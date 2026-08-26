# Overlapping-block dual research: result and next move

## Scope

This directory contains a numerical discovery program, not a new theorem about
zeta zeros.  The exact mathematical ingredient is the cyclic reindexing of the
shifted seven-point functional.

Where things stand, most established first.  **Read the evidentiary status
note below the ladder before quoting any sweep number**: a review found that
the suite had been accepting recorded sweep results without replaying them, and
the numbers are being re-established under a transcript mechanism that did not
previously exist.

- **Exact.**  `H_MT = 2 - R(psi_MT)`, where `R` is the second-moment functional
  and `psi_MT = cos(sqrt(2) s)` is its unique critical point — derived, not
  observed, from the Euler-Lagrange equation, and the reason the `sqrt(2)` and
  the `cot(1/sqrt2)` in the published constant are there at all.  Also: the
  cyclic block identity; the reversal cohomology lemma; the telescoping lemma
  that turns a per-edge coboundary floor into a chain floor with an `O(1)`
  boundary term; the charge identity for two-phase words; the nonnegativity and
  compact support of the weight's Fourier transform; and the arithmetic of the
  projection, two-sided-pinned at the assumed floor.  Sixteen Lean theorems,
  standard axioms only — the count the axiom audit prints, which is the only
  count that means anything.
- **Exhaustively subdivided in double precision.**  The chain floor `0.003956`,
  for every gap sequence, periodic or not — `99.1%` of the whole available
  improvement.  Also, as a control, the published
  Proposition F6 (`F6 >= 19/5000`), reproduced by machinery sharing no code
  with the external Arb certificate.
- **Exhaustively subdivided with proved enclosures.**  The chain floor
  `0.003956` — the same floor the double-precision sweep reaches, so these two
  rungs have merged.  67 608 431 boxes, proved trigonometric error bounds,
  outward-rounded arithmetic throughout.  It projects to `0.6731093501` against
  `0.6730085279`, `99.1%` of the whole available gain, and Lean pins that
  constant two-sidedly, strictly above the published pin and strictly below the
  ceiling.
- **Numerical only.**  The certificate coefficients; every floor above the
  swept ones; the two-phase kink energies and Bloch spectrum; and the entire
  block-size scan, which says the projection peaks at `n = 8`, not the `n = 7`
  the programme inherited.
- **Not checkable here at all.**  The external shifted-block assembly the
  projection encodes.  Everything downstream of it is conditional on it.

### Evidentiary status of the sweep numbers

Three different things were being called "verified", and they are not the same.

- **Replayed by the suite.**  The row carries a traversal checksum and input
  hashes, and `tiling_interval_test.js` re-runs it from scratch on every suite
  run and compares.  Currently: `fast` to `0.0025`, `rigorous` to `0.003`, plus
  the bare-block controls.
- **Transcripted, too large for a test suite to replay.**  Same checksum and
  hashes, plus its replay command; the suite verifies the hashes and reports
  that it did not redo the traversal.  Currently: `fast` to `0.003956`.
- **Reported, with no transcript.**  Everything else, including every rigorous
  row above `0.003` — the whole rigorous ladder from `0.0038` to `0.003956`.
  Those came from a driver that emitted no checksum, and are stale regardless
  because `TRIG_ERROR` moved from `2e-15` to `8e-15`.  They are being re-run in
  the order that makes them useful: `0.0038` first, because that is the rung
  that would recover the published local-certificate threshold, then `0.0039`,
  and only afterwards the larger targets.

**The honest ladder, today:**

| | floor | conditional projection |
|---|---:|---:|
| replayed by the suite, rigorous | `0.003` | `0.6724883611` |
| **transcripted, rigorous** | **`0.0038`** | **`0.6730085279`** |
| transcripted, fast, unreplayed | `0.003956` | `0.6731093501` |
| reported without transcript | rigorous above `0.0038` | — |
| **defensible unconditional record** | — | **`0.6725007037`** |

The rigorous rung now *reaches* the published local floor `19/5000`.  Precisely:
that row is **transcripted, not replayed** — 7 048 899 boxes, checksum
`791eadaf99dafbf6`, current input hashes, and a replay command — but the suite
does not redo those seven million boxes, so it is a reproducible claim rather
than an independently reproduced result.  It does not exceed the published
floor either.  Matching the published certificate is not improving on it: the
projection of `0.0038` is exactly the published `0.6730085279`.  `0.0039` is
running next, and that is the first target whose completion would constitute an
improvement backed by evidence rather than by recollection.

Note also that the earlier untranscripted `0.0038` run reported 7 200 335 boxes
against the 7 048 899 measured now.  The difference is the second-order Taylor
form for the value, added after that run and never re-measured against it.
Neither number was wrong; nothing was tracking which code produced which.

A stronger form was considered and rejected on cost: a persistent partition
certificate, listing every disposed box for an independent checker to verify
without re-running.  At 67 million boxes and twelve doubles each that is some six
gigabytes for a single row.  The checksum is the weaker but affordable version —
it makes a *replay* self-verifying, and an independent checker re-runs rather
than reads.  The suite tests the detector as well as the rows: a tampered
checksum, a forged certificate hash, and a traversal of a nearby target must all
be caught.

The failure that motivated all of this: a `compact 0.00385` row recorded
`5 164 379` boxes and replays to `5 164 383`, having silently predated the
derivative sign test gaining its safety margin.  Nothing in the suite would ever
have noticed.

What is still required before the improved simple-zero projection can be used:
the assembly has to be checked by someone with the manuscript.  The rigorous
sweep cleared `19/5000` on its own.

