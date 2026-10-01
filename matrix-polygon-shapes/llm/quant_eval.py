"""Post-training quantisation of the feed-forward weights: does a triangle (or cube) of weights, swept three
ways, keep its quality with fewer bits than an MLP or a gated (SwiGLU-style) block?

Every feed-forward parameter tensor (projections and the triangle/cube weights) is rounded to b bits:
symmetric, per tensor, round-to-nearest, levels k·scale with |k| ≤ 2^(b−1) − 1 (b = 2 is ternary).
Usage: python quant_eval.py variant seed"""
import sys, math, torch, torch.nn.functional as F
variant, seed = sys.argv[1], int(sys.argv[2])
mode = sys.argv[3] if len(sys.argv) > 3 else "all"   # all | shape-only (triangle/cube W) | in-only (input projection) | out-only (output projection)
shape_only = mode == "shape-only"
sys.argv = ["triangle_ffn.py", variant, str(seed), "1500"]
src = open("triangle_ffn.py").read()
exec(src[: src.index("model = LM()")])                      # data, model classes, batch()
model = LM(); model.load_state_dict(torch.load(f"ckpt_{variant}_{seed}_1500.pt")); model.eval()
ffn = ([b.ffn.W for b in model.blocks] if mode == "shape-only" else [b.ffn.a.weight for b in model.blocks] if mode == "in-only"
       else [b.ffn.b.weight for b in model.blocks] if mode == "out-only" else [p for b in model.blocks for p in b.ffn.parameters()])
orig = [p.detach().clone() for p in ffn]
n_params = sum(p.numel() for p in ffn)

@torch.no_grad()
def evaluate(n=100):
    gv = torch.Generator().manual_seed(4321); tot = 0.0
    for _ in range(n):
        x, y = batch(val, gv)
        tot += sum(F.cross_entropy(model(xm).reshape(-1, V), ym.reshape(-1)).item() for xm, ym in zip(x.chunk(ACCUM), y.chunk(ACCUM))) / ACCUM
    return tot / n / math.log(2)

@torch.no_grad()
def quantise(bits):
    for p, o in zip(ffn, orig):
        if bits is None: p.copy_(o); continue
        L = 2 ** (bits - 1) - 1; scale = o.abs().max() / L
        p.copy_(torch.round(o / scale).clamp(-L, L) * scale)

base = evaluate()
print(f"{variant}{'' if mode == 'all' else '/' + mode} seed={seed} bits=float val_bpc={base:.4f} ffn_params={n_params}", flush=True)
for bits in (8, 6, 5, 4, 3, 2):
    quantise(bits); v = evaluate()
    print(f"{variant}{'' if mode == 'all' else '/' + mode} seed={seed} bits={bits} val_bpc={v:.4f} delta={v - base:+.4f} ffn_kbits={n_params * bits / 1000:.1f}", flush=True)
quantise(None)
