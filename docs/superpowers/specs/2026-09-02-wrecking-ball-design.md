# Wrecking Ball — Design

**Date:** 2026-09-02
**Directory:** `3d-wrecking-ball/`
**Deliverable:** One `index.html` (Three.js r170 and Rapier 3D 0.20 from jsdelivr via importmap; everything else inline), a `test.mjs` that runs the shared-code tests in Node, a `screenshot1.jpg`, a README entry and a `gallery.yaml` title override.

## Purpose

Entertainment for two old demosceners: swing a wrecking ball into procedurally generated 3D structures and watch them crack, shear and collapse. Four targets: a stone castle, a stepped Mesoamerican pyramid, a wooden Trojan horse and a red-brick apartment block. The structures are the point, so they are generated block by block in pure code, and the collapse follows a masonry model rather than a pile of loose boxes.

## Decisions taken (owner-approved)

- **Physics:** Rapier 3D (`@dimforge/rapier3d-compat`, WASM embedded in the ESM bundle) loaded from jsdelivr, same precedent as Three.js. Alternatives rejected: cannon-es (jittery stacking past a few hundred bodies) and a hand-rolled solver (weeks of tuning for stable 2 000-box stacks).
- **Structure model:** mortar bonds. Blocks start as fixed bodies bonded to their neighbours; impacts release them into the dynamic world and cascade to unsupported blocks. Rejected: everything dynamic from frame one (the plank horse would collapse on load, walls would slump instead of cracking).
- **Controls:** mouse-drag the ball back and release, plus keys for the crane.

## Block model (pure logic in `<script id="shared-code">`, object `Wreck`)

Units are metres, Y up, ground plane at `y = 0`. A block is

```
{ p:[x,y,z], s:[sx,sy,sz], q:[x,y,z,w], mat:'stone'|'brick'|'wood'|'slab'|'roof', tint:0..1 }
```

`p` centre, `s` full size, `q` unit quaternion (identity when omitted; helpers `Wreck.qYaw(a)`, `Wreck.qRoll(a)`, `Wreck.qPitch(a)`), `tint` a per-block colour jitter in 0..1.

