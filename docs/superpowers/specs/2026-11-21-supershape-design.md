# Supershape: 2D light trace and 3D path trace

## Intent
A from-scratch, self-contained page (`supershape/index.html`) with a generalised Gielis superformula in 2D and 3D. It has many more parameters than the classic six (m, n1, n2, n3, a, b), and it is rendered by ray tracing, so light refracts into the shape, bounces around inside (total internal reflection, Fresnel reflection) and splits into colours. The owner asked for it to be built from scratch, without looking at existing supershape pages.

## Goals
- One formula engine shared by both views. Formulas A and B each have m1 and m2 (separate cos and sin symmetry), n1, n2, n3, a, b, a phase, and a ripple (amplitude and frequency).
- **2D view:** the curve is A, B, or a combination of them (A·B, mean, min, max, morph), with turns, spiral growth, rotation, stretch, noise and a hollow shell.
  - The interior is the even-odd fill, so self-crossing curves still work.
  - A laser, beam or lamp sends spectral rays. Fresnel decides reflect or refract at each crossing, TIR is handled, Cauchy dispersion comes from n_d and the Abbe number, and Beer–Lambert absorption applies inside.
  - Rays accumulate additively in a float buffer (WebGL2 lines).
- **3D view:** the spherical product of A (around) and B (up/down), or a supertorus.
  - Deformations: inflate, twist, taper, bend, xyz stretch, noise, a hollow shell, a cut plane and tilt.
  - A WebGL2 progressive path tracer with the same optics: spectral once a path meets the glass, sun next-event estimation with MIS so caustics appear on the floor, studio, sky and dark environments, ACES tone mapping, and an internal-bounce heatmap view.
- Material presets: BK7, fused silica, water, SF11 flint, sapphire, cubic zirconia, diamond, rutile and custom. A dispersion boost defaults to the real value (×1). Ceramic is offered as an opaque preview surface.
- Presets, Random, shareable links (hash) and PNG export from the clean canvas.

## Non-goals
- No polarisation: Fresnel is the unpolarised average.
- No rough or frosted glass.

## Key technical decisions (Claude's calls)
- The 3D surface has no exact distance function. The page marches the radial field d = |q| − R(direction) divided by its analytic gradient magnitude, times a safety factor. Deformations get a global Lipschitz factor. A sign-change bisection then refines the hit. JS mirrors the GLSL, and Node tests check the analytic gradient against finite differences.
- On the CPU, a 40³ sample of the field finds the bounding radius and the lowest point, so the object rests on the floor.
- 2D hits come from a uniform-grid DDA over about 4096 segments per turn, with interpolated vertex normals.
- Tests: `supershape/test.mjs` runs the `shared-code` block in Node.
