# EML experiment: is `x·y·z` cheaper as one tree than as two multiplications?

EML (Odrzywołek, [arXiv:2603.21852](https://arxiv.org/abs/2603.21852)):
`eml(a,b) = exp(a) − ln(b)`, over ℂ with the principal branch. Terminals are `1` and the input
variables. Size K is the RPN length (leaves + nodes). The idea being tested: search
*directly* for a tree computing `x·y·z` instead of composing `mul(mul(x,y),z)`.

## Search (`eml_search.py`)

* Bottom-up enumeration of all distinct functions up to size `kmax`, deduplicated by numeric
  fingerprint (values at 4 generic points, positive and negative). This is the paper's numeric sieve.
* Extended reals are allowed (`ln 0 = −∞`, `exp(−∞) = 0`, env `EML_EXT=1`). The paper's
  shortest `−x`, `1/x` need them. Complex `exp` is kept real on the real axis, because
  NumPy returns `exp(∞+0i) = ∞+NaN·i`.
* The root is matched with a hash lookup: `T = exp(a) − ln b ⇔ b = exp(exp(a) − T)` when
  `Im ∈ (−π, π]`. Lopsided roots are inverted recursively, e.g. `exp(·) = eml(·,1)`.
  Inverting `exp` leaves a `2πik` ambiguity *per sample point*.
* Every hit is re-verified at 4 fresh points.

Reproduces the paper's direct-search values (Table 4): `x−y` 11, `x−1` 11, `x+1` 19,
`−x` 15, `1/x` 15, `x²` 17, `x·y` 17.

## Result: products of n variables cost 8n+1, not 16(n−1)+1

The paper's 17-token `x·y`, `1 1 1 1 x E E 1 E E y E 1 E E 1 E`, is a log-domain accumulator:

    s1 = eml(1, x)            = e − ln x
    s2 = eml(ln s1, y)        = s1 − ln y            (ln u = eml(1, eml(eml(1,u),1)), 6 extra tokens)
    x·y = exp(e − s2)         = exp(ln x + ln y)

Each extra factor is one more `s ← eml(ln s, v)` (8 tokens). Verified by `products.py`:

| target | composed from `mul` | direct tree |
|---|---|---|
| x·y | 17 | 17 |
| x·y·z | 33 | **25** |
| x·y·z·w | 49 | **33** |

So yes, the 3-way tree is much shorter than the composition, which is what the pasted note predicted.
Whether anything below 25 exists for x·y·z is only partially searched: all trees up to K=13 were
enumerated, root matching was complete for children ≤ 11, and inversion only went through a leaf.

## Why this does not bear on "13 instead of 14 multiplications"

The saving is exactly the classical log-table trick: `xyz = exp(ln x + ln y + ln z)`. The
composed version pays for a pointless `exp` then `ln` round-trip between the two factors. The EML
tree contains **no multiplications at all**; in EML, multiplication is cheap and **addition is
expensive** (`x+y` needs 19 against 17 for `x·y`). Translating the tree back into ordinary arithmetic gives 0
`*` gates, so it says nothing about scalar-multiplication counts.

For the matrix problem the EML cost model inverts the usual ranking. Each entry of `ABC` is a
sum of four triple products (`aei + bgi + afk + bhk`). Products are nearly free in log space, and the
cost is the additions and the exp/log crossings between the two domains. Under that model
Strassen (18 additions per 2×2 product) is *worse* than the naive chain, and the natural
3-way question becomes "fewest additions/domain crossings", not fewest multiplications.
