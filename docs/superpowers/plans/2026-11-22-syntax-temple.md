# Syntax Temple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-file top-down puzzle game where the player pushes word tiles to rewrite each room's rules, with 12 rooms reached from a fog-covered world map, inside a bevelled grey window.

**Architecture:** A pure engine (sentence parser, rule evaluation, turn step, room and map data) lives in a `<script id="shared-code">` block of `index.html` and is run under Node by `test.mjs`. A second script block holds everything browser-only: pixel sprites, canvas rendering, input, undo, menus, persistence. The chrome is HTML/CSS; the playfield is one canvas.

**Tech Stack:** Plain HTML/CSS/JavaScript, Canvas 2D, Node for tests. No libraries, no network requests.

**Spec:** `docs/superpowers/specs/2026-11-22-syntax-temple-design.md` — read it first; the language section is normative.

## Global Constraints

- One self-contained page: `game-syntax-temple/index.html`. Other files: `test.mjs`, `README.md`, `screenshot1.jpg`.
- Original name, sprites, palette, levels and layout. No level may copy a known level of any existing game.
- Room is 20 × 13 tiles; map is about 24 × 16; tiles are 24 × 24 logical pixels, scaled by a whole number of device pixels.
- 16-colour palette.
- No sound, touch controls, level editor, image export, score, lives or timers.
- Turn-based; unlimited undo; restart.
- Every room has a recorded solution replayed by `test.mjs`.
- `localStorage` access is always wrapped in try/catch; the game works without it.
- Before the final commit: verify in the browser, check for overlapping text and missing margins, check Chromium and Firefox layout.
- Commits go to `main`, each ending with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. Nothing is `YOU` after a push breaks the line: a notice appears, moves do nothing, undo still works. (Task 2 test, Task 5 check)
2. Pushing a word or object against the room edge: the whole chain is blocked, nothing leaves the grid. (Task 2 test)
3. Keys with modifiers (Cmd+R, Ctrl+Z, Alt+arrow) must reach the browser and not move, restart or undo. (Task 5 check)
4. Quick taps during a slide animation are queued (cap 4), not dropped; a held arrow repeats. (Task 5 check)
5. Stored progress that is missing, unreadable or not valid JSON: the game starts fresh without an error. (Task 6 check)
6. Undo with an empty history does nothing; restart is itself undoable. (Task 5 check)
7. Window smaller than the playfield at 1×, or a hidden pane reporting width 0: scale never drops below 1 and the layout does not overlap. (Task 5 check)

## File Structure

- `game-syntax-temple/index.html`
  - `<style>`: window chrome and bevels.
  - `<script id="shared-code">`: `SyntaxTemple` (engine + data) and `SyntaxTempleTests`.
  - `<script>`: `App` — sprites, font, rendering, input, screens, storage.
- `game-syntax-temple/test.mjs`: extracts the shared-code block and runs `SyntaxTempleTests.run()`, same shape as `game-car-simple/test.mjs` without the planck part.
- `game-syntax-temple/README.md`, `screenshot1.jpg`.
- Modify: `gallery.yaml`, root `index.html` (via `build_gallery.py`), root `README.md`.

## Shared data conventions (used by every task)

State is a plain object, never mutated by the engine's public functions:

```js
{ w, h, ents: [{ id, word: bool, name, x, y }], won: bool, noYou: bool, moves: int }
```

`name` is a noun (`'HERO'`) for objects and the word itself (`'IS'`, `'='`) for word tiles.

Room rows use one character per tile:

| Objects | | Words | | | |
|---|---|---|---|---|---|
| `.` empty | `@` HERO | `H` HERO | `Y` YOU | `I` IS | `Q` IF |
| `#` WALL | `k` KEY | `W` WALL | `V` WIN | `N` AND | `R` THEN |
| `d` DOOR | `s` SKULL | `K` KEY | `X` STOP | `T` NOT | `L` ON |
| `f` FIRE | `g` GEM | `D` DOOR | `P` PUSH | `E` = | `M` NEAR |
| `c` CRATE | `~` WATER | `S` SKULL | `Z` DEATH | | `B` NO |
| | | `F` FIRE | `J` SINK | | |
| | | `G` GEM | `O` OPEN | | |
| | | `C` CRATE | `U` SHUT | | |
| | | `A` WATER | | | |

A room definition is `{ name, rows: [13 strings of 20 chars], extra: [{ch, x, y}] (optional stacked entities), solution: 'RRUL…', needs: [room indices] }`.

