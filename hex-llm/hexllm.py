"""hex-llm: a small character-level language model whose hidden state is a hexagon of feature cells.

  blocks 1–2: hexagon radius 12 (469 cells × 2 channels = 938 features)
  bottleneck: every 3 mutually adjacent cells → 1 coarse cell (aperture-3 triangles, cropped to radius 6)
  blocks 3–4: radius 6 (127 cells × 6 channels = 762)
  bottleneck: 3 → 1, cropped to radius 3
  blocks 5–6: radius 3 (37 cells × 16 channels = 592)

Each block: causal attention across tokens (on the flattened hexagon, low-rank 128-dim heads) and a hexagonal
feed-forward: every cell mixes with its 6 neighbours through a shared gated 7-tap hexagonal convolution, plus a
per-cell bias. The baseline is an ordinary transformer with the same depth and parameter count.
Usage: python hexllm.py hex|base seed steps"""
import sys, glob, math, time, torch, torch.nn as nn, torch.nn.functional as F
from hexgrid import cells, neighbours, bottleneck
torch.set_num_threads(2)

kind, seed, steps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
torch.manual_seed(seed)
CTX, BATCH, LR = 64, 16, 1e-3

paths = sorted(glob.glob("../**/*.md", recursive=True))
text = "".join(open(p, encoding="utf-8", errors="ignore").read() for p in paths)
common = [c for c in sorted(set(text)) if text.count(c) > 200]
stoi = {c: i for i, c in enumerate(common)}; V = len(common) + 1
data = torch.tensor([stoi.get(c, V - 1) for c in text], dtype=torch.long)
n_val = len(data) // 10; train, val = data[:-n_val], data[-n_val:]
def batch(src, g):
    ix = torch.randint(len(src) - CTX - 1, (BATCH,), generator=g)
    return torch.stack([src[i:i + CTX] for i in ix]), torch.stack([src[i + 1:i + CTX + 1] for i in ix])

class Attention(nn.Module):
    def __init__(s, D, A=128, H=4):
        super().__init__(); s.H = H; s.qkv = nn.Linear(D, 3 * A, bias=False); s.o = nn.Linear(A, D, bias=False)
    def forward(s, x):
        B, T, _ = x.shape
        q, k, v = s.qkv(x).view(B, T, 3, s.H, -1).permute(2, 0, 3, 1, 4)
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        return s.o(y.transpose(1, 2).reshape(B, T, -1))

class HexFFN(nn.Module):
    """gated 7-tap hexagonal convolution over the feature cells (weights shared across cells) + per-cell bias."""
    def __init__(s, R, c, mult=4):
        super().__init__(); s.R, s.c = R, c
        nb = torch.tensor(neighbours(R)); s.register_buffer("nb", nb.clamp(min=0)); s.register_buffer("valid", (nb >= 0).float())
        s.up = nn.Linear(7 * c, 2 * mult * c, bias=False); s.down = nn.Linear(mult * c, c, bias=False)
        s.bias = nn.Parameter(torch.zeros(len(cells(R)), c))
    def forward(s, x):
        B, T, _ = x.shape; h = x.view(B, T, -1, s.c)
        g = h[:, :, s.nb, :] * s.valid[..., None]                   # (B, T, cells, 7, c), zero outside the hexagon
        u, v = s.up(g.flatten(-2)).chunk(2, -1)
        return (s.down(F.silu(u) * v) + s.bias).view(B, T, -1)

class Block(nn.Module):
    def __init__(s, D, ffn):
        super().__init__(); s.n1 = nn.LayerNorm(D); s.att = Attention(D); s.n2 = nn.LayerNorm(D); s.ffn = ffn
    def forward(s, x):
        x = x + s.att(s.n1(x)); return x + s.ffn(s.n2(x))

class Bottleneck(nn.Module):
    """each coarse cell = linear map of its 3 fine cells (3·c_in → c_out, shared) + per-cell bias."""
    def __init__(s, Rf, Rc, cin, cout):
        super().__init__(); s.cin = cin
        g = torch.tensor(bottleneck(Rf, Rc)); s.register_buffer("g", g.clamp(min=0)); s.register_buffer("valid", (g >= 0).float())
        s.lin = nn.Linear(3 * cin, cout, bias=False); s.bias = nn.Parameter(torch.zeros(len(cells(Rc)), cout)); s.norm = nn.LayerNorm(len(cells(Rc)) * cout)
    def forward(s, x):
        B, T, _ = x.shape; h = x.view(B, T, -1, s.cin)
        t = h[:, :, s.g, :] * s.valid[..., None]                    # (B, T, coarse, 3, c_in)
        return s.norm((s.lin(t.flatten(-2)) + s.bias).view(B, T, -1))

class HexLM(nn.Module):
    LEVELS = [(12, 2), (6, 6), (3, 16)]                             # (radius, channels per cell), 2 blocks each
    def __init__(s):
        super().__init__()
        D0 = len(cells(12)) * 2
        s.emb = nn.Embedding(V, D0); s.pos = nn.Embedding(CTX, D0)
        layers = []
        for li, (R, c) in enumerate(s.LEVELS):
            D = len(cells(R)) * c
            if li: Rp, cp = s.LEVELS[li - 1]; layers.append(Bottleneck(Rp, R, cp, c))
            layers += [Block(D, HexFFN(R, c)), Block(D, HexFFN(R, c))]
        s.body = nn.Sequential(*layers); Dl = len(cells(3)) * 16
        s.norm = nn.LayerNorm(Dl); s.out = nn.Linear(Dl, V, bias=False)
    def forward(s, idx): return s.out(s.norm(s.body(s.emb(idx) + s.pos(torch.arange(idx.shape[1])))))

class MLP(nn.Module):
    def __init__(s, D): super().__init__(); s.a = nn.Linear(D, 4 * D, bias=False); s.b = nn.Linear(4 * D, D, bias=False)
    def forward(s, x): return s.b(F.gelu(s.a(x)))
class BaseLM(nn.Module):
    def __init__(s, D):
        super().__init__(); s.emb = nn.Embedding(V, D); s.pos = nn.Embedding(CTX, D)
        s.body = nn.Sequential(*[Block(D, MLP(D)) for _ in range(6)]); s.norm = nn.LayerNorm(D); s.out = nn.Linear(D, V, bias=False)
    def forward(s, idx): return s.out(s.norm(s.body(s.emb(idx) + s.pos(torch.arange(idx.shape[1])))))

count = lambda m: sum(p.numel() for p in m.parameters())
if kind == "hex": model = HexLM()
else:                                                               # match the hex model's parameter count
    target = count(HexLM()); D = 64
    while count(BaseLM(D + 8)) <= target: D += 8
    model = BaseLM(D)
print(f"{kind}: {count(model):,} parameters", flush=True)

opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=LR, total_steps=steps, pct_start=0.1)
g, gv = torch.Generator().manual_seed(seed), torch.Generator().manual_seed(1234)
@torch.no_grad()
def evaluate(n=40):
    model.eval(); tot = 0.0; gv.manual_seed(1234)
    for _ in range(n): x, y = batch(val, gv); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    model.train(); return tot / n / math.log(2)
t0 = time.time()
for step in range(1, steps + 1):
    x, y = batch(train, g); loss = F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1))
    opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); sched.step()
    if step % (steps // 5) == 0:
        print(f"{kind} seed={seed} step={step} val_bpc={evaluate():.4f} sec/step={(time.time()-t0)/step:.3f}", flush=True)
torch.save(model.state_dict(), f"ckpt_{kind}_{seed}_{steps}.pt")
