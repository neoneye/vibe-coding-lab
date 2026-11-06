# Centipede and millipede simulator: design notes

- **Date:** 2026-11-06
- **Directory:** `centipede/`. It holds a single `index.html`, plus `test.mjs` and `screenshot1.jpg`.

## What the owner asked for

- "a centipede/milipede simulator, with lots of parameters for number of segments, the shape of segments, the number of legs per segment, the bendability per joint."
- "3d with slight fish eye lens, to enhance their scariness."
- "segmented control with the 3 different modes: walking across the ground, coiling up, climbing over things".
- "educational info about the most common types of these animals. Where the settings can be set to each of them."
- They then said "I think you make some good decisions. Go ahead and impl". Everything below that is not quoted is my call.

## Intent

A faithful, educational model of how many-legged animals move, drawn close up and a little menacing:
- a low camera;
- a fish-eye lens;
- glossy chitin;
- dark forest-floor light.

The parameters are the anatomy and the gait. Changing them shows why each real animal moves the way it does. There are no game mechanics.

## Model (my calls)

### Engine and rendering

- **Kinematics, not rigid-body physics.** `CentipedeCore` is plain JS in `<script id="shared-code">` and is tested by `test.mjs`. It computes everything:
  - segment frames;
  - leg phases;
  - footholds;
  - two-bone leg IK.
- **Rendering.** three.js draws the core's output with instanced meshes. Fish-eye is a post pass on a render target.

### Body

- **Chain.** The body is a chain of a head plus N trunk segments. In walk and climb mode, it uses follow-the-leader: the head steers, and each joint is dragged behind the one in front at a fixed spacing.
- **Joint limits.** Each joint is clamped to a side-bend (yaw) limit and an up/down-bend (pitch) limit per joint.
- **Bridging.** A stiff body cannot drape over a log, so it bridges and its legs reach down.
- **Clearance.** The body is never pushed into the ground.

### Legs and gait

- **Leg layout.** The layout is set per segment:
  - leg pairs per segment (centipede 1, millipede 2);
  - legless front segments (millipede collum);
  - single-pair front segments (millipede segments 2–4);
  - legless rear rings.
