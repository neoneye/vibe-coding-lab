# 3D Game of Life (cubes and tetrahedrons)

Date: 2026-10-11
Directory: `3d-game-of-life/`

## Goal

Conway's Game of Life in three dimensions, on a wrap-around voxel world, with
two lattices: one made of cubes and one made of tetrahedrons. The user picks a
rule set and a neighbourhood size. A 3×3 neighbourhood is the classic
immediate-neighbour reach (a 3×3×3 voxel block), and 5×5 reaches two voxels out
(a 5×5×5 block). It is a sandbox to watch, orbit and reseed. There is no score.

## Owner decisions (settled in brainstorming)

- **Two lattice modes**, not a mixed world. Cube mode has one cell per voxel.
  Tetra mode splits every voxel into 6 tetrahedra (Kuhn triangulation), which
  tiles space and wraps cleanly.
- **Box neighbourhoods in both modes.** A cell's neighbours are every cell
  whose voxel lies in the 3×3×3 (radius 1) or 5×5×5 (radius 2) block around
  the cell's own voxel, minus the cell itself. Neighbour counts:

  | lattice | 3×3 | 5×5 |
  |---------|-----|-----|
  | cube    | 26  | 124 |
  | tetra   | 161 | 749 |

- **Generations rules.** The notation is `S/B/C`. C = 2 is classic
  alive/dead. C > 2 adds decay states that cells fade through after they die.

## Constraints

- One self-contained `index.html`, plus `test.mjs`, `search.mjs` and later
  `screenshot1.jpg`.
- three.js 0.160.0 and OrbitControls come from jsdelivr through an import map,
  as in `3d-voxel-cave`. There are no other dependencies.
- Pure logic lives in `<script id="shared-code">` with a `GolTests.run()`
  runner. `test.mjs` extracts that block by regex and runs it in Node. The
  block must not touch the DOM or three.js.
- Canvas backing store is sized in device pixels (retina Mac).

## Engine (shared-code)

### World

- Grid size N³, with N ∈ {24, 32, 48, 64}. Every axis wraps, so the world is a
  3-torus. N ≥ 2r+1 always holds, so a box never overlaps itself across the
  wrap.
- Voxel index: `v = x + N*(y + N*z)`.
- Cell index: in cube mode `cell = v`; in tetra mode `cell = v*6 + k`, with
  k ∈ 0..5.
- State: a `Uint8Array` with one byte per cell. 0 = dead, 1 = alive, and
  2…C−1 = decaying.

### Tetra lattice (Kuhn / Freudenthal)

Tetrahedron k of a voxel corresponds to permutation `P[k]` of the axes
(x,y,z). Its vertices are a monotone path through the unit cube:

    v0 = (0,0,0)
    v1 = v0 + e[P[k][0]]
    v2 = v1 + e[P[k][1]]
    v3 = (1,1,1)

The 6 tetrahedra have equal volume (1/6), share the main diagonal, and fill
the voxel exactly. Neighbouring voxels' triangulations match face to face.
The engine exports the vertex list so the renderer and the tests use the same
geometry.

### Neighbour counting

Only cells in state 1 count as neighbours.

1. Build a per-voxel value `a[v]`. In cube mode this is 1 if the cell is
   alive, else 0. In tetra mode it is the number of alive tetrahedra in the
   voxel (0..6).
2. Box-sum `a` with radius r and wrap-around, one axis at a time: a sliding
   window along x, then y, then z. This takes O(N³) per axis whatever r is.
   The result goes in a `Uint16Array` (the maximum is 750).
3. `count(cell) = box[voxel(cell)] − (state[cell] == 1 ? 1 : 0)`.

### Rule

The rule string is `S/B/C`. S and B are comma-separated lists of counts or
inclusive ranges (`9-26,5`), and either may be empty. C is an integer ≥ 2.
Whitespace is ignored. Parsing produces two `Uint8Array` lookup tables sized
`maxCount+1` for the current lattice and neighbourhood. If an entry exceeds
`maxCount`, or the string is malformed, the parser returns an error message
instead of a rule. The UI shows that message and keeps the previous rule.

One step, per cell, with a double buffer:

- state 0: becomes 1 if `B[count]`, otherwise stays 0;
- state 1: stays 1 if `S[count]`, otherwise becomes 0 (C = 2) or 2 (C > 2);
- state s ≥ 2: becomes s+1, or 0 when s+1 == C. Decaying cells cannot be
  reborn until they reach 0.

### Seeding

`seed(density, region, rng)`: `region` is the edge length of a centred cube
of voxels (N gives the full volume). Every cell inside it becomes alive with
probability `density`. A seeded PRNG (mulberry32) makes runs reproducible for
the tests and `search.mjs`.

### Stats

The world exposes the generation count, the alive count and the non-dead
count after each step.

## Presets

Each preset is a lattice, neighbourhood, rule and default seed (density and
region size). The preset dropdown lists only the presets for the current
lattice and neighbourhood. A free-text rule field always allows a custom rule.

