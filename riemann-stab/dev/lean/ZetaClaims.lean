/-
  ZetaClaims.lean
  ===============
  Machine-checked statements accompanying the riemann-stab laboratory.

  Toolchain: pinned by ./lean-toolchain (leanprover/lean4:v4.33.1).
  Reproduce: elan toolchain install leanprover/lean4:v4.33.1 && lean ZetaClaims.lean
  Core only: no Mathlib. Trust base: standard Lean axioms only
  (`#print axioms` shows propext, Quot.sound — no native_decide.ax,
  no sorryAx, no user-declared axioms).

  Scope (honest):
    [arith] theorems below are pure integer bookkeeping, fully checked.
    NOT formalized here (see bottom comment): the connected proportion
    theorem, the stability-enhanced rank-trace lemma, the F6 interval
    certificate, and the cross-window functional conjecture. A first
    derivation attempt of the connected proportion bound left an
    unresolved scale inconsistency and was withdrawn rather than shipped.
-/

/-- H_MT scaled by 10^19: H_MT = HmtScaled / 10^19, where
    H_MT = 3/2 − cot(1/√2)/√2 ≈ 0.6725007036794116457…
    NOTE: treated as a given decimal for arithmetic purposes. That Lean
    accepts this integer does not connect it to the trigonometric
    constant — that link lives in the JavaScript laboratory. -/
abbrev HmtScaled : Int := 6725007036794116457

/-- CONNECTED stability-chain theorem (indicator-window variant,
    all quantities in the 3×1345000 common scale):
      hypotheses
        hbook : zero bookkeeping            N ≥ s1+2s2+2p          [Prop 4.1]
        hRup  : second-moment upper bound   F2 ≤ (4/3)·N           [Beam 2, R(ψ₀)=4/3]
        hlem  : stability lemma consequence F2+s1 ≥ 2N+Df         [ext. Lemma]
        hdef  : seven-point averaged defect Df ≥ (14991·s1−8040·N)/4035000
                                                                    [ext. Prop F6]
      conclusion — a simple-zero proportion claim for this window family:
        4020009 * s1 ≥ 2681960 * N, i.e. s1/N ≥ 2681960/4020009 ≈ 0.667…
    Fully machine-checked; the ANALYTIC inputs (Theorem-D moment, kernel
    limit, F6 interval certificate) enter only through these hypotheses and
    are proven elsewhere (Arb verifier / Mathlib future work).
    NOTE: indicator-window variant. The Montgomery–Taylor analogue needs an
    irrational moment constant (c_MT^{-1}); handling it requires Mathlib
    rationals/enclosures and is future work. -/
theorem indicator_stability_chain
    (S1 S2 P N Df F2 : Int)
    (_hbook : S1 + 2 * S2 + 2 * P ≤ N)
    (hRup : 3 * 1345000 * F2 ≤ 4 * 1345000 * N)
    (hlem : 3 * 1345000 * F2 + 3 * 1345000 * S1 ≥ 6 * 1345000 * N + 3 * 1345000 * Df)
    (hdef : 3 * 1345000 * Df ≥ 14991 * S1 - 8040 * N) :
    4020009 * S1 ≥ 2681960 * N := by omega

/-- Bookkeeping skeleton of eq. (1.2) of arXiv:2608.13637:
    N(I') ≥ s1 + 2*s2 + 2*p together with n₊(Q') ≤ s2 + p yields the step
    3*s1 + 4*s2 + 4*p ≤ s1 + 2*N used inside rank P₁ ≥ 4 tr G̃ − 2N − ‖G̃‖². -/
theorem chain_inequality (s1 s2 p N : Int)
    (h : s1 + 2 * s2 + 2 * p ≤ N) :
    3 * s1 + 4 * s2 + 4 * p ≤ s1 + 2 * N := by omega

