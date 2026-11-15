# Zebra pattern generator — short design

**Intent.** A standalone page, `zebra-pattern/index.html`, that generates zebra stripes with many
parameters. Sister of `leopard-pattern/`. Owner's references (`~/Desktop/zebra`) are zebra-print
close-ups: mostly black, pale stripes that taper to points, fork and wave.

**Approaches considered.**
1. *Procedural phase field (chosen as the main mode).* Stripes are level sets of a periodic phase.
   A complex noise multiplied onto the carrier wave creates phase vortices, which are exactly the
   Y-forks and stripe ends of a zebra; its amplitude tapers stripes to points. Instant, every
   feature has its own slider, tiles exactly, renders at any export size.
2. *Turing growth (second mode).* Barrio's model from the leopard page with the quadratic term
   off (stripes) and anisotropic diffusion to align them. Faithful to the theory, few direct knobs.
3. *Turing only.* Rejected: cannot give "lots of parameters".

**Design.**
- Engine in a `shared-code` block, CPU renderer shared by both modes, tested by `test.mjs`.
- Procedural groups: layout, waves, forks/taper/gaps, flow (arch, S-bend, fan, converge, fade),
  shadow stripes, edges and hair, coat colours.
- Turing: WebGL2 stepper with a plain-JS twin (also the fallback), sliders for D, δ, α, β, r₂, r₃,
  anisotropy and its direction.
- Presets, seed, randomise, 1×1/2×2/3×3 seam view, PNG export to 4096, share link, honesty panel.
- No 3D preview (owner did not ask for one).

**Left to the builder.** Default values and presets, tuned by eye.
