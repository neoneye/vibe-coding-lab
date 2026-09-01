# Pythagorean Cup v2 — Design

**Date:** 2026-09-02
**Directory:** `pythagorean-cup/`
**Deliverable:** Full rework of the self-contained `index.html`, plus a new `test.mjs` and a regenerated `screenshot1.jpg`. The old page is replaced entirely (git history keeps v1: commits `b14605b`, `07b8212`, `362031d`).

## Problem with v1

v1 is a pleasant animation, but it does not explain the cup's internals:

- **The anatomy is wrong-ish and cramped.** The hidden channel is drawn as a thin inverted U inside a solid post. A real Pythagorean cup has a *hollow* central column with a *concentric* inner tube: liquid enters through holes at the column's base, rises in the ring-shaped gap around the inner tube, spills over the tube's open top, and falls through the tube and the stem to a hole under the foot. Nobody can learn that from the v1 drawing.
- **The physics is scripted, not modelled.** Stages (`cascade`, `prime`, `siphon`) are timers; the drain rate is a hand-tuned curve; the "you can't out-pour a siphon" taunt is simply false.
- **The explanation is a bullet list.** No pressures, no flow rates, no heads, no way to change the geometry and see what happens, no way to see the cup from the outside first.

## Concept

**Anatomy first, then physics, then play.** The page keeps v1's warm terracotta/parchment look and its hold-to-pour charm, but is rebuilt around three things:

1. **A correct cutaway** of the concentric siphon with a *reveal slider* that peels the opaque exterior away to the cross-section, clickable parts with names and one-line explanations, and a small *plan-view inset* showing that the "two channels" in the section are one ring.
2. **A real 1-D hydraulic model** in physical units (cm, cm³/s, cm H₂O): communicating vessels while filling, a weir over the crest, a slug that primes the falling tube, Torricelli/Bernoulli siphon flow whose head is the drop from the free surface to the outlet, air break-in at the intake holes. Live readouts of level, flow, and gauge pressure at the crest, with an optional pressure colouring of the liquid in the channel and a pressure-along-the-path chart.
3. **A guided tour** of seven steps that drives the same model and drawing to make each point, then hands over to **free play** with sliders for crest height (the "fair-share" line) and bore diameter.

## Anatomy (what the drawing must show)

Cross-section through the axis, real proportions, units cm. Constants live in a `GEO` object in the shared-code block; the numbers below are initial values.

| Part | Geometry |
|---|---|
| Bowl | inner radius 4.0, floor at z = 0, rim at z = 8.0, wall 0.35 |
| Foot and stem | stem below the floor, foot bottom at z = −2.0 |
| Central column (hollow shell) | outer radius 1.1, wall 0.25, closed domed top at z = 6.4 |
| Intake holes | openings in the column shell at z = 0…0.35 (two visible in section; a ring of holes in reality) |
| Rising channel (annulus) | ring between column shell (inner r 0.85) and inner tube (outer r 0.45) |
| Inner tube (falling channel) | bore radius 0.4 (slider 0.2–0.6), wall 0.05, open top = **crest** at z = H_c = 5.0 (slider 2.5–6.5) |
| Stem passage and outlet | the inner tube continues straight down through the floor and stem; outlet at z = −2.0 |

Named parts (hover/click targets, and the legend): `bowl`, `column`, `holes`, `annulus`, `tube`, `crest`, `stem`, `outlet`. Each has a title and a one-sentence explanation.

**Reveal slider** (0–100 %): an opaque exterior layer (bowl silhouette, foot, shading; *no* column visible — from the side it is just a cup) is clipped by a vertical cut edge that moves from the right edge to the left edge. The section underneath is always fully rendered. A hatched cut edge and an "outside / inside" caption make the reveal legible.

**Plan-view inset** (fixed, small, in a stage corner): concentric rings as seen from above at a dashed cut height z = 2.5 — bowl liquid ring, column shell, annulus, tube wall, bore. Rings are painted wine-coloured when the model says they are wet at that height.

## Physics (the shared-code model)

`CupModel` is pure JS, no DOM, deterministic (no RNG). State is in cm and cm³. `g = 981 cm/s²`.

Areas: `A_bowl = π(R_b² − R_c²)` (free surface, constant), `A_ann = π(r_ci² − r_to²)`, `A_tube = π r_t²`. Volumes are tracked separately for the bowl (`h`), the rising channel, the falling tube (`tubeFill`, 0…1 from the crest downward), the stream that has left the outlet (`drained`), rim overflow (`spilled`), and `poured`.