Materials (`Wreck.MATERIALS`): density in kg/m³, `strength` in kN for a 1 m³ block, `reach` in metres (how far an impact force travels through the material before decaying by 1/e) and a base colour: stone 2 400 / 160 / 1.5 / warm grey; brick 1 800 / 90 / 1.3 / red; wood 600 / 100 / 0.6 / tan; slab (concrete floors) 2 400 / 200 / 0.6 / pale grey; roof (slate) 2 000 / 60 / 1.5 / blue-grey. A block may carry `tough`, a multiplier on its hit points for massive timbers (the horse's sled beams and cradle).

### Geometry helpers

- `Wreck.aabb(block)` — world axis-aligned bounds of the rotated box.
- `Wreck.obbOverlap(a, b, shrink)` — separating-axis test between two oriented boxes, each shrunk by `shrink` metres per side. Used by tests to prove assets contain no interpenetration.
- `Wreck.wallCourses(spec)` — the masonry generator shared by the castle, pyramid temple and apartment. Input: wall length, thickness, number of courses, course height, unit length, running-bond offset, openings `[{x0,x1,y0,y1}]` and material. Output: blocks along the local X axis; units are clipped at opening edges (pieces shorter than a quarter unit are dropped), and a single lintel block spans each opening one course above its top. The caller places the result with a yaw and an origin.
- `Wreck.ring(spec)` — one course of `n` blocks around a circle of radius `r` (each block yawed to its angle, alternate courses offset by half a step). Used by castle towers and horse hoops (with a roll so the ring stands in the YZ plane).

### Assets (`Wreck.assets.<name>.build()` → `{ name, blocks, radius, craneStart }`)

Block budget ≤ 2 500 per asset. `radius` is the footprint radius used for camera and crane placement; `craneStart` is the crane base position and heading.

- **Castle.** 24 × 24 m. Four curtain walls 7 m high of 1.5 × 0.6 × 1.2 m stone in running bond, ending where the towers begin, merlons (0.8 m) on top, a 3 m wide, 4 m high gate in the front wall with a lintel. Four round corner towers, radius 3 m, 10 m high, 12 blocks per ring, crenellated, capped by a stepped cone of shrinking `roof` rings. A central keep 8 × 8 × 12 m with a door and crenellations. About 2 300 blocks.
- **Pyramid.** Seven stepped tiers on a 30 × 30 m base, each tier 2.4 m high and inset 1.5 m. Tier faces are three courses of 1.5 × 0.8 × 0.9 m stone; the interior is filled with 3 × 2.4 × 3 m core blocks so the pyramid is solid but cheap. A 4 m wide stairway of single-block steps (0.3 m rise, 0.19 m tread, matching the tier slope) climbs the front face; each step block runs back to the tier face behind it. A 6 × 6 m temple with a door and a flat slab roof stands on the summit. About 1 700 blocks.
- **Trojan horse.** All wood. A plank sled (8 × 4 m deck of eight planks on two cross-beams) on four cylinder wheels. Four legs, each a 2 × 2 column of 0.8 × 0.6 × 0.8 m timbers, 3.6 m tall, carrying one wide cradle plank. A barrel body 6 m long, radius 2.2 m: 18 longitudinal staves resting on the cradle, three rib rings inside the barrel, closed by plank end caps trimmed to the circle. A neck of six leaning timbers rising forward from the barrel top, a plank head with ears, and three tail boards stepping up and back. About 210 blocks. The crane starts in front of a leg.
- **Apartment.** 16 × 10 m footprint, six storeys of 3 m. Walls of 1.0 × 0.33 × 0.3 m brick units in running bond (`wallCourses`) with 1.2 × 1.5 m windows on a 2 m grid on every façade, lintels above, a ground-floor door, and a 0.6 m roof parapet. Each floor is a slab of eight 4 × 0.25 × 5 m concrete plates resting on the walls (interior columns of brick at the two slab seams so the plates are supported). About 2 100 blocks.

Cylinders (`shape:'cyl'`, axis local Y, then rotated) exist only for the horse's wheels.

### Bond graph and collapse (`Wreck.Structure`)

`new Wreck.Structure(blocks, strengthScale)`:

- **Bonds.** Two blocks are bonded when their AABBs, expanded by 6 cm, overlap. Built with a spatial hash; symmetric adjacency lists.
- **Support.** A block is supported when its AABB bottom is within 6 cm of the ground, or when it is bonded to an intact block whose centre is at least a tenth of the upper block's height lower than its own centre. Lintels rest on their end blocks, barrel staves rest on the staves below them, an arch left by a hole in a wall keeps standing.
- **Hit points.** `hp = strength(mat) · strengthScale · cbrt(volume)`.
- **`hit(index, forceKN)`** on an intact block: if `force < hp`, the block records `damage = max(damage, force)` (visual only, darker tint) and returns `[]`. Otherwise the block is released and the force travels on along its bonds, multiplied by `exp(−d / reach)` for the distance `d` to each neighbour, breaking every block it still exceeds (a crater whose size grows with the logarithm of the force, independent of block size). Finally the cascade releases every intact block that is no longer supported, breadth-first from the released ones. Returns the list of newly released indices.
- **`unsupported()`** returns intact blocks that fail the support rule; every freshly built asset must return an empty list, which is the structural test that assets stand.

### Tests (`WreckTests.run()`, run by `test.mjs`)

- Quaternion helpers and `aabb` against known rotations.
- `obbOverlap` on touching, separated and rotated pairs.
- `wallCourses`: total length covered, no block inside an opening, one lintel per opening, running-bond offsets alternate.
- Every asset: block count within budget, finite values, positive sizes, no block below ground, no interpenetration (`obbOverlap` with 2 cm shrink) on all bonded pairs, `unsupported()` empty, bonds symmetric, every block bonded to at least one other block.
- `Structure` on a synthetic 3-block column and a 2-pillar lintel: weak hit releases nothing but records damage; strong hit on the base releases the column; removing one pillar keeps the lintel, removing both drops it; excess force reaches neighbours.

## Page

Full-screen canvas with the dark collapsible card panel top-left, like the Eiffel page.

**Target card.** Four asset buttons, block count, Reset. Switching assets rebuilds the physics world.

**Ball card.** Sliders: mass (0.5..10 t, default 3), radius (0.5..1.5 m), cable length (4..20 m, default 12). The boom starts at 40° so the ball hangs at wall height. Space bar or *Shove* button applies an impulse from the ball towards the structure centre.

**Crane card.** Key hints: `←` `→` turn tracks, `↑` `↓` drive, `A` `D` slew, `W` `S` luff the boom, `Q` `E` hoist. Readout of boom angle and hook height. Sliders mirror slew and luff for mouse users.

**World card.** Mortar strength multiplier (0.2..5, log slider), slow motion (0.1..1), shadows toggle, camera follows ball toggle.

**Stats card.** Blocks total / released / asleep, contacts per step, frames per second.

**Mouse.** Left-drag on the ball grabs it: the ball becomes kinematic and follows the intersection of the mouse ray with the horizontal plane at the ball's height, projected onto the sphere of cable length around the hook so the rope stays taut. Release makes it dynamic with zero velocity, so it swings like a pendulum. Left-drag elsewhere orbits the camera around the structure centre (or the ball when following), wheel zooms.

## Physics plan

- Rapier world, gravity −9.81, timestep 1/60 scaled by the slow-motion factor, one step per rendered frame (cap two steps when the frame is late). Solver iterations 8.
- Every block gets its own rigid body, created **fixed**, with a cuboid (or cylinder) collider one centimetre smaller than the drawn block on every side (a mortar joint: blocks generated touching exactly rub on four fixed faces once freed and lose their kick to friction within a few steps): density from the material, friction 0.6, restitution 0.05, `CONTACT_FORCE_EVENTS` active with a threshold of 30 kN so resting contacts stay silent.
- The ball is a dynamic ball collider with continuous collision detection, whose density is set from the mass slider. The hook is a kinematic position-based body at the boom tip. A **rope joint** of the cable length connects hook and ball; changing the length recreates the joint. Linear damping 0.05 on the ball.
- Per step: record the ball's velocity, step, then drain contact force events into a list and apply them **strongest first** (otherwise a weak event can release a block through spill before the big event that actually struck it is seen). Each intact block hit gets `structure.hit(index, force / 1000)`; every returned index has its body switched to dynamic. Blocks freed by a ball contact are pushed at the ball's pre-impact speed along the struck block's local axis that best faces the ball (the wall normal for masonry, the radial for ring blocks and staves; pushing along the ball's own velocity drives them sideways into fixed neighbours), fading with distance from the ball, and the ball keeps about half of that velocity, because the solver resolved the impact against fixed bodies and would otherwise leave the freed stones resting in place and the ball bouncing off. Released debris that falls below y = −10 is removed from the world and hidden.
- Crane: base position and heading are integrated from the drive keys; slew, luff and hoist are angles and a length. The hook target is the boom tip, moved with `setNextKinematicTranslation` and smoothed so the ball is not yanked.

