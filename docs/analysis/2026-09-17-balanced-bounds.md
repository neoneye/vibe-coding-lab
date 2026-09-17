# Choosing continued-fraction bounds so their midpoint is best

Date: 2026-09-17
Code: `continued-fractions/index.html` (Bounds tab)
Tests: `node continued-fractions/test.mjs` — 133 tests
Written for review. Claims are labelled **proved**, **verified** (computed in exact
rational arithmetic) or **assumed** (relied on, not established here).

> **Review outcome (Codex, 2026-09-17).** The core mathematics — the midpoint
> identity, the quadratic law, the 1.26e+11 √2 figure — was confirmed, including
> against an exhaustive check of 31,518 candidate pairs. Six defects were found in
> the surrounding code, all now fixed (`continued-fractions/index.html`, 144 tests).
> Two claims in *this document* were wrong and are corrected in place below: §3.3
> on whether the conversion problem reaches the page, and §4 on why φ resists
> balancing. Full report: `2026-09-17-balanced-bounds-review.md`.

## 1. The construction

For a real irrational `x`, the regular continued fraction's convergents alternate
sides. Split them by parity:

- **B** (lower) = the even-indexed convergents, rising to `x` from below
- **A** (upper) = the odd-indexed convergents, falling to `x` from above
- **C** = `(A + B) / 2`

Two modes are compared, both at the **same denominator budget**
`Q = max(qA, qB)` taken from the independent pair:

- `independent` — A and B are the parity-split convergents. Each is individually
  the closest fraction on its side for its denominator.
- `balanced` — A and B are chosen from the pool of one-sided best approximations
  with `q ≤ Q` to minimise `| |x−A| − |x−B| |`.

## 2. Why balancing is the right objective

**Proved.** Write `eB = x − B > 0` and `eA = A − x > 0`. Then

```
C − x = (A + B)/2 − x = ((A − x) + (B − x))/2 = (eA − eB)/2
```

so `|C − x| = |eA − eB| / 2`.

C is therefore **not** made small by making each bound small. It is made small by
making the two errors *equal*. Deliberately choosing a worse bound on the better
side can improve C, and improving either bound in isolation can make C worse.

This identity is pinned by the test
`the midpoint error is exactly half the difference of the two errors`.

**Proved.** Balanced can never lose to independent: the independent pair lies in
the pool the balanced search draws from, at the same budget. Test:
`balanced is never worse than independent`.

## 3. The √2 case, where the gain is ten orders of magnitude

### 3.1 What the search selects

**Verified** at every level computed (k = 0…8): the balanced pair is

```
B = p/q        A = 2q/p
```

the harmonic conjugate. If `p/q < √2` then `2q/p > √2`, so the pair always
brackets. Selected pairs:

```
7/5 & 10/7      41/29 & 58/41      239/169 & 338/239      1393/985 & 1970/1393
8119/5741 & 11482/8119             47321/33461 & 66922/47321
275807/195025 & 390050/275807      1607521/1136689 & 2273378/1607521
```

**Resolved by review.** That `2q/p` is a semiconvergent of `√2` at every depth was
left assumed here; Codex established it. Separately, that convergents plus
semiconvergents are exactly the one-sided best approximations is a theorem
(Hančl & Turek, *One-sided Diophantine approximations*, Thm 4.5), and the `j`
range in `semiconvergents()` was confirmed correct — `j = 0` is the previous
convergent and `j = a` the next, both added separately.

The real defect was elsewhere: the pool was generated from a **fixed 34
convergents** regardless of the budget, so at deep budgets it could omit even the
independent pair and balanced mode lost to it (φ level 17: `1.112e-14` against
`1.623e-15`). Fixed — the pool now grows until the denominators pass the budget,
and the caller's pair is injected as a candidate.

### 3.2 Why the midpoint is then quadratically accurate

**Proved.** Put `L = p/q = √2(1 − ε)` with `ε > 0`. Since `L = p/q`, the partner
is `U = 2q/p = 2/L`:

```
U = 2 / (√2(1−ε)) = √2 / (1−ε)

C = (L + U)/2 = (√2/2) · [ (1−ε) + 1/(1−ε) ]
              = (√2/2) · [ (1−ε)² + 1 ] / (1−ε)
              = (√2/2) · [ 2 − 2ε + ε² ] / (1−ε)

C − √2 = (√2/2) · [ 2 − 2ε + ε² − 2(1−ε) ] / (1−ε)
       = (√2/2) · ε² / (1−ε)
```

and since `eB = √2 − L = √2 ε`, i.e. `ε = eB/√2`:

```
|C − √2| = eB² / ( 2√2 (1−ε) )   →   eB² / (2√2)
```

**The midpoint error is quadratic in the bound error.** That is the whole
mechanism: the two errors are equal to first order in ε and cancel, leaving the
second-order term.

### 3.3 Numerical check of the quadratic law

**Verified** in exact rational arithmetic — `ratio = |C − √2| · 2√2 / eB²`, which
the derivation says tends to 1:

