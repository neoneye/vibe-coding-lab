# Simulate Hand — 27-DoF Humanoid Hand Simulator

**Date:** 2026-07-15
**Project:** `simulate-hand/`
**Status:** Approved

## Goal

A standalone HTML page simulating a 3D humanoid right hand with 27 degrees of
freedom. The user orbits/zooms the camera, drives every actuator with sliders,
and picks up a sphere, a cube, or a pencil. The page visualizes skin pressure
as a heatmap on the hand surface and per-actuator stress, and the pressure
pattern visibly depends on the shape of the grasped object.

## Non-goals

- No rigid-body physics engine (no rapier/cannon-es). Grasping is kinematic
  with an analytic contact model.
- No left hand, no arm, no multi-object scenes.
- No object slip/friction simulation — a grasped object attaches rigidly.

## Architecture

Single self-contained `simulate-hand/index.html` following repo conventions:

- three.js 0.170 from jsdelivr CDN via import map, `OrbitControls` for camera.
- Pure logic (kinematics, SDFs, contact/pressure/stress math) lives in a
  `<script type="text/plain" id="shared-code">`-style shared block (same
  pattern as `game-snake/`), evaluated by the page and by `test.mjs` under
  node for unit testing.
- Rendering, UI, and DOM wiring live in a separate module script.

### Components

1. **HandModel** — builds a 17-bone skeleton (root + palm + 3 phalanx bones
   per digit × 5) and a procedural smooth
   `SkinnedMesh` (palm box + tapered finger capsules, merged and smoothed),
   with per-vertex skin weights. Exposes `setPose(angles[27])`.
2. **DoFTable** — static description of all 27 DoF: name, joint, axis,
   min/max (anatomical limits), default. Order: wrist 6 (pos XYZ, rot
   pitch/yaw/roll), thumb 5 (CMC abd, CMC flex, MCP abd, MCP flex, IP flex),
   then index/middle/ring/pinky 4 each (MCP abd, MCP flex, PIP flex, DIP
   flex).
3. **SkinSensors** — ~200 sample points on the hand surface (denser on
   fingertips and palm), each bound to a bone with a local offset and an
   outward normal. Each frame they are transformed to world space.
4. **ObjectSDF** — analytic signed-distance functions for sphere, box
   (cube), and capsule (pencil), plus surface normal via gradient.
5. **ContactModel** — per frame: pressure_i = k · max(0, −sdf(sensor_i)).
   Splats pressure to nearby skin vertices → vertex-color heatmap
   (blue→green→yellow→red).
6. **GraspLogic** — object selector places object at a rest pose in front of
   the palm. "Grasp" tweens sliders to a canned per-object pose (power grasp
   for sphere/cube, precision pinch for pencil). When contact normals oppose
   (spread of contact-normal directions exceeds a threshold and total force
   exceeds a minimum), the object attaches to the wrist frame and follows
   wrist sliders. "Release" tweens the hand open and the object falls back to
   rest with a simple gravity tween.
7. **ActuatorStress** — per-joint stress = Σ (child-link sensor pressures ×
   moment arm about the joint axis) + joint-limit strain term. Displayed as
   (a) glowing joint spheres on a toggleable skeleton overlay (green→red)
   and (b) a stress bar under each slider.
8. **UI panel** — collapsible groups (Wrist, Thumb, Index, Middle, Ring,
   Pinky), one slider + value + stress bar per DoF; object selector;
   Grasp / Release buttons; skeleton-overlay toggle; readouts for total grip
   force and max skin pressure.

### Data flow

sliders → pose angles → skeleton bones → sensor world positions →
SDF contact test → pressures → (skin heatmap, joint stress, grasp state) →
render. One pass per animation frame; everything deterministic.

## Error handling

- Sliders clamp to joint limits; grasp tween respects limits.
- If WebGL is unavailable, show a plain-text error message.
- Grasp attach/detach is hysteretic (attach threshold > detach threshold) to
  avoid flicker at the boundary.

## Testing

`simulate-hand/test.mjs` (node, no deps) exercises the shared-code block:

- SDF correctness: known distances for sphere/box/capsule, inside/outside.
- SDF gradient ≈ analytic normal.
- Joint limits: DoF table sane (min < default < max), clamping works.
- Forward kinematics: fingertip positions move monotonically with flexion.
- Contact/pressure: closing pose on a sphere yields fingertip+palm pressure;
  cube yields pressure concentrated at edges relative to sphere; pencil
  contacts only a thin band of sensors.
- Grasp detection: opposing contacts attach, open hand detaches.

Visual verification: headless Chrome screenshot (drive the pose
synchronously per the rAF-loop screenshot memory) for the gallery.

## Success criteria

- 60 fps orbit/zoom with heatmap live.
- All 27 sliders move the expected joint.
- Grasp button reliably picks up each of the three objects; wrist sliders
  lift them.
- Sphere/cube/pencil produce visibly different pressure patterns.
- Actuator stress rises when squeezing harder into an object.
