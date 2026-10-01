"""Border-rank probe for the pentagon ring at R = 30: ridge continuation (minimise |fit|² + μ|p|², μ → 0)
from drop-one starts of the exact 31-term surgery decomposition. A border decomposition shows up as the
fit falling towards 0 while the coefficient norm grows without bound; an exact one keeps the norm bounded.
Usage: python border.py drop seed"""
import sys, numpy as np
from ring_rank import ring_tensor, recon
k, R = 5, 30
T = ring_tensor(k, 2); d = 4
F = np.load("surgery_k5.npy")
drop, seed = int(sys.argv[1]), int(sys.argv[2])
rng = np.random.default_rng(seed)
keep = [r for r in range(31) if r != drop]
x = np.concatenate([(F[m][:, keep] + 0.05 * rng.normal(size=(d, R))).ravel() for m in range(k)])
unpack = lambda x: [m.reshape(d, R) for m in np.split(x, k)]
L = "abcde"

def jac_fit(x):
    Fs = unpack(x); J = np.zeros((d ** k, k * d * R))
    for m in range(k):
        others = [Fs[q] for q in range(k) if q != m]; sub = [L[q] for q in range(k) if q != m]
        kr = np.einsum(",".join(f"{c}z" for c in sub) + "->" + "".join(sub) + "z", *others)
        full = np.zeros((d,) * k + (d, R))
        for p in range(d):
            idx = [slice(None)] * k; idx[m] = p; full[tuple(idx) + (p,)] = kr
        J[:, m * d * R:(m + 1) * d * R] = full.reshape(d ** k, d * R)
    return J

def solve(x, mu, iters=600, lam=1e-3):
    def res(x): return np.concatenate([(recon(unpack(x)) - T).ravel(), np.sqrt(mu) * x])
    r = res(x); cost = r @ r
    for _ in range(iters):
        J = np.vstack([jac_fit(x), np.sqrt(mu) * np.eye(len(x))]); g = J.T @ r; H = J.T @ J
        while True:
            xn = x + np.linalg.solve(H + lam * (np.diag(np.diag(H)) + 1e-12 * np.eye(len(x))), -g)
            rn = res(xn); cn = rn @ rn
            if np.isfinite(cn) and cn < cost: x, r, cost, lam = xn, rn, cn, max(lam / 3, 1e-12); break
            lam *= 4
            if lam > 1e14: return x
    return x

for e in range(4, 15):
    mu = 10.0 ** (-e)
    x = solve(x, mu)
    fit = np.linalg.norm(recon(unpack(x)) - T)
    print(f"drop={drop} seed={seed} mu=1e-{e:02d} fit={fit:.4e} |p|={np.linalg.norm(x):.3e} max={np.abs(x).max():.3e}", flush=True)
