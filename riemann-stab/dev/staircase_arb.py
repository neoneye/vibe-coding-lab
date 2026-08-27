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

What replaces the lower crossing is a WINDOW.  Period five is the ground state on
an interval of pressures, roughly [1452.44, 1456.17], and the old crossing sits
inside it: below the window the period-three branch is lowest, above it the
period-two branch is, and in between a phase of period 5 = 3 + 2 whose pattern is
literally one three-block next to one two-block.  That is the Farey-mediant
arrangement a devil's staircase is built from, so the obvious next question is
whether the construction repeats -- whether 8 = 3 + 5 opens a window at the lower
edge and 7 = 5 + 2 at the upper one.  It does NOT.  At both edges the mediant is
strictly ABOVE the two phases it would interpolate, by 5.73e-7 and 6.73e-6, which
is the same statement as the interface tension between those phases being
positive.  So this is a finite sequence of commensurate phases with first-order
transitions between them, and not a staircase -- checked at the one level where
a staircase would have had to show itself.

The 5.73e-7 was 5.80e-5 in the first version of this file, because the period-8
seed there was the two certified blocks written end to end and that relaxes into
the wrong stationary point.  Concatenation is a plausible seed and not a
minimiser; the number now comes from a multi-start scan of period eight at that
pressure.  The margin shrank by a factor of a hundred and the conclusion did not
move, which is the only reason the conclusion was worth keeping.

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

# The window around the old lower crossing.  Bracketing pressures on both sides
# of each edge: the sign of the energy difference is proved at each, and that
# brackets the edge without needing to certify a root in p.
WINDOW = {
    "1452.0": {2: [1.041561593, 1.978981545],
               3: [1.032315719, 1.971417638, 1.032315719],
               5: [1.0327883, 1.0327883, 1.975223135, 1.040530079, 1.975223135]},
    "1453.0": {2: [1.041561751, 1.978982193],
               3: [1.032315883, 1.971418274, 1.032315883],
               5: [1.032788464, 1.032788464, 1.975223776, 1.04053024, 1.975223776]},
    "1455.5": {2: [1.041562144, 1.978983806],
               3: [1.032316292, 1.971419861, 1.032316292],
               5: [1.032788872, 1.032788872, 1.975225373, 1.040530639, 1.975225373]},
    "1457.0": {2: [1.04156238, 1.978984772],
               3: [1.032316537, 1.971420811, 1.032316537],
               5: [1.032789116, 1.032789116, 1.975226329, 1.040530878, 1.975226329]},
}

# The two edges, and at each the mediant that a staircase would require.
EDGES = {
    "1452.444719016": {
        3: [1.032315792, 1.971417921, 1.032315792],
        5: [1.032788373, 1.032788373, 1.97522342, 1.040530151, 1.97522342],
        # NOT the concatenation of the certified three- and five-blocks.  That
        # seed relaxes to a stationary point 5.80e-5 above the phases, and an
        # earlier version of this file certified it and published that number as
        # the mediant's cost.  It is a genuine stationary point and the wrong
        # one: a multi-start scan of period eight at this pressure finds an orbit
        # a hundred times closer, 5.73e-7 above.  The conclusion survives -- the
        # mediant still loses -- but the margin does not, and a certified number
        # about the wrong orbit is worse than no number.
        8: [1.0323530616, 1.9714067684, 1.0323530617, 1.0325520116,
            1.9752361218, 1.0409094852, 1.9752361229, 1.0325520111]},
    "1456.171287537": {
        2: [1.04156225, 1.978984239],
        5: [1.032788981, 1.032788981, 1.975225801, 1.040530746, 1.975225801],
        7: [1.0326267741, 1.0326267744, 1.9754828039, 1.040958765,
            1.9790423937, 1.0409587646, 1.9754828032]},
}

# The neighbours of the winning composition at the lower crossing.  Writing a
# mixed orbit as a two-blocks beside b three-blocks, tau_eff at the lower
# crossing is negative for (a, b) = (1, 1) and positive everywhere else in the
# scan -- so the period-five phase is not merely one competitor that happens to
# win, it is the ONLY mixture that beats the pure phases there.  These two are
# the immediate neighbours, (2, 1) and (1, 2), certified so the claim has more
# than a floating-point table under it.
NEIGHBOURS = {
    7: [1.0409585277, 1.979041433, 1.0409585275, 1.9754818521,
        1.0326265295, 1.0326265292, 1.9754818521],
    8: [1.0409098385, 1.9752375507, 1.0325523776, 1.0323534291,
        1.9714081867, 1.0323534288, 1.0325523779, 1.9752375505],
}

