# Overlapping-block dual research: result and next move

## Scope

This directory contains a numerical discovery program, not a new theorem about
zeta zeros.  The exact mathematical ingredient is the cyclic reindexing of the
shifted seven-point functional.

Where things stand, most established first:

- **Exact and machine-checked.**  The cyclic block identity; the reversal
  cohomology lemma; the telescoping lemma that turns a per-edge coboundary
  floor into a chain floor with an `O(1)` boundary term; the charge identity
  for two-phase words; and the arithmetic of the projection, including a
  two-sided pin of the constant the swept floor projects to.  Fifteen Lean
  theorems, standard axioms only.
- **Exhaustively subdivided in double precision.**  The chain floor `0.003955`,
  for every gap sequence, periodic or not.  Also, as a control, the published
  Proposition F6 (`F6 >= 19/5000`), reproduced by machinery sharing no code
  with the external Arb certificate.
- **Exhaustively subdivided with proved enclosures.**  The chain floor
  `0.00394`, strictly above the published local floor `19/5000`.  This is the
  strongest rung the improvement itself has reached: 25 523 525 boxes, proved
  trigonometric error bounds, outward-rounded arithmetic throughout.  It
  projects to `0.6730989992` against `0.6730085279`, `88.9%` of the whole
  available gain, and Lean pins that constant two-sidedly and strictly between
  the published pin and the double-precision one.
- **Numerical only.**  The certificate coefficients; every floor above the
  swept ones; the two-phase kink energies and Bloch spectrum; and the entire
  block-size scan, which says the projection peaks at `n = 8`, not the `n = 7`
  the programme inherited.
- **Not checkable here at all.**  The external shifted-block assembly the
  projection encodes.  Everything downstream of it is conditional on it.

What is still required before the improved simple-zero projection can be used:
the assembly has to be checked by someone with the manuscript.  The rigorous
sweep cleared `19/5000` on its own.

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

### The certificate closes the aperiodic gap, which the period sweep never did

A per-edge floor telescopes over *any* gap sequence.  For a window of `m` gaps,
`sum_i R(window_i) = sum_i F6(window_i) + Phi(end) - Phi(start)`, so the block
average is at least `kappa*(m-5)/m - 2*amplitude/m` for every configuration,
periodic or not, and the liminf is at least `kappa`.  Together with the
alternating cycle as an upper bound this pins the chain infimum inside

`[0.003957227285, 0.003957393309]`,   width `1.66e-7`,

over all configurations.  The period-9-through-64 sweep could always have
missed a continuous or aperiodic minimizer; the certificate cannot.  That
caveat, carried on the page since the probe started, is now retired — at
floating-point confidence, like everything else here.

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
| record | **`0.003955`** | 54 730 585 | 476 s | **complete** |
| compact | `0.00396` | 8 779 523 | — | refused, counterexample `0.00395999969` |
| bare block `F6` | `0.0039` | 940 375 | — | refused, counterexample `0.003840817` |

The bare-block row is the control: with the zero potential the reduced cost is
the isolated block functional, so that sweep is an independent exhaustive
reproduction of the published Proposition F6 (`F6 >= 19/5000` for all
nonnegative gaps), by machinery that shares no code with the Arb certificate.
It also refuses `0.0039`, correctly, with a counterexample below the known
isolated-block minimum.  A verifier that never fails proves nothing; this one
fails exactly where it should.

**What this buys.**  `0.003955` telescopes to a chain floor for every gap
sequence, periodic or not, and projects a simple-zero constant of
`0.6731086901` against `0.6730085279` from the published local certificate —
`98.4%` of the entire improvement the alternating-chain candidate could ever
deliver.  The sweep now sits within `2.3e-6` of the certificate's own audited
floor, so the subdivision, not the certificate, is what is left on the table.

### Closing the floating-point gap

The table above is IEEE double precision leaning on `Math.sin`, which is not
correctly rounded and carries no proved error bound.  `tiling_rigorous.js`
removes both leans: Cody-Waite reduction against a four-term split of `pi/2`,
Taylor series to `r^19` and `r^18` whose truncation is below the first omitted
term, and outward rounding by `2.3e-16` relative, sound because IEEE 754
`+ - * /` are correctly rounded.  The resulting sine lands within `1.25e-16` of
60-digit mpmath values, well inside its declared `2e-15` bound.

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
| compact | **`0.00394`** | 25 523 525 | 1792 s | **complete** |

`0.00394` projects to `0.6730989992` against the published `0.6730085279`.
That is `88.9%` of the whole available improvement, established with proved
enclosures rather than with `Math.sin`.  The remaining tenth is the
double-precision sweep's lead, and closing it is compute, not research.

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

1. **Compute.**  The rigorous sweep is at `0.00392` and the double-precision
   one at `0.003955`; that lead is mostly just hours.  `0.00394` took 25.5
   million rigorous boxes and half an hour; `0.003949` should be roughly 60
   million.  Nothing about the method changes — `node dev/sweep.js rigorous
   compact 0.003949` and wait.
2. **An independent implementation.**  Everything above trusts that this code
   has no bugs.  The cross-checks are real — 60-digit mpmath for the
   trigonometry, the exact-range table for every box analysis, the degenerate
   box reproducing `additiveReducedCost` bit for bit — but they are checks by
   the same author.  Reimplementing the four range primitives in Arb or MPFI
   and rerunning would be worth more than any further tightening here.
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
