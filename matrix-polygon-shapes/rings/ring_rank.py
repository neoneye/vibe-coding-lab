"""Rank search for the k-gon (cycle) tensor T_N(C_k) = trace(A1 A2 ... Ak) as a k-linear form.

Leg v carries matrix A_v with entries indexed (a_{v-1}, a_v); the tensor has a 1 wherever the indices
chain around the ring. k = 3 is the N×N matrix multiplication tensor; k = 4 is trace(ABCD).
Known (Christandl–Zuiddam, "Tensor surgery and tensor rank"): for N = 2, even k has rank exactly 2^k;
odd k has 2^(k−1) ≤ R ≤ 2^k − 1, and for the pentagon 24 ≤ R ≤ 31 is open.

Usage: python ring_rank.py k N R seeds [seed0]   -> Levenberg–Marquardt fits from random starts."""
import sys, time, itertools, numpy as np


def ring_tensor(k, N):
    d = N * N
    T = np.zeros((d,) * k)
    for a in itertools.product(range(N), repeat=k):
        T[tuple(a[v - 1] * N + a[v] for v in range(k))] = 1     # leg v: (a_{v-1}, a_v)
    return T


def recon(F):
    k = len(F)
    letters = "abcdefghij"[:k]
    return np.einsum(",".join(f"{c}z" for c in letters) + "->" + letters, *F)


def fit(T, R, seed, iters=3000, scale=0.5, x0=None):
    k, d = T.ndim, T.shape[0]
    rng = np.random.default_rng(seed)
    if x0 is None: x0 = rng.normal(scale=scale, size=k * d * R)
    unpack = lambda x: [m.reshape(d, R) for m in np.split(x, k)]
    letters = "abcdefghij"[:k]

    def res(x):
        return (recon(unpack(x)) - T).ravel()

    def jac(x):
        F = unpack(x)
        J = np.zeros((d ** k, k * d * R))
        for m in range(k):
            others = [F[q] for q in range(k) if q != m]
            sub = [letters[q] for q in range(k) if q != m]
            kr = np.einsum(",".join(f"{c}z" for c in sub) + "->" + "".join(sub) + "z", *others)  # (d,)*(k-1) + (R,)
            full = np.zeros((d,) * k + (d, R))
            for p in range(d):
                idx = [slice(None)] * k; idx[m] = p
                full[tuple(idx) + (p,)] = kr
            J[:, m * d * R:(m + 1) * d * R] = full.reshape(d ** k, d * R)
        return J

    x, lam = x0, 1e-2
    r = res(x); cost = r @ r; hist = []
    for it in range(iters):                      # plain Levenberg–Marquardt (works when unknowns > equations)
        hist.append(cost)
        if cost < 1e-26 or (it > 400 and cost > 0.9995 * hist[-300] and cost > 1e-12): break
        J = jac(x); g = J.T @ r; H = J.T @ J
        while True:
            step = np.linalg.solve(H + lam * (np.diag(np.diag(H)) + 1e-9 * np.eye(len(x))), -g)
            xn = x + step; rn = res(xn); cn = rn @ rn
            if np.isfinite(cn) and cn < cost:
                x, r, cost, lam = xn, rn, cn, max(lam / 3, 1e-12); break
            lam *= 4
            if lam > 1e14: break
        if lam > 1e14: break
    F = unpack(x)
    return np.sqrt(cost), F, max(np.abs(f).max() for f in F)


if __name__ == "__main__":
    k, N, R, seeds = map(int, sys.argv[1:5])
    s0 = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    T = ring_tensor(k, N)
    for s in range(s0, s0 + seeds):
        t = time.time(); err, F, mx = fit(T, R, s)
        print(f"k={k} N={N} R={R} seed={s} err={err:.3e} maxcoef={mx:.2e} ({time.time()-t:.0f}s)", flush=True)
        if err < 1e-10:
            np.save(f"sol_k{k}_N{N}_R{R}_s{s}.npy", np.array(F)); print("FOUND", flush=True)
