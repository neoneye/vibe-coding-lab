# Queen clothing simulator

Date: 2026-10-10
Directory: `3d-queen-clothing/`

## Goal

A 3D sandbox for royal gowns across six eras: 1500, 1600, 1700, 1800, 1900
and 2000. A stylised queen stands on a museum plinth wearing a fully
parametric gown. Every slider rebuilds the gown instantly, and the skirt,
train and mantle sway with light spring motion. Lots of parameters.

The owner's reference folder (`~/Desktop/clothing`) sets the look:

- the Elizabeth I "Rainbow/Ditchley" style, with a cartwheel ruff, a wired
  lace fan, jewel-studded white silk and ropes of pearls;
- the Elizabeth effigy, with an open robe over an embroidered petticoat and
  an ermine-lined mantle;
- a Marie Antoinette robe à la française, with panniers, a stomacher with
  échelle bows and lace engageantes;
- Victorian crinolines, with an off-shoulder bertha, flounces, floral stripes
  and a tiara;
- an 1890s/Edwardian gown with leg-of-mutton sleeves, trellis silk and a
  train;
- the 1953 coronation gown with an ermine robe;
- a V&A-style gallery hall with many gowns on plinths.

There is no score and no goal. It is a dress-up sandbox with a light
educational layer: an x-ray view of the underpinnings and a short note per
era.

## Constraints

- One self-contained `index.html`, plus `test.mjs` and later
  `screenshot1.jpg`.
- three.js 0.170.0 comes from jsdelivr through an import map, as in
  `3d-animal-haircut`. There are no other dependencies; all textures are
  generated procedurally on a canvas.
- Pure logic lives in `<script id="shared-code">` with a `QueenTests.run()`
  runner. `test.mjs` extracts that block and runs it in Node. The block uses
  no three.js and no DOM.
- Scene units are metres. The queen is 1.65 m tall plus her hair and crown.
- Retina canvas: the backing store is in device pixels, with the pixel ratio
  capped at 2.
- It must hold 60 fps in studio mode on a retina MacBook. Gallery mode
  (six queens) may be lighter.

## Architecture

### 1. Parameter model (shared code)

`SCHEMA` is a flat list of parameter definitions. Each definition has:

- `key`
- `group`
- `kind`: `num`, `color` or `choice`
- `min`, `max`, `step`, `def`
- `label`
- for a `choice`, its `options`

The groups (≈70 parameters in total):

- **Silhouette:**
  - `waistY`
  - `hipShelf`, the drum-farthingale shelf width
  - `hemRadius`
  - `curve`: −1 concave cone … 0 straight … +1 convex bell
  - `pannier`: the extra side width at the hip, which gives a width:depth
    ratio
  - `bustle`: the back bump below the waist
  - `trainLength`
  - `frontOpen`: the angle of the opening in the overskirt that shows the
    petticoat
  - `flounces`: the tier count
  - `flounceDepth`
  - `hemFullness`: how many folds
- **Bodice:**
  - `bust`, `waist`
  - `corsetShape`: cone / hourglass / S-bend / natural
  - `neckShape`: square / high / off-shoulder / V / sweetheart
  - `neckDepth`, `neckWidth`
  - `pointDepth`: the stomacher dip
  - `stomacherBows`: count
- **Sleeves:**
  - `sleeveLength`: short / elbow / wrist, as a number from 0 to 1
  - `shoulderPuff`
  - `upperFull`
  - `cuffFlare`: trumpet
  - `engageantes`: the size of the lace ruffles at the elbow
  - `sleeveSlash`: the puffed slashing count
- **Collar:**
  - `ruff`: cartwheel ruff size
  - `ruffLayers`
  - `fanCollar`: the size of the wired lace fan behind the head
  - `bertha`: the depth of the off-shoulder lace band
  - `highCollar`: the height of the Edwardian collar
- **Mantle:**
  - `mantle`: length, where 0 means none
  - `mantleWidth`
  - `ermine`: the width of the ermine border
  - `mantleColor`
- **Fabric:** for each of the gown, the petticoat (forepart) and the bodice,
  a base colour and an accent colour; plus
  - `pattern`: plain / damask / trellis / floral stripes / brocade /
    stripes / jewel grid
  - `patternScale`
  - `material`: satin / velvet / brocade / taffeta
  - `sheen`
- **Trim:**
  - `braidBands`: the hem band count
  - `braidColor`
  - `frontTrim`: the width of the braid down the opening
  - `pearlRows`: on seams and the opening
  - `jewelDensity`
  - `fringe`
  - `bowsOnSkirt`
