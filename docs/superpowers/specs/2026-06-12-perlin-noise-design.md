# 2D Perlin Noise — Design

**Date:** 2026-06-12
**Project directory:** `2d-perlin-noise/`
**Status:** Approved by owner
**Origin:** Faithful port of the owner's 2007 C++ brick
`/Users/neoneye/git/opcoders_toolbox/CONTENT/TBEngine/brick_lib/gfx_perlin.cpp`
(werkkzeug-style tiling noise texture generator; fixed-point arithmetic
throughout).

## Purpose

Resurrect the gfx_perlin brick as a web page: seamlessly tiling noise
textures from the owner's hand-built fixed-point 3D simplex noise, with the
brick's full parameter set, plus the fixed-point classic-Perlin backend that
lived behind `#ifdef` — now a runtime dropdown so the two can be compared
live for the first time.

## Repo conventions followed

- Single self-contained `index.html`; engine + tests in
  `<script id="shared-code">`; `test.mjs` runs `PerlinTests.run()`.
- Big-canvas layout (responsive square canvas, fixed scrollable right
  panel, actions on top).
- `screenshot1.png`, `gallery.yaml`, `build_gallery.py`, commits to `main`.

## Engine (shared-code)

### Noise backends (exact integer semantics)

Both use the standard 512-entry permutation table (second half mirrors the
first). C++ `int` arithmetic → `Math.imul`/`| 0`; C++ `size_t` (unsigned)
shifts → `>>>`.

1. **`simplexNoiseFixed(x, y, z)`** — port of
   `simons_simplex_noise_fixedpoint::noise`: 16.16 inputs; skew `s=(x+y+z)/3`
   (JS `Math.trunc` division), cell `& 0xffff0000`, unskew `t=(i+j+k)/6`,
   `>> 4` to 12-bit fractions; the six-way simplex-corner branch; per corner
   `t = I06_MUL_256 − x² − y² − z²` with the `(ut>>>12, ut²>>>12, ut²>>>8)`
   attenuation and `igrad`; result `(n0+n1+n2+n3) >> 7`.
   Constants: `I06_MUL_256 = Math.trunc(0.6*65536*256)`,
   `i_G3_12 = Math.trunc(4096*0.166666667)`.
2. **`perlinNoiseFixed(x, y, z, fadeZ)`** — port of
   `perlin_noise_fixedpoint::noise_without_z_fade`: 16.16 inputs, the
   ruby-generated 256-entry `fade_lut` (copied verbatim) with interpolated
   `fade()`, `lerp_fixedpoint(t,a,b) = a + (t*(b−a) >> 12)`, `grad` as in
   INoise.java. `fadeZ` precomputed once per octave by the caller.

### Fast math (bit hacks preserved)

Shared `Float32Array(1)` + `Int32Array` view for type punning:
- `fastSin(x)`: wrap to [−π, π], `B·x + C·x·|x|` with B=4/π, C=−4/π².
- `fastLog2(i)`: reinterpret float bits as int, `*OOshift23 − 127`,
  bodge 0.346607.
- `fastPow2(i)`: bodge 0.33971, write truncated int into float bits.
- `fastPow(a, b) = fastPow2(b * fastLog2(a))`.

### Octave pipeline

`PerlinEngine({size})` (square, default 512):

- **Backend config:** simplex → `FREQUENCY_FACTOR 0.375`, amplify table
  [0.6, 0.6, 0.5, 0.4]; perlin → `0.5`, [1.0, 0.75, 0.5, 0.4]
  (the `#ifdef USE_SIMPLEX` / `#ifndef` tables).
