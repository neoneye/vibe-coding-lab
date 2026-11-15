# Shell generator — short design

**Intent.** A standalone page, `shell-generator/index.html`, that generates sea shells, snail
shells and horns in 3D from David Raup's coiling parameters, with many parameters for the pigment
pattern. The owner named W, D, T and Rule 30-like patterns.

**Approaches considered.**
1. *Raup sweep + lip-grown pattern (chosen).* The surface is a generating curve swept round the
   coiling axis while it grows by W per turn. The pattern is a 1D process along the growing lip
   with growth as its time axis (Meinhardt), written into a texture: rows are time, columns are
   positions on the lip. This is how shells make patterns and it gives Rule 30 directly.
2. *2D noise painted on the surface.* Rejected: not how shells work, cannot give Rule 30.
3. *Physical accretion model of the mantle.* Rejected: far more than was asked.

**Design.**
- Engine (no DOM) in a `shared-code` block, tested by `test.mjs`; three.js for the view.
- Form: W (log slider), D, T, plus Raup's fourth parameter S as aperture aspect, squareness,
  egg and tilt; turns, handedness, wall thickness, lip flare.
- Sculpture: axial ribs, spiral cords, knobs/spines, growth lines.
- Pattern engines: elementary cellular automaton (any rule), Meinhardt activator–inhibitor,
  procedural bands and flames. Shared: drift, mirror, smoothing, contrast, band mask, growth
  scaling, colours, wear.
- Presets, seed, randomise, morphospace plot (W against T, D gauge), unrolled pattern strip,
  PNG export from a clean square canvas, share link, honesty panel.
- No game mechanics.

**Left to the builder.** Default values and presets, tuned by eye.
