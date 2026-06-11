# 2D IFS Fractals (gfx_chaos port) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-fidelity port of the 2009 C++ `gfx_chaos` brick to `2d-ifs-fractals/index.html` — ~210 IFS presets, dual crossfades (presets and flame variants), histogram rendering with the original 2D tonemap.

**Architecture:** `convert_data.mjs` regenerates a `PRESETS` block inside `index.html` from the original C++ data file. The shared-code block holds the engine as standalone functions mirroring the C++ stages (`random1d`, `obtainFunctionValues`, `VARIANT_FNS`/`VARIANT_MENU`, `computePoints`, histogram splat/finalize, tonemap) plus `IfsTests`. The UI runs a progressive renderer (one 30k-point pass per frame up to `repeat` passes).

**Tech Stack:** Vanilla JS, Canvas 2D, Node ≥18. Source of truth for transcription: `/Users/neoneye/git/opcoders_toolbox/CONTENT/TBEngine/brick_lib/gfx_chaos.cpp` (engine) and `gfx_chaos_data.cpp` (data).

**Spec:** `docs/superpowers/specs/2026-06-12-ifs-fractals-design.md`

---

### Task 1: Scaffold, PRNGs (mulberry32 + bit-faithful random1d)

**Files:**
- Create: `2d-ifs-fractals/test.mjs`
- Create: `2d-ifs-fractals/index.html`

- [ ] **Step 1: Write the test runner** — same regex extractor as the sibling projects, running `IfsTests.run()`:

```js
// Runs the IfsTests embedded in index.html's shared-code script block.
// Usage: node test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) {
  console.error("shared-code block not found");
  process.exit(1);
}
const ok = new Function(`${m[1]}; return IfsTests.run();`)();
process.exit(ok ? 0 : 1);
```

Run it → expected FAIL (ENOENT).

- [ ] **Step 2: Create the index.html skeleton**

Same shape as `2d-cloud-chamber/index.html` Task-1 skeleton (placeholder body, `<style>` comment for Task 6), with shared-code containing `mulberry32` (copy verbatim from the cloud chamber), `random1d`, the generated-presets markers, and `IfsTests` with PRNG tests:

```js
// Bit-faithful port of the C++ random_1d (Perlin-style integer hash).
// Math.imul reproduces 32-bit overflow semantics.
function random1d(x) {
  let s = Math.imul(71, x);
  s = (Math.imul(s, 8192) ^ s) | 0;
  const t = (Math.imul(s, (Math.imul(Math.imul(s, s), 15731) | 0) + 789221) + 1376312589) & 0x7fffffff;
  return 1.0 - t / 1073741824.0;
}

// BEGIN GENERATED PRESETS
const PRESETS = [];
// END GENERATED PRESETS
```

`IfsTests.run()` starts with the standard mulberry32 checks (determinism + range, as in the sibling projects) plus:

```js
    // --- random1d characterization ---
    {
      let ok = true;
      for (const x of [0, 1, 2, 100, -7, 12345]) {
        const v = random1d(x);
        if (!(v > -1.0000001 && v < 1.0000001) || !Number.isFinite(v)) ok = false;
        if (random1d(x) !== v) ok = false;
      }
      check("random1d: bounded and pure", ok);
      check("random1d: distinct values", random1d(1) !== random1d(2));
    }
```

After implementing, print `random1d(1), random1d(7), random1d(100)` with a one-off `node -e` extraction and PIN the three printed values into an additional check (`Math.abs(random1d(1) - <printed>) < 1e-12`) — a characterization guard against future edits.

- [ ] **Step 3: Run tests → all PASS, then commit**

```bash
git add 2d-ifs-fractals
git commit -m "ifs-fractals: scaffold with test runner, mulberry32, bit-faithful random1d"
```

---

### Task 2: Data converter and PRESETS

**Files:**
- Create: `2d-ifs-fractals/convert_data.mjs`
- Modify: `2d-ifs-fractals/index.html` (generated block + tests)

- [ ] **Step 1: Add failing data tests**

```js
    // --- Preset data ---
    {
      check("presets: converted (not empty)", PRESETS.length > 150);
      let structureOk = PRESETS.length > 0;
      let probOk = true;
      for (const p of PRESETS) {
        if (typeof p.name !== "string" || !Array.isArray(p.maps) || p.maps.length < 1) structureOk = false;
        let sum = 0;
        for (const m of p.maps) {
          if (m.length !== 7 || m.some((v) => !Number.isFinite(v))) structureOk = false;
          sum += m[0];
        }
        if (sum < 0.95 || sum > 1.05) probOk = false;
      }
      check("presets: structure valid", structureOk);
      check("presets: probabilities sum ~1", probOk);
      const sier = PRESETS.find((p) => p.name === "sierpinski gasket (equal sides)");
      check("presets: sierpinski present", !!sier && sier.maps.length === 3);
    }
```

Run → FAIL (`presets: converted` — PRESETS is empty).

- [ ] **Step 2: Write the converter**

`2d-ifs-fractals/convert_data.mjs`:

