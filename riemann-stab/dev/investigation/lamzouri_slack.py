"""Experiment D (stage 5 of CLAUDE_INVESTIGATION_PLAN.md): where the slack of Lamzouri's
Proposition 2.1 goes, on data.

For a conjugation-invariant multiset Z the proof builds, in L^2((-1/2,1/2)),
    f_z(u) = eta(u) e^{-2 pi i z u},   g_z = (f_z + f_zbar)/2,   h_z = (f_z - f_zbar)/(2i),
with <f_z, f_s> = K(z - conj s), K = f0-hat (the page's kernel), and
    F = sum_x m_x f_x (x) f_x  +  2 sum_z m_z (g_z (x) g_z - h_z (x) h_z)   (eq. 2.11),
    ||F||^2 = sum_{z,s} m_z m_s K(z-s)^2 = S.
Gram-Schmidt the nested family  U = span(f_{multiples}, g_z),  V = U + span(f_{simples}),
W = V + span(h_z)  (in that order); with L the triangular factor of the family's Gram matrix
(rows = family members, columns = orthonormal basis psi_j) the coefficient matrix of F is
    A = sum_x m_x l_x l_x^T + 2 sum_z m_z (l_{g_z} l_{g_z}^T - l_{h_z} l_{h_z}^T),
    ||F||^2 = ||A||_F^2,  alpha_j = A_jj,  sum_j alpha_j = sum_z m_z = N.
The proof drops, in order:
    (a) Bessel:            sum_{j != l} A_jl^2
    (b) second range:      sum_{j in V\\U} (alpha_j - 1)^2            [a^2 + 1 >= 2a]
    (c) dimension:         n1 - dim(V/U)                              [n1 = #simple real]
    (d1) first range:      sum_{j in U} (alpha_j - 2)^2               [a^2 + 4 >= 4a]
    (d2) first range:      2 (sum_{j in U} alpha_j - 2 dim U)         [multiplicity >= 2, ||g||^2-||h||^2 = 1]
    (e) third range:       sum_{j in W\\V} (alpha_j^2 - 2 alpha_j)     [alpha_j <= 0 there]
and the slack  Delta(Z) := #{simple real} - (2N - S)  equals (a)+(b)+(c)+(d1)+(d2)+(e).
This script checks that identity on every multiset (it is the finite proof, replayed in
floating point), reports the pieces, and tests candidate correction terms D(Z) against
Delta with the mandatory negative control (a lone double real point has Delta = 0).

Floating point (numpy, float64), Cholesky with a diagonal jitter on near-dependent
families -- a decomposition table, not an enclosure.  Kernel: the closed form of the page.
"""
import json, os, sys, random, math
import numpy as np

here = os.path.dirname(os.path.abspath(__file__))
S2 = math.sqrt(2.0); NRM = 1.0 / (S2 * math.sin(1.0 / S2))

def sinc(w):
    w = complex(w)
    if abs(w) < 1e-8: return 1 - w * w / 6
    return np.sin(w) / w

def K(z):
    """f0-hat at complex z (closed form, complex sine)."""
    b = 2 * np.pi * complex(z)
    return (sinc((S2 - b) / 2) + sinc((S2 + b) / 2)) / (2 * S2 * math.sin(1 / S2))

def gram_inner(z, s):
    """<f_z, f_s> = K(z - conj s)."""
    return K(z - np.conj(s))

