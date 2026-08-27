"""What is actually the ground state, as the pressure moves.

The pressure section here has tracked two branches, period two and period three,
and read their crossings as transitions.  dev/branch_arb.py certified the two
branches themselves and said plainly what was still missing: nothing had
excluded configurations OFF those two branches.

This file goes and looks.  Minimising the mean block functional over cyclic
configurations of each period separately (dev/rotation_scan.py, floating point)
turns up competitors, and every competitor that matters is certified here in
Arb -- Krawczyk for existence and uniqueness, verified Cholesky for strict local
minimality, and an enclosed per-gap energy to compare.

Two things come out, and they point opposite ways.

  * At the UPPER crossing p* = 3370.4507 the two branches really are the bottom.
    Period five sits 1.69e-6 above them and period seven 5.51e-6 above, so the
    coexistence that dev/interface_arb.py found survives its nearest competitors
    and p* stays a first-order transition.

  * At the LOWER crossing p = 1454.6785 they are NOT.  A period-five
    configuration -- one period-three block and one period-two block, which is
    exactly a 2|3 interface pair at the shortest possible separation -- lies
    4.18e-7 BELOW both branches.  So the interface tension that is positive at
    p* is NEGATIVE there, the branches cross without exchanging ground states,
    and the lower crossing is not a phase boundary of this model at all.

  * And at p = 1000, below both crossings, neither branch is even close: a
    genuinely period-four state is 1.27e-4 below the period-two branch.

The last two are corrections to what this directory said.  The lower crossing
was already relabelled once, from "plateau edge" to "metastability limit", after
a review pointed out it is not where the walls vanish; this says something
stronger and simpler, which is that the ground state near it has a longer period
than either branch being crossed.

Run:  python3 dev/staircase_arb.py   (needs python-flint)
"""

import json
import os
import sys

from flint import arb, ctx

import arb_provenance
import branch_arb as B
import coercivity_arb as C
import kink_arb as K

SOURCES = [
    "arb_provenance.py",
    "branch_arb.py",
    "coercivity_arb.py",
    "kink_arb.py",
    "staircase_arb.py",
]

ctx.prec = 300

P_LOW = "1454.6785461214313"        # dev/tiling_pressure.js lowerCrossover
P_STAR = "3370.450721224646523297"  # dev/interface_arb.py
C_STAR = "0.00362533155996670429057064"

# Seeds from the floating-point scan.  A seed is a starting point and nothing
# more: what is asserted below is proved about the certified box Krawczyk
# returns, not about the number written here.
SEEDS = {
    P_LOW: {
        2: [1.041562015052, 1.978983276688],
        3: [1.032316157763, 1.971419340593, 1.032316157768],
        5: [1.032788737831, 1.032788737832, 1.975224848944,
            1.040530507877, 1.975224848944],
    },
    P_STAR: {
        2: [1.041692343443, 1.979517365475],
        3: [1.043574498646, 1.992286369581, 1.992286369581],
        5: [1.042569620506, 1.981063127276, 1.042569621166,
            1.991571555310, 1.991571553690],
        7: [1.041700000000, 1.980200000000, 1.042400000000, 1.991800000000,
            1.991800000000, 1.042400000000, 1.980200000000],
    },
    "1000.0": {
        2: [1.016522080642, 1.016522080642],
        3: [1.032208078018, 1.032208078018, 1.971000092838],
        4: [1.023237851690, 1.029683085693, 1.968922623693, 1.029683085733],
    },
}

CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok), detail))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name,
                         "  -- " + detail if detail else ""), flush=True)
    return bool(ok)


def certify(p, seed, halfwidth=1e-7):
    """A period-n orbit at a single pressure, with its per-gap energy enclosed."""
    return B.certify_ring(arb(p), arb(p), seed, halfwidth)


def strictly_below(a, b):
    """a < b with no overlap: proved by the enclosures, not by midpoints."""
    return arb(a.upper()) < arb(b.lower())


def report(p, orbits):
    out = {}
    for n in sorted(orbits):
        r = certify(p, orbits[n])
        e = r["energy"]
        check("period %d is certified at p = %s" % (n, p),
              r["proved"] and r["pd"],
              "energy %s" % e.str(14))
        out[n] = r
    return out