```js
// Regenerates the PRESETS block in index.html from the original C++ data.
// Usage: node convert_data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = "/Users/neoneye/git/opcoders_toolbox/CONTENT/TBEngine/brick_lib/gfx_chaos_data.cpp";
const here = dirname(fileURLToPath(import.meta.url));
const cpp = readFileSync(SRC, "utf8");

// 1. Parse every FunctionData definition: identifier, name, set count, floats.
const defs = new Map();
const defRe = /FunctionData\s+(\w+)\s*=\s*\{\s*"([^"]*)"\s*,\s*(\d+)\s*,([^;]*?)\};/gs;
let m;
while ((m = defRe.exec(cpp))) {
  const [, ident, name, countStr, body] = m;
  const count = Number(countStr);
  const nums = (body.match(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g) || []).map(Number);
  if (nums.length < count * 7) {
    throw new Error(`${ident}: expected ${count * 7} numbers, found ${nums.length}`);
  }
  const maps = [];
  for (let i = 0; i < count; i++) maps.push(nums.slice(i * 7, i * 7 + 7));
  defs.set(ident, { name, maps });
}

// 2. Parse the fdata[] array, honoring #if 1 / #if 0 blocks.
const fdataBody = cpp.match(/const FunctionData fdata\[\]\s*=\s*\{([\s\S]*?)\};/)[1];
const order = [];
let active = true;
for (const line of fdataBody.split("\n")) {
  const t = line.trim();
  if (t.startsWith("#if")) { active = t === "#if 1"; continue; }
  if (t.startsWith("#endif")) { active = true; continue; }
  if (!active || t.startsWith("//")) continue;
  for (const ident of t.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!defs.has(ident)) throw new Error(`fdata references unknown ${ident}`);
    order.push(ident);
  }
}

const presets = order.map((ident) => defs.get(ident));
const json = presets.map((p) =>
  `{name:${JSON.stringify(p.name)},maps:[${p.maps.map((row) => `[${row.join(",")}]`).join(",")}]}`
).join(",\n");

// 3. Splice between markers in index.html.
const htmlPath = join(here, "index.html");
const html = readFileSync(htmlPath, "utf8");
const out = html.replace(
  /\/\/ BEGIN GENERATED PRESETS[\s\S]*?\/\/ END GENERATED PRESETS/,
  `// BEGIN GENERATED PRESETS\n// Generated by convert_data.mjs from gfx_chaos_data.cpp — do not edit.\nconst PRESETS = [\n${json}\n];\n// END GENERATED PRESETS`
);
writeFileSync(htmlPath, out);
console.log(`Wrote ${presets.length} presets.`);
```

- [ ] **Step 3: Run the converter, inspect, pin the count**

Run: `cd 2d-ifs-fractals && node convert_data.mjs`
Expected: `Wrote N presets.` with N in the ~190–215 range. Then UPDATE the first data test to pin it exactly: `PRESETS.length === N`. Run `node test.mjs` → all PASS. (If the probability-sum test fails for a few presets, print the offenders and widen only as far as the real data requires — the originals are hand-tuned; report what was found.)

- [ ] **Step 4: Commit**

```bash
git add 2d-ifs-fractals/convert_data.mjs 2d-ifs-fractals/index.html
git commit -m "ifs-fractals: preset data converted from gfx_chaos_data.cpp"
```

---

### Task 3: Function mixing (obtainFunctionValues)

**Files:**
- Modify: `2d-ifs-fractals/index.html` (shared-code)

- [ ] **Step 1: Add failing tests**

```js
    // --- Function mixing ---
    if (typeof obtainFunctionValues !== "undefined") {
      const i = PRESETS.findIndex((p) => p.name === "sierpinski gasket (equal sides)");
      // mix=0, no shuffle: rows reproduce preset A exactly; q cumulative; last q=5.
      {
        const fv = obtainFunctionValues(i, (i + 1) % PRESETS.length, 0, 0);
        const src = PRESETS[i].maps;
        let exact = true, cum = 0;
        for (let d = 0; d < src.length; d++) {
          for (let e = 0; e < 6; e++) if (fv[d].values[e] !== src[d][e + 1]) exact = false;
          if (d < src.length - 1) {
            cum += src[d][0];
            if (Math.abs(fv[d].q - cum) > 1e-6) exact = false;
          }
        }
        check("mix: mix=0 reproduces preset A", exact);
        check("mix: last row q=5 guarantee", fv[src.length - 1].q === 5);
      }
      // q nondecreasing for a 0.5 mix of different-row-count presets.
      {
        const a = PRESETS.findIndex((p) => p.maps.length >= 4);
        const b = PRESETS.findIndex((p) => p.maps.length === 2);
        const fv = obtainFunctionValues(a, b, 0.5, 0);
        let mono = true;
        const n = Math.max(PRESETS[a].maps.length, PRESETS[b].maps.length);
        for (let d = 1; d < n; d++) if (fv[d].q < fv[d - 1].q - 1e-6) mono = false;
        check("mix: cumulative q nondecreasing", mono);
      }
      // Shuffle: seed>0 permutes rows deterministically (same seed → same result).
      {
        const f1 = obtainFunctionValues(i, i, 0, 42);
        const f2 = obtainFunctionValues(i, i, 0, 42);
        let same = true;
        for (let d = 0; d < PRESETS[i].maps.length; d++)
          for (let e = 0; e < 6; e++) if (f1[d].values[e] !== f2[d].values[e]) same = false;
        check("mix: shuffle deterministic", same);
      }
    } else {
      check("obtainFunctionValues: implemented", false);
    }
```

Run → FAIL.

- [ ] **Step 2: Implement** (direct port of gfx_chaos.cpp lines 1321–1442; cosine interpolation is `a + (b-a) * (1 - cos(t*π))/2`):

```js
const SUB_FUNCTION_CAPACITY = 40;

