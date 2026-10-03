"""How robust is a trained model to disruptions? Evaluation only, on a trained checkpoint; reports the rise in validation loss.
  weight noise:     every weight multiplied by (1 + σ·ε), ε ~ N(0, 1), for σ = 5%, 10%, 20% (mean of 3 draws)
  value noise:      every LayerNorm output (the input to each attention, feed-forward and output layer) plus σ·std·ε, σ = 0.1, 0.2, 0.5
  dropped values:   a random 10% or 20% of every LayerNorm output set to zero (rescaled like dropout)
Usage: SHAPE_CORPUS=corpus_e4.txt python robust_props.py <kind> [seed] [steps]"""
import sys, math, torch, torch.nn.functional as F
name = sys.argv[1]; seed = int(sys.argv[2]) if len(sys.argv) > 2 else 0; steps = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
sys.argv = ["shapellm.py", name, str(seed), str(steps)]
src = open("shapellm.py").read(); exec(src[: src.index("g, gv = torch.Generator()")])
model.load_state_dict(torch.load(f"ckpt_{TAG}_{seed}_{steps}.pt")); model.eval(); QSTATE["rng"] = __import__("random").Random(1234)
params = [p for nm, p in model.named_parameters() if p.dim() >= 2 or nm.endswith(".W")]   # weight matrices and the triangle weights; not LayerNorm gains
orig = [p.detach().clone() for p in params]
MODE = {"kind": None, "s": 0.0}; noise_g = torch.Generator().manual_seed(7)
def hook(m, i, o):
    if MODE["kind"] == "noise": return o + MODE["s"] * o.std() * torch.randn(o.shape, generator=noise_g)
    if MODE["kind"] == "drop": keep = (torch.rand(o.shape, generator=noise_g) >= MODE["s"]).float(); return o * keep / (1 - MODE["s"])
for m in model.modules():
    if isinstance(m, nn.LayerNorm): m.register_forward_hook(hook)
@torch.no_grad()
def evaluate(n=40):
    g = torch.Generator().manual_seed(1234); tot = 0.0
    for _ in range(n): x, y = batch(val, g); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    return tot / n / math.log(2)
base = evaluate(); out = [f"{TAG}: base {base:.4f}"]
wn = []
for sg in (0.05, 0.10, 0.20):
    vs = []
    for d in range(3):
        g = torch.Generator().manual_seed(100 + d)
        with torch.no_grad():
            for p, o in zip(params, orig): p.copy_(o * (1 + sg * torch.randn(o.shape, generator=g)))
        vs.append(evaluate())
    with torch.no_grad():
        for p, o in zip(params, orig): p.copy_(o)
    wn.append(f"{sum(vs) / 3 - base:+.3f}")
out.append("weight noise 5/10/20%: " + " ".join(wn))
an = []
for sg in (0.1, 0.2, 0.5): MODE.update(kind="noise", s=sg); noise_g.manual_seed(7); an.append(f"{evaluate() - base:+.3f}")
out.append("value noise 0.1/0.2/0.5: " + " ".join(an))
dr = []
for sg in (0.1, 0.2): MODE.update(kind="drop", s=sg); noise_g.manual_seed(7); dr.append(f"{evaluate() - base:+.3f}")
MODE["kind"] = None
out.append("dropped 10/20%: " + " ".join(dr))
print(" | ".join(out), flush=True)
