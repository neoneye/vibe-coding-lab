# Animal haircut

Date: 2026-10-10
Directory: `3d-animal-haircut/`

## Goal

A cozy 3D grooming sandbox. A big, fluffy llama (or alpaca, sheep, poodle)
stands on a salon floor. You orbit around it and run clippers over the
fleece. The tufts fall and pile up, and the slim, cute animal underneath
appears. The payoff is the before/after: the owner loves llamas, and a
llama with a huge fleece looks very different, and cuter, once shorn.

There is no score and no timer. Lots of parameters.

## Constraints

- One self-contained `index.html`, plus `test.mjs` and later
  `screenshot1.jpg`.
- three.js 0.170.0 comes from jsdelivr through an import map, as in
  `3d-wrecking-ball`. Nothing else.
- Pure logic lives in `<script id="shared-code">` with a `HaircutTests.run()`
  runner. `test.mjs` extracts that block and runs it in Node.
- Scene units are metres. The llama is about 1.8 m tall at the ears.
- Retina canvas: the backing store is in device pixels, with the pixel ratio
  capped at 2.

## Architecture

### 1. Body: an SDF blended from primitives

Each animal is a recipe: a list of primitives, each tagged with a
**region**.

- Primitives are capsules (`a`, `b`, `r`, optionally tapered `r2`) and
  ellipsoids.
- The SDF is a polynomial smooth-min union with blend radius `k`, set per
  animal.
- Regions: `body`, `neck`, `head`, `muzzle`, `topknot`, `legUpper`,
  `legLower`, `tail`. Ears are *not* in the SDF; see 3.

A "chubbiness" parameter scales the radii of the `body` and `neck`
primitives before meshing. Changing it re-meshes the animal and resets the
fleece.

### 2. Skin mesh: surface nets

The SDF is sampled on a grid fitted to the animal's bounding box, at about
110 cells along the longest axis. The mesh is extracted with **naive surface
nets**: one vertex per sign-changing cell, placed at the mean of the edge
crossings, and one quad per sign-changing edge. Each vertex is then projected
onto the surface with two Newton steps along the SDF gradient. Normals come
from the SDF gradient.

For each vertex the mesher also produces:

- `region` weights: a softmax over the per-primitive distances, gathered into
  regions;
- `area`: one third of the summed area of the adjacent triangles, used for
  the wool mass;
- `headW`: the head-follow weight, 1 in head/muzzle/topknot and ramped
  along the upper neck.

Target size: 20k–45k vertices.

### 3. Non-fur features

These are ordinary meshes in a `headGroup` that shares the head transform:

- big glossy eyes: a dark sphere plus 2 white specular dots, with
  eyelid caps that close for blinks;
- eyelashes on the llama and alpaca;
- a nose/mouth line: a small dark torus arc for the smile;
- ears: banana-shaped lathe geometry for the llama, a smaller variant for
  the alpaca, droopy ellipsoids for the sheep and poodle;
- hooves/toes: dark rounded caps at the leg ends.

Ears are matte and coat-coloured (tint-coloured on the sheep). They are not
cuttable.

### 4. Fleece model

The state is `len[]` (current length in metres per skin vertex) and `base[]`
(the length at reset). The defaults come from each animal's
`regionLength[region]`, blended by the region weights, then multiplied by
the global **Max length** parameter and a little low-frequency noise so the
coat looks natural.

**Llama defaults (× max length 0.22 m):**

| Region | Length factor |
|---|---|
| body | 1.0 |
| neck | 0.9 |
| topknot | 0.5 (the ears must stick out above it) |
| tail | 0.8 |
| legUpper | 0.6 |
| legLower | 0.4 (the "leg puffs" the Pom-pom cut keeps) |
| head | 0.10 |
| muzzle | 0.03 |

Every vertex keeps a minimum skin fuzz (`minLen` = 0.006 m), so a shorn
animal still looks soft, not bald.

### 5. Shell fur rendering

The skin mesh is drawn as an `InstancedBufferGeometry` with `N` instances,
one per shell (N is a parameter, 16–64, default 40). The instance attribute
is `h ∈ (0, 1]`. Shell 0 is the opaque skin pass, drawn in the skin colour.

