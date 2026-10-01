"""Mixed-precision storage of the feed-forward block: each weight group gets its own bit width.
Compares quality at equal total feed-forward storage (bits). Groups: a = input projection, g = gate (SwiGLU-style),
W = triangle/cube three-way weights, b = output projection. Same quantiser as quant_eval.py.
Usage: python mixed_eval.py variant seed "a=8,W=3,b=4" ["a=..." ...]"""
import sys, math, torch, torch.nn.functional as F
variant, seed, configs = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
sys.argv = ["triangle_ffn.py", variant, str(seed), "1500"]
src = open("triangle_ffn.py").read(); exec(src[: src.index("model = LM()")])
model = LM(); model.load_state_dict(torch.load(f"ckpt_{variant}_{seed}_1500.pt")); model.eval()
groups = {}
for blk in model.blocks:
    f = blk.ffn
    for name in ("a", "g", "b"):
        if hasattr(f, name): groups.setdefault(name, []).append(getattr(f, name).weight)
    if hasattr(f, "W"): groups.setdefault("W", []).append(f.W)
orig = {k: [p.detach().clone() for p in v] for k, v in groups.items()}
@torch.no_grad()
def evaluate(n=100):
    gv = torch.Generator().manual_seed(4321); tot = 0.0
    for _ in range(n):
        x, y = batch(val, gv)
        tot += sum(F.cross_entropy(model(xm).reshape(-1, V), ym.reshape(-1)).item() for xm, ym in zip(x.chunk(ACCUM), y.chunk(ACCUM))) / ACCUM
    return tot / n / math.log(2)
base = evaluate()
for cfg in configs:
    bits = dict((k, int(v)) for k, v in (kv.split("=") for kv in cfg.split(",")))
    kbits = 0.0
    with torch.no_grad():
        for k, ps in groups.items():
            for p, o in zip(ps, orig[k]):
                b = bits[k]; L = 2 ** (b - 1) - 1; s = o.abs().max() / L
                p.copy_(torch.round(o / s).clamp(-L, L) * s); kbits += o.numel() * b / 1000
    v = evaluate()
    print(f"{variant} seed={seed} {cfg:22s} ffn_kbits={kbits:6.1f} delta={v - base:+.4f}", flush=True)
