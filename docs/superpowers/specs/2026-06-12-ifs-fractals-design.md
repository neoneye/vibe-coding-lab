# 2D IFS Fractals — Design

**Date:** 2026-06-12
**Project directory:** `2d-ifs-fractals/`
**Status:** Approved by owner
**Origin:** Full-fidelity port of the owner's 2009 C++ engine:
`/Users/neoneye/git/opcoders_toolbox/CONTENT/TBEngine/brick_lib/gfx_chaos.cpp`
and `gfx_chaos_data.{h,cpp}` (fractal-flame-inspired IFS with variant
crossfading; see flam3 paper credit in the original header).

## Purpose

Resurrect the gfx_chaos brick as a standalone web page: ~210 affine IFS
presets, crossfade between any two presets, the chaos game with a crossfade
of two flame variants per step (all 53 variant functions), histogram
rendering with the original 2D tonemap coloring, and every original
parameter exposed as a control.

## Repo conventions followed

- Single self-contained `index.html`; engine + data + tests in
  `<script id="shared-code">`; `test.mjs` extracts and runs `IfsTests.run()`
  under Node. Seeded mulberry32 for the chaos rng.
- `screenshot1.png`, `gallery.yaml` override, `build_gallery.py`,
  commits to `main`.

## Data conversion (committed tool)

`2d-ifs-fractals/convert_data.mjs` parses the original C++ (paths above,
read-only) and splices generated JS between markers in `index.html`:

- `PRESETS`: array of `{ name, maps: [[p, a, b, c, d, e, f], ...] }`
  in the exact order of the original `fdata[]` array (categories: spirals,
  plants, shapes-without-curves, then the three uncommented blocks);
  `#if 0` blocks excluded. Approx. 212 entries; the converter prints the
  count and it is pinned in a test.
- Marker comments `// BEGIN GENERATED PRESETS` / `// END GENERATED PRESETS`
  inside the shared-code block. Running the converter regenerates the
  section idempotently.

The variant menu (the `init_variant` switch, cases 0–~250 with baked
parameters: CASE_DIRECT/JULIA1/JULIA2/SUPERSHAPE/DISC2/RINGS2/RECTANGLES/
PIE/BLOB/PDJ/FAN2/PERSPECTIVE/RADIALBLUR/NGON/CURL/...) is transcribed by
hand into a `VARIANT_MENU` data table `{ label, fn, params }` with the same
indices — it is code-like data with macro structure, not bulk numbers.

## Engine (shared-code)

Faithful transcription, same stage names as the C++:

1. `random1d(x)` — bit-faithful port of `random_1d` (integer overflow
   semantics reproduced with `Math.imul`/`|0` so shuffle seeds match).
2. `obtainFunctionValues(i0, i1, mix, seed)` — clamp indices, optional
   seeded row shuffle (same constants 10033/100/20003/53), cosine
   interpolation of probability + 6 coefficients per row, cumulative q,
   last-row q=5 guarantee with the original n0/n1/mix selection logic.
3. `VARIANT_FNS` — all 53 `calc_out_*` functions transcribed from
   gfx_chaos.cpp (lines ~220–1010): linear, sinusoidal, spherical, swirl,
   horseshoe, polar, handkerchief, heart, disc, spiral, hyperbolic, diamond,
   ex, julia, bent, waves, fisheye, popcorn, exponential, power, cosine,
   rings, fan, blob, pdj, fan2, rings2, eyefish, bubble, cylinder,
   perspective, noise, julia_n, juliascope_n, blur, gaussian, radial_blur,
   pie, ngon, curl, rectangles, arch, tangent, square, rays, blade, secant,
   twintrian, cross, disc2, supershape, flower, conic. Each takes a context
   `{x, y, xb, yb, xc, yc, rng, p}` (p = baked params) and writes
   `{outX, outY}`. Temporaries (r, r², atan2 pair, sina/cosa, rand pools)
   computed on demand as in the original.