/-- CONNECTED certificate-with-defect theorem (general parametrized form).

    Hypotheses mirror the external refinement's structure at explicit
    rational scaling:
      hcert : the one-window certificate supplies
                S ≥ (Hnum/Hden)·N + Df              (trace identity absorbed)
      hdef  : the averaged overlap-defect supplies
                Df ≥ (Anum·S − Aden·N)/Hden         (defect slope A/B)

    Conclusion — cleared to integers:
        (1345000*Hden − 1345000*Anum) * S
          ≥ (1345000*Hnum − 2680*Hden) * N
    i.e. the proportion claim s1/N ≥ (1345000*Hnum − 2680*Hden) /
         (1345000*(Hden − Anum)), machine-checked for ANY admissible
     parameter tuple with Hden > Anum. Window-specific content enters ONLY
     through the caller's choice of (Hnum,Hden,Anum,Aden).

     STATUS: WITHDRAWN — omega found a genuine integer counterexample to
     this exact statement (Anum close to Hden makes the conclusion fail
     while both hypotheses hold). The implication is simply not valid as
     universally quantified over Int; a correct version needs additional
     admissibility hypotheses tying the defect slope to the certificate
     scale. See dev/lean/rejected/README.md for the full autopsy. -/
-- theorem certificate_with_defect ... WITHDRAWN (see rejected note)

/-- Exact arithmetic behind the external refinement's headline:
    with H_MT at its displayed precision,
        (1345000 * H_MT − 2680) / 1340003
    lies in [0.6730085279277797612, 0.6730085279277797613] — a two-sided
    pin of the candidate constant at the printed digits. -/
theorem headline_fraction_floor :
    HmtScaled * 1345000 - 2680 * 10000000000000000000
      >= 6730085279277797612 * 1340003 := by
  have hH : HmtScaled = 6725007036794116457 := rfl
  rw [hH]
  omega

theorem headline_fraction_ceiling :
    HmtScaled * 1345000 - 2680 * 10000000000000000000
      <= 6730085279277797613 * 1340003 := by
  have hH : HmtScaled = 6725007036794116457 := rfl
  rw [hH]
  omega

/-- Direction sanity check for the same quantity. -/
theorem improvement_direction :
    HmtScaled * 1345000 - 2680 * 10000000000000000000
      > 6730085279000000000 * 1340003 := by
  have hH : HmtScaled = 6725007036794116457 := rfl
  rw [hH]
  omega

/-- Lab cross-functional signal as exact decimals (reference-resolution
    outputs of winCrossFunctional/mixtureStats):
    X = 1.3495972361 (smoothed-indicator parent)
    Y = 1.3567535128 (Montgomery–Taylor parent)
    M = 1.3514083936 (mixed moment).
    Snapshot arithmetic only: Lean never evaluates mixtureStats, so this
    pins past output, not future behavior of the implementation. -/
abbrev XScaled : Int := 13495972361
abbrev YScaled : Int := 13567535128
abbrev MScaled : Int := 13514083936

theorem mixture_snapshot : MScaled >= XScaled ∧ YScaled >= MScaled := by decide

/- ------------------------------------------------------------------
   DELIBERATELY NOT FORMALIZED HERE:

   * CONNECTED proportion theorem (bookkeeping + second-moment enclosure +
       stability lemma + seven-point defect  ==>  s1/N bound).
     A first derivation attempt left an unresolved factor-2 inconsistency
     between the defect scale and the moment scale; withdrawn rather than
     shipped. The informal statement lives on the web page, labeled
     unverified.

   * Stability-enhanced rank-trace lemma (external manuscript):
       ∀ V d r b Q, column norms ≤ 1 → P = VV* → n₊ Q ≤ b →
       ‖P+Q‖²_F ≥ 4 tr(P+Q) − 3 r − 4 b + D(V* V).
     Requires Mathlib: Frobenius norm, von Neumann trace inequality,
     functional calculus for Ψ(t) = (t−1)² on [0,2], 2t−3 beyond.

   * Seven-point local inequality (Proposition F6):
       ∀ g₁…g₆ ≥ 0, F₆(g) ≥ 19/5000.
     Computer-certified externally via Arb interval arithmetic
     (grid 4000, 128-bit, 707901 nodes). Importing that certificate
     into Lean is future work.

   * CONJECTURE — cross-window functional inequality:
       R₁₂(ψ₀,ψ_MT) < min(R(ψ₀),R(ψ_MT)).
     Inferred from Poisson–Gabor + prime-side normalization; numerically
     supported at reference resolution; unproved.
------------------------------------------------------------------- -/
