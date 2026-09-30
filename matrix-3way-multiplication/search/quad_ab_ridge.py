"""Ridge continuation for the 6-product quadratic 2x2 A*B fit: border (fit->0 only as |p|->inf) vs exact."""
import torch
torch.set_default_dtype(torch.float64); torch.set_num_threads(2)
from torch.func import jacfwd
s = 6
def target(X): return (X[:, :4].reshape(-1, 2, 2) @ X[:, 4:].reshape(-1, 2, 2)).reshape(-1, 4)
def run(p, X):
    l, m, be = p[:8*s].reshape(s, 8), p[8*s:16*s].reshape(s, 8), p[16*s:].reshape(4, s)
    return ((X @ l.T) * (X @ m.T)) @ be.T
g = torch.Generator().manual_seed(0)
X = torch.randn(300, 8, generator=g); Y = target(X)
p = 0.6 * torch.randn(20*s, generator=g)
def solve(p, mu, iters=1500, lam=1e-2):
    f = lambda q: torch.cat([(run(q, X) - Y).reshape(-1), mu ** 0.5 * q])
    r = f(p); cost = r @ r
    for it in range(iters):
        J = jacfwd(f)(p); gr = J.T @ r; H = J.T @ J
        while True:
            q = p + torch.linalg.solve(H + lam * torch.diag(torch.diag(H) + 1e-9), -gr); rq = f(q); cq = rq @ rq
            if torch.isfinite(cq) and cq < cost: p, r, cost = q, rq, cq; lam = max(lam/3, 1e-12); break
            lam *= 4
            if lam > 1e12: return p
    return p
for e in range(0, 13):
    mu = 10.0 ** (-e); p = solve(p, mu)
    print(f"mu=1e-{e:02d} fit={(run(p, X) - Y).norm().item():.3e} |p|={p.norm().item():.3e}", flush=True)
