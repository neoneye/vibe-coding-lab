# Leopard pattern generator

Date: 2026-09-29
Directory: `leopard-pattern-generator/`

## Goal

A standalone page that grows big-cat coat patterns with a Turing
reaction–diffusion model, following the two-stage account of how leopards and
jaguars get their rosettes. It also has an instant procedural mode. The
output is a seamless, fur-shaded texture that you can export as a PNG and
preview on a 3D cat.

## Source

R. T. Liu, S. S. Liaw and P. K. Maini, *Two-stage Turing model for generating
pigment patterns on the leopard and the jaguar*, Phys. Rev. E 74, 011914
(2006).

The paper uses Barrio et al.'s model:

- ∂u/∂t = Dδ∇²u + αu + v − r₂uv − αr₃uv²
- ∂v/∂t = δ∇²v − αu + βv + r₂uv + αr₃uv²

It starts from random values in [0, 1].

**Stage 1 (flecks):** D = 0.45, δ = 6, α = 0.899, β = −0.91, r₂ = 2,
r₃ = 3.5. The most enhanced mode is k ≈ 0.27, so the spots are about 25 px
apart.

**Stage 2 (adult):**

| | Leopard | Jaguar |
|---|---|---|
| 1 | r₂ goes 2 → 7 | r₂ goes 2 → 7, held longer |
| 2 | δ goes 6 → 3.8 | δ goes 6 → 1.8 |
| 3 | D goes 0.45 → 0.15 | D goes 0.45 → 0.15 |

## Choices the page makes itself

The page labels each of these.

- **Periodic boundaries,** where the paper used zero flux. This makes the
  pattern tile seamlessly.
- **A 9-point isotropic Laplacian.** The 5-point one turns spots into squares
  at D = 0.15.
- **A time step** of dt = 0.02·h², where h is the grid spacing.
- **Timings,** which the paper does not give:
  - stage 1 runs to t = 300;
  - leopard: r₂ changes at 300, δ at 310 and D at 320, and the adult pattern
    is at t ≈ 420;
  - jaguar: the changes come at 300, 315 and 325, and the adult pattern is at
    t ≈ 500.
- **Why the steps come so fast.** Near the uniform state the model is a
  barely damped oscillator: at k = 0, Re λ ≈ −0.006 with a period of about 22.
  With slow parameter changes this uniform swing wipes out the rings, which
  the prototype showed.
- **Two more presets, by analogy:**
  - cheetah: stage 1 only, with δ = 3 for finer solid spots;
  - snow leopard: the leopard schedule at a larger scale, with grey colours.
- **A custom preset** with live sliders for D, δ and r₂.

## Rendering

The pipeline has three passes:

1. **The simulation** writes u and v as RG floats.
2. **An analysis pass** writes the pigment amount (a smoothstep of u around a
   threshold θ) and the interior tint (a blurred u, so the inside of each ring
   is darker tawny). Fast mode writes these two channels directly.
3. **A colour pass** combines:
   - the coat, interior and pigment colours;
   - optional fur shading: tileable hair streaks, a normal taken from them,
     and soft light;
   - an optional pale belly, off by default because it breaks the tiling.

Viewing, export and 3D:

- **View:** 1×1, or 2×2 to check the seams.
- **Export:** PNG at 512, 1024, 2048 or 4096 px, rendered at that size from a
  bilinear sample, so the edges stay crisp.
- **3D preview:** Three.js, a stylised cat made of primitives, or a sphere,
  textured with the current tile.

## Fast mode

Instant procedural rosettes on a torus:

- a jittered grid with a whole number of cells per tile, so it tiles;
- each cell holds a broken ring of 3–6 blobs around a tawny centre;
- small flecks between the rings.

Sliders set rosette size, ring break-up, ring thickness, fleck density,
irregularity and seed. It is pure JS, and it is tested.

## Interaction

- Play, pause and step; a speed control; a timeline showing the stages, the
  parameter changes and the current t.
- A dispersion-curve plot of Re λ(k) for the current parameters.
- Painting with the mouse on the running simulation: paint pigment or erase.
- A seed field for reproducible starts.
- Grid size of 256, 512 or 1024; a scale h of 1, 0.75 or 0.5.
- Editable coat colours for each preset.

## Architecture

- **`shared-code`:** the model constants, presets and schedules, `paramsAt`,
  the dispersion relation, a seeded PRNG, the reference CPU simulation
  (`TuringSim`), the pigment analysis (periodic components and holes), and
  the procedural generator.
- **The UI module:** the WebGL2 simulation, which needs float colour buffers
  and mirrors the reference step; the render passes; the UI; Three.js from
  jsDelivr.
- **Without WebGL2 float textures,** the Turing mode shows a notice, and fast
  mode still works on the CPU.

## Tests (`test.mjs`)

- **Dispersion:** Re λ(k) is at its highest near k ≈ 0.27 for stage 1 and is
  positive there, and the uniform mode k = 0 is stable. Lowering δ to 3.8
  moves the peak to a higher k.
- **The PRNG:** it is deterministic, and the same seed gives the same start.
- **The simulation:** stage 1 on a 100² grid gives spots, with a component
  count close to (100/25)² × 1.15, where 1.15 is the hexagonal-packing
  factor, and no holes.
- **The leopard schedule** gives rings: at least a third of the pigment
  components enclose a hole at the adult t.
- **The 9-point Laplacian** is exact on a quadratic, and the simulation keeps
  periodic wrap-around.
- **Fast mode** tiles: the field at x = 0 equals the field at x = W, and the
  same holds for y. The seed is deterministic, and a higher fleck density
  gives more pigment.
