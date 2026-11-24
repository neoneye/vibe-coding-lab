# Spartan Arena — design

Date: 2026-11-24
Directory: `game-spartan-arena/` (`index.html` + a folder of PNG voxel slices + `README.md` + `test.mjs` + `screenshot1.jpg`). Folder name and title are my call ("Spartan Arena" is a working title).

## Intent

An original two-player fighting game for the owner and the owner's brother, played side by side on one keyboard. It's in the spirit of the classic arcade fighters (Mortal Kombat was the inspiration), with the theme of Spartan gladiators fighting in a Roman arena in front of Caesar and a big crowd. The owner's C64 references (International Karate / IK+) supply the staging: a side view, a painted landmark backdrop, and a judge figure standing at the edge who here becomes Caesar.

Everything is drawn as **sprite-stacked voxels**: each model is 15 flat pixel-art slices stacked together, so the owner can edit any model in an ordinary pixel editor. Reference: `~/Desktop/computer_game/voxels/` (a sliced car) and `~/Desktop/computer_game/backgrounds/` (sphinx, temple).

## Goals

- A match that is fun to replay between two brothers of possibly unequal skill: escalating levels, new moves earned along the way, and spectacle (arm chops, beasts, Caesar's verdict).
- Pixel-art voxel models that the owner can repaint in any pixel editor; reload the page to see the change.
- Real lighting: fighters cast shadows on themselves, on each other and on the sand, while the image stays crisp pixel art.
- Fighters are real 3D models that turn round in place (turning to face the opponent after a cross-over, spinning in a circle kick).
- Deployed on GitHub Pages; the README explains how to run it locally.

## Non-goals (first version)

- A computer opponent, online play, touch or gamepad controls. (A scripted demo/attract fight for screenshots and testing is fine; see "Left to the builder".)
- More than one gladiator design (the two players are the same model in different team colours).
- Music. The owner is writing lyrics for a separate song (`2026-11-24-spartan-arena-lyrics-brief.md`); the game should have a place for a background track (a plain `<audio>`, M to toggle) to drop in later, but ships without one.

## Anti-goals

- A recreation of Mortal Kombat or any other existing game: no characters, names, catchphrases, announcer lines, logos or level layouts from it. The genre and the idea of a finishing move are fine; call ours **Caesar's verdict**, never "fatality".
- Smooth, blurry, high-res rendering that loses the pixel-art look.
- Realistic gore. Severed arms and blood are chunky red voxel cubes, cartoon and over the top.
- One lucky hit deciding a round.

## Decided with the owner

| Topic | Decision |
|---|---|
| View | Side-scroller view; fighters are lit 3D voxel models that cast shadows on themselves and can rotate around their own vertical axis |
| Voxel format | 15 pixel-art slices per model, editable in any pixel editor |
| Build approach | **Rigid body parts + skeleton.** Each part is its own 15-slice stack; poses are keyframes in code. (Rejected: a whole-body stack per frame — far too much art, and every frame needs an armless twin; one bending body stack — voxels tear at the joints.) |
| Levels | 1: unarmed beginner. 2: sword and shield. 3: sword and shield plus animals (lion / elephant) |
| Animals | The animal attacks both players, and the players fight each other too: every fighter for themselves |
| Arm chopping (owner's brother's request) | Option C: a rare mid-fight chop **and** a guaranteed chop as the finishing move at the end of every round won |
| Rewards | After each level the winner picks first from 3 random reward cards, then the loser picks one of the other two. Rewards are kept for the rest of the match |
| Arena | Mixed: voxel sand floor, voxel Caesar in his box, voxel front rows of crowd; a painted PNG backdrop behind (far crowd, arches, temple, sky) |
| Running | Deployed to GitHub Pages (repo has `.nojekyll`, files are served as they are). Locally: `python3 -m http.server` from the repo root, not Jekyll |

## Proposed by me, not objected to

- Two players on one keyboard (the owner and the owner's brother).
- Each level is best of 3 rounds. The match always plays all three levels; whoever wins two levels is champion. Level 3 is played even when the match is already decided.
- No physics engine: hand-written fighting motion; severed arms and blood cubes fly in simple arcs and bounce on the sand.
- I generate first-draft pixel art for every part with a script; the owner repaints the PNGs.
- Caesar gives the thumbs down at the end of each round: that's the cue for Caesar's verdict.
- An animal killed by a gladiator gives that gladiator a crowd cheer and a small health refill.
- The page is one `index.html` plus a folder of PNGs (a deliberate exception to the repo's "single self-contained page" rule, because the PNGs must stay editable). The README says so.

## The match

```
Title screen → Level 1 (best of 3) → reward draft → Level 2 (best of 3) → reward draft → Level 3 (best of 3) → champion screen
```

- **Round.** 99-second timer, health bars at the top, KO when health reaches 0. If the timer runs out, the fighter with more health wins. Health and arms are restored at the start of every round.
- **End of a round.** Caesar turns his thumb down; the winner has about 4 seconds to perform Caesar's verdict (walk up and press attack): the loser's arm comes off. If the winner does nothing, the round still ends. *My call:* in Level 1 nobody has a sword, so Caesar throws a gladius into the sand at the thumbs down and the winner picks it up for the verdict.
- **Reward draft.** A full-screen card pick: 3 random cards, the level winner chooses first, then the loser chooses one of the two left. Each player picks with their own keys (left/right + attack).
- **Champion screen.** The champion salutes Caesar; the crowd throws flowers; a rematch key starts a new match.

## Fighting

### Controls (my call; same left/right split as `game-blast-yard`)

| | Player 1 (red) | Player 2 (blue) |
|---|---|---|
| Move / jump / crouch | A D / W / S | ← → / ↑ / ↓ |
| Punch (Level 1) · sword slash (Level 2–3) | F | . (period) |
| Kick | G | / (slash) |
| Special (reward moves) | H | Right Shift |
| Block | hold back (away from the opponent) | hold back |

Fixed-timestep simulation with queued key presses so that quick taps are never lost (see the boulder-dash input-queue lesson).

### Base moves

- **Level 1:** walk, jump, crouch, punch, kick, crouching kick (sweep), block. Weak damage.
- **Level 2–3:** the sword slash replaces the punch; the shield turns blocking into a strong block that takes almost no damage, with block stamina so turtling can't last forever. **Charged strike:** hold slash for about 1 s, release for a heavy blow.

### Reward cards

Starting pool, based on the owner's list:

| Card | Effect |
|---|---|
| Sword throw | The sword flies across the arena; the fighter is unarmed (punches) until they walk over to pick it up |
| Leap of Sparta | Extra-high jump, with a downward stomp attack while airborne |
| Fury fists | Fast multi-hit punch combo (one button press triggers a 5-hit sequence) |
| Whirlwind kick | Circle kick: the fighter spins 360° in place (shows off the 3D voxels) and knocks the opponent back |
| Thunder blade | Super hit: the sword charges up (fills as you land hits), then discharges in a burst of light onto the opponent |
| Shield bash | Charge forward shield-first; stuns briefly |

Two cards per player at most can be in use (one draft after Level 1, one after Level 2), bound to **Special** and **down + Special**, shown on the HUD under each health bar. Sword-based cards picked after Level 1 work from Level 2 on, which always has swords.

### Arm chopping

- Each arm has a hidden wound meter. Sword hits that land on an arm fill it.
- A **charged strike** that lands on an arm whose meter is above a threshold cuts it off mid-fight. The rare chop (owner's "C"): expected about once every few rounds, not every round.
- A one-armed fighter loses what that arm did: losing the **shield arm** means no strong block (an ordinary block still halves damage); losing the **sword arm** means no slash or sword reward moves, only kicks and the other-arm punch.
- **Animals cannot chop arms;** only swords can.
- The severed arm is released from the skeleton, tumbles in an arc, bounces and lies on the sand until the round ends. A spurt of red voxel cubes leaves stains on the sand that fade by the next round.

## Level 3: the beasts

- A few seconds into each round, Caesar signals and a gate in the arena wall opens: a **lion** (rounds 1 and 3) or an **elephant** (round 2). *My call on the alternation.*
- The animal targets whichever gladiator is nearest (with some hysteresis so it doesn't flip every frame).
- **Lion:** fast, pounces, claw swipes, low health.
- **Elephant:** slow, charges and tramples, trunk swipe that tosses a fighter, high health, can't be jumped over easily.
- Both gladiators can hit the animal; it has its own small health bar. Hits from the animal count like any other damage; a gladiator KO'd by the animal loses the round to the other gladiator. If both fall at once, the round is a draw and replayed.
- Whoever kills the animal: crowd cheer + small health refill.

## Look and rendering

- **Camera:** three.js perspective camera, a little above the fighters' chest and looking very slightly down, so the sand floor is visible and shadows read; side view of a strip of arena. The camera tracks the midpoint between the fighters with gentle zoom so both always fit.
- **Pixel look:** render the 3D scene into a low-resolution target (around 320×180 to 400×225, builder's call) and scale it up to the window with nearest-neighbour filtering. Lighting and shadows come out in crisp screen pixels. HUD text and health bars are drawn at the same pixel scale.
- **Lighting:** one warm directional sun with shadow maps (self-shadows on and between fighters, shadows on the sand) plus a cool ambient/hemisphere fill. Flat-shaded voxel faces.
- **Fighter turning:** a fighter turns round with a short visible rotation (not an instant mirror) when they cross over the opponent. The whirlwind kick spins a full 360°.
- **Team colours:** the same gladiator model; cloak, crest and tunic colours are recoloured per player (red / blue) from key colours in the PNGs. Builder's call how (palette swap of marked colours is suggested).
- **Progression of the look:** Level 1 — tunic only, no helmet, bare-handed. Level 2–3 — bronze helmet with crest, sword and shield. Same skeleton.

## Voxel format

- **One PNG per part.** A sheet holds the part's 15 slices side by side in one row: slice width W × height H, sheet size (15·W) × H. Slice 0 is the one nearest the camera (front), slice 14 the furthest back. A fully transparent pixel is empty; any opaque pixel is a voxel of that colour.
- Slices are **side views**: each slice looks like the fighter drawn in profile (facing right), and the stack gives the body its thickness. This is the orientation the owner draws most easily.
- Parts for the gladiator (suggested): head, helmet (Level 2–3), torso, hips, upper arm ×2, forearm/hand ×2, thigh ×2, shin/foot ×2, sword, shield. Left/right limbs may share a sheet. Lion, elephant, Caesar and a crowd person are built the same way with their own parts.
- **Joint pivots and part offsets live in a rig table in `index.html`,** in voxel coordinates, not in the images. So repainting a PNG never breaks the skeleton unless the owner changes the part's size.
- Folder layout: `game-spartan-arena/voxels/<model>/<part>.png`, for example `voxels/gladiator/torso.png`. The backdrop is `game-spartan-arena/backdrop.png`.
- The page loads the PNGs at start, reads their pixels and turns each into a mesh (only faces between a filled and an empty voxel; builder's choice of greedy meshing).
- First-draft art is made by a generator script committed in the folder (for example `tools/make_art.py`). The script is a starting point; once the owner has repainted a PNG, re-running the script must not overwrite it silently. The builder decides how (write only missing files, or require a flag).

## Arena

- **Voxel, lit:** the sand floor (slight colour noise, stains), the arena wall at the back of the sand with the beast gate, Caesar's box above the wall, Caesar himself (purple toga, laurel wreath, an arm with a thumb that turns up or down), and two to three rows of crowd in front of the backdrop. The crowd is a few voxel spectator models with colour variations, many instances, animated cheaply (stand up, arms up, sway).
- **Backdrop PNG:** far stands full of crowd, Colosseum-style arches, a temple and sky, drawn as one wide pixel-art picture on a plane behind everything, unlit or only lightly lit.
- **Crowd reactions:** cheer on big hits, chops and animal kills; boo when nobody attacks for a while; roar on the thumbs down.
- **Caesar reactions:** leans forward on big moments, thumbs down at the end of the round, applauds the champion.

## Sound (my call)

Synthesised Web Audio effects only: hits, blocks, sword clang, whoosh, chop, crowd roar and boo (filtered noise), lion roar, elephant trumpet, gate. M toggles sound. A background-music slot (plain `<audio>` with a file next to `index.html`) is wired but ships empty until the owner's song exists. Must work when served over http; file:// is not a target.

## Running and deployment

- GitHub Pages serves the repo as static files (`.nojekyll` stays).
- README "Run locally": from the repo root,
  ```bash
  python3 -m http.server 8000
  ```
  then open `http://localhost:8000/game-spartan-arena/`. It explains that opening `index.html` directly from disk doesn't work because the browser blocks reading the PNG pixels, and that after editing a PNG you just reload.
- README "Editing the voxels": the sheet format above, which slice is front, transparency = empty, how team colours are marked, and where pivots live.
- Add the game to the gallery (`build_gallery.py` / `index.html`) and the top-level `README.md`.

## Testing

- Keep the game rules (match flow, round/KO/timer, damage and block, wound meters and chops, reward draft order, animal targeting) in a pure-JS core inside a marked shared-code block, tested by `game-spartan-arena/test.mjs` under Node, following the repo's pattern.
- A PNG-to-voxel test: a tiny known sheet produces the expected voxel count and face count.
- Browser check in the Browser pane over http (Chromium; Firefox where possible): no overlapping HUD text, both fighters always in frame, shadows visible, all three levels reachable. URL parameters to jump straight to a level/round, a reward draft, or a frozen pose are expected for review and screenshots.

## Left to the builder

- Exact internal resolution, camera numbers, voxel size in world units, slice sizes per part.
- Damage numbers, timings, block stamina, wound thresholds, animal stats, all tuned for play; record final numbers in the README.
- Animation keyframes and blending.
- Recolouring scheme for team colours.
- A scripted demo fight (both players driven by a simple script) for screenshots and smoke tests — useful but optional.
- Exact gallery description text.

## Settled after the builder review (my calls)

- **Draws** in any level: the round is replayed (same rule as Level 3).
- **Thick or thin models:** a model may stack several 15-slice sheets one behind the other (rig table gives each a depth offset), so the elephant can be thicker than 15 voxels; thin parts such as the sword just leave most slices empty.
- **Fury fists in Levels 2–3:** the combo is thrown with the shield-side fist and the sword pommel, so it keeps working when the slash replaces the punch. If the fighter has lost both usable arms for it, the card does nothing.
- **Which arm comes off:** a mid-fight chop takes the arm the hit landed on (wound meters are per arm). Caesar's verdict takes the loser's sword arm.
- **Pre-fight salute:** at the start of each level both gladiators raise a fist (or sword) to Caesar, a short "Ave Caesar" moment that can be skipped with any attack key.
