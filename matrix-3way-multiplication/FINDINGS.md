# Findings

Status: **no breakthrough — two rigorous negative results** for the natural meanings
of "3-way multiplication". No HTML page (per the brief: only on a concrete breakthrough).

## 1. A fused 3-way algorithm (sum of products of three linear forms) has rank exactly N⁴

`T_N = trace(ABCD)`; a 3-way algorithm is a rank-R decomposition of `T_N`
(see README). The *(A,C | B,D)* flattening sends row `(i,j,k,l)` to the unique column
`(jk, li)`, i.e. it is an injective 0/1 map, so it has rank N⁴ (checked numerically:
`search/flattenings.py` → ranks 16, 81, 256 for N = 2, 3, 4). Tensor rank ≥ flattening
rank, and the naive algorithm has N⁴ terms, so **R(T_N) = N⁴** — the fused approach
cannot even match the naive chain (2N³), let alone Strassen-chained (14 at N=2).

Numerical corroboration (`search/run.py`, Levenberg–Marquardt, 30 random starts per R):
R = 16 converges (err 2e-15); every R < 16 stalls at error exactly √(16−R), i.e. the
naive decomposition with terms deleted — no hidden cheaper decomposition.
(Border rank is also pinned: border rank ≥ flattening rank, so even approximate
low-rank schemes are ruled out.)

## 2. Two-level nested algorithms cannot beat chained 2-way multiplication

Architecture: level 1 computes `s` bilinear products `p_k = ℓ_k(A)·m_k(B)`; level 2
computes `t` products `q_r = (Σ_k α_rk p_k)·c_r(C)`; `ABC` is a linear combination of
the `q_r` (chain = `s = t = R(⟨N,N,N⟩)`; the mirrored order `A·(BC)` is symmetric).
Write the four-tensor as `T = Σ_r W_r ⊗ M_r`, `W_r = c_r⊗d_r`, `M_r ∈ span(p_k)`.

* The (AB | CD) flattening of `T` has image `U = {(AB)_ij}`, so `U ⊆ span(M_r) ⊆ span(p_k)`:
  `s` rank-one bilinear forms span the matrix-product forms ⇒ `s ≥ R(⟨N,N,N⟩)`.
* Symmetrically `V = {(CD)_ji} ⊆ span(W_r)` with each `W_r` rank one ⇒ `t ≥ R(⟨N,N,N⟩)`.

So `s + t ≥ 2·R(⟨N,N,N⟩)`, which the chain attains. **In this architecture a 3-way
algorithm is exactly as good as two 2-way ones, and beating the chain for N=3 would
require R(⟨3,3,3⟩) < 23, a famous open problem.** For N=2 (R=7, proven optimal) 14 is optimal here.

## Not ruled out

General arithmetic circuits (more levels, mixed-degree intermediates) are not covered;
homogenisation does not obviously preserve the multiplication count. A sharper
search would be a SAT/SMT or gradient search over 3-level circuits for N=2 with ≤ 13
binary multiplications. That is the only remaining avenue for a positive result.
