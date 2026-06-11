# 2D Slime Mold — Interaction Tools Design

**Date:** 2026-06-11
**Project directory:** `2d-slime-mold/` (iteration on existing project)
**Status:** Approved by owner
**Prior spec:** `2026-06-11-slime-mold-design.md`

## Purpose

The original click-to-feed interaction gives poor feedback (hard to tell
whether a click added or removed food) and offers no other ways to play with
the colony. This iteration adds a three-tool palette with clear visual
feedback:

1. **Food** (default) — improved add/remove with hover affordances and
   confirmation animations.
2. **Drag** — a brush circle that physically drags everything inside it
   (trail, agents, food) across the canvas.
3. **Slime** — paints fresh agents into the simulation.

## Engine additions (shared-code, tested)

```js
// Spawn `count` new agents uniformly inside the disk (cx, cy, radius) with
// random headings. Also deposits params.deposit at each spawn cell (clamped)
// so painting is visible immediately, even while paused.
// Returns the new agent count.
addAgents(cx, cy, radius, count)

// Translate trail mass, agents, and food sources whose position lies within
// the disk (cx, cy, radius) by (dx, dy), wrapping toroidally.
// Trail: gather all disk cells into a list, zero them, scatter-add each
// value into the wrapped destination cell (clamped to TRAIL_CLAMP).
// Agents/food: Euclidean distance test (no wrap on the membership test),
// wrapped destination coordinates.
translateRegion(cx, cy, radius, dx, dy)
```

Disk sampling for `addAgents`: `r = radius * sqrt(rng())`, `theta = rng() * 2π`
(uniform over the disk), positions wrapped into the grid.

## UI changes

**Tool palette.** New "Tool" fieldset (top of the controls column) with three
toggle buttons: Food / Drag / Slime. Exactly one active (visually
highlighted). The hint line under the canvas changes per tool:

- Food: "Click: add food · click a highlighted ring: remove it"
- Drag: "Drag to move trail, agents and food inside the circle"
- Slime: "Click or drag to paint fresh slime"

**Brush size slider.** In the Tool fieldset: 8–60 grid cells, default 24.
Always visible; only the Drag and Slime tools read it.

**Render-loop restructure.** `frame()` always calls `render()` and
`updateReadout()`; `engine.step()` runs only when not paused. Transient
effects and cursor overlays advance every frame, so all tool feedback works
while paused.

**Food tool feedback:**

- Food sources render as a filled bright dot (radius ~4 px) plus the existing
  ring — visible against bright trails.
- Hover: if the cursor is within the removal radius (6 grid cells) of a food,
  that food's ring renders red and slightly larger (signals "click removes").
  Otherwise a faint ghost ring renders at the cursor (signals "click adds").
- On add: push effect `{type:"add", x, y, age:0}` — expanding white ring,
  fading over ~25 frames.
- On remove: effect `{type:"remove", x, y, age:0}` — shrinking red ring,
  fading over ~25 frames.
- Effects stored in an array, aged each frame, removed when expired.

**Drag tool.** Pointer events (`pointerdown`/`pointermove`/`pointerup`):
while down, each move computes the cursor delta in grid coordinates and calls
`engine.translateRegion(prevX, prevY, brushRadius, dx, dy)` with the previous
cursor position as the disk center, then updates the stored position. The
brush circle renders at the cursor whenever the Drag or Slime tool is active
(white at rest, accent-colored while dragging/painting).

**Slime tool.** On `pointerdown` and each `pointermove` while down:
`engine.addAgents(x, y, brushRadius, 150)`, capped so the total never exceeds
80 000 (the Agents slider max). After painting, the Agents slider value and
readout sync to the actual count.

**Mouse tracking.** `pointermove` updates a `cursor {x, y, inside}` state used
for hover highlights and brush rendering; `pointerleave` clears it.

## Testing (additions to `SlimeTests.run()`)

1. **addAgents:** count grows by requested amount; all new agents lie within
   `radius` of the center (center placed mid-grid, no wrap); headings in
   [0, 2π); trail mass increases (immediate deposit); return value equals new
   count.
2. **translateRegion — trail:** stamp a small blob, translate; total mass
   conserved (±1e-3); destination region holds the mass; source region is
   empty.
3. **translateRegion — agents:** agent inside the disk moves by exactly
   (dx, dy); agent outside is untouched; moved coordinates stay in bounds.
4. **translateRegion — food:** food inside moves by (dx, dy); food outside
   does not.
5. **translateRegion — wrap:** translating a blob across the right edge lands
   its mass at the wrapped x coordinates, mass conserved.

UI feedback (hover rings, pulses, brush circle) is verified by screenshot,
not unit tests.

## Out of scope (YAGNI)

- Undo, multi-touch, keyboard shortcuts for tools.
- Eraser tool (drag + decay already removes effectively).
- Per-tool brush sizes.
