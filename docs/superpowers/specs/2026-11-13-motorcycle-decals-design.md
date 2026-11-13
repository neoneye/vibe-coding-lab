# Motorcycle decal designer — design

Date: 2026-11-13. Directory: `motorcycle-decals/`. One self-contained `index.html` (three.js from jsdelivr) plus `test.mjs`.

## Intent

A design tool for motorcycle artwork: stripes, flames, arrows and more on a 3D sport bike that can be orbited. The page proposes complete liveries; every proposal can then be tuned through many parameters. Output is a picture of the bike and a flat decal sheet.

## Decided by the owner

- 3D model view.
- Sport bikes only.
- Proposals as a gallery of thumbnails; click to load, "More" to reroll.
- Output: PNG of the bike and a decal sheet.
- Approach A below.

## Approaches

- **A. Side-projected livery (picked).** Body panels are lofted strips between a top and a bottom side-view curve. Artwork is vector, defined in a side-view template in millimetres, and projected onto the panels; left and right halves are mirrored, with text un-mirrored on the left. The same vectors clipped per panel form the decal sheet. Trade-off: stretch where a panel curves away from the side (nose front, tank top).
- B. Unwrapped panels: true-size decals, but far more work per bike and stripes across panels are hard to align.
- C. Decals projected onto the mesh: free placement but no flat sheet.

## My calls

- Five unbranded bikes from one parametric builder: supersport, hypersport, 90s superbike, 80s endurance racer, lightweight.
- Six paintable panels: nose, side fairing, tank, tail, front fender, belly pan. Each has a tile in a 2048² texture atlas; that atlas layout is also the basis of the sheet.
- Layer types: colour block, stripes, flames, arrows, chequer, halftone dots, pinstripe outline, race number, text, emblem. Layers stack, reorder, and target chosen panels.
- Twelve colour themes of five slots (primary, secondary, accent, dark, light); layers refer to slots so a theme change recolours the design.
- Twelve proposal styles, rule-based and seeded, placed from each bike's own panel anchors; each bike lists the styles that suit it first.
- Trim (rims, rim tape, frame, forks, seat, screen, backdrop) and paint finish (gloss, metallic, clearcoat, pearl).
- Double-click on the bike moves the selected layer there.
- Export: bike PNG rendered at 2400×1500 from a camera refitted to centre the bike; decal sheet as SVG in millimetres and as PNG.

## Non-goals

No real brand logos, no pricing, no riding, no share links.
