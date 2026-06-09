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

## Development

The engine and bot are pure JS in the `shared-code` script block, shared
between the page, the worker, and the test runner:

```sh
node test.mjs          # run the engine/bot test suite
open index.html?test=1 # same suite in the browser
```

All 12 levels from the original `SnakeLevels.bundle` are embedded as CSV.
