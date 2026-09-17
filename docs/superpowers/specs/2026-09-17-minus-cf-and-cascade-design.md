# Minus continued fractions and the bracket cascade — design

Date: 2026-09-17
Directory: `continued-fractions/` (extends the existing page)
Extends: `docs/superpowers/specs/2026-09-17-continued-fractions-design.md`

Two additions to the Simple tab, driven by one observation: a regular continued
fraction's convergents alternate above and below the target, and a *minus*
continued fraction's do not. Putting both behind one toggle makes the contrast a
single click, and a telescoping bracket picture makes it visible rather than
something read off a column of signs.

## 1. Mode toggle

Two buttons above the constant chips:

- **regular** — `a₀ + 1/(a₁ + 1/(a₂ + …))`
- **minus** — `b₀ − 1/(b₁ − 1/(b₂ − …))`

`state.simple.mode` is `'plus'` or `'minus'`, defaulting to `'plus'`. The tower,
term list, convergent table, approximation race and the cascade all follow it.
The constant chips and the depth slider are shared.

π flips from `[3; 7, 15, 1, 292, …]` to `⟦4; 2, 2, 2, 2, 2, 2, 17, 294⟧`. The
double-bracket notation marks a minus expansion; the page states this next to the
term list rather than assuming the reader knows it.

## 2. Minus continued fraction maths

The map is `b = ⌈x⌉`, then `x ↦ 1/(b − x)`.

Two properties differ from the regular case and both matter:

- `x ↦ 1/(b − x)` is **increasing** in `x`, where the regular Gauss map
  `x ↦ 1/(x − a)` is decreasing. The interval endpoints therefore do **not** swap
  when pushed through it. Getting this backwards silently produces wrong terms.
- The recurrence is `pₙ = bₙ·pₙ₋₁ − pₙ₋₂`, `qₙ = bₙ·qₙ₋₁ − qₙ₋₂`, seeded
  `p₋₂ = 0, p₋₁ = 1, q₋₂ = −1, q₋₁ = 0`. The `q` seed is the one that differs from
  the regular case (`q₋₂ = 1`); using the regular seed yields negative
  denominators throughout. A test pins the exact convergents.

New functions, mirroring the existing regular ones:

- `CF.minusTermsExact(r: Rat, maxTerms) -> {terms: BigInt[], stopReason}` —
  `stopReason` `'exact'` when `b − x` reaches zero, else `'max-terms'`.
- `CF.minusTermsFromInterval(lo, hi, maxTerms) -> {terms, stopReason}` — emits a
  term only while `⌈lo⌉ = ⌈hi⌉`, else stops with `'precision-exhausted'`.
- `CF.minusConvergents(terms) -> {p, q}[]`
- `CF.minusExpand(key, maxTerms) -> {terms, stopReason, source}` — `'exact'` for
  rationals, `'interval'` otherwise.

Minus mode uses the interval path for **every** irrational, including √2 and φ.
Minus expansions of quadratic irrationals are eventually periodic too, but a
second periodic generator earns little; those constants report however many terms
the 60-digit enclosure determines, with the same honest cutoff as everything else.

`CF.convergentRowsFor(key, maxTerms, mode)` generalises the existing
`convergentRows`, which keeps its signature and delegates with `mode = 'plus'`.

## 3. The race becomes mode-aware

Minus convergents are **one-sided** best approximations. Verified during design
against π: every minus convergent with `q ≤ 200000` is the closest fraction
*greater than* π with a denominator that small, while `4/1`, `7/2` and `10/3` all
lose an unrestricted race to `3/1`.

So in minus mode the race searches only fractions above the target:

- `CF.bestApproximationsAbove(key, Q, count)` — same two-stage shape as the
  existing `bestApproximations` (double pre-scan, exact re-rank), but a candidate
  is `p = ⌈x·q⌉` and only `p/q > x` is considered.

The panel's wording changes with the mode: "the closest fraction of them all" in
regular mode, "the closest fraction **from above**" in minus mode, plus one line
explaining that a minus convergent can lose an unrestricted race precisely
because it never approaches from below. The page states the restriction rather
than quietly reporting a convergent that "did not win".

The existing `CF.MAX_RACE_Q = 200000` limit and its refusal message apply
unchanged to both modes.

## 4. The telescoping cascade

A canvas between the term list and the convergent table, `900 × H` where `H`
grows with the number of rows drawn (about 26px per row, capped at 14 rows).

Row `n` draws the bracket between convergent `n−1` and convergent `n`, with the
horizontal extent auto-zoomed so the **previous** row's bracket fills the full
width. Each row shows:

- a horizontal rule spanning the zoomed view
- a tick at each of the two convergents, labelled `p/q`, coloured by side:
  one colour for endpoints below the target, another for endpoints above
- a vertical line at the target value
- a left-margin label: the level `n` and the bracket width in scientific notation

The colouring carries the whole point. In regular mode the ticks alternate side
down the cascade and the target is always trapped between the last two
convergents. In minus mode every tick is on the same side and the ticks march
down onto the target without ever crossing it.

```
CF.cascadeRows(key, mode, maxRows) -> {
  n: number,                     // level
  lo: Rat, hi: Rat,              // the interval this row draws, lo < hi
  width: Rat,                    // hi - lo
  brackets: boolean,             // true when the target lies strictly inside [lo, hi]
  loPos, hiPos, targetPos: number,   // positions in [0, 1] within the zoomed view
  loLabel, hiLabel: string,      // "p/q", or "x" for a target endpoint
  loAbove, hiAbove: boolean      // which side of the target each endpoint is on
}[]
```

Positions are computed as `(v − viewLo)/(viewHi − viewLo)` in exact rationals and
only then converted to `Number`, so the geometry stays correct for brackets
narrower than `10⁻³⁰`, where a float subtraction would underflow to zero.

The view for row `n` is row `n−1`'s bracket, widened by 15% on each side so the
endpoints are not drawn flush against the canvas edge. Row 0's view is the
bracket of row 0 itself, similarly padded.

For a minus expansion the "bracket" between consecutive convergents does not
contain the target — both endpoints are above it. The row therefore draws the
interval from the newer convergent to the target instead, and the caption says
so. `cascadeRows` marks each row with `brackets: boolean` so the drawing code and
the caption can tell the two cases apart without inspecting the mode.

## 5. Tests

- π's minus terms are `4,2,2,2,2,2,2,17,294,3`.
- π's minus convergents are `4/1, 7/2, 10/3, 13/4, 16/5, 19/6, 22/7, 355/113,
  104348/33215` — pinning the `q₋₂ = −1` seed.
- Every minus convergent of every shipped irrational is `≥` the target; no minus
  convergent ever falls below it.
- Regular convergents strictly alternate (already covered by the existing
  `errors alternate in sign` test, which stays).
- `minusExpand('r355_113')` terminates with `stopReason = 'exact'` and its last
  convergent equals `355/113` exactly.
- Every minus convergent of π with `q ≤ 200000` wins `bestApproximationsAbove`
  for its own denominator.
- `4/1` loses the unrestricted `bestApproximations` race to `3/1`, pinning the
  one-sidedness the UI explains.
- Cascade: for both modes, each row's interval is strictly nested inside the
  previous row's; every computed position lies in `[0, 1]`; and in regular mode
  the target lies strictly between the two endpoints of every row.

## Non-goals

- No periodic generator for minus expansions of quadratic irrationals.
- No minus mode in the Generalized, Geometry or Euler product tabs.
- No signed-error zigzag chart; the cascade is the only new picture.
- No animation of the zoom; rows are static and all visible at once.
