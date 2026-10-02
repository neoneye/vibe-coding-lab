"""Count the arithmetic one token needs in a forward pass, independent of how fast the code is.
Multiply-adds: every weight of a matrix in use once per token (Linear layers, bottlenecks), attention scores and
mixing (2 · context · attention width), the matrix product of the feed-forward (m³, or m² · window for the local one).
Element operations: what is touched but not multiplied by a weight (LayerNorm, residual adds), about 6 per value of width.
Usage: python flops.py <kind>"""
import sys, torch
name = sys.argv[1]; sys.argv = ["shapellm.py", name, "0", "1000"]
src = open("shapellm.py").read(); exec(src[: src.index("g, gv = torch.Generator()")])
ma = {"linear": 0, "attention": 0, "product": 0}; el = [0]
def lin(m, i, o): ma["linear"] += m.in_features * m.out_features * (i[0].shape[-2] if i[0].dim() == 4 else 1)   # bottleneck: once per coarse cell
def att(m, i, o): ma["attention"] += 2 * CTX * (m.qkv.out_features // 3)
def ffn(m, i, o):
    if isinstance(m, MatFFN) and m.offset != "none" and m.offset != "gelu": ma["product"] += m.m ** 2 * ((2 * m.half + 1) if LOCAL else m.m)
def norm(m, i, o): el[0] += 6 * i[0].shape[-1]
hooks = []
for m in model.modules():
    if isinstance(m, nn.Linear): hooks.append(m.register_forward_hook(lin))
    if isinstance(m, Attention): hooks.append(m.register_forward_hook(att))
    if isinstance(m, (MatFFN,)): hooks.append(m.register_forward_hook(ffn))
    if isinstance(m, nn.LayerNorm): hooks.append(m.register_forward_hook(norm))
unused = [m for m in model.modules() if (isinstance(m, MatFFN) and m.offset == "none") or (isinstance(m, MLP) and m.off)]
for m in unused:
    for h in list(m.a._forward_hooks): pass
with torch.no_grad(): model(torch.zeros(1, CTX, dtype=torch.long))
skip = sum(l.in_features * l.out_features for m in unused for l in (m.a, m.b))   # never executed anyway (the layer returns early)
tot = sum(ma.values())
print(f"{TAG}: multiply-adds per token {tot:,} (linear {ma['linear']:,}, attention {ma['attention']:,}, matrix product {ma['product']:,}); element operations {el[0]:,}; widths {sorted({m.normalized_shape[0] for m in model.modules() if isinstance(m, nn.LayerNorm)}, reverse=True)}")
