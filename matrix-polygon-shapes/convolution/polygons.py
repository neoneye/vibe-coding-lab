"""Polygon-shaped arrays multiplied by convolution (two-variable polynomial product).

An array with support P (a finite set of lattice points) is a polynomial Σ_{p∈P} a_p x^p. The product of
arrays with supports P and Q has support P+Q (Minkowski sum). Facts checked here:
  * exact bilinear rank (minimum number of multiplications, over ℝ/ℂ) = |P+Q|:
      lower bound: the |P+Q| output coefficients are linearly independent bilinear forms;
      upper bound: evaluate at |P+Q| generic points, multiply pointwise, interpolate.
  * 2D lattice polygons are "normal": (P∩Z²) + (P∩Z²) = (2P)∩Z², so the product of a k-pentagon array is
    exactly a 2k-pentagon array (no stray points). In 3D this fails (Reeve tetrahedron).
  * cost per output and per input for triangle / square / hexagon / pentagon / octagon / disk supports."""
import numpy as np, itertools
from scipy.spatial import ConvexHull, Delaunay

# ---------- shapes as lattice point sets (square lattice Z²; hexagonal lattice in skewed coordinates) ----------
def triangle(k):  return {(i, j) for i in range(k) for j in range(k) if i + j <= k - 1}
def square(k):    return {(i, j) for i in range(k) for j in range(k)}
def hexagon(k):   # regular hexagon of side k on the hexagonal lattice (axial coords): |i|,|j|,|i+j| ≤ k−1
    r = k - 1;    return {(i, j) for i in range(-r, r + 1) for j in range(-r, r + 1) if abs(i + j) <= r}
def lattice_polygon(n, radius, hexlat=False, rot=np.pi / 2):
    """lattice points inside a regular n-gon (snapped: the convex hull of those points is the actual shape)."""
    ang = rot + 2 * np.pi * np.arange(n) / n
    poly = np.c_[radius * np.cos(ang), radius * np.sin(ang)]
    R = int(np.ceil(radius)) + 2
    pts = []
    for i in range(-2 * R, 2 * R + 1):
        for j in range(-2 * R, 2 * R + 1):
            xy = np.array([i + 0.5 * j, j * np.sqrt(3) / 2]) if hexlat else np.array([i, j], float)
            pts.append(((i, j), xy))
    tri = Delaunay(poly)
    return {ij for ij, xy in pts if tri.find_simplex(xy) >= 0}
def disk(radius, hexlat=False): return lattice_polygon(96, radius, hexlat)

def boundary_points(P):
    """lattice points of P on the boundary of conv(P) (lattice-independent: works in axial hex coordinates too)."""
    V = np.array(sorted(P), float); hull = ConvexHull(V)
    return sum(1 for p in V if any(abs(eq[:2] @ p + eq[2]) < 1e-9 for eq in hull.equations))

def minkowski(P, Q): return {(p[0] + q[0], p[1] + q[1]) for p in P for q in Q}

def lattice_hull_points(S, scale=1):
    """lattice points in scale·conv(S) (for checking normality)."""
    V = np.array(sorted(S), float) * scale
    if len(V) < 3: return set(map(tuple, V.astype(int)))
    tri = Delaunay(V); lo, hi = V.min(0).astype(int) - 1, V.max(0).astype(int) + 2
    return {(i, j) for i in range(lo[0], hi[0]) for j in range(lo[1], hi[1]) if tri.find_simplex(np.array([i, j]), tol=1e-9) >= 0}

# ---------- exact rank check for small shapes ----------
def conv_tensor(P, Q):
    P, Q = sorted(P), sorted(Q); S = sorted(minkowski(P, Q)); idx = {s: n for n, s in enumerate(S)}
    T = np.zeros((len(P), len(Q), len(S)))
    for a, p in enumerate(P):
        for b, q in enumerate(Q): T[a, b, idx[(p[0] + q[0], p[1] + q[1])]] = 1
    return T, P, Q, S

def eval_interp_algorithm(P, Q, seed=0):
    """multiplication by evaluation at |P+Q| random points + interpolation; returns #mults and max error."""
    rng = np.random.default_rng(seed); P, Q = sorted(P), sorted(Q); S = sorted(minkowski(P, Q))
    pts = rng.uniform(0.5, 1.5, size=(len(S), 2))
    V = lambda X: np.array([[x ** e[0] * y ** e[1] for e in X] for x, y in pts])
    a, b = rng.normal(size=len(P)), rng.normal(size=len(Q))
    prod = (V(P) @ a) * (V(Q) @ b)                                      # |P+Q| multiplications
    c = np.linalg.solve(V(S), prod)
    ref = {s: 0.0 for s in S}
    for (p, ap), (q, bq) in itertools.product(zip(P, a), zip(Q, b)): ref[(p[0] + q[0], p[1] + q[1])] += ap * bq
    return len(S), np.abs(c - np.array([ref[s] for s in S])).max(), np.linalg.cond(V(S))

