# Sewing Factory — design

Date: 2026-11-25. Directory: `sewing-factory/` (single self-contained `index.html`, three.js from CDN like `queen-clothing/`, plus `test.mjs`, `README.md`, `screenshot1.jpg`).

## Intent

The owner asked for a page that "shows how industrial sewing machines work" and "how pieces of material get assembled into a full piece of clothing". The viewer sets a mannequin's measurements, picks a garment and a fabric, sees the cut pieces, can change the fabric of individual pieces, and watches the pieces being sewn into the garment.

It is an explainer, in the style of the repo's other educational pages. Per the repo rules it stays a faithful, educational simulation: no scores, no game mechanics.

## Goals

- A measured mannequin: changing a measurement reshapes the body **and** the pattern pieces.
- Six garments: jeans, shorts, shirt, dress, one-piece swimsuit, bikini.
- Fabrics: zebra, leopard, denim, spandex (solid, colour picker), polka dots, plus cheap extras (plain cotton, gingham, pinstripe). Fabric can be set for the whole garment or per piece.
- The cut pieces shown flat on a cutting table before assembly, with grain lines, seam allowance and names.
- Assembly shown as a real factory operation list: each seam is done by the machine type a factory would use, and that machine's stitch formation is shown in a close-up.
- Finished garment on the mannequin, with a clean centred PNG export.

## Non-goals

- Cloth physics. Garments are parametric surfaces, as in `queen-clothing/`.
- A production pattern-making tool. Pieces are plausible blocks, not graded industry patterns; no darts, facings, linings, interfacing or fly/zip construction (these are named in notes where a real factory would do them).
- Mechanically exact machine timing. Motions are schematic and slowed; the page says so.
- Buttons, zips, rivets as modelled operations (drawn as small details at most, mentioned in notes).

## Anti-goals

- Machines assigned to seams where no factory would use them (the whole point of the chosen approach).
- Stitch diagrams with wrong thread topology. Each stitch class must show the right number of threads and where each lies (top, bottom, round the edge).
- A page where the garment is the star and the machines are a footnote.

## Constraints

- One HTML file; works from `file://`; three.js via CDN import map as the sibling pages do.
- Pure logic (body, drafting, operations, stitch paths, fabric tiles) in a `<script id="shared-code">` block with a test runner; `test.mjs` runs it in Node.
- Retina-aware canvases. Layout checked in Chromium and Firefox. No overlapping labels.
- Added to `index.html` gallery (via `build_gallery.py`) and `README.md`.
- British spelling in page text, as in the sibling pages.

## Approaches

1. **Factory line (chosen by the owner).** Every seam goes to the machine a factory would use; a close-up shows that machine forming its stitch. Shows why denim and spandex are sewn differently. Each machine gets less depth.
2. **One lockstitch machine in depth.** Clearer single mechanism, but untrue to how jeans or swimwear are made. Rejected by the owner's pick.
3. **Garment-only assembly, machines as text labels.** Cheapest, but fails the first sentence of the request. Not offered.

## Design (builder's calls unless marked "owner")

### Four stages, one scene

A stepper across the top: **1 Measure → 2 Cut → 3 Sew → 4 Finished**. One three.js scene holds a mannequin on a stand and a cutting table beside it; the camera moves between them. The same piece meshes are used throughout and morph between three placements: flat on the table, flat and floating around the mannequin ("exploded"), and worn.

Layout: control panel on the left, 3D view filling the rest. In the Sew stage the view splits: assembly view and machine close-up side by side (stacked on narrow screens), with the operation list in the panel.

### Mannequin (owner: adjustable dimensions)

Abstract matte dress-form figure with head, arms in an A-pose and legs. Sliders in cm: height, chest/bust, waist, hip, shoulder width, inseam, arm length. Two starting presets (women's form, men's form). Torso cross-sections are solved numerically so the tape girth at chest, waist and hip equals the slider value. Stage 1 draws tape rings with their cm values.

### Pieces: one definition, flat and worn

