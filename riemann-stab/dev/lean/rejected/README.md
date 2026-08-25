# Rejected derivation: connected proportion theorem (first attempt)

Status: WITHDRAWN 2026-08-25. Reason: unresolved factor-2 scale
inconsistency between the seven-point defect bound and the second-moment
bound. Preserved here so future reviewers can reproduce exactly why the
theorem was not shipped.

## What was attempted

Combine, at a common integer scale:

  (hcert) 1345000*S >= Hnum*N + 1345000*Df
  (hRup)  3*1345000*F2 <= 4*1345000*N          [Beam-2 moment upper bound]
  (hlem)  F2 + S1 >= 2*N + Df                  [stability lemma consequence]
  (hdef)  3*1345000*Df >= 14991*S1 - 8040*N    [seven-point defect]

into a single s1/N lower bound. Eliminating F2 and Df by linear combination
yields (after correcting one sign slip that omega's counterexample caught):

  4020009 * S1 >= 2681960 * N        i.e.  s1/N >= 0.66715

## Why it was still withdrawn

The constant 2681960/4020009 encodes the defect slope pair (14991/4035000,
8040/4035000), which is derived from the Montgomery–Taylor overlap kernel.
Pairing it with an indicator-window moment bound mixes two different window
certificates — precisely the incoherence flagged in review. The residual gap
between this skeleton's ≈0.6730071 and the manuscript's published
0.6730085279… is NOT an o(N) effect: after dividing by N, little-o remainders
vanish and cannot shift a limiting proportion. It traces instead to (a) the
coarse rational enclosure R_hi = 1327501/10^6 exceeding c_MT^-1 by ~3e-7 and
(b) normalization differences between my defect scaling (×4035000) and the
manuscript's (/1345000). Both are unresolved coefficient/enclosure issues,
not asymptotic remainders.

## Machine-checkable residue

The implication that DOES hold and was verified by omega over 100000 random
instances plus an exhaustive small-range sweep:

  hcert /\ hdef ==> 1340003 * s1 + 2680 * n >= Hn * n

(see git history of dev/lean/ZetaClaims.lean and mix_convergence_test.js).