**Vertex shader:**

- `p = pos + n · len · h + droop`: the shells scale with the local
  length, so short fuzz stays dense
- `droop = gravityDir · droopAmt · len · h²`
- add a wind sway, sinusoidal in time and in `pos`, scaled by `h²`
- then apply the breathing and head transforms (section 8).

**Fragment shader:**

- The **strand mask** is a tileable value-noise texture (256², NearestFilter
  on the strand layer, linear on the clump layer). It is sampled by
  dominant-axis planar projection of the *base* position × density. Curl
  rotates the sample offset by `curl · h` around the normal.
- The strand exists where `noise > hc^thickness`, which gives tapered
  strands. Here `hc = h · len / base` is the height along the *original*
  strand, so clipped strands end blunt and plush instead of re-tapering.
  Fluffiness lowers the threshold so the coat looks denser.
- `discard` where the strand mask fails.
- Colour: `mix(rootColor, tipColor, h)`, times a self-shadow
  `mix(aoRoot, 1, h)`. Lighting is wrapped Lambert plus a hemisphere light
  plus a soft rim (Kajiya-like) highlight from the key light.

The fur casts no shadow map. A soft radial blob shadow texture on the floor
sits under the animal.

### 6. Brush and hit testing

This part is pure and tested.

**`pickFur(ray, verts, len, deform)`.** For each vertex facing the camera,
the tip is `pos + n · len` (after deformation). It returns the smallest ray
`t` among vertices whose tip lies within `pickRadius` of the ray. It also
considers the skin hit, so the brush lands on the visible fleece surface
even for overhanging fluff beyond the skin silhouette.

**`applyBrush(state, hit, ray, tool, params)`:**

- **Affected set:** vertices whose tip lies within `R` of the ray and whose
  `t ∈ [tHit − R, tHit + R + maxLen]`. That depth window means a stroke
  never cuts through to the far side.
- **Weight** `w = (1 − smoothstep(R·hardness, R, dist)) · strength`, with
  hardness ∈ [0, 0.95]. Regrow and fluff also scale by dt.

The tools:

| Tool | Effect |
|---|---|
| Clippers | `len ← max(guard, len − w·(len − guard))`, only where `len > guard` |
| Scissors | `len ← len − w·snip` (snip = 0.03 m per pass), floored at the guard |
| Regrow | `len ← min(base, len + w·rate)` |
| Fluff | `len ← min(base·1.15, len + w·rate·0.5)`: puffs a little past the original |

The brush returns `removed[]`, the length removed at each vertex, which feeds
the clippings and the wool mass.

The brush is a plain loop over all vertices. At ≤ 45k vertices that is
well under 2 ms, so a spatial hash is not needed.

**Wool mass.** `Σ area_i · removed_i · fleeceDensity`, with fleeceDensity
= 12 kg/m³ for loose fleece. That puts a full llama shear at about 2–4 kg,
which matches real llama clips. The total is shown as "Fleece collected:
2.37 kg".

### 7. Clippings

An `InstancedMesh` of a low-poly fluffy tuft (a jittered icosahedron),
capped at `maxClippings` (default 2500) as a ring buffer.

- **Spawn:** per cut vertex, with probability ∝ removed length. The position
  is the old tip region; the colour is the vertex's fleece colour; the size
  is ∝ removed length.
- **Physics:** gravity, air drag with a flutter (a small sinusoidal lateral
  force), a floor bounce with restitution 0.2 and friction, then sleep.
  There are no inter-tuft collisions. Piles form because the tufts land on
  the floor at slightly offset heights, `y = r · stack noise`.
- **Lifetime:** "Clipping lifetime" (∞ or 10–120 s) fades and shrinks old
  ones. A "Sweep floor" button clears them all.

### 8. Animation

- **Breathing:** the body-region vertices scale along their normals by
  `1 + 0.012 · sin(0.9·2π·t)`.
- **Head follow:** the head yaws and pitches gently towards the cursor
  (clamped to ±25° yaw and ±12° pitch, critically damped). The vertex shader
  rotates vertices about the neck pivot, weighted by `headW`. `headGroup`
  uses the same transform. The CPU uses the same `deform()` function in
  shared code, so picking matches the screen.
