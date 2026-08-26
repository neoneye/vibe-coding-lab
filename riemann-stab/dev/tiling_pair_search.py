"""Discovery tool for PAIR-STATE coboundary certificates.  NOT in the trusted base.

The additive family cannot reach the alternating chain energy.  Its best member
stops at 0.003957227285, short by 1.66e-7, and dev/tiling_defect.js says where
that goes: three near-degenerate basins, one of which is a high-high defect
block that the chain charges a certified wall tension of 1.47e-4 and the block
relaxation charges essentially nothing.  A potential that sees only individual
gaps cannot charge an ADJACENCY, so it has to lift the high-high defect without
noticing it is one.

This file widens the family to potentials on consecutive PAIRS.  For any state
potential Phi on five consecutive gaps,

    R(g) = F6(g) + Phi(g_2..g_6) - Phi(g_1..g_5)

telescopes, so min_g R(g) is a lower bound on the per-gap chain energy.  Taking
Phi(s) = sum_{j=1..4} phi_j(s_j, s_{j+1}) gives the normal form

    R(g) = F6(g) + sum_{k=1..5} psi_k(g_k, g_{k+1}),   sum_k psi_k = 0,

with five bivariate functions.  Setting psi_k(x,y) = u_k(x) + v_k(y) recovers
the additive family exactly, so this is a strict widening; what it adds is the
ability to price (low, low) differently from (high, high).

The ceiling is unchanged and structural: F6 is reversal-invariant and the
coboundary cancels between the two phases of the alternating chain, so

    min_g R(g) <= (R(alt, phase 0) + R(alt, phase 1)) / 2 = F6(alt) = E_alt

for EVERY telescoping certificate.  Reaching E_alt is therefore the whole game --
it would say the alternating chain is the minimiser, which is the crystallization
statement.  Exceeding it is impossible.

Everything here is floating point, heuristic, and outside the trusted base.  It
emits candidates; a candidate is worth nothing until an interval sweep confirms
it.

    python3 tiling_pair_search.py maxmin [knots] [rounds] [out.json]
"""
import json
import sys
import time

import numpy as np
from scipy.optimize import linprog

SQRT2 = np.sqrt(2.0)
N = 7
P = 3000.0
PAIRS = [(i, j) for i in range(N) for j in range(i + 1, N)]
E_ALT = 0.003957393309109344          # dev/coercivity_arb.py, rigorously enclosed
LOW = 1.0416801034484870
HIGH = 1.9794672314032244


def sinc0(x):
    x = np.asarray(x, dtype=float)
    out = np.empty_like(x)
    small = np.abs(x) < 1e-7
    x2 = x * x
    out[small] = 1 - x2[small] / 6 + x2[small] * x2[small] / 120
    ns = ~small
    out[ns] = np.sin(x[ns]) / x[ns]
    return out


def sinc0d(x):
    x = np.asarray(x, dtype=float)
    out = np.empty_like(x)
    small = np.abs(x) < 1e-5
    xs = x[small]
    x2 = xs * xs
    out[small] = -xs / 3 + xs * x2 / 30 - xs * x2 * x2 / 840
    ns = ~small
    xn = x[ns]
    out[ns] = (xn * np.cos(xn) - np.sin(xn)) / (xn * xn)
    return out


def mt_kernel(x):
    b = 2 * np.pi * np.asarray(x, dtype=float)
    return 0.5 * sinc0((SQRT2 - b) / 2) + 0.5 * sinc0((SQRT2 + b) / 2)


K0 = float(mt_kernel(np.array([0.0]))[0])


def w(x):
    k = mt_kernel(x) / K0
    return k * k


def wd(x):
    x = np.asarray(x, dtype=float)
    zl = (SQRT2 - 2 * np.pi * x) / 2
    zr = (SQRT2 + 2 * np.pi * x) / 2
    kern = 0.5 * (sinc0(zl) + sinc0(zr))
    der = 0.5 * np.pi * (-sinc0d(zl) + sinc0d(zr))
    return 2 * kern * der / (K0 * K0)


def f6_grad(g):
    g = np.atleast_2d(np.asarray(g, dtype=float))
    m = g.shape[0]
    pts = np.concatenate([np.zeros((m, 1)), np.cumsum(g, axis=1)], axis=1)
    val = g.sum(axis=1) / P
    grad = np.full((m, 6), 1.0 / P)
    for (i, j) in PAIRS:
        d = pts[:, j] - pts[:, i]
        c = 2.0 / (N - (j - i))
        val = val + c * w(d)
        dv = c * wd(d)
        for k in range(i, j):
            grad[:, k] += dv
    return val, grad


