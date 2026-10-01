"""Hexagonal feature grids for hex-llm.

Cells use axial coordinates (q, r); a hexagon of radius R has 3R²+3R+1 cells.
Bottleneck "3 neighbours → 1 cell": the up-triangles {b, b+(1,0), b+(0,1)} with base points b on the sublattice
q − r ≡ 0 (mod 3) tile the plane exactly (the three cells have the three residues of q − r mod 3). The base points
form a coarser hexagonal lattice (rotated 30°, scaled √3; the aperture-3 hierarchy). A base point b = (q, r) with
c = (q − r)/3 maps to the coarse cell (r + 2c, −c)."""
HEX_DIRS = [(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)]

def cells(R):
    return [(q, r) for q in range(-R, R + 1) for r in range(-R, R + 1) if abs(q + r) <= R]

def dist(a, b=(0, 0)):
    dq, dr = a[0] - b[0], a[1] - b[1]
    return (abs(dq) + abs(dr) + abs(dq + dr)) // 2

def neighbours(R):
    """for each cell of hexagon R: indices of itself and its 6 neighbours (−1 where outside the hexagon)."""
    C = cells(R); idx = {c: i for i, c in enumerate(C)}
    return [[idx[c]] + [idx.get((c[0] + dq, c[1] + dr), -1) for dq, dr in HEX_DIRS] for c in C]

def coarse_of(base):
    q, r = base; c = (q - r) // 3
    return (r + 2 * c, -c)

def bottleneck(R_fine, R_coarse):
    """for each coarse cell of hexagon R_coarse: indices of its 3 fine cells in hexagon R_fine (−1 if outside)."""
    F = {c: i for i, c in enumerate(cells(R_fine))}; groups = {}
    for (q, r) in cells(R_fine + 3):
        if (q - r) % 3: continue
        tri = [(q, r), (q + 1, r), (q, r + 1)]
        groups[coarse_of((q, r))] = [F.get(t, -1) for t in tri]
    return [groups.get(c, [-1, -1, -1]) for c in cells(R_coarse)]

if __name__ == "__main__":
    # the triangles tile the plane exactly
    seen = {}
    for q in range(-20, 21):
        for r in range(-20, 21):
            if (q - r) % 3 == 0:
                for t in [(q, r), (q + 1, r), (q, r + 1)]: seen[t] = seen.get(t, 0) + 1
    inner = [c for c in seen if max(abs(c[0]), abs(c[1])) <= 15]
    print("tiling: every inner cell in exactly one triangle:", all(seen[c] == 1 for c in inner))
    # coarse lattice is hexagonal: the 6 nearest base points around (0,0) map to the 6 coarse neighbours
    nb = sorted(coarse_of(b) for b in [(1, 1), (2, -1), (-1, 2), (-1, -1), (-2, 1), (1, -2)])
    print("coarse neighbours of the centre:", nb, "== HEX_DIRS:", nb == sorted(HEX_DIRS))
    for Rf, Rc in [(12, 6), (6, 3)]:
        B = bottleneck(Rf, Rc); used = {i for g in B for i in g if i >= 0}
        full = sum(all(i >= 0 for i in g) for g in B)
        print(f"radius {Rf} ({len(cells(Rf))} cells) -> radius {Rc} ({len(cells(Rc))} cells): "
              f"{full}/{len(B)} coarse cells get all 3 inputs, fine cells used {len(used)}/{len(cells(Rf))}")
