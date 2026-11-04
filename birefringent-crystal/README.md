# Birefringent Crystal

A ray-traced calcite (Iceland spar) crystal lying on paper. Everything underneath shows up twice. Below the
simulation is a plain-language explanation of why, with a live Huygens-wavelet diagram.

- **Crystal:** a natural cleavage rhomb (true 101.92° calcite geometry, slanted sides) or a cut rectangular
  block. You can set length, width, thickness, rotation and position, and you can drag the crystal around.
  The optic axis tilt and turn can be overridden. "Natural optic axis" restores 44.6°.
- **Material:** calcite, quartz, rutile, sodium nitrate, ice and glass (the control: no doubling), or custom
  nₒ/nₑ. Also dispersion (colour fringes, can be exaggerated), amber tint, frosted sides and reflections.
- **Underneath:** word + line (like the classic photo), text, newspaper column, graph paper, lines at four
  angles, pencil, single dot, dot grid, checkerboard, target/Siemens star, colour chart, or your own image.
  You can change the text, font, paper size, rotation, offset and the ink, paper and table colours.
- **Polarizer:** look through a polarizing filter and turn it (Malus's law). One image fades while the
  other strengthens.
- **Second crystal:** stack another crystal on top, turned relative to the first, with its own thickness and
  optionally a half-wave plate or a polarization rotator in between. Preset buttons show the classic
  experiments: same way round → 2 images, turned 180° → 1, turned 45° → 4 in a parallelogram, and same way
  round with a half-wave plate at 22.5° → 3 in a row at ¼, ½, ¼.
- **Display:** show both images, ordinary only or extraordinary only, colour-code them (o red, e blue),
  spin the crystal, adjust the light, and turn 4× smoothing on or off.

Drag to orbit, drag the crystal to move it, scroll to zoom, and press Q/E to rotate.

## How it renders

A WebGL2 fragment shader traces one ray per pixel (four with smoothing). At the crystal surface the
ordinary ray follows Snell's law. For the extraordinary ray, the tangential wave vector stays the same and
the normal component solves the index ellipsoid `k∥²/nₒ² + k⊥²/nₑ² = 1`. The ray then walks off along the
energy direction `k/nₑ² + (k·a)a(1/nₒ² − 1/nₑ²)`. Rays that reach the bottom face read the paper directly.
Rays that hit a side face either refract out or reflect totally and keep going. The page renders on
demand, not every frame.

With a second crystal, a beam that leaves one crystal through the thin gap is traced into the other and split
again. Each part is weighted by Malus's law, cos² of the angle between the arriving polarization (after the
optional plate) and the second crystal's ordinary polarization. That makes up to 4 light paths per pixel and
colour channel. Paths that land on the same spot add in brightness, because their polarizations are crossed.
With both stacking and dispersion on, smoothing drops to one sample per pixel.

## Tests

    node test.mjs

The tests run the physics core from `<script id="physics-core">`. They cover:

- the rhomb geometry (optic axis 44.6° from the face)
- the walk-off formula (6.23° for calcite)
- vector refraction against the formula and the Huygens construction
- the parallel-slab check
- a ray traced through the rhomb (shift = thickness · tan ρ along the axis direction)
- two stacked crystals: same way round (2 images, double shift), turned 180° (1 image), turned 45° (4 equal
  images in a parallelogram), a half-wave plate at 22.5° (3 images in a row at ¼, ½, ¼), rotators, cos² weights
  and conservation of light for slanted views

## Not modelled

Partial internal reflections (only total ones), caustics on the paper, optical activity, and biaxial
crystals. The plate between stacked crystals is idealised: it has no thickness and works the same for every
colour. A ray passes through each crystal at most once.
