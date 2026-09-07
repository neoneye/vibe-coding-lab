# The window-sum variant of `n_point_bound`, in Lean

Branch `window-sum` of a clone of `teal-sea/zeta-lab` at `47d02411673f2a3f4bc07dde31c0b323459646ae`, subdirectory `lean/bridge` (Lean `v4.33.0-rc2`, Mathlib and `anthropics/zeta-23-lean@3635e74` at the manifest's pinned revisions). `window-sum.patch` is the full diff (373 added lines, nothing removed); `build-axioms.log` is the filtered output of `lake build Zeta23Ext.Bridge.Main` on that branch on 2026-09-07 (exit 0, no errors).

Reproduce:

```
git clone https://github.com/teal-sea/zeta-lab && cd zeta-lab && git checkout 47d0241
git apply <this dir>/window-sum.patch
cd lean/bridge && PATH="$HOME/.elan/bin:$PATH" lake exe cache get && lake build Zeta23Ext.Bridge.Main
```

## What was added (upstream declarations untouched)

`Zeta23Ext/Bridge/S11.lean`:

```
def WindowSumCert (n p m : ℕ) (c : ℝ) : Prop :=
  ∀ y : Fin m → ℝ, StrictMono y →
    c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ ∑ i ∈ range (m - (n - 1)), F n p (windowGaps n (sortedExt y) i)

theorem windowSum_of_cert (hn : 2 ≤ n) (hm : n ≤ m)
    (hCert : ∀ g : Fin (n - 1) → ℝ, (∀ i, 0 ≤ g i) → c ≤ F n p g) : WindowSumCert n p m c

theorem windowSum_of_telescoping (hn : 2 ≤ n) (hm : n ≤ m) (φ : (Fin m → ℝ) → ℕ → ℝ)
    (hcob : ∀ y, StrictMono y → ∀ i ∈ range (m - (n - 1)),
      c ≤ F n p (windowGaps n (sortedExt y) i) + (φ y (i + 1) - φ y i))
    (hB : ∀ y, StrictMono y → φ y (m - (n - 1)) - φ y 0 ≤ B) :
    WindowSumCert n p m (c - B / ((m : ℝ) - ((n : ℝ) - 1)))

theorem block_energy_of_windowSum ... (hSum : WindowSumCert n p m c) ... :
    c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ energyOn x univ + (((n : ℝ) - 1) / (p : ℝ)) * spanOf x univ
theorem block_energy' ...   -- the upstream block_energy re-derived through the two above
```

`Zeta23Ext/Bridge/S13.lean`: `block_bound_of_windowSum`. `Zeta23Ext/Bridge/Main.lean`: `block_bound_eventually_of_windowSum`, `pre_solve_of_windowSum`,

```
theorem n_point_bound_of_windowSum (n : ℕ) (c : ℝ) (m p : ℕ) (hn : 2 ≤ n) (hm : n ≤ m) (hp : 0 < p)
    (hc : 0 < c) (hSum : WindowSumCert n p m c) (hA0 : c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ 1) :
    ∀ ε > 0, ∃ T₀ : ℝ, ∀ T ≥ T₀, (Phi_n n c m p - ε) * (Ncount T (2 * T) : ℝ) ≤ N0simple T (2 * T)

theorem n_point_bound' ...   -- the upstream n_point_bound re-derived (regression)

theorem sharp_chain_bound_of_windowSum (hSum : WindowSumCert 7 3000 259 (394924 / 100000000)) :
    ∀ ε > 0, ∃ T₀ : ℝ, ∀ T ≥ T₀,
      (Phi_n 7 (394924 / 100000000) 259 3000 - ε) * (Ncount T (2 * T) : ℝ) ≤ N0simple T (2 * T)
```

All of `windowSum_of_cert`, `windowSum_of_telescoping`, `block_energy_of_windowSum`, `block_energy'`, `block_bound_of_windowSum`, `n_point_bound_of_windowSum`, `n_point_bound'`, `sharp_chain_bound_of_windowSum` print `[propext, Classical.choice, Quot.sound]` (Lean abbreviates `Classical.choice` to `choice` in `Main`). No `sorryAx`.

Every proof body is the upstream body with the per-window step replaced by the hypothesis (`window-sum.patch` shows it as a copy with a three-line change per file); the theorems are stated at the theorem's fixed `m`, which is all the proof ever uses.

## What remains hypothetical for the `sharp` instance

- `hSum : WindowSumCert 7 3000 259 (394924/10⁸)` — supplied, via `windowSum_of_telescoping`, by (i) the coboundary inequality `R(g) ≥ 0.003956` on every six-gap window of every sorted list (an exhaustive interval subdivision on `[0,16]⁶` plus the tail lemma; its rigorous transcript, absent when this was first written, was restored on 2026-09-07), (ii) `φ y i := Φ(gaps i..i+4 of y)` with the endpoint loss `Φ(state_W) − Φ(state_0) ≤ B = 0.00170904…` — exact in rationals of the shipped coefficients (`../endpoint_oscillation.py`), **not formalised** (the missing Lean step is: a function piecewise-linear between knots and constant beyond them attains its extrema at knots), (iii) `394924/10⁸ ≤ (0.003956·253 − B)/253 = 0.0039492449…`, arithmetic.
- `Phi_n 7 (394924/10⁸) 259 3000 = 0.6731050981…` (numerical; a Lean pin of the decimal is the same kind of statement as `dev/lean/ZetaClaims.lean` already carries and was not added).

## The signed-endpoint telescope, proved in isolation

Also in `S11.lean` (rebuilt alone afterwards, standard axioms):

```
theorem sum_shift_sub_telescope (f : ℕ → ℝ) (K W : ℕ) :
    ∑ s ∈ range K, (f (s + W) - f s) = ∑ s ∈ range W, (f (K + s) - f s)
theorem sum_shift_sub_le (f : ℕ → ℝ) (K W : ℕ) (lo hi : ℝ) (hf : ∀ s, lo ≤ f s ∧ f s ≤ hi) :
    ∑ s ∈ range K, (f (s + W) - f s) ≤ (W : ℝ) * (hi - lo)
```

This is the finite identity behind step 3 of the follow-up plan: the endpoint terms of all `K` consecutive full blocks sum to at most `W·(sup φ − inf φ)`, independent of `K`. It is the one ingredient that was new; what remains is plumbing, described next.

## The signed-endpoint extension: proved

`Signed.lean` (a new module importing `Main`, copied here verbatim; also in the patch) carries the
whole extension, every proof being the upstream proof with the endpoint term kept:

```
def stateGaps (n : ℕ) (Y : ℕ → ℝ) (i : ℕ) : Fin (n - 2) → ℝ      -- the first n−2 gaps of window i
def enumBlock (x : ι → ℝ) (y : Fin N → ℝ) (s m : ℕ) : Finset ι    -- the points of ranks s..s+m−1

theorem block_energy_signed            -- S11:  c·W − (φ y W − φ y 0) ≤ E + q·span, for every sorted enumeration y of the block
theorem offset_average_indexed         -- S15 with a block-dependent left-hand side, summed over the n+1−m full blocks
theorem block_bound_signed             -- S13, under the cap  c·W − (φ y W − φ y 0) ≤ 1
theorem block_bound_eventually_signed  -- S9 + S13, uniform in T
theorem pre_solve_signed               -- S15 signed + the telescope: the fixed W·(hi−lo) is absorbed by the tolerance
theorem n_point_bound_signed (n : ℕ) (c : ℝ) (m p : ℕ) (hn : 2 ≤ n) (hm : n ≤ m) (hp : 0 < p) (hc : 0 < c)
    (Ψ : (Fin (n - 2) → ℝ) → ℝ) (lo hi : ℝ) (hΨ : ∀ g, lo ≤ Ψ g ∧ Ψ g ≤ hi)
    (hcob : ∀ y : Fin m → ℝ, StrictMono y → ∀ i ∈ range (m - (n - 1)),
      c ≤ F n p (windowGaps n (sortedExt y) i)
        + (Ψ (stateGaps n (sortedExt y) (i + 1)) - Ψ (stateGaps n (sortedExt y) i)))
    (hcap : c * ((m : ℝ) - ((n : ℝ) - 1)) + (hi - lo) ≤ 1) :
    ∀ ε > 0, ∃ T₀ : ℝ, ∀ T ≥ T₀, (Phi_n n c m p - ε) * (Ncount T (2 * T) : ℝ) ≤ N0simple T (2 * T)

theorem sharp_chain_bound_signed (Ψ : (Fin 5 → ℝ) → ℝ) (lo hi : ℝ)
    (hΨ : ∀ g, lo ≤ Ψ g ∧ Ψ g ≤ hi) (hB : hi - lo ≤ 171 / 100000)
    (hcob : ∀ y : Fin 258 → ℝ, StrictMono y → ∀ i ∈ range 252,
      3956 / 1000000 ≤ F 7 3000 (windowGaps 7 (sortedExt y) i)
        + (Ψ (stateGaps 7 (sortedExt y) (i + 1)) - Ψ (stateGaps 7 (sortedExt y) i))) :
    ∀ ε > 0, ∃ T₀ : ℝ, ∀ T ≥ T₀,
      (Phi_n 7 (3956 / 1000000) 258 3000 - ε) * (Ncount T (2 * T) : ℝ) ≤ N0simple T (2 * T)
```

All seven print `[propext, Classical.choice, Quot.sound]` (`build-axioms.log`, 2026-09-08). So the
signed route of the follow-up plan's step 3 is a theorem: with the cap `c·W + (hi − lo) ≤ 1` the
constant is `Phi_n n c m p` itself, and for `sharp` (`c = 0.003956`, `W = 252`, `B = 0.00171`,
cap `0.998622`) that is `0.6731093501…`, the naive projection, with no endpoint penalty.

## The `sharp` state potential and its bounds, proved

`SharpPotential.lean` (copied here) closes `hΨ` and `hB`:

```
def plClamp (N : ℕ) (k v : ℕ → ℝ) (x : ℝ) : ℝ        -- tiling_additive.js:piecewiseLinear, exactly
theorem plClamp_mem : lo ≤ v i ≤ hi for i ≤ N  →  lo ≤ plClamp N k v x ≤ hi
def sharpKnotNum sharpANum sharpHNum : List ℤ       -- the 51 exact binary64 values, as integers over 2^68
def sharpPsi (g : Fin 5 → ℝ) : ℝ                    -- −a(g₀) − h(g₁) + h(g₃) + a(g₄), h = a + b
theorem sharpPsi_bounds (g) : sharpLo ≤ sharpPsi g ∧ sharpPsi g ≤ sharpHi
theorem sharp_oscillation : sharpHi - sharpLo ≤ 171 / 100000     -- exact: 0.00170904…
theorem sharp_chain_bound_signed_concrete
    (hcob : ∀ y : Fin 258 → ℝ, StrictMono y → ∀ i ∈ range 252,
      3956 / 1000000 ≤ F 7 3000 (windowGaps 7 (sortedExt y) i)
        + (sharpPsi (stateGaps 7 (sortedExt y) (i + 1)) - sharpPsi (stateGaps 7 (sortedExt y) i))) :
    ∀ ε > 0, ∃ T₀ : ℝ, ∀ T ≥ T₀,
      (Phi_n 7 (3956 / 1000000) 258 3000 - ε) * (Ncount T (2 * T) : ℝ) ≤ N0simple T (2 * T)
```

All with `[propext, Classical.choice, Quot.sound]`; the integer bound checks are `decide`, the
oscillation is `norm_num`. So the only hypothesis left between the shipped `sharp` certificate and
a theorem about ζ at `Phi_n 7 (3956/10⁶) 258 3000 = 0.6731093501…` is `hcob`: the coboundary
inequality `F(window) + sharpPsi(next state) − sharpPsi(state) ≥ 0.003956` on every window of every
sorted 258-point list — what the exhaustive interval subdivision of `R` on `[0,16]⁶` plus the tail
lemma claims, on this page's own arithmetic; its rigorous transcript was restored on 2026-09-07
(67 608 431 boxes, checksum `37308f214a50bb25`) and its proof tape is structurally verified in full.

