"""Homogeneous degree-3 circuit model (constants/linear terms provably irrelevant, see FINDINGS):

    (ABC)_i = sum_r ga_ir * v_r(x) * sum_k al_rk * l_k(x) * m_k(x)

l_k, m_k (k < s), v_r (r < t): linear forms in all 12 entries of A,B,C (mixing allowed).
Cost s + t. Chain = special case l in A, m in B, v in C with s = t = 7."""
import sys, time, torch
torch.set_num_threads(1)
torch.set_default_dtype(torch.float64)
from torch.func import jacfwd
NV = 12

def target(X):
    A = X[:, 0:4].reshape(-1, 2, 2); B = X[:, 4:8].reshape(-1, 2, 2); C = X[:, 8:12].reshape(-1, 2, 2)
    return (A @ B @ C).reshape(-1, 4)

def split(p, s, t):
    sizes = [s*NV, s*NV, t*NV, t*s, 4*t]
    l, m, v, al, ga = torch.split(p, sizes)
    return l.reshape(s, NV), m.reshape(s, NV), v.reshape(t, NV), al.reshape(t, s), ga.reshape(4, t)

def nparams(s, t): return 2*s*NV + t*NV + t*s + 4*t

def run(p, X, s, t):
    l, m, v, al, ga = split(p, s, t)
    Pq = (X @ l.T) * (X @ m.T)
    return ((Pq @ al.T) * (X @ v.T)) @ ga.T

def lm(p, X, Y, s, t, iters=6000, lam=1e-2):
    f = lambda q: (run(q, X, s, t) - Y).reshape(-1)
    r = f(p); cost = r @ r; hist = []
    for it in range(iters):
        hist.append(cost.item())
        if it > 300 and hist[-1] > 0.999 * hist[-200] and hist[-1] > 1e-10: break
        J = jacfwd(f)(p); g = J.T @ r; H = J.T @ J
        while True:
            step = torch.linalg.solve(H + lam * torch.diag(torch.diag(H) + 1e-9), -g)
            q = p + step; rq = f(q); cq = rq @ rq
            if torch.isfinite(cq) and cq < cost:
                p, r, cost = q, rq, cq; lam = max(lam / 3, 1e-12); break
            lam *= 4
            if lam > 1e12: return p, cost.sqrt().item()
        if cost < 1e-24: break
    return p, cost.sqrt().item()

def attempt(s, t, seed, npts=700):
    g = torch.Generator().manual_seed(seed)
    X = torch.randn(npts, NV, generator=g); Y = target(X)
    p = 0.6 * torch.randn(nparams(s, t), generator=g)
    p, err = lm(p, X, Y, s, t)
    Xt = torch.randn(2000, NV, generator=g)
    return p, err, (run(p, Xt, s, t) - target(Xt)).abs().max().item()

if __name__ == "__main__":
    s, t, seeds = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
    s0 = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    for seed in range(s0, s0 + seeds):
        t0 = time.time(); p, err, terr = attempt(s, t, seed)
        print(f"s={s} t={t} seed={seed} fit={err:.2e} test={terr:.2e} maxcoef={p.abs().max().item():.1e} ({time.time()-t0:.0f}s)", flush=True)
        if terr < 1e-8:
            torch.save(p, f"sol/deg3h_s{s}_t{t}_seed{seed}.pt"); print("FOUND", flush=True)
