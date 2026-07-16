# Boulder Dash: Roman audience redesign

Date: 2026-07-16
Status: approved by owner

## Problem

The Colosseum spectators read as bald modern figures: an 8×7 colored
rectangle (t-shirt) with a bare skin-colored head. No hair, no face, no
period clothing. The emperor box is already Roman; the crowd is not.

## Owner decisions

- Enlarge the spectators ~50% (not detail-at-current-size, not
  front-row-only).
- Make room by widening the stands band, not by dropping tiers or
  overlapping rows. Crowd density and 3-tier layout are preserved.
- Facial expressions react to the game (cheer-driven), not fixed per
  person.

## Geometry

- `STAND` 84 → 120. Canvas becomes 864×630 logical (derived), and
  already auto-scales to the window via `fitCanvasMetrics`, so no other
  sizing code changes.
- Tier spacing 22 → 33 px, seat pitch along rows 14 → 21 px, side
  column pitch 17 → 25 px.
- Wine stall, emperor-box seating gap, empty seats (12%), and walkers
  (6%) keep their logic; coordinates nudge to the new pitch.

## Figure rendering

One parametric `drawSpectator` using the file's existing
`fillRect`/`arc` pixel-art primitives, driven by per-seat hashed
attributes assigned in `buildAudience`. Figures are ~12 px wide,
~19 px tall, head radius ~4.5 px.

### Garments (by seat hash)

- **Tunic, ~45%** — knee-length, colors from the existing `TUNICS`
  palette, darker belt line, bare lower legs.
- **Toga, ~25%** — off-white/natural wool with a diagonal drape band
  over the left shoulder; a small fraction get the purple stripe of
  the toga praetexta.
- **Stola + palla, ~30%** — ankle-length stola in matron colors with a
  contrasting palla shawl across the shoulders; about half wear the
  palla drawn up over the head (fabric arc replaces hair).

### Hair

Hair cap 2–3 px in black/brown/auburn/grey; ~10% of men bald with a
fringe; men get a short crop, women without a head-palla get a bun
knot.

### Faces

Two 1 px eyes always. Mouth follows the game: absent/flat when idle,
open dark shout when `cheer × zeal` crosses the same 0.45 threshold
that raises arms today; on thumbs-down deaths the shout reads as
jeering. Walkers keep their wine cup and never shout (hands full).

## Untouched

Emperor box figures (already Roman) except coordinate shifts from the
wider band; the wine vendor gets the same hair/face treatment so he
matches the crowd. Engine, input, audio, and gameplay code unchanged.

## Verification

`test.mjs` covers the engine only. Verify visually via the synchronous
headless-screenshot flow (temp `_shot.html`) at dpr 1 and 2, in idle
and full-cheer crowd states.
