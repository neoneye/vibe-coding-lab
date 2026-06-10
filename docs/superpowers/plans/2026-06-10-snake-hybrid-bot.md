# Snake Hybrid Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Hybrid" bot (trap-aware BFS + alpha-beta/Voronoi duel search) to game-snake and prove it beats the Monte Carlo 2 port in an automated tournament.

**Architecture:** All bot logic goes in the shared-code block of `game-snake/index.html` (pure JS, no DOM — shared by page, worker, test.mjs). A new `tournament.mjs` extracts that block like `test.mjs` does. Roles are widened from `"bot"` to `"botMonteCarlo" | "botHybrid"`.

**Tech Stack:** Vanilla JS, existing SnakeTests registry, node for tests/tournament.

**Spec:** `docs/superpowers/specs/2026-06-10-snake-hybrid-bot-design.md` — normative for all algorithms, weights, and the success bar.

---

### Task 1: Role plumbing — botMonteCarlo / botHybrid

**Files:** Modify `game-snake/index.html` (shared-code + UI script)

- [ ] Add `function playerIsBot(p) { return p.role === "botMonteCarlo" || p.role === "botHybrid"; }` next to the other player helpers; replace the three `role === "bot"` checks (StuckDetector.killBotIfStuckInLoop, UI requestBotMoves, render path-overlay guard) and `playerCreate`'s `isInstalled` logic (`role !== "none"` is unchanged).
- [ ] Update HUD `<select>` options: `botMonteCarlo` ("Bot — Monte Carlo 2", still P2 default), `botHybrid` ("Bot — Hybrid").
- [ ] Worker glue: compute message gains `role`; worker keeps `bots = {player1: {type, bot}, player2: …}` and re-instantiates when type changes (Bot6 for botMonteCarlo, HybridBot for botHybrid).
- [ ] Test: `gameStateCreate("Level 0", "botHybrid", "botMonteCarlo")` → both `playerIsBot`, neither human-alive; runBotGame helper updated to take per-player bot constructors.
- [ ] `node test.mjs` green → commit `feat(snake): widen player roles for multiple bot types`

### Task 2: Path/space toolkit (pure functions, the bot's primitives)

**Files:** Modify `game-snake/index.html` (shared-code)

- [ ] Implement, each taking explicit args (level, body/bodies, growth counts) so they're unit-testable:
  - `vacateStep(body, growth)`: map posKey → step number at which that body cell vacates (tail vacates at step 1 + growth, etc.).
  - `passableAt(level, vacateMaps, pos, step)`: not wall, and every occupying snake cell vacates ≤ step.
  - `bfsPath(level, vacateMaps, start, target)`: timing-aware BFS, returns position array head→target or null.
  - `floodFillCount(level, vacateMaps, start)`: timing-aware reachable-cell count.
  - `tailReachable(level, body, otherBody, growth)`: BFS from head to current tail cell with timing.
- [ ] Tests: straight snake can reach the cell its tail vacates next step but not its mid-body; flood fill on Level 0 from a corner = free cells; path around the Level 5 inner walls exists and has plausible length.
- [ ] `node test.mjs` green → commit `feat(snake): timing-aware path/space toolkit`

### Task 3: HybridBot single-player

**Files:** Modify `game-snake/index.html` (shared-code)

- [ ] `class HybridBot { compute(level, player, oppositePlayer, foodPosition) }` implementing attack → escape-check → stall → last-resort exactly per spec, plus the own-body-state-hash repeat penalty. Opponent treated as static obstacle when dead-but-installed (its cells never vacate).
- [ ] Tests: determinism; safety invariant over 200 solo steps; **Hybrid clears Level 0 solo** (noMoreFood within 1500 steps); does not enter a constructed dead-end pocket.
- [ ] `node test.mjs` green → commit `feat(snake): hybrid bot single-player search`

### Task 4: HybridBot two-player minimax

**Files:** Modify `game-snake/index.html` (shared-code)

- [ ] Alpha-beta, 8 plies alternating me/opponent, paranoid; evaluation weights per spec (death ±1e9∓ply, length ×10000, food race +2000, trap −1000/cell, Voronoi ×10); root veto = prefer tail-escape-passing moves; plannedPath = PV positions.
- [ ] Tests: avoids a forced head-on (constructed position where moveForward = mutual death); 20-tick duel vs Bot6 on Level 0 runs clean; determinism in duel mode.
- [ ] `node test.mjs` green → commit `feat(snake): hybrid bot adversarial duel search`

### Task 5: Tournament + README results

**Files:** Create `game-snake/tournament.mjs`; modify `game-snake/README.md`

- [ ] Script per spec: 24 duels (12 levels × 2 seats, 2000-step cap) + solo runs (1500-step cap), winner rules from spec, prints a table, exits 0 iff Hybrid meets the success bar (more duel wins than losses AND clears ≥1 board MC2 doesn't).
- [ ] Run it; paste the summary table into README under a "Bots" section.
- [ ] Commit `feat(snake): hybrid-vs-mcts tournament with results`

### Task 6: Browser verification + merge

- [ ] CDP check: select Bot — Hybrid for P1 vs Monte Carlo 2 for P2, watch 30+ steps, path overlay renders, no console errors; screenshot.
- [ ] `node test.mjs` + tournament green on merged result → merge to main, delete branch.

## Self-review

Spec coverage: roles (T1), algorithms (T2-4), tournament+bar (T5), UI/browser (T6). Names consistent: `playerIsBot`, `HybridBot`, `bfsPath`, `tailReachable`, `floodFillCount`, `vacateStep`. No placeholders; weights and rules live in the spec to avoid drift.
