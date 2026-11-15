# Zebra pattern generator

A standalone page that generates zebra stripes, with a slider for every feature
of them. Sister of [leopard-pattern](../leopard-pattern/). Open `index.html` in
a browser; nothing is loaded from the network.

## Two modes

- **Procedural (instant).** Stripes are where the phase of a wave is near a
  crest. Smooth noise bends the phase. Multiplying the wave by a complex noise
  `1 + f·(N₁ + iN₂)` makes it pass through zero at isolated points; the phase
  winds once round each, which is a stripe fork or a stripe end. The size of
  that factor pinches stripes to points there.
- **Turing growth.** Barrio's reaction–diffusion model, as on the leopard page,
  with the quadratic term `r₂` at zero so that it makes stripes, and with the
  activator diffusing faster along one direction so that the stripes line up.
  It runs as a WebGL2 shader; a plain-JS copy is the test reference and the
  fallback.

Both modes feed one renderer, so stripe width, shadow stripes, edges, hair and
coat colour work the same in each.

## Parameters

| Group | Sliders |
|---|---|
| Layout | stripes per tile, direction |
| Stripe width | black share, width variation and its scale |
| Waves | waviness, bend scale, wobble, wobble scale |
| Forks and ends | forks, fork spacing, fork stretch, taper (negative tapers the white), breaks, break scale |
| Flow over the body | arch, S-bend, spacing drift, converge, fade out |
| Shadow stripes | strength, width, patchiness |
| Edges and hair | softness, roughness, hair fineness, length and direction |
| Coat | five colours, fur shading, sheen, two tints and their scale, speckle |
| Turing | D, δ, α, β, r₂, r₃, anisotropy, direction, contrast |

Also: seven presets, a seed, Randomise, a 1 × 1 / 2 × 2 / 3 × 3 seam view,
PNG export at 512–4096 px (rendered afresh at that size), and a link that
reopens the page with the same settings. Click a slider's value to return it
to the preset's value.

## What is the page's own

The procedural mode is a way of drawing, not a model of an embryo. The presets
are drawn by eye. Using Barrio's model for a zebra, the form and size of the
anisotropy, and when to stop the growth are this page's choices. The page's
own panel lists these next to what comes from the literature (Turing 1952;
Bard 1977; Barrio et al. 1999; Shoji et al. 2002; Liu, Liaw & Maini 2006).
The zebra facts and citations were written from memory and not re-checked.

## Tests

```
node test.mjs
```

About 3 seconds. They check the whole-number wave vector, the stripe count and
black share of plain stripes, that the tile and the hair noise wrap, that fork
noise creates dislocations in ± pairs, that breaks, taper and fade remove
black, seeds, every preset, the dispersion peak (k = 0.27 at δ = 6) and that
anisotropy combs the Turing stripes along the fast direction.
