# Paper shredder: design

Approved by the owner on 2026-11-25 ("Yes, build it").

## Intent

A faithful, educational page showing how a paper shredder cuts. The owner uploads an image, it is shredded, and
the paper and the machine can be changed through many parameters. Not a game. Reassembling the shreds is a
possible later direction and is out of scope, but the data must not rule it out.

## How real shredders work (shapes the model)

Two counter-rotating shafts of interleaved discs slit the sheet into strips; strip width is the disc thickness.
In a cross-cut machine the same discs carry hooked teeth that also chop each strip to length, staggered from disc
to disc, so one pass gives particles. There is no separate horizontal cutter. "Passes" are not a machine feature;
re-feeding the output (optionally turned 90°) is a real practice and is offered as an option.

## Approaches

1. **2D top-down table (chosen).** Sheet feeds down into a cutter bar, pieces land spread out on an output tray.
   Every piece stays readable, which is what reassembly needs later.
2. 2D front view with a bin. Faithful to the machine, but one sheet makes a 2 mm layer and 99 % of the pieces
   are hidden.
3. 3D with rigid bodies. Looks good, but 12,000 micro-cut particles are out of reach and pieces are hard to read.

## Design

- `paper-shredder/index.html`, self-contained. Pure logic in a `shared-code` block with `test.mjs`.
- **Geometry:** every piece is a convex polygon in sheet millimetres, cut by half-plane clipping against the
  cutter grid (strip bands, staggered slanted cross cuts). Each edge is tagged (sheet edge, slit, cross cut,
  tear). Passes re-clip the previous pieces under a new placement. Pieces keep their sheet coordinates, so the
  true position of every piece is known.
- **Rendering:** WebGL2 textured meshes for the pieces (ragged fibre edges and fringe in the shader, curl and
  twist for long strips), 2D canvases for the tray below and the cutter housing above.
- **Machine parameters:** type and DIN 66399 presets P-1 to P-7, strip width, particle length, tooth stagger, cut
  slant, blade wear, clearance, oil, motor power, feed speed, throat, sheets at once, skew, passes and re-feed
  orientation, bin size.
- **Paper parameters:** presets, grammage, thickness, fibre length, grain direction, moisture, laminate film,
  curl, colour, single or double sided.
- **Effects:** rougher edges with wear, moisture and against the grain; cross cuts that fail and leave joined
  particles; wet strips that tear and clump; laminate that loads the motor; slow-down and jam above capacity with
  auto-reverse.
- **Readouts:** piece count and sizes, DIN level, motor load and sheet capacity, bin fill, share of pieces with
  visible content, a rule-of-thumb recoverability rating.
- **Extras:** side and top cutaway of the cutting head, enlarged specimen particles with a ruler, a "put it back"
  toggle that uses the known answer, Save image.

## Calls made by the builder (not owner decisions)

- The motor load model is calibrated to typical rated sheet capacities, not derived from fracture mechanics. The
  page says so.
- Landing positions are drawn from a distribution and animated, not simulated as rigid bodies.
- With many sheets at once, only as many sheets as fit a piece budget are drawn; load and bin fill use all.
