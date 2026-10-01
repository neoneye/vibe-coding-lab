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

## 3D shapes: cube and tetrahedron

* **Cube** W[i,j,k]: a full 3-way weight array (n³ weights). It has 3 sweep directions (its axes) with 2 inputs multiplied per sweep, so 6 multiplications per weight read. The triangle is its diagonal slice i + j + k = n − 1.
* **Tetrahedron**: cells (i,j,k,l) with i + j + k + l = n − 1 (≈ n³/6 weights). Its 4 sweep directions are the face directions; each collapses a triangular slice and multiplies 3 inputs, so **12 multiplications per weight read**. Together the sweeps are the gradient of a quartic energy.
* General d-simplex: d + 1 sweeps, d(d+1) multiplications per weight read, n^d/d! weights.

Same tiny LM, ≈65.5k feed-forward parameters (cube n = 29, tetrahedron n = 46), validation bits/char:

| feed-forward | 500 steps (2 seeds) | 1,500 steps |
|---|---|---|
| MLP | 3.972 (3.956, 3.987) | 3.389 |
| triangle, 3 sweeps | 3.965 (3.953, 3.978) | 3.374 |
| tetrahedron, 4 sweeps | 3.966 (3.951, 3.981) | — (3.6 s/step on CPU) |
| cube, 3 sweeps | 3.963 (3.943, 3.983) | **3.350** (3.348, 3.353) |
| SwiGLU | 3.971 (3.972, 3.970) | **3.325** |

* At 500 steps all five are within seed noise (spread ±0.02): too early to separate.
* At 1,500 steps:
  - the cube is second best, behind SwiGLU and ahead of the three-sweep triangle and the MLP;
  - the full 3-way array (cube) beats its diagonal slice (triangle) at equal parameters;
  - the cube computes as fast dense einsums, 0.11 s/step vs 0.89 for the triangle in this implementation.
* The tetrahedron (quartic interactions, 12× weight reuse) could not be trained long enough on CPU (3.6 s/step) to tell; at 500 steps it ties.

## Fewer bits? Quantisation of shaped weights (`quant_eval.py`, `mixed_eval.py`)

Post-training round-to-nearest quantisation (symmetric, per tensor) of the feed-forward weights. Changes are in
validation bits/char, mean of 2 seeds; the gated block is the SwiGLU-style feed-forward (silu gate × linear, then a projection).

**Everything at the same bit width:** no precision bonus. At 3–4 bits the triangle and cube layers degrade a little
*faster* (3 bits: MLP +0.30, gated +0.27, triangle +0.39, cube +0.39).

**One weight group at a time** shows where the sensitivity lives:

| quantised group | weights | 3 bits | 2 bits |
|---|---|---|---|
| cube's 3-way weights | 48.8k | **+0.082** | **+1.07** |
| triangle's weights | 11.3k | +0.065 | +0.95 |
| MLP output matrix | 32.8k | +0.115 | +1.77 |
| MLP input matrix | 32.8k | +0.170 | +1.49 |
| triangle's output projection | 40.7k | +0.094 | +1.24 |
| triangle's input projection | 13.6k | **+0.197** | **+1.85** |

* The three-way weights tolerate coarse rounding unusually well: the cube's 49k weights at 2 bits cost less than either 33k MLP matrix at 2 bits.
* The weak point is the **input projection**, whose rounding errors get multiplied together inside the products.

**Mixed precision at equal total storage** (absolute val bits/char = float + quantisation loss):

| feed-forward storage | MLP | gated | cube (W 3 bits, input 6–8, output 3–4) |
|---|---|---|---|
| ≈ 262k bits (4 bits each) | 3.416 | **3.380** | — |
| ≈ 221–241k bits | 3.521 (229k) | 3.462 (241k) | **3.460 (221k)** |
| ≈ 197–202k bits | 3.670 | 3.602 | **3.530 (202k)** |

* With the 3-way weights stored at 3 bits and the small input projection kept precise, the cube needs **fewer bits for the same quality**. It matches the gated block with 8% less storage, and at about 200k bits it beats it by 0.07 bits/char (both cube seeds beat both gated seeds).
* The triangle does not benefit. Its large output projection (3 sweeps × n) dominates storage.
* 2-bit three-way weights break every configuration (+1.0 or worse).
* Caveats: tiny model, two seeds, simple per-tensor rounding. Differences at 4 bits are within noise.

