# How a submarine works — design

**Intent.** A standalone page, `submarine/index.html`, that demonstrates how a submarine
dives, holds depth and surfaces. The owner asked for lots of parameters and two exercise
maps: a 2D side view to build intuition for ascending and descending, and a harder 3D map
seen first-person from the captain's position. Inspiration and conventions:
`continuous-track/` (collapsible side cards, presets, levers + keys, shared-code physics
block with `test.mjs`, URL review hooks, a "What is simplified" card).

**Goals.**
- A faithful, educational model of buoyancy control: main ballast tanks with vents and
  compressed-air blows, trim and compensating tanks, hydroplanes, propulsion, hull
  compression with depth, sea water density with depth (thermocline), Boyle's law for the air
  in the tanks.
- The 2D map teaches the feel: you see the tanks fill, the air expand, the forces as arrows.
- The 3D map is harder because it is realistic: murky water, little to see, the captain flies
  on instruments.
- Lots of parameters (target ~60), grouped in collapsible cards, plus presets.

**Non-goals / anti-goals.**
- No score, timer ranking, lives or play-as modes (CLAUDE.md). Exercises are a list of tasks
  ticked done or not done, plus a free sandbox.
- No combat, torpedoes, sonar contacts to hunt.
- Not a flight-sim-style arcade: the boat must be heavy, slow to respond, and overshoot when
  handled badly, because real boats do.

## Approaches

- **A. One page, one physics core, 2D on Canvas 2D, 3D in three.js (chosen; owner left the
  how to me).** The 2D map is a cutaway diagram with tank water levels, air volumes, plane
  angles and water coloured by density; the 3D map runs the same boat in three.js. The 2D map
  constrains the same 3D body to the vertical plane.
- B. Both maps in three.js, 2D as an orthographic side camera. One renderer, but the cutaway
  and density shading are harder and read less like a diagram.
- C. Two pages. Duplicated physics, split gallery entry, against the one-page convention.

## Physics core (shared-code block, tested in Node)

Rigid body with surge, heave, pitch (2D) plus sway, yaw and a stiff roll (3D). Fixed time
step (~1/120 s) with substeps; time warp ×1/×2/×4/×8 because diving is slow.

- **Hull.** Length, diameter, pressure-hull volume, structural mass, centre of gravity height
  below centre of buoyancy (BG, gives pitch and roll righting moment), hull compressibility
  (fractional volume loss per MPa; steel hulls compress more than sea water, so the boat gets
  heavier going deeper), test depth and collapse depth. Past test depth a warning; past
  collapse depth the hull fails and the run stops with an explanation (a fact of the model,
  not a game over screen).
- **Surfaced buoyancy.** Submerged volume of the hull cross-section as a function of draft
  (circle-segment area), plus the sail; waterplane gives surfaced stability. Waves: simple
  surface swell, optional.
- **Main ballast tanks (fore and aft).** Open at the bottom (flood holes), vent valve on top.
  State per tank: mass of air. Air volume follows Boyle at ambient pressure (plus a small
  temperature-free assumption); water fills the rest. Vents open → air escapes at a rate set
  by vent area and pressure difference → tank floods. Blow → HP air flows from the air bank,
  rate falls as ambient pressure approaches bank pressure; bank pressure drops as air is used.
  Air in a shut tank expands on the way up, so an ascending boat with air in the tanks gets
  lighter: the runaway ascent is real and visible.
- **Negative tank** (WWII preset): flooded to dive fast, blown at depth.
- **Compensating (auxiliary) tank**: pump to sea / flood from sea, slow, for fine weight.
- **Trim tanks fore and aft**: pump water between them to move the centre of gravity.
- **Hydroplanes**: bow (or sail) planes and stern planes, each an angle; lift ∝ ρ·v²·area·
  lift slope, stall beyond a stall angle; stern planes mostly pitch the boat, bow planes mostly
  change depth. Planes do nothing at zero speed.
- **Rudder** (3D): yaw force ∝ v².
- **Propulsion**: engine telegraph lever → thrust from shaft power and speed; drag ∝ v²
  (surge), large cross-flow drag in heave and sway; added mass; damping in pitch and yaw.
  Surfaced: extra wave-making drag.