Cube 3×3 starts from well-known 26-neighbour rules: 445 (`4/4/5`), Amoeba
(`9-26/5-7,12-13,15/5`), Clouds (`13-26/13-14,17-19/2`), Pyroclastic
(`4-7/6-8/10`), Builder (`2,6,9/4,6,8-9/10`), and the binary Bays rules
B5/S4-5 (`4-5/5/2`) and B6/S5-7 (`5-7/6/2`).

The other three combinations (cube 5×5, tetra 3×3, tetra 5×5) have no known
rules. Their presets come from `search.mjs`, which reuses the shared-code
engine: it scales density thresholds from the cube 3×3 rules and then
random-searches S/B ranges around them.

Acceptance test for every preset, including the known ones, on N = 32 from its
own default seed with a fixed PRNG seed. After 300 generations:

- the alive count is above 0;
- the non-dead fraction is below 50%;
- the state is not static: it changed at least once in the last 50
  generations.

A known rule that fails this test under our seeding is retuned (different
seed) or dropped. The goal is 4 or more presets per combination. `test.mjs`
re-runs the acceptance test for every preset.

## Rendering

- **Instancing:** `InstancedBufferGeometry` with a per-instance `vec4`
  attribute (voxel x, y, z, state) and a small `ShaderMaterial`. That is 4
  floats per instance instead of a 16-float matrix, so a 64³ tetra world fits
  in memory.
  - Cube mode: one mesh with cube geometry, scaled to 0.86 so the cells read
    as separate.
  - Tetra mode: 6 meshes, one per orientation k. Each tetra is shrunk to 0.8
    about its centroid.
- **Buffers:** each render, the instance buffers are refilled with the
  non-dead cells that pass the slice filter, and `instanceCount` is set. The
  buffers are allocated once per lattice/size change, at the maximum cell
  count.
- **Lighting:** flat per-face normals with one directional light and an
  ambient term, computed in the shader.
- **Colour:**
  - Alive cells take a hue from their position in the volume, so structures
    read in 3D.
  - Decaying cells blend toward a dim ember colour as s → C−1.
  - An option switches to colour by state only.
- **Scene:** a wireframe box shows the world boundary, so the wrap is visible
  at the edges. The orbit camera can auto-rotate (on by default).
- **Slice:** pick an axis (x/y/z) and use a slider from 0..N. Cells whose
  coordinate on that axis is ≥ the slider are hidden, which lets you look
  inside a dense volume.

## UI

The control panel sits on the left over a full-window canvas, in a dark
theme. On phone widths it collapses to a toggle.

- Lattice: cube / tetra.
- Neighbourhood: 3×3 / 5×5.
- Preset dropdown, filtered to the current combination; picking one applies
  its rule and reseeds.
- Rule text field with Apply, plus an inline error line.
- Grid size: 24 / 32 / 48 / 64. The default is 48.
- Play/pause, Step, and a speed slider in generations per second (up to as
  fast as possible).
- Seed density, seed region size, Reseed and Clear.
- Slice axis and slider, colour mode and auto-rotate.
- A readout showing generation, alive count, non-dead count and ms per step.
- Keys: Space toggles play/pause, `.` steps, `R` reseeds.

Changing the lattice, neighbourhood or size reapplies the first preset for
the new combination and reseeds.

On load the page starts in cube 3×3 with Amoeba (or the best cube 3×3 preset
after tuning), N = 48, playing, with auto-rotate on.

A debug handle `window.__gol` exposes `step(n)`, `render()` and the world, so
headless screenshots can advance the simulation synchronously.

## Performance target

A 48³ tetra 3×3 world (663k cells) runs at ≥ 5 generations per second
including the instance refill on this Mac. The simulation is throttled by the
speed slider. The world is rendered after each step, at most once per frame.

## Testing (`test.mjs`)

- Rule parser: ranges, lists, empty S or B, whitespace, rejecting a count
  above `maxCount`, rejecting malformed strings.
- Box sum against a brute-force neighbour count on small random worlds:
  cube r = 1 and r = 2, tetra r = 1 and r = 2, including cells on the wrap
  boundary. N = 5 for r = 2 is the tightest legal size.
- Tetra geometry: the 6 tetrahedra have volume 1/6 each, sum to 1 and do not
  overlap. Overlap is checked by sampling points, each of which lands in
  exactly one tetra.
- Generations: the decay sequence for C = 5, no rebirth while decaying, and
  C = 2 behaving as classic Life.
- A known 3D oscillator or still life under B5/S4-5 or B6/S5-7 behaves as
  expected. If no textbook pattern is confirmed, the fallback is a
  translation-invariance check: shifting the seed across the wrap shifts the
  result.
- The acceptance test for every preset.

## Out of scope

- A mixed cube+tetra world, or cross-shape neighbourhoods.
- Von Neumann or other non-box neighbourhoods.
- Hand-drawing cells, importing or exporting patterns, URL-shared rules.
- A GPU simulation.
