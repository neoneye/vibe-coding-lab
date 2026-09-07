"""Finite model of the signed-endpoint route (follow-up plan, step 3), exact rationals.

The chain S11 -> S13 -> S15 with the endpoint term kept:
  S11 (signed):  c*W - Delta_s <= E_s + q*span_s,   Delta_s = Phi(state_{s+W}) - Phi(state_s)
  S12/S13:       D_s >= min(1, E_s - 2 m^2 delta)   (S12 is a theorem; here taken as given)
  S15:           sum over every consecutive full block start s = 0..M-m, then average offsets.
Checks:
  (1) the telescope  sum_s Delta_s = sum(last W potentials) - sum(first W potentials), exactly,
      and |sum_s Delta_s| <= W*B, for lists of length M near m, m+W, 2m, 3m, 5m, with both signs;
  (2) with the side condition c*W + B <= 1 the signed S13 step holds for every block, both
      clipping branches; without it, an explicit counterexample where clipping breaks it.
Phi is the sharp certificate's state potential on real (random rational) gap data.
"""
import json, random
from fractions import Fraction as Q
from pathlib import Path
DEV = Path(__file__).resolve().parents[1]
add = json.loads((DEV/'tiling_additive.certificate.json').read_text())
c = {x['name']: x for x in add['certificates']}['sharp']
k = list(map(Q, c['knots'])); a = list(map(Q, c['a'])); b = list(map(Q, c['b'])); h = [x+y for x,y in zip(a,b)]
def pl(v, x):
    if x <= k[0]: return v[0]
    if x >= k[-1]: return v[-1]
    for i in range(len(k)-1):
        if k[i] <= x <= k[i+1]:
            t=(x-k[i])/(k[i+1]-k[i]); return v[i]*(1-t)+v[i+1]*t
def Phi(s): return -pl(a,s[0]) - pl(h,s[1]) + pl(h,s[3]) + pl(a,s[4])
B = 2*(max(a)-min(a)) + 2*(max(h)-min(h))
n = 7
rnd = random.Random(7)
fails = 0
def check(name, cond, detail=''):
    global fails
    print(('  OK   ' if cond else '  FAIL ') + name + (' -- '+detail if detail else ''))
    if not cond: fails += 1

print('--- (1) the telescope over all consecutive full blocks, exactly ---')
for m in [20, 40]:
    W = m - (n-1)
    for M in [m, m+1, m+W, 2*m, 3*m, 5*m+3]:
        # strictly increasing rational points, gaps in a range that exercises the knot grid
        gaps = [Q(rnd.randint(1, 4000), 1000) for _ in range(M-1)]
        # states: state_i = gaps[i..i+4]; a block starting at s has W windows, states s..s+W
        def state(i): return gaps[i:i+5]
        total = sum(Phi(state(s+W)) - Phi(state(s)) for s in range(M-m+1))
        last_states = range(M-m+1, M-m+1+W)      # states s+W for s = M-m+1-W .. M-m  -> the final W
        tele = sum(Phi(state(i)) for i in range(M-m+1, M-m+1+W)) - sum(Phi(state(i)) for i in range(0, W))
        check(f'm={m} M={M}: sum_s Delta_s == final-W minus initial-W potentials', total == tele)
        check(f'm={m} M={M}: |sum_s Delta_s| <= W*B ({float(abs(total)):.3e} <= {float(W*B):.3e})', abs(total) <= W*B)
        # both signs occur across samples: report
print('   (B =', float(B), ')')

print('--- (2) the clipped S13 step with a signed right-hand side ---')
# abstract block data: E (energy), span, delta=0, q>0.  S11 signed gives E + q*span >= cW - Delta.
# S13 needs  D + q*span >= cW - Delta  from  D >= min(1, E).
q = Q(6, 3000)
def s13_holds(cW, Delta, E, span):
    D = min(Q(1), E)                      # the worst case allowed by S12
    assert E + q*span >= cW - Delta      # S11 signed premise
    return D + q*span >= cW - Delta
ok = True
for _ in range(2000):
    cW = Q(rnd.randint(900, 999), 1000); Delta = Q(rnd.randint(-2000, 2000), 10**6)
    if cW + B > 1: continue
    # E large or small, span random; enforce the S11 premise by construction
    span = Q(rnd.randint(0, 3000), 100); E = max(Q(0), cW - Delta - q*span) + Q(rnd.randint(0, 3000), 1000)
    if abs(Delta) > B: continue
    ok = ok and s13_holds(cW, Delta, E, span)
check('with c*W + B <= 1 and |Delta| <= B, the clipped step holds on 2000 random blocks', ok)
# counterexample without the cap: cW - Delta > 1 while E is huge and span = 0
cW = Q(999, 1000); Delta = Q(-5, 1000); E = Q(10); span = Q(0)
check('without the cap (c*W - Delta = 1.004 > 1) clipping breaks the step: D = min(1,E) = 1 < 1.004',
      not s13_holds(cW, Delta, E, span))
# and the sufficient condition for sharp at W = 252
cW252 = Q('0.003956')*252
check(f'sharp at W=252: c*W + B = {float(cW252+B):.8f} <= 1', cW252 + B <= 1)
check(f'sharp at W=253: c*W + B = {float(Q("0.003956")*253+B):.8f} > 1 (so the signed cap costs one window)', Q('0.003956')*253 + B > 1)
print('\nMODEL', 'FAIL %d' % fails if fails else 'PASS')
