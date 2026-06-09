# Snake "Hybrid" bot — design

Date: 2026-06-10
Target: game-snake/index.html (shared-code block), game-snake/tournament.mjs
Goal: a new bot that demonstrably beats the ported SnakeBot6 ("Monte Carlo 2").

## Why it wins

SnakeBot6 loses two ways: it enters spaces it cannot exit (its tree narrows
to 1-2 random branches past depth 5, so it never proves an escape exists),
and in duels it models the opponent as random rather than adversarial. The
Hybrid bot replaces sampling with exact graph algorithms.

## Bot interface

Same as Bot6: `compute(level, player, oppositePlayer, foodPosition)` returns
a new bot instance with `plannedMovement` and `plannedPath`. Pure and
deterministic — no RNG, no time budget. Lives in the shared-code script
block; runs in the existing worker; tested via SnakeTests/test.mjs.

## Single-player mode (opponent dead or not installed)

1. **Attack**: BFS shortest path to food. A body cell is passable if it will
   have vacated when the head arrives (cells-from-tail index vs arrival
   step, accounting for pending growth from food in the stomach).
2. **Escape check**: simulate following the entire path and eating (+1
   growth). From the post-eat state, the snake's own tail cell must be
   reachable (same timing-aware BFS). Only then commit to the path's first
   step.
3. **Stall** (no path, or escape check fails): among the up-to-3 legal
   moves, keep those after which the tail is still reachable; prefer the
   move maximizing flood-fill free area, tie-break on larger distance to
   food (waste time so the tail frees space).
4. **Last resort** (no move keeps the tail reachable): take the move with
   the largest flood-fill area.
5. **Stuck-loop avoidance**: the engine kills bots repeating body states
   (StuckSnakeDetector: repeat +2, fresh -1, dead at score 5). The bot
   keeps its own set of body-state hashes it has produced and treats a
   repeat as a heavy penalty when choosing among otherwise-equal stall
   moves.

`plannedPath`: the BFS food path when attacking (renders bright to the
food); the stall/last-resort single move plus the path to the tail when
stalling (renders as the thin speculative line).

## Two-player mode (both installed and alive)

Fixed-depth alpha-beta minimax, 8 plies, move order me-opponent-me-…
(approximates simultaneous movement; paranoid — opponent minimizes my
score). Per-node move generation = the 3 rotations, pruning moves into
walls or into body cells that won't vacate in time.

Evaluation at leaves and terminals, descending weight:
- Death: mine = -1e9 + ply (prefer dying later), opponent's = +1e9 - ply.
- Length difference: (myLength - oppLength) * 10_000.
- Voronoi territory: dual-source BFS from both heads over passable cells;
  cells I reach strictly first count +1, opponent's -1; ties neutral.
  Weight 10.
- Food race: +2_000 if my BFS distance to food is strictly smaller than the
  opponent's (0 otherwise; food may be null mid-tick).
- Trap penalty: if my flood-fill area < my length, -(length - area) * 1_000.

Move veto: if any root move passes the single-player tail-escape check, the
chosen move must be among those that pass.

`plannedPath`: my moves along the principal variation, converted to
positions from the head (same simulateTick walk as Bot6).

## Integration

- Player roles become `"human" | "botMonteCarlo" | "botHybrid" | "none"`.
  A `playerIsBot(p)` helper replaces the `role === "bot"` checks
  (environment stuck-kill, UI requestBotMoves/render/keyboard guards,
  worker). Existing saved role value "bot" maps to "botMonteCarlo".
- Role dropdowns gain "Bot — Hybrid" (Monte Carlo 2 stays default for P2).
- Worker keeps per-player bot instances keyed by bot type; a role change or
  reset recreates them.

## Tournament — game-snake/tournament.mjs

Node script extracting the shared-code block (like test.mjs):
- **Duels**: Hybrid vs Monte Carlo 2, all 12 levels x both seats = 24
  deterministic games, max 2000 steps. Win = outlive the opponent;
  same-tick death = longer snake wins, else draw; step cap = longer snake
  wins, else draw. noMoreFood for both = draw (board cleared).
- **Solo**: each bot alone on each level, 1500-step cap; report foods eaten
  and whether the board was cleared (noMoreFood).
- Prints a results table; summary goes into game-snake/README.md.

Success bar: Hybrid wins the duel series outright (more wins than losses)
and clears at least one board solo that Monte Carlo 2 does not.

## Tests (SnakeTests registry)

- Determinism: two computes on the same state give identical movement+path.
- Safety invariant: across a 200-step solo game, after every chosen move
  the tail remains reachable whenever some legal move could have kept it
  reachable.
- Solo Level 0: Hybrid clears the board (both players die of noMoreFood)
  within 1500 steps.
- Constructed trap: a position where the food sits in a dead-end pocket
  smaller than the snake; Hybrid must not enter (Bot6 used as contrast in
  the tournament, not asserted in unit tests).
- Duel smoke: 20 ticks Hybrid vs MC2 on Level 0 without error.
- Role plumbing: gameStateCreate with "botHybrid"/"botMonteCarlo" roles.
