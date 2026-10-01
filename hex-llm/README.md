# hex-llm

A small character-level language model whose hidden state, for every token, is a **hexagon of feature cells**,
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
- `hexllm.py`: models and training (`python hexllm.py hex|base seed steps`).

Data: the repository's markdown, character level.
