/-
Copyright (c) 2026 Zeta Lab and contributors. All rights reserved.
Released under MIT license as described in the file LICENSE.
SPDX-License-Identifier: MIT
-/
import Zeta23Ext.Bridge.Signed

/-!
# The `sharp` certificate's state potential, with its bounds proved

`tiling_additive.js` evaluates a certificate function as clamped piecewise-linear interpolation
of its knot values.  `plClamp` is that evaluation; `plClamp_mem` says it never leaves the range
of the knot values.  `sharpPsi` is the state potential `Φ(s) = −a(s₀) − h(s₁) + h(s₃) + a(s₄)`,
`h = a + b`, of the `sharp` certificate on the exact binary64 values shipped in
`tiling_additive.certificate.json` (every value is an integer over `2⁶⁸`, and the lists below are
those integers); its bounds `sharpLo ≤ sharpPsi g ≤ sharpHi` follow, and
`sharpHi − sharpLo ≤ 171/100000` is checked by `norm_num`.  With those, the only hypothesis left
in `sharp_chain_bound_signed_concrete` is the coboundary inequality itself — what the sweep
claims.
-/

noncomputable section
set_option linter.unusedSectionVars false

open Matrix Finset RHLinalg Filter
open scoped ComplexOrder BigOperators
open Zeta23 Zeta23.ZeroSide Zeta23.ThmD

namespace Zeta23Ext.Bridge

/-- Clamped piecewise-linear interpolation of the values `v 0, …, v N` at the knots
`k 0 < ⋯ < k N`, as `tiling_additive.js:piecewiseLinear` computes it: constant outside the knot
range, linear on each cell, the cell of `x` being the largest `i < N` with `k i ≤ x`. -/
def plClamp (N : ℕ) (k v : ℕ → ℝ) (x : ℝ) : ℝ :=
  if x ≤ k 0 then v 0
  else if k N ≤ x then v N
  else
    let i := Nat.findGreatest (fun i => k i ≤ x) (N - 1)
    v i + (v (i + 1) - v i) * ((x - k i) / (k (i + 1) - k i))

/-- The interpolant stays within the range of the values it interpolates. -/
theorem plClamp_mem (N : ℕ) (hN : 0 < N) (k v : ℕ → ℝ) (hk : ∀ i, i < N → k i < k (i + 1))
    (lo hi : ℝ) (hv : ∀ i, i ≤ N → lo ≤ v i ∧ v i ≤ hi) (x : ℝ) :
    lo ≤ plClamp N k v x ∧ plClamp N k v x ≤ hi := by
  unfold plClamp
  split_ifs with h0 hN'
  · exact hv 0 (Nat.zero_le _)
  · exact hv N le_rfl
  · rw [not_le] at h0 hN'
    have hP : k (Nat.findGreatest (fun i => k i ≤ x) (N - 1)) ≤ x :=
      Nat.findGreatest_spec (P := fun i => k i ≤ x) (m := 0) (Nat.zero_le (N - 1)) h0.le
    have hiN : Nat.findGreatest (fun i => k i ≤ x) (N - 1) ≤ N - 1 := Nat.findGreatest_le _
    have hxk : x < k (Nat.findGreatest (fun i => k i ≤ x) (N - 1) + 1) := by
      rcases lt_or_eq_of_le hiN with hlt | heq
      · have := Nat.findGreatest_is_greatest (P := fun i => k i ≤ x)
          (k := Nat.findGreatest (fun i => k i ≤ x) (N - 1) + 1) (Nat.lt_succ_self _) (by omega)
        exact lt_of_not_ge this
      · rw [heq, Nat.sub_add_cancel hN]; exact hN'
    set i := Nat.findGreatest (fun i => k i ≤ x) (N - 1) with hi_def
    have hiltN : i < N := by omega
    have hki := hk i hiltN
    set t := (x - k i) / (k (i + 1) - k i) with ht
    have ht0 : 0 ≤ t := div_nonneg (by linarith) (by linarith)
    have ht1 : t ≤ 1 := by rw [ht, div_le_one (by linarith)]; linarith
    obtain ⟨hvi0, hvi1⟩ := hv i hiltN.le
    obtain ⟨hvj0, hvj1⟩ := hv (i + 1) hiltN
    constructor
    · nlinarith [mul_nonneg ht0 (sub_nonneg.mpr hvj0), mul_nonneg (sub_nonneg.mpr ht1) (sub_nonneg.mpr hvi0)]
    · nlinarith [mul_nonneg ht0 (sub_nonneg.mpr hvj1), mul_nonneg (sub_nonneg.mpr ht1) (sub_nonneg.mpr hvi1)]

