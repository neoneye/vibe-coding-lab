# Overlapping-block dual research: result and next move

## Scope

This directory contains a numerical discovery program, not a new theorem about
zeta zeros.  The exact mathematical ingredient is the cyclic reindexing of the
shifted seven-point functional.  A uniform continuous coboundary inequality is
still required before the improved simple-zero projection can be used.

## What is new in this experiment

- Analytic gradients and multi-start searches now stress periods 9 through 64,
  including long waves, quasiperiodic starts, and random two-band starts.  Every
  tested even period returned the alternating two-cycle; period 9 returned the
  repeated three-cycle.  These are numerical upper bounds on minima, never
  lower-bound certificates.
- A five-gap Bellman graph makes the proposed telescoping proof architecture
  explicit.  On the two-symbol alphabet `{1.041680, 1.979467}`, its lower and
  upper residuals meet at `0.003957393309...`, on the alternating cycle.
- The first apparently successful continuous one-body potential was false.  It
  used a reversal quotient that is valid for the bare block functional but not
  for an oriented coboundary.  Searching all 729 ordered three-basin words
  finds reduced cost `0.003727368933...`.  That counterexample is pinned in the
  test suite.
- Correctly oriented searches found adversarial values near `0.00389481` for a
  one-body potential and `0.00391999` for a degree-two clipped Walsh potential.
  A degree-five run did not improve this.  These values characterize the fixed
  candidates found by the optimizer; they do not prove optimality of a family.

## Interpretation

The compatibility signal survives long-period stress, but a globally clipped
polynomial state potential does not currently expose enough of it.  The active
local minimizers occupy several sharply separated gap basins, while polynomial
interpolation blends those basins and creates cheap oriented transitions.

## Concrete next proof program

1. Partition each gap coordinate at the certified one-variable basin and
   kernel-critical-point boundaries, preserving orientation.
2. Put an independent potential variable on each five-cell state.  Solve the
   finite Bellman linear program using rigorous lower bounds for every
   six-cell transition, not point samples.
3. Refine only transitions whose reduced-cost interval intersects `0.00395`.
   Never quotient by reversal unless the potential constraints explicitly
   enforce reversal symmetry.
4. Emit a standalone certificate: rational cell boundaries, rational potential
   enclosures, and interval kernel bounds.  The checker must enumerate every
   oriented transition and must not invoke the optimizer.
5. Accept the projected zeta improvement only after the checker proves a
   continuous floor at least `0.00395` and the finite-chain boundary term is
   bounded by `O(1)`.

This is a smaller and more falsifiable target than another unconstrained
window search: either the adaptive interval Bellman certificate closes, or its
lowest transition supplies a new explicit counterexample.

## Unusual stone: reversal cohomology

The bare block energy is unchanged when a six-gap edge is reversed.  If `Phi`
is any state potential proving a coboundary floor, apply its inequality to the
reversed edge and average the two inequalities.  The new potential

`Psi(s) = (Phi(s) - Phi(reverse(s))) / 2`

is reversal-antisymmetric and proves the same floor.  Therefore restricting a
search to antisymmetric potentials loses nothing.  It also states exactly when
reflection quotienting is legal.  The doubled integral statement is checked in
`lean/ZetaClaims.lean`; the continuous kernel inequality is not.

The full clipped-Walsh state space has 12 antisymmetric mask pairs.  The best
fixed candidate found by the corrected numerical oracle had adversarial value
about `0.003923427087`, still short of `0.00395`.

## Unusual stone: two phases and domain walls

The alternating chain has two translates.  Rings forced to contain both phases
were relaxed while short arcs inside each phase were pinned.  The excess energy
localized at the two interfaces:

| period | excess per wall |
|---:|---:|
| 32 | 0.000620034007 |
| 48 | 0.000619935991 |
| 64 | 0.000619935975 |

A two-site Bloch analysis of the numerical Hessian found every mode positive;
the softest extensive eigenvalue was about `1.66129029`, stable across periods
32--96 and finite-difference scales `10^-4` through `5*10^-6`.

This suggests a proof route unlike a pointwise block certificate: establish
two locally coercive alternating phases, classify all low-energy blocks into
their neighborhoods, and charge phase changes by a certified interface cost.
The present wall tension and spectral gap are numerical evidence only.  A proof
would need interval Hessian bounds inside the phase neighborhoods and a finite
transition certificate outside them.
