# Activation-aware A·B·C: decide saturated outputs cheaply, refine the rest

Goal: compute `Y = f(A·B·C + β)` for an activation f. If a cheap, low-precision estimate plus a
**rigorous** error bound shows that f is flat over the whole uncertainty interval (sign doesn't
change, ReLU stays ≤ 0, hardtanh or sigmoid is saturated), the output is decided without full
precision. Only the undecided entries get a deeper (more bits) multiplication.

Cost model: multiplying a p-bit by a q-bit number costs p·q bit operations. Inputs are 16-bit
fixed point. The exact chain costs 3·N³·16² (A·B at 16×16 bits, then ·C at 32×16). Run
`node cascade.mjs` for the self-tests (minimum-cover optimality by brute force; zero wrong decisions in
rigorous mode) and the experiments.

## 1. Cascade over the whole chain: costs *more* than computing exactly

Round A, B, C to b bits and bound `|ABC − ÃB̃C̃|` by the exact seven-term expansion of
`(A−ΔA)(B−ΔB)(C−ΔC)`. Evaluate undecided entries through rows of ÃB̃ or columns of B̃C̃, choosing
the fewest such lines by a minimum vertex cover (König's theorem).

Result at N = 32: **107–181 % of the exact chain**, never a wrong decision. Two three-way reasons:

* refining one entry of A·B·C needs a whole row of A·B or column of B·C (≈ N² work, not N), and
  the undecided entries touch almost every row and column;
* the worst-case bound accumulates error through B·C (∝ N²·δ, while outputs are ∝ N); it is
  ~30× pessimistic. Shrinking it by γ = 0.03 ("predictive", SeerNet-style) made no wrong decisions
  on this data and cost 66 %, but without a guarantee.

## 2. Hybrid: exact middle product, cascade on the last one: up to 48 % saved, guaranteed

Compute `P = B·C` exactly (a fixed third of the chain), then cascade on `A·P`. Here an entry is one
dot product, and the bound `δA·Σ|P_jl| + δP·Σ|A_ij| + δAδP·N` does not compound through B·C.

| activation (N = 32, one 8-bit pass) | cost vs exact chain | decided at 8 bits |
|---|---|---|
| sign | **52 %** | 927 / 1024 |
| hardtanh | 60 % | 809 |
| sigmoid, gain 4, ε = 0.01 | 60 % | 814 |
| ReLU, bias −4 | 65 % | 725 |
| ReLU, bias 0 | 81 % | 482 (only negatives; positives need exact values) |

* Floor: 33 % (the exact B·C).
* **One well-chosen level beats several:** a 4-bit pass decides almost nothing and only adds cost.
* **Precision has to grow with N** (the relative bound grows ≈ √N). Sign at N = 16 / 32 / 64 is cheapest at 8 / 8–10 / 10 bits (53 / 51 / 52 %).

## Prior work

For a single matrix product this is established: SnaPEA (ISCA 2018, exact and predictive early
exit for ReLU), SeerNet (CVPR 2019, low-bit prediction of ReLU sparsity), Precision Gating
(ICLR 2020, low precision first, high precision where it matters), ComPreEND (early negative
detection). New here: the three-factor case, the strict bound, the row/column cover, and the finding
that the cascade belongs on the last product, not the whole chain.

## 3. Picking terms at random instead of lowering precision

`sampling.mjs` estimates each output from randomly chosen terms (without replacement) and decides
with either a strict Hoeffding–Serfling bound or an empirical normal-approximation bound. Cost here
is multiplications; the exact chain is 2N³.

* *hybrid*: exact B·C, then sample j for each output. Its worst case equals the exact chain.
* *triple*: sample (j,k) pairs directly with no intermediate (2 multiplications per sample), then refine via the minimum cover.

| data (N = 32) | strict bound | empirical bound |
|---|---|---|
| signed | never decides anything (100% / 200%) | 95–99%, a few wrong decisions |
| nonnegative | never decides | 91–97% (hybrid), wrong decisions |
| sparse heavy-tailed | never decides | 38–72%, **hundreds of wrong decisions** (early samples are all zero, so the sample spread looks like 0) |

Why: to decide an output, the sampling error must be smaller than its distance to the threshold. With
the threshold inside the bulk, that distance is about the spread of the outputs, which partial samples
cannot beat. **To decide which side of a threshold a sum lands, it is better to see every term a little
(low precision) than some terms fully (sampling).**

### Random walks through A → B → C (`walks.mjs`)

For nonnegative matrices, a three-step random walk i → j → k → l lands on output l with probability
exactly D_il / Σ_l D_il. That holds if each step is weighted by the rest of the chain:
j ∝ A_ij·(B·C·1)_j, k ∝ B_jk·(C·1)_k, l ∝ C_kl (Cohen–Lewis, extended to three factors). Setup costs
5N² multiplications. Visit counts then give a guaranteed Hoeffding bound with no further multiplications.

| data | threshold | walks / row | multiplications vs exact | undecided |
|---|---|---|---|---|
| sparse heavy-tailed, N = 32 | top 1% | 4,096 | **24%** | 38 / 1,024 |
| same | top 1% | 65,536 | **16%** | 9 |
| same | top 10% | 65,536 | 47% | 92 |
| same, N = 64 | top 1% | 65,536 | 30% | 269 |
| dense nonnegative | any | any | 70–108% | most |

Zero wrong decisions throughout. The catch: walks replace multiplications with random draws (about
393,000 draws at N = 32, s = 4,096, against 65,536 multiplications for the exact chain). They pay only
when a multiplication is much more expensive than a random index, for nonnegative, heavy-tailed data,
and when the question is "which few outputs are large" (Cohen–Lewis 1999; diamond sampling, Ballard,
Kolda, Pinar, Seshadhri 2015).