/-! ### The `sharp` certificate's data: exact binary64 values, as integers over `2⁶⁸` -/

/-- The common denominator of every value below. -/
def sharpD : ℝ := 2 ^ 68

def sharpKnotNum : List ℤ :=
  [0,
   29514790517935284224,
   59029581035870568448,
   88544371553805844480,
   118059162071741136896,
   147573952589676412928,
   177088743107611688960,
   206603533625546964992,
   236118324143482273792,
   265633114661417549824,
   295147905179352825856,
   324662695697288134656,
   354177486215223377920,
   383692276733158686720,
   413207067251093929984,
   442721857769029238784,
   472236648286964547584,
   501751438804899790848,
   531266229322835099648,
   560781019840770342912,
   590295810358705651712,
   619810600876640960512,
   649325391394576269312,
   678840181912511447040,
   708354972430446755840,
   737869762948382064640,
   767384553466317373440,
   796899343984252682240,
   826414134502187859968,
   855928925020123168768,
   885443715538058477568,
   914958506055993786368,
   944473296573929095168,
   973988087091864272896,
   1003502877609799581696,
   1033017668127734890496,
   1062532458645670199296,
   1092047249163605508096,
   1121562039681540685824,
   1151076830199475994624,
   1180591620717411303424,
   1210106411235346481152,
   1239621201753281921024,
   1269135992271217098752,
   1298650782789152538624,
   1328165573307087716352,
   1475739525896764129280,
   1770887431076116955136,
   2361183241434822606848,
   3246626956972881084416,
   4132070672510939561984]

def sharpANum : List ℤ :=
  [63052508634231112,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   31596268182062296,
   63052508634231112,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   -63052508634231112,
   27428993239228300,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   0,
   63052508634231112,
   63052508634231112,
   63052508634231112,
   63052508634231112,
   63052508634231112,
   63052508634231112]

def sharpHNum : List ℤ :=
  [94578762951346668,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   13202264885299184,
   65778653634095923,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   18968148023066945,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   -31526254317115556,
   94578762951346668,
   94578762951346668,
   94578762951346668,
   94578762951346668,
   94578762951346668,
   94578762951346668]

def sharpKnotR (i : ℕ) : ℝ := ((sharpKnotNum.getD i 0 : ℤ) : ℝ) / sharpD
def sharpAR (i : ℕ) : ℝ := ((sharpANum.getD i 0 : ℤ) : ℝ) / sharpD
def sharpHR (i : ℕ) : ℝ := ((sharpHNum.getD i 0 : ℤ) : ℝ) / sharpD

/-- The state potential of the `sharp` certificate on five consecutive gaps. -/
def sharpPsi (g : Fin 5 → ℝ) : ℝ :=
  - plClamp 50 sharpKnotR sharpAR (g 0) - plClamp 50 sharpKnotR sharpHR (g 1)
    + plClamp 50 sharpKnotR sharpHR (g 3) + plClamp 50 sharpKnotR sharpAR (g 4)

def sharpAmin : ℤ := -63052508634231112
def sharpAmax : ℤ := 63052508634231112
def sharpHmin : ℤ := -31526254317115556
def sharpHmax : ℤ := 94578762951346668
/-- `sharpLo = (−amax − hmax + hmin + amin)/2⁶⁸`, `sharpHi` its negative. -/
def sharpLo : ℝ := ((sharpAmin - sharpAmax - sharpHmax + sharpHmin : ℤ) : ℝ) / sharpD
def sharpHi : ℝ := ((sharpAmax - sharpAmin - sharpHmin + sharpHmax : ℤ) : ℝ) / sharpD

theorem sharpANum_bounds :
    ∀ i ∈ range 51, sharpAmin ≤ sharpANum.getD i 0 ∧ sharpANum.getD i 0 ≤ sharpAmax := by
  decide
theorem sharpHNum_bounds :
    ∀ i ∈ range 51, sharpHmin ≤ sharpHNum.getD i 0 ∧ sharpHNum.getD i 0 ≤ sharpHmax := by
  decide
theorem sharpKnotNum_mono : ∀ i ∈ range 50, sharpKnotNum.getD i 0 < sharpKnotNum.getD (i + 1) 0 := by
  decide

theorem sharpD_pos : 0 < sharpD := by unfold sharpD; positivity

theorem sharpKnotR_mono : ∀ i, i < 50 → sharpKnotR i < sharpKnotR (i + 1) := by
  intro i hi
  unfold sharpKnotR
  have h := sharpKnotNum_mono i (mem_range.mpr hi)
  exact div_lt_div_of_pos_right (by exact_mod_cast h) sharpD_pos

