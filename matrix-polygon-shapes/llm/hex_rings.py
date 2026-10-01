"""Per-ring statistics of a trained hexagonal layer: output-projection column norm, activation size, and how far
the output weights moved from initialisation (init re-created with the same seed). Usage: python hex_rings.py variant seed"""
import sys, math, torch
variant, seed = sys.argv[1], int(sys.argv[2])
sys.argv = ["triangle_ffn.py", variant, str(seed), "1500"]
src = open("triangle_ffn.py").read(); exec(src[: src.index("model = LM()")])
torch.manual_seed(seed); init = LM()                                  # same seed ⇒ same initial weights as training
model = LM(); model.load_state_dict(torch.load(f"ckpt_{variant}_{seed}_1500.pt")); model.eval()
conv = model.blocks[0].ffn.conv; ring = conv.ring; maxring = int(ring.max())
acts = []
def hook(m, i, o): acts.append(o.detach())
h = model.blocks[0].ffn.conv.register_forward_hook(hook)
with torch.no_grad():
    gv = torch.Generator().manual_seed(1); x, _ = batch(val, gv); model(x)
h.remove()
z = acts[0].reshape(-1, conv.n_out)
W, W0 = model.blocks[0].ffn.b.weight.detach(), init.blocks[0].ffn.b.weight.detach()
print(f"{variant} seed={seed}   ring:  " + " ".join(f"{k:6d}" for k in range(maxring + 1)))
for name, vals in [("|activation|", z.abs().mean(0)), ("|out weight col|", W.norm(dim=0)), ("moved from init", (W - W0).norm(dim=0))]:
    per = [float(vals[ring == k].mean()) for k in range(maxring + 1)]
    print(f"  {name:18s} " + " ".join(f"{v:6.3f}" for v in per))
