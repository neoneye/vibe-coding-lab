# Findings

## 1. Shape = nonzero pattern of a square matrix (`sparsity/`)

Continuum limit: a pattern is a convex region R of the unit square (rows x, columns y). The product of
two R-patterned matrices has pattern R∘R = {(x,z) : ∃y, (x,y) ∈ R, (y,z) ∈ R}, and costs N³·vol{(x,y,z)}
multiplications. Both are computed exactly by polytope projection (`shapes.py`), and agree with
boolean matrix products at N = 200 to within 1%.

| shape | density | closed under product? | R∘R | cost / N³ |
|---|---|---|---|---|
| full square | 1 | yes | square | 1 |
| upper triangle x ≤ y | 0.5 | **yes** | itself | **0.167** |
| strict triangle y ≥ x + 0.2 | 0.32 | yes, shrinking (nilpotent) | smaller triangle | 0.036 |
| trapezoid x ≤ y, x ≤ 0.6 | 0.42 | **yes** | itself | 0.108 |
| pentagon x ≤ y, x ≤ 0.7, y ≥ 0.3 | 0.41 | **yes** | itself | 0.095 |
| band \|x−y\| ≤ 0.15 (hexagon) | 0.28 | no, grows | wider band 0.51 → 0.70 → 0.84 → 0.94 | 0.079 |
| anti-triangle x + y ≤ 1 | 0.5 | no | full square | 0.333 |
| centred regular 3/4/5/6/8-gon, disk | 0.26–0.64 | no | spreads to its bounding rectangle in 2–3 steps | 0.12–0.48 |

* **Stable shapes (R∘R = R).**
  - Sufficiency, proved: any box whose row and column ranges overlap, optionally cut by the diagonal half-plane x ≤ y (or x ≥ y), is stable. Such shapes have at most 5 corners: rectangle, triangle, trapezoid, pentagon.
  - Necessity, numerical: 507 of 507 stable shapes found in a random search of 4,171 polygons had only horizontal, vertical and diagonal edges.
  - **No hexagon or larger n-gon can be stable.**
* **Closed but transient.** Shapes whose column range misses their row range square to zero, and some others shrink into themselves. These can be any n-gon, including hexagons, but their powers die out (nilpotent).
* **Multiplication squares things up.** Under repeated products, every shape crossing the diagonal converges to its bounding rectangle. Band matrices (hexagons) fill the matrix after about 1/(bandwidth) steps.
* Triangles are the classic win: closed, an LU/Cholesky building block, N³/6 per product. But upper·lower is dense.
* Triangle *storage* (symmetric matrices) is closed under the Jordan product (AB+BA)/2 and powers, not under the ordinary product.

## 2. Shape = index set of an array, multiplied by convolution (`convolution/`)

Arrays with support P (lattice points) multiply like two-variable polynomials: the product has support
P + Q (Minkowski sum).

* **Exact cost.** The minimum number of multiplications is |P + Q|, over ℝ or ℂ.
  - Lower bound: the output coefficients are independent bilinear forms (flattening rank checked numerically).
  - Upper bound: evaluate at |P+Q| points and interpolate.
  - Caveat: the interpolation is ill-conditioned (condition 10⁶–10¹⁰ already for 15–25 points), which is why practice uses FFTs.
* **Pick's theorem gives a closed form.** For a lattice polygon with |P| points and B boundary points, a product costs exactly **4|P| − B − 3** multiplications. This matches all shapes tested, on both the square and the hexagonal lattice.
  - At equal size, more boundary points means cheaper.
  - Lattice-aligned edges (triangles, squares, hexagons) carry many boundary points. Pentagon, octagon and disk edges carry few, so those shapes cost relatively more (rank/|P| 3.74 vs 3.60).
* **Shapes are preserved, and in 2D without gaps.** Every 2D lattice polygon is normal: (P∩Z²) + (P∩Z²) = (2P)∩Z² (0 failures in 300 random polygons). So a k-pentagon array times a k-pentagon array is exactly a 2k-pentagon array.
  - In 3D this fails: the Reeve tetrahedron's double contains (1,1,1) and (1,1,2), which are not sums.
* **Mixing shapes.** triangle + reflected triangle = hexagon (correlating triangular arrays gives hexagons); square + diamond = octagon; pentagon + reflected pentagon = decagon.
* **Regular n-gons on a lattice exist only for n = 3, 4, 6** (crystallographic restriction). Pentagons and octagons can only be approximated.
* Hexagonal sampling needs 13.4% fewer samples than square sampling for circularly band-limited signals (Petersen–Middleton; hex FFT by Mersereau 1979).

## 3. Shape = ring of matrices, trace(A₁···A_k) (`rings/`)

