# Basement menu march — design

Date: 2026-07-16
Project: `3d-game-basement/`
Status: approved

## Goal

Add a catchy chiptune soundtrack to every screen where the player is **not**
actively playing: title, pause, dead, and win. Gameplay stays music-free, as it
is today. The target mood is dictator/military march in the Wolfenstein/DOOM
family, but hummable — the player should leave with the hook stuck in their
head.

## Decisions (owner-settled)

- **One march everywhere.** The same track plays on title, pause, dead, and
  win screens. No mood variants; repetition is the earworm mechanism.
- **M toggles music.** Session-only mute (no persistence). Advertised on the
  title screen's controls lines.
- **Hand-composed WebAudio sequencer.** No audio assets, no generative
  melodies. The track is written by hand as compact pattern strings and played
  by a small lookahead scheduler on the existing `AudioContext`. Keeps
  `index.html` self-contained and all-procedural.

## The track

> **Retune 2026-07-16:** after shipping, the owner supplied a reference
> track (`basement1.m4a`). Spectral analysis put it at ~96 BPM in C minor
> with i–bVI–bVII harmony (Cm/Ab/Bb + Fm and a major-V), a C5→G5 leap
> answered by an Ab5–F5–G5 descent, Eb–F–D–Eb turn figures, and a held
> C6→B5→G5 climax. The march was recomposed around those gestures:
> C minor, 96 BPM, progression Cm Ab Bb Cm / Cm Ab Fm G / Ab Bb Cm G /
> Cm Ab Bb Cm. Engine, grid (8 tokens/bar, 128 steps), and all other
> sections below are unchanged; original composition details below
> describe v1.

- ~16-bar loop, E minor, ~126 BPM, seamless wrap.
- March skeleton: root–fifth oom-pah bass, snare on backbeats with roll fills,
  a short punchy 4-note hook that opens the melody and recurs.
- Four voices, in the style of the existing `tone()`/`noiseBurst()` primitives:
  - square-wave lead (melody),
  - quieter pulse harmony (third/octave below the lead),
  - triangle bass,
  - noise-burst kick/snare.
- Composition data: pattern strings (note-name + octave + duration shorthand)
  plus a tiny parser, so the tune is easy to retune later.

## Audio plumbing rework

Today, pausing calls `AC.suspend()`, which silences everything — incompatible
with music during pause. Replace with two gain buses:

- `gameBus` → `AC.destination`: ambient hum, lamp ballast buzz, and **all**
  sfx. Every `connect(AC.destination)` in the sfx/ambience path reroutes to
  `gameBus`.
- `musicBus` → `AC.destination`: all sequencer voices.

Pausing ramps `gameBus` gain to 0 (and back to 1 on unpause) instead of
suspending the context. The `AudioContext` stays running whenever anything
should be audible.

## Music engine

- Lookahead sequencer: a ~30 ms `setInterval` schedules notes ~150 ms ahead on
  `AC.currentTime` — the standard drift-free WebAudio pattern. A step counter
  wraps to loop the track.
- `musicStart()` / `musicStop()` with gain ramps on `musicBus`: ~0.4 s
  fade-out when the player clicks into play; near-instant fade-in on pause.
- State rule, evaluated in the main loop:
  `wantMusic = (mode !== 'play' || paused) && !musicMuted`.

## Details

- **Autoplay:** browsers block audio until a user gesture, so the very first
  title screen is silent until the first click *or keypress* — any `keydown`
  also inits/resumes audio (today only `mousedown` does). After the first
  gesture, music persists across all screens.
- **Death/win grace:** delay music start ~1 s on the dead and win screens so
  the existing `sfx.sting` / `sfx.win` jingles land first.
- **M key:** toggles `musicMuted`; ramps `musicBus` accordingly if music is
  currently playing.
- **Title screen:** add `M MUSIC` to the controls lines.

## Testing / verification

- Extend `window.__dbg` with a music-state getter (playing/muted/step).
- Verify with the project's `3d-game-basement:verify` headless-Chrome skill:
  - title after synthetic gesture → music playing,
  - enter play → music stops (fade-out),
  - lose pointer lock (pause) → music resumes and `gameBus` is silent,
  - unpause → music stops, `gameBus` restored,
  - M → muted.
- Final quality gate is the owner listening to the track — "catchy" is a human
  judgment; iterate on the melody if it doesn't stick.
