# Boulder Dash: Praetorian honor line at the imperial box

Date: 2026-07-16
Status: approved by owner

## Problem

The imperial box has only two flanking guards. The owner wants more
soldiers with red banners around Caesar's temple.

## Owner decisions

- Honor line each side (not full perimeter, not a dense double row):
  three additional Praetorians per side with red vexillum banners.

## Design

- Extract the `guard(gx)` helper from `drawImperialBox` into a
  standalone `drawPraetorian(gx)` in the presentation IIFE — identical
  drawing (red tunic, bronze cuirass/helmet, red crest, full-height
  vexillum standard: pole, crossbar, red banner, gold border, gold
  roundel), box-local coordinates.
- `drawImperialBox` keeps calling `drawPraetorian(-70)` / `(70)` — the
  2.2× death/game-over screens are unchanged (flanking pair only).
- In `drawAudience`, inside the existing 1.4× box transform right after
  `drawImperialBox`, draw the honor line: `drawPraetorian` at local
  x = ±95, ±120, ±145 (real ≈ ±133/168/203 from canvas center),
  standing on the arena wall at the box's ground level.
- The seating gap in `buildAudience` widens from `|x - CW/2| < 115` to
  `< 215`, still all three top tiers — the banner poles and cloth rise
  through every tier height, so the zone reads as an imperial cordon.
  Sides and bottom stands untouched.

## Verification

`node test.mjs` (engine untouched); headless screenshots via
`window.__colosseum`: stands view (evenly spaced honor line, banners
not overlapping spectators, cordon clear) and deathwait view (still
only the two flanking guards).
