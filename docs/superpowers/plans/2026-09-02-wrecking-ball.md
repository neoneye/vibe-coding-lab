# Wrecking Ball Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone `3d-wrecking-ball/index.html` where a crane-hung wrecking ball demolishes four procedurally generated block structures under a mortar-bond collapse model.

**Architecture:** Pure geometry and collapse logic live in a `<script id="shared-code">` block (object `Wreck`, tests `WreckTests`) that Node can run without a browser. A `<script type="module">` imports Three.js and Rapier from jsdelivr, builds the Rapier world from the block list, renders with instanced meshes, and feeds contact-force events back into `Wreck.Structure`.

**Tech Stack:** Three.js 0.170.0 (importmap), `@dimforge/rapier3d-compat` 0.20.0 (`+esm` bundle), vanilla JS, Node ≥ 18 for tests, headless Chrome for smoke tests and the screenshot.

Spec: `docs/superpowers/specs/2026-09-02-wrecking-ball-design.md`.

## Global Constraints

- Single self-contained `index.html`; only the two CDN imports above may be external.
- Block budget ≤ 2 500 per asset.
- Shared-code block must run in Node via `new Function` (no `import`, no DOM).
- Units: metres, Y up, ground at y = 0.
- Renderer pixel ratio capped at 2.
- Commit directly to `main`.

## File structure

- `3d-wrecking-ball/index.html` — page, shared-code block, module script.
- `3d-wrecking-ball/test.mjs` — copy of the Eiffel runner, calling `WreckTests.run()`.
- `3d-wrecking-ball/screenshot1.jpg` — gallery image.
- `README.md`, `gallery.yaml`, `index.html` (root, via `build_gallery.py`).

---

### Task 1: Skeleton, test runner, geometry helpers

**Files:** create `3d-wrecking-ball/index.html`, `3d-wrecking-ball/test.mjs`.

**Produces:** `Wreck.qYaw(a)`, `Wreck.qRoll(a)`, `Wreck.qPitch(a)` → `[x,y,z,w]`; `Wreck.qMul(a,b)`; `Wreck.rotate(q, v)`; `Wreck.aabb(block)` → `{min:[..], max:[..]}`; `Wreck.obbOverlap(a, b, shrink)` → boolean; `Wreck.MATERIALS`; `WreckTests.run()` returning boolean, using a tiny `T.eq/T.ok/T.near` harness that logs pass/fail counts.

- [ ] Write `test.mjs` (regex-extract the shared-code block, run `WreckTests.run()`, exit code).
- [ ] Write tests: `qYaw(π/2)` rotates `[1,0,0]` to `[0,0,-1]`; `aabb` of a 2×1×1 block yawed 90° is 1×1×2; `obbOverlap` false for touching unit cubes with shrink 0.02, true for overlapping, true/false for a 45° rotated pair placed inside/outside.
- [ ] Run `node 3d-wrecking-ball/test.mjs` — expect failures (functions missing).
- [ ] Implement helpers (SAT over 15 axes for `obbOverlap`).
- [ ] Tests pass. Commit `3d-wrecking-ball: skeleton, geometry helpers, tests`.

### Task 2: Masonry generators

**Produces:** `Wreck.wallCourses({length, thickness, courses, courseH, unit, bond, openings, mat, y0})` → blocks in local frame (x along length from 0, z = 0 at wall centre line); `Wreck.place(blocks, origin[3], yawRad)` → transformed copies; `Wreck.ring({r, n, courses, courseH, len, thick, mat, y0, roll})` → blocks around the Y axis (roll rotates the whole ring about X afterwards).

- [ ] Tests: wall of length 6, unit 1, 4 courses → covered length per course equals 6 (sum of sx); with an opening `{x0:2,x1:4,y0:0.6,y1:1.8}` no block centre falls inside the opening rectangle, exactly one `lintel:true` block exists spanning ≥ 2 m; odd courses start with a half unit; `ring({n:12})` produces 12 blocks per course whose centres are at radius r ± 1e-9.
- [ ] Run tests, expect failures. Implement. Tests pass. Commit `3d-wrecking-ball: masonry generators`.

### Task 3: Bond graph and collapse model

**Produces:** `new Wreck.Structure(blocks, strengthScale=1)` with `.bonds[i]` (arrays), `.released` (Uint8Array), `.damage` (Float32Array), `.hp` (Float32Array), `.hit(i, forceKN)` → array of newly released indices, `.unsupported()` → array of intact indices failing the support rule, `.isSupported(i)`.

