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

Run:  python3 dev/sweep_proof_arb.py                 # check the committed tape
      node dev/sweep_proof.js 1.6 0.008             # rebuild the tape itself
"""

import hashlib
import json
import math
import os
import sys
import time

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


def lo_out(x):
    """A float at or below every point of the ball `x`: the rounding of the conversion
    is taken outward, so the caller never narrows an enclosure by a float conversion."""
    return math.nextafter(float(x.lower()), -math.inf)


def hi_out(x):
    return math.nextafter(float(x.upper()), math.inf)


def span(a, b):
    """The hull [a, b] as a ball.  `a`, `b` may be floats or balls; the midpoint's own
    radius (the rounding of (a+b)/2 when a, b are balls) is carried into the result,
    which the previous version dropped -- an unsoundness of ~1e-20 that showed up as
    disjoint enclosures at point boxes."""
    a = a if isinstance(a, arb) else arb(a)
    b = b if isinstance(b, arb) else arb(b)
    m = (a + b) / 2
    rad = (b - a) / 2
    return arb(m.mid(), (float(rad.upper()) + float(m.rad())) * (1 + 1e-12) + 1e-300)


def point_pad(x):
    """A ball around the float `x` wide enough to contain the exact centre it stands for."""
    return abs(x) * 2.3e-16 + 1e-300


def pl_range(knots, coeffs, lo, hi):
    # The interpolation is done in ball arithmetic, so the returned ball
    # encloses the exact piecewise-linear value of the certificate as the
    # doubles represent it.  A previous version interpolated in Python floats
    # and then wrapped the result in a ball whose padding was relative to the
    # interval WIDTH, not to the value's magnitude -- so at a degenerate or
    # narrow interval the rounding of the interpolation itself was uncovered.
    # Numerically that slack (~1e-21 on coefficients of size 2e-5) never bound,
    # but the argument was by magnitude comparison, not by construction; a
    # reviewer flagged it and this removes the need for the argument.
    n = len(knots)
    def at(x):
        if x <= knots[0]:
            return arb(coeffs[0])
        if x >= knots[-1]:
            return arb(coeffs[-1])
        i, j = 0, n - 1
        while j - i > 1:
            m = (i + j) // 2
            if knots[m] <= x: i = m
            else: j = m
        t = (arb(x) - arb(knots[i])) / (arb(knots[i + 1]) - arb(knots[i]))
        return arb(coeffs[i]) * (1 - t) + arb(coeffs[i + 1]) * t
    vals = [at(lo), at(hi)] + [arb(coeffs[i]) for i in range(n) if lo < knots[i] < hi]
    lo_b = min(float(v.lower()) for v in vals)
    hi_b = max(float(v.upper()) for v in vals)
    return span(lo_b, hi_b)


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

    def __init__(self, here, candidate="tiling_pair.stationary.json"):
        cand = json.load(open(os.path.join(here, candidate)))
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
            ci = float(c[i].mid()); pi_ = point_pad(ci)
            if SIGN_A[i]:
                val += SIGN_A[i] * pl_range(self.base["knots"], self.base["a"], ci - pi_, ci + pi_)
            if SIGN_B[i]:
                val += SIGN_B[i] * pl_range(self.base["knots"], self.base["b"], ci - pi_, ci + pi_)
        for k in range(5):
            ck, ck1 = float(c[k].mid()), float(c[k + 1].mid())
            pk, pk1 = point_pad(ck), point_pad(ck1)
            val += grid_range(self.mats[k], self.J, self.knots, ck - pk, ck + pk, ck1 - pk1, ck1 + pk1)
        _, grad = self.bound_and_grad(lo, hi)
        for k in range(6):
            val += grad[k] * rad[k]
        return val, grad

    def grad_centered(self, lo, hi):
        """The pair part of the gradient in centred form: grad(centre) plus the second
        derivative over the box times the half-widths (mean value theorem, componentwise;
        the pair part is smooth).  The additive and pair-state parts keep their exact slope
        hulls, since a piecewise-linear slope has no centred form across a knot."""
        c = [(arb(lo[k]) + arb(hi[k])) / 2 for k in range(6)]
        rad = [span(lo[k], hi[k]) - c[k] for k in range(6)]
        pc, plo, phi = [arb(0)], [arb(0)], [arb(0)]
        for k in range(6):
            pc.append(pc[k] + c[k])
            plo.append(plo[k] + arb(lo[k]))
            phi.append(phi[k] + arb(hi[k]))
        g = [arb(1) / 3000 for _ in range(6)]
        H = [[arb(0) for _ in range(6)] for _ in range(6)]
        for (i, j) in PAIRS:
            coef = arb(2) / (NPTS - (j - i))
            wd = KP.weight_d(pc[j] - pc[i]) * coef
            dbox = span(plo[j] - phi[i], phi[j] - plo[i])
            try:
                wdd = KP.weight_dd(dbox) * coef
            except ValueError:
                # the jet arithmetic has no series branch at the kernel's removable
                # singularity 1/(sqrt2 pi); a box straddling it keeps the natural gradient
                return None
            for k in range(i, j):
                g[k] += wd
                for l in range(i, j):
                    H[k][l] += wdd
        for i in range(6):
            if SIGN_A[i]:
                g[i] += SIGN_A[i] * pl_slope_range(self.base["knots"], self.base["a"], lo[i], hi[i])
            if SIGN_B[i]:
                g[i] += SIGN_B[i] * pl_slope_range(self.base["knots"], self.base["b"], lo[i], hi[i])
        for k in range(5):
            dx, dy = grid_slopes(self.mats[k], self.J, self.knots,
                                 lo[k], hi[k], lo[k + 1], hi[k + 1])
            g[k] += dx
            g[k + 1] += dy
        for k in range(6):
            for l in range(6):
                g[k] += H[k][l] * rad[l]
        return g

    def best_bound(self, lo, hi):
        nat, grad = self.bound_and_grad(lo, hi)
        cen, _ = self.bound_and_grad_centered(lo, hi)
        gcen = self.grad_centered(lo, hi)
        if gcen is not None:
            for k in range(6):
                try:
                    grad[k] = grad[k].intersection(gcen[k])
                except ValueError:
                    CONFLICTS.append({"kind": "grad", "k": k, "lo": list(lo), "hi": list(hi),
                                      "natural": str(grad[k]), "centred": str(gcen[k])})
        try:
            val = nat.intersection(cen)
        except ValueError:
            CONFLICTS.append({"kind": "value", "lo": list(lo), "hi": list(hi),
                              "natural": str(nat), "centred": str(cen)})
            val = nat
        return val, grad

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
            d = span(plo[j] - phi[i], phi[j] - plo[i])
            c = arb(2) / (NPTS - (j - i))
            val += self.pieces.w_range(lo_out(d), hi_out(d)) * c
            dw = self.pieces.wd_range(lo_out(d), hi_out(d)) * c
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
CONFLICTS = []   # disjoint enclosures of one quantity: a soundness fault somewhere, recorded, never hidden


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok)))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    args = sys.argv[1:]
    def opt(name, default=None):
        for a in args:
            if a.startswith("--" + name + "="):
                return a[len(name) + 3:]
        return default
    meta_name = opt("meta", "sweep_proof.json")
    check_all = "--all" in args
    limit = int(opt("limit", "0"))
    refine = int(opt("refine", "0"))     # verified subdivision depth for unresolved nodes
    sample_n = int(opt("sample", "220"))  # arithmetic sample size per node kind
    out_name = opt("out", None)
    meta = json.load(open(os.path.join(here, meta_name)))
    candidate = meta.get("candidate", "tiling_pair.stationary.json")
    sources = list(SOURCES)
    if meta_name != "sweep_proof.json":
        sources[sources.index("sweep_proof.json")] = meta_name
    if candidate not in sources:
        sources.append(candidate)
    cert = Cert(here, candidate)
    tape = open(os.path.join(here, meta["tape"]), "rb").read()
    # inline arithmetic (every node, or the first `limit`), with checkpoints
    acc = {"leaf": [0, 0, 0], "coll": [0, 0, 0], "checked": 0, "started": time.time()}
    def ckpt_path():
        return os.path.join(here, (out_name or "sweep_proof_arb.results.json")
                            .replace(".json", ".checkpoint.json"))
    acc["sub"] = 0     # sub-boxes evaluated during verified subdivision
    def widest(lo, hi):
        k, w = -1, -1.0
        for i in range(6):
            if hi[i] - lo[i] > w: k, w = i, hi[i] - lo[i]
        return k, w
    def verdict_leaf(lo, hi, depth):
        """0 confirmed, 1 unresolved, 2 refuted -- with verified subdivision to `depth`.
        A refutation on any sub-box refutes the leaf (its minimum over the sub-box is
        below the target); confirmation needs every sub-box confirmed."""
        val, _ = cert.best_bound(lo, hi)
        acc["sub"] += 1
        if float(val.lower()) >= target: return 0
        if float(val.upper()) < target: return 2
        if depth == 0: return 1
        k, w = widest(lo, hi)
        if k < 0 or w <= 0: return 1
        mid = (lo[k] + hi[k]) / 2
        lo2 = list(lo); lo2[k] = mid
        hi2 = list(hi); hi2[k] = mid
        a = verdict_leaf(tuple(lo), tuple(hi2), depth - 1)
        if a == 2: return 2
        b = verdict_leaf(tuple(lo2), tuple(hi), depth - 1)
        if b == 2: return 2
        return 0 if (a == 0 and b == 0) else 1
    def verdict_coll(lo, hi, k, side, depth):
        _, grad = cert.best_bound(lo, hi)
        acc["sub"] += 1
        g = grad[k]
        if side == 'hi' and float(g.lower()) > 0: return 0
        if side == 'lo' and float(g.upper()) < 0: return 0
        if (side == 'hi' and float(g.upper()) <= 0) or (side == 'lo' and float(g.lower()) >= 0): return 2
        if depth == 0: return 1
        kk, w = widest(lo, hi)
        if kk < 0 or w <= 0: return 1
        mid = (lo[kk] + hi[kk]) / 2
        lo2 = list(lo); lo2[kk] = mid
        hi2 = list(hi); hi2[kk] = mid
        a = verdict_coll(tuple(lo), tuple(hi2), k, side, depth - 1)
        if a == 2: return 2
        b = verdict_coll(tuple(lo2), tuple(hi), k, side, depth - 1)
        if b == 2: return 2
        return 0 if (a == 0 and b == 0) else 1
    def leaf_arith(lo, hi):
        acc["leaf"][verdict_leaf(lo, hi, refine)] += 1
        acc["checked"] += 1
        if acc["checked"] % 20000 == 0: checkpoint()
    def coll_arith(lo, hi, k, side):
        acc["coll"][verdict_coll(lo, hi, k, side, refine)] += 1
        acc["checked"] += 1
        if acc["checked"] % 20000 == 0: checkpoint()
    def checkpoint():
        el = time.time() - acc["started"]
        rec = {"what": "checkpoint of an inline Arb check of every node of a proof tape",
               "meta": meta_name, "candidate": candidate, "checked": acc["checked"],
               "leaf_confirmed_unresolved_refuted": list(acc["leaf"]),
               "collapse_confirmed_unresolved_refuted": list(acc["coll"]),
               "refine_depth": refine, "sub_boxes_evaluated": acc["sub"],
               "seconds": round(el, 1), "per_node_ms": round(1000 * el / max(1, acc["checked"]), 3)}
        json.dump(rec, open(ckpt_path(), "w"), indent=1)
        print("  checkpoint: %d checked, leaves %s, collapses %s, %.1f s (%.3f ms/node)"
              % (acc["checked"], acc["leaf"], acc["coll"], el, 1000 * el / max(1, acc["checked"])), flush=True)
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
    step_leaf = max(1, meta["leaves"] // sample_n)
    step_coll = max(1, meta["collapses"] // sample_n)
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
                    if check_all and (limit == 0 or acc["checked"] < limit):
                        leaf_arith(tuple(lo), tuple(hi))
                    elif leaves % step_leaf == 0 and len(sample_leaf) < sample_n:
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
                    if check_all and (limit == 0 or acc["checked"] < limit):
                        coll_arith(tuple(lo), tuple(hi), k, 'lo' if op < OP_HI else 'hi')
                    elif collapses % step_coll == 0 and len(sample_collapse) < sample_n:
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

    # ---- arithmetic, on the sample (or, with --all, already done inline)
    cnt = list(acc["leaf"])
    for lo, hi in sample_leaf:
        cnt[verdict_leaf(lo, hi, refine)] += 1
    confirmed, unresolved, refuted = cnt
    check("no sampled discharged leaf is refuted by Arb", refuted == 0,
          "%d confirmed outright, %d beyond this checker's resolution, %d refuted"
          % (confirmed, unresolved, refuted))

    gcnt = list(acc["coll"])
    for lo, hi, k, side in sample_collapse:
        gcnt[verdict_coll(lo, hi, k, side, refine)] += 1
    gconf, gunres, gref = gcnt
    check("no sampled collapse is refuted by Arb", gref == 0,
          "%d confirmed outright, %d beyond this checker's resolution, %d refuted"
          % (gconf, gunres, gref))

    check("no pair of enclosures of one quantity was disjoint (a disjoint pair means one is unsound)",
          len(CONFLICTS) == 0, "%d conflicts" % len(CONFLICTS))
    if CONFLICTS:
        cpath = os.path.join(here, (out_name or "sweep_proof_arb.results.json").replace(".json", ".conflicts.json"))
        json.dump(CONFLICTS[:200], open(cpath, "w"), indent=1)
        print("conflicts written to", cpath)
    bad = [x for x in CHECKS if not x[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(bad)))
    n_leaf_checked = sum(acc["leaf"]) if check_all else len(sample_leaf)
    n_coll_checked = sum(acc["coll"]) if check_all else len(sample_collapse)
    print("Structure is checked for all %d nodes; arithmetic on %d leaves and %d "
          "collapses." % (len(tape), n_leaf_checked, n_coll_checked))
    if not bad:
        json.dump({
            "what": "independent replay and partial Arb check of the sweep's "
                    "subdivision proof",
            "engine": "python-flint / Arb, %d bits" % ctx.prec,
            "inputs": arb_provenance.hash_inputs(sources),
            "mode": "every node, inline" if check_all else "sample",
            "candidate": candidate,
            "arithmetic_checked": (sum(acc["leaf"]) + sum(acc["coll"])) if check_all
                                  else len(sample_leaf) + len(sample_collapse),
            "refine_depth": refine,
            "sub_boxes_evaluated": acc["sub"],
            # Two commands, and only the first is a replay of THIS transcript.
            # dev/check_arb.js executes `replay`, so it must not write a repo
            # file that is also a declared input -- regenerating sweep_proof.json
            # restamps its commit and leaves the worktree dirty after every suite
            # run.  Rebuilding the tape is a separate, rarer act, so it gets its
            # own field: recorded for whoever wants it, never run by the checker.
            "replay": "python3 dev/sweep_proof_arb.py",
            "tape_replay": "node dev/sweep_proof.js 1.6 0.008",
            "tape_sha256": digest,
            "nodes": len(tape), "leaves": leaves, "splits": splits,
            "collapses": collapses,
            "structure_checked": "all nodes",
            "leaf_sample": {"size": (sum(acc["leaf"]) if check_all else len(sample_leaf)), "confirmed": confirmed,
                            "beyond_resolution": unresolved, "refuted": refuted},
            "collapse_sample": {"size": (sum(acc["coll"]) if check_all else len(sample_collapse)), "confirmed": gconf,
                                "beyond_resolution": gunres, "refuted": gref},
            "not_established": "that the unsampled nodes' arithmetic claims hold, "
                               "nor the sampled ones whose margin is finer than a "
                               "straightforward Arb enclosure can resolve",
            "checks": [{"name": n, "ok": ok} for n, ok in CHECKS],
        }, open(os.path.join(here, out_name or "sweep_proof_arb.results.json"), "w"),
            indent=2, sort_keys=True)
        print("wrote dev/" + (out_name or "sweep_proof_arb.results.json"))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
