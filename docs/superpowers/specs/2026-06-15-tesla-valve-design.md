# 2D Tesla Valve — Design

Date: 2026-06-15

## Goal

An interactive, self-contained `index.html` that shows how a Tesla valve works.
Particles flow through a Tesla valvular conduit; the user adjusts particle size
and flow direction and sees the valve's directional resistance (diodicity)
emerge: forward flow passes easily, reverse flow is diverted into the
recirculation loops and resists. Larger particles get trapped/diverted more
readily, especially in reverse.

## Core principle

The diode behavior is **emergent**, not scripted. The valve is built from wall
line segments shaped as the classic series of teardrop recirculation loops along
a main channel. A uniform body force ("flow") pushes circular particles through;
particles collide and reflect off walls.

- **Forward flow:** loop mouths face away from the flow, so particles glide along
  the main channel.
- **Reverse flow:** the same geometry funnels particles into the loops, which
  curve back and oppose the main flow — producing recirculation, slowdown, and
  trapping.
- **Particle size:** larger radius ⇒ more wall contact ⇒ more diversion/trapping,
  most pronounced in reverse. This makes the size slider physically meaningful.

## Architecture

Single self-contained `index.html`, following the repo convention
(`shared-code` script block + bottom render script + `test.mjs`).

### `<script id="shared-code">` — pure logic, no DOM

- **Vector helpers**: add, scale, dot, length, normalize.
- **Geometry/collision**: closest point on a segment; circle-vs-segment overlap;
  positional correction + velocity reflection (with restitution) so a particle
  never remains inside a wall.
- **`buildTeslaValve(params)`**: returns an array of wall segments from
  parameters (loop count, segment spacing, channel width, loop angle, bounds).
  Also exposes inlet/outlet regions.
- **`Particle`**: position, velocity, radius; `step(dt, force, walls, drag)`
  integrates motion, applies drag, resolves collisions.
- **`Simulation`**: holds walls + particles; `emit()` spawns particles at the
  current upstream end; `advance(dt)` steps all particles, culls those past the
  downstream exit while counting them (throughput), recycles/culls stuck ones.
  Direction flips by reversing the force vector and swapping inlet/outlet roles.
- **`TeslaTests`**: returns `true`/`false` from `run()`.
  - Reflection: a particle driven into a wall ends up outside it with reflected
    normal velocity.
  - Containment: after many random steps, no particle center sits inside a wall
    by more than a small epsilon.
  - Geometry: `buildTeslaValve` produces the expected number of segments for a
    given loop count.
  - **Diodicity integration test**: with identical force magnitude and particle
    stream, forward throughput over N steps is meaningfully greater than reverse
    throughput. This asserts the model actually demonstrates the valve effect.

### `<script>` — DOM + render (bottom of file)

- Canvas 2D render loop: draws walls (strokes), particles (dots colored by
  speed), a flow-direction arrow, and a stats panel.
- Wires controls to the `Simulation`.
- `requestAnimationFrame` loop with fixed-timestep accumulator for stable physics.

### `test.mjs`

Extracts the `shared-code` block and runs `TeslaTests.run()`, exiting non-zero on
failure — identical pattern to sibling projects (e.g. `2d-cloud-chamber`).

## Controls

- **Flow direction**: Forward / Reverse toggle (central to showing diodicity).
- **Particle size**: slider (radius).
- **Flow strength**: slider (body-force magnitude).
- **Emission rate**: slider (particles/sec).
- **Pause** and **Reset** buttons.
- **Throughput readout**: live particles-reaching-exit rate, shown for the
  current direction so the diode effect is visible as a number.

## Rendering / style

- Dark background, light channel walls.
- Particles drawn as dots, color mapped to speed (slow = cool, fast = warm).
- Large arrow indicating current flow direction.
- Compact stats panel (throughput, particle count, direction).

## Gallery integration

- Add a title override to `gallery.yaml` (`2d-tesla-valve: 2D Tesla Valve`).
- Add `screenshot1.png` captured via headless Chrome, matching siblings.

## Out of scope (YAGNI)

- Real Navier–Stokes / grid fluid solver (illustrative particle model chosen).
- Particle–particle collisions (only particle–wall).
- Saving/sharing state, multiple valve designs beyond parameterized geometry.