def decompose(points, jitter=1e-13):
    """points: list of (z complex, m int), conjugation-invariant, distinct z.
    Returns dict with N, S, bound, slack and the six pieces."""
    reals = [(z.real, m) for z, m in points if z.imag == 0]
    simples = [(x, m) for x, m in reals if m == 1]
    mults = [(x, m) for x, m in reals if m >= 2]
    pairs = [(z, m) for z, m in points if z.imag > 0]           # one representative per pair
    N = sum(m for _, m in points)
    # S = sum_{z,s} m_z m_s K(z - s)^2  (not conj: eq. 2.10 uses conjugation invariance)
    S = 0.0
    for z, mz in points:
        for s, ms in points:
            S += mz * ms * (K(z - s) ** 2).real
    n1 = len(simples)
    bound = 2 * N - S
    slack = n1 - bound
    # the family, in the proof's order: U = f_mult, g_pairs ; then f_simple ; then h_pairs
    fam = []            # (kind, payload)
    for x, m in mults: fam.append(('f', x, m))
    for z, m in pairs: fam.append(('g', z, m))
    dimU = len(fam)
    for x, m in simples: fam.append(('f', x, m))
    dimV = len(fam)
    for z, m in pairs: fam.append(('h', z, m))
    n = len(fam)
    # Gram matrix of the family (real by (2.13)); g,h built from f_z, f_zbar
    def vec_inner(a, b):
        ka, za = a[0], a[1]; kb, zb = b[0], b[1]
        def ff(p, q): return gram_inner(p, q)
        def comps(kind, z):
            if kind == 'f': return [(1.0, z)]
            if kind == 'g': return [(0.5, z), (0.5, np.conj(z))]
            return [(-0.5j, z), (0.5j, np.conj(z))]          # h = (f_z - f_zbar)/(2i)
        tot = 0j
        for ca, pa in comps(ka, za):
            for cb, pb in comps(kb, zb):
                tot += ca * np.conj(cb) * ff(pa, pb)
        return tot.real
    G = np.array([[vec_inner(fam[i], fam[j]) for j in range(n)] for i in range(n)])
    # Cholesky = Gram-Schmidt in the family's order: G = L L^T, L[i,j] = <v_i, psi_j>
    try:
        L = np.linalg.cholesky(G)
        rank_note = 'full'
    except np.linalg.LinAlgError:
        L = np.linalg.cholesky(G + jitter * np.eye(n))
        rank_note = 'jitter %g' % jitter
    A = np.zeros((n, n))
    for i, (kind, z, m) in enumerate(fam):
        l = L[i]
        if kind == 'f': A += m * np.outer(l, l)
        elif kind == 'g': A += 2 * m * np.outer(l, l)
        else: A -= 2 * m * np.outer(l, l)
    alpha = np.diag(A)
    frob = float((A * A).sum())
    a_bessel = frob - float((alpha * alpha).sum())
    b_second = float(((alpha[dimU:dimV] - 1) ** 2).sum())
    c_dim = n1 - (dimV - dimU)
    d1_first = float(((alpha[:dimU] - 2) ** 2).sum())
    d2_first = 2 * (float(alpha[:dimU].sum()) - 2 * dimU)
    e_third = float((alpha[dimV:] ** 2 - 2 * alpha[dimV:]).sum())
    pieces = dict(bessel=a_bessel, second=b_second, dim=c_dim, first_sq=d1_first,
                  first_mult=d2_first, third=e_third)
    return dict(N=N, S=S, bound=bound, slack=slack, n1=n1, dimU=dimU, dimV=dimV, n=n,
                frob_vs_S=frob - S, trace_vs_N=float(alpha.sum()) - N,
                identity_residual=slack - sum(pieces.values()), pieces=pieces,
                rank=rank_note, min_alpha_third=float(alpha[dimV:].min()) if n > dimV else None)

def offdiag_simple(points):
    """Candidate D1: the pair energy of the simple real points among themselves."""
    xs = [z.real for z, m in points if z.imag == 0 and m == 1]
    return sum(K(x - y).real ** 2 for x in xs for y in xs if x != y)

def offdiag_all(points):
    return sum((mz * ms * (K(z - s) ** 2).real) for z, mz in points for s, ms in points if z != s)

