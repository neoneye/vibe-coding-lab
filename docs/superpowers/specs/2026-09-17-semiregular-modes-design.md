# Semiregular continued fraction modes — design

Date: 2026-09-17
Directory: `continued-fractions/` (extends the existing page)
Extends: `docs/superpowers/specs/2026-09-17-minus-cf-and-cascade-design.md`

The Simple tab's regular/minus toggle becomes a four-way choice over one knob:
which way each partial quotient is rounded. The two existing modes turn out to be
the two constant answers to that question; two more modes fill in the rest.

## 1. The knob is the rounding rule

Every one of these expansions has the form `x = a + ε/x′` with `x′ > 1`, iterated.
The rounding direction and the numerator sign are not two choices but one:

- `a = ⌊x⌋` puts the remainder `x − a` in `(0, 1)`, forcing `ε = +1`.
- `a = ⌈x⌉` puts it in `(−1, 0)`, forcing `ε = −1`.

So the modes are named and labelled by the rounding rule, which is the actual
control, rather than by the sign, which merely follows:

| mode key | label | rounding rule | ε |
|---|---|---|---|
| `floor` | `⌊x⌋ always` | `a = ⌊x⌋` | always `+1` |
| `nearest` | `nearest` | `a = round(x)` | `sign(x − a)` |
| `alt` | `⌊x⌋ ⌈x⌉ alternating` | floor, ceiling, floor, ceiling … | `+1, −1, +1, −1` … |
| `ceil` | `⌈x⌉ always` | `a = ⌈x⌉` | always `−1` |

`floor` is the existing regular mode and `ceil` the existing minus mode; their
keys change from `'plus'`/`'minus'` to `'floor'`/`'ceil'` so the naming matches
the control.

In every mode the next value is `x′ = 1/|x − a|`.

`nearest` is the classical nearest-integer continued fraction. `alt` is not a
classical named object — it is a construction, and the page labels it as one.

## 2. One expansion function, not four

`CF.semiregularTerms` replaces the parallel `termsFromInterval` /
`minusTermsFromInterval` pair, and `CF.semiregularConvergents` replaces the
`convergents` / `minusConvergents` pair. The recurrence

```
Aₖ = aₖ·Aₖ₋₁ + εₖ·Aₖ₋₂        A₋₂ = 0, A₋₁ = 1
Bₖ = aₖ·Bₖ₋₁ + εₖ·Bₖ₋₂        B₋₂ = 1, B₋₁ = 0
```

with the convention `ε₀ = +1` — there is no numerator before the first term, and
`ε₀` only ever multiplies the seed. That convention is what makes `B₀ = 1` in
every mode.

This is the regular recurrence at `ε = +1` and the minus recurrence at `ε = −1`,
so the two existing functions collapse into it rather than sitting beside it.
Their current seeds differ (`q₋₂ = +1` regular, `−1` minus) only because the sign
was baked into the seed; with `ε` carried explicitly the seed is `q₋₂ = +1` for
both. Verified during design: this recurrence reproduces π's regular convergents
`3/1, 22/7, 333/106, 355/113, 103993/33102` and its minus convergents
`4/1, 7/2, 10/3, 13/4, 16/5, 19/6, 22/7, 355/113, 104348/33215` exactly, with
positive denominators throughout.

Regular mode keeps the exact periodic generator (`quadraticTerms`) for √2, √3, √5
and φ, so it does not lose its unlimited term count. The other three modes use
the interval path.

## 3. The honesty rule gains a second condition

Today a term is emitted only while `⌊lo⌋ = ⌊hi⌋`. For the sign-carrying modes
that is not sufficient: if the enclosure straddles `a`, the *sign* is undetermined
even when the integer is not. `semiregularTerms` therefore emits a term only when
**both** the chosen integer and the resulting sign agree across the whole
enclosure, and otherwise stops with `stopReason = 'precision-exhausted'`.

Without this, nearest-integer mode would print a sign it has not earned whenever
the value sits near a half-integer.

## 4. The cascade decides per row, not per mode

The cascade currently branches on the mode: brackets for regular, target-to-newest
for minus. It instead decides per row — if consecutive convergents straddle the
target, draw the bracket between them; otherwise draw from the target to the newer
convergent. Nearest and alternating then render with no extra code.

This matters because those modes are genuinely mixed. `e` in nearest mode has
convergents above, above, below, below, above, above, below — so the cascade
switches shape partway down, which neither existing mode ever does.

The caption is chosen from what the rows actually contain (all bracketing, none
bracketing, or mixed) rather than from the mode.

## 5. The race

- `floor` keeps the unrestricted race.
- `ceil` keeps the from-above race, with its one-sidedness explanation.
- `nearest` and `alt` use the unrestricted race.

Nearest-integer convergents are a subset of the regular convergents, so they win
their races. `alt` convergents demonstrably do not: π's alternating expansion
yields `3/1, 25/8, 22/7, 355/113, …`, and `25/8` is not a best approximation at
all — `22/7` is closer with a smaller denominator. The existing "did not win"
branch is therefore load-bearing in `alt` mode rather than a defensive
afterthought, and a test pins both facts: that nearest convergents win, and that
π's `25/8` loses to `22/7`.

## 6. Tests

- π: `floor` gives `3,7,15,1,292,1,1,1`; `ceil` gives `4,2,2,2,2,2,2,17,294`;
  `nearest` gives `3,7,16,294,3,4,5` with signs `+,+,−,−,−,−`; `alt` gives
  `3,8,1,15,293,2,2,3` with signs strictly `+,−,+,−,+,−,+`.
- √2 in `nearest` mode produces all `+1` signs and terms identical to its regular
  expansion — rounding down *is* rounding to nearest when every partial quotient
  is at least 2.
- φ in `nearest` mode produces all `−1` signs, terms `2,3,3,3,3,…`, and every
  convergent above φ — its regular terms are all 1s, so rounding always goes up.
- Every mode's last convergent agrees with the target to the precision its own
  terms support, for all shipped constants.
- The sign-undetermined cutoff fires: a value enclosed loosely enough that the
  nearest integer is certain but the side is not yields `'precision-exhausted'`.
- `semiregularConvergents` with all-`+1` signs reproduces the existing
  `convergents` output, and with all-`−1` signs reproduces `minusConvergents`
  — including positive denominators, which the old minus seed encoded separately.
- π in `alt` mode yields `25/8` at level 1, and `22/7` beats it in an unrestricted
  race despite the smaller denominator, so the race's losing branch is exercised.
- The existing regular and minus tests keep passing unchanged, since both are now
  the same code path under new mode keys.

## Non-goals

- No semiregular modes in the Generalized, Geometry or Euler product tabs.
- No periodic generator for the non-regular modes.
- No further members of the family (even/odd continued fractions, Farey or
  backwards variants).