- **Blink:** random every 2–6 s; the eye squashes vertically over 160 ms.
- **Ears:** a random twitch, plus a flick when the brush is near the head.
- **Happy wiggle:** while cutting, a "contentment" value rises. Above a
  threshold the animal does a small hop or squash and its eyes turn into
  `^ ^` arcs for a moment. This can be turned off.

All of these can be toggled.

### 9. Before/after

- Hold **B** (or the "Hold for before" button) to render `base[]` instead of
  `len[]`. Both are vertex attributes, and a uniform blends between them.
- **Split compare:** a toggle with a draggable divider. Left is the original
  and right is the current state. It renders twice with a scissor rectangle.
- **Snapshot:** saves the current length array into one of three slots, so
  you can flip between cuts.

### 10. Presets: style cuts

Each animal has 1–2 named cuts:

| Animal | Cuts |
|---|---|
| Llama | "Pom-pom" (shorn body and neck, fluffy topknot, tail pom, leg puffs), "Lion" (shorn rear half, full mane on the neck and chest) |
| Alpaca | "Shorn with topknot" |
| Sheep | "Full shear" |
| Poodle | "Continental" |

A cut is a per-region target length. It is applied **animated** over about
3 s, sweeping from back to front, with the clippings spawned as if clipped
by hand.

## Parameters panel

The panel has collapsible cards in the house style of `3d-wrecking-ball`.

| Card | Contents |
|---|---|
| Animal | Llama / Alpaca / Sheep / Poodle buttons; chubbiness; coat colour presets (cream, white, caramel, chocolate, grey, black); Reset fleece; style cut buttons |
| Tool | Clippers / Scissors / Regrow / Fluff; brush radius (0.03–0.4 m); guard length (0–0.08 m); strength; hardness |
| Fleece | Max length (0.05–0.40 m); density (strands per unit); strand thickness; curl; fluffiness; droop; wind strength; shell count; root colour; tip colour |
| View | Hold for before; split compare; snapshots 1–3; auto-rotate; lighting angle; background (salon, pasture, studio dark) |
| Clippings | Max clippings; lifetime; Sweep floor |
| Animation | Breathing, head follow, blink, happy wiggle (checkboxes) |
| Readout | Fleece collected (kg); % of coat removed; vertex count; FPS |

**Controls:**

- Left-drag on the animal: cut.
- Left-drag on the background, or right-drag: orbit.
- Wheel: zoom.
- Ctrl/Cmd+Z: undo, a stack of 20 stroke snapshots.
- `1`–`4`: pick a tool.
- `[` `]`: brush size.
- `B`: before.

A translucent ring decal shows the brush under the cursor, sitting on the
fleece surface.

## Testing

`test.mjs` runs `HaircutTests.run()` in Node:

1. The SDF primitives return the correct signed distances at known points.
   Smooth-min is ≤ min and equals min when the primitives are far apart.
2. Surface nets on a sphere SDF: the vertices satisfy |sdf| < 0.01·r, the
   mesh is closed (every edge is shared by exactly 2 triangles), normals point
   outward, and the total area is within 3% of 4πr².
3. The llama recipe meshes to 20k–45k vertices and is closed. The default
   lengths are longest on the body and shortest on the muzzle.
4. The clippers never raise a length and never go below the guard. Regrow
   never exceeds base. Repeated strokes converge to the guard.
5. Depth window: a brush aimed at the near side of a sphere leaves the far
   hemisphere untouched.
6. Wool mass: shearing a uniform-length sphere completely to 0 gives
   ≈ area · len · density (within 3%).
7. Applying `deform()` with an identity head transform and zero breath is an
   identity. The head rotation moves head vertices and leaves the body ones
   alone.
8. Each style-cut preset produces target lengths ≤ base everywhere.

**Visual verification:** headless Chrome screenshots (plain `--headless=new`,
real GPU) of the uncut llama and of the llama after the Pom-pom cut, side by
side. Then check in the Browser pane that cutting, the clippings and the B
toggle work.

## Out of scope

- Strand-level physics.
- A shadow map from the fur.
- Full skeletal animation: walking, lying down.
- Sound. It could be a later extension: clipper buzz, a llama hum.
- Saving to disk.
