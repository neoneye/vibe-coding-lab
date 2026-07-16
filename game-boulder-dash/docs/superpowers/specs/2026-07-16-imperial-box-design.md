# Boulder Dash: imperial box — bigger, regal, ringside

Date: 2026-07-16
Status: approved by owner (incl. annotated screenshot: move the box down
to the arena edge)

## Problem

The emperor's box is small relative to the enlarged Roman crowd and sits
at the outer rim of the top stands, far from the arena. It neither reads
as the ruler's area nor gives Caesar a view of the fight.

## Owner decisions

- Bigger AND more regal (guards, standards, canopy) — not a plain
  scale-up, not a full podium redesign.
- The box must sit adjacent to the arena: platform flush on the arena
  wall ring, like a balcony over the action ("1st class tickets").

## Placement and scale (stands view)

- Draw at 1.4× via `ctx.scale` at the `drawAudience` call site.
- Translate to `(CW / 2, PF_Y - 4 - 32 * 1.4)` so the scaled platform
  bottom (local y = +32) lands on the arena wall ring at `PF_Y - 4`.
- The seating gap near the box widens to `|x - CW/2| < 115` and applies
  to ALL THREE top tiers (the box now covers the band's lower half at
  the center; no row may poke through it).
- Death/game-over screens keep their existing translate + 2.2× scale.

## Regalia (inside `drawImperialBox`, inherited by death screens)

- Two Praetorian guards flanking the box just outside the columns
  (x ≈ ±70): red tunic, bronze helmet with red crest, skin-tone legs,
  standing at platform-base level.
- Each guard holds a vexillum standard: a pole rising above the
  pediment line, crossbar on top, hanging red banner with gold border
  and a gold roundel emblem. No SPQR lettering — unreadable at these
  scales.
- A purple-and-gold scalloped valance under the pediment across the
  front, replacing the plain gold top strip of the platform.
- Caesar, Cleopatra, fan servants, columns, and pediment unchanged.

## Verification

`node test.mjs` (engine untouched) plus headless screenshots via the
`window.__colosseum` hook: stands view (box on the arena wall, no
orphaned spectators through the box, no collision with the HUD plaque)
and the deathwait screen (regalia at 2.2×, composition intact).
