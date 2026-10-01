# Triangle-shaped weights in a tiny language model

Idea: store weights on a triangular lattice, cells (i, j, k) with i + j + k = n − 1. Every cell lies on three
lines (0°, 60°, 120°), so one read of the weights can be swept three ways:

    y0[i] = Σ W·h_j·h_k,   y1[j] = Σ W·h_i·h_k,   y2[k] = Σ W·h_i·h_j

Together these are the gradient of the cubic energy Σ W_ijk h_i h_j h_k: a multiplicative (gating-like) layer
with n²/2 weights. A matrix entry lies on only two lines (row and column).

Experiment (`triangle_ffn.py`): a 2-layer, width-64 character-level transformer trained on the repo's
markdown (2.8 MB) for 1,500 steps on CPU. Only the feed-forward block differs, and all variants have ≈65.5k
feed-forward parameters.

| feed-forward block | val bits/char |
|---|---|
| MLP (GELU, 64→256→64) | 3.389 (seeds 3.394, 3.383) |
| triangle, three sweeps (n = 106) | 3.374 (3.374, 3.373) |
| triangle, one sweep (n = 158) | 3.344 (one seed) |
| SwiGLU (bilinear gate) | **3.325** (3.323, 3.327) |

* Triangle layers work: both beat the plain MLP at equal parameters.
* The standard multiplicative baseline (SwiGLU) is still best.
* **Three sweeps did not beat one sweep per parameter.** Each extra direction needs its own output projection (3n·d instead of n·d), so at a fixed budget tri3 must use a smaller triangle (n = 106 vs 158).
* What three sweeps do buy is **weight reuse**:
  - a triangle weight serves 6 multiplications per read (3 sweeps × 2), against 1 for an ordinary matrix weight;
  - batch-1 LLM decoding is limited by memory bandwidth, so that ratio is what matters there.
  - Whether it pays off needs a fused GPU kernel. This CPU implementation (gather + scatter) runs 25× slower per step than the MLP, an implementation artefact rather than the arithmetic.
* Caveats: tiny model, short training, CPU, one seed for tri1. This is a smoke test, not a scaling result.

Related, with the triangle over tokens or pairs rather than weights:
- AlphaFold's triangle multiplicative updates (pair (i,j) updated from both other edges of each triangle, swept "outgoing" and "incoming");
- 2-simplicial attention (Roy et al. 2025, *Fast and Simplex*), a trilinear attention over triangles of tokens that improves token efficiency on maths, code and reasoning.
