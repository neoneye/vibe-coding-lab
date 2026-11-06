# Ancient sculpture: design notes

- **Date:** 2026-11-06.
- **Directory:** `sculpture/`. It holds a single self-contained `index.html`, plus `test.mjs` and `screenshot1.jpg`.
- **Repo conventions:** the usual ones (gallery, README "### 3D" section, `gallery.yaml` title, shared-code + `test.mjs`).

## What the owner asked for

- "a sculpture simulator. With tools such as chissel, (I don't know what other tools they used back then)."
- "Material: stone of different colors. I'm not interested in bronze."
- Statues: Easter Island heads, the Nefertiti bust, David (Michelangelo), the Buddhas of Bamiyan, the Terracotta Army, the Great Sphinx of Giza.
- "I'm not interested in christian statues nor modern statues."
- On entering the page: "watch the old carvers' process play out step by step, from rough block to finished head."
- "allow the user to cut in stone too."
- Terracotta Army: "Just sculpt a single one of the Terracotta Army statues".
- The owner recalled that carvers had a tool for transferring measurements so the result came out near photo-realistic. I explained the historical methods (below) and asked about fidelity.
- On fidelity: "model the statues yourself to the best of your recall. Don't use 3d scans."

Everything not quoted above is my call. Repo rules also apply: a faithful, educational simulation with no game mechanics (no score, no play-as mode), and a Save image that renders from a clean canvas with the subject centred.

## Intent

The page shows how six famous ancient statues were actually made, step by step, with the real tools, the real stone and the real methods for transferring a design onto stone. You can stop at any point and cut into the stone yourself with the same tools, and feel why a copper chisel is useless on granite.

## Goals

- **Watch mode, the landing view.** It plays the making of the chosen statue as named stages, with play/pause, a scrubber, a speed control and a stage list you can click. Each stage names its tools, its method, roughly how long it took, and how many people worked on it, with an honest note where that is not known.
- **Carve mode.** At any moment, "Take the tools" switches to free carving. You can carve:
  - the statue at its current stage;
  - a fresh block, or a cliff face for the rock-cut statues;
  - in any stone from the picker.

  There is a ghost of the finished statue to aim at (a toggle), undo, and reset.
- **Stones of different colours,** each with its hardness and look: veins, grains, strata, inclusions. Hardness decides how fast each tool removes material, and whether the tool works at all.
- **The educational text:**
  - cards for each statue (date, place, size, stone, tools, makers, what happened to it since);
  - a tools glossary;
  - a stones table;
  - a section on "how they copied the design onto the stone".

## Non-goals and anti-goals

- Bronze, and casting in general.
- Christian statues and modern statues. David is on the owner's own list, so it stays.
- 3D scans or any loaded model data. Every statue is modelled in code from recall.
- Game mechanics: no score and no "how close did you get" rating. A neutral readout of the volume removed and the historic time it would have taken is fine.
- The whole Terracotta Army. There is one soldier only.
- Photorealism. The statues should be clearly recognisable, faithful in proportion and in their signature features, but they are hand-modelled.

## The six statues

The finished state is "as made". A **Then / Today** toggle shows the losses where they matter. Sizes and dates are from recall and must be checked against sources during the build.

1. **Moai** (Rapa Nui).
   - **Material and size:** Rano Raraku lapilli tuff (soft, grey-brown, with dark lapilli). A typical moai is about 4 m. The page models a classic Ahu-type head-and-torso with a long ear and a heavy brow, hands on the belly with long fingers, and no legs.
   - **Process:**
     1. outline the figure on the quarry wall;
     2. carve channels around it with hand-held basalt picks (toki);
     3. carve the face and front while the figure lies on its back;
     4. undercut the back to a thin keel;
     5. break it free and slide it down the slope;
     6. stand it up in a pit and finish the back;
     7. transport it to the ahu (text only);
     8. add the eyes (white coral and an obsidian or red scoria pupil) and the red scoria topknot (pukao).
   - **Today:** no eyes, and most moai have no pukao.
2. **Nefertiti bust** (Amarna, c. 1345 BC, workshop of Thutmose).
   - **Material and size:** a limestone core with gypsum stucco layers, painted. About 48 cm tall.
   - **Process:**
     1. draw a grid with front and side views on the block;
     2. rough out with copper chisels and stone pounders;
     3. redraw the lines and cut again;
     4. smooth with abrasive;
     5. build up stucco layers of varying thickness for the fine modelling (the CT scans showed this; I recall that from sources, not from scan data);
     6. paint;
     7. inlay the right eye (quartz with black wax).
   - **The left eye was never inlaid,** in both Then and Today.
