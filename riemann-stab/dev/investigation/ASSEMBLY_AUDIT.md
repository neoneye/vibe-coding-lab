# Assembly audit: from a block floor to a proportion of zeros

Stage 2 of `CLAUDE_INVESTIGATION_PLAN.md`. Written 2026-09-07 at commit `107fbd9` plus the working tree of that day.

## What was found

The "external shifted-block assembly nobody here can check" of `TILING_DUAL_RESEARCH.md` is a Lean 4 theorem. It lives in `teal-sea/zeta-lab` (cloned at `47d0241`, 2026-09-06), file `lean/bridge/V2Challenge.lean` (statement surface, deliberate `sorry`s) with the proofs in `lean/bridge/Zeta23Ext/Bridge/` (`Main.lean`, `S6`–`S16`), built on `anthropics/zeta-23-lean` at `3635e74` (the Lean arm of arXiv:2608.13637). It was registered at the Palomar Registry as `PALOMAR-2026-08-25-000005`; the repository's `lean/bridge/AXIOM-AUDIT.md` pins the `#print axioms` log of the frozen tree (`propext, Classical.choice, Quot.sound`, no `sorryAx`). No person has reviewed it, by the repository's own statement.

**Rebuilt here.** On 2026-09-07 `lake exe cache get && lake build V2Challenge V2Solution` was run on the clone at `47d0241` (Lean `v4.33.0-rc2`, Mathlib at the manifest's pinned revision, upstream `zeta-23-lean` at `3635e74`): 8905 jobs, exit 0. A separate file importing `V2Solution` and running `#print axioms` on the seven advertised declarations (`n_point_bound`, `eight_point_bound`, `eight_point_bound_ratio`, `three_point_bound`, `three_point_bound_ratio`, `four_point_bound`, `four_point_bound_ratio`) reports exactly `[propext, Classical.choice, Quot.sound]` for each — no `sorryAx`, so no deliberate hole in the Challenge surface reaches a proved statement. So "kernel-checked" now rests on a build in this session as well as on the registry's replay. What it still does not rest on is a person having read the statements for faithfulness; the statements were read here (`V2Challenge.lean` 128–311) and say what their names say, but that is one reader.

## The theorem, verbatim in substance

```
def Phi_n (n : ℕ) (c : ℝ) (m p : ℕ) : ℝ :=
  (H - ((n : ℝ) - 1) * ((m : ℝ) - 1) / ((p : ℝ) * m)) / (1 - c * ((m : ℝ) - ((n : ℝ) - 1)) / m)

theorem n_point_bound (n : ℕ) (c : ℝ) (m p : ℕ) (hn : 2 ≤ n) (hm : n ≤ m) (hp : 0 < p) (hc : 0 < c)
    (hCert : ∀ g : Fin (n - 1) → ℝ, (∀ i, 0 ≤ g i) → c ≤ F n p g)
    (hA0 : c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ 1) :
    ∀ ε > 0, ∃ T₀ : ℝ, ∀ T ≥ T₀, (Phi_n n c m p - ε) * (Ncount T (2 * T) : ℝ) ≤ N0simple T (2 * T)
```

with `H = 3/2 − (1/√2)cot(1/√2)`, `F n p g = (1/p)Σgᵢ + Σ_{i<j} (2/(n−(j−i))) w(yⱼ−yᵢ)`, `w = (K/K(0))²`, `K(x) = ∫_{−1/2}^{1/2} cos(√2 t)cos(2πxt)dt`. `Ncount`/`N0simple` count zeros of Mathlib's `riemannZeta` in `(T, 2T]` with multiplicity / simple on the line.

## Term-for-term match with the page

`tiling_research.js:projectedSimpleZeroBound(floor, n, p, base)`:

| page | Lean | match |
|---|---|---|
| `windowsPerBlock = floor((1−1e−12)/floor)` | cap `hA0: c(m−(n−1)) ≤ 1`, i.e. `W ≤ 1/c`, so `W = ⌊1/c⌋` | equal unless `1/c` is an exact integer, where the page takes `W−1` (conservative, still admissible) |
| `blockSize = W + n − 1` | `m` | equal |
| `defectCoefficient = floor·W/m` | `c(m−(n−1))/m` | equal |
| `spanCoefficient = ((n−1)/p)((m−1)/m)` | `(n−1)(m−1)/(pm)` | equal |
| `bound = (base − span)/(1 − defect)` | `Phi_n` | equal, with `base = H` |

Recomputed in `mpmath` at 40 digits directly from `Phi_n` (script in this file's history; see `REPORT.md` for the command):

| instance | `n` | `c` | `p` | `m` | `Phi_n` | page / source |
|---|---|---|---|---|---|---|
| Ainta, per-block certificate | 7 | 19/5000 | 3000 | 269 | 0.67300852792777976 | page `0.6730085279277798` ✓ |
| zeta-lab three-point, **unconditional** | 3 | 1345/10⁶ | 3000 | 745 | 0.67273733450380945 | their README ✓ |
| zeta-lab four-point, **unconditional** | 4 | 2310/10⁶ | 2500 | 435 | 0.67284701976668883 | their README ✓ |
| zeta-lab eight-point, conditional on an Arb run | 8 | 41763/10⁷ | 3200 | 246 | 0.67305298298962889 | their README ✓ |
| page `sharp` chain floor, **naively** | 7 | 0.003956 | 3000 | 258 | 0.67310935014636168 | page ✓ |
| page alternating-chain energy, **naively** | 7 | 0.003957393309 | 3000 | 258 | 0.67311026973978851 | page ✓ |

So the page's projection is the Lean theorem's formula. The strictness offset `1e−12` is a benign convention: the Lean cap is non-strict, so at an exact reciprocal the page under-counts one window, which only lowers its number.

## Is `n` free? Is `p` free?

Both are parameters of `n_point_bound` (`p : ℕ`, so integer pressure denominators only — a real optimum such as 3370.45 needs integer neighbours or an extension), with side conditions `2 ≤ n ≤ m`, `0 < p`, `0 < c`, `c(m−(n−1)) ≤ 1`, and the certificate at the same `(n, p)`. This answers the two questions the research note put to "whoever has the manuscript": the `1/3000` is a choice, not a derivation, and general `n` is allowed. The block-size scan and the pressure optimisation of the note are therefore mathematics about a well-posed parameter of the theorem — still subject to the missing lemma below, since they were run on chain floors.

## The hypothesis is per-block, and the page's floors are not

`hCert` demands `c ≤ F n p g` for **every** nonnegative gap vector: a floor on the isolated block. The isolated seven-point block minimum is `0.003826231211` (note, "The isolated-block search"). Every chain floor on the page (`0.003956` swept with proved enclosures; `0.003957393309` via the pinned pair certificate) exceeds it, so none of them satisfies `hCert`. They are floors on `F(g) + Φ(σg) − Φ(g)` — telescoping certificates whose sum over the windows of a chain is a floor on the chain energy up to a boundary term.

## The exact missing lemma

`hCert` is consumed in exactly one place: `Zeta23Ext/Bridge/S11.lean`, theorem `block_energy`, lines 240–252:

```
have hwin : ∀ i ∈ range (m - (n - 1)), c ≤ F n p (windowGaps n Y i) := by ... apply hCert ...
have hsum : c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ ∑ i ∈ range (m - (n - 1)), F n p (windowGaps n Y i) := ...
```

and everything after `hsum` — the telescoping of the pressure terms, the fibre-wise regrouping of pair terms, `S13.block_bound`, `Main.block_bound_eventually`, `pre_solve`, the final elimination — uses only `hsum`. (`grep -rn hCert Zeta23Ext` shows the other occurrences merely pass the hypothesis down to `block_energy`.)

Therefore the statement that would accept the page's chain floors is

```
theorem n_point_bound_sum (n : ℕ) (c : ℝ) (m p : ℕ) (hn : 2 ≤ n) (hm : n ≤ m) (hp : 0 < p) (hc : 0 < c)
    (hSum : ∀ Y : Fin m → ℝ, StrictMono Y →
              c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ ∑ i ∈ range (m - (n - 1)), F n p (windowGaps n Y i))
    (hA0 : c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ 1) : ... same conclusion ...
```

obtained by cutting `block_energy` at `hsum`. The hypothesis is needed only at the theorem's own `m`. **This lemma is identified, not proved.** It looks like a routine refactor of S11; it has not been attempted here because the Mathlib build was still running when this was written.

## What a telescoping certificate supplies, and what it costs (corrected 2026-09-07, second pass)

If `R(g) = F(g) + Φ(σg) − Φ(g) ≥ c` on every window, summing over the `W = m−(n−1)` windows of a sorted `m`-block gives `Σ F ≥ cW − (Φ(state_W) − Φ(state_0))`. The quantity to bound is the **endpoint oscillation** `B = sup Φ − inf Φ` of the state potential, *not* the single-edge amplitude `A_tail = 2(max|a| + max|b| + max|a+b|)` that the tail lemma uses; the first version of this file used `A_tail`, and a reviewer showed by explicit positive-gap witnesses that it is too small. For the additive certificates the state potential on five gaps is `Φ(s₀..s₄) = −a(s₀) − h(s₁) + h(s₃) + a(s₄)`, `h = a + b` (checked by expansion against the shipped six-gap correction, `investigation/endpoint_oscillation.py`), so `B = 2·osc(a) + 2·osc(h)` exactly. For the pair certificate the four state edge functions are the cumulative negatives of the five `ψ_k` and `B` is computed by a dynamic programme over the union knot grid (extrema at vertices, validated against brute force on a sub-grid). Exact fractions of the shipped binary64 coefficients:

| certificate | chain floor `c` | `A_tail` (wrong for this purpose) | `B` (endpoint oscillation) |
|---|---|---|---|
| `sharp` | 0.003956 | 0.00128178 | **0.00170904** |
| `compact` | 0.003950948 | 0.00110684 | 0.00131141 |
| `record` | 0.003957227 | 0.00519679 | 0.00808341 |
| pinned pair (on `record`) | 0.003957393 | — (earlier guess 0.00528) | **0.00814654** |

Two scores follow, kept separate (`investigation/projection.py`, exact rationals for `c, B, W, m`, `H` and `Phi_n` in 40-digit mpmath — numerical, not enclosed):

| certificate | conservative: `c_eff = min(cW−B,1)/W`, best integer `W` | signed-cap (unproved extension): `Phi_n(c)` at the largest `W` with `cW + B ≤ 1` | naive (not a valid target) |
|---|---|---|---|
| `sharp` | `W=253, m=259`: **0.6731051013** | `W=252, m=258`: 0.6731093501 | 0.6731093501 |
| `compact` | `W=253`: 0.6731028043 | `W=252`: 0.6731060160 | 0.6731062256 |
| `record` | `W=254`: 0.6730895711 | `W=250, m=256`: 0.6731097351 | 0.6731101602 |
| pinned pair | `W=254`: 0.6730895166 | `W=250, m=256`: 0.6731098447 | 0.6731102697 |

The compiled instance `sharp_chain_bound_of_windowSum` (below) uses the rational `c = 394924/10⁸ ≤ (0.003956·253 − B)/253` at `m = 259`, whose `Phi_n` is 0.6731050981.

**The theorem, proved (conservative form).** In a branch `window-sum` of the zeta-lab clone (patch and logs in `investigation/lean/`), `S11.lean` gains `WindowSumCert n p m c`, `windowSum_of_cert` (per-block ⇒ window-sum), `windowSum_of_telescoping` (a coboundary certificate with endpoint loss ≤ `B` ⇒ window-sum at `c − B/W`), and `block_energy_of_windowSum`; `S13.lean` gains `block_bound_of_windowSum`; `Main.lean` gains `block_bound_eventually_of_windowSum`, `pre_solve_of_windowSum`, `n_point_bound_of_windowSum`, the regression `n_point_bound'` (the original theorem re-derived), and the instance `sharp_chain_bound_of_windowSum`. The upstream theorems are untouched. Build and axiom outcome: see `investigation/lean/README.md`.

**The signed route (follow-up plan, step 3).** Keeping `Δ_s = Φ(state_{s+W}) − Φ(state_s)` signed through S13 and summing over every consecutive full block in S15 before bounding: `Σ_s Δ_s` telescopes to the last `W` potentials minus the first `W`, so `|Σ_s Δ_s| ≤ W·B` independent of the configuration length, and the S13 clipping step survives under the side condition `cW + B ≤ 1`. Both facts are checked exactly on rational data by `investigation/signed_endpoint_model.py`, with the clipping counterexample when the cap fails. `sharp` meets the cap at `W = 252` (`cW + B = 0.99862`), which would recover 0.6731093501. **Not formalised**: it needs `S15.offset_average` generalised to a block-dependent left-hand side with the signed sum retained, and the asymptotic elimination in `pre_solve` carrying a fixed `W·B` error; the exact statement to prove is in `investigation/lean/README.md`.

Remaining numerical premise for either score: the `sharp` chain floor `0.003956` on `[0,16]⁶` with the tail lemma — whose rigorous transcript was found to be **absent** from `tiling_interval.results.json` (only the fast row exists; the rigorous rows stop at `compact 0.0038`). A rigorous `sharp 0.003956` run was started on 2026-09-07 to restore it; its outcome is in `REPORT.md`.

## Dependency table

| ingredient | status | where |
|---|---|---|
| kernel `K`, `w = (K/K0)²`, Fourier convention | proved (Lean def, matches page to 1e−13; see `LAB_F_AUDIT.md`) | `V2Challenge.lean` 128–135; `tiling_research.js` |
| base constant `H` | Lean theorem (`zeta-23-lean` Theorem D), Lamzouri reproof | arXiv:2608.13637, 2609.02882 |
| unconditional analytic input (pair correlation, BGSTB) | Lean, as `PaperInputs` of the upstream | `Main.lean` |
| finite inequality, per block, at `(7, 19/5000, 3000)` | Arb program accepts; **not** Lean | Ainta; page's `bare` control sweep reproduces `F6 ≥ 19/5000` |
| finite inequality, per block, at `n = 3, 4` | **Lean** (interval cell lemmas) | `ThreePoint.lean`, `FourPoint.lean` |
| block/chain counting, multiplicities, off-line pairs, elimination | Lean (`S6`–`S16`) | `Zeta23Ext/Bridge/` |
| telescoping lemma (coboundary → chain floor + O(1)) | Lean, page's own `coboundary_floor_telescopes`, `chain_inequality` | `dev/lean/ZetaClaims.lean` |
| chain floor `0.003956` on `[0,16]⁶` + tail lemma | exhaustive subdivision with proved enclosures on the page's own arithmetic, **rigorous transcript absent** (re-run in progress); no independent arithmetic check of this sweep exists — the Arb tape sample (39/220, 67/220) belongs to the cube-1.6 pair tape, not to this sweep | `tiling_interval.results.json` |
| endpoint loss ≤ `B` (oscillation of the state potential) | exact rationals, `endpoint_oscillation.py`; the adapter `windowSum_of_telescoping` is Lean, the PL-extrema-at-knots step for the concrete `Φ` is not | `investigation/endpoint_oscillation.py` |
| window-sum variant of the assembly | **Lean** (`n_point_bound_of_windowSum`, standard axioms) | branch `window-sum`, `investigation/lean/` |

## Decision

The bridge exists and is readable. Continue the auxiliary-chain work only as conditional on `n_point_bound_sum`, and state every projection with the boundary term paid. The single highest-value next step in this direction is to prove `n_point_bound_sum` in a fork of `zeta-lab` (a cut at `hsum` in S11), which would make the page's `sharp` sweep the binding item.

The defensible **unconditional** record, for anyone who accepts a registry-replayed Lean build with standard axioms and no human review, is zeta-lab's four-point `0.6728470198`; for anyone who insists on human review it remains `0.6725007037`. The page now says both.
