# Snake MCTS Browser Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the 2-player snake puzzle game with MCTS AI (SnakeBot6 "Monte Carlo 2") from SwiftSnakeEngine to a single self-contained `game-snake/index.html`.

**Architecture:** One HTML file with two script blocks: `<script id="shared-code">` holds the pure game engine + MCTS bot + self-tests (no DOM access), and a second script holds the UI (canvas rendering, input, game loop). The bot runs in a Web Worker built from a Blob whose source is the textContent of the shared-code script tag, so logic exists once and the file works from `file://`. A `test.mjs` Node script extracts the shared-code block and runs the self-tests for TDD during development.

**Tech Stack:** Vanilla JS (ES2022), Canvas 2D, Web Worker via Blob URL, Node (any recent version) for the test runner. No dependencies, no build step.

**Source reference:** All Swift paths below are under `/Users/neoneye/git/SwiftSnakeEngine/`. The implementer must read the referenced Swift before porting each piece — it is the authoritative spec.

**Spec:** `docs/superpowers/specs/2026-06-10-snake-mcts-port-design.md`

---

## File structure

- Create: `game-snake/index.html` — the deliverable. Layout:
  ```html
  <!DOCTYPE html><html><head><style>…</style></head><body>
    <div id="hud">…role selectors, level dropdown, buttons…</div>
    <canvas id="board"></canvas>
    <script id="shared-code">/* engine + bot + SnakeTests; pure, no DOM */</script>
    <script>/* UI: rendering, input, worker, game loop */</script>
  </body></html>
  ```
- Create: `game-snake/test.mjs` — extracts the shared-code block, evals it in Node, runs `SnakeTests.run()`, exits non-zero on failure.
- Commit after every green task.

## Conventions used throughout

- Positions are `{x, y}` plain objects. Origin is **bottom-left** (as in Swift); only the canvas renderer flips y. Key helper: `posKey(p)` → `"x,y"` for use in `Set`/`Map`.
- Immutability: game state, players, bodies are frozen plain objects; every "update" returns a new object (mirrors the Swift builder methods in `EngineShared/Snake/SnakeGameState.swift`).
- Movements are the strings `"dontMove" | "moveCCW" | "moveForward" | "moveCW"`; directions `"up" | "down" | "left" | "right"`.
- Cause of death: `"collisionWithWall" | "collisionWithItself" | "collisionWithOpponent" | "stuckInALoop" | "noMoreFood"`.

---

### Task 1: Scaffold + test harness

**Files:** Create `game-snake/index.html`, `game-snake/test.mjs`

- [ ] **Step 1: Write `index.html` skeleton** with the structure above. The shared-code block initially contains only the test registry:

