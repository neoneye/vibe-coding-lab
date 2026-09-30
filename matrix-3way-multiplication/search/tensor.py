"""Chain tensor T_N = trace(A B C D) and a Levenberg-Marquardt rank-R fitter."""
import numpy as np
from scipy.optimize import least_squares


def chain_tensor(n):
    d = n * n
    T = np.zeros((d, d, d, d))
    for i in range(n):
        for j in range(n):
            for k in range(n):
                for l in range(n):
                    T[i*n+j, j*n+k, k*n+l, l*n+i] = 1
    return T


def matmul_tensor(n):
    d = n * n
    T = np.zeros((d, d, d))
    for i in range(n):
        for j in range(n):
            for k in range(n):
                T[i*n+j, j*n+k, k*n+i] = 1
    return T


def recon(F):
    a, b, c, d = F
    return np.einsum('ir,jr,kr,lr->ijkl', a, b, c, d)


def fit(T, R, seed, iters=400, scale=0.5):
    rng = np.random.default_rng(seed)
    d = T.shape[0]
    x0 = rng.normal(scale=scale, size=4 * d * R)

    def unpack(x):
        return np.split(x.reshape(4 * d, R), 4)

    def res(x):
        return (recon(unpack(x)) - T).ravel()

    def jac(x):
        a, b, c, dd = unpack(x)
        n = d
        J = np.zeros((n**4, 4 * n * R))
        fs = [a, b, c, dd]
        for m in range(4):
            others = [fs[q] for q in range(4) if q != m]
            # derivative wrt fs[m][p, r] : delta on index m times prod of others
            sub = ['ir', 'jr', 'kr', 'lr']
            idx = 'ijkl'
            ops = [sub[q] for q in range(4) if q != m]
            part = np.einsum(','.join(ops) + '->' + ''.join(idx[q] for q in range(4) if q != m) + 'r', *others)
            # part has shape (others..., r); place into J
            for p in range(n):
                sl = [slice(None)] * 4
                full = np.zeros((n, n, n, n, R))
                sl2 = [slice(None)] * 4
                sl2[m] = p
                full[tuple(sl2)] = part
                J[:, m * n * R + p * R: m * n * R + (p + 1) * R] = full.reshape(n**4, R)
        return J

    sol = least_squares(res, x0, jac=jac, method='lm', max_nfev=iters, xtol=1e-15, ftol=1e-15, gtol=1e-15)
    return np.linalg.norm(sol.fun), unpack(sol.x)
