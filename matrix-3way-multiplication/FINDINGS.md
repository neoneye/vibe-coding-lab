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
* (8,5): **UNSAT** (48 min), so no exact 13-mult scheme with that split exists over GF(2).
* (6,7), (7,6), (5,8): still running at the time of writing.

## 4. EML (exp-minus-log) trees — see `eml/README.md`

Direct EML search does compress `x·y·z`: 25 tokens against 33 for composing `mul`, and in general
8n+1 against 16(n−1)+1. The reason is that EML multiplies in log space
(`exp(ln x + ln y + ln z)`), so the saving is the removed exp/ln round-trip, not fewer
multiplications. The tree contains no `*` at all. Under EML's cost model addition is the
expensive operation, so it does not inform the 13-vs-14 multiplication question.

## 5. Write-expensive / read-free model — see `write-avoiding/README.md`

Here the 3-way view pays off.
- Fusing A·B·C writes only the N² outputs (the optimum), against 2N² for the chain.
- With N registers (one column of BC) it needs no extra arithmetic: still 2N³ multiplications.
- With S registers it costs N³ + N⁴/S multiplications.
- In the e/ln domain a triple product is a single exp. The scratch-free fused sum then costs N⁴ exps, which ties the chain at N = 2 with half the writes.
- Strassen-like schedules are bad for writes unless every temporary fits in scratch (Carson, Demmel et al. 2015).

## Not ruled out

Circuits whose intermediates exceed degree 3 and cancel later. Over ℝ/ℂ, the
homogeneous-model question for 13 has numerical evidence only. It is not proven.

## 6. Repeated values: caching products (page section 5)

With only k distinct values, scalar products recur. Measured multiplications on random matrices (N = 32):

| k | chain | chain + product cache | pair cache + grouping, A·(BC) | fused triple table |
|---|---|---|---|---|
| 2 | 65,536 | 608 | 2,052 | **12** |
| 4 | 65,536 | 4,112 | 4,112 | **80** |
| 16 | 65,536 | 14,432 | 14,688 | **4,352** |
| all distinct | 65,536 | 65,536 | 65,536 | 1,081,344 |

* Caching by value pair is exactly distributive grouping. Even the plain chain benefits (≈ k² + N²k), because each entry of A·B meets only k values of C.
* The three-way effect: a fused triple table needs at most k² + k³ multiplications, independent of N. It pays with N⁴ additions instead of ≈ N³, so it wins on multiplications only when k < N.
* Prior art for two factors: Four Russians, the Mailman algorithm, LUT-GEMM, T-MAC.

## 7. Activation-aware A·B·C — see `activation/README.md`

Compute f(A·B·C + β). A low-precision pass plus a rigorous error bound decides every output where f is
flat over the uncertainty interval; only the rest is recomputed at full precision.
- Run over the whole chain it costs *more* than exact (107–181 %). Refining one entry needs a row of A·B or a column of B·C (≈ N²), and the bound compounds through B·C. Refinement lines were chosen by a König minimum vertex cover.
- Computing B·C exactly and cascading only on A·(B·C) saves up to 48 % with zero wrong decisions (sign 52 %, hardtanh 60 %, ReLU 65–81 % of the exact cost at N = 32, 8 bits).
- Prior work for one product: SnaPEA, SeerNet, Precision Gating, ComPreEND.

## 8. Picking terms at random (activation/sampling.mjs, walks.mjs)

Random sampling instead of low precision mostly loses:
- strict bounds never decide anything;
- empirical bounds save at most a few percent on dense data, and are badly fooled on sparse data, where early samples are all zeros and the estimate looks falsely certain;
- to decide which side of a threshold a sum lands, seeing every term a little beats seeing some terms fully.

The exception is genuinely three-way: Cohen–Lewis random walks i → j → k → l, weighted by the rest of the chain (B·C·1, C·1). For nonnegative heavy-tailed data and a top-1% threshold they need only 16–24% of the multiplications, with guaranteed decisions. They pay in random draws (about 6× more draws than the exact multiplications), so they only help when multiplications are expensive.

## Takeaways

**The common thread is the intermediate product.** Every gain came from handling A·B (or B·C) deliberately:
don't store it (writes), cache before it (its entries are sums and repeat less), and keep it exact while the
cheap tricks go on the last multiplication (activations).

Surprises:
- the whole-chain activation cascade costs more than exact, because one refinement in a chain is a row or column (N²), not an entry (N);
- the guaranteed bound is about 30× too cautious; at ≈ 0.03× the whole chain reaches 50% with no wrong decisions on this data;
- more precision levels made it worse;
- ReLU benefits least;
- the refinement plan is a König minimum vertex cover;
- caching helps even the plain chain (≈ k² + N²k).

