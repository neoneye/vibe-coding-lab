# shape-llm

Small character-level language models whose structure follows a shape.

## The hexagonal pyramid

The hidden state, for every token, is a **hexagon of feature cells**,
shrinking through the network like an image pyramid:

| blocks | hexagon radius | cells | channels per cell | features |
|---|---|---|---|---|
| 1–2 | 12 | 469 | 2 | 938 |
| 3–4 | 6 | 127 | 6 | 762 |
| 5–6 | 3 | 37 | 16 | 592 |

* **Each block:** causal self-attention across tokens on the flattened hexagon (4 heads, 128-dim), then a **hexagonal feed-forward**. Every cell mixes with its 6 neighbours through a shared, gated 7-tap hexagonal convolution, plus a per-cell bias.
* **Bottlenecks, "3 neighbours → 1 cell":**
  - The up-triangles {b, b+(1,0), b+(0,1)}, with base points on the sublattice q − r ≡ 0 (mod 3), tile the hexagonal grid exactly. Their base points form a coarser hexagonal grid (rotated 30°, scaled √3: the aperture-3 hierarchy).
  - Each coarse cell is a learned linear map of its triangle's 3 fine cells.
  - The coarse grid is cropped to radius 6, then 3. Because the requested radii halve while the triangles shrink by √3, the crop drops the outer band of fine cells: 377 of 469 used, then 107 of 127.
* **Baseline:** an ordinary 6-layer transformer (GELU MLP) with the same parameter count.

Files:
- `hexgrid.py`: geometry and checks (`python3 hexgrid.py`);
- `shapellm.py`: models and training (`python shapellm.py hex|base seed steps`).

Data: the repository's markdown, character level.

## Results (2,000 steps, CPU, 2 seeds)

| model | parameters | val bits/char | time per step |
|---|---|---|---|
| standard transformer | 2.59M | **2.992** (2.991, 2.992) | 0.11 s |
| hex v1: shared 7-tap kernel; attention holds 89% of the parameters | 2.63M | 3.342 (3.252, 3.431) | 0.47 s |
| standard transformer, re-matched | 2.25M | **3.023** (3.031, 3.016) | 0.10 s |
| hex v2: locally connected (each cell its own neighbour weights); hexagonal part holds 52% | 2.33M | 3.259 (3.223, 3.295) | 0.48 s |

* **The hexagonal pyramid is clearly worse than a standard transformer at the same size:** 0.35 bits/char behind for v1, 0.24 for v2.
  - It also trains less consistently (the seeds differ by 0.07–0.18).
  - It is 4–5× slower per step on CPU because of the neighbour gathering.
* **v1's main handicap was its budget:** a shared hexagonal kernel has almost no parameters (40k), leaving the model mostly attention. Giving the hexagonal part its own weights per cell (v2) helps but does not close the gap.
* **Likely remaining causes**, untested:
  - mixing within a token is only local (6 neighbours per block);
  - the width shrinks with depth (938 → 762 → 592 features);
  - the cropped bottlenecks discard the outer band of cells.

### What the hexagonal structure does give: an importance order (v1, `analyze.py`)

Zeroing cells of the residual stream at the end of each level, outer rings first vs the same number of random cells (Δ bits/char, mean of 2 seeds):

| level | cells kept | outer rings first | random |
|---|---|---|---|
| radius 12 | 85% | +0.006 | +0.065 |
| radius 12 | 71% | +0.034 | +0.168 |
| radius 6 | 72% | +0.089 | +0.264 |
| radius 3 (read by the output head) | 51% | **+0.18** | **+0.32** |

* At radius 12 and 6, part of this is built in: the cropped bottleneck never reads the outermost band, so zeroing it is nearly free by construction.
* At radius 3 the output head reads every cell, yet the outer ring is still about 40% cheaper to drop than random cells, and its activations are about 35% weaker (1.14 vs 1.8).
* The centre-first importance order seen in the single-layer experiments reappears in a full model.

### Neighbour-count normalisation (`hex2n`)

Cells at the hexagon's edge have only 3–4 neighbours, so their input is weaker. Scaling every cell's neighbourhood
by √(7 / number of valid neighbours) gives each cell the same expected input (interior cells keep weight 1).

