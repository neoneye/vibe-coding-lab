# Eiffel Tower Assembly — Design

**Date:** 2026-09-02
**Directory:** `3d-eiffel-tower-assembly/`
**Deliverable:** One `index.html` (Three.js r170 from jsdelivr via importmap, same as `3d-shadows/`; everything else inline), a `test.mjs` that runs the shared-code tests in Node, a `screenshot1.jpg`, and a `gallery.yaml` title override.

## Purpose

Show the Eiffel Tower being assembled in 3D, from the foundation pits of January 1887 to the flag on the top in March 1889. The viewer scrubs a timeline to watch it rise, moves the camera freely, and switches the weather between sunny, rainy and windy.

## Approaches considered

1. **Three.js with a procedural lattice built from instanced struts** (chosen). Thousands of struts in one `InstancedMesh`, so hiding/animating pieces is a per-instance matrix update. Matches how `3d-shadows` and the tetris game load Three.js.
2. Custom WebGL2 renderer, no library. Fully self-contained, but shadows, fog and instancing would cost several hundred lines that Three.js gives for free.
3. A hand-modelled mesh loaded from an embedded glTF. Looks best, but the assembly needs each strut as a separate piece with a build height, which a monolithic mesh cannot give.

## Tower model (pure logic in `<script id="shared-code">`, object `Eiffel`)

Units are metres; the world origin is the tower axis at ground level, Y up.

- **Profile.** `Eiffel.halfWidth(h)` gives the distance from the axis to a leg centre at height `h`, by monotone cubic interpolation through `(0, 50)`, `(57, 32)`, `(115, 17)`, `(180, 11)`, `(276, 6)`, `(300, 4)`. The real tower has 125 m between pillar outer edges at the ground, a 57.6 m first floor, a 115.7 m second floor and a 276 m third floor.
- **Leg cross-section.** Below the second floor each of the four legs is a square lattice of side `Eiffel.legSide(h)` (15 m at the ground, 7 m at the second floor). Above the second floor the four legs have merged into one square tower whose corner rails sit at `±halfWidth(h)`.
- **Pieces.** `Eiffel.buildPieces()` returns an array of struts `{a:[x,y,z], b:[x,y,z], r, kind, h}`: `a`/`b` endpoints, `r` half-thickness, `kind` in `rail | brace | ring | deck | arch | pit | mast`, and `h` the build height (mid-height of the strut, except foundations, which get negative build heights so they appear first). Struts are generated per height segment: four corner rails, an X-brace on each face, and a horizontal ring. Decks at 57, 115 and 276 m are flat slabs with railings. Decorative arches (radius ~ 40 m) hang between adjacent legs under the first floor. A lantern and mast sit on top up to 300 m, with a flag at 312 m.
- **Schedule.** `Eiffel.schedule` is a list of `{t, date, height, label}` milestones; `Eiffel.stateAt(t)` (t in 0..1) linearly interpolates height and picks the label:

  | t | date | height | label |
  |---|------|--------|-------|
  | 0.00 | 1887-01-28 | −6 (foundation pits) | Digging the foundations |
  | 0.18 | 1887-06-30 | 0 | Masonry piers finished |
  | 0.20 | 1887-07-01 | 1 | First iron goes up |
  | 0.42 | 1887-12-07 | 28 | Legs lean outward on timber scaffolds |
  | 0.55 | 1888-03-26 | 58 | Legs joined at the first floor |
  | 0.72 | 1888-08-14 | 116 | Second floor reached |
  | 0.88 | 1888-12-26 | 200 | Creeper cranes climb the single tower |
  | 0.97 | 1889-03-15 | 300 | Top reached |
  | 1.00 | 1889-03-31 | 320 (past the flag, so the last pieces finish animating) | Flag raised — 2 years, 2 months, 5 days |

  A piece is complete when `h < height − band`, animating (scaled in and lowered from above) when within the `band` (6 m), otherwise absent. Foundation pits, timber scaffolds under the legs (visible for `28 ≤ height < 62`) and four creeper cranes riding at the current frontier are scenery driven by the same height.
- **Tests.** `EiffelTests.run()` checks: `halfWidth` is monotone decreasing and hits the anchors; every piece has finite coordinates, `r > 0` and `h` inside `[−8, 315]`; piece heights are non-decreasing after sort; `stateAt(0)` and `stateAt(1)` match the schedule ends; `stateAt` is monotone in height; pieces count is between 2 000 and 20 000.

## Page (full-screen canvas, dark control panel top-left like `3d-shadows`)

**Timeline card.** Range slider 0..1 (step 0.001), play/pause button, speed select (30 s, 1 min, 3 min per full build), a date readout and the milestone label, and a progress readout of height in metres and piece count.

**Camera card.** Sliders: azimuth (−180..180°), elevation (−5..85°), distance (60..900 m), target height (0..320 m), field of view (20..90°). Auto-orbit checkbox with speed. Presets: *Champ de Mars* (ground, looking up), *Aerial*, *First floor*, *Under the arches*, *Follow the top* (target height tracks the build frontier). Mouse drag orbits, wheel zooms, both write back into the sliders.

**Weather card.** Radio: sunny / rainy / windy, plus intensity slider (0..1) and wind direction slider (0..360°).
- *Sunny:* clear blue sky gradient, warm directional sun with shadow map, sun elevation slider, light fog at 3 km.
- *Rainy:* grey sky, dense fog, dim cool light, no shadows, a rain volume of line-segment streaks (count scaled by intensity) falling around the tower and drifting with the wind, darker wet ground.
- *Windy:* streaky clouds sliding across the sky, dust and leaf particles streaming horizontally, the top flag and the crane pennants whipping, and a sway of the tower of a few decimetres times intensity (exaggerated on purpose, and the card says so).

**Scene.** Green Champ de Mars plane with the Seine as a blue band along the north side, the four masonry piers, and the tower itself. Ground receives shadows in sunny weather.

## Rendering plan

- One `InstancedMesh` of a unit box for all struts; per-piece matrix from endpoints (`lookAt`-style basis), plus a scale factor for the build animation. Colour per kind via `instanceColor` (iron: brown-red "Venetian red" like the 1889 paint; decks: dark; pits: stone).
- Timeline updates only recompute matrices for pieces whose state changed since the last frame (track a `visibleCount` cursor because pieces are height-sorted; the animating band is the only region rewritten every frame).
- Rain: `LineSegments` with a fixed pool of 6 000 segments; per-frame vertical shift in the vertex buffer. Wind particles: `Points`. Clouds: a few large translucent planes on a dome.
- HiDPI: renderer pixel ratio capped at 2.

## Testing and verification

- `node test.mjs` runs `EiffelTests`.
- Headless Chrome smoke test with `--use-angle=swiftshader` loads the page, advances the timeline via the `window.__eiffel` debug handle, and checks that the canvas is non-blank and there are no console errors.
- Screenshot taken at t ≈ 0.6 (legs just joined, cranes on the first floor) in sunny weather for the gallery.