For practice:
- put the product that feeds the nonlinearity last, and keep the middle product exact and in fast memory;
- fusion pays off in memory traffic, not arithmetic;
- cache before the sums;
- measure how loose your bounds are on real data.

Possibly new:
- border-6 commutative 2×2 A·B (numerical);
- for three factors, the activation shortcut belongs on the last product;
- the triple-table trade-off (≤ k² + k³ multiplications, N⁴ additions).

Next:
- derive the explicit 6-product formula;
- try probabilistic bounds;
- test on trained weights;
- let the GF(2) runs finish.

## Prior work and comparison

| topic | published | here | verdict |
|---|---|---|---|
| Three-way forms | trace(ABC) is the standard trilinear form; ⟨2,2,2⟩ rank 7 ([Strassen](https://en.wikipedia.org/wiki/Strassen_algorithm), Winograd 1971, Hopcroft–Kerr over GF(2)); border rank 7 ([Landsberg](https://arxiv.org/abs/math/0407224), [border support rank](https://arxiv.org/abs/1705.09652)) | rank and border rank of trace(ABCD) = N⁴ | consistent, routine extension |
| Iterated matrix multiplication | IMM is ABP-complete; asymptotic formula/ABP lower bounds ([1710.05481](https://arxiv.org/abs/1710.05481), [STOC'22](https://dl.acm.org/doi/10.1145/3519935.3520044), [sums of ABPs](https://dl.acm.org/doi/10.1016/j.tcs.2025.115214)) | exact small case: two-level ≥ 2R; degree-3 circuits only border 13s | complementary regime |
| Border algorithms | border multiplicative complexity ≥ border rank / 2 ([Landsberg survey](https://people.tamu.edu/~jml/msurvey0407.pdf)), so commutative 2×2 needs ≥ 4 approximately, 7 exactly | numerical border 6 for commutative 2×2 A·B | open: inside the known window, no explicit construction |
| Exact search | SAT / flip graphs ([Heule–Kauers–Seidl](https://arxiv.org/abs/1903.11391), [Kauers–Moosbauer](https://arxiv.org/abs/2212.01175)) | GF(2): 7+7 SAT, 8+5 UNSAT, others unresolved | partial |
| Write-avoiding | Strassen-like algorithms can't be write-avoiding ([Carson, Demmel et al.](https://harsha-simhadri.org/pubs/EECS-2015-163.pdf), [asymmetric memories](https://link.springer.com/article/10.1007/s11390-023-3489-y)); GEMM fusion ([Bolt](https://arxiv.org/abs/2110.15238)), [FlashAttention](https://research.colfax-intl.com/wp-content/uploads/2023/12/colfax-flashattention.pdf) | fused A·B·C: N² writes at 2N³ mults with N registers | rediscovery |
| Repeated values | [Four Russians](https://en.wikipedia.org/wiki/Method_of_Four_Russians), [Mailman](https://www.cs.yale.edu/homes/el327/papers/matrixVectorApp.pdf), [LUT-GEMM](https://proceedings.iclr.cc/paper_files/paper/2024/file/a4f98ce85f440ee269b0df57b4368719-Paper-Conference.pdf), [T-MAC](https://arxiv.org/abs/2407.00088) | fused triple table: ≤ k² + k³ mults for any N, N⁴ adds | extension of a known technique |
| EML | [Odrzywołek 2026](https://arxiv.org/abs/2603.21852): x·y in 17; ternary operator only future work | x·y·z in 25 vs 33 composed | new but minor (log-table trick) |
| Ternary products | Bhattacharya–Mesner product of 3-D hypermatrices ([AMS Notices](https://www.ams.org/journals/notices/202110/noti2366/noti2366.html), [arXiv:2301.07494](https://arxiv.org/abs/2301.07494)) | not studied | different object |

## Lean certificates

`lean/Chain.lean` (core Lean 4.34, no Mathlib — the Mathlib fetch fails here on a Lake/git
partial-clone error; verify with `lean lean/Chain.lean`):
`strassen_chain` (Strassen∘Strassen = A·B·C, 14 mults), `mul_assoc'`, and
`flatten_injective` (the injectivity core of the N⁴ bound, for all N). The step
"injective 0/1 flattening ⇒ rank N⁴ ⇒ tensor rank ≥ N⁴" is linear algebra that is
only checked numerically (`search/flattenings.py`), not in Lean.