def main():
    print("Arb, %d bits.  The ground state off the two tracked branches.\n"
          % ctx.prec)

    # ---------------------------------------------------------- the upper crossing
    print("p* = %s, the crossing the directory calls a transition" % P_STAR)
    up = report(P_STAR, SEEDS[P_STAR])
    c = arb(C_STAR)
    for n in (2, 3):
        e = up[n]["energy"]
        check("period %d sits on the crossing energy c" % n,
              abs(e - c) < arb(1e-18), "|e - c| <= %s" % abs(e - c).str(4))
    for n in (5, 7):
        e = up[n]["energy"]
        ok = strictly_below(c, e)
        check("and period %d is strictly ABOVE it, so it does not compete" % n,
              ok, "e - c = %s" % (e - c).str(6))
    # The excess of a mixed orbit is two interfaces at spacing n/2.  Positive
    # excess is a positive tension at that spacing; dev/interface_arb.py gives
    # the isolated value 1.7477e-5 and this is the same quantity at close range.
    for n in (5, 7):
        tau = arb(n) * (up[n]["energy"] - c) / 2
        print("     tau_eff(%d) = %s   (isolated 1.74774e-5)" % (n, tau.str(8)))

    # ---------------------------------------------------------- the lower crossing
    print("\np = %s, the crossing the directory calls a metastability limit"
          % P_LOW)
    lo = report(P_LOW, SEEDS[P_LOW])
    e2, e3, e5 = lo[2]["energy"], lo[3]["energy"], lo[5]["energy"]
    check("the two branches meet there", abs(e2 - e3) < arb(1e-12),
          "|e2 - e3| = %s" % abs(e2 - e3).str(4))
    ok5 = strictly_below(e5, e2) and strictly_below(e5, e3)
    check("but a certified period-FIVE orbit lies strictly below BOTH", ok5,
          "e5 - e2 = %s,  e5 - e3 = %s" % ((e5 - e2).str(6), (e5 - e3).str(6)))
    tau_lo = arb(5) * (e5 - e2) / 2
    check("so the 2|3 interface tension is NEGATIVE at the lower crossing",
          arb(tau_lo.upper()) < 0, "tau_eff(5) = %s" % tau_lo.str(8))
    print("     the lower crossing is therefore NOT a phase boundary: the two")
    print("     branches exchange nothing there, because a mixture of them is")
    print("     below both.")

    # ---------------------------------------------------------- further down
    print("\np = 1000, below both crossings")
    dn = report("1000.0", SEEDS["1000.0"])
    d2, d3, d4 = dn[2]["energy"], dn[3]["energy"], dn[4]["energy"]
    check("a certified period-FOUR orbit lies strictly below the period-two branch",
          strictly_below(d4, d2), "e4 - e2 = %s" % (d4 - d2).str(6))
    check("and strictly below the period-three branch",
          strictly_below(d4, d3), "e4 - e3 = %s" % (d4 - d3).str(6))
    check("the period-two branch has collapsed to a uniform state there",
          abs(dn[2]["box"][0] - dn[2]["box"][1]) < arb(1e-12),
          "L - H = %s" % abs(dn[2]["box"][0] - dn[2]["box"][1]).str(4))

    failed = [x for x in CHECKS if not x[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(failed)))
    if not failed:
        here = os.path.dirname(os.path.abspath(__file__))
        rec = {
            "what": "certified orbits off the two tracked branches",
            "engine": "python-flint / Arb, %d bits" % ctx.prec,
            "inputs": arb_provenance.hash_inputs(SOURCES),
            "replay": "python3 dev/staircase_arb.py   (needs python-flint)",
            "p_star": P_STAR, "p_low": P_LOW, "c": C_STAR,
            "upper_crossing": {
                str(n): {"energy": up[n]["energy"].str(20),
                         "gaps": [x.str(16) for x in up[n]["box"]]}
                for n in sorted(up)},
            "lower_crossing": {
                str(n): {"energy": lo[n]["energy"].str(20),
                         "gaps": [x.str(16) for x in lo[n]["box"]]}
                for n in sorted(lo)},
            "p1000": {
                str(n): {"energy": dn[n]["energy"].str(20),
                         "gaps": [x.str(16) for x in dn[n]["box"]]}
                for n in sorted(dn)},
            "finding": ("period five is strictly below both branches at the "
                        "lower crossing and strictly above both at p*, so the "
                        "2|3 interface tension changes sign between them"),
            "checks": [{"name": n, "ok": ok, "detail": d} for n, ok, d in CHECKS],
        }
        json.dump(rec, open(os.path.join(here, "staircase_arb.results.json"), "w"),
                  indent=2, sort_keys=True)
        print("wrote dev/staircase_arb.results.json")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
