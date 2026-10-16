# Lithium — design

Date: 2026-10-16. Directory: `game-lithium/` (single `index.html` + `test.mjs` + `screenshot1.jpg` + `README.md`).
Gallery title: "Lithium".

## Intent

A desktop browser revival of *Lithium*, the owner's unfinished 2016 iOS prototype (SpriteKit,
`opcoders_test_ios/Lithium`). The concept deck ("Game Concept, 2016-01-07 version 2") states the
hypothesis: *it's addictive to tweak sliders over and over and see how the new vehicle behaves and if it
passes the track.* The page should test that hypothesis and look like the prototype's screenshots, which
the owner likes.

Owner choices:
- Sliders plus light control: tune the car in a garage, press Start, the car's motor drives itself; the
  player may hold Space for a booster and use ← → to tilt.
- Strictly flat 2D: orthographic camera, unlit flat colours. three.js only renders.
- Physics: planck.js (Box2D port) — WheelJoint gives suspension spring + wheel motor in one joint, and
  the prototype ran on SpriteKit's Box2D, so the feel carries over.
- Desktop focus (keyboard + mouse); no touch layout work.

## Look (from the prototype screenshots)

- Background pure blue `#0000ff`. Track: thick yellow `#ffff00` band made of straight segments with
  hairline seams between segments (as the SpriteKit sprites showed).
- Chassis black `#000000` (a long bar with two small end posts), legs black, wheels dark grey `#5a5a5a`
  with a light grey `#e0e0e0` hub. Hub shape depends on wheel type (hexagon / gear teeth / plain disc).
  Gear wheels are drawn like screenshot 1: outer toothed ring `#6e6e6e`, inner disc `#9a9a9a`, a black
  spoke line so rotation is visible.
- Cargo: loose green `#00ff00` blocks on the chassis bed.
- Booster: red `#ff0000` + green triangle flame behind the chassis, with small yellow spark dots.
- UI text: big bold yellow Helvetica — the distance number at the top centre, "Start"/"Stop" at the
  bottom centre. Small white monospace `nodes:N draws:N  60.0 fps` readout bottom-right on a dim box,
  as an homage to the SpriteKit debug label.
- Garage sliders: white round thumbs on thin lines, blue fill left of the thumb, grey right (deck slide
  "Sliders"), with small labels. Panel on the left on desktop, the live car preview to the right.
- Win: the prototype's `winnerSequence` — background flashes white/black ~8 times, then the level clears.
- Crisp on retina: renderer pixel ratio = devicePixelRatio, canvas sized in device pixels.

## Game flow

1. **Garage** (initial state). The car stands at the start of the current level's track. Sliders on the
   left; moving any slider rebuilds the preview car immediately (physics keeps running with the wheel motors braked, so the new car drops in and settles on its suspension). Level
   picker shows unlocked levels and best score per level. Big "Start" at the bottom (click or Enter).
2. **Run.** Physics runs at fixed 60 Hz. The wheel motors spin at the slider speed. The camera follows
   the chassis with smoothing; orthographic zoom fits ~20 m of track horizontally. The big number shows
   the distance score 0–10. "Stop" (click or Enter) returns to the garage.
3. **Run ends** when any of:
   - **stuck:** score-distance progress < 0.3 m over the last 3 s;
   - **flipped:** chassis upside down (|angle| > 120°) for 1.5 s;
   - **fell:** chassis more than 4 m below the track surface at its x (pits), or below the lowest point minus 5 m.
   The car freezes, a small yellow caption ("stuck" / "flipped" / "fell") appears under the number, the
   best score for the level updates. After 1.5 s the game returns to the garage by itself, keeping the
   result caption, so the tweak → Start loop stays quick.
4. **Reaching 10** triggers the win flash, unlocks the next level, and returns to the garage on that
   next level. After level 5 a "all tracks done" caption shows; levels stay replayable.

## Vehicle and sliders