Directions are `'U' 'D' 'L' 'R'`.

---

### Task 1: Scaffold, test harness and sentence parser

**Files:**
- Create: `game-syntax-temple/index.html`, `game-syntax-temple/test.mjs`

**Interfaces:**
- Produces:
  - `SyntaxTemple.load(rows, extra?) -> state` (rows may be any rectangular size; does not settle rules)
  - `SyntaxTemple.findSentences(state) -> [{ dir: 'h'|'v', cells: [{x,y}], text: string, cond: null | {op:'ON'|'NEAR'|'NO', a, b?}, stmt: {type:'is', subjects:[{noun, not:bool}], props:[string]} | {type:'assign', from, to} }]` in listing order (horizontal by row then column, then vertical by column then row)
  - `SyntaxTempleTests.run() -> bool`, built on a tiny `t(name, fn)` / `eq(a, b)` helper that prints failures and counts them.

- [ ] **Step 1: Write `test.mjs` and failing parser tests** inside `SyntaxTempleTests`:

```js
const S = rows => SyntaxTemple.findSentences(SyntaxTemple.load(rows)).map(s => s.text);
t('declaration',        () => eq(S(['HIY']), ['HERO IS YOU']));
t('and props',          () => eq(S(['KIPNO']), ['KEY IS PUSH AND OPEN']));
t('and subjects + not', () => eq(S(['TKNSIX']), ['NOT KEY AND SKULL IS STOP']));
t('assignment',         () => eq(S(['SEK']), ['SKULL = KEY']));
t('if on',              () => eq(S(['QHLFRDIO']), ['IF HERO ON FIRE THEN DOOR IS OPEN']));
t('if near',            () => eq(S(['QHMDRSEG']), ['IF HERO NEAR DOOR THEN SKULL = GEM']));
t('if no',              () => eq(S(['QBSRDIO']), ['IF NO SKULL THEN DOOR IS OPEN']));
t('vertical',           () => eq(S(['H','I','Y']), ['HERO IS YOU']));
t('broken',             () => ['HI.Y', 'IYH', 'HIK', 'QHLFR', 'HIYN', 'SES.'].forEach(r => eq(S([r]).filter(x => x !== 'HERO IS YOU').length, 0)));
t('trailing AND dropped', () => eq(S(['HIYN']), ['HERO IS YOU']));
t('longest match',      () => eq(S(['HIYNV']), ['HERO IS YOU AND WIN']));
t('junk before',        () => eq(S(['YHIY']), ['HERO IS YOU']));
t('failed IF falls back', () => eq(S(['QHIY']), ['HERO IS YOU']));
t('two in one run',     () => eq(S(['HIYWIX']), ['HERO IS YOU', 'WALL IS STOP']));
t('listing order',      () => eq(S(['W.HIY','I....','X....']), ['HERO IS YOU', 'WALL IS STOP']));
t('object breaks run',  () => eq(S(['HI@Y']).length, 0)); // a tile holding no word is a gap, whatever else is on it
```

- [ ] **Step 2: Run** `node game-syntax-temple/test.mjs` — expected: fails, `SyntaxTemple` not defined.
- [ ] **Step 3: Implement** the page skeleton (doctype, title "Syntax Temple", empty chrome), the word table, `load`, and `findSentences` using the spec's grammar: for each maximal run of word tiles, at each start try the longest valid sentence, then continue after it, else advance one tile.
- [ ] **Step 4: Run tests** — expected: all pass, exit code 0.
- [ ] **Step 5: Commit** `syntax-temple: sentence parser and test harness`.

### Task 2: Rules and the turn step

**Files:**
- Modify: `game-syntax-temple/index.html` (shared-code)

**Interfaces:**
- Consumes: `load`, `findSentences`.
- Produces:
  - `SyntaxTemple.settle(state) -> state` — runs everything in the spec's turn order after movement (parse → tests → assignments in listing order → tests again and properties → `OPEN`/`SHUT`, `SINK`, `DEATH` → `WIN`); sets `won` and `noYou`.
  - `SyntaxTemple.step(state, dir) -> state` — moves every `YOU` object with push chains, then `settle`; increments `moves`. Returns the same state object unchanged if `state.won`.
  - `SyntaxTemple.rules(state) -> { props: {NOUN: Set<prop>}, listing: [{ text, active: bool }] }` — `active` is false for a conditional whose test is false.
  - Test helpers `at(state, x, y) -> [names]` and `run(rows, moves) -> state` (`load`, `settle`, then `step` per character).

