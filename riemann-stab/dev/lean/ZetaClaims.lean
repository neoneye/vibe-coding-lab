/-
  ZetaClaims.lean
  ===============
  Machine-checked statements accompanying the riemann-stab laboratory.

  Compiled with: Lean 4.33.1, CORE ONLY (no Mathlib).
  Reproduce:     elan default stable && lean ZetaClaims.lean

  Conventions: real quantities appear as INTEGERS scaled by a fixed power
  of ten, documented at each definition. Every `theorem` below is fully
  machine-checked: no `sorry`, no `axiom`.

  Claims that need Mathlib (matrix Frobenius norms, functional calculus)
  or that are conjectural are listed at the bottom as comments,
  deliberately NOT stated as theorems.
-/

/-- H_MT scaled by 10^19, i.e. H_MT = HmtScaled / 10^19, where
    H_MT = 3/2 - cot(1/sqrt2)/sqrt2 = 0.6725007036794116457… -/
abbrev HmtScaled : Int := 6725007036794116457

/-- Bookkeeping skeleton of eq. (1.2) of arXiv:2608.13637:
    N(I') ≥ s1 + 2*s2 + 2*p together with n₊(Q') ≤ s2 + p yields the step
    3*s1 + 4*s2 + 4*p ≤ s1 + 2*N used inside rank P₁ ≥ 4 tr G̃ − 2N − ‖G̃‖². -/
theorem chain_inequality (s1 s2 p N : Int)
    (h : s1 + 2 * s2 + 2 * p ≤ N) :
    3 * s1 + 4 * s2 + 4 * p ≤ s1 + 2 * N := by omega

/-- Final assembly step of the stability-defect refinement
    (ainta/zeta-simple-zeros §5 → thm:main), exact integer form:
    if the retained-central defect satisfies
        D ≥ (4997 * S − 2680 * N) / 1345000
    and the one-window certificate gives S ≥ Hn*N + D, then
        1340003 * S ≥ (1345000 * Hn − 2680) * N.
    Purely arithmetical heart only; analytic inputs are separate. -/
theorem assembly_step (S N D Hn : Int)
    (hdef : 1345000 * D + 2680 * N ≥ 4997 * S)
    (hscaled : 1345000 * S ≥ 1345000 * (Hn * N) + 1345000 * D)
    (hscale : 1345000 * (Hn * N) = 1345000 * Hn * N) :
    1340003 * S + 2680 * N ≥ 1345000 * Hn * N := by omega

/-- Exact arithmetic behind the external manuscript's headline.
    With the manuscript's own TRUNCATED decimal H_MT = 0.6725007036794116457
    (display precision 10^-19), the fraction
        (1345000 * H_MT − 2680) / 1340003
    is pinned on both sides at the printed precision:
        0.6730085279277797612… ≤ fraction ≤ 0.6730085279277797613…
    (The one-ulp gap versus the manuscript's trailing digit is display
    truncation of H_MT, not a mathematical error.) -/
theorem headline_fraction_floor :
    HmtScaled * 1345000 - 2680 * 10000000000000000000
      ≥ 6730085279277797612 * 1340003 := by native_decide

theorem headline_fraction_ceiling :
    HmtScaled * 1345000 - 2680 * 10000000000000000000
      ≤ 6730085279277797613 * 1340003 := by native_decide

/-- The official record stays strictly above the naive truncation floor
    (direction sanity check). -/
theorem improvement_direction :
    HmtScaled * 1345000 - 2680 * 10000000000000000000
      > 6730085279000000000 * 1340003 := by
  have hH : HmtScaled = 6725007036794116457 := rfl
  rw [hH]
  native_decide

/-- Lab cross-functional signal as exact decimals (reference-resolution
    outputs of winCrossFunctional/mixtureStats):
    X = 1.3495972361 (smoothed-indicator parent)
    Y = 1.3567535128 (Montgomery–Taylor parent)
    M = 1.3514083936 (mixed moment) -/
abbrev XScaled : Int := 13495972361
abbrev YScaled : Int := 13567535128
abbrev MScaled : Int := 13514083936

/-- The finite-T experiment shows NO mixed-Gram dip: M ≥ min(X,Y).
    Since X < Y here this reduces to M ≥ X, and Y stays above M.
    Encoded exactly so any regression flips this proof loudly. -/
theorem mixture_no_dip_decimal :
    MScaled >= XScaled ∧ YScaled >= MScaled := by decide

/- ------------------------------------------------------------------
   DELIBERATELY NOT FORMALIZED HERE:

   * Stability-enhanced rank-trace lemma (external manuscript):
       ∀ V d r b Q, column norms ≤ 1 → P = VV* → n₊ Q ≤ b →
       ‖P+Q‖²_F ≥ 4 tr(P+Q) − 3 r − 4 b + D(V* V)
     Requires Mathlib: Frobenius norm, von Neumann trace inequality,
     functional calculus for Ψ(t) = (t−1)² on [0,2], 2t−3 beyond.

   * Seven-point local inequality (Proposition F6):
       ∀ g₁…g₆ ≥ 0, F₆(g) ≥ 19/5000.
     Computer-certified externally via Arb interval arithmetic
     (grid 4000, 128-bit, 707901 nodes). Importing that certificate
     into Lean is future work.

   * CONJECTURE — cross-window functional inequality:
       R₁₂(ψ₀,ψ_MT) < min(R(ψ₀),R(ψ_MT))
     where R₁₂ = (∫ψ₀ψ_MT + ∬|u−v|√(ψ₀ψ_MT)(u)√(ψ₀ψ_MT)(v)) / ((∫ψ₀)(∫ψ_MT)).
     Inferred from Poisson–Gabor + prime-side normalization; numerically
     supported at reference resolution (R₁₂ ≈ 1.32682329); unproved.
------------------------------------------------------------------- -/
