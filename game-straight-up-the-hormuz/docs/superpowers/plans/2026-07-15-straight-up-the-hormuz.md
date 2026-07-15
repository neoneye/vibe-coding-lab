# Straight up the Hormuz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solo Minesweeper×Battleship deduction game with an oil economy, in one standalone `index.html`.

**Architecture:** All game logic is pure functions on a plain state object inside `<script id="hormuz-logic">` in `index.html`, exposed as `globalThis.Hormuz`. UI/DOM code lives in a separate `<script id="hormuz-ui">` block and only calls the logic API. A node test harness extracts the logic block by its id and asserts on it headlessly.

**Tech Stack:** Vanilla HTML/CSS/JS, zero dependencies. Node (any modern version) for the test harness.

## Global Constraints

- Single deliverable file `index.html`; no external assets, fonts, CDNs, or fetches.
- Logic script must not touch `document`/`window` (only `globalThis.Hormuz = ...`) so node can run it.
- All randomness in logic goes through an injectable `rng()` (defaults to `Math.random`) for deterministic tests.
- Spec: `docs/superpowers/specs/2026-07-15-straight-up-the-hormuz-design.md`. Copy values exactly: grid 10×10; fleet 5/4/3/3/2; shot 1 oil, recon 3, bombing 5, oil field +10; difficulties Easy 60/12/8, Normal 50/16/6, Straight Up 40/20/5; mine penalties standard −3, depth −5, EMP 3 actions.
- Tone everywhere in UI copy: sarcastic dark comedy.

---

### Task 1: Skeleton + test harness

**Files:**
- Create: `index.html`
- Create: `test/run_tests.mjs`

**Interfaces:**
- Produces: `index.html` with `<script id="hormuz-logic">` defining `globalThis.Hormuz` (namespace object) and `<script id="hormuz-ui">` (empty for now). `test/run_tests.mjs` exports nothing; running `node test/run_tests.mjs` evaluates the logic block and runs `assert`-based tests, printing `ALL TESTS PASSED` or throwing.

- [ ] **Step 1: Write harness expecting `Hormuz.SHIPS` and `Hormuz.DIFFICULTIES`**

```js
// test/run_tests.mjs
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const m = html.match(/<script id="hormuz-logic">([\s\S]*?)<\/script>/);
if (!m) throw new Error('logic script block not found');
(0, eval)(m[1]);
const H = globalThis.Hormuz;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
// simple deterministic rng for tests
function makeRng(seed = 42) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

test('namespace basics', () => {
  assert.equal(H.SHIPS.length, 5);
  assert.deepEqual(H.SHIPS.map(s => s.size), [5, 4, 3, 3, 2]);
  assert.deepEqual(H.DIFFICULTIES.normal, { oil: 50, mines: 16, oilFields: 6 });
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (e) { failed++; console.error(`FAIL - ${name}\n${e.stack}`); }
}
if (failed) { console.error(`${failed} test(s) failed`); process.exit(1); }
console.log('ALL TESTS PASSED');
```

- [ ] **Step 2: Run to verify it fails** — `node test/run_tests.mjs` → "logic script block not found"

- [ ] **Step 3: Minimal `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Straight up the Hormuz</title>
<style>/* filled in Task 6 */</style>
</head>
<body>
<div id="app"></div>
<script id="hormuz-logic">
'use strict';
(function () {
  const SHIPS = [
    { name: 'Carrier', size: 5 },
    { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 },
    { name: 'Submarine', size: 3 },
    { name: 'Destroyer', size: 2 },
  ];
  const DIFFICULTIES = {
    easy: { oil: 60, mines: 12, oilFields: 8 },
    normal: { oil: 50, mines: 16, oilFields: 6 },
    straightUp: { oil: 40, mines: 20, oilFields: 5 },
  };
  globalThis.Hormuz = { SHIPS, DIFFICULTIES };
})();
</script>
<script id="hormuz-ui">
'use strict';
// filled in Task 6
</script>
</body>
</html>
```

- [ ] **Step 4: Run tests** — expect `ALL TESTS PASSED`
- [ ] **Step 5: Commit** — `git add index.html test/run_tests.mjs && git commit -m "hormuz: skeleton + headless test harness"`

### Task 2: Board generation

**Files:**
- Modify: `index.html` (logic block)
- Modify: `test/run_tests.mjs`

**Interfaces:**
- Produces: `Hormuz.createGame(difficultyKey, rng?) -> state`. State shape:
  `{ size: 10, difficulty, oil, empRemaining: 0, status: 'playing', cells, ships, stats: { shots: 0, minesHit: 0, oilGained: 0, oilSpent: 0 }, reconZones: [] }`.
  `cells` is a 10×10 array of `{ content: 'water'|'ship'|'mine'|'oil', shipIndex: null|number, mineType: null|'standard'|'depth'|'oilfire'|'emp', number: 0.., revealed: false, flagged: false, burned: false }`.
  `ships` is `[{ name, size, cells: [[r,c],...], hits: 0, sunk: false }]`.
  Mine variant mix: easy → 1 each of depth/oilfire/emp, rest standard; normal/straightUp → 2 each, rest standard.

