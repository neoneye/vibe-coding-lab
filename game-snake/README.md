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

## Development

The engine and bot are pure JS in the `shared-code` script block, shared
between the page, the worker, and the test runner:

```sh
node test.mjs          # run the engine/bot test suite
open index.html?test=1 # same suite in the browser
```

All 12 levels from the original `SnakeLevels.bundle` are embedded as CSV.
