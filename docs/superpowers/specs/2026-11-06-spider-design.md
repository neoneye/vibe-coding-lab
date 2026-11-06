# Spiders: design notes

- **Date:** 2026-11-06.
- **Directory:** `spider/`. It holds a single `index.html`, plus `test.mjs` and `screenshot1.jpg`.
- **Sister page:** `centipede/`. See `2026-11-06-centipede-design.md` for the shared style.

## What the owner asked for

- "make a similar dir for spiders. I imagine there are lots of parameters for spiders. hair, eyes, legs, movement pattern, if it's a jumping spider or a daddy longleg".
- On "daddy longlegs" meaning several animals: "all of those types of spiders. I'm no expert in spider terminology".
- On what the spider does: "do something similar to the milipedes". That means a segmented control of modes, species cards that set every parameter, a 3D low camera with fish-eye, and educational text.

Everything not quoted above is my call.

## Intent

A faithful, educational model of how spiders are built and move, close up and a little menacing.

- The parameters are the anatomy (body, legs, eyes, hair, fangs) and the behaviour (gait, movement pattern, jumping, defence).
- Changing them shows why a jumping spider, a cellar spider and a tarantula look and move so differently.
- Not a game: no score, no play-as mode.

## Modes (segmented control)

- **Walk.** Walking across leaf litter. The movement pattern is a parameter: continuous, stop-and-go (pauses and turns to look), small hops, or sideways like a crab spider.
- **Jump.**
  - **Sequence:** crouch, fix a safety dragline, launch, fly, land on the front legs.
  - **How it launches:** spiders have no muscles to straighten two of their leg joints. They extend them with blood (haemolymph) pressure, and jumpers push off with legs III–IV.
  - **What the sliders set:** take-off speed follows from leg pressure, the extending legs' length and thickness, and body mass. The jump distance and g-force then follow from the ballistics.
  - **Non-jumpers:** every animal can try, so a house spider makes a small hop.
- **Climb.** Over stones, logs and twigs, as on the centipede page, scaled to the leg span. The body tilts to the plane of its feet.
- **Threat pose.** The style is a parameter:
  - rear up showing the fangs (tarantula, house spider);
  - raise the front legs (jumping spider);
  - whirl the body fast (cellar spider, which blurs itself in its web);
  - bob up and down (harvestman);
  - curl the legs and play dead.

## Model (my calls)

- **Engine.** `SpiderCore` is plain JS in `<script id="shared-code">`, tested by `test.mjs`. It is kinematic, with real ballistics for jumps. three.js draws its output.
- **Legs.** 8 legs from the sides of the front body (prosoma).
  - Each leg is drawn with its 7 segments: coxa, trochanter, femur, patella, tibia, metatarsus, tarsus. It is solved as three bones: femur, patella+tibia, metatarsus+tarsus. The knee, the femur–patella joint, sits high above the body, by an "arch" parameter.
  - The leg angles fan from forward (I) to backward (IV). A laterigrade switch turns the legs sideways, as in crab spiders and huntsmen.
- **Gait.**
  - **Alternating tetrapod:** L1, R2, L3, R4 step together, then R1, L2, R3, L4.
  - **Parameters:** duty factor, phase lag along each side, and speed (frequency = speed ÷ stride).
  - **Feet:** a planted foot stays planted; a swinging foot arcs forward.
- **Hydraulics.**
  - A leg-pressure slider sets how straight the legs stand.
  - At zero pressure the legs curl in, as they do when a spider dies.
  - In a jump the pressure peaks: resting pressures of a few kPa rise several-fold.
- **Body.**
  - **Prosoma:** length, width, height and head-region height, with jumping spiders' raised, boxy head.
  - **Pedicel:** the waist. Its length is 0 for harvestmen, whose body is one fused piece.
  - **Abdomen:** length, width, height, shape (round, oval, long, pointed) and tilt.
  - **Palps:** male palps with bulbs ("boxing gloves").
  - **Chelicerae and fangs:** size, and whether the fangs strike down (tarantulas) or pinch sideways (most spiders).
  - **Spinnerets.**
