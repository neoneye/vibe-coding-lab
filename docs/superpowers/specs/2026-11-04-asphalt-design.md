# Asphalt — design notes

Date: 2026-11-04. Directory: `asphalt/` (single `index.html` + `test.mjs` + `screenshot1.jpg`).

## What the owner asked for

An asphalt simulator inspired by the watercolour page: "lay a layer of asphalt, that is this
non-uniform sticky substance, and applying compression that flattens it.. that is an unusual drawing
program". They want to see each layer being applied, with a small degree of interaction where the
user places imperfections. References in `~/Desktop/asphalt/`: fresh overlay with water on it,
close-ups of the texture, hot mix being raked and rolled, a tanker spraying bitumen, chip seal, a
loader dumping a pile. Then: "go ahead and impl. Make some reasonable decisions."

## Decisions (mine)

- **Top-down drawing canvas** of a 2.4 × 1.6 m patch on a crushed-gravel base, plus a **cross-section
  strip** along a cut line the user drags, where every layer shows with its thickness, air voids and
  temperature.
- **State per 5 mm cell**: a stack of up to six layers, each with solids thickness, air voids,
  temperature, mix type and whether it was bonded by a tack coat. Thickness = solids / (1 − voids).
- **Mixes**: base course 0/32, binder course 0/16, surface course 0/11 (coarse to fine stones).
- **Tools**: shovel (lumpy, loose, ~25% voids), paver (even mat, ~17% voids from the screed), rake
  (levels hot mix, conserves material), roller (static or vibrating), tack coat (emulsion that turns
  from brown to black as it breaks), road paint, dig up. **Imperfections**: cold clump, big stone,
  puddle, boot print, segregated (stony) patch. A seam appears by itself when a new pass meets a mat
  that has already cooled.
- **Physics, simplified but in the right ranges**: laid at ~150 °C; Newton cooling to air and ground
  with a time constant proportional to lift thickness (a 50 mm lift falls to 80 °C in about 20
  minutes, a thin one much faster); water cools the mat sharply and boils off. Each roller pass removes
  a share of the remaining air voids, scaled by how hot the mix is (full above ~130 °C, nothing
  below ~80 °C); high spots take more of the drum's weight; hot material above the drum is shoved
  ahead; rolling cold, loose mix cracks it. Target: 93–96% density (4–7% air voids).
- **Clock**: simulated time runs faster than real time (adjustable), so the compaction window is
  tens of seconds of play rather than twenty minutes.
- **Views**: the surface; a thermal camera (as paving crews use to find cold spots); a density map;
  and a roller-pass count map (as intelligent-compaction rollers show).
- **Look**: aggregate drawn procedurally per pixel (two sizes of stones, open gaps when loose, filled
  and flattened when compacted), binder glossy while hot, puddles mirror-like with steam on hot mix.
- **Faithful, not a game.** Demos: "pave a strip" and "patch by hand".

## Left out

- Traffic, ageing and potholes over years; aggregate gradation curves beyond three mixes; binder
  chemistry.
