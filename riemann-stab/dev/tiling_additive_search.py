"""Discovery tool for additive coboundary certificates.  NOT in the trusted base.

    python3 -m venv venv && venv/bin/pip install numpy scipy
    venv/bin/python tiling_additive_search.py maxmin 0.10 26 1e-4 record.json
    venv/bin/python tiling_additive_search.py refine record.json 0.003951 26 compact.json

`maxmin` runs linear-programming cut generation for

    max_{a,b} min_{g >= 0} R(g),
    R(g) = F6(g) + a(g0) + a(g5) + b(g1) + b(g4) - (a+b)(g2) - (a+b)(g3),

with a and b free piecewise-linear functions on a knot grid.  That normal form
is exactly the set of reversal-antisymmetric additive state potentials; see
dev/tiling_additive.js and the completeness checks in its test file.

`refine` takes a working certificate and finds the smallest-sup-norm one that
still clears a fixed target floor.  A small sup norm shrinks both the
finite-chain boundary term and the cube a later interval sweep must cover.

Everything here is floating point and heuristic.  The certificates it emits are
re-audited in dev/tiling_additive_test.js by adversaries sharing no code with
this file, and even that is evidence, not proof.
"""
import sys, time, json
import numpy as np
from scipy.optimize import linprog, minimize


# ---------------------------------------------------------------- kernel
SQRT2 = np.sqrt(2.0)

def sinc0(x):
    x = np.asarray(x, dtype=float)
    out = np.empty_like(x)
    small = np.abs(x) < 1e-7
    x2 = x*x
    out[small] = 1 - x2[small]/6 + x2[small]*x2[small]/120
    ns = ~small
    out[ns] = np.sin(x[ns])/x[ns]
    return out

def sinc0d(x):
    x = np.asarray(x, dtype=float)
    out = np.empty_like(x)
    small = np.abs(x) < 1e-5
    xs = x[small]; x2 = xs*xs
    out[small] = -xs/3 + xs*x2/30 - xs*x2*x2/840
    ns = ~small
    xn = x[ns]
    out[ns] = (xn*np.cos(xn) - np.sin(xn))/(xn*xn)
    return out

def mt_kernel(x):
    b = 2*np.pi*np.asarray(x, dtype=float)
    return 0.5*sinc0((SQRT2 - b)/2) + 0.5*sinc0((SQRT2 + b)/2)

K0 = float(mt_kernel(np.array([0.0]))[0])

def w(x):
    k = mt_kernel(x)/K0
    return k*k

def wd(x):
    x = np.asarray(x, dtype=float)
    zl = (SQRT2 - 2*np.pi*x)/2
    zr = (SQRT2 + 2*np.pi*x)/2
    kern = 0.5*(sinc0(zl) + sinc0(zr))
    der = 0.5*np.pi*(-sinc0d(zl) + sinc0d(zr))
    return 2*kern*der/(K0*K0)

N = 7
P = 3000.0

# pairs (i,j) with i<j over 7 points; lag s = j-i, coefficient 2/(N-s)
PAIRS = [(i, j) for i in range(N) for j in range(i+1, N)]

def f6(g):
    """g: (...,6) array of gaps -> block functional value."""
    g = np.atleast_2d(np.asarray(g, dtype=float))
    pts = np.concatenate([np.zeros((g.shape[0], 1)), np.cumsum(g, axis=1)], axis=1)
    out = g.sum(axis=1)/P
    for (i, j) in PAIRS:
        out = out + (2.0/(N-(j-i)))*w(pts[:, j]-pts[:, i])
    return out

def f6_grad(g):
    g = np.atleast_2d(np.asarray(g, dtype=float))
    m = g.shape[0]
    pts = np.concatenate([np.zeros((m, 1)), np.cumsum(g, axis=1)], axis=1)
    val = g.sum(axis=1)/P
    grad = np.full((m, 6), 1.0/P)
    for (i, j) in PAIRS:
        d = pts[:, j]-pts[:, i]
        c = 2.0/(N-(j-i))
        val = val + c*w(d)
        dv = c*wd(d)
        for k in range(i, j):
            grad[:, k] += dv
    return val, grad

# ---------------------------------------------------------------- basis
def make_knots(step=0.05, fine_max=4.5, tail=(5.0, 6.0, 8.0, 11.0, 14.0)):
    t = np.arange(0.0, fine_max + 1e-9, step)
    return np.concatenate([t, np.array(tail)])

