"""Shapes as nonzero patterns of square matrices, in the continuum limit N → ∞.

A shape is a convex region R of the unit square (rows x, columns y), given by half-planes a·x + b·y ≤ c.
The product of two matrices with patterns R and S has pattern
    R∘S = {(x, z) : ∃ y with (x, y) ∈ R and (y, z) ∈ S}
which is the projection of the 3-D polytope Q = {(x,y,z) : (x,y) ∈ R, (y,z) ∈ S}. A sparse product costs
N³·vol(Q) multiplications (dense: N³). Everything below is exact polytope geometry (vertex enumeration
+ convex hull), cross-checked against boolean matrix products at finite N."""
import itertools, numpy as np
from scipy.spatial import ConvexHull

BOX = [(-1, 0, 0), (1, 0, 1), (0, -1, 0), (0, 1, 1)]           # 0 ≤ x ≤ 1, 0 ≤ y ≤ 1


def hp(*planes):                         # list of (a, b, c) meaning a·x + b·y ≤ c, always inside the unit box
    return list(planes) + BOX


def vertices2d(H):
    pts = []
    for (a1, b1, c1), (a2, b2, c2) in itertools.combinations(H, 2):
        M = np.array([[a1, b1], [a2, b2]], float)
        if abs(np.linalg.det(M)) < 1e-12: continue
        p = np.linalg.solve(M, [c1, c2])
        if all(a * p[0] + b * p[1] <= c + 1e-9 for a, b, c in H): pts.append(p)
    return np.unique(np.round(pts, 9), axis=0) if pts else np.zeros((0, 2))


def area(H):
    V = vertices2d(H)
    return ConvexHull(V).volume if len(V) >= 3 else 0.0


def compose(R, S):
    """returns (half-planes of R∘S, vol(Q))."""
    planes = [(a, b, 0, c) for a, b, c in R] + [(0, a, b, c) for a, b, c in S]      # (x,y) ∈ R, (y,z) ∈ S
    V = []
    for P in itertools.combinations(planes, 3):
        M = np.array([p[:3] for p in P], float)
        if abs(np.linalg.det(M)) < 1e-12: continue
        v = np.linalg.solve(M, [p[3] for p in P])
        if all(p[0] * v[0] + p[1] * v[1] + p[2] * v[2] <= p[3] + 1e-9 for p in planes): V.append(v)
    if not V: return None, 0.0                                      # R∘S is empty (nilpotent pattern)
    V = np.unique(np.round(V, 9), axis=0)
    vol = ConvexHull(V).volume if len(V) >= 4 and np.linalg.matrix_rank(V - V[0]) == 3 else 0.0
    P2 = np.unique(np.round(V[:, [0, 2]], 9), axis=0)
    if len(P2) < 3 or np.linalg.matrix_rank(P2 - P2[0]) < 2: return None, vol
    hull = ConvexHull(P2)
    H = [(eq[0], eq[1], -eq[2]) for eq in hull.equations]           # a x + b z + d ≤ 0  →  a x + b z ≤ -d
    return H, vol


def contains(R, S, tol=1e-7):            # S ⊆ R ?
    V = vertices2d(S)
    return all(a * p[0] + b * p[1] <= c + tol for p in V for a, b, c in R)


def polygon_corners(H):
    V = vertices2d(H)
    if len(V) < 3: return 0
    return len(ConvexHull(V).vertices)


def regular_ngon(n, r=0.45, cx=0.5, cy=0.5, rot=None):
    rot = np.pi / 2 if rot is None else rot                          # one vertex pointing "up" (towards y = 1)
    pts = [(cx + r * np.cos(rot + 2 * np.pi * k / n), cy + r * np.sin(rot + 2 * np.pi * k / n)) for k in range(n)]
    hull = ConvexHull(pts)
    return hp(*[(e[0], e[1], -e[2]) for e in hull.equations])


SHAPES = {
    "full square (dense)":            hp(),
    "upper triangle (x ≤ y)":         hp((1, -1, 0)),
    "strict triangle (y ≥ x + 0.2)":  hp((1, -1, -0.2)),
    "trapezoid (x ≤ y, x ≤ 0.6)":     hp((1, -1, 0), (1, 0, 0.6)),
    "pentagon (x ≤ y, x ≤ .7, y ≥ .3)": hp((1, -1, 0), (1, 0, 0.7), (0, -1, -0.3)),
    "band |x−y| ≤ 0.15 (hexagon)":    hp((1, -1, 0.15), (-1, 1, 0.15)),
    "anti-triangle (x + y ≤ 1)":      hp((1, 1, 1)),
    "regular triangle, centred":      regular_ngon(3),
    "diamond (square at 45°)":        regular_ngon(4),
    "regular pentagon, centred":      regular_ngon(5),
    "regular hexagon, centred":       regular_ngon(6),
    "regular octagon, centred":       regular_ngon(8),
    "disk (64-gon)":                  regular_ngon(64),
}


def raster(H, N):
    c = (np.arange(N) + 0.5) / N
    X, Y = np.meshgrid(c, c, indexing="ij")
    M = np.ones((N, N), bool)
    for a, b, cc in H: M &= a * X + b * Y <= cc + 1e-12
    return M


if __name__ == "__main__":
    print(f"{'shape':34s} {'corners':>7} {'density':>8} {'closed':>7} {'R∘R area':>9} {'R∘R corners':>11} {'cost/N³':>8}  powers: area of R^k, k=1..5")
    for name, R in SHAPES.items():
        RR, vol = compose(R, R)
        closed = RR is None or contains(R, RR)
        areas, P = [area(R)], R
        for _ in range(4):
            P, _ = compose(P, R)
            areas.append(0.0 if P is None else area(P))
            if P is None: break
        print(f"{name:34s} {polygon_corners(R):7d} {area(R):8.3f} {str(closed):>7} {0 if RR is None else area(RR):9.3f} "
              f"{0 if RR is None else polygon_corners(RR):11d} {vol:8.4f}  " + " ".join(f"{a:.3f}" for a in areas))
    # cross-check against boolean matrix products at N = 200
    N = 200
    print("\nfinite-N check (N = 200): pattern density of R·R, and multiplications / N³")
    for name, R in SHAPES.items():
        M = raster(R, N).astype(np.int64)
        prod = (M @ M) > 0
        mults = int((M.sum(0) * M.sum(1)).sum())                    # Σ_j |column j| · |row j|
        RR, vol = compose(R, R)
        print(f"  {name:34s} density(R·R) {prod.mean():.3f} (exact {0 if RR is None else area(RR):.3f})   mults/N³ {mults / N**3:.4f} (exact {vol:.4f})")
