# Straight up the Hormuz — Design

Solo tactical deduction game: Minesweeper × Battleship × oil economy.
Single standalone `index.html`, zero dependencies. Tone: sarcastic dark comedy,
delivered through a Captain's Log and game-over screens.

## Concept

You command a carrier group ordered to clear an enemy fleet out of the Strait
of Hormuz before your oil reserves run dry. One hidden 10×10 grid; every action
costs oil; deduction from minesweeper-style numbers guides your shots.

## Grid contents

10×10 grid, randomly populated per game, no overlaps:

- Fleet (straight lines, horizontal or vertical; every fleet contains at
  least one horizontal and one vertical ship): Carrier 5, Battleship 4,
  Cruiser 3, Submarine 3, Destroyer 2 — 17 ship segments total.
- Mines (count by difficulty; variant mix below).
- Oil fields (count by difficulty).

Every other tile is water. A water tile's number = count of adjacent
(8-direction) tiles containing a ship segment, mine, or oil field.

## Revealing

Clicking an unrevealed tile costs 1 oil and resolves as:

- 💥 Ship hit — damages that segment. When all segments of a ship are hit,
  the ship is sunk: outline revealed, log entry.
- 💣 Mine — detonates (see variants).
- 🛢️ Oil field — captured: +10 oil.
- 🔢 Number — empty water. Revealing a 0 flood-reveals the connected region of
  zeros (and its numbered border) for free, minesweeper-style.

Right-click / long-press toggles a free 🚩 flag on an unrevealed tile.

## Oil economy & win/lose

- Standard shot: 1 oil. Recon Flight: 3 oil. Bombing Run: 5 oil.
- Oil field capture: +10 oil.
- Win: all 5 ships sunk. Lose: oil reaches 0 with ships still afloat.
  (An action may be taken while oil ≥ its cost; oil may not go below 0 from
  action costs. Mine penalties clamp at 0 — if a mine penalty lands you on 0
  and ships remain, you lose.)

Difficulties (start screen):

| Difficulty  | Oil | Mines | Oil fields |
|-------------|-----|-------|------------|
| Easy        | 60  | 12    | 8          |
| Normal      | 50  | 16    | 6          |
| Straight Up | 40  | 20    | 5          |

## Air abilities (always available, unless EMP'd)

- 🛩️ Recon Flight (3 oil): pick the center of a 3×3 area. Tiles stay hidden;
  you get a report — ship segments: N, mines: N, oil fields: N — in the log,
  and a faint persistent overlay marks the scanned zone with its counts.
- 💣 Bombing Run (5 oil): pick orientation (row or column), then a target
  cell. The target and its two line-neighbors all resolve exactly as if
  clicked (hits, mines, oil all trigger; already-revealed cells are no-ops).
  Cells clipped by the board edge are lost — 3 cells max, fewer at the rim.

The spec's Emergency Supply Drop (repairing your own ships) has no target in
solo mode and is dropped.

## Mine variants

- 💣 Standard — hull scratch: −3 oil.
- 🧨 Depth Charge — −5 oil, then detonates: reveals all 8 neighbors; any oil
  fields among them burn (revealed, worth nothing); ship segments among them
  are revealed as hits.
- 🔥 Oil Fire — ignites the nearest unrevealed oil field (Euclidean nearest;
  ties resolve in row-major order): destroyed in place, revealed, worth
  nothing. If no
  unrevealed oil fields remain, falls back to standard −3 oil.
- ⚡ EMP — air abilities disabled for the next 3 actions (any oil-costing
  action counts down the timer).

Variant mix scales with difficulty; mostly standard, a few of each variant.

## UI

Dark naval palette, laptop-first, mouse/touch only.

- Left panel: fleet status (ship silhouettes filling red per hit, struck
  through when sunk), oil gauge (color shifts as it drains), ability buttons
  (Recon / Bombing Run) with costs, EMP lockout indicator.
- Center: the grid — CSS grid tiles, emoji icons, small CSS animations
  (shake on mine, flash on hit, ripple reveal).
- Right/bottom: Captain's Log, newest first, randomized sarcastic lines per
  event type (no immediate repeats).
- Start screen: title, difficulty select, tongue-in-cheek briefing.
- Game-over screens (win and loss variants) that roast the player, with
  stats (shots fired, oil wasted, mines found the hard way) and replay button.

## Architecture & testing

Single `index.html`. Game logic (placement, adjacency counts, flood reveal,
oil accounting, mine effects, ability resolution, win/lose) written as plain
pure-ish functions on a state object, separate from DOM rendering code, in
distinct `<script>` sections. Logic functions are exported to `globalThis`
under a `Hormuz` namespace so a node-based harness can extract and
sanity-check them headlessly. Manual playthrough for UI verification.
