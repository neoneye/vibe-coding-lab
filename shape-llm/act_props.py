"""How few bits can the numbers flowing through a trained model have?
Every LayerNorm output (the input to every attention and feed-forward layer, and to the output layer) is rounded to
b bits at evaluation: symmetric, clipped at 3 standard deviations of that tensor, round to nearest.
With few-bit weights (SHAPE_WBITS) every weight-matrix multiply then has small-integer inputs and small-integer weights.
Usage: SHAPE_WBITS=2 SHAPE_CORPUS=corpus_e4.txt python act_props.py <kind> [seed] [steps]"""
import sys, math, torch, torch.nn.functional as F
name = sys.argv[1]; seed = int(sys.argv[2]) if len(sys.argv) > 2 else 0; steps = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
sys.argv = ["shapellm.py", name, str(seed), str(steps)]
src = open("shapellm.py").read(); exec(src[: src.index("opt = torch.optim.AdamW")])
model.load_state_dict(torch.load(f"ckpt_{TAG}_{seed}_{steps}.pt")); model.eval(); QSTATE["rng"] = __import__("random").Random(1234)
ABITS = {"b": None}
def hook(m, i, o):
    if ABITS["b"] is None: return
    L = 2 ** (ABITS["b"] - 1) - 1; sc = 3 * o.std() / L
    return torch.round(o / sc).clamp(-L, L) * sc
for m in model.modules():
    if isinstance(m, nn.LayerNorm): m.register_forward_hook(hook)
@torch.no_grad()
def evaluate(k=40):
    g = torch.Generator().manual_seed(1234); tot = 0.0
    for _ in range(k): x, y = batch(val, g); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    return tot / k / math.log(2)
base = evaluate(); out = [f"float {base:.4f}"]
for b in (8, 6, 5, 4, 3, 2):
    ABITS["b"] = b; v = evaluate(); out.append(f"{b}b {v:.4f} ({v - base:+.3f})")
print(f"{TAG}: activations →", "  ".join(out))
