# Shell generator

A standalone page that generates sea shells, snail shells and horns in 3D, with
a pattern grown at the lip. Open `index.html` in a browser. The 3D view loads
three.js from cdn.jsdelivr.net; everything else is in the one file.

## Form

David Raup's coiling model: a generating curve (the outline of the aperture) is
swept round a coiling axis while it grows by a constant factor per turn.

- **W**, whorl expansion: the size ratio of the curve after one full turn.
- **D**, distance from the axis: inner margin / outer margin of the curve.
- **T**, translation: movement along the axis per unit of movement away from it.
- **S**, the shape of the curve: here a superellipse with aspect, squareness,
  egg and tilt.

Ribs, cords, knobs/spines, lip flare and wall thickness are displacements added
on top and are not part of Raup's model.

## Pattern

Pigment is laid down only at the growing lip, so the pattern is a space-time
diagram: columns are cells along the lip, rows are time steps (Meinhardt). The
texture is built exactly that way by one of three engines:

- **Cellular automaton**: any elementary rule 0-255, with first-row, noise and
  asynchronous-update controls. Rule 30 gives the textile cone.
- **Activator-inhibitor**: Meinhardt's reaction with saturation. Recipes for
  stripes, rings, chevrons and tents.
- **Bands and flames**: drawn, not grown.

Finishing controls (drift, mirror, smoothing, threshold, contrast, late onset,
mottle), a spiral band mask, and colour, gloss, nacre and wear apply to all.

## Other things on the page

Presets, seed, random form / random pattern, a morphospace plot (click to set W
and T), the pattern unrolled as a strip, PNG export of the shell (square, the
shell centred, optional transparent background) and of the pattern, and a share
link.

URL parameters for screenshots: `?preset=Nautilus`, `?bare` (3D view only),
`?still` (show the first frame as an image, for tools that cannot capture a
WebGL canvas).

## Tests

    node test.mjs

The engine is in the `shared-code` script block. The tests check Raup's
definitions of W, D and T against the mesh, the mesh's normals and winding,
Rule 30 and Rule 90 against known rows, and that every preset builds.
