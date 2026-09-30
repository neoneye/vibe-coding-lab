"""Exact SAT search over GF(2) for the homogeneous degree-3 model

    (ABC)_i = sum_r ga_ir * v_r * P_r ,   P_r = sum_k al_rk * l_k * m_k      (cost s + t)

as an identity of formal polynomials over GF(2) (coefficients of all 364 cubic monomials
in 12 variables, squares included). SAT => an exact GF(2) algorithm; UNSAT => none over GF(2)."""
import sys, itertools, time
from pysat.formula import IDPool, CNF
from pysat.solvers import Cadical195

NV = 12
def var_index(M, i, j): return {"A": 0, "B": 4, "C": 8}[M] + 2 * i + j

def target():
    """dict: output i -> set of monomials (sorted tuples) with coefficient 1 (over GF(2))."""
    T = {}
    for i in range(2):
        for l in range(2):
            mons = set()
            for j in range(2):
                for k in range(2):
                    mons ^= {tuple(sorted((var_index("A", i, j), var_index("B", j, k), var_index("C", k, l))))}
            T[2 * i + l] = mons
    return T

def build(s, t):
    pool = IDPool(); cnf = CNF()
    V = lambda *k: pool.id(k)
    TRUE = V("true"); cnf.append([TRUE])

    def AND(a, b):
        z = pool.id(("and", a, b)) if a < b else pool.id(("and", b, a))
        if z not in done:
            done.add(z); cnf.extend([[-z, a], [-z, b], [z, -a, -b]])
        return z
    def XOR_eq(lits, rhs):
        """encode XOR(lits) == rhs via a Tseitin chain."""
        if not lits:
            if rhs: cnf.append([])
            return
        acc = lits[0]
        for b in lits[1:]:
            z = pool.id(("xor", acc, b, len(done)))
            done.add(z)
            cnf.extend([[-z, acc, b], [-z, -acc, -b], [z, -acc, b], [z, acc, -b]])
            acc = z
        cnf.append([acc] if rhs else [-acc])
    def XOR_def(lits):
        """fresh var equal to XOR(lits) (lits may be empty -> constant false)."""
        z = pool.id(("xdef", len(done))); done.add(z)
        if not lits: cnf.append([-z]); return z
        XOR_eq(lits + [z], 0)
        return z
    done = set()

    l = [[V("l", k, a) for a in range(NV)] for k in range(s)]
    m = [[V("m", k, a) for a in range(NV)] for k in range(s)]
    v = [[V("v", r, a) for a in range(NV)] for r in range(t)]
    al = [[V("al", r, k) for k in range(s)] for r in range(t)]
    ga = [[V("ga", i, r) for r in range(t)] for i in range(4)]

    quad = [(a, b) for a in range(NV) for b in range(a, NV)]
    # coefficient of x_a x_b in l_k m_k
    c = {}
    for k in range(s):
        for (a, b) in quad:
            c[k, a, b] = AND(l[k][a], m[k][a]) if a == b else XOR_def([AND(l[k][a], m[k][b]), AND(l[k][b], m[k][a])])
    # P_r coefficients
    P = {}
    for r in range(t):
        for (a, b) in quad:
            P[r, a, b] = XOR_def([AND(al[r][k], c[k, a, b]) for k in range(s)])
    # u_ir = ga_ir * v_r
    u = [[[AND(ga[i][r], v[r][a]) for a in range(NV)] for r in range(t)] for i in range(4)]
    T = target()
    for i in range(4):
        for mon in itertools.combinations_with_replacement(range(NV), 3):
            lits = []
            for r in range(t):
                for a in sorted(set(mon)):
                    rest = list(mon); rest.remove(a); x, y = rest
                    lits.append(AND(u[i][r][a], P[r, x, y]))
            XOR_eq(lits, 1 if mon in T[i] else 0)
    # light symmetry breaking: every gate used (nonzero forms)
    for k in range(s): cnf.append(l[k]); cnf.append(m[k])
    for r in range(t): cnf.append(v[r]); cnf.append(al[r])
    return cnf, (l, m, v, al, ga)

if __name__ == "__main__":
    s, t = int(sys.argv[1]), int(sys.argv[2])
    t0 = time.time(); cnf, vs = build(s, t)
    print(f"s={s} t={t}: {cnf.nv} vars, {len(cnf.clauses)} clauses, built in {time.time()-t0:.1f}s", flush=True)
    with Cadical195(bootstrap_with=cnf.clauses) as S:
        ok = S.solve()
        print(f"s={s} t={t}: {'SAT' if ok else 'UNSAT'} in {time.time()-t0:.0f}s", flush=True)
        if ok:
            mdl = set(x for x in S.get_model() if x > 0)
            l, m, v, al, ga = vs
            bits = lambda row: "".join("1" if x in mdl else "0" for x in row)
            for k in range(s): print("l", k, bits(l[k]), "m", bits(m[k]))
            for r in range(t): print("v", r, bits(v[r]), "al", bits(al[r]))
            for i in range(4): print("ga", i, bits(ga[i]))
