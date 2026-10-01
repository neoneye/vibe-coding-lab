"""Probe the near-hit k=5, R=30 (5 orbits + 5 fixed), seed 0: long LM, then ridge continuation.
Exact solution: fit → 0 with bounded |p|. Border (approximate) decomposition: fit → 0 only as |p| → ∞."""
import torch, numpy as np
import cyclic as C
from torch.func import jacfwd
g = torch.Generator().manual_seed(0)
p = 0.6 * torch.randn(C.m * C.k * C.d + C.f * C.d, generator=g)
p, err = C.lm(p, iters=3000)
print(f"LM: err={err:.4e} |p|={p.norm():.3e}", flush=True)
for rnd in range(3):
    p, err = C.lm(p, iters=3000)
    print(f"LM continued: err={err:.4e} |p|={p.norm():.3e} max={p.abs().max():.3e}", flush=True)
np.save("probe_m5f5.npy", p.numpy())
def solve(p, mu, iters=800, lam=1e-3):
    f = lambda q: torch.cat([C.res(q), mu ** 0.5 * q]); r = f(p); cost = r @ r
    for _ in range(iters):
        J = jacfwd(f)(p); gr = J.T @ r; H = J.T @ J
        while True:
            q = p + torch.linalg.solve(H + lam * (torch.diag(torch.diag(H)) + 1e-12 * torch.eye(len(p))), -gr); rq = f(q); cq = rq @ rq
            if torch.isfinite(cq) and cq < cost: p, r, cost, lam = q, rq, cq, max(lam / 3, 1e-12); break
            lam *= 4
            if lam > 1e14: return p
    return p
for e in range(3, 13):
    mu = 10.0 ** (-e); p = solve(p, mu)
    print(f"ridge mu=1e-{e:02d} fit={C.res(p).norm():.4e} |p|={p.norm():.3e} max={p.abs().max():.3e}", flush=True)
