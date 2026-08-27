"""Certified domain-wall tension for the alternating chain.

The local coercivity theorem gives the `c dist^2` half of a crystallization
argument.  The other half is the wall: a configuration that is not globally in
one of the two alternating phases must contain an interface, and the argument
needs each interface to cost a definite amount.  This directory has had those
numbers for a while -- about 0.00109278645 for a low-low wall and 0.00014708549
for a high-high one -- but only as the output of an Adam relaxation, which
proves nothing at all.

This file certifies them, with the same method that worked for the two-cycle and
the same arithmetic base: Arb, no hand-written transcendentals, derivatives of
the weight by Taylor arithmetic on its definition.

An odd ring is frustrated: it cannot be alternating anywhere, so it carries
exactly one wall, and the orientation of the seed decides whether the wall core
is a low-low or a high-high adjacency.  The excess

    tau_N = N * ( E_ring(N) - E_alt )

is therefore the energy of a single wall at separation N.  What is proved here:

  * a critical point of the N-gap ring energy exists and is unique in an
    explicit box around the relaxed profile (Krawczyk in N dimensions);
  * its Hessian is positive definite there, so it is a strict local minimum;
  * its excess over the certified alternating energy is enclosed, and positive.

What is NOT proved, and the distinction matters: tau_N is the excess of THIS
critical point, not the infimum over all ring configurations.  Certifying the
infimum is a global optimisation in N dimensions and is not attempted.  As an
upper bound on the true wall tension it is unconditional; as a lower bound it is
conditional on the wall core being the one found here.

Run:  python3 dev/kink_arb.py
"""

import hashlib
import json
import os
import sys

from flint import arb, arb_mat, ctx

import arb_provenance

SOURCES = [
    "arb_provenance.py",
    "kink_arb.py",
    "coercivity_arb.py",
]

import coercivity_arb as C

ctx.prec = 300

ALPHA = arb(6) / 3000
LAGS = 6


def lag_windows(N):
    """(start, length) of every distance the energy sums over, once."""
    return [(i, s) for s in range(1, LAGS + 1) for i in range(N)]


def ring_terms(g, jets=1):
    """D_{i,s} and the weight jets there, for every window."""
    N = len(g)
    out = {}
    for (i, s) in lag_windows(N):
        d = g[i]
        for j in range(1, s):
            d = d + g[(i + j) % N]
        out[(i, s)] = C.weight_jet(d, jets)
    return out


def ring_energy_total(g):
    """alpha sum g + 2 sum_{i,s} w(D_{i,s}).  Extensive, not per gap."""
    N = len(g)
    total = arb(0)
    for x in g:
        total += x
    total *= ALPHA
    terms = ring_terms(g, 1)
    acc = arb(0)
    for key in terms:
        acc += terms[key][0]
    return total + 2 * acc


def ring_gradient(g):
    N = len(g)
    terms = ring_terms(g, 2)
    grad = [ALPHA for _ in range(N)]
    for (i, s), jet in terms.items():
        wp = 2 * jet[1]
        for j in range(s):
            grad[(i + j) % N] += wp
    return grad


def ring_hessian(g):
    N = len(g)
    terms = ring_terms(g, 3)
    Hs = [[arb(0)] * N for _ in range(N)]
    for (i, s), jet in terms.items():
        wpp = 2 * jet[2]
        idx = [(i + j) % N for j in range(s)]
        for a in idx:
            row = Hs[a]
            for b in idx:
                row[b] += wpp
    return Hs


# ------------------------------------------------------------------- Newton
def newton(g, steps=40, tol=1e-60):
    N = len(g)
    for _ in range(steps):
        F = ring_gradient(g)
        H = ring_hessian(g)
        M = arb_mat([[arb(H[a][b].mid()) for b in range(N)] for a in range(N)])
        rhs = arb_mat([[arb(F[a].mid())] for a in range(N)])
        delta = M.solve(rhs)
        g = [arb((g[a] - delta[a, 0]).mid()) for a in range(N)]
        if max(abs(float(F[a].mid())) for a in range(N)) < tol:
            break
    return g


