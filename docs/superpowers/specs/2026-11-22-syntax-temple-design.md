# Syntax Temple — design

Date: 2026-11-22
Directory: `game-syntax-temple/` (single self-contained `index.html`, plus `test.mjs`, `README.md`, `screenshot1.jpg`)

## Intent

An original top-down puzzle game in which the rules of each room are word
tiles lying in the room, and the player solves the room by pushing the words
into new statements. The owner is a programmer and finds it fascinating that
the player can change the programming, so the vocabulary goes beyond plain
"noun is property" sentences into constructs a programmer recognises:
`NOT`, `AND`, `IF … THEN` and assignment. Later rooms should feel like
debugging someone's broken program.

The rule-pushing idea is inspired by Baba Is You. The setting borrows the
feel of an early-80s temple-exploration game (keys, doors, skulls, fire,
gems, brick rooms on black) and an early-90s top-down strategy map (square
terrain tiles, fog lifting). The window chrome is bevelled grey in the manner
of an early-90s desktop GUI.

## Goals

- Rules are visible, physical and editable; the currently running program is
  always readable in a listing next to the room.
- Each new word is introduced in a room built around it and then reused in
  at least one later room. (Builder's call: 12 rooms cannot give every word
  its own separate test room.)
- 12 rooms, reached from a walkable world map that lets the player skip a
  room they are stuck on.
- Turn-based, unlimited undo, instant restart.
- Every room is proven solvable by an automated replay.

## Non-goals (first version)

- Numbers, counters, loops.
- Rules that affect the world map.
- Sound, touch controls, a level editor, image export.
- Score, lives, timers.

## Anti-goals

- A recreation of any existing game: the name, sprites, levels, palette and
  layout must be this game's own. No level may copy a known level of the
  inspiration.
- Rooms that are solvable only by trial and error. Each room has one idea.

## Decided with the owner

| Decision | Choice |
|---|---|
| Depth of rule changing | Word tiles plus programming constructs (`NOT`, `AND`, `IF … THEN`, `=`) |
| Structure | Top-down world map; temples on it each hold one puzzle room |
| Language (below) | Approved as proposed |
| GUI | Bevelled grey window chrome |
| Build approach | Canvas for the playfield, HTML/CSS for the chrome |

Room count (12), turn-based play, undo and restart were proposed and not
objected to.

## Approaches considered

1. **Canvas playfield + HTML/CSS chrome (chosen).** Pixel sprites defined in
   code, drawn to a canvas scaled in whole device pixels. Frame, menus,
   buttons and the rules list are HTML elements with CSS bevel borders.
   Menus and buttons get input handling for free.
2. **Everything on one canvas.** Uniform look, but menus, hover states and
   text layout must be hand-written.
3. **Everything in HTML/CSS, one element per tile.** Simplest, but pixel
   sprites and slide animation are awkward and Chromium/Firefox differ on
   sub-pixel layout.

The rules engine is identical in all three.

## The language

Nouns: `HERO`, `WALL`, `KEY`, `DOOR`, `SKULL`, `FIRE`, `GEM`, `CRATE`, `WATER`.

Properties: `YOU`, `WIN`, `STOP`, `PUSH`, `DEATH`, `SINK`, `OPEN`, `SHUT`.

Other words: `IS`, `AND`, `NOT`, `=`, `IF`, `THEN`, `ON`, `NEAR`, `NO`.

Grammar. A sentence is a contiguous straight run of word tiles, read left to
right in a row or top to bottom in a column.

```
sentence  := statement | IF test THEN statement
statement := subject IS props | NOUN = NOUN
subject   := [NOT] NOUN { AND [NOT] NOUN }
props     := PROP { AND PROP }
test      := NOUN ON NOUN | NOUN NEAR NOUN | NO NOUN
```

- Parsing: in each maximal run of word tiles, try each start position in
  order and take the longest valid sentence starting there; continue after
  it. Anything that does not parse does nothing.
- `NOT X` as a subject means every object kind present in the room except
  `X`. Word tiles are never included.
- `A = B` turns every A into a B. It applies every turn while the line is
  active (so it also fires the moment it forms). `A = A` does nothing.