## Properties instead of operation counts: hexagonal feed-forward layers (`hexconv.py`, `hex_props.py`, `hex_rings.py`)

Hidden units on a hexagon; feed-forward block C·((A x) ∗ (B x)) with hexagonal convolution, computed exactly by FFT.
A hexagon of radius R wrapped on a torus is the cyclic group Z_N, N = 3R²+3R+1, via φ(q,r) = ((R+1)q − Rr) mod N.
- **Without wrap-around** the output hexagon has twice the radius, and centre outputs collect up to |P| products against 1 at the corners.
- **With wrap-around** every output collects |P|.

Quality at ≈65k feed-forward weights, 1,500 steps, validation bits/char (2 seeds):

| block | bits/char |
|---|---|
| MLP | 3.389 |
| gated (SwiGLU-style) | 3.325 |
| hexagonal, no wrap (centre-heavy) | 3.324 (3.324, 3.323) |
| element-wise bilinear C·((Ax)⊙(Bx)) | 3.301 (3.296, 3.307) |
| hexagonal, wrap (uniform) | 3.289 (3.312, 3.265; noisy) |
| hexagonal, wrap, half the weights | 3.384 |

Competitive, but not a clear win over the plain bilinear block.

**Importance ordering (the useful property).** Zeroing output cells of the trained layer:

| cells kept | no wrap: drop outer rings | no wrap: drop random | wrap: drop outer rings | wrap: drop random |
|---|---|---|---|---|
| 82% (no wrap) / 75% (wrap) | **+0.08** | +0.23 | +0.39 | +0.36 |
| 66% / 54% | **+0.23** | +0.44 | +0.91 | +0.91 |
| 51% / 36% | **+0.43** | +0.69 | +1.48 | +1.54 |

- The centre-heavy layer puts its important features in the centre without being trained to: trimming the outer rings hurts 2–3× less than random.
- The uniform layer has no such order.
- Trimming is not free, but it gives a natural knob for elastic compute (fewer output columns at inference).

**Precision by ring: no gain.** Output weights at a 3-bit average:
- uniform: +0.18
- more bits at the centre: +0.34
- more bits at the edge: +0.49 (no wrap) / +0.25 (wrap)

Starving any ring down to 2 bits costs more than it saves.

**What training does with the non-uniformity** (no wrap, per ring from centre to corner):
- activation size: 3.7 → 0.7;
- output-weight size: 0.44 → 0.73;
- distance the output weights moved from initialisation: 0.40 → 0.69 (mean of 2 seeds).

The model compensates for weak edge activations by growing the edge weights; the edges move about 70% more. The compensation is partial: the centre still contributes about 3× more. With wrap-around every row is flat.

Next steps:
- train with random outer-ring dropout (Matryoshka-style) to sharpen the ordering;
- use the ordering for early exit or elastic width.

## Turning the centre down: fan-in normalisation (`hexn_sqrt`, `hexn_mean`)

Idea: centre outputs add up many products (91 at the centre against 1 at a corner), so they may carry more noise.
Give them lower weight and keep full weight at the edges, scaling each output by fan-in^(−½) or fan-in^(−1).

| no-wrap hexagonal layer | val bits/char (2 seeds) | importance order (82% of cells kept: outer rings first / random) | output weights by ring |
|---|---|---|---|
| unscaled | **3.324** | centre-first: +0.08 / +0.23 | grow towards the edge (training compensates) |
| × fan-in^(−½) | 3.330 | **none**: +0.18 / +0.17 | flat (0.70–0.76) |
| × fan-in^(−1) | 3.392 | **inverted**: +0.32 / +0.13 | lower at the centre |

* The 1/√ scaling does what the idea predicts. After scaling, centre and edge outputs contribute about equally (raw activations are still 5× larger at the centre: 8.1 vs 1.6, scaled to 0.85 vs 0.95). Training no longer has to grow the edge weights, and the centre-first ordering disappears.
* It does not improve quality: 3.330 against 3.324, a tie. There is no sign that the centre's extra sum was harmful noise.
* 1/fan-in over-corrects. The edges become the most important cells and quality drops (3.392).
* So it's a choice: a balanced layer (1/√), or a centre-first layer (unscaled) whose outer rings can be trimmed gracefully.
