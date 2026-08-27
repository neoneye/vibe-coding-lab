"""An independent checker for the sweep's proof object.

The sweep emits one byte per node of its subdivision tree.  This file replays
that tape -- reconstructing every box from an independently recomputed root
partition -- and checks the claims, in Arb, on a deterministic sample.

What it can check, and what it cannot.

  * STRUCTURE, for every node at no arithmetic cost: that the tape is
    well-formed, that it is consumed exactly, that every split's children union
    to their parent, that every collapse lands on a face of its box, and that no
    leaf is left open.  This is the check that catches a lost region -- a sweep
    reporting "complete" having silently dropped part of its domain -- and it is
    the reason a proof object is worth emitting at all.

  * ARITHMETIC, on a sample: that a discharged leaf's bound really does clear
    the target, and that a collapsed coordinate's derivative really does keep
    its sign.  Here the checker is at a disadvantage it cannot argue away: the
    sweep uses exact monotone-piece ranges built from precomputed breakpoints,
    and a straightforward Arb enclosure over the same box is far wider.  So the
    checker can only confirm the claims whose margin exceeds its own resolution,
    and it reports the fraction it could reach rather than implying it reached
    all of them.

The 1.6 is the cube half-width the committed tape was emitted at, and it is not
decoration: this line used to read 3, which does not reproduce the committed tape
at all -- it emits a different one with 53102447 nodes and a 51 MB file.  A replay
command that does not replay is worse than none, because following it looks like
verification.

Run:  node dev/sweep_proof.js 1.6 0.008 && python3 dev/sweep_proof_arb.py
"""

import hashlib
import json
import os
import sys

from flint import arb, ctx

import arb_provenance
import coercivity_arb as C
import kernel_pieces_arb as KP

SOURCES = [
    "arb_provenance.py",
    "sweep_proof_arb.py",
    "coercivity_arb.py",
    "kernel_pieces_arb.py",
    "sweep_proof.json",
    "tiling_pair.stationary.json",
    "tiling_additive.certificate.json",
]

ctx.prec = 200

OP_SPLIT, OP_LO, OP_HI = 0x00, 0x08, 0x10
LEAF_BOUND, LEAF_TUBE, LEAF_OPEN = 0x20, 0x21, 0x22
NPTS = 7
PAIRS = [(i, j) for i in range(NPTS) for j in range(i + 1, NPTS)]
SIGN_A = [1, 0, -1, -1, 0, 1]
SIGN_B = [0, 1, -1, -1, 1, 0]
LOW = 1.0416801034484870
HIGH = 1.9794672314032244


def partition(cube, rho):
    """Recomputed here, not read from the sweep: the checker must not inherit
    the very geometry it is checking."""
    cuts = {0.0, float(cube)}
    for i in range(6):
        centre = LOW if i % 2 == 0 else HIGH
        for c in (LOW, HIGH):
            for v in (c - rho, c + rho):
                if 0 < v < cube:
                    cuts.add(v)
    edges = sorted(cuts)
    slabs = [(edges[i], edges[i + 1]) for i in range(len(edges) - 1)]
    out = []
    lo = [0.0] * 6
    hi = [0.0] * 6

    def inside(centres):
        return all(lo[i] >= centres[i] - rho - 1e-15 and hi[i] <= centres[i] + rho + 1e-15
                   for i in range(6))

    def walk(k):
        if k == 6:
            for phase in (0, 1):
                c = [LOW if (i + phase) % 2 == 0 else HIGH for i in range(6)]
                if inside(c):
                    return
            out.append((tuple(lo), tuple(hi)))
            return
        for a, b in slabs:
            lo[k] = a; hi[k] = b
            walk(k + 1)

    walk(0)
    return out


def weight_ball(d):
    r = arb(2).sqrt()
    tp = 2 * arb.pi()
    k = (((r - tp * d) / 2).sinc() + ((r + tp * d) / 2).sinc()) / 2
    q = k / (r / 2).sinc()
    return q * q


def weight_deriv_ball(d):
    r = arb(2).sqrt()
    tp = 2 * arb.pi()
    zl = (r - tp * d) / 2
    zr = (r + tp * d) / 2
    k = (zl.sinc() + zr.sinc()) / 2
    def sd(z):
        if arb(0) in z:
            m = max(abs(float(z.lower())), abs(float(z.upper())))
            return (-z / 3 + z ** 3 / 30 - z ** 5 / 840) + arb(0, m ** 7 / 45360)
        return (z * z.cos() - z.sin()) / (z * z)
    kp = arb.pi() * (sd(zr) - sd(zl)) / 2
    K0 = (r / 2).sinc()
    return 2 * k * kp / (K0 * K0)


