"""Triangle-shaped weight layers in a tiny language model: wrap-around or not, unscaled or with the
heavily-used ("centre") outputs turned down. Same 2-layer, width-64 character model as the earlier experiments in
../matrix-polygon-shapes/llm, so the numbers are comparable.

Triangle layer: h = A·x (n units); weights W on cells (i, j, k), swept at 0°, 60° and 120°:
    y0[i] = Σ W·h_j·h_k,  y1[j] = Σ W·h_i·h_k,  y2[k] = Σ W·h_i·h_j,   then B·[y0, y1, y2]
  no wrap: cells with i + j + k = n − 1 (n(n+1)/2 weights). The line at index i holds n − i weights, so output i
           collects n − i products: long lines are the triangle's "centre", short lines its edge.
  wrap:    cells with i + j + k ≡ n − 1 (mod n) (n² weights, a torus); every line holds n weights.
  scaled:  every output is multiplied by (products it collects)^−½, so long-line outputs are turned down and the
           length-1 lines keep full weight. With wrap all lines are equal, so scaling is a constant there.
  triSN:   scaled, then renormalised to average 1, so only the balance between lines changes (not the overall size).
Usage: python tiny.py tri|triS|triSN|triW|triWS seed steps [save]"""
import sys, glob, math, time, torch, torch.nn as nn, torch.nn.functional as F
torch.set_num_threads(1)
variant, seed, steps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
torch.manual_seed(seed)
D, LAYERS, HEADS, CTX, BATCH, LR = 64, 2, 4, 64, 32, 3e-3
paths = sorted(glob.glob("../**/*.md", recursive=True))
paths = [p for p in paths if "/shape-llm/" not in p]                       # same corpus as the earlier experiments
text = "".join(open(p, encoding="utf-8", errors="ignore").read() for p in paths)
chars = sorted(set(text)); common = [c for c in chars if text.count(c) > 200] if len(chars) > 120 else chars
stoi = {c: i for i, c in enumerate(common)}; UNK = len(common); V = UNK + 1
data = torch.tensor([stoi.get(c, UNK) for c in text], dtype=torch.long)
n_val = len(data) // 10; train, val = data[:-n_val], data[-n_val:]
def batch(src, g):
    ix = torch.randint(len(src) - CTX - 1, (BATCH,), generator=g)
    return torch.stack([src[i:i + CTX] for i in ix]), torch.stack([src[i + 1:i + CTX + 1] for i in ix])

class Triangle(nn.Module):
    def __init__(s, n, wrap, scaled, renorm=False):
        super().__init__(); s.n = n
        cells = [(i, j, (n - 1 - i - j) % n) for i in range(n) for j in range(n)] if wrap else \
                [(i, j, n - 1 - i - j) for i in range(n) for j in range(n - i)]
        I, J, K = (torch.tensor(c) for c in zip(*cells))
        s.register_buffer("I", I); s.register_buffer("J", J); s.register_buffer("K", K)
        fan = torch.stack([torch.bincount(t, minlength=n).float() for t in (I, J, K)])   # products per output, per sweep
        s.register_buffer("fanin", fan.flatten())
        sc = fan.flatten().clamp(min=1) ** -0.5 if scaled else torch.ones(3 * n)
        if renorm: sc = sc / sc.mean()                                      # redistribute only: average weight stays 1
        s.register_buffer("scale", sc)
        s.W = nn.Parameter(torch.randn(len(cells)) / n)
        s.a = nn.Linear(D, n, bias=False); s.b = nn.Linear(3 * n, D, bias=False)
        s.keep = None                                                       # optional mask over the 3n outputs
    def forward(s, x):
        h = s.a(x); hi, hj, hk = h[..., s.I], h[..., s.J], h[..., s.K]
        y = torch.cat([torch.zeros_like(h).index_add_(-1, t, s.W * p) for t, p in [(s.I, hj * hk), (s.J, hi * hk), (s.K, hi * hj)]], -1)
        y = y * s.scale
        if s.keep is not None: y = y * s.keep
        return s.b(y)
def make_ffn():
    return {"tri": lambda: Triangle(106, False, False), "triS": lambda: Triangle(106, False, True),
            "triW": lambda: Triangle(94, True, False), "triWS": lambda: Triangle(94, True, True),
            "triSN": lambda: Triangle(106, False, True, renorm=True)}[variant]()

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

if __name__ == "__main__":
    model = LM(); ffn_params = sum(p.numel() for b in model.blocks for p in b.ffn.parameters())
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=LR, total_steps=steps, pct_start=0.1)
    g = torch.Generator().manual_seed(seed); gv = torch.Generator().manual_seed(1234)
    @torch.no_grad()
    def evaluate(n=40):
        model.eval(); tot = 0.0
        for _ in range(n): x, y = batch(val, gv); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
        model.train(); return tot / n / math.log(2)
    t0 = time.time()
    for step in range(1, steps + 1):
        x, y = batch(train, g); loss = F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1))
        opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); sched.step()
        if step % (steps // 5) == 0:
            print(f"{variant} seed={seed} step={step} val_bpc={evaluate():.4f} ffn_params={ffn_params} sec/step={(time.time()-t0)/step:.3f}", flush=True)
    if len(sys.argv) > 4: torch.save(model.state_dict(), f"ckpt_tiny_{variant}_{seed}_{steps}.pt")
