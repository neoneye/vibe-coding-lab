# Overlapping-block dual research: result and next move

## Scope

This directory contains a numerical discovery program, not a new theorem about
zeta zeros.  The exact mathematical ingredient is the cyclic reindexing of the
shifted seven-point functional.  A uniform continuous coboundary inequality is
still required before the improved simple-zero projection can be used.

## What is new in this experiment

- Analytic gradients and multi-start searches now stress periods 9 through 64,
  including long waves, quasiperiodic starts, random two-band starts, and both
  alternating orientations.  Every tested even period returned the alternating
  two-cycle; odd periods carry a localized kink.  These are numerical upper
  bounds on minima, never lower-bound certificates.
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
The next section removes exactly that obstruction: the potential does not have
to be smooth, and once each gap coordinate carries a free piecewise-linear
function the same additive ansatz reaches the ceiling.


## The move that closed the numerical gap: an additive normal form

Every previous coboundary search parameterized `Phi` through a single clipped
ramp per gap coordinate.  That was the binding constraint, not the geometry.

Take any *additive* state potential `Phi(s) = sum_k psi_k(s_k)`.  The reversal
lemma says one may antisymmetrize without losing floor, and antisymmetrizing
preserves additivity.  Writing out the telescoping edge difference for such a
potential gives an exact normal form with only two free functions:

`R(g) = F6(g) + a(g0) + a(g5) + b(g1) + b(g4) - (a+b)(g2) - (a+b)(g3).`

Every antisymmetric additive potential produces such a pair `(a, b)` and every
pair arises from one, so searching `(a, b)` searches the whole family.  Both
directions are checked in `tiling_additive_test.js`.  Two structural facts fall
out immediately:

- `R` is reversal invariant *by construction*.  The reflection quotient in the
  adversarial search, which was illegal for the oriented Walsh family and
  produced the pinned autopsy, is legal here.
- On both alternating blocks every feature cancels, so `R = F6 = 0.003957393309`
  there for any `(a, b)`.  The alternating chain energy is a hard ceiling on
  what this family can certify — and it is exactly the conjectured chain
  minimum.

With `a` and `b` free piecewise-linear functions on a 51-knot grid and the
max-min solved by linear-programming cut generation instead of a subgradient
loop, the audited floor moves from `0.003923427087` (previous best, degree-five
clipped Walsh) to

| certificate | audited floor | search box | amplitude bound | share of gain |
|---|---:|---:|---:|---:|
| record | `0.003957227285` | `[0, 28]^6` | `5.1968e-3` | `99.89%` |
| compact | `0.003950948242` | `[0, 16]^6` | `1.1068e-3` | `96.03%` |

Both are in `tiling_additive.certificate.json` and are re-audited from scratch
by `tiling_additive_test.js`.  The compact one is the interval-sweep target:
it clears the programme's stated `0.00395` with margin, its cube is smaller by
a factor of `28^6/16^6 ≈ 29`, and its amplitude — which also bounds the
finite-chain boundary term — is five times smaller.

The record floor is `1.66e-7` below the structural ceiling.  Both were audited
in JavaScript by three adversaries that share no code with the Python search
that produced them: the deterministic 729-word three-basin enumeration, a
differential-evolution run, and a gradient multistart.  Python and JavaScript
agree to about `4e-18`.

### Amplitude, the tail, and why the search box is finite

`F6(g) >= (sum g)/3000` with every pair term nonnegative, so

`R(g) >= (sum g)/3000 - amplitude`, &nbsp; `amplitude = 2(|a|_inf + |b|_inf + |a+b|_inf)`.

Any gap reaching `3000*(floor + amplitude)` therefore satisfies the inequality
outright, and the certificate only has to be checked on that cube.  Adding a
constant to `a` or to `b` leaves `R` unchanged — each enters with signs
`(+,+,-,-)` — so gauge-centering both functions is free and shrinks the cube by
a factor of about fifty.  The audits above search the entire cube each
certificate's own tail lemma leaves open, not a convenient part of it.

The same amplitude bounds the finite-chain boundary term: a length-`m` chain
loses at most `2*max|Phi| = O(1)`, independent of `m`.  That is the `o(m)`
requirement of step 5 below, made explicit.

### What a floor is worth: the payoff curve

The conditional projection is strongly concave in the certified floor, so the
round number `0.00395` was never the real target.  `floorPayoff` in
`tiling_research.js` reports the fraction of the available improvement a floor
buys, between the published isolated-block certificate `19/5000` and the
alternating-chain ceiling.

| floor | source | projected constant | share of available gain |
|---:|---|---:|---:|
| `0.003800000000` | published `F6 >= 19/5000` | `0.6730085279` | `0%` |
| `0.003826231219` | true isolated-block minimum | `0.6730254768` | `16.7%` |
| `0.003923427087` | previous best coboundary | `0.6730882669` | `78.4%` |
| `0.003950948242` | additive compact certificate | `0.6731062256` | `96.0%` |
| `0.003957227285` | additive record certificate | `0.6731101602` | `99.9%` |
| `0.003957393309` | alternating chain candidate | `0.6731102697` | `100%` |

