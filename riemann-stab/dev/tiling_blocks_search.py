"""Additive coboundary certificate search at an arbitrary block size.
NOT in the trusted base -- a discovery tool that emits candidates only.

    python3 -m venv venv && venv/bin/pip install numpy scipy
    venv/bin/python tiling_blocks_search.py 7 0.10 90 block7

Arguments: number of gaps m, knot spacing, cut-generation rounds, output tag.
m = 6 reproduces tiling_additive_search.py's maxmin mode and is how to check
this file against it; m = 7 is the block size the projection actually peaks at
(see block_size_scan in tiling_research.golden.json).

The free directions are the reversal-antisymmetric additive coboundaries,
u_i = u_{m-1-i} with sum u_i = 0: two functions at m = 6, three at m = 7.  The
linear programme's cap is the chain candidate at every m, because the two
alternating blocks' corrections are equal and opposite even when they do not
cancel pointwise as they do at even m.

Output is JSON with `knots` and `functions`, readable by tiling_blocks.js.
"""
import sys, json, time, os
import numpy as np
from scipy.optimize import linprog, minimize
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tiling_additive_search import w, wd, make_knots, Basis

P = 3000.0

def sign_matrix(m):
    half = m // 2
    free = half - 1 if m % 2 == 0 else half
    rows = []
    for f in range(free):
        row = [0]*m
        row[f] += 1
        row[m-1-f] += 1
        if m % 2 == 0:
            row[half-1] -= 1
            row[half] -= 1
        else:
            row[half] -= 2
        rows.append(row)
    return np.array(rows, dtype=float)

def block_pairs(n):
    return [(i, j, 2.0/(n-(j-i))) for i in range(n) for j in range(i+1, n)]

def make_block(m):
    pairs = block_pairs(m+1)
    def fn(g):
        g = np.atleast_2d(np.asarray(g, float))
        pts = np.concatenate([np.zeros((g.shape[0],1)), np.cumsum(g, axis=1)], axis=1)
        out = g.sum(axis=1)/P
        for (i,j,c) in pairs: out = out + c*w(pts[:,j]-pts[:,i])
        return out
    def grad(g):
        g = np.atleast_2d(np.asarray(g, float))
        pts = np.concatenate([np.zeros((g.shape[0],1)), np.cumsum(g, axis=1)], axis=1)
        val = g.sum(axis=1)/P
        gr = np.full((g.shape[0], m), 1.0/P)
        for (i,j,c) in pairs:
            d = pts[:,j]-pts[:,i]
            val = val + c*w(d)
            dv = c*wd(d)
            for k in range(i, j): gr[:,k] += dv
        return val, gr
    return fn, grad

def run(m, step, rounds, tag, nstart=12000):
    F, FG = make_block(m)
    S = sign_matrix(m)
    nf = S.shape[0]
    basis = Basis(make_knots(step=step, fine_max=4.5))
    J = basis.J
    rng = np.random.default_rng(20260826 + m)
    BANDS = np.array([1.0408,1.9776,1.044,1.975,3.02,0.6,2.5,4.06,2.95,0.35])
    def starts(n):
        a = rng.uniform(0.1, 4.4, (n//2, m))
        b = BANDS[rng.integers(0, len(BANDS), (n//2, m))] + rng.normal(0, 0.06, (n//2, m))
        return np.clip(np.vstack([a,b]), 0, 14)
    def features(G):
        out = np.zeros((G.shape[0], nf*J))
        for f in range(nf):
            acc = np.zeros((G.shape[0], J))
            for k in range(m):
                if S[f,k]: acc += S[f,k]*basis.weights(G[:,k])
            out[:, f*J:(f+1)*J] = acc
        return out
    def reduced(coef, G, grad=False):
        G = np.atleast_2d(G)
        if grad: val, gr = FG(G); gr = gr.copy()
        else: val = F(G); gr = None
        for f in range(nf):
            c = coef[f*J:(f+1)*J]
            for k in range(m):
                if S[f,k]:
                    val = val + S[f,k]*basis.value(c, G[:,k])
                    if grad: gr[:,k] += S[f,k]*basis.slope(c, G[:,k])
        return (val, gr) if grad else val
    def batch_adam(coef, X, steps=350, lr=0.06):
        m1 = np.zeros_like(X); m2 = np.zeros_like(X)
        for t in range(1, steps+1):
            _, gr = reduced(coef, X, grad=True)
            m1 = 0.9*m1+0.1*gr; m2 = 0.999*m2+0.001*gr*gr
            mh = m1/(1-0.9**t); vh = m2/(1-0.999**t)
            rate = lr*(0.1+0.9*(1-t/steps))
            X = np.clip(X - rate*mh/(np.sqrt(vh)+1e-12), 0, 14)
        return X
    def polish(coef, x0):
        def fun(x):
            v, g = reduced(coef, x.reshape(1,m), grad=True)
            return float(v[0]), g[0]
        r = minimize(fun, x0, jac=True, method='L-BFGS-B', bounds=[(0,14)]*m,
                     options={'maxiter':600,'ftol':1e-18,'gtol':1e-14})
        return float(r.fun), r.x
    G = starts(14000)
    # The alternating two-cycle is the conjectured chain minimiser at every
    # block size, so both of its blocks belong in the cut set from the start.
    lowhigh = {6: (1.041680, 1.979467), 7: (1.040769, 1.977587)}.get(m, (1.04, 1.98))
    alt = np.array([[lowhigh[(i+ph) % 2] for i in range(m)] for ph in (0, 1)])
    G = np.vstack([G, alt])
    Fv = F(G); A = features(G)
    best = None; t0 = time.time()
    for it in range(rounds):
        nv = nf*J
        A_ub = np.hstack([-A, np.ones((A.shape[0],1))])
        obj = np.zeros(nv+1); obj[-1] = -1.0
        res = linprog(obj, A_ub=A_ub, b_ub=Fv, bounds=[(-0.03,0.03)]*nv+[(None,None)], method='highs')
        if not res.success: print('LP failed'); break
        coef = res.x[:nv]; kap = float(res.x[-1])
        X = batch_adam(coef, starts(nstart))
        vals = reduced(coef, X); order = np.argsort(vals)
        audit = np.inf; argmin = None; pol = []
        for k in order[:24]:
            v, x = polish(coef, X[k]); pol.append(x)
            if v < audit: audit, argmin = v, x
        if best is None or audit > best['audit']:
            best = {'audit': audit, 'coef': coef.copy(), 'lp': kap, 'gmin': argmin.tolist()}
        viol = order[vals[order] < kap][:600]
        newG = np.vstack([X[viol], np.array(pol)]) if len(viol) else np.array(pol)
        G = np.vstack([G,newG]); Fv = np.concatenate([Fv, F(newG)]); A = np.vstack([A, features(newG)])
        print(f'{it:3d} LP={kap:.12f} adv={audit:.12f} best={best["audit"]:.12f} cuts={G.shape[0]} {time.time()-t0:.0f}s', flush=True)
        json.dump({'m':m,'knots':basis.t.tolist(),
                   'functions':[best['coef'][f*J:(f+1)*J].tolist() for f in range(nf)],
                   'audit':best['audit'],'lp':best['lp']}, open(f'cert_{tag}.json','w'))
        if kap - best['audit'] < 1e-10: break
    print('BEST', repr(best['audit']), flush=True)

if __name__ == '__main__':
    if len(sys.argv) < 5:
        raise SystemExit('usage: tiling_blocks_search.py <gaps> <knot-step> <rounds> <tag>')
    run(int(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
