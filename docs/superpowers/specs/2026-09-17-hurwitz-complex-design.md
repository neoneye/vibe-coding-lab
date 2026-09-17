# Hurwitz complex continued fractions — design

Date: 2026-09-17
Directory: `continued-fractions/` (extends the existing page)
Extends: `docs/superpowers/specs/2026-09-17-continued-fractions-design.md`

Sub-project **A** of three. The user asked for "a complex representation" and chose
all three readings; they are independent builds and get one spec each:

- **A (this spec)** — exact Gaussian-rational arithmetic and a Hurwitz continued
  fraction tab. The foundation: B depends on its number type.
- **B** — complex entries in the Generalized tab's sequence menus.
- **C** — the Möbius disk view of the *real* continued fractions already shipped.

## 1. Gaussian rationals

`CRat = {re: Rat, im: Rat}` — a complex number with exact rational parts.

- `cAdd`, `cSub`, `cMul` — the obvious formulas on `Rat`.
- `cNormSq(z) -> Rat` — `re² + im²`.
- `cInv(z) -> CRat` — `conj(z)/|z|²`, exact because `|z|²` is a `Rat`.
- `cIsZero(z) -> boolean`.
- `cNearestGaussian(z) -> CRat` — `ratRound` applied to each part independently,
  so both halves round up, matching the existing real `nearest` mode.

Coordinate-wise rounding puts the remainder inside a square of half-width ½,
hence `|remainder| ≤ √2/2 ≈ 0.7071 < 1` and `|1/remainder| > 1`. That bound is
what makes the algorithm terminate-or-converge at all, and a test asserts it holds
at every step of every shipped expansion.

## 2. The enclosure is a disk, not a rectangle

On the real line an enclosure is an interval and `x ↦ 1/x` maps intervals to
intervals, which is why the existing code can carry two endpoints. In ℂ inversion
maps circles to circles but **not** rectangles to rectangles, so carrying a
rectangle through `1/r` would need a bounding box that loses ground every step.

So the complex enclosure is a disk: a centre `ẑ : CRat` and a rational radius
`δ : Rat`, meaning the true value lies within `δ` of `ẑ`.

**Propagation.** After subtracting the exact Gaussian integer `a`, the centre is
`r̂ = ẑ − a` and the radius is unchanged. Inversion then gives

```
|1/r − 1/r̂| = |r − r̂| / (|r|·|r̂|) ≤ δ / (|r̂|·(|r̂| − δ))
```

so the new centre is `1/r̂` and the new radius is `δ / (|r̂|(|r̂| − δ))`, valid
whenever `δ < |r̂|`. When `δ ≥ |r̂|` the disk contains the origin, the inversion is
unbounded, and the expansion stops with `precision-exhausted`.

Because `|r̂|` is generally irrational while `δ` must stay rational, the
implementation uses a rational **lower** bound on `|r̂|`: from `m = |r̂|²` (a `Rat`),
take `L = ratSqrtLower(m, 40)`, a rational with `L² ≤ m`, so `L ≤ |r̂|`. Using `L`
in place of `|r̂|` can only enlarge the radius, which keeps the enclosure valid.

**Certainty test.** A term is emitted only when every point of the disk rounds to
the same Gaussian integer:

```
|re(ẑ) − round(re(ẑ))| + δ < 1/2   and   |im(ẑ) − round(im(ẑ))| + δ < 1/2
```

Both sides are `Rat`, so the comparison is exact. If either fails, the expansion
stops with `precision-exhausted` and the UI says so, exactly as the real tabs do.

**A consequence found while building.** A value whose real or imaginary part is
*exactly* a half-integer has a genuinely ambiguous nearest Gaussian integer, and
the rule then refuses to emit even a first term. `(1 + i√7)/2` — the obvious
choice for a complex quadratic irrational — is exactly such a value, and produced
an empty expansion. It is replaced by `i·√7`, whose real part is 0, and the
boundary case is kept as a test rather than discarded, since it pins the rule's
behaviour at its sharpest point.

## 3. Convergents

`Aₖ = aₖAₖ₋₁ + Aₖ₋₂`, `Bₖ = aₖBₖ₋₁ + Bₖ₋₂`, seeded `A₋₂ = 0, A₋₁ = 1, B₋₂ = 1,
B₋₁ = 0`, all in `CRat`. Numerators are always `+1` — the Hurwitz algorithm carries
no sign choice, unlike the real semiregular family, because nearest-Gaussian
rounding already minimises the remainder in both coordinates.

## 4. Constants

All derivable from values the page already stores, plus `ratSqrt` for √7:

| key | value | note |
|---|---|---|
| `pi_e_i` | `π + e·i` | terms 3+3i, 1+3i, 2+1i, 1+5i, … |
| `rot8` | `(1+i)/√2` | periodic: 1+i, then −2+2i, 2+2i repeating |
| `quad7` | `i·√7` | a complex quadratic irrational, root of `z² + 7 = 0`; periodic `3i, 3i, 6i, 3i, 6i, …` |
| `g45` | `(3+4i)/5` | a Gaussian rational; terminates in two terms |
| `gamma_phi` | `γ + φ·i` | |
| `ln2_sqrt3` | `ln 2 + √3·i` | |

Each ships as a centre `CRat` truncated to 50 decimals per part with
`δ = 10⁻⁴⁸`, a radius comfortably covering both truncations. `g45` ships exactly,
with `δ = 0`.

## 5. The tab

A sixth tab, **Complex**. Chips for the six constants, then:

- the term list as Gaussian integers, `⟨3+3i; 1+3i, 2+1i, 1+5i, …⟩`, with an
  ellipsis exactly when `stopReason !== 'exact'`;
- a convergent table: `k`, the term, `Aₖ`, `Bₖ`, the value as a decimal pair, and
  `|z − Aₖ/Bₖ|` in scientific notation;
- a complex-plane canvas, device-pixel sized, plotting the target as a cross and
  the convergents as points joined in order, auto-scaled to the convergents drawn.
  There is no above/below in ℂ, so the cascade's alternation has no analogue; the
  convergents spiral onto the target instead, and the picture shows that spiral.
- a status line with the term count and stop reason.

## 6. Tests

- `π + e·i` gives `3+3i, 1+3i, 2+1i, 1+5i` as its first four terms.
- `(3+4i)/5` gives `1+i, −2+i` and `stopReason = 'exact'`, with the final
  convergent equal to `(3+4i)/5` exactly.
- `(1+i)/√2` is periodic from the second term: `−2+2i, 2+2i, −2+2i, 2+2i`.
- Every remainder satisfies `|r|² ≤ 1/2`, the bound coordinate-wise rounding
  guarantees — checked as a `Rat` comparison, not a float one.
- `|z − Aₖ/Bₖ|` strictly decreases for every shipped constant.
- `cInv(cInv(z))` equals `z` exactly, and `cMul(z, cInv(z))` equals 1.
- The disk rule withholds a term: a constant supplied with a deliberately large
  `δ` yields `stopReason = 'precision-exhausted'` and fewer terms.
- `ratSqrtLower(m, n)` satisfies `L² ≤ m` for a range of `m`, so the radius bound
  is never optimistic.

## Non-goals

- No Eisenstein or other imaginary-quadratic integer rings.
- No periodicity detector; `rot8`'s periodicity is asserted by a test, not
  discovered by the page.
- No complex entries in the Generalized tab (that is sub-project B).
- No Möbius disk picture (that is sub-project C).
