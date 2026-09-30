"""Quadratic (commutative) algorithms for 2x2 A*B:  (AB)_i = sum_k be_ik l_k(A,B) m_k(A,B).
Exact multiplicative complexity is 7 (Winograd 1971). Does s=6 fit approximately (border)?"""
import sys, torch
torch.set_default_dtype(torch.float64); torch.set_num_threads(1)
from torch.func import jacfwd
s, seeds = int(sys.argv[1]), int(sys.argv[2])
def target(X):
    return (X[:, :4].reshape(-1, 2, 2) @ X[:, 4:].reshape(-1, 2, 2)).reshape(-1, 4)
def run(p, X):
    l, m, be = p[:8*s].reshape(s, 8), p[8*s:16*s].reshape(s, 8), p[16*s:].reshape(4, s)
    return ((X @ l.T) * (X @ m.T)) @ be.T
for seed in range(seeds):
    g = torch.Generator().manual_seed(seed)
    X = torch.randn(300, 8, generator=g); Y = target(X)
    p = 0.6 * torch.randn(20*s, generator=g); lam = 1e-2
    f = lambda q: (run(q, X) - Y).reshape(-1)
    r = f(p); cost = r @ r
    for it in range(3000):
        J = jacfwd(f)(p); gr = J.T @ r; H = J.T @ J
        while True:
            q = p + torch.linalg.solve(H + lam * torch.diag(torch.diag(H) + 1e-9), -gr); rq = f(q); cq = rq @ rq
            if torch.isfinite(cq) and cq < cost: p, r, cost = q, rq, cq; lam = max(lam/3, 1e-12); break
            lam *= 4
            if lam > 1e12: break
        if lam > 1e12 or cost < 1e-24: break
    print(f"s={s} seed={seed} fit={cost.sqrt().item():.2e} max={p.abs().max().item():.1e}", flush=True)
