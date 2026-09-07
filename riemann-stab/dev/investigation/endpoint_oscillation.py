"""Exact endpoint oscillation B = sup Phi - inf Phi of the state potentials behind the
telescoping certificates, in exact fractions of the shipped binary64 coefficients.

Additive certificates (tiling_additive.js, signs SIGN_A=[1,0,-1,-1,0,1], SIGN_B=[0,1,-1,-1,1,0]):
the six-gap correction  a(g0)+a(g5)+b(g1)+b(g4)-h(g2)-h(g3), h=a+b, is the coboundary of
    Phi(s0..s4) = -a(s0) - h(s1) + h(s3) + a(s4)       (checked by expansion below),
so B = 2 osc(a) + 2 osc(h) with independent nonnegative coordinates and constant extension.

Pair certificate (tiling_pair.js): five bilinear corrections psi_k(g_k, g_{k+1}), k=0..4 on
gaps g0..g5, psi_4 = -(psi_0+..+psi_3), on top of the `record` additive base.  Writing the
state potential as Phi_add + sum_{j=0..3} phi_j(s_j, s_{j+1}) and telescoping gives
psi_0 = -phi_0, psi_k = phi_{k-1} - phi_k (k=1..3), psi_4 = phi_3, i.e. phi_j = -(psi_0+..+psi_j).
Phi is affine in each coordinate on every cell of the union grid (additive knots ∪ pair knots)
and constant beyond the last knot, so its extrema are attained at grid vertices; the unary +
adjacent-pair structure makes min/max a dynamic programme along the chain s0..s4.
"""
import json, itertools, random
from fractions import Fraction as Q
from pathlib import Path
DEV = Path(__file__).resolve().parents[1]

def pl(knots, vals, x):
    if x <= knots[0]: return vals[0]
    if x >= knots[-1]: return vals[-1]
    for i in range(len(knots)-1):
        if knots[i] <= x <= knots[i+1]:
            t=(x-knots[i])/(knots[i+1]-knots[i]); return vals[i]*(1-t)+vals[i+1]*t
    raise AssertionError

def bil(knots, grid, J, x, y):
    def idx(v):
        if v <= knots[0]: return 0, Q(0)
        if v >= knots[-1]: return J-2, Q(1)
        for i in range(J-1):
            if knots[i] <= v <= knots[i+1]: return i, (v-knots[i])/(knots[i+1]-knots[i])
        raise AssertionError
    i,fx = idx(x); j,fy = idx(y)
    c00,c01,c10,c11 = grid[i*J+j], grid[i*J+j+1], grid[(i+1)*J+j], grid[(i+1)*J+j+1]
    return (1-fx)*((1-fy)*c00+fy*c01) + fx*((1-fy)*c10+fy*c11)

add = json.loads((DEV/'tiling_additive.certificate.json').read_text())
certs = {c['name']: c for c in add['certificates']}
out = {}
for name, c in certs.items():
    k = list(map(Q, c['knots'])); a = list(map(Q, c['a'])); b = list(map(Q, c['b'])); h=[x+y for x,y in zip(a,b)]
    # coboundary check on random gaps
    rnd = random.Random(1)
    for _ in range(50):
        g=[Q(rnd.randint(0,30000),1000) for _ in range(6)]
        corr = pl(k,a,g[0])+pl(k,a,g[5])+pl(k,b,g[1])+pl(k,b,g[4])-pl(k,h,g[2])-pl(k,h,g[3])
        Phi = lambda s: -pl(k,a,s[0])-pl(k,h,s[1])+pl(k,h,s[3])+pl(k,a,s[4])
        assert Phi(g[1:6])-Phi(g[0:5]) == corr
    B = 2*(max(a)-min(a)) + 2*(max(h)-min(h))
    Atail = 2*(max(map(abs,a))+max(map(abs,b))+max(map(abs,h)))
    out[name] = {'B_exact': str(B), 'B': float(B), 'A_tail': float(Atail), 'coboundary_identity_checked': True}

# pair certificate on the record base
pair = json.loads((DEV/'tiling_pair.stationary.json').read_text())
pk = list(map(Q, pair['knots'])); J=len(pk); free=pair['free']
coef = list(map(Q, pair['coefficients']))
mats = [coef[t*J*J:(t+1)*J*J] for t in range(free)]
tail = [-sum(m[i] for m in mats) for i in range(J*J)]
psi = mats+[tail]            # psi_0..psi_4
phi = []                     # phi_j = -(psi_0+..+psi_j), j=0..3
acc=[Q(0)]*(J*J)
for j in range(4):
    acc=[x+y for x,y in zip(acc,psi[j])]; phi.append([-x for x in acc])
# telescoping identity check: psi_k(g_k,g_{k+1}) = [Phi'(g1..g5)-Phi'(g0..g4)] pieces
base = certs[pair['base']]
k = list(map(Q, base['knots'])); a=list(map(Q,base['a'])); b=list(map(Q,base['b'])); h=[x+y for x,y in zip(a,b)]
def PhiPair(s):
    v = -pl(k,a,s[0])-pl(k,h,s[1])+pl(k,h,s[3])+pl(k,a,s[4])
    for j in range(4): v += bil(pk,phi[j],J,s[j],s[j+1])
    return v
rnd=random.Random(2)
for _ in range(30):
    g=[Q(rnd.randint(0,14000),1000) for _ in range(6)]
    corr = pl(k,a,g[0])+pl(k,a,g[5])+pl(k,b,g[1])+pl(k,b,g[4])-pl(k,h,g[2])-pl(k,h,g[3])
    corr += sum(bil(pk,psi[t],J,g[t],g[t+1]) for t in range(5))
    assert PhiPair(g[1:6])-PhiPair(g[0:5]) == corr, 'pair coboundary identity failed'
# DP over the union grid (extrema of a per-coordinate-affine function lie at vertices;
# constant extension beyond the last knot means the last knot itself is a vertex).
U = sorted(set(k)|set(pk))
un = [lambda s: -pl(k,a,s), lambda s: -pl(k,h,s), lambda s: Q(0), lambda s: pl(k,h,s), lambda s: pl(k,a,s)]
def dp(sign):
    best = [sign*un[0](u) for u in U]
    for j in range(4):
        nb=[]
        for v in U:
            uv = sign*un[j+1](v)
            nb.append(max(best[i] + sign*bil(pk,phi[j],J,U[i],v) for i in range(len(U))) + uv)
        best=nb
    return sign*max(best)
Pmax = dp(1); Pmin = dp(-1)
# validate the DP on a coarse sub-grid against brute force
sub = U[::max(1,len(U)//7)][:7]
def dp_sub(sign):
    best=[sign*un[0](u) for u in sub]
    for j in range(4):
        best=[max(best[i]+sign*bil(pk,phi[j],J,sub[i],v) for i in range(len(sub)))+sign*un[j+1](v) for v in sub]
    return sign*max(best)
brute = [PhiPair(s) for s in itertools.product(sub,repeat=5)]
assert dp_sub(1)==max(brute) and dp_sub(-1)==min(brute), 'DP disagrees with brute force on the sub-grid'
Bp = Pmax-Pmin
out['pair (on record)'] = {'B_exact': str(Bp), 'B': float(Bp), 'sup_Phi': float(Pmax), 'inf_Phi': float(Pmin),
    'union_grid_points': len(U), 'dp_validated_on_subgrid_size': len(sub), 'coboundary_identity_checked': True,
    'record_base_B': out['record']['B'], 'earlier_guess_B_plus_4cap': out['record']['A_tail']+8e-5}
print(json.dumps(out, indent=2))
