# Euler product tab — design

Date: 2026-09-17
Directory: `continued-fractions/` (extends the existing page)
Extends: `docs/superpowers/specs/2026-09-17-continued-fractions-design.md`

A fourth tab showing how a constant can be built out of the integers in two ways
at once: as a Dirichlet series summed over every integer, and as an Euler product
taken over the primes alone.

## Framing

An Euler product is not a continued fraction. It earns its place beside the other
three tabs because it answers the same question with different machinery — how an
infinite process pins down a constant — and because the comparison is instructive:
Brouncker's continued fraction for π and the Euler product for π²/6 are both
famously slow.

The page subtitle widens accordingly, from "the picture behind both" to wording
that covers series and products as well as continued fractions. The tab is
labelled **Euler product**.

## 1. Which s values, and why those

Only `s = 2, 3, 4, 6`. This is a verification constraint, not a cosmetic one: every
target value must be computable by the page itself, since the rest of the page
refuses to display digits it cannot check.

- `s = 2` → `π²/6`, `s = 4` → `π⁴/90`, `s = 6` → `π⁶/945`, all from the π enclosure
  already shipped.
- `s = 3` → Apéry's constant, computed by Apéry's series
  `ζ(3) = (5/2) · Σ_{n≥1} (−1)^(n−1) / (n³ · C(2n,n))`, which gains roughly
  0.6 decimal digits per term and is exact in rationals. Verified during design:
  120 terms agree with the published value to 43 digits.
- `s = 5` is deliberately excluded. It has no closed form and no series cheap
  enough to implement and verify here; transcribing unverifiable digits would
  break the rule the rest of the page follows.

The even/odd contrast survives the exclusion: 2, 4 and 6 get powers of π, while 3
gets only a name and Apéry's 1978 proof that it is irrational. The tab states this.

## 2. Math engine additions (`CF`, shared-code)

All exact on the existing `Rat`.

- `CF.zetaPartialSum(s, N) -> Rat` — `Σ_{n=1}^{N} 1/n^s`.
- `CF.eulerPartialProduct(s, N) -> Rat` — `∏_{p ≤ N} p^s/(p^s − 1)`, equivalently
  `∏ (1 − p^-s)^-1`.
- `CF.apery(terms) -> Rat` — Apéry's series above, exact; `terms = 120` gives well
  over the 30 digits displayed.
- `CF.zetaValue(s) -> {rat: Rat, label: string, closedForm: string|null}` —
  `{closedForm: 'π²/6'}` for 2, `'π⁴/90'` for 4, `'π⁶/945'` for 6, and
  `{closedForm: null, label: "Apéry's constant"}` for 3. The π-based values use the
  stored enclosure's `lo` endpoint.
- `CF.smoothNumbers(N, limit) -> number[]` — every integer `≤ limit` whose prime
  factors are all `≤ N`. Used by the grid in §4.
- `CF.primeFactorRows(s, N) -> {p, factor: Rat, decimal: string}[]` — one row per
  prime `p ≤ N`.

Denominators stay tractable: the partial sum's reduced denominator is bounded by
`lcm(1..N)^s`, about `10^87` at `N = 200, s = 2` and `10^522` at `s = 6` — large
for a human, trivial for `BigInt`.

`N` is capped at 200 in the UI.

## 3. The race

Controls: `s` chips (2, 3, 4, 6) and an `N` slider (2…200).

Two columns side by side:

| | over every integer | over the primes only |
|---|---|---|
| expression | `Σ_{n≤N} 1/n^s` | `∏_{p≤N} (1 − p^-s)^-1` |
| value | exact rational, 20 decimals | exact rational, 20 decimals |
| error | `ζ(s) − partial`, scientific | same |
| work done | `N` terms | `π(N)` factors |

Both approach `ζ(s)` from below and never overshoot, which a test asserts. The
"work done" row is the point: at `N = 100` the product uses 25 factors against the
sum's 100 terms and is still closer.

A line above the columns names the target: for `s = 2`, "ζ(2) = π²/6 =
1.6449340668…"; for `s = 3`, "ζ(3) = Apéry's constant = 1.2020569031… — no closed
form is known".

## 4. Why the product wins

A grid of the integers 1…240, each cell in one of three states. Every `n ≤ N` is
trivially `N`-smooth, so the sum's reach is a subset of the product's and three
states suffice:

- **reached by both** — `n ≤ N`
- **reached by the product alone** — `N`-smooth but greater than `N`
- **reached by neither** — has a prime factor above `N`

At `N = 5` the sum stops at 5 while the product already
contains 6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 27, 30, 32, … scattered across
the grid. A caption states the identity driving it: the product over primes `≤ N`
is exactly the sum over `N`-smooth integers, which is unique factorisation.

## 5. Per-prime contribution

A canvas bar chart, device-pixel sized, one bar per prime `p ≤ N`, height
proportional to `factor − 1` so the decay is legible. Each bar labelled with its
prime; the first few also with the factor. At `s = 2`: 2 → 1.333333, 3 → 1.125,
5 → 1.041667, 7 → 1.020833, and 97 → 1.000106. The caption states that the small
primes do nearly all the work, and that raising `s` makes the decay steeper.

## 6. Tests

- `zetaPartialSum(2, 3)` equals `1 + 1/4 + 1/9 = 49/36` exactly.
- `eulerPartialProduct(2, 3)` equals `(4/3)·(9/8) = 3/2` exactly.
- The Euler identity: for several `(s, N)` pairs, `eulerPartialProduct(s, N)`
  equals `Σ 1/n^s` over the `N`-smooth integers up to a bound high enough that the
  tail is below the compared precision — checked to 12 digits.
- `apery(120)` agrees with the ζ(3) digits already in `NAMED_VALUES` to 40 digits.
- `zetaValue(2/4/6)` agree with `π²/6`, `π⁴/90`, `π⁶/945` built from the enclosure.
- Monotone approach: for `s = 2, 3, 4, 6` and `N` up to 60, both the partial sum
  and the partial product increase with `N` and stay strictly below `ζ(s)`.
- The product beats the sum: for every `N ≥ 4`, the product's error is smaller
  than the sum's.
- `smoothNumbers(5, 40)` equals `[1,2,3,4,5,6,8,9,10,12,15,16,18,20,24,25,27,30,32,36,40]`.

## Non-goals

- No Dirichlet characters or L-functions.
- No squarefree-probability demonstration (`1/ζ(2) = 6/π²`).
- No `s = 5` or other odd `s` beyond 3, for the verification reason in §1.
- No non-integer or complex `s`; the exact-rational engine does not support it and
  the page will not switch to floating point for one tab.
