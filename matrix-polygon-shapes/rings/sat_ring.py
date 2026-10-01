"""Exact tensor rank over GF(2) of the k-ring tensor of 2×2 matrices, by SAT (CaDiCaL via python-sat).
T = Σ_{r<R} x_r^(0) ⊗ ... ⊗ x_r^(k−1) over GF(2): for every entry (4^k of them) the XOR over r of the AND of
the k selected bits must equal T's entry. Symmetry breaking: terms sorted lexicographically by their leg-0 bits.
Usage: python sat_ring.py k R"""
import sys, itertools, time
from pysat.formula import IDPool, CNF
from pysat.solvers import Cadical195
import numpy as np
from ring_rank import ring_tensor

k, R = int(sys.argv[1]), int(sys.argv[2])
T = ring_tensor(k, 2).astype(int); d = 4
pool, cnf = IDPool(), CNF()
X = [[[pool.id(("x", r, m, p)) for p in range(d)] for m in range(k)] for r in range(R)]
cnt = [0]
def fresh(): cnt[0] += 1; return pool.id(("aux", cnt[0]))
for idx in itertools.product(range(d), repeat=k):
    lits = []
    for r in range(R):
        z = fresh(); ins = [X[r][m][idx[m]] for m in range(k)]
        for v in ins: cnf.append([-z, v])
        cnf.append([z] + [-v for v in ins])
        lits.append(z)
    acc = lits[0]
    for b in lits[1:]:
        z = fresh(); cnf.extend([[-z, acc, b], [-z, -acc, -b], [z, -acc, b], [z, acc, -b]]); acc = z
    cnf.append([acc] if T[idx] else [-acc])
for r in range(R):                                   # every term nonzero on every leg
    for m in range(k): cnf.append(X[r][m])
# lexicographic order of leg-0 bit-vectors (non-strict) between consecutive terms
for r in range(R - 1):
    a, b = X[r][0], X[r + 1][0]
    eq_prefix = []
    for p in range(d):
        cnf.append([-x for x in eq_prefix] + [-a[p], b[p]])          # if prefix equal: a_p ≤ b_p
        e = fresh(); cnf.extend([[-e, -a[p], b[p]], [-e, a[p], -b[p]], [e, a[p], b[p]], [e, -a[p], -b[p]]])
        eq_prefix.append(e)
t0 = time.time()
print(f"k={k} R={R}: {cnf.nv} vars, {len(cnf.clauses)} clauses", flush=True)
with Cadical195(bootstrap_with=cnf.clauses) as S:
    ok = S.solve()
    print(f"k={k} R={R}: {'SAT' if ok else 'UNSAT'} over GF(2) in {time.time()-t0:.0f}s", flush=True)
