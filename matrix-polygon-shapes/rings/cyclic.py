"""Rotation-symmetric decompositions of the k-ring tensor of 2×2 matrices.
The ring tensor is invariant under rotating the legs (v → v+1). Ansatz: m orbit generators (each a k-tuple of
4-vectors, contributing all k rotations) plus f fixed terms v⊗v⊗...⊗v. Rank R = k·m + f.
Strassen's triangle is of this form (2 orbits of 3 + 1 fixed = 7). Levenberg–Marquardt via torch.
Usage: python cyclic.py k m f seeds [seed0]"""
import sys, time, numpy as np, torch
torch.set_default_dtype(torch.float64); torch.set_num_threads(1)
from torch.func import jacfwd
from ring_rank import ring_tensor

if __name__ == "__main__":
    k, m, f, seeds = map(int, sys.argv[1:5]); s0 = int(sys.argv[5]) if len(sys.argv) > 5 else 0
else:
    k, m, f = 5, 5, 5
T = torch.tensor(ring_tensor(k, 2)); d = 4
L = "abcdefghij"[:k]

def factors(p):
    G = p[: m * k * d].reshape(m, k, d); Fx = p[m * k * d:].reshape(f, d)
    legs = []
    for v in range(k):   # leg v of the rotation by s of generator g is G[g, (v - s) mod k]
        cols = [G[g, (v - s) % k] for g in range(m) for s in range(k)] + [Fx[j] for j in range(f)]
        legs.append(torch.stack(cols, 1))
    return legs

def res(p):
    return (torch.einsum(",".join(f"{c}z" for c in L) + "->" + L, *factors(p)) - T).reshape(-1)

def lm(p, iters=3000, lam=1e-2):
    r = res(p); cost = r @ r; hist = []
    for it in range(iters):
        hist.append(cost.item())
        if cost < 1e-26 or (it > 400 and hist[-1] > 0.9995 * hist[-300] and hist[-1] > 1e-12): break
        J = jacfwd(res)(p); g = J.T @ r; H = J.T @ J
        while True:
            q = p + torch.linalg.solve(H + lam * (torch.diag(torch.diag(H)) + 1e-9 * torch.eye(len(p))), -g); rq = res(q); cq = rq @ rq
            if torch.isfinite(cq) and cq < cost: p, r, cost, lam = q, rq, cq, max(lam / 3, 1e-12); break
            lam *= 4
            if lam > 1e14: return p, cost.sqrt().item()
    return p, cost.sqrt().item()

if __name__ == "__main__":
  for s in range(s0, s0 + seeds):
    g = torch.Generator().manual_seed(s); t0 = time.time()
    p = 0.6 * torch.randn(m * k * d + f * d, generator=g)
    p, err = lm(p)
    print(f"k={k} R={k*m+f} (m={m} orbits, f={f} fixed) seed={s} err={err:.3e} max={p.abs().max().item():.2e} ({time.time()-t0:.0f}s)", flush=True)
    if err < 1e-10: np.save(f"cyclic_k{k}_m{m}_f{f}_s{s}.npy", p.numpy()); print("FOUND", flush=True)
