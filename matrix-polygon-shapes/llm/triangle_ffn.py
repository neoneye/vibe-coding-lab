"""Triangle-shaped weights in a tiny language model.

A triangle layer stores weights on a triangular lattice: cells (i, j, k) with i + j + k = n − 1, n(n+1)/2 weights.
Each cell lies on three lines (0°, 60°, 120°). Sweeping along each direction gives three outputs from one read
of the weights:
    y0[i] = Σ_{cells} W·h_j·h_k,   y1[j] = Σ W·h_i·h_k,   y2[k] = Σ W·h_i·h_j
(together: the gradient of the cubic energy Σ W_ijk h_i h_j h_k). The feed-forward block of a small
character-level transformer is replaced by  x → h = A·x → [y0, y1, y2] → B·[...]  and compared, at equal
parameter count, with a GELU MLP, a SwiGLU block and a one-sweep triangle.
Usage: python triangle_ffn.py variant seed steps"""
import sys, time, math, glob, torch, torch.nn as nn, torch.nn.functional as F
torch.set_num_threads(1)

variant, seed, steps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
torch.manual_seed(seed)
D, LAYERS, HEADS, CTX, BATCH, LR = 64, 2, 4, 64, 32, 3e-3

# ---------------- data: the repo's markdown, character level ----------------
paths = sorted(glob.glob("../../**/*.md", recursive=True))
text = "".join(open(p, encoding="utf-8", errors="ignore").read() for p in paths)
chars = sorted(set(text)); common = [c for c in chars if text.count(c) > 200] if len(chars) > 120 else chars
stoi = {c: i for i, c in enumerate(common)}; UNK = len(common); V = UNK + 1
data = torch.tensor([stoi.get(c, UNK) for c in text], dtype=torch.long)
n_val = len(data) // 10; train, val = data[:-n_val], data[-n_val:]
def batch(src, g, size=BATCH):
    ix = torch.randint(len(src) - CTX - 1, (size,), generator=g)
    return torch.stack([src[i:i + CTX] for i in ix]), torch.stack([src[i + 1:i + CTX + 1] for i in ix])

# ---------------- feed-forward variants ----------------
class MLP(nn.Module):
    def __init__(s): super().__init__(); s.a = nn.Linear(D, 4 * D, bias=False); s.b = nn.Linear(4 * D, D, bias=False)
    def forward(s, x): return s.b(F.gelu(s.a(x)))
class GLU(nn.Module):
    def __init__(s, h=171): super().__init__(); s.a = nn.Linear(D, h, bias=False); s.g = nn.Linear(D, h, bias=False); s.b = nn.Linear(h, D, bias=False)
    def forward(s, x): return s.b(F.silu(s.g(x)) * s.a(x))
class Triangle(nn.Module):
    def __init__(s, n, sweeps):
        super().__init__(); s.n, s.sweeps = n, sweeps
        cells = [(i, j, n - 1 - i - j) for i in range(n) for j in range(n - i)]
        I, J, K = (torch.tensor(c) for c in zip(*cells))
        s.register_buffer("I", I); s.register_buffer("J", J); s.register_buffer("K", K)
        s.W = nn.Parameter(torch.randn(len(cells)) / n)
        s.a = nn.Linear(D, n, bias=False); s.b = nn.Linear(sweeps * n, D, bias=False)
    def forward(s, x):
        h = s.a(x); hi, hj, hk = h[..., s.I], h[..., s.J], h[..., s.K]
        outs = []
        for target, p in [(s.I, hj * hk), (s.J, hi * hk), (s.K, hi * hj)][: s.sweeps]:
            outs.append(torch.zeros_like(h).index_add_(-1, target, s.W * p))
        return s.b(torch.cat(outs, -1))
class Cube(nn.Module):
    """full 3-way weight array W[i,j,k] (n³ weights), swept along its 3 axes: gradient of a cubic energy."""
    def __init__(s, n):
        super().__init__(); s.W = nn.Parameter(torch.randn(n, n, n) / n ** 1.5)
        s.a = nn.Linear(D, n, bias=False); s.b = nn.Linear(3 * n, D, bias=False)
    def forward(s, x):
        h = s.a(x)
        y0 = torch.einsum("ijk,...j,...k->...i", s.W, h, h)
        y1 = torch.einsum("ijk,...i,...k->...j", s.W, h, h)
        y2 = torch.einsum("ijk,...i,...j->...k", s.W, h, h)
        return s.b(torch.cat([y0, y1, y2], -1))