Two consequences for the proof program.  Reaching the ceiling exactly is worth
almost nothing over reaching `0.003951`, so an interval sweep should be run
against a certificate with margin, not against the record.  And the earlier
verdict that a family "still falls short of `0.00395`" was measuring the wrong
thing: the previous best was already buying 78% of the prize.

### Reproducing it

`tiling_additive_search.py` is the discovery tool and is deliberately outside
the trusted base: it needs numpy and scipy, and it emits candidates only.

```
python3 -m venv venv && venv/bin/pip install numpy scipy
venv/bin/python tiling_additive_search.py maxmin 0.10 26 1e-4 record.json
venv/bin/python tiling_additive_search.py refine record.json 0.003951 26 compact.json
```

`tiling_additive.js` evaluates and audits; `tiling_additive_test.js` re-audits
the shipped file from scratch on every suite run and fails if a floor moves.

### Status

Still numerical.  The coefficients are floating-point LP output and the floors
are floating-point global searches; a missed minimum inside the cube would
invalidate them.  What changed is that the remaining obligation is now a single
well-posed finite computation — an interval sweep of one explicit piecewise
linear inequality over one explicit finite cube — rather than a search for a
family that might work at all.

## Concrete next proof program

The five-dimensional cell-partition Bellman program below is no longer the
cheapest route.  The additive normal form replaces a potential on five-gap
cells by two functions of one variable, so the obligation collapses to:

1. Fix a shipped certificate with margin — the compact one, not the record —
   and rationalize its knots and coefficients.
2. Interval-sweep `R(g) >= floor` over the single cube its own tail lemma
   leaves open.  Branch on the six gaps; `R` is piecewise linear in the
   potential part, so only the kernel needs interval enclosures.
3. Discard sub-boxes by the tail bound `R >= (sum g)/3000 - amplitude` before
   evaluating the kernel at all; that is what keeps the cube finite in
   practice as well as in principle.
4. Emit a standalone checker: rational knots, rational coefficients, interval
   kernel bounds, no optimizer in the trusted base.
5. Accept the projected zeta improvement only after the checker closes.  The
   finite-chain boundary term is already explicit: it is bounded by the
   certificate amplitude, uniformly in the chain length.

Either the sweep closes, or one of its sub-boxes supplies an explicit
counterexample and the audited floor above is wrong.  Both outcomes are
informative, and both are reachable with one finite computation.

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
about `0.003923427087`.  That is 78% of the available improvement, not the
failure the earlier round number suggested; and replacing the clipped ramp by
free piecewise-linear functions raises it to `0.003957227285` (above).

## Unusual stone: two phases and domain walls

The alternating chain has two translates.  Rings forced to contain both phases
were relaxed while short arcs inside each phase were pinned.  The excess energy
localized at the two interfaces:

| period | total two-interface excess |
|---:|---:|
| 32 | 0.001240068014 |
| 48 | 0.001239871982 |
| 64 | 0.001239871950 |

The two interfaces are not energetically equivalent.  Odd rings isolate their
two orientations.  At period 63 the low-low kink costs `0.001092786451`, while
the high-high kink costs only `0.000147085491`.  Their sum differs from the
period-64 two-interface excess by about `7.0e-12`.  An earlier odd-period stress
missed the cheap kink because it seeded only one alternating phase; both phases
are now mandatory starts and the old period-9 pin has been replaced.

For any cyclic binary phase word, directed-edge counting gives the exact charge
identity `#low - #high = #LL - #HH`, since `#LH = #HL`.  Its integer skeleton is
machine-checked as `binary_phase_defect_balance`.  The numerical kink costs are
not part of that theorem.

A two-site Bloch analysis of the numerical Hessian found every mode positive;
the softest extensive eigenvalue was about `1.66129029`, stable across periods
32--96 and finite-difference scales `10^-4` through `5*10^-6`.
Scanning finite-amplitude Bloch deformations kept the energy-to-square-distance
ratio positive: about `0.83048` at radius `0.01` and `0.77675` at radius `0.15`.
The soft nonlinear direction is a staggered deformation concentrated on the
high-gap sublattice.  This scan covers structured phonon directions, not every
point in the corresponding neighborhood.

This suggests a proof route unlike a pointwise block certificate: establish
two locally coercive alternating phases, classify all low-energy blocks into
their neighborhoods, and charge LL and HH defects by separate certified costs.
The present wall tension and spectral gap are numerical evidence only.  A proof
would need interval Hessian bounds inside the phase neighborhoods and a finite
transition certificate outside them.