function interpolateCosine(t, a, b) {
  const f = (1 - Math.cos(t * Math.PI)) * 0.5;
  return a + (b - a) * f;
}

// Port of obtain_function_values: mixes two presets row-by-row with cosine
// interpolation, optional seed-driven row shuffle (original constants),
// cumulative probabilities, and the guaranteed-last-row trick.
function obtainFunctionValues(index0, index1, mix, seed) {
  const maxIndex = PRESETS.length - 1;
  const fd0 = PRESETS[Math.min(Math.max(index0, 0), maxIndex)];
  const fd1 = PRESETS[Math.min(Math.max(index1, 0), maxIndex)];
  const n0 = fd0.maps.length, n1 = fd1.maps.length;
  const zero = [0, 0, 0, 0, 0, 0, 0];

  const indexes0 = [], indexes1 = [];
  for (let i = 0; i < SUB_FUNCTION_CAPACITY; i++) { indexes0.push(i); indexes1.push(i); }
  if (seed > 0) {
    for (let i = 0; i < n0; i++) {
      let v = (random1d(seed * 10033 + i * 100) + 1) * 0.5;
      let i2 = Math.floor(v * n0);
      i2 = Math.min(Math.max(i2, 0), n0 - 1);
      const tmp = indexes0[i]; indexes0[i] = indexes0[i2]; indexes0[i2] = tmp;
    }
    for (let i = 0; i < n1; i++) {
      let v = (random1d(seed * 20003 + i * 53) + 1) * 0.5;
      let i2 = Math.floor(v * n1);
      i2 = Math.min(Math.max(i2, 0), n1 - 1);
      const tmp = indexes1[i]; indexes1[i] = indexes1[i2]; indexes1[i2] = tmp;
    }
  }

  const result = [];
  for (let d = 0; d < SUB_FUNCTION_CAPACITY; d++) {
    const c0 = d < n0 ? fd0.maps[indexes0[d]] : zero;
    const c1 = d < n1 ? fd1.maps[indexes1[d]] : zero;
    const row = { q: interpolateCosine(mix, c0[0], c1[0]), values: [] };
    if (d > 0) row.q += result[d - 1].q;
    for (let e = 0; e < 6; e++) row.values.push(interpolateCosine(mix, c0[e + 1], c1[e + 1]));
    result.push(row);
  }

  if (mix < 0.0001) result[n0 - 1].q = 5;
  else if (mix > 0.9999) result[n1 - 1].q = 5;
  else if (n0 > n1) result[n0 - 1].q = 5;
  else result[n1 - 1].q = 5;
  return result;
}
```

Note: with mix=0, `interpolateCosine(0, a, b)` returns `a` exactly (cos(0)=1 → f=0), so the exactness test holds.

- [ ] **Step 3: Run tests → PASS, commit**

```bash
git add 2d-ifs-fractals/index.html
git commit -m "ifs-fractals: preset crossfade mixing with seeded row shuffle"
```

---

### Task 4: Flame variants — VARIANT_FNS and VARIANT_MENU

**Files:**
- Modify: `2d-ifs-fractals/index.html` (shared-code)
- Reference: `gfx_chaos.cpp` lines ~58–1010 (Variant struct + all calc functions) and lines ~1576–2015 (`init_variant` switch — the menu)

This is a transcription task. The C++ file is the spec; the JS pattern is fixed here; the wholesale finite-output test catches typos across all entries.

- [ ] **Step 1: Add failing tests**

```js
    // --- Variants ---
    if (typeof VARIANT_MENU !== "undefined") {
      check("variants: menu has full catalog", VARIANT_MENU.length > 200);
      // linear is identity
      {
        const out = applyVariant(VARIANT_MENU[0], { x: 0.3, y: -0.7, xb: 0, yb: 0, xc: 0, yc: 0 }, mulberry32(1));
        check("variants: linear identity", out.x === 0.3 && out.y === -0.7);
      }
      // sinusoidal bounded
      {
        const r = mulberry32(2);
        let ok = true;
        for (let i = 0; i < 100; i++) {
          const out = applyVariant(VARIANT_MENU[1], { x: r() * 20 - 10, y: r() * 20 - 10, xb: 0, yb: 0, xc: 0, yc: 0 }, r);
          if (out.x < -1 || out.x > 1 || out.y < -1 || out.y > 1) ok = false;
        }
        check("variants: sinusoidal bounded", ok);
      }
      // spherical inverts radius: (2,0) -> (0.5,0)
      {
        const out = applyVariant(VARIANT_MENU[2], { x: 2, y: 0, xb: 0, yb: 0, xc: 0, yc: 0 }, mulberry32(3));
        check("variants: spherical (2,0)->(0.5,0)", Math.abs(out.x - 0.5) < 1e-6 && Math.abs(out.y) < 1e-6);
      }
      // EVERY menu entry: finite output over 200 seeded random inputs.
      {
        let bad = null;
        for (let vi = 0; vi < VARIANT_MENU.length && !bad; vi++) {
          const r = mulberry32(1000 + vi);
          for (let i = 0; i < 200; i++) {
            const out = applyVariant(VARIANT_MENU[vi],
              { x: r() * 4 - 2, y: r() * 4 - 2, xb: r() - 0.5, yb: r() - 0.5, xc: r() - 0.5, yc: r() - 0.5 }, r);
            if (!Number.isFinite(out.x) || !Number.isFinite(out.y)) { bad = VARIANT_MENU[vi].label; break; }
          }
        }
        check("variants: all finite (" + (bad || "ok") + ")", bad === null);
      }
    } else {
      check("variants: implemented", false);
    }
