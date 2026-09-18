# 2D Floor Plan Generator

Date: 2026-09-18
Directory: `2d-floor-plan-generator/`

A standalone page that draws architectural floor plans of absurd buildings:
evil villain mansions, supermax prisons, datacenters, power plants, malls and
bunkers. Nothing is drawn or dragged by hand. Every plan is a pure function of
a seed and a large panel of parameters, so the same inputs always produce the
same drawing. The running joke is the restroom: every plan has toilets with far
too many pissoirs, and a slider can turn that into whole pissoir halls.

Look: white background, black ink, straight lines only, the drafting style of
the reference images (thick poché walls, door swings as quarter arcs, windows as
double lines in the wall, room name over "W × D" dimension text, dimension
strings with tick marks outside the shell, a title block).

## Non-goals

No drawing tools, no drag-and-drop, no 3D, no colour beyond a single grey for
hatching and dimension lines, no server, no external libraries.

## Architecture

One `index.html`, no dependencies. Three layers, in the order they run:

1. **Engine** (`<script id="shared-code">`): PRNG, footprint builder, corridor
   and room subdivision, room-type assignment, furniture placement, door and
   window placement, label generation. Produces a plain-object *plan model*.
   No DOM access, so `test.mjs` can run it in Node.
2. **Renderer** (also in `shared-code`): plan model → SVG markup string.
   Pure string building, so tests can check the output.
3. **UI** (page script): builds the control panel from a declarative
   parameter table, keeps the parameters in the URL hash (and best-effort
   localStorage), regenerates on every input, offers Download SVG / PNG.

### Plan model

```
{
  units: "m", width, depth,          // footprint bounding box in metres
  cell,                              // grid cell in metres
  footprint: [poly],                 // outer polygon, axis-aligned
  holes: [poly],                     // courtyards
  rooms: [{ id, x, y, w, h, kind, label, sublabel, number, furniture: [...] }],
  corridors: [{ x, y, w, h, deadEnd }],
  walls: [{ x1,y1,x2,y2, thickness, exterior }],
  doors: [{ x, y, w, wallDir, swing, kind }],    // kind: single|double|sliding|blast|secret|cell
  windows: [{ x, y, w, wallDir }],
  furniture: [{ kind, x, y, w, h, rot, n }],    // n = repeat count (pissoirs, racks, cells)
  annotations: { title, subtitle, north, scaleBar, dims: [...] , notes: [...] }
}
```

Coordinates are metres with origin at the shell's top-left. The renderer
multiplies by the scale parameter.

### Generation pipeline

1. **Seed** → sfc32 PRNG. Every random decision draws from it in a fixed
   order, so seed + params is reproducible.
2. **Footprint**: rectangle, L, U, T or courtyard, sized by width/depth, cut on
   the grid. Shell wall polygon.
3. **Corridors**: a spine along the long axis, optionally a loop or a
   cross-grid, width from a slider. Dead-end stubs are added with probability
   from the backrooms sliders.
4. **Room subdivision**: the leftover area is split into wings (rectangles
   touching a corridor). Each wing is recursively split perpendicular to its
   long side until it fits between min and max room area, with an aspect
   tolerance parameter. A "split bias" slider skews toward many small rooms or
   a few large halls.
5. **Room-type assignment**: each building type has a palette of room kinds
   with weights, size preferences (hall / medium / closet) and a mandatory
   list (a datacenter always has a server hall, a prison always has cells).
   Mandatory kinds are assigned to the best-fitting rooms first, the rest by
   weighted draw. Restroom frequency is a slider.
6. **Doors**: every room gets at least one door onto a corridor or a
   neighbouring room, chosen so the door graph is connected (BFS check;
   extra doors from a density slider). Backrooms "doorless" slider removes
   doors afterwards, deliberately breaking connectivity.
7. **Windows**: along exterior walls at a spacing slider, skipped for room
   kinds that should not have them (server hall, vault, cell block). Bunkers
   and datacenters default to few windows.