def rnd_multiset(rng, n1, n2, n3, W=20.0, ymax=0.6):
    used = set(); pts = []
    def fresh():
        while True:
            x = round(rng.uniform(0, W), 6)
            if x not in used: used.add(x); return x
    for _ in range(n1): pts.append((complex(fresh(), 0), 1))
    for _ in range(n2): pts.append((complex(fresh(), 0), rng.choice([2, 3])))
    for _ in range(n3):
        x, y, m = fresh(), rng.uniform(0.02, ymax), rng.choice([1, 2])
        pts.append((complex(x, y), m)); pts.append((complex(x, -y), m))
    return pts

def fmt(d):
    p = d['pieces']
    return ('N=%3d S/N=%.4f slack=%.5f | bessel %.5f second %.5f dim %d first_sq %.5f first_mult %.4f third %.5f | resid %.1e frob-S %.1e tr-N %.1e %s'
            % (d['N'], d['S'] / d['N'], d['slack'], p['bessel'], p['second'], p['dim'], p['first_sq'], p['first_mult'], p['third'],
               d['identity_residual'], d['frob_vs_S'], d['trace_vs_N'], d['rank']))

if __name__ == '__main__':
    rng = random.Random(11)
    print('--- controls ---')
    print('lone simple real   ', fmt(decompose([(complex(1, 0), 1)])))
    print('lone double real   ', fmt(decompose([(complex(1, 0), 2)])), '  <- Delta = 0: any D must vanish here')
    print('lone pair y=0.25   ', fmt(decompose([(complex(1, .25), 1), (complex(1, -.25), 1)])))
    print('two distant simples', fmt(decompose([(complex(0, 0), 1), (complex(40, 0), 1)])))
    print('two close simples  ', fmt(decompose([(complex(0, 0), 1), (complex(0.05, 0), 1)])))
    print('--- families (identity residual must be ~0 on all) ---')
    worst = 0.0; rows = []
    fams = [('all simple', (12, 0, 0)), ('with multiples', (8, 3, 0)), ('with pairs', (8, 0, 3)), ('mixed', (8, 2, 2)), ('dense simple', (30, 0, 0))]
    for name, (n1, n2, n3) in fams:
        for t in range(6):
            pts = rnd_multiset(rng, n1, n2, n3, W=20.0 if name != 'dense simple' else 12.0)
            d = decompose(pts); worst = max(worst, abs(d['identity_residual']))
            d1 = offdiag_simple(pts); da = offdiag_all(pts)
            rows.append((name, d, d1, da))
            if t < 2: print('%-15s' % name, fmt(d))
    print('worst identity residual over %d multisets: %.2e' % (len(rows), worst))
    print('--- candidate corrections D(Z), ratio Delta/D over the families (min is what matters) ---')
    for label, pick in [('D1 = simple-simple pair energy', lambda r: r[2]), ('Dall = all-pairs energy sum_{z!=s} m m K^2', lambda r: r[3])]:
        ratios = [(r[1]['slack'] / pick(r), r[0]) for r in rows if pick(r) > 1e-12]
        viol = [(v, nm) for v, nm in ratios if v < 1 - 1e-9]
        print('%-45s min Delta/D = %.6f (%s); Delta < D on %d of %d' % (label, min(ratios)[0], min(ratios)[1], len(viol), len(ratios)))
        if viol: print('      counterexamples (ratio, family):', [(round(v, 4), nm) for v, nm in viol[:5]])
    # the live zeros: all real and simple, so Delta = off-diagonal mass exactly
    zpath = os.path.join(here, 'zeros600.json')
    if os.path.exists(zpath):
        zs = json.load(open(zpath))
        for T in (100, 300, 600):
            L = math.log(T); g = [z for z in zs if z <= T]
            pts = [(complex(z * L / (2 * math.pi), 0), 1) for z in g]
            d = decompose(pts)
            print('zeros T=%d ' % T, fmt(d))
        print('on the zeros every piece but the Bessel remainder and the second-range squares is zero, and their sum is the off-diagonal pair mass: the slack IS the pair-correlation input.')
    else:
        print('(zeros600.json absent: run  node -e ... findZeros ... to dump the zeros)')
