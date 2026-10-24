# Jacquard Loom: design

Date: 2026-10-24. Directory: `jacquard-loom/`.

## Intent

A single self-contained page about the Jacquard loom (1804). Punched cards choose which warp threads are lifted for each pass of the shuttle, so any picture can be woven. The owner picked this from five proposals with "go ahead, implement that" and then went away for a few hours. So every choice below is *(my call)*, made to match the lab's habits: a real mechanism, lots of parameters, presets, honest explanations, and tests for every claim.

The page shows the whole chain: **design on point paper → punched cards → hooks → warp up or down (the shed) → shuttle → woven cloth**, with the loom running and the cloth growing pick by pick.

## Goals

- **One weave model** that covers single-weft cloth (damask, shaded "portrait" weaving) and multi-weft brocade:
  - Each design colour has a *face weft* and a *weave structure*.
  - Each design row becomes k picks (one per weft).
  - The weft whose colour matches the cell goes on the face using the structure. The others are hidden behind lifted warp, tied down at sparse binding points (optional, so you can see back floats appear when the ties are off).
- **Structure library:**
  - plain, basket, warp and weft ribs
  - twills (1/2, 2/1, 1/3, 3/1, 2/2, S/Z)
  - herringbone
  - 5- and 8-end satins (warp- and weft-faced)
  - a 7-step *shaded satin* series (1/8…7/8 warp) for grey levels
- **Harness:** n hooks; straight tie (repeat) or point tie (mirror), with horizontal and vertical repeats. Card layout: rows of holes (8 by default) by columns; one card per pick.
- **Float analysis:** the longest warp and weft floats on the face and back, plus an overlay marking floats longer than a limit.
- **Cloth renderer:**
  - shaded threads (tubes that dive at interlacings), thread cover and colours, warp stripes
  - face or back view
  - bare warp above the fell (the edge where weaving stops)
  - a linen-tester loupe under the mouse for thread-level detail
- **Mechanism views**, both animated per pick phase (select → lift → shuttle → beat → next card):
  - *front view of the shed*: card, hooks, cords, warp ends up or down, shuttle carrying weft, cloth fell
  - *side view of the Jacquard head*: card on the prism, 8 needles, hooks, griffe knives, springs
- **Card chain:** the punched cards with the current one highlighted. Click one to jump there.
- **Point-paper editor:**
  - paint tools: pencil, line, rectangle, fill, picker; mirror symmetry; undo
  - bold lines every 8 cells
  - toggle between design colours and the drawdown (the lift pattern)
- **Image import:** fit to the design size, quantised by luminance levels or k-means colours, with optional Floyd–Steinberg or ordered dithering. Shade levels are picked automatically by matching each mix's luminance; wefts can come from the image's colours.
- **Presets**, all procedural (no external images):
  - weave sampler
  - damask rose (straight tie, symmetric drawing)
  - shaded sphere (grey levels)
  - Ada Lovelace's 1843 quote in a built-in 5×7 pixel font
  - three-weft brocade
  - shaded Mandelbrot
  - a diamond motif on a point tie
  - a plain/twill/satin comparison
- **Controls:** play/pause, step, speed, weave all, rewind; optional loom sound (synthesised clacks), off by default.
- **Export:** a cloth PNG, and a WIF 1.1 file (Jacquard as one shaft per hook, threading + liftplan).
- **Explainer and honesty panel**, covering the history: Bouchon 1725, Falcon 1728, Vaucanson 1745, Jacquard 1804, the 1839 woven portrait (~24,000 cards), Babbage, Lovelace, Hollerith.

## Non-goals

- No thread mechanics: no take-up or crimp physics. The cloth rendering is stylised.
- A single-lift Jacquard head (one griffe). Double-lift machines, multiple harnesses and lampas binding warps are not modelled.
- No libraries. Works from `file://`.

## Testing

`JacquardTests` in `<script id="shared-code">`, run by `test.mjs`. It checks:

- satins have one point per row and column and are not twills
- each shaded level has coverage k/n
- twill diagonals and plain-weave floats
- float lengths with wrap-around
- single-weft and multi-weft lift rules, including back binding
- the back view is the inverted mirror of the face
- point and straight ties
- the card hole layout is a bijection
- quantiser and ditherer properties
- font coverage for the quote
- shade selection at the extremes
- every preset builds with sane floats
- WIF structure

## Findings while building (my calls, recorded)

- **Point tie mirrors the satin.** Mirrored, a satin with counter 3 becomes one with counter 5. Where they meet at the mirror lines, floats merge to 13–15 ends. So the damask moved to a straight tie with a symmetric drawing. The point tie is shown with twills (the diamond preset), which mirror cleanly.
- **Matched satin family.** Mixing satin 8 (counter 3) with satin 5, twill 2/2, or even the complementary satin 8 gives edge floats up to 13. Using the shaded series for figures (shade 7/8 on a satin 8 ground: same counter, nested points) keeps every float ≤ 7. The Lovelace and damask presets use this, and a test pins it.
- **Picks drawn 1/k tall** with k wefts (finer wefts), so multi-weft figures keep their proportions.
- **Point paper** shows arbitrary code colours by default, as on real mise-en-carte, with *Tone* (the woven mix) and *Cards* (the drawdown) as alternative views. In tone view, plain, basket and twill 2/2 all look alike, because they share the same 50% cover.
- **Image import:**
  - Grey levels are spread over shades 1–7 by rank. Threads too close in tone switch to black and white.
  - Colour import uses a dark warp drawn from the image. Each extra weft dilutes the others in this one-layer model, so 2–3 wefts read best, and the panel says so.
- **Cloth view:**
  - A box-filtered mip chain stops moiré when the cloth is zoomed out.
  - When paused, the mechanism shows the open shed for the next pick.
