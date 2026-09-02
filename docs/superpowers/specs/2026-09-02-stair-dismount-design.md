# Stair Dismount — Design

**Date:** 2026-09-02
**Directory:** `3d-stair-dismount/`
**Deliverable:** One `index.html` (Three.js r170 and Rapier 3D 0.20 from jsdelivr via importmap; everything else inline), a `test.mjs` that runs the shared-code tests in Node, a `screenshot1.jpg`, a README entry and a `gallery.yaml` title override.

## Purpose

A homage to *Porrasturvat / Stair Dismount* (tAAt, 2002). A ragdoll stands at the top of a staircase. The player picks a spot on the body, aims a push, sets the force, and lets go. The ragdoll tumbles down the stairs and every impact scores points, head hits scoring most. Four staircases, a per-staircase best score, and a retry that replays the exact same push.

## Decisions taken

These were settled by the author without a dialogue (the session ran unattended); the owner can override any of them.

- **Physics:** Rapier 3D via the `+esm` bundle, same precedent as `3d-wrecking-ball`. A hand-rolled ragdoll solver is the wrong place to spend effort.
- **Joints:** Rapier's JavaScript API gives limits only on revolute joints. Knees and elbows are revolute with limits; neck, spine, shoulders, hips and ankles are spherical joints held near the rest pose by position motors on all three angular axes. Motor stiffness follows a *limpness* slider, so the figure ranges from a stiff plank to a rag.
- **Aim phase:** all bones are fixed bodies while the player aims, so the figure stands perfectly still. Pushing switches them to dynamic and applies the impulse. Retry rebuilds the same pose and reapplies the recorded push, which is deterministic in Rapier.
- **Scoring:** contact-force events between bones and the environment. No joint-bending score, no self-collision score.
- **Camera:** orbit around the pelvis with a follow toggle. Click selects a body part; drag orbits.

## Pure logic (`<script id="shared-code">`, object `Dismount`)

Metres, Y up, kilograms. The top landing of every staircase is where the figure stands; the stairs descend along the local −Z direction from the landing edge.

### Staircases (`Dismount.stairs.<name>.build()` → `{ name, boxes, landing, down, radius, floorY }`)

Solids are boxes `{ shape:'box', p:[x,y,z], s:[sx,sy,sz], yaw, kind }`, cylinders `{ shape:'cyl', p, r, h, kind }` and wedges `{ shape:'wedge', cx, cz, r0, r1, a0, ang, y, t, kind }` (annular sector, azimuth from +Z towards +X, top surface at `y`), with `kind` one of `'step'|'landing'|'floor'|'wall'|'post'`. `Dismount.supportHeight(stairs, x, z)` returns the highest walkable surface under a point; the tests use it to prove the landing is the top and that the first step meets the landing edge. `landing` is `{ p:[x,y,z], w, d }`: the standing point (centre of the top landing surface) and its width and depth. `down` is a unit vector in the XZ plane pointing from the landing down the first flight. `radius` is the footprint radius for camera placement. `floorY` is the ground level (0).

- **Straight.** Fourteen steps, 1.4 m wide, rise 0.18 m, tread 0.28 m, a 1.6 × 1.4 m landing on top, a floor slab. Solid stair: each step box runs from its tread down to the floor so there is no hollow underside.
- **Dogleg.** Eight steps down to a 1.6 × 3.0 m half landing, a 180° turn, eight more steps back the other way. A 0.2 m thick wall separates the two flights, and a newel post stands at the turn.
- **Spiral.** Twenty wedge steps around a 0.3 m column, outer radius 1.9 m, 18° per step, rise 0.19 m, one full turn. Wedges are true annular sectors (`shape:'wedge'`, eight vertices from `Dismount.wedgeVertices`) rendered as flat-shaded meshes and simulated as Rapier convex hulls. The landing is a wider 40° wedge just before the first step, so the figure stands on the same kind of plate; `down` is the tangent at the landing's midpoint. Steps are 0.12 m thick plates with open air below them.
- **Long.** Thirty steps, 1.2 m wide, rise 0.2 m, tread 0.25 m, low 0.9 m side walls on both sides so the figure keeps bouncing between them.

### Ragdoll (`Dismount.ragdoll.build(height=1.8)` → `{ parts, joints, mass }`)

Fifteen `parts`, each `{ name, shape:'capsule'|'box'|'ball', dims, mass, p, q, weight, group }`: head (ball), chest (box), pelvis (box), upper arm ×2, forearm ×2, thigh ×2, shin ×2 (capsules, axis local Y), foot ×2 (box), hand ×2 (small box). Dimensions scale linearly with height; masses follow standard segment fractions and sum to about 75 kg at 1.8 m. `weight` is the scoring weight: head 5, chest 3, pelvis 2, thigh 1.5, shin 1, upper arm 1, forearm 1, hand 0.5, foot 0.5. `p`, `q` describe the standing pose in a local frame whose origin is the point between the feet on the ground, facing −Z.

