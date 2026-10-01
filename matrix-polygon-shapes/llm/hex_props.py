"""Properties of hexagonal feed-forward layers in the tiny LM (trained checkpoints):
1. ring ablation: keep only output rings ≤ k (drop the outer ones) vs dropping the same number of random cells;
   also how many pair-products the kept outputs still need (compute that can be skipped)
2. precision by ring: quantise the output-projection weights attached to each output cell with more bits near
   the centre and fewer at the edge, vs the same average bit width everywhere.
Usage: python hex_props.py variant seed"""
import sys, math, torch, torch.nn.functional as F
variant, seed = sys.argv[1], int(sys.argv[2])
sys.argv = ["triangle_ffn.py", variant, str(seed), "1500"]
src = open("triangle_ffn.py").read(); exec(src[: src.index("model = LM()")])
model = LM(); model.load_state_dict(torch.load(f"ckpt_{variant}_{seed}_1500.pt")); model.eval()
ffns = [b.ffn for b in model.blocks]; conv = ffns[0].conv
ring = conv.ring; maxring = int(ring.max()); n_out = conv.n_out
# products landing on each output cell (fan-in), from the radius-R input hexagon
from hexconv import hex_cells
P = hex_cells(conv.R); outs = hex_cells(conv.R if conv.wrap else 2 * conv.R); oi = {c: i for i, c in enumerate(outs)}
fanin = torch.zeros(n_out)
if conv.wrap: fanin[:] = len(P)
else:
    for p in P:
        for q in P: fanin[oi[(p[0] + q[0], p[1] + q[1])]] += 1

@torch.no_grad()
def evaluate(n=60):
    gv = torch.Generator().manual_seed(4321); tot = 0.0
    for _ in range(n):
        x, y = batch(val, gv); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    return tot / n / math.log(2)
def set_keep(mask):
    for f in ffns: f.keep = None if mask is None else mask.float()
base = evaluate()
print(f"{variant} seed={seed} full: bpc={base:.4f} outputs={n_out} products={int(fanin.sum())}", flush=True)
g = torch.Generator().manual_seed(7)
for k in range(maxring - 1, max(-1, maxring - 7), -1):
    keep = ring <= k; nk = int(keep.sum())
    set_keep(keep); v_ring = evaluate()
    perm = torch.randperm(n_out, generator=g); rnd = torch.zeros(n_out, dtype=torch.bool); rnd[perm[:nk]] = True
    set_keep(rnd); v_rand = evaluate()
    print(f"{variant} seed={seed} keep rings<= {k:2d}: cells {nk:3d}/{n_out} ({100*nk/n_out:4.1f}%) products kept {100*float(fanin[keep].sum()/fanin.sum()):5.1f}%"
          f"  drop-outer-rings Δ={v_ring-base:+.4f}  drop-random Δ={v_rand-base:+.4f}", flush=True)
set_keep(None)
# precision by ring on the output projection columns
orig = [f.b.weight.detach().clone() for f in ffns]
def quantise(bits_per_cell):
    with torch.no_grad():
        for f, o in zip(ffns, orig):
            W = o.clone()
            for b in bits_per_cell.unique().tolist():
                cols = bits_per_cell == b; L = 2 ** (int(b) - 1) - 1; s = o[:, cols].abs().max() / L
                W[:, cols] = torch.round(o[:, cols] / s).clamp(-L, L) * s
            f.b.weight.copy_(W)
def restore():
    with torch.no_grad():
        for f, o in zip(ffns, orig): f.b.weight.copy_(o)
for avg in (3, 2):
    uni = torch.full((n_out,), float(avg)); quantise(uni); v_uni = evaluate()
    # centre-heavy allocation with the same average: bits fall linearly with ring, scaled to the target mean
    w = (maxring + 1 - ring.float()); alloc = (w / w.mean() * avg).round().clamp(2, 8)
    while alloc.mean() > avg + 1e-9: alloc[alloc.argmax()] -= 1
    quantise(alloc); v_ctr = evaluate()
    rev = (ring.float() + 1); alloc_r = (rev / rev.mean() * avg).round().clamp(2, 8)
    while alloc_r.mean() > avg + 1e-9: alloc_r[alloc_r.argmax()] -= 1
    quantise(alloc_r); v_edge = evaluate(); restore()
    print(f"{variant} seed={seed} output weights at {avg} bits average: uniform Δ={v_uni-base:+.4f}  more bits at centre Δ={v_ctr-base:+.4f}  more bits at edge Δ={v_edge-base:+.4f}", flush=True)
