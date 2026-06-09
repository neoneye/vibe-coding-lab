# Snake MCTS browser port — design

Date: 2026-06-10
Source: /Users/neoneye/git/SwiftSnakeEngine (Swift, ~2020)
Target: game-snake/index.html (single self-contained file)

## Goal

Port the 2-player snake puzzle game with MCTS AI from Swift to browser JS.
Modes: human vs human, human vs AI, AI vs AI. A toggle shows the path the AI
is plotting, as in the original app. Undo (Z) is a core mechanic in human
play.

## Deliverable

One `game-snake/index.html` with inline JS/CSS. No build step, no server;
must work opened from `file://`. Canvas rendering styled after the original
app: dark board, walls, green player 1, blue player 2.

## Game engine (faithful port of EngineShared)

- Immutable `GameState { level, foodPosition, player1, player2, foodRngSeed,
  numberOfSteps }`. Updates produce new states (enables undo).
- Simultaneous 2-player movement. Movements: dontMove, moveForward, moveCCW,
  moveCW. Reversing is impossible by construction.
- Collisions: wall, self, opponent. A dead snake stays on the board as an
  obstacle. Cause-of-death tracked per player (wall / itself / opponent /
  stuck-in-a-loop / no-more-food).
- Food: one food at a time, spawned at a random empty cell using the same
  LCRNG as Swift `SeededGenerator` (seed = 2862933555777941757 * seed +
  3037000493), seed carried in game state for reproducibility. No empty
  cells left → game over (.noMoreFood).
- Stuck-in-a-loop detector for bots, ported from `StuckSnakeDetector`.
- Levels: all 12 CSVs from `SnakeLevels.bundle` embedded as strings, parsed
  with the original tokens (`W` wall, `P1R4` player 1 facing Right length 4,
  `F` food, blank empty). UUIDs preserved.

## Play modes and stepping

- Per-player role selector: Human / MCTS bot / Disabled.
- If a living human is installed, the game is turn-based: each tick waits
  for human arrow/WASD input (`isWaitingForHumanInput` semantics, including
  `preventHumanCollisions`). This is the original puzzle play style.
- Bots-only games auto-step on a timer; Space = pause/resume; a single-step
  button advances one tick while paused.
- Keys as in the original: arrows = P1, WASD = P2, Z = undo, Enter =
  restart. Plus P = toggle planned path.
- Undo: stack of past game states; Z pops one, clears pending human input,
  re-triggers bot planning, and pauses auto-stepping.

## MCTS bot (faithful SnakeBot6 port)

- Tree shape: MoveNode → 3 move choices (CCW/forward/CW, wall-colliding
  moves pruned) → FoodNode → food placement choices → opponent MoveNode →
  recursive.
- Adaptive branching: full 3-way at depth ≤ 2, narrower (1–2 random) below.
- Depth limits: 37 single-player, 17 two-player.
- Scenario comparator: avoid certain death ≻ longer surviving path ≻ more
  food eaten ≻ shorter distance to food.
- Tree reuse between ticks (reattach subtree at the new position).
- Deterministic seeding per iteration (seed = iteration * 100).
- Runs in a Web Worker created from a Blob. The engine code lives in one
  `<script>` tag whose text is concatenated into the worker source, so game
  logic is defined once. UI shows a "thinking…" indicator during compute
  (1–10 s is normal for two bots).
- Bot output per compute: chosen movement + `plannedPath` (array of
  positions from head along the best scenario).

## Planned-path overlay

- Toggle button and `P` key.
- Per bot player, draw a polyline through `plannedPath` in the player's
  color: bright, ~30% of tile width, rounded caps up to the food position
  (high confidence); 1px at 30% opacity, square caps beyond it (low
  confidence). Same scheme as `PlannedPathView.swift`.

## Out of scope

Replay system, level-picker screen (a dropdown replaces it), other bots
(shortest-path, tree search, Monte Carlo 1, random, neural net), sounds.
The bot interface is ported as-is so these can be added later.

## Verification

- `?test=1` runs an in-console self-test: all 12 levels parse; engine
  determinism (fixed seed → identical state hash after N bot-vs-bot steps);
  collision and food-spawn unit checks.
- Manual play-testing of all three modes, undo, pause, path toggle.
