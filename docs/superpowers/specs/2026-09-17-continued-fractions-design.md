# Continued Fractions — design

Date: 2026-09-17
Directory: `continued-fractions/`

An interactive page about continued fractions: the simple `1/N` kind for famous
constants, generalized continued fractions where the visitor picks the numerator
and denominator sequences, and the square-dissection picture that makes the
Euclidean algorithm visible.

## Shape

One self-contained `index.html` (no network, no build), plus `test.mjs` running
the pure maths in Node, per repo convention. Three tabs across the top:
**Simple**, **Generalized**, **Geometry**. Visual style follows `packing/`:
light background, system font, 14px, thin borders, no framework.

Pure logic lives in `<script id="shared-code">` exposing a `CF` namespace and an
`XTests` runner (the name `test.mjs` already looks for in this repo); `test.mjs`
extracts the block by regex and runs it.

## 1. Math engine (`CF`, shared-code)

All arithmetic exact on `BigInt`. No floating point anywhere a result is shown
as a term, a convergent, or an error bound. Doubles are used only for drawing
coordinates and for the pre-scan in the best-approximation race (see §2.3).

### 1.1 Rationals

`Rat` = `{n: BigInt, d: BigInt}`, `d > 0`, reduced by `gcd` on construction.
Operations: `add`, `sub`, `mul`, `div`, `neg`, `cmp`, `floor`, `fromInt`,
`fromDecimalString`, `toDecimalString(digits)` (long division, correctly
truncated toward zero, with the sign carried separately).

### 1.2 Constants as enclosures

Each constant is a decimal string of ~60 significant digits, stored as an
interval `[lo, hi]` where `hi = lo + 10^-60`. The value is guaranteed to lie in
the interval; nothing else is claimed about it.

Constants shipped: π, e, √2, √3, √5, φ, ln 2, γ, ∛2, and the rational 355/113.
The digit strings are transcribed into the source and pinned by a test that
checks each enclosure against an independently computed value (√2, √3, √5, φ,
∛2 by Newton iteration in exact rationals; ln 2 and e by series; π by the
Chudnovsky-free Machin formula `16·arctan(1/5) − 4·arctan(1/239)` in rationals;
γ has no cheap series, so its transcribed digits are cross-checked against the
independently published list of its simple-CF terms, OEIS A002852 —
a different source, not a round-trip of the same digits).

### 1.3 Term extraction with an honest cutoff

`CF.termsFromInterval(lo, hi, maxTerms)` runs the Gauss map on both endpoints in
lockstep:

```
loop:
  a_lo = floor(lo); a_hi = floor(hi)
  if a_lo !== a_hi: stop, reason = "precision exhausted"
  emit a_lo
  lo, hi = 1/(hi - a_hi), 1/(lo - a_lo)      # note the swap: the map is decreasing
  if either fractional part is 0: stop, reason = "exact" (rational input)
```

Returns `{terms, stopReason}`. `stopReason` is one of `exact`,
`precision-exhausted`, `max-terms`. The UI always shows which one applied, so a
term is never displayed unless it is certain. With 60 digits this gives roughly
40+ certain terms for π and unbounded terms for the quadratic irrationals
(√2, √3, √5, φ), which are also generated periodically so they can run past the
enclosure limit.

Quadratic irrationals additionally get an exact periodic generator
(`CF.sqrtTerms(n)`, the standard `(P,Q)` integer algorithm), used in preference
to the enclosure so √2 can show 200 terms with `stopReason = "periodic"`.

### 1.4 Convergents

`CF.convergents(terms)` — `h_k = a_k·h_{k-1} + h_{k-2}`, `k_k = a_k·k_{k-1} + k_{k-2}`
with `h_{-1}=1, h_{-2}=0, k_{-1}=0, k_{-2}=1`. Exact BigInts.

### 1.5 Generalized continued fractions

`b₀ + a₁/(b₁ + a₂/(b₂ + …))` with

```
A_n = b_n·A_{n-1} + a_n·A_{n-2},   A_{-1} = 1, A_0 = b_0
B_n = b_n·B_{n-1} + a_n·B_{n-2},   B_{-1} = 0, B_0 = 1
```

`a_n` and `b_n` are `Rat`s, so the whole recurrence stays exact. When a sequence
is irrational (π, e, √2) its enclosure truncated to 30 decimals is used and the
result is labelled as computed from that approximation — exact for it, not for
the constant. Levels are capped at 150 when both sequences are integer-valued
and at 60 when either is irrational, which keeps the exact recurrence fast
enough to redraw on a slider drag.

## 2. Simple tab

### 2.1 Picker and tower

Constant chips: π, e, √2, √3, √5, φ, ln 2, γ, ∛2, 355/113. Selecting one
recomputes everything.

A nested fraction tower rendered in plain CSS (nested divs, a border-top acting
as the fraction bar) shows `a₀ + 1/(a₁ + 1/(a₂ + …))` down to a depth set by the
step control, with an ellipsis at the bottom for non-terminating expansions.

### 2.2 Terms and convergents

The term list `[a₀; a₁, a₂, …]` with a step slider (1..N) that drives both the
tower depth and how many rows of the table are shown.

Convergent table columns: `n`, `aₙ`, `pₙ/qₙ` (exact, elided in the middle with
the full value in the `title` attribute once it exceeds 18 digits), decimal to
20 places, signed error `x − pₙ/qₙ` in scientific notation, and `|error|·qₙ²`.
The last column stays below 1 throughout, which is the point: it is the
`|x − p/q| < 1/q²` theorem shown rather than asserted. For π, row 3 is
`355/113` with error ≈ −2.7e−7.

