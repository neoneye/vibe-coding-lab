"""The period-two and period-three branches, certified over pressure intervals.

The pressure section of this directory is exploratory numerics: gradient
descent from structured seeds, reporting the lowest branch found.  A review made
the point that a crossing of two numerically selected branches is not a certified
transition, and asked for the branches themselves to be certified over an
interval of pressures first.  This does that much.

For a whole INTERVAL of pressures at once, a Krawczyk test on the stationarity
system proves that a branch exists and is unique in an explicit box, and a
verified Cholesky on the interval Hessian proves it is a strict local minimum
there.  Both are done in Arb.  Period two is a two-variable system; period three
is a three-variable one, and its ring energy wraps the lag-six interaction round
the period, which is what a period-three CHAIN does too.

What this does NOT do, and it is the whole of the gap the review named: it says
nothing about configurations off these two branches.  Excluding every other
configuration near the crossing needs a transfer-operator or coboundary bound,
which is not here.  So "the branches cross at 3370.45" becomes "two certified
branches cross at 3370.45", and the step from that to "the ground state changes
period there" is still missing.

Run:  python3 dev/branch_arb.py
"""

import hashlib
import json
import os
import sys

from flint import arb, arb_mat, ctx

import arb_provenance

SOURCES = [
    "arb_provenance.py",
    "branch_arb.py",
    "coercivity_arb.py",
    "kink_arb.py",
]

import coercivity_arb as C
import kink_arb as K

ctx.prec = 300


def set_pressure(p):
    """alpha = 6/p, as an interval when p is one."""
    C.ALPHA = arb(6) / p
    K.ALPHA = arb(6) / p


def krawczyk(F, J, mid, box):
    """Generic Krawczyk: F and J are callables on a vector of balls."""
    n = len(mid)
    Fm = F(mid)
    Jm = J(mid)
    M = arb_mat([[arb(Jm[a][b].mid()) for b in range(n)] for a in range(n)])
    Cinv = M.inv()
    Cm = [[arb(Cinv[a, b].mid()) for b in range(n)] for a in range(n)]
    Jx = J(box)
    r = [box[a] - mid[a] for a in range(n)]
    out = []
    inside = True
    for a in range(n):
        acc = arb(0)
        for k in range(n):
            acc -= Cm[a][k] * Fm[k]
        acc += mid[a]
        for b in range(n):
            e = arb(1 if a == b else 0)
            for k in range(n):
                e -= Cm[a][k] * Jx[k][b]
            if not e.is_zero():
                acc += e * r[b]
        out.append(acc)
        if not (arb(acc.lower()) > arb(box[a].lower())
                and arb(acc.upper()) < arb(box[a].upper())):
            inside = False
    return inside, out


def two_cycle_newton(p, seed):
    set_pressure(arb(p))
    L, H = arb(seed[0]), arb(seed[1])
    for _ in range(120):
        dL, dH = C.gradient(L, H)
        J = C.jacobian(L, H)
        det = J[0][0] * J[1][1] - J[0][1] * J[1][0]
        L = arb((L - (J[1][1] * dL - J[0][1] * dH) / det).mid())
        H = arb((H - (-J[1][0] * dL + J[0][0] * dH) / det).mid())
    return L, H


def ring_newton(p, seed, n):
    set_pressure(arb(p))
    g = [arb(x) for x in seed]
    return K.newton(g, steps=80, tol=1e-120)


def certify_two(p_lo, p_hi, halfwidth):
    """Existence, uniqueness and strict local minimality of the period-two
    branch for EVERY pressure in [p_lo, p_hi]."""
    mid_p = (p_lo + p_hi) / 2
    L0, H0 = two_cycle_newton(mid_p, (1.0416801034484870, 1.9794672314032244))
    set_pressure(arb((p_lo + p_hi) / 2, (p_hi - p_lo) / 2))
    mid = [arb(L0.mid()), arb(H0.mid())]
    box = [arb(L0.mid(), halfwidth), arb(H0.mid(), halfwidth)]

    def F(v):
        a, b = C.gradient(v[0], v[1])
        return [a, b]

    def J(v):
        return C.jacobian(v[0], v[1])

    proved, image = krawczyk(F, J, mid, box)
    # Iterating tightens the enclosure; the energy comparison at the crossing
    # needs a box far narrower than the one existence is proved in, because the
    # interval evaluation of the energy is first order in the box width and the
    # difference being tested is around 1e-6.
    if proved:
        for _ in range(4):
            nxt = [box[a].intersection(image[a]) for a in range(2)]
            if max(float(x.rad()) for x in nxt) >= max(float(x.rad()) for x in box):
                break
            box = nxt
            ok, image = krawczyk(F, J, [arb(x.mid()) for x in box], box)
            if not ok:
                break
    Hs = J(box)
    pd = K.cholesky_positive_definite([[Hs[a][b] for b in range(2)] for a in range(2)])
    energy = C.energy(box[0], box[1])
    return {"proved": proved, "pd": pd, "box": box, "energy": energy}


