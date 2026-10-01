"""Random search for convex patterns closed under matrix multiplication (R∘R ⊆ R).
Conjecture: closed ⇔ every edge is horizontal, vertical or parallel to the diagonal (slope 1), with the
diagonal edge on the correct side (y − x ≥ c ≥ 0 or y − x ≤ c ≤ 0), i.e. a box ∩ shifted triangle.
Such shapes have at most 5 corners, so no hexagon or higher n-gon can be closed."""
import numpy as np
from shapes import hp, compose, contains, vertices2d, area
from scipy.spatial import ConvexHull

DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1), (1, 1), (-1, -1), (2, -1), (-1, 2), (1, -2), (-2, 1), (1, 2), (2, 1)]
rng = np.random.default_rng(0)

def edge_dirs(H):
    V = vertices2d(H); hull = ConvexHull(V); V = V[hull.vertices]
    out = []
    for i in range(len(V)):
        d = V[(i + 1) % len(V)] - V[i]
        if np.linalg.norm(d) < 1e-6: continue
        ang = np.degrees(np.arctan2(d[1], d[0])) % 180
        out.append(round(ang, 3))
    return sorted(set(out)), len(V)

stats = {"tried": 0, "zero product": 0, "shrinking (R∘R ⊊ R)": 0, "stable (R∘R = R)": 0, "not closed": 0}
corners_by_kind = {"zero product": {}, "shrinking (R∘R ⊊ R)": {}, "stable (R∘R = R)": {}}
stable_other = []
for trial in range(6000):
    k = rng.integers(1, 6)
    H = hp(*[(a, b, float(np.dot((a, b), rng.uniform(0.15, 0.85, 2)))) for a, b in (DIRS[i] for i in rng.integers(0, len(DIRS), k))])
    V = vertices2d(H)
    if len(V) < 3 or area(H) < 0.01: continue
    stats["tried"] += 1
    RR, _ = compose(H, H)
    if RR is None: kind = "zero product"
    elif not contains(H, RR, tol=1e-6): stats["not closed"] += 1; continue
    elif contains(RR, H, tol=1e-6): kind = "stable (R∘R = R)"
    else: kind = "shrinking (R∘R ⊊ R)"
    stats[kind] += 1
    dirs, corners = edge_dirs(H)
    corners_by_kind[kind][corners] = corners_by_kind[kind].get(corners, 0) + 1
    if kind.startswith("stable") and not all(d in (0.0, 90.0, 45.0) for d in dirs): stable_other.append((dirs, corners))
print(stats)
for kind, h in corners_by_kind.items(): print(f"  {kind:22s} corner counts {dict(sorted(h.items()))}")
print("stable shapes with an edge that is not horizontal, vertical or diagonal:", len(stable_other), stable_other[:5])