- [ ] **Step 1: Write failing tests** (each row set is tiny; `HIY` supplies `HERO IS YOU` unless the test is about its absence):

```js
t('move',             () => eq(at(run(['@..', 'HIY'], 'R'), 1, 0), ['HERO']));
t('edge blocks',      () => eq(at(run(['@', 'H', 'I', 'Y'], 'L'), 0, 0), ['HERO']));
t('stop',             () => eq(at(run(['@#.', 'HIY', 'WIX'], 'R'), 0, 0), ['HERO']));
t('no stop = walk through', () => eq(at(run(['@#.', 'HIY'], 'R'), 1, 0).sort(), ['HERO', 'WALL']));
t('push chain',       () => eq(at(run(['@cc.', 'HIY.', 'CIP.'], 'R'), 3, 0), ['CRATE']));
t('push chain blocked at edge', () => eq(at(run(['@cc', 'HIY', 'CIP'], 'R'), 0, 0), ['HERO']));
t('words always push',() => eq(at(run(['@X.', 'HIY'], 'R'), 2, 0), ['STOP']));
t('words do not stack', () => eq(at(run(['@XV', 'HIY'], 'R'), 0, 0), ['HERO']));
t('push beats stop',  () => eq(at(run(['@c...', 'HIY..', 'CIPNX'], 'R'), 2, 0), ['CRATE']));
t('breaking a rule',  () => eq(at(run(['@.#', 'WIX', '...', 'HIY'], 'RDUR'), 2, 0).sort(), ['HERO', 'WALL'])); // D pushes IS out of WALL IS STOP
t('noYou',            () => eq(run(['..@', 'HIY', '...'], 'D').noYou, true)); // pushed YOU out of line
t('win',              () => eq(run(['@g.', 'HIY', 'GIV'], 'R').won, true));
t('you and win',      () => eq(run(['@..', 'HIY', 'HIV'], '').won, true));
t('death',            () => { const s = run(['@s.', 'HIY', 'SIZ'], 'R'); eq([at(s, 1, 0), s.noYou], [['SKULL'], true]); });
t('sink',             () => eq(at(run(['@c~', 'HIY', 'CIP', 'AIJ'], 'R'), 2, 0), []));
t('sink spares words',() => eq(at(run(['@X~', 'HIY', 'AIJ'], 'R'), 2, 0).sort(), ['STOP', 'WATER']));
t('open shut through stop', () => eq(at(run(['@kd..', 'HIY..', 'KIPNO', 'DIXNU'], 'R'), 2, 0), []));
t('not',              () => eq(at(run(['@c..', 'HIY.', 'THIP'], 'R'), 2, 0), ['CRATE']));
t('assignment',       () => eq(at(run(['@.s', 'HIY', 'SEK'], ''), 2, 0), ['KEY']));
t('assignments run in order', () => eq(at(run(['@.s', 'HIY', 'SEK', 'KEG'], ''), 2, 0), ['GEM']));
t('swap needs a temp',() => eq([at(run(['@sk', 'HIY', 'SEK', 'KES'], ''), 1, 0), at(run(['@sk', 'HIY', 'SEK', 'KES'], ''), 2, 0)], [['SKULL'], ['SKULL']]));
t('assignment ignores words', () => eq(SyntaxTemple.rules(run(['@.s', 'HIY', 'SEK'], '')).listing.length, 2));
t('if on false',      () => eq(SyntaxTemple.rules(run(['@f.d....', 'HIY.....', 'QHLFRDIO'], '')).listing.at(-1).active, false));
t('if on true',       () => eq(SyntaxTemple.rules(run(['@f.d....', 'HIY.....', 'QHLFRDIO'], 'R')).props.DOOR.has('OPEN'), true));
t('if near',          () => eq(at(run(['@.d.s...', 'HIY.....', 'QHMDRSEG'], 'R'), 4, 0), ['GEM']));
t('if no',            () => eq(SyntaxTemple.rules(run(['@.d....', 'HIY....', 'QBSRDIV'], '')).props.DOOR.has('WIN'), true));
t('won state is frozen', () => { const s = run(['@g.', 'HIY', 'GIV'], 'R'); eq(SyntaxTemple.step(s, 'L'), s); });
t('step does not mutate', () => { const a = run(['@..', 'HIY'], ''); const j = JSON.stringify(a); SyntaxTemple.step(a, 'R'); eq(JSON.stringify(a), j); });
```

