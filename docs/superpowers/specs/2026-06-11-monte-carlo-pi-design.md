# Monte Carlo π Estimator — Design

**Date:** 2026-06-11
**Project directory:** `2d-monte-carlo-pi/`
**Status:** Approved by owner

## Purpose

An interactive, standalone HTML page that estimates π by throwing uniform random
points into a square and counting how many land inside an inscribed shape. The
page demonstrates that the classic circle-in-square is not special: any shape
whose area is a known multiple of π works. The user watches the estimate
converge live and can adjust the simulation parameters.

## Repo conventions followed

- Single self-contained `index.html`, no external dependencies, no build step.
- Engine code in a `<script id="shared-code">` block; `test.mjs` extracts that
  block with a regex, evaluates it under Node, and runs the embedded test
  object (same mechanism as `game-snake/`).
- Committed directly to `main`.

## Shapes

All shapes are inscribed in the unit square `[0,1] × [0,1]`. Points are sampled
uniformly in the square; `hits / samples` estimates the shape's area fraction,
which inverts to a π estimate.

| Key | Shape | Area fraction | π estimate from ratio `r` |
|---|---|---|---|
| `circle` | Circle, center (½,½), radius ½ | π/4 | `4r` |
| `quarter` | Quarter circle, center (0,0), radius 1 | π/4 | `4r` |
| `ellipse` | Ellipse, semi-axes ½ × ¼, in full square | π/8 | `8r` |
| `annulus` | Ring, outer R=½, inner r=¼ | 3π/16 | `16r/3` |

Note on the ellipse: an ellipse inscribed in its *bounding rectangle* always
covers π/4 of it, independent of aspect ratio — the page states this as the
teaching point. Because our sampling domain is the full unit square (not the
bounding rectangle), the ½ × ¼ ellipse covers π·(½)(¼) = π/8 of the square,
hence the `8r` formula.

Each shape definition is an object:

```js
{ key, label, formula,          // formula: human-readable, e.g. "π ≈ 4 · hits/samples"
  explanation,                  // one-liner: why this shape yields π
  contains(x, y),               // hit test, pure function
  piFromRatio(ratio),           // inverts area fraction to π
  areaFraction,                 // exact value (uses Math.PI), for tests
  draw(ctx, scale) }            // outline rendering
```

`SHAPES` is an array in the shared-code block. UI code never hard-codes shape
math; adding a fifth shape means adding one object.

## Engine

A small `Estimator` class in shared-code:

- `constructor(shape, rng)` — rng injectable for deterministic tests
  (mulberry32 seeded PRNG included in shared-code; UI uses a random seed,
  tests use a fixed seed).
- `step(n)` — sample `n` points, update `samples`, `hits`, return the batch of
  `{x, y, inside}` points for plotting.
- `estimate()` — current π estimate (NaN-safe when samples = 0).
- `reset()`.

## UI

Two-panel layout (stacks vertically on narrow screens):

- **Canvas panel:** square canvas; shape outline drawn on top; each sampled
  point plotted as a small dot, green inside / red outside. Points accumulate
  visually (canvas is not cleared between batches); reset clears it.
- **Control & readout panel:**
  - Shape selector (radio buttons or segmented control) with the shape's
    formula and explanation shown beneath.
  - Speed slider: points per animation frame (1 … 10 000, log-ish steps).
  - Point size slider (1–4 px).
  - Pause/Resume and Reset buttons. Switching shape implies reset.
  - Live readout: samples, hits, π estimate (6 decimals), absolute error vs
    `Math.PI`.
  - Convergence chart: small canvas plotting running estimate vs sample count
    on a log-x axis, with a horizontal reference line at true π. Estimate
    recorded at geometrically spaced sample checkpoints to keep the series
    small.

Animation via `requestAnimationFrame`; no Web Worker (sampling at ≤10k points
per frame is cheap).

## Testing (`test.mjs`)

Embedded `PiTests.run()` in shared-code, executed by `test.mjs` under Node:

1. **Geometry sanity:** for each shape, known inside/outside probe points.
2. **Area fraction:** for each shape, 200k seeded samples → empirical fraction
   within 0.01 of `areaFraction`.
3. **Inversion:** `piFromRatio(areaFraction)` ≈ π exactly (algebraic check).
4. **Convergence:** estimator with fixed seed reaches |estimate − π| < 0.05
   at 200k samples for every shape.
5. **Determinism:** two estimators with the same seed produce identical counts.

## Out of scope (YAGNI)

- Buffon's needle (different mechanism; possible future project).
- Web Worker sampling, CSV export, URL-encoded state.
