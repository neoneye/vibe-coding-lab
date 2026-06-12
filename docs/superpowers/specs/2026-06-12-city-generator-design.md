# 2D City Generator — Design

**Date:** 2026-06-12
**Project directory:** `2d-city-generator/`
**Status:** Approved by owner
**Origin:** Faithful port of the owner's C++ brick
`/Users/neoneye/git/opcoders_toolbox/CONTENT/TBEngine/brick_lib/gfx_city.cpp`
(Substrate-inspired crack/street growth; original credits j.tarbell's
Substrate for the algorithm idea).

## Purpose

Resurrect the gfx_city brick as a standalone web page with animated growth:
agents crawl across a grid laying down streets; collisions with
differently-angled streets stop an agent and spawn a new one perpendicular
to a random existing street. Black streets on paper-white.

## Repo conventions followed

- Single self-contained `index.html`; engine + tests in
  `<script id="shared-code">`; `test.mjs` extracts and runs `CityTests.run()`.
- Big-canvas layout (as in `2d-ifs-fractals`): responsive square canvas,
  fixed scrollable right panel, actions on top.
- `screenshot1.png`, `gallery.yaml`, `build_gallery.py`, commits to `main`.

## Engine (shared-code)

`CityEngine` — a stage-by-stage port:

- **PRNG:** `random1(x)` — the same bit-faithful Perlin-style hash as the
  IFS port (`Math.imul` overflow semantics); `random2 = (random1+1)/2`;
  `rand1()/rand2()` consume `this.currentSeed++`.
- **State:** `grid` = `Uint32Array(w*h)`, 10001 = empty, values < 360 = crack
  direction. The Uint32Array deliberately reproduces the C++ uint quirk:
  a negative direction cast into the grid wraps to a huge value and reads
  back as "empty". `pixels` = `Uint8Array(w*h)` (1 = street, for tests and
  rendering). Agents: `{used, x, y, angle}`, capacity = swarm count (min 3).
- **`start(rawParams)`** with the brick's exact remaps:
  - `crackSeed = raw.crackSeed * 1000 + 9298`
  - `iterationSeed = raw.iterationSeed * 10000 + 234234`
  - `iterationNoise = remap(raw.noise, 0,100, 0,2)`
  - cracks: `v = exp(remap(raw.density,0,100,0,4) * ln 8)`;
    `numberOfCracks = floor(w*h*v/(400*400)) + 16`
  - iterations: `v = remap(raw.iterations,0,100,1,5)`;
    `if (v > 0.05) total = floor(10000 * ln(v)/ln(5))` (0 when v ≤ 0.05 —
    matches the C++ float-to-int path; raw default 25 → v=2 → 4306)
  - `initialCrackCount = max(raw.crackCount, 1)`; capacity `max(swarm, 3)`.
  - Clears pixels and grid; seeds `numberOfCracks` cells: per crack
    `currentSeed = (crackSeed + i)*10 + 34`, position `rand2()*(dim-0.9)`
    floored + modulo, direction `int(rand2()*359.1) + rotation, mod 360`;
    the first `initialCrackCount` become live agents (no perpendicular
    adjustment — seeded agents start with the cell's direction, as in C++).
    Then `currentSeed = iterationSeed`, `iterationsDone = 0`.
- **`step(n)`**: n iterations; each iteration moves every agent slot once
  (in index order) via `moveAgent`:
  1. unused agent → `restartAgent` and return.
  2. `move(0.42)` along angle (degrees).
  3. wobble: tier by agent index (<2: 5, <4: 4, <8: 3, <16: 2, else 1)
     × iterationNoise; `angle = fmod(angle + rand1()*amount, 360)`
     (fmod semantics: JS `%` matches C `fmodf` for sign).
  4. sample cell = `int(x + rand1()*0.33), int(y + rand1()*0.33)` (C cast =
     `Math.trunc`), tile-mode modulo (positive).
  5. out of bounds → `restartAgent(agent)` + `insertAgent()`. Else:
     `gdir = grid[cell]`; if `gdir > 10000 || abs(gdir - dir) < 5` →
     `grid[cell] = int(dir)` (Uint32Array wrap for negatives); else if
     `abs(gdir - dir) > 2` → `restartAgent` + `insertAgent`.
  6. tile mode: `x = fmod(x, w)`, `y = fmod(y, h)` (JS `%`, can be negative —
     faithful).
  7. plot: `pixels[trunc(y)*w + trunc(x)] = 1` if in bounds (tile-mode
     modulo first).
- **`restartAgent`**: probe up to 1000 random cells for a crack
  (`grid < 360`); not found → agent.used = false. Found →
  `initAgent(agent, x, y, dir)`: `adj = 90 + rand1()*2`;
  `dir += (rand1() < 0 ? adj : -adj)`; `dir = fmod(dir, 360)`;
  `agent.move(0.61)` after init.
- **`insertAgent`**: appends (restarts) a new agent if below capacity.
- **`finish()`**: steps until `iterationsDone === iterationsTotal`.
- Test helpers: `streetPixelCount()`, `agentCount()` (used slots),
  `crackCellCount()` (grid values < 360).

## UI

Grid fixed 640×640, rendered 1:1 into ImageData (white #f4f1ea paper,
near-black streets #1a1a1a), canvas scaled responsively (IFS layout).

- **Actions (top):** Regenerate (new run, same params), Finish (run all
  remaining iterations synchronously), Pause/Resume.
- **Parameters:** Crack seed 0–400 (default 0), Crack rotation −180–180 (0),
  Crack density 0–100 (25), Crack count 0–20 (5), Swarm count 0–100 (25),
  Iterations 0–100 (25), Iteration seed 0–400 (0), Tile checkbox (on),
  Iteration noise 0–100 (0), Speed 1–200 iterations/frame (30).
  Any parameter change restarts generation immediately.
- **Readout:** iterations done / total, live agents, street pixels.

## Testing (`test.mjs` → `CityTests.run()`)

1. **random1 pins** — same three pinned values as the IFS port.
2. **Remaps:** density 25 @640×640 → pinned crack count (computed once and
   pinned); iterations 25 → 4306; iterations 0 → v=1 → ln(1)=0 → 0 total;
   noise 50 → 1.0.
3. **Seeding:** after `start`, `crackCellCount` ≤ numberOfCracks and > 0;
   agentCount == initialCrackCount (capacity permitting); deterministic:
   two engines, same params → identical grids.
4. **Branching:** force a restart via `initAgent` path (engine with one
   seeded crack of known direction; restart an agent) → resulting angle
   differs from the crack direction by 88–92° (mod 360, either side).
5. **Collision:** construct a grid with a vertical crack line of direction
   90 and drive an agent at direction 0 into it → agent restarts and
   agentCount grows by one (capacity permitting).
6. **Tile wrap:** tile mode on, agent stepped past the right edge plots a
   pixel with wrapped x; tile off → leaving the canvas restarts the agent.
7. **Full determinism:** two engines, same params, `finish()` → identical
   `streetPixelCount` and byte-equal pixels.
8. **Progressive equivalence:** `step(100)` ×k to completion equals
   `finish()` in one call (same pixels).

## Out of scope (YAGNI)

- Anti-aliasing (the original's own TODO), watercolor/sand shading,
  variable grid size, image export.