def certify_ring(p_lo, p_hi, seed, halfwidth):
    """Same, for a period-n branch, n = len(seed)."""
    n = len(seed)
    mid_p = (p_lo + p_hi) / 2
    g0 = ring_newton(mid_p, seed, n)
    set_pressure(arb((p_lo + p_hi) / 2, (p_hi - p_lo) / 2))
    mid = [arb(x.mid()) for x in g0]
    box = [arb(x.mid(), halfwidth) for x in g0]
    proved, image = krawczyk(K.ring_gradient, K.ring_hessian, mid, box)
    if proved:
        for _ in range(4):
            nxt = [box[a].intersection(image[a]) for a in range(n)]
            if max(float(x.rad()) for x in nxt) >= max(float(x.rad()) for x in box):
                break
            box = nxt
            ok, image = krawczyk(K.ring_gradient, K.ring_hessian,
                                 [arb(x.mid()) for x in box], box)
            if not ok:
                break
    pd = K.cholesky_positive_definite(K.ring_hessian(box))
    energy = K.ring_energy_total(box) / n
    return {"proved": proved, "pd": pd, "box": box, "energy": energy}


CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok)))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def main():
    print("Arb, %d bits.  Branches certified over pressure intervals.\n" % ctx.prec)

    for lo, hi, hw in ((2900.0, 3100.0, 1e-4), (3300.0, 3450.0, 1e-4),
                       (1400.0, 1600.0, 2e-4)):
        r = certify_two(lo, hi, hw)
        check("a unique period-two branch exists for every p in [%g, %g]" % (lo, hi),
              r["proved"], "box halfwidth %g" % hw)
        check("and it is a strict local minimum throughout", r["pd"])

    for lo, hi, hw in ((3300.0, 3450.0, 3e-4),):
        r = certify_ring(lo, hi, (1.0436, 1.9923, 1.9923), hw)
        check("a unique period-three branch exists for every p in [%g, %g]"
              % (lo, hi), r["proved"], "box halfwidth %g" % hw)
        check("and it is a strict local minimum throughout", r["pd"])

    # the crossing, from certified branches
    # A point pressure, not an interval: the branch certification above already
    # covers the interval, and the energy comparison wants no avoidable width.
    lo_p, hi_p = 3360.0, 3380.0
    e2 = []
    e3 = []
    for p in (lo_p, hi_p):
        a = certify_two(p, p, 1e-4)
        b = certify_ring(p, p, (1.0436, 1.9923, 1.9923), 3e-4)
        e2.append(a)
        e3.append(b)
        check("both branches certified at p = %g" % p,
              a["proved"] and a["pd"] and b["proved"] and b["pd"])
    d_lo = e2[0]["energy"] - e3[0]["energy"]
    d_hi = e2[1]["energy"] - e3[1]["energy"]
    check("E_2 - E_3 is certainly negative at p = %g" % lo_p, d_lo < 0,
          d_lo.str(8))
    check("and certainly positive at p = %g" % hi_p, d_hi > 0, d_hi.str(8))
    check("so the two CERTIFIED branches cross somewhere in between",
          d_lo < 0 and d_hi > 0,
          "which is not the same as the ground state changing period there -- "
          "nothing here excludes other configurations")

    bad = [c for c in CHECKS if not c[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(bad)))
    if not bad:
        here = os.path.dirname(os.path.abspath(__file__))

        json.dump({
            "what": "period-two and period-three branches certified over pressure intervals",
            "engine": "python-flint / Arb, %d bits" % ctx.prec,
            "inputs": arb_provenance.hash_inputs(SOURCES),
            "replay": "python3 dev/branch_arb.py   (needs python-flint)",
            "crossing_bracket": [lo_p, hi_p],
            "E2_minus_E3": {str(lo_p): d_lo.str(12), str(hi_p): d_hi.str(12)},
            "not_established": "that the ground state changes period at the "
                               "crossing; nothing here excludes configurations "
                               "off these two branches",
            "checks": [{"name": n, "ok": ok} for n, ok in CHECKS],
        }, open(os.path.join(here, "branch_arb.results.json"), "w"),
            indent=2, sort_keys=True)
        print("wrote dev/branch_arb.results.json")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
