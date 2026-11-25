# Submarine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `submarine/index.html`, one self-contained page with a shared submarine physics core,
a 2D cutaway side-view exercise map and a murky 3D captain's-view exercise map.

**Architecture:** A `<script id="shared-code">` block defines `SUB` (pure physics, no DOM) and
`SubTests`. A module script builds the UI (parameter cards, ballast board, levers, keys), a
Canvas 2D renderer for the side map and a three.js renderer for the 3D map; both drive the same
`SUB.step`. The 2D map freezes sway, yaw and roll.

**Tech Stack:** Vanilla JS, Canvas 2D, three.js 0.170.0 from jsdelivr via importmap (as in
continuous-track), Node for `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-25-submarine-design.md`

## Global Constraints

- One `index.html`, no build step; three.js only from `cdn.jsdelivr.net/npm/three@0.170.0`.
- No score, lives or game-over screens; tasks are ticked done / not done.
- Canvas backing stores sized in device pixels (HiDPI).
- Save image renders the current view from a clean canvas, no UI panel offsets, subject centred.
- Review hooks: `?map=2d|3d&preset=&task=&t=&pause=1&cam=`, any parameter name, `__sub.step(s)`.
- Gallery card in `index.html`, README entry, `submarine/README.md`, `submarine/screenshot1.jpg`.

## Review Focus

1. Boat surfaced with vents shut must float steady at its waterline (no bobbing drift, no slow
   sink) — test `surfacedFloatsSteady`.
2. Huge time warp with stiff seabed contact must not explode — test `bottomedStaysPut` at the
   largest substep the page uses.
3. Empty air bank: blowing does nothing, no NaN — test `emptyBankNoNaN`.
4. Preset switch mid-dive keeps the state finite and tank fills within [0, capacity] — test
   `presetSwitchFinite`.
5. Boat pitched steeply (±60°) must keep finite Euler maths — test `steepPitchFinite`.

---

### Task 1: Physics core and tests