The k-gon tensor network. For 2×2 matrices (Christandl–Zuiddam, *Tensor surgery and tensor rank*):
* even k: rank exactly 2^k, so no fused algorithm beats the naive one (our four-way N⁴ result is k = 4);
* odd k: 2^k − 2^(k−2) + 1 ≤ R ≤ 2^k − 1 (Young-flattening lower bound by Buhrman et al.; the upper bound is the surgery).
* Reproduced here: the flattening ranks (2^k even, 2^(k−1) odd), Strassen's 7 for the triangle by search, and the exact 31-term pentagon / 127-term heptagon decompositions built by tensor surgery.
* **Open problem attacked:** the pentagon rank (25 ≤ R ≤ 31).
  - Random Levenberg–Marquardt starts stall even at R = 31, at error √(32 − R).
  - Drop-one restarts from the exact 31-term decomposition stall at error exactly 1; ridge-continuation border probes at R = 30 from there show no divergence.
  - Exact GF(2) SAT (`sat_ring.py`): reproduces triangle 7 / not 6 instantly, but even the certain "square ring, 15" UNSAT did not finish in 15 minutes; pentagon 30 and 31 gave no answer and were stopped after 7.5 hours.
  - **Rotation-symmetric search** (`cyclic.py`; orbits of 5 rotated terms plus fixed v⊗v⊗v⊗v⊗v terms, the form of symmetric Strassen, which it finds from 4 of 6 starts):
    - 31 = 6·5+1 reaches error 3·10⁻⁴, then freezes;
    - 29 = 5·5+4 freezes at 0.041;
    - **30 = 5·5+5 keeps descending, error 0.044 → 0.025 over 24 long chunks while the coefficient norm grows 26 → 34 (error ∝ ‖p‖^≈−2.1, still falling at the end)**;
    - all other splits stay at √(32 − R)-type plateaus.
  - That R = 30 trajectory is the signature of a *border* (approximate) decomposition, which would beat the best known border bound of 31. It is **not confirmed**: extrapolating, error 10⁻⁶ would need coefficients near 3,000, beyond what double precision can resolve. Confirming it needs an explicit ε-family, or exact arithmetic.

## 4. Triangle-shaped weights swept three ways (`llm/`)

Weights on a triangular lattice lie on three lines each (0°, 60°, 120°). The three sweeps sum to the gradient of the
cubic energy Σ W·h_i h_j h_k, and each weight feeds 6 multiplications per read.

In a tiny character-level LM, at equal feed-forward parameters, validation bits/char were:
- MLP 3.389
- triangle, three sweeps 3.374
- triangle, one sweep 3.344
- SwiGLU 3.325

So the triangle beats the MLP but not SwiGLU, and three sweeps are no better than one per parameter. The open question is weight reuse for memory-bound decoding, which needs a GPU kernel.
Related: AlphaFold triangle updates; 2-simplicial attention.

3D shapes, at the same parameter count:
- **cube** (full 3-way array, 3 sweeps, 6 multiplications per weight read): 3.350 at 1,500 steps, second only to SwiGLU and better than its diagonal slice, the triangle;
- **tetrahedron** (4 sweeps, quartic, 12 multiplications per weight read): ties everything at 500 steps, but is too slow on CPU to train longer.

General d-simplex: d+1 sweeps, d(d+1) multiplications per weight read.

Quantisation:
- At the same bit width for everything, there is no bonus; shaped layers degrade slightly faster at 3–4 bits.
- But the three-way weights themselves are robust: the cube's 49k weights at 2 bits cost +1.07, against +1.5 to +1.8 for a 33k MLP matrix.
- The sensitive part is the input projection, whose errors are multiplied together.
- With mixed precision (three-way weights at 3 bits, input projection at 6–8 bits), the cube reaches 3.530 bits/char at 202k stored bits, against 3.602 for the gated block and 3.670 for the MLP at 197k. So it needs fewer bits for the same quality.
- The triangle doesn't gain, because its 3n-wide output projection dominates storage.

## 5. Hexagons: wrap-around or not, hexagonal attention, isotropy

- **Wrap-around** (hexagons of radius R tile a torus with translations (2R+1, −R) and (R, R+1)): every output of a hex ∗ hex product gets exactly |P| multiplications. **Without it**: |P| at the centre, 1 at the corners.
- **Learning speed** of an output = its NTK diagonal. Without wrap-around the centre learns about 30× faster than the corners (radius 4: NTK 41 vs 2; error removed in 3 steps 9.4 vs 0.29). With wrap-around it is uniform.
- **Hexagonal masks** on a radius-8 map (217 cells), links per cell / layers to connect everything:
  - ring 1: 6.5 / 16
  - ring 1 + 2: 16.7 / 8
  - ring 1 + 3 (skip ring 2): 20.4 / 6
  - **ring 1 + 3 random far cells: 9.5 / 5**
  - ring 1 + 3 + random: 23.2 / 4
- **Isotropy:** a repeated hexagonal blur is exactly isotropic in its 4th moments; square blurs are not (4-neighbour 1.29 after 2 steps, 1.04 after 10).
- Related: BigBird (local + random attention), HexagDLy (hexagonal CNNs), Uber H3 (hexagonal geospatial grid).

## 6. Hexagonal feed-forward layers in the tiny LM: properties rather than operation counts

- Quality at ≈65k weights:
  - hexagonal wrap 3.289 (noisy)
  - element-wise bilinear 3.301
  - hexagonal no-wrap 3.324
  - gated 3.325
  - MLP 3.389

  Competitive, no clear win.
