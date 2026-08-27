"""The interface between the two phases at the crossing pressure.

At p* the period-two and period-three branches have the same energy c.  That by
itself says nothing about whether they COEXIST: if an interface between them
cost negative energy, a mixed chain would beat both and neither pure phase would
be the ground state, so "the two branches cross" would not be a transition
between them at all.

The interface cost is a finite computation.  A ring that follows the period-two
pattern on one arc and the period-three pattern on the other carries exactly two
interfaces, and its excess over N c is their total.  In Arb, with the same
Krawczyk-plus-Cholesky machinery the wall tensions use:

    tau_23 = 1.74773822872e-5,  positive,

and saturated -- identical from N = 84 to N = 156 to twelve digits, so it is the
infinite-chain value and not a finite-ring artifact.  Positive means the two
phases coexist at p*: mixing them costs, so neither pure phase is beaten by a
mixture, and p* is a genuine first-order transition rather than a place where
the branches merely happen to cross.

Run:  python3 dev/interface_arb.py
"""

import json
import os
import sys

from flint import arb, ctx

import arb_provenance
import coercivity_arb as C
import kink_arb as K

SOURCES = [
    "arb_provenance.py",
    "interface_arb.py",
    "coercivity_arb.py",
    "kink_arb.py",
]

ctx.prec = 260

# The crossing, from a Newton solve on E_2(p) - E_3(p) = 0 at 300 bits.
PSTAR = "3370.450721224646523297"
LTWO = "1.0416923434460380797"
HTWO = "1.9795173654714754534"
THREE = ["1.0435744986456292657", "1.9922863695808364586", "1.9922863695808364586"]
CVAL = "0.00362533155996670429057064"


def setup():
    p = arb(PSTAR)
    C.ALPHA = arb(6) / p
    K.ALPHA = arb(6) / p
    return p, arb(LTWO), arb(HTWO), [arb(x) for x in THREE], arb(CVAL)


def mixed_ring(n_two, n_three, L, H, three):
    g = [L if i % 2 == 0 else H for i in range(n_two)]
    g += [three[i % 3] for i in range(n_three)]
    return g


CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok)))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def main():
    print("Arb, %d bits.  The 2-3 interface at the crossing.\n" % ctx.prec)
    p, L, H, three, c = setup()
    # p* is stored to twenty digits, so the two energies agree to about 4e-26
    # rather than exactly -- that residue is the truncation, not a disagreement.
    e2 = C.energy(L, H)
    e3 = K.ring_energy_total(three) / 3
    check("the two branches have the same energy at p*, to the precision p* is "
          "stored at", abs(float((e2 - e3).mid())) < 1e-24,
          "E_2 - E_3 = %s, against a p* truncated at twenty digits"
          % (e2 - e3).str(8))

    rows = []
    for n in (42, 54, 66, 78):
        N = 2 * n
        g = K.newton(mixed_ring(n, n, L, H, three), steps=90, tol=1e-90)
        excess = K.ring_energy_total(g) - N * c
        tau = excess / 2
        rows.append({"N": N, "tau": tau.str(16), "tau_float": float(tau.mid())})
        check("a mixed ring of %d relaxes and its excess is positive" % N,
              excess > 0, "tau_23 = %s" % tau.str(14))

    spread = max(r["tau_float"] for r in rows) - min(r["tau_float"] for r in rows)
    check("and the tension has saturated, so it is the infinite-chain value",
          spread < 1e-18, "spread over N = 84..156 is %.2e" % spread)

    # existence, uniqueness and strict local minimality of the interface itself
    n = 42
    N = 2 * n
    g = K.newton(mixed_ring(n, n, L, H, three), steps=90, tol=1e-90)
    proved = K.krawczyk_ring(g, 1e-6)["proved"]
    check("a unique interface configuration exists in a 1e-6 box in %d dimensions" % N,
          proved)
    X, refined = K.refine_ring(g, 1e-6)
    check("the enclosure refines", refined,
          "widest gap radius %.2g" % max(float(x.rad()) for x in X))
    lam = K.hessian_smallest_eigenvalue_lower(X)
    check("and it is a strict local minimum", lam > 0,
          "lambda_min >= %.9f" % float(lam.lower()))
    tau = (K.ring_energy_total(X) - N * c) / 2
    check("so the interface tension is enclosed and positive", tau > 0,
          "tau_23 = %s" % tau.str(18))

    check("POSITIVE means the phases coexist at p*: a mixture costs, so neither "
          "pure phase is beaten by one", tau > 0,
          "which makes p* a first-order transition and not merely a crossing")

    bad = [x for x in CHECKS if not x[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(bad)))
    if not bad:
        here = os.path.dirname(os.path.abspath(__file__))
        json.dump({
            "what": "interface tension between the period-two and period-three "
                    "phases at the crossing pressure",
            "engine": "python-flint / Arb, %d bits" % ctx.prec,
            "inputs": arb_provenance.hash_inputs(SOURCES),
            "replay": "python3 dev/interface_arb.py   (needs python-flint)",
            "p_star": PSTAR, "c": CVAL,
            "tau_23": tau.str(20),
            "finite_size": rows,
            "not_established": "that the two phases are the GLOBAL minima at p*; "
                               "this says only that mixing them costs",
            "checks": [{"name": n_, "ok": ok} for n_, ok in CHECKS],
        }, open(os.path.join(here, "interface_arb.results.json"), "w"),
            indent=2, sort_keys=True)
        print("wrote dev/interface_arb.results.json")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
