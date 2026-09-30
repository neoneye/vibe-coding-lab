"""Degree-bounded circuit search for A*B*C (2x2): every gate has degree <= 3.

  quadratic gate k (k < s):  p_k = (c_k + a_k.x) * (d_k + b_k.x)          -- any affine forms, A/B/C mixed
  cubic gate r     (r < t):  q_r = (e_r + u_r.x + sum_k al_rk p_k) * (f_r + v_r.x)
  output i:                  y_i = h_i + w_i.x + sum_k be_ik p_k + sum_r ga_ir q_r

Cost = s + t binary multiplications. Two-level chains (s = t = 7) are a special case.
All outputs have degree <= 3 in 12 variables (455 monomials), so a zero residual on
>= 1000 generic points certifies the polynomial identity; we re-check on fresh points."""
import sys, time, torch
torch.set_default_dtype(torch.float64)
from torch.func import jacfwd
NV = 12

def target(X):
    A = X[:, 0:4].reshape(-1, 2, 2); B = X[:, 4:8].reshape(-1, 2, 2); C = X[:, 8:12].reshape(-1, 2, 2)
    return (A @ B @ C).reshape(-1, 4)

def shapes(s, t):
    return [("c", (s,)), ("a", (s, NV)), ("d", (s,)), ("b", (s, NV)),
            ("e", (t,)), ("u", (t, NV)), ("al", (t, s)), ("f", (t,)), ("v", (t, NV)),
            ("h", (4,)), ("w", (4, NV)), ("be", (4, s)), ("ga", (4, t))]

def unpack(p, s, t):
    out, i = {}, 0
    for n, sh in shapes(s, t):
        k = torch.Size(sh).numel(); out[n] = p[i:i+k].reshape(sh); i += k
    return out

def nparams(s, t): return sum(torch.Size(sh).numel() for _, sh in shapes(s, t))

def run(p, X, s, t):
    P = unpack(p, s, t)
    Pq = (P["c"] + X @ P["a"].T) * (P["d"] + X @ P["b"].T)            # (n, s)
    Q = (P["e"] + X @ P["u"].T + Pq @ P["al"].T) * (P["f"] + X @ P["v"].T)
    return P["h"] + X @ P["w"].T + Pq @ P["be"].T + Q @ P["ga"].T

def lm(p, X, Y, s, t, iters=4000, lam=1e-2, reg=0.0):
    def f(q):
        r = (run(q, X, s, t) - Y).reshape(-1)
        return torch.cat([r, reg * q]) if reg else r
    r = f(p); cost = r @ r; hist = []
    for it in range(iters):
        hist.append(cost.item())
        if it > 300 and hist[-1] > 0.999 * hist[-200] and hist[-1] > 1e-10: break   # stalled
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

def attempt(s, t, seed, npts=1000):
    g = torch.Generator().manual_seed(seed)
    X = torch.randn(npts, NV, generator=g); Y = target(X)
    p = 0.5 * torch.randn(nparams(s, t), generator=g)
    p, err = lm(p, X, Y, s, t)
    Xt = torch.randn(2000, NV, generator=g)
    terr = (run(p, Xt, s, t) - target(Xt)).abs().max().item()
    return p, err, terr

if __name__ == "__main__":
    s, t, seeds = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
    s0 = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    for seed in range(s0, s0 + seeds):
        t0 = time.time(); p, err, terr = attempt(s, t, seed)
        print(f"s={s} t={t} seed={seed} fit={err:.2e} test={terr:.2e} ({time.time()-t0:.0f}s)", flush=True)
        if terr < 1e-8:
            torch.save(p, f"deg3_s{s}_t{t}_seed{seed}.pt"); print("FOUND", flush=True)
