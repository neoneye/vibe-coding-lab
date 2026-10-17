# Birefringent crystal (calcite) — design

## Intent

Show what a birefringent crystal such as Iceland spar (calcite) looks like when you put it on a printed
page: everything underneath appears twice. The owner's references are photos of a calcite rhomb on the word
"Calcite", on a pencil and on a grid. Seeing the effect is the main goal. The physics is explained next to
it in plain language, without assuming a math degree.

## Owner decisions

- Several test backgrounds, plus uploading your own image.
- Lots of parameters: crystal dimensions, what lies underneath, and so on.
- The math is explained for non-specialists.
- "Go ahead" after the playback (no further questions).

## Builder calls (mine)

- **Rendering:** WebGL2 fragment-shader ray tracer, one self-contained `index.html` with no libraries. The
  camera orbits like in the photos, with a top-view button. The page renders on demand, not every frame,
  unless auto-spin is on. Backing store is sized in device pixels.
- **Physics:** uniaxial crystal with the optic axis `a`.
  - Ordinary wave: Snell's law with `n_o`.
  - Extraordinary wave: the tangential wave vector is continuous at each face, and the normal component
    solves the index ellipsoid `k∥²/n_o² + k⊥²/n_e² = 1`. The energy (ray) direction is the gradient
    `k/n_e² + (k·a)a(1/n_o² − 1/n_e²)`, which gives the walk-off.
  - Rays that reach the bottom face sample the paper directly, because the crystal touches the paper.
  - Side and top faces refract out, or reflect totally (TIR) and keep tracing, up to a few bounces.
  - Fresnel losses use Schlick's approximation, and the top face reflects soft studio lights.
- **Geometry:** a parallelepiped. "Cleavage rhomb" uses the true calcite rhombohedron: face angle 101.9°,
  slanted sides, and the optic axis about 44.6° from the face normal along the short diagonal.
  "Rectangular block" is a cut slab. Length, width and thickness are in mm. The optic axis tilt and azimuth
  can be overridden.
- **Materials:** calcite (default), quartz, rutile, sodium nitrate, ice, and plain glass as a control
  (no doubling), plus custom `n_o`/`n_e`.
- **Underneath:** editable text, a line, a pencil, a grid, a newspaper paragraph, dots, a single point, a
  checkerboard, a colour chart, and an uploaded image. Scale, rotation, and paper/ink colours are
  adjustable.
- **Polarizer:** an analyzer in front of the camera. Malus's law `cos²` on each ray's polarization, which
  is `k×a` for the o-ray and perpendicular to it for the e-ray. Exposure is compensated so that only the
  relative fading shows.
- **Extras:**
  - Dispersion (per-channel indices, exaggeration slider).
  - Diagnostic tint for the o and e images.
  - Show only o, only e, or both.
  - Amber tint absorption and side-face frost.
  - Auto-spin.
  - Readouts: Δn, walk-off angle, image separation, apparent depths.
- **Explainer:** a plain-language article below the app, with a live 2D cross-section diagram (Huygens
  sphere vs ellipsoid wavelets, o and e rays, optic axis) driven by the same parameters.
- **Tests:** the JS physics core lives in `<script id="physics-core">` and `test.mjs` runs it in Node. The
  GLSL mirrors the JS.

## Non-goals

Caustics on the paper, physically correct partial internal reflections (only TIR bounces), optical
activity, and biaxial crystals.
