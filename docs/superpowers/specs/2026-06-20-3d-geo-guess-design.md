# 3D Geo Guess — Design

**Date:** 2026-06-20
**Directory:** `3d-geo-guess/`
**Deliverable:** A single self-contained `index.html` (no CDN, no external runtime deps) plus a `test.mjs` and a one-time data converter.

## Concept

An interactive globe of Earth. Each round the player is shown a country — either its **name** or its **flag** (50/50) — and must guess where that country is by clicking the spot on the globe. The player starts with **3 health points**. A correct guess keeps health and increases score; a wrong guess removes one health. The run is **endless until health reaches 0**, then game over with the final score and a restart.

## Decisions (settled during brainstorming)

1. **Guess mechanic:** Click on the globe + polygon hit-test (option A). The player rotates the globe and clicks a location; correctness is determined against the target country's actual borders.
2. **Prompt:** Random mix — show the country **name OR flag** each round (option C). Flags rendered as emoji (regional-indicator letters from the ISO code); no image assets.
3. **Country set:** All ~195 countries (option A).
4. **Correctness tolerance:** Polygon hit **or** within a small great-circle snap radius (~150 km) of the country (option B). This keeps micro-states (Vatican, Monaco, Nauru) fair without making large countries trivial.

## Architecture & rendering

- One self-contained `index.html`. All logic lives in a single inline `<script type="module">` "shared-code" block so `test.mjs` can import the pure functions.
- The globe is rendered with a **2D canvas orthographic projection** (the classic "globe disk", equivalent to D3's `geoOrthographic`) — not WebGL. This keeps the projection math fully under our control, makes hit-testing exact, and avoids any dependency.
- Interaction: drag to rotate the globe (yaw = longitude rotation `lambda`, pitch = latitude rotation `phi`). Only the front hemisphere of each country is drawn; polygon segments crossing the horizon are clipped.
- Visual layers (back to front): ocean sphere fill, graticule (optional faint lat/long lines), filled country polygons with thin borders, highlighted target country (after a guess), click marker.

## Country data

- A **converter script** `build_data.mjs` (run once, during implementation) downloads **Natural Earth 110m admin-0 countries** (public domain). It simplifies/quantizes coordinates to integers and emits a compact `COUNTRIES` array embedded inline in `index.html`.
- Each country record: `{ name, iso2, rings: [[lon,lat], ...][], centroid: [lon,lat] }`.
  - `rings` is a list of polygon rings (outer rings; holes ignored at this resolution). Multi-polygon countries keep all their parts.
  - `centroid` is precomputed for the fly-to animation and as a fallback prompt anchor.
- Expected inline size: ~150–300 KB. Acceptable for a standalone page.
- **Flags:** `iso2ToEmoji(iso2)` maps a 2-letter ISO code to two Unicode regional-indicator symbols (e.g. `"FR"` → 🇫🇷). No image files.
- **Tolerance:** correctness uses each country's rings plus a ~150 km great-circle snap radius.

> Data dependency: building the embedded dataset requires a one-time network download of Natural Earth during implementation. The shipped `index.html` is fully offline and self-contained.

## Components (logical units)

All pure-logic units live in the shared-code block and are importable by `test.mjs`. The render unit touches the DOM/canvas and is not unit-tested.

- **`projection`**
  - `project(lon, lat, rot) -> {x, y, visible}` — orthographic projection to canvas-normalized coords; `visible` false when the point is on the back hemisphere.
  - `unproject(x, y, rot) -> {lon, lat} | null` — inverse; `null` when the screen point is outside the globe disk.
  - `rot` carries `{lambda, phi}` (and the disk center/radius is applied by the renderer).
- **`geo`**
  - `pointInPolygon(lon, lat, ring) -> bool` — ray-casting point-in-polygon.
  - `greatCircleKm(a, b) -> number` — haversine distance between two `[lon,lat]` points.
  - `distanceToCountryKm(lon, lat, country) -> number` — 0 if inside any ring, else min great-circle distance to the nearest ring vertex/edge (vertex-distance approximation is acceptable at this resolution).
- **`flags`**
  - `iso2ToEmoji(iso2) -> string`.
- **`game`** — state machine independent of rendering.
  - State: `health`, `score`, `target` (current country), `phase` (`'guessing' | 'revealed' | 'over'`).
  - `pickTarget()` — choose a random country and a random prompt mode (`'name' | 'flag'`).
  - `guess(lon, lat) -> { correct, distanceKm }` — evaluates against `distanceToCountryKm(...) <= TOLERANCE_KM`; updates health/score; sets phase to `'revealed'`; sets phase to `'over'` when health hits 0.
  - `next()` — from `'revealed'`, pick a new target and return to `'guessing'`.
  - `restart()` — reset health=3, score=0, pick a new target.
- **`render`** — draws sphere, graticule, countries, target highlight, click marker; runs the fly-to (lerp `rot` toward the target centroid) animation. Not unit-tested.

## UI

- Top bar: prompt (large country **name** text, or large **flag emoji**), 3 hearts (filled/empty), score.
- Center: the globe canvas (drag to rotate).
- After a guess: globe animates to center the target, target highlights, a marker shows where the player clicked, and a result line shows ✓/✗ and the country name (+ distance if wrong). A **Next** button (or click/key) advances.
- On game over: overlay with final score and a **Restart** button.

## Game loop

1. `pickTarget()` → show name or flag.
2. Player rotates/clicks → screen point `unproject`s to `[lon,lat]`.
3. `guess(lon, lat)`: correct if inside the target's rings or within ~150 km.
4. Fly-to + highlight target, drop click marker, show ✓/✗ + name.
5. Correct → keep health, score +1; wrong → health −1. `next()` continues; at 0 health → game over → `restart()`.

## Testing (`test.mjs`, run with `node test.mjs`)

- `project` → `unproject` round-trip returns the original lon/lat (within tolerance) for front-hemisphere points.
- `unproject` returns `null` outside the disk and for back-hemisphere screen points.
- `pointInPolygon` on a known square: inside true, outside false.
- `greatCircleKm` matches known city-pair distances within a small tolerance.
- `iso2ToEmoji('FR') === '🇫🇷'`.
- `game.guess()` correct-guess scenario: clicking inside the target keeps health, score +1, phase `'revealed'`.
- `game.guess()` wrong-guess scenario: clicking far away decrements health; reaching 0 sets phase `'over'`.

## Non-goals (YAGNI)

- No WebGL / textured Earth imagery.
- No image flag assets.
- No backend, accounts, or persistence (score is per-session).
- No holes/lakes in polygons at this resolution.
- No timed rounds or difficulty levels (endless single mode).

## File layout

```
3d-geo-guess/
  index.html      # self-contained game (shared-code block + UI)
  test.mjs        # node tests of pure logic
  build_data.mjs  # one-time converter: Natural Earth -> embedded COUNTRIES
```
