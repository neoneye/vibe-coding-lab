# Unit fractions tab — design

Date: 2026-09-17
Directory: `continued-fractions/` (extends the existing page)
Extends: `docs/superpowers/specs/2026-09-17-continued-fractions-design.md`

A fifth tab expanding a constant as a **sum** of distinct unit fractions, the
greedy Egyptian-fraction algorithm. Continued fractions divide, the Euler product
tab multiplies; this one adds.

The page's product question is already answered by the Euler product tab, whose
`∏ₚ (1 − p⁻ˢ)⁻¹` is literally a product of fractions `∏ₚ pˢ/(pˢ − 1)`. No
separate product expansion is added.

## 1. The algorithm

Split `x` into its integer part and a remainder `r ∈ [0, 1)`. Then repeatedly:

```
n = ⌈1/r⌉          the largest unit fraction 1/n that still fits under r
r = r − 1/n
```

`n` is the smallest denominator whose unit fraction does not overshoot, which is
what makes the choice greedy. The denominators strictly increase and are
distinct.

For π: `3 + 1/8 + 1/61 + 1/5020 + 1/128541455 + 1/162924332716605980 + …`

## 2. The cutoff is doubly constrained, and the page must say which bound bit

Two separate things stop this expansion, and they are worth distinguishing in the
UI because they mean different things:

- **Precision.** `n = ⌈1/r⌉` is only certain when `⌈1/r_lo⌉ = ⌈1/r_hi⌉` across the
  whole enclosure, the same interval discipline the continued-fraction tabs use.
- **Speed.** The remainder roughly squares each step — 6.1e-18 after four terms
  for π, about 1e-35 after five, about 1e-69 after six — so a 60-digit enclosure
  is exhausted after roughly five or six terms no matter how much display room
  there is.

In practice the second causes the first. The status line reports the term count
and `stopReason`, and for `precision-exhausted` adds that the remainder squares
each step, so the reader understands the expansion is short because it converges
fast, not because the page gave up early.

A rational terminates exactly (`stopReason = 'exact'`) when the remainder reaches
zero.

## 3. Engine (`CF`, shared-code)

- `CF.unitFractions(lo: Rat, hi: Rat, maxTerms: number) -> {whole: BigInt, dens: BigInt[], stopReason: 'exact'|'precision-exhausted'|'max-terms'}`
  — `whole` is the integer part (certain only when `⌊lo⌋ = ⌊hi⌋`; otherwise the
  expansion stops immediately with no terms).
- `CF.unitFractionRows(key: string, maxTerms: number) -> {whole, rows, stopReason}`
  where each row is
  `{k, den: BigInt, digits: number, partial: Rat, partialStr: string, error: Rat, errorStr: string}`.
  `partial` is the running sum including `whole`.

Both endpoints are carried through the subtraction, so the remainder stays an
enclosure and the certainty test above is exact.

## 4. The tab

Constant chips (the existing ten). Below them:

- The expansion written out: `π = 3 + 1/8 + 1/61 + 1/5020 + …`, with an ellipsis
  exactly when `stopReason !== 'exact'` — the same rule the Simple tab uses.
- A table: `k`, `nₖ` (elided past 18 characters with the full value in `title`),
  `digits in nₖ`, the partial sum to 20 places, and the remaining error in
  scientific notation.
- A status line naming the term count and the stop reason.
- One comparison line: the accuracy reached by the unit-fraction sum after all
  its certain terms, and how many regular continued-fraction terms of the same
  constant are needed to match it. For π this is roughly four unit fractions
  against fourteen continued-fraction terms — but the fourth unit-fraction
  denominator has nine digits and the fifth eighteen, where the continued
  fraction's terms are mostly single digits. The line is computed, not
  hardcoded: the page finds the first convergent whose error is below the
  unit-fraction sum's error.

No canvas. The digit explosion is legible in the table's `digits` column, and a
chart of five points would earn nothing.

## 5. Tests

- π's greedy denominators are `8, 61, 5020, 128541455, 162924332716605980`.
- e's are `2, 5, 55, 9999, 3620211523`; √2's are `3, 13, 253, 218201, 61323543802`.
- Greediness, checked directly rather than assumed: for each `k`, `nₖ − 1` would
  overshoot — that is, `1/(nₖ − 1)` exceeds the remainder — while `1/nₖ` does not.
- Partial sums strictly increase and never exceed the target.
- Denominators strictly increase.
- A rational terminates: 355/113 gives `stopReason = 'exact'` and a partial sum
  exactly equal to 355/113.
- The interval cutoff fires: a 5-digit enclosure of π yields only the terms those
  5 digits determine, with `stopReason = 'precision-exhausted'`.
- The integer part is withheld when the enclosure straddles an integer.

## Non-goals

- No Engel, Pierce or Cantor product expansions.
- No canvas or chart on this tab.
- No attempt to continue past the enclosure by re-deriving constants at higher
  precision.
