# Independent review of balanced bounds and continued-fractions

Reviewed 2026-09-17 at commit `7ae8b3a`. Application source unchanged.

The central balanced-bounds result is correct at the displayed depths. The
implementation has correctness defects outside the existing tests, including
two that directly contradict its precision guarantees.

## Findings

### 1. [P1] Five claimed enclosures do not contain their constants

`continued-fractions/index.html:354–361` always adds `10^-60`, but √2, √3,
√5, φ and ∛2 have only 59 digits after the decimal point. All five true values
are above the resulting upper endpoints. This is provable without a reference
digit string: `hi² < 2`, `hi² < 3`, `hi² < 5`, `hi²-hi-1 < 0`, and `hi³ < 2`,
respectively, using the page's exact rational arithmetic.

This produces incorrect terms within the Simple tab's 60-term limit. For
example, `CF.expandMode('sqrt5', 'nearest', 60)` emits 5 at zero-based index 47,
where the correct term is 4; ceiling √3 emits 3 at index 52 instead of 4.
Comparison against 90-decimal Newton approximations reproduced both failures.

The test named “enclosure brackets the value” only checks `lo < hi`; the digit
test counts significant digits, including the integer part. Neither checks the
claimed enclosure. Derive interval width from the number of fractional digits,
or supply enough digits, and test actual containment algebraically.

### 2. [P2] The Bounds chart drops the most accurate √2 midpoint

`continued-fractions/index.html:3547`, `3567`, and `3575` convert errors through
`Rat.toNumber`, which truncates to 20 decimal places. At level 6 the actual
`3.52540e-20` becomes `3e-20`; at level 7 `3.05494e-23` becomes zero and is
skipped by the chart. The table retains the small value, so table and chart
disagree precisely at the showcased result.

The analysis at lines 117–121 incorrectly says this conversion problem affects
only the check, not the page. Use a significant-digit conversion or compute
logarithms from rational magnitudes. The Generalized convergence plot uses the
same conversion and is affected too.

### 3. [P2] Deep quadratic errors measure the stored decimal, not the constant

`continued-fractions/index.html:1253–1275` generates exact quadratic terms but
subtracts their convergents from the fixed decimal `lo`, regardless of depth.
Selecting regular √5 renders 60 rows; row 59 reports `|error| q²` as
`623136931983969.176690` and discarded distance `4.236067`. For a regular
convergent the former is below 1, and the latter should be in [0,1).

This is separate from the interval-width bug: widening the enclosure alone does
not fix subtraction from its lower endpoint. Use exact quadratic error formulas,
adapt precision to depth, or withhold quantities that the interval cannot resolve.

### 4. [P2] A zero generalized denominator is reported as zero

`continued-fractions/index.html:1150` replaces every convergent with `B_n = 0`
by `O.zero`. In the Generalized controls, choose `b₀=0`, `aₙ=1`, `bₙ=k`, `k=0`.
The engine returns `[0,0,0,0,...]`, although the recurrence alternates infinity
and zero. Its table therefore invents finite values and zero differences.

Represent poles and indeterminate values explicitly, and make the table,
identification and plot handle them. Keep the recurrence state so subsequent
finite convergents can still be computed.

### 5. [P2, API limitation] The pool is silently limited to 34 convergents

`continued-fractions/index.html:730` requests exactly 34 convergents independent
of `maxQ`. Consequently “balanced never loses” is not an unrestricted guarantee
of the exported functions. Reproduction:

```js
CF.boundRows('phi', 18, 'independent').rows[17].eMidStr // '1.623e-15'
CF.boundRows('phi', 18, 'balanced').rows[17].eMidStr    // '1.112e-14'
```

The current eight-level Bounds UI is unaffected. Generate until the budget is
covered, or expose an explicit completeness limit and retain the independent
pair as a candidate. This also qualifies the report's “at every depth” discussion.

### 6. [P2, API limitation] Strict-upper search can return no candidates

`CF.bestApproximationsAbove('r355_113', 10000, 5)` returns `[]`, although 22/7
alone proves the set is nonempty. Exact hits occupy the 50-item shortlist and
are removed only afterward (`index.html:1292–1308`). Generate a strictly greater
numerator and exclude exact hits before maintaining the shortlist.