3. **David** (Michelangelo, Florence, 1501–1504).
   - **Material and size:** white Carrara marble, 5.17 m. The block was a narrow one already started and abandoned by earlier sculptors (Agostino di Duccio).
   - **Process:**
     1. the partly worked block;
     2. a small wax model;
     3. the "water level" method (Vasari): the forms nearest the front come out of the block first, layer by layer towards the back;
     4. point chisel;
     5. tooth chisel (claw) cross-hatching;
     6. flat chisel;
     7. drill for the hair curls, nostrils and pupils;
     8. rasps;
     9. abrasives (pumice) to polish.
   - **Today:** stands in the Accademia since 1873 (text only).
4. **Buddhas of Bamiyan** (Afghanistan, 6th–7th century).
   - **Material and size:** the larger western Buddha, about 55 m, in sedimentary conglomerate and sandstone.
   - **Process:**
     1. cut the niche into the cliff;
     2. carve the rough body from the rock;
     3. drive wooden pegs and hang ropes for the drapery folds;
     4. model the folds and face in mud-straw plaster;
     5. paint (red and gold are reported).
   - **The face:** the upper face was probably a wooden mask that was lost early.
   - **Today:** an empty niche, after the destruction in March 2001. The card says so plainly, without dramatising.
5. **One Terracotta Army soldier** (Lintong, c. 210 BC).
   - **Material and size:** fired clay, about 1.8 m. This is the one statue built up rather than cut away; the card explains why.
   - **Process:**
     1. a solid lower body and legs on a plinth;
     2. a hollow torso coil-built from clay strips;
     3. a head from moulds with the face hand-finished;
     4. the hands made separately;
     5. details carved and added while the clay is leather-hard (hair, armour plates, belt hook, shoe laces);
     6. drying;
     7. firing at about 950–1050 °C;
     8. lacquer and pigment.
   - **Today:** most paint flaked off when the pit was opened.
   - **Carve mode:** carving cuts leather-hard clay.
6. **Great Sphinx of Giza** (c. 2500 BC, Khafre).
   - **Material and size:** cut from the bedrock of the Giza plateau, about 73 m long and 20 m high.
   - **Process:**
     1. quarry a U-shaped trench around a rock knoll, using the stone for the temples;
     2. rough out the head from the harder upper layer;
     3. shape the body from the softer middle layers (the visible horizontal strata);
     4. carve the paws, later cased with masonry blocks;
     5. use copper chisels, dolerite pounders and wooden wedges;
     6. paint (red face, a striped nemes headdress).
   - **Today:** no nose or beard, heavy weathering of the body layers.

## Design transfer, shown on the stone

The owner remembered a measuring tool for near-exact copies. On the page:

- **Egyptian grid and profile drawings.** Lines are painted on the block faces and redrawn after each cut. Used for the Sphinx head and Nefertiti.
- **Roman pointing with calipers and plumb lines.** The page explains it as the ancient copying method, with drill holes to depth. It is not used for any of the six, except optionally in carve mode as a "drill guide points" aid.
- **The pointing machine** (about 1800). Text only, as too late for this list.
- **Michelangelo's water level** (Vasari). Shown as a falling plane that the carving follows.
- **No known measuring tool on Rapa Nui.** Text only.
- **Moulds and hand finishing** for the terracotta soldier.

## Tools (carve mode)

Each tool is a distinct cutting kernel with its own mark left on the surface:

| Tool | Cultures | Action and mark |
|---|---|---|
| Basalt pick (toki) | Rapa Nui | Pecks out small pits; slow; works on tuff |
| Dolerite pounder | Egypt | Crushes and bruises; slow on any stone; the only thing that dents granite |
| Copper chisel + mallet | Egypt | Chips soft limestone; blunts and barely works on granite or basalt |
| Sand abrasive (with a stone or copper saw) | Egypt | Grinds slowly; works on any stone |
| Iron point chisel | Michelangelo, Bamiyan | Pits deep in conical chunks; roughing |
| Tooth chisel (claw) | Michelangelo | Leaves parallel grooves; cross-hatched shaping |
| Flat chisel | Michelangelo | Shaves smooth planes |
| Drill (bow or running drill) | Michelangelo | Cylindrical holes and channels |
| Rasp | Michelangelo | Files ridges smooth; leaves a fine scratch texture |
| Pumice / emery | Michelangelo | Polishes; raises gloss |
| Wire loop / knife | Terracotta | Cuts leather-hard clay cleanly |
| Clay and stucco | Nefertiti, Bamiyan, Terracotta | Adds material: stucco, mud plaster, clay |

