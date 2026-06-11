# 2D Cloud Chamber — Smoke Layer Design

**Date:** 2026-06-12
**Project directory:** `2d-cloud-chamber/` (iteration)
**Status:** Approved by owner
**Prior spec:** `2026-06-11-cloud-chamber-design.md`

## Purpose

The chamber's tracks are crisp but the atmosphere is thin — a static mist
speckle and nothing else. This iteration adds a billowing smoke layer: every
track sheds vapor that drifts, curls, and slowly dissipates through an
animated flow field, with four user-facing parameters.

## Architecture

A second Float32Array `smoke` (same 480×480 grid) lives beside the track
`field`. The two layers have independent dynamics and are composited at
render time:

- **field** (existing): crisp tracks; mild diffusion, fast decay. Unchanged
  except that mist no longer feeds it.
- **smoke** (new): fed by track deposits and mist; advected by a swirl flow;
  heavy blur; slow decay.

## Engine changes

New engine state: `smoke`, `smokeTmp` (Float32Array W×H), `tick` (int,
incremented once per `step()` — the flow animates off it, never wall clock).

New params (defaults): `smokeAmount 0.35`, `swirl 0.6`, `smokeDecay 0.985`,
`smokeDiffusion 0.5`. SMOKE_CLAMP = 4.0.

1. **Feeding.** `_deposit(x, y, amount)` additionally adds
   `amount * params.smokeAmount` to the smoke cell (clamped at SMOKE_CLAMP).
   The mist loop in `step()` deposits into **smoke** (amount 0.05/cell as
   before) instead of the track field.
2. **Flow field.** Deterministic function of position and `tick`:
   ```js
   _flow(x, y) {
     const s = this.params.swirl, t = this.tick;
     return {
       vx: s * (Math.sin(y * 0.013 + t * 0.011) + 0.5 * Math.sin((x + y) * 0.021 - t * 0.017)),
       vy: s * (Math.cos(x * 0.011 - t * 0.013) + 0.5 * Math.cos((x - y) * 0.019 + t * 0.019) + 0.35),
     };
   }
   ```
   The `+ 0.35` bias is a gentle downdraft (vapor falls in a real chamber).
   With swirl = 0 the flow is exactly zero everywhere.
3. **Advection.** `_advectSmoke()`: semi-Lagrangian — for each cell, sample
   `smoke` at `(x - vx, y - vy)` with bilinear interpolation, clamping sample
   coordinates to the grid interior. With zero velocity this is exactly the
   identity (integer-coordinate bilinear sampling).
4. **Order in `step()`:** events/sources fire (deposits feed both layers) →
   mist into smoke → `_advectSmoke()` → smoke blur+decay (reuse the box-blur
   shape with `smokeDiffusion`/`smokeDecay`) → existing `_diffuseAndDecay()`
   for the track field. `tick++`.
5. `smokeMass()` test helper, mirroring `fieldMass()`.
6. "Clear chamber" clears both layers.

## Rendering

Single composite loop: track value through the existing white LUT; smoke
value (normalized by SMOKE_CLAMP, gamma 0.6) through a soft blue-grey tint
`(95, 115, 150)`; per-channel sum clamped by Uint8ClampedArray assignment.
Smoke renders under everything (it is added, so bright tracks stay white).

## UI

New "Smoke" fieldset between "Chamber" and "State":

- Amount: 0–1, step 0.05, default 0.35 (`smokeAmount`)
- Swirl: 0–2, step 0.05, default 0.6 (`swirl`)
- Fade: 0.95–0.999, step 0.001, default 0.985 (`smokeDecay`)
- Softness: 0–1, step 0.05, default 0.5 (`smokeDiffusion`)

The existing Mist slider stays in "Chamber" (it now feeds the smoke layer).
"Clear chamber" zeroes both fields.

## Testing (additions to `ChamberTests.run()`)

1. **Feeding:** an alpha fired with smokeAmount 0.5 yields smokeMass > 0;
   with smokeAmount 0 yields smokeMass = 0; mass scales (0.5 run > 0.1 run,
   same seed).
2. **Mist feeds smoke:** rates 0, mist 100 → after one step smokeMass > 0 and
   fieldMass = 0. The existing "step: mist deposits" test changes accordingly:
   it now asserts the ~5.0 mass lands in `smokeMass()` (with smokeDecay 1,
   swirl 0, smokeDiffusion 0) and that `fieldMass()` stays 0.
3. **Identity at swirl 0:** seed the smoke field, swirl 0, smokeDiffusion 0,
   smokeDecay 1, mist 0, rates 0 → one step leaves smokeMass and a probe
   cell exactly unchanged.
4. **Advection moves smoke:** stamp a blob, swirl 1.5, smokeDiffusion 0,
   smokeDecay 1 → after 10 steps the smoke centroid has moved by ≥ 2 cells
   (downdraft guarantees net motion).
5. **Smoke decay:** swirl 0, smokeDecay 0.9, smokeDiffusion 0 → mass ×0.9
   per step (±1e-2 relative).
6. **Determinism:** two engines, same seed, source + 30 steps → identical
   smokeMass.

## Out of scope (YAGNI)

- Vorticity confinement / Navier-Stokes solver, WebGL, per-particle smoke
  colors, wind direction control.