Each garment surface is a set of *charts* over the body (torso, each side of the lower body with a crotch blend, each arm, skirt cone, collar), each a function (angle, height) → 3D point, equal to the body plus ease or a garment silhouette (hanging shirt, straight/flared leg, A-line skirt).

A piece is a four-sided region of a chart, given by four boundary curves. Its 3D shape is the chart surface over that region. Its flat pattern is the same region *unrolled*: horizontal position is arc length around the chart from the piece's grain line, vertical position is length along the grain line. So widths at every height equal the real girth fraction plus ease, and crotch curves, armholes and sleeve caps come out of the body rather than being drawn by hand. Stretch fabrics get negative ease: the flat piece is cut narrower than the body by a stated percentage.

Seams between different charts (sleeve cap to armhole, collar to neckline) are welded in 3D by snapping the edge and fading the correction into the piece. Thin parts (ties, straps, belt loops) are ribbons: a flat rectangle and a 3D band along a polyline.

Texture coordinates are the flat coordinates, so a print follows the grain, does not stretch when worn, and mismatches at seams as real cloth does.

Pieces per garment (approximate):
- Jeans: front ×2, back ×2, yoke ×2, waistband, back pocket ×2, belt loops.
- Shorts: front ×2, back ×2, waistband.
- Shirt: front ×2, back, yoke, sleeve ×2, cuff ×2, collar, chest pocket.
- Dress: bodice front, bodice back, skirt front, skirt back, straps or cap of the bodice as drafted.
- Swimsuit: front, back, gusset.
- Bikini: cup ×2, band, ties, bottom front, bottom back.

Two or three fit sliders per garment (e.g. leg length and flare, sleeve length, skirt length and flare, ease).

### Cut stage

Pieces lie on the table in a simple marker layout on a fixed cloth width, each with stitch line, cut line (seam allowance), grain arrow and name. The panel shows marker length and efficiency (piece area ÷ cloth used). Clicking a piece selects it; the fabric swatches then apply to that piece ("apply to all" resets). A note appears when a fabric suits the garment badly (e.g. denim swimsuit: no stretch) — information only, never blocked.

### Fabrics

The owner handed the fabric list to the builder ("there may be more fabrics that make better sense, I'm not a domain expert"). Builder's call: split the choice in two, as the trade does, because zebra or polka dots are a *print* and denim or spandex are a *cloth*.

- **Cloth** (structure, weight, stretch, sheen; drawn as a weave or knit micro-texture): denim (3/1 twill, indigo warp, pale weft), stretch denim, chino twill, cotton poplin, oxford, linen, flannel, satin, viscose crepe, cotton jersey (knit), swim tricot (nylon/elastane knit — the "spandex" of the request).
- **Print or colour** (laid over the cloth): solid (colour picker), zebra, leopard, polka dots, stripes, gingham check, floral, camouflage.

Each garment lists the cloths a factory would normally use first and opens on a typical one (jeans: denim; shorts: chino twill; shirt: poplin; dress: viscose crepe; swimsuit and bikini: swim tricot). The other cloths stay selectable under "unusual for this garment" and raise the note. Any print goes on any cloth. Both cloth and print can be set for the whole garment or per piece.

Tiling canvas textures are generated in-page. Zebra and leopard reuse the CPU procedural tile code from `zebra-pattern/` and `leopard-pattern/` (ported, trimmed to one preset each, recolourable). Each cloth carries: woven or knit, stretch %, weight, and a default thread colour.

### Sew stage: operation list and machines

Each garment has an ordered operation list in factory order. An operation names its pieces, the seam edges, the machine, the stitch class (ISO 4915 number) and a one-line reason. Playing an operation: the pieces involved move to their worn place on the form, the seam is highlighted, the machine close-up runs, and the stitch line is drawn along the seam. Controls: play/pause, step, speed, jump to any operation. A note states that a real factory sews flat at the machine, not on a form.

Machines (four mechanism families, seven uses):