## Rendering plan

- One `InstancedMesh` of a unit box for all boxes and one of a unit cylinder for wheels; per-instance colour = material colour × tint jitter × (1 − 0.5 · damage/hp). Matrices are copied from Rapier each frame only for released bodies (fixed blocks never move); intact blocks keep the matrices written at build time.
- Ground plane receiving shadows, a directional sun with a shadow map covering the structure, hemisphere fill, fog to the horizon, gradient sky colour.
- Crane: crawler tracks and cab as boxes, a lattice boom drawn with `LineSegments`, the ball a dark sphere. The cable is a chain of oval torus links (one `InstancedMesh`, 0.42 m pitch, alternate links turned 90°) laid along the hook-to-ball line; when the rope joint is slack the links follow a parabola bowed away from the chord (in the gravity direction, or sideways for a vertical chord) whose sag makes the arc length match the cable. The chain is visual only: a physical chain of light links under a multi-ton ball would fight the solver.
- Renderer pixel ratio capped at 2 (HiDPI).

## Sound

All effects are synthesised with Web Audio at run time (no sample files), started on the first pointer or key gesture, with a *Sound effects* checkbox in the World card. Each sound is panned by the source's screen position.

- **Impact** (strongest ball-on-block contact per step above 60 kN): a pitch-dropping sine thud plus a filtered noise burst, sized by the force; stone low and dull, brick brighter, wood a resonant bandpass knock; hits above 600 kN add a one-second low rumble. The ball landing on the ground plays a softer stone thud.
- **Clatter** (strongest contact per step of a loose block that was moving faster than 1 m/s before the step, rate-limited to one every 28 ms of simulation time and one per block every 0.3 s): a short bandpass click, wooden for wood. The motion gate matters: a settled pile still presses on the ground above the contact-event threshold while it jitters to sleep, and would otherwise keep clattering long after the fall. Impact sounds likewise require the ball to have been moving.
- **Clink** when the ball is grabbed and released: three detuned high triangle partials.
- **Crane engine**: a diesel (sawtooth plus sub-octave square through a lowpass, chugging via a slow gain LFO) that idles at 31 Hz and revs to 47 Hz, louder and more open, while any crane key is held. The idle shuts off 5 s after the last crane input (fading over about a second) so the page is silent when nothing is happening, and starts again on the next crane key.
- **Hydraulic whine** while slewing, luffing or hoisting: a vibrato sine at 560 / 700 / 880 Hz respectively.
- **Tracks** while driving: the engine drops to 42 Hz but gets harder and louder, a deep rumble and a 38 Hz ground shake come in, a drivetrain growl (two beating sawtooths through a tanh shaper and a bandpass, amplitude-modulated at the track-link rate) and a thin gear whine at 1 450 Hz, plus one clank per track link (0.45 m of travel, alternating left and right): a ground thud, a dull body knock and a metallic ring.
- **Turning** on the spot: the same drivetrain at lower pitch and gear whine at 1 050 Hz, clanks on the outer track only at a slower rate, and a track scrape (bandpass noise around 850 Hz) with a wavering metal squeal.
- **Backup alarm** while driving backwards: a 1 050 Hz square beep, 0.45 s on and 0.45 s off.

## Testing and verification

- `node test.mjs` runs `WreckTests`.
- Headless Chrome (plain `--headless=new`, no swiftshader) loads a temporary copy of the page through a local http server with an appended module script that awaits `window.__wreckReady`, shoves the ball and steps the world synchronously through the `window.__wreck` handle, writes the released count into the document title (read back with `--dump-dom`) and is captured with `--screenshot`.
- Screenshot for the gallery: the castle a second or two after the first impact.