```js
"use strict";
const SnakeTests = {
  tests: [],
  add(name, fn) { this.tests.push({ name, fn }); },
  run() {
    let failures = 0;
    for (const { name, fn } of this.tests) {
      try { fn(); console.log(`ok - ${name}`); }
      catch (e) { failures++; console.error(`FAIL - ${name}: ${e.message}`); }
    }
    console.log(`${this.tests.length - failures}/${this.tests.length} passed`);
    return failures === 0;
  },
};
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || "assertEq"}: ${a} !== ${e}`);
}
SnakeTests.add("smoke", () => assertEq(1 + 1, 2));
```

- [ ] **Step 2: Write `test.mjs`:**

```js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) { console.error("shared-code block not found"); process.exit(1); }
const ok = new Function(`${m[1]}; return SnakeTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 3: Run `node game-snake/test.mjs`** — expect `ok - smoke`, exit 0.
- [ ] **Step 4: Commit** `feat(snake): scaffold single-file app with node test harness`

### Task 2: Primitives — LCRNG, position helpers, Fifo

**Swift refs:** `EngineShared/Common/SeededGenerator.swift`, `EngineShared/Common/IntVec2.swift`, `EngineShared/Snake/SnakeFifo.swift`

- [ ] **Step 1: Tests first** (in shared-code): LCRNG must match the Swift constants with 64-bit wrapping. Expected values computed from `seed' = (2862933555777941757 * seed + 3037000493) mod 2^64`:

```js
SnakeTests.add("lcrng sequence from seed 0", () => {
  const rng = new LCRNG(0n);
  assertEq(rng.next().toString(), "3037000493");
  // second value: (2862933555777941757 * 3037000493 + 3037000493) mod 2^64
  const expected2 = ((2862933555777941757n * 3037000493n + 3037000493n) & 0xFFFFFFFFFFFFFFFFn).toString();
  assertEq(rng.next().toString(), expected2);
});
SnakeTests.add("fifo append keeps capacity, appendAndGrow grows", () => {
  const f0 = Fifo.fromArray([1, 2, 3]);          // capacity 3
  const f1 = f0.append(4);                       // drop oldest
  assertEq(f1.array, [2, 3, 4]);
  const f2 = f0.appendAndGrow(4);                // capacity 4
  assertEq(f2.array, [1, 2, 3, 4]);
});
```

- [ ] **Step 2: Implement.** `LCRNG` holds a BigInt seed; `next()` applies the recurrence masked to 64 bits and returns the BigInt. Add derived helpers used later (deterministic, documented here once):
  - `randomInt(n)` → `Number(this.next() % BigInt(n))` (n ≥ 1)
  - `pickIndex(arrayLength)` → `randomInt(arrayLength)`
  - `shuffle(array)` → in-place Fisher–Yates using `randomInt`
  `Fifo` is immutable: `{ capacity, array }`; `append` pushes then drops from the front while `array.length > capacity`; `appendAndGrow` increments capacity first (port of `SnakeFifo.purge`). Position helpers: `posKey`, `posEq`, `manhattan(a,b)`, `offsetBy`.
- [ ] **Step 3: Run tests** — all pass.
- [ ] **Step 4: Commit** `feat(snake): LCRNG, fifo, position primitives`

### Task 3: SnakeHead + SnakeBody

**Swift refs:** `EngineShared/Snake/SnakeHead.swift`, `SnakeHeadDirection.swift` (rotatedCCW/CW), `SnakeBody.swift`

- [ ] **Step 1: Tests first:**

```js
SnakeTests.add("head simulateTick", () => {
  const h = { position: { x: 5, y: 5 }, direction: "up" };
  assertEq(headSimulateTick(h, "moveForward"), { position: { x: 5, y: 6 }, direction: "up" });
  assertEq(headSimulateTick(h, "moveCCW"), { position: { x: 4, y: 5 }, direction: "left" });
  assertEq(headSimulateTick(h, "moveCW"), { position: { x: 6, y: 5 }, direction: "right" });
  assertEq(headSimulateTick(h, "dontMove"), h);
});
SnakeTests.add("head moveToward direction blocks reversal", () => {
  const h = { position: { x: 5, y: 5 }, direction: "up" };
  assertEq(headMoveTowardDirection(h, "down"), "dontMove");
  assertEq(headMoveTowardDirection(h, "left"), "moveCCW");
});
SnakeTests.add("body create extends backward from head", () => {
  const b = bodyCreate({ x: 5, y: 5 }, "right", 4);
  assertEq(b.head.position, { x: 5, y: 5 });
  assertEq(bodyPositionArray(b), [{x:1,y:5},{x:2,y:5},{x:3,y:5},{x:4,y:5},{x:5,y:5}]);
  // Swift create() yields length+1 parts: start part + n ticks (SnakeBody.swift:117-149)
});
SnakeTests.add("body eat grows, isEatingItself detects overlap", () => {
  const b = bodyCreate({ x: 5, y: 5 }, "right", 2);
  const b2 = bodyStateForTick(b, "moveForward", "eat");
  assertEq(b2.fifo.array.length, b.fifo.array.length + 1);
  assert(!bodyIsEatingItself(b2));
});
```

  Note: verify the `bodyCreate` expectation against the Swift code while implementing — `SnakeBody.create` appends a start part then ticks `n` times with `.eat`, producing `n+1` parts. If the real Swift count differs, fix the test to match Swift, not the other way around.
- [ ] **Step 2: Implement** as a faithful port: rotations (up→left→down→right→up for CCW), `headSimulateTick`, `headMoveTowardPosition` (the dx/dy decision table at `SnakeHead.swift:72-124`), `headMoveTowardDirection`, `bodyCreate`, `bodyStateForTick(movement, act)` (`act` is `"doNothing"|"eat"`; eat → `appendAndGrow`), `bodyPositionArray/Set`, `bodyWithoutHeadPositionSet`, `bodyIsEatingItself`, `bodyClearStomach` (content flags ported: each part has `content: "empty"|"food"` — the renderer uses this to draw food bulges).
- [ ] **Step 3: Run tests**, fix until green.
- [ ] **Step 4: Commit** `feat(snake): snake head and body mechanics`

### Task 4: Levels — embedded CSVs, parser, cluster distances

**Swift refs:** `EngineShared/Level/SnakeLevel+Load.swift`, `SnakeLevel.swift`, `SnakeLevelBuilder.swift`, `EngineShared/Common/ComputeShortestPath.swift`; data in `EngineShared/Level/SnakeLevels.bundle/Level {0..11}.csv`

- [ ] **Step 1: Embed the 12 CSVs verbatim** as a `LEVEL_CSV` object keyed `"Level 0"…"Level 11"` (template literals; copy the files exactly — cells may hold multiple space-separated tokens like `C9 P1R2`).
- [ ] **Step 2: Tests first:**

```js
SnakeTests.add("level 0 parses", () => {
  const lv = parseLevel(LEVEL_CSV["Level 0"]);
  assertEq(lv.size, { x: 9, y: 9 });
  // CSV rows are REVERSED (origin bottom-left): P1 is on csv row 2 ⇒ y = 9-1-2 = 6... verify vs Swift reversal
  assertEq(lv.player1Body.head.direction, "right");
  assertEq(lv.player2Body.head.direction, "left");
  assert(lv.initialFoodPosition);
  assert(lv.wallSet.has("0,0"));
});
SnakeTests.add("all 12 levels parse", () => {
  for (const name of Object.keys(LEVEL_CSV)) {
    const lv = parseLevel(LEVEL_CSV[name]);
    assert(lv.size.x >= 3 && lv.size.y >= 3, name);
    assert(lv.emptyPositionArray.length > 0, name);
  }
});
SnakeTests.add("estimateDistance same cluster = manhattan, no route = Infinity", () => {
  const lv = parseLevel(LEVEL_CSV["Level 5"]); // has clusters C1..C9
  const d = levelEstimateDistance(lv, { x: 5, y: 5 }, { x: 7, y: 5 });
  assert(Number.isFinite(d));
});
```

- [ ] **Step 3: Implement.**
  - Parser: first row = UUID header (keep `id`), remaining rows reversed so row index 0 is the bottom. Tokens per `SnakeLevel+Load.swift:77-134`: `W` wall, `F` → `initialFoodPosition`, `P{1|2}{U|L|D|R}{len}` → `bodyCreate(position, direction, len)`, `C{n}` → cluster id.
  - Level object: `{ id, size, wallSet, clusters (Map posKey→id), emptyPositionArray (sorted y-then-x as Swift builds it), emptyPositionSet, initialFoodPosition, player1Body, player2Body, distanceBetweenClusters }`.
  - Cluster distances (`SnakeLevelBuilder.swift:88-200`): bounding-box center per cluster → nearest empty cell to center → BFS shortest path over empty cells between the two representative cells → `distance = path length`; skip **adjacent** cluster pairs (pairs that touch via 4-neighbour empty cells); unreachable → -1. `levelEstimateDistance` (`SnakeLevel.swift:64-84`): same cluster (or missing pair) → manhattan; -1 → `Infinity` (Swift `UInt32.max`); else `distance * 10`. BFS replaces Swift's A* (`ComputeShortestPath`) — only path *length* is consumed, BFS on an unweighted grid is exact.
  - Compute distances once at parse; cache parsed levels in a module-level Map (no protobuf cache needed — parsing all 12 takes ms).
- [ ] **Step 4: Run tests**, fix the y-reversal expectation against actual Swift behavior, get green.
- [ ] **Step 5: Commit** `feat(snake): 12 embedded levels with cluster distance estimation`

### Task 5: Player, GameState, collision, food, stuck detection

**Swift refs:** `EngineShared/Snake/SnakePlayer.swift`, `SnakeGameState.swift`, `SnakeGameState+Create.swift`, `SnakeCollisionDetector.swift`, `SnakeFoodGenerator.swift`, `StuckSnakeDetector.swift`, `SnakeGameState+PreventHumanCollisions.swift`, `SnakeGameState+IsWaitingForHumanInput.swift`

- [ ] **Step 1: Tests first:**

```js
SnakeTests.add("head-on collision kills both", () => {
  let gs = createGameStateForTest(/* two snakes facing each other 2 cells apart, both pendingMovement moveForward */);
  gs = detectCollision(gs);
  assert(!playerIsAlive(gs.player1) && !playerIsAlive(gs.player2));
  assert(gs.player1.causesOfDeath.includes("collisionWithOpponent"));
});
SnakeTests.add("wall collision kills", () => { /* snake facing wall, moveForward → dead, collisionWithWall */ });
SnakeTests.add("eating clears food and sets pendingAct", () => {
  /* snake head one cell from food, pendingMovement toward it; after detectCollision: foodPosition null, pendingAct "eat" */
});
SnakeTests.add("food placement is deterministic and avoids snakes", () => {
  let gs = /* state with foodPosition null, foodRngSeed 42n */;
  const a = placeNewFood(gs), b = placeNewFood(gs);
  assertEq(a.foodPosition, b.foodPosition);
  assert(!bodyPositionSet(a.player1.snakeBody).has(posKey(a.foodPosition)));
});
SnakeTests.add("stuck detector kills bot repeating states", () => {
  /* append the same body alternating until isStuck per StuckSnakeDetector scoring: repeat → +2, new → -1, stuck at >= 5 */
});
```

  Each test needs a small builder: `createGameStateForTest({levelName, p1: {pos, dir, len, role}, p2, food})` — write it once here, reuse in later tasks.
- [ ] **Step 2: Implement** faithful ports:
  - `Player`: `{ id, isInstalled, role ("human"|"bot"|"none"), snakeBody, pendingMovement, pendingAct, causesOfDeath: [], botPlannedPath: [] }` plus `playerIsAlive`, `kill`, `clearPending…` helpers. (The bot's tree lives in the worker, not in the player — only `plannedMovement`/`plannedPath` cross the boundary. This is the one deliberate deviation from Swift's `player.bot`; document it in a code comment.)
  - `detectCollision` ports `SnakeCollisionDetector` exactly: tick both bodies speculatively with pendingMovement & act `doNothing`; order: wall kills → direct head-to-head (mutual) → head into opponent positionSet → self-eat → food eaten flags (`SnakeCollisionDetector.swift:82-180`); then apply kills + set `pendingAct = "eat"` / clear food (`:183-229`).
  - `placeNewFood` ports `SnakeFoodGenerator`: candidates = emptyPositionArray minus both snakes' positions (in array order!), seed from `gs.foodRngSeed`, pick `rng.pickIndex(candidates.length)`, write back new seed; empty candidates → kill both with `"noMoreFood"`.
  - `StuckDetector` class with history + undo replay, scoring per `StuckSnakeDetector.swift:72-88`; `killBotIfStuckInLoop` only for bots. Hash a body as `JSON.stringify([bodyPositionArray, head.direction])`.
  - `preventHumanCollisions` and `isWaitingForHumanInput` exactly as the two small Swift extensions.
- [ ] **Step 3: Run tests** until green.
- [ ] **Step 4: Commit** `feat(snake): game state, collisions, food, stuck detection`

### Task 6: Game environment — step, undo, reset

**Swift ref:** `EngineShared/Environment/GameEnvironmentInteractive.swift` (read in full; it is 241 lines)

- [ ] **Step 1: Tests first:**

```js
SnakeTests.add("step applies simultaneous movement and grows on eat", () => { /* scripted 2-human game on Level 0 builder state; step twice; assert head positions, lengths, numberOfSteps */ });
SnakeTests.add("tail collision after opponent eats (collisionCheckAfterEating)", () => {
  /* p1 eats food this tick (grows); p2's head moves onto p1's new tail cell → p2 dead (GameEnvironmentInteractive.swift:148-167) */
});
SnakeTests.add("undo restores previous state and clears human pending input", () => {
  /* env.step, env.undo → state deep-equals pre-step state with cleared pending */
});
SnakeTests.add("deterministic bot-vs-bot run", () => { /* placeholder pending Task 7 — register in Task 7 instead if bot not yet available */ });
```

- [ ] **Step 2: Implement `GameEnvironment` class** holding `{ initialGameState, gameState, previousGameStates: [], stuck1, stuck2 }`:
  - `reset()` → restore initial, clear stacks/detectors, `placeNewFood`, request bot moves (async — see Task 8; in the engine this is a no-op hook `onBotComputeNeeded`).
  - `step(action)` ports `step(action:)` exactly: increment steps → write human pending movements (reject `dontMove` for living humans) → `detectCollision` → per player: tick body with pending movement+act, clear pending, `killBotIfStuckInLoop` (only when opponent is not a living human — Swift line 124) → the post-eat tail-collision check → `placeNewFood` → push old state on undo stack.
  - `undo()` → pop, `clearPendingMovementAndPendingActForHumanPlayers`, `placeNewFood`, `stuck.undo()` both.
  - `stepControlMode` getter: `"reachedTheEnd" | "stepRequiresHumanInput" | "stepAutonomous"` (lines 52-76).
- [ ] **Step 3: Run tests** until green.
- [ ] **Step 4: Commit** `feat(snake): interactive game environment with undo`

### Task 7: SnakeBot6 — the MCTS port

**Swift ref:** `EngineShared/Bot/SnakeBot6.swift` — **read the whole file**; port it structurally. This is the largest task; keep the JS organized in the same shapes so it can be diffed against the Swift.

Key structures (all `fileprivate` in Swift, plain classes in JS):
- Node types: `RootNode {child}`, `LeafNode`, `FoodNode {choices:[FoodNodeChoice]}`, `FoodNodeChoice {position, child}`, `MoveNode {playerId, choices:[MoveNodeChoice], needsExploringPermanentObstacles}`, `MoveNodeChoice {playerId, movement, position, child}`, `KillNode {playerId, cause, child}`. Every node: `parent`, `isBest`. Use a `kind` string + switch instead of the Visitor double-dispatch — same traversal order, less ceremony.
- `Scenario {destinationNode, movements, certainDeath, numberOfFoodsEaten, distanceToFood}` with comparator `mycompare` (lines 502-544): not-certain-death first, then **more** movements, then more foods eaten, then smaller `distanceToFood`. Sort scenarios with this; best = first.
- `BuildTreeVisitor` (lines 552-1114) — port as a class with mutable cursor state `{rng, level, player:[p0,p1], foodPosition, numberOfMoves:[0,0], numberOfFoodsEaten, movements, scenarios}` and methods `visitRoot/visitLeaf/visitFood/visitFoodChoice/visitMove/visitMoveChoice/visitKill/processChildNode`. Critical details:
  - `visitMove`: on first visit prune wall-colliding moves via `level.emptyPositionSet` (lines 822-855, order CCW, forward, CW); then visit `isBest` child first, then `shuffle` non-best and take `limit` = 3 if `newNumberOfMoves < 3`, 2 if `< 5`, else 1 (lines 861-884).
  - `visitMoveChoice` (lines 886-1012): save/restore player, foodPosition, movements (only player 0 appends to `movements`); eat case → grown body, self-eat → KillNode(collisionWithSelf); normal move → self-eat → KillNode; opponent body contains position → KillNode(collisionWithOpponent); else recurse `processChildNode(node, nextAlivePlayerId)`.
  - `visitFood` (lines 625-767): branching `limit` tables — port the exact nested if/else for single-player (16/6/4/3/2 by numberOfMoves when ≤1 food eaten; 6/4/3/2/1 by foods eaten) and two-player (6/3 when ≤1 food eaten else 2/1). Keep surviving previous choices whose position is still free; fill the rest by seeded random picks from the **sorted** free-position array (sort y-then-x like Swift's `IntVec2` Comparable — check `IntVec2.swift` for the actual sort order and match it); finally sort choices by position.
  - `processChildNode` (lines 1080-1113): reuse existing non-Leaf child; depth limit 37 single-player / 17 two-player on the *current player's* numberOfMoves; deeper → `LeafNode`.
  - `visitKill` (lines 1014-1034): playerId 0 → scenario with `certainDeath: true`; playerId 1 → scenario `certainDeath: false`.
  - `appendScenario` (lines 602-619): `distanceToFood = levelEstimateDistance(level, player[0].head.position, foodPosition)` or `Infinity` when no food.
- `Bot6` class `{iteration, plannedMovement, plannedPath, previousRoot}` with `compute(level, player, oppositePlayer, foodPosition)` (lines 33-251): tree reuse — descend previous root through MoveNode choices matching the two players' *actual* new head positions, then through FoodNode by picking the choice nearest the actual food (via `levelEstimateDistance`), reattach or discard; seed `BigInt(iteration * 100)`; build; clear isBest flags; pick best scenario; flag its node chain `isBest`; plannedMovement = first movement (default `"moveForward"`); plannedPath = head position + simulateTick over scenario movements.

- [ ] **Step 1: Tests first:**

```js
SnakeTests.add("bot is deterministic", () => {
  const run = () => {
    /* single-player Level 0 state; loop 15 ticks: bot.compute → env.step with bot's movement; collect movements */
  };
  assertEq(run(), run());
});
SnakeTests.add("bot plannedPath is contiguous from head", () => {
  /* one compute; path[0] == head position; every consecutive pair manhattan distance 1 */
});
SnakeTests.add("bot survives and eats on Level 0 single player", () => {
  /* run 60 ticks; assert player alive; assert length grew (ate at least 1 food) */
});
SnakeTests.add("bot avoids certain death", () => {
  /* construct a state where moveForward dies but moveCW survives; one compute; assert plannedMovement !== moveForward */
});
```

- [ ] **Step 2: Implement** per the structure above. Sanity targets: a compute on Level 0 early game should finish well under 1 s in Node and produce a multi-thousand-node tree.
- [ ] **Step 3: Run tests.** If "survives and eats" flakes, debug the port against Swift (comparator direction and the limit tables are the usual suspects) — do not loosen the test.
- [ ] **Step 4: Commit** `feat(snake): faithful SnakeBot6 MCTS port`

### Task 8: Web Worker integration

**Files:** Modify `game-snake/index.html` (UI script block)

- [ ] **Step 1: Implement worker plumbing** (no engine changes):
  - `const src = document.getElementById("shared-code").textContent + WORKER_GLUE;` → `new Worker(URL.createObjectURL(new Blob([src], {type:"text/javascript"})))`.
  - `WORKER_GLUE` (string constant): holds `bots = {p1: new Bot6(), p2: new Bot6()}`; `onmessage` handles `{type:"compute", playerKey, levelName, player, oppositePlayer, foodPosition, requestId}` → rebuild level from cache, run `bots[playerKey].compute(...)` , post back `{type:"result", playerKey, requestId, movement, plannedPath}`; `{type:"reset"}` → fresh Bot6 instances.
  - Players/bodies serialize as plain JSON already (no classes with methods on state objects — keep state pure data, functions top-level, exactly so this works).
  - Main thread: `requestBotMove(playerKey)` returns a Promise; stale results (requestId mismatch after undo/restart) are dropped. On `reset`/level change post `{type:"reset"}`. After `undo`, do NOT reset — Bot6's tree-reuse handles position mismatch by discarding the tree, same as Swift's failed-reuse path.
- [ ] **Step 2: Manual test:** temporary button in HUD calling compute on the current state and logging the movement + path to console. Open `index.html` from `file://`, verify worker responds and UI stays responsive.
- [ ] **Step 3: Commit** `feat(snake): MCTS bot in blob web worker`

### Task 9: UI — rendering, input, game loop

**Files:** Modify `game-snake/index.html`. **Reference for look:** screenshots in `/Users/neoneye/git/SwiftSnakeEngine/screenshots/` (open `SwiftSnakeEngine_TwoPlayers.gif` and `SwiftSnakeEngine_macOS5.png`).

- [ ] **Step 1: HUD + canvas.** Dark theme. Controls: level dropdown (Level 0–11, default 0), per-player role `<select>` (Player 1: Human/Bot/Off, default Human; Player 2 default Bot), buttons: Restart (Enter), Undo (Z), Pause/Resume (Space), Single step, and the **Show AI path** toggle button (P) — wire the toggle state now, drawing comes in Task 10. Status line: steps, snake lengths, whose-turn / thinking indicator, game-over message with cause of death (e.g. "Player 2 died: collision with wall").
- [ ] **Step 2: Renderer.** Canvas sized to fit window, square tiles. Draw order: background, walls, food (red circle), dead snakes (desaturated), snakes as rounded-rect paths through body cells (player1 green, player2 blue, head brighter; food bulges where body part `content === "food"`), planned-path overlay (Task 10). Flip y when mapping grid→pixels.
- [ ] **Step 3: Game loop + input.** Port the IngameViewModel semantics (`AppShared/IngameView/IngameViewModel.swift:360-517`):
  - Keyboard: arrows → `headMoveTowardDirection` for p1, WASD for p2; ignore keys for non-human roles. Z=undo, Space=pause toggle, Enter=restart, P=path toggle.
  - **Human mode (any living human):** each input sets that player's pending movement; then mirror `step_humanVsAny`: apply `preventHumanCollisions`; if `isWaitingForHumanInput` → wait; else collect actions, await bot moves (request from worker if a bot player has `pendingMovement === "dontMove"`), call `env.step`, render. Bot pending movements are requested immediately after each step so the bot thinks while the human thinks.
  - **Bots-only mode:** auto-step loop (`requestAnimationFrame`-driven; one step per completed bot compute — compute time is the natural throttle); Space pauses; Single-step button steps once while paused.
  - Game over when `stepControlMode === "reachedTheEnd"`: stop loop, show message. Winner = surviving player, or "all food eaten" on `noMoreFood`.
  - Undo: pause auto-step, `env.undo()`, re-request bot planning, render.
- [ ] **Step 4: Manual test matrix** (open from `file://`): human-vs-bot on Level 0 — play, undo repeatedly, restart; bot-vs-bot — pause/single-step; human-vs-human — both key sets; level switch resets cleanly.
- [ ] **Step 5: Commit** `feat(snake): canvas UI, turn-based and autonomous game loops`

### Task 10: Planned-path overlay

**Swift ref:** `AppShared/IngameView/PlannedPathView.swift` (read fully — the split-index arithmetic is subtle)

- [ ] **Step 1: Implement** `drawPlannedPath(ctx, path, foodPosition, color)` for each living bot player when the toggle is on:
  - `highConfidenceCount` = index of the first path position equal to `foodPosition`, else 0 (lines 70-77).
  - High-confidence polyline = `path[0 .. min(highConfidenceCount+1, path.length))`, stroke `color`, lineWidth `max(tile*0.3, 1)`, round caps/joins.
  - Low-confidence polyline = `path[min(highConfidenceCount, path.length) ..)`, stroke `color` at 30% alpha, lineWidth 1, square caps, miter joins. Draw low first, high on top.
  - Path points at tile centers; skip drawing when `path.length < 2`. Colors: player1 `#2ecc40`-ish green, player2 `#0a84ff`-ish blue (match the app screenshots by eye).
- [ ] **Step 2: Manual test:** human-vs-bot with toggle on — bright path should run head→food, faint thin tail beyond; toggle off hides it; path updates each step. Bot-vs-bot shows two paths.
- [ ] **Step 3: Commit** `feat(snake): planned-path overlay with confidence split`

### Task 11: In-browser self-test + final review

- [ ] **Step 1:** `?test=1` → instead of starting the game, run `SnakeTests.run()` and render pass/fail summary into the page (plus console). Reuses the registry that `test.mjs` runs.
- [ ] **Step 2: Full check:** `node game-snake/test.mjs` green; manual matrix from Task 9 Step 4 once more; check performance of bot-vs-bot on Level 5 (two-player computes may take seconds — acceptable, matches the original; the thinking indicator must show).
- [ ] **Step 3: Write `game-snake/README.md`** (short): what it is, link to SwiftSnakeEngine, controls table, `node test.mjs`.
- [ ] **Step 4: Commit** `feat(snake): browser self-test runner and readme`

---

## Self-review notes

- Spec coverage: engine (Tasks 2-6), MCTS (7), worker/thinking indicator (8), modes/undo/keys (9), path toggle (10), levels (4), `?test=1` (11), single-file/file:// (1, 8). Replay/other bots correctly absent (out of scope).
- Type consistency: state objects are pure data + top-level functions (required for worker serialization); names used across tasks: `bodyCreate`, `bodyStateForTick`, `bodyPositionArray/Set`, `headSimulateTick`, `placeNewFood`, `detectCollision`, `levelEstimateDistance`, `GameEnvironment`, `Bot6`.
- Known deliberate deviations from Swift (each needs a code comment at the site): bot state lives in the worker rather than on the player; BFS instead of A* for cluster distances; `randomInt`/`shuffle` are deterministic but not bit-identical to Swift stdlib's `randomElement`/`shuffle` (cross-language replay parity is a non-goal; in-JS determinism is the requirement).
