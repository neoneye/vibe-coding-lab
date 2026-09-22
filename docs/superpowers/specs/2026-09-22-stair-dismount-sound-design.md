# Stair Dismount — Sound Effects Design

**Date:** 2026-09-22
**Directory:** `3d-stair-dismount/`
**Extends:** `2026-09-02-stair-dismount-design.md`
**Deliverable:** Changes to `index.html` only (new pure helpers in the `shared-code` block with self-tests, a new inline audio module, one checkbox, one hotkey). `test.mjs` runs unchanged.

## Purpose

The ragdoll tumbles in silence. Add cartoonish sound effects so the dismount is funnier: a punch when the push lands, a wobbly scream while the body is in motion, thuds and grunts on every impact, and a sharper bonk when the head hits. Everything is synthesized with Web Audio, no sample files, matching `3d-wrecking-ball`.

## Decisions settled with the owner

- **Project:** `3d-stair-dismount`.
- **Vocal style:** cartoonish, every hit. A scream starts at the push and continues while the body is moving; each impact adds a grunt scaled to force.
- **Source:** Web Audio synthesis inline (approach A). Recorded samples and the Web Speech API were rejected.

## Pure logic (`Dismount.sfx` in `<script id="shared-code">`)

All functions are pure and deterministic. They decide *what* to play; the audio module decides *how*.

- `sfx.thresholds = { thud: 400, grunt: 1200, loud: 4000 }` newtons. `thud` equals `score.threshold`, so every scoring contact makes a sound.
- `sfx.impactGain(force)` → 0..1. 0 at or below `thud`, rising with the square root of the excess, reaching 1 at `loud` and clamped there. Square root keeps light taps audible without making big hits clip.
- `sfx.impactKind(partName, force)` → `'none' | 'thud' | 'grunt' | 'bonk'`. Below `thud` → `'none'`. Head at or above `thud` → `'bonk'`. Any other part at or above `grunt` → `'grunt'`, otherwise `'thud'`. The audio module plays a thud under every grunt and bonk as well, so the kind names the *extra* layer.
- `sfx.cooldown = 0.08` seconds. `sfx.allow(last, partName, t)` → boolean; `last` is a `{ partName: time }` map, mutated in place when the sound is allowed. Sliding contact fires a force event every tick, so a per-part cooldown stops machine-gunning. The head is exempt from the cooldown so no bonk is dropped.
- `sfx.screamRate(slowmo)` → playback-rate multiplier `max(0.25, slowmo)`. Slow motion pitches the scream and all bursts down by the same factor; floored so 0.1× does not become sub-audible.
- `sfx.pushGain(percent)` → 0.35 + 0.65 · percent / 100, clamped to 0..1.

### Self-tests (appended to `DismountTests`)

- Impact gain is 0 at threshold, monotonic, 1 at `loud`, still 1 at 10 000 N.
- Kind: 300 N foot → none, 500 N foot → thud, 1500 N foot → grunt, 500 N head → bonk.
- Cooldown: two thud calls for the same part 0.02 s apart allow only the first; 0.1 s apart allow both; two different parts at the same instant both allow; head allows twice at 0.02 s.
- Scream rate floor and identity: `screamRate(1) === 1`, `screamRate(0.1) === 0.25`.
- Push gain endpoints: 0 → 0.35, 100 → 1, 150 → 1.

## Audio module (inline, after the physics setup)

A single object `audio = { ctx, master, noise, enabled, scream, last }`.

- **Unlock.** `audio.init()` creates the `AudioContext` and a 2 s white-noise buffer the first time a push happens or the Sound checkbox is turned on. Browsers require a user gesture, and both of those are gestures. If the constructor throws, `audio.enabled` stays false and the checkbox is disabled with the title "Web Audio unavailable".
- **Master gain** at 0.8. Toggling Sound off ramps master to 0 over 50 ms and stops the scream; toggling on ramps back.
- **Noise burst** helper as in `3d-wrecking-ball`: a `BufferSource` of the noise buffer through a `BiquadFilter` and a gain envelope with a linear attack of 5 ms and an exponential decay to the given duration, playback rate multiplied by `sfx.screamRate(state.slowmo)`.