```
k   B lower            A upper             |err C|      ratio
0   1/1                2/1                 8.578e-2     1.4142135623
1   7/5                10/7                7.215e-5     1.0101525445
2   41/29              58/41               6.252e-8     1.0002973977
3   239/169            338/239             5.417e-11    1.0000087533
4   1393/985           1970/1393           4.694e-14    1.0000002576
5   8119/5741          11482/8119          4.068e-17    1.0000000075
6   47321/33461        66922/47321         3.525e-20    1.0000000002
7   275807/195025      390050/275807       3.054e-23    1.0000000000
8   1607521/1136689    2273378/1607521     2.647e-26    1.0000000000
```

**A trap worth recording — and a claim this document got wrong.** The first
version of this check used `CF.Rat.toNumber`, which routes through
`toDecimalString(…, 20)` and floors below `1e-20`, so k=6 read `0.851` and k=7
read `0.000`.

This document originally called that "an artifact of the *check*, not of the
page". **That was false.** The page's arithmetic is exact, but its *charts*
converted through the same function — so the level-7 midpoint error `3.05e-23`
became zero and vanished from the Bounds plot, deleting precisely the result the
tab exists to show. Fixed by adding `Rat.log10`, which reads the exponent off the
BigInt digit counts and is valid at any magnitude; the Bounds, Generalized and
Complex plots now use it. Two further underflows of the same family were fixed at
the same time (the Möbius zoom strip divided two separately-converted doubles;
the Complex plot took its radial magnitude from a double difference of order-1
values).

### 3.4 The resulting gain

At k=7, same denominator budget:

```
independent   |C − √2| = 3.85e-12
balanced      |C − √2| = 3.05e-23      factor 1.26e+11
```

The independent split pairs consecutive convergents, whose errors differ by
roughly `q_k / q_{k+2}` — nowhere near equal, so nothing cancels.

## 4. What is NOT claimed

- **The magnitude is √2-specific.** Largest gain across 8 levels: √2 `×1.26e+11`,
  e `×3.33e+2`, π `×4.22`, φ `×1` (none).
- **φ is unimprovable** — but the reason given here originally ("every partial
  quotient is 1, so there are no semiconvergents") does **not** by itself prove
  it, as Codex pointed out: older convergents remain in the pool and could in
  principle pair better. The completion is via the error sizes. With
  `E_n = |φ − p_n/q_n| = φ^(−n−1)/F_(n+1)`, one has `E_n/E_(n+1) > 2` for `n ≥ 1`,
  so the adjacent gaps `g_n = E_n − E_(n+1)` strictly decrease for `n ≥ 1`, and
  `g_0 > g_2` by direct check on 1, 2, 3/2, 5/3. At a budget ending on an
  odd-indexed convergent the smallest adjacent gap is therefore `g_(2k)`; adjacent
  errors alternate sides and no non-adjacent pair has a smaller gap. The
  independent pair is thus optimal within the complete pool.
- **No claim that C beats the best single bound in general.** In independent mode
  the midpoint beats both bounds well under half the time; that is the point of
  §2 and is itself a test (`the midpoint is not uniformly better than its own bounds`).
- **No claim of optimality over all rationals** with `q ≤ Q`. The search is
  optimal *over the pool*, which is **assumed** to be the complete set of
  one-sided best approximations (convergents plus semiconvergents). If that set
  is incomplete the search remains sound but may not be optimal.
- **C's denominator is not bounded by Q.** `(A+B)/2` has denominator up to
  `2·qA·qB`. Both modes obey the same *endpoint* budget, which is the stated
  fairness control — but their resulting midpoint denominators are not equal, so
  "both modes pay this equally" means they face the same constraint, not that
  their outputs are the same size. C is not a low-denominator approximation and
  should not be read as one.

## 5. Reproducing

```bash
node continued-fractions/test.mjs          # 133 tests, exits 0
```

Relevant code in `continued-fractions/index.html`, inside `<script id="shared-code">`:

- `semiconvergents(key, maxQ)` — the pool
- `balancedPair(key, maxQ)` — sorts by error magnitude, scans each element to its
  first opposite-side neighbour. Exact, not a heuristic: the nearest opposite-side
  partner in sorted order gives that element's smallest gap, and a backward
  partner for `i` is a forward partner for the earlier element.
- `boundRows(key, maxLevels, mode)` — `'independent'` or `'balanced'`

Relevant tests: `the midpoint error is exactly half the difference of the two errors`,
`balanced is never worse than independent`, `balanced bounds still bracket the value`,
`balancing buys orders of magnitude on sqrt2 and nothing on phi`,
`the semiconvergent pool respects its budget and takes a side`.

## 6. Attack targets, and what came of them

1. `2q/p` a semiconvergent of `√2` at every depth — **resolved**, established by
   Codex rather than left at k=8.
2. Whether `semiconvergents()` enumerates every one-sided best approximation —
   **the `j` range was correct**, but the enumeration was capped at a fixed 34
   convergents, which broke the "never worse" guarantee at depth. Fixed.
3. The fairness control — **accepted as legitimate and explicitly stated**, with
   the wording tightened (see §4).
4. `balancedPair` breaking after the first opposite-side partner — **confirmed
   correct**, and cross-checked against an exhaustive search over 31,518 pairs.

Four further defects were found outside these targets: unsound interval widths
(five constants, producing uncertified terms), deep rows reporting impossible
error bounds, singular convergents printed as zero, and the strict-upper search
returning nothing for a rational target. All fixed; see the review report.
