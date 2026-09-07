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

- `hSum : WindowSumCert 7 3000 259 (394924/10⁸)` — supplied, via `windowSum_of_telescoping`, by (i) the coboundary inequality `R(g) ≥ 0.003956` on every six-gap window of every sorted list (an exhaustive interval subdivision on `[0,16]⁶` plus the tail lemma; **its rigorous transcript is absent from `tiling_interval.results.json`** and is being re-run), (ii) `φ y i := Φ(gaps i..i+4 of y)` with the endpoint loss `Φ(state_W) − Φ(state_0) ≤ B = 0.00170904…` — exact in rationals of the shipped coefficients (`../endpoint_oscillation.py`), **not formalised** (the missing Lean step is: a function piecewise-linear between knots and constant beyond them attains its extrema at knots), (iii) `394924/10⁸ ≤ (0.003956·253 − B)/253 = 0.0039492449…`, arithmetic.
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

## The signed-endpoint extension: exact statement to prove (not attempted beyond the lemma above)

Keep `Δ_s := Φ(state_{s+W}) − Φ(state_s)` in the S11 conclusion, `c·W − Δ_s ≤ E_s + q·span_s`; carry it through S13 with the side condition `c·W + B ≤ 1` (so `c·W − Δ_s ≤ 1` and the `min(1, ·)` clipping survives); generalise `S15.offset_average` to a block-dependent left-hand side

```
hblock : ∀ B, B.card = m → IsInterval x B → A_B ≤ Dblk B + q * spanOf x B
```

and conclude with `Σ_{consecutive full blocks} A_B` on the left, then use the exact telescope `Σ_s Δ_s = Σ(last W potentials) − Σ(first W potentials)`, `|Σ_s Δ_s| ≤ W·B`, and carry the fixed `W·B` through `pre_solve`'s elimination (it is `o(N)`). `../signed_endpoint_model.py` checks the telescope and the clipping condition exactly on rational data and exhibits the clipping counterexample without the cap. For `sharp` at `W = 252`, `c·W + B = 0.99862 ≤ 1`, and the projection would be `0.6731093501`.