def f6(g):
    return f6_grad(g)[0]


# ------------------------------------------------------------------ basis
def make_knots(count):
    """Knots concentrated where the gaps live, with a clamped tail."""
    core = np.linspace(0.80, 2.30, count - 6)
    return np.unique(np.concatenate([
        np.array([0.0, 0.35, 0.62]), core,
        np.array([2.70, 3.30, 4.50, 7.0, 12.0])]))


class Hat:
    def __init__(self, knots):
        self.t = np.asarray(knots, dtype=float)
        self.J = len(self.t)

    def weights(self, g):
        g = np.clip(np.asarray(g, dtype=float), self.t[0], self.t[-1])
        idx = np.clip(np.searchsorted(self.t, g, side='right') - 1, 0, self.J - 2)
        t0 = self.t[idx]
        t1 = self.t[idx + 1]
        frac = (g - t0) / (t1 - t0)
        W = np.zeros((g.shape[0], self.J))
        rows = np.arange(g.shape[0])
        W[rows, idx] += 1 - frac
        W[rows, idx + 1] += frac
        return W

    def dweights(self, g):
        """Derivative of the hat weights; zero where the argument is clamped."""
        gg = np.asarray(g, dtype=float)
        idx = np.clip(np.searchsorted(self.t, np.clip(gg, self.t[0], self.t[-1]),
                                      side='right') - 1, 0, self.J - 2)
        h = self.t[idx + 1] - self.t[idx]
        D = np.zeros((gg.shape[0], self.J))
        rows = np.arange(gg.shape[0])
        live = ~self.clamped(gg)
        D[rows[live], idx[live]] -= 1.0 / h[live]
        D[rows[live], idx[live] + 1] += 1.0 / h[live]
        return D

    def index_frac(self, g):
        g = np.clip(np.asarray(g, dtype=float), self.t[0], self.t[-1])
        idx = np.clip(np.searchsorted(self.t, g, side='right') - 1, 0, self.J - 2)
        t0 = self.t[idx]
        t1 = self.t[idx + 1]
        return idx, (g - t0) / (t1 - t0), t1 - t0

    def clamped(self, g):
        g = np.asarray(g, dtype=float)
        return (g <= self.t[0]) | (g >= self.t[-1])


def pair_features(hat, X, Y):
    """(m,J*J) bilinear features for the pair (X, Y)."""
    WX = hat.weights(X)
    WY = hat.weights(Y)
    return (WX[:, :, None] * WY[:, None, :]).reshape(X.shape[0], -1)


def pair_value_grad(hat, C, X, Y):
    """value and the two partial derivatives of a bilinear psi at (X, Y)."""
    ix, fx, hx = hat.index_frac(X)
    iy, fy, hy = hat.index_frac(Y)
    c00 = C[ix, iy]
    c01 = C[ix, iy + 1]
    c10 = C[ix + 1, iy]
    c11 = C[ix + 1, iy + 1]
    val = ((1 - fx) * ((1 - fy) * c00 + fy * c01)
           + fx * ((1 - fy) * c10 + fy * c11))
    dx = (((1 - fy) * c10 + fy * c11) - ((1 - fy) * c00 + fy * c01)) / hx
    dy = (((1 - fx) * c01 + fx * c11) - ((1 - fx) * c00 + fx * c10)) / hy
    # a clamped coordinate contributes no slope
    dx = np.where(hat.clamped(X), 0.0, dx)
    dy = np.where(hat.clamped(Y), 0.0, dy)
    return val, dx, dy


# --------------------------------------------------------- reduced cost
FREE = 4                 # psi_1..psi_4 free; psi_5 = -(psi_1+..+psi_4)


def features(hat, G):
    """(m, FREE*J*J): psi_k acts on (g_k, g_{k+1}) minus its action on (g_5, g_6)."""
    tail = pair_features(hat, G[:, 4], G[:, 5])
    return np.concatenate([pair_features(hat, G[:, k], G[:, k + 1]) - tail
                           for k in range(FREE)], axis=1)


def unpack(c, J):
    return [c[k * J * J:(k + 1) * J * J].reshape(J, J) for k in range(FREE)]


