# 2D Cloud Chamber — Design

**Date:** 2026-06-11
**Project directory:** `2d-cloud-chamber/`
**Status:** Approved by owner

## Purpose

A simulated diffusion cloud chamber: charged particles cross a supersaturated
vapor layer and leave ionization trails that condense into bright droplet
tracks, linger, soften, and fade. The ambient zoo (alphas, betas, cosmic
muons) plays continuously; the user can curve tracks with a magnetic field
and click to place radioactive specks that spray particles.

## Repo conventions followed

- Single self-contained `index.html`, no dependencies.
- Engine in `<script id="shared-code">`; `test.mjs` extracts and runs the
  embedded `ChamberTests.run()` under Node (same as `2d-slime-mold/`).
- Seeded mulberry32 PRNG injected for deterministic tests.
- `screenshot1.png` + `gallery.yaml` + `build_gallery.py`; commits to `main`.

## Architecture

Droplet-field model (same skeleton as the slime mold's trail field):
a Float32Array `field` (480×480) holds condensation density. Particle events
deposit into it instantly (particles cross at near light speed; only the
trail lingers); each frame the field diffuses slightly and decays. Rendering
maps the field through a monochrome vapor palette (black → faint blue-grey →
white) into ImageData scaled to a 640×640 canvas. No toroidal wrap — tracks
leave the chamber at the walls (deposits outside bounds are discarded).

## Track integration

One integrator serves all particle types. A particle has position (x, y),
heading θ, energy E, and a type definition:

| Type | E₀ (random) | deposit/step | scatter (rad/step) | B response | thickness |
|---|---|---|---|---|---|
| alpha | 30–50 | 2.0 + braggGain/E (capped at 5) | 0.012 | weak (p ∝ E, heavy) | 3×3 blob |
| beta | 4–40 | 0.55 | 0.05 + 0.35/√E | strong | 1 cell |
| muon | 1500–2500 | 0.7 | 0.002 | negligible (huge p) | 1 cell |

Per step (ds = 1 cell):

1. Deposit `deposit(E)` at the current cell (alpha: into its 3×3 blob with
   reduced edge weights), with ±0.5 cell lateral jitter for droplet texture.
2. Scatter: θ += gaussian-ish kick `(rng()*2-1) * scatter(E)`.
3. Magnetic curvature: θ += `B * CHARGE_SIGN / p` with p = E·typeMomentumScale
   (alpha momentumScale 50, beta 1, muon 1 — so betas curve hard, muons
   barely, alphas slightly). B slider range 0–3.
4. Move: x += cos θ, y += sin θ. Stop when E ≤ 0.5 or position leaves bounds.
5. Energy loss: E −= stoppingPower (alpha 0.55/step — short range with Bragg
   brightening as E→0; beta 0.04; muon 0.4 — crosses the whole chamber).
6. Delta rays: alpha and muon tracks spawn a knock-on electron with
   probability `params.deltaProb` (default 0.004) per step: a beta fired from
   the current position at θ ± ~90° with E 2–8. Recursion depth 1 (deltas
   don't spawn deltas) — enforced by an internal flag.

`fireParticle(type, x, y, theta, E)` runs the integration immediately and
returns `{steps, pathLength, endX, endY, deposited}` for tests. E optional
(random in the type's range when omitted).

## Ambient events and sources

`step()` each frame (assume 60 fps; dt fixed at 1/60 s):

1. For each type, fire an ambient event with probability `rate * dt`
   (rates in events/sec from sliders). Spawn positions:
   - alpha, beta: random interior point, random direction.
   - muon: random point on a chamber edge, direction aimed across the
     chamber (perpendicular-to-edge ± 60°).
2. Each placed source fires alphas with probability `sourceRate * dt` per
   source (and a beta instead 10% of the time), random direction from the
   speck position.
3. Mist: deposit 0.05 at `params.mist` random cells (slider 0–200, default 60)
   — faint ambient shimmer.
4. `diffuseAndDecay()`: 3×3 box blur blended by `diffusion` (default 0.15),
   multiplied by `decay` (default 0.965). Non-wrapping (edges clamp).
5. Field values clamp at FIELD_CLAMP = 4.0 on deposit.

Sources: `addSource(x, y)`, `removeSourceNear(x, y, r)` (nearest within r,
returns boolean), `clearSources()`; stored as `{x, y}` list.

## Engine API summary

```js
class ChamberEngine {
  constructor({ width, height, rng, params })  // params override defaults
  // params: { bField, alphaRate, betaRate, muonRate, sourceRate,
  //           decay, diffusion, mist, deltaProb }
  step()
  fireParticle(type, x, y, theta, E)   // -> {steps, pathLength, endX, endY, deposited,
                                       //     braggFirstQ, braggLastQ, maxExcursion}
  addSource(x, y); removeSourceNear(x, y, r); clearSources()
  fieldMass()
  // state: field (Float32Array), sources, width, height, params, events (count)
}
```

Defaults: bField 0, alphaRate 0.4, betaRate 0.5, muonRate 0.3, sourceRate 6,
decay 0.965, diffusion 0.15, mist 60, deltaProb 0.004.

## UI

Layout mirrors the sibling projects (canvas panel left, controls right).

- **Canvas:** 640×640. Click = place source (ghost ring at cursor); click
  within 6 grid cells of a source = remove it (red hover highlight on the
  source, slime-mold feedback language); add/remove confirmation pulses.
  Sources drawn as small bright dots with a thin ring.
- **Sliders:** Alphas /s (0–5, default 0.4), Betas /s (0–5, default 0.5),
  Muons /s (0–5, default 0.3), Magnetic field (0–3, default 0), Source
  activity /s (0–20, default 6), Fade (decay 0.90–0.995, default 0.965),
  Mist (0–200, default 60).
- **Buttons:** Pause/Resume, Clear chamber (field to zero), Clear sources.
- **Readout:** total events, sources, current B.
- Render loop always renders; `engine.step()` only when running (slime-mold
  pattern). Gamma ≈ 0.5 in the palette mapping so faint old tracks stay
  visible.

## Testing (`test.mjs` → `ChamberTests.run()`)

Deterministic (mulberry32), small grids where possible.

1. **Alpha range & straightness:** fired mid-chamber: pathLength within
   [40, 110]; end-to-end distance / pathLength > 0.95; deposited mass > a
   beta's of comparable length.
2. **Bragg peak:** record per-step deposits (engine exposes them via the
   fireParticle return or recomputed from field along a B=0, jitter-irrelevant
   straight track): mean deposit over the final 25% of steps > mean over the
   first 25% × 1.5. (Implementation may track sums internally and return
   `braggFirstQ`/`braggLastQ` in the fireParticle result.)
3. **Beta spirals under B:** with B = 0 a beta of E=30 ends far from its
   start (≥ 60 cells); with B = 2.5 the same seed ends within 40 cells and
   its maximum excursion from start is smaller than the B=0 case.
4. **Muon straightness:** end-to-end / pathLength > 0.99 and pathLength ≥
   chamber width × 0.9 when fired horizontally from the left edge.
5. **Delta rays:** with deltaProb 1 a muon deposits strictly more mass than
   with deltaProb 0 (same seed).
6. **Field dynamics:** decay shrinks mass by ×decay (no events, mist 0);
   deposits clamp at FIELD_CLAMP; out-of-bounds integration stops (a particle
   fired at a wall outward takes ≤ 2 steps).
7. **Sources:** addSource then steps with sourceRate high → mass grows and
   events counter increments; removeSourceNear and clearSources behave.
8. **Determinism:** two engines, same seed, 30 steps with a source → equal
   fieldMass and events count.

## Out of scope (YAGNI)

- Positrons / pair production, animated track growth, sound, WebGL,
  palettes, recording.