**Phases** (`phase` field):

- `filling` — liquid enters via the holes; the annulus is a communicating vessel, so `levelAnnulus = h` whenever `h ≥ hole height` (below it the holes are the only wet part). No outflow. Pouring stops adding at the rim: excess goes to `spilled` (overflow down the outside).
- `spilling` — `h > H_c`: a sharp-crested circular weir of length `2π r_t` passes `Q_w = C_w · 2π r_t · √(2g) · (h − H_c)^1.5` with `C_w = 0.4`. The overflow forms a slug that fills the falling tube from the crest downward: `tubeFill += Q_w dt / V_tube`, where `V_tube = A_tube · (H_c − z_out)`. This is the one qualitative step in the model and is described as such in the tour ("in a narrow bore the overflow does not free-fall; it seals the bore and pushes the air out ahead of it").
- `siphon` — `tubeFill = 1`. Flow `Q = C_d · A_tube · √(2g (h − z_out))` with `C_d = 0.62` (bore losses lumped). Note the head is surface-to-outlet, **not** surface-to-crest: crossing the crest is what starts it, but the crest height plays no part in how hard it pulls. Pouring during the siphon nets against `Q`; if the pour rate exceeds `Q(h = rim)` the level pins at the rim and the excess overflows. The annulus level is pinned to the crest (the channel runs full).
- `breaking` — when `h < z_holeTop` air enters the intake; the tube and annulus drain (`tubeFill` and `levelAnnulus` fall over ~0.4 s), then `phase = empty`. The residual in the bowl is what sits below the hole top (a film, ≈ 0.35 cm × A_bowl).
- `empty` — a terminal state until the user pours again, which returns to `filling`.

**Pressure** (gauge, in cm H₂O; the display unit is "cm of water", with kPa shown on hover).

- Static (filling/spilling): `p(z) = h − z` anywhere in the connected liquid.
- Siphon: Bernoulli with losses along the streamline surface → holes → annulus → crest → tube → outlet. Let `H = h − z_out`, `v = C_d √(2gH)`, and the total loss `(1 − C_d²) H` be distributed in proportion to distance travelled along the path. Then `p(s)/ρg = (h − z(s)) − C_d² H − (1 − C_d²) H · s/s_total`. This gives `p = 0` at the outlet and a negative (suction) value at the crest — the point the tour makes.
- `pressureProfile()` returns ~40 samples `{s, z, p, label}` along the path for the chart and for colouring the channel liquid.

**Default rates** (tune in implementation): pour rate 45 cm³/s; with the default bore, `Q(h = H_c) ≈ 37 cm³/s` and `Q(h = rim) ≈ 44 cm³/s`, so the cup drains from the crest in about 8 s at 1× and a determined pourer pins the level just under the rim. Speed control 0.25× / 1× / 3× replaces v1's "slow motion".

## Guided tour (default on load)

Each step sets the model to a snapshot, sets the reveal amount, highlights parts, decides whether the model runs and at what speed, and shows a card of 40–90 words. Prev/Next buttons, step dots, and a "Try it yourself" button at the end that switches to Free play.

1. **From the outside** — reveal 0 %. A cup with a foot and, for the drinker, a little dome in the middle. Nothing gives the secret away.
2. **Cut it open** — reveal animates to 100 %. Numbered leader lines to the eight parts. The plan-view inset explains that the two gaps in the section are one ring.
3. **Filling** — model at `h = 3`, pouring on, runs live at 1× and holds at `h = 4` (pour stops automatically). Callout: the liquid in the ring rises level with the bowl (communicating vessels). Readout shows flow out = 0.
4. **The fair-share line** — model paused at `h = H_c − 0.1`. The crest is the only height that matters *now*. Stop here and you keep it all.
5. **Over the top** — pour on, speed 0.25×; runs from `h = H_c − 0.1` until the siphon primes, then pauses. Text: overflow → slug fills the tube → bore sealed. Flow readout jumps from a trickle to the full siphon rate at the instant of priming.
6. **Why it keeps going** — siphon running at 1× from `h = 4` with the pressure colouring and the pressure chart on. Text: the head is surface-to-outlet; pressure at the crest is below atmospheric; the atmosphere on the drink pushes it up the ring to fill the gap. Runs until the break.
7. **Nothing left** — model in `empty` with the residual film. Text: air got in at the holes, the siphon broke; what is left is the film under the hole. Legend: Pythagoras, Samos, ~530 BC, fair share or nothing. "Try it yourself" → Free play.