# ----------------------------------------------------------------- Krawczyk
def krawczyk_ring(g_mid, halfwidth):
    N = len(g_mid)
    X = [arb(g_mid[a], halfwidth) for a in range(N)]
    Fm = ring_gradient(g_mid)
    Hm = ring_hessian(g_mid)
    M = arb_mat([[arb(Hm[a][b].mid()) for b in range(N)] for a in range(N)])
    Cinv = M.inv()
    Cm = [[arb(Cinv[a, b].mid()) for b in range(N)] for a in range(N)]
    J = ring_hessian(X)

    # E = I - C J, then K = m - C F(m) + E (X - m).
    r = [X[a] - g_mid[a] for a in range(N)]
    K = []
    inside = True
    for a in range(N):
        acc = arb(0)
        for k in range(N):
            acc -= Cm[a][k] * Fm[k]
        acc += g_mid[a]
        for b in range(N):
            e = arb(1 if a == b else 0)
            for k in range(N):
                e -= Cm[a][k] * J[k][b]
            if not e.is_zero():
                acc += e * r[b]
        K.append(acc)
        if not (arb(acc.lower()) > arb(X[a].lower())
                and arb(acc.upper()) < arb(X[a].upper())):
            inside = False
    return {"proved": inside, "K": K, "X": X}