Errors are computed against the enclosure `lo`, and rendered only to a digit
count the enclosure supports.

A status line under the table states the stop reason and the number of certain
terms.

### 2.3 Best-approximation race

Click a convergent row to set `Q = qₙ`. The page then searches every denominator
`q ≤ Q` for the fraction closest to x, and reports the five closest, with the
selected convergent highlighted in the list.

Two-stage for speed: scan with doubles (`p = Math.round(x*q)`), keep the best 50
candidates, then re-rank those exactly in `Rat`. This is safe because the errors
being compared are of order `1/q²` (≈ 2.5e−11 at `q = 2·10^5`), five orders of
magnitude above double rounding noise; the exact re-rank settles ties regardless.

The race is only offered for rows with `qₙ ≤ 200000`. Larger rows show a
disabled button and the note "denominator too large to search exhaustively" —
the page does not pretend to have checked what it has not.

## 3. Generalized tab

### 3.1 Builder

Tower display of `b₀ + a₁/(b₁ + a₂/(b₂ + …))` with live values.

Two dropdowns choose the sequences, each offering: `1`, `n`, `2n−1`, `2n+1`,
`n²`, `(2n−1)²`, `nth prime`, `(nth prime)²`, `π`, `e`, `√2`, `k` (a constant set
by a number input). A separate `b₀` input, and a "negate aₙ" checkbox so the
Gauss/Lambert forms with `−z²` numerators are reachable.

This makes both of the owner's stated ideas single menu picks: `aₙ = nth prime`
with `bₙ = 2n+1`, and `aₙ = π` with `bₙ = n`.

Primes come from a sieve sized to the term cap.

### 3.2 Presets

Buttons loading known expansions, each verified by a test against its known
value:

- Brouncker: `4/π = 1 + 1²/(2 + 3²/(2 + 5²/(2 + …)))`
- `π = 3 + 1²/(6 + 3²/(6 + 5²/(6 + …)))`
- the `e` ladder (the exact form is fixed during implementation by numerically
  checking the candidate against `e`; the spec does not guess it)
- `√2 = 1 + 1/(2 + 1/(2 + …))`

### 3.3 Convergence and identification

A convergence plot: `log₁₀|xₙ − xₙ₋₁|` against `n`, drawn on canvas in device
pixels. Successive differences are used rather than the error to a limit,
because arbitrary menu combinations have no limit known to the page. Brouncker's
slow linear descent next to the `π = 3 + 1²/(6 + …)` form's faster one is the
lesson.

An identification panel takes the last convergent's decimal and matches it
against a table of named values (π, e, √2, √3, √5, φ, ln 2, γ, π/2, π/4, 4/π,
2/π, π², π²/6, e−1, 1/e, e², ln 10, Catalan, ζ(3), 1+√2, ∛2) to 12 digits. No
match prints "no match in the table" — it does not invent a closed form.

## 4. Geometry tab

Canvas sized in device pixels (`devicePixelRatio`), per the repo's HiDPI
pattern; never a CSS-stretched logical buffer.

A rectangle of aspect ratio x. The largest square is fitted repeatedly: `a₀`
squares along the long side, then `a₁` squares in the remaining strip, then
`a₂`, and so on. Each generation gets its own colour and a label `a₀ = 7` etc.,
so the picture and the Simple tab's term list are visibly the same object.

Controls: the same constant chips, a depth slider, and "zoom to remainder",
which rescales the drawing so the current remainder rectangle fills the canvas —
the self-similar spiral that never terminates for an irrational. `355/113`
terminates on an exact square, and the page says so.

Geometry uses the terms from §1.3; only the drawing coordinates are doubles.

## 5. Tests (`test.mjs`)

- `Rat`: reduction, sign handling, `toDecimalString` truncation, comparison.
- Enclosure pinning: each shipped constant's digits agree with an independently
  computed value to the claimed precision (§1.2).
- Terms: `√2 → [1;2,2,2,…]`, `φ → [1;1,1,…]`, `√3 → [1;1,2,1,2,…]`,
  `e → [2;1,2,1,1,4,1,1,6,…]`, `355/113 → [3;7,16]` with `stopReason = "exact"`,
  π's first 20 terms against the known list `[3;7,15,1,292,1,1,1,2,1,3,1,14,2,1,1,2,2,2,2]`.
- Honest cutoff: a value supplied as a 5-digit enclosure yields only the terms
  that 5 digits determine, with `stopReason = "precision-exhausted"`.
- Convergents: π gives `3, 22/7, 333/106, 355/113`; `|x − p/q|·q² < 1` for every
  convergent of every shipped constant.
- Best approximation: for each of π's first six convergents with `q ≤ 200000`,
  a brute-force search confirms no fraction with smaller or equal denominator is
  closer.
- Generalized: the recurrence reproduces the simple CF when all `aₙ = 1`;
  Brouncker's partial values match known figures and converge toward `4/π`;
  each shipped preset converges to its claimed constant to 8 digits.
- Geometry: the square counts produced by the dissection equal the CF terms, and
  the remainder ratio after each generation equals the corresponding complete
  quotient.

## Non-goals

- No custom value entry in the Simple tab; the constant list is fixed.
- No term bar chart or Gauss–Kuzmin histogram.
- No lattice/Klein-sail picture, and no linear-fractional-transformation view.
  (Note for the record: the Wikipedia anchor `#A_geometric_interpretation` is
  about LFTs focusing the complex plane; the square-dissection picture shipped
  here is the one in the *Simple continued fraction* article.)
- No arbitrary-expression parser for the sequences; menus only.
