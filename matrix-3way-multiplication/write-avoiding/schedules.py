"""Write-expensive / read-free cost model for D = A*B*C (N x N).

Memory: inputs A, B, C and anything stored. Reads are free; every word written to memory costs 1.
Scratch: S registers (the accumulator file). Register traffic is not a memory write, but S is
reported as the resource being traded. The output D must be written: W >= N^2 is a hard lower bound.

Every schedule runs through an instrumented machine, is checked against numpy, and reports
  W   memory writes
  mul scalar multiplications           (log domain: mul -> add of logs + one exp)
  S   peak registers in use
"""
import numpy as np


class Machine:
    def __init__(self, n, log_domain=False):
        self.n, self.log = n, log_domain
        self.W = self.mul = self.add = self.exp = self.ln = 0
        self.live = self.peak = 0

    # registers -----------------------------------------------------------------------------
    def alloc(self, k=1):
        self.live += k; self.peak = max(self.peak, self.live)
    def free(self, k=1):
        self.live -= k
    # arithmetic ------------------------------------------------------------------------------
    def times(self, a, b):
        if self.log:                 # a*b = exp(ln a + ln b); logs of inputs recomputed on read (no writes)
            self.ln += 2; self.add += 1; self.exp += 1
        else:
            self.mul += 1
        return a * b
    def times3(self, a, b, c):       # fused triple product
        if self.log:
            self.ln += 3; self.add += 2; self.exp += 1
        else:
            self.mul += 2
        return a * b * c
    def plus(self, a, b):
        self.add += 1; return a + b
    # memory ----------------------------------------------------------------------------------
    def store(self, M, idx, v):
        self.W += 1; M[idx] = v


def chain(m, A, B, C):
    """T = A B stored in memory, then D = T C. The textbook two-step."""
    n = m.n; T = np.zeros((n, n)); D = np.zeros((n, n))
    for X, Y, Z in ((A, B, T), (T, C, D)):
        for i in range(n):
            for l in range(n):
                m.alloc(); acc = 0.0
                for j in range(n): acc = m.plus(acc, m.times(X[i, j], Y[j, l]))
                m.store(Z, (i, l), acc); m.free()
    return D


def fused_triple(m, A, B, C):
    """Each output written once, D_il = sum_jk A_ij B_jk C_kl, one accumulator."""
    n = m.n; D = np.zeros((n, n))
    for i in range(n):
        for l in range(n):
            m.alloc(); acc = 0.0
            for j in range(n):
                for k in range(n): acc = m.plus(acc, m.times3(A[i, j], B[j, k], C[k, l]))
            m.store(D, (i, l), acc); m.free()
    return D


def fused_tiled(m, A, B, C, S):
    """S output accumulators D[i0:i0+S, l]; each (BC)_jl recomputed once per row tile and held
    in one extra register. W = N^2, mults = N^3 + N^4/S (S | N)."""
    n = m.n; D = np.zeros((n, n))
    for l in range(n):
        for i0 in range(0, n, S):
            rows = range(i0, min(n, i0 + S))
            m.alloc(len(rows)); acc = {i: 0.0 for i in rows}
            for j in range(n):
                m.alloc(); bc = 0.0
                for k in range(n): bc = m.plus(bc, m.times(B[j, k], C[k, l]))
                for i in rows: acc[i] = m.plus(acc[i], m.times(A[i, j], bc))
                m.free()
            for i in rows: m.store(D, (i, l), acc[i])
            m.free(len(rows))
    return D


def fused_column(m, A, B, C):
    """Column l of BC kept in N registers, then column l of D = A (BC)[:,l]. W = N^2, mults 2N^3."""
    n = m.n; D = np.zeros((n, n))
    for l in range(n):
        m.alloc(n); col = np.zeros(n)
        for j in range(n):
            acc = 0.0
            for k in range(n): acc = m.plus(acc, m.times(B[j, k], C[k, l]))
            col[j] = acc
        for i in range(n):
            m.alloc(); acc = 0.0
            for j in range(n): acc = m.plus(acc, m.times(A[i, j], col[j]))
            m.store(D, (i, l), acc); m.free()
        m.free(n)
    return D


def strassen(m, X, Y, spill):
    """Recursive Strassen. spill=True: every temporary block is written to memory (the setting of
    Carson et al.); spill=False: temporaries live in registers. Registers are never reused here,
    so the reported peak is an upper bound on the scratch actually needed."""
    n = X.shape[0]
    if n == 1:
        return np.array([[m.times(X[0, 0], Y[0, 0])]])
    h = n // 2
    a, b, c, d = X[:h, :h], X[:h, h:], X[h:, :h], X[h:, h:]
    e, f, g, k = Y[:h, :h], Y[:h, h:], Y[h:, :h], Y[h:, h:]
    def add(P, Q, s=1):
        R = P + s * Q; m.add += P.size
        if spill: m.W += R.size
        else: m.alloc(R.size)
        return R
    def keep(R):
        if spill: m.W += R.size
        else: m.alloc(R.size)
        return R
    M1 = keep(strassen(m, add(a, d), add(e, k), spill))
    M2 = keep(strassen(m, add(c, d), e, spill))
    M3 = keep(strassen(m, a, add(f, k, -1), spill))
    M4 = keep(strassen(m, d, add(g, e, -1), spill))
    M5 = keep(strassen(m, add(a, b), k, spill))
    M6 = keep(strassen(m, add(c, a, -1), add(e, f), spill))
    M7 = keep(strassen(m, add(b, d, -1), add(g, k), spill))
    Z = np.block([[M1 + M4 - M5 + M7, M3 + M5], [M2 + M4, M1 - M2 + M3 + M6]])
    m.add += 8 * h * h
    return Z


def strassen_chain(m, A, B, C, spill):
    T = strassen(m, A, B, spill)
    m.W += T.size if spill else 0; m.alloc(0 if spill else T.size)
    D = strassen(m, T, C, spill)
    m.W += D.size                                  # output always written
    return D


if __name__ == "__main__":
    rng = np.random.default_rng(0)
    rows = []
    for n in (2, 4, 8, 16):
        A, B, C = (rng.standard_normal((n, n)) for _ in range(3))
        ref = A @ B @ C
        sched = [("chain (AB stored)", lambda m: chain(m, A, B, C)),
                 ("fused triple-sum", lambda m: fused_triple(m, A, B, C)),
                 ("fused tiled S=2", lambda m: fused_tiled(m, A, B, C, 2)),
                 ("fused column (S=N)", lambda m: fused_column(m, A, B, C)),
                 ("Strassen chain, spill", lambda m: strassen_chain(m, A, B, C, True)),
                 ("Strassen chain, regs (upper bd)", lambda m: strassen_chain(m, A, B, C, False))]
        for name, f in sched:
            for log in (False, True):
                m = Machine(n, log)
                D = f(m)
                assert np.allclose(D, ref), (name, n)
                rows.append((n, name + (" [e/ln]" if log else ""), m.W, m.mul, m.exp, m.ln, m.add, m.peak))
    print(f"{'N':>3} {'schedule':40s} {'writes':>7} {'mul':>7} {'exp':>7} {'ln':>7} {'add':>7} {'regs':>6}")
    for r in rows:
        print(f"{r[0]:>3} {r[1]:40s} {r[2]:>7} {r[3]:>7} {r[4]:>7} {r[5]:>7} {r[6]:>7} {r[7]:>6}")
