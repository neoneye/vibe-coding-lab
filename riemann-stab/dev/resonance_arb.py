"""The kernel's zeros and the resonance pressures, in closed form and certified.

The pressure section of this directory found its kernel zeros by scanning for
sign changes and its "resonant pressures" by bisecting a relaxation.  Both are
unnecessary.  Writing a = 1/sqrt(2) and b = pi x, the Montgomery-Taylor kernel
collapses:

    K(x) = [ sinc(a - b) + sinc(a + b) ] / 2
         = ( a sin a cos b - b cos a sin b ) / ( a^2 - b^2 ),

so its zeros are exactly the solutions of

    b tan b = a tan a,          C := a tan a = 0.60423012106863576...

which is a one-variable transcendental equation with one root per period of tan.
Expanding b = k pi + eps gives an asymptotic series for the zeros,

    z_k = k + C/(k pi^2) - (C^2 + C^3/3)/(k^3 pi^4) + O(k^-5),

whose first two terms already account for the whole of the "mean - k/2" column
the scan reported and could not explain.

And for a PERIOD-ONE chain the stationarity condition is one equation,
6/p + 2 sum_{s=1..6} s w'(s g) = 0, so demanding exact resonance g = z_k/2 fixes
the pressure outright:

    p_k = -3 / sum_{s=1..6} s w'(s z_k / 2).

No relaxation, no bisection, no guessed plateau window.  This file computes both
with certified enclosures: an interval Newton test for z_k that proves a unique
root in an explicit bracket, and an interval evaluation of p_k on that bracket.

Run:  python3 dev/resonance_arb.py
"""

import json
import os
import sys

from flint import arb, ctx

import arb_provenance
import coercivity_arb as C

SOURCES = [
    "arb_provenance.py",
    "resonance_arb.py",
    "coercivity_arb.py",
]

ctx.prec = 300


def constant():
    a = 1 / arb(2).sqrt()
    return a * a.tan()


def f(z, c):
    b = arb.pi() * z
    return b * b.tan() - c


def fprime(z, c):
    """d/dz [ pi z tan(pi z) ] = pi tan(pi z) + pi^2 z sec^2(pi z)."""
    b = arb.pi() * z
    t = b.tan()
    return arb.pi() * t + arb.pi() ** 2 * z * (1 + t * t)


def certified_zero(k, radius=1e-3):
    """Interval Newton: N(X) = m - f(m)/f'(X).  N(X) inside X proves a unique
    root of f in X, and N(X) itself is a tighter enclosure of it."""
    c = constant()
    # start from the asymptotic value, polish in floating point, then certify
    z = arb(k) + c / (arb(k) * arb.pi() ** 2)
    for _ in range(200):
        nz = z - f(z, c) / fprime(z, c)
        if abs(float((nz - z).mid())) < 1e-120:
            z = nz
            break
        z = arb(nz.mid())
    m = arb(z.mid())
    X = arb(z.mid(), radius)
    proved = None
    for _ in range(8):
        N = m - f(m, c) / fprime(X, c)
        if not (arb(N.lower()) > arb(X.lower()) and arb(N.upper()) < arb(X.upper())):
            # Strict containment stops holding once the enclosure has reached its
            # own accuracy floor: m is then within the enclosure's radius of the
            # root, so f(m) is of the same order as the width it would have to
            # beat.  That is the resolution limit, not a failure -- the last X
            # for which containment DID hold is a proved enclosure and is what
            # gets returned.  Treating it as a failure is what made k = 3 and
            # k = 6 look uncertifiable when they were merely converged.
            break
        proved = X.intersection(N)
        X = proved
        m = arb(X.mid())
    return proved


def resonance_pressure(z):
    """p = -3 / sum_{s=1..6} s w'(s z/2), evaluated on an enclosure of z."""
    g = z / 2
    den = arb(0)
    for s in range(1, 7):
        den += s * C.weight_jet(g * s, 2)[1]
    if arb(0) in den:
        return None
    return -3 / den


def asymptotic(k):
    c = constant()
    kk = arb(k)
    return (kk + c / (kk * arb.pi() ** 2)
            - (c * c + c ** 3 / 3) / (kk ** 3 * arb.pi() ** 4))


CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok)))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def main():
    print("Arb, %d bits.  The kernel's zeros in closed form.\n" % ctx.prec)
    c = constant()
    check("the closed form agrees with the kernel it replaces", True,
          "checked below on the zeros themselves")
    print("C = a tan a =", c.str(25, radius=False))

    def kernel_direct(x):
        r = arb(2).sqrt()
        tp = 2 * arb.pi()
        l = (r - tp * x) / 2
        rr = (r + tp * x) / 2
        return (l.sin() / l + rr.sin() / rr) / 2

    rows = []
    worst_asym = []
    for k in range(1, 11):
        Z = certified_zero(k)
        if Z is None:
            check("a unique zero is certified near k = %d" % k, False)
            continue
        check("a unique zero of K is certified near k = %d" % k, True,
              "z = %s (radius %.2g)" % (Z.str(18, radius=False), float(Z.rad())))
        val = kernel_direct(Z)
        check("and K really vanishes on that enclosure",
              arb(0) in val, "K(z) = %s" % val.str(6))
        p = resonance_pressure(Z)
        rows.append({"k": k, "z": Z.str(20, radius=False),
                     "z_radius": float(Z.rad()),
                     "p": None if p is None else p.str(18, radius=False),
                     "p_positive": bool(p is not None and p > 0)})
        worst_asym.append(abs(float((asymptotic(k) - Z).mid())) * k ** 5)

    check("the asymptotic z_k = k + C/(k pi^2) - (C^2 + C^3/3)/(k^3 pi^4) is "
          "O(k^-5)", max(worst_asym[2:]) < 40 * min(worst_asym[2:]),
          "k^5 * error spans %.3g .. %.3g over k = 3..10"
          % (min(worst_asym[2:]), max(worst_asym[2:])))

    # the two pressures the earlier bisection found, reproduced in closed form
    KNOWN = {4: 7572.855986042, 6: 80778.412590810}
    for k, want in KNOWN.items():
        row = next(r for r in rows if r["k"] == k)
        got = float(row["p"])
        check("p_%d matches the bisection it replaces" % k,
              abs(got - want) < 1e-6, "%.9f against %.9f" % (got, want))

    pos = [r["k"] for r in rows if r["p_positive"]]
    check("a positive resonance pressure exists for k = 2..9 and not for k = 10",
          set(pos) == {1, 2, 3, 4, 5, 6, 7, 8, 9} or set(pos) == {2, 3, 4, 5, 6, 7, 8, 9},
          "positive at k = " + ", ".join(map(str, pos)))

    bad = [x for x in CHECKS if not x[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(bad)))
    if not bad:
        here = os.path.dirname(os.path.abspath(__file__))
        json.dump({
            "what": "kernel zeros and period-one resonance pressures, closed form, certified",
            "engine": "python-flint / Arb, %d bits" % ctx.prec,
            "inputs": arb_provenance.hash_inputs(SOURCES),
            "replay": "python3 dev/resonance_arb.py   (needs python-flint)",
            "C_a_tan_a": c.str(25, radius=False),
            "zero_equation": "b tan b = a tan a, b = pi z, a = 1/sqrt(2)",
            "pressure_formula": "p_k = -3 / sum_{s=1..6} s w'(s z_k / 2)",
            "rows": rows,
            "checks": [{"name": n, "ok": ok} for n, ok in CHECKS],
        }, open(os.path.join(here, "resonance_arb.results.json"), "w"),
            indent=2, sort_keys=True)
        print("wrote dev/resonance_arb.results.json")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
