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
import os, sys, glob, math, time, random, torch, torch.nn as nn, torch.nn.functional as F
from hexgrid import cells, neighbours, bottleneck
torch.set_num_threads(int(os.environ.get("SHAPE_THREADS", 2)))

kind, seed, steps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
EVALS = int(sys.argv[4]) if len(sys.argv) > 4 else 5          # how many validation points to log
SWEEPS = "all"                                                     # triangle sweeps per training step: all 3, or 2 of 3
for suf in ("-rot", "-rnd"):                                       # -rot: skip direction (i+2) % 3 at step i; -rnd: skip a random one
    if kind.endswith(suf): SWEEPS, kind = suf[1:], kind[:-len(suf)]
TAG = kind + ("" if SWEEPS == "all" else "-" + SWEEPS)
THRU = kind.startswith("matstair") and kind.endswith("c")          # "matstair…c": the staircases pass through the output cell
if THRU: kind = kind[:-1]
SWEEP = {"drop": None, "boost": 1.0}                               # set per step by the training loop; eval uses all three sweeps
NORM = kind == "hex2n"
if NORM: kind = "hex2"                                             # same model as hex2, plus neighbour-count normalisation
TRI = kind in ("tri", "triS", "triSN", "triW", "triWS", "triR", "triRN")   # triangle feed-forwards inside the hexagonal pyramid
TRI_WRAP, TRI_SCALED = kind in ("triW", "triWS"), kind in ("triS", "triSN", "triWS")
TRI_RENORM, TRI_REVERSE = kind in ("triSN", "triRN"), kind in ("triR", "triRN")
SQ = kind in ("sq4", "sq4c")                                       # square torus swept along rows, columns and both diagonals
import re
MAT_XY = re.fullmatch(r"matoff(\d)(\d)", kind)                      # "matoffAB": two states, (0,0) and (x+A, y+B) on odd iterations
MAT = kind in ("mat", "matoff", "matoff3", "matoff4", "matstair", "matstairfix", "matstair3", "matstair18", "matstair18fix", "matstair32", "matq", "matqr") or bool(MAT_XY)
QMODE = {"matq": "both", "matqr": "row"}.get(kind)                 # sparse "queens" product instead of the full matrix product
def queens_pool(m, want=200, rng_seed=0):
    """random m-queens placements (one cell per row and per column, no shared diagonal), enough of them to cover every cell."""
    import random; r = random.Random(rng_seed); pool, seen, cover = [], set(), set()
    def place(row, cols, d1, d2, acc):
        if row == m: return acc[:]
        order = list(range(m)); r.shuffle(order)
        for c in order:
            if c in cols or row - c in d1 or row + c in d2: continue
            acc.append(c); got = place(row + 1, cols | {c}, d1 | {row - c}, d2 | {row + c}, acc)
            if got: return got
            acc.pop()
    while len(pool) < want or len(cover) < m * m:
        q = tuple(place(0, frozenset(), frozenset(), frozenset(), []))
        if q not in seen: seen.add(q); pool.append(q); cover |= {(y, c) for y, c in enumerate(q)}
    return torch.tensor(pool)
QSTATE = {"rng": None, "fixed": None}                              # which placement to use: a seeded random one, or a fixed index                                    # feed-forward = ordinary matrix product M·M of a projected m × m matrix
STAIR_RUN = 3 if kind in ("matstair18", "matstair18fix", "matstair32") else 2   # cells along per step: 2 → 26.565°, 3 → 18.435°
STAIR_RISE = 2 if kind == "matstair32" else 1                      # cells across per step; 3 along + 2 across → 33.69° (the path skips a cell when it steps)
MAT_M = [10, 11, 13]                                               # matrix side per level (≈ the triangle's feed-forward budget)
MATSTEP = {"it": 0}                                                # training iteration, set by the training loop; evaluation uses 0 (no offset)
SQ_N = [41, 53, 67]                                                # odd sides, chosen to match the wrapped triangle's parameter count
TRI_N = [50, 65, 85]                                               # triangle side per level (≈ the hex2 feed-forward budget)
torch.manual_seed(seed)
CTX, BATCH, LR = 64, 16, 1e-3

