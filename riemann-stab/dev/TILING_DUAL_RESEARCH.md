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