- [ ] **Step 2: Run tests** — expected: new tests fail, Task 1 tests pass.
- [ ] **Step 3: Implement `settle`, `step`, `rules`.** Movement: all `YOU` objects attempt the move against the pre-move positions; a mover enters a tile if every blocker there can be pushed onward (recursively) or is not `STOP`; a tile outside the grid blocks. Special case from the spec: if the mover (or the pushed thing at the head of a chain) is `OPEN` and the blocker is `SHUT` and `STOP` (or the reverse), destroy both and let the chain advance. Properties used during movement are those computed by the previous `settle`.
- [ ] **Step 4: Run tests** — expected: all pass.
- [ ] **Step 5: Commit** `syntax-temple: rule evaluation and turn step`.

### Task 3: The twelve rooms

**Files:**
- Modify: `game-syntax-temple/index.html` (shared-code)

**Interfaces:**
- Consumes: `load`, `settle`, `step`.
- Produces: `SyntaxTemple.ROOMS` (12 room definitions in the conventions above), `SyntaxTemple.openRoom(i) -> state` (`load` + `settle`), `SyntaxTemple.replay(i, moves) -> state`.

Room ideas follow the spec's teaching order (1 win line; 2 push and rule breaking; 3 becoming something else; 4 `DEATH`/`SINK`; 5 `OPEN`/`SHUT`; 6 `AND`; 7 `NOT`; 8 `=`; 9 `IF … ON`; 10 `IF … NEAR` and `IF NO`; 11 conditional assignment; 12 a buggy program needing at least three separate fixes, one of them an ordered-assignment fix). Each room has one idea, uses only words taught in itself or in rooms listed in its `needs`, and keeps the fixed `HERO IS YOU` (or its replacement) reachable so the room cannot be soft-locked without the player choosing to break it.

`needs` graph (indices are room numbers): 1 → 2 → {3, 4}; 3 → {5, 6}; 4 → {7, 8}; 5, 6 → 9; 7, 8 → 10; 9, 10 → 11; 12 needs all.

- [ ] **Step 1: Write failing tests:**

```js
t('12 rooms',     () => eq(SyntaxTemple.ROOMS.length, 12));
SyntaxTemple.ROOMS.forEach((r, i) => {
  t(`room ${i + 1} shape`,        () => eq([r.rows.length, ...new Set(r.rows.map(x => x.length))], [13, 20]));
  t(`room ${i + 1} not won at start`, () => { const s = SyntaxTemple.openRoom(i); eq([s.won, s.noYou], [false, false]); });
  t(`room ${i + 1} solution wins`,    () => eq(SyntaxTemple.replay(i, r.solution).won, true));
  t(`room ${i + 1} wins only on last move`, () => eq(SyntaxTemple.replay(i, r.solution.slice(0, -1)).won, false));
});
```

  Plus two more per room, written as loops over a `TAUGHT` table (room index → the words that room introduces, following the teaching order below):
  - `room N uses only taught words`: every word tile in the room is in `TAUGHT` for the room itself or for a room in its transitive `needs`.
  - `room N needs a rule change`: a breadth-first search over `step` from the opening state, restricted to moves after which every word tile is where it started, never reaches `won` (cap 20000 states).

- [ ] **Step 2: Run tests** — expected: fail, `ROOMS` undefined.
- [ ] **Step 3: Design the rooms and record solutions.** Write each room, then find its solution by writing moves and replaying; a throwaway BFS solver in the scratchpad (not committed) is the quickest way to confirm the intended solution and to spot unintended shortcuts.
- [ ] **Step 4: Run tests** — expected: all pass.
- [ ] **Step 5: Commit** `syntax-temple: twelve rooms with recorded solutions`.

### Task 4: World map logic

**Files:**
- Modify: `game-syntax-temple/index.html` (shared-code)

**Interfaces:**
- Consumes: `ROOMS[i].needs`.
- Produces:
  - `SyntaxTemple.MAP = { rows: [16 strings of 24 chars], start: {x, y}, temples: [{ room, x, y }] }` with terrain chars `,` grass, `t` forest, `h` hills, `^` mountain, `~` water, `1`–`9`/`a`–`c` temple of room 1–12.
  - `SyntaxTemple.revealed(solved: number[]) -> Set<'x,y'>` — the start area plus a disc of radius 4 around each solved temple and around each temple whose `needs` are all solved.
  - `SyntaxTemple.walkable(solved, x, y) -> bool` — in bounds, revealed, not mountain or water.
  - `SyntaxTemple.openTemples(solved) -> number[]` — unsolved rooms whose temple tile is reachable on foot from `start`.

