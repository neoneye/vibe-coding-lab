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
    [abstract] reversal-coboundary symmetrization and the telescoping
    coboundary-floor lemmas are checked independently of any analytic claim
    about the zeta kernel: they say a per-edge floor becomes a chain floor,
    not that any particular edge inequality holds.
    [pin] the swept-floor projection theorems pin a decimal, not a proof of
    the assembly they come from.
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

/-- Bookkeeping skeleton of eq. (1.2) of arXiv:2608.13637:
    N(I') ≥ s1 + 2*s2 + 2*p together with n₊(Q') ≤ s2 + p yields the step
    3*s1 + 4*s2 + 4*p ≤ s1 + 2*N used inside rank P₁ ≥ 4 tr G̃ − 2N − ‖G̃‖². -/
theorem chain_inequality (s1 s2 p N : Int)
    (h : s1 + 2 * s2 + 2 * p ≤ N) :
    3 * s1 + 4 * s2 + 4 * p ≤ s1 + 2 * N := by omega

/-- Reversal-cohomology lemma for a finite-range chain.  If reversing an edge
    swaps its endpoints without changing its cost, then any coboundary lower
    bound can be averaged with its reversed copy.  The displayed potential is
    doubled to keep the statement integral:

      Ψ₂(s) = Φ(s) − Φ(R(s)).

    Thus restricting a certificate search to reversal-antisymmetric potentials
    loses no attainable floor.  This is abstract bookkeeping: applying it to
    the seven-point kernel still requires a certified analytic edge bound. -/
theorem reversal_coboundary_symmetrization {α : Type} (F : α → α → Int)
    (R : α → α) (Phi : α → Int) (c : Int)
    (hF : ∀ s t, F (R t) (R s) = F s t)
    (hcert : ∀ s t, c ≤ F s t + Phi t - Phi s) :
    ∀ s t, 2 * c ≤ 2 * F s t
      + (Phi t - Phi (R t)) - (Phi s - Phi (R s)) := by
  intro s t
  have hforward := hcert s t
  have hreverse := hcert (R t) (R s)
  rw [hF s t] at hreverse
  omega

/-- The doubled averaged potential above is genuinely antisymmetric when R is
    an involution. -/
theorem reversal_potential_antisymmetric {α : Type} (R : α → α)
    (Phi : α → Int) (hR : ∀ s, R (R s) = s) :
    ∀ s, Phi (R s) - Phi (R (R s)) = -(Phi s - Phi (R s)) := by
  intro s
  rw [hR s]
  omega

/-- Directed-edge bookkeeping for a cyclic two-phase word.  If every low and
    high site is counted by its outgoing edge, and cross-phase edges balance,
    then the population imbalance equals the imbalance of the two defect
    types.  This is the exact combinatorial charge behind the odd-ring kink
    probe; it supplies no analytic lower bound for either defect energy. -/
theorem binary_phase_defect_balance
    (nLow nHigh nLL nHH nLH nHL : Int)
    (hLow : nLow = nLL + nLH)
    (hHigh : nHigh = nHH + nHL)
    (hCross : nLH = nHL) :
    nLow - nHigh = nLL - nHH := by omega

/-- Telescoping sum over an initial segment. -/
def sumRange (f : Nat → Int) : Nat → Int
  | 0 => 0
  | n + 1 => sumRange f n + f n

/-- The mechanism a coboundary certificate runs on: the potential differences
    along a path collapse to the two endpoints. -/
theorem potential_telescopes (Phi : Nat → Int) :
    ∀ n : Nat, sumRange (fun i => Phi (i + 1) - Phi i) n = Phi n - Phi 0 := by
  intro n
  induction n with
  | zero => show (0 : Int) = Phi 0 - Phi 0; omega
  | succ k ih =>
      show sumRange (fun i => Phi (i + 1) - Phi i) k + (Phi (k + 1) - Phi k)
        = Phi (k + 1) - Phi 0
      rw [ih]
      omega

/-- A per-edge floor becomes a chain floor up to one boundary term.  If every
    edge of a path satisfies `c ≤ F i + Phi (i+1) - Phi i`, then the path cost
    is at least `n * c` minus the endpoint difference.  This is the statement
    the additive certificates in `dev/tiling_additive.js` are built to feed,
    and the boundary term there is bounded by the certificate amplitude,
    uniformly in `n`.  The analytic hypothesis — that the six-gap inequality
    holds for every nonnegative gap vector — is NOT proved here; only the
    bookkeeping is. -/
theorem coboundary_floor_telescopes (F Phi : Nat → Int) (c : Int)
    (hedge : ∀ i, c ≤ F i + Phi (i + 1) - Phi i) :
    ∀ n : Nat, (n : Int) * c ≤ sumRange F n + (Phi n - Phi 0) := by
  intro n
  induction n with
  | zero =>
      show ((0 : Nat) : Int) * c ≤ (0 : Int) + (Phi 0 - Phi 0)
      omega
  | succ k ih =>
      have hk := hedge k
      have hcast : ((k + 1 : Nat) : Int) = (k : Int) + 1 := by omega
      show ((k + 1 : Nat) : Int) * c ≤ sumRange F k + F k + (Phi (k + 1) - Phi 0)
      rw [hcast]
      have hexpand : ((k : Int) + 1) * c = (k : Int) * c + c := by
        rw [Int.add_mul, Int.one_mul]
      rw [hexpand]
      omega

/-- Cyclic corollary: on a closed chain the boundary term vanishes outright,
    so a per-edge floor is exactly a mean-cost floor for the cycle. -/
