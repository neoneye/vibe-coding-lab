"""Is the coexistence pair actually MINIMISING?  Ergodic optimisation, by orbit.

A calibrated coboundary at p* -- a telescoping R = F6 + (coboundary) with
R >= c everywhere and R = c on BOTH the period-two and the period-three cycle --
was the most promising remaining stone.  Direct search for one kept failing, and
a linear programme that fails proves nothing.

But the question has a dual that can be attacked head on.  A telescoping
certificate with floor c exists only if c is a LOWER BOUND for the mean of F6
over every shift-invariant measure: the coboundary averages to zero against any
such measure, so mean(R) = mean(F6) >= c.  Periodic orbits give shift-invariant
measures, so a single periodic configuration whose mean F6 falls below c REFUTES
the calibration outright, and no amount of LP tuning could have saved it.

That turns an existence search into a falsification search, which is the version
one can actually finish.  This file minimises the mean of F6 over cyclic
configurations of every period n from 1 to 14 at p = p*, from many random
starts, and compares each period's minimum with c.

    python3 rotation_scan.py [max_period] [starts]

Floating point and heuristic, like the rest of the search tooling: it can only
find a violation, never certify its absence.  Anything it finds at or below c
goes to Arb.
"""
import json
import sys

import numpy as np
from scipy.optimize import minimize

import tiling_pair_search as S

CR = json.load(open('/tmp/crossing.json')) if False else None
PSTAR = 3370.45072122464652329745482382
CVAL = 0.00362533155996670429057063948581
L2, H2 = 1.04169234344603807974458211280, 1.97951736547147545342996611320
A3 = [1.04357449864562926570088915967,
      1.99228636958083645860460242077,
      1.99228636958083645860460242077]
S.P = PSTAR


def windows(g, n):
    """The n cyclic windows of six gaps of the period-n configuration g."""
    idx = (np.arange(n)[:, None] + np.arange(6)[None, :]) % n
    return g[idx], idx


def mean_grad(g, n):
    W, idx = windows(np.asarray(g, float), n)
    val, gr = S.f6_grad(W)
    out = np.zeros(n)
    np.add.at(out, idx.ravel(), gr.ravel())
    return float(val.mean()), out / n


def relax(g0, n, steps=600):
    def fun(x):
        v, gr = mean_grad(x, n)
        return v, gr
    r = minimize(fun, np.asarray(g0, float), jac=True, method='L-BFGS-B',
                 bounds=[(0.05, 12.0)] * n,
                 options={'maxiter': steps, 'ftol': 1e-18, 'gtol': 1e-14})
    return float(r.fun), r.x


