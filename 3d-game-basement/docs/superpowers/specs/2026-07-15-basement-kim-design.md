# Basement Kim — design doc

Date: 2026-07-15
Status: built autonomously per "go ahead" (brainstorming interview skipped by user instruction)

## Original ask (verbatim)

> I want you to create a standalone html game, no backend. That is a clone of
> Wolfenstein, where the setting is in the basement of a dictators bunker. Take
> inspiration from Backrooms, with VHS camera. The dictator lives elite
> upperclass environment, his servants in misery with primitive weapons.

## Concept

You are a servant in the basement of the Dictator's bunker. Tonight you snap.
Fight your way from the miserable, Backrooms-yellow servant quarters up through
the guard barracks into the marble-and-gold elite wing, and end the Dictator in
his throne room. The whole thing is seen through a battered VHS security-camera
recording.

## Decisions (made autonomously)

- **Player = servant, enemies = the Dictator's guards.** The class contrast is
  environmental: the level starts in mold-and-fluorescent misery and gets more
  opulent the deeper you push. Servant NPCs are non-hostile set dressing.
- **Primitive weapons only:** fists → lead pipe (melee) → slingshot (projectile,
  scavenged bolts). Guards drop nothing usable — their rifles are
  coded-to-owner, which keeps the primitive-weapons constraint honest.
- **One handcrafted level, four zones:** servant quarters (Backrooms wallpaper,
  hum), utility tunnels (concrete), barracks (brick, guards), elite wing
  (marble, red carpet, gold), throne room (boss).
- **Engine:** classic Wolfenstein grid raycaster, canvas 2D, DDA algorithm,
  textured walls + billboard sprites. All textures procedurally drawn to
  offscreen canvases at boot — zero external assets, works from `file://`.
- **VHS layer:** scanlines, animated static, chromatic aberration on hits,
  tracking glitches, timestamp + "PLAY ►" + REC overlay, vignette.
- **Audio:** WebAudio-synthesized (hum, thwack, slingshot, guard bark, alarm).
  No audio files.
- **Single file:** `index.html`, no build step, no backend, no network.

## Non-goals

- Multiple levels, saves, difficulty settings, mobile controls.
- Any real-world political figures: "the Dictator" is a fictional archetype;
  the file name's "Kim" stays out of the game's text.
