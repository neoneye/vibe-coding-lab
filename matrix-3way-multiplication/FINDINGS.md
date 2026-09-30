# Findings

Status: **no breakthrough.**

* Two rigorous negative results for the natural meanings of "3-way multiplication" (sections 1 and 2).
* A numerical search of degree-bounded circuits (section 3) finds no exact 13-multiplication algorithm for 2×2.
* It only finds *approximate* (border) 13-schemes, and those turn out to be a commutative border trick for A·B alone, not a 3-way effect.

No HTML page (per the brief: only on a concrete breakthrough).

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

## 3. General circuits for N=2 with 13 multiplications (attempted)

**Fully general straight-line programs** (`search/circuit.py`): each gate multiplies
two affine combinations of inputs and all earlier gates. Sample-based LM fitting fails
even at L=14: nested gates create huge-degree terms that overfit the sample points.
Not usable as a search tool.

**Degree-bounded circuits** (every gate of degree ≤ 3; `search/deg3.py`, `deg3h.py`).
This is strictly larger than section 2's model: linear forms may mix A, B and C, which
allows commutative (Winograd-style) tricks. Constants and linear terms provably don't
help. The quadratic part of the output can always be cancelled, so the model reduces to

    (ABC)_i = Σ_r γ_ir · v_r · P_r ,   P_r = Σ_k α_rk ℓ_k m_k        cost s + t

with ℓ_k, m_k, v_r linear forms in all 12 entries.

* Control: s = t = 7 converges from about 1 in 10 random starts.
* s + t = 13, all splits s = 5…9, 60 LM starts each (286 runs finished):

  | split (s,t) | best residual |
  |---|---|
  | (5,8) | 36 |
  | (6,7) | **3.2e-3** (three runs near 0) |
  | (7,6) | 28 |
  | (8,5) | 41 |
  | (9,4) | 57 |

* The (6,7) near-hits are **border (approximate) schemes, not algorithms.**
  - Ridge continuation (`ridge.py`, minimising fit² + μ‖p‖², μ → 0) gives residual ∝ ‖p‖⁻³: the error falls only as coefficients diverge.
  - That is an order-1 border decomposition: every product carries an ε^(-1/3) factor from each of three parameter groups, giving 1/ε terms that cancel, with an O(ε) remainder.
  - Structure: the 6 quadratic gates are (a + εb)(a′ + εb′) with a, a′ ∈ A and b, b′ ∈ B. Each supplies a rank-2 AB-part ab′ + ba′, while the A·A·C junk cancels among the cubic gates.
* **This is not a 3-way effect.** The same thing happens for A·B alone (`quad_ab.py`, `quad_ab_ridge.py`):
  - 6 commutative products fit 2×2 A·B to 2e-3, with residual ∝ ‖p‖⁻³ under ridge continuation.
  - 7 products fit exactly (6e-14).
  - Exact multiplicative complexity is 7 (Winograd 1971), so 2×2 A·B apparently has *border* quadratic complexity ≤ 6 (numerical evidence).
  - The A·B·C "13" is just that border-6 followed by the ordinary 7 for ·C. Commutative/quadratic algorithms don't recurse to block matrices, so it gives no asymptotic gain either.

**Exact search over GF(2)** (`search/sat_gf2.py`, CaDiCaL via python-sat).
The same homogeneous model, matched coefficient by coefficient as formal polynomials.
Finite fields have no border phenomena, so SAT/UNSAT is exact for GF(2).

* (7,7): SAT in 26 min. The solver independently found the A·(BC) chain.
* 13 splits (6,7), (7,6), (5,8), (8,5): running (see below).

## Not ruled out

Circuits whose intermediates exceed degree 3 and cancel later. Over ℝ/ℂ, the
homogeneous-model question for 13 has numerical evidence only. It is not proven.

## Lean certificates

`lean/Chain.lean` (core Lean 4.34, no Mathlib — the Mathlib fetch fails here on a Lake/git
partial-clone error; verify with `lean lean/Chain.lean`):
`strassen_chain` (Strassen∘Strassen = A·B·C, 14 mults), `mul_assoc'`, and
`flatten_injective` (the injectivity core of the N⁴ bound, for all N). The step
"injective 0/1 flattening ⇒ rank N⁴ ⇒ tensor rank ≥ N⁴" is linear algebra that is
only checked numerically (`search/flattenings.py`), not in Lean.
