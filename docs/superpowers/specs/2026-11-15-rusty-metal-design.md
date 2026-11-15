# Rusty metal generator — short design

**Intent.** A standalone page, `rusty-metal/index.html`, that generates rusty metal textures with
many parameters. The owner's references (`~/Desktop/rusty`) show six looks: solid pitted rust,
purple-brown weathered sheet with vertical staining, white paint with rust breaking through and
running down, rust flaking on bare brushed steel, a worn painted stencil on rust, and riveted
overlapping plates.

**Approaches considered.**
1. *Procedural layers in a WebGL2 shader (chosen).* One "onset" field says when each point starts
   to rust; an age slider sweeps through it, so fresh orange sits at spreading edges and dark old
   oxide in the cores. Paint, seams, rivets and scratches shift the onset. Height is built
   alongside colour and lit in a second pass. Instant, every feature has a slider, tiles, exports
   at any size.
2. *Cellular corrosion simulation (Merillou-style).* Faithful growth, but slow, few direct knobs,
   and hard to export at 4096. Rejected for a "lots of parameters" generator.
3. *Photo-based synthesis from the references.* Rejected: stock photos, not ours to reuse.

**Design.**
- Pass 1 writes albedo + gloss and height + rust mask; pass 2 lights it (normal from height,
  ambient occlusion, specular, wetness) or shows a map (albedo, height, normal, mask).
- Groups: corrosion, rust colour, relief, bare metal, paint, runs and stains, plates and rivets,
  scratches, stencil (text, stripes, trefoil, arrow), light and grade.
- Periodic noise so the tile wraps; 1×1 / 2×2 view; PNG export to 4096 of whichever map is shown.
- Presets after the six reference looks, seed, randomise, share link, honesty panel.
- Parameter table and presets in a `shared-code` block, tested by `test.mjs` (the shader itself
  is checked in the browser).

**Left to the builder.** Default values and presets, tuned by eye against the references.
