# Watercolour Text

Type a title in poster lettering and watch drops of water land on the paint. The water re-wets the pigment,
pushes it outward, wicks along the paper's fibres and frays the edges, and dries with a dark rim where the
pigment piled up. An intro drops water on the letters by itself; click to drop water, drag to trail it. The
look was matched to stills from a film title sequence: dark red capitals on near-black navy.

## How it works

A simplified GPU version of the watercolour model of Curtis, Anderson, Seims, Fleischer and Salesin
("Computer-Generated Watercolor", SIGGRAPH 1997), as five WebGL2 fragment shaders ping-ponging two RGBA32F
textures:

- **drop:** water lands, with a small outward splash.
- **flow:** surface water slides down its own slope and into the paper's hollows, and near the rim of a wet patch it is drawn outward (the coffee-ring flow).
- **advect:** water and the pigment floating in it move between cells by conservative upwind fluxes.
- **paper:** the paper drinks water and wicks it to its neighbours, but only out of cells wetter than both cells' thresholds. Fibres have low thresholds, so the wet front advances in fingers (invasion percolation). Pigment rides along with the wicking water, lifts off wet paper, settles as the water thins, and everything evaporates fastest at a patch's rim.
- **show:** pigment over the ground, darker where it piled up, with the water drawn as a faint lens.

The paper is generated, not stored: noise octaves for its grain and capacity, plus thousands of short curved
strokes for its fibres. `WaterCore` in the `shared-code` block holds the paper generator and the intro's drop
schedule. `node test.mjs` runs their tests. `?selftest` presses every control in the browser.

## Directions to take it further

- **Sync it to music.** Drops could land on the beat, with bigger splashes on accents, in a timed sequence like a real title card.
- **Bake the intro to a fixed seed.** Every replay would then be identical, as a production needs.
- **Use it as a transition.** One title would dissolve into the next as the old paint lifts.
- **Squeeze it.** The core is small: five short fragment shaders and a noise generator, with no meshes or stored assets. It would fit comfortably in a 64k intro.

## Known gap

In the reference stills, fine red tendrils creep out from the letters into the dark background, for example
along the top of the first letter. Here the fraying mostly happens inside the letters and along their
outlines, with dark rims. Getting the tendrils probably needs pigment that sticks to the fibres as it
travels.