`joints` are `{ a, b, type:'spherical'|'revolute', anchorA, anchorB, axis?, limits?, stiffness }` where anchors are in each part's local frame and coincide in world space in the standing pose. Revolute joints: elbows (axis local X, limits 0 … 2.4 rad, bending forward) and knees (limits −2.4 … 0, bending backward). `stiffness` is a relative muscle tone (spine 3, neck 1.5, hips 2, shoulders 1, ankles 2, elbows and knees 1) multiplied by a global figure from the limpness slider.

`Dismount.ragdoll.place(rig, landing, down)` → array of `{ p, q }` in world space: the rig stands centred on the landing, 0.25 m back from its down edge, facing `down`.

### Scoring (`Dismount.score`)

`impactPoints(weight, force, dt)` = `weight · max(0, force − 400) · dt / 2`. A 75 kg figure resting on the floor never exceeds the 400 N threshold on any single bone, so resting scores nothing; a head-first dive down the straight flight scores about 1 000 to 2 000 points in total, the long flight around 2 500. `partColour(damage)` maps accumulated damage to a bruise tint (skin → red → purple) saturating at 500 points.

`pushImpulse(percent)` = `15 + 3 · percent` N·s (percent 0 … 100), so full force moves a 75 kg body at about 4 m/s. Stronger pushes (the first draft used 600 N·s) launch the figure clean over the staircase, which is no fun.

`dismountOver(speeds, dt)` accumulates rest time: returns true once every bone has moved slower than 0.08 m/s for 1.5 s, or after 25 s of simulation.

### Tests (`DismountTests.run()`, run by `test.mjs`)

- Every staircase: all values finite and sizes positive, nothing below the floor, the landing is the highest surface, steps descend monotonically along the flight, the landing's down edge sits at the first step (via `supportHeight`), footprint radius covers every solid, and no two steps overlap (AABB for boxes, disjoint azimuth ranges for wedges).
- Ragdoll at 1.8 m and 1.5 m: fifteen parts, mass 60 … 90 kg scaled, every joint's anchors coincide within 1 mm in world space, feet bottoms at y = 0 within 5 mm, head is the highest part, no two non-jointed parts overlap (AABB test), weights present and positive.
- `place` on each staircase puts the feet on the landing surface, facing `down`.
- Scoring: zero below threshold, linear above, head outscores foot for the same force, `pushImpulse` endpoints, `dismountOver` fires after 1.5 s of rest and not before, and fires at the 25 s cap.

## Implementation note

The `rapier3d-compat` 0.20 bundle ships two copies of its joint class hierarchy; the one `createImpulseJoint` returns has an empty `SphericalImpulseJoint` wrapper without motor methods. Spherical motors are therefore configured through `joint.rawSet.jointConfigureMotorModel(handle, axis, model)` and `jointConfigureMotorPosition(handle, axis, target, stiffness, damping)`. Motors use the acceleration-based model, so one stiffness figure serves hands and thighs alike: stiffness `420·(1−limpness)²·rel`, damping `(2 + 28·(1−limpness))·√rel`.

## Page

Full-screen canvas, dark collapsible card panel top-left like the Wrecking Ball page.

**Stairs card.** Four buttons (Straight, Dogleg, Spiral, Long), Reset. Switching rebuilds the world and the figure.

**Push card.** Readout of the selected part and push point. Sliders: direction (azimuth −180 … 180°, elevation −60 … 60°, both relative to the down-stairs direction), force 0 … 100 % (default 50), limpness 0 … 1 (default 0.35). Buttons: *Push* (space), *Retry* (R: reset and replay the last push), *Reset* (Esc). Default target is the chest, pushed straight down the stairs.

**Score card.** Total, per-part breakdown sorted by damage, best score for this staircase (kept in `localStorage`, wrapped in try/catch), state line: *Aim*, *Falling…*, *Dismount over*.

**World card.** Slow motion 0.1 … 1, shadows toggle, camera follow toggle, fps.

**Scene.** Steps as pale concrete boxes with darker nosing lines, floor slab, distant fog, hemisphere and directional light with shadows. Ragdoll parts as capsule / box / sphere meshes in a skin tone that bruises with damage. A yellow arrow from the push point shows direction and grows with force; while aiming, hovering a part highlights it and clicking sets the push point.

**Mouse.** Click a body part to select the push point. Drag orbits the camera around the pelvis; wheel zooms. Keys: `A`/`D` azimuth, `W`/`S` elevation, `+`/`-` force, `Space` push, `R` retry, `Esc` reset, `1`–`4` staircases.

**Loop.** Fixed 120 Hz steps (two substeps per 60 Hz frame) with a slow-motion scale; contact-force events drained every step; the figure's bones stay fixed until the push. `window.__dismount` exposes `step(n)`, `push()`, `select(name)`, `load(name)` and `state` for smoke tests, and `window.__dismountReady` resolves when the world is built.
