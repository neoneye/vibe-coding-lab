# 2D Slime Mold (Physarum) — Design

**Date:** 2026-06-11
**Project directory:** `2d-slime-mold/`
**Status:** Approved by owner

## Purpose

An interactive Physarum polycephalum simulation (Jeff Jones agent model):
tens of thousands of agents deposit and follow pheromone trails, producing
emergent organic transport networks. Two experiences in one engine:

1. **Free-roam:** agents self-organize into evolving patterns; parameter
   sliders and presets explore distinct morphologies.
2. **Food mode:** clicking the canvas drops food sources that continuously
   emit pheromone; the mold grows and prunes networks connecting them — a
   living companion piece to `2d-shortest-path`.

## Repo conventions followed

- Single self-contained `index.html`, no dependencies, no build step.
- Engine in `<script id="shared-code">`; `test.mjs` extracts the block with a
  regex and runs the embedded test object under Node (`game-snake` pattern).
- Seeded PRNG (mulberry32) for deterministic tests.
- `screenshot1.png` + `gallery.yaml` override + `build_gallery.py` at the end.
- Committed directly to `main`.

## Algorithm (Jones 2010)

Per `step()`, for each agent (x, y, heading), on a toroidal W×H trail grid:

1. **Sense:** sample trail at three points: `heading` and `heading ± sensorAngle`,
   each at `sensorDistance` cells ahead.
2. **Turn:** toward the strongest sample. If forward is strongest, go straight.
   If both sides beat forward equally-ambiguously (left and right both greater
   than forward), turn randomly left or right. Turn amount = `turnAngle`.
3. **Move:** advance `stepSize` cells along heading, wrapping toroidally.
4. **Deposit:** add `deposit` to the trail cell under the agent.

Then `diffuseAndDecay()`: each cell becomes
`lerp(cell, boxBlur3x3(cell), diffusion) * decay`.

Food sources stamp pheromone each frame (see Food). Agents are attracted to
food through the same sensing mechanism — no special-case steering.

## Engine API (shared-code)

```js
class SlimeEngine {
  // opts: { width, height, agentCount, rng,
  //         sensorAngle, sensorDistance, turnAngle, stepSize,
  //         deposit, decay, diffusion, foodDeposit, foodRadius }
  constructor(opts)
  reset()                  // re-scatter agents (random pos+heading), clear trail
  setAgentCount(n)         // grow/shrink agent arrays, preserving existing agents
  step()                   // sense/turn/move/deposit for all agents, then food stamp, then diffuseAndDecay
  addFood(x, y)            // append food source (grid coords)
  removeFoodNear(x, y, r)  // remove nearest food within r; returns true if removed
  clearFood()
  trailMass()              // sum of trail values (test helper)
  // exposed state: trail (Float32Array W*H), agents (Float32Array n*3),
  //                foods (array of {x, y}), width, height, params
}
```

- Agents stored flat: `agents[i*3] = x, [i*3+1] = y, [i*3+2] = heading`.
- All randomness via injected `rng` (mulberry32). UI seeds randomly; tests fix seeds.
- Parameters are plain mutable fields on `engine.params` so sliders apply live.
- Food stamping: each food source adds `foodDeposit` to every cell within
  `foodRadius` (Euclidean) of it, every frame, before diffusion.
- Trail values are clamped to a max (e.g. 5) after deposit/stamp so food
  blobs don't grow unboundedly.

## Defaults and presets

Grid 320×320. Default agent count 30 000 (slider 5 000–80 000).

| Preset | sensorAngle | sensorDist | turnAngle | stepSize | deposit | decay | diffusion |
|---|---|---|---|---|---|---|---|
| Networks (default) | 30° | 9 | 25° | 1.0 | 0.6 | 0.92 | 0.55 |
| Cells | 45° | 18 | 45° | 1.2 | 0.8 | 0.90 | 0.40 |
| Waves | 15° | 25 | 12° | 1.6 | 0.5 | 0.95 | 0.65 |
| Fingerprint | 60° | 4 | 60° | 0.8 | 0.9 | 0.88 | 0.30 |

(Angles stored in radians internally; the table is human-readable. Presets are
a starting point — values may be tuned during implementation when observing
actual output; the spec requirement is four visually distinct presets.)

`foodDeposit` = 0.4, `foodRadius` = 4, trail clamp = 5.0 for all presets.

## UI

Layout mirrors `2d-monte-carlo-pi`: canvas panel left, controls right,
stacking on narrow screens.

- **Canvas:** display canvas 640×640 CSS px; the 320×320 trail rendered via an
  offscreen `ImageData` canvas drawn scaled with `imageSmoothingEnabled = true`.
  Click = add food at that grid cell; click within 6 grid cells of an existing
  food = remove it instead. Food drawn as bright rings.
- **Presets:** dropdown with the four presets; selecting one sets all sliders.
- **Sliders:** agent count, sensor angle (5–90°), sensor distance (1–30),
  turn angle (5–90°), step size (0.2–2.5), deposit (0.1–1.5),
  decay (0.80–0.99), diffusion (0–1). Live-applied; agent count applies via
  `setAgentCount` without resetting the trail.
- **Buttons:** Pause/Resume, Reset (re-scatter agents, clear trail, keep food),
  Clear food.
- **Palette selector:** three ramps — Amber (black → deep orange → gold →
  white), Cyan (black → teal → cyan → white), Mono (black → white).
- **Readout:** agent count, food count, simulation steps.

Rendering maps `trail[i]` through a precomputed 256-entry palette lookup
(value normalized by the trail clamp, gamma ≈ 0.45 so faint trails are visible).

## Testing (`test.mjs` → `SlimeTests.run()`)

Deterministic via mulberry32. Small grids for speed.

1. **Init:** requested agent count allocated; all agents within bounds;
   headings in [0, 2π).
2. **Wrap:** an agent stepped past an edge reappears on the opposite side.
3. **Mass dynamics:** with decay = 1, diffusion = 0, one step of n agents adds
   exactly n × deposit to trail mass; with decay = 0.9 and no agents
   (agentCount 0), mass shrinks by ×0.9 per step.
4. **Diffusion conserves mass:** decay = 1, diffusion = 1, no agents: total
   mass before ≈ after (within 1e-3 relative) on a wrapped grid.
5. **Steering:** stamp a strong horizontal trail line; release agents near it
   heading roughly parallel; after 50 steps, mean distance to the line is
   well below that of a control run with sensing disabled (sensorDistance 0).
6. **Food:** `addFood` then one step raises mass by at least the stamped
   amount (before decay); `removeFoodNear` removes; `clearFood` empties.
7. **Determinism:** two engines with equal seeds have identical trail mass and
   first-agent position after 20 steps.
8. **Clamp:** trail values never exceed the clamp after many steps on a tiny
   grid with huge deposit.

## Out of scope (YAGNI)

- WebGL/GPU simulation, Web Workers.
- Multiple species / competing pheromones.
- Image-based food maps, preset food layouts (e.g. Tokyo).
- Recording, GIF/CSV export.
