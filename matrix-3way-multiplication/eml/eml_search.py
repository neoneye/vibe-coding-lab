"""Exhaustive shortest-EML search (Odrzywolek, arXiv:2603.21852).

Grammar  S -> 1 | x | y | ... | eml(S,S),  eml(a,b) = exp(a) - ln(b) (complex, principal branch).
Size K = RPN length = leaves + nodes (always odd).

Bottom-up enumeration by K with numeric-fingerprint dedup (values at a few generic points,
as in the paper's numeric sieve). Only finite values are kept (no extended reals, i.e. the
paper's parenthesised numbers). Meet-in-the-middle at the root: target T = exp(a) - ln(b)
  <=>  b = exp(exp(a) - T)  with  Im(exp(a) - T) in (-pi, pi]   (principal branch),
so a hash lookup over stored functions finds roots of size Ka + Kb + 1 up to 2*Kmax + 1.
Every hit is re-evaluated at fresh points before it is reported.
"""
import sys, time, itertools, numpy as np

PTS = np.array([  # generic points, positive and negative, per variable (columns = sample points)
    [0.5772156649, -1.2824271291, 2.6854520010, -0.3036630029],
    [1.2824271291, 0.9159655942, -1.6180339887, 2.5029078750],
    [-0.9159655942, 1.4142135624, 0.3036630029, -2.2360679775],
    [2.2360679775, -0.5772156649, 1.1319882488, 0.7404804897],
], dtype=np.complex128)
FRESH = np.array([
    [0.7390851332, -1.3035772690, 1.9021605831, -0.6931471806],
    [-1.4513692348, 0.8346268417, 2.8077702420, -1.1865691104],
    [1.6066951524, -2.6651441426, 0.5671432904, 1.0986122887],
    [-0.4053964254, 1.7320508076, -2.0287578381, 0.3678794412],
], dtype=np.complex128)

import os
if os.environ.get("EML_DOMAIN") == "pos":      # restrict to positive reals
    PTS, FRESH = np.abs(PTS), np.abs(FRESH)

EXT = os.environ.get("EML_EXT") == "1"

def cexp(z):
    """complex exp that keeps the real axis real: numpy gives exp(inf+0j) = inf+nan*j."""
    z = np.asarray(z)
    out = np.exp(z)
    real = (z.imag == 0)
    if real.any():
        out = np.where(real, np.exp(z.real) + 0j, out)
    return out

def key(V):
    """row-wise fingerprint: values rounded to ~9 significant digits."""
    s = np.round(V.real, 8) + 0.0, np.round(V.imag, 8) + 0.0
    return np.ascontiguousarray(np.concatenate(s, axis=1)).view(np.dtype((np.void, 16 * V.shape[1]))).ravel()

