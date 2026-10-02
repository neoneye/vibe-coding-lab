"""What did the alternating matrix-product models learn? For a trained 1,000-step model:
  * loss on training text vs held-out text (is the gain optimisation or generalisation?);
  * for the offset family: held-out loss when the result of blocks 1–2 is shifted by offsets the model may never have seen.
Usage: SHAPE_CORPUS=corpus_e4.txt python mat_props.py <kind> [seed] [steps]"""
import sys, math, torch, torch.nn.functional as F
name = sys.argv[1]; seed = int(sys.argv[2]) if len(sys.argv) > 2 else 0; steps = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
sys.argv = ["shapellm.py", name, str(seed), str(steps)]
src = open("shapellm.py").read(); exec(src[: src.index("count = lambda m")])
if MAT or TRI or SQ or kind in ("hex", "hex2"): model = HexLM()
else:
    count = lambda m: sum(p.numel() for p in m.parameters())
    k0 = kind; kind = "hex2"; target = count(HexLM()); kind = k0; D = 64
    while count(BaseLM(D + 8)) <= target: D += 8
    model = BaseLM(D)
model.load_state_dict(torch.load(f"ckpt_{TAG}_{seed}_{steps}.pt")); model.eval(); QSTATE["rng"] = __import__("random").Random(1234)
@torch.no_grad()
def loss_on(src_data, n=40):
    g = torch.Generator().manual_seed(1234); tot = 0.0
    for _ in range(n): x, y = batch(src_data, g); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    return tot / n / math.log(2)
tr_l, va_l = loss_on(train), loss_on(val)
print(f"{TAG}: train {tr_l:.4f}  val {va_l:.4f}  gap {va_l - tr_l:+.4f}")
ffns = [m.ffn for m in model.body if hasattr(m, "ffn")]             # the six feed-forward layers, in order
first = ffns[:2] if MAT or TRI12 else []
if kind == "matnone12" and not GAIN12 and "none12" in TAG: first = []   # nothing to test: blocks 1–2 have no feed-forward
if first and not QMODE and not kind.startswith("matstair") and all(isinstance(m, MatFFN) and m.gain is None for m in first):
    out = []
    for xo, yo in [(0, 0), (1, 0), (0, 1), (1, 1), (2, 1), (2, 2), (3, 3), (5, 5), (0, 5), (7, 3)]:
        for m in first: m.offset = (xo, yo)
        MATSTEP["it"] = 1; out.append(f"({xo},{yo}) {loss_on(val) - va_l:+.3f}"); MATSTEP["it"] = 0
    print("   shift →", "  ".join(out))
if first:                                                           # how much does the model rely on the feed-forward of blocks 1–2?
    for m in first:
        if isinstance(m, MatFFN) and not kind.startswith("matstair"): m.offset = False
    hooks = [m.register_forward_hook(lambda mod, i, o: torch.zeros_like(o)) for m in first]
    print(f"   blocks 1–2 feed-forward switched off: {loss_on(val) - va_l:+.3f}")
    for h in hooks: h.remove()
    later = ffns[2:]
    hooks = [m.register_forward_hook(lambda mod, i, o: torch.zeros_like(o)) for m in later]
    print(f"   blocks 3–6 feed-forward switched off: {loss_on(val) - va_l:+.3f}")
    for h in hooks: h.remove()
    norms = []
    def grab(mod, i, o): norms.append((o.norm(dim=-1).mean() / i[0].norm(dim=-1).mean()).item())
    hooks = [m.register_forward_hook(grab) for m in ffns]
    loss_on(val, 4)
    n = len(norms) // 6; print("   |feed-forward output| / |its input|, blocks 1..6:", " ".join(f"{sum(norms[i::6]) / n:.2f}" for i in range(6)))
