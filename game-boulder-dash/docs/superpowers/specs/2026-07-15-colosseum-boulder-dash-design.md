# Colosseum Dash — design spec

Boulder Dash-inspired, top-down 2D, standalone HTML game themed as the Roman
Colosseum. The player is a gladiator digging through arena sand, collecting
gold while dodging lions and elephants, cheered on by an audience in the
stands.

## Goals

- Faithful Boulder Dash *feel*: deterministic grid physics, falling/rolling
  objects, crush deaths, quota-gated exit, time pressure.
- Self-contained `index.html` (repo convention): no server, no build step,
  no external assets. All graphics procedural canvas pixel-art; all audio
  WebAudio-synthesized.
- Deterministic engine in a `shared-code` script block, exercised by
  `node test.mjs` (repo convention, same pattern as game-snake).

## Non-goals (YAGNI)

- Amoeba, magic wall, slime — classic BD elements omitted from v1.
- Level editor, high-score persistence, mobile touch controls.
- Sprite sheets or downloaded art.

## Theme mapping

| Boulder Dash | Colosseum Dash | Behavior |
| --- | --- | --- |
| Rockford | Gladiator | Digs sand, pushes stones, collects gold |
| Dirt | Arena sand | Removed when walked through |
| Boulder | Stone column drum | Falls, rolls off rounded objects, crushes |
| Diamond | Gold (coin pile) | Falls/rolls like boulders; collect for quota |
| Firefly | Lion | Hugs wall turning LEFT first; kills on touch; 3×3 explosion when crushed or when touching explosion |
| Butterfly | Elephant | Hugs wall turning RIGHT first; kills on touch; explodes into 3×3 GOLD when crushed |
| Brick wall | Sandstone block | Static, destroyed by explosions |
| Steel wall | Colosseum wall | Indestructible; forms the border |
| Exit | Portcullis gate | Flashes open when gold quota met; entering wins level |

Audience: decorative animated ring of spectators drawn in stands around the
playfield (outside the steel border). Idle sway; wave/cheer burst when gold
is collected, when an elephant is crushed, and when the level is won.
Emperor's box at the top center gives thumbs down on death.

## Engine (shared-code block)

Pure JS, no DOM. Fixed tick (~150 ms game tick; renderer interpolates).

- Grid of cells, each `{type, dir, falling, ...}`. Level defined as ASCII
  map strings for easy authoring and testing.
- Update pass: single top-to-bottom, left-to-right scan per tick with a
  `scanned` flag, matching classic BD semantics:
  - Falling: stone/gold falls into EMPTY below; rolls left/right off
    "rounded" cells (stone, gold, sandstone) when the side+diagonal are
    empty; a falling object landing on the player/lion/elephant triggers an
    explosion (gold explosion for elephants).
  - Lions turn left-hand rule, elephants right-hand rule; both explode when
    adjacent (4-neighborhood) to the gladiator's death explosion, and kill
    the gladiator on contact.
  - Explosions occupy 3×3, clear to EMPTY (or GOLD for elephants) after a
    short fuse.
- Player input latched between ticks; move/dig/collect/push (push a single
  stone horizontally with 1-in-1 success when the far cell is empty —
  simplified from BD's probabilistic push, deterministic for testability).
- Win: reach open exit. Lose: crushed, touched by animal, or timer hits 0.
- API: `createGame(levelIndex)`, `setInput(dir)`, `tick(game)`,
  `serialize(game)` for tests. Deterministic: no `Math.random` in the
  engine (any variation seeded per level).

## Levels

4 handcrafted ASCII levels, increasing difficulty:

1. **Training Grounds** — sand, stones, gold, no animals. Learn digging and
   gravity.
2. **The Lions' Den** — 2–3 lions patrolling chambers; lure or crush them.
3. **Elephant March** — elephants worth crushing for bonus gold; tighter
   quota forces it.
4. **The Emperor's Games** — lions + elephants + stone-heavy layout, tight
   timer.

Each level: `{name, map, quota, time}`. Lives: 3, restart level on death;
game over → back to level 1 title.

## Presentation

- Canvas, fixed logical resolution scaled to window (integer-ish scaling,
  crisp pixels via `image-rendering: pixelated`).
- Playfield centered; stands (audience rows) frame it on all four sides.
  Spectators = small procedurally-colored tunic/head sprites, ~2 rows,
  animated (sway, arms up on cheer). Emperor's box at top.
- HUD in Roman style: gold count vs quota (Roman numerals for flavor,
  digits for readability), timer, lives (laurel icons), level name.
- Camera follows player when a level is larger than the viewport.
- Title screen → level intro card ("Level II — The Lions' Den") → play →
  win/death → next/retry. Keys: arrows/WASD move, R restart level, P pause,
  M mute, Enter start/advance.
- SFX (WebAudio): dig scrunch, gold chime, stone thud, explosion boom,
  crowd cheer (filtered noise swell), portcullis fanfare, death sting.

## Testing (`test.mjs`)

Node test runner over the shared-code engine:

- Gravity: stone falls, stops on sand; gold falls likewise.
- Rolling: stone atop stone rolls to a free side; blocked sides = no roll.
- Crush: stone falling onto gladiator/lion → explosion; onto elephant →
  3×3 gold.
- Enemy AI: lion left-hand loop and elephant right-hand loop follow known
  paths on a fixture map (golden-path assertion).
- Collect & exit: quota collection flips exit open; entering wins.
- Push: stone pushed into empty; refuses when blocked.
- Determinism: two runs with identical inputs serialize identically.

## Verification

- `node test.mjs` green.
- Headless Chrome screenshot via a temp `_shot.html` driving the engine
  synchronously (repo convention for rAF loops) to confirm rendering:
  playfield, audience, HUD.
- Manual smoke: open `index.html`, play level 1 to the exit.