- **Jewels and accessories:**
  - `necklaces`: rope count
  - `pearlLength`
  - `crown`: none / Tudor arched / gable hood / small diadem / tiara /
    coronation
  - `crownScale`
  - `gloves`
  - `sceptreOrb`
  - `handFan`: a hand-held fan
- **Hair:**
  - `hairStyle`: gable-covered / red curls / powdered pouf / chignon /
    upswept / modern set
  - `hairColor`
  - `poufHeight`
- **Skin:** `skinTone`, and `faceMakeup` (0 natural … 1 Elizabethan white).
- **Motion:**
  - `motionMode`: still / turntable / walk
  - `speed`
  - `wind`
  - `swing`: spring stiffness
  - `damping`

`ERAS` holds the six anchor presets. Each has a `year`, a `name`, a short
note (in our own words), its `underpinnings` (see 4) and a full parameter
object:

| Year | Name | Silhouette | Key features |
|---|---|---|---|
| 1500 | Tudor | cone (Spanish farthingale) | square neck, trumpet sleeves, gable hood, open front with forepart |
| 1600 | Elizabethan | drum (French farthingale) with hip shelf | cartwheel ruff + wired fan, jewel grid on white, pearl ropes, puffed sleeves, red curls, arched crown |
| 1700 | Rococo | wide panniers, flat front/back | robe à la française open front, stomacher with échelle bows, engageantes, floral stripes, powdered pouf |
| 1800 | Victorian | dome crinoline | off-shoulder bertha, flounce tiers, short sleeves, gloves, tiara, chignon |
| 1900 | Edwardian | S-bend, smooth hips | high lace collar, long train, trellis silk, leg-of-mutton puffs |
| 2000 | Modern | column / soft A-line | sweetheart or V neck, sash ribbon, tiara, optional state mantle |

The year anchors are nominal: the 1700 preset is the mid-century Rococo
robe, and the 1900 preset is c. 1900–1905.

Model functions:

- `clampParams(p)`: snaps a parameter object to the schema.
- `paramsAtYear(year)`: finds the neighbouring anchors a and b with
  t = (year − a.year)/(b.year − a.year), eased with smoothstep.
  - `num`: linear interpolation.
  - `color`: linear interpolation in linear-sRGB.
  - `choice`: a below t = 0.5, otherwise b.
  - Years outside 1500..2000 clamp.