- [ ] **Step 1: Failing tests** — ship counts/shapes (straight lines, in bounds, no overlap), mine and oil counts per difficulty, `number` equals 8-neighbour count of ship+mine+oil for every water cell, mine variant mix, determinism for same seed.

```js
test('createGame board integrity', () => {
  const st = H.createGame('normal', makeRng(7));
  assert.equal(st.oil, 50);
  const flat = st.cells.flat();
  assert.equal(flat.filter(c => c.content === 'ship').length, 17);
  assert.equal(flat.filter(c => c.content === 'mine').length, 16);
  assert.equal(flat.filter(c => c.content === 'oil').length, 6);
  // ships straight and matching cells arrays
  for (const ship of st.ships) {
    assert.equal(ship.cells.length, ship.size);
    const rs = new Set(ship.cells.map(([r]) => r));
    const cs = new Set(ship.cells.map(([, c]) => c));
    assert.ok(rs.size === 1 || cs.size === 1);
  }
  // numbers correct
  const K = ['ship', 'mine', 'oil'];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    if (st.cells[r][c].content !== 'water') continue;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const cell = (st.cells[r + dr] || [])[c + dc];
      if (cell && K.includes(cell.content)) n++;
    }
    assert.equal(st.cells[r][c].number, n, `number at ${r},${c}`);
  }
  // variant mix (normal): 2 depth, 2 oilfire, 2 emp, 10 standard
  const mines = flat.filter(c => c.content === 'mine').map(c => c.mineType);
  for (const t of ['depth', 'oilfire', 'emp']) assert.equal(mines.filter(x => x === t).length, 2);
  assert.equal(mines.filter(x => x === 'standard').length, 10);
});
test('createGame deterministic per seed', () => {
  const a = H.createGame('easy', makeRng(3)), b = H.createGame('easy', makeRng(3));
  assert.deepEqual(a, b);
});
```

- [ ] **Step 2: Run, verify FAIL** (`createGame is not a function`)
- [ ] **Step 3: Implement `createGame`** — random straight placement with retry; then scatter mines and oil on free cells; shuffle a variant list `[depth,depth,oilfire,oilfire,emp,emp,...standard]` (1 each on easy) onto mine cells; compute numbers for water cells.
- [ ] **Step 4: Run tests, PASS**
- [ ] **Step 5: Commit** — `hormuz: board generation`

### Task 3: Reveal, flood, oil accounting, win/lose

**Files:** modify `index.html` logic + `test/run_tests.mjs`

**Interfaces:**
- Produces: `Hormuz.reveal(state, r, c) -> events[]` (mutates state). Event objects: `{type:'number',r,c,value}`, `{type:'hit',r,c,ship}`, `{type:'sunk',ship}`, `{type:'oil',r,c,amount:10}` or `{...amount:0,burned:true}`, `{type:'mine',r,c,mineType,...}` (Task 4), `{type:'flood',count}`, `{type:'won'}`, `{type:'lost'}`, `{type:'rejected',reason:'no-oil'|'revealed'|'not-playing'}`.
  Rules: rejected if status≠playing, cell revealed, or oil<1. Cost 1 oil (stats.shots++, stats.oilSpent++), decrement `empRemaining` if >0. Zero-water flood-reveals connected zeros + numbered border free. Ship hit increments ship.hits; full hits → sunk event. Oil field: +10 (stats.oilGained), unless `burned`. After resolution: all ships sunk → status 'won' + event; else oil<=0 → 'lost' + event.
- Also produces: `Hormuz.toggleFlag(state, r, c)` (free, only unrevealed, playing).

- [ ] **Step 1: Failing tests** — cost/oil math, flood on zero region (find a zero cell in a seeded board), hit/sunk on a known ship, oil capture +10 net +9, rejection when broke, win when last ship sunk, loss at 0 oil, flag toggle, no reveal on flagged? (flags are advisory only — reveal allowed; clicking clears flag). Use seeded boards and read coordinates from `state.ships`/`state.cells` in the test itself.
- [ ] **Step 2: Run, FAIL**
- [ ] **Step 3: Implement** (mine branch may be a stub `standard` −3 until Task 4)
- [ ] **Step 4: Run, PASS**
- [ ] **Step 5: Commit** — `hormuz: reveal mechanics, flood, win/lose`

### Task 4: Mine effects

**Files:** modify `index.html` logic + `test/run_tests.mjs`

**Interfaces:**
- Produces (all inside `reveal` when hitting a mine; stats.minesHit++):
  - standard: oil = max(0, oil−3); event `{type:'mine',mineType:'standard',penalty:3}`.
  - depth: oil = max(0, oil−5); reveal all 8 neighbours: ship segments become hits (may sink/win), oil fields burn (`burned:true`, no oil), mines revealed but NOT detonated, water reveals number (0 floods). Event includes `penalty:5` plus normal per-cell events.
  - oilfire: nearest (Euclidean, rng tie-break) unrevealed oil field gets `burned:true` and `revealed:true`; event `{type:'mine',mineType:'oilfire',target:[r,c]}`. No unrevealed oil left → behaves as standard.
  - emp: `state.empRemaining = 3`; event `{type:'mine',mineType:'emp'}`.
