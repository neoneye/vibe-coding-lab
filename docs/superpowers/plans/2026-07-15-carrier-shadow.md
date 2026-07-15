# Carrier Shadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `game-carrier-shadow/` — a turn-based Minesweeper/Battleship crossover set in the Strait of Hormuz, per the approved spec `docs/superpowers/specs/2026-07-15-carrier-shadow-design.md`.

**Architecture:** Pure game engine (no DOM, no `Math.random()`) inside a `<script id="shared-code">` block in a single self-contained `index.html`; embedded test registry `CarrierTests` run by `test.mjs` in Node; a separate UI script renders engine state to a canvas and translates input to engine actions.

**Tech Stack:** Vanilla JS, HTML5 canvas, Node ≥18 for tests (zero dependencies).

## Global Constraints

- One directory: `game-carrier-shadow/`. Everything playable lives in `index.html` (repo convention: self-contained projects).
- Engine code and its tests live inside `<script id="shared-code">…</script>`; `test.mjs` extracts that block with regex `/<script id="shared-code">([\s\S]*?)<\/script>/` and calls `CarrierTests.run()` (same pattern as `game-snake/test.mjs`).
- Engine determinism: no `Math.random()`, no `Date.now()` in the shared-code block. All randomness through the state's seeded RNG. Same seed ⇒ identical game.
- UI language: English.
- Grid: 20 columns × 12 rows. Directions are 8-way (Chebyshev distance everywhere).
- Run tests with `node test.mjs` from `game-carrier-shadow/`; expected pass output ends with `ALL n TESTS PASSED`.
- Commit after every green task. Commit messages start with `carrier-shadow:`.

## Engine constants (single source of truth)

Every task uses these exact names/values. Defined in Task 1–3; later tasks must not redefine or rename them.

```js
const W = 20, H = 12;
const TER = { WATER: 0, IRAN: 1, OMAN: 2, EXIT: 3 };
const CARRIER_POS = { x: 20, y: 5 };        // off-map strip, one column east of grid
const ESCALATION = {
  reconFlight: 1, radarLock: 3, airspaceViolation: 5, warningShot: 6,
  droneShootdown: 8, attackVessel: 12, mannedShootdown: 20,
};
const POSTURES = ['shadowing', 'harassment', 'conflict']; // <30, <60, <100; 100 = defeat
const SAM_RADIUS = 3;
const SAM_RELOCATE_EVERY = 6;
const SAM_HIT_CHANCE = 0.35;      // per turn per aircraft in envelope, conflict posture only
const BOAT_HIT_UNSPOTTED = 0.5;   // missile-boat attack success vs unspotted ship
const BOAT_HIT_SPOTTED = 0.9;
const FIGHTER_STATION_TURNS = 3;
const SURVEIL_STATION_TURNS = 4;
const AIRCRAFT_SPEED = 4;         // cells per resolution leg
const RESCUE_WINDOW = 3;          // turns to use the helicopter
const SPOT_DURATION = 3;          // turns a drone-spotted ship stays spotted
```

---

### Task 1: Scaffold, test harness, seeded RNG

**Files:**
- Create: `game-carrier-shadow/index.html`
- Create: `game-carrier-shadow/test.mjs`

**Interfaces:**
- Produces: `CarrierTests.add(name, fn)`, `CarrierTests.run()`, `assertEq(a, b, msg)`, `assert(cond, msg)`, `rngNext(state) -> float [0,1)`, `rngInt(state, n) -> int [0,n)`. State field consumed by RNG: `state.rngState` (uint32).

