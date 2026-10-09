# Wrecking Ball — Cab and Ball views

Date: 2026-10-09
Project: `3d-wrecking-ball/index.html`

## Goal

Two first-person views next to the existing orbit camera: the crane
operator's seat in the cab, and a ride on the wrecking ball itself.

## Switching views

- World card gets a **View** row: three buttons **Orbit · Cab · Ball**, the
  active one highlighted. **C** cycles Orbit → Cab → Ball → Orbit.
- "Camera follows the ball" only affects Orbit.
- `#hint` text changes per view.
- Crane keys (arrows, WASD, QE) and Space (shove) work in every view.

## Cab view (crane operator)

- Eye point seated at the back of the cab (slew-local `1.05, 2.55, 0.7`), a child of `slewGroup`, so the view
  turns with slew and with the tracks.
- Default gaze: toward the ball, smoothed (operator watches the load).
- Drag on empty space turns the head: yaw offset clamped to ±120°, pitch of the
  final gaze clamped to −60°…+70°. Double-click resets the head offset to 0.
- Wheel changes field of view, 20°–75° (default 50°).
- Window frame is real 3D geometry attached to `slewGroup` at the cab: four
  corner pillars, a roof rim, a sill/dashboard and two joystick levers. Shown
  only in Cab view; the solid cab box is hidden in Cab view.
- Grabbing the ball works as in Orbit (raycast from the active camera).

## Ball view (stabilised rider)

- Camera rides above and behind the top of the ball relative to the look
  direction: up `r + 0.35`, back `1.1 r` (tuned visually), so the curve of
  the ball fills the bottom quarter of the frame. Ball spin is ignored; no
  roll, always upright. The chain is hidden in this view: it rises about a
  metre in front of the rider and its face-on links blocked much of the frame.
- Look direction (horizontal): horizontal velocity direction when horizontal
  speed is above 1.5 m/s, the direction to the target centre below 0.5 m/s,
  linearly blended in between. Smoothed with a ~0.3 s time constant. Pitch −4°.
- No grabbing from Ball view (pointer drag does nothing); Space still shoves.
- Wheel changes field of view, 20°–75°.
- Known limitation: on a hard hit the camera may dip into a block for a few
  frames. No camera collision.

## Shared

- Near plane 0.05 in Cab and Ball, 0.5 in Orbit.
- Field of view resets to 50° when entering Orbit.
- Sound panning already projects through the active camera; no change.
- Pure math goes in the shared-code block as `Wreck.view` and is tested in
  `WreckTests`:
  - `ballGaze(vel, toTarget)` → unit horizontal direction (velocity / target
    blend, thresholds above, degenerate inputs fall back to the other vector
    or `[0, 0, 1]`).
  - `smoothDir(cur, want, dt, tau)` → unit horizontal direction turned toward
    `want` by `1 − exp(−dt/tau)`; handles opposite vectors.
  - `clampHead(yaw, pitch)` → clamped offsets.
- Debug handle: `__wreck.setView(name)` and `__wreck.view`.

## Out of scope

Camera collision, mouse look while riding the ball, cab interior beyond the
frame and levers, gamepad.
