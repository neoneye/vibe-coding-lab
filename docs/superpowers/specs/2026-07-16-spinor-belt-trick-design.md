# Spinor Belt Trick — Design

Date: 2026-07-16
Project directory: `3d-spinor-belt-trick/`

## Goal

A standalone HTML page visualizing the Dirac belt trick from the Wikipedia
[Spinor](https://en.wikipedia.org/wiki/Spinor) article: a cube attached to 6
belts spins continuously without the belts becoming tangled. After a 360°
rotation the belt spiral is reversed from its initial configuration; after a
full 720° the belts return exactly to their original configuration. The user
interacts with the rotation directly.

## Approach

Three.js via CDN importmap (jsdelivr, pinned version), matching the existing
`3d-shadows` / `3d-geo-guess` pattern. Single self-contained `index.html`.

Alternatives rejected: raw WebGL (boilerplate for no benefit), 2D canvas
pseudo-3D (depth sorting six twisting ribbons is painful and looks worse).

## The math

Cube orientation and belt shapes come from the classic null-homotopy of the
720° rotation loop, computed with unit quaternions in the `shared-code`
script block:

```
H(u, t) = exp(πt · â(u)) · exp(πt · ẑ)
```

- `t ∈ [0, 1]` is the animation phase, mapping to a cube rotation of 0–720°.
- `u ∈ [0, 1]` is the position along a belt: `u = 0` at the cube face,
  `u = 1` at the wall anchor.
- `â(u)` is a unit axis tilting from `ẑ` at `u = 0` to `−ẑ` at `u = 1`,
  e.g. `â(u) = (sin πu, 0, cos πu)`.
- `exp(θ n̂)` is the quaternion `cos θ + sin θ n̂` (a rotation by `2θ`).

Properties (each is a unit test):

- `H(0, t) = exp(2πt ẑ)` — the cube end rotates by `4πt` about the vertical
  axis: the cube spins twice per cycle, at constant rate.
- `H(1, t) = 1` for all `t` — wall anchors never move.
- `H(u, 0) = H(u, 1) = 1` for all `u` — the entire belt field is the
  identity at 0° and again at 720°: belts return exactly to their starting
  shape, smoothly, with no pop at 360°.
- `H` is smooth in both arguments — sampled neighbors stay within a small
  angular step.

At `t = 0.5` (360°) the belts are maximally spiraled; the spiral sense
reverses during the second revolution.

All six belts share the same field `H(u, t)`; each belt applies it to its own
rest pose (straight line from cube face to wall anchor).

## Scene

- Cube (~1 unit) with six distinct face colors, centered at the origin.
- Subtle room: dark walls or thin wireframe box (~6 units) so the wall
  anchors read as attached to something.
- Six ribbons, one per cube face, from face center to the matching wall
  anchor. Each ribbon is a strip mesh sampled at ~64 points along `u`.
  Per frame, point positions and ribbon frames are the rest-pose line and
  frame transformed by `H(u, t)` (positions rebuilt each frame,
  `needsUpdate` on the buffer attributes).
- Ribbon faces: front carries a bright stripe texture (CanvasTexture, stripe
  down the middle), back is a contrasting solid color — a twist is visually
  unmistakable. Implemented as the same strip rendered with a FrontSide and
  a BackSide material.
- Lighting: one directional + ambient; no shadows required.
- Camera: perspective, OrbitControls (drag orbits, scroll zooms).

## Controls

Bottom bar, monospace HUD styling consistent with sibling projects:

- Wide slider, 0–720°, with a live degree readout.
- Play/pause button; auto-spin advances the same `t`.
- Speed slider.
- Dragging the angle slider pauses auto-spin.

No snap buttons, no explainer text, no belt-count toggle (owner opted for
minimal chrome; striped two-sided belts are the one legibility feature).

## Testing

Repo pattern: math in a `<script type="shared-code">` block; `test.mjs`
extracts it (same extraction approach as `game-snake`) and runs with
`node test.mjs`. Tests cover the four `H` properties above plus:

- quaternion helpers (multiply, normalize, rotate-vector) against known
  values;
- belt endpoint positions: wall ends fixed for all `t`, cube ends equal the
  cube-rotated face centers.

## Out of scope

Mobile/touch layout polish, sound, belt-count toggle, explainer captions,
snap-to-angle buttons, physics-based belts.
