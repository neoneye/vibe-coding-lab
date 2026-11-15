# Snake skin generator — short design

**Intent.** A standalone page, `snake-skin/index.html`, that generates snake skin textures with
many parameters. The owner's references (`~/Desktop/snake`) show: python diamonds drawn one scale
at a time, a diamondback net on cream, a reticulated zigzag with iridescence, plain grey leather,
glossy black leather with wide belly scales, amber scales with dark edges, flattened tanned hides
with pale skin between irregular blotches, a dyed pink hide, and coppery bead-like scales.

**Approaches considered.**
1. *Scale lattice plus a separate pattern field, in a WebGL2 shader (chosen).* Overlapping
   superellipse scales on a staggered grid, front row wins; a pattern field coloured as blotch,
   outline, halo, ground, sampled at each scale's centre. Instant, a slider per feature, tiles,
   exports at any size. Shares the two-pass layout of `rusty-metal`.
2. *Reaction–diffusion pattern (Murray-style) under the same scales.* Closer to how patterns
   form, but slow to converge, hard to steer to a given look, and awkward to tile and export at
   4096. Rejected for a "lots of parameters" generator; noted in the page's honesty panel.
3. *Photo-based synthesis from the references.* Rejected: stock photos, not ours to reuse.

**Design.**
- Pass 1 writes albedo + gloss and height + pattern class + iridescence phase; pass 2 lights it
  or shows a map (albedo, height, normal, pattern mask).
- Groups: scales, relief, belly, pattern, pattern colours, spots and flecks, scale finish, light
  and grade.
- Whole-number lattice counts and noise frequencies so the tile wraps; rows kept even for the
  stagger; 1×1 / 2×2 view; PNG export to 4096.
- Presets after the reference looks plus coral bands, garter stripes and an emerald skin; seed,
  randomise, share link, honesty panel.
- Parameter table and presets in a `shared-code` block, tested by `test.mjs`.

**Left to the builder.** Default values and presets, tuned by eye against the references.