# The two ISOLATED defects at p*, dilute rather than dense: one two-block inside
# a long stretch of the period-three phase (a = 1, b = 6) and one three-block
# inside a long stretch of the period-two phase (a = 6, b = 1).  Both costing is
# the statement that each pure phase is locally stable against inserting a single
# block of the other, which is what makes p* look like an ordinary first-order
# point with a metastability overlap rather than a spinodal.
DEFECTS = {
    20: [1.0426520077, 1.9804687091, 1.0426520076, 1.9918487841, 1.9920312209,
         1.0435152868, 1.9926121098, 1.9922279384, 1.0435683013, 1.9922755131,
         1.9922867318, 1.0435756375, 1.9922867318, 1.9922755132, 1.0435683015,
         1.9922279385, 1.9926121097, 1.0435152867, 1.9920312208, 1.9918487841],
    15: [1.0425356511, 1.9802324658, 1.0416816031, 1.9795179275, 1.0415649881,
         1.9795399499, 1.0417019536, 1.9795399505, 1.0415649873, 1.9795179277,
         1.0416816038, 1.9802324653, 1.0425356511, 1.9917921461, 1.9917921465],
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

    # ------------------------------------ each pure phase resists a lone defect
    print("\nisolated defects at p*")
    LABEL = {20: "one two-block inside the period-three phase",
             15: "one three-block inside the period-two phase"}
    for n in sorted(DEFECTS, reverse=True):
        r = certify(P_STAR, DEFECTS[n], halfwidth=1e-8)
        tau = arb(n) * (r["energy"] - c) / 2
        check("%s costs" % LABEL[n],
              r["proved"] and r["pd"] and arb(tau.lower()) > 0,
              "tau_eff = %s, %.3f of the isolated tau_23"
              % (tau.str(8), float(tau.mid()) / 1.74773822872121908e-5))
    print("     so both phases are locally stable at p*, and the transition")
    print("     there has a metastability overlap rather than a spinodal.")

    # ----------------------------------- only the shortest mixture goes negative
    print("\nthe neighbouring compositions at the lower crossing")
    for n in sorted(NEIGHBOURS):
        r = certify(P_LOW, NEIGHBOURS[n])
        ok = r["proved"] and r["pd"]
        tau = arb(n) * (r["energy"] - e2) / 2
        check("period %d, the next composition along, is certified and costs" % n,
              ok and arb(tau.lower()) > 0,
              "tau_eff(%d) = %s" % (n, tau.str(8)))
    print("     so (a, b) = (1, 1) is the only mixture below the pure phases:")
    print("     one two-block beside one three-block, and nothing longer.")

    # ------------------------------------------------ the window that replaces it
    print("\nthe period-five window, bracketed")
    w = {}
    for p in sorted(WINDOW, key=float):
        w[p] = {n: certify(p, WINDOW[p][n]) for n in sorted(WINDOW[p])}
        for n in sorted(w[p]):
            if not (w[p][n]["proved"] and w[p][n]["pd"]):
                check("period %d certified at p = %s" % (n, p), False)
    def e(p, n):
        return w[p][n]["energy"]
    check("below the window, at p = 1452, period three is strictly under period five",
          strictly_below(e("1452.0", 3), e("1452.0", 5)),
          "e3 - e5 = %s" % (e("1452.0", 3) - e("1452.0", 5)).str(6))
    check("just inside, at p = 1453, period five is strictly under period three",
          strictly_below(e("1453.0", 5), e("1453.0", 3)),
          "e5 - e3 = %s" % (e("1453.0", 5) - e("1453.0", 3)).str(6))
    check("and still inside at p = 1455.5, strictly under period two",
          strictly_below(e("1455.5", 5), e("1455.5", 2)),
          "e5 - e2 = %s" % (e("1455.5", 5) - e("1455.5", 2)).str(6))
    check("above the window, at p = 1457, period two is strictly under period five",
          strictly_below(e("1457.0", 2), e("1457.0", 5)),
          "e2 - e5 = %s" % (e("1457.0", 2) - e("1457.0", 5)).str(6))
    check("so the period-five window contains the old lower crossing",
          1453.0 < float(P_LOW) < 1455.5,
          "1453 < %s < 1455.5" % P_LOW)

    # ------------------------------------------------ and the mediants do not open
    print("\nthe Farey mediant at each edge -- a staircase would need it to win")
    for p in sorted(EDGES, key=float):
        cert = {n: certify(p, EDGES[p][n]) for n in sorted(EDGES[p])}
        ns = sorted(cert)
        med = max(ns)
        others = [n for n in ns if n != med]
        em = cert[med]["energy"]
        for n in others:
            check("at p = %s the mediant %d = %d + %d is strictly ABOVE period %d"
                  % (p, med, others[0], others[1], n),
                  strictly_below(cert[n]["energy"], em),
                  "e%d - e%d = %s" % (med, n, (em - cert[n]["energy"]).str(6)))
        tau = arb(med) * (em - cert[others[0]]["energy"]) / 2
        print("     tau_eff(%d) = %s, positive, so the edge is first order"
              % (med, tau.str(8)))

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
            "window": {p: {str(n): w[p][n]["energy"].str(20) for n in w[p]}
                       for p in w},
            "mediants": ("checked at both edges: 8 = 3 + 5 and 7 = 5 + 2 are "
                         "strictly above the phases they would interpolate, so "
                         "no second-level window opens"),
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