```

Run → FAIL.

- [ ] **Step 2: Implement the variant framework**

```js
// Each variant fn: (c, p, rng) -> {x, y}, where c = {x, y, xb, yb, xc, yc}
// (xb/yb/xc/yc come from the chosen affine row — waves/popcorn/rings/fan use
// them) and p = baked parameters from the menu entry. Helper temps mirror
// the C++ calc_tmp_* functions. EPS guards divisions as in the original.
const EPS = 1e-10;

function applyVariant(menuEntry, c, rng) {
  return VARIANT_FNS[menuEntry.fn](c, menuEntry.params || {}, rng);
}

const VARIANT_FNS = {
  linear(c) { return { x: c.x, y: c.y }; },
  sinusoidal(c) { return { x: Math.sin(c.x), y: Math.sin(c.y) }; },
  spherical(c) {
    const r2 = c.x * c.x + c.y * c.y + EPS;
    return { x: c.x / r2, y: c.y / r2 };
  },
  // ... transcribe ALL remaining calc_out_* functions from gfx_chaos.cpp
  // lines ~220-1010, one key per enum name (swirl, horseshoe, polar,
  // handkerchief, heart, disc, spiral, hyperbolic, diamond, ex, julia,
  // bent, waves, fisheye, popcorn, exponential, power, cosine, rings, fan,
  // blob, pdj, fan2, rings2, eyefish, bubble, cylinder, perspective, noise,
  // julia_n, juliascope_n, blur, gaussian, radial_blur, pie, ngon, curl,
  // rectangles, arch, tangent, square, rays, blade, secant, twintrian,
  // cross, disc2, supershape, flower, conic), reading each C++ body and
  // converting: tmp_r -> local r, tmp_atan_xy -> Math.atan2(c.x, c.y),
  // tmp_atan_yx -> Math.atan2(c.y, c.x), tmp_sina/cosa from atan2(x, y),
  // tmp_rand01[k] -> rng(), tmp_rand11[k] -> rng()*2-1, param_* -> p.*.
};
```

The transcription requirement is exhaustive: every enum name listed above must exist in `VARIANT_FNS` when this task completes — the menu in Step 3 references them all, and the wholesale finite test executes every one.

- [ ] **Step 3: Transcribe the menu**

Read `gfx_chaos.cpp` lines 1576–2015 (`init_variant` switch). Build:

```js
// Port of the init_variant switch: each entry = case index, target variant
// fn, and baked parameters. Labels are generated for the UI dropdowns.
const VARIANT_MENU = [
  { label: "0 linear", fn: "linear" },
  { label: "1 sinusoidal", fn: "sinusoidal" },
  { label: "2 spherical", fn: "spherical" },
  // CASE_DIRECT(3..30, ...) one entry each, in case order;
  // CASE_JULIA1(31..48, power, dist)  -> fn "julia_n",      params {power, dist}
  // CASE_JULIA2(49..66, power, dist)  -> fn "juliascope_n", params {power, dist}
  // CASE_SUPERSHAPE(67..86, ...)      -> fn "supershape",   params {m, n1, n2, n3, random, holes}
  // CASE_DISC2(87..108, rot, twist)   -> fn "disc2",        params {rot, twist}
  // CASE_RINGS2(109..120, amount)     -> fn "rings2",       params {val}
  // CASE_RECTANGLES(121..134, x, y)   -> fn "rectangles",   params {x, y}
  // CASE_BLOB(135..149, low, high, w) -> fn "blob",         params {low, high, waves}
  // CASE_PDJ(150..168, a, b, c, d)    -> fn "pdj",          params {a, b, c, d}
  // CASE_FAN2(169..177, x, y)         -> fn "fan2",         params {x, y}
  // CASE_PIE(178..182, r, s, t)       -> fn "pie",          params {rotation, slices, thickness}
  // CASE_PERSPECTIVE(183..194, a, d)  -> fn "perspective",  params {angle, dist}  (deg2rad applied)
  // CASE_RADIALBLUR(195..207, a)      -> fn "radial_blur",  params {angle}       (deg2rad applied)
  // CASE_NGON(208..232, ...)          -> fn "ngon",         params {power, sides, corners, circle}
  // CASE_CURL(233..247, c1, c2)       -> fn "curl",         params {c1, c2}
  // ...continue through the end of the switch (read to line ~2015), same
  // pattern for any remaining CASE_ families (flower, conic, supershape
  // variants, etc.), preserving case order. Labels: "<index> <fn> <params>".
];
```

Every case index in the C++ switch becomes exactly one entry, in order (ARCH is commented out in the original — skip it as the original does).

- [ ] **Step 4: Run tests → all PASS** (the finite test names the first broken entry if any transcription slipped). Commit:

```bash
git add 2d-ifs-fractals/index.html
git commit -m "ifs-fractals: all 53 flame variants and the full parameterized menu"
```

---

### Task 5: Chaos game, histograms, tonemap, finalize

**Files:**
- Modify: `2d-ifs-fractals/index.html` (shared-code)

- [ ] **Step 1: Add failing tests**

```js
    // --- Chaos game & rendering pipeline ---
    if (typeof IfsRenderer !== "undefined") {
      const mk = (seed) => {
        const r = new IfsRenderer({ width: 96, height: 96 });
        r.setParams({ preset0: 28, preset1: 28, functionMix: 0, seed: 0,
          variant0: 0, variant1: 0, varianceMix: 0, repeat: 2,
          gamma: 1, contrast: 1, brightness: 0, zoom: 0, rotate: 0 });
        r.resetAccumulation(mulberry32(seed));
        return r;
      };
      // Passes accumulate density mass ~ 30000 per pass.
      {
        const r = mk(5);
        r.runPass();
        const m1 = r.histMass();
        r.runPass();
        const m2 = r.histMass();
        check("pipeline: pass adds ~30000 density (" + m1.toFixed(0) + ")", m1 > 25000 && m1 <= 30001);
        check("pipeline: passes accumulate", m2 > m1 * 1.8);
      }
      // Deterministic.
      {
        const a = mk(7); a.runPass(); a.runPass();
        const b = mk(7); b.runPass(); b.runPass();
        check("pipeline: deterministic", a.histMass() === b.histMass());
      }
      // Finalize produces RGBA pixels; background where empty.
      {
        const r = mk(9); r.runPass();
        const px = r.finalize({ c0: [255, 210, 77], c1: [255, 90, 54], c2: [122, 31, 162], bg: [11, 14, 19] });
        check("pipeline: pixel buffer", px.length === 96 * 96 * 4 && px[3] === 255);
        let bgFound = false, litFound = false;
        for (let i = 0; i < 96 * 96; i++) {
          if (px[i * 4] === 11 && px[i * 4 + 1] === 14 && px[i * 4 + 2] === 19) bgFound = true;
          else litFound = true;
        }
        check("pipeline: background and lit pixels", bgFound && litFound);
      }
      // Tonemap corners.
      {
        const tm = renderTonemap([255, 0, 0], [0, 255, 0], [0, 0, 255], [9, 9, 9]);
        check("tonemap: 256x256 rgb", tm.length === 256 * 256 * 3);
        check("tonemap: left column is background", tm[0] === 9 && tm[1] === 9 && tm[2] === 9);
        const top = (0 * 256 + 255) * 3, bottom = (255 * 256 + 255) * 3;
        check("tonemap: bands colored", tm[top] + tm[top + 1] + tm[top + 2] > 0
          && tm[bottom] + tm[bottom + 1] + tm[bottom + 2] > 0);
      }
    } else {
      check("IfsRenderer: implemented", false);
    }