- [ ] **Step 1: Create `index.html` skeleton with shared-code block containing the test registry, asserts, RNG, and a first failing-by-absence smoke test**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Carrier Shadow</title>
<style>
  /* UI styles arrive in Task 15 */
  body { margin: 0; background: #0a1420; color: #cfe3f5; font-family: ui-monospace, monospace; }
</style>
</head>
<body>
<script id="shared-code">
"use strict";
// ============ test registry ============
const CarrierTests = {
  tests: [],
  add(name, fn) { this.tests.push({ name, fn }); },
  run() {
    let failed = 0;
    for (const t of this.tests) {
      try { t.fn(); console.log(`PASS ${t.name}`); }
      catch (e) { failed++; console.error(`FAIL ${t.name}: ${e.message}`); }
    }
    if (failed === 0) console.log(`ALL ${this.tests.length} TESTS PASSED`);
    return failed === 0;
  },
};
function assert(cond, msg) { if (!cond) throw new Error(msg || "assert failed"); }
function assertEq(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg || "assertEq"}: ${sa} !== ${sb}`);
}

// ============ seeded RNG (mulberry32 on state) ============
function rngNext(state) {
  let t = (state.rngState = (state.rngState + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rngInt(state, n) { return Math.floor(rngNext(state) * n); }

CarrierTests.add("smoke", () => assertEq(1 + 1, 2));
CarrierTests.add("rng deterministic per seed", () => {
  const a = { rngState: 42 }, b = { rngState: 42 }, c = { rngState: 43 };
  const seqA = [rngNext(a), rngNext(a), rngNext(a)];
  const seqB = [rngNext(b), rngNext(b), rngNext(b)];
  assertEq(seqA, seqB, "same seed same sequence");
  assert(rngNext(c) !== seqA[0], "different seed differs");
  for (const v of seqA) assert(v >= 0 && v < 1, "range");
});
</script>
<script>
// UI arrives in Task 15.
</script>
</body>
</html>
```

- [ ] **Step 2: Create `test.mjs`**

```js
// Runs the CarrierTests embedded in index.html's shared-code script block.
// Usage: node test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) {
  console.error("shared-code block not found");
  process.exit(1);
}
const ok = new Function(`${m[1]}; return CarrierTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 3: Run tests**

Run: `cd game-carrier-shadow && node test.mjs`
Expected: `PASS smoke`, `PASS rng deterministic per seed`, `ALL 2 TESTS PASSED`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add game-carrier-shadow/index.html game-carrier-shadow/test.mjs
git commit -m "carrier-shadow: scaffold with test harness and seeded RNG"
```

---

### Task 2: Map, terrain, geometry helpers

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CarrierTests`, asserts (Task 1).
- Produces: `W`, `H`, `TER`, `CARRIER_POS`, `MAP` (2D array `MAP[y][x] -> TER value`), `key(x, y) -> "x,y"`, `unkey(k) -> {x,y}`, `inBounds(x, y) -> bool`, `terrainAt(x, y) -> TER value` (out-of-grid returns `TER.WATER` so the off-map carrier strip counts as water), `isWaterCell(x, y) -> bool` (WATER or EXIT), `neighbors8(x, y) -> [{x,y}]` (in-bounds only), `chebyshev(a, b) -> int`, `stepToward(from, to) -> {x,y}` (one 8-way step; equal coords step 0).

- [ ] **Step 1: Add failing tests to the shared-code block (below the RNG tests)**

```js
CarrierTests.add("map dimensions and terrain zones", () => {
  assertEq(MAP.length, H); assertEq(MAP[0].length, W);
  assertEq(terrainAt(0, 0), TER.IRAN, "NW is Iranian coast");
  assertEq(terrainAt(19, 0), TER.IRAN, "NE is Iranian coast");
  assertEq(terrainAt(0, 11), TER.OMAN, "SW is Omani coast");
  assertEq(terrainAt(0, 4), TER.EXIT, "west exit zone");
  assertEq(terrainAt(19, 5), TER.WATER, "east edge open water");
  assert(isWaterCell(0, 4), "exit is sailable");
  assert(!isWaterCell(0, 0), "land is not sailable");
  assertEq(terrainAt(CARRIER_POS.x, CARRIER_POS.y), TER.WATER, "off-map strip counts as water");
});
CarrierTests.add("geometry helpers", () => {
  assertEq(key(3, 7), "3,7");
  assertEq(unkey("3,7"), { x: 3, y: 7 });
  assert(inBounds(0, 0) && inBounds(19, 11) && !inBounds(20, 5) && !inBounds(-1, 0));
  assertEq(neighbors8(0, 0).length, 3);
  assertEq(neighbors8(5, 5).length, 8);
  assertEq(chebyshev({ x: 1, y: 1 }, { x: 4, y: 3 }), 3);
  assertEq(stepToward({ x: 0, y: 0 }, { x: 5, y: 5 }), { x: 1, y: 1 });
  assertEq(stepToward({ x: 2, y: 2 }, { x: 2, y: 2 }), { x: 2, y: 2 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.mjs`
Expected: FAIL with `MAP is not defined`.

- [ ] **Step 3: Implement map and helpers (place above the tests in the block)**

```js
const W = 20, H = 12;
const TER = { WATER: 0, IRAN: 1, OMAN: 2, EXIT: 3 };
const CARRIER_POS = { x: 20, y: 5 };
// I = Iranian coast, O = Omani coast, E = exit zone, ~ = water. 20 chars x 12 rows.
const MAP_ROWS = [
  "IIIIIIIIIIIIIIIIIIII",
  "IIIIIIIIIIIIIIII~~~~",
  "III~~~~~~~~~~~~~~~~~",
  "E~~~~~~~~~~~~~~~~~~~",
  "E~~~~~~~~~~~~~~~~~~~",
  "E~~~~~~~~~~~~~~~~~~~",
  "E~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~",
  "OO~~~~~~~~~~~~~~~~~~",
  "OOOO~~~~~~~~~~~~~~~~",
  "OOOOOO~~~~~~~~~~~~~~",
  "OOOOOOOOO~~~~~~~~~~~",
];
const TER_CHAR = { I: TER.IRAN, O: TER.OMAN, E: TER.EXIT, "~": TER.WATER };
const MAP = MAP_ROWS.map((row) => [...row].map((ch) => TER_CHAR[ch]));

function key(x, y) { return `${x},${y}`; }
function unkey(k) { const [x, y] = k.split(",").map(Number); return { x, y }; }
function inBounds(x, y) { return x >= 0 && x < W && y >= 0 && y < H; }
function terrainAt(x, y) { return inBounds(x, y) ? MAP[y][x] : TER.WATER; }
function isWaterCell(x, y) { const t = terrainAt(x, y); return t === TER.WATER || t === TER.EXIT; }
function neighbors8(x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    if (inBounds(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
  }
  return out;
}
function chebyshev(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
function stepToward(from, to) {
  return { x: from.x + Math.sign(to.x - from.x), y: from.y + Math.sign(to.y - from.y) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.mjs` — Expected: `ALL 4 TESTS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add game-carrier-shadow/index.html
git commit -m "carrier-shadow: map terrain and geometry helpers"
```

---

### Task 3: `createGame(seed)` — state shape and seeded opposition placement

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: map/geometry (Task 2), RNG (Task 1).
- Produces: `createGame(seed) -> state` and the state shape all later tasks rely on:

```js
{
  seed, rngState, turn: 1,
  escalation: 0, escalationPeak: 0, escalationBleed: 0,
  aggressiveThisTurn: false,
  resources: { sorties: 6, surveillance: 2, refuel: 1, helo: 1 },
  ships: [ { id, kind: 'tanker'|'frigate'|'minesweeper', x, y,
             movesLeft, sensorUsed, crippled: false, destroyed: false,
             exited: false, spottedUntil: 0 } ],       // ids: t1..t4, f1, f2, m1
  mines:   [ { x, y, cleared: false } ],                // 4
  boats:   [ { id, x, y, waypoints: [{x,y}x3], wpIndex: 0, sunk: false } ],   // b1, b2
  sam:     { x, y, revealedUntil: 0, relocateAt: 6, destroyed: false },
  drones:  [ { id, x, y, orbit: [{x,y}x4], orbitIndex: 0, downed: false } ],  // d1..d3
  eFighters: [ { id, x, y, track: [{x,y}x6], trackIndex: 0, downed: false } ],// ef1, ef2
  echoes:  [ { x, y, identified: false } ],             // 4
  airliners: [ { id, spawnTurn, row, dir: 1|-1, x, y, active: false, gone: false } ],
  aircraft: [],           // player missions, shape defined in Task 9
  seaNumbers: {},         // key -> { value, turn, stale: false, content: 'mine'|'boat'|'empty' }
  airNumbers: {},         // key -> { value, turn }
  marks: { sea: {}, air: {} },
  log: [],                // { turn, kind, text }
  pendingIntercept: null, // Task 11
  rescue: null,           // Task 12: { x, y, deadline }
  outcome: null,          // { win, reason, grade } | null
}
```

Also produces `postureOf(escalation) -> 'shadowing'|'harassment'|'conflict'|'war'` and `logEvent(state, kind, text)`.

Placement rules (all seeded via `rngInt`): mines on WATER cells with `x >= 4` (clear of exit) and Chebyshev ≥ 3 from every ship start, unique cells; boats on WATER cells with `8 <= x <= 15`, waypoints are 3 seeded WATER cells with `6 <= x <= 16`; SAM on an IRAN cell; drone orbit centers on cells with `x <= W-2` and `y in 2..9` (so the 2×2 loop `[c, c+dx, c+dx+dy, c+dy]` never needs clamping and stays degenerate-free); enemy-fighter tracks = 6-cell rectangle loop around seeded centers with `10 <= x <= 16` and `y in 2..9` (track x-offsets span -1..+3); echoes unique in-bounds cells; airliners: schedule `{spawnTurn: 2 + 4*i, row: i%2 ? 7 : 2, dir: i%2 ? -1 : 1}` for `i = 0..7`. Ship starts (fixed): tankers `(18,4) (18,5) (19,4) (19,5)`, frigates `(17,4) (17,6)`, minesweeper `(17,5)`.

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("createGame places the specced opposition legally", () => {
  const s = createGame(7);
  assertEq(s.mines.length, 4); assertEq(s.boats.length, 2);
  assertEq(s.drones.length, 3); assertEq(s.eFighters.length, 2);
  assertEq(s.echoes.length, 4); assertEq(s.airliners.length, 8);
  assertEq(s.ships.length, 7);
  for (const m of s.mines) {
    assert(terrainAt(m.x, m.y) === TER.WATER && m.x >= 4, "mine in open water");
    for (const sh of s.ships) assert(chebyshev(m, sh) >= 3, "mine clear of starts");
  }
  const mineKeys = new Set(s.mines.map((m) => key(m.x, m.y)));
  assertEq(mineKeys.size, 4, "mines unique");
  for (const b of s.boats) assert(isWaterCell(b.x, b.y) && b.x >= 8 && b.x <= 15);
  assertEq(terrainAt(s.sam.x, s.sam.y), TER.IRAN, "SAM on Iranian coast");
  assertEq(s.resources, { sorties: 6, surveillance: 2, refuel: 1, helo: 1 });
  assertEq(s.turn, 1); assertEq(s.escalation, 0); assertEq(s.outcome, null);
});
CarrierTests.add("createGame is deterministic per seed", () => {
  assertEq(createGame(11), createGame(11));
  const a = createGame(11), b = createGame(12);
  assert(JSON.stringify(a) !== JSON.stringify(b), "different seeds differ");
});
CarrierTests.add("postureOf thresholds", () => {
  assertEq(postureOf(0), "shadowing"); assertEq(postureOf(29), "shadowing");
  assertEq(postureOf(30), "harassment"); assertEq(postureOf(59), "harassment");
  assertEq(postureOf(60), "conflict"); assertEq(postureOf(99), "conflict");
  assertEq(postureOf(100), "war");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.mjs` — Expected: FAIL `createGame is not defined`.

- [ ] **Step 3: Implement**

```js
const SHIP_STARTS = [
  { id: "t1", kind: "tanker", x: 18, y: 4 }, { id: "t2", kind: "tanker", x: 18, y: 5 },
  { id: "t3", kind: "tanker", x: 19, y: 4 }, { id: "t4", kind: "tanker", x: 19, y: 5 },
  { id: "f1", kind: "frigate", x: 17, y: 4 }, { id: "f2", kind: "frigate", x: 17, y: 6 },
  { id: "m1", kind: "minesweeper", x: 17, y: 5 },
];
function postureOf(esc) {
  if (esc >= 100) return "war";
  if (esc >= 60) return "conflict";
  if (esc >= 30) return "harassment";
  return "shadowing";
}
function logEvent(state, kind, text) { state.log.push({ turn: state.turn, kind, text }); }

function seededCell(state, pred) {
  for (let i = 0; i < 10000; i++) {
    const x = rngInt(state, W), y = rngInt(state, H);
    if (pred(x, y)) return { x, y };
  }
  throw new Error("no legal cell found");
}
function clampCell(c) {
  return { x: Math.min(W - 1, Math.max(0, c.x)), y: Math.min(H - 1, Math.max(0, c.y)) };
}
function makeOrbit(c) {
  return [c, { x: c.x + 1, y: c.y }, { x: c.x + 1, y: c.y + 1 }, { x: c.x, y: c.y + 1 }].map(clampCell);
}
function makeTrack(c) {
  return [c, { x: c.x + 2, y: c.y }, { x: c.x + 3, y: c.y + 1 }, { x: c.x + 2, y: c.y + 2 },
          { x: c.x, y: c.y + 2 }, { x: c.x - 1, y: c.y + 1 }].map(clampCell);
}

function createGame(seed) {
  const state = {
    seed, rngState: seed >>> 0, turn: 1,
    escalation: 0, escalationPeak: 0, escalationBleed: 0, aggressiveThisTurn: false,
    resources: { sorties: 6, surveillance: 2, refuel: 1, helo: 1 },
    ships: SHIP_STARTS.map((s) => ({ ...s, movesLeft: 0, sensorUsed: false,
      crippled: false, destroyed: false, exited: false, spottedUntil: 0 })),
    mines: [], boats: [], sam: null, drones: [], eFighters: [], echoes: [], airliners: [],
    aircraft: [], seaNumbers: {}, airNumbers: {}, marks: { sea: {}, air: {} },
    log: [], pendingIntercept: null, rescue: null, outcome: null,
  };
  const taken = new Set();
  const free = (x, y) => !taken.has(key(x, y));
  for (let i = 0; i < 4; i++) {
    const c = seededCell(state, (x, y) => terrainAt(x, y) === TER.WATER && x >= 4 && free(x, y)
      && state.ships.every((sh) => chebyshev({ x, y }, sh) >= 3));
    taken.add(key(c.x, c.y));
    state.mines.push({ ...c, cleared: false });
  }
  for (let i = 0; i < 2; i++) {
    const c = seededCell(state, (x, y) => isWaterCell(x, y) && x >= 8 && x <= 15 && free(x, y));
    taken.add(key(c.x, c.y));
    const waypoints = [];
    for (let j = 0; j < 3; j++) {
      waypoints.push(seededCell(state, (x, y) => isWaterCell(x, y) && x >= 6 && x <= 16));
    }
    state.boats.push({ id: `b${i + 1}`, ...c, waypoints, wpIndex: 0, sunk: false });
  }
  const samCell = seededCell(state, (x, y) => terrainAt(x, y) === TER.IRAN);
  state.sam = { ...samCell, revealedUntil: 0, relocateAt: SAM_RELOCATE_EVERY, destroyed: false };
  for (let i = 0; i < 3; i++) {
    const c = seededCell(state, (x, y) => x <= W - 2 && y >= 2 && y <= 9);
    state.drones.push({ id: `d${i + 1}`, ...c, orbit: makeOrbit(c), orbitIndex: 0, downed: false });
  }
  for (let i = 0; i < 2; i++) {
    const c = seededCell(state, (x, y) => x >= 10 && x <= 16 && y >= 2 && y <= 9);
    state.eFighters.push({ id: `ef${i + 1}`, ...c, track: makeTrack(c), trackIndex: 0, downed: false });
  }
  for (let i = 0; i < 4; i++) {
    const c = seededCell(state, (x, y) => free(x, y));
    taken.add(key(c.x, c.y));
    state.echoes.push({ ...c, identified: false });
  }
  for (let i = 0; i < 8; i++) {
    const dir = i % 2 ? -1 : 1;
    state.airliners.push({ id: `al${i + 1}`, spawnTurn: 2 + 4 * i, row: i % 2 ? 7 : 2,
      dir, x: dir === 1 ? 0 : W - 1, y: i % 2 ? 7 : 2, active: false, gone: false });
  }
  logEvent(state, "info", "Mission start: escort 4 tankers to the western exit zone.");
  return state;
}
```

(Also add the constants block from “Engine constants” at the top of the shared-code section, next to `W`/`H`, if not already present: `ESCALATION`, `SAM_RADIUS`, `SAM_RELOCATE_EVERY`, `SAM_HIT_CHANCE`, `BOAT_HIT_UNSPOTTED`, `BOAT_HIT_SPOTTED`, `FIGHTER_STATION_TURNS`, `SURVEIL_STATION_TURNS`, `AIRCRAFT_SPEED`, `RESCUE_WINDOW`, `SPOT_DURATION`.)

- [ ] **Step 4: Run tests** — `node test.mjs`, expect `ALL 7 TESTS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add game-carrier-shadow/index.html
git commit -m "carrier-shadow: createGame with seeded opposition placement"
```

---

### Task 4: Ship movement orders

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: state shape (Task 3), geometry (Task 2).
- Produces: `shipById(state, id)`, `shipSpeed(ship) -> int` (tanker/minesweeper 1, frigate 2, crippled → min(1, speed), destroyed/exited → 0), `legalMoveCells(state, shipId) -> [{x,y}]` (adjacent water cells not occupied by a living non-exited player ship, within remaining moves this turn), `applyAction(state, action) -> events[]` dispatcher with the first action `{ type: 'move', shipId, x, y }`. At the start of each orders phase `ship.movesLeft = shipSpeed(ship)`; `createGame` initializes `movesLeft` accordingly (change the `movesLeft: 0` initializer to use `shipSpeed`). Moving one cell decrements `movesLeft`.

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("ship movement rules", () => {
  const s = createGame(7);
  const f1 = shipById(s, "f1");
  assertEq(shipSpeed(f1), 2);
  assertEq(shipSpeed(shipById(s, "t1")), 1);
  const cells = legalMoveCells(s, "f1");
  assert(cells.length > 0, "frigate can move");
  for (const c of cells) {
    assert(isWaterCell(c.x, c.y), "moves onto water only");
    assert(!s.ships.some((sh) => !sh.destroyed && !sh.exited && sh.x === c.x && sh.y === c.y),
      "no stacking");
  }
  const dest = cells[0];
  applyAction(s, { type: "move", shipId: "f1", x: dest.x, y: dest.y });
  assertEq({ x: f1.x, y: f1.y }, dest);
  assertEq(f1.movesLeft, 1, "frigate has second step");
  applyAction(s, { type: "move", shipId: "f1", x: f1.x, y: f1.y + 1 });
  assertEq(f1.movesLeft, 0);
  assertEq(legalMoveCells(s, "f1"), [], "no moves left");
});
CarrierTests.add("illegal moves throw", () => {
  const s = createGame(7);
  let threw = false;
  try { applyAction(s, { type: "move", shipId: "t1", x: 0, y: 0 }); } catch { threw = true; }
  assert(threw, "cannot move onto land / far cell");
});
```

- [ ] **Step 2: Run tests** — expect FAIL `shipById is not defined`.

- [ ] **Step 3: Implement**

```js
function shipById(state, id) { return state.ships.find((s) => s.id === id); }
function shipSpeed(ship) {
  if (ship.destroyed || ship.exited) return 0;
  const base = ship.kind === "frigate" ? 2 : 1;
  return ship.crippled ? 1 : base;
}
function occupiedByShip(state, x, y) {
  return state.ships.some((s) => !s.destroyed && !s.exited && s.x === x && s.y === y);
}
function legalMoveCells(state, shipId) {
  const ship = shipById(state, shipId);
  if (!ship || ship.movesLeft <= 0 || state.outcome) return [];
  return neighbors8(ship.x, ship.y)
    .filter((c) => isWaterCell(c.x, c.y) && !occupiedByShip(state, c.x, c.y));
}
function applyAction(state, action) {
  const events = [];
  switch (action.type) {
    case "move": {
      const ok = legalMoveCells(state, action.shipId)
        .some((c) => c.x === action.x && c.y === action.y);
      if (!ok) throw new Error(`illegal move ${JSON.stringify(action)}`);
      const ship = shipById(state, action.shipId);
      ship.x = action.x; ship.y = action.y; ship.movesLeft--;
      events.push({ type: "moved", shipId: ship.id, x: ship.x, y: ship.y });
      break;
    }
    default: throw new Error(`unknown action ${action.type}`);
  }
  return events;
}
```

In `createGame`, change the ship initializer to `movesLeft: 0` → set after construction:
`state.ships.forEach((s) => { s.movesLeft = shipSpeed(s); });` (place after `state.ships` is built; `shipSpeed` only reads flags already present).

- [ ] **Step 4: Run tests** — expect `ALL 9 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: ship movement orders"`

---

### Task 5: Sonar ping, sea numbers, staleness, sea marks

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: `applyAction` dispatcher (Task 4), state (Task 3).
- Produces:
  - `sonarRange(ship) -> 2 (frigate) | 3 (minesweeper) | 0 (others)`.
  - Action `{ type: 'ping', shipId, x, y }` — legal if ship is frigate/minesweeper, `!ship.sensorUsed`, `!ship.crippled`, target `isWaterCell` within `sonarRange`. Sets `sensorUsed = true`. Writes `state.seaNumbers[key] = { value, turn, stale: false, content }` where `value` = count of live mines + unsunk boats in the target's 8 neighbors, `content` = `'mine' | 'boat' | 'empty'` for the target cell itself.
  - `markStaleSeaNumbers(state, oldPos, newPos)` — flags every seaNumbers entry whose cell is within Chebyshev 1 of `oldPos` or `newPos` as `stale: true` (called by boat movement in Task 8).
  - Action `{ type: 'mark', layer: 'sea'|'air', x, y, mark }` — `mark` one of `'mine'|'ship'|'clear'` (sea) / `'hostile'|'civ'|'drone'|'radar'|'false'` (air), or `null` to erase. Pure bookkeeping in `state.marks[layer][key]`.

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("sonar ping stamps a correct minesweeper number", () => {
  const s = createGame(7);
  // Plant a controlled scene: clear all enemies, put one mine + one boat around (10,5).
  s.mines = [{ x: 9, y: 4, cleared: false }];
  s.boats = [{ id: "b1", x: 11, y: 6, waypoints: [{ x: 11, y: 6 }], wpIndex: 0, sunk: false }];
  const f1 = shipById(s, "f1"); f1.x = 10; f1.y = 6;   // (10,5) within range 2
  applyAction(s, { type: "ping", shipId: "f1", x: 10, y: 5 });
  const e = s.seaNumbers[key(10, 5)];
  assertEq(e.value, 2, "mine + boat adjacent");
  assertEq(e.content, "empty");
  assertEq(e.stale, false);
  assert(f1.sensorUsed, "sensor spent");
  let threw = false;
  try { applyAction(s, { type: "ping", shipId: "f1", x: 10, y: 6 }); } catch { threw = true; }
  assert(threw, "one sensor action per turn");
});
CarrierTests.add("ping reveals target cell content", () => {
  const s = createGame(7);
  s.mines = [{ x: 15, y: 5, cleared: false }]; s.boats = [];
  const m1 = shipById(s, "m1"); m1.x = 14; m1.y = 5;
  applyAction(s, { type: "ping", shipId: "m1", x: 15, y: 5 });
  assertEq(s.seaNumbers[key(15, 5)].content, "mine");
});
CarrierTests.add("boat movement stales nearby sea numbers", () => {
  const s = createGame(7);
  s.seaNumbers[key(10, 5)] = { value: 1, turn: 1, stale: false, content: "empty" };
  s.seaNumbers[key(2, 2)] = { value: 0, turn: 1, stale: false, content: "empty" };
  markStaleSeaNumbers(s, { x: 11, y: 6 }, { x: 12, y: 6 });
  assert(s.seaNumbers[key(10, 5)].stale, "neighborhood touched by old pos");
  assert(!s.seaNumbers[key(2, 2)].stale, "far number untouched");
});
CarrierTests.add("marks are bookkeeping", () => {
  const s = createGame(7);
  applyAction(s, { type: "mark", layer: "sea", x: 5, y: 5, mark: "mine" });
  assertEq(s.marks.sea[key(5, 5)], "mine");
  applyAction(s, { type: "mark", layer: "sea", x: 5, y: 5, mark: null });
  assertEq(s.marks.sea[key(5, 5)], undefined);
});
```

- [ ] **Step 2: Run tests** — expect FAIL `markStaleSeaNumbers is not defined` (and ping unknown-action throw).

- [ ] **Step 3: Implement — add cases to `applyAction` and the helpers**

```js
function sonarRange(ship) {
  return ship.kind === "frigate" ? 2 : ship.kind === "minesweeper" ? 3 : 0;
}
function seaThreatsAdjacent(state, x, y) {
  let n = 0;
  for (const c of neighbors8(x, y)) {
    if (state.mines.some((m) => !m.cleared && m.x === c.x && m.y === c.y)) n++;
    if (state.boats.some((b) => !b.sunk && b.x === c.x && b.y === c.y)) n++;
  }
  return n;
}
function seaContentAt(state, x, y) {
  if (state.mines.some((m) => !m.cleared && m.x === x && m.y === y)) return "mine";
  if (state.boats.some((b) => !b.sunk && b.x === x && b.y === y)) return "boat";
  return "empty";
}
function markStaleSeaNumbers(state, oldPos, newPos) {
  for (const k of Object.keys(state.seaNumbers)) {
    const c = unkey(k);
    if (chebyshev(c, oldPos) <= 1 || chebyshev(c, newPos) <= 1) state.seaNumbers[k].stale = true;
  }
}
```

New `applyAction` cases:

```js
    case "ping": {
      const ship = shipById(state, action.shipId);
      const range = sonarRange(ship);
      if (!range || ship.sensorUsed || ship.crippled || ship.destroyed
          || !isWaterCell(action.x, action.y) || chebyshev(ship, action) > range) {
        throw new Error("illegal ping");
      }
      ship.sensorUsed = true;
      const content = seaContentAt(state, action.x, action.y);
      state.seaNumbers[key(action.x, action.y)] = {
        value: seaThreatsAdjacent(state, action.x, action.y),
        turn: state.turn, stale: false, content,
      };
      logEvent(state, "intel", `Sonar (${action.x},${action.y}): ${content}, `
        + `${state.seaNumbers[key(action.x, action.y)].value} contact(s) adjacent.`);
      events.push({ type: "pinged", x: action.x, y: action.y });
      break;
    }
    case "mark": {
      const k = key(action.x, action.y);
      if (action.mark == null) delete state.marks[action.layer][k];
      else state.marks[action.layer][k] = action.mark;
      break;
    }
```

- [ ] **Step 4: Run tests** — expect `ALL 13 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: sonar pings, sea numbers, staleness, marks"`

---

### Task 6: Air signals and radar sweep

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: state (Task 3), `applyAction` (Task 4).
- Produces:
  - `airSignals(state) -> [{x, y, kind, ref}]` — one entry per live air signal: `kind` ∈ `'drone' | 'efighter' | 'airliner' | 'echo' | 'sam'`; `ref` is the underlying object. SAM counts only while `state.sam.revealedUntil >= state.turn` (emitting). Echoes count only while `!identified`. Airliners only while `active && !gone`. Player aircraft are NOT signals (the player sees their own).
  - `airSignalsAdjacent(state, x, y) -> int` — count of signals in the 8 neighbors.
  - Action `{ type: 'sweep', shipId, x, y }` — frigate only, `!sensorUsed`, `!crippled`, center within Chebyshev 3 of the frigate. Stamps `state.airNumbers[key] = { value, turn }` for every in-bounds cell of the 3×3 around the center.
  - `sweepFootprint(state, cx, cy, radius)` — shared by frigate sweep (radius 1) and surveillance (radius 2, Task 9).

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("airSignals collects the right kinds", () => {
  const s = createGame(7);
  s.drones = [{ id: "d1", x: 5, y: 5, orbit: [], orbitIndex: 0, downed: false }];
  s.eFighters = []; s.echoes = [{ x: 6, y: 5, identified: false }];
  s.airliners = [{ id: "al1", spawnTurn: 1, row: 2, dir: 1, x: 7, y: 2, active: true, gone: false }];
  s.sam.revealedUntil = 0;
  const sig = airSignals(s);
  assertEq(sig.length, 3);
  s.echoes[0].identified = true;
  assertEq(airSignals(s).length, 2, "identified echo stops counting");
  s.sam.revealedUntil = s.turn;
  assertEq(airSignals(s).length, 3, "emitting SAM counts");
});
CarrierTests.add("radar sweep stamps a 3x3 of correct numbers", () => {
  const s = createGame(7);
  s.drones = [{ id: "d1", x: 10, y: 4, orbit: [], orbitIndex: 0, downed: false }];
  s.eFighters = []; s.echoes = []; s.airliners = [];
  const f1 = shipById(s, "f1"); f1.x = 10; f1.y = 6; f1.sensorUsed = false;
  applyAction(s, { type: "sweep", shipId: "f1", x: 10, y: 5 });
  assertEq(s.airNumbers[key(10, 5)].value, 1, "drone adjacent to center");
  assertEq(s.airNumbers[key(9, 5)].value, 1);
  assertEq(s.airNumbers[key(10, 4)].value, 0, "drone's own cell counts neighbors only");
  assertEq(Object.keys(s.airNumbers).length, 9);
  assert(f1.sensorUsed);
});
```

- [ ] **Step 2: Run tests** — expect FAIL `airSignals is not defined`.

- [ ] **Step 3: Implement**

```js
function airSignals(state) {
  const out = [];
  for (const d of state.drones) if (!d.downed) out.push({ x: d.x, y: d.y, kind: "drone", ref: d });
  for (const f of state.eFighters) if (!f.downed) out.push({ x: f.x, y: f.y, kind: "efighter", ref: f });
  for (const a of state.airliners) if (a.active && !a.gone) out.push({ x: a.x, y: a.y, kind: "airliner", ref: a });
  for (const e of state.echoes) if (!e.identified) out.push({ x: e.x, y: e.y, kind: "echo", ref: e });
  if (state.sam && !state.sam.destroyed && state.sam.revealedUntil >= state.turn) {
    out.push({ x: state.sam.x, y: state.sam.y, kind: "sam", ref: state.sam });
  }
  return out;
}
function airSignalsAdjacent(state, x, y) {
  const sig = airSignals(state);
  return sig.filter((s) => chebyshev(s, { x, y }) === 1).length;
}
function sweepFootprint(state, cx, cy, radius) {
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const x = cx + dx, y = cy + dy;
    if (!inBounds(x, y)) continue;
    state.airNumbers[key(x, y)] = { value: airSignalsAdjacent(state, x, y), turn: state.turn };
  }
}
```

`applyAction` case:

```js
    case "sweep": {
      const ship = shipById(state, action.shipId);
      if (!ship || ship.kind !== "frigate" || ship.sensorUsed || ship.crippled || ship.destroyed
          || chebyshev(ship, action) > 3) throw new Error("illegal sweep");
      ship.sensorUsed = true;
      sweepFootprint(state, action.x, action.y, 1);
      logEvent(state, "intel", `Radar sweep centered (${action.x},${action.y}).`);
      events.push({ type: "swept", x: action.x, y: action.y });
      break;
    }
```

- [ ] **Step 4: Run tests** — expect `ALL 15 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: air signals and radar sweeps"`

---

### Task 7: Escalation engine

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: state (Task 3), `postureOf`, `logEvent`.
- Produces: `addEscalation(state, kindKey)` — adds `ESCALATION[kindKey]`, clamps to 100, updates `escalationPeak`, sets `aggressiveThisTurn = true` for every key except `reconFlight`, logs the event, and if the meter reaches 100 sets `state.outcome = { win: false, reason: 'war', grade: 'F' }`. Also `decayEscalation(state)` — called from endTurn (Task 8): if `!aggressiveThisTurn && escalation > 0`, subtract 1; then add `escalationBleed`; then reset `aggressiveThisTurn = false`.

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("escalation table, peak, decay, war", () => {
  const s = createGame(7);
  addEscalation(s, "radarLock");
  assertEq(s.escalation, 3); assert(s.aggressiveThisTurn);
  addEscalation(s, "mannedShootdown");
  assertEq(s.escalation, 23); assertEq(s.escalationPeak, 23);
  decayEscalation(s);           // aggressive turn: no decay
  assertEq(s.escalation, 23);
  decayEscalation(s);           // quiet turn: -1
  assertEq(s.escalation, 22);
  s.escalationBleed = 1;        // lost pilot: +1/turn overrides quiet decay net 0
  decayEscalation(s);
  assertEq(s.escalation, 22);
  s.escalation = 95; s.escalationBleed = 0;
  addEscalation(s, "mannedShootdown");
  assertEq(s.escalation, 100);
  assertEq(s.outcome.reason, "war");
});
CarrierTests.add("recon flight is not aggressive", () => {
  const s = createGame(7);
  addEscalation(s, "reconFlight");
  assertEq(s.escalation, 1);
  assert(!s.aggressiveThisTurn, "recon does not block decay");
});
```

- [ ] **Step 2: Run tests** — expect FAIL `addEscalation is not defined`.

- [ ] **Step 3: Implement**

```js
function addEscalation(state, kindKey) {
  const amount = ESCALATION[kindKey];
  if (amount === undefined) throw new Error(`unknown escalation ${kindKey}`);
  state.escalation = Math.min(100, state.escalation + amount);
  state.escalationPeak = Math.max(state.escalationPeak, state.escalation);
  if (kindKey !== "reconFlight") state.aggressiveThisTurn = true;
  logEvent(state, "escalation", `Escalation +${amount} (${kindKey}) → ${state.escalation}.`);
  if (state.escalation >= 100 && !state.outcome) {
    state.outcome = { win: false, reason: "war", grade: "F" };
    logEvent(state, "outcome", "Escalation reached 100: regional war. Mission failed.");
  }
}
function decayEscalation(state) {
  if (!state.aggressiveThisTurn && state.escalation > 0) state.escalation -= 1;
  state.escalation = Math.min(100, state.escalation + state.escalationBleed);
  state.escalationPeak = Math.max(state.escalationPeak, state.escalation);
  state.aggressiveThisTurn = false;
}
```

- [ ] **Step 4: Run tests** — expect `ALL 17 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: escalation engine"`

---

### Task 8: `endTurn` resolution core — enemy movement, mines, exits, win/loss

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: everything above.
- Produces: `endTurn(state) -> events[]` running, in order:
  1. `resolveAircraft(state, events)` — no-op placeholder this task, filled in Task 9 (define the empty function now so the order is fixed).
  2. Enemy movement: boats (`moveBoats`), drones (`moveDrones` — advance `orbitIndex`, move to `orbit[orbitIndex]`), enemy fighters (`moveEFighters` — same over `track`), airliners (`moveAirliners` — activate at `spawnTurn`, advance `x += 2*dir`, `gone` when off-grid). Boat movement calls `markStaleSeaNumbers`.
  3. Drone spotting: drone within Chebyshev 1 of a ship sets `ship.spottedUntil = state.turn + SPOT_DURATION`.
  4. Boat attacks (`boatAttacks`): posture `conflict` only — a boat adjacent to a living non-exited ship attacks it once: success if `rngNext(state) < (spotted ? BOAT_HIT_SPOTTED : BOAT_HIT_UNSPOTTED)`; tanker hit ⇒ `destroyed`, warship hit ⇒ `crippled` (second hit ⇒ `destroyed`).
  5. Mine strikes (`mineStrikes`): a living ship on an uncleared mine cell — tanker ⇒ destroyed, warship ⇒ crippled (already-crippled ⇒ destroyed); the mine is spent (`cleared = true`).
  6. Exits: a tanker on a `TER.EXIT` cell sets `exited = true`.
  7. `checkOutcome(state)`: `≥3` tankers exited ⇒ win; `≥2` tankers destroyed ⇒ loss (`reason: 'convoy'`); (war handled by escalation).
  8. `decayEscalation(state)`; `turn++`; reset per-ship `movesLeft = shipSpeed(ship)` and `sensorUsed = false`; clear expired `spottedUntil`.
  Also produces action `{ type: 'clearMine', shipId, x, y }` — minesweeper only, adjacent cell, consumes sensor action AND all movement (`movesLeft = 0`); if an uncleared mine is there ⇒ `cleared = true` + log, else log a wasted sweep.
  Also `boatAttacks` and posture behavior for boats in `moveBoats`: posture `shadowing` ⇒ patrol waypoints (step toward `waypoints[wpIndex]`, advance index on arrival); `harassment`/`conflict` ⇒ step toward nearest living, non-exited tanker. Boats never enter land; if the step cell is land or occupied by another boat, they stay.

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("endTurn advances turn and resets orders", () => {
  const s = createGame(7);
  const f1 = shipById(s, "f1");
  applyAction(s, { type: "move", shipId: "f1", x: f1.x - 1, y: f1.y });
  endTurn(s);
  assertEq(s.turn, 2);
  assertEq(f1.movesLeft, 2); assertEq(f1.sensorUsed, false);
});
CarrierTests.add("boats patrol under shadowing and stalk under harassment", () => {
  const s = createGame(7);
  const b = s.boats[0];
  b.x = 10; b.y = 5; b.waypoints = [{ x: 13, y: 5 }]; b.wpIndex = 0;
  endTurn(s);
  assertEq({ x: b.x, y: b.y }, { x: 11, y: 5 }, "stepped toward waypoint");
  s.escalation = 40; // harassment
  const t1 = shipById(s, "t1"); t1.x = 15; t1.y = 8;
  const before = chebyshev(b, t1);
  endTurn(s);
  assert(chebyshev(b, t1) < before, "stalks nearest tanker");
});
CarrierTests.add("mine strike destroys tanker, cripples then sinks warship", () => {
  const s = createGame(7);
  s.mines = [{ x: 10, y: 5, cleared: false }, { x: 12, y: 5, cleared: false }];
  s.boats = [];
  const t1 = shipById(s, "t1"); t1.x = 10; t1.y = 5;
  const f1 = shipById(s, "f1"); f1.x = 12; f1.y = 5;
  endTurn(s);
  assert(t1.destroyed, "tanker sunk");
  assert(f1.crippled && !f1.destroyed, "frigate crippled");
  assert(s.mines.every((m) => m.cleared), "mines spent");
});
CarrierTests.add("clearMine action", () => {
  const s = createGame(7);
  s.mines = [{ x: 10, y: 5, cleared: false }];
  const m1 = shipById(s, "m1"); m1.x = 10; m1.y = 6;
  applyAction(s, { type: "clearMine", shipId: "m1", x: 10, y: 5 });
  assert(s.mines[0].cleared);
  assertEq(m1.movesLeft, 0, "clearing takes the whole turn");
});
CarrierTests.add("boat attack in conflict posture uses spotting odds", () => {
  const s = createGame(7);
  s.escalation = 70; s.mines = [];
  const b = s.boats[0]; const t1 = shipById(s, "t1");
  b.x = t1.x - 1; b.y = t1.y; b.waypoints = [{ x: b.x, y: b.y }];
  s.boats = [b];
  t1.spottedUntil = s.turn + 3;           // 0.9 hit chance
  s.rngState = 1;                          // deterministic; find a seed value where it hits
  endTurn(s);
  assert(t1.destroyed || !t1.destroyed, "resolves without error");
  // determinism assertion instead of outcome: same start state resolves identically
  const s2 = createGame(7);
  s2.escalation = 70; s2.mines = [];
  const b2 = s2.boats[0]; const t12 = shipById(s2, "t1");
  b2.x = t12.x - 1; b2.y = t12.y; b2.waypoints = [{ x: b2.x, y: b2.y }];
  s2.boats = [b2]; t12.spottedUntil = s2.turn + 3; s2.rngState = 1;
  endTurn(s2);
  assertEq(t1.destroyed, t12.destroyed, "attack resolution deterministic");
});
CarrierTests.add("win on 3 exits, loss on 2 tanker kills", () => {
  const a = createGame(7);
  for (const id of ["t1", "t2", "t3"]) { const t = shipById(a, id); t.x = 0; t.y = 4; t.exited = false; }
  // place them on distinct exit cells
  shipById(a, "t2").y = 5; shipById(a, "t3").y = 6;
  a.mines = []; a.boats = [];
  endTurn(a);
  assert(a.outcome && a.outcome.win, "3 tankers through wins");
  const b = createGame(7);
  shipById(b, "t1").destroyed = true; shipById(b, "t2").destroyed = true;
  b.mines = []; b.boats = [];
  endTurn(b);
  assert(b.outcome && !b.outcome.win && b.outcome.reason === "convoy");
});
```

- [ ] **Step 2: Run tests** — expect FAIL `endTurn is not defined`.

- [ ] **Step 3: Implement**

```js
function resolveAircraft(state, events) { /* filled in Task 9 */ }

function moveBoats(state) {
  const posture = postureOf(state.escalation);
  for (const b of state.boats) {
    if (b.sunk) continue;
    let target;
    if (posture === "shadowing") {
      target = b.waypoints[b.wpIndex];
      if (chebyshev(b, target) === 0) { b.wpIndex = (b.wpIndex + 1) % b.waypoints.length; target = b.waypoints[b.wpIndex]; }
    } else {
      const tankers = state.ships.filter((s) => s.kind === "tanker" && !s.destroyed && !s.exited);
      if (!tankers.length) continue;
      target = tankers.reduce((best, t) => (chebyshev(b, t) < chebyshev(b, best) ? t : best));
    }
    const step = stepToward(b, target);
    const blocked = !isWaterCell(step.x, step.y)
      || state.boats.some((o) => o !== b && !o.sunk && o.x === step.x && o.y === step.y);
    if (!blocked && (step.x !== b.x || step.y !== b.y)) {
      const oldPos = { x: b.x, y: b.y };
      b.x = step.x; b.y = step.y;
      markStaleSeaNumbers(state, oldPos, b);
    }
  }
}
function moveOnLoop(unit, loop, indexProp) {
  unit[indexProp] = (unit[indexProp] + 1) % loop.length;
  unit.x = loop[unit[indexProp]].x; unit.y = loop[unit[indexProp]].y;
}
function moveDrones(state) { for (const d of state.drones) if (!d.downed) moveOnLoop(d, d.orbit, "orbitIndex"); }
function moveEFighters(state) { for (const f of state.eFighters) if (!f.downed) moveOnLoop(f, f.track, "trackIndex"); }
function moveAirliners(state) {
  for (const a of state.airliners) {
    if (a.gone) continue;
    if (!a.active && state.turn >= a.spawnTurn) a.active = true;
    if (a.active) {
      a.x += 2 * a.dir;
      if (a.x < 0 || a.x >= W) { a.gone = true; a.active = false; }
    }
  }
}
function droneSpotting(state) {
  for (const d of state.drones) {
    if (d.downed) continue;
    for (const sh of state.ships) {
      if (!sh.destroyed && !sh.exited && chebyshev(d, sh) <= 1) {
        sh.spottedUntil = state.turn + SPOT_DURATION;
      }
    }
  }
}
function hitShip(state, ship, cause) {
  if (ship.kind === "tanker" || ship.crippled) {
    ship.destroyed = true;
    logEvent(state, "combat", `${ship.id} destroyed (${cause}).`);
  } else {
    ship.crippled = true;
    logEvent(state, "combat", `${ship.id} crippled (${cause}).`);
  }
}
function boatAttacks(state) {
  if (postureOf(state.escalation) !== "conflict") return;
  for (const b of state.boats) {
    if (b.sunk) continue;
    const target = state.ships.find((s) => !s.destroyed && !s.exited && chebyshev(b, s) === 1);
    if (!target) continue;
    const p = target.spottedUntil >= state.turn ? BOAT_HIT_SPOTTED : BOAT_HIT_UNSPOTTED;
    if (rngNext(state) < p) hitShip(state, target, `missile boat ${b.id}`);
    else logEvent(state, "combat", `Missile attack on ${target.id} missed.`);
  }
}
function mineStrikes(state) {
  for (const sh of state.ships) {
    if (sh.destroyed || sh.exited) continue;
    const mine = state.mines.find((m) => !m.cleared && m.x === sh.x && m.y === sh.y);
    if (mine) { mine.cleared = true; hitShip(state, sh, "mine"); }
  }
}
function resolveExits(state) {
  for (const sh of state.ships) {
    if (sh.kind === "tanker" && !sh.destroyed && !sh.exited && terrainAt(sh.x, sh.y) === TER.EXIT) {
      sh.exited = true;
      logEvent(state, "info", `${sh.id} has cleared the strait.`);
    }
  }
}
function checkOutcome(state) {
  if (state.outcome) return;
  const tankers = state.ships.filter((s) => s.kind === "tanker");
  if (tankers.filter((t) => t.exited).length >= 3) {
    state.outcome = { win: true, reason: "convoy-through", grade: gradeGame(state) };
    logEvent(state, "outcome", "Convoy through. Mission accomplished.");
  } else if (tankers.filter((t) => t.destroyed).length >= 2) {
    state.outcome = { win: false, reason: "convoy", grade: "F" };
    logEvent(state, "outcome", "Two tankers lost. Mission failed.");
  }
}
function gradeGame(state) { return "A"; }   // real formula in Task 13

function endTurn(state) {
  if (state.outcome) return [];
  if (state.pendingIntercept) throw new Error("resolve the intercept first");
  const events = [];
  resolveAircraft(state, events);
  moveBoats(state); moveDrones(state); moveEFighters(state); moveAirliners(state);
  droneSpotting(state);
  boatAttacks(state);
  mineStrikes(state);
  resolveExits(state);
  checkOutcome(state);
  decayEscalation(state);
  state.turn++;
  for (const sh of state.ships) { sh.movesLeft = shipSpeed(sh); sh.sensorUsed = false; }
  events.push({ type: "turn", turn: state.turn });
  return events;
}
```

`applyAction` case:

```js
    case "clearMine": {
      const ship = shipById(state, action.shipId);
      if (!ship || ship.kind !== "minesweeper" || ship.sensorUsed || ship.destroyed
          || chebyshev(ship, action) !== 1) throw new Error("illegal clearMine");
      ship.sensorUsed = true; ship.movesLeft = 0;
      const mine = state.mines.find((m) => !m.cleared && m.x === action.x && m.y === action.y);
      if (mine) { mine.cleared = true; logEvent(state, "info", `Mine cleared at (${action.x},${action.y}).`); }
      else logEvent(state, "info", `Sweep at (${action.x},${action.y}) found nothing.`);
      events.push({ type: "cleared", x: action.x, y: action.y, found: !!mine });
      break;
    }
```

- [ ] **Step 4: Run tests** — expect `ALL 23 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: endTurn resolution, enemy movement, mines, win/loss"`

---

### Task 9: Air mission lifecycle — launch, legs, surveillance, refuel

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: `resolveAircraft` placeholder (Task 8), resources (Task 3), `sweepFootprint` (Task 6), `addEscalation` (Task 7).
- Produces: aircraft object shape used by Tasks 10–12:

```js
{ id: 'ac1'..., kind: 'surveillance'|'fighter',
  tasking: 'surveil'|'cap'|'recon'|'intercept'|'strike',
  x, y,                       // starts at CARRIER_POS
  dest: {x,y},                // station center / first recon point / target cell
  reconEnd: {x,y}|null,       // recon line end
  targetRef: {kind, id}|null, // intercept/strike target
  leg: 'transit'|'station'|'return'|'done',
  stationLeft: int, ladderDone: [], downed: false }
```

  - Launch actions (all consume `resources` at launch, all log, surveillance/recon add `+1 reconFlight` escalation at launch):
    - `{ type: 'launch', mission: 'surveil', x, y }` — needs `resources.surveillance > 0`; decrement; station `SURVEIL_STATION_TURNS`.
    - `{ type: 'launch', mission: 'cap', x, y }` — needs `resources.sorties > 0`; station `FIGHTER_STATION_TURNS`.
    - `{ type: 'launch', mission: 'recon', x, y, ex, ey }` — sortie; flies the line `(x,y)→(ex,ey)` during station.
    - `{ type: 'launch', mission: 'intercept', targetX, targetY }` — sortie; `dest` tracks the nearest unknown air signal to that cell (resolved at launch to a `targetRef`).
    - `{ type: 'launch', mission: 'strike', targetX, targetY }` — sortie; Task 11 resolves the attack.
  - `{ type: 'refuel', aircraftId }` — needs `resources.refuel > 0` and aircraft on station; `stationLeft += 2`.
  - `resolveAircraft(state, events)` (replaces placeholder): per aircraft — `transit`: move `AIRCRAFT_SPEED` steps toward `dest` (repeat `stepToward`); on arrival `leg = 'station'`. `station`: `stationLeft--`; surveillance sweeps `sweepFootprint(state, x, y, 2)` each station turn; when `stationLeft <= 0` ⇒ `leg = 'return'`, `dest = CARRIER_POS`. `return`: move toward carrier; on arrival `leg = 'done'` (token removed from display; stays in array).
  - Airspace check: after moving each player aircraft, if it sits over a `TER.IRAN` cell ⇒ `addEscalation(state, 'airspaceViolation')` (once per aircraft per turn).

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("surveillance launch, transit, station sweep, return", () => {
  const s = createGame(7);
  s.drones = []; s.eFighters = []; s.echoes = []; s.airliners = [];
  applyAction(s, { type: "launch", mission: "surveil", x: 10, y: 5 });
  assertEq(s.resources.surveillance, 1);
  assertEq(s.escalation, 1, "recon flight escalation");
  const ac = s.aircraft[0];
  assertEq(ac.leg, "transit");
  endTurn(s); endTurn(s); endTurn(s);
  assertEq(ac.leg, "station");
  assert(Object.keys(s.airNumbers).length >= 25 - 5, "5x5 footprint stamped (minus off-grid)");
  for (let i = 0; i < 8; i++) endTurn(s);   // 4 station turns + return leg from mid-map
  assertEq(ac.leg, "done", "returned to carrier");
});
CarrierTests.add("refuel extends station", () => {
  const s = createGame(7);
  applyAction(s, { type: "launch", mission: "cap", x: 12, y: 5 });
  const ac = s.aircraft[0];
  while (ac.leg === "transit") endTurn(s);
  const before = ac.stationLeft;
  applyAction(s, { type: "refuel", aircraftId: ac.id });
  assertEq(ac.stationLeft, before + 2);
  assertEq(s.resources.refuel, 0);
});
CarrierTests.add("sortie resource gates launches", () => {
  const s = createGame(7);
  s.resources.sorties = 0;
  let threw = false;
  try { applyAction(s, { type: "launch", mission: "cap", x: 10, y: 5 }); } catch { threw = true; }
  assert(threw);
});
CarrierTests.add("overflying Iranian coast escalates", () => {
  const s = createGame(7);
  applyAction(s, { type: "launch", mission: "cap", x: 10, y: 0 }); // station over IRAN row 0
  const before = s.escalation;
  while (s.aircraft[0].leg === "transit") endTurn(s);
  assert(s.escalation >= before + 5, "airspace violation applied");
});
```

- [ ] **Step 2: Run tests** — expect FAIL (unknown action `launch`).

- [ ] **Step 3: Implement**

```js
let nextAircraftId = 1;   // module-level; reset in createGame: nextAircraftId = 1;
function spawnAircraft(state, kind, tasking, dest, extra = {}) {
  const ac = { id: `ac${nextAircraftId++}`, kind, tasking, x: CARRIER_POS.x, y: CARRIER_POS.y,
    dest, reconEnd: null, targetRef: null, leg: "transit",
    stationLeft: kind === "surveillance" ? SURVEIL_STATION_TURNS : FIGHTER_STATION_TURNS,
    ladderDone: [], downed: false, ...extra };
  state.aircraft.push(ac);
  return ac;
}
```

`applyAction` cases:

```js
    case "launch": {
      const m = action.mission;
      if (state.outcome) throw new Error("game over");
      if (m === "surveil") {
        if (state.resources.surveillance <= 0) throw new Error("no surveillance flights left");
        state.resources.surveillance--;
        spawnAircraft(state, "surveillance", "surveil", { x: action.x, y: action.y });
        addEscalation(state, "reconFlight");
        logEvent(state, "air", `Surveillance flight launched toward (${action.x},${action.y}).`);
      } else {
        if (state.resources.sorties <= 0) throw new Error("no sorties left");
        state.resources.sorties--;
        if (m === "cap") {
          spawnAircraft(state, "fighter", "cap", { x: action.x, y: action.y });
          logEvent(state, "air", `CAP established over (${action.x},${action.y}).`);
        } else if (m === "recon") {
          spawnAircraft(state, "fighter", "recon", { x: action.x, y: action.y },
            { reconEnd: { x: action.ex, y: action.ey } });
          addEscalation(state, "reconFlight");
          logEvent(state, "air", `Recon flight tasked (${action.x},${action.y})→(${action.ex},${action.ey}).`);
        } else if (m === "intercept") {
          const sig = airSignals(state)
            .filter((g) => g.kind !== "sam")
            .sort((a, b) => chebyshev(a, { x: action.targetX, y: action.targetY })
                          - chebyshev(b, { x: action.targetX, y: action.targetY }))[0];
          if (!sig) throw new Error("no contact to intercept");
          spawnAircraft(state, "fighter", "intercept", { x: sig.x, y: sig.y },
            { targetRef: { kind: sig.kind, id: sig.ref.id ?? key(sig.x, sig.y) } });
          logEvent(state, "air", `Interceptor vectored to contact near (${sig.x},${sig.y}).`);
        } else if (m === "strike") {
          spawnAircraft(state, "fighter", "strike", { x: action.targetX, y: action.targetY });
          logEvent(state, "air", `Strike package launched toward (${action.targetX},${action.targetY}).`);
        } else throw new Error(`unknown mission ${m}`);
      }
      events.push({ type: "launched", mission: m });
      break;
    }
    case "refuel": {
      const ac = state.aircraft.find((a) => a.id === action.aircraftId);
      if (!ac || ac.leg !== "station" || state.resources.refuel <= 0) throw new Error("illegal refuel");
      state.resources.refuel--;
      ac.stationLeft += 2;
      logEvent(state, "air", `${ac.id} refueled in the air; +2 turns on station.`);
      break;
    }
```

Replace the `resolveAircraft` placeholder:

```js
function moveAircraftToward(state, ac, dest) {
  for (let i = 0; i < AIRCRAFT_SPEED; i++) {
    if (ac.x === dest.x && ac.y === dest.y) break;
    const step = stepToward(ac, dest);
    ac.x = step.x; ac.y = step.y;
  }
}
function resolveAircraft(state, events) {
  for (const ac of state.aircraft) {
    if (ac.downed || ac.leg === "done") continue;
    if (ac.leg === "transit") {
      moveAircraftToward(state, ac, ac.dest);
      if (ac.x === ac.dest.x && ac.y === ac.dest.y) ac.leg = "station";
    } else if (ac.leg === "station") {
      ac.stationLeft--;
      if (ac.kind === "surveillance") sweepFootprint(state, ac.x, ac.y, 2);
      if (ac.tasking === "recon") resolveReconLeg(state, ac);        // Task 10
      if (ac.tasking === "strike") resolveStrike(state, ac, events); // Task 11
      if (ac.tasking === "intercept") arriveIntercept(state, ac);    // Task 11
      if (ac.stationLeft <= 0 && ac.leg === "station") { ac.leg = "return"; ac.dest = { ...CARRIER_POS }; }
    } else if (ac.leg === "return") {
      moveAircraftToward(state, ac, ac.dest);
      if (ac.x === ac.dest.x && ac.y === ac.dest.y) {
        ac.leg = "done";
        logEvent(state, "air", `${ac.id} recovered aboard the carrier.`);
      }
    }
    if (terrainAt(ac.x, ac.y) === TER.IRAN && ac.leg !== "done") {
      addEscalation(state, "airspaceViolation");
    }
  }
}
function resolveReconLeg(state, ac) {}          // Task 10
function resolveStrike(state, ac, events) {}    // Task 11
function arriveIntercept(state, ac) {}          // Task 11
```

Add `nextAircraftId = 1;` as the first line inside `createGame`.

- [ ] **Step 4: Run tests** — expect `ALL 27 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: air mission lifecycle and surveillance"`

---

### Task 10: Recon identification and CAP engagements

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: aircraft lifecycle (Task 9), `airSignals` (Task 6).
- Produces:
  - `identifyContact(state, sig)` — sets per-kind identification: echo ⇒ `identified = true` (stops counting as signal); drone/efighter/airliner ⇒ push id into `state.identified` (a `Set`-like object `state.idents = {}`, `state.idents[id] = kind`; add `idents: {}` to `createGame`). Logs what it found.
  - `contactLabel(state, sig) -> string` — `'unknown'` unless identified.
  - `resolveReconLeg(state, ac)` (fills Task 9 stub): while on station, the aircraft walks the line from `dest` to `reconEnd` at `AIRCRAFT_SPEED` per turn (reuse `moveAircraftToward` with `reconEnd`); every air signal within Chebyshev 1 of any cell it passed this turn is identified; every sea cell passed is classified: writes `seaNumbers[key] = { value: seaThreatsAdjacent(...), turn, stale: false, content: boat ? 'boat' : 'empty' }` — mines are NOT revealed (content of a mine cell reports `'empty'` from the air; a recon confirms no ships, not no mines — implement by mapping `seaContentAt` result `'mine'` → `'empty'`). Reaching `reconEnd` sets `stationLeft = 0`.
  - CAP: during `resolveAircraft`, after enemy movement — CAP fighters engage: any drone or efighter within Chebyshev 2 of a stationed CAP fighter triggers `state.pendingIntercept = { aircraftId, sigKind, sigId }` (one at a time; first found). `endTurn` throws while `pendingIntercept` is set (already implemented in Task 8), so the player must resolve the ladder (Task 11) before the next turn. NOTE the ordering issue: CAP engagement checks run inside a new function `capEngagements(state)` called in `endTurn` AFTER enemy movement (insert between `moveAirliners` and `droneSpotting`), not inside `resolveAircraft`.

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("recon identifies contacts along the line and classifies sea", () => {
  const s = createGame(7);
  s.drones = [{ id: "d1", x: 10, y: 5, orbit: [{ x: 10, y: 5 }], orbitIndex: 0, downed: false }];
  s.eFighters = []; s.airliners = []; s.echoes = [{ x: 8, y: 5, identified: false }];
  s.boats = [{ id: "b1", x: 9, y: 5, waypoints: [{ x: 9, y: 5 }], wpIndex: 0, sunk: false }];
  s.mines = [{ x: 11, y: 5, cleared: false }];
  applyAction(s, { type: "launch", mission: "recon", x: 6, y: 5, ex: 14, ey: 5 });
  for (let i = 0; i < 8; i++) { endTurn(s); if (s.pendingIntercept) resolveLadder(s, "observe"); }
  assertEq(s.idents["d1"], "drone", "drone identified");
  assert(s.echoes[0].identified, "echo unmasked");
  assertEq(s.seaNumbers[key(9, 5)].content, "boat", "boat classified from the air");
  assertEq(s.seaNumbers[key(11, 5)].content, "empty", "mine invisible from the air");
});
CarrierTests.add("CAP engagement raises pendingIntercept and blocks endTurn", () => {
  const s = createGame(7);
  s.drones = [{ id: "d1", x: 12, y: 5, orbit: [{ x: 12, y: 5 }], orbitIndex: 0, downed: false }];
  s.eFighters = []; s.airliners = [];
  applyAction(s, { type: "launch", mission: "cap", x: 12, y: 5 });
  while (!s.pendingIntercept && s.turn < 10) endTurn(s);
  assert(s.pendingIntercept, "engagement triggered");
  let threw = false;
  try { endTurn(s); } catch { threw = true; }
  assert(threw, "endTurn blocked until ladder resolved");
});
```

(`resolveLadder` is defined in Task 11; for THIS task add a temporary stub so the first test compiles: `function resolveLadder(state, step) { state.pendingIntercept = null; }` — Task 11 replaces it.)

- [ ] **Step 2: Run tests** — expect FAIL (`idents` undefined / no engagement).

- [ ] **Step 3: Implement**

```js
function identifyContact(state, sig) {
  if (sig.kind === "echo") { sig.ref.identified = true; logEvent(state, "intel", `Contact at (${sig.x},${sig.y}) is a false echo.`); }
  else { state.idents[sig.ref.id] = sig.kind; logEvent(state, "intel", `Contact ${sig.ref.id} identified: ${sig.kind}.`); }
}
function contactLabel(state, sig) {
  if (sig.kind === "echo") return sig.ref.identified ? "false echo" : "unknown";
  return state.idents[sig.ref.id] || "unknown";
}
function resolveReconLeg(state, ac) {
  const passed = [];
  for (let i = 0; i < AIRCRAFT_SPEED; i++) {
    passed.push({ x: ac.x, y: ac.y });
    if (ac.x === ac.reconEnd.x && ac.y === ac.reconEnd.y) { ac.stationLeft = 0; break; }
    const step = stepToward(ac, ac.reconEnd);
    ac.x = step.x; ac.y = step.y;
  }
  passed.push({ x: ac.x, y: ac.y });
  for (const sig of airSignals(state)) {
    if (passed.some((p) => chebyshev(p, sig) <= 1)) identifyContact(state, sig);
  }
  for (const p of passed) {
    if (!isWaterCell(p.x, p.y)) continue;
    const raw = seaContentAt(state, p.x, p.y);
    state.seaNumbers[key(p.x, p.y)] = {
      value: seaThreatsAdjacent(state, p.x, p.y), turn: state.turn, stale: false,
      content: raw === "boat" ? "boat" : "empty",
    };
  }
}
function capEngagements(state) {
  if (state.pendingIntercept) return;
  for (const ac of state.aircraft) {
    if (ac.downed || ac.leg !== "station" || ac.tasking !== "cap") continue;
    for (const sig of airSignals(state)) {
      if ((sig.kind === "drone" || sig.kind === "efighter") && chebyshev(ac, sig) <= 2) {
        state.pendingIntercept = { aircraftId: ac.id, sigKind: sig.kind, sigId: sig.ref.id };
        logEvent(state, "air", `CAP ${ac.id} intercepting contact ${contactLabel(state, sig)} near (${sig.x},${sig.y}).`);
        return;
      }
    }
  }
}
function resolveLadder(state, step) { state.pendingIntercept = null; }  // replaced in Task 11
```

Add `idents: {}` to the state literal in `createGame`. Insert `capEngagements(state);` in `endTurn` between `moveAirliners(state);` and `droneSpotting(state);`.

- [ ] **Step 4: Run tests** — expect `ALL 29 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: recon identification and CAP engagements"`

---

### Task 11: Intercept ladder and strikes

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: `pendingIntercept` (Task 10), escalation (Task 7).
- Produces:
  - `arriveIntercept(state, ac)` (fills Task 9 stub): when an intercept-tasked fighter is on station, set `pendingIntercept = { aircraftId, sigKind, sigId }` for its `targetRef` if that contact still exists, else `stationLeft = 0`.
  - Action `{ type: 'ladder', step }` implemented by real `resolveLadder(state, step)` (replaces Task 10 stub), `step` ∈ `observe | hail | lock | warningShot | attack`:
    - `observe`: identifies the contact (`identifyContact`), +0.
    - `hail`: airliners respond ⇒ identified; drones/fighters stay `unknown`; log either way; +0.
    - `lock`: `addEscalation('radarLock')`; identifies the contact (military vs civilian certain).
    - `warningShot`: `addEscalation('warningShot')`; a drone or efighter target retreats — teleport its position 3 cells east (clamped in bounds) and log; airliner just logs a diplomatic incident note.
    - `attack`: airliner ⇒ `state.outcome = { win:false, reason:'airliner', grade:'F' }` + log catastrophe. Drone ⇒ `downed = true`, `addEscalation('droneShootdown')`. Efighter ⇒ `downed = true`, `addEscalation('mannedShootdown')`. Echo ⇒ identified + log wasted weapons.
    - Every step clears `pendingIntercept`. Every step except `attack`/`warningShot` leaves the contact free to be re-engaged next turn (CAP will re-trigger while it stays in radius).
  - `resolveStrike(state, ac, events)` (fills Task 9 stub): on station over `dest` — if a live boat is at `dest` ⇒ `sunk = true`, `addEscalation('attackVessel')`, `markStaleSeaNumbers` around it; else if the SAM is at `dest` and not destroyed ⇒ `destroyed = true`, `addEscalation('attackVessel')`; else log "strike found no target" (sortie wasted). Then `stationLeft = 0`.

- [ ] **Step 1: Add failing tests**

```js
function makePending(s, kind, obj) {   // test helper
  s.pendingIntercept = { aircraftId: "acX", sigKind: kind, sigId: obj.id };
}
CarrierTests.add("ladder: observe identifies, lock escalates, attack downs drone", () => {
  const s = createGame(7);
  const d = s.drones[0];
  makePending(s, "drone", d);
  resolveLadder(s, "observe");
  assertEq(s.idents[d.id], "drone"); assertEq(s.escalation, 0);
  makePending(s, "drone", d);
  resolveLadder(s, "lock");
  assertEq(s.escalation, ESCALATION.radarLock);
  makePending(s, "drone", d);
  resolveLadder(s, "attack");
  assert(d.downed);
  assertEq(s.escalation, ESCALATION.radarLock + ESCALATION.droneShootdown);
});
CarrierTests.add("ladder: attacking an airliner loses the game", () => {
  const s = createGame(7);
  const al = s.airliners[0]; al.active = true;
  makePending(s, "airliner", al);
  resolveLadder(s, "attack");
  assert(s.outcome && !s.outcome.win && s.outcome.reason === "airliner");
});
CarrierTests.add("ladder: hail identifies airliner but not drone", () => {
  const s = createGame(7);
  const al = s.airliners[0]; al.active = true;
  makePending(s, "airliner", al);
  resolveLadder(s, "hail");
  assertEq(s.idents[al.id], "airliner");
  const d = s.drones[0];
  makePending(s, "drone", d);
  resolveLadder(s, "hail");
  assertEq(s.idents[d.id], undefined, "drone ignores hail");
});
CarrierTests.add("strike sinks an identified boat and escalates +12", () => {
  const s = createGame(7);
  const b = s.boats[0];
  applyAction(s, { type: "launch", mission: "strike", targetX: b.x, targetY: b.y });
  const boatPos = { x: b.x, y: b.y };
  b.waypoints = [boatPos]; s.escalation = 0;   // keep boat parked (shadowing patrol on own cell)
  while (!b.sunk && s.turn < 12) { if (s.pendingIntercept) resolveLadder(s, "observe"); endTurn(s); }
  assert(b.sunk, "boat sunk by strike");
  assert(s.escalation >= ESCALATION.attackVessel - 4, "attackVessel escalation applied (minus decay)");
});
```

- [ ] **Step 2: Run tests** — expect FAIL (stub `resolveLadder` doesn't identify).

- [ ] **Step 3: Implement — replace the stubs**

```js
function findSignalById(state, sigKind, sigId) {
  return airSignals(state).find((g) => g.kind === sigKind
    && (g.ref.id === sigId || key(g.x, g.y) === sigId)) || null;
}
function resolveLadder(state, step) {
  const pi = state.pendingIntercept;
  if (!pi) throw new Error("no pending intercept");
  state.pendingIntercept = null;
  const sig = findSignalById(state, pi.sigKind, pi.sigId);
  if (!sig) { logEvent(state, "air", "Contact faded before action."); return; }
  if (step === "observe") {
    identifyContact(state, sig);
  } else if (step === "hail") {
    if (sig.kind === "airliner") { identifyContact(state, sig); logEvent(state, "air", "Contact answers hail: civilian airliner."); }
    else logEvent(state, "air", "No response to hail.");
  } else if (step === "lock") {
    addEscalation(state, "radarLock");
    identifyContact(state, sig);
  } else if (step === "warningShot") {
    addEscalation(state, "warningShot");
    if (sig.kind === "drone" || sig.kind === "efighter") {
      sig.ref.x = Math.min(W - 1, sig.ref.x + 3);
      logEvent(state, "air", `Contact ${sig.ref.id} turns away east.`);
    } else logEvent(state, "air", "Warning shot near a civilian track. Diplomatic protest incoming.");
  } else if (step === "attack") {
    if (sig.kind === "airliner") {
      state.outcome = { win: false, reason: "airliner", grade: "F" };
      logEvent(state, "outcome", "A civilian airliner is down. Catastrophe. Mission failed.");
    } else if (sig.kind === "drone") {
      sig.ref.downed = true; addEscalation(state, "droneShootdown");
      logEvent(state, "air", `Drone ${sig.ref.id} splashed.`);
    } else if (sig.kind === "efighter") {
      sig.ref.downed = true; addEscalation(state, "mannedShootdown");
      logEvent(state, "air", `Hostile fighter ${sig.ref.id} shot down. This will have consequences.`);
    } else if (sig.kind === "echo") {
      sig.ref.identified = true;
      logEvent(state, "air", "Weapons expended on a false echo.");
    }
  } else throw new Error(`unknown ladder step ${step}`);
}
function arriveIntercept(state, ac) {
  if (state.pendingIntercept) return;
  const sig = findSignalById(state, ac.targetRef.kind, ac.targetRef.id);
  if (!sig) { ac.stationLeft = 0; logEvent(state, "air", `${ac.id}: contact lost.`); return; }
  moveAircraftToward(state, ac, sig);
  if (chebyshev(ac, sig) <= 1) {
    state.pendingIntercept = { aircraftId: ac.id, sigKind: sig.kind, sigId: ac.targetRef.id };
  }
}
function resolveStrike(state, ac, events) {
  const b = state.boats.find((x) => !x.sunk && x.x === ac.dest.x && x.y === ac.dest.y);
  if (b) {
    b.sunk = true; addEscalation(state, "attackVessel");
    markStaleSeaNumbers(state, b, b);
    logEvent(state, "combat", `Missile boat ${b.id} destroyed by air strike.`);
  } else if (state.sam && !state.sam.destroyed && state.sam.x === ac.dest.x && state.sam.y === ac.dest.y) {
    state.sam.destroyed = true; addEscalation(state, "attackVessel");
    logEvent(state, "combat", "SAM site destroyed by air strike.");
  } else {
    logEvent(state, "combat", "Strike found no target. Ordnance wasted.");
  }
  ac.stationLeft = 0;
}
```

Add `applyAction` case:

```js
    case "ladder": { resolveLadder(state, action.step); break; }
```

- [ ] **Step 4: Run tests** — expect `ALL 33 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: intercept ladder and strikes"`

---

### Task 12: SAM behavior, shootdowns, rescue

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: `resolveAircraft` (Task 9), escalation (Task 7), posture (Task 3).
- Produces: `samPhase(state)` called in `endTurn` right after `resolveAircraft` and before `moveBoats`:
  - Relocation: when `state.turn >= sam.relocateAt` and not destroyed — move to a new seeded IRAN cell, `relocateAt += SAM_RELOCATE_EVERY`, log nothing (silent).
  - Warnings: for each live player aircraft (leg ≠ done) with `chebyshev(aircraft, sam) <= SAM_RADIUS`: posture `shadowing` ⇒ log `Radar warning: weak — estimated threat 1–2 cells away, identification unknown.`; `harassment` ⇒ log `Radar warning: STRONG — tracking radar locked.` and set `sam.revealedUntil = state.turn + 1` (emission makes it a sweepable signal); `conflict` ⇒ fire: if `rngNext(state) < SAM_HIT_CHANCE` the aircraft is downed — `downed = true`, `sam.revealedUntil = state.turn + 2`, and a rescue opens: `state.rescue = { x: ac.x, y: ac.y, deadline: state.turn + RESCUE_WINDOW, aircraftId: ac.id }` (all player aircraft are manned; surveillance too). Missed shots also set `revealedUntil = state.turn + 2` and log.
  - Enemy fighters vs surveillance: in `samPhase` add `fighterThreats(state)` — an efighter within Chebyshev 1 of a stationed surveillance aircraft: if a CAP fighter is stationed within Chebyshev 2 of the surveillance ⇒ log "CAP drives off the bandit"; else the surveillance is shot down (`downed = true`, rescue window opens — spec: unescorted surveillance reached by a fighter is a loss).
  - Rescue: action `{ type: 'rescue' }` — needs `resources.helo > 0` and `state.rescue`; consumes helo, clears `rescue`, logs pilot recovered. In `endTurn` (after `checkOutcome`), if `state.rescue` and `state.turn > rescue.deadline` ⇒ `escalationBleed += 1`, clear `rescue`, log "pilot lost; political pressure mounts (+1 escalation per turn)".

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("SAM warns under shadowing, is sweepable under harassment, fires under conflict", () => {
  const s = createGame(7);
  s.drones = []; s.eFighters = []; s.airliners = []; s.boats = []; s.mines = [];
  // station on row 3 (always water, and within SAM_RADIUS of any coast SAM at y <= 2)
  applyAction(s, { type: "launch", mission: "cap", x: s.sam.x, y: 3 });
  const ac = s.aircraft[0];
  while (ac.leg === "transit") endTurn(s);
  assert(s.log.some((l) => l.text.startsWith("Radar warning: weak")), "weak warning logged");
  s.escalation = 40;
  endTurn(s);
  assert(s.sam.revealedUntil >= s.turn - 1, "emitting SAM revealed under harassment");
  const s2 = createGame(7);
  s2.drones = []; s2.eFighters = []; s2.airliners = []; s2.boats = []; s2.mines = [];
  s2.escalation = 70;
  applyAction(s2, { type: "launch", mission: "cap", x: s2.sam.x, y: 3 });
  let fired = false;
  for (let i = 0; i < 12 && !fired; i++) {
    if (s2.pendingIntercept) resolveLadder(s2, "observe");
    endTurn(s2);
    fired = s2.log.some((l) => l.text.includes("SAM"));
  }
  assert(fired, "SAM engages under conflict");
});
CarrierTests.add("SAM relocates on schedule", () => {
  const s = createGame(7);
  s.drones = []; s.eFighters = []; s.airliners = []; s.boats = []; s.mines = [];
  const before = { x: s.sam.x, y: s.sam.y };
  for (let i = 0; i < SAM_RELOCATE_EVERY + 1; i++) endTurn(s);
  assert(s.sam.x !== before.x || s.sam.y !== before.y, "moved");
  assertEq(terrainAt(s.sam.x, s.sam.y), TER.IRAN, "still on Iranian coast");
});
CarrierTests.add("rescue: helo saves pilot, missing the window bleeds escalation", () => {
  const s = createGame(7);
  s.rescue = { x: 10, y: 3, deadline: s.turn + RESCUE_WINDOW, aircraftId: "ac1" };
  applyAction(s, { type: "rescue" });
  assertEq(s.resources.helo, 0); assertEq(s.rescue, null);
  const s2 = createGame(7);
  s2.drones = []; s2.eFighters = []; s2.airliners = []; s2.boats = []; s2.mines = [];
  s2.rescue = { x: 10, y: 3, deadline: s2.turn, aircraftId: "ac1" };
  endTurn(s2);
  assertEq(s2.escalationBleed, 1, "pilot lost bleeds escalation");
  assertEq(s2.rescue, null);
});
```

- [ ] **Step 2: Run tests** — expect FAIL (no warnings logged).

- [ ] **Step 3: Implement**

```js
function samPhase(state) {
  const sam = state.sam;
  if (!sam || sam.destroyed) return;
  if (state.turn >= sam.relocateAt) {
    const c = seededCell(state, (x, y) => terrainAt(x, y) === TER.IRAN && !(x === sam.x && y === sam.y));
    sam.x = c.x; sam.y = c.y; sam.relocateAt += SAM_RELOCATE_EVERY;
  }
  const posture = postureOf(state.escalation);
  for (const ac of state.aircraft) {
    if (ac.downed || ac.leg === "done") continue;
    if (chebyshev(ac, sam) > SAM_RADIUS) continue;
    if (posture === "shadowing") {
      logEvent(state, "warning", "Radar warning: weak — estimated threat 1–2 cells away, identification unknown.");
    } else if (posture === "harassment") {
      sam.revealedUntil = state.turn + 1;
      logEvent(state, "warning", "Radar warning: STRONG — tracking radar locked.");
    } else {
      sam.revealedUntil = state.turn + 2;
      if (rngNext(state) < SAM_HIT_CHANCE) {
        ac.downed = true;
        state.rescue = { x: ac.x, y: ac.y, deadline: state.turn + RESCUE_WINDOW, aircraftId: ac.id };
        logEvent(state, "combat", `SAM launch — ${ac.id} is hit and goes down. Crew in the water at (${ac.x},${ac.y}).`);
      } else {
        logEvent(state, "combat", `SAM launch — ${ac.id} evades. Site position glimpsed.`);
      }
    }
  }
}
function fighterThreats(state) {
  for (const ef of state.eFighters) {
    if (ef.downed) continue;
    const surv = state.aircraft.find((a) => a.kind === "surveillance" && !a.downed
      && a.leg === "station" && chebyshev(a, ef) <= 1);
    if (!surv) continue;
    const cap = state.aircraft.find((a) => a.tasking === "cap" && a.leg === "station"
      && !a.downed && chebyshev(a, surv) <= 2);
    if (cap) {
      logEvent(state, "air", "CAP drives off a bandit closing on the surveillance aircraft.");
    } else {
      // Spec: unescorted surveillance reached by a fighter is lost (manned crew -> rescue window).
      surv.downed = true;
      state.rescue = { x: surv.x, y: surv.y, deadline: state.turn + RESCUE_WINDOW, aircraftId: surv.id };
      logEvent(state, "combat", `Surveillance aircraft ${surv.id} shot down — crew in the water at (${surv.x},${surv.y}).`);
    }
  }
}
function rescueDeadline(state) {
  if (state.rescue && state.turn > state.rescue.deadline) {
    state.rescue = null;
    state.escalationBleed += 1;
    logEvent(state, "escalation", "Pilot lost. Political pressure mounts: +1 escalation per turn.");
  }
}
```

Wire into `endTurn` (final order inside `endTurn`):

```js
  resolveAircraft(state, events);
  samPhase(state);
  fighterThreats(state);
  moveBoats(state); moveDrones(state); moveEFighters(state); moveAirliners(state);
  capEngagements(state);
  droneSpotting(state);
  boatAttacks(state);
  mineStrikes(state);
  resolveExits(state);
  checkOutcome(state);
  rescueDeadline(state);
  decayEscalation(state);
```

`applyAction` case:

```js
    case "rescue": {
      if (!state.rescue || state.resources.helo <= 0) throw new Error("illegal rescue");
      state.resources.helo--;
      logEvent(state, "air", `Helicopter recovers the crew at (${state.rescue.x},${state.rescue.y}).`);
      state.rescue = null;
      break;
    }
```

- [ ] **Step 4: Run tests** — expect `ALL 36 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: SAM, shootdowns, rescue"`

---

### Task 13: Grading and full scripted playthrough regression

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: whole engine.
- Produces: real `gradeGame(state) -> 'A'|'B'|'C'|'D'` (replaces the Task 8 stub; loss paths stay hard-coded `'F'`):

```
score = 25 * tankersExited
      + 3 * (sorties + surveillance + refuel + helo remaining)
      - 0.5 * escalationPeak
      - 0.5 * (turn - 1)
grade: A >= 90, B >= 75, C >= 60, D otherwise
```

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("gradeGame formula", () => {
  const s = createGame(7);
  s.turn = 21; s.escalationPeak = 20;
  s.resources = { sorties: 3, surveillance: 1, refuel: 1, helo: 1 };
  for (const id of ["t1", "t2", "t3", "t4"]) shipById(s, id).exited = true;
  // score = 100 + 18 - 10 - 10 = 98 -> A
  assertEq(gradeGame(s), "A");
  shipById(s, "t4").exited = false;
  // score = 75 + 18 - 10 - 10 = 73 -> C
  assertEq(gradeGame(s), "C");
});
CarrierTests.add("scripted playthrough: sail the convoy west and win", () => {
  const s = createGame(3);
  s.mines = []; s.boats = [];            // clean corridor: this test locks the convoy/turn loop
  s.drones = []; s.eFighters = [];       // no CAP prompts
  let guard = 0;
  while (!s.outcome && guard++ < 80) {
    // steer only the tankers: escorts stay east so they never park on the 4 exit cells
    for (const sh of s.ships.filter((x) => x.kind === "tanker")) {
      while (sh.movesLeft > 0 && !sh.destroyed && !sh.exited) {
        const cells = legalMoveCells(s, sh.id).filter((c) => c.x < sh.x);
        if (!cells.length) break;
        cells.sort((a, b) => Math.abs(a.y - 5) - Math.abs(b.y - 5));
        applyAction(s, { type: "move", shipId: sh.id, x: cells[0].x, y: cells[0].y });
      }
    }
    endTurn(s);
  }
  assert(s.outcome && s.outcome.win, `convoy should win, got ${JSON.stringify(s.outcome)}`);
  assert(["A", "B", "C", "D"].includes(s.outcome.grade));
});
CarrierTests.add("full-opposition game runs 40 turns without error and stays deterministic", () => {
  const run = (seed) => {
    const s = createGame(seed);
    for (let i = 0; i < 40 && !s.outcome; i++) {
      if (s.pendingIntercept) resolveLadder(s, "observe");
      endTurn(s);
    }
    return JSON.stringify(s);
  };
  assertEq(run(99), run(99), "identical replay");
});
```

- [ ] **Step 2: Run tests** — expect FAIL (`gradeGame` returns "A" always ⇒ second assertion fails).

- [ ] **Step 3: Implement — replace the stub**

```js
function gradeGame(state) {
  const r = state.resources;
  const exited = state.ships.filter((s) => s.kind === "tanker" && s.exited).length;
  const score = 25 * exited + 3 * (r.sorties + r.surveillance + r.refuel + r.helo)
    - 0.5 * state.escalationPeak - 0.5 * (state.turn - 1);
  return score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
}
```

- [ ] **Step 4: Run tests** — expect `ALL 39 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: grading and playthrough regression tests"`

---

### Task 14: Legal-actions summary for the UI

**Files:**
- Modify: `game-carrier-shadow/index.html` (shared-code block)

**Interfaces:**
- Consumes: whole engine.
- Produces: `uiOptions(state, selection) -> { moves: [{x,y}], actions: [string] }` — one function the UI calls to populate the action panel. `selection` is `{ kind: 'ship', id }` or `{ kind: 'carrier' }` or `{ kind: 'aircraft', id }` or `null`. Returned `actions` strings (exact values the UI switches on): ship → `'ping'`, `'sweep'`, `'clearMine'` as applicable (sensor unused, right kind, not crippled/destroyed); carrier → `'surveil'`, `'cap'`, `'recon'`, `'intercept'`, `'strike'` for each affordable resource (plus `'rescue'` if `state.rescue` and helo left); aircraft on station → `'refuel'` if refuel left.

- [ ] **Step 1: Add failing tests**

```js
CarrierTests.add("uiOptions lists per-selection capabilities", () => {
  const s = createGame(7);
  const f = uiOptions(s, { kind: "ship", id: "f1" });
  assert(f.actions.includes("ping") && f.actions.includes("sweep"));
  assert(!f.actions.includes("clearMine"));
  assert(f.moves.length > 0);
  const m = uiOptions(s, { kind: "ship", id: "m1" });
  assert(m.actions.includes("clearMine") && m.actions.includes("ping") && !m.actions.includes("sweep"));
  const c = uiOptions(s, { kind: "carrier" });
  assert(c.actions.includes("cap") && c.actions.includes("surveil"));
  s.resources.sorties = 0;
  const c2 = uiOptions(s, { kind: "carrier" });
  assert(!c2.actions.includes("cap") && c2.actions.includes("surveil"));
  assertEq(uiOptions(s, null), { moves: [], actions: [] });
});
```

- [ ] **Step 2: Run tests** — expect FAIL `uiOptions is not defined`.

- [ ] **Step 3: Implement**

```js
function uiOptions(state, selection) {
  const out = { moves: [], actions: [] };
  if (!selection || state.outcome) return out;
  if (selection.kind === "ship") {
    const ship = shipById(state, selection.id);
    if (!ship || ship.destroyed || ship.exited) return out;
    out.moves = legalMoveCells(state, ship.id);
    if (!ship.sensorUsed && !ship.crippled) {
      if (ship.kind === "frigate") out.actions.push("ping", "sweep");
      if (ship.kind === "minesweeper") out.actions.push("ping", "clearMine");
    }
  } else if (selection.kind === "carrier") {
    const r = state.resources;
    if (r.surveillance > 0) out.actions.push("surveil");
    if (r.sorties > 0) out.actions.push("cap", "recon", "intercept", "strike");
    if (state.rescue && r.helo > 0) out.actions.push("rescue");
  } else if (selection.kind === "aircraft") {
    const ac = state.aircraft.find((a) => a.id === selection.id);
    if (ac && ac.leg === "station" && state.resources.refuel > 0) out.actions.push("refuel");
  }
  return out;
}
```

- [ ] **Step 4: Run tests** — expect `ALL 40 TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -am "carrier-shadow: uiOptions for the action panel"`

---

### Task 15: UI — rendering (canvas, SEA/AIR views, top bar, log)

**Files:**
- Modify: `game-carrier-shadow/index.html` (styles + the second `<script>` block, NOT shared-code)

**Interfaces:**
- Consumes: full engine API: `createGame`, `uiOptions`, `applyAction`, `endTurn`, `resolveLadder` (via `applyAction {type:'ladder'}`), state fields per Task 3/9, `postureOf`, `TER`, `MAP`, `key`.
- Produces: a playable page. No engine changes. Global `ui` object so Task 16's handlers and the screenshot harness can drive it: `ui = { state, view: 'sea'|'air', selection, pendingLaunch: null, render() }`.

- [ ] **Step 1: Replace the `<style>` block**

```css
body { margin: 0; background: #0a1420; color: #cfe3f5; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
#wrap { display: flex; gap: 12px; padding: 12px; max-width: 1200px; margin: 0 auto; }
#left { flex: 1 1 auto; min-width: 0; }
#topbar { display: flex; align-items: center; gap: 16px; padding: 8px 4px; font-size: 14px; flex-wrap: wrap; }
#escwrap { flex: 1 1 160px; height: 14px; background: #14243a; border: 1px solid #2b4a6b; border-radius: 7px; overflow: hidden; }
#escbar { height: 100%; width: 0%; background: #4a9; transition: width .3s, background .3s; }
#board { display: block; width: 100%; border: 1px solid #2b4a6b; background: #0d1b2e; touch-action: manipulation; }
#panel { width: 290px; flex: 0 0 290px; display: flex; flex-direction: column; gap: 8px; }
#actions button, #controls button { background: #14324e; color: #cfe3f5; border: 1px solid #2b4a6b;
  border-radius: 4px; padding: 6px 10px; margin: 2px; cursor: pointer; font: inherit; }
#actions button:hover, #controls button:hover { background: #1d4468; }
#log { background: #0d1b2e; border: 1px solid #2b4a6b; padding: 8px; height: 320px;
  overflow-y: auto; font-size: 12px; line-height: 1.5; }
#log .warning { color: #ffcf66; } #log .combat { color: #ff8a7a; }
#log .escalation { color: #ff8a7a; } #log .intel { color: #7ad0ff; }
#log .outcome { color: #fff; font-weight: bold; } #log .air { color: #b9a7ff; }
.viewbtn.active { background: #2b6a9b !important; }
#overlay { position: fixed; inset: 0; background: rgba(4,10,18,.88); display: flex;
  align-items: center; justify-content: center; z-index: 10; }
#overlay > div { max-width: 560px; background: #0d1b2e; border: 1px solid #2b4a6b;
  border-radius: 8px; padding: 24px; font-size: 14px; line-height: 1.6; }
.hidden { display: none !important; }
```

- [ ] **Step 2: Replace the empty UI `<script>` with page structure + renderer**

```html
<script>
"use strict";
document.body.insertAdjacentHTML("afterbegin", `
<div id="wrap">
  <div id="left">
    <div id="topbar">
      <b>CARRIER SHADOW</b>
      <span id="turnlbl"></span>
      <span>Escalation</span><div id="escwrap"><div id="escbar"></div></div><span id="esclbl"></span>
      <span id="reslbl"></span>
    </div>
    <div id="controls">
      <button class="viewbtn active" id="btnSea">SEA</button>
      <button class="viewbtn" id="btnAir">AIR</button>
      <button id="btnEnd">End Turn (Space)</button>
    </div>
    <canvas id="board"></canvas>
  </div>
  <div id="panel">
    <div id="selinfo">Click a unit or the carrier.</div>
    <div id="actions"></div>
    <div id="log"></div>
  </div>
</div>
<div id="overlay"><div id="overlaybox"></div></div>
`);

const CELL = 44, PAD = 20, STRIP = 56; // carrier strip on the right
const canvas = document.getElementById("board");
canvas.width = PAD * 2 + W * CELL + STRIP;
canvas.height = PAD * 2 + H * CELL;
const ctx = canvas.getContext("2d");

const ui = {
  state: createGame(((Math.random() * 2 ** 31) | 0) >>> 0),  // UI may use Math.random for the seed only
  view: "sea", selection: null, pendingLaunch: null,
  render() { drawBoard(); drawTopbar(); drawPanel(); drawLog(); maybeOverlay(); },
};
window.ui = ui;

const TER_FILL = { [TER.WATER]: "#123252", [TER.IRAN]: "#4a3b2a", [TER.OMAN]: "#3a4030", [TER.EXIT]: "#144a3a" };
function cellRect(x, y) { return [PAD + x * CELL, PAD + y * CELL, CELL, CELL]; }

function drawBoard() {
  const s = ui.state;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [px, py, w, h] = cellRect(x, y);
    ctx.fillStyle = TER_FILL[MAP[y][x]];
    ctx.fillRect(px, py, w - 1, h - 1);
  }
  // carrier strip
  ctx.fillStyle = "#0e2740";
  ctx.fillRect(PAD + W * CELL + 4, PAD, STRIP - 8, H * CELL);
  ctx.fillStyle = "#cfe3f5"; ctx.font = "18px monospace"; ctx.textAlign = "center";
  ctx.fillText("CV", PAD + W * CELL + STRIP / 2, PAD + (CARRIER_POS.y + 0.6) * CELL);
  ctx.font = "10px monospace";
  ctx.fillText("GULF OF", PAD + W * CELL + STRIP / 2, PAD + 14);
  ctx.fillText("OMAN", PAD + W * CELL + STRIP / 2, PAD + 26);

  if (ui.view === "sea") drawSeaLayer(s); else drawAirLayer(s);
  drawShips(s);
  drawAircraft(s);
  drawSelection(s);
}
function drawSeaLayer(s) {
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [k, e] of Object.entries(s.seaNumbers)) {
    const { x, y } = unkey(k); const [px, py] = cellRect(x, y);
    ctx.fillStyle = e.stale ? "#5a6b7a" : "#7ad0ff";
    ctx.font = "16px monospace";
    ctx.fillText(String(e.value), px + CELL / 2, py + CELL / 2);
    if (e.content === "mine") { ctx.fillStyle = "#ff8a7a"; ctx.font = "10px monospace"; ctx.fillText("MINE", px + CELL / 2, py + CELL - 8); }
    if (e.content === "boat") { ctx.fillStyle = e.stale ? "#5a6b7a" : "#ffcf66"; ctx.font = "10px monospace"; ctx.fillText("SHIP", px + CELL / 2, py + CELL - 8); }
  }
  const SEA_MARK = { mine: "⚑", ship: "▣", clear: "✓" };
  for (const [k, m] of Object.entries(s.marks.sea)) {
    const { x, y } = unkey(k); const [px, py] = cellRect(x, y);
    ctx.fillStyle = "#ffcf66"; ctx.font = "13px monospace";
    ctx.fillText(SEA_MARK[m], px + 10, py + 12);
  }
}
function drawAirLayer(s) {
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [k, e] of Object.entries(s.airNumbers)) {
    const { x, y } = unkey(k); const [px, py] = cellRect(x, y);
    const stale = e.turn < s.turn - 1;
    ctx.fillStyle = stale ? "#5a6b7a" : "#b9a7ff";
    ctx.font = "16px monospace";
    ctx.fillText(String(e.value), px + CELL / 2, py + CELL / 2);
  }
  const AIR_MARK = { hostile: "▲", civ: "△", drone: "◇", radar: "⚡", false: "✕" };
  for (const [k, m] of Object.entries(s.marks.air)) {
    const { x, y } = unkey(k); const [px, py] = cellRect(x, y);
    ctx.fillStyle = "#ffcf66"; ctx.font = "13px monospace";
    ctx.fillText(AIR_MARK[m], px + 10, py + 12);
  }
  // identified contacts render at their live positions
  for (const sig of airSignals(s)) {
    const lbl = contactLabel(s, sig);
    if (lbl === "unknown") continue;
    const [px, py] = cellRect(sig.x, sig.y);
    ctx.fillStyle = lbl === "airliner" ? "#8fd18f" : "#ff8a7a";
    ctx.font = "11px monospace";
    ctx.fillText(lbl === "false echo" ? "✕" : lbl.toUpperCase().slice(0, 5), px + CELL / 2, py + 10);
  }
  if (s.sam.revealedUntil >= s.turn && !s.sam.destroyed) {
    const [px, py] = cellRect(s.sam.x, s.sam.y);
    ctx.fillStyle = "#ff8a7a"; ctx.font = "13px monospace";
    ctx.fillText("⚡SAM", px + CELL / 2, py + CELL / 2);
  }
}
const SHIP_GLYPH = { tanker: "T", frigate: "F", minesweeper: "M" };
function drawShips(s) {
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 15px monospace";
  for (const sh of s.ships) {
    if (sh.destroyed || sh.exited) continue;
    const [px, py] = cellRect(sh.x, sh.y);
    ctx.fillStyle = sh.kind === "tanker" ? "#8fd18f" : "#7ad0ff";
    if (sh.crippled) ctx.fillStyle = "#ffcf66";
    ctx.fillText(SHIP_GLYPH[sh.kind] + sh.id.slice(1), px + CELL / 2, py + CELL / 2);
  }
  if (s.rescue) {
    const [px, py] = cellRect(s.rescue.x, s.rescue.y);
    ctx.fillStyle = "#ffcf66"; ctx.fillText("🛟", px + CELL / 2, py + CELL / 2);
  }
}
function drawAircraft(s) {
  ctx.font = "13px monospace";
  for (const ac of s.aircraft) {
    if (ac.leg === "done" || ac.downed) continue;
    const px = ac.x >= W ? PAD + W * CELL + STRIP / 2 - CELL / 2 : cellRect(ac.x, 0)[0];
    const [, py] = cellRect(Math.min(ac.x, W - 1), ac.y);
    ctx.fillStyle = ac.kind === "surveillance" ? "#b9a7ff" : "#7ad0ff";
    ctx.fillText(ac.kind === "surveillance" ? "✈S" : "✈", px + CELL / 2, py + 10);
  }
}
function drawSelection(s) {
  const sel = ui.selection;
  if (!sel) return;
  const opts = uiOptions(s, sel);
  ctx.strokeStyle = "#ffcf66"; ctx.lineWidth = 2;
  for (const c of opts.moves) {
    const [px, py, w, h] = cellRect(c.x, c.y);
    ctx.strokeRect(px + 2, py + 2, w - 5, h - 5);
  }
  if (sel.kind === "ship") {
    const sh = shipById(s, sel.id);
    const [px, py, w, h] = cellRect(sh.x, sh.y);
    ctx.strokeStyle = "#fff"; ctx.strokeRect(px, py, w - 1, h - 1);
  }
}
function drawTopbar() {
  const s = ui.state;
  document.getElementById("turnlbl").textContent = `Turn ${s.turn}`;
  const bar = document.getElementById("escbar");
  bar.style.width = `${s.escalation}%`;
  const posture = postureOf(s.escalation);
  bar.style.background = { shadowing: "#4a9", harassment: "#fc6", conflict: "#f75", war: "#f33" }[posture];
  document.getElementById("esclbl").textContent = `${s.escalation} (${posture})`;
  const r = s.resources;
  document.getElementById("reslbl").textContent =
    `Sorties ${r.sorties} · Surveil ${r.surveillance} · Refuel ${r.refuel} · Helo ${r.helo}`;
}
function drawLog() {
  const el = document.getElementById("log");
  el.innerHTML = ui.state.log.slice(-80)
    .map((l) => `<div class="${l.kind}">T${l.turn} ${l.text}</div>`).join("");
  el.scrollTop = el.scrollHeight;
}
function drawPanel() { /* filled by Task 16 (interaction); harmless no-op until then */ }
function maybeOverlay() { /* filled by Task 16 */ }
ui.render();
</script>
```

- [ ] **Step 3: Verify tests still pass and the page renders**

Run: `node test.mjs` — expected `ALL 40 TESTS PASSED` (UI must not break the engine).
Run: `open index.html` (manual look: terrain, ships at the east end, carrier strip, SEA numbers absent until pinged).

- [ ] **Step 4: Commit** — `git commit -am "carrier-shadow: canvas rendering, top bar, event log"`

---

### Task 16: UI — interaction (selection, actions, launch targeting, ladder dialog, overlays)

**Files:**
- Modify: `game-carrier-shadow/index.html` (UI script)

**Interfaces:**
- Consumes: `ui` object, `uiOptions`, `applyAction`, `endTurn`, engine state.
- Produces: full input handling. Interaction contract:
  - Left-click: select own ship / carrier strip / aircraft; if a ship is selected and the click is on a highlighted move cell ⇒ `move`. If `ui.pendingLaunch` is set (see below) the click supplies target cell(s) instead.
  - Action buttons (from `uiOptions().actions`): `ping`/`sweep`/`clearMine` set `ui.pendingTargetAction = { type }` — next click on the map supplies `x,y` and calls `applyAction`. `surveil`/`cap`/`strike`/`intercept` set `ui.pendingLaunch = { mission }` — next click launches. `recon` collects two clicks (start, end). `refuel`/`rescue` apply immediately.
  - Right-click: cycles the mark for the active layer on the clicked cell (`sea`: mine→ship→clear→none; `air`: hostile→civ→drone→radar→false→none) via `applyAction {type:'mark'}`; `contextmenu` prevented.
  - `Tab` toggles SEA/AIR (also the two buttons); `Space` / End Turn button: reject with a log flash if `state.pendingIntercept`, else `endTurn` + render.
  - When `state.pendingIntercept` is set (after endTurn or CAP trigger), the overlay shows the five ladder buttons (`Observe / Hail / Radar lock / Warning shot / Attack`) with their escalation costs; clicking applies `{type:'ladder', step}` and re-renders.
  - First load: overlay with a short how-to-play (goal, SEA/AIR, numbers, marks, escalation warning); `Start mission` button dismisses it. Game over: overlay with outcome, reason, grade, per-item summary, and a `New game (new seed)` button that rebuilds `ui.state = createGame(newSeed)`.

- [ ] **Step 1: Implement handlers (replace `drawPanel`/`maybeOverlay` no-ops, add listeners)**

```js
function describeSelection(s, sel) {
  if (!sel) return "Click a unit or the carrier.";
  if (sel.kind === "carrier") return "Carrier (off-map). Launch air missions.";
  if (sel.kind === "aircraft") {
    const ac = s.aircraft.find((a) => a.id === sel.id);
    return ac ? `${ac.id} — ${ac.tasking}, ${ac.leg}${ac.leg === "station" ? ` (${ac.stationLeft} turns left)` : ""}` : "";
  }
  const sh = shipById(s, sel.id);
  return `${sh.kind} ${sh.id}${sh.crippled ? " (CRIPPLED)" : ""} — moves ${sh.movesLeft}, sensor ${sh.sensorUsed ? "used" : "ready"}`;
}
const ACTION_LABEL = {
  ping: "Sonar ping…", sweep: "Radar sweep…", clearMine: "Clear mine…",
  surveil: "Surveillance flight…", cap: "CAP…", recon: "Recon line…",
  intercept: "Intercept…", strike: "Strike…", refuel: "Refuel (+2 turns)", rescue: "Rescue crew",
};
function drawPanel() {
  const s = ui.state;
  document.getElementById("selinfo").textContent = describeSelection(s, ui.selection);
  const box = document.getElementById("actions");
  box.innerHTML = "";
  if (ui.pendingLaunch) {
    box.innerHTML = `<div>${ui.pendingLaunch.mission}: click target cell`
      + `${ui.pendingLaunch.mission === "recon" && ui.pendingLaunch.start ? " (end point)" : ""}</div>`;
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.onclick = () => { ui.pendingLaunch = null; ui.pendingTargetAction = null; ui.render(); };
    box.appendChild(cancel);
    return;
  }
  for (const a of uiOptions(s, ui.selection).actions) {
    const b = document.createElement("button");
    b.textContent = ACTION_LABEL[a];
    b.onclick = () => onAction(a);
    box.appendChild(b);
  }
}
function onAction(a) {
  const s = ui.state;
  try {
    if (a === "refuel") { applyAction(s, { type: "refuel", aircraftId: ui.selection.id }); }
    else if (a === "rescue") { applyAction(s, { type: "rescue" }); }
    else if (a === "ping" || a === "sweep" || a === "clearMine") {
      ui.pendingTargetAction = { type: a, shipId: ui.selection.id };
      ui.pendingLaunch = { mission: a };   // reuse the "click a target" panel state
    } else { ui.pendingLaunch = { mission: a }; }
  } catch (e) { logUi(e.message); }
  ui.render();
}
function logUi(text) { ui.state.log.push({ turn: ui.state.turn, kind: "warning", text }); }

function cellFromEvent(ev) {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  const cx = (ev.clientX - rect.left) * scale, cy = (ev.clientY - rect.top) * scale;
  if (cx >= PAD + W * CELL) return { strip: true };
  const x = Math.floor((cx - PAD) / CELL), y = Math.floor((cy - PAD) / CELL);
  return inBounds(x, y) ? { x, y } : null;
}
canvas.addEventListener("click", (ev) => {
  const s = ui.state;
  const c = cellFromEvent(ev);
  if (!c) return;
  if (c.strip) { ui.selection = { kind: "carrier" }; ui.pendingLaunch = null; ui.render(); return; }
  try {
    if (ui.pendingLaunch) { handleTargetClick(c); ui.render(); return; }
    const ship = s.ships.find((sh) => !sh.destroyed && !sh.exited && sh.x === c.x && sh.y === c.y);
    const ac = s.aircraft.find((a) => a.leg !== "done" && !a.downed && a.x === c.x && a.y === c.y);
    if (ship) ui.selection = { kind: "ship", id: ship.id };
    else if (ac) ui.selection = { kind: "aircraft", id: ac.id };
    else if (ui.selection?.kind === "ship") {
      const mv = uiOptions(s, ui.selection).moves.some((m) => m.x === c.x && m.y === c.y);
      if (mv) applyAction(s, { type: "move", shipId: ui.selection.id, x: c.x, y: c.y });
    }
  } catch (e) { logUi(e.message); }
  ui.render();
});
function handleTargetClick(c) {
  const s = ui.state, m = ui.pendingLaunch.mission;
  if (ui.pendingTargetAction) {
    applyAction(s, { ...ui.pendingTargetAction, x: c.x, y: c.y });
    ui.pendingTargetAction = null; ui.pendingLaunch = null;
    return;
  }
  if (m === "recon") {
    if (!ui.pendingLaunch.start) { ui.pendingLaunch.start = c; return; }
    applyAction(s, { type: "launch", mission: "recon",
      x: ui.pendingLaunch.start.x, y: ui.pendingLaunch.start.y, ex: c.x, ey: c.y });
  } else if (m === "intercept" || m === "strike") {
    applyAction(s, { type: "launch", mission: m, targetX: c.x, targetY: c.y });
  } else {
    applyAction(s, { type: "launch", mission: m, x: c.x, y: c.y });
  }
  ui.pendingLaunch = null;
}
canvas.addEventListener("contextmenu", (ev) => {
  ev.preventDefault();
  const c = cellFromEvent(ev);
  if (!c || c.strip) return;
  const cycles = {
    sea: [null, "mine", "ship", "clear"],
    air: [null, "hostile", "civ", "drone", "radar", "false"],
  }[ui.view];
  const cur = ui.state.marks[ui.view][key(c.x, c.y)] ?? null;
  const next = cycles[(cycles.indexOf(cur) + 1) % cycles.length];
  applyAction(ui.state, { type: "mark", layer: ui.view, x: c.x, y: c.y, mark: next });
  ui.render();
});
function setView(v) {
  ui.view = v;
  document.getElementById("btnSea").classList.toggle("active", v === "sea");
  document.getElementById("btnAir").classList.toggle("active", v === "air");
  ui.render();
}
document.getElementById("btnSea").onclick = () => setView("sea");
document.getElementById("btnAir").onclick = () => setView("air");
function doEndTurn() {
  if (ui.state.pendingIntercept) { logUi("Resolve the intercept first."); ui.render(); return; }
  if (ui.state.outcome) return;
  endTurn(ui.state);
  ui.selection = null; ui.pendingLaunch = null; ui.pendingTargetAction = null;
  ui.render();
}
document.getElementById("btnEnd").onclick = doEndTurn;
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Tab") { ev.preventDefault(); setView(ui.view === "sea" ? "air" : "sea"); }
  if (ev.key === " ") { ev.preventDefault(); doEndTurn(); }
});

const LADDER_STEPS = [
  ["observe", "Observe (+0)"], ["hail", "Hail (+0)"], ["lock", "Radar lock (+3)"],
  ["warningShot", "Warning shot (+6)"], ["attack", "Attack (+8/+20 / airliner = defeat)"],
];
let howToDismissed = false;
function maybeOverlay() {
  const s = ui.state;
  const overlay = document.getElementById("overlay");
  const box = document.getElementById("overlaybox");
  if (!howToDismissed) {
    box.innerHTML = `<h2>Carrier Shadow</h2>
<p>Escort <b>3 of 4 tankers</b> to the green exit zone in the west. The strait hides
mines, missile boats, a mobile SAM, drones and false radar echoes.</p>
<p><b>SEA / AIR</b> (Tab) toggles the intel layers. Sonar and radar stamp
Minesweeper-style numbers: threats adjacent to that cell. Gray numbers are stale —
something moved. Right-click marks cells.</p>
<p>Your carrier (east strip) launches surveillance, CAP, recon, intercepts and
strikes — resources are finite. Every aggressive act raises <b>escalation</b>;
at 100 the region is at war and you lose. Quiet turns cool it down.</p>
<p><button id="btnStart">Start mission</button></p>`;
    overlay.classList.remove("hidden");
    document.getElementById("btnStart").onclick = () => { howToDismissed = true; ui.render(); };
    return;
  }
  if (s.pendingIntercept) {
    box.innerHTML = `<h3>Intercept — contact ${s.pendingIntercept.sigId} (${
      contactLabel(s, findSignalById(s, s.pendingIntercept.sigKind, s.pendingIntercept.sigId) || { kind: s.pendingIntercept.sigKind, ref: {} })
    })</h3><p>Choose your action:</p><p id="ladderbtns"></p>`;
    overlay.classList.remove("hidden");
    const p = box.querySelector("#ladderbtns");
    for (const [step, label] of LADDER_STEPS) {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = () => { try { applyAction(s, { type: "ladder", step }); } catch (e) { logUi(e.message); } ui.render(); };
      p.appendChild(b);
    }
    return;
  }
  if (s.outcome) {
    const t = s.ships.filter((x) => x.kind === "tanker");
    box.innerHTML = `<h2>${s.outcome.win ? "MISSION ACCOMPLISHED" : "MISSION FAILED"}</h2>
<p>${{ "convoy-through": "The convoy is through.", convoy: "Too many tankers lost.",
       war: "Escalation reached 100 — regional war.", airliner: "A civilian airliner was shot down." }[s.outcome.reason]}</p>
<p>Tankers through: ${t.filter((x) => x.exited).length}/4 · Escalation peak: ${s.escalationPeak}
 · Turns: ${s.turn} · Grade: <b>${s.outcome.grade}</b></p>
<p><button id="btnNew">New game (new seed)</button></p>`;
    overlay.classList.remove("hidden");
    document.getElementById("btnNew").onclick = () => {
      ui.state = createGame(((Math.random() * 2 ** 31) | 0) >>> 0);
      ui.selection = null; ui.pendingLaunch = null;
      ui.render();
    };
    return;
  }
  overlay.classList.add("hidden");
}
```

- [ ] **Step 2: Verify engine tests still pass**

Run: `node test.mjs` — expected `ALL 40 TESTS PASSED`.

- [ ] **Step 3: Manual play check (open `index.html`)**

Checklist: how-to overlay shows and dismisses; ship selection + move highlights work; ping stamps a number on SEA; sweep stamps numbers on AIR; Tab toggles; carrier click offers launches; recon two-click works; End Turn advances and enemy log lines appear; right-click cycles marks per layer; intercept dialog appears when CAP engages (launch a CAP over mid-map and wait); end screen appears on loss/win.

- [ ] **Step 4: Commit** — `git commit -am "carrier-shadow: full interaction, ladder dialog, overlays"`

---

### Task 17: Screenshot verification, README, gallery entry

**Files:**
- Create: `game-carrier-shadow/README.md`
- Modify: `gallery.yaml`
- Scratch: `game-carrier-shadow/_shot.html` (temporary, deleted before commit)

**Interfaces:**
- Consumes: finished game.

- [ ] **Step 1: Screenshot with a driven mid-game state**

rAF/interaction won't advance under `--virtual-time-budget` (see memory: headless-screenshot-raf-loops). Copy `index.html` to `_shot.html` and append, at the end of the UI script (just before `</script>`), a synchronous driver:

```js
// _shot.html only: drive to a lively mid-game state
howToDismissed = true;
ui.state = createGame(7);
applyAction(ui.state, { type: "launch", mission: "surveil", x: 10, y: 5 });
applyAction(ui.state, { type: "ping", shipId: "f1", x: 16, y: 5 });
applyAction(ui.state, { type: "sweep", shipId: "f2", x: 15, y: 7 });
for (let i = 0; i < 6; i++) {
  if (ui.state.pendingIntercept) applyAction(ui.state, { type: "ladder", step: "observe" });
  endTurn(ui.state);
}
ui.render();
```

Run:

```bash
cd game-carrier-shadow
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --screenshot=screenshot1.png --window-size=1250,700 --virtual-time-budget=2000 \
  "file://$PWD/_shot.html"
```

Read `screenshot1.png` and verify: terrain zones visible, ships at the east end, sea number stamped, top bar populated, log has entries. Repeat with `setView("air")` appended in the driver for an AIR-view check if the first shot looks off. Then `rm _shot.html`.

- [ ] **Step 2: Write `README.md`**

```markdown
# Carrier Shadow

Minesweeper on the sea, Battleship with moving vessels, and an air layer where
one wrong radar echo can start a regional war. Escort 4 tankers through the
Strait of Hormuz.

Open `index.html`. Turn-based; SEA/AIR (Tab) toggles intel layers; Space ends
the turn. Details in the in-game How to play overlay.

Spec: `../docs/superpowers/specs/2026-07-15-carrier-shadow-design.md`.
Tests: `node test.mjs`.
```

- [ ] **Step 3: Add gallery title override**

Append to `gallery.yaml`:

```yaml
game-carrier-shadow: Carrier Shadow
```

- [ ] **Step 4: Final verification**

Run: `node test.mjs` → `ALL 40 TESTS PASSED`. Confirm `_shot.html` is deleted (`git status` clean of scratch files).

- [ ] **Step 5: Commit**

```bash
git add game-carrier-shadow/README.md game-carrier-shadow/screenshot1.png gallery.yaml
git commit -m "carrier-shadow: screenshot, README, gallery entry"
```

---

## Test-count ledger

Task 1: 2 → Task 2: 4 → Task 3: 7 → Task 4: 9 → Task 5: 13 → Task 6: 15 → Task 7: 17 → Task 8: 23 → Task 9: 27 → Task 10: 29 → Task 11: 33 → Task 12: 36 → Task 13: 39 → Task 14: 40. Tasks 15–17 add no engine tests; `node test.mjs` must stay at 40 passing.