- **`buildOctave(octave)`** — port of the fixedpoint rebuild loop:
  `areaSpan = frequency * 2^octave` where
  `frequency = 2^freqParam * FREQUENCY_FACTOR`; bounds ±areaSpan;
  `delta = extent/(size−0.5)` (float) then converted to 16.16 ints exactly as
  the C++ (`* 65536` truncated); `nz = octave + 1 + seed*1000` (seed =
  rawSeed/400), `inz = nz*65536` truncated; blend factors
  `blendInvW = Math.trunc(4095*65536/(size−1))`, per pixel
  `iblend = (i*blendInv) >> 16`; 4-corner samples (x, x+iex) × (y, y+iey);
  fixed-point bilinear with the original's argument order
  (`lerp(blend_x, value_br, value_bl)` — note br first); store int result
  into the octave's `Int32Array`. Perlin backend: `fadeZ =
  fade(inz & 0xffff)` once per octave, passed to every sample.
- **Octave cache:** `Int32Array(size*size)` per octave (max 8), built lazily
  and kept until seed, frequency, backend, or size changes (`buildCount`
  exposed for tests). The UI builds at most one octave per animation frame.
- **`composite(params)`** — the sum + color stage, on demand (cheap):
  per pixel, for each octave `v = iv/65536`; modes:
  - 0 normal: `sum += v*scale`
  - 1 absolute: `sum ±= |v*scale|` (minus when fadeoff<0 and octave odd)
  - 2 sinus: `sum += fastSin(v*π*1.33)*scale`
  - 3 abs+sinus: `v += fastSin(v*π*1.33)` then the absolute logic
  with `scale *= fadeoff` each octave; then `sum *= amplify *
  amplifyTable[mode]`; final: modes 0/2 remap [−1,1]→[0,1], 1/3 as-is;
  floor at 1e-5; `v = fastPow(v, gamma)`; lerp colorBegin→colorEnd per
  channel, clamp. Returns RGBA pixels.

## UI

- Big-canvas layout. Texture 512×512 rendered to offscreen, scaled to the
  responsive display canvas.
- **Actions (top):** Random (seed + frequency + mode + fadeoff/amplify/gamma
  within tasteful ranges), Reset (brick defaults).
- **Parameters:** Backend select (Simplex fixed-point / Perlin fixed-point),
  Seed 0–400 (default 0), Frequency 0–8 (default 2), Octaves 0–8 (default 3),
  Mode select (default Normal), Fadeoff −400–400 (default 100), Amplify
  0–400 (default 100), Gamma 0–400 (default 100) — sliders show the brick's
  ÷100 values where applicable. Color Begin (default #000000) / Color End
  (default #ffffff). **Tile 2×2 preview** checkbox: draws the texture in a
  2×2 grid to demonstrate seamless tiling.
- Recompute strategy: seed/frequency/backend change → invalidate octave
  cache, rebuild progressively (one octave per frame, readout shows
  "building octave k/n"); any other change → re-composite immediately.
- Readout: octaves cached, last composite ms.

## Testing (`test.mjs` → `PerlinTests.run()`)

1. **Tables:** permutation 512 entries, `perm[i] === perm[i+256]`,
   `fade_lut` 256 entries, endpoints 0 and 4095, monotone nondecreasing.
2. **Noise characterization:** pinned values (computed once at
   implementation, then pinned) for `simplexNoiseFixed` and
   `perlinNoiseFixed` at ~5 sample coordinates each; outputs bounded
   (|result| < 2^26 sanity bound, exact bound pinned from observation).
3. **fast math:** `fastSin` within 0.06 of `Math.sin` on [−π, π] sampled at
   100 points; `fastPow(0.5, g)` within 10% of `Math.pow(0.5, g)` for
   g ∈ {0.25, 0.5, 1, 2, 4}; `fastPow(x, 1)` within 10% of x for
   x ∈ {0.1, 0.5, 0.9}.
4. **Engine:** octave cache — two `composite` calls with different fadeoff
   leave `buildCount` unchanged; seed change increments it. Determinism:
   two engines, same params → byte-equal pixels. Backend switch changes
   output (pixels differ) and uses the right amplify table (exposed config
   checked directly).
5. **Tiling:** with default params at size 64, for every row the sum-stage
   values of column 0 and column 63 differ by < 0.1, and likewise for
   rows 0/63 (edge continuity of the 4-corner blend).
6. **Modes:** absolute mode output ≥ 0 before remap (sum stage inspected via
   a test hook or by construction with positive fadeoff); normal mode with
   octaves 0 renders the mid color (sum 0 → v 0.5 → gamma 0.5^g) — checked
   for gamma 1: all pixels equal the 50% lerp of the two colors ±1.

## Out of scope (YAGNI)

- The float/double reference Perlin path (comparison-only in the original),
  cosine interpolation (disabled there), 3D cube faces (open TODO),
  width≠height, image export.
