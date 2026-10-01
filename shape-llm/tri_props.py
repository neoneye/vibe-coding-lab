"""Properties of a trained triangle layer (tiny.py checkpoints): which outputs matter, and how training treats
long ("centre") vs short (edge) lines.
- importance: zero the 3n sweep outputs longest-line first, shortest-line first, or at random (same counts)
- per-output statistics by line length: activation size (after scaling) and output-weight column norm
Usage: python tri_props.py variant seed steps"""
import sys, math, torch, torch.nn.functional as F
variant, seed, steps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
sys.argv = ["tiny.py", variant, str(seed), str(steps)]
src = open("tiny.py").read(); exec(src[: src.index('if __name__ == "__main__":')])
model = LM(); model.load_state_dict(torch.load(f"ckpt_tiny_{variant}_{seed}_{steps}.pt")); model.eval()
ffns = [b.ffn for b in model.blocks]; fan = ffns[0].fanin; m = len(fan)
@torch.no_grad()
def evaluate(n=60):
    gv = torch.Generator().manual_seed(4321); tot = 0.0
    for _ in range(n): x, y = batch(val, gv); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    return tot / n / math.log(2)
def keep(mask):
    for f in ffns: f.keep = None if mask is None else mask.float()
base = evaluate(); print(f"{variant} seed={seed} bpc={base:.4f}")
order_long = torch.argsort(fan, descending=True, stable=True); order_short = torch.argsort(fan, stable=True)
g = torch.Generator().manual_seed(5)
for frac in (0.2, 0.4, 0.6):
    k = int(frac * m); res = []
    for order in (order_long, order_short, torch.randperm(m, generator=g)):
        mask = torch.ones(m); mask[order[:k]] = 0; keep(mask); res.append(evaluate() - base)
    keep(None)
    print(f"  drop {int(frac*100)}% of outputs: longest lines first Δ={res[0]:+.4f}  shortest first Δ={res[1]:+.4f}  random Δ={res[2]:+.4f}")
acts = []
h = ffns[0].b.register_forward_hook(lambda mod, i, o: acts.append(i[0].detach()))
with torch.no_grad(): x, _ = batch(val, torch.Generator().manual_seed(1)); model(x)
h.remove()
a = acts[0].abs().mean((0, 1)); wn = ffns[0].b.weight.detach().norm(dim=0)
bins = [(1, 10), (11, 40), (41, 80), (81, 200)]
print("  line length     " + "  ".join(f"{lo:>3}-{hi:<3}" for lo, hi in bins))
for name, v in (("|activation|", a), ("|out weight|", wn)):
    print(f"  {name:15s} " + "  ".join(f"{float(v[(fan >= lo) & (fan <= hi)].mean()) if ((fan >= lo) & (fan <= hi)).any() else float('nan'):7.3f}" for lo, hi in bins))
