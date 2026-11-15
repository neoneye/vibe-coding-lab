# Rusty metal generator

A standalone page that generates rusty metal textures, with a slider for every
feature. Open `index.html` in a browser; nothing is loaded from the network.
It needs WebGL2.

## How it works

One field, the onset, says when each point of the sheet starts to rust. It is a
fractal noise with head starts added at pinpoint specks, along seams, round
rivets and in scratches, and a delay under intact paint. The age slider sweeps
through it: `x = age - onset`. Coverage is a soft step of `x`; maturity (how
long a point has been rusting) picks the colour, from young orange at the
spreading edge through red-brown to dark old oxide. Runs are the coverage
smeared downwards and broken into trickles.

Pass 1 writes colour and gloss, and height and the rust mask. Pass 2 lights the
height map (normal, crevice shadow, highlight, wetness) or shows one of the
maps. All noise is periodic, so the tile wraps.

## Controls

Corrosion, rust colour, rust relief, bare metal, paint, runs and stains, plates
and rivets, scratches, stencil, light and grade: 89 parameters. Presets, seed,
randomise, 1x1 / 2x2 view, share link, and PNG export (1024 to 4096) of
whichever map is showing: lit, colour, height, normal or rust mask.

URL parameters for screenshots: `?preset=Ship%20hull`, `?bare` (texture only),
`?view=normal`, `?tile=2`, `?still` (show the first frame as an image, for tools
that cannot capture a WebGL canvas).

## Tests

    node test.mjs

The parameter table, presets and shader sources are in the `shared-code` script
block. The tests check the table, that every shader uniform is a real parameter
and every parameter reaches a shader, and the presets. The shaders themselves
are checked in the browser.
