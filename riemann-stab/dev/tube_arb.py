"""The tube half of the crystallization argument, in Arb.

A review made the point that "interval arithmetic throughout" was not true of
dev/tiling_pair_local.js -- it contained ordinary rounded arithmetic used as
exact enclosures -- and that even repaired, the whole thing still stands on
tiling_rigorous.js, which is mine.  The repair is done; this is the second half
of the answer: the same theorem on an arithmetic base that is not mine.

Arb (python-flint), midpoint-radius balls with proved enclosures, Arb's own
sine, and the derivatives of w by Taylor-series arithmetic on its definition
rather than by hand.  The certificate coefficients are doubles and enter Arb
exactly.  Nothing here uses tiling_rigorous.js.

Smoothness is a precondition, not an assumption: the additive potential is
piecewise linear and psi is bilinear, so both are only CONTINUOUS across their
knot lines and a Taylor argument across one is nonsense.  The file computes the
clearance of the alternating gaps from their nearest knots in BOTH grids and
refuses any radius that exceeds it.

Run:  python3 dev/tube_arb.py
"""

import hashlib
import json
import os
import sys

from flint import arb, ctx

import arb_provenance

SOURCES = [
    "arb_provenance.py",
    "tube_arb.py",
    "coercivity_arb.py",
    "tiling_pair.stationary.json",
    "tiling_additive.certificate.json",
]

import coercivity_arb as C

ctx.prec = 300

NPTS = 7
PAIRS = [(i, j) for i in range(NPTS) for j in range(i + 1, NPTS)]
SIGN_A = [1, 0, -1, -1, 0, 1]
SIGN_B = [0, 1, -1, -1, 1, 0]
LOW = 1.0416801034484870
HIGH = 1.9794672314032244
E_ALT = "0.003957393309109343844588308250635018628261217786065732772034"


def load():
    here = os.path.dirname(os.path.abspath(__file__))
    cand = json.load(open(os.path.join(here, "tiling_pair.stationary.json")))
    bundle = json.load(open(os.path.join(here, "tiling_additive.certificate.json")))
    certs = bundle["certificates"]
    base = next(e for e in (certs.values() if isinstance(certs, dict) else certs)
                if e["name"] == cand["base"])
    J = len(cand["knots"])
    mats = [cand["coefficients"][k * J * J:(k + 1) * J * J] for k in range(cand["free"])]
    tail = [-sum(m[i] for m in mats) for i in range(J * J)]
    return cand, base, mats + [tail], J


def cell_of(knots, x):
    if not (knots[0] < x < knots[-1]):
        raise ValueError("outside the knot range")
    lo, hi = 0, len(knots) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if knots[mid] <= x:
            lo = mid
        else:
            hi = mid
    return lo


def clearance(knots, x):
    i = cell_of(knots, x)
    return min(x - knots[i], knots[i + 1] - x)


def piecewise_linear(knots, coeffs, x):
    i = cell_of(knots, float(x.mid()))
    t0, t1 = arb(knots[i]), arb(knots[i + 1])
    c0, c1 = arb(coeffs[i]), arb(coeffs[i + 1])
    slope = (c1 - c0) / (t1 - t0)
    return c0 + slope * (x - t0), slope


def bilinear(knots, grid, J, x, y):
    i = cell_of(knots, float(x.mid()))
    j = cell_of(knots, float(y.mid()))
    hx = arb(knots[i + 1]) - arb(knots[i])
    hy = arb(knots[j + 1]) - arb(knots[j])
    u = (x - arb(knots[i])) / hx
    v = (y - arb(knots[j])) / hy
    c00, c01 = arb(grid[i * J + j]), arb(grid[i * J + j + 1])
    c10, c11 = arb(grid[(i + 1) * J + j]), arb(grid[(i + 1) * J + j + 1])
    value = (1 - u) * ((1 - v) * c00 + v * c01) + u * ((1 - v) * c10 + v * c11)
    dx = ((1 - v) * (c10 - c00) + v * (c11 - c01)) / hx
    dy = ((1 - u) * (c01 - c00) + u * (c11 - c10)) / hy
    cross = (c11 - c10 - c01 + c00) / (hx * hy)
    return value, dx, dy, cross