```

(Preset 28 ≈ a Sierpinski-family entry; any stable preset works — the test only needs a contractive system. Adjust the index after Task 2 if needed so it points at "sierpinski carpet"; note which index was used.)

Run → FAIL.

- [ ] **Step 2: Implement** — direct port of `compute_points` (lines 2017–2071), bbox/remap/rotate (2073–2118), `plot_points_in_result_map` (1247–1311), `update_b_result_map`/`normal_factor`/`gamma_result_map` (1184–1245), `render` view math (1478–1567), `render_tonemap` (2120–2247), `render_final_image` (2249–2276):

```js
const POINT_CAPACITY = 30000;

function renderTonemap(c0, c1, c2, bg) {
  const W = 256, H = 256, out = new Uint8ClampedArray(W * H * 3);
  const rgb = [c0, c1, c2].map((c) => c.map((v) => v / 255));
  const rgbBg = bg.map((v) => v / 255);
  for (let y = 0; y < H; y++) {
    const value = (y / (H - 1)) * 2 - 1;
    const mix = [0, 0, 0];
    { const m = (value + 1) * 0.7; mix[0] = m < 0 ? 1 : (m < 1 ? (Math.cos(m * Math.PI) + 1) * 0.5 : 0); }
    { const m = value * 1.5; mix[1] = (m > -1 && m < 1) ? (Math.cos(m * Math.PI) + 1) * 0.5 : 0; }
    { const m = (value - 1) * 0.7; mix[2] = m > 0 ? 0 : (m > -1 ? (Math.cos(m * Math.PI) + 1) * 0.5 : 0); }
    for (let x = 0; x < W; x++) {
      const fx = x / (W - 1);
      let r = 0, g = 0, b = 0, msum = 0;
      for (let k = 0; k < 3; k++) {
        const m = mix[k] * fx;
        msum += m;
        r += rgb[k][0] * m; g += rgb[k][1] * m; b += rgb[k][2] * m;
      }
      if (msum < 1) {
        const m = 1 - msum;
        r += rgbBg[0] * m; g += rgbBg[1] * m; b += rgbBg[2] * m;
      }
      const o = (y * W + x) * 3;
      out[o] = Math.min(1, r) * 255;
      out[o + 1] = Math.min(1, g) * 255;
      out[o + 2] = Math.min(1, b) * 255;
    }
  }
  return out;
}