- [ ] Tests: three stacked unit cubes: bonds symmetric, `unsupported()` empty; `hit(0, hp0 − 1)` returns `[]` and sets damage; `hit(0, 10·hp0)` returns all three (cascade); two pillars + lintel: release one pillar (hit with huge force but neighbours' spill zeroed by `strengthScale` large? — instead call `release(i)` helper) keeps lintel; release both drops lintel; spill: a row of three touching cubes, hit middle with `hp + 4·hp` releases neighbours too.
- [ ] Implement spatial hash on expanded AABBs, support rule (ground within 0.06 m, or a bonded intact block with centre lower by ≥ 0.1·own height), `hit` with half-excess spill split among intact neighbours, breadth-first `cascade`.
- [ ] Tests pass. Commit `3d-wrecking-ball: bond graph and collapse model`.

### Task 4: The four assets

**Produces:** `Wreck.assets.castle|pyramid|horse|apartment`, each `{ label, build() → {name, blocks, radius, craneStart:{pos:[x,0,z], heading}} }`. Cylinder blocks carry `shape:'cyl'` (`s = [diameter, height, diameter]`).

- [ ] Tests run for every asset: block count in `[100, 2500]`, finite, sizes > 0, AABB min y ≥ −0.01, every block has ≥ 1 bond, no `obbOverlap` (shrink 0.02) among bonded pairs, `unsupported()` is empty.
- [ ] Build castle (walls via `wallCourses` + gate, four towers via `ring` with stepped roof rings, keep). Run tests; fix overlaps at wall/tower junctions by starting walls at the tower tangent.
- [ ] Build pyramid (tiers of faced courses + big core blocks, single-block stair steps, balustrades, temple with door + slab roof).
- [ ] Build horse (sled planks + beams + cylinder wheels, 2×2 timber legs, 18 staves + 3 hoops rolled into YZ, end caps, neck, head, tail).
- [ ] Build apartment (perimeter `wallCourses` with windows/door/lintels, slabs of 8 plates per floor, interior brick columns at slab seams, parapet).
- [ ] All asset tests pass. Commit `3d-wrecking-ball: castle, pyramid, trojan horse, apartment assets`.

### Task 5: Page — physics, rendering, controls

**Consumes:** everything above. **Produces:** `window.__wreck = { load(name), step(n), shove(strength), stats(), structure, world }` for headless testing.

- [ ] Panel HTML/CSS (Target, Ball, Crane, World, Stats cards, hint text, error box) following the Eiffel page.
- [ ] Module script: importmap for `three` and `@dimforge/rapier3d-compat`; `await RAPIER.init()`; renderer/scene/lights/ground/sky/fog; camera orbit + wheel.
- [ ] `loadAsset(name)`: dispose old world; create Rapier world (gravity −9.81, `numSolverIterations = 8`); one fixed body + collider per block (density, friction 0.6, restitution 0.05, `CONTACT_FORCE_EVENTS`, threshold 20 000 N); `Structure`; instanced box mesh and instanced cylinder mesh with per-instance colours; crane placed at `craneStart`; hook kinematic body, ball dynamic body, rope joint.
- [ ] Frame loop: integrate crane keys → boom tip → `setNextKinematicTranslation` (smoothed); step world with `dt = (1/60)·slowmo`; drain contact-force events → `structure.hit` → `setBodyType(Dynamic)` for released; copy matrices of released bodies; remove bodies below y = −10; update colours of damaged blocks; render; stats.
- [ ] Mouse: raycast ball for grab (kinematic follow on the ball-height plane, projected onto the rope sphere), otherwise orbit.
- [ ] Sliders: mass/radius (rebuild ball), cable (recreate joint), mortar (rebuild `Structure` hp), slow-mo, shadows, follow.
- [ ] Headless smoke test: serve the directory over `python3 -m http.server`, load with Chrome `--headless=new`, call `__wreck.load('castle'); __wreck.shove(1); __wreck.step(240)` and assert released > 0 and no console errors. Commit `3d-wrecking-ball: page — physics, rendering, controls`.

### Task 6: Screenshot, README, gallery

- [ ] Take `screenshot1.jpg` (castle mid-collapse) with headless Chrome via a temporary `_shot.html` that steps synchronously.
- [ ] Add README entry after the Eiffel entry, `gallery.yaml` line `3d-wrecking-ball: 3D Wrecking Ball`, run `python3 build_gallery.py`.
- [ ] Commit `3d-wrecking-ball: screenshot, README, gallery`.