- Loss check runs after penalties (oil 0 + ships afloat = lost).

- [ ] **Step 1: Failing tests** — one per variant with seeded boards; oilfire fallback; depth-charge neighbour hits can sink a ship; loss via penalty.
- [ ] **Step 2: FAIL** → **Step 3: Implement** → **Step 4: PASS**
- [ ] **Step 5: Commit** — `hormuz: mine variants`

### Task 5: Air abilities

**Files:** modify `index.html` logic + `test/run_tests.mjs`

**Interfaces:**
- Produces: `Hormuz.recon(state, r, c) -> events[]` — cost 3; counts ALL contents in the 3×3 centred on (r,c) (clipped at edges): `{type:'recon', r, c, ships, mines, oil}`; pushes `{r,c,ships,mines,oil}` onto `state.reconZones`. Rejected if status≠playing, oil<3, or `empRemaining>0` (`reason:'emp'`).
- Produces: `Hormuz.bombingRun(state, orientation /*'row'|'col'*/, r, c) -> events[]` — cost 5; resolves the target cell and its two line-neighbours exactly like reveal-resolution (mines trigger, oil captured, hits land; already-revealed cells no-op; off-board cells skipped). Same rejection rules as recon. Single win/lose check after all three cells.
- Both count as one action for `empRemaining` decrement (reveal already does this; EMP-rejected calls decrement nothing).

- [ ] **Step 1: Failing tests** — recon counts on seeded board incl. corner clipping; bombing run 3-cell resolution incl. edge clip, mine trigger inside run, EMP rejection of both abilities, EMP timer expiry after 3 paid actions.
- [ ] **Step 2: FAIL** → **Step 3: Implement** (refactor reveal's single-cell resolution into internal `resolveCell` reused by depth charge + bombing run) → **Step 4: PASS**
- [ ] **Step 5: Commit** — `hormuz: recon + bombing run + EMP gating`

### Task 6: UI — start screen, grid, panels, interaction

**Files:** modify `index.html` (style + ui block)

**Interfaces:**
- Consumes the full logic API above. No logic in the UI block beyond calling it and rendering state.

- [ ] **Step 1: Layout + CSS** — dark naval palette (deep blue-blacks, amber oil gauge). Three-zone layout: left sidebar (fleet status silhouettes as rows of segment boxes turning red/struck when hit/sunk; oil gauge bar with count, hue shifts amber→red under 15; ability buttons with costs + EMP lockout countdown; mode indicator), centre 10×10 grid of buttons, right Captain's Log (scrollable, newest first). Start overlay: title, one-liner briefing, three difficulty buttons. Game-over overlay: verdict headline, stats (shots, mines hit, oil gained/wasted), replay button.
- [ ] **Step 2: Interaction wiring** — click = reveal (or ability targeting when armed); right-click/long-press = flag; Recon button arms recon mode (next click = centre); Bombing Run button arms bomb mode + orientation toggle (row/col) with hover preview of the 3 cells; Escape/second click disarms. Render function redraws grid + panels from state after every action; recon zones drawn as faint overlay badges with their counts.
- [ ] **Step 3: Manual verify in browser** — `open index.html`; play a full game at each difficulty far enough to see hit/sink/mine/oil/recon/bomb/EMP flows; verify tests still pass.
- [ ] **Step 4: Commit** — `hormuz: full UI`

### Task 7: Dark-comedy copy + polish

**Files:** modify `index.html` (ui block + style)

- [ ] **Step 1: Captain's Log copy pools** — ≥4 randomized sarcastic lines per event type (water, hit, sunk per-ship, each mine variant, oil capture, recon, bomb, EMP tick, low-oil nagging at <15/<8, win, loss), no immediate repeat (remember last index per pool). Win/loss overlays with dark-comedy verdicts.
- [ ] **Step 2: Animations** — CSS keyframes: tile flip/ripple on reveal, screen-shake on mine, flash on hit, slow burn flicker on burned oil, gauge pulse when low. Respect `prefers-reduced-motion`.
- [ ] **Step 3: Manual verify + tests** — full playthrough, `node test/run_tests.mjs` green.
- [ ] **Step 4: Commit** — `hormuz: flavor copy + animation polish`

## Self-Review

- Spec coverage: grid/fleet/numbers (T2), reveal/flood/oil/win-lose (T3), mine variants (T4), recon/bombing/EMP (T5), UI/panels/log/difficulties (T6), tone/animations/game-over (T7). Emergency Supply Drop intentionally dropped per spec. No gaps.
- Types consistent: single state object; `resolveCell` shared by reveal/depth/bombing.