theorem sharpPsi_bounds (g : Fin 5 → ℝ) : sharpLo ≤ sharpPsi g ∧ sharpPsi g ≤ sharpHi := by
  have hD := sharpD_pos
  have hA : ∀ i, i ≤ 50 →
      ((sharpAmin : ℤ) : ℝ) / sharpD ≤ sharpAR i ∧ sharpAR i ≤ ((sharpAmax : ℤ) : ℝ) / sharpD := by
    intro i hi
    have := sharpANum_bounds i (mem_range.mpr (by omega))
    unfold sharpAR
    exact ⟨div_le_div_of_nonneg_right (by exact_mod_cast this.1) hD.le,
      div_le_div_of_nonneg_right (by exact_mod_cast this.2) hD.le⟩
  have hH : ∀ i, i ≤ 50 →
      ((sharpHmin : ℤ) : ℝ) / sharpD ≤ sharpHR i ∧ sharpHR i ≤ ((sharpHmax : ℤ) : ℝ) / sharpD := by
    intro i hi
    have := sharpHNum_bounds i (mem_range.mpr (by omega))
    unfold sharpHR
    exact ⟨div_le_div_of_nonneg_right (by exact_mod_cast this.1) hD.le,
      div_le_div_of_nonneg_right (by exact_mod_cast this.2) hD.le⟩
  have h0 := plClamp_mem 50 (by norm_num) sharpKnotR sharpAR sharpKnotR_mono _ _ hA (g 0)
  have h1 := plClamp_mem 50 (by norm_num) sharpKnotR sharpHR sharpKnotR_mono _ _ hH (g 1)
  have h3 := plClamp_mem 50 (by norm_num) sharpKnotR sharpHR sharpKnotR_mono _ _ hH (g 3)
  have h4 := plClamp_mem 50 (by norm_num) sharpKnotR sharpAR sharpKnotR_mono _ _ hA (g 4)
  unfold sharpPsi sharpLo sharpHi
  push_cast
  have e1 : (((sharpAmin : ℤ) : ℝ) - ((sharpAmax : ℤ) : ℝ) - ((sharpHmax : ℤ) : ℝ) + ((sharpHmin : ℤ) : ℝ)) / sharpD
      = ((sharpAmin : ℤ) : ℝ) / sharpD - ((sharpAmax : ℤ) : ℝ) / sharpD
        - ((sharpHmax : ℤ) : ℝ) / sharpD + ((sharpHmin : ℤ) : ℝ) / sharpD := by ring
  have e2 : (((sharpAmax : ℤ) : ℝ) - ((sharpAmin : ℤ) : ℝ) - ((sharpHmin : ℤ) : ℝ) + ((sharpHmax : ℤ) : ℝ)) / sharpD
      = ((sharpAmax : ℤ) : ℝ) / sharpD - ((sharpAmin : ℤ) : ℝ) / sharpD
        - ((sharpHmin : ℤ) : ℝ) / sharpD + ((sharpHmax : ℤ) : ℝ) / sharpD := by ring
  constructor <;> linarith [h0.1, h0.2, h1.1, h1.2, h3.1, h3.2, h4.1, h4.2, e1, e2]

theorem sharp_oscillation : sharpHi - sharpLo ≤ 171 / 100000 := by
  unfold sharpHi sharpLo sharpAmin sharpAmax sharpHmin sharpHmax sharpD
  norm_num

/-- **The `sharp` instance with only the sweep left as a hypothesis.**  The state potential is the
shipped one and its bounds are theorems; `hcob` — the coboundary inequality on every window of
every sorted 258-point list — is what the exhaustive interval subdivision claims. -/
theorem sharp_chain_bound_signed_concrete
    (hcob : ∀ y : Fin 258 → ℝ, StrictMono y → ∀ i ∈ range 252,
      3956 / 1000000 ≤ F 7 3000 (windowGaps 7 (sortedExt y) i)
        + (sharpPsi (stateGaps 7 (sortedExt y) (i + 1)) - sharpPsi (stateGaps 7 (sortedExt y) i))) :
    ∀ ε > 0, ∃ T₀ : ℝ, ∀ T ≥ T₀,
      (Phi_n 7 (3956 / 1000000) 258 3000 - ε) * (Ncount T (2 * T) : ℝ)
        ≤ N0simple T (2 * T) :=
  sharp_chain_bound_signed sharpPsi sharpLo sharpHi sharpPsi_bounds sharp_oscillation hcob

#print axioms plClamp_mem
#print axioms sharpPsi_bounds
#print axioms sharp_oscillation
#print axioms sharp_chain_bound_signed_concrete

end Zeta23Ext.Bridge
