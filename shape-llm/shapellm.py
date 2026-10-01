"""shape-llm: small character-level language models shaped like a hexagon (or, see below, a triangle).

The hexagonal pyramid: the hidden state is a hexagon of feature cells.

  blocks 1–2: hexagon radius 12 (469 cells × 2 channels = 938 features)
  bottleneck: every 3 mutually adjacent cells → 1 coarse cell (aperture-3 triangles, cropped to radius 6)
  blocks 3–4: radius 6 (127 cells × 6 channels = 762)
  bottleneck: 3 → 1, cropped to radius 3
  blocks 5–6: radius 3 (37 cells × 16 channels = 592)

Each block: causal attention across tokens (on the flattened hexagon, low-rank 128-dim heads) and a hexagonal
feed-forward: every cell mixes with its 6 neighbours through a shared gated 7-tap hexagonal convolution, plus a
per-cell bias. The baseline is an ordinary transformer with the same depth and parameter count.
Usage: python shapellm.py hex|base seed steps [evals]"""
import sys, glob, math, time, torch, torch.nn as nn, torch.nn.functional as F
from hexgrid import cells, neighbours, bottleneck
torch.set_num_threads(2)

kind, seed, steps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
EVALS = int(sys.argv[4]) if len(sys.argv) > 4 else 5          # how many validation points to log
NORM = kind == "hex2n"
if NORM: kind = "hex2"                                             # same model as hex2, plus neighbour-count normalisation
TRI = kind in ("tri", "triS", "triSN", "triW", "triWS", "triR", "triRN")   # triangle feed-forwards inside the hexagonal pyramid
TRI_WRAP, TRI_SCALED = kind in ("triW", "triWS"), kind in ("triS", "triSN", "triWS")
TRI_RENORM, TRI_REVERSE = kind in ("triSN", "triRN"), kind in ("triR", "triRN")
TRI_N = [50, 65, 85]                                               # triangle side per level (≈ the hex2 feed-forward budget)
torch.manual_seed(seed)
CTX, BATCH, LR = 64, 16, 1e-3

paths = [p for p in sorted(glob.glob("../**/*.md", recursive=True)) if "/shape-llm/" not in p]   # not our own write-ups
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
        if kind == "hex2": A = 48
        super().__init__(); s.H = H; s.qkv = nn.Linear(D, 3 * A, bias=False); s.o = nn.Linear(A, D, bias=False)
    def forward(s, x):
        B, T, _ = x.shape
        q, k, v = s.qkv(x).view(B, T, 3, s.H, -1).permute(2, 0, 3, 1, 4)
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        return s.o(y.transpose(1, 2).reshape(B, T, -1))

class HexFFN(nn.Module):
    """gated 7-tap hexagonal convolution over the feature cells + per-cell bias.
    shared=True: one kernel for all cells (a hexagonal CNN layer); shared=False: every cell has its own
    7-neighbour weights (locally connected), so the hexagonal part can hold most of the parameters."""
    def __init__(s, R, c, mult=4, shared=True):
        super().__init__(); s.R, s.c, s.shared = R, c, shared
        nb = torch.tensor(neighbours(R)); s.register_buffer("nb", nb.clamp(min=0)); s.register_buffer("valid", (nb >= 0).float())
        n = len(cells(R)); h = mult * c
        if shared: s.up = nn.Linear(7 * c, 2 * h, bias=False); s.down = nn.Linear(h, c, bias=False)
        else:
            s.Wup = nn.Parameter(torch.randn(n, 7 * c, 2 * h) / math.sqrt(7 * c)); s.Wdown = nn.Parameter(torch.randn(n, h, c) / math.sqrt(h))
        s.bias = nn.Parameter(torch.zeros(n, c))
        # neighbour-count normalisation (hex2n): cells with fewer valid neighbours get their input scaled up by
        # sqrt(7 / #valid), so every cell's input has the same expected size (interior cells keep weight 1)
        s.register_buffer("nscale", (7.0 / s.valid.sum(1)).sqrt() if NORM else torch.ones(n))
    def forward(s, x):
        B, T, _ = x.shape; h = x.view(B, T, -1, s.c)
        g = (h[:, :, s.nb, :] * s.valid[..., None] * s.nscale[:, None, None]).flatten(-2)  # (B, T, cells, 7c), zero outside
        if s.shared: u, v = s.up(g).chunk(2, -1); y = s.down(F.silu(u) * v)
        else: u, v = torch.einsum("btnk,nkh->btnh", g, s.Wup).chunk(2, -1); y = torch.einsum("btnh,nhc->btnc", F.silu(u) * v, s.Wdown)
        return (y + s.bias).reshape(B, T, -1)

