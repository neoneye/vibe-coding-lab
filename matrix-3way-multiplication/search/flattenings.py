"""Matrix ranks of the three balanced flattenings of T_N = trace(ABCD).
rank(T) >= max flattening rank, so these are rigorous lower bounds on tensor rank."""
import numpy as np
from tensor import chain_tensor
for n in (2, 3, 4):
    T = chain_tensor(n); d = n * n
    out = {}
    for name, perm in [("AB|CD", (0,1,2,3)), ("AC|BD", (0,2,1,3)), ("AD|BC", (0,3,1,2))]:
        M = np.transpose(T, perm).reshape(d*d, d*d)
        out[name] = np.linalg.matrix_rank(M)
    print(f"N={n}: flattening ranks {out}  (N^4 = {n**4})")