theorem cyclic_coboundary_floor (F Phi : Nat → Int) (c : Int) (n : Nat)
    (hedge : ∀ i, c ≤ F i + Phi (i + 1) - Phi i)
    (hclosed : Phi n = Phi 0) :
    (n : Int) * c ≤ sumRange F n := by
  have h := coboundary_floor_telescopes F Phi c hedge n
  rw [hclosed] at h
  omega

/- WITHDRAWN THEOREM SKETCH — DO NOT REINSTATE WITHOUT READING
   dev/lean/rejected/README.md.

   Claim attempted: from hcert : S ≥ (Hnum/Hden)·N + Df and
   hdef : Df ≥ (Anum·S − Aden·N)/Hden, conclude the proportion bound
   (1345000*Hden − 1345000*Anum)*S ≥ (1345000*Hnum − 2680*Hden)*N.

   DISPOSITION: omega REFUTED this implication over Int (genuine integer
   counterexample; see dev/lean/rejected/README.md for the constraint
   system). The refutation exposed a real mathematical content problem:
   pairing an indicator-window moment bound with Montgomery–Taylor-kernel
   defect coefficients mixes two different window certificates. Any
   correct version needs window-coherent hypotheses supplied by actual
   analytic work — not a tactic fix.
- -/
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

/-- R(psi_MT) scaled by 10^19: the second-moment functional at its unique
    critical point, R = 1/2 + cot(1/sqrt 2)/sqrt 2 = 1.3274992963205883543...
    The closed form is not assumed here; it is derived by evaluating the
    Euler-Lagrange equation at s = 0 (see core.js) and checked to 31 digits. -/
abbrev RmtScaled : Int := 13274992963205883543

/-- The Montgomery-Taylor constant is exactly two minus that value:

        H_MT + R(psi_MT) = 2.

    Both sides are 3/2 - cot(1/sqrt 2)/sqrt 2 and 1/2 + cot(1/sqrt 2)/sqrt 2, so
    the cotangent cancels and the identity is exact rather than numerical.  What
    Lean checks is that the two displayed decimals really are complements; that
    they are the right decimals is the laboratory's business. -/
theorem montgomery_taylor_complement :
    RmtScaled + HmtScaled = 2 * 10000000000000000000 := by decide

/-- The exhaustively swept chain floor, as an exact rational: 989/250000
    = 0.003956.  It sits strictly above the published local certificate
    19/5000, which is the whole point of the sweep. -/
theorem swept_floor_beats_local_certificate :
    (989 : Int) * 5000 > 19 * 250000 := by omega

/-- Projection of the swept floor.  With floor c = 989/250000 the shifted
    block assembly uses 252 windows per block and blocks of 258 gaps, so

        bound = (258*10^6 * H_MT - 514000) / 257003088,

    the same algebra that turns the published floor 19/5000 into
    (1345000 * H_MT - 2680)/1340003.  Two-sided pin at the printed digits:
    the constant lies in [0.6731093501463616833, 0.6731093501463616834].
    As with the headline pin, Lean is checking arithmetic on a decimal, not
    the analytic derivation behind the assembly. -/
theorem swept_projection_floor :
    258000000 * HmtScaled - 514000 * 10000000000000000000
      >= 6731093501463616833 * 257003088 := by
  have hH : HmtScaled = 6725007036794116457 := rfl
  rw [hH]
  omega

theorem swept_projection_ceiling :
    258000000 * HmtScaled - 514000 * 10000000000000000000
      <= 6731093501463616834 * 257003088 := by
  have hH : HmtScaled = 6725007036794116457 := rfl
  rw [hH]
  omega

/-- The swept projection strictly improves on the published one: the two-sided
    pins do not overlap. -/
theorem swept_projection_improves :
    (6731093501463616833 : Int) > 6730085279277797613 := by omega

/-- The floor established by the sweep that uses proved enclosures rather than
    plain double precision: 989/250000 = 0.003956.  That is the same floor the
    double-precision sweep reaches, so the arithmetic gap between the two rungs
    has closed: everything the fast sweep can see, the rigorous one now sees. -/
theorem rigorous_floor_beats_local_certificate :
    (989 : Int) * 5000 > 19 * 250000 := by omega

/-- Projection of the rigorous floor.  With c = 989/250000 the assembly uses
    252 windows per block and blocks of 258 gaps, so

        bound = (258000000 * H_MT - 514000) / 257003088,

    pinned two-sidedly at [0.6731093501463616833, 0.6731093501463616834] --
    the same interval as swept_projection_floor/ceiling, which is the point. -/
theorem rigorous_projection_floor :
    258000000 * HmtScaled - 514000 * 10000000000000000000
      >= 6731093501463616833 * 257003088 := by
  have hH : HmtScaled = 6725007036794116457 := rfl
  rw [hH]
  omega

theorem rigorous_projection_ceiling :
    258000000 * HmtScaled - 514000 * 10000000000000000000
      <= 6731093501463616834 * 257003088 := by
  have hH : HmtScaled = 6725007036794116457 := rfl
  rw [hH]
  omega

/-- The projection pins.  The published local certificate sits strictly below
    what the sweep gives, and the swept constant sits strictly below the ceiling
    the alternating chain imposes (0.6731102697399269...).  The two sweep rungs,
    double precision and proved enclosures, now land on the same floor, so there
    is no longer a third rung between them.  No interval overlaps another, so
    none of this depends on rounding. -/
theorem projection_ladder :
    (6730085279277797613 : Int) < 6731093501463616833
    ∧ (6731093501463616834 : Int) < 6731102697399269000 := by
  constructor <;> omega

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
