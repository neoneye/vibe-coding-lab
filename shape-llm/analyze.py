"""Inspect a trained shape-llm: activation size per cell at the end of each level, and the cost of zeroing the
outer rings vs random cells of the residual stream at the end of each level.
Usage: python analyze.py seed steps   (writes analysis_<seed>.json for the page)"""
import sys, json, math, torch, torch.nn.functional as F
seed, steps = int(sys.argv[1]), int(sys.argv[2])
sys.argv = ["shapellm.py", "hex", str(seed), str(steps)]
src = open("shapellm.py").read(); exec(src[: src.index("count = lambda m")])
from hexgrid import cells, dist
model = HexLM(); model.load_state_dict(torch.load(f"ckpt_hex_{seed}_{steps}.pt")); model.eval()
ends = [1, 4, 7]                                   # body index after the 2nd block of each level
levels = HexLM.LEVELS
mask = {}
def make_hook(li):
    R, c = levels[li]
    def hook(m, i, o):
        acts[li] = o.detach().view(*o.shape[:2], -1, c).abs().mean(-1).mean((0, 1))
        if li in mask: return (o.view(*o.shape[:2], -1, c) * mask[li][None, None, :, None]).view_as(o)
    return hook
acts = {}
for li, bi in enumerate(ends): model.body[bi].register_forward_hook(make_hook(li))
@torch.no_grad()
def evaluate(n=40):
    gv = torch.Generator().manual_seed(4321); tot = 0.0
    for _ in range(n): x, y = batch(val, gv); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    return tot / n / math.log(2)
base = evaluate(); out = {"base_bpc": base, "levels": []}
print(f"seed={seed} val_bpc={base:.4f}")
g = torch.Generator().manual_seed(9)
for li, (R, c) in enumerate(levels):
    C = cells(R); ring = torch.tensor([dist(x) for x in C])
    lev = {"R": R, "act": [float(v) for v in acts[li]], "ablation": []}
    for k in range(R - 1, max(-1, R - 5), -1):
        keep = (ring <= k).float(); n = int(keep.sum())
        mask[li] = keep; v_ring = evaluate()
        rnd = torch.zeros(len(C)); rnd[torch.randperm(len(C), generator=g)[:n]] = 1; mask[li] = rnd; v_rand = evaluate()
        del mask[li]
        lev["ablation"].append({"kept": n / len(C), "outer": v_ring - base, "random": v_rand - base})
        print(f"  level radius {R:2d}: keep rings <= {k:2d} ({100*n/len(C):4.1f}% of cells)  outer-first Δ={v_ring-base:+.4f}  random Δ={v_rand-base:+.4f}")
    by_ring = [float(acts[li][ring == k].mean()) for k in range(R + 1)]
    print(f"  level radius {R:2d}: |activation| by ring " + " ".join(f"{v:.3f}" for v in by_ring))
    lev["act_by_ring"] = by_ring; out["levels"].append(lev)
json.dump(out, open(f"analysis_{seed}.json", "w"))
