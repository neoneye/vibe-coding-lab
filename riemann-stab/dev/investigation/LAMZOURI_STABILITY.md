# Lamzouri stability slack — Experiment D (stage 5 of the plan)

Conducted 2026-09-07 (it had been recorded as deferred); D1 verdict corrected the same day after external review. Script: `investigation/lamzouri_slack.py` (numpy float64; a decomposition table, not an enclosure). Run: `<venv python> dev/investigation/lamzouri_slack.py` after dumping the zeros (`zeros600.json`, see the script's tail); 0.6 s.

## The decomposition, replayed

For a conjugation-invariant multiset, the proof's nested spaces `U ⊆ V ⊆ W` (multiples and the `g_z` of pairs; then the simple reals; then the `h_z`) are Gram–Schmidt'd on the family's Gram matrix (`⟨f_z, f_s⟩ = K(z − s̄)`, the page's kernel), the coefficient matrix `A` of `F = Σ m_x f_x⊗f_x + 2Σ m_z (g_z⊗g_z − h_z⊗h_z)` is formed in that basis, and the slack `Δ(Z) = #{simple real} − (2N − S)` is split into the six quantities the proof discards: the Bessel remainder `Σ_{j≠l} A_jl²`, the second-range squares `Σ (α_j − 1)²`, the dimension loss `n₁ − dim(V/U)`, the first-range squares `Σ (α_j − 2)²`, the first-range multiplicity excess `2(Σ α_j − 2 dim U)`, and the third-range term `Σ (α_j² − 2α_j)` with `α_j ≤ 0`. Checks on every multiset: `‖A‖_F² = S`, `Σ α_j = N`, and the six pieces sum to `Δ` — worst residual 1.7e−13 over 30 random multisets (five families) and the controls, including near-dependent dense sets (Cholesky with a 1e−13 jitter). So the finite proof is reproduced numerically, piece by piece.

## Where the slack sits

| multiset | Δ | Bessel | second | dim | first (sq) | first (mult) | third |
|---|---|---|---|---|---|---|---|
| lone simple real | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **lone double real (negative control)** | **0** | 0 | 0 | 0 | 0 | 0 | 0 |
| lone conjugate pair, y = 0.25 | 2.095 | 0 | 0 | 0 | 0.186 | 0.862 | 1.047 |
| two simples at distance 0.05 | 1.985 | 0.015 | 1.970 | 0 | 0 | 0 | 0 |
| zeros to T = 100 (29) | 0.832 | 0.823 | 0.008 | 0 | 0 | 0 | 0 |
| zeros to T = 300 (138) | 8.476 | 7.780 | 0.696 | 0 | 0 | 0 | 0 |
| zeros to T = 600 (341) | 26.189 | 21.921 | 4.268 | 0 | 0 | 0 | 0 |

On the zeros (all real, all simple) only the Bessel remainder and the second-range squares are nonzero, and their sum is exactly the off-diagonal pair mass `Σ_{z≠s} K(z−s)²`: at T = 600 it is 26.19 = 0.0768·N (the page's Lab F·ii figure). **The slack is the pair-correlation input and nothing else.** The split between "Bessel" and "second range" depends on the Gram–Schmidt order and carries no meaning of its own; their sum does not.

Multiples put their slack into the first-range pieces (a double point at a lone location has none; a double point near others has `(α − 2)²` and the multiplicity excess); an off-line pair puts it into all three of the first-range squares, the multiplicity excess and the third-range term (the `h_z` direction), 2.09 for a lone pair at `y = 0.25`.

## Candidate correction terms `D(Z)`, tested for `Δ ≥ c·D`

The plan's rule: `D` may not use the unknown simple count and may not be the slack itself; a lone double real point has `Δ = 0`, so `D` must vanish there.

| candidate | min Δ/D over 30 multisets | verdict |
|---|---|---|
| `D1 = Σ_{x≠y simple real} K(x−y)²`, the simple-simple pair energy | 1.000000 on the 30 random multisets (attained on every all-simple set) | **refuted** (2026-09-07, external review): ten simple reals `1.06 + j/10000`, `j = 0..9`, with the pair `±i/20` give `Δ = 89.98688917536…`, `D1 = 89.99994951745…`, `Δ − D1 = −0.0130603420956…`, certified negative in 256-bit complex ball arithmetic (radius < 6e−73; the script reproduces it in float64 and, with python-flint, in Arb). The random families never put a tight cluster of simple reals next to an off-line pair, and 30 passes were taken for validity. They were not. |
| `Dall = Σ_{z≠s} m_z m_s K(z−s)²`, the all-pairs energy | 0.9246 ("with pairs") | **fails**: 7 of 30 have `Δ < Dall`, all in the families with off-line pairs — the cross terms `2 Re K(x+iy)²` between a real point and a pair can be negative, so the all-pairs energy is not a lower bound for the slack. Counterexamples printed by the script. |

## Decision

Both candidate corrections are refuted. `D1` holds on every all-simple multiset (where it is the slack itself) and on the random families, and fails when a cluster of simple reals sits next to an off-line pair: the cross terms between the cluster and the pair are negative there and outweigh the pair's own first-range and third-range contributions. Neither Lamzouri's inequality nor `Δ ≥ 0` is in question — `Δ` is positive on the counterexample. What is refuted is any *universal* correction of the form `Δ ≥ D(Z)` with `D` the simple-simple pair energy; a correction that survives would have to depend on the off-line points too, and none was found.

On the zeros (all real, all simple under the hypothesis being bounded) `Δ` *is* the off-diagonal pair mass, and turning that into a larger constant needs a lower bound for the near-pair energy of the zeros — a lower bound on the pair-correlation form factor, available unconditionally only for Fourier support ≤ 1, where it yields exactly `C_MT − 1` and the ceiling `2 − C_MT` (Remark 3.4; zeta-lab's family wall for the pressure route). No candidate that uses *new* information was found; the plan's stopping rule applies ("a positive measured remainder alone is insufficient"). Stage 5 is closed as conducted — a **numerical experiment**: the decomposition reproduced piece by piece, two candidate corrections both refuted, every counterexample preserved with its coordinates in `investigation/lamzouri_slack.counterexamples.json` (replay: `python3 dev/investigation/lamzouri_slack.py`; the D1 counterexample is also certified in Arb when python-flint is present). The previous version of this file called `D1` "valid" on the strength of 30 random passes; that was wrong, and the correction came from the external review of commit 69d3f99.