- **Removal rate.** The tool's power over the stone's hardness gives the rate. When the stone is too hard for the tool, the readout says so, for example "copper chisel on granite: the edge folds".
- **Striking.** Click to strike once and drag to keep striking. The strike direction comes from the camera and the surface normal. Chips fly and a strike sound plays, with its pitch depending on the stone.

## Stones (picker, each with a colour/texture preset)

| Stone | Approx. hardness | Used for |
|---|---|---|
| White Carrara marble | Mohs 3 | David |
| Giza limestone (yellow, layered) | about 3, uneven by layer | Sphinx, Nefertiti core |
| Rano Raraku tuff (grey-brown, lapilli) | soft | Moai |
| Bamiyan conglomerate/sandstone (ochre, pebbly) | soft and crumbly | Buddhas |
| Red Aswan granite | 6–7 | contrast: Egyptian hard stone |
| Black basalt | about 6 | contrast |
| Green serpentinite or grey schist | 3–4 | contrast |
| Leather-hard clay (terracotta) | very soft | soldier |

## Look

- **3D with orbit and zoom,** lit like a workshop or a site at daylight.
- **Ground and setting.** A plain ground per statue: the quarry slope, a sand plateau, a workshop floor or a cliff.
- **Scale.** A human figure for scale, plus height and length readouts.
- **Large statues.** The Sphinx, Bamiyan and the Moai in its quarry show tiny workers for scale, as simple figures: no faces, no game avatars.
- **Paint and today's state.** Paint stages and the Then/Today toggle recolour the surface.

## Architecture (my call; the builder may change it with a reason)

- **Engine.** `SculptCore` is plain JS in `<script id="shared-code">`, tested by `test.mjs`. It holds:
  - the statue definitions, as signed distance functions built from primitives with smooth unions;
  - the stage schedules;
  - the stones and tools tables;
  - the removal-rate rule;
  - the carve-kernel math.
- **Rendering.** three.js 0.170 via an importmap, for the scene, ground, scale figures and the camera.
- **The statue surface.** A raymarched field that writes depth so it composites with the three.js scene. The field combines:
  - the statue's target SDF, baked once into a WebGL2 3D texture, preferably on the GPU;
  - the stage rule: start block or cliff → target offset by a shrinking margin, plus stage-specific shaping such as the water-level plane, the keel and the trench;
  - a carve texture, updated with sub-region uploads where the user cuts or adds material;
  - a finish channel (pits, grooves, smooth, polished) that drives the tool-mark texture and gloss.

  The reason is that faces need sub-voxel smoothness that marching cubes at this size would not give.
- **Resolution.** Per statue, fitted to its bounding box (roughly 256–384 cells on the long axis). Very tall or long statues (the Sphinx, Bamiyan, David) frame the whole statue.
- **Save image.** It renders from a clean canvas with no UI and the subject centred.

## Resolved after the builder check (my calls)

- **Scale of carving on huge statues.**
  - The Moai, Nefertiti, David and the soldier are carved in place at full statue resolution.
  - The Sphinx and Bamiyan are carved on a life-size working face of that rock, with the statue's own surface as the starting shape around the head or a paw. They are never carved at whole-monument scale. Their tools stay historically sized, so the copper-on-granite lesson still shows.
- **Faces must read close up.** Every statue gets a second, finer grid for the head, nested in the whole-statue field and modelled with its own detail. Watch mode ends with a slow move onto the face.
- **What Watch mode shows.**
  - The geometry is a deterministic, scrubbable function of time: margins shrink, planes fall, trenches deepen.
  - Strikes, chips, dust and a working tool are decoration placed on the moving cutting front, so they never change the geometry and scrubbing backwards just works.
  - Workers are static scale props.
- **Switching back from Carve.** Your carving is kept as a separate copy. Watch shows the historic timeline. Returning to Carve brings back your copy until you reset it.

## Page