- [ ] **Step 1: Write failing tests:**

```js
t('map shape',        () => eq([SyntaxTemple.MAP.rows.length, ...new Set(SyntaxTemple.MAP.rows.map(r => r.length))], [16, 24]));
t('12 temples',       () => eq(SyntaxTemple.MAP.temples.map(t => t.room).sort((a, b) => a - b), [...Array(12).keys()]));
t('start opens room 1 only', () => eq(SyntaxTemple.openTemples([]), [0]));
t('every solve order finishes and keeps a choice', () => {
  // depth-first over all orders that always pick from openTemples(solved):
  // openTemples is never empty before all 12 are solved;
  // once rooms 1 and 2 are solved and more than 3 rooms remain unsolved, openTemples has >= 2 entries;
  // room 12 appears in openTemples only when the other 11 are solved.
});
t('unrevealed is not walkable', () => { const t12 = SyntaxTemple.MAP.temples.find(t => t.room === 11); eq(SyntaxTemple.walkable([], t12.x, t12.y), false); });
```

- [ ] **Step 2: Run tests** — expected: fail.
- [ ] **Step 3: Implement** the map data and the three functions (flood fill for `openTemples`). Lay the map out so the two branches of the `needs` graph run through different terrain and meet near the finale.
- [ ] **Step 4: Run tests** — expected: all pass.
- [ ] **Step 5: Commit** `syntax-temple: world map with fog and unlock graph`.

### Task 5: Room screen — chrome, sprites, rendering, input

**Files:**
- Modify: `game-syntax-temple/index.html` (style, markup, second script)

**Interfaces:**
- Consumes: `openRoom`, `step`, `rules`, `ROOMS`.
- Produces (browser only, on `window.__st` for verification): `__st.enterRoom(i)`, `__st.press(dir)`, `__st.undo()`, `__st.restart()`, `__st.state()`, `__st.draw()` (synchronous full redraw, usable while the pane is hidden). URL parameter `?room=N` opens room N directly; `?room=N&moves=RRU…` also applies moves without animation.

Decisions:
- Window: outer frame `#c0c0c0` with 2 px bevel (light `#ffffff` top/left, shadow `#808080` and `#000000` bottom/right), navy `#000080` title bar with white bold title "Syntax Temple", menu bar (Game: New game, Return to map · Room: Undo, Restart · Help: How to play, Word reference, About), sunken viewport holding the canvas, to its right a sunken white list box captioned `PROGRAM.RUL` showing `rules(state).listing` as `10 HERO IS YOU`, `20 …` in a monospace face with inactive lines grey, raised Undo and Restart buttons under it, and a sunken status bar with room name and move count. Menus open on click, close on outside click or Esc. Help entries open a bevelled modal dialog with an OK button. System UI font stack; no web fonts.
- Canvas: logical 480 × 312. Backing store = logical × `scale`, where `scale = max(1, floor(min(availW, availH) * devicePixelRatio / logical))`; CSS size = backing / devicePixelRatio; `image-rendering: pixelated`; recompute on resize.
- Sprites: 24 × 24, drawn procedurally or from pixel strings, from one 16-colour palette constant. Room floor black; walls as coloured brick. Word tiles: raised bevelled button, face colour by kind (noun, property, operator `IS AND NOT =`, control `IF THEN ON NEAR NO`), text in a built-in pixel font, at most 5 letters on one line or split over two; `=` drawn as a glyph. Tiles in an active sentence are drawn at full brightness, others dimmed.
- Input: arrows/WASD move, Z undo (repeats when held), R restart, Esc return to map. Ignore key events with meta, ctrl or alt held. Presses are queued (cap 4) and consumed one per 100 ms slide; auto-repeat keydowns only enqueue when the queue is empty.
- Undo: stack of states; restart pushes the current state then loads the room fresh; undo with an empty stack does nothing.
- `noYou`: a bevelled notice over the viewport, "Nothing IS YOU. Press Z to undo." On `won`: a dialog "Room solved" with an OK button that returns to the map (Task 6; until then it reopens the room).