def span(a, b):
    m = (arb(a) + arb(b)) / 2
    rad = (arb(b) - arb(a)) / 2
    return arb(m.mid(), float(rad.upper()) * (1 + 1e-12) + 1e-300)


def pl_range(knots, coeffs, lo, hi):
    n = len(knots)
    def at(x):
        if x <= knots[0]:
            return coeffs[0]
        if x >= knots[-1]:
            return coeffs[-1]
        i, j = 0, n - 1
        while j - i > 1:
            m = (i + j) // 2
            if knots[m] <= x: i = m
            else: j = m
        t = (x - knots[i]) / (knots[i + 1] - knots[i])
        return coeffs[i] * (1 - t) + coeffs[i + 1] * t
    vals = [at(lo), at(hi)] + [coeffs[i] for i in range(n) if lo < knots[i] < hi]
    return span(min(vals), max(vals))


def pl_slope_range(knots, coeffs, lo, hi):
    s = [(coeffs[i + 1] - coeffs[i]) / (knots[i + 1] - knots[i])
         for i in range(len(knots) - 1)
         if knots[i + 1] > lo and knots[i] < hi]
    if lo <= knots[0] or hi >= knots[-1]:
        s.append(0.0)
    return span(min(s), max(s)) if s else arb(0)


def cell(knots, x):
    if x <= knots[0]: return 0
    if x >= knots[-1]: return len(knots) - 2
    i, j = 0, len(knots) - 1
    while j - i > 1:
        m = (i + j) // 2
        if knots[m] <= x: i = m
        else: j = m
    return i


def grid_range(grid, J, knots, aLo, aHi, bLo, bHi):
    i0, i1 = cell(knots, aLo), cell(knots, aHi)
    j0, j1 = cell(knots, bLo), cell(knots, bHi)
    vals = [grid[i * J + j] for i in range(i0, i1 + 2) for j in range(j0, j1 + 2)]
    return span(min(vals), max(vals))


def grid_slopes(grid, J, knots, aLo, aHi, bLo, bHi):
    i0, i1 = cell(knots, aLo), cell(knots, aHi)
    j0, j1 = cell(knots, bLo), cell(knots, bHi)
    xs = [(grid[(i + 1) * J + j] - grid[i * J + j]) / (knots[i + 1] - knots[i])
          for i in range(i0, i1 + 1) for j in range(j0, j1 + 2)]
    ys = [(grid[i * J + j + 1] - grid[i * J + j]) / (knots[j + 1] - knots[j])
          for j in range(j0, j1 + 1) for i in range(i0, i1 + 2)]
    if aLo <= knots[0] or aHi >= knots[-1]: xs.append(0.0)
    if bLo <= knots[0] or bHi >= knots[-1]: ys.append(0.0)
    return span(min(xs), max(xs)), span(min(ys), max(ys))