- **Centipede extras.** The first pair is drawn as forcipules (venom claws, not walking legs). The last pair can be enlarged trailing "ultimate legs".
- **Gait (after Manton's parameters).**
  - Every leg has a phase. Leg pair k runs at phase `f·t ∓ k·lag`. The sign gives a retrograde wave (head to tail, as in centipedes) or a direct wave (tail to head, as in millipedes).
  - Left and right legs are either in antiphase (centipedes) or in step (millipedes).
  - The duty factor β is the fraction of each cycle a foot is on the ground.
  - Frequency follows from speed: f = speed / stride, where stride = step length / β (span over duty factor).
- **Footholds.** A stance foot is planted in the world and does not slide. A swing foot arcs to a foothold half a span ahead of its hip's neutral point, on the terrain.
- **Undulation.** Lateral body undulation is a travelling wave, applied on top of the chain and growing with speed. It is used for fast retrograde-wave centipedes; direct-wave millipedes have none.

### Coiling

The animal stops, then bends joint by joint from the head towards a target shape. Each joint angle is clamped to the bend limits, so a stiff body cannot close its coil, and the readout says so. There are three styles:
- **Spiral (juliform millipedes).** The body rolls onto its side and flexes ventrally into a flat spiral, head at the centre and legs inside.
- **Ball (pill millipedes).** A ventral flexion into a circle; the domed tergites make a ball.
- **Curl (centipedes).** A lateral curl on the ground, as brooding females do. Centipedes do not roll up defensively.

### Terrain and scale

- **Terrain.** An analytic heightfield: ground, embedded ellipsoid stones, logs (cylinder tops) and twigs. Climb mode fills the arena with them; walk mode is open ground with leaf litter in the texture.
- **Scale.** The scene is scaled to the animal's body length so every species fills the view. A scale bar shows the real size. Speeds are in real mm/s, and there is a slow-motion control.

## Species presets (cards with facts, "Use these settings")

| Species | Group | Preset build | Notes |
|---|---|---|---|
| House centipede, *Scutigera coleoptrata* | centipede | 15 leg pairs, about 30 mm | very long legs, longest at the rear; runs at about 0.4 m/s with its body held straight |
| Stone centipede, *Lithobius forficatus* | centipede | 15 leg pairs, 20–30 mm | the common garden centipede of Europe |
| Giant centipede, *Scolopendra subspinipes* | centipede | 21 leg pairs, up to about 20 cm | flattened tergites, ultimate legs |
| Soil centipede, Geophilomorpha | centipede | 27–191 pairs (always odd); preset 49 | blind, worm-like, burrows; very flexible |
| Giant African millipede, *Archispirostreptus gigas* | millipede | about 256 legs, up to 38.7 cm (Guinness) | coils into a spiral |
| White-legged snake millipede, *Tachypodoiulus niger* | millipede | 41–56 rings, up to about 6 cm | glossy black body, white legs |
| Flat-backed millipede, *Polydesmus angustus* | millipede | 20 rings, 30–31 pairs | eyeless, with lateral keels (paranota) |
| Pill millipede, *Glomeris marginata* | millipede | 17–19 pairs, about 15–20 mm | rolls into a ball |
| *Eumillipes persephone* | millipede | 1306 legs, 330 segments, 95 mm | the record holder (Marek et al. 2021) |

## Controls

- **Mode:** a segmented control for Walk, Coil up and Climb.
- **Body:** segments, length, cross-section (round, flattened, keeled, dome), width, flatness, keels, taper, bulge, and the joint gap.
- **Legs:** pairs per segment, the front and rear layout, leg length, the rear growth, thickness, ultimate legs, and antennae.
- **Joints:** side-bend and up/down-bend limits.
- **Gait:** speed, step length, duty factor, legs per wave, wave direction, left/right coupling, and undulation.
- **Look:** colours, pale tergite margins, and gloss.
- **View:** the camera (follow, head-on, top-down, free orbit), fish-eye strength, and slow motion.
- **Save image.**

## Left out

- Real contact dynamics and slipping.
- Climbing vertical walls and undersides (the heightfield only has tops).
- Burrowing.
- Self-collision while walking.

## As built (2026-11-06)

### Body and legs

- **Legs.** Centipede legs attach at the sides and splay out, with the knee pointing up and out. Millipede legs ("ventral" for any section other than flattened) attach under the body, near the midline, and point straight down with no fan.
- **Segment shape.** Segments are superellipse rings, overlapping backwards: each rear edge, which carries the pale margin, lies over the next segment's narrower front.
- **Head.** A shield (centipede) or a capsule tilted down (millipede), with ocelli. The house centipede gets compound eyes (antennae longer than 6× width).

### Gait

- **Undulation.** A travelling lateral wave with a wavelength of 0.6 N segments, advancing half a wave per stride and growing with speed. This is my simplification.
- **Frequency.** Speed ÷ (span ÷ duty factor).

### Bridging and penetration

- **Bridging.** A link that would go into the ground is tilted upwards past its pitch limit until it clears, while its side-bend limit still holds.
- **Reach.** When climbing, up to about 20% of feet can be momentarily beyond reach. This is accepted: the legs reach down while the body bridges.

### Coil

- **Spiral and curl.** An Archimedean spiral with a pitch of 1.08× the body thickness. The inner radius is raised until the tightest joint is within its limit, so stiff bodies make a loose spiral with a hole.
- **Ball.** A circle; it closes only if 360°·L/length fits within the pitch limit.
- **Readout.** It says which case applies and gives the numbers.

### Climbing arena

- **Layout.** About 30 stones, 3 logs plus one across the start, and 9 twigs within 2.7 body lengths.
- **Steering.** The head wanders within 2.2 body lengths of the centre.
- **Scale.** Everything is scaled to the body length.

### Camera

- **Modes.** Low by the head (default), head-on, whole body, from above, and free orbit. A mouse drag switches to free orbit; on touch screens a swipe still scrolls the page.
- **Distance.** There is a distance slider instead of wheel zoom, so the page still scrolls.
- **Fish-eye.** A post pass that blends rectilinear into tan-mapped radii (corners fixed), with slight chromatic fringing and a vignette.

### Verification

- **Core tests.** 19 tests in `test.mjs`.
- **Selftest.** `?selftest` runs every control, and every species in every mode, with a visibility check. The ball closes, and fails to close when stiff. It passes in Chrome, Firefox and Safari.
