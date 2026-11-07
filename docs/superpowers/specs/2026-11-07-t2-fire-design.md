# T2 Fire — design (as built)

**Date:** 2026-11-07
**Page:** `t2-fire/index.html` (one self-contained WebGL2 page, no dependencies)

## Intent

The owner asked for a standalone page that simulates fire and flames as seen in *Terminator 2: Judgment Day*, with lots of parameters. The background image must be replaceable. With no image, a random T2 quote is shown instead.

Their reference folder (`~/Desktop/vibe-coding-fire/`) held:
- the *Judgment Day* poster (a chrome skull seen through see-through yellow-orange flames);
- film stills (the T-1000 walking out of the steel-mill fire, dense gasoline flames);
- flame photographs;
- `terminator-2d-crappy-fire.jpg`, a tiled, repeating wave pattern. The owner confirmed it is the look to beat ("you can do way better than that").

The owner never answered whether the picture itself should burn. As built, the fire sits in front of the picture by default. Burning is opt-in: **Picture burns** (bright pixels give off fuel) and **Picture chars** (the hottest places scorch the picture).

## As built

### Simulation (GPU, half-float ping-pong)

**Grids:**
- Air: velocity and pressure on a grid of 96 to 320 cells across the short side (default 224).
- Flame: temperature, fuel, smoke and burn rate on a grid 1 to 4 times finer (default 4, capped at the canvas resolution).

**Each step:**
1. Brush stamps, laid along the whole pointer path since the last step.
2. Combustion. Fuel enters from the sources, collected along the path the gas travels this step, then:
   - pilot heat moves toward a target at a finite rate;
   - burning switches on smoothly above the ignition temperature;
   - burning releases heat and smoke;
   - cooling goes as `exp(-dt·cool·(0.8+1.2T²))`.
3. Optional scorch accumulation.
4. Forces:
   - buoyancy, measured against a blurred local "ambient" temperature (blend 0.6);
   - smoke weight;
   - wind as relaxation toward a gusting target speed;
   - curl-noise turbulence;
   - vorticity confinement;
   - a light 4-neighbour viscosity.
5. Projection. Divergence minus an expansion source taken from the burn rate, then Jacobi pressure iterations (warm start 0.8). The floor is closed; the sides and top are open.
6. Advection. Semi-Lagrangian for velocity, MacCormack with limiter for the flame fields. Air arriving from outside the frame is fresh and cool.

**Fuel sources:**
- floor (patchy);
- wall of fire (sparse ignition spots that move and climb up to a set height);
- fuel pools (random ellipses);
- painted fuel (persistent mask);
- picture luminance.

### Look

- **Palette:** temperature maps to colour and opacity through a 256-entry LUT. The palettes are poster yellow, film stock, blackbody (Tanner Helland fit), blue gas, green chemical and retro (stepped).
- **Composite pass:**
  - heat shimmer that bends the picture;
  - orange tint;
  - scorch with ember edges;
  - firelight from a deep bloom level;
  - fine displacement plus upward streak texture on the flames, so they do not look like smooth lava;
  - smoke darkening;
  - bloom, a soft-shoulder tone curve, vignette, an optional 2.39:1 frame, and film grain.
- **Quote card:** drawn on a 2D canvas in chrome-gradient Impact capitals, with the speaker's name underneath. It is fitted by `FireCore.fitQuote`. Clicking the quote picks a new one, never the same line twice in a row.

### Controls

- About 50 parameters in 7 groups, plus 7 presets:
  - Judgment Day poster (the default)
  - Steel mill blaze
  - Burning floor
  - Fuel pools
  - Scorching wind
  - Slow and tall
  - Retro demo fire
- Buttons: Randomize, Defaults, Save PNG (canvas only), Reset fire, Clear painted fuel, Hide controls.
- Pictures: choose a file, drag and drop, or paste.
- Settings are kept in the URL hash.
- Keys: space, R, Q, S, H.

### Tests

`node t2-fire/test.mjs` runs `FireCore.Tests`, about 300 checks:
- preset keys and ranges;
- hash round trip;
- randomize stays in range;
- quotes never repeat back to back;
- quote fitting;
- picture fit transforms;
- palette monotonicity;
- blackbody sanity;
- pools stay inside the frame.

## Lessons (from tuning)

- **Ripples and combs came from forcing that ignored the time step.** Clamping temperature to the pilot value every step made a relaxation oscillator. At high flow speed, stamping the source once per step left gaps of v·dt between deposits. The fixes were a finite pilot rate, sources swept along the gas path, and a softer ignition window. Proof: 4× sub-stepping made the artefact vanish.
- **Buoyancy against a whole-row mean** gave a uniformly burning floor no lift. Absolute buoyancy with open sides pulled jets in sideways. A blurred local ambient temperature blended at 0.6 sits between the two.
- **An open floor** (air coming in from below) produced banding in the time step. The floor stays closed (`TUNE.floorOpen`).
- **Unbounded wind force** saturated the velocity cap and blew the fire out. Wind is now a target speed.
- `window.__fire.TUNE` keeps these internal choices available for debugging.

## Verified

- Chrome (Browser pane): every preset, painting, picture loading, phone layout at 375 px with no horizontal scroll, Save PNG blob.
- Firefox: headless screenshot.
- Not checked: Safari, and real touch devices.