def seeds(n, m, rng):
    """Bands around the two cycle values, plus wide random, plus the cycles."""
    out = []
    if n % 2 == 0:
        out.append(np.array([L2, H2] * (n // 2)))
    if n % 3 == 0:
        out.append(np.array((A3 * (n // 3))[:n]))
    band = rng.uniform(0, 1, size=(m, n)) < 0.5
    out.append(np.where(band, rng.uniform(0.95, 1.15, size=(m, n)),
                        rng.uniform(1.9, 2.15, size=(m, n))))
    out.append(rng.uniform(0.3, 4.5, size=(m // 2, n)))
    out.append(rng.uniform(0.6, 2.6, size=(m // 2, n)))
    return np.vstack([np.atleast_2d(x) for x in out])


def main():
    nmax = int(sys.argv[1]) if len(sys.argv) > 1 else 14
    starts = int(sys.argv[2]) if len(sys.argv) > 2 else 400
    rng = np.random.default_rng(4242)
    print("p* = %.15f    c = %.20f" % (PSTAR, CVAL))
    print("minimum mean F6 over period-n cyclic configurations\n")
    print("  n   min mean F6            min - c        pattern")
    rows = []
    worst = (np.inf, None, None)
    for n in range(1, nmax + 1):
        best = (np.inf, None)
        for g0 in seeds(n, starts, rng):
            v, x = relax(g0, n)
            if v < best[0]:
                best = (v, x)
        v, x = best
        # Canonical form: rotate so the smallest gap comes first.
        x = np.roll(x, -int(np.argmin(x)))
        pat = " ".join("%.4f" % t for t in x[:6]) + (" ..." if n > 6 else "")
        flag = ""
        if v < CVAL - 1e-13:
            flag = "   <-- BELOW c"
        elif abs(v - CVAL) <= 1e-13:
            flag = "   == c"
        print("  %2d  %.18f  %+.3e  %s%s" % (n, v, v - CVAL, pat, flag))
        rows.append({"n": n, "mean": v, "excess": v - CVAL, "gaps": x.tolist()})
        if v < worst[0]:
            worst = (v, n, x)
    v, n, x = worst
    print("\nlowest over all periods: n = %d at %.18f, which is c %+.3e"
          % (n, v, v - CVAL))
    if v < CVAL - 1e-13:
        print("A configuration BELOW c exists -- the calibration is refuted.")
    else:
        print("Nothing found below c: no periodic orbit refutes the calibration.")
    json.dump({"p": PSTAR, "c": CVAL, "rows": rows}, open('/tmp/rotation.json', 'w'))
    print("wrote /tmp/rotation.json")


if __name__ == '__main__':
    main()


# ---------------------------------------------------------------- the sweep
# The scan above asks one question at p*.  The sharper question is whether the
# crossing at p* is an exchange of GLOBAL minimisers -- over every periodic
# orbit, not merely between the two branches that were being tracked.  If the
# period-two orbit is the strict minimum for p < p*, the period-three orbit for
# p > p*, and every other period is strictly above at both, then p* is a genuine
# first-order transition point of the whole variational problem and not an
# artefact of having looked at two candidates.
def sweep(pressures, nmax=8, starts=120, seed=99):
    rng = np.random.default_rng(seed)
    out = []
    print("  p            n*  min mean F6           runner-up n  margin")
    for p in pressures:
        S.P = float(p)
        best = []
        for n in range(1, nmax + 1):
            b = np.inf
            for g0 in seeds(n, starts, rng):
                v, _ = relax(g0, n)
                b = min(b, v)
            best.append((b, n))
        best.sort()
        # A period that is a multiple of the winner realises the SAME measure,
        # so the honest runner-up is the first period that is not a multiple.
        n0 = best[0][1]
        alt = next((x for x in best[1:] if x[1] % n0 != 0), best[-1])
        out.append({"p": float(p), "n": n0, "min": best[0][0],
                    "runner_n": alt[1], "margin": alt[0] - best[0][0]})
        print("  %-11.2f  %2d  %.18f  %2d          %+.3e"
              % (p, n0, best[0][0], alt[1], alt[0] - best[0][0]))
    return out


# ------------------------------------------- the interface, at finite spacing
# dev/interface_arb.py measures the cost of a single 2|3 interface in isolation:
# tau_23 = 1.7477e-5, saturated from N = 84 out to N = 156, so that is the value
# at infinite separation.  A short mixed orbit is the same interface at FINITE
# separation, and its excess says how two interfaces at that spacing interact.
#
# For a period-n orbit that mixes the two patterns there are exactly two
# interfaces per period, so
#
#     tau_eff(n) = n * (m(n) - c) / 2
#
# with m(n) the minimum mean F6 over period n.  tau_eff(n) -> tau_23 is the only
# thing the isolated computation guarantees; HOW it approaches -- from below,
# from above, or oscillating -- is a different question, and with an oscillatory
# pair kernel there is no reason to expect it to be monotone.  It matters
# because tau_eff(n) < 0 for any n would mean a mixed orbit beats both pure
# phases at p*, and coexistence would fail at that spacing even though the
# isolated interface costs.
TAU_INF = 1.74773822872121908e-5


def tensions(nmax=16, starts=260, seed=7, p=PSTAR):
    S.P = float(p)
    rng = np.random.default_rng(seed)
    print("p = %.12f    c = %.20f    tau_inf = %.6e\n" % (p, CVAL, TAU_INF))
    print("   n   min mean F6           excess/gap    tau_eff(n)     /tau_inf")
    out = []
    for n in range(2, nmax + 1):
        b, bx = np.inf, None
        for g0 in seeds(n, starts, rng):
            v, x = relax(g0, n)
            if v < b:
                b, bx = v, x
        ex = b - CVAL
        te = n * ex / 2
        mark = ""
        if ex < -1e-13:
            mark = "   <-- BELOW c"
        elif abs(ex) <= 1e-13:
            mark = "   pure"
        print("  %2d   %.18f  %+.4e   %+.4e   %+7.3f%s"
              % (n, b, ex, te, te / TAU_INF, mark))
        out.append({"n": n, "min": b, "excess": ex, "tau_eff": te,
                    "gaps": np.roll(bx, -int(np.argmin(bx))).tolist()})
    return out


def table(pressures, nmax=9, starts=200, seed=11):
    """Every period's minimum, printed, at each pressure -- no inference."""
    rng = np.random.default_rng(seed)
    out = {}
    for p in pressures:
        S.P = float(p)
        row = []
        for n in range(1, nmax + 1):
            b, bx = np.inf, None
            for g0 in seeds(n, starts, rng):
                v, x = relax(g0, n)
                if v < b:
                    b, bx = v, x
            row.append((n, b, np.roll(bx, -int(np.argmin(bx)))))
        base = min(v for _, v, _ in row)
        print("\np = %.6f" % p, flush=True)
        for n, v, x in row:
            print("   n=%d  %.18f  %+.4e   %s" %
                  (n, v, v - base, " ".join("%.4f" % t for t in x[:7])), flush=True)
        out[str(p)] = [{"n": n, "min": v, "gaps": x.tolist()} for n, v, x in row]
    return out
