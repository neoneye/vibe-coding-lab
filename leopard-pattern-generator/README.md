# Leopard pattern generator

A standalone page that grows big-cat coat patterns with a Turing
reaction–diffusion model. Leopards are thought to get their rosettes in two
stages:

- **As a cub,** two chemicals settle into solid spots, called flecks.
- **As the animal grows,** three parameters change in turn. The spots open
  into rings, and the rings break into rosettes.

The page also has an instant procedural mode. Every pattern tiles seamlessly.
You can shade it as fur, export it as a PNG at up to 4096 px, and preview it
on a 3D cat.

Open `index.html` in a browser that supports WebGL2. Three.js loads from
jsDelivr.

## Features

- **Presets:**
  - leopard and jaguar, which follow the paper's schedules;
  - cheetah and snow leopard, which are the page's own analogies;
  - custom, with live sliders for D, δ and r₂.
- **The growth view:** play, pause and step through the simulation. A timeline
  marks the stages and the parameter changes, and a dispersion-curve plot shows
  which spot sizes are growing.
- **The simulation:** paint or erase pigment on the running simulation; choose
  a seed for a reproducible start, a grid of 256, 512 or 1024, and a rosette
  size.
- **Coat rendering:** edit the colours; turn fur shading on or off; add a pale
  belly (which breaks the tiling); set the pigment threshold; check the seams
  in a 2 × 2 view.
- **Fast mode:** procedural rosettes on a torus, with sliders for size, ring
  break-up, thickness, flecks and irregularity.

## The model

R. T. Liu, S. S. Liaw and P. K. Maini, *Two-stage Turing model for generating
pigment patterns on the leopard and the jaguar*, Phys. Rev. E 74, 011914
(2006). The paper uses Barrio et al.'s model:

- ∂u/∂t = Dδ∇²u + αu + v − r₂uv − αr₃uv²
- ∂v/∂t = δ∇²v − αu + βv + r₂uv + αr₃uv²

**Stage 1:** D = 0.45, δ = 6, α = 0.899, β = −0.91, r₂ = 2, r₃ = 3.5.

**Stage 2:**

| | Leopard | Jaguar |
|---|---|---|
| 1 | r₂ goes 2 → 7 | r₂ goes 2 → 7 |
| 2 | δ goes 6 → 3.8 | δ goes 6 → 1.8 |
| 3 | D goes 0.45 → 0.15 | D goes 0.45 → 0.15 |

The page's own choices, which it also lists:

- **The timings,** which the paper does not give. Each parameter changes 10
  time units after the previous one. Slower changes let a barely damped
  uniform oscillation wipe out the rings: at k = 0, Re λ = −0.0055.
- **The start:** noise of ±0.1 around the steady state. The paper's start, in
  [0, 1], sometimes blew up.
- **Periodic boundaries,** so the pattern tiles seamlessly.
- **The numerics:** a 9-point Laplacian and explicit Euler.
- **Everything about rendering.**

The simulation runs on the GPU as a WebGL2 shader. A copy of the same step in
plain JS is the reference that the tests run.

## Tests

```
node test.mjs
```

The tests run in about 10 seconds. They check:

- the dispersion relation: the peak is at k = 0.27, as in the paper, and it
  shifts as 1/√δ;
- the 9-point Laplacian and the periodic wrap-around;
- stage 1 gives about the expected number of solid flecks;
- the leopard and jaguar schedules turn the spots into rings and broken rings;
- the simulation stays finite for eight seeds;
- the procedural tile wraps exactly, and its seed is deterministic.