// Orchestrates the original render() flow with progressive passes.
class IfsRenderer {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;
    this.histA = new Float32Array(width * height);
    this.histB = new Float32Array(width * height);
    this.px = new Float32Array(POINT_CAPACITY);
    this.py = new Float32Array(POINT_CAPACITY);
    this.pq = new Float32Array(POINT_CAPACITY);
    this.params = null;
    this.passes = 0;
    this.bbox = null;
    this.rng = Math.random;
  }

  setParams(p) { this.params = p; }

  resetAccumulation(rng) {
    this.histA.fill(0);
    this.histB.fill(0);
    this.passes = 0;
    this.bbox = null;
    if (rng) this.rng = rng;
    this.fv = obtainFunctionValues(this.params.preset0, this.params.preset1,
      this.params.functionMix, this.params.seed);
  }

  histMass() {
    let s = 0;
    for (let i = 0; i < this.histA.length; i++) s += this.histA[i];
    return s;
  }

  computePoints() {
    const { variant0, variant1, varianceMix } = this.params;
    const m0 = VARIANT_MENU[variant0], m1 = VARIANT_MENU[variant1];
    const fv = this.fv, rng = this.rng;
    let lastX = rng() * 2 - 1, lastY = rng() * 2 - 1;
    const skip = 20;
    for (let i = -skip; i < POINT_CAPACITY; i++) {
      const rv = rng();
      let j = 0;
      while (rv > fv[j].q) j++;
      const f = fv[j].values;
      const ax = f[0] * lastX + f[1] * lastY + f[2];
      const ay = f[3] * lastX + f[4] * lastY + f[5];
      const c = { x: ax, y: ay, xb: f[1], yb: f[4], xc: f[2], yc: f[5] };
      const o0 = applyVariant(m0, c, rng);
      const o1 = applyVariant(m1, c, rng);
      lastX = interpolateCosine(varianceMix, o0.x, o1.x);
      lastY = interpolateCosine(varianceMix, o0.y, o1.y);
      if (i >= 0) { this.px[i] = lastX; this.py[i] = lastY; this.pq[i] = rv; }
    }
  }

  runPass() {
    this.computePoints();
    if (!this.bbox) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < POINT_CAPACITY; i++) {
        const x = this.px[i], y = this.py[i];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      this.bbox = { minX, maxX, minY, maxY };
    }
    // View transform: original zoomwrap math.
    let zw = this.params.zoom * 2;
    zw *= Math.abs(zw) * 4;
    zw += 0.5;
    const dw = this.width, dh = this.height;
    const rx0 = (-zw + 0.5 + 100) * dw, rx1 = (zw + 0.5 + 100) * dw;
    const ry0 = (-zw + 0.5 + 100) * dh, ry1 = (zw + 0.5 + 100) * dh;
    const b = this.bbox;
    const rad = this.params.rotate * Math.PI;
    const cr = Math.cos(rad), sr = Math.sin(rad);
    for (let i = 0; i < POINT_CAPACITY; i++) {
      // normalize to [-1,1] from the first-pass bbox
      let x = remap(this.px[i], b.minX, b.maxX, -1, 1);
      let y = remap(this.py[i], b.minY, b.maxY, -1, 1);
      // rotate (original handedness)
      const dx = x, dy = y;
      x = dy * sr + dx * cr;
      y = dy * cr - dx * sr;
      // view remap + bilinear splat with modulo tiling
      this.splat(remap(x, -1, 1, rx0, rx1), remap(y, -1, 1, ry0, ry1), this.pq[i]);
    }
    this.passes++;
    return this.passes;
  }

  splat(px, py, ps) {
    const dw = this.width, dh = this.height;
    const x0 = Math.floor(px), y0 = Math.floor(py);
    const x0f = px - x0, y0f = py - y0;
    const corners = [
      [x0, y0, x0f * y0f], [x0 + 1, y0, (1 - x0f) * y0f],
      [x0 + 1, y0 + 1, (1 - x0f) * (1 - y0f)], [x0, y0 + 1, x0f * (1 - y0f)],
    ];
    for (const [cx, cy, v] of corners) {
      const x = cx % dw, y = cy % dh;
      if (x >= 0 && y >= 0 && x < dw && y < dh) {
        this.histA[y * dw + x] += v;
        this.histB[y * dw + x] += v * ps;
      }
    }
  }

  finalize(colors) {
    const dw = this.width, dh = this.height, n = dw * dh;
    const a = new Float32Array(this.histA);
    const bq = new Float32Array(this.histB);
    for (let i = 0; i < n; i++) if (a[i] > 0.001) bq[i] /= a[i];
    let maxA = 0;
    for (let i = 0; i < n; i++) if (a[i] > maxA) maxA = a[i];
    const nf = maxA < 0.001 ? 1 : 1 / maxA;
    const { gamma, contrast, brightness } = this.params;
    for (let i = 0; i < n; i++) {
      const va = a[i];
      let v = Math.pow(va * nf, gamma);
      v = (v - 0.5) * contrast + 0.5 + brightness;
      v = v > 1 ? 1 : v;
      v *= va > 1 ? 1 : va;   // original dim-down anti-aliasing trick
      a[i] = v < 0 ? 0 : v;
    }
    const tm = renderTonemap(colors.c0, colors.c1, colors.c2, colors.bg);
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const ia = Math.min(255, Math.max(0, (a[i] * 256) | 0));
      const ib = Math.min(255, Math.max(0, (bq[i] * 256) | 0));
      const s = (ib * 256 + ia) * 3;
      out[i * 4] = tm[s]; out[i * 4 + 1] = tm[s + 1]; out[i * 4 + 2] = tm[s + 2];
      out[i * 4 + 3] = 255;
    }
    return out;
  }
}

