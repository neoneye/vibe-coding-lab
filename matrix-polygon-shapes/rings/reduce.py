"""Try to beat Christandl–Zuiddam's 31 for the pentagon ring of 2×2 matrices: start from the exact 31-term
surgery decomposition, drop one term, perturb, and refit with 30 terms (Levenberg–Marquardt).
Usage: python reduce.py first_drop last_drop seeds noise"""
import sys, numpy as np
from ring_rank import ring_tensor, fit
k, R0 = 5, 31
T = ring_tensor(k, 2)
F = np.load("surgery_k5.npy")                       # (5, 4, 31)
a, b, seeds, noise = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4])
for drop in range(a, b):
    keep = [r for r in range(R0) if r != drop]
    for s in range(seeds):
        rng = np.random.default_rng(1000 * drop + s)
        G = F[:, :, keep] + noise * rng.normal(size=(k, 4, R0 - 1))
        x0 = np.concatenate([G[m].ravel() for m in range(k)])
        err, Fs, mx = fit(T, R0 - 1, s, iters=4000, x0=x0)
        print(f"drop={drop:2d} seed={s} noise={noise} err={err:.3e} maxcoef={mx:.2e}", flush=True)
        if err < 1e-10: np.save(f"R30_drop{drop}_s{s}.npy", np.array(Fs)); print("FOUND R=30", flush=True)
