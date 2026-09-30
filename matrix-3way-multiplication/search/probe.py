"""Continue LM on one seed and log (fit, max|coef|) to tell exact solutions from border (divergent) ones."""
import sys, torch, deg3h
from deg3h import *
s, t, seed, rounds = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
g = torch.Generator().manual_seed(seed)
X = torch.randn(700, NV, generator=g); Y = target(X)
p = 0.6 * torch.randn(nparams(s, t), generator=g)
for k in range(rounds):
    p, err = lm(p, X, Y, s, t, iters=1500)
    print(f"round {k}: fit={err:.3e} maxcoef={p.abs().max().item():.3e}", flush=True)
    torch.save(p, f"sol/probe_s{s}_t{t}_seed{seed}.pt")
