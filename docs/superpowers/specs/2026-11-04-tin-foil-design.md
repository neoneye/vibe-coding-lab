# Tin foil — design notes

Date: 2026-11-04. Directory: `tin-foil/` (single `index.html` + `test.mjs` + `screenshot1.jpg`).

## What the owner asked for

A tin-foil simulator: text written *behind* the foil, text *pressed into* the foil, and one or more
lamps that can be moved around, with real light sources rather than RGB colours (sodium, halogen,
LED, light bulb). The owner loves foil that is not flat, with curls and patterns, and noted that foil
is used for wrapping chocolate. The references in `~/Desktop/tin-foil/` show crumpled kitchen foil,
gold-wrapped chocolate coins, a foil-wrapped chocolate bar, an embossed snowflake roll, tin-foil-art
cards (string drawings under foil), a debossed silver stamp and stamped metal plates.

The owner left with "make some good decisions and go ahead". Everything below except the four
requests above is my call.

## Decisions

- **2.5D heightfield, seen through a perspective camera.** A sheet 24 × 16 cm on a table. The foil is
  a height map; the page ray-casts it (with a few parallax steps), so highlights move correctly as
  lamps move and the view tilts.
- **Crumple model:** the lower envelope of random paraboloid-planes per Voronoi cell, several octaves
  with alternating sign. It gives flat facets meeting in sharp ridges and valleys, which is what
  crumpled foil is (it barely stretches, so it folds).
- **Things under the foil** are drawn as a height map (letters, chocolate-bar squares, coins with rim
  and lettering, string drawings as in tin-foil art). The foil *drapes* over them: a wide blur where
  it is loose, the backing itself where it is tight. Burnishing (rubbing) pulls it tight and flattens
  crumples locally, so rubbing reveals what is underneath, as with a pencil rubbing.
- **Pressed-in text** is debossed, and the pressed area is flattened (pressing irons out crinkles), so
  pressed letters read as mirror-smooth grooves. The stylus tool presses freehand lines.
- **Embossed patterns** from the roll: snowflakes, quilted diamonds, dots, curls (spiral scrolls) and
  hammered dimples.
- **Spectral lighting.** Lamps use the spectra already shared by the spectroscopy playground and the
  optical bench (sodium low/high pressure, mercury, fluorescent, LED) plus blackbody halogen, bulb and
  candle, an RGB LED with three channels, and a single-wavelength laser. Foil reflectance is a
  spectrum too: aluminium, real gold and copper (fitted roughly to published optical constants), and
  coloured chocolate foils as aluminium under a transparent lacquer (filter × aluminium, plus the
  lacquer's own clear-coat reflection). Each lamp × foil pair is integrated against the CIE 1931
  colour-matching functions on the CPU; the shader only gets RGB per lamp. This is what makes
  "under a low-pressure sodium lamp gold foil and silver foil look the same" come out on its own.
- **Kitchen foil has two sides:** shiny and matte (the matte side touched the other sheet in the
  final rolling pass). Both are anisotropic along the rolling direction.
- **Room light:** the lamps also light the room, and the foil reflects that room (brighter towards
  each lamp, dark straight up where the camera is). Without it foil reads as black with glints.
- **White balance:** none (show sodium as orange) or adapt to lamp 1 (Bradford), like a camera.
- **Faithful, not a game.** No scores. Presets show scenes from the references.

## Left out

- Real cloth/sheet mechanics (no folding simulation; crumple is procedural).
- Interreflection between facets; the room term stands in for it.
- Tin itself: modern "tin foil" is aluminium. The prose explains the name.