if __name__ == "__main__":
    print("== exact rank = |P+Q| (flattening lower bound) and an evaluation–interpolation algorithm attaining it ==")
    for name, P in [("triangle k=3", triangle(3)), ("square 3×3", square(3)), ("hexagon side 2", hexagon(2)), ("pentagon r=1.6", lattice_polygon(5, 1.6))]:
        T, Ps, Qs, S = conv_tensor(P, P)
        r = np.linalg.matrix_rank(T.reshape(-1, T.shape[2]))
        m, err, cond = eval_interp_algorithm(P, P)
        print(f"  {name:16s} |P|={len(P):2d} naive {len(P)**2:3d} mults  |P+P|={len(S):2d}  flattening rank {r:2d}  "
              f"eval–interp: {m} mults, max error {err:.1e}, condition {cond:.1e}")

    print("\n== normality: is (P∩Z²)+(P∩Z²) exactly the lattice points of 2·conv(P)? ==")
    rng = np.random.default_rng(1); bad = 0
    for t in range(300):
        S = {tuple(v) for v in rng.integers(0, 7, size=(rng.integers(3, 8), 2))}
        V = np.array(sorted(S), float)
        if len(S) < 3 or np.linalg.matrix_rank(V - V[0]) < 2: continue          # skip collinear sets
        P = lattice_hull_points(S)
        if len(P) < 3: continue
        if minkowski(P, P) != lattice_hull_points(P, 2): bad += 1
    print(f"  300 random lattice polygons: {bad} failures (2D lattice polygons are normal)")
    reeve = {(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 3)}                # Reeve tetrahedron (only its 4 vertices are lattice points)
    twoP = set()
    for i, j, k in itertools.product(range(0, 3), range(0, 3), range(0, 7)):
        # inside 2·conv(reeve)?  barycentric test
        A = np.array([[1, 0, 1], [0, 1, 1], [0, 0, 3]], float) * 2       # columns: 2·e1, 2·e2, 2·(1,1,3)
        lam = np.linalg.solve(A, [i, j, k])
        if lam.min() >= -1e-9 and lam.sum() <= 1 + 1e-9: twoP.add((i, j, k))
    sums = {tuple(np.add(p, q)) for p in reeve for q in reeve}
    print(f"  3D Reeve tetrahedron: 2P has {len(twoP)} lattice points, P+P only {len(sums)}; missing {sorted(twoP - sums)}")

    print("\n== cost of multiplying two arrays of the same shape, at ~100 coefficients each ==")
    rows = [("triangle (k=14)", triangle(14)), ("square (10×10)", square(10)), ("hexagon (side 6, hex lattice)", hexagon(6)),
            ("pentagon r≈5.9", lattice_polygon(5, 5.9)), ("octagon r≈5.6", lattice_polygon(8, 5.6)), ("disk r≈5.65", disk(5.65)),
            ("disk r≈5.4 (hex lattice)", disk(5.4, True))]
    print(f"  {'shape':32s} {'|P|':>4} {'B':>4} {'|P+P|':>6} {'4|P|−B−3':>9} {'naive':>6} {'rank/|P|':>9}")
    for name, P in rows:
        S = minkowski(P, P)
        B = boundary_points(P)
        print(f"  {name:32s} {len(P):4d} {B:4d} {len(S):6d} {4*len(P)-B-3:9d} {len(P)**2:6d} {len(S)/len(P):9.2f}")

    print("\n== mixing shapes: Minkowski sums ==")
    T3 = triangle(4); negT = {(-i, -j) for i, j in T3}
    for name, P, Q in [("triangle + triangle", T3, T3), ("triangle + reflected triangle", T3, negT),
                       ("square + diamond", square(3), {(0, 1), (1, 0), (1, 2), (2, 1), (1, 1)}),
                       ("pentagon + reflected pentagon", lattice_polygon(5, 3.2), {(-i, -j) for i, j in lattice_polygon(5, 3.2)})]:
        S = minkowski(P, Q); V = np.array(sorted(S), float)
        print(f"  {name:32s} -> {len(ConvexHull(V).vertices)} corners")
