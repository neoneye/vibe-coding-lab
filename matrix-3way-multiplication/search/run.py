import sys, numpy as np
from tensor import *
n, R, starts = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
T = chain_tensor(n) if len(sys.argv) < 5 else chain_tensor(n)
best = 1e9
for s in range(starts):
    err, F = fit(T, R, s)
    best = min(best, err)
    if err < 1e-9:
        print(f"N={n} R={R} seed={s} err={err:.2e}  CONVERGED"); np.save(f"sol_n{n}_r{R}_s{s}.npy", np.array(F)); break
else:
    print(f"N={n} R={R} best err over {starts} starts = {best:.3e}")
