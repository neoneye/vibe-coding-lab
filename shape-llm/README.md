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