| Machine | Stitch | Used for |
|---|---|---|
| Single-needle lockstitch (rotary hook, bobbin) | 301 | topstitching, pockets, collars, cuffs, woven seams, hems |
| Zigzag lockstitch (swinging needle bar) | 304 | elastic on swimwear |
| Bartacker (lockstitch, moving clamp) | 301/304 pattern | belt loops, pocket corners, strap ends |
| Twin-needle feed-off-the-arm chainstitch with folder | 2 × 401 | lap-felled jeans seams (yoke, seat, inseam) |
| Overlock, 3- and 4-thread (two loopers, knife) | 504 / 514 | edge finishing, knit and swimwear seams |
| 5-thread safety stitch | 516 (401 + 504) | jeans outseam, shirt side seams |
| Coverstitch (two needles, one looper) | 406 | swimwear and knit hems |

Close-up: a procedural 3D machine head with moving needle bar, presser foot, four-motion feed dogs, take-up lever, and under the plate the hook and bobbin or the loopers; overlock adds the knife. Two plies of the actual fabric texture feed through. Formed stitches are 3D thread tubes with the correct topology for the class, each thread a different teaching colour (toggle to real thread colour). Live thread loops follow guide points on the moving parts. Controls: slow motion, phase-by-phase step with a caption for each phase, cutaway (hide plate and bed), see-through fabric, view from below.

### Finished stage

Garment on the mannequin, orbit camera, turntable toggle, thread colour, "Save image" (rendered off-screen at a fixed size with the figure centred, no panel offset).

### Honesty panel

Lists what is simplified: schematic machine timing, enlarged thread, no cloth physics, simplified blocks, omitted operations (fly, zip, buttons, rivets, interfacing), assembly shown on a form.

### Tests (`test.mjs`)

- Body girths match the measurement sliders within 0.5 cm across the slider ranges.
- Every garment at default and extreme measurements: all pieces have positive area and finite coordinates; every piece is used by at least one operation; every operation references existing pieces and edges and a known machine.
- Seam walk: the two flat edges joined by an operation match in length within a stated tolerance.
- Stitch generators: right thread count per class, finite paths, one repeat per stitch length.
- Fabric tiles wrap (left edge equals right edge, top equals bottom).

## Calls settled after the builder check (builder's calls)

- **Fabric changes the look, not the construction.** Ease and the operation list are fixed per garment: swimsuit and bikini are drafted with negative ease and sewn with stretch stitches whatever fabric is chosen; jeans, shorts, shirt and dress are drafted with positive ease. A poorly suited fabric only raises the note. Texture coordinates are the flat cut coordinates, so on negative-ease garments the print is stretched when worn, as it would be; on the others it is not.
- **Seam cross-sections in the close-up are correct per seam type**, from four ply profiles: superimposed (two flat plies), lap-felled (two interlocked folds, with the folder shown), hem (one ply folded), and elastic application (ply plus elastic strip).
- **The women's form has a modelled bust**, included in the girth solve. All six garments are offered on both forms with the same drafting code; no darts, so woven bodices are drafted with enough ease to clear the bust.

## Zips and buttons (owner, 2026-11-25: "I want zippers and buttons")

Closures are modelled, visible on the garment, and are operations in the list with their own machines:

- **Jeans and shorts:** a zip fly at the centre front (zip tape set with the lockstitch machine and a zipper foot, J-shaped fly topstitch), a keyhole buttonhole and a tack button on the waistband. The tack button is pressed on, not sewn, and the operation says so.
- **Shirt:** buttons and buttonholes down the front placket and on the cuffs.
- **Dress:** a zip in the centre-back seam.
- **Swimsuit and bikini:** none (the bikini ties are the closure).

Added machines: **buttonhole machine** (304 zigzag lockstitch bead round a slot, then a knife cuts the slot) and **button sewer** (101 single-thread chainstitch through the button's holes, moving clamp). Both reuse existing mechanism families (lockstitch rig; chainstitch rig with one looper). The zip is a toothed chain between two tapes with a slider; buttons are small discs with holes.

This replaces the earlier non-goal that left zips and buttons out. Rivets and interfacing stay as notes only.

## Left to the builder

Exact body proportions, piece boundary curves, ease values, operation wording, machine part shapes and phase timing, colours, camera positions, URL params for review screenshots, marker packing rule.
