# Snake MCTS

Browser port of [SwiftSnakeEngine](https://github.com/neoneye/SwiftSnakeEngine) —
a 2-player snake puzzle game with a Monte-Carlo tree search AI ("Monte Carlo 2"
/ SnakeBot6). Single self-contained `index.html`; open it directly from disk,
no server or build step needed. The MCTS runs in a Web Worker so the UI stays
responsive.

Each player can be Human, Bot, or Off — so human vs human, human vs AI, and
AI vs AI all work. The **Show AI path** toggle draws the route the bot is
plotting: bright and thick up to the food, thin and faint for the speculative
moves beyond it.

When a human is playing, the game is turn-based: it waits for your key each
step, and **undo** lets you backtrack out of certain death — that's the puzzle.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys | Player 1 (green) |
| WASD | Player 2 (blue) |
| Z | Undo |
| Space | Pause/resume (bot-vs-bot) |
| Enter | Restart |
| P | Toggle AI path overlay |
| M | Toggle music |

## Bots

- **Monte Carlo 2** — faithful port of SnakeBot6 from SwiftSnakeEngine: a
  deterministic Monte-Carlo tree search over moves and simulated food drops.
- **Hybrid** — exact-search bot built to beat it. Solo: BFS to the food,
  committed only when a timing-aware flood fill proves the snake can still
  escape after eating; otherwise it stalls safely. Duels: 8-ply paranoid
  alpha-beta with Voronoi territory, food-race, and trap-penalty evaluation.

`node tournament.mjs` plays the deterministic series (12 levels × both
seats, plus solo runs):

| | Hybrid | Monte Carlo 2 |
| --- | --- | --- |
| Head-to-head (24 games) | **17 wins** | 5 wins (2 draws) |
| Solo: longer snake | **8 / 12 levels** | 2 / 12 |
| Solo: boards fully cleared | **1** (Level 0, 49/49 cells) | 0 |

(Levels 4 and 5 are structurally unwinnable solo — food can spawn outside
the sealed room a snake starts in — and score identically for both bots.)

## Notes on the original algorithm (SnakeBot6, ~2020)

A close read during the port turned up more than expected.

**The distinctive trick: nearest-food subtree adoption.** The bot keeps its
search tree between ticks and reattaches the subtree matching what actually
happened. Food respawns are modeled as chance nodes, and when the real food
appears at a position the tree never sampled, the orthodox move is to
discard the subtree. SnakeBot6 instead adopts the subtree of the *nearest*
simulated food drop, as if it were the real one. Technically unsound — those
cached simulations assumed food elsewhere — but cheap, and it exploits a
real property of snake: plans toward nearby goals are mostly
interchangeable. No named counterpart in the MCTS literature comes to mind.

**Independent reinventions.** The hand-tuned food-drop branching tables
(16 samples early, narrowing with depth and foods eaten) are progressive
widening, arrived at empirically. The `isBest` flags — always re-expand
last tick's principal variation, randomly sample a few alternatives — are
PV-first move ordering standing in for UCT's bandit statistics. The level
cluster system (precomputed inter-cluster distances, manhattan within a
cluster) is a simplified HPA*-style abstraction used as a distance oracle.

**The deliberate heresy.** There is no value backup at all: complete
scenarios are collected at the leaves and ranked by a lexicographic
comparator (survival ≻ longer line ≻ foods eaten ≻ food distance). That
discards the statistical averaging that makes Monte-Carlo methods strong —
the tree remembers *where* it searched but not *what it learned* — but it
makes the bot perfectly explainable: the winning scenario literally is the
planned path drawn on screen. The visualization works because of this.

**Determinism as a design principle.** Everything is seeded; candidate food
positions are even sorted before random selection ("we trade slow
performance, and instead gets a deterministic bot"). It's why the planned
path is stable enough to watch, why games reproduce, and why the port
could be verified against tests at all.

**The margin notes predicted the winner.** The original `IDEA:` comments
diagnose every weakness the tournament exposed: getting to food without
room to move around (the missing flood-fill escape check), tail-chasing
instead of eating the last food, and treating the opponent as a static
obstacle. The Hybrid bot is essentially that comment section, implemented —
and SnakeBot6 still takes 5 of 24 games off it.

## Development

The engine and bot are pure JS in the `shared-code` script block, shared
between the page, the worker, and the test runner:

```sh
node test.mjs          # run the engine/bot test suite
open index.html?test=1 # same suite in the browser
```

All 12 levels from the original `SnakeLevels.bundle` are embedded as CSV.