**Files:** Create `submarine/index.html` (shared-code block only, plus a stub page),
`submarine/test.mjs` (copy of continuous-track's runner calling `SubTests.run()`).

**Interfaces — produces:**
- `SUB.DEFAULTS` (flat param object), `SUB.PRESETS` (`{key:{label,...overrides}}`),
  `SUB.BOAT_KEYS` (keys a preset resets).
- `SUB.density(P, depth) -> kg/m³` (linear EOS: temperature, salinity with a smooth
  thermocline, pressure compressibility).
- `SUB.createSim(P, world) -> S`; `world = { seabed(x,y)->depth, ceiling(x,y)->depth|null,
  current(x,y,depth)->[n,e] , planar:bool }`.
- `SUB.reconf(S)` after a parameter change (keeps fill fractions).
- `SUB.step(S, dt)`; `S.ctl = { telegraph, bowPlane, sternPlane, rudder (−1..1),
  vent:[f,a], blow:[f,a], emergency, negFlood, negBlow, compFlood, compPump, trimFwd, trimAft,
  dropWeight (edge count), shotRelease, gasRelease }`.
- `SUB.readout(S) -> { depth, keelClear, speed, pitch, heading, roll, pAmb, weight,
  buoyancy, net, trimMoment, tanks:[{name,frac,cap}], bank, hull:'ok'|'test'|'failed' ,...}`.
- `S.p=[n,e,d]`, Euler `S.psi,S.theta,S.phi`, body velocities `S.u,S.v,S.w`, rates `S.p_,S.q,S.r`.

**Model decisions (from the spec, my numbers):** body frame x fwd, y stbd, z down (SNAME);
12 hull stations with a tapered radius profile, each giving circle-segment buoyancy, cross-flow
drag and seabed/ceiling penalty contacts; tanks as boxes at fixed stations; MBT air by
Boyle with bisection for the internal water level; choked/subsonic blow flow from a finite
bank; vents flow by orifice law on the air-column head; lifting surfaces (fins, planes,
rudder, sail) at their positions with stall; Munk moment from added-mass difference; rigid
body equations with cross terms; substep 1/240 s.

- [ ] Write `SubTests` with: `neutralHoldsDepth` (trimmed boat at 50 m, 60 s, |Δdepth| < 1 m),
  `ventsSinkBoat` (surfaced, vents open → depth > 15 m within 120 s),
  `boyleAscent` (shut tank holding air at 100 m: air volume at 20 m ≈ 100/20 pressure ratio within 3 %),
  `hullHeavierWithDepth` (net weight at 300 m > at 50 m),
  `planesNeedSpeed` (zero speed: plane force = 0; at 5 m/s ≠ 0),
  `blowVolumeFallsWithDepth` (displaced m³/s at 200 m < at 20 m),
  `dropWeightRises` (submersible after dropping all weights rises),
  `gasolineCompresses` (bathyscaphe heavier at 2000 m than at 100 m),
  plus the five Review Focus tests. Run `node submarine/test.mjs` → fails (no SUB).
- [ ] Implement SUB until `node submarine/test.mjs` prints all PASS and exits 0.
- [ ] Commit `submarine: physics core and tests`.

### Task 2: Page shell, panels and controls

**Consumes:** Task 1. **Produces:** `P`, `S`, `GROUPS` (continuous-track style `R/SEL/CHK`
items), `setMap('2d'|'3d')`, `resetRun()`, `ctlFromInput()`, readout + charts (depth/time,
net buoyancy/time, density profile with the boat), Explain and What-is-simplified cards.

- [ ] Layout: left column (title, map switch, presets, run buttons, parameter cards, Keys,
  How it works, What is simplified), right column (Now readout, Charts, Tasks), bottom strip
  (ballast board buttons greyed when capacity 0; levers: telegraph, bow planes, stern planes,
  rudder in 3D only). Keys: W/S telegraph ±0.1, X stop, ↑/↓ planes (rate, linked unless
  unlinked), A/D rudder, C centre, V vents, B blow (hold), Space emergency blow (hold),
  N negative flood/blow toggle, G/H compensating flood/pump, T/Y trim fwd/aft, J drop weight,
  K shot, L gasoline, Z periscope, O outside view, [ ] time warp, P pause, R reset.
- [ ] URL hooks and `window.__sub = { S, P, step(sec), setMap, task }`.
- [ ] Check in the Browser pane: no console errors, panels don't overlap. Commit.

### Task 3: 2D side-view map and exercises

**Consumes:** Task 2. Planar world: seabed profile with shelf, drop-off, pad at `padDepth`,
basin at `basinDepth`; markers at `markerDepth`; thermocline from water params.

- [ ] Renderer: water shaded by density, thermocline band, swell, seabed, cutaway boat (tank
  water/air levels, planes, prop, sail), bubbles from vents / flood holes, force arrows
  (toggle), depth ruler, scale bar, overview strip, wheel zoom.
- [ ] Six tasks + Free dive with the numeric rules of the spec; tasks beyond the preset's test
  depth show "beyond this boat's test depth".
- [ ] Browser-pane check of each preset diving and surfacing; screenshot. Commit.

### Task 4: 3D captain's-view map

**Consumes:** Task 2; world built from a height field (fjord) + arch ceiling + channel current,
horizontal scale from boat length.

- [ ] three.js scene: terrain, sea surface seen from below, exp fog by visibility and depth
  light, marine snow, boat lights, rings, buoys, arch, pad; captain camera (mouse look),
  periscope (≤ periscope depth), outside camera with a boat model.
- [ ] Instruments canvas: depth dial, inclinometer, compass tape, speed log, echo sounder strip,
  overhead clearance, sonar fan, ballast lamps, next task bearing/depth.
- [ ] Ordered tasks: rings, under the arch, over the seamount, pad landing, surface by buoy.
- [ ] Browser-pane check, headless screenshot. Commit.

### Task 5: Ship

- [ ] README entry, gallery card, `submarine/README.md`, screenshot1.jpg, Save image check,
  Firefox layout check. Commit `submarine: README, gallery entry and screenshot`.
