"""How well does a trained model survive rounding its weights to few bits?
Every weight matrix in use (embeddings, attention, bottlenecks, feed-forward projections, output layer) is rounded
to b bits after training: symmetric, per tensor, round to nearest, levels k·scale with |k| ≤ 2^(b−1) − 1
(b = 2 is ternary: −1, 0, +1). The scale is the clipping point that minimises the squared rounding error.
LayerNorm gains and biases (1-D, 0.3% of the parameters) are left as they are.
Usage: SHAPE_CORPUS=corpus_e4.txt python quant_props.py <kind> [seed] [steps]"""
import sys, math, torch, torch.nn.functional as F
name = sys.argv[1]; seed = int(sys.argv[2]) if len(sys.argv) > 2 else 0; steps = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
sys.argv = ["shapellm.py", name, str(seed), str(steps)]
src = open("shapellm.py").read(); exec(src[: src.index("count = lambda m")])
count = lambda m: sum(p.numel() for p in m.parameters())
if MAT or TRI or SQ or kind in ("hex", "hex2"): model = HexLM()
else:
    k0 = kind; kind = "hex2"; target = count(HexLM()); kind = k0; D = 64
    while count(BaseLM(D + 8)) <= target: D += 8
    model = BaseLM(D)
model.load_state_dict(torch.load(f"ckpt_{TAG}_{seed}_{steps}.pt")); model.eval(); QSTATE["rng"] = __import__("random").Random(1234)
unused = set()                                                      # feed-forward weights that exist but are never used ("…none12")
for m in model.modules():
    if (isinstance(m, MatFFN) and m.offset == "none") or (isinstance(m, MLP) and m.off): unused |= {id(p) for p in m.parameters()}
mats = [p for p in model.parameters() if p.dim() >= 2 and id(p) not in unused]; orig = [p.detach().clone() for p in mats]
n = sum(p.numel() for p in mats)

@torch.no_grad()
def evaluate(k=40):
    g = torch.Generator().manual_seed(1234); tot = 0.0
    for _ in range(k): x, y = batch(val, g); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    return tot / k / math.log(2)

@torch.no_grad()
def rounded(o, bits):
    L = 2 ** (bits - 1) - 1; best = None
    for c in torch.linspace(0.15, 1.0, 18):                         # choose the clipping point with the least squared error
        scale = c * o.abs().max() / L; q = torch.round(o / scale).clamp(-L, L) * scale; e = (q - o).pow(2).sum()
        if best is None or e < best[0]: best = (e, q)
    return best[1]

base = evaluate(); print(f"{TAG}: {n:,} weights in matrices in use; float loss {base:.4f}", flush=True)
for bits in (8, 6, 5, 4, 3, 2):
    for p, o in zip(mats, orig): p.data.copy_(rounded(o, bits))
    v = evaluate(); print(f"  {bits} bits: {v:.4f} ({v - base:+.4f})  {n * bits / 8e6:.2f} MB", flush=True)
for p, o in zip(mats, orig): p.data.copy_(o)
