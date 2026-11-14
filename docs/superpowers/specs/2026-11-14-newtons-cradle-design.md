# Newton's cradle — design

Approved by the owner in conversation on 2026-11-14.

## Intent

A faithful, educational Newton's cradle where the interesting part is what
happens when the ideal assumptions break: materials, suspension, defects,
surface quality, the surrounding medium. No game mechanics.

## Approaches

1. **Event-driven "swap velocities"** — the textbook shortcut. Cheap, but it
   cannot show mixed materials, touching balls, elastic ropes or bumpy
   surfaces. Rejected.
2. **Contact-force model (picked)** — every ball is a point mass in 3D hanging
   from two strings (springs that only pull), with Hertz contact springs plus
   viscoelastic damping between neighbours, and an adaptive time step that
   drops to microseconds during a collision. The compression wave, the leak of
   energy into the middle balls, vertical bounce on elastic ropes and sideways
   drift from out-of-round balls all emerge from one model.
3. **Off-the-shelf rigid-body engine (Rapier)** — impulse solvers do not
   resolve the wave through a touching chain, and they break the single-file,
   offline convention. Rejected.

## What gets built

`newtons-cradle/index.html`, single file, canvas 2D with a hand-rolled
perspective view. Engine in a `shared-code` block, `test.mjs` runs its tests.

Eight demonstrations: perfect cradle (vacuum, lossless), desk toy (air, lossy
steel, nylon line), mixed materials, one defective ball, chains, elastic
ropes, rough out-of-round balls, unequal sizes.

Parameters: ball count, lift left/right and angle, per-ball material,
diameter, mass factor, restitution, hang offset and shape error; gap and
spacing error; suspension type, stiffness, damping, friction, drop; medium
and gravity; slow motion down to 1/20000; view.

Readouts: energy ledger by loss channel, swing-angle traces, and a collision
scope showing the force in each contact during the latest impact.

## Builder's calls

- 3D state per ball (swing, vertical, sideways) so ropes and rough balls behave.
- Restitution is given at 0.5 m/s and calibrated numerically to a dissipative
  constant; pair restitution is weighted by compliance (softer ball dominates).
- No ball spin and no friction between balls; listed in the page's
  "what is simplified" panel.
- Drag-to-lift on the canvas; optional impact sound, off by default.