class Basis:
    def __init__(self, knots):
        self.t = np.asarray(knots, dtype=float)
        self.J = len(self.t)

    def weights(self, g):
        """g: (m,) -> (m, J) hat weights (clamped outside)."""
        g = np.clip(np.asarray(g, dtype=float), self.t[0], self.t[-1])
        idx = np.searchsorted(self.t, g, side='right') - 1
        idx = np.clip(idx, 0, self.J - 2)
        t0 = self.t[idx]; t1 = self.t[idx + 1]
        frac = (g - t0) / (t1 - t0)
        W = np.zeros((g.shape[0], self.J))
        rows = np.arange(g.shape[0])
        W[rows, idx] += 1 - frac
        W[rows, idx + 1] += frac
        return W

    def value(self, c, g):
        return np.interp(np.clip(g, self.t[0], self.t[-1]), self.t, c)

    def slope(self, c, g):
        gg = np.clip(np.asarray(g, dtype=float), self.t[0], self.t[-1])
        idx = np.clip(np.searchsorted(self.t, gg, side='right') - 1, 0, self.J - 2)
        return (c[idx + 1] - c[idx]) / (self.t[idx + 1] - self.t[idx])

# ------------------------------------------------------- reduced cost
SIGN_A = np.array([1.0, 0.0, -1.0, -1.0, 0.0, 1.0])
SIGN_B = np.array([0.0, 1.0, -1.0, -1.0, 1.0, 0.0])

def features(basis, G):
    """G: (m,6) -> (m, 2J) LP feature matrix."""
    m = G.shape[0]
    Fa = np.zeros((m, basis.J)); Fb = np.zeros((m, basis.J))
    for i in range(6):
        W = basis.weights(G[:, i])
        if SIGN_A[i]: Fa += SIGN_A[i] * W
        if SIGN_B[i]: Fb += SIGN_B[i] * W
    return np.concatenate([Fa, Fb], axis=1)

def reduced(basis, ca, cb, G, grad=False):
    G = np.atleast_2d(G)
    if grad:
        val, gr = f6_grad(G)
        gr = gr.copy()
    else:
        val = f6(G); gr = None
    for i in range(6):
        if SIGN_A[i]:
            val = val + SIGN_A[i] * basis.value(ca, G[:, i])
            if grad: gr[:, i] += SIGN_A[i] * basis.slope(ca, G[:, i])
        if SIGN_B[i]:
            val = val + SIGN_B[i] * basis.value(cb, G[:, i])
            if grad: gr[:, i] += SIGN_B[i] * basis.slope(cb, G[:, i])
    return (val, gr) if grad else val