class Cert:
    """Two enclosures of R over a box, and the better of them is used.

    The natural extension is first order in the box width and cannot resolve the
    margins the sweep works with.  Two things narrow it.  The kernel ranges come
    from dev/kernel_pieces_arb.py, which uses the EXACT monotone-piece range --
    the same idea the sweep uses, built here from certified breakpoints of w and
    w' rather than from a precomputed table.  And the whole bound is also
    computed in a centred form, R(centre) + grad(box) . (x - centre), which is
    second order.  Neither closes the gap entirely: matching a 1e-10 margin means
    reproducing the sweep's whole enclosure strategy, which is the rebuild this
    checker is a step towards and not a substitute for.
    """

    def __init__(self, here):
        cand = json.load(open(os.path.join(here, "tiling_pair.stationary.json")))
        bundle = json.load(open(os.path.join(here, "tiling_additive.certificate.json")))
        certs = bundle["certificates"]
        self.base = next(e for e in (certs.values() if isinstance(certs, dict) else certs)
                         if e["name"] == cand["base"])
        self.knots = cand["knots"]
        self.J = len(self.knots)
        m = [cand["coefficients"][k * self.J * self.J:(k + 1) * self.J * self.J]
             for k in range(cand["free"])]
        m.append([-sum(x[i] for x in m) for i in range(self.J * self.J)])
        self.mats = m
        self.pieces = KP.Pieces(30.0)

    def bound_and_grad_centered(self, lo, hi):
        """R(centre) + grad(box) . (x - centre): second order in the width."""
        c = [(arb(lo[k]) + arb(hi[k])) / 2 for k in range(6)]
        rad = [span(lo[k], hi[k]) - c[k] for k in range(6)]
        pc = [arb(0)]
        for k in range(6):
            pc.append(pc[k] + c[k])
        val = sum(c, arb(0)) / 3000
        for (i, j) in PAIRS:
            val += KP.weight(pc[j] - pc[i]) * (arb(2) / (NPTS - (j - i)))
        for i in range(6):
            ci = float(c[i].mid())
            if SIGN_A[i]:
                val += SIGN_A[i] * pl_range(self.base["knots"], self.base["a"], ci, ci)
            if SIGN_B[i]:
                val += SIGN_B[i] * pl_range(self.base["knots"], self.base["b"], ci, ci)
        for k in range(5):
            ck, ck1 = float(c[k].mid()), float(c[k + 1].mid())
            val += grid_range(self.mats[k], self.J, self.knots, ck, ck, ck1, ck1)
        _, grad = self.bound_and_grad(lo, hi)
        for k in range(6):
            val += grad[k] * rad[k]
        return val, grad

    def best_bound(self, lo, hi):
        nat, grad = self.bound_and_grad(lo, hi)
        cen, _ = self.bound_and_grad_centered(lo, hi)
        return nat.intersection(cen), grad

    def bound_and_grad(self, lo, hi):
        plo, phi = [arb(0)], [arb(0)]
        for k in range(6):
            plo.append(plo[k] + arb(lo[k]))
            phi.append(phi[k] + arb(hi[k]))
        s = arb(0)
        for k in range(6):
            s += span(lo[k], hi[k])
        val = s / 3000
        grad = [arb(1) / 3000 for _ in range(6)]
        for (i, j) in PAIRS:
            d = span(float((plo[j] - phi[i]).lower()), float((phi[j] - plo[i]).upper()))
            c = arb(2) / (NPTS - (j - i))
            val += self.pieces.w_range(float(d.lower()), float(d.upper())) * c
            dw = self.pieces.wd_range(float(d.lower()), float(d.upper())) * c
            for k in range(i, j):
                grad[k] += dw
        for i in range(6):
            if SIGN_A[i]:
                val += SIGN_A[i] * pl_range(self.base["knots"], self.base["a"], lo[i], hi[i])
                grad[i] += SIGN_A[i] * pl_slope_range(self.base["knots"], self.base["a"], lo[i], hi[i])
            if SIGN_B[i]:
                val += SIGN_B[i] * pl_range(self.base["knots"], self.base["b"], lo[i], hi[i])
                grad[i] += SIGN_B[i] * pl_slope_range(self.base["knots"], self.base["b"], lo[i], hi[i])
        for k in range(5):
            val += grid_range(self.mats[k], self.J, self.knots, lo[k], hi[k], lo[k + 1], hi[k + 1])
            dx, dy = grid_slopes(self.mats[k], self.J, self.knots,
                                 lo[k], hi[k], lo[k + 1], hi[k + 1])
            grad[k] += dx
            grad[k + 1] += dy
        return val, grad


CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok)))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    meta = json.load(open(os.path.join(here, "sweep_proof.json")))
    tape = open(os.path.join(here, meta["tape"]), "rb").read()
    print("Arb, %d bits.  Checking a subdivision proof of %d nodes.\n"
          % (ctx.prec, len(tape)))

    digest = hashlib.sha256(tape).hexdigest()
    check("the tape is the one the metadata describes", digest == meta["tape_sha256"],
          digest[:16])

    roots = partition(meta["cube"], meta["tubeRadius"])
    check("the root partition recomputed here matches the count the sweep used",
          len(roots) == meta["roots"], "%d pieces" % len(roots))

    # ---- structural replay: every node, no arithmetic
    target = meta["target"]
    pos = 0
    leaves = splits = collapses = openleaf = 0
    bad_struct = 0
    sample_leaf, sample_collapse = [], []
    step_leaf = max(1, meta["leaves"] // 220)
    step_coll = max(1, meta["collapses"] // 220)
    for lo0, hi0 in roots:
        stack = [(list(lo0), list(hi0))]
        while stack:
            lo, hi = stack.pop()
            while True:
                if pos >= len(tape):
                    bad_struct += 1
                    break
                op = tape[pos]; pos += 1
                if op == LEAF_BOUND:
                    leaves += 1
                    if leaves % step_leaf == 0 and len(sample_leaf) < 220:
                        sample_leaf.append((tuple(lo), tuple(hi)))
                    break
                if op in (LEAF_TUBE, LEAF_OPEN):
                    leaves += 1
                    if op == LEAF_OPEN:
                        openleaf += 1
                    break
                k = op & 0x07
                if op < OP_LO:                       # split
                    if not (hi[k] > lo[k]):
                        bad_struct += 1
                    mid = (lo[k] + hi[k]) / 2
                    if not (lo[k] <= mid <= hi[k]):
                        bad_struct += 1
                    splits += 1
                    right = (list(lo), list(hi)); right[0][k] = mid
                    stack.append((right[0], right[1]))
                    hi = list(hi); hi[k] = mid
                    continue
                if op < LEAF_BOUND:                  # collapse
                    collapses += 1
                    if collapses % step_coll == 0 and len(sample_collapse) < 220:
                        sample_collapse.append((tuple(lo), tuple(hi), k,
                                                'lo' if op < OP_HI else 'hi'))
                    if op < OP_HI:
                        lo = list(lo); lo[k] = hi[k]
                    else:
                        hi = list(hi); hi[k] = lo[k]
                    continue
                bad_struct += 1
                break

    check("the tape is consumed exactly, with nothing left over",
          pos == len(tape) and bad_struct == 0,
          "%d of %d bytes, %d structural faults" % (pos, len(tape), bad_struct))
    check("the node counts agree with the metadata",
          leaves == meta["leaves"] and splits == meta["splits"]
          and collapses == meta["collapses"],
          "%d leaves, %d splits, %d collapses" % (leaves, splits, collapses))
    check("no leaf was left open, so the subdivision terminated everywhere",
          openleaf == 0)

    # ---- arithmetic, on the sample
    cert = Cert(here)
    confirmed = unresolved = refuted = 0
    for lo, hi in sample_leaf:
        val, _ = cert.best_bound(lo, hi)
        if float(val.lower()) >= target:
            confirmed += 1
        elif float(val.upper()) < target:
            refuted += 1
        else:
            unresolved += 1
    check("no sampled discharged leaf is refuted by Arb", refuted == 0,
          "%d confirmed outright, %d beyond this checker's resolution, %d refuted"
          % (confirmed, unresolved, refuted))

    gconf = gunres = gref = 0
    for lo, hi, k, side in sample_collapse:
        _, grad = cert.best_bound(lo, hi)
        g = grad[k]
        if side == 'hi' and float(g.lower()) > 0:
            gconf += 1
        elif side == 'lo' and float(g.upper()) < 0:
            gconf += 1
        elif (side == 'hi' and float(g.upper()) <= 0) or (side == 'lo' and float(g.lower()) >= 0):
            gref += 1
        else:
            gunres += 1
    check("no sampled collapse is refuted by Arb", gref == 0,
          "%d confirmed outright, %d beyond this checker's resolution, %d refuted"
          % (gconf, gunres, gref))

    bad = [x for x in CHECKS if not x[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(bad)))
    print("Structure is checked for all %d nodes; arithmetic on %d leaves and %d "
          "collapses." % (len(tape), len(sample_leaf), len(sample_collapse)))
    if not bad:
        json.dump({
            "what": "independent replay and partial Arb check of the sweep's "
                    "subdivision proof",
            "engine": "python-flint / Arb, %d bits" % ctx.prec,
            "inputs": arb_provenance.hash_inputs(SOURCES),
            "replay": "node dev/sweep_proof.js 1.6 0.008 && python3 dev/sweep_proof_arb.py",
            "tape_sha256": digest,
            "nodes": len(tape), "leaves": leaves, "splits": splits,
            "collapses": collapses,
            "structure_checked": "all nodes",
            "leaf_sample": {"size": len(sample_leaf), "confirmed": confirmed,
                            "beyond_resolution": unresolved, "refuted": refuted},
            "collapse_sample": {"size": len(sample_collapse), "confirmed": gconf,
                                "beyond_resolution": gunres, "refuted": gref},
            "not_established": "that the unsampled nodes' arithmetic claims hold, "
                               "nor the sampled ones whose margin is finer than a "
                               "straightforward Arb enclosure can resolve",
            "checks": [{"name": n, "ok": ok} for n, ok in CHECKS],
        }, open(os.path.join(here, "sweep_proof_arb.results.json"), "w"),
            indent=2, sort_keys=True)
        print("wrote dev/sweep_proof_arb.results.json")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