def prefix(g):
    p = [arb(0)]
    for x in g:
        p.append(p[-1] + x)
    return p


def reduced_cost(g, base, mats, knots, J, alpha):
    p = prefix(g)
    total = arb(0)
    for x in g:
        total += x
    total *= alpha
    grad = [arb(alpha) for _ in range(6)]
    for (i, j) in PAIRS:
        d = p[j] - p[i]
        jet = C.weight_jet(d, 2)
        c = arb(2) / (NPTS - (j - i))
        total += c * jet[0]
        for k in range(i, j):
            grad[k] += c * jet[1]
    for i in range(6):
        if SIGN_A[i]:
            v, s = piecewise_linear(base["knots"], base["a"], g[i])
            total += SIGN_A[i] * v
            grad[i] += SIGN_A[i] * s
        if SIGN_B[i]:
            v, s = piecewise_linear(base["knots"], base["b"], g[i])
            total += SIGN_B[i] * v
            grad[i] += SIGN_B[i] * s
    for k in range(5):
        v, dx, dy, _ = bilinear(knots, mats[k], J, g[k], g[k + 1])
        total += v
        grad[k] += dx
        grad[k + 1] += dy
    return total, grad


def hessian(g, knots, mats, J):
    p = prefix(g)
    H = [[arb(0)] * 6 for _ in range(6)]
    for (i, j) in PAIRS:
        second = C.weight_jet(p[j] - p[i], 3)[2] * (arb(2) / (NPTS - (j - i)))
        for a in range(i, j):
            for b in range(i, j):
                H[a][b] = H[a][b] + second
    for k in range(5):
        _, _, _, cross = bilinear(knots, mats[k], J, g[k], g[k + 1])
        H[k][k + 1] = H[k][k + 1] + cross
        H[k + 1][k] = H[k + 1][k] + cross
    return H