# ------------------------------------------------------ LP
def solve_lp(basis, cuts_G, cuts_F, bound=0.03, smooth=0.0):
    m = cuts_G.shape[0]
    A = features(basis, cuts_G)            # (m, 2J)
    n = A.shape[1]
    # variables: [c (n), kappa]; maximise kappa  s.t.  kappa - A c <= F6
    A_ub = np.concatenate([-A, np.ones((m, 1))], axis=1)
    b_ub = cuts_F
    obj = np.zeros(n + 1); obj[-1] = -1.0
    bounds = [(-bound, bound)] * n + [(None, None)]
    res = linprog(obj, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')
    if not res.success:
        raise RuntimeError(res.message)
    c = res.x[:n]
    return c[:basis.J], c[basis.J:], float(res.x[-1])

# ------------------------------------------------------ LP variants
def solve_lp_reg(basis, A, F, level=None, mu=0.0, bound=0.03):
    """max kappa (or, if level given, minimise roughness s.t. kappa >= level)."""
    J = basis.J; n = 2 * J
    m = A.shape[0]
    # second-difference roughness variables r (n-2 per function -> 2*(J-2))
    nr = 2 * (J - 2) if mu > 0 else 0
    nv = n + 1 + nr
    rows = []; rhs = []
    # cut constraints: kappa - A c <= F
    blk = np.zeros((m, nv)); blk[:, :n] = -A; blk[:, n] = 1.0
    rows.append(blk); rhs.append(F)
    if nr:
        D = np.zeros((nr, nv))
        k = 0
        for off in (0, J):
            for j in range(J - 2):
                D[k, off + j] = 1.0; D[k, off + j + 1] = -2.0; D[k, off + j + 2] = 1.0
                D[k, n + 1 + k] = -1.0
                k += 1
        rows.append(D); rhs.append(np.zeros(nr))       #  d - r <= 0
        rows.append(-D - 2 * np.eye(nr, nv, k=n + 1) * 0)  # placeholder replaced below
        D2 = -D.copy()
        for k in range(nr):
            D2[k, n + 1 + k] = -1.0
        rows[-1] = D2; rhs.append(np.zeros(nr))
        rhs = rhs[:len(rows)]
    A_ub = np.vstack(rows); b_ub = np.concatenate(rhs)
    obj = np.zeros(nv)
    bounds = [(-bound, bound)] * n + [(None, None)] + [(0, None)] * nr
    if level is None:
        obj[n] = -1.0
    else:
        obj[n] = -1e-6
        if nr: obj[n + 1:] = mu
        bounds[n] = (level, None)
    res = linprog(obj, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')
    if not res.success:
        return None
    c = res.x[:n]
    return c[:J], c[J:], float(res.x[n])


# ------------------------------------------------ adversary + cut loop
def batch_adam(basis, ca, cb, X, steps=350, lr=0.06, lo=0.0, hi=14.0):
    m1 = np.zeros_like(X); m2 = np.zeros_like(X)
    for t in range(1, steps + 1):
        _, gr = reduced(basis, ca, cb, X, grad=True)
        m1 = 0.9*m1 + 0.1*gr; m2 = 0.999*m2 + 0.001*gr*gr
        mh = m1/(1-0.9**t); vh = m2/(1-0.999**t)
        rate = lr*(0.1 + 0.9*(1 - t/steps))
        X = np.clip(X - rate*mh/(np.sqrt(vh)+1e-12), lo, hi)
    return X

def polish(basis, ca, cb, x0, lo=0.0, hi=14.0):
    def fun(x):
        v, g = reduced(basis, ca, cb, x.reshape(1,6), grad=True)
        return float(v[0]), g[0]
    r = minimize(fun, x0, jac=True, method='L-BFGS-B', bounds=[(lo,hi)]*6,
                 options={'maxiter':600,'ftol':1e-18,'gtol':1e-14})
    return float(r.fun), r.x

BANDS = np.array([1.0417, 1.9795, 1.045, 1.986, 3.02, 0.6, 2.5, 4.06, 2.95, 0.35])

def starts(rng, n):
    a = rng.uniform(0.1, 4.4, (n//2, 6))
    b = BANDS[rng.integers(0, len(BANDS), (n//2, 6))] + rng.normal(0, 0.06, (n//2, 6))
    return np.clip(np.vstack([a, b]), 0, 14)

def maxmin(argv):
    step = float(argv[0]); rounds = int(argv[1])
    mu = float(argv[2]); tag = argv[3]
    nstart = int(argv[4]) if len(argv) > 4 else 8000
    rng = np.random.default_rng(20260826)
    basis = Basis(make_knots(step=step))
    print('knots', basis.J, flush=True)
    G = starts(rng, 12000)
    alt = np.array([[1.041680,1.979467,1.041680,1.979467,1.041680,1.979467],
                    [1.979467,1.041680,1.979467,1.041680,1.979467,1.041680],
                    [1.046077,1.98913,1.986416,1.041605,1.977021,1.045003]])
    G = np.vstack([G, alt])
    F = f6(G); A = features(basis, G)
    best = None; t0 = time.time(); pool = []
    for it in range(rounds):
        out = solve_lp_reg(basis, A, F)
        if out is None: print('LP failed', flush=True); break
        _, _, kap = out
        base = best['audit'] if best else 0.0038
        level = kap - 0.30*(kap - base)
        reg = solve_lp_reg(basis, A, F, level=level, mu=mu)
        ca, cb, _ = reg if reg is not None else out
        X0 = starts(rng, nstart)
        if pool: X0 = np.vstack([X0, np.array(pool)])
        X = batch_adam(basis, ca, cb, X0)
        vals = reduced(basis, ca, cb, X)
        order = np.argsort(vals)
        # polish the leading cluster to get an honest audit value
        audit = np.inf; argmin = None; polished = []
        for k in order[:24]:
            v, x = polish(basis, ca, cb, X[k])
            polished.append(x)
            if v < audit: audit, argmin = v, x
        if best is None or audit > best['audit']:
            best = {'audit': audit, 'ca': ca.copy(), 'cb': cb.copy(), 'lp': kap,
                    'gmin': argmin.tolist()}
        # bulk cuts: every violated point
        viol = order[vals[order] < kap]
        take = viol[:600]
        newG = np.vstack([X[take], np.array(polished)]) if len(take) else np.array(polished)
        G = np.vstack([G, newG]); F = np.concatenate([F, f6(newG)])
        A = np.vstack([A, features(basis, newG)])
        pool = [x for x in np.array(polished)][:24]
        json.dump({'knots': basis.t.tolist(), 'ca': best['ca'].tolist(), 'cb': best['cb'].tolist(),
                   'audit': best['audit'], 'lp': best['lp']}, open(f'cert_{tag}.json','w'))
        print(f'{it:3d} LP={kap:.12f} adv={audit:.12f} best={best["audit"]:.12f} '
              f'cuts={G.shape[0]} {time.time()-t0:.0f}s', flush=True)
        if kap - best['audit'] < 1e-10: break
    print('BEST', repr(best['audit']), 'gmin', np.round(np.array(best['gmin']),6).tolist(), flush=True)
    json.dump({'knots': basis.t.tolist(), 'ca': best['ca'].tolist(), 'cb': best['cb'].tolist(),
               'audit': best['audit'], 'lp': best['lp']}, open(f'cert_{tag}.json','w'))


# ---------------------------------------------- amplitude minimisation
def min_amplitude_lp(basis, A, F, target):
    J = basis.J; n = 2*J; nv = n + 1          # last variable = t (sup norm)
    m = A.shape[0]
    rows = [np.hstack([-A, np.zeros((m,1))])]; rhs = [F - target]
    I = np.eye(n)
    rows.append(np.hstack([ I, -np.ones((n,1))])); rhs.append(np.zeros(n))
    rows.append(np.hstack([-I, -np.ones((n,1))])); rhs.append(np.zeros(n))
    obj = np.zeros(nv); obj[-1] = 1.0
    res = linprog(obj, A_ub=np.vstack(rows), b_ub=np.concatenate(rhs),
                  bounds=[(None,None)]*n + [(0,None)], method='highs')
    if not res.success: return None
    c = res.x[:n]
    return c[:J], c[J:], float(res.x[-1])

def refine(argv):
    src = argv[0]; target = float(argv[1]); rounds = int(argv[2])
    out = argv[3]
    data = json.load(open(src))
    basis = Basis(np.array(data['knots']))
    ca = np.array(data['ca']); cb = np.array(data['cb'])
    rng = np.random.default_rng(987654321)
    G = starts(rng, 14000)
    alt = np.array([[1.041680,1.979467,1.041680,1.979467,1.041680,1.979467],
                    [1.979467,1.041680,1.979467,1.041680,1.979467,1.041680]])
    G = np.vstack([G, alt]); F = f6(G); A = features(basis, G)
    best = None; top = None; t0 = time.time()
    for it in range(rounds):
        X = batch_adam(basis, ca, cb, np.vstack([starts(rng, 14000), G[-400:]]))
        vals = reduced(basis, ca, cb, X); order = np.argsort(vals)
        audit = np.inf; argmin = None; pol = []
        for k in order[:24]:
            v, x = polish(basis, ca, cb, X[k]); pol.append(x)
            if v < audit: audit, argmin = v, x
        amp = max(np.abs(ca).max(), np.abs(cb).max())
        if it > 0 and audit >= target and (best is None or amp < best['amp']):
            best = {'amp': amp, 'ca': ca.copy(), 'cb': cb.copy(), 'audit': audit,
                    'gmin': argmin.tolist()}
        if it > 0 and (top is None or audit > top['audit']):
            top = {'amp': amp, 'ca': ca.copy(), 'cb': cb.copy(), 'audit': audit,
                   'gmin': argmin.tolist()}
        viol = order[vals[order] < target + 2e-6][:800]
        newG = np.vstack([X[viol], np.array(pol)]) if len(viol) else np.array(pol)
        G = np.vstack([G, newG]); F = np.concatenate([F, f6(newG)])
        A = np.vstack([A, features(basis, newG)])
        print(f'{it:3d} audit={audit:.12f} amp={amp:.6f} '
              f'best_amp={best["amp"] if best else float("nan"):.6f} cuts={G.shape[0]} '
              f'{time.time()-t0:.0f}s', flush=True)
        nxt = min_amplitude_lp(basis, A, F, target)
        if nxt is None: print('LP infeasible at target', target, flush=True); break
        ca, cb, t = nxt
    if best is None:
        print('target not reached; shipping best-audit iterate', flush=True)
        best = top
        if best is None: return
    print('BEST amplitude', best['amp'], 'audit', repr(best['audit']), flush=True)
    json.dump({'knots': basis.t.tolist(), 'ca': best['ca'].tolist(), 'cb': best['cb'].tolist(),
               'audit': best['audit'], 'target': target, 'amplitude': best['amp']},
              open(out, 'w'))



if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'maxmin':
        maxmin(sys.argv[2:])
    elif mode == 'refine':
        refine(sys.argv[2:])
    else:
        raise SystemExit('usage: tiling_additive_search.py {maxmin|refine} ...')