function remap(v, fromMin, fromMax, toMin, toMax) {
  const d = fromMax - fromMin;
  if (Math.abs(d) < EPS) return toMin;
  return toMin + ((v - fromMin) / d) * (toMax - toMin);
}
```

Note on the bilinear weights: the original C++ uses `x0f*y0f` at (x0,y0) — weights mirrored versus the textbook convention. The port keeps the original's exact arrangement (it tiles via `%` and the visual result is what matters for fidelity).

- [ ] **Step 3: Run tests → PASS, commit**

```bash
git add 2d-ifs-fractals/index.html
git commit -m "ifs-fractals: chaos game pipeline with histograms and tonemap"
```

---

### Task 6: UI

**Files:**
- Modify: `2d-ifs-fractals/index.html` (style, body, UI script)

- [ ] **Step 1: Styles and markup** — reuse the repo's standard dark layout CSS (copy the `:root`/panel/slider/button/readout rules from `2d-cloud-chamber`, drop the canvas cursor rule). Body:

```html
<h1>2D IFS Fractals</h1>
<p class="subtitle">A 2009 chaos-game engine reborn: crossfade two IFS systems, warp them through two flame variants, and watch the histogram bloom. Port of opcoders.com gfx_chaos.</p>
<div class="layout">
  <div class="panel">
    <canvas id="display-canvas" width="640" height="640"></canvas>
  </div>
  <div class="controls">
    <fieldset class="panel">
      <legend>System</legend>
      <label class="slider">Preset A <select id="preset0"></select></label>
      <label class="slider">Preset B <select id="preset1"></select></label>
      <label class="slider">Function mix: <span id="function-mix-value"></span>
        <input type="range" id="function-mix" min="0" max="1" step="0.01" value="0">
      </label>
      <label class="slider">Shuffle seed: <span id="seed-value"></span>
        <input type="range" id="seed" min="0" max="100" step="1" value="0">
      </label>
    </fieldset>
    <fieldset class="panel">
      <legend>Variants</legend>
      <label class="slider">Variant A <select id="variant0"></select></label>
      <label class="slider">Variant B <select id="variant1"></select></label>
      <label class="slider">Variant mix: <span id="variance-mix-value"></span>
        <input type="range" id="variance-mix" min="0" max="1" step="0.01" value="0">
      </label>
    </fieldset>
    <fieldset class="panel">
      <legend>Image</legend>
      <label class="slider">Passes: <span id="repeat-value"></span>
        <input type="range" id="repeat" min="1" max="16" step="1" value="4">
      </label>
      <label class="slider">Gamma: <span id="gamma-value"></span>
        <input type="range" id="gamma" min="0.1" max="3" step="0.05" value="1">
      </label>
      <label class="slider">Contrast: <span id="contrast-value"></span>
        <input type="range" id="contrast" min="0" max="3" step="0.05" value="1">
      </label>
      <label class="slider">Brightness: <span id="brightness-value"></span>
        <input type="range" id="brightness" min="-1" max="1" step="0.05" value="0">
      </label>
      <label class="slider">Zoom: <span id="zoom-value"></span>
        <input type="range" id="zoom" min="-1" max="1" step="0.01" value="0">
      </label>
      <label class="slider">Rotate: <span id="rotate-value"></span>
        <input type="range" id="rotate" min="-1" max="1" step="0.01" value="0">
      </label>
    </fieldset>
    <fieldset class="panel">
      <legend>Colors</legend>
      <label class="slider">Highlight <input type="color" id="color0" value="#ffd24d"></label>
      <label class="slider">Mid <input type="color" id="color1" value="#ff5a36"></label>
      <label class="slider">Deep <input type="color" id="color2" value="#7a1fa2"></label>
      <label class="slider">Background <input type="color" id="colorbg" value="#0b0e13"></label>
    </fieldset>
    <fieldset class="panel">
      <legend>Actions</legend>
      <div class="buttons">
        <button id="random-btn">Random</button>
        <button id="reset-view-btn">Reset view</button>
        <button id="animate-btn">Animate mix</button>
      </div>
      <table class="readout">
        <tr><td>Preset A</td><td id="readout-p0"></td></tr>
        <tr><td>Preset B</td><td id="readout-p1"></td></tr>
        <tr><td>Passes</td><td id="readout-passes">0</td></tr>
      </table>
    </fieldset>
  </div>
</div>
```

- [ ] **Step 2: UI script**

```js
"use strict";
const RENDER_SIZE = 480;
const display = document.getElementById("display-canvas");
const displayCtx = display.getContext("2d");
const offscreen = document.createElement("canvas");
offscreen.width = RENDER_SIZE;
offscreen.height = RENDER_SIZE;
const offCtx = offscreen.getContext("2d");
const image = offCtx.createImageData(RENDER_SIZE, RENDER_SIZE);

const renderer = new IfsRenderer({ width: RENDER_SIZE, height: RENDER_SIZE });

function fillSelect(id, items) {
  const sel = document.getElementById(id);
  items.forEach((label, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = label;
    sel.append(o);
  });
  return sel;
}
const preset0Sel = fillSelect("preset0", PRESETS.map((p, i) => `${i} ${p.name}`));
const preset1Sel = fillSelect("preset1", PRESETS.map((p, i) => `${i} ${p.name}`));
const variant0Sel = fillSelect("variant0", VARIANT_MENU.map((v) => v.label));
const variant1Sel = fillSelect("variant1", VARIANT_MENU.map((v) => v.label));
preset1Sel.value = 1;

const SLIDERS = [
  { id: "function-mix", key: "functionMix", fmt: (v) => v.toFixed(2) },
  { id: "seed",         key: "seed",        fmt: (v) => v },
  { id: "variance-mix", key: "varianceMix", fmt: (v) => v.toFixed(2) },
  { id: "repeat",       key: "repeat",      fmt: (v) => v },
  { id: "gamma",        key: "gamma",       fmt: (v) => v.toFixed(2) },
  { id: "contrast",     key: "contrast",    fmt: (v) => v.toFixed(2) },
  { id: "brightness",   key: "brightness",  fmt: (v) => v.toFixed(2) },
  { id: "zoom",         key: "zoom",        fmt: (v) => v.toFixed(2) },
  { id: "rotate",       key: "rotate",      fmt: (v) => v.toFixed(2) },
];