class TriFFN(nn.Module):
    """triangle-shaped weights swept at 0°, 60° and 120° (see tiny.py): h = A x (n units), three sweeps, then B.
    wrap: i + j + k ≡ n − 1 (mod n), every line holds n weights; no wrap: line i holds n − i weights.
    scaled: each output × (products it collects)^−½ (long "centre" lines turned down, length-1 lines at weight 1)."""
    def __init__(s, D, n, wrap, scaled):
        super().__init__()
        cells = [(i, j, (n - 1 - i - j) % n) for i in range(n) for j in range(n)] if wrap else \
                [(i, j, n - 1 - i - j) for i in range(n) for j in range(n - i)]
        I, J, K = (torch.tensor(c) for c in zip(*cells))
        s.register_buffer("I", I); s.register_buffer("J", J); s.register_buffer("K", K)
        fan = torch.stack([torch.bincount(t, minlength=n).float() for t in (I, J, K)]).flatten()
        sc = fan.clamp(min=1) ** -0.5 if scaled else torch.ones(3 * n)
        if TRI_REVERSE: sc = (fan.clamp(min=1) / fan.max()) ** 0.5         # triR: long "centre" lines at 1, edges lower
        if TRI_RENORM: sc = sc / sc.mean()                                 # triSN / triRN: redistribute only, average weight 1
        s.register_buffer("scale", sc)
        s.W = nn.Parameter(torch.randn(len(cells)) / n); s.a = nn.Linear(D, n, bias=False); s.b = nn.Linear(3 * n, D, bias=False)
    def forward(s, x):
        h = s.a(x); hi, hj, hk = h[..., s.I], h[..., s.J], h[..., s.K]
        y = torch.cat([torch.zeros_like(h).index_add_(-1, t, s.W * p) for t, p in [(s.I, hj * hk), (s.J, hi * hk), (s.K, hi * hj)]], -1)
        return s.b(y * s.scale)

class Block(nn.Module):
    def __init__(s, D, ffn):
        A = 48 if (kind == "hex2" or TRI) else 128
        super().__init__(); s.n1 = nn.LayerNorm(D); s.att = Attention(D, A); s.n2 = nn.LayerNorm(D); s.ffn = ffn
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

HEX2_MULT = [4, 3, 2]                                              # hidden multiplier per level for the locally connected version
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
            if TRI:
                layers += [Block(D, TriFFN(D, TRI_N[li], TRI_WRAP, TRI_SCALED)) for _ in range(2)]
            else:
                mult, shared = (HEX2_MULT[li], False) if kind == "hex2" else (4, True)
                layers += [Block(D, HexFFN(R, c, mult, shared)), Block(D, HexFFN(R, c, mult, shared))]
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
if kind in ("hex", "hex2") or TRI: model = HexLM()
else:                                                               # match the hex model's parameter count
    if kind == "base2": kind = "hex2"; target = count(HexLM()); kind = "base2"   # match the locally connected version
    else: target = count(HexLM())
    D = 64
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
    if step % (steps // EVALS) == 0:
        print(f"{kind}{'n' if NORM else ''} seed={seed} step={step} val_bpc={evaluate():.4f} sec/step={(time.time()-t0)/step:.3f}", flush=True)
torch.save(model.state_dict(), f"ckpt_{kind}{'n' if NORM else ''}_{seed}_{steps}.pt")
