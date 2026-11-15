# Snake skin generator

A standalone page that generates snake skin textures, with a slider for every
feature. Open `index.html` in a browser; nothing is loaded from the network.
It needs WebGL2.

## How it works

Scales and pattern are built separately, as they are on the animal.

Scales: a staggered lattice. Each scale is a superellipse with a base and a
free tip, optionally tapered. The row nearer the head lies over the row behind
it, so for every pixel the rows are tried from the head end and the first scale
that covers the pixel wins. What no scale covers is the skin between scales. A
band of wide belly scales can replace part of the lattice.

Pattern: a field over the whole tile that is below 1 inside a blotch or band
and rises outwards; it is coloured as blotch (with an optional middle), dark
outline, pale halo, then ground. Blotches are a lattice of superellipses with
scatter; bands can run across, along or diagonally and can zigzag; marbling is
a thresholded noise. Each scale looks the pattern up at its own centre, so the
pattern comes out in scale-sized steps. A second layer of spots and random
single-scale flecks go on top.

Pass 1 writes colour and gloss, and height, the pattern class and an
iridescence phase. Pass 2 lights the height map (normal, crevice shadow,
highlight, iridescence, wetness) or shows one of the maps. Lattice counts and
noise frequencies are whole numbers, so the tile wraps.

## Controls

Scales, relief, belly, pattern, pattern colours, spots and flecks, scale finish,
light and grade: 100 parameters. Presets, seed, randomise, 1x1 / 2x2 view, share
link, and PNG export (1024 to 4096) of whichever map is showing: lit, colour,
height, normal or pattern mask.

URL parameters for screenshots: `?preset=Coral%20bands`, `?bare` (texture only),
`?view=normal`, `?tile=2`, `?still` (show the first frame as an image, for tools
that cannot capture a WebGL canvas).

## Tests

    node test.mjs

The parameter table, presets and shader sources are in the `shared-code` script
block. The tests check the table, that every shader uniform is a real parameter
and every parameter reaches a shader, and the presets. The shaders themselves
are checked in the browser.