function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function currentParams() {
  const p = { preset0: Number(preset0Sel.value), preset1: Number(preset1Sel.value),
              variant0: Number(variant0Sel.value), variant1: Number(variant1Sel.value) };
  for (const s of SLIDERS) {
    const v = Number(document.getElementById(s.id).value);
    p[s.key] = v;
    document.getElementById(s.id + "-value").textContent = s.fmt(v);
  }
  return p;
}

let needsRestart = true;
function markDirty() { needsRestart = true; }
for (const s of SLIDERS) document.getElementById(s.id).addEventListener("input", markDirty);
for (const sel of [preset0Sel, preset1Sel, variant0Sel, variant1Sel]) sel.addEventListener("change", markDirty);
for (const id of ["color0", "color1", "color2", "colorbg"]) {
  document.getElementById(id).addEventListener("input", () => { needsRepaint = true; });
}
let needsRepaint = false;

document.getElementById("random-btn").addEventListener("click", () => {
  preset0Sel.value = Math.floor(Math.random() * PRESETS.length);
  preset1Sel.value = Math.floor(Math.random() * PRESETS.length);
  variant0Sel.value = Math.floor(Math.random() * VARIANT_MENU.length);
  variant1Sel.value = Math.floor(Math.random() * VARIANT_MENU.length);
  document.getElementById("seed").value = Math.floor(Math.random() * 101);
  markDirty();
});
document.getElementById("reset-view-btn").addEventListener("click", () => {
  for (const [id, v] of [["gamma", 1], ["contrast", 1], ["brightness", 0], ["zoom", 0], ["rotate", 0]])
    document.getElementById(id).value = v;
  markDirty();
});
let animating = false, animT = 0;
document.getElementById("animate-btn").addEventListener("click", (ev) => {
  animating = !animating;
  ev.target.textContent = animating ? "Stop animation" : "Animate mix";
});

function repaint() {
  const colors = {
    c0: hexToRgb(document.getElementById("color0").value),
    c1: hexToRgb(document.getElementById("color1").value),
    c2: hexToRgb(document.getElementById("color2").value),
    bg: hexToRgb(document.getElementById("colorbg").value),
  };
  image.data.set(renderer.finalize(colors));
  offCtx.putImageData(image, 0, 0);
  displayCtx.imageSmoothingEnabled = true;
  displayCtx.drawImage(offscreen, 0, 0, display.width, display.height);
}

function frame() {
  if (animating) {
    animT += 0.004;
    document.getElementById("function-mix").value = ((1 - Math.cos(animT)) / 2).toFixed(3);
    document.getElementById("variance-mix").value = ((1 - Math.cos(animT * 0.37)) / 2).toFixed(3);
    needsRestart = true;
  }
  const p = currentParams();
  if (needsRestart) {
    renderer.setParams(p);
    renderer.resetAccumulation(mulberry32((p.seed * 7919 + 1) >>> 0));
    needsRestart = false;
    needsRepaint = true;
  }
  if (renderer.passes < p.repeat) {
    renderer.runPass();
    needsRepaint = true;
    document.getElementById("readout-passes").textContent = renderer.passes + " / " + p.repeat;
  }
  if (needsRepaint) {
    repaint();
    needsRepaint = false;
  }
  document.getElementById("readout-p0").textContent = PRESETS[p.preset0].name;
  document.getElementById("readout-p1").textContent = PRESETS[p.preset1].name;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 3: Run tests, screenshot, verify**

`node test.mjs` → ALL TESTS PASSED. Headless Chrome screenshot (`--window-size=1080,980 --virtual-time-budget=8000`); Read it: a fractal should be visible (default preset 0 = Kevin Lee's Spiral 1, linear variants), controls populated. Iterate on defaults if the first frame is washed out (gamma is the usual suspect — the original default behavior corresponds to gamma 1).

- [ ] **Step 4: Commit**

```bash
git add 2d-ifs-fractals/index.html
git commit -m "ifs-fractals: full parameter UI with progressive rendering"
```

---

### Task 7: Visual exploration pass and gallery

**Files:**
- Create: `2d-ifs-fractals/screenshot1.png`
- Modify: `gallery.yaml`, root `index.html` (regenerated)
- Possibly modify: `2d-ifs-fractals/index.html` (defaults only)

- [ ] **Step 1: Screenshot several configurations** via a TEMP block setting select/slider values before the loop starts (e.g., a plant preset with julia_n variant at mix 0.4; a spiral pair at function mix 0.5; sierpinski with swirl). Verify variants visually do what their names say (swirl swirls, ngon polygonizes). Pick the most beautiful as the default startup configuration (set the actual `value` attributes / select defaults), and capture `screenshot1.png` from it. Remove the TEMP block, re-run tests.

- [ ] **Step 2: Gallery**

```bash
printf '2d-ifs-fractals: 2D IFS Fractals\n' >> gallery.yaml
python3 build_gallery.py
cd 2d-ifs-fractals && node test.mjs
```

Expected: 34 entries; ALL TESTS PASSED.

- [ ] **Step 3: Commit**

```bash
git add 2d-ifs-fractals gallery.yaml index.html
git commit -m "ifs-fractals: default composition and gallery integration"
```