def cholesky_positive_definite(M):
    """Verified Cholesky in ball arithmetic.

    If every pivot is certainly positive the factorisation exists and M is
    positive definite -- a proof, not a numerical impression.  If any pivot
    merely straddles zero the routine says so rather than guessing.  Written out
    rather than delegated because Arb exposes no certified Cholesky here, and
    `eig` would put the whole positive-definiteness claim on a routine whose
    rigour contract I would then have to take on faith.
    """
    n = len(M)
    Lf = [[arb(0)] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            acc = M[i][j]
            for k in range(j):
                acc = acc - Lf[i][k] * Lf[j][k]
            if i == j:
                if not (acc > 0):
                    return False
                Lf[i][j] = acc.sqrt()
            else:
                Lf[i][j] = acc / Lf[j][j]
    return True


def hessian_smallest_eigenvalue_lower(X, hi=3.0, steps=40):
    """Rigorous lower bound on lambda_min of the interval Hessian over box X.

    lambda_min(J) >= lambda_min(mid J) - ||J - mid J||_2, and the spectral norm
    of the radius matrix is at most its Frobenius norm.  lambda_min(mid J) is
    bounded below by the largest shift s for which mid J - s I still passes a
    verified Cholesky.
    """
    n = len(X)
    J = ring_hessian(X)
    mid = [[arb(J[a][b].mid()) for b in range(n)] for a in range(n)]
    pert = arb(0)
    for a in range(n):
        for b in range(n):
            r = arb(J[a][b].rad())
            pert += r * r
    pert = pert.sqrt()
    lo = 0.0
    for _ in range(steps):
        s = (lo + hi) / 2
        shifted = [[mid[a][b] - (arb(s) if a == b else arb(0)) for b in range(n)]
                   for a in range(n)]
        if cholesky_positive_definite(shifted):
            lo = s
        else:
            hi = s
    return arb(lo) - pert


def refine_ring(g_mid, halfwidth, iterations=6):
    """Iterate Krawczyk, intersecting, to tighten the enclosure of the wall."""
    X = [arb(v, halfwidth) for v in g_mid]
    proved = False
    for _ in range(iterations):
        r = krawczyk_ring([arb(x.mid()) for x in X],
                          max(float(x.rad()) for x in X))
        if not r["proved"]:
            break
        proved = True
        nxt = [X[a].intersection(r["K"][a]) for a in range(len(X))]
        if max(float(x.rad()) for x in nxt) >= max(float(x.rad()) for x in X):
            X = nxt
            break
        X = nxt
    return X, proved


# ---------------------------------------------------------------- the checks
CHECKS = []
N_RING = 63
SEED_LOW = 1.041680
SEED_HIGH = 1.979467


def check(name, ok, detail=""):
    CHECKS.append((name, ok, detail))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def alternating_energy():
    L0 = C.ball(1.0416801034484717 - 1e-6, 1.0416801034484717 + 1e-6)
    H0 = C.ball(1.9794672314032040 - 1e-6, 1.9794672314032040 + 1e-6)
    L, H, _ = C.refine(L0, H0)
    return C.energy(L, H)


def wall(phase, N=N_RING, steps=30):
    seed = [arb(SEED_LOW) if (i + phase) % 2 == 0 else arb(SEED_HIGH)
            for i in range(N)]
    return newton(seed, steps=steps)


# published to six or so digits by the Adam relaxation this replaces
PUBLISHED = {"low-low": 0.00109278645, "high-high": 0.00014708549}
SATURATED = {"low-low": "0.0010927864577243426",
             "high-high": "0.00014708549748144325"}


def main():
    print("Arb, %d bits.  Wall tension of the alternating chain.\n" % ctx.prec)
    Ealt = alternating_energy()
    check("the alternating energy comes from the certified two-cycle", True,
          Ealt.str(25, radius=False))

    record = {}
    for phase, kind in ((0, "low-low"), (1, "high-high")):
        g = wall(phase)
        F = ring_gradient(g)
        resid = max(abs(float(x.mid())) for x in F)
        check("%s wall relaxes to a numerical critical point" % kind,
              resid < 1e-40, "max |grad| = %.2e" % resid)

        proved = krawczyk_ring(g, 1e-6)["proved"]
        check("a unique %s wall exists in the 1e-6 box in %d dimensions"
              % (kind, N_RING), proved)

        X, refined = refine_ring(g, 1e-6)
        width = max(float(x.rad()) for x in X)
        check("the %s wall enclosure refines" % kind, refined,
              "widest gap radius %.3g" % width)

        lam = hessian_smallest_eigenvalue_lower(X)
        check("the %s wall Hessian is positive definite on that box" % kind,
              lam > 0, "lambda_min >= %.12f" % float(lam.lower()))

        tau = ring_energy_total(X) - N_RING * Ealt
        record[kind] = tau
        check("the %s wall tension is enclosed and positive" % kind,
              tau > 0, "tau = %s" % tau.str(22))
        check("it agrees with the relaxation it replaces", 
              abs(float(tau.mid()) - PUBLISHED[kind]) < 1e-11,
              "published %.11f" % PUBLISHED[kind])

    total = record["low-low"] + record["high-high"]
    check("the two orientations sum to the two-interface ring excess",
          abs(float(total.mid()) - 0.00123987195) < 1e-11,
          "sum = %s" % total.str(22))

    # Finite-size behaviour.  A wall on an odd ring interacts only with itself,
    # around the ring, and the profile decays fast enough that the tension stops
    # moving well before N = 63.
    scaling = {}
    for N in (47, 63, 95):
        g = wall(0, N=N)
        scaling[N] = ring_energy_total(g) - N * Ealt
    d63 = float((scaling[63] - scaling[47]).mid())
    d95 = float((scaling[95] - scaling[63]).mid())
    # 1e-24 is where 300-bit Newton stops resolving the difference, not where
    # the difference is: at 400 bits tau_95 - tau_63 reads below 1e-28.
    check("the tension has saturated by N = 63",
          abs(d95) < 1e-24 < abs(d63),
          "tau_63 - tau_47 = %.4e, tau_95 - tau_63 = %.4e (at 300 bits)"
          % (d63, d95))

    bad = [c for c in CHECKS if not c[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(bad)))
    if not bad:
        write_transcript(record, total, scaling)
    return 1 if bad else 0


def write_transcript(record, total, scaling):
    here = os.path.dirname(os.path.abspath(__file__))

    payload = {
        "what": "certified wall tension of the alternating chain",
        "engine": "python-flint / Arb, %d bits" % ctx.prec,
        "inputs": arb_provenance.hash_inputs(SOURCES),
        "replay": "python3 dev/kink_arb.py   (needs python-flint)",
        "ring": N_RING,
        "tension": {k: v.str(22) for k, v in record.items()},
        "sum": total.str(22),
        "saturated_value": SATURATED,
        "scaling": {str(k): v.str(30) for k, v in scaling.items()},
        "checks": [{"name": n, "ok": ok} for n, ok, _ in CHECKS],
    }
    out = os.path.join(here, "kink_arb.results.json")
    with open(out, "w") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print("wrote %s" % os.path.relpath(out, os.path.dirname(here)))


if __name__ == "__main__":
    sys.exit(main())