- [ ] **Step 1: Implement** the chrome, sprites, renderer, input and undo as decided above.
- [ ] **Step 2: Verify in the Browser pane** using an http server on port 8765 (`.claude/launch.json` config named `static`): open `?room=1`, screenshot; check with `read_page` that the listing shows the room's rules; `__st.press` through room 1's recorded solution and confirm the solved dialog; confirm via `javascript_tool` that the canvas backing width is a whole multiple of 480.
- [ ] **Step 3: Check the Review Focus items 1, 3, 4, 6, 7** by driving `__st` and dispatching synthetic `keydown` events (including one with `metaKey: true`), and by `resize_window` to 375 × 812 comparing `document.documentElement.scrollWidth` with `clientWidth`.
- [ ] **Step 4: Screenshot every room** (`?room=N`) and check each for legible words, no clipped tiles and no overlap between listing and viewport.
- [ ] **Step 5: Run** `node game-syntax-temple/test.mjs` — expected: still all pass.
- [ ] **Step 6: Commit** `syntax-temple: room screen in a bevelled window`.

### Task 6: Map screen, progress and help

**Files:**
- Modify: `game-syntax-temple/index.html`

**Interfaces:**
- Consumes: `MAP`, `revealed`, `walkable`, `openTemples`, Task 5's `enterRoom`.
- Produces: `__st.showMap()`, `__st.solved()`, `__st.setSolved([..])`; URL parameter `?solved=0,1,2` to preview a map state without touching storage.

Decisions:
- The map draws in the same canvas at 24 px tiles (24 × 16 = 576 × 384 logical; the canvas logical size switches per screen and the scale is recomputed). Terrain tiles are flat colour with simple icon detail; fog is black; solved temples show a small flag; the hero sprite walks tile to tile with the same queued input.
- Enter on a temple opens its room. The status bar shows the temple's room name while standing on it and "n of 12 rooms solved" otherwise. The rules list box is replaced on the map by a list of rooms: solved, open, or `???` for unrevealed.
- Progress: `localStorage['syntax-temple-v1'] = JSON.stringify({ solved: [...], pos: {x, y} })`. Reads are validated (array of integers 0–11, position walkable) and fall back to a fresh game. Game → New game asks for confirmation in a dialog, then clears it.
- Solving room 12 shows a short closing dialog; all rooms stay replayable.
- Help → How to play: about 120 words. Help → Word reference: a table of every word the player has met so far with a one-line meaning, wording taken from the spec.

- [ ] **Step 1: Implement** the map screen, storage and dialogs.
- [ ] **Step 2: Verify in the Browser pane over http:** fresh load shows the map with only the start area and room 1 visible; walk to temple 1, Enter, solve via `__st.press`, return and confirm new terrain is revealed; reload and confirm progress persisted; `?solved=0,1,2,3,4,5,6,7,8,9,10` shows the finale revealed.
- [ ] **Step 3: Check Review Focus item 5:** set the storage key to `"{not json"` and to `{"solved":[99]}`, reload each time, confirm a fresh game and no console errors.
- [ ] **Step 4: Run** `node game-syntax-temple/test.mjs` — expected: all pass.
- [ ] **Step 5: Commit** `syntax-temple: world map, saved progress and help`.

### Task 7: Cross-browser check, gallery and README

**Files:**
- Create: `game-syntax-temple/README.md`, `game-syntax-temple/screenshot1.jpg`
- Modify: `gallery.yaml`, root `index.html` (regenerated), root `README.md`

- [ ] **Step 1: Headless screenshots** in Chrome (`--headless=new`) and Firefox (`--headless --screenshot`) of `?room=9` and of the map with `?solved=0,1,2,3`, at 1280 × 800. Compare the two browsers for bevel borders, menu bar height, listing font and canvas position; fix differences.
- [ ] **Step 2: Open the page from `file://`** in headless Chrome and confirm it renders (storage may be unavailable; the game must still start).
- [ ] **Step 3: Write `README.md`** (what it is, the word list, controls, how to run the tests, a line crediting Baba Is You as the inspiration for the rule-pushing idea) and save `screenshot1.jpg` from a mid-game room with a conditional on screen.
- [ ] **Step 4: Add** `game-syntax-temple: Syntax Temple` to `gallery.yaml` next to the other games, run `python3 build_gallery.py`, and add the entry to the root `README.md` in the same form as its neighbours.
- [ ] **Step 5: Run** `node game-syntax-temple/test.mjs` — expected: all pass. Open the root gallery page and confirm the new card and thumbnail.
- [ ] **Step 6: Commit** `syntax-temple: rewrite the rules of a temple, one word tile at a time`.