- Several active assignments run one after another in listing order, like
  statements in a program (builder's call). Listing order is: horizontal
  sentences by row then column, then vertical sentences by column then row.
  So `A = B` followed by `B = C` leaves only Cs, and `A = B` followed by
  `B = A` leaves only As: a swap needs a temporary, as in real code. The
  rules list shows sentences in this same order.
- `A ON B`: some A shares a tile with some B. `A NEAR B`: some A is
  orthogonally adjacent to some B. `NO A`: the room contains no A.
- A conditional's statement is active only on turns when its test is true.
  Tests look only at positions, never at properties, so there is no
  circularity.
- Word tiles are always pushable and cannot be stacked on each other. They
  can share a tile with any object that does not block them, and they are
  never destroyed or transformed: `SINK`, `DEATH`, `OPEN`/`SHUT` and `=`
  ignore them (builder's call, so the program can be broken but not lost).

Property behaviour:

- `YOU`: moves one tile per arrow press. Several things can be `YOU`. If
  nothing is, the game shows a notice suggesting undo.
- `STOP`: cannot be entered. `PUSH`: is shoved along by a mover, in chains;
  `PUSH` wins over `STOP` on the same object.
- `DEATH`: a `YOU` object sharing its tile is destroyed.
- `SINK`: anything sharing its tile is destroyed along with it.
- `OPEN` / `SHUT`: when one moves into, or shares a tile with, the other,
  both are destroyed. This also applies when the `SHUT` object is `STOP`
  (a key pushed into a locked door opens it).
- `WIN`: when a `YOU` object shares its tile (or is itself `WIN`), the room
  is solved.

Turn order: move `YOU` objects and resolve pushes → parse → evaluate tests →
apply assignments → evaluate tests again and compute properties → resolve
`OPEN`/`SHUT`, `SINK`, `DEATH` → check `WIN`. Rules are also parsed once when
a room loads.

## Rooms

One room is 20 × 13 tiles. Suggested teaching order (builder may adjust, but
every word must be taught before it is tested):

1. `IS`, `YOU`, `WIN`, `STOP` — complete a broken win line
2. `PUSH`, breaking a rule by pushing a word out of it
3. Becoming something else (`KEY IS YOU`)
4. `DEATH`, `SINK`
5. `OPEN`, `SHUT`
6. `AND`
7. `NOT`
8. `=` (assignment)
9. `IF … ON … THEN`
10. `IF … NEAR`, `IF NO`
11. Combination: conditional assignment
12. Finale: a room whose program is "buggy" in several places

## World map

- Top-down terrain tiles: grass, forest, hills, mountains and water
  (mountains and water impassable), with 12 temple tiles. About 24 × 16.
- Fog covers the map. Only revealed tiles are walkable. Solving a temple
  lifts the fog around it, exposing the next temples.
- Skipping means choosing another open temple; there is no skip button
  (builder's call). The temples form a branching unlock graph rather than a
  chain: after the first two rooms, at least two unsolved temples are open
  at any time until only the last rooms remain. A room may rely only on
  words taught in the temples that must be solved to reach it. The finale
  is revealed last, once all other temples are solved.
- Walking onto a temple and pressing Enter opens its room. Solved temples
  are marked and can be replayed.
- Progress is stored in `localStorage` (guarded; the game works without it).

## Look

- Limited 16-colour palette. Rooms: black floor, coloured brick walls,
  bright chunky sprites. Map: flat green and blue terrain tiles with simple
  icon detail.
- 24 × 24 logical-pixel tiles, integer-scaled to device pixels (crisp on
  HiDPI). Words drawn with a small built-in pixel font; all words must be
  legible at 2× scale.
- Word tiles are drawn as raised bevelled buttons, colour-coded by kind
  (noun, property, operator, control word). Tiles that are part of an active
  sentence are lit; others are dimmed.
- Window: grey bevelled frame, title bar, menu bar — Game (New game, Return
  to map), Room (Undo, Restart), Help (How to play, Word reference, About) —
  a sunken viewport for the canvas, and a sunken list box titled like a
  program listing that shows active rules with line numbers; conditionals
  whose test is currently false are shown greyed. Raised Undo and Restart
  buttons. A status bar shows the room name and move count.
- Moves animate as a short slide (about 100 ms); key presses are queued so
  quick taps are not lost.

## Controls

Arrows or WASD to move, Z undo (repeats when held), R restart, Esc return to
map, Enter to enter a temple.

## Code structure and testing

- The engine (parser, turn step, room data, recorded solutions) lives in a
  shared-code block inside `index.html` that `test.mjs` extracts and runs
  under Node, as in other games in this repo. The engine is pure: state plus
  a move gives a new state; undo is a stack of states.
- `test.mjs` covers the parser (each grammar form, broken lines, vertical
  sentences), every property, turn order, and replays a recorded solution
  for each of the 12 rooms, asserting the room is not won at the start and is
  won at the end.
- Verified in the browser (Chromium and Firefox) for layout, overlapping
  text and margins before committing. Added to `gallery.yaml`, the gallery
  index and the root README, with `screenshot1.jpg`.

## Left to the builder

- Exact room layouts, map layout and reveal regions.
- Sprite art, palette values, pixel font.
- Wording of the help text.