def reduced(hat, mats, G, grad=False):
    G = np.atleast_2d(G)
    val, gr = f6_grad(G)
    gr = gr.copy()
    tail = -sum(mats)                       # psi_5
    for k, C in enumerate(list(mats) + [tail]):
        v, dx, dy = pair_value_grad(hat, C, G[:, k], G[:, k + 1])
        val = val + v
        if grad:
            gr[:, k] += dx
            gr[:, k + 1] += dy
    return (val, gr) if grad else val


# ------------------------------------------------------------------- LP
def solve_lp_amplitude(A, F, target, cap):
    """Smallest sup-norm psi that clears `target` on the current cut set.

    Maximising the floor directly does not work here: the family has 4*J^2
    parameters and the cut set never constrains all of them, so the LP puts
    whatever it likes wherever no cut looks -- the first version of this loop
    reported an LP bound of exactly E_alt while its own adversary found points
    at -0.15.  Asking instead for the SMALLEST certificate that clears a fixed
    target keeps the unconstrained directions at zero, and the target is then
    walked up by hand.
    """
    m, n = A.shape
    # variables [c (n), s]; minimise s subject to -s <= c_i <= s and A c >= target - F
    A_ub = np.zeros((2 * n + m, n + 1))
    b_ub = np.zeros(2 * n + m)
    A_ub[:n, :n] = np.eye(n)
    A_ub[:n, n] = -1.0
    A_ub[n:2 * n, :n] = -np.eye(n)
    A_ub[n:2 * n, n] = -1.0
    A_ub[2 * n:, :n] = -A
    b_ub[2 * n:] = F - target
    obj = np.zeros(n + 1)
    obj[n] = 1.0
    res = linprog(obj, A_ub=A_ub, b_ub=b_ub,
                  bounds=[(-cap, cap)] * n + [(0, cap)], method='highs')
    if not res.success:
        return None, None
    return res.x[:n], float(res.x[n])


def solve_lp(hat, A, F, bound):
    m, n = A.shape
    A_ub = np.concatenate([-A, np.ones((m, 1))], axis=1)
    obj = np.zeros(n + 1)
    obj[-1] = -1.0
    bounds = [(-bound, bound)] * n + [(None, None)]
    res = linprog(obj, A_ub=A_ub, b_ub=F, bounds=bounds, method='highs')
    if not res.success:
        raise RuntimeError(res.message)
    return res.x[:n], float(res.x[-1])


# ------------------------------------------------------------ adversary
def batch_adam(hat, mats, X, steps=400, lr=0.05, lo=0.02, hi=12.0):
    m1 = np.zeros_like(X)
    m2 = np.zeros_like(X)
    for t in range(1, steps + 1):
        _, gr = reduced(hat, mats, X, grad=True)
        m1 = 0.9 * m1 + 0.1 * gr
        m2 = 0.999 * m2 + 0.001 * gr * gr
        mh = m1 / (1 - 0.9 ** t)
        vh = m2 / (1 - 0.999 ** t)
        rate = lr * (0.1 + 0.9 * (1 - t / steps))
        X = np.clip(X - rate * mh / (np.sqrt(vh) + 1e-12), lo, hi)
    return X


