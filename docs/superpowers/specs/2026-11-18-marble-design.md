# Marble generator — short design

**Intent.** A standalone page, `marble/index.html`, that generates marble patterns with many
parameters. The owner's references (`~/Desktop/marble`) show: Calacatta (white, broad grey bands
with brown edges, hairlines), Statuario (white islands in a grey breccia net), Paonazzo (cream
clasts in a dark net with gold veins), a dark green serpentine with white veins and rusty
accents, the UN General Assembly's green marble wall laid as tiles, a cream quartz with fine
beige veins, a pale streaky ivory, and a grey travertine with pores.

**Approaches considered.**
1. *Layered noise and Voronoi fields in a flow frame, WebGL2 (chosen).* Instant, a slider per
   feature, exports at any size. Same two-pass layout as `rusty-metal` and `snake-skin`.
2. *Simulating metamorphism (advected dye in a viscous flow).* Truer to the process but slow,
   hard to steer to a named look, and not a "lots of parameters" generator.
3. *Photo-based synthesis.* Rejected: stock photos, not ours to reuse.

**Design.** Ground (clouds, streaks, patina); main veins in slots across the flow with halo,
edge lines, strands and fibres; network, hairline and accent veins as filled borders of
stretched, wriggled Voronoi cells (noise zero lines were tried first: they never branch and
read as contour maps); breccia clasts in a widening matrix; pores, grain, specks; tile layouts.
Seamless is opt-in and keeps the flow level or upright, because a rotated whole-number frame
repeats the pattern |a|² times in the tile.

**Left to the builder.** Default values and presets, tuned by eye against the references.