def cholesky_pd(M, n):
    L = [[arb(0)] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            acc = M[i][j]
            for k in range(j):
                acc = acc - L[i][k] * L[j][k]
            if i == j:
                if not (acc > 0):
                    return False
                L[i][j] = acc.sqrt()
            else:
                L[i][j] = acc / L[j][j]
    return True


def smallest_eigenvalue_lower(H, n, hi=6.0, steps=36):
    lo = 0.0
    for _ in range(steps):
        s = (lo + hi) / 2
        shifted = [[H[a][b] - (arb(s) if a == b else arb(0)) for b in range(n)]
                   for a in range(n)]
        if cholesky_pd(shifted, n):
            lo = s
        else:
            hi = s
    return arb(lo)


def certify(radius, cuts):
    cand, base, mats, J = load()
    knots = cand["knots"]
    # The BLOCK functional's linear term is (sum g)/p, not (6/p)(sum g): the
    # 6/p form belongs to the per-gap chain average.  The first run of this file
    # used the chain one and R came out 0.0151057 too high, which is exactly
    # (L+H)/2 * 5/3000 -- the test caught it because the gradient at a critical
    # point is supposed to vanish and did not.
    alpha = arb(1) / 3000
    centre = [arb(LOW) if i % 2 == 0 else arb(HIGH) for i in range(6)]

    clear = min(min(clearance(knots, float(x.mid())) for x in centre),
                min(clearance(base["knots"], float(x.mid())) for x in centre))
    if radius >= clear:
        return {"holds": False, "reason": "tube crosses a knot line",
                "clearance": clear}

    value, grad = reduced_cost(centre, base, mats, knots, J, alpha)
    sq = arb(0)
    for x in grad:
        sq += x * x
    grad_norm = sq.sqrt()

    half = arb(radius) / cuts
    lam = [None]
    box = [None] * 6

    def walk(k):
        if lam[0] is not None and not (lam[0] > 0):
            return
        if k == 6:
            v = smallest_eigenvalue_lower(hessian(box, knots, mats, J), 6)
            if lam[0] is None or v < lam[0]:
                lam[0] = v
            return
        for i in range(cuts):
            mid = centre[k] - radius + half * (2 * i + 1)
            box[k] = arb(mid.mid(), float(half.upper()) * (1 + 1e-12))
            walk(k + 1)

    walk(0)
    lam = lam[0]
    ealt = arb(E_ALT)
    deficit = ealt - value
    worst = (-deficit - grad_norm * grad_norm / (2 * lam)) if lam > 0 else None
    return {"holds": bool(lam > 0), "radius": radius, "cuts": cuts,
            "clearance": clear, "lambda": lam, "value": value,
            "grad_norm": grad_norm, "deficit": deficit, "worst": worst}


CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok)))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def main():
    print("Arb, %d bits.  The tube, on a base that is not tiling_rigorous.js.\n"
          % ctx.prec)
    cand, base, mats, J = load()
    centre = [arb(LOW) if i % 2 == 0 else arb(HIGH) for i in range(6)]
    clear = min(min(clearance(cand["knots"], float(x.mid())) for x in centre),
                min(clearance(base["knots"], float(x.mid())) for x in centre))
    check("the alternating gaps sit strictly inside a cell of both grids",
          clear > 0.02, "clearance %.6f" % clear)

    bad = certify(clear * 1.01, 2)
    check("a tube crossing a knot line is refused, not certified",
          bad.get("reason") == "tube crosses a knot line")

    alpha = arb(1) / 3000
    value, grad = reduced_cost(centre, base, mats, cand["knots"], J, alpha)
    check("R at the alternating block is enclosed", float(value.rad()) < 1e-30,
          "R - E_alt = %s" % (value - arb(E_ALT)).str(8))
    sq = arb(0)
    for x in grad:
        sq += x * x
    check("and the gradient there is enclosed near zero",
          float(sq.sqrt().upper()) < 1e-14, "|grad| <= %.3e" % float(sq.sqrt().upper()))

    results = []
    for radius, cuts in ((0.003, 3), (0.005, 4), (0.008, 6)):
        r = certify(radius, cuts)
        results.append((radius, r))
        check("the Hessian is positive definite over the radius-%g tube" % radius,
              r["holds"], "lambda >= %.6f" % float(r["lambda"].lower()))
        check("so R >= E_alt - %.3e there" % float((-r["worst"]).upper()),
              float((-r["worst"]).upper()) < 1e-10,
              "Arb, no tiling_rigorous.js anywhere in this file")

    js = 1.163e-11
    best = min(float((-r["worst"]).upper()) for _, r in results)
    check("Arb confirms the JavaScript tube result rather than merely agreeing "
          "with its style", best < 2 * js,
          "Arb %.3e against the JavaScript's %.3e" % (best, js))

    failed = [c for c in CHECKS if not c[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(failed)))
    if not failed:
        here = os.path.dirname(os.path.abspath(__file__))

        payload = {
            "what": "the tube half of the crystallization argument, certified in Arb",
            "engine": "python-flint / Arb, %d bits" % ctx.prec,
            "inputs": arb_provenance.hash_inputs(SOURCES),
            "replay": "python3 dev/tube_arb.py   (needs python-flint)",
            "clearance": clear,
            "tubes": [{"radius": radius, "cuts": r["cuts"],
                       "lambda_lower": float(r["lambda"].lower()),
                       "shortfall_upper": float((-r["worst"]).upper())}
                      for radius, r in results],
            "checks": [{"name": n, "ok": ok} for n, ok in CHECKS],
        }
        out = os.path.join(here, "tube_arb.results.json")
        with open(out, "w") as fh:
            json.dump(payload, fh, indent=2, sort_keys=True)
            fh.write("\n")
        print("wrote dev/tube_arb.results.json")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