| shape-llm v2 | val bits/char (2 seeds) |
|---|---|
| without normalisation | 3.259 (3.223, 3.295) |
| with normalisation | 3.254 (3.246, 3.261) |
| standard transformer, same size | **3.023** |

A tie on quality. The normalised seeds agree more closely (spread 0.015 vs 0.072), possibly steadier training, but two seeds can't establish that.

## The triangle: weights swept at 0°, 60° and 120°

`tiny.py` (single layer in the tiny model), `tri_props.py` (its properties), and the `tri*` kinds in
`shapellm.py` (triangle feed-forwards inside the same hexagonal pyramid, same bottlenecks, same 48-dim attention
as `hex2`; triangle sides 50 / 65 / 85).

Triangle layer: h = A·x (n units), weights W on cells (i, j, k), three sweeps
y0[i] = Σ W·h_j·h_k, y1[j] = Σ W·h_i·h_k, y2[k] = Σ W·h_i·h_j, then B·[y0, y1, y2].
- **no wrap:** i + j + k = n − 1, so the line at index i holds n − i weights. Long lines are the triangle's "centre" and short lines its edge.
- **wrap:** i + j + k ≡ n − 1 (mod n), n² weights on a torus; every line holds n.
- **centre lowered (S):** each output × (products it collects)^−½, so long lines are turned down and length-1 lines keep weight 1. With wrap all lines are equal, so this is just a constant.
- **centre lowered, average kept at 1 (SN):** the same, renormalised so only the balance between lines changes, not the overall size.

The training text has grown since the earlier runs, so everything below was re-run together at 1,000 steps (2 seeds each, validation bits/char).

### Full model (hexagonal pyramid, radius 12 → 6 → 3)

| feed-forward | val bits/char |
|---|---|
| standard transformer (no pyramid) | **3.384** (3.372, 3.396) |
| **triangle, no wrap, unscaled** | **3.407** (3.421, 3.392) |
| triangle, wrap, unscaled | 3.441 (3.463, 3.419) |
| triangle, no wrap, centre lowered, average kept at 1 | 3.465 (3.472, 3.458) |
| triangle, wrap, scaled (constant) | 3.514 (3.492, 3.536) |
| triangle, no wrap, centre lowered | 3.554 (3.528, 3.580) |
| hexagonal local feed-forward (`hex2`) | 3.587 (3.541, 3.634) |

* **The triangle feed-forward rescues the pyramid.** It is 0.18 bits/char better than the hexagonal local feed-forward and within 0.02 of a standard transformer, about the seed spread.
* So the pyramid and its 3 → 1 bottlenecks were not what held the hexagonal model back. The local 7-neighbour mixing was.

### Single layer (tiny model)

| triangle layer | unscaled | centre lowered | centre lowered, average 1 |
|---|---|---|---|
| no wrap | 3.538 | 3.619 | 3.550 |
| wrap | **3.510** | 3.604 (constant) | — |

### Wrap or not

Mixed: wrap is slightly better in the single layer (3.510 vs 3.538), and slightly worse in the full model (3.441 vs 3.407). Both differences are close to seed noise.

### Lowering the centre

Lowering the centre never helps the triangle:
* Plain scaling hurts mostly because it shrinks the whole output: wrap + scaling is just a constant 0.10, and still costs about 0.09.
* With the average kept at 1, the redistribution alone is close to neutral in the single layer (3.550 vs 3.538). It still costs 0.06 in the full model.

### What the trained triangle layer does (`tri_props.py`, seed 0)

| triangle layer | drop 20% of outputs: longest lines first / shortest first / random | activation by line length (1–10 → 81+) | output weights by line length |
|---|---|---|---|
| no wrap, unscaled | **+0.16** / +0.05 / +0.10 | 0.29 → 1.05 | 0.81 → 0.73 |
| no wrap, centre lowered | +0.13 / +0.06 / +0.05 | 0.32 → 0.36 (equalised) | **0.80 → 1.01** |
| wrap | equal (every line has 94 weights) | flat | flat |

* **The long lines carry the important features.** Dropping them first costs the most.
* **Unlike the hexagon, training does not compensate the weak short lines.**
* **When the long lines are turned down, training grows their output weights back.** The triangle's "centre" is signal the model wants, not noise. That is the opposite of the hexagon, where turning the centre down was neutral.