- **Layout.** It follows the sister pages:
  - a statue picker (segmented control or cards);
  - the stage with the Watch / Carve switch;
  - the timeline;
  - the tool and stone pickers;
  - readouts;
  - collapsible settings;
  - the educational sections below.
- **Sources.** Facts are checked against sources during the build. Anything uncertain says so.

## Left out

- Transport of the Moai ("walking" with ropes) beyond a text note.
- Real fracture mechanics. Chips are an effect; removal follows the kernel.
- Sound beyond the strike click.
- Saving and loading the user's carving.

## As built (2026-11-06)

### Engine

- **Statues as primitives.** Every statue is a list of a few dozen to about 400 primitives in `models.js`: spheres, ellipsoids, rounded cones, boxes, tori, cylinders and half-spaces, combined in sequence by smooth union, subtraction and intersection.
  - A shared `head()` builder makes all the faces, and `hand()`, `foot()` and `along()` make the limbs.
  - Each primitive carries a tag (skin, crown, collar, armour, rivet and so on) that the page paints.
- **Baking.** `SculptCore.bake` evaluates the field on a coarse grid (every 4th cell), then evaluates exactly only near the surface.
  - It uses a per-coarse-cell list of the primitives that can matter there.
  - In the hot path, `Math.hypot` became `sqrt`, a 4.5× speed-up.
  - David (194 primitives, 5.1 M cells plus a 4.3 M-cell head grid) bakes in about 1.7 s. The other statues are faster.
  - Near the surface the error is below 3 mm, against a 16 mm cell.
- **Two grids per statue.** A whole-statue grid and a finer head grid, blended at the head grid's edge, both uploaded as half-float 3D textures. Tags go in R8 textures read with `texelFetch`.
- **Rendering.** A full-screen raymarch in a three.js `RawShaderMaterial` that writes `gl_FragDepth`, so the three.js props composite with it: the person for scale, the workers, the water in David's tub and the flying chips.
  - **Shading:** soft shadows, ambient occlusion, a procedural texture per stone, tool-mark bump patterns, paint tags with optional stripes, plaster and stucco shells, Egyptian grid lines and peg holes.
  - **Speed:** the resolution adapts while the picture moves (target about 30 ms a frame) and sharpens when it stops.

### Stages

- **What a stage changes.** A stage eases named parameters:
  - margins in two regions;
  - a keep plane: the quarry floor, the niche cut, Vasari's water level;
  - a growth height for the clay;
  - plaster or stucco on and off;
  - paint, eyes, topknot and inlay;
  - the moai's pose and keel;
  - firing and drying;
  - "today".
- **Nefertiti** uses the front and side profiles of her grid (the minimum over depth), so "cut to the outlines" leaves the square-edged figure that Egyptian sculptors worked from.
- **The moai** is modelled in its quarry frame:
  - a work channel follows the figure, 0.62 m wide;
  - the keel ridge shrinks to nothing;
  - the statue then slerps upright into its pit and onto the ahu.
- **Bamiyan's robe folds** are rope-like ridges laid on the surface built so far. The builder probes its own partial field to find the surface. The terracotta soldier's armour plates are placed the same way.

### Carving

- **The edit grid.** An RGBA8 grid at the resolution of the statue grid holds:
  - removal and addition, as signed distances quantised to ±2.5 cells;
  - a finish code;
  - a stroke direction.
- **Picking.** A 1×1 render of the same shader returns the hit point and the normal.
- **Uploads.** Each blow writes only its dirty box with `texSubImage3D`.
- **Undo.** Every stroke keeps a log of the old cell values.
- **Tool effect.** The rate is the tool's hardness against the stone's, from `effectiveness()`. A tool that is too soft does nothing and the page says why.
- **The Sphinx and Bamiyan** are carved on a 3 m life-size patch at about 1.3–1.8 cm cells, baked on demand: the Sphinx's nose and eye, and Bamiyan's robe folds.

### Calls the owner may revisit

- **Default statue.** The moai, first in the owner's list.
- **Then and Today.** These are the last stages of the timeline, rather than a separate toggle. The Today button jumps there and back.
- **Interpretations.**
  - The Sphinx's beard is shown in the "as made" state, although it may have been added in the New Kingdom.
  - The Bamiyan Buddha's forearms reach forward. Their real pose is not known.
  - The terracotta soldier is a standing armoured infantryman.
- **Sizes and facts.** These were checked against Wikipedia's articles on the six statues (2026-11-06). Firing near 1000 °C and the moai process are from general references, not checked here.
