"""Which sweep directions does a trained model rely on? Zero one direction's outputs in every feed-forward layer
(at evaluation only) and report the rise in validation loss, plus the mean |output weight| per direction.
Usage: SHAPE_CORPUS=corpus_e4.txt python sq_props.py sq4c|sq4|triW seed steps"""
import sys, math, torch, torch.nn.functional as F
kind, seed, steps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
sys.argv = ["shapellm.py", kind, str(seed), str(steps)]
src = open("shapellm.py").read(); exec(src[: src.index("count = lambda m")])
model = HexLM(); model.load_state_dict(torch.load(f"ckpt_{kind}_{seed}_{steps}.pt")); model.eval()
ffns = [m for m in model.modules() if isinstance(m, (SqFFN, TriFFN))]
ND = 4 if SQ else 3; drop = {"d": None}
def pre(m, inp):
    if drop["d"] is None: return
    y = inp[0].clone(); n = y.shape[-1] // ND; y[..., drop["d"] * n:(drop["d"] + 1) * n] = 0; return (y,)
for f in ffns: f.b.register_forward_pre_hook(pre)
@torch.no_grad()
def evaluate(n=40):
    gv = torch.Generator().manual_seed(1234); tot = 0.0
    for _ in range(n): x, y = batch(val, gv); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    return tot / n / math.log(2)
base = evaluate(); names = ["rows 0°", "columns 90°", "diagonal 45°", "diagonal 135° (extra)"][:ND]   # i+j = const is the triangle's third direction; i−j = const is the added one
wn = [sum(f.b.weight[:, d * (f.b.in_features // ND):(d + 1) * (f.b.in_features // ND)].abs().mean().item() for f in ffns) / len(ffns) for d in range(ND)]
print(f"{kind} seed={seed} val_bpc={base:.4f}")
for d in range(ND):
    drop["d"] = d; print(f"  without {names[d]:22s} Δ={evaluate() - base:+.6f}   mean |out weight| {wn[d]:.4f}")