paths = [p for p in sorted(glob.glob("../**/*.md", recursive=True)) if "/shape-llm/" not in p]   # not our own write-ups
text = "".join(open(p, encoding="utf-8", errors="ignore").read() for p in paths)
if os.environ.get("SHAPE_CORPUS"): text = open(os.environ["SHAPE_CORPUS"], encoding="utf-8").read()   # frozen text, so later batches match earlier ones
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
        sweeps = [(s.I, lambda: hj * hk), (s.J, lambda: hi * hk), (s.K, lambda: hi * hj)]      # the 0°, 60° and 120° sweeps
        y = torch.cat([torch.zeros_like(h) if d == SWEEP["drop"] else torch.zeros_like(h).index_add_(-1, t, s.W * f())
                       for d, (t, f) in enumerate(sweeps)], -1)
        return s.b(y * s.scale * SWEEP["boost"]) if SWEEP["boost"] != 1.0 else s.b(y * s.scale)

class SqFFN(nn.Module):
    """n × n weights on a torus (n odd), swept along 4 directions: rows i, columns j, diagonals k = n−1−i−j and l = i−j (mod n).
    The first three are exactly the wrapped triangle; l is the extra diagonal. Every cell lies on one line of each direction.
    Each line's output sums W × (features of the cell's other three lines): their three pairwise products ("sq4"),
    or their triple product ("sq4c"). 2 directions would be a plain matrix, 3 the triangle."""
    def __init__(s, D, n, cubic):
        super().__init__(); s.cubic = cubic
        cells = [(i, j, (n - 1 - i - j) % n, (i - j) % n) for i in range(n) for j in range(n)]
        for name, t in zip("IJKL", zip(*cells)): s.register_buffer(name, torch.tensor(t))
        s.W = nn.Parameter(torch.randn(len(cells)) / n); s.a = nn.Linear(D, n, bias=False); s.b = nn.Linear(4 * n, D, bias=False)
    def forward(s, x):
        h = s.a(x); idx = [s.I, s.J, s.K, s.L]; f = [h[..., t] for t in idx]
        if s.cubic: others = [f[1] * f[2] * f[3], f[0] * f[2] * f[3], f[0] * f[1] * f[3], f[0] * f[1] * f[2]]
        else:
            p = {(a, b): f[a] * f[b] for a in range(4) for b in range(a + 1, 4)}
            others = [(p[1, 2] + p[1, 3] + p[2, 3]), (p[0, 2] + p[0, 3] + p[2, 3]), (p[0, 1] + p[0, 3] + p[1, 3]), (p[0, 1] + p[0, 2] + p[1, 2])]
            others = [o * 3 ** -0.5 for o in others]                     # three products per cell: keep the triangle's output size
        return s.b(torch.cat([torch.zeros_like(h).index_add_(-1, t, s.W * o) for t, o in zip(idx, others)], -1))