class Search:
    def __init__(self, nvars, kmax, cap=3_000_000):
        self.nv, self.kmax, self.cap = nvars, kmax, cap
        self.vals, self.prov = {}, {}           # K -> (n,P) values ; K -> list of provenance
        self.seen = set()
        leaves = [("1",)] + [(f"x{i}",) for i in range(nvars)]
        V = np.stack([np.ones(PTS.shape[1], complex)] + [PTS[i] for i in range(nvars)])
        self._add(1, V, leaves)
        with np.errstate(all="ignore"):
            for K in range(3, kmax + 1, 2):
                self._level(K)

    def _add(self, K, V, prov):
        ks = key(V)
        _, first = np.unique(ks, return_index=True)
        keep = [i for i in sorted(first) if ks[i].tobytes() not in self.seen]
        for i in keep: self.seen.add(ks[i].tobytes())
        self.vals[K] = V[keep]; self.prov[K] = [prov[i] for i in keep]

    def _level(self, K):
        Vs, provs = [], []
        for Ka in range(1, K - 1, 2):
            Kb = K - 1 - Ka
            A, B = self.vals[Ka], self.vals[Kb]
            eA, lB = cexp(A), np.log(B)
            for i0 in range(0, len(A), max(1, 4_000_000 // max(1, len(B)))):
                blk = eA[i0:i0 + max(1, 4_000_000 // max(1, len(B)))]
                V = (blk[:, None, :] - lB[None, :, :]).reshape(-1, A.shape[1])
                if EXT:   # extended reals: keep +-inf intermediates (ln 0 = -inf, exp(-inf) = 0), drop NaN
                    ok = ~np.isnan(V).any(1) & ((np.abs(V) < 1e12) | np.isinf(V.real)).all(1)
                else:
                    ok = np.isfinite(V).all(1) & (np.abs(V) < 1e12).all(1)
                idx = np.nonzero(ok)[0]
                Vs.append(V[idx])
                provs.extend(("E", Ka, i0 + j // len(B), Kb, j % len(B)) for j in idx)
        V = np.concatenate(Vs) if Vs else np.zeros((0, PTS.shape[1]), complex)
        self._add(K, V, provs)
        n = len(self.vals[K])
        print(f"  K={K}: {n} new distinct functions (total {len(self.seen)})", flush=True)
        if len(self.seen) > self.cap:
            print("  cap reached; stopping enumeration", flush=True); self.kmax = K
            raise_stop = True
            self.vals = {k: v for k, v in self.vals.items() if k <= K}

    def rpn(self, K, i):
        p = self.prov[K][i]
        if len(p) == 1: return p[0]
        _, Ka, ia, Kb, ib = p
        return f"{self.rpn(Ka, ia)} {self.rpn(Kb, ib)} E"

    def build_index(self):
        self.index = {}
        for K in sorted(self.vals):
            for i, kk in enumerate(key(self.vals[K])): self.index.setdefault(kk.tobytes(), (K, i))

    def solve(self, T, K, depth, small=5, check=None):
        """RPN of a tree of size exactly <= K computing values T (at PTS), or None.
        Root split K = Ka + Kb + 1. If Kb is stored: look b up for every stored a.
        If one side is small (<= `small`), invert the root for the other side and recurse."""
        ok = check or (lambda r: True)
        hit = self.index.get(key(T[None])[0].tobytes())
        if hit and hit[0] <= K and ok(self.rpn(*hit)): return self.rpn(*hit)
        if K <= self.kmax or K < 3: return None     # everything <= kmax is already indexed
        for Ka in range(1, K - 1, 2):
            Kb = K - 1 - Ka
            if Ka <= self.kmax and Kb <= self.kmax:
                W = cexp(self.vals[Ka]) - T[None]
                good = (np.abs(W.imag) <= np.pi + 1e-9).all(1) & np.isfinite(W).all(1)
                Bn = cexp(W)
                for i in np.nonzero(good)[0]:
                    h = self.index.get(key(Bn[i:i+1])[0].tobytes())
                    if h and h[0] <= Kb:
                        c = f"{self.rpn(Ka, i)} {self.rpn(*h)} E"
                        if ok(c): return c
            if depth <= 0: continue
            if Kb <= small and Ka > self.kmax:        # known small b, solve for a: exp(a) = T + ln b
                for Kb2 in range(1, Kb + 1, 2):
                    for j, b in enumerate(self.vals.get(Kb2, [])):
                        base = np.log(T + np.log(b))
                        if not np.isfinite(base).all(): continue
                        # exp(a) fixes a only up to 2*pi*i*k, and k may differ from point to point
                        for ks in itertools.product((0, 1, -1), repeat=len(base)):
                            A = base + 2j * np.pi * np.array(ks)
                            ra = self.solve(A, Ka, depth - 1, small)
                            if ra and ok(f"{ra} {self.rpn(Kb2, j)} E"): return f"{ra} {self.rpn(Kb2, j)} E"
            if Ka <= small and Kb > self.kmax:        # known small a, solve for b = exp(exp(a) - T)
                for Ka2 in range(1, Ka + 1, 2):
                    for i, a in enumerate(self.vals.get(Ka2, [])):
                        W = cexp(a) - T
                        if not (np.isfinite(W).all() and (np.abs(W.imag) <= np.pi + 1e-9).all()): continue
                        rb = self.solve(cexp(W), Kb, depth - 1, small)
                        if rb and ok(f"{self.rpn(Ka2, i)} {rb} E"): return f"{self.rpn(Ka2, i)} {rb} E"
        return None

    def find(self, f, kstop, depth=3, small=5):
        self.build_index()
        T = f(PTS)
        with np.errstate(all="ignore"):
            for K in range(1, kstop + 1, 2):
                r = self.solve(T, K, depth, small, check=lambda c: verify(c, f, self.nv))
                if r: return len(r.split()), r
        return None

def evaluate(rpn, X):
    st = []
    for tok in rpn.split():
        if tok == "1": st.append(np.ones(X.shape[1], complex))
        elif tok == "E":
            b = st.pop(); a = st.pop(); st.append(cexp(a) - np.log(b))
        else: st.append(X[int(tok[1:])].astype(complex))
    return st[0]

def verify(rpn, f, nv):
    with np.errstate(all="ignore"):
        v = evaluate(rpn, FRESH)
    return np.allclose(v, f(FRESH), rtol=1e-9, atol=1e-9)

TARGETS = {
    "x*y":        (2, lambda X: X[0] * X[1]),
    "x*y*z":      (3, lambda X: X[0] * X[1] * X[2]),
    "x*y+z*w":    (4, lambda X: X[0] * X[1] + X[2] * X[3]),
    "x-y":        (2, lambda X: X[0] - X[1]),
    "x+y":        (2, lambda X: X[0] + X[1]),
    "-x":         (1, lambda X: -X[0]),
    "1/x":        (1, lambda X: 1 / X[0]),
    "x^2":        (1, lambda X: X[0] ** 2),
    "x-1":        (1, lambda X: X[0] - 1),
    "x+1":        (1, lambda X: X[0] + 1),
}

if __name__ == "__main__":
    name, kmax, kstop = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    depth = int(sys.argv[4]) if len(sys.argv) > 4 else 3     # 0 = no root-inversion recursion
    nv, f = TARGETS[name]
    t0 = time.time(); S = Search(nv, kmax)
    small = int(sys.argv[5]) if len(sys.argv) > 5 else 5     # max size of the known side when inverting the root
    res = S.find(f, kstop, depth, small)
    print(f"{name}: shortest K = {res[0] if res else f'> {kstop} (not found)'}  rpn = {res[1] if res else '-'}  ({time.time()-t0:.0f}s)", flush=True)
