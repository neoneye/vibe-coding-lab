"""Conditional projections from a chain floor through n_point_bound / n_point_bound_of_windowSum.

Two scores per certificate, kept separate as the follow-up plan requires:
  conservative : c_eff = min(c*W - B, 1)/W, the window-sum form the telescoping adapter gives,
                 W chosen among the integers near the cap (needs c*W - B > 0);
  signed-cap   : the projection at the floor c itself with the stricter cap c*W + B <= 1,
                 which is what the (unproved) signed-endpoint extension would deliver.
Also the naive number (no endpoint term), which is NOT a valid target.
Exact rationals for c, B, W, m, p; H and Phi in mpmath at 40 digits (numerical, not enclosed).
Coefficients are the exact binary64 values of the shipped certificates (endpoint_oscillation.py).
"""
import json, sys
from fractions import Fraction as Q
from mpmath import mp, mpf, sqrt, cot
mp.dps = 40
H = mpf(3)/2 - cot(1/sqrt(2))/sqrt(2)
def R(q): return mpf(q.numerator)/q.denominator
def Phi(n, c, m, p):  # Lean Phi_n: (H - (n-1)(m-1)/(p m)) / (1 - c (m-(n-1))/m)
    return (H - mpf(n-1)*(m-1)/(mpf(p)*m)) / (1 - R(c)*(m-(n-1))/m)

def conservative(n, c, B, p):
    best = None
    Wcap = int((1 + B) / c)            # c W - B <= 1  <=>  W <= (1+B)/c
    for W in range(max(1, Wcap - 3), Wcap + 2):
        L = min(c*W - B, Q(1))
        if L <= 0: continue
        ceff = L / W; m = W + n - 1
        val = Phi(n, ceff, m, p)
        if best is None or val > best[3]: best = (W, m, ceff, val)
    return best
def signed_cap(n, c, B, p):
    W = int((1 - B) / c)               # c W + B <= 1
    m = W + n - 1
    return (W, m, c, Phi(n, c, m, p))
def naive(n, c, p):
    W = int(1 / c); m = W + n - 1
    return (W, m, c, Phi(n, c, m, p))

osc = {  # from endpoint_oscillation.py, exact
  'sharp':   (Q('0.003956'),            Q(7881563579278889, 4611686018427387904)),
  'compact': (Q('0.003950948242'),      Q(96764894522698103, 73786976294838206464)),
  'record':  (Q('0.003957227285'),      Q(298225007605550441, 36893488147419103232)),
  'pair (on record)': (Q('0.003957393309'), Q(300554237605695997, 36893488147419103232)),
}
n, p = 7, 3000
rows = []
for name, (c, B) in osc.items():
    W1, m1, c1, v1 = conservative(n, c, B, p)
    W2, m2, c2, v2 = signed_cap(n, c, B, p)
    W0, m0, c0, v0 = naive(n, c, p)
    rows.append((name, float(c), float(B), W1, m1, float(c1), mp.nstr(v1, 12), W2, m2, mp.nstr(v2, 12), W0, m0, mp.nstr(v0, 12)))
print(f"{'certificate':18s} {'floor c':>12s} {'B':>10s} | conservative: W  m   c_eff        Phi      | signed-cap: W  m   Phi      | naive: W  m   Phi")
for r in rows:
    print(f"{r[0]:18s} {r[1]:12.10f} {r[2]:10.7f} | {r[3]:3d} {r[4]:3d} {r[5]:.10f} {r[6]:>13s} | {r[7]:3d} {r[8]:3d} {r[9]:>13s} | {r[10]:3d} {r[11]:3d} {r[12]:>13s}")
print("\nreference: per-block Ainta 19/5000 ->", mp.nstr(Phi(7, Q(19,5000), 269, 3000), 12),
      "| zeta-lab 8-point ->", mp.nstr(Phi(8, Q(41763,10**7), 246, 3200), 12),
      "| zeta-lab 4-point (Lean) ->", mp.nstr(Phi(4, Q(2310,10**6), 435, 2500), 12))
print("the compiled sharp instance uses c = 394924/10^8 at m = 259:", mp.nstr(Phi(7, Q(394924,10**8), 259, 3000), 12),
      " (cap c*253 =", float(Q(394924,10**8)*253), ")")
print("note: the Lean theorem takes p : Nat; a real pressure such as 3370.45 needs integer neighbours or an extension.")