class MatFFN(nn.Module):
    """M = a(x) as an m × m matrix; the output cell [x, y] is the usual product: row y of M times column x of M.
    With offset (blocks 1–2 of "matoff") the cell [x, y] is instead computed from row (y + yoffset) and column (x + xoffset),
    wrapped; the destination cell is not displaced. "matoff": xoffset = (iteration*2)&2, yoffset = iteration&1 (two states);
    "matoff4": xoffset = (iteration>>1)&1, yoffset = iteration&1 (the four states (0,0), (0,1), (1,0), (1,1) in turn);
    "matoffAB" (e.g. matoff11, matoff22): two states, no offset on even iterations and (x+A, y+B) on odd ones;
    "matoff3": three states in turn, (0,0), (x+1, y+1), (x+2, y+2), i.e. xoffset = yoffset = iteration % 3.
    "matstair" (blocks 1–2): the row and the column are followed as staircases, 2 cells along and 1 across (26.565°), wrapped:
    cell [x, y] = Σ_k M[y + s·⌊k/2⌋, k] · M[k, x − s·⌊k/2⌋], with s = +1 on even iterations and −1 on odd ones
    (both paths turned by the same angle, so they stay perpendicular). "matstairfix": the same with s = +1 always.
    "matstair3": three states in turn, s = −1, 0, +1 (iteration % 3), where 0 is the plain straight product.
    "matstair18": the two-state staircase with 3 cells along per 1 across (⌊k/3⌋ instead of ⌊k/2⌋), i.e. ±18.435°. "matstair18fix": that staircase with s = +1 always.
    "matstair32": two states, 3 cells along then 2 across (2·⌊k/3⌋), i.e. ±33.69°; still one cell per k.
    With a trailing "c" (matstairc, matstair18c, …) each path is the staircase of its family that passes through the output cell:
    cell [x, y] = Σ_k M[y + s·(f(k) − f(x)), k] · M[k, x − s·(f(k) − f(y))], f(k) = rise·⌊k/run⌋ (without the "c" the paths start at the edge)."""
    def __init__(s, D, m, offset):
        super().__init__(); s.m, s.offset = m, offset; s.a = nn.Linear(D, m * m, bias=False); s.b = nn.Linear(m * m, D, bias=False)
        if QMODE: s.register_buffer("pool", queens_pool(m), persistent=False)
        if offset in ("stair", "stairfix", "stair3"):                 # index tables for the two tilts, s = +1 and s = −1
            k, c = torch.arange(m), torch.arange(m)
            for name, sg in (("p", 1), ("n", -1)):
                s.register_buffer("ri" + name, (c[:, None] + sg * STAIR_RISE * (k[None, :] // STAIR_RUN)) % m, persistent=False)   # [y, k] → row index
                s.register_buffer("ci" + name, (c[None, :] - sg * STAIR_RISE * (k[:, None] // STAIR_RUN)) % m, persistent=False)   # [k, x] → column index
                fk = STAIR_RISE * (c // STAIR_RUN)                    # through the output cell: read the edge-anchored result at [y − s·f(x), x + s·f(y)]
                s.register_buffer("t" + name, ((c[:, None] - sg * fk[None, :]) % m) * m + (c[None, :] + sg * fk[:, None]) % m, persistent=False)
    def forward(s, x):
        M = s.a(x).view(*x.shape[:-1], s.m, s.m); it = MATSTEP["it"] if s.offset else 0
        if QMODE:                                                     # p[y] = the one picked column of row y
            p = s.pool[QSTATE["fixed"] if QSTATE["fixed"] is not None else QSTATE["rng"].randrange(len(s.pool))]
            v = M.gather(-1, p.expand(*M.shape[:-2], s.m).unsqueeze(-1)).squeeze(-1)      # the m picked values M[y, p[y]]
            if QMODE == "row": Y = v.unsqueeze(-1) * M[..., p, :]     # cell [x, y] = M[y, p[y]] · M[p[y], x]: m² products
            else:                                                     # both sides masked: m products, m non-zero cells
                Y = torch.zeros_like(M); Y[..., torch.arange(s.m), p[p]] = v * v[..., p]
            return s.b(Y.flatten(-2))
        if s.offset == "stair3" and it % 3 == 1: return s.b((M @ M).flatten(-2) * s.m ** -0.5)     # the 0° state: straight rows and columns
        if s.offset in ("stair", "stairfix", "stair3"):
            ri, ci = ((s.rin, s.cin) if it % 3 == 0 else (s.rip, s.cip)) if s.offset == "stair3" else (s.rip, s.cip) if it % 2 == 0 or s.offset == "stairfix" else (s.rin, s.cin)
            lead = M.shape[:-2]
            Y = (M.gather(-2, ri.expand(*lead, s.m, s.m)) @ M.gather(-1, ci.expand(*lead, s.m, s.m))).flatten(-2)
            if THRU: Y = Y[..., (s.tp if ri is s.rip else s.tn).flatten()]
            return s.b(Y * s.m ** -0.5)
        xo, yo = (it % 3, it % 3) if s.offset == 3 else ((it >> 1) & 1, it & 1) if s.offset == 4 else ((it & 1) * s.offset[0], (it & 1) * s.offset[1]) if isinstance(s.offset, tuple) else ((it * 2) & 2, it & 1)
        rows = torch.roll(M, -yo, -2) if yo else M                    # rows[y] = M[(y + yo) % m]
        cols = torch.roll(M, -xo, -1) if xo else M                    # cols[:, x] = M[:, (x + xo) % m]
        return s.b((rows @ cols).flatten(-2) * s.m ** -0.5)

class Block(nn.Module):
    def __init__(s, D, ffn):
        A = 48 if (kind == "hex2" or TRI or SQ or MAT) else 128
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
            if MAT:
                layers += [Block(D, MatFFN(D, MAT_M[li], ("stair" if kind in ("matstair", "matstair18", "matstair32") else "stairfix" if kind in ("matstairfix", "matstair18fix") else "stair3" if kind == "matstair3" else 4 if kind == "matoff4" else 3 if kind == "matoff3" else (int(MAT_XY[1]), int(MAT_XY[2])) if MAT_XY else kind == "matoff") if li == 0 else False)) for _ in range(2)]
            elif SQ:
                layers += [Block(D, SqFFN(D, SQ_N[li], kind == "sq4c")) for _ in range(2)]
            elif TRI:
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
if kind in ("hex", "hex2") or TRI or SQ or MAT: model = HexLM()
else:                                                               # match the hex model's parameter count
    if kind == "base2": kind = "hex2"; target = count(HexLM()); kind = "base2"   # match the locally connected version
    else: target = count(HexLM())
    D = 64
    while count(BaseLM(D + 8)) <= target: D += 8
    model = BaseLM(D)
print(f"{TAG}: {count(model):,} parameters", flush=True)

opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=LR, total_steps=steps, pct_start=0.1)
g, gv = torch.Generator().manual_seed(seed), torch.Generator().manual_seed(1234)
@torch.no_grad()
def evaluate(n=40):
    model.eval(); tot = 0.0; gv.manual_seed(1234); keep = QSTATE["rng"]; QSTATE["rng"] = random.Random(1234)
    for _ in range(n): x, y = batch(val, gv); tot += F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1)).item()
    QSTATE["rng"] = keep; model.train(); return tot / n / math.log(2)
rnd = random.Random(seed); QSTATE["rng"] = random.Random(seed)
t0 = time.time()
for step in range(1, steps + 1):
    if SWEEPS != "all":                                            # 2 of 3 sweeps, scaled 3/2 like dropout so all 3 match at eval
        SWEEP["drop"], SWEEP["boost"] = ((step + 2) % 3 if SWEEPS == "rot" else rnd.randrange(3)), 1.5
    MATSTEP["it"] = step - 1                                        # iteration 0 has no offset
    x, y = batch(train, g); loss = F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1))
    opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); sched.step()
    SWEEP["drop"], SWEEP["boost"] = None, 1.0; MATSTEP["it"] = 0
    if step % (steps // EVALS) == 0:
        print(f"{TAG}{'n' if NORM else ''} seed={seed} step={step} val_bpc={evaluate():.4f} sec/step={(time.time()-t0)/step:.3f}", flush=True)
if kind == "matoff":                                                # the headline evaluation uses no offset; also evaluate with the odd-iteration offset
    MATSTEP["it"] = 1; v = evaluate(); MATSTEP["it"] = 0
    print(f"{TAG} seed={seed} offset_eval x+2,y+1: {v:.4f}", flush=True)
if QMODE:                                                           # the headline evaluation draws random placements; also try three fixed ones
    vs = []
    for i in range(3): QSTATE["fixed"] = i; vs.append(evaluate())
    QSTATE["fixed"] = None
    print(f"{TAG} seed={seed} fixed_mask_eval: " + " ".join(f"{v:.4f}" for v in vs), flush=True)
if MAT_XY:
    MATSTEP["it"] = 1; v = evaluate(); MATSTEP["it"] = 0
    print(f"{TAG} seed={seed} offset_eval x+{MAT_XY[1]},y+{MAT_XY[2]}: {v:.4f}", flush=True)
if kind in ("matstair", "matstair18", "matstair32"):                            # the headline evaluation uses the + tilt; also the − one
    MATSTEP["it"] = 1; v = evaluate(); MATSTEP["it"] = 0
    print(f"{TAG} seed={seed} tilt_eval minus: {v:.4f}", flush=True)
if kind == "matstair3":                                             # the headline evaluation uses iteration 0's state (−26.5°); also the other two
    vs = []
    for it in (1, 2): MATSTEP["it"] = it; vs.append(evaluate())
    MATSTEP["it"] = 0
    print(f"{TAG} seed={seed} tilt_eval 0deg +26.5deg: " + " ".join(f"{v:.4f}" for v in vs), flush=True)
if kind == "matoff3":
    vs = []
    for it in (1, 2): MATSTEP["it"] = it; vs.append(evaluate())
    MATSTEP["it"] = 0
    print(f"{TAG} seed={seed} offset_eval (x+1,y+1) (x+2,y+2): " + " ".join(f"{v:.4f}" for v in vs), flush=True)
if kind == "matoff4":                                               # ... and with each of the other three states of the cycle
    vs = []
    for it in (1, 2, 3): MATSTEP["it"] = it; vs.append(evaluate())
    MATSTEP["it"] = 0
    print(f"{TAG} seed={seed} offset_eval (x+0,y+1) (x+1,y+0) (x+1,y+1): " + " ".join(f"{v:.4f}" for v in vs), flush=True)
if TRI:                                                             # also evaluate with only 2 of the 3 sweeps (cheaper inference)
    pair = []
    for d in range(3):
        SWEEP["drop"], SWEEP["boost"] = d, 1.5; pair.append(evaluate())
    SWEEP["drop"], SWEEP["boost"] = None, 1.0
    print(f"{TAG} seed={seed} two_sweep_eval " + " ".join(f"skip{d}={v:.4f}" for d, v in enumerate(pair)) + f" mean={sum(pair) / 3:.4f}", flush=True)
torch.save(model.state_dict(), f"ckpt_{TAG}{'n' if NORM else ''}_{seed}_{steps}.pt")