### Sounds

- **Punch** (`doPush`): a 60 ms low-pass burst at 180 Hz for the body of the thud, plus a 30 ms band-pass burst at 900 Hz with Q 6 for the slap. Gain `sfx.pushGain(force)`. Then the scream starts.
- **Scream** (`falling` phase): two sawtooth oscillators a fifth apart, base 330 Hz, through a band-pass formant at 1 100 Hz with Q 3, plus a 6 Hz vibrato of ±25 Hz on the base pitch from an LFO. Gain 0.35 with a 120 ms attack. Every frame while falling, the base frequency tracks the pelvis speed: 330 Hz at rest, up to 520 Hz at 8 m/s, so the scream rises during freefall and settles as the body slows. Playback pitch is multiplied by `sfx.screamRate(state.slowmo)` each frame. The scream stops with a 200 ms release when `finishDismount` runs, when the figure is reset, or when Sound is turned off.
- **Thud** (every impact of kind thud, grunt or bonk): 90 ms low-pass burst at 240 Hz, Q 0.8, gain `impactGain(force) · 0.9`. Steps and landings are wood-like: add a 40 ms band-pass burst at 1 400 Hz, Q 5, gain 0.3 · impactGain, randomised ±300 Hz with `Math.random`. `buildWorld` records each environment collider handle → solid `kind` in a `kindByCollider` map so the impact hook can tell a step from a wall or the floor.
- **Grunt** (kind grunt): a 140 ms sawtooth at 140 Hz sweeping down to 95 Hz through a low-pass at 700 Hz, gain 0.6 · impactGain. Reads as "ugh".
- **Bonk** (kind bonk): a 120 ms sine at 620 Hz sweeping down to 300 Hz, gain 0.8 · impactGain, plus a 25 ms band-pass click at 3 000 Hz. Reads as a cartoon head hit.
- **Cap:** at most 6 impact sounds per physics tick, chosen strongest first, so a full-body flop does not stack fifteen bursts.

### Hooks

- `doPush` → `audio.punch(force)` then `audio.startScream()`.
- `drainImpacts` → after computing points, `audio.impact(bone.part.name, force, state.simTime)`. This runs inside the fixed tick, so the audio module schedules bursts at `ctx.currentTime` rather than at sim time; several ticks per frame collapse onto the same frame boundary, which is inaudible at 120 Hz.
- `frame` → `audio.updateScream(pelvisSpeed, state.slowmo)` once per rendered frame while falling.
- `finishDismount`, `resetFigure` → `audio.stopScream()`.

## Controls

- Checkbox `cSound` "Sound" in the World card, below the follow-camera checkbox, checked by default.
- Hotkey `M` toggles it. The `.keys` list in the World card gains a row `M` / `sound on / off`.
- State: `state.sound = true`. No persistence; the page starts with sound on every load.

## Determinism

The audio module reads physics state and never writes it. Retry remains bit-identical because sound never touches Rapier. Timbre randomness uses `Math.random`, which the simulation does not use.

## Error handling

- No `AudioContext` → module inert, checkbox disabled, everything else works.
- Context suspended (tab backgrounded, autoplay policy) → `init` and every toggle-on call `ctx.resume()`; scheduling into a suspended context is harmless.
- Contact events with no bone (env–env) are already skipped before the hook.

## Testing

- `node 3d-stair-dismount/test.mjs` must stay green with the new `sfx` cases added.
- Browser pane: load over the static http server, push, confirm the punch, scream and thuds are audible, and the console is clean. Toggle M twice; scream stops and resumes correctly on the next push. Set slow motion to 0.25×; scream drops in pitch.
- Retry after a push and confirm the final score is unchanged from before the audio work.

## Out of scope

Volume slider, per-staircase materials beyond wood-versus-other, crowd reactions, music, persistence of the sound setting.