class Tetra(nn.Module):
    """weights on a tetrahedral lattice, cells (i,j,k,l) with i+j+k+l = n−1 (≈ n³/6 weights), swept along its
    4 face directions: y_a[m] = Σ_{cells with coordinate a = m} W · (product of the other three h's).
    Together: the gradient of a quartic energy. Each weight feeds 4 sweeps × 3 multiplications."""
    def __init__(s, n):
        super().__init__(); s.n = n
        cells = [(i, j, k, n - 1 - i - j - k) for i in range(n) for j in range(n - i) for k in range(n - i - j)]
        for name, col in zip("IJKL", zip(*cells)): s.register_buffer(name, torch.tensor(col))
        s.W = nn.Parameter(torch.randn(len(cells)) / n ** 2)
        s.a = nn.Linear(D, n, bias=False); s.b = nn.Linear(4 * n, D, bias=False)
    def forward(s, x):
        h = s.a(x); hi, hj, hk, hl = h[..., s.I], h[..., s.J], h[..., s.K], h[..., s.L]
        ij, kl = hi * hj, hk * hl
        outs = [torch.zeros_like(h).index_add_(-1, t, s.W * p) for t, p in [(s.I, hj * kl), (s.J, hi * kl), (s.K, ij * hl), (s.L, ij * hk)]]
        return s.b(torch.cat(outs, -1))
def make_ffn():
    return {"mlp": MLP, "glu": GLU, "tri1": lambda: Triangle(158, 1), "tri3": lambda: Triangle(106, 3),
            "cube3": lambda: Cube(29), "tet4": lambda: Tetra(46)}[variant]()
ACCUM = 4 if variant == "tet4" else 1          # micro-batches (same effective batch) to bound memory

class Block(nn.Module):
    def __init__(s):
        super().__init__(); s.n1 = nn.LayerNorm(D); s.att = nn.MultiheadAttention(D, HEADS, batch_first=True, bias=False); s.n2 = nn.LayerNorm(D); s.ffn = make_ffn()
        s.register_buffer("mask", torch.triu(torch.ones(CTX, CTX, dtype=torch.bool), 1))
    def forward(s, x):
        y = s.n1(x); x = x + s.att(y, y, y, attn_mask=s.mask, need_weights=False)[0]
        return x + s.ffn(s.n2(x))
class LM(nn.Module):
    def __init__(s):
        super().__init__(); s.emb = nn.Embedding(V, D); s.pos = nn.Embedding(CTX, D); s.blocks = nn.Sequential(*[Block() for _ in range(LAYERS)]); s.n = nn.LayerNorm(D); s.out = nn.Linear(D, V, bias=False)
    def forward(s, idx): return s.out(s.n(s.blocks(s.emb(idx) + s.pos(torch.arange(idx.shape[1])))))

model = LM()
ffn_params = sum(p.numel() for b in model.blocks for p in b.ffn.parameters())
opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=LR, total_steps=steps, pct_start=0.1)
g = torch.Generator().manual_seed(seed); gv = torch.Generator().manual_seed(1234)
@torch.no_grad()
def evaluate(n=40):
    model.eval(); tot = 0.0
    for _ in range(n):
        x, y = batch(val, gv)
        tot += sum(F.cross_entropy(model(xm).reshape(-1, V), ym.reshape(-1)).item() for xm, ym in zip(x.chunk(ACCUM), y.chunk(ACCUM))) / ACCUM
    model.train(); return tot / n / math.log(2)
t0 = time.time()
for step in range(1, steps + 1):
    x, y = batch(train, g)
    opt.zero_grad()
    for xm, ym in zip(x.chunk(ACCUM), y.chunk(ACCUM)):
        (F.cross_entropy(model(xm).reshape(-1, V), ym.reshape(-1)) / ACCUM).backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); sched.step()
    if step % (steps // 5) == 0 or step == steps:
        print(f"{variant} seed={seed} step={step} val_bpc={evaluate():.4f} ffn_params={ffn_params} sec/step={(time.time()-t0)/step:.3f}", flush=True)
