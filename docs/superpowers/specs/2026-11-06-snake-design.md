# Snakes: design notes

- **Date:** 2026-11-06.
- **Directory:** `snake/`, holding a single `index.html`, plus `test.mjs` and `screenshot1.jpg`.
- **Sister pages:** `centipede/` and `spider/`.

## What the owner asked for

I offered snakes as the next page in the series: a long chain of vertebrae that each bend a little, and four ways of moving that can come out of the settings rather than being animated. The owner replied: "snakes.. go ahead impl".

Everything below is my call, built on the style of the sister pages:
- a segmented mode control;
- species cards that set every parameter;
- a low camera with a fish-eye lens;
- educational text;
- no game mechanics.

## Modes

The segmented control has five modes.

- **Slither (lateral undulation).**
  - **Physics.** The shape is a curvature wave running from head to tail. The motion of the body comes from friction alone. At each instant the model solves for the rigid velocity (vx, vz, ω) that makes the net friction force and torque zero, with anisotropic Coulomb friction (forward μf, backward μb, sideways μt). This is the quasi-static model of Hu et al. 2009 (PNAS 106:10081).
  - **Defaults.** Their measured μf 0.11, μb 0.14, μt 0.20.
  - **Equal friction.** With isotropic friction the snake goes almost nowhere, as on glass.
  - **Grass and stones.** "Grass and stones to push against" adds sideways grip. This is my approximation of pushing against pegs.
  - **Lifting.** "Lift the curves" puts the weight on the straight parts, between the curves, as Hu et al. observed. They report it adds about 35% speed.
- **Concertina.** Kinematic, inside a ring-shaped tunnel.
  - The tail folds anchor against the walls while the front unfolds and the head moves ahead.
  - Then the head anchors and the front refolds, pulling the rest forward.
  - Settings: the number of folds, how tight they are, and the cycle time.
- **Sidewind.** The same friction physics on sand.
  - **Waves.** A horizontal wave plus a lifting wave a quarter-cycle out of step.
  - **Contact.** Only the lowered stretches bear weight. The body moves sideways at an angle and leaves the parallel, J-shaped tracks of a sidewinder.
- **Creep (rectilinear).** The body stays straight and moves at a steady speed. Waves of skin stepping run back along the belly: the belly scales bunch and stretch while the skeleton slides smoothly. This is how big heavy snakes (pythons) creep.
- **Strike.** Kinematic.
  - **Styles:** a viper's S-coil with the neck raised; a cobra rearing up with its hood spread; a constrictor's low lunge.
  - **Strike.** The head shoots out to a reach (a fraction of body length) in tens of milliseconds and pulls back.
  - **Rattle.** Rattlesnakes shake the rattle at 60–100 Hz (Forsthofer et al. 2021).

Tongue flicks happen in every mode.

## Parameters

- **Body:**
  - vertebrae (one enlarged belly scale per trunk vertebra);
  - length and girth;
  - cross-section (round, flat belly, tall and slim);
  - neck, tail fraction and tail taper.
- **Head:**
  - shape (oval, viper triangle, cobra, python, blunt);
  - size, eyes and pupil (round or vertical slit);
  - hood, horns, rattle segments, tongue.
- **Joints:** side bend and up/down bend per vertebra.
  - Side bend limits the wave amplitude and the coil tightness.
  - Up/down bend limits rearing and sidewinding lift.
- **Belly scales:** μf, μb, μt, grass/stones, and lifting the curves.
- **Movement:**
  - wave frequency, waves along the body, wave amplitude;
  - sidewinding lift and phase;
  - concertina folds, fold angle and cycle;
  - creep speed and skin waves;
  - wandering.
- **Strike:** style, reach, strike time, how often.
- **Look:**
  - base, pattern, belly and head colours;
  - pattern (plain, stripes, blotches, diamonds, zigzag, bands, collar, spectacle);
  - pattern size, gloss, scale size, keeled scales.

## Species

- **Grass snake**, *Natrix natrix*: Europe, yellow collar.
- **Common garter snake**, *Thamnophis sirtalis*.
- **Western diamondback rattlesnake**, *Crotalus atrox*.
- **Sidewinder**, *Crotalus cerastes*.
- **Burmese python**, *Python bivittatus*.
- **Indian cobra**, *Naja naja*.
- **Corn snake**, *Pantherophis guttatus*.
- **European adder**, *Vipera berus*: Denmark's only venomous snake.
- **Brahminy blind snake**, *Indotyphlops braminus*: the tiny all-female flowerpot snake.

Vertebra counts are estimated from typical ventral plus subcaudal scale counts.

## Left out

- Swimming.
- Climbing trees.
- Inertia: real snakes slithering fast are not purely quasi-static.
- Swallowing prey.

## As built (2026-11-06)

### Friction physics

- **Solver.** Each substep runs Newton with a numeric Jacobian on (vx, vz, ω).
  - The Coulomb friction is regularised by ε = 0.02 of the wave speed.
  - Forward and backward μ switch smoothly (tanh).
  - The friction is weighted by mass (∝ r²) times contact.
- **Measured behaviour.**
  - With Hu's coefficients and no grass, the grass snake moves at about 8% of the wave speed.
  - With equal friction it slides about 5% backwards: "slips like on glass".
  - At the default grass setting of 0.3 it slithers at about 0.38 lengths/s.
  - Lifting the curves gives more than 10% extra speed (tested). Hu reports 35%.
- **Grass and stones.** They are added to the sideways friction as 1.6 × the setting. This is my approximation.

### Kinematic modes

- **Concertina.**
  - A ring tunnel, so the snake can go on forever.
  - A two-phase cycle: tail anchored while the front unfolds, then head anchored while the front refolds.
  - Axial steps are corrected for the ring radius.
  - The walls are set exactly at the fold width.
- **Creep.**
  - The skeleton follows a path at the set speed.
  - Belly skin offset: amp × sin, with amp = v / (2π f), so the skin rests at the troughs. This shows in the scale texture.
  - One belly plate per vertebra.
- **Strike.**
  - The rear of the body lies in an Archimedean coil, whose inner radius is limited by the side bend.
  - The neck is an S-curve solved for its arc length.
  - How high the cobra rears is limited by the up/down bend times the number of neck vertebrae.
  - A reared neck keeps its back to the rear, so the hood spreads sideways.

### Look and layout

- **Body mesh.** The body is one tube mesh updated every frame (20 vertices around each vertebra).
- **Colour and scales.** The pattern is in vertex colours. The scales are a bump texture.
- **Ground.** The ground follows the snake, snapped to whole tiles.

### Verification

- **Core tests.** 13 tests in `test.mjs`.
- **Selftest.** It runs every control and every snake in every mode. It checks friction against glass, sidewinding tracks and a strike. It passes in Chrome, Firefox and Safari. Safari needs a foreground run.
