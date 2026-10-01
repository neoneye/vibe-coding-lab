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
  - Exact GF(2) SAT (`sat_ring.py`): reproduces triangle 7 / not 6 instantly, but even the certain "square ring, 15" UNSAT did not finish in 15 minutes; pentagon 30 and 31 did not finish (left running).
  - **Rotation-symmetric search** (`cyclic.py`; orbits of 5 rotated terms plus fixed v⊗v⊗v⊗v⊗v terms, the form of symmetric Strassen, which it finds from 4 of 6 starts):
    - 31 = 6·5+1 reaches error 3·10⁻⁴, then freezes;
    - 29 = 5·5+4 freezes at 0.041;
    - **30 = 5·5+5 keeps descending, error 0.044 → 0.029 while the coefficient norm grows 26 → 32 (error ∝ ‖p‖^−2.2)**;
    - all other splits stay at √(32 − R)-type plateaus.
  - That R = 30 trajectory is the signature of a *border* (approximate) decomposition, which would beat the best known border bound of 31. It is **not confirmed**: extrapolating, error 10⁻⁶ would need coefficients near 3,000, beyond what double precision can resolve. Confirming it needs an explicit ε-family, or exact arithmetic.