## Free play

- **Hold to pour** (pointer and keyboard, as v1), **Reset**.
- Sliders: **Crest height** (fair-share line, 2.5–6.5 cm; live-moves the tube top and the dashed line, resets only if the model is mid-siphon), **Bore diameter** (4–12 mm), **Speed**.
- Toggles: **Pressure colouring + chart**, **Labels**, **Reveal** slider (also available in the tour, but the tour overrides it on step changes).
- Readouts (always visible under the stage): level in bowl (cm), level in rising channel (cm), flow out (mL/s), gauge pressure at crest (cm H₂O), poured / drained / kept (mL). Phase badge with the same warn/danger/ok colouring as v1's status line.
- Narration line: one sentence per phase change, as v1, but factual (no "you can't out-pour" claim; instead: "pouring faster than it drains just overflows the rim").

## Rendering

SVG stage (`viewBox` in stage px; `GEO` cm → px via one scale function `sx/sz`). Liquid shapes are rebuilt each frame from the model: bowl liquid (left and right of the column, wave on the surface), annulus liquid (two strips), tube slug (from crest down by `tubeFill`), outlet stream, rim overflow, puddle. A `parts` overlay of transparent hit shapes carries `data-part` for hover/click. Pressure colouring maps `p` through a diverging ramp (warm above atmospheric, cool below) applied as gradient stops along the channel. Droplet particles ride the path (kept from v1's idea, re-parameterised to the new geometry) — decoration only, disabled under `prefers-reduced-motion`.

The pressure chart is a small inline SVG line chart: x = distance along the path (ticks at holes, crest, outlet), y = gauge pressure with the 0 line labelled "atmospheric". Built with the repo's dataviz guidance (neutral palette, both themes not required — the page is a single warm theme).

## Components (logical units)

All pure logic in `<script id="shared-code">`; `test.mjs` extracts and runs `CupTests`.

- **`GEO` / `makeGeometry(overrides)`** — derived radii, areas, volumes, path stations (`s` and `z` for surface, holes, annulus, crest, tube, outlet).
- **`CupModel`** — `constructor(geo, opts)`, `step(dt, {pouring})`, `snapshot()` / `restore()`, `setCrest(h)`, `setBore(d)`, `pressureAt(station)`, `pressureProfile()`, `flowOut()`, `fairShareVolume()`.
- **`CupTests`** — registry with `add(name, fn)` and `run()` returning a boolean (repo pattern).
- **DOM script** — stage renderer, tour controller, free-play controls, readouts, chart, particle pool, main loop. Exposes `window.__shot(stepOrPhase)` for headless screenshots (drives the model synchronously and renders one frame).

## Testing (`test.mjs`, Node, no deps)

1. Communicating vessels: pour to `h = 3`, annulus level equals `h`, flow out is 0, phase `filling`.
2. Stop below the crest: pour to `H_c − 0.2`, stop, run 10 s — nothing changes.
3. Crossing the crest primes the siphon within 3 s of `h > H_c`.
4. Torricelli: in `siphon` with pouring off, `flowOut()` equals `C_d A √(2g(h − z_out))`.
5. The siphon keeps running with `h` well below `H_c`.
6. It drains to the residual film and ends in `empty`; `drained ≈ poured − residual`.
7. Conservation at every step: `poured − drained − spilled − (bowl + annulus + tube volumes) = 0` within 1e-6.
8. Pressure: static `p(holes) = h`; in `siphon` `p(crest) < 0` and `p(outlet) = 0`.
9. Air break: once `h < z_holeTop` the phase goes `breaking → empty` and channel levels fall to the bowl level.
10. Rim overflow: pouring far above the siphon rate pins `h` at the rim and accumulates `spilled`.
11. Fair-share volume increases monotonically with crest height; `setBore` changes the drain rate as `d²`.
12. Determinism: two models fed the same input sequence produce identical states.

## Honest simplifications (stated on the page, in the tour step 5 card and a footnote)

- The slug that primes the tube is modelled as filling the bore from the crest at the weir rate; real priming depends on bore diameter, wetting and surface tension.
- Losses are lumped in one discharge coefficient and spread evenly along the path.
- Surface waves, droplets and bubbles are decoration.

## Out of scope

- 3-D rendering; the cutaway plus plan-view inset is the chosen explanation device.
- Multiple cup designs (some antique cups route the tube through a handle); one canonical concentric design only.
- Touch-specific layout work beyond what the flex layout already gives.
