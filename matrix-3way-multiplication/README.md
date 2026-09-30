# matrix-3way-multiplication

**Question.** Computing `A·B·C` for N×N matrices is normally done as two matrix
multiplications `(A·B)·C`. With Strassen for each step that is 7 + 7 = 14 scalar
multiplications for N=2 (naive: 8 + 8 = 16). Can a *3-way* algorithm that treats
`A,B,C` jointly beat two chained 2-way multiplications?

## Formalisation

`A·B·C` has N² outputs. Pairing it with a fourth matrix `D` gives the 4-linear form

    T_N(A,B,C,D) = trace(A·B·C·D) = Σ A_ij B_jk C_kl D_li

a tensor in (ℂ^{N²})^{⊗4}. A rank-R decomposition

    T_N = Σ_{r=1..R}  a_r(A) · b_r(B) · c_r(C) · d_r(D)      (a_r, b_r, c_r, d_r linear forms)

is a *3-way algorithm*: R products of three linear forms, each scattered into the
outputs by `d_r`. Two cost models, reported side by side:

| model | cost of the 3-way algorithm | chained baseline (N=2) |
|---|---|---|
| ternary gate (a·b·c is one multiplication) | R | 14 binary multiplications |
| binary gates only (a·b·c = two multiplications) | 2R | 14 |

Observations that frame the search:

* Restricting `D = I` gives `trace(ABC)`, the matrix multiplication tensor ⟨N,N,N⟩,
  so `R(T_N) ≥ R(⟨N,N,N⟩)` — for N=2 that is ≥ 7, hence under the binary model the
  3-way algorithm can at best tie the chain (14), and only if `R(T_2) = 7`.
* Naive upper bound: `R(T_N) ≤ N⁴` (16 for N=2).

## Plan

1. `search/` — numerical (Levenberg–Marquardt / ALS) search for rank-R decompositions
   of `T_N`, N = 2, 3; find the smallest R that converges to ~1e-12.
2. Rationalise/sparsify hits to exact integer or rational coefficients; check exactly.
3. `lean/` — Lean 4 certificates: any claimed decomposition is verified by `ring`/`decide`
   over ℤ (or ℚ), so a claimed result is a machine-checked fact.
4. Only when there is a concrete breakthrough: a standalone HTML page.

## Status

See `FINDINGS.md` (kept up to date as results land).