def seeds(rng, count):
    alt0 = np.tile([LOW, HIGH], 3)
    alt1 = np.tile([HIGH, LOW], 3)
    fixed = [alt0, alt1,
             np.array([HIGH, LOW, HIGH, HIGH, LOW, HIGH]),     # high-high defect
             np.array([LOW, HIGH, LOW, LOW, HIGH, LOW]),       # low-low defect
             np.array([1.98135, 1.04247, 1.98414, 1.04602, 2.95584, 1.04705])]
    rand = rng.uniform(0.6, 3.2, size=(count, 6))
    band = rng.uniform(0, 1, size=(count, 6)) < 0.5
    rand = np.where(band, rng.uniform(0.95, 1.25, size=(count, 6)),
                    rng.uniform(1.8, 2.4, size=(count, 6)))
    wide = rng.uniform(0.3, 6.0, size=(count // 2, 6))
    return np.vstack([np.array(fixed), rand, wide])


def climb(knot_count, rounds, out_path, start_target=0.0039, cap=0.5):
    """Walk the target up towards E_alt, re-solving for the smallest certificate."""
    hat = Hat(make_knots(knot_count))
    J = hat.J
    rng = np.random.default_rng(20260826)
    print("knots %d, variables %d" % (J, FREE * J * J), flush=True)

    G = np.vstack([seeds(rng, 1500),
                   rng.uniform(0.35, 3.6, size=(6000, 6))])
    F = f6(G)
    A = features(hat, G)
    target = start_target
    best = None
    for r in range(rounds):
        t0 = time.time()
        c, amp = solve_lp_amplitude(A, F, target, cap)
        if c is None:
            print("  round %2d  target %.12f  INFEASIBLE on the cut set" % (r, target),
                  flush=True)
            target = (target + (best[0] if best else start_target)) / 2
            continue
        mats = unpack(c, J)
        X = batch_adam(hat, mats, seeds(rng, 1200))
        vals = reduced(hat, mats, X)
        order = np.argsort(vals)
        keep = X[order[:300]]
        worst = float(vals[order[0]])
        alt = float(reduced(hat, mats, np.array([np.tile([LOW, HIGH], 3)]))[0])
        print("  round %2d  target %.12f  amp %.4f  adversary %.12f  R(alt) %.12f"
              "  cuts %d  (%.1fs)"
              % (r, target, amp, worst, alt, A.shape[0], time.time() - t0), flush=True)
        if best is None or worst > best[0]:
            best = (worst, c.copy(), target, amp)
        if worst >= target - 1e-12:
            target = min(E_ALT, target + max(1e-6, (E_ALT - target) * 0.5))
        G = np.vstack([G, keep])
        F = np.concatenate([F, f6(keep)])
        A = np.vstack([A, features(hat, keep)])
        if A.shape[0] > 20000:
            slack = F - A @ c
            idx = np.argsort(slack)[:14000]
            G, F, A = G[idx], F[idx], A[idx]

    worst, c, target, amp = best
    print("\nbest adversary-verified floor %.12f   E_alt %.12f   short by %.3e"
          % (worst, E_ALT, E_ALT - worst))
    with open(out_path, "w") as fh:
        json.dump({"what": "pair-state coboundary candidate (NOT trusted base)",
                   "knots": hat.t.tolist(), "free": FREE,
                   "coefficients": c.tolist(), "target": target,
                   "amplitude": amp, "adversary_floor": worst,
                   "e_alt": E_ALT}, fh)
    print("wrote " + out_path)


def gradient_features(hat, G):
    """d/dg_i of the psi part, as a linear functional of the free coefficients.

    Rows: one per (block, i).  Used to pin the gradient of R to zero at the
    alternating blocks -- the constraint that turns "the floor is nearly E_alt"
    into "the alternating block is a critical point of R", which is what a
    certificate attaining the ceiling has to be.
    """
    m = G.shape[0]
    J = hat.J
    out = np.zeros((m, 6, FREE * J * J))
    W = [hat.weights(G[:, i]) for i in range(6)]
    D = [hat.dweights(G[:, i]) for i in range(6)]

    def outer(a, b):
        return (a[:, :, None] * b[:, None, :]).reshape(m, -1)

    for k in range(FREE):
        sl = slice(k * J * J, (k + 1) * J * J)
        out[:, k, sl] += outer(D[k], W[k + 1])
        out[:, k + 1, sl] += outer(W[k], D[k + 1])
        out[:, 4, sl] -= outer(D[4], W[5])
        out[:, 5, sl] -= outer(W[4], D[5])
    return out


# --------------------------------------------- pair correction to a base
SIGN_A = np.array([1.0, 0.0, -1.0, -1.0, 0.0, 1.0])
SIGN_B = np.array([0.0, 1.0, -1.0, -1.0, 1.0, 0.0])


class AdditiveBase:
    """An existing additive certificate, evaluated on its own knots."""

    def __init__(self, entry):
        self.t = np.asarray(entry["knots"], dtype=float)
        self.a = np.asarray(entry["a"], dtype=float)
        self.b = np.asarray(entry["b"], dtype=float)
        self.name = entry["name"]
        self.floor = entry["floor"]

    def _v(self, c, g):
        return np.interp(np.clip(g, self.t[0], self.t[-1]), self.t, c)

    def _s(self, c, g):
        gg = np.clip(np.asarray(g, dtype=float), self.t[0], self.t[-1])
        idx = np.clip(np.searchsorted(self.t, gg, side='right') - 1, 0, len(self.t) - 2)
        return (c[idx + 1] - c[idx]) / (self.t[idx + 1] - self.t[idx])

    def value_grad(self, G):
        val, gr = f6_grad(G)
        gr = gr.copy()
        for i in range(6):
            if SIGN_A[i]:
                val = val + SIGN_A[i] * self._v(self.a, G[:, i])
                gr[:, i] += SIGN_A[i] * self._s(self.a, G[:, i])
            if SIGN_B[i]:
                val = val + SIGN_B[i] * self._v(self.b, G[:, i])
                gr[:, i] += SIGN_B[i] * self._s(self.b, G[:, i])
        return val, gr


def improve(base_name, knot_count, rounds, cap, out_path, stages=1,
            stationary=False):
    """Add a pair-state correction to an additive certificate and push the floor.

    Searching the whole pair family from scratch does not converge: 4 J^2
    parameters against a cut set that can never cover six dimensions, so the LP
    fills the unsampled directions with holes faster than the adversary finds
    them.  Starting from a certificate that already reaches 0.003957227285 and
    asking only for a bounded CORRECTION keeps the problem small and well posed,
    and answers the question that matters -- whether pricing adjacencies buys
    anything the additive family cannot have.
    """
    with open("tiling_additive.certificate.json") as fh:
        bundle = json.load(fh)
    certs = bundle["certificates"]
    entry = next(e for e in (certs.values() if isinstance(certs, dict) else certs)
                 if e["name"] == base_name)
    base = AdditiveBase(entry)
    hat = Hat(make_knots(knot_count))
    J = hat.J
    rng = np.random.default_rng(20260826)
    print("base %s (floor %.12f), correction knots %d, variables %d, cap %g"
          % (base.name, base.floor, J, FREE * J * J, cap), flush=True)

    accum = [np.zeros((J, J)) for _ in range(FREE)]

    def total(G, mats, grad=False):
        val, gr = base.value_grad(G)
        allm = [accum[k] + mats[k] for k in range(FREE)]
        mats = allm
        tail = -sum(mats)
        for k, C in enumerate(list(mats) + [tail]):
            v, dx, dy = pair_value_grad(hat, C, G[:, k], G[:, k + 1])
            val = val + v
            if grad:
                gr[:, k] += dx
                gr[:, k + 1] += dy
        return (val, gr) if grad else val

    def adam(mats, X, steps=400, lr=0.05):
        m1 = np.zeros_like(X)
        m2 = np.zeros_like(X)
        for t in range(1, steps + 1):
            _, gr = total(X, mats, grad=True)
            m1 = 0.9 * m1 + 0.1 * gr
            m2 = 0.999 * m2 + 0.001 * gr * gr
            rate = lr * (0.1 + 0.9 * (1 - t / steps))
            X = np.clip(X - rate * (m1 / (1 - 0.9 ** t))
                        / (np.sqrt(m2 / (1 - 0.999 ** t)) + 1e-12), 0.02, 12.0)
        return X

    G = np.vstack([seeds(rng, 2500), rng.uniform(0.35, 3.6, size=(9000, 6))])
    A = features(hat, G)
    zero = [np.zeros((J, J)) for _ in range(FREE)]
    reached = float(total(adam(zero, seeds(rng, 1500)), zero).min())
    print("  base adversary floor %.12f" % reached, flush=True)

    def accum_val(X):
        """Everything already absorbed, so the LP only sees the new correction."""
        return total(X, zero)

    base_val = accum_val(G)

    # Stationarity at the alternating blocks.  Without it the LP can only push
    # the floor up to where R dips just OFF the alternating point, which is the
    # entire residue the knot ladder was chipping at.
    alt = np.array([np.tile([LOW, HIGH], 3), np.tile([HIGH, LOW], 3)])

    def equalities(with_kappa=True):
        """R = E_alt at both alternating blocks, and its gradient zero there.

        The value rows are not optional.  Pinning only the gradient makes the
        alternating block a critical point of the WRONG value: the coboundary is
        free to shift R(alt, phase 0) down and R(alt, phase 1) up by the same
        amount -- their sum is fixed, each is not -- and the first attempt did
        exactly that, dropping phase 0 by 1e-5 and the floor with it.
        """
        gf = gradient_features(hat, alt).reshape(-1, FREE * J * J)
        vf = features(hat, alt)
        vbase, gbase = total(alt, zero, grad=True)
        Ae = np.vstack([vf, gf])
        be = np.concatenate([E_ALT - vbase, -gbase.reshape(-1)])
        if with_kappa:
            Ae = np.concatenate([Ae, np.zeros((Ae.shape[0], 1))], axis=1)
        return Ae, be

    # The equalities go straight into the floor-maximising LP rather than being
    # solved first.  Solving them first picks the SMALLEST correction that pins
    # the alternating block, which is a spiky one: it satisfied stationarity to
    # 7e-16 and dug a 2.8e-5 hole elsewhere, which no later round under the
    # improvement cap could climb out of.  Inside the LP the same equalities are
    # satisfied by whichever correction is best for the floor.
    A_eq, b_eq = equalities() if stationary else (None, None)

    best = (reached, np.zeros(FREE * J * J))
    for r in range(rounds * stages):
        if r and r % rounds == 0:
            # absorb: the correction becomes part of the base and the LP starts
            # over with a fresh cap.  One pass of the cap is limited by how deep
            # a hole the LP can dig before the adversary finds it; absorbing and
            # repeating compounds the gain instead.
            for k in range(FREE):
                accum[k] = accum[k] + best[1][k * J * J:(k + 1) * J * J].reshape(J, J)
            best = (best[0], np.zeros(FREE * J * J))
            base_val = accum_val(G)
            if stationary:
                A_eq, b_eq = equalities()
            print("  -- absorbed; base now %.12f" % best[0], flush=True)
        t0 = time.time()
        m, n = A.shape
        A_ub = np.concatenate([-A, np.ones((m, 1))], axis=1)
        obj = np.zeros(n + 1)
        obj[-1] = -1.0
        res = linprog(obj, A_ub=A_ub, b_ub=base_val, A_eq=A_eq, b_eq=b_eq,
                      bounds=[(-cap, cap)] * n + [(None, None)], method='highs')
        if not res.success:
            print("  round %2d  LP failed: %s" % (r, res.message), flush=True)
            break
        d = res.x[:n]
        kappa = float(res.x[-1])
        mats = unpack(d, J)
        X = adam(mats, seeds(rng, 1500))
        vals = total(X, mats)
        order = np.argsort(vals)
        keep = X[order[:400]]
        worst = float(vals[order[0]])
        print("  round %2d  LP %.12f  adversary %.12f  (base %.12f)  cuts %d  (%.1fs)"
              % (r, kappa, worst, base.floor, m, time.time() - t0), flush=True)
        if worst > best[0]:
            best = (worst, d.copy())
        G = np.vstack([G, keep])
        base_val = np.concatenate([base_val, accum_val(keep)])
        A = np.vstack([A, features(hat, keep)])
        if A.shape[0] > 26000:
            slack = base_val - A @ d
            idx = np.argsort(slack)[:18000]
            G, base_val, A = G[idx], base_val[idx], A[idx]

    worst, d = best
    print("\nbest adversary-verified floor %.12f" % worst)
    print("  additive base            %.12f" % base.floor)
    print("  alternating ceiling      %.12f" % E_ALT)
    print("  gain over the base       %+.3e" % (worst - base.floor))
    print("  still short of E_alt by  %.3e" % (E_ALT - worst))
    for k in range(FREE):
        accum[k] = accum[k] + d[k * J * J:(k + 1) * J * J].reshape(J, J)
    with open(out_path, "w") as fh:
        json.dump({"what": "pair-state correction to an additive certificate"
                           " (NOT trusted base)",
                   "base": base.name, "knots": hat.t.tolist(), "free": FREE,
                   "cap": cap, "stages": stages,
                   "correction": np.concatenate([m.ravel() for m in accum]).tolist(),
                   "adversary_floor": worst, "base_floor": base.floor,
                   "e_alt": E_ALT}, fh)
    print("wrote " + out_path)


def maxmin(knot_count, rounds, out_path):
    hat = Hat(make_knots(knot_count))
    J = hat.J
    rng = np.random.default_rng(20260826)
    print(f"knots {J}, variables {FREE * J * J}", flush=True)

    G = seeds(rng, 400)
    F = f6(G)
    A = features(hat, G)
    bound = 0.02
    best = None
    for r in range(rounds):
        t0 = time.time()
        c, kappa = solve_lp(hat, A, F, bound)
        mats = unpack(c, J)
        X = batch_adam(hat, mats, seeds(rng, 900))
        vals = reduced(hat, mats, X)
        order = np.argsort(vals)
        keep = X[order[:220]]
        kv = vals[order[:220]]
        worst = float(kv[0])
        alt_val = float(reduced(hat, mats, np.array([np.tile([LOW, HIGH], 3)]))[0])
        print(f"  round {r:2d}  LP {kappa:.12f}  adversary {worst:.12f}"
              f"  R(alt) {alt_val:.12f}  cuts {A.shape[0]}"
              f"  ({time.time() - t0:.1f}s)", flush=True)
        if best is None or worst > best[0]:
            best = (worst, c.copy(), kappa)
        G = np.vstack([G, keep])
        F = np.concatenate([F, f6(keep)])
        A = np.vstack([A, features(hat, keep)])
        if A.shape[0] > 9000:
            idx = np.argsort(F - A @ c)[:6000]
            G, F, A = G[idx], F[idx], A[idx]

    worst, c, kappa = best
    print(f"\nbest verified-by-adversary floor {worst:.12f}"
          f"   E_alt {E_ALT:.12f}   short by {E_ALT - worst:.3e}")
    payload = {
        "what": "pair-state coboundary candidate (NOT in the trusted base)",
        "knots": hat.t.tolist(),
        "free": FREE,
        "coefficients": c.tolist(),
        "lp_bound": kappa,
        "adversary_floor": worst,
        "e_alt": E_ALT,
    }
    with open(out_path, "w") as fh:
        json.dump(payload, fh)
    print("wrote " + out_path)


def selftest():
    """The two claims everything above rests on, checked rather than asserted."""
    rng = np.random.default_rng(5)
    hat = Hat(make_knots(14))
    J = hat.J
    mats = [rng.normal(0, 0.01, size=(J, J)) for _ in range(FREE)]

    # 1. The normal form telescopes.  If the coboundary does not cancel over a
    #    periodic chain, every floor this tool reports bounds nothing.
    worst = 0.0
    for _ in range(40):
        n = int(rng.integers(7, 20))
        g = rng.uniform(0.6, 3.0, size=n)
        blocks = np.array([[g[(i + j) % n] for j in range(6)] for i in range(n)])
        worst = max(worst, abs(reduced(hat, mats, blocks).mean() - f6(blocks).mean()))
    print("telescoping: max |mean R - mean F6| = %.3e over 40 periodic chains" % worst)
    ok = worst < 1e-14

    # 2. The ceiling.  F6 is reversal-invariant and the two alternating blocks
    #    are reverses of each other, so the coboundary cancels between them and
    #    min R <= their average = F6(alt) = E_alt, for EVERY telescoping
    #    certificate.  Reaching E_alt is the goal; exceeding it is impossible.
    alt = np.array([np.tile([LOW, HIGH], 3), np.tile([HIGH, LOW], 3)])
    avg = float(reduced(hat, mats, alt).mean())
    print("ceiling:     mean R over the two alternating phases = %.15f" % avg)
    print("             E_alt                                  = %.15f" % E_ALT)
    ok = ok and abs(avg - E_ALT) < 1e-14
    print("SELFTEST " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "climb"
    if cmd == "selftest":
        raise SystemExit(selftest())
    if cmd == "improve":
        base_name = sys.argv[2] if len(sys.argv) > 2 else "record"
        knot_count = int(sys.argv[3]) if len(sys.argv) > 3 else 14
        rounds = int(sys.argv[4]) if len(sys.argv) > 4 else 20
        cap = float(sys.argv[5]) if len(sys.argv) > 5 else 2e-4
        out = sys.argv[6] if len(sys.argv) > 6 else "pair_correction.json"
        stages = int(sys.argv[7]) if len(sys.argv) > 7 else 1
        stationary = len(sys.argv) > 8 and sys.argv[8] == "stationary"
        improve(base_name, knot_count, rounds, cap, out, stages, stationary)
    elif cmd in ("climb", "maxmin"):
        knot_count = int(sys.argv[2]) if len(sys.argv) > 2 else 14
        rounds = int(sys.argv[3]) if len(sys.argv) > 3 else 24
        out = sys.argv[4] if len(sys.argv) > 4 else "pair_candidate.json"
        (climb if cmd == "climb" else maxmin)(knot_count, rounds, out)
    else:
        raise SystemExit(__doc__)
