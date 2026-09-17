# Möbius disk view — design

Date: 2026-09-17
Sub-project **C** of the complex work. Independent of A and B — it is a picture of
the *real* continued fractions already on the page.

## What the picture actually is

The Wikipedia section the user linked in the very first message,
`Continued fraction#A geometric interpretation`, is about linear fractional
transformations: the convergent `Aₙ/Bₙ` is `Tₙ(0)` for a composition of Möbius
maps, and as `n` grows `Tₙ` squeezes a whole region of the plane onto the value.

**A correction found while designing this.** The obvious reading — draw the image
of the unit disk under `Tₙ` — is wrong. Those images contain the target but do
**not** nest, verified numerically for π, e, √2 and φ: the unit disk is not a
region each successive map sends inside itself.

The region that works is the closed right half-plane. `Tₙ` has real coefficients
and sends `0 ↦ Aₙ₋₁/Bₙ₋₁` and `∞ ↦ Aₙ/Bₙ`, so it maps the imaginary axis to a
circle through those two points and the half-plane to the **disk whose diameter
runs between consecutive convergents**. Verified for π, e, √2, φ and γ: those
disks contain the target, nest strictly, and shrink strictly.

So each disk is:

```
centre = (Aₙ₋₁/Bₙ₋₁ + Aₙ/Bₙ) / 2        radius = |Aₙ/Bₙ − Aₙ₋₁/Bₙ₋₁| / 2
```

both exact `Rat`s, and the picture is the complex-plane form of the Simple tab's
cascade: there the two convergents are the ends of a bracket, here they are the
ends of a diameter.

## Engine

`CF.mobiusDisks(key: string, mode: string, maxLevels: number) -> {disks, stopReason}`
where each disk is
`{n, centre: Rat, radius: Rat, radiusStr: string, shrink: Rat|null, shrinkStr: string,
  containsTarget: boolean, loLabel, hiLabel}` — `shrink` is `radiusₙ / radiusₙ₋₁`.

`containsTarget` is computed, not assumed, so a failure would be visible rather
than silent.

## The tab

A seventh tab, **Möbius**, with the Simple tab's constant chips and its four
rounding modes, since the disks are defined for any of them.

- A table: level, centre, radius, shrink factor, and the two convergents at the
  ends of the diameter.
- A **zoom strip**: a grid of up to eight small panels. Panel `k` frames disk `k`
  and draws disk `k+1` inside it at its true relative position and size, so the
  nesting is shown rather than asserted. Where disk `k+1` is smaller than a pixel
  it is drawn at a 1px floor and the panel is labelled with the shrink factor, so
  a dot is never mistaken for a measured size.
- A caption stating the identity: these are the images of the right half-plane, and
  the diameter ends are consecutive convergents.

## Tests

- For every shipped constant and all four modes, each disk contains the target.
- Disks nest: `|centreₙ − centreₙ₋₁| + radiusₙ ≤ radiusₙ₋₁`.
- Radii strictly shrink.
- The diameter ends equal the consecutive convergents of that constant and mode.
- A regression test recording the corrected geometry: the *unit-disk* image
  formula, `radius = 1/||Bₙ₋₁|² − |Bₙ|²|`, does **not** nest for π — kept so the
  wrong construction cannot quietly return.

## Non-goals

- No complex constants (their convergents are not real, so the diameter
  construction does not apply unchanged).
- No animation.
