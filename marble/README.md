# Marble generator

A standalone page that generates marble textures, with a slider for every
feature. Open `index.html` in a browser; nothing is loaded from the network.
It needs WebGL2.

## How it works

Everything is laid out in a flow frame: coordinates across and along the
direction the rock flowed, after the tile has been bent by a smooth noise
(bend, turbulence) and optionally folded into waves.

- Ground: two colours mixed by cloudy noise, streaks stretched along the
  flow, and an optional patina.
- Main veins: one slot per band across the flow, some empty. Each vein has its
  own position, width, wander and pinch-and-swell along its length, a cloudy
  streaked halo, dark edge lines (or one sharp and one feathered side), parallel
  strands and fibres.
- Vein network, hairline cracks and accent veins: the borders of stretched,
  wriggled Voronoi cells, of which only a share is filled, so veins branch and
  end in T junctions. Coverage noise gathers them into zones.
- Breccia: Voronoi clasts with rough outlines in a matrix that widens towards
  the middle of a broken zone until the clasts become islands; finer cracks
  inside the clasts.
- Pores (stretched along the layers, in clusters), crystal grain and specks.
- Tiles: a grid cut from the block as continuous, random cuts, bookmatched
  pairs or one cut turned, with joints, bevels and tone differences.

Pass 1 writes colour and gloss, and height and a vein mask. Pass 2 lights the
height map (normal, crevice shadow, highlight, optional window reflection) or
shows one of the maps.

With Seamless on, frequencies are whole numbers per tile and the veins run
level or upright, so the tile wraps. A slanted flow could only wrap with a
whole-number direction such as (2,1), and noise read in that frame repeats
|a|² times inside the tile, so slanted flows are left non-repeating.

## Controls

Flow and folding, ground, main veins, vein network, hairline cracks, accent
veins, breccia, pores/grain/specks, tiles, finish, light and grade: 119
parameters. Eleven presets (Calacatta, Statuario, Carrara, Paonazzo, Verde,
Green wall, Nero, Perla, Ivory, Travertine, Rosa), seed, randomise, 1x1 / 2x2
view, share link, and PNG export (1024 to 4096) of whichever map is showing:
lit, colour, height, normal or vein mask.

URL parameters for screenshots: `?preset=Verde`, `?bare` (texture only),
`?view=normal`, `?tile=2`, `?still` (show the first frame as an image, for tools
that cannot capture a WebGL canvas). Settings can also go in the hash, as the
share link does: `#preset=Calacatta&seamless=1&angle=0`.

## Tests

`node test.mjs` checks the parameter table, that every shader uniform is a
parameter and the other way round, the flow frame and seamless snapping, and
that presets survive sanitising.
