"""Ridge continuation: minimise |fit|^2 + mu |p|^2 for decreasing mu starting from a saved point.
Exact solution: fit -> 0 with bounded |p|.  Border (approximate) scheme: fit ~ mu^a while |p| grows."""
import sys, torch
from deg3h import *
from torch.func import jacfwd
s, t, path = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
p = torch.load(path)
g = torch.Generator().manual_seed(12345)
X = torch.randn(700, NV, generator=g); Y = target(X)
def solve(p, mu, iters=800, lam=1e-3):
    f = lambda q: torch.cat([(run(q, X, s, t) - Y).reshape(-1), mu ** 0.5 * q])
    r = f(p); cost = r @ r
    for it in range(iters):
        J = jacfwd(f)(p); gr = J.T @ r; H = J.T @ J
        while True:
            q = p + torch.linalg.solve(H + lam * torch.diag(torch.diag(H) + 1e-9), -gr)
            rq = f(q); cq = rq @ rq
            if torch.isfinite(cq) and cq < cost: p, r, cost = q, rq, cq; lam = max(lam / 3, 1e-12); break
            lam *= 4
            if lam > 1e12: return p
        if it > 50 and abs(cost.item()) < 1e-30: break
    return p
for e in range(0, 11):
    mu = 10.0 ** (-e)
    p = solve(p, mu)
    fit = (run(p, X, s, t) - Y).norm().item()
    print(f"mu=1e-{e:02d}  fit={fit:.3e}  |p|={p.norm().item():.3e}  max={p.abs().max().item():.3e}", flush=True)
torch.save(p, path.replace(".pt", "_ridge.pt"))
