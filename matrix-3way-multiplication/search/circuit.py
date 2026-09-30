"""General straight-line-program search for A*B*C (2x2) with L binary multiplications.

Gate m:  g_m = (c_m + a_m.x + sum_{k<m} al_mk g_k) * (d_m + b_m.x + sum_{k<m} be_mk g_k)
Output:  y_i = e_i + f_i.x + sum_m ga_im g_m ,   x = (A,B,C) entries (12 vars)
Additions / scalar multiplications are free; only the L gates count.
Fitted by Levenberg-Marquardt on random sample points (polynomial identity <=> zero
residual on enough generic points; re-checked on fresh points afterwards)."""
import sys, time, torch
torch.set_default_dtype(torch.float64)
from torch.func import jacrev

NV, NO = 12, 4

def target(X):
    A = X[:, 0:4].reshape(-1, 2, 2); B = X[:, 4:8].reshape(-1, 2, 2); C = X[:, 8:12].reshape(-1, 2, 2)
    return (A @ B @ C).reshape(-1, 4)

def shapes(L):
    return [("c", (L,)), ("a", (L, NV)), ("al", (L, L)), ("d", (L,)), ("b", (L, NV)), ("be", (L, L)),
            ("e", (NO,)), ("f", (NO, NV)), ("ga", (NO, L))]

def unpack(p, L):
    out, i = {}, 0
    for n, s in shapes(L):
        k = 1
        for t in s: k *= t
        out[n] = p[i:i+k].reshape(s); i += k
    return out

def nparams(L): return sum(torch.Size(s).numel() for _, s in shapes(L))

def run(p, X, L):
    P = unpack(p, L)
    mask = torch.tril(torch.ones(L, L), -1)
    al, be = P["al"] * mask, P["be"] * mask
    gs = []
    for m in range(L):
        G = torch.stack(gs, 1) if gs else torch.zeros(X.shape[0], 0)
        l = P["c"][m] + X @ P["a"][m] + (G @ al[m, :m] if m else 0)
        r = P["d"][m] + X @ P["b"][m] + (G @ be[m, :m] if m else 0)
        gs.append(l * r)
    G = torch.stack(gs, 1)
    return P["e"] + X @ P["f"].T + G @ P["ga"].T

def residual(p, X, L, Y):
    return (run(p, X, L) - Y).reshape(-1)

def lm(p, X, Y, L, iters=3000, lam=1e-2):
    f = lambda q: residual(q, X, L, Y)
    r = f(p); cost = r @ r
    for it in range(iters):
        J = jacrev(f)(p)
        g = J.T @ r; H = J.T @ J
        while True:
            step = torch.linalg.solve(H + lam * torch.diag(torch.diag(H) + 1e-9), -g)
            q = p + step; rq = f(q); cq = rq @ rq
            if torch.isfinite(cq) and cq < cost:
                p, r, cost = q, rq, cq; lam = max(lam / 3, 1e-12); break
            lam *= 4
            if lam > 1e10: return p, cost.sqrt().item()
        if cost < 1e-26: break
    return p, cost.sqrt().item()

if __name__ == "__main__":
    L, seeds, npts = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else 200
    s0 = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    for s in range(s0, s0 + seeds):
        g = torch.Generator().manual_seed(s)
        X = torch.randn(npts, NV, generator=g); Y = target(X)
        p = 0.4 * torch.randn(nparams(L), generator=g)
        P = unpack(p, L); P["al"].mul_(0.05); P["be"].mul_(0.05)   # views: shrink gate-to-gate wiring
        t = time.time(); p, err = lm(p, X, Y, L)
        Xt = torch.randn(500, NV, generator=g)
        terr = (run(p, Xt, L) - target(Xt)).abs().max().item()
        print(f"L={L} seed={s} fit={err:.2e} test_maxerr={terr:.2e} ({time.time()-t:.0f}s)", flush=True)
        if terr < 1e-8:
            torch.save(p, f"circuit_L{L}_s{s}.pt"); print("FOUND", flush=True)
