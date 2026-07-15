# BASEMENT — Sublevel K, Tape #7

A standalone Wolfenstein-style raycaster in a single HTML file. No backend,
no build step, no external assets — every texture, sprite, and sound is
generated in code at boot. Works straight from `file://`.

**Play:** open `index.html` in a browser, click to insert the tape.

## Premise

You are a servant in the sub-basement of the Dictator's bunker, seen through
a battered VHS security camera. You come to in the filthy staff restroom —
the figure in the grimy mirror wears a gas mask, so you never see your own
face. The deeper you push north, the richer it
gets: Backrooms-yellow servant quarters → concrete utility tunnels → brick
guard barracks → marble residence wing → the gold throne hall. They live in
marble. You live in the mold. Tonight you take the pipe and go upstairs.

## Controls

| Input | Action |
|---|---|
| Click | capture mouse (pointer lock) |
| WASD / arrows | move (arrows also turn) |
| Mouse | look |
| LMB / Space | attack |
| E | open doors |
| 1 / 2 / 3 | fists / lead pipe / slingshot |
| Shift | sneak (guards spot you later, aim worse) |
| Tab (hold) | map |

## Progression

Pipe (servant hall) → slingshot + bolts (tunnel store room) → brass key
(guarded, tunnel dead end) → steel door to the barracks → gold key (residence
wing side chamber) → the throne hall.

## Tech notes

- Grid raycaster (DDA), textured walls, Wolf3D-style sliding doors rendered
  on the cell mid-plane (auto-close after ~5s with rusty stick-slip hinge
  audio; they refuse to close on anyone standing in them), billboard sprites
  clipped against a per-column z-buffer, particles, projectiles.
- VHS pass at composite time: chromatic fringe, animated static, scanlines,
  tracking-band glitches, head-switching noise, vignette, burned-in VCR OSD.
- Fake dynamic lights: sodium-vapor ceiling lamps (amber wall tint per column,
  additive glow billboards, flicker/dropout-restrike, ballast buzz swells) in
  the industrial zones, and guard flashlights (smoothed beam sweep, dusty
  cone, wall hot spot, lens glare when the beam finds the camera).
- The restroom mirror is a special wall tile: the player's reflection is a
  gas-masked billboard mirrored across the glass plane and clipped, column by
  column, to the screen columns that actually hit mirror glass — grime
  streaks and panel frames cut into it.
- WebAudio-synthesized sound (hum, shots, alarm, stings).
- URL params: `?auto` skips the title screen; `?debug` exposes
  `window.__dbg` (player/enemies/doors) for scripted testing.