- `skirtRadius(v, theta, p)`: the radius at height fraction v (0 at the
  waist, 1 at the hem) and angle θ (0 is the front, +x is the queen's left).
  - Profile: start at the waist radius. Blend toward
    `max(hipShelf, waistR)` over the first 8% of v (the drum shelf). Then
    run to `hemRadius` with the curvature from `curve`
    (`v' = v^(1−0.6·curve)` style shaping).
  - Cross-section: an ellipse with a side scale of `1 + pannier·g(v)` and a
    front/back scale of 1, where g falls off toward the hem as panniers
    really do.
  - Bustle: a back bump `bustle·exp(−((v−0.18)/0.18)²)·max(0, −cos θ)`.
  - Train: back extension `trainLength·smoothstep(0.55, 1, v)·max(0, −cos θ)²`
    added along −z. The hem also lowers to the floor across the train.
- `skirtHemY(theta, p)`: the floor contact height (≈0.01).
- `underpinningsFor(p)`: returns a list of hoops (each with v, radius
  samples, kind), a corset kind, and pannier baskets or a bustle cage. They
  are derived from `skirtRadius`, so they always sit inside the gown.
- `encodeHash(p, eraIndex)` / `decodeHash(str)`: the URL hash stores the
  era index plus only the keys that differ from that era's preset. Numbers
  are rounded to their step and colours stored as 6-digit hex. Decoding
  unknown or malformed input never throws; bad keys are ignored.
- `randomCommission(rng, mode, eraIndex)`:
  - `within`: each number is jittered by ±25% of its range around the era
    preset, colours by a hue jitter, and choices kept with probability 0.8.
  - `wild`: uniform over the schema, with colours drawn from a curated royal
    palette.
  - A seeded `mulberry32` rng makes it testable.
- Geometry helpers that return plain arrays, with no three.js:
  - `buildSkirtGrid(p, cols, rows, opts)` → positions, uvs, indices. It
    covers either the full ring or the overskirt with a front gap of
    `frontOpen`, and adds hem folds as a radial sinusoid with amplitude
    tied to `hemFullness`.
  - `buildRuffRing(p)` → positions and indices for the pleated ruff.
  - `buildBodiceGrid(p)` → the torso offset surface with rows above the
    neckline curve removed.

### 2. The queen (render code)

- **Body:**
  - The torso is a lofted surface of elliptical sections from the hips to
    the neck. Its waist, bust and shoulder radii come from `bust`/`waist`
    and `corsetShape`:
    - cone: flat front, conical;
    - hourglass;
    - S-bend: the bust pushed forward and the hips back;
    - natural.
  - The neck, the head (a slightly elongated sphere with a jaw) and the arms
    are tapered tubes in a fixed regal pose: the elbows bent, the forearms
    forward, the hands at the waist.
  - When `sceptreOrb` is on, the right hand holds a sceptre and the left an
    orb.
  - The legs are hidden by the skirt and never modelled.
- **Face:** a canvas texture with almond eyes, brows, lips and a blush. It
  is tinted by `skinTone`, and `faceMakeup` blends it toward Elizabethan
  white with red lips.
- **Hair:**
  - built from primitive clusters: sphere curls, a torus chignon, a stacked
    pouf of ellipsoids with a few curls and a feather, and a modern smooth
    wave;
  - the gable hood is a pentagonal extruded frame with a veil.
- **Crowns:**
  - Tudor arched: a band, crosses pattées and fleurs, arches and an orb
    with a cross;
  - small diadem;
  - tiara: a lace arc of jewels;
  - coronation: the 1953-style closed crown.
  - All are instanced jewels on a gold band.

### 3. The gown (render code)

All gown pieces are rebuilt from the parameters by `buildGown(p)` into a
`THREE.Group`. Only the pieces whose inputs changed are rebuilt: a param
change marks the groups it belongs to as dirty.

- **Skirt:** the overskirt is a 160×56 grid. When `frontOpen > 0`, a
  petticoat (forepart) sits underneath with the forepart colours and
  pattern, slightly inset.
- **Flounce tiers:** `flounces` rings, each a short scalloped band offset
  0.5–1.5 cm outward, with a ruffled hem.
- **Bodice:** the torso surface offset by 6 mm.
  - The neckline is cut by a curve: square, high, off-shoulder (bateau),
    V, or sweetheart.
  - The waist edge dips to a point at the front by `pointDepth`.
  - A stomacher panel and `stomacherBows` bows are added.
- **Sleeves:** a tube along each arm with a radius profile from
  `shoulderPuff`, `upperFull` and `cuffFlare`, ending at `sleeveLength`.
  - Slashing adds `sleeveSlash` puff bands.
  - Engageantes are 2–3 stacked translucent lace cones at the sleeve end.
- **Collar:**
  - Ruff: a ring around the neck whose cross-section is a figure-8 pleat
    (radius modulated by `sin(N·θ)`). Each of the `ruffLayers` layers is
    slightly larger.
  - Wired fan: a half-disc of lace standing behind the head, with an
    alpha-tested lace texture and a wire rim.
  - Bertha: a lace band draped around the off-shoulder neckline.
  - High collar: a cylinder of lace up the neck.
- **Mantle:** a cape surface hanging from the shoulders, spreading behind
  and trailing `mantle` metres on the floor.
  - It has a lining colour and ermine borders: white with black tail spots,
    from a procedural texture.
  - Its motion comes from the same spring model as the train.
- **Fabric textures:** generated on a canvas at 512² and cached by
  (pattern, colours, scale).
  - Patterns: damask (mirrored floral medallions), trellis (diagonal
    quilting with dots), floral stripes (bands of roses), brocade (dense
    gold motif), stripes, jewel grid (red/gold rosettes as in the Ditchley
    portrait), plain.
  - `material` maps onto `MeshPhysicalMaterial`:
    - satin: low roughness, sheen;
    - velvet: high sheen, dark sheen tint;
    - brocade: metalness on the gold accents through the roughness map;
    - taffeta: stiff, crisp.
- **Trim:** instanced meshes, each kind being one `InstancedMesh`:
  - braid bands are thin tube strips around the hem at `braidBands`
    heights and down the opening edges;
  - pearls follow curves (the opening edges, the neckline, the necklace
    catenaries);
  - jewels are scattered over the skirt with Poisson-ish spacing by
    `jewelDensity`;
  - fringe is short strands along the flounces;
  - bows are on the skirt.

### 4. Underpinnings x-ray

The `xray` slider (0..1) fades all outer garments (opacity
`1 − xray·0.9`, depthWrite off once it is above 0) and fades in the
underpinnings from `underpinningsFor(p)`:

- **Corset:** the torso at 1 cm, in a linen colour with boning lines. Its
  kind follows `corsetShape`.
- **Hoops:**
  - Spanish farthingale: cane hoops on the cone;
  - French farthingale: a bum-roll torus plus a wheel;
  - panniers: side cages (hoops elliptical only at the sides) on tapes;
  - crinoline: steel hoops on vertical tapes;
  - bustle: half-hoops at the back;
  - for 1900/2000: a petticoat only (a translucent bell), no hoops.
- The choice is automatic from the silhouette parameters:
  - `pannier > 0.3` → panniers;
  - `hipShelf` large → wheel;
  - `curve < −0.2` → cone hoops;
  - `curve > 0.2` with a large `hemRadius` → crinoline;
  - `bustle > 0.1` → bustle cage;
  - otherwise a petticoat.

  This is why it still makes sense mid-morph.

### 5. Cloth motion

This is CPU vertex displacement on the skirt, flounces, train and mantle
every frame. Base positions are kept and the displaced positions written
back.

- **State:** the hip pose (yaw and position) is driven by `motionMode`:
  - still;
  - turntable: the plinth turns;
  - walk: the queen glides around a circle with a slight bob.
- **Skirt rows:** each row has a damped angular spring (`swing`, `damping`)
  that lags the hip yaw, plus a lateral spring that lags translation. The
  displacement of row v is weighted by v², so the hem lags most.
- **Train and mantle:** an extra drag offset proportional to velocity along
  −forward, weighted by distance along the train.
- **Wind:** a low-frequency noise offset scaled by `wind` and v.
- Normals are recomputed every 2nd frame for the moving meshes.

### 6. Modes, scene and UI

- **Studio:**
  - one queen on a round plinth in a dim museum room;
  - a key spotlight with soft shadows (`PCFSoftShadowMap`), a rim light and
    a warm fill;
  - OrbitControls.
- **Gallery:**
  - six queens on plinths in an arc in a long hall, each with its own
    `slots[i]` params, initialised from the six eras;
  - clicking a queen makes her the active slot and flies the camera to her
    (eased over 0.8 s);
  - the panel edits the active slot;
  - a "Back to overview" button;
  - motion is off in gallery mode except a gentle idle sway.
- **Panel (left):**
  - title;
  - the era strip of six buttons, which loads that preset into the active
    slot;
  - the year morph slider, 1500–2000. Dragging it sets the active slot to
    `paramsAtYear(y)`, and touching any other parameter shows "custom";
  - the x-ray slider;
  - mode buttons (studio / gallery);
  - collapsible groups, generated from `SCHEMA`;
  - Dice (within era / wild), Copy link, Reset era.
- **Info card (bottom right):** the era name, approximate dates, a two to
  four sentence note in our own words, and an honesty line: "Stylised
  reconstruction for play; proportions and details are simplified."
- **URL params for headless shots:**
  - `?era=0..5`
  - `&year=1750`
  - `&xray=0.8`
  - `&mode=gallery`
  - `&motion=still`
  - plus the `#` hash state.
- **Debug handle:** `window.__qc = { step(dt), render(), params, setParam }`.

## Testing

`test.mjs` runs `QueenTests.run()` in Node. It checks:

1. Every era preset has every schema key, and every value is within its
   range or a valid option.
2. `paramsAtYear(era.year)` equals that preset for all six, and years
   outside the range clamp.
3. Midpoints between eras are within range, and colours stay valid hex.
4. `encodeHash`/`decodeHash` round-trip randomised parameter sets losslessly
   to step precision. Garbage input decodes to a valid preset without
   throwing.
5. Silhouette properties:
   - 1700: the skirt radius at θ = ±90° is more than 1.6× the radius at
     θ = 0 near the hips;
   - 1900: the train's back radius at the hem exceeds the front by more
     than 0.5 m;
   - 1600: the drum shelf radius at v = 0.1 is more than 2.5× the waist;
   - 1800: the hem radius is the largest of all eras;
   - all eras: the radius rises monotonically along v at the sides.
6. `underpinningsFor` picks the expected kind for each era, and every hoop
   lies inside the skirt (hoop r ≤ skirt r at the same v, θ).
7. The geometry builders return finite positions with indices in range, and
   the front gap removes the expected columns.
8. `randomCommission` is deterministic for a seed and in range for both
   modes.

Visual check: headless Chrome screenshots of all six eras, an x-ray shot, a
morph midpoint (1750) and gallery mode, served over http://localhost:8765.

## Out of scope

- real cloth simulation and collisions;
- dressing layer by layer;
- male or court costumes;
- saving to a file (the URL hash covers sharing);
- historically exact patterns or garments.