This budget is not selectable through the current convergent-row UI for this
rational; it is a defect in the exported search function.

## What was verified

- `node continued-fractions/test.mjs`: all 133 existing tests pass.
- Independent denominator-by-denominator enumeration through Q=2000 exactly
  matches the pool for all nine shipped irrational constants: 198 distinct
  one-sided record fractions in total.
- Exhaustive comparison of all opposite-side pairs agrees with `balancedPair`
  at all 72 displayed irrational budgets: 31,518 pairs checked.
- All nine √2 midpoint errors in analysis §3.3 reproduce to the printed four
  significant digits. This was also checked using a separate integer-bisection
  construction of a 100-decimal interval for √2; both error endpoints have the
  printed digits. It does not rely on the page's defective √2 enclosure.
- The eight-level maximum gains reproduce: √2 approximately 1.2603e11,
  e 333.23, π 4.2286, φ 1.

Browser visual inspection was blocked by the browser's local-file URL policy.
The chart finding follows from executing its conversion on its actual inputs
and inspecting the rendering conditions; no browser screenshot was verified.

## Resolving the mathematical questions

### The √2 partner really is a semiconvergent

For √2 the convergents satisfy

`p_n + q_n√2 = (1+√2)^(n+1)`.

Multiplication by `√2-1` gives the previous convergent's components:

`p_(n-1) = 2q_n-p_n`, `q_(n-1) = p_n-q_n`.

The sole intermediate fraction (j=1 because the next partial quotient is 2) is

`(p_(n-1)+p_n)/(q_(n-1)+q_n) = 2q_n/p_n`.

This includes n=0 using the usual seed 1/0. For even n the original convergent
is below √2 and its partner is above. Its denominator `p_n` is below the next
convergent's denominator `p_n+q_n`, so it fits the independent pair's budget.
Thus the assumption in §3.1 can be replaced with a proof. Pool membership alone
does not prove that the implementation selects that pair at arbitrary depth.

### The midpoint law and search are correct

For `L<√2` and `U=2/L`, direct algebra gives

`C-√2 = (L-√2)²/(2L)`.

This is exactly the quadratic law in the analysis. More generally,
`|C-x| = |eA-eB|/2`. In sorted error magnitudes, for any candidate with a partner
to its right, its first opposite-side partner has no larger gap. Every unordered
pair has a left endpoint, so the implemented search finds a global minimum over
the supplied pool. The nested scan can be quadratic in pool size; correctness
does not require it to be a linear scan.

### Completeness is a theorem, subject to generating enough terms

Theorem 4.5 of [Hančl and Turek, One-sided Diophantine approximations](https://arxiv.org/html/1809.01013#S4)
characterizes the best one-sided approximations as convergents and
semiconvergents. The implemented j range is correct: the missing j=0 case is
the previous convergent, and j=a is the next convergent, both added separately.
The practical limitation is the fixed 34-term cap, not an off-by-one in j.

### The φ conclusion needs more than “there are no semiconvergents”

There are still older convergents to choose from. The conclusion is true for
the complete mathematical pool at budgets ending at odd-indexed convergents,
but the report's stated reason does not by itself prove it.

One completion: let `E_n = |φ-p_n/q_n|`. The Fibonacci formula gives
`E_n = φ^(-n-1)/F_(n+1)`. Thus `E_n/E_(n+1) > 2` for n≥1. The adjacent error
gaps `g_n=E_n-E_(n+1)` consequently decrease strictly for n≥1. Also
`g_0 > g_2`, checked from 1, 2, 3/2, 5/3. At a budget ending in index 2k+1,
the smallest adjacent gap is therefore `g_(2k)` (k=0 is immediate). Adjacent
errors alternate sides, and no nonadjacent pair has a smaller gap. This proves
the independent pair is optimal within that complete pool.

### Fairness and precision language

The endpoint-denominator budget is a legitimate, explicitly stated comparison.
It is not a comparison at equal reduced midpoint denominators: the actual
denominators of C can differ. “Both modes pay this equally” should mean both
obey the same endpoint constraint, not that their output sizes are identical.

BigInt operations are exact on the stored rational decimals, not on irrational
constants. The printed √2 values are nevertheless certified by the independent
interval check above. Distinguish exact rational operations from certified
irrational errors in the text and tests.