8. **Furniture**: per room kind, a placement routine draws symbols from a
   small primitive vocabulary (rect, double rect, circle, arc, line array):
   beds, desks, racks in rows, turbines, cell rows, tables with chairs,
   shark tank, escalators. Restrooms get a pissoir wall: N urinals along the
   longest free wall at a spacing slider, stalls on the opposite wall, sinks
   in the remainder. Pissoir mania scales N and converts a share of ordinary
   rooms into "PISSOIR HALL" rooms lined on every wall.
9. **Labels**: room name (uppercase), "W × D" line, optional area and room
   number. A humour slider mixes in sublabels such as "(THE REAL MASTER
   BEDROOM)". Backrooms "label glitch" replaces some labels with "HALLWAY",
   repeated numbers, or nothing.
10. **Annotations**: overall dimension strings on top and right, a north
    arrow, scale bar, title block with sheet name, building type, seed,
    gross area and a "FOR ___ ONLY" subtitle.

### Backrooms sliders

- **Liminality** (0–100): master slider that raises every effect below when
  the individual sliders are at their defaults.
- **Dead ends**: number of corridor stubs that terminate in nothing.
- **Room nesting**: probability a room contains a smaller room with its own
  door, up to three deep.
- **Doorless rooms**: share of rooms whose doors are removed.
- **Repetition**: splits rooms into runs of identical cells with identical
  labels ("HALLWAY 4", "HALLWAY 4", …).
- **Label glitch**: share of labels that become wrong, missing or repeated.
- **Window blackout**: removes windows.

### Parameter panel

Grouped fieldsets. Every control is declared once in a table
`{ id, group, label, type, min, max, step, default, options }` and both the
DOM and the URL-hash serialiser are built from it.

Building: type, footprint shape, width, depth, grid cell, exterior wall,
interior wall, storey label.
Corridors: width, layout (spine / loop / cross / none), branch count.
Rooms: min area, max area, split bias, aspect tolerance, restroom share, big
hall share.
Openings: door width, door density, swings on/off, window spacing, window
width, secret passages (villain mansion).
Furniture: density, symbol detail.
Pissoirs: per restroom, spacing, mania, stalls, sinks.
Backrooms: the seven sliders above.
Annotation: labels, dimensions, room numbers, areas, title block, north
arrow, scale bar, font size, humour, sheet title text.
Style: scale (px/m), line weight, wall fill (solid / hatch / hollow),
dimension line grey, paper margin.
Seed: numeric input, Random, ◀ ▶ step buttons.

Every parameter change regenerates immediately. A "Reset group" link per
fieldset and a "Reset all" button.

### Output

Inline SVG scaled to fit the viewport. Buttons: Download SVG, Download PNG
(rasterised at 2× through a canvas), Copy link (URL with hash), Reset.

## Tests

`FloorPlanTests.run()` in `shared-code`, run by `test.mjs` in Node:

- PRNG: fixed seed gives a known first five values; different seeds differ.
- Determinism: two generations with identical inputs serialise identically.
- Geometry: every room lies inside the footprint and outside holes; no two
  rooms overlap; every room touches a corridor or another room.
- Connectivity: with doorless = 0 the door graph reaches every room from the
  entry.
- Pissoirs: a plan with restroom share 1 has at least one restroom and its
  urinal count matches the slider; mania 1 yields at least one pissoir hall.
- Backrooms: dead-end slider N produces N dead-end corridors when there is
  room; doorless 1 leaves at least one room without doors.
- Renderer: output starts with `<svg`, has balanced `<g>` tags, contains
  every room label, contains no `NaN`.
- Every building type generates without throwing for seeds 1–50 at default
  parameters.

## Files

- `2d-floor-plan-generator/index.html`
- `2d-floor-plan-generator/test.mjs`
- `2d-floor-plan-generator/screenshot1.png`
- `gallery.yaml`: title override "2D Floor Plan Generator".