- **Water column**: surface density, temperature/salinity profile collapsed into density vs
  depth with a thermocline (depth, thickness, density jump), sea-water compressibility,
  gravity. Optional current (3D: by region, and the 2D map's along-track component).
- **Seabed contact**: soft contact with a sand/rock bottom, friction; touchdown speed
  reported. Terrain collision in 3D stops the boat and logs "grounded / collided".

Readouts: depth, depth under keel, speed, pitch, heading, ambient pressure, weight, buoyancy,
net buoyancy (kg), trim moment, each tank's water %, air bank pressure, plane angles,
hull state.

## Presets (my calls, numbers from memory, marked approximate on the page)

Modern attack submarine (large, fast, deep test depth), WWII diesel boat (negative tank,
shallow test depth, fast dive), Holland-era early boat (small, single tank, poor stability),
deep research submersible (no main ballast for depth: drop weights + variable ballast,
very deep), bathyscaphe (gasoline float, iron shot ballast released electromagnetically).
Presets that lack a mechanism grey out its controls.

## 2D map: side view

Canvas 2D, HiDPI backing store. Long side-on section: surface with swell, water shaded by
density, a thermocline band, seabed profile with a shelf, a drop-off and a flat pad. The boat
drawn as a cutaway: tank water levels and air, planes at their angles, propeller turning.
Toggleable force arrows (weight, buoyancy, plane lift, thrust, drag). Camera follows with an
optional vertical exaggeration-free scale bar and depth ruler. A small depth-vs-time chart.

Exercises (ticked in a list; each has a one-line hint on how a real crew does it):
1. Dive from the surface to periscope depth (~18 m) and hold it ±1 m for 20 s.
2. Pass through a marker at 60 m.
3. Cross the thermocline and re-trim to neutral (|net| < 50 kg).
4. Hover: stop the engine and hold depth ±2 m for 30 s using the compensating tank.
5. Settle on the seabed pad slower than 0.3 m/s.
6. Surface again: blow and ride up without broaching faster than a limit.
Plus "Free dive" (no tasks).

## 3D map: captain's view

three.js, first person from the control position, looking forward through a view port /
external camera feed (stated on the page: a real attack boat has no windows; this is the
equivalent of the submersible view port). Mouse drag to look around within limits. Water is
murky: exponential fog of a few tens of metres, light falling off with depth to near-black,
the boat's own lights reach a short way. Periscope view (key) only works at periscope depth or
shallower and shows the surface.

Instrument overlay (HTML/canvas on top): depth gauge, depth-under-keel echo sounder strip,
trim inclinometer, heading compass, speed log, ballast board (vent and blow lamps per tank),
tank levels, air bank pressure, plane angle indicators, and a forward-looking sonar fan that
shows terrain returns and markers ahead.

Course (fjord / canyon terrain, procedural but fixed seed): a buoy start on the surface,
lit ring markers moored at set depths, a thermocline, a current through a narrow channel, an
overhang/arch to pass under, a seamount to climb over, a seabed landing pad, a surface pickup
buoy at the end. Tasks are ticked as rings are passed and conditions met; the list shows the
next task with its depth and bearing.

## Controls

Same in both maps (3D adds rudder and view):
- Vents fore/aft (toggle), blow fore/aft (hold), emergency blow (all), negative tank flood/blow,
  compensating tank flood/pump, trim fore↔aft pump.
- Bow planes and stern planes levers (optionally linked), engine telegraph lever, rudder (3D).
- Keys (builder settles exact mapping and shows it in a Keys card).

## Page conventions

Collapsible cards left and right as in continuous-track; map switch 2D / 3D at top; presets;
Pause, Reset, time warp, Save image (renders from a clean canvas, subject centred); Explain
cards (Archimedes, why boats get heavier as they go deeper, why air expands on the way up,
why planes need speed, trimming) and a "What is simplified" card. Review hooks:
`?map=2d|3d&preset=&task=&t=&pause=1`, any parameter name as a URL param, `__sub.step(s)`.
`test.mjs` runs `SubTests.run()` from the shared-code block: neutral trim holds depth, open
vents sink the boat, Boyle expansion on ascent, hull compression makes the boat heavier with
depth, planes give no lift at zero speed, blow rate falls with depth.

Gallery card + README entry + screenshot. Verify in the Browser pane; layout check in
Firefox where possible.

## Settled after the builder check (my calls)

- **One core.** A single body with all six degrees of freedom; the 2D map freezes sway, yaw
  and roll. Tests run the same core.
- **3D tasks.** Rings ~10 m across; the course is ordered and the next task is highlighted,
  but a missed ring does not block later ones (fly back and retry). Each task has a numeric
  pass rule shown in its line (ring passed within its radius; landing < 0.3 m/s; under the
  arch without touching; surface beside the pickup buoy within 30 m).
- **Parameters** are live-editable mid-run where that makes physical sense (tank and hull
  sizes re-derive the state, keeping fill fractions); every parameter is accepted as a URL
  parameter. ~60 is a target, not a hard count.
- **Submersible and bathyscaphe get their own mechanisms**: drop weights (release
  discrete steel weights), a variable-ballast sphere pumped against sea pressure; a
  gasoline float modelled as a buoyant volume of gasoline whose compressibility is higher
  than sea water's, plus iron shot released at a chosen rate. Tests cover them.
- **Failure and recovery.** Past collapse depth the simulation stops and explains why; Reset
  puts the boat back at the start of the current exercise and keeps ticked tasks. Collisions
  are soft contacts with friction: the boat stops or slides, and the event is logged.
- **Views.** The 3D map drives from the captain's view; an optional outside (observer)
  camera is there for understanding and screenshots, off by default. Save image saves the
  current view without the UI panels.
- **Verification.** Node tests for physics; 3D checked in the Browser pane plus a headless
  Chrome screenshot; Firefox layout check where possible.

## Left to the builder

Exact numbers, key mapping, terrain shape, visual style, fog and light constants, which
parameters go in which card, chart details, sound (optional: ballast hiss, blow roar, hull
creak near test depth).

## Deferred

Snorkel/diesel/battery energy, torpedo trim compensation, crew moving fore/aft, depth-keeping
autopilot, real hydrodynamic derivatives, sonar physics beyond a terrain-return fan.