4. `computePoints(fv, vi0, vi1, varianceMix, points, rng)` — skip 20,
   per step: cumulative-probability map pick, affine, both variants on the
   affine result (with xb/yb/xc/yc exposed, as waves/popcorn/rings/fan use
   them), cosine mix, store x/y/q (q = the uniform random used for the pick).
   POINT_CAPACITY 30000.
5. Post: `boundingBoxForPoints` (first pass only), `remapPoints`,
   `rotatePoints` (original handedness), zoomwrap view transform (the
   original's modulo-tiling plot preserved: splat coordinates wrap with
   `%` exactly as the C++ does), bilinear splat into `histA` (density) and
   `histB` (q-weighted), `histB /= histA`, max-normalize, gamma → contrast →
   brightness with the dim-down anti-aliasing trick.
6. `renderTonemap(c0, c1, c2, bg)` — 256×256, the three cosine bands over
   the q axis and the background crossfade over the density axis, exact
   constants (0.7 / 1.5 / 0.7).
7. `renderFinalImage` — per pixel: density → tonemap x index, q → y index,
   copy RGB.

Render buffer 480×480 shown on a 640×640 canvas. Rendering is progressive:
on any parameter change the histograms reset and one `computePoints` pass
runs per animation frame until `repeat` passes accumulate (1–16).

## UI

Controls (right panel, repo layout):

- Preset A / Preset B: dropdowns with all preset names (index-prefixed).
- Function mix (0–1), Shuffle seed (0–100, 0 = no shuffle, matching
  `function_seed > 0` semantics; also reseeds the chaos starting point).
- Variant A / Variant B: dropdowns over VARIANT_MENU (labels like
  "31 julia_n p=2 d=2"). Variant mix (0–1).
- Repeat passes (1–16, default 4), Gamma (0.1–3, default 1), Contrast
  (0–3, default 1), Brightness (−1–1, default 0), Zoom (−1–1, default 0,
  the original zoomwrap mapping), Rotate (−1–1, default 0, ×π).
- Colors: three tonemap colors + background (`<input type="color">`),
  defaults: c0 #ffd24d, c1 #ff5a36, c2 #7a1fa2, bg #0b0e13.
- Buttons: **Random** (random presets, variants, seed — mixes untouched),
  **Reset view** (zoom/rotate/gamma/contrast/brightness to defaults).
- **Animate mix** toggle: slowly oscillates function mix and variant mix
  (different periods), re-rendering continuously — the crossfade morph show.
- Readout: current preset names, point count per frame, passes done.

## Testing (`test.mjs` → `IfsTests.run()`)

1. **Data:** PRESETS.length pinned (exact count printed by the converter);
   every preset: maps nonempty, 7 finite numbers each, probabilities sum in
   [0.95, 1.05] (original data is hand-tuned; spot tolerance);
   sierpinski gasket preset present with its known coefficients (0.5 …).
2. **random1d:** exact expected values for a few inputs (computed once from
   the ported function and pinned — guards against regressions; the port
   reproduces C float behavior only where integers dominate, which the
   shuffle path uses).
3. **Mixing:** mix=0 reproduces preset A's rows exactly (modulo shuffle off);
   cumulative q nondecreasing; final row q = 5; mix=0.5 between two presets
   of different row counts pads with zero rows.
4. **Variants:** linear is identity; sinusoidal output within [-1,1];
   spherical at (2,0) → (0.5,0); every menu entry produces finite output for
   200 seeded random inputs (catches transcription typos wholesale).
5. **Chaos game:** deterministic for equal seeds; 30000 points produced;
   q values in [0,1).
6. **Histogram:** splatting N points adds total density ≈ N (interior
   points); gamma/contrast/brightness with neutral values is max-normalize
   only.
7. **Tonemap:** corner pixels equal background (x=0) and the cosine-band
   colors at x=max for top/middle/bottom rows.

## Out of scope (YAGNI)

- The `#if 0` presets and the unused `func1000+` experiments.
- Density estimation blur, outlier trimming (IDEA comments — never built).
- Image export, URL state, WebGL.