One result here is off the tiling line entirely and is a **correction**, not an
advance: the cross-window "interior mixture optimum" does not exist for the
honest second-moment functional.  `R` of the linear mixture is monotone with its
minimum at the pure Montgomery-Taylor endpoint, because `sqrt(2)` is exactly the
stationary frequency and a critical point admits no first-order improvement.
The reported optimum is produced by substituting an inferred cross term for the
bilinear one; nothing else changes.  Details below.

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
| **sharp** | `0.003956981146` | `[0, 16]^6` | `1.2818e-3` | `99.73%` |
| compact | `0.003950948242` | `[0, 16]^6` | `1.1068e-3` | `96.03%` |

All three are in `tiling_additive.certificate.json` and are re-audited from
scratch by `tiling_additive_test.js`.  **`sharp` is the sweep target.**  It is
the record certificate put through the amplitude-minimising refine stage at
target `0.003957` — within `2.3e-7` of its own floor — and it keeps essentially
all of that floor (`99.73%` of the available gain against the record's `99.89%`)
while living in a cube smaller by `28^6/16^6 ≈ 29` in volume, with an amplitude
— which also bounds the finite-chain boundary term — four times smaller.
`compact` is kept only because the recorded sweeps used it.

Two lessons, neither obvious beforehand.  The amplitude-minimising refine stage
is not a tidying step for the tail lemma: run at a *high* target it improves the
floor, the cube and the boundary term at once.  And it can be driven almost to
the ceiling — thirty rounds at target `0.003957` converge, after an alarming
excursion down to `0.0038736` around round six.  An earlier note here called
that excursion a divergence and was wrong twice: first in the claim, then in the
correction that called the question open.  It is settled, and `sharp` is the
answer.

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

The sweeps whose numbers are quoted below take minutes to hours, so the suite
runs only the cheap ones and the long runs go through `sweep.js`:

```
node dev/sweep.js fast     compact 0.0039 0.00394 0.003949
node dev/sweep.js fast     record  0.00395 0.003955
node dev/sweep.js rigorous compact 0.0038 0.0039
node dev/sweep.js fast     bare    0.0038
```

`bare` is the zero potential, for which the reduced cost is the isolated block
functional; that run is the control reproducing the published Proposition F6.

At other block sizes the search is `tiling_blocks_search.py`, which takes the
number of gaps as its first argument; `m = 6` reproduces the mode above and is
how to check it.

```
venv/bin/python tiling_blocks_search.py 7 0.10 90 block7
```
Every number in `tiling_interval.results.json` comes from one of these lines,
and the suite checks the recorded outcomes stay consistent with the audited
floors.

### Status

Still numerical.  The coefficients are floating-point LP output and the floors
are floating-point global searches; a missed minimum inside the cube would
invalidate them.  What changed is that the remaining obligation is now a single
well-posed finite computation — an interval sweep of one explicit piecewise
linear inequality over one explicit finite cube — rather than a search for a
family that might work at all.


## The sweep runs: exhaustive subdivision reaches 0.003955

The "next proof obligation" written earlier in this file — interval-sweep one
explicit inequality over one explicit cube — turned out to be reachable, but
not by the route that section proposed, and it needed one idea that section
did not mention.

**What does not work.**  Two things were tried and failed, and both are worth
recording so they are not tried again.

- *Naive subdivision.*  The measured enclosure slack of the box bound is first
  order, about `0.045 * diameter`.  Certifying a floor `5e-5` under the true
  minimum therefore needs boxes of diameter `1e-3`, and the cube holds about
  `1e20` of those.  Hopeless, and no amount of hardware fixes it.
- *A fully separable certificate.*  Replacing the six-dimensional inequality by
  one-dimensional sup-convolution constraints is very appealing — verification
  collapses to 21 one-dimensional inequalities — but the relaxation is far too
  lossy.  Cut generation drove it below `0.0031`, under the published
  `19/5000`, and it was still descending.  Separability throws away the
  correlation the whole compatibility effect lives in.

**What works: the monotonicity reduction.**  If the enclosure of `dR/dg_k` over
a box misses zero, the minimum over that box lies on one face, so the box
collapses to a face and loses a dimension.  Applied repeatedly this is the
difference between `1e20` boxes and `1e7`.  With exact one-dimensional ranges
for `w` and `w'` — `w` is nonnegative with zeros exactly at the zeros of `K`,
and rises to a single interior maximum between consecutive zeros, so its range
over any interval is a table lookup — the sweep finishes:

| certificate | target | boxes | wall clock | outcome |
|---|---:|---:|---:|---|
| bare block `F6` | `0.0038` | 3 147 403 | 22 s | complete |
| compact | `0.0039` | 8 166 263 | 64 s | complete |
| compact | `0.00394` | 16 156 457 | 135 s | complete |
| compact | `0.003949` | 32 617 969 | 277 s | complete |
| record | `0.00395` | 32 931 519 | 283 s | complete |
| record | `0.003955` | 54 730 585 | 476 s | complete |
| sharp | **`0.003956`** | 54 518 075 | 458 s | **complete** |
| compact | `0.00396` | 8 779 523 | — | refused, counterexample `0.00395999969` |
| bare block `F6` | `0.0039` | 940 375 | — | refused, counterexample `0.003840817` |

The bare-block row is the control: with the zero potential the reduced cost is
the isolated block functional, so that sweep is an independent exhaustive
reproduction of the published Proposition F6 (`F6 >= 19/5000` for all
nonnegative gaps), by machinery that shares no code with the Arb certificate.
It also refuses `0.0039`, correctly, with a counterexample below the known
isolated-block minimum.  A verifier that never fails proves nothing; this one
fails exactly where it should.

**What this buys.**  `0.003956` telescopes to a chain floor for every gap
sequence, periodic or not, and projects a simple-zero constant of
`0.6731093501` against `0.6730085279` from the published local certificate —
`99.1%` of the entire improvement the alternating-chain candidate could ever
deliver, against a ceiling of `0.6731102697`.  It sits `9.8e-7` below `sharp`'s
own audited floor, so the certificate is again the binding constraint.

### Closing the floating-point gap

The table above is IEEE double precision leaning on `Math.sin`, which is not
correctly rounded and carries no proved error bound.  `tiling_rigorous.js`
removes both leans: Cody-Waite reduction against a four-term split of `pi/2`,
Taylor series to `r^19` and `r^18` whose truncation is below the first omitted
term, and outward rounding by `2.3e-16` relative, sound because IEEE 754
`+ - * /` are correctly rounded.  Against a 6174-row mpmath oracle at 60 digits,
biased towards the cases where argument reduction is delicate, containment holds
everywhere and the worst true error is `9.99e-16`.  The declared bound is
`8e-15` — eight times that, and five times the term-by-term derivation beside
the constant.  An earlier `2e-15` was carrying only twofold headroom, which a
uniform random sample against the engine's own `Math.sin` had not revealed.

Two things had to be got right for the sweep to survive the change.

- *Natural extension is not enough.*  Enclosing the weight over an interval by
  interval-evaluating its formula gives slack proportional to the interval
  width even where the weight is flat — about thirty times looser than the
  exact monotone-piece range.  That would demand boxes 700 times smaller, and
  `1e17` of them.
- *Centered forms are.*  `f([a,b]) subset f(m) + f'([a,b]) * [-rho, rho]` has
  slack proportional to the width times the *variation* of `f'`, which does
  vanish where `f` is flat.  Measured against the exact range: `1.35e-6` at
  width `1e-3`, against `7.3e-4` for the natural extension — 540 times tighter,
  and second order as advertised.  The second derivative only enters that
  second-order term, so a natural extension suffices for it.

The rigorous sweep then costs about `1.9x` the boxes and `9x` the wall clock of
the table version, which is affordable — and it finishes:

| certificate | target | boxes | wall clock | outcome |
|---|---:|---:|---:|---|
| compact | `0.0038` | 7 200 335 | 491 s | complete, equals the published floor |
| compact | `0.0039` | 14 817 467 | 1027 s | complete, strictly above `19/5000` |
| compact | `0.00392` | 18 260 117 | 1285 s | complete |
| compact | `0.00394` | 25 523 525 | 1792 s | complete |
| compact | `0.003949` | 42 531 993 | 2924 s | complete |
| sharp | `0.003952` | 40 938 447 | 2783 s | complete |
| sharp | `0.003954` | 47 516 991 | 3223 s | complete |
| sharp | **`0.003956`** | 67 608 431 | 4470 s | **complete — equals the double-precision floor** |

`0.003956` projects to `0.6731093501` against the published `0.6730085279`.
That is `99.1%` of the whole available improvement, against a ceiling of
`0.6731102697` — **and it is exactly the floor the double-precision sweep
reaches.**  The arithmetic gap that motivated `tiling_rigorous.js` has closed:
everything the fast sweep can see, the sweep with proved enclosures now sees
too, at about 1.24 times the boxes and 9.8 times the wall clock.

What limits the answer now is neither the arithmetic nor the subdivision.  It is
the certificate: `sharp` stops at `0.003956981` and `record` at `0.003957227`,
against a ceiling of `0.003957393`.  The last `4e-7` is cut-generation rounds.

The `0.003949` row is worth keeping for what it showed: it was within `1e-6` of
the `compact` certificate's own floor, so the subdivision had caught up with the
certificate and the certificate had become the binding constraint.  `sharp`
removed that constraint in the same cube, and the very next rigorous run cleared
`0.003952` in slightly *fewer* boxes than `0.003949` had needed on `compact` —
the margin it has to resolve is larger.

Two attempts to narrow the rigorous sweep's `~1.8x` box overhead are worth
recording as failures.  A second-order Taylor form for the value bought `0.1%`
where a sixth-power argument predicted a factor of eight; it is kept only
because every quantity it needs is already computed.  The same treatment for
the derivative, with a third-derivative remainder — implemented, validated
against finite differences, measured — bought `0.4%` for `1.7x` the wall clock
and was removed.  So the overhead is not a question of local expansion order,
and raising the order further is the wrong place to look.

What the rigorous sweep still assumes: that the engine implements IEEE 754 for
the four basic operations, and that this code has no bugs.  The second is what
the cross-validation is for — against 60-digit mpmath for the trigonometry, and
against the table version for every box analysis, where the rigorous bound must
come out weaker or one of the two is wrong.


## Unusual stone: seven is not the best block size

The whole programme inherits `n = 7` from the manuscript, and nobody varied it.
`projectedSimpleZeroBound` already takes `n` as a parameter, so the question
costs nothing to ask.

For each `n` the chain minimiser is again the alternating two-cycle — the pair
drifts slowly, `(1.979467, 1.041680)` at `n = 7` and `(1.040769, 1.977587)` at
`n = 8` — and pushing each chain minimum through the same projection gives:

| `n` | chain candidate | windows/block | projected constant | gain over the published headline |
|---:|---:|---:|---:|---:|
| 6 | `0.003389815865` | 295 | `0.673083193522` | `0.75e-4` |
| 7 | `0.003957393309` | 252 | `0.673110269740` | `1.02e-4` |
| **8** | `0.004524418568` | 221 | **`0.673129621611`** | **`1.21e-4`** |
| 9 | `0.005065102444` | 197 | `0.673123433005` | `1.15e-4` |
| 10 | `0.005607259037` | 178 | `0.673109394454` | `1.01e-4` |
| 11 | `0.006134360830` | 163 | `0.673076870025` | `0.68e-4` |

The trade-off is visible: a larger block raises the floor, which raises the
defect coefficient, but it also lengthens the span term that gets subtracted.
The peak is at `n = 8`, and `n = 7` sits on the rising side of it.  Moving one
step along costs nothing and adds `1.9e-5` — about a fifth again of the entire
chain-versus-block improvement this directory has been chasing.

Three caveats, all real.

- This is conditional on the published shifted-block assembly being valid for
  general `n`.  The code parameterises it; this laboratory cannot check the
  manuscript.  If the assembly is `n = 7` only, the row is meaningless.
- The `n = 8` floor is a numerical candidate with no certificate behind it.
  Everything this directory built — the additive normal form, the linear
  programme, the sweep — would have to be redone one dimension higher.
- The normal form itself does generalise cleanly.  For a block of `m` gaps the
  antisymmetric additive coboundaries are `u_i = u_{m-1-i}` with `sum u_i = 0`;
  writing `h = floor(m/2)`, an even block gives `h-1` free functions with the
  middle pair carrying minus their sum, an odd block gives `h` free functions
  with the centre slot carrying minus twice their sum.  At `m = 7`:

  `R = F7 + a(g0)+a(g6) + b(g1)+b(g5) + c(g2)+c(g4) - 2(a+b+c)(g3)`.

### And seven dimensions turns out to be feasible

`tiling_blocks.js` is the whole machinery written for a general block, and it
earns its keep by reproducing the specialised modules exactly: `signMatrix(6)`
is the hand-derived pair, the reduced cost agrees to `1e-15`, the amplitude
agrees to the last bit, and the general sweep reproduces the specialised sweep
*box for box* — 103 437 and 314 321.

Two seven-gap results follow.  The isolated block minimum, the `n = 8` analogue
of Proposition F6, is `0.004388737` at a palindrome,

`(1.04427, 1.97494, 1.03979, 1.97160, 1.03979, 1.97494, 1.04427)`,

against the `n = 8` chain candidate `0.004524419` — a compatibility gap of
`1.36e-4`, the same order as at `n = 7`.  And the probe that decides whether
any of this is actionable: **a seven-dimensional exhaustive sweep terminates.**
44 339 boxes at `0.003`, 1 485 735 at `0.004`, and a correct refusal with an
explicit counterexample at `0.0045`.  The monotonicity reduction still carries
the extra dimension.

One structural check came free.  At an odd block the features do *not* cancel
pointwise on the alternating blocks the way they do at `m = 6` — but the two
blocks' corrections are equal and opposite, so their average is still the chain
energy, and the ceiling argument survives in the form that actually matters.
The linear programme confirms it numerically: its cap at `m = 7` sits at exactly
`0.004524418568`, the `n = 8` chain candidate.

### But not by the easy route

Before anyone certifies the seven-gap block minimum and calls it a day: that is
not enough.  `0.004388737` at `n = 8` projects to `0.673042788`, a gain of only
`0.34e-4` over the published headline — *below* the `0.78e-4` the `n = 7` chain
certificate already delivers with proved enclosures, and well below the
`1.00e-4` it delivers in double precision.  The block minimum is worth less at
`n = 8` than the chain minimum is at `n = 7`.

The break-even floors, solved from the projection:

| to beat | `n = 8` floor required |
|---|---:|
| the `n = 7` rigorous sweep (`0.00392`) | `0.004456540625` |
| the `n = 7` double-precision sweep (`0.003955`) | `0.004491924776` |

against an `n = 8` chain ceiling of `0.004524418568`.  So the `n = 8` route pays
only with a coboundary certificate capturing roughly half to three quarters of
the compatibility gap — the easy version of the finding is worthless, and the
hard version has to be nearly as good as what already exists at `n = 7`.

How expensive is the sweep at that margin?  Measured, with the zero potential:

| margin below the block minimum | boxes | wall clock |
|---:|---:|---:|
| `3.887e-4` | 1 485 735 | 14 s |
| `1.887e-4` | 7 110 011 | 69 s |
| `8.874e-5` | 16 727 847 | 167 s |
| `3.874e-5` | 30 682 593 | 316 s |
| `8.737e-6` | 56 271 749 | 611 s |

so boxes grow like `margin^-1.3` in seven dimensions, against `margin^-0.5` in
six — but the constant is small.  The tightest margin measured, `8.7e-6`, is
already finer than a useful `n = 8` certificate would need, and it costs ten
minutes.  The seven-dimensional sweep is not the obstacle; getting a good
enough `m = 7` certificate is.

### A first `m = 7` certificate, and the three ways it fails

Ninety rounds of cut generation at `m = 7` produced a certificate that does not
work.  The ways it fails are the useful part.

- *Convergence is far slower.*  Ninety rounds reached `96.3%` of the chain
  ceiling inside the box the search looked at.  At `m = 6`, twenty-six rounds
  reached `99.98%`.
- *It is worse than no certificate.*  Its small-box floor `0.004355584` is
  below the trivial zero-certificate floor `0.004388737`, which is just the
  isolated block minimum.  The search has not yet bought anything.
- *It has no amplitude control.*  The `m = 6` pipeline has an
  amplitude-minimising refine stage; that was never generalised.  So the
  certificate's amplitude is `0.36`, its own tail lemma demands the cube
  `[0, 1094]^7`, and an audit over that cube returns `-0.053`.  The certificate
  is valid only on the box the search happened to look in, which is not a
  certificate at all.

Against a break-even of `0.004456540625`, this is not close.  The conclusion is
specific and worth stating plainly: **the `n = 8` route needs more search, not
more sweeping.**  The sweep side is solved — seven dimensions terminates at
margins finer than needed.  What is missing is an amplitude-minimising refine
stage generalised to `m` gaps, and substantially more cut generation.

So the `n = 8` programme is reachable rather than merely describable.  What it
needs is a certificate at `m = 7`, which is the same cut-generation loop with
three free functions instead of two, and then the seven-dimensional sweep at a
margin comparable to the one that already works at six.




## Unusual stone: the compatibility gap is an end effect

The number this whole directory is chasing is the compatibility gap — the chain
minimum minus the isolated-block minimum, `1.31e-4` at `n = 7`.  Measuring it
at every block size gives a surprise: it does not grow.

| `n` | isolated block minimum | chain candidate | gap |
|---:|---:|---:|---:|
| 5 | `0.002627169469` | `0.002767634662` | `1.405e-4` |
| 6 | `0.003238101026` | `0.003389815865` | `1.517e-4` |
| 7 | `0.003826231211` | `0.003957393309` | `1.312e-4` |
| 8 | `0.004388737387` | `0.004524418568` | `1.357e-4` |
| 9 | `0.004935586734` | `0.005065102444` | `1.295e-4` |
| 10 | `0.005454743634` | `0.005607259037` | `1.525e-4` |
| 11 | `0.006015956917` | `0.006134360830` | `1.184e-4` |

The block minima survived six independent differential-evolution runs at four
times the usual budget without moving, so they are converged upper bounds,
which makes each gap a *lower* bound on the true one.  Across `n = 5` to `11`
the gap stays inside `[1.18, 1.53]e-4` and oscillates with the parity of the
block instead of trending — odd gap counts sit high, even ones low.

That is exactly what an end effect looks like.  A finite block is cheaper than
the chain because it can relax its two free ends, and the saving from doing so
does not care how long the block is.  The bulk of the block is already paying
chain prices.

It also says something about the block-size question above.  Since the
chain-over-block improvement is worth the same `~1.3e-4` at every `n`, the
choice of block size is not a question about how much compatibility costs — it
is governed entirely by the projection's own trade-off between a floor that
grows with `n` and a span term that grows with `n` too.  Which is why the peak
sits at `n = 8` and is shallow on both sides.

## Concrete next proof program

The old program's steps are done: the certificate exists, the cube is finite
and explicit, the sweep is exhaustive, and it now runs on proved enclosures.
What is left, in order of how much it buys per unit of work:

1. **A better certificate, not a longer sweep.**  Both rungs are at `0.003956`
   and the certificate is what binds: `sharp` stops at `0.003956981`, `record`
   at `0.003957227`, ceiling `0.003957393`.  The last `4e-7` is worth `0.9%` of
   the gain and costs only cut-generation rounds —
   `tiling_additive_search.py maxmin` for longer, then `refine` at a target just
   under the new floor, which is the loop that produced `sharp`.
2. **An independent implementation.**  Everything above trusts that this code
   has no bugs.  The cross-checks are real — 60-digit mpmath for the
   trigonometry, the exact-range table for every box analysis, the degenerate
   box reproducing `additiveReducedCost` bit for bit — but they are checks by
   the same author.  Reimplementing in Arb or MPFI and rerunning would be worth
   more than any further tightening here, and the surface is small: the whole
   rigorous stack is `sinPoint`/`cosPoint` (Cody-Waite plus Taylor, the only
   place a hand-written error bound is asserted), `sinRange`/`cosRange` (exact
   ranges, extremum included whenever it cannot be excluded), `sincRange`,
   `sincDerivRange`, `sincSecondRange`, and `weightPairCentered`, which fuses
   the value and derivative enclosures.  Everything else — the subdivision, the
   monotonicity reduction, the piecewise-linear potential — is exact rational
   bookkeeping that needs no enclosure at all.
3. **A checker with no optimizer in its trusted base.**  The certificate's
   knots and coefficients should be rationalised, and the checker should read
   them as data.  The finite-chain boundary term is already explicit: it is
   bounded by the certificate amplitude, uniformly in the chain length.
4. **The assembly.**  Everything downstream of `projectedSimpleZeroBound` is
   conditional on a manuscript this directory cannot see.  That is the one
   remaining gap nobody here can close.

One design note worth keeping, because it inverts the old plan.  The old step 2
was to build *verified* breakpoint tables — enclosures of the zeros of `K` and
`K'` partitioning the line into monotone pieces — and it warned that a missed
breakpoint silently narrows a range, the one failure mode that invalidates
everything while every other approximation only widens.  The rigorous sweep
avoids that hazard entirely by not using a breakpoint table: natural interval
extension plus centered forms need no structural facts about where the kernel's
zeros and extrema are.  The price is the `~1.8x` box overhead.  That is a good
trade — the dangerous step was removed and paid for in compute — and it should
not be undone in pursuit of speed.

## Unusual stone: the cross-window dip is a normalisation effect

This one is off the tiling line entirely — it is about the other conjecture the
laboratory displays, that a mixed window lowers the second moment below both
parents.  The cross-window functional factors exactly.  With `G = sqrt(A B)`
the pointwise geometric mean, its numerator is `int A B + int int |u-v| G G`,
and `int A B` is exactly `int G^2`, so

`R12 = R(G) * kappa`,  `kappa = (int G)^2 / (int A int B) <= 1`

by Cauchy-Schwarz, equality only for proportional windows.  Numerically
`R(G) = 1.328915660253` and `kappa = 0.998425519145`, and the product matches
the directly quadratured `R12` to the last bit.

The attribution is the point.  `R(G)` sits *above* `min(R_A, R_B)`: the mixed
window's shape is worse than the better parent by `1.42e-3`, and the entire
reported dip — plus `2.09e-3` more — comes from `kappa < 1`, that is, from the
denominator being `int A int B` rather than `(int G)^2`.

**And the honest functional has no interior optimum at all.**  `R` of the linear
mixture is directly computable with no inferred formula, and it is monotone
decreasing on `[0, 1]` at every resolution tested, minimum at the pure
Montgomery-Taylor endpoint.  Expanding `R` at a mixture, the quotient rule at
`w = 1` collapses to

`R'(1) = 2 ( N_BB P_A - N_AB P_B ) / P_B^3`,

so `R'(1) = 0` exactly when the *bilinear* cross term `N_AB/(P_A P_B)` equals
`R(psi_MT)`.  It does, to thirty digits — and it fails for `cos(cs)` with
`c != sqrt(2)`.  ### Why sqrt(2), in two lines

The reason is not numerical.  `R` is stationary when its first variation
vanishes, and dividing that out gives the Euler-Lagrange equation

`psi(s) + int |s-v| psi(v) dv  =  R(psi) * int psi`   (a constant, on the interior).

Now `d^2/ds^2 int |s-v| f(v) dv = 2 f(s)`, so differentiating twice kills the
constant and leaves

`psi'' + 2 psi = 0`,

whose general solution is `A cos(sqrt(2) s) + B sin(sqrt(2) s)`.  The
*undifferentiated* equation then forces `B = 0` — the residual spread grows
exactly linearly in `|B|`, `0.8960 |B|` — so the critical point is unique up to
scale.  It is positive on its support (`cos(sqrt(2)/2) = 0.7602 > 0`), hence
interior to the positivity constraint, and every direction tried increases `R`
(indicator, `cos s`, `cos 3s`, `s^2`, `s^4`, a Gaussian, `cos 2 pi s`,
`sin 2 pi s`): a strict local minimum.

**The Montgomery-Taylor window is the unique critical point of the second-moment
functional, and the frequency is `sqrt(2)` because the second derivative of the
`|s-v|` kernel contributes a factor of two, and nothing else.**

### The two halves of the laboratory are the same object

Worth stating once, because it is easy to miss.  The tiling weight is
`w = (K/K(0))^2`, and `K` is the cosine transform of `cos(sqrt(2) t)` on
`[-1/2, 1/2]` — checked here to `9e-11`.  That is *exactly* the window the
Euler-Lagrange equation selects.  So the seven-point kernel every certificate
and every sweep in this directory is built on is the normalised power spectrum
of the unique critical point of the second-moment functional, and the constant
those certificates project against is two minus that functional's value there.
The tiling line and the window line are not two experiments; they are the same
`sqrt(2)` seen twice.

### And the headline constant falls out of it

Evaluate the Euler-Lagrange equation at `s = 0`.  With `psi = cos(a s)` and
`a^2 = 2`,

`1 + sin(a/2)/a + 2(cos(a/2) - 1)/a^2  =  R * 2 sin(a/2)/a`,

and the `a^2 = 2` collapses the left side to `cos(a/2) + sin(a/2)/a`, giving

`R(psi_MT) = (a/2) cot(a/2) + 1/2 = cot(1/sqrt2)/sqrt2 + 1/2 = 1.3274992963205883543...`

which matches quadrature to 31 digits.  And the Montgomery-Taylor constant the
whole zeta bound rests on is `H_MT = 3/2 - cot(1/sqrt2)/sqrt2`, so

**`H_MT + R(psi_MT) = 2`, exactly** — the cotangent cancels.

`H_MT = 0.67250070367941164573...` is therefore not an opaque decimal: it is two
minus the second-moment functional evaluated at its unique critical point, and
the `cot(1/sqrt2)/sqrt2` in it is exactly what evaluating the Euler-Lagrange
equation at the origin produces.  The integer complement is machine-checked as
`montgomery_taylor_complement`.

One honest caveat, to forestall the obvious misreading.  The Euler-Lagrange
equation fixes the *shape* at a given support; it says nothing about the support
itself, and `R` decreases monotonically as the support widens
(`2.166`, `1.514`, `1.327`, `1.223`, `1.146`, `1.112` at widths `0.5` through
`2`).  The width is normalised to `1` by the application, not chosen by
optimising `R`.  Nothing here says a wider window would do better in the place
that matters.

Checked: the residual — the spread of that expression over `s` — is exactly
zero at `sqrt(2)` to 22 digits and settles at `R(psi) * int psi =
1.219607282008414370146`, while for `cos(s)` and `cos(2s)` it spreads by
`0.079` and `0.152`.  Correspondingly `dR/dc` vanishes at `c = sqrt(2)` to 26
digits, a root-find on `dR/dc` returns `sqrt(2)`, and `psi_MT` is stationary in
every direction tried (indicator, `cos s`, `cos 2s`, `s^2`, a Gaussian:
`dR/dt = 0` to `1e-32`).  A critical point admits no first-order improvement,
so no mixture with it can lower the second moment.

Note the two cross formulas differ in the double integral as well as the
denominator: the inferred one puts the geometric mean at both arguments, the
expansion of `R` gives the bilinear product.

**The reported optimum is exactly that substitution.**  Expanding `R` at a
mixture needs a cross term.  Feed it the inferred `R12` and the expansion has an
interior minimum at `w ~ 0.09` (weight on the indicator) with value
`1.327436`, below both parents — which is the claim on display.  Feed it the
bilinear cross term instead and the minimum moves to the endpoint, at
`R(psi_MT)` to `1e-9`.  Nothing else changes.  The interior optimum is not a
property of the windows; it is the difference between the two cross terms.

## Unusual stone: the weight is positive definite, and why that does not help

`w = (K/K(0))^2` and `K` is the cosine transform of `cos(sqrt(2) t)` on
`[-1/2, 1/2]`, so the transform of `w` is the autoconvolution `(f*f)/K(0)^2`.
It is supported on `[-1, 1]` and equals, for `0 <= t <= 1`,

`( sin(sqrt2 (1-t))/sqrt2 + (1-t) cos(sqrt2 t) ) / (2 K(0)^2)`,

which is **nonnegative**, with a two-line proof: `sqrt2 (1-t)` lies in
`[0, sqrt2] subset [0, pi]` and `sqrt2 t` lies in `[0, sqrt2] subset [0, pi/2]`,
so both terms are nonnegative.  `w` is therefore a positive definite function
with compactly supported transform — exactly the Cohn-Elkies setting, and worth
knowing is available.

It does not close for the functional here, and the reason is worth recording so
it is not attempted a third time.  The chain energy truncates at lag six **by
index, not by distance**.  Poisson summation turns a two-body *spatial* energy
into a nonnegative Fourier sum; an index-truncated sum is not a two-body
spatial energy, so the argument has nothing to act on.  Two attempts:

- Bounding the full-lag energy below by `rho * what(0) - 1` and subtracting a
  tail founders on the size of the tail.  Measured at the alternating cycle: the
  pair part truncated at lag six is `9.3625e-4`, out to lag 400 it is
  `3.5802e-3`, so the tail beyond lag six is at least `2.6439e-3` — twenty times
  the `1.3116e-4` compatibility gap the whole exercise is trying to resolve.
  A bound on it would have to be accurate to about `5%` relative, which a
  linear-programming bound on a slowly converging `1/s^2` tail does not give.
  (An earlier estimate here said the full pair sum was `0.0171` and the tail had
  to be known to `0.5%`; both were wrong, from a `0.12/x^2` envelope that badly
  overestimates. The numbers above are measured.)
- Restricting the auxiliary function to `[-r, r]` so index truncation and
  distance truncation coincide needs every seven consecutive gaps to span more
  than `r`, which no configuration guarantees; tiny gaps break it, and the
  case split that would handle them is the original problem again.

The compactly supported nonnegative transform is still the cleanest structural
fact about this kernel, and `overlapWeightTransform` ships it in closed form.

## A local theorem, proved rather than measured

Everything else here bounds the energy by subdividing a six-dimensional cube.
This is different and much cheaper, and it is the first statement in this
directory that is established rather than observed.

**The Hessian escapes the truncation.**  The lag-six truncation is by index, not
distance, which is what defeats every Fourier argument for the energy itself.
It does not defeat the *Hessian*: at a two-periodic state

`Hhat_{ab} = 2 sum_{s=|a-b|+1}^{6} sum_{i=max(a,b)-s+1}^{min(a,b)} w''(D_{i,s})`

is a finite sum that vanishes identically for `|a-b| >= 6`.  A two-site Bloch
decomposition turns it into a `2x2` Hermitian symbol `M(q)`, so certifying
positive definiteness is a **one-variable** interval problem.  The exact symbol
agrees with the laboratory's existing finite-difference spectrum to `1e-7`,
sharing no code with it.

**What is certified.**  Two things, both cheap:

- *Existence and uniqueness.*  A Krawczyk test on `dE/dL = dE/dH = 0` proves a
  unique two-periodic critical point in a box of halfwidth `1e-6` about the
  quoted values.  Iterating the test tightens it to

  `L in [1.0416801034484717, 1.0416801034485021]`  (width `3.0e-14`),
  `H in [1.9794672314032040, 1.9794672314032447]`  (width `4.1e-14`).

  The width floor is the gradient enclosure itself: `w'` is only known to a few
  times `1e-14`, and no correct operator can beat that.

- *A spectral gap.*  For every momentum `q in [0, pi]` and every two-periodic
  state in a box of halfwidth `1e-4` about that point, the smaller Bloch
  eigenvalue is at least `1.6`.  About 1700 momentum intervals, well under a
  second.  The certification is tested to fail at `1.7`, which the spectrum does
  not reach, so it is not vacuous.

Together: **the alternating two-cycle is a strict local minimum of the chain
energy, with a certified spectral gap of `1.6`.**

The enclosure above is `3.0e-14` wide in `L` and `4.1e-14` in `H` — not "the
last bit of a double", which was an artifact of a Krawczyk operator that
collapsed the gradient enclosure to its midpoint and so reported an enclosure
narrower than the gradient uncertainty that produced it.  That operator was
unsound; it is repaired, and the width above is what a correct one gives.

### The same theorem again, in Arb

Everything above rests on `tiling_rigorous.js`: hand-written sine and cosine
with error constants I chose, first and second derivatives of the weight that I
differentiated by hand and typed in, and a hand-written outward-rounding
convention.  Each of those three has produced at least one unsoundness in this
directory.  A theorem with a base that thin is not worth quoting however green
the suite is, so `dev/coercivity_arb.py` proves it again with none of it:

- arithmetic is **Arb** (`python-flint`), midpoint-radius balls with proved
  enclosures, at 200 bits — not doubles with a hand-picked epsilon;
- sine is Arb's, with Arb's bound — not a Cody-Waite reduction and a constant
  called `TRIG_ERROR`;
- `w'` and `w''` come from **Taylor-series arithmetic on the definition of `w`**
  — nothing is differentiated by hand.

Only the mathematics is shared: the definition of the weight, the chain energy,
and the shape of the Krawczyk and Bloch arguments.  The two agree, so the local
theorem does not depend on my arithmetic.  Arb also resolves the critical point
about `10^45` times more finely than doubles allow:

`L = 1.04168010344848698644197575211`   (radius `1.7e-59`),
`H = 1.97946723140322440794242316550`   (radius `2.2e-59`),
`E = 0.00395739330910934384458830825064` (radius `2.5e-60`).

That is the strong direction of the check.  The true `L` sits `1.5e-14` into the
`3.0e-14`-wide interval the JavaScript reports, and the true `H` `2.0e-14` into
its `4.1e-14` — so the double-precision intervals are correct, and very nearly
centred, rather than merely self-consistent.

Two facts the Arb run adds outright:

- **The gap is at least `1.6612`,** not merely `1.6`, in 3731 momentum
  intervals.  Numerically the minimum is `1.66128101824`; bisection gets within
  `1e-5` of it before the first-order slack in the interval evaluation starts
  costing exponentially many subdivisions, which is the resolution limit rather
  than a failure.
- **The minimising momentum is certified,** by an argument the gap certificate
  cannot make.  A lower-bound sweep says nothing about *where* the minimum sits,
  which is why `q/pi = 0.929` was withdrawn as a certified claim.  But one point
  evaluation bounds the minimum from *above* by `1.661281018241`, and the
  eigenvalue is then certified to exceed that bound everywhere outside a window;
  whatever is left inside the window must contain the minimiser.  In 16954
  intervals this certifies

  `q/pi in [0.925, 0.933]`,

  with the numerical minimiser at `q/pi = 0.9290451141`.  So `0.929` is now a
  certified two-decimal statement rather than a scan reading.  Nothing else here
  depends on it.

`dev/coercivity_arb.results.json` records the run, hashed to the source that
produced it.  The suite reruns the whole certification when `python-flint` is
importable and otherwise checks only that the transcript is not stale — and says
which of the two it did, because a matching hash is not a rerun.

**What this does not establish, and the gap is the whole problem.**  It is local.
It says nothing about configurations far from the alternating state, nothing
about the energy of a wall between the two alternating phases, and nothing about
the global floor -- which is what the sweeps are for and what an eventual
crystallization argument would have to supply.  A coercivity statement of the
form `E(g) - E(g_alt) >= c dist(g, A)^2 + tau (walls)` needs this constant *and*
a wall tension *and* control of everything in between; only the first is here.
Converting even the local statement into a quadratic growth bound with a
certified *radius* would need Hessian control off the two-periodic slice, which
this file does not attempt.

**A correction it produced, and this time enclosed rather than computed.**  The
`(1.041680, 1.979467)` quoted throughout this directory is a six-decimal
rounding.  The chain energy at the certified critical point, *rigorously
enclosed*, is

`E in [0.003957393309106188, 0.003957393309112507]`   (width `6.3e-15`),

and in Arb, `E = 0.00395739330910934384458830825064` to a radius of `2.5e-60`.
The ceiling constant this directory quotes everywhere, `0.003957393309209766`,
lies **outside** that interval — high by `1.004e-13`, which is exactly the cost
of evaluating at the six-decimal rounding.  Immaterial to every projection
here, and now a certified statement rather than a number read off the ordinary
floating-point kernel, which carries no bound and should never have been called
a true minimum.

## The wall, certified

Local coercivity supplies the `c dist^2` half of a crystallization argument.  The
other half is the wall: a configuration that is not globally in one of the two
alternating phases must contain an interface, and a Peierls bound needs each
interface to cost a definite amount.  This directory has carried those numbers
for a while — about `0.00109278645` for a low-low wall and `0.00014708549` for a
high-high one — as the output of an Adam relaxation, which proves nothing.

`dev/kink_arb.py` certifies them, on the same Arb base and by the same method
that worked for the two-cycle.  An odd ring is frustrated: it cannot be
alternating anywhere, so it carries exactly one wall, and the phase of the seed
decides whether the core is a low-low or a high-high adjacency.

**What is proved,** on a ring of 63 gaps:

- *Existence and uniqueness.*  A Krawczyk test in **63 dimensions** on the full
  gradient system proves a unique critical point in a box of halfwidth `1e-6`
  about the relaxed profile.  Iterating tightens every gap to a radius near
  `3e-89`.
- *Strict local minimality.*  The interval Hessian over that box is positive
  definite, by a **verified Cholesky in ball arithmetic** — written out rather
  than delegated to `eig`, whose rigour contract would then have to be taken on
  faith.  Every pivot is certifiably positive, and

  `lambda_min >= 1.6613857650`  (low-low),
  `lambda_min >= 1.2272529833`  (high-high).

  Worth noticing: the low-low wall sits *above* the bulk Bloch gap `1.66128`,
  and the high-high wall *below* it.  The high-high core carries a genuinely
  softer mode; the low-low core does not soften the spectrum at all.
- *The tensions, enclosed and positive.*

  `tau_LL = 0.001092786457724342735  +/- 2.0e-25`,
  `tau_HH = 0.000147085497481443264  +/- 1.1e-26`,

  and their sum `0.001239871955205786000` reproduces the independently relaxed
  two-interface ring excess.

**And a clean structural fact the relaxation could not see.**  On an odd ring a
wall interacts only with itself, around the ring.  That self-interaction dies
extremely fast: the profile deviation from the crystal is `8.9e-3` at the core
and `7e-30` eighty gaps away, a decay of about `e^-0.78` per gap, so the wall is
localised within a couple of gaps.  The tension is correspondingly frozen —

`tau_63 - tau_47 = 1.14e-19`,   `tau_95 - tau_63 < 1e-25`,

with the second difference reading below `1e-28` at 400 bits.  So the ring value
*is* the infinite-chain value to twenty-odd digits:

`tau_LL^inf = 0.0010927864577243426...`,   `tau_HH^inf = 0.00014708549748144325...`

**What this does not prove, and it is the same shape of gap as before.**  These
are the tensions of *this* wall — the one the relaxation finds, now certified to
be a genuine, unique, strict local minimum of the ring energy.  As an **upper**
bound on the true wall tension that is unconditional.  As a **lower** bound it is
conditional on the wall core being this one: certifying the infimum over all
configurations of an odd ring is a global optimisation in 63 dimensions, and is
not attempted here.  A Peierls bound needs exactly that lower bound.  So the
missing constant of the crystallization program is now pinned to twenty digits
and proved positive *for the wall that occurs*, which is strictly more than
"numerical evidence", and strictly less than the theorem.

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
The wall tension is no longer numerical evidence only -- it is certified for the
wall that occurs, and still uncertified as an infimum; see "The wall, certified".
The spectral gap is not numerical either:
it is certified at `1.6` over a box around the critical point, by the Bloch
reduction in `tiling_coercivity.js` — see the local-theorem section above.  This
paragraph predates that and said both were numerical.  A proof
would need interval Hessian bounds inside the phase neighborhoods and a finite
transition certificate outside them.
