# 2D Floor Plan Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone `2d-floor-plan-generator/index.html` that draws deterministic, parameter-driven floor plans of villain mansions, prisons, datacenters, power plants, malls and bunkers, with pissoir-heavy restrooms and backrooms sliders.

**Architecture:** Engine + renderer live in `<script id="shared-code">` (pure JS, no DOM) and produce a plan model, then an SVG string. The page script builds the control panel from a declarative `PARAMS` table, syncs to the URL hash, and inserts the SVG. `test.mjs` extracts the shared block and runs `FloorPlanTests.run()` in Node.

**Tech Stack:** Vanilla JS, inline SVG, no dependencies. Spec: `docs/superpowers/specs/2026-09-18-floor-plan-generator-design.md`.

## Global Constraints

- One self-contained `index.html`; works from `file://`.
- Drawing: white background, black ink, straight axis-aligned lines and circular arcs only. No hand-drawn wobble.
- Same seed + same params → byte-identical SVG.
- Every random draw goes through the single PRNG instance passed down the pipeline.
- Coordinates in metres in the model; the renderer applies `scale` px/m.

---

### Task 1: Scaffold, PRNG, test runner

**Files:** Create `2d-floor-plan-generator/index.html`, `2d-floor-plan-generator/test.mjs`.

**Produces:** `FP.makeRng(seed) → { next(), int(a,b), pick(arr), chance(p), shuffle(arr) }` (sfc32), `FloorPlanTests.run() → boolean`.

- [ ] Write `test.mjs` (copy of `game-snake/test.mjs` with `FloorPlanTests.run()`).
- [ ] Write `index.html` skeleton with an empty shared-code block, `FP` namespace, `FloorPlanTests` with a tiny `assert` helper.
- [ ] Test: `makeRng(42).next()` five values are stable, `makeRng(1)` ≠ `makeRng(2)`, `int(3,7)` stays in range over 1000 draws.
- [ ] Run `node test.mjs`; commit.

### Task 2: Parameter table and defaults

**Produces:** `FP.PARAMS` (array of `{id, group, label, type, min, max, step, def, options}`), `FP.defaults()`, `FP.BUILDINGS` (type → palette, see Task 5).

- [ ] Declare every parameter from the spec's "Parameter panel" section.
- [ ] Test: ids are unique; every `def` lies within `[min,max]`; every select default is in its options.
- [ ] Commit.

### Task 3: Footprint and grid

**Produces:** `FP.buildFootprint(p, rng) → { poly, holes, bbox, cells: Set("x,y") }` for shapes rectangle / L / U / T / courtyard, snapped to `p.cell`.

- [ ] Test: bbox equals width × depth; polygon is closed and axis-aligned; L-shape has one notch; courtyard has exactly one hole inside the polygon.
- [ ] Commit.

### Task 4: Corridors and room subdivision

**Produces:** `FP.layout(p, rng, fp) → { corridors, rooms }` where rooms are `{id,x,y,w,h}` rectangles. Spine corridor along the long axis, optional loop/cross, dead-end stubs, recursive split of the remaining wings with min/max area, aspect tolerance, split bias.

- [ ] Test: no two rooms overlap; every room and corridor lies inside the footprint cells and outside holes; every room touches a corridor or a room; every room area ≥ min area (allow 1 cell tolerance).
- [ ] Test: `deadEnds = 3` gives 3 corridors flagged `deadEnd` on an 80 × 40 plan.
- [ ] Commit.

### Task 5: Room kinds and labels

**Produces:** `FP.assignKinds(p, rng, rooms) → rooms with {kind, label, sublabel, number}`; `FP.BUILDINGS[type] = { title, subtitle, entry, mandatory: [kind…], palette: [{kind, w, size}], funny: {kind: [sublabels]} }`; `FP.KINDS[kind] = { label, windows, furnish }`.

- [ ] Test: for every type at defaults over seeds 1–20, every mandatory kind appears at least once when room count ≥ mandatory count; restroom share 1 → all non-mandatory rooms are restrooms; humour 0 → no sublabels.
- [ ] Test: label glitch 1 → at least one label differs from its kind's default; repetition 1 → at least one run of ≥ 3 identical labels.
- [ ] Commit.

### Task 6: Doors and windows

**Produces:** `FP.placeOpenings(p, rng, model)` fills `doors`, `windows`, `entry`; `FP.doorGraphConnected(model) → boolean`.

- [ ] Test: doorless 0 → connected from the entry; doorless 1 → some room has zero doors; window spacing 1e9 → no windows; server hall / vault / cell kinds never have windows.
- [ ] Commit.

### Task 7: Furniture and pissoirs

**Produces:** `FP.furnish(p, rng, model)` fills `furniture` with `{kind, x, y, w, h, rot, n}` primitives: `urinal`, `stall`, `sink`, `bed`, `desk`, `chair`, `table`, `rack`, `turbine`, `tank`, `cell`, `escalator`, `sofa`, `shelf`, `machine`, `crate`.

- [ ] Test: restroom with pissoirs-per-restroom 12 and a wide enough wall has exactly 12 urinals; mania 1 → at least one room kind `pissoirHall` with urinals on ≥ 2 walls; furniture never leaves its room rectangle.
- [ ] Commit.

### Task 8: SVG renderer

**Produces:** `FP.render(p, model) → string`. Walls as filled polygons or hatched, doors as leaf + quarter arc, windows as double lines, furniture symbols, labels, dimension strings with ticks, north arrow, scale bar, title block.

- [ ] Test: starts with `<svg`; `<g>` open/close counts match; contains every room label; contains no `NaN`; two renders of the same inputs are identical.
- [ ] Commit.

### Task 9: UI

- [ ] Build fieldsets from `FP.PARAMS`; range + number readouts; selects; checkboxes.
- [ ] Seed input with Random / ◀ / ▶; Reset all; Reset group.
- [ ] Regenerate on `input`; write params to `location.hash`; read on load; best-effort localStorage.
- [ ] Download SVG (Blob), Download PNG (Image → canvas 2×), Copy link.
- [ ] Verify in the Browser pane over http (see memory: localStorage over http), all six types, screenshot.
- [ ] Commit.

### Task 10: Gallery and screenshot

- [ ] `gallery.yaml`: `2d-floor-plan-generator: 2D Floor Plan Generator`.
- [ ] Headless Chrome screenshot → `screenshot1.png`; run `python3 build_gallery.py`.
- [ ] Commit.
