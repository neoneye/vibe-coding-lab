"""Long continuation of a near-hit symmetric pentagon fit: log (error, norm) every chunk.
A border decomposition keeps lowering the error as a power of the growing norm; a flat valley stalls.
Usage: python long_cyclic.py m f seed chunks"""
import sys, numpy as np, torch
import cyclic as C
m, f, seed, chunks = map(int, sys.argv[1:5])
C.m, C.f = m, f
g = torch.Generator().manual_seed(seed)
p = 0.6 * torch.randn(m * C.k * C.d + f * C.d, generator=g)
for c in range(chunks):
    p, err = C.lm(p, iters=2500)
    print(f"m={m} f={f} R={5*m+f} seed={seed} chunk={c} err={err:.5e} |p|={p.norm().item():.4e} max={p.abs().max().item():.4e}", flush=True)
    np.save(f"long_m{m}_f{f}_s{seed}.npy", p.numpy())