- **Natural importance ordering from non-uniform fan-in:** in the no-wrap layer, trimming the outer output rings hurts 2–3× less than dropping random cells (82% kept: +0.08 vs +0.23). The wrapped layer has no ordering.
- **Precision by ring:** no gain; uniform bits beat centre-heavy or edge-heavy allocations.
- **Training partly compensates:** edge activations are 5× weaker, so the edge output weights grow and move about 70% more from initialisation. The centre still contributes about 3× more.

## 7. Turning the centre down (fan-in normalisation)

- Scaling the no-wrap hexagonal layer's outputs by fan-in^(−½) (centre 1/√91, corners 1) equalises the centre and edge contributions. Training no longer compensates at the edges, and the centre-first importance order disappears.
- Quality is unchanged: 3.330 vs 3.324.
- Scaling by fan-in^(−1) over-corrects: the edges become most important and quality drops to 3.392.
- In shape-llm, normalising by neighbour count is a tie on quality (3.254 vs 3.259), with closer seeds.
- No evidence that the centre's larger sums were harmful noise.

## 8. A whole model in a shape (`../shape-llm/`)

A pyramid of hexagonal feature cells (radius 12 → 6 → 3) with 3 → 1 triangle bottlenecks. The up-triangles on q − r ≡ 0 (mod 3) tile the grid exactly and form an aperture-3 hexagonal hierarchy.
- With a hexagonal (6-neighbour) feed-forward it trails a parameter-matched transformer by 0.2–0.35 bits/char.
- With the triangle feed-forward it comes within 0.02 (3.407 vs 3.384, 1,000 steps; the wrapped version is 0.013 behind at 4,000 steps), so the local mixing was the problem, not the pyramid.
- In the triangle, the long lines ("centre") are signal: lowering them hurts, raising them is free or slightly helpful (best mean 3.391 for the reversed, average-1 version). That is within seed noise at 1,000 steps.
- Longer run (4,000 steps, 3 seeds per model, same text): transformer 2.726; triangle with wrap **2.739** (0.013 behind, seed ranges overlap); without wrap, reversed avg 1 2.770, reversed 2.773, unscaled 2.778, centre lowered avg 1 2.789, centre lowered 2.817.
  - Wrap beats no wrap (ranges do not overlap), though the wrapped triangle does twice the products per step (n² vs ~n²/2 weights, +0.6% parameters, ~1.5× time).
  - Raising the centre is level with unscaled; lowering it is the only clear loss. The 1,000-step lead of the reversed triangle was noise.
  - Triangle steps cost ~4× (no wrap) to ~6× (wrap) a transformer step on CPU.
- What the longer runs revealed:
  - Uniform beats every centre/edge weighting, in both shapes (hexagon single layer: wrap 3.289 vs 3.324; triangle full model: 2.739 vs 2.778).
  - The 1,000-step, 2-seed runs ranked variants wrongly twice (wrap behind by 0.034; reversed triangle "ahead" of the transformer). Seed spread fell from up to 0.19 to at most 0.045 at 4,000 steps.
  - Triangles lead at step 400, fall 0.07–0.09 behind by step 1,200, then close in while the learning rate anneals (last 1,600 steps: −0.16–0.17 vs −0.14 for the transformer). Untested guess: three-way products train worse at high learning rate.
  - The triangle's own weights are 14,150 numbers (0.6% of the model; 27,900 with wrap), yet the wiring change (wrap) moves the loss more than any reweighting.
  - Centre lowered + average 1 had the tightest seeds (2.787–2.791), without rescaling the widest (2.787–2.832).
  - Per unit of time the transformer wins easily (triangle steps 4–6× slower on CPU).
- Loss curves (page section 6, `../shape-llm/loss_curves.png`): the transformer learns fastest early, the triangles catch up, and everything is still falling at step 1,000.

## Takeaways

**The rectangle is the attractor.**
- Shapes inside a matrix drift towards rectangles under multiplication.
- Other shapes survive only with a different multiplication: convolution keeps every convex polygon.
- For rings of matrices, parity matters, not shape.

Surprises:
- pentagons can be stable matrix shapes and hexagons cannot (at most 5 corners);
- Pick's theorem gives the exact convolution cost 4|P| − B − 3, so lattice-irregular shapes pay about 4%;
- even rings are incompressible and odd rings are not, so Strassen is an odd-cycle phenomenon;
- triangle ⊕ mirrored triangle = hexagon;
- 3D doubled shapes can have gaps;
- the symmetric 31-term pentagon fit froze;
- SAT can't even prove the trivial square-ring bound quickly.

Uses:
- **causal attention masks** are triangles (closed: stacked causal layers stay causal);
- **sliding-window masks** are band ∩ triangle, which widen per product, so the receptive field is about layers × window (tested on the page);
- storage formats that stay closed;
- hexagons for isotropic data, triangles for total-degree polynomials;
- even tensor-network loops admit no fused shortcut.

New here:
- the stable-shape classification (at most 5 corners);
- the 4|P| − B − 3 cost formula;
- the unconfirmed border-30 pentagon hint.
