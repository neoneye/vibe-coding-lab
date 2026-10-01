"""Christandl–Zuiddam tensor surgery: build a (2^k − 1)-term decomposition of the k-ring tensor of 2×2
matrices from Strassen's 7-term triangle decomposition, then verify it reconstructs T_2(C_k) exactly.

Leg conventions follow ring_rank.ring_tensor: leg v is indexed (a_{v-1}, a_v), flattened as a_{v-1}·2 + a_v.
φ inserts two new legs at leg 0: a rank-1 leg u⊗v becomes Σ_{j1,j2} (u⊗e_j1)⊗(e_j1⊗e_j2)⊗(e_j2⊗v) (4 terms);
the one rank-2 leg M becomes a twisted triangle φ(M) = Strassen with its third leg multiplied by M (7 terms)."""
import numpy as np
from ring_rank import ring_tensor

E = np.eye(2)

def strassen_c3():
    """Strassen's decomposition of T_2(C3) in our leg convention, as three 4×7 factor matrices, exact ±1."""
    # bilinear form trace(X Y Z): T[(a2,a0),(a0,a1),(a1,a2)]; build Strassen from C = A B, trace(A B Z) = Σ C_ij Z_ji
    A_ = lambda i, j: np.outer(E[i], E[j]).ravel()
    terms = [  # (A-form, B-form, output C positions with signs) for C = A·B (Strassen 1969)
        (A_(0,0) + A_(1,1), A_(0,0) + A_(1,1), {(0,0): 1, (1,1): 1}),
        (A_(1,0) + A_(1,1), A_(0,0),            {(1,0): 1, (1,1): -1}),
        (A_(0,0),            A_(0,1) - A_(1,1), {(0,1): 1, (1,1): 1}),
        (A_(1,1),            A_(1,0) - A_(0,0), {(0,0): 1, (1,0): 1}),
        (A_(0,0) + A_(0,1), A_(1,1),            {(0,0): -1, (0,1): 1}),
        (A_(1,0) - A_(0,0), A_(0,0) + A_(0,1), {(1,1): 1}),
        (A_(0,1) - A_(1,1), A_(1,0) + A_(1,1), {(0,0): 1}),
    ]
    # trace(A B Z) = Σ_ij C_ij Z_ji ; in ring convention leg0 = matrix X0 indexed (a2,a0), leg1 X1 (a0,a1), leg2 X2 (a1,a2)
    # trace(X0 X1 X2) with X0 = A, X1 = B, X2 = Z  -> output form on Z: Σ C_ij Z_ji, i.e. Z-vector = Σ sign·e_(j,i)
    F0, F1, F2 = [], [], []
    for a, b, out in terms:
        z = sum(s * A_(j, i) for (i, j), s in out.items())
        F0.append(a); F1.append(b); F2.append(z)
    return [np.array(F).T for F in (F0, F1, F2)]

def recon(F):
    k = len(F); L = "abcdefghij"[:k]
    return np.einsum(",".join(f"{c}z" for c in L) + "->" + L, *F)

def surgery(F):
    """one surgery step: k-ring decomposition -> (k+2)-ring decomposition (legs inserted at leg 0)."""
    S0, S1, S2 = strassen_c3()
    out = [[] for _ in range(len(F) + 2)]
    for r in range(F[0].shape[1]):
        M = F[0][:, r].reshape(2, 2); rest = [f[:, r] for f in F[1:]]
        U, s, Vt = np.linalg.svd(M)
        if s[1] < 1e-12:                                        # rank 1: M = u v^T -> 4 terms
            u, v = U[:, 0] * s[0], Vt[0]
            for j1 in range(2):
                for j2 in range(2):
                    legs = [np.kron(u, E[j1]), np.kron(E[j1], E[j2]), np.kron(E[j2], v)] + rest
                    for o, x in zip(out, legs): o.append(x)
        else:                                                   # rank 2: twisted triangle, 7 terms
            for t in range(7):
                s3 = S2[:, t].reshape(2, 2) @ M                 # third leg (j2, p') -> (j2, q) through M
                legs = [S0[:, t], S1[:, t], s3.ravel()] + rest
                for o, x in zip(out, legs): o.append(x)
    return [np.array(o).T for o in out]

if __name__ == "__main__":
    F = strassen_c3()
    print("triangle: terms", F[0].shape[1], " exact:", np.abs(recon(F) - ring_tensor(3, 2)).max())
    for k in (5, 7):
        F = surgery(F)
        err = np.abs(recon(F) - ring_tensor(k, 2)).max()
        print(f"{k}-ring: terms {F[0].shape[1]} (2^k − 1 = {2**k - 1})  max error {err:.1e}")
        np.save(f"surgery_k{k}.npy", np.array(F))
