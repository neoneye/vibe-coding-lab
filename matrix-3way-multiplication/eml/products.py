"""Build and verify EML trees for products of n variables (log-domain accumulator, K = 8n+1)
and compare with composing the paper's 17-token x*y tree (K = 16(n-1)+1)."""
import numpy as np
from eml_search import evaluate, PTS, FRESH

E = lambda a, b: f"{a} {b} E"
ln = lambda u: E("1", E(E("1", u), "1"))          # ln u, 6 extra tokens
XY = "1 1 1 1 x0 E E 1 E E x1 E 1 E E 1 E"        # paper's shortest x*y (K=17)

def direct(n):
    s = E("1", "x0")                               # e - ln x0
    for i in range(1, n):
        s = E(ln(s), f"x{i}")                      # s <- s - ln x_i
    return E(E("1", E(s, "1")), "1")               # exp(e - s) = prod x_i

def composed(n):
    r = "x0"
    for i in range(1, n):
        r = XY.replace("x1", f"x{i}").replace("x0", r, 1) if i > 1 else XY
    return r

if __name__ == "__main__":
    with np.errstate(all="ignore"):
        for n in (2, 3, 4):
            for name, r in (("composed", composed(n)), ("direct", direct(n))):
                err = max(np.abs(evaluate(r, X) - np.prod(X[:n], axis=0)).max() for X in (PTS, FRESH))
                print(f"n={n} {name:8s} K={len(r.split()):2d}  max err {err:.1e}")