Ranges below are starting values and may be retuned during playtesting so every level is passable with some setting. All sliders are integer steps (like the prototype's `random_range` configs) so configurations are easy
to compare and share. Defaults reproduce the Car6 vehicle (chassis 200×20 px ⇒ 4 m × 0.4 m at 50 px/m,
legs 0.8 m, wheel radius 0.5 m, wheels at ±1.2 m) and can finish level 1.

| Slider | Range | Effect |
|---|---|---|
| Rear wheel size | radius 0.3–1.2 m | rear wheel radius |
| Front wheel size | radius 0.3–1.2 m | front wheel radius |
| Wheel type | smooth / hex / gear | friction 0.6 / 0.9 / 1.4; hex and gear draw differently |
| Motor speed | 2–14 rad/s | wheel joint motor speed (both wheels) |
| Motor torque | 20–200 N·m | wheel joint max motor torque |
| Leg length | 0.2–1.6 m | distance chassis → wheel axle |
| Chassis width | 2–6 m | bar length; wheels sit at ±max(width/2 − 0.8, 0.3·width) m |
| Chassis height | 0.2–1.0 m | bar thickness (also mass) |
| Suspension | 1–10 | WheelJoint spring frequency 1–10 Hz, damping ratio 0.7 |
| Cargo | 0–6 blocks | loose green blocks on the bed (more weight, more grip, can fall off) |
| Booster fuel | 0–5 s | seconds of Space thrust available per run |

Cargo falling off is allowed and has no penalty; it only changes how the car behaves.

Controls: **Space** booster (thrust along the chassis' forward axis while fuel lasts), **← →** apply a
tilt torque to the chassis (works in the air and on ground), **Enter** Start/Stop, **R** restart run,
**M** mute, **1–5** pick an unlocked level in the garage. Slider values and level progress persist in
`localStorage` (wrapped in try/catch; the game works without it).

## Tracks

Each level is a `slopes` array of segment angles in degrees (the prototype's `traverseSlopes` format),
each segment `segLen` m long horizontally, plus feature markers. Level score: the track's total
horizontal length L (excluding the run-up) divided into 10; score = floor(10 · progress / L) clamped
to 0..10, and it never decreases within a run (as `updateDistance` did).

1. **Bumps** — gentle ±10° rolling slopes (based on Car6's array).
2. **Steep places** — climbs up to 35°, with drops.
3. **Pitfalls** — gaps in the track 1.5–3.5 m wide; falling in ends the run.
4. **Rope bridge** — two gaps spanned by bridges of 0.5 m planks chained with revolute joints anchored
   to the track at both ends; they sag and swing.
5. **Friction varies** — slippery stretches (friction 0.05) drawn in pale yellow `#ffff99`, plus a
   high-grip stretch drawn in orange `#ffcc00`, on steep sections.

Every track has an 8 m flat run-up before score 0 and a flat 10 m run-out after score 10, then a wall.

## Sound (Web Audio, created on first user gesture)

- Motor hum: a sawtooth + lowpass whose pitch follows mean wheel angular speed; quiet.
- Thumps: short filtered noise burst when a car part (wheel, chassis, cargo) touches the ground or a plank
  at `begin-contact` with approach speed > 2 m/s, volume scaled by speed. (Implemented from approach speed
  rather than `post-solve` impulses, because the wheel suspension absorbs the impulse.)
- Booster: band-passed noise while Space thrust is active.
- Win: a short rising arpeggio during the flash.
- **M** toggles mute; the help line in the corner shows "sound on" / "muted".
- The AudioContext is suspended while the tab is hidden.

## Architecture (inside one `index.html`)

- `<script id="shared-code">`: pure logic with no DOM/three dependency, testable in Node:
  - `Tracks`: level definitions and `buildTrackGeometry(level)` → segment list (from/to points,
    friction class, gaps, bridge spans), run-up/run-out, score length.
  - `VehicleConfig`: slider definitions (`SLIDERS` table), `defaults()`, `clamp`, and
    `toPhysicsSpec(values)` → body/fixture/joint descriptions in metres.
  - `Score`: `scoreFor(progress, L)` and `RunMonitor` (stuck/flipped/fell detection from per-step
    samples).
  - `Sim`: `createSim(planck, level, values)` builds the planck world from the specs and exposes
    `step(input)`, `state()` — planck is injected, so Node can drive the same code.
  - `LithiumTests.run()` — the runner used by `test.mjs`.
- Module script: loads three 0.170.0 and planck 1.5.1 (`dist/planck.mjs`) from jsdelivr, renders the
  sim (one flat mesh per fixture, updated from body transforms each frame), owns UI, input, audio, and
  persistence. A `window.__lithium` debug handle exposes `sim`, `step(n)` and `setValues()` for
  headless screenshots (rAF does not advance under virtual time).

## Testing

- `node game-lithium/test.mjs` runs `LithiumTests` (track geometry continuity, score mapping and
  monotonicity, RunMonitor end conditions, slider clamping/defaults).
- If `PLANCK_PATH` points at a local `planck.mjs`, the physics tests also run: the default car
  finishes level 1 headless; every level has one known slider-only solution (`SOLUTIONS`) that wins
  headless, and the default car does not win levels 2–5; zero motor speed ends "stuck"; extreme slider
  combinations stay finite.
- Browser: Browser pane check of garage → run → end → win flow, retina sharpness, console clean.
- Screenshot via headless Chrome using `__lithium.step` for a mid-run state.

## Out of scope

Continuous tracks, mutations/random cars, a parts-based builder (garage UIs 1–3 in the deck), touch
controls, coins/shop, mobile layout.