- **Eyes.** Arrangement presets:
  - 8 eyes in two rows (house spider);
  - the big front pair of a jumping spider plus side eyes;
  - wolf spider 4-2-2 with large rear eyes;
  - 6 eyes in three pairs (cellar spider);
  - 2 eyes on a turret (harvestman);
  - none (cave species).

  Size sliders: principal eyes and others. A "torch" view toggle shows eyeshine from the reflective layer behind the eyes (tapetum) of wolf spiders.
- **Hair.** Length, density, stiffness and colour on the body and the legs, baked into the meshes. Leg spines are separate.
- **Look.** Body and leg colours, leg bands, and an abdomen pattern drawn into a texture: none, stripes, chevrons, cross, spots, or a red hourglass under the belly. Also gloss and iridescence (the jumping spider's green fangs).

## Species presets (cards with facts, "Use these settings")

1. **Giant house spider**, *Eratigena atrica*.
2. **Garden cross spider**, *Araneus diadematus*.
3. **Jumping spider**, *Phidippus audax*, the bold jumper.
4. **Wolf spider**, *Pardosa*/*Hogna*.
5. **Mexican red-knee tarantula**, *Brachypelma hamorii*.
6. **Cellar spider**, *Pholcus phalangioides*. One of the animals called "daddy longlegs".
7. **Crab spider**, *Misumena vatia*.
8. **Black widow**, *Latrodectus*.
9. **Harvestman**, Opiliones. Not a spider, and also called "daddy longlegs". The card explains the difference: one fused body, two eyes, no silk, no venom, and the second legs used as feelers.

The crane fly, the third "daddy longlegs", is an insect, so it is mentioned in the text only.

## Page

The layout matches the centipede page:

- the stage with the mode control and the camera choice above it;
- a readout below;
- the parameter panel in collapsible groups (Body, Legs, Eyes, Hair, Movement, Jump, Look, View);
- cards, a "spider or not?" table, and "how spiders move" sections.

## Left out

- Web building and silk physics. Only the jump dragline is drawn.
- Air drag on jumps.
- Real contact forces.
- Walls and undersides (the heightfield has tops only).

## As built (2026-11-06)

### Jumps

- **Take-off speed.** v = √(2·(push − 1)·g·stroke), where the stroke is 0.8× the mean length of the pushing legs.
- **Aiming.** The spider aims: it jumps short when the target is closer than its reach.
- **Range.** The jumping spider preset (push 5×, 28°) reaches about 3 body lengths at 0.73 m/s. Published figures are about five times body weight at take-off and up to about six body lengths. The page notes the 2018 finding (Nabawy et al., regal jumping spider) that leg muscles alone could power the jump, so pressure is not used for the jump.
- **Take-off height.** The body leaves from its standing height, so landing matches v²·sin 2θ / g. This is tested.

### Posture and gait

- **Pressure and posture.** 6 kPa is the normal posture. Below about 2.5 kPa the legs curl in under the body and the body sinks.
- **Body tilt.** The body rides on a least-squares plane through the planted feet, which gives pitch and roll when climbing.
- **Leg shape.** A leg is coxa, then a femur at an elevation set by "knees raised", then patella+tibia and metatarsus+tarsus solved as two bones.

### Look

- **Eyes.** Eye layouts are hand-placed on the prosoma surface.
- **Eyeshine.** It appears only with the torch: emissive ∝ tapetum × facing⁴.
- **Hair.** Hair is baked as thin cones on the body and as cones in the leg bone templates (squashed along the bone axis).

### Calls the owner may revisit

- **Thumbnail.** The jumping spider raising its front legs.
- **Default animal.** The giant house spider.
- **Speeds.** Preset speeds are typical; only the house spider's 0.5 m/s is a measured figure.

### Verification

- **Core tests.** 16 tests in `test.mjs`.
- **Selftest.** `?selftest` covers every control and every animal in every mode, plus jump, curl and visibility checks. It passes in Chrome, Firefox and Safari.
