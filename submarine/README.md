# Submarine

How a submarine dives, holds its depth and surfaces. Open `index.html` in a
browser. The 3D map loads three.js from a CDN, so it needs a network connection.

## What to try

- **Dive.** On the surface, open both vents (V). A boat trimmed to be neutral
  only sinks to its deck: go ahead (W) and put the planes on dive (↓).
- **Watch Boyle's law.** Blow the tanks at depth (B) and watch the air in the
  cutaway grow as the boat rises. A short blow at 100 m ends as a fast ascent.
- **The thermocline.** Go below the layer and watch Net buoyancy: the colder,
  denser water makes the boat lighter. The chart "net buoyancy at each depth"
  shows the step, and how the hull's compression makes a deep boat heavier.
- **Hover.** Stop the engine and hold depth with the compensating tank alone.
  The planes do nothing without speed.
- **The 3D map** is murky on purpose: find the next ring on the sonar, steer
  for the bearing on the compass, and level off by the depth gauge. The
  channel has a cross-current, the arch has rock overhead, the sill comes up
  steeply. Come up to periscope depth to use the periscope (Z).
- **Other boats.** The WWII boat dives fast on its negative tank, the Holland
  boat has a test depth of 23 m, the submersible sinks on drop weights and the
  bathyscaphe on a float of gasoline that gets heavier as it is squeezed.

## Controls

Ballast board and levers at the bottom of the screen; the Keys card lists the
keyboard. `W S` telegraph, `↑ ↓` planes, `A D` rudder, `V` vents, `B` blow,
`E` emergency blow, `G H` compensating tank, `T Y` trim pumps, `Z` periscope,
`O` outside view, `[ ]` time warp, `R` reset to the start of the task.

## The model

- The hull is a rigid body of revolution in 14 stations, each with buoyancy
  (circle-segment immersion near the surface), cross-flow drag and seabed
  contact. Rigid-body equations with added mass and a Munk moment.
- Main ballast tanks are open at the bottom; the air in each obeys Boyle's
  law and the water finds its level at once. Vents follow an orifice law on
  the air column's head; blows draw choked flow from a finite air bank.
- Planes, fins, rudder and sail are wings with lift proportional to speed
  squared and a simple stall.
- Sea water density from a linear equation of state (temperature, salinity,
  pressure) with a smooth thermocline.

The page's "What is simplified" card lists what is left out. Preset figures
are approximate.

## Review hooks

URL parameters: any parameter name (`?tcDepth=60`), `map=2d|3d`,
`preset=ssn|ww2|holland|dsv|scaphe`, `task=N` (1-based), `t=seconds`
simulated before the first frame, `ctl=telegraph:0.4,stern:-0.3,vent:1`,
`cam=captain|periscope|outside`, `zoom=`, `pause=1`, `bare=1`.
`__sub.step(seconds)` advances the simulation from the console.

## Tests

`node test.mjs` runs the physics checks in the page's shared-code block.
