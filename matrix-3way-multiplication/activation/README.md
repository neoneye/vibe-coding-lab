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
