# Audio Singularity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `audio-singularity/index.html`, a standalone sound generator where colliding black holes, a bouncing ball, a spinning disk and the AI singularity are presets in one parameter space built on the shared structure of a finite-time singularity.

**Architecture:** One pure-JS DSP core inside a `<script id="shared-code">` block, feeding three consumers: live playback (AudioWorklet via Blob URL, `ScriptProcessorNode` fallback), offline WAV export, and headless Node tests. Everything derives from one number `x` — normalized time to singularity — through a single divergence factor `D(x) = max(|x|,ε)^(−p)`. A seeded PRNG makes exports reproducible and tests deterministic.

**Tech Stack:** Vanilla JavaScript, Web Audio API, Canvas 2D, Node.js (tests only). No build step, no dependencies, no network access.

**Spec:** `docs/superpowers/specs/2026-08-03-audio-singularity-design.md`

## Global Constraints

- Single self-contained `audio-singularity/index.html`. No build step, no external requests, no npm dependencies. Must work opened directly from `file://`.
- All DSP lives in `<script id="shared-code">`. `test.mjs` extracts that block with the regex `/<script id="shared-code">([\s\S]*?)<\/script>/` and evaluates it with `new Function`. **The block must therefore contain no DOM access and no `import`/`export` statements.**
- Tests run with `node test.mjs` from inside `audio-singularity/`, exit 0 on pass, non-zero on fail. Same harness shape as `game-snake/test.mjs`.
- Seeded PRNG (`makeRng`) is the only source of randomness anywhere in the core. No `Math.random()` in `shared-code`.
- Hard cap: impact event rate never exceeds `4000` events/sec (`MAX_EVENT_RATE`).
- Hard cap: swarm voice count never exceeds `64`.
- Frequency clamp: every oscillator frequency clamped to `0.45 * sampleRate`.
- Limiter on by default; output magnitude strictly `< 1.0` when on.
- Commit message prefix: `audio-singularity: ` followed by a lowercase description. End every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Ship `screenshot1.jpg` and a `gallery.yaml` entry `audio-singularity: Audio Singularity`.

## File Structure

| File | Responsibility |
|---|---|
| `audio-singularity/index.html` | Everything. Structured internally as: `<style>`, markup, `<script id="shared-code">` (DSP core + tests), `<script>` (audio glue, UI, canvases, export). |
| `audio-singularity/test.mjs` | Extracts `shared-code`, runs `SingularityTests.run()`, sets exit code. |
| `audio-singularity/screenshot1.jpg` | Gallery screenshot. |
| `gallery.yaml` | Modified: add title override line. |

Inside `shared-code`, in order: PRNG → clock math → `PARAM_SPEC` and `defaultParams` → the five voice factories → limiter → `createEngine` → presets → `renderOffline` → `encodeWav` → `SingularityTests`.

---

### Task 1: Scaffold, PRNG, test harness

Establishes the `shared-code` + `test.mjs` pattern and the deterministic random source everything else depends on.

**Files:**
- Create: `audio-singularity/index.html`
- Create: `audio-singularity/test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `makeRng(seed) -> () => number` returning floats in `[0,1)`. `SingularityTests` with `.run() -> boolean` and an internal `check(name, condition)` / `approx(a, b, tol)` helper pair used by every later task.

- [ ] **Step 1: Create the HTML skeleton with the shared-code block**

Create `audio-singularity/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Audio Singularity</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(160deg, #05060c 0%, #0b0a18 55%, #12081a 100%);
    color: #d8dced;
    min-height: 100vh;
  }
</style>
</head>
<body>
<div class="container"><h1>Audio Singularity</h1></div>

<script id="shared-code">
"use strict";

// ---------------------------------------------------------------------------
// Seeded PRNG. xorshift32. The only source of randomness in the core, so that
// offline renders are reproducible and tests are deterministic.
// ---------------------------------------------------------------------------
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
const SingularityTests = (function () {
  let failures = 0;
  let total = 0;

  function check(name, condition, detail) {
    total++;
    if (!condition) {
      failures++;
      console.error("FAIL: " + name + (detail ? "  [" + detail + "]" : ""));
    }
  }

  function approx(name, actual, expected, tol) {
    const ok = Math.abs(actual - expected) <= tol;
    check(name, ok, "actual=" + actual + " expected=" + expected + " tol=" + tol);
  }

  function relApprox(name, actual, expected, relTol) {
    const ok = Math.abs(actual - expected) <= Math.abs(expected) * relTol;
    check(name, ok, "actual=" + actual + " expected=" + expected + " relTol=" + relTol);
  }

  function testRng() {
    const a = makeRng(1), b = makeRng(1), c = makeRng(2);
    const seqA = [], seqB = [], seqC = [];
    for (let i = 0; i < 100; i++) { seqA.push(a()); seqB.push(b()); seqC.push(c()); }
    check("rng: same seed is identical", seqA.every((v, i) => v === seqB[i]));
    check("rng: different seed differs", seqA.some((v, i) => v !== seqC[i]));
    check("rng: in range [0,1)", seqA.every(v => v >= 0 && v < 1));
    const mean = seqA.reduce((s, v) => s + v, 0) / seqA.length;
    approx("rng: roughly uniform mean", mean, 0.5, 0.1);
    check("rng: seed 0 does not lock up", makeRng(0)() !== makeRng(0)());
  }

  function run() {
    failures = 0; total = 0;
    testRng();
    console.log((total - failures) + "/" + total + " checks passed");
    return failures === 0;
  }

  return { run, check, approx, relApprox };
})();
</script>

<script>
"use strict";
// Application layer added in later tasks.
</script>
</body>
</html>
```

- [ ] **Step 2: Create the test harness**

Create `audio-singularity/test.mjs`:

```js
// Runs the SingularityTests embedded in index.html's shared-code script block.
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
const ok = new Function(`${m[1]}; return SingularityTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 3: Run the tests**

```bash
cd audio-singularity && node test.mjs
```

Expected: `5/5 checks passed`, exit code 0.

- [ ] **Step 4: Verify the harness catches failures**

Temporarily change `check("rng: in range [0,1)", ...)` to `check("rng: in range [0,1)", false)`, run `node test.mjs` again. Expected: one `FAIL:` line, `4/5 checks passed`, exit code 1. Then revert the change and re-run to confirm 5/5.

- [ ] **Step 5: Commit**

```bash
git add audio-singularity/index.html audio-singularity/test.mjs
git commit -m "$(cat <<'EOF'
audio-singularity: scaffold, seeded prng and test harness

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The clock

The single number every voice reads. `x = 1` at start, `x = 0` at `t*`, `x < 0` in the aftermath.

**Files:**
- Modify: `audio-singularity/index.html` (`shared-code` block)

**Interfaces:**
- Consumes: `SingularityTests.check/approx/relApprox` from Task 1.
- Produces: `PHASE_APPROACH`, `PHASE_MERGER`, `PHASE_AFTERMATH` string constants; `divergence(x, p, eps) -> number`; `phaseFor(x, mergerWidth) -> string`; `dbToGain(db) -> number`.

- [ ] **Step 1: Write the failing tests**

In `shared-code`, add this function inside the `SingularityTests` IIFE, above `run`:

```js
  function testClock() {
    // Divergence is 1 at the start of the approach.
    approx("clock: D(1) = 1", divergence(1, 1.0, 1e-3), 1, 1e-12);
    // Power law holds away from the floor.
    relApprox("clock: D(0.01, p=1)", divergence(0.01, 1.0, 1e-6), 100, 1e-12);
    relApprox("clock: D(0.01, p=2)", divergence(0.01, 2.0, 1e-6), 10000, 1e-12);
    // The regularization floor caps the divergence, and epsilon is the cap.
    relApprox("clock: D(0) capped by eps", divergence(0, 1.0, 1e-3), 1000, 1e-12);
    relApprox("clock: D below floor is flat", divergence(1e-9, 1.0, 1e-3), 1000, 1e-12);
    relApprox("clock: ceiling is eps^-p", divergence(0, 1.5, 1e-2), Math.pow(1e-2, -1.5), 1e-12);
    // The aftermath mirrors the approach.
    approx("clock: D is symmetric in x", divergence(-0.01, 1.0, 1e-6), divergence(0.01, 1.0, 1e-6), 1e-9);

    // Phase boundaries land exactly on +/- mergerWidth.
    const w = 0.01;
    check("clock: above width is APPROACH", phaseFor(0.0100001, w) === PHASE_APPROACH);
    check("clock: exactly +width is MERGER", phaseFor(w, w) === PHASE_MERGER);
    check("clock: zero is MERGER", phaseFor(0, w) === PHASE_MERGER);
    check("clock: exactly -width is MERGER", phaseFor(-w, w) === PHASE_MERGER);
    check("clock: below -width is AFTERMATH", phaseFor(-0.0100001, w) === PHASE_AFTERMATH);
    check("clock: start is APPROACH", phaseFor(1, w) === PHASE_APPROACH);

    // Decibel helper.
    approx("clock: 0 dB is unity", dbToGain(0), 1, 1e-12);
    approx("clock: -6 dB is ~0.5", dbToGain(-6), 0.5012, 1e-3);
    approx("clock: -60 dB is silence-ish", dbToGain(-60), 0.001, 1e-6);
  }
```

And call it from `run`:

```js
  function run() {
    failures = 0; total = 0;
    testRng();
    testClock();
    console.log((total - failures) + "/" + total + " checks passed");
    return failures === 0;
  }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd audio-singularity && node test.mjs
```

Expected: crash with `ReferenceError: divergence is not defined`, exit code 1.

- [ ] **Step 3: Implement the clock**

In `shared-code`, immediately after `makeRng`, add:

```js
// ---------------------------------------------------------------------------
// The clock. Everything derives from x, the normalized time to singularity:
//   x = 1  start of approach
//   x = 0  the singularity, t*
//   x < 0  aftermath
// One divergence factor is shared by every voice, so the regularization floor
// eps caps every infinity in the system at once.
// ---------------------------------------------------------------------------
const PHASE_APPROACH  = "APPROACH";
const PHASE_MERGER    = "MERGER";
const PHASE_AFTERMATH = "AFTERMATH";

function divergence(x, p, eps) {
  return Math.pow(Math.max(Math.abs(x), eps), -p);
}

function phaseFor(x, mergerWidth) {
  if (x > mergerWidth) return PHASE_APPROACH;
  if (x < -mergerWidth) return PHASE_AFTERMATH;
  return PHASE_MERGER;
}

function dbToGain(db) {
  return db <= -60 ? 0.001 : Math.pow(10, db / 20);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd audio-singularity && node test.mjs
```

Expected: `21/21 checks passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: clock, divergence factor and phase boundaries

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Parameter spec and defaults

A single data table describing all 42 parameters. The UI generates every slider from it, `defaultParams()` derives from it, and nothing duplicates a range or default.

**Files:**
- Modify: `audio-singularity/index.html` (`shared-code` block)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PARAM_SPEC` — an object keyed by group (`global`, `chirp`, `impacts`, `ringdown`, `field`, `swarm`), each `{ label, params: [...] }` where a param is `{ key, label, min, max, def, step?, unit?, log?, type? }`. `defaultParams() -> object` shaped `{ global: {...}, chirp: {...}, ... }`. `clampParams(p) -> p` clamping every numeric value into its spec range.

- [ ] **Step 1: Write the failing tests**

Add inside the `SingularityTests` IIFE:

```js
  function testParams() {
    const groups = ["global", "chirp", "impacts", "ringdown", "field", "swarm"];
    check("params: all groups present", groups.every(g => PARAM_SPEC[g] && PARAM_SPEC[g].params.length > 0));

    let count = 0;
    const d = defaultParams();
    for (const g of groups) {
      for (const s of PARAM_SPEC[g].params) {
        count++;
        check("params: " + g + "." + s.key + " has a default", d[g][s.key] !== undefined);
        if (s.type === "bool") continue;
        check("params: " + g + "." + s.key + " default in range",
          d[g][s.key] >= s.min && d[g][s.key] <= s.max,
          "def=" + s.def + " min=" + s.min + " max=" + s.max);
        check("params: " + g + "." + s.key + " has a label", typeof s.label === "string" && s.label.length > 0);
      }
    }
    check("params: 42 parameters total", count === 42, "count=" + count);

    // Log-scaled parameters must be strictly positive at both ends.
    for (const g of groups) {
      for (const s of PARAM_SPEC[g].params) {
        if (s.log) check("params: log param " + g + "." + s.key + " is positive", s.min > 0 && s.max > 0);
      }
    }

    // defaultParams returns a fresh object each call, so the UI cannot mutate
    // the spec by editing a params object.
    const d2 = defaultParams();
    d2.chirp.f0 = 999;
    check("params: defaults are not shared", defaultParams().chirp.f0 === 55);

    // Clamping pulls out-of-range values back in.
    const bad = defaultParams();
    bad.chirp.f0 = 1e9;
    bad.swarm.nmax = -5;
    const fixed = clampParams(bad);
    check("params: clamp upper", fixed.chirp.f0 === 400);
    check("params: clamp lower", fixed.swarm.nmax === 1);
  }
```

Add `testParams();` to `run` after `testClock();`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd audio-singularity && node test.mjs
```

Expected: `ReferenceError: PARAM_SPEC is not defined`, exit code 1.

- [ ] **Step 3: Implement the spec table**

In `shared-code`, after the clock section, add:

```js
// ---------------------------------------------------------------------------
// Parameter spec. The single source of truth for ranges, defaults and labels.
// The UI generates every control from this table; nothing else hardcodes a
// range or a default.
// ---------------------------------------------------------------------------
const PARAM_SPEC = {
  global: { label: "Global", params: [
    { key: "T",           label: "Approach duration",  min: 0.5,  max: 60,   def: 8,     step: 0.1,  unit: "s" },
    { key: "p",           label: "Approach exponent",  min: 0.1,  max: 4,    def: 1.0,   step: 0.01 },
    { key: "eps",         label: "Regularization ε", min: 1e-6, max: 0.5, def: 1e-3, log: true },
    { key: "aftermath",   label: "Aftermath length",   min: 0,    max: 20,   def: 4,     step: 0.1,  unit: "s" },
    { key: "mergerWidth", label: "Merger width",       min: 1e-4, max: 0.1,  def: 0.01,  log: true },
    { key: "masterGain",  label: "Master gain",        min: -60,  max: 0,    def: -6,    step: 0.5,  unit: "dB" },
    { key: "limiter",     label: "Limiter",            type: "bool", def: true },
    { key: "seed",        label: "Seed",               min: 1,    max: 9999, def: 1,     step: 1 },
  ]},
  chirp: { label: "Chirp — black holes", params: [
    { key: "f0",        label: "Base frequency",   min: 20,   max: 400,  def: 55,    step: 1,    unit: "Hz" },
    { key: "expo",      label: "Exponent",         min: 0.05, max: 1.5,  def: 0.375, step: 0.005 },
    { key: "partials",  label: "Partials",         min: 1,    max: 12,   def: 4,     step: 1 },
    { key: "inharm",    label: "Inharmonicity",    min: 0,    max: 0.5,  def: 0,     step: 0.005 },
    { key: "morph",     label: "Sine → saw",  min: 0,    max: 1,    def: 0.15,  step: 0.01 },
    { key: "massRatio", label: "Mass ratio",       min: 1,    max: 10,   def: 1.4,   step: 0.05 },
    { key: "detune",    label: "Stereo detune",    min: 0,    max: 30,   def: 6,     step: 0.5,  unit: "¢" },
    { key: "level",     label: "Level",            min: -60,  max: 0,    def: -10,   step: 0.5,  unit: "dB" },
  ]},
  impacts: { label: "Impacts — ball and disk", params: [
    { key: "rate0", label: "Base rate",       min: 0.2, max: 40,   def: 2,   step: 0.1,  unit: "Hz" },
    { key: "q",     label: "Rate exponent",   min: 0.2, max: 3,    def: 1.0, step: 0.01 },
    { key: "decay", label: "Decay",           min: 2,   max: 400,  def: 40,  step: 1,    unit: "ms" },
    { key: "pitch", label: "Burst pitch",     min: 40,  max: 4000, def: 400, step: 5,    unit: "Hz" },
    { key: "drift", label: "Pitch drift",     min: -24, max: 24,   def: 12,  step: 0.5,  unit: "st" },
    { key: "mix",   label: "Noise → tone", min: 0, max: 1,    def: 0.5, step: 0.01 },
    { key: "level", label: "Level",           min: -60, max: 0,    def: -8,  step: 0.5,  unit: "dB" },
  ]},
  ringdown: { label: "Ringdown", params: [
    { key: "ratio",   label: "Fundamental ratio", min: 0.1, max: 4,    def: 0.7, step: 0.01 },
    { key: "modes",   label: "Modes",             min: 1,   max: 8,    def: 3,   step: 1 },
    { key: "spacing", label: "Mode spacing",      min: 1.0, max: 3.0,  def: 1.6, step: 0.01 },
    { key: "q",       label: "Q",                 min: 5,   max: 2000, def: 120, step: 1 },
    { key: "level",   label: "Level",             min: -60, max: 0,    def: -8,  step: 0.5, unit: "dB" },
  ]},
  field: { label: "Field", params: [
    { key: "centre",   label: "Base centre",      min: 40,  max: 2000, def: 200,  step: 5,    unit: "Hz" },
    { key: "tracking", label: "Centre tracking",  min: 0,   max: 1,    def: 0.6,  step: 0.01 },
    { key: "bw",       label: "Bandwidth",        min: 0.1, max: 4,    def: 1.5,  step: 0.01, unit: "oct" },
    { key: "bwTrack",  label: "Bandwidth track",  min: -1,  max: 1,    def: -0.3, step: 0.01 },
    { key: "colour",   label: "White → brown", min: 0, max: 1,    def: 0.5,  step: 0.01 },
    { key: "level",    label: "Level",            min: -60, max: 0,    def: -18,  step: 0.5,  unit: "dB" },
  ]},
  swarm: { label: "Swarm — the AI one", params: [
    { key: "n0",     label: "Initial count",   min: 1,   max: 16,   def: 2,   step: 1 },
    { key: "k",      label: "Growth exponent", min: 0,   max: 2,    def: 0.6, step: 0.01 },
    { key: "nmax",   label: "Max count",       min: 1,   max: 64,   def: 48,  step: 1 },
    { key: "band",   label: "Pitch centre",    min: 100, max: 4000, def: 900, step: 10,  unit: "Hz" },
    { key: "spread", label: "Pitch spread",    min: 0,   max: 4,    def: 2,   step: 0.01, unit: "oct" },
    { key: "decay",  label: "Voice decay",     min: 5,   max: 500,  def: 90,  step: 1,   unit: "ms" },
    { key: "jitter", label: "Retrigger jitter", min: 0,  max: 1,    def: 0.5, step: 0.01 },
    { key: "level",  label: "Level",           min: -60, max: 0,    def: -14, step: 0.5, unit: "dB" },
  ]},
};

const PARAM_GROUPS = Object.keys(PARAM_SPEC);
const VOICE_GROUPS = ["chirp", "impacts", "ringdown", "field", "swarm"];

function defaultParams() {
  const out = {};
  for (const g of PARAM_GROUPS) {
    out[g] = {};
    for (const s of PARAM_SPEC[g].params) out[g][s.key] = s.def;
  }
  out.mute = { chirp: false, impacts: false, ringdown: false, field: false, swarm: false };
  out.solo = null;
  return out;
}

function clampParams(p) {
  for (const g of PARAM_GROUPS) {
    for (const s of PARAM_SPEC[g].params) {
      if (s.type === "bool") { p[g][s.key] = !!p[g][s.key]; continue; }
      let v = Number(p[g][s.key]);
      if (!isFinite(v)) v = s.def;
      p[g][s.key] = Math.min(s.max, Math.max(s.min, v));
    }
  }
  return p;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks pass, exit code 0. If the `42 parameters total` check fails, the reported `count=` tells you how far off the table is.

- [ ] **Step 5: Commit**

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: parameter spec table and defaults

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: WAV encoder

Standalone and dependency-free, so it can be built and tested before any audio exists.

**Files:**
- Modify: `audio-singularity/index.html` (`shared-code` block)

**Interfaces:**
- Consumes: nothing.
- Produces: `encodeWav(L, R, sampleRate, bitDepth) -> Uint8Array`. `L` and `R` are `Float32Array`s of equal length. `bitDepth` is `16` (PCM, format code 1) or `32` (float, format code 3). Always stereo.

- [ ] **Step 1: Write the failing tests**

Add inside the `SingularityTests` IIFE:

```js
  function testWav() {
    const n = 100;
    const L = new Float32Array(n), R = new Float32Array(n);
    for (let i = 0; i < n; i++) { L[i] = Math.sin(i * 0.1); R[i] = -Math.sin(i * 0.1); }

    function str(bytes, off, len) {
      let s = ""; for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[off + i]); return s;
    }
    function u32(bytes, off) {
      return bytes[off] | (bytes[off+1] << 8) | (bytes[off+2] << 16) | (bytes[off+3] << 24);
    }
    function u16(bytes, off) { return bytes[off] | (bytes[off+1] << 8); }

    const w16 = encodeWav(L, R, 48000, 16);
    check("wav16: RIFF magic",  str(w16, 0, 4) === "RIFF");
    check("wav16: WAVE magic",  str(w16, 8, 4) === "WAVE");
    check("wav16: fmt chunk",   str(w16, 12, 4) === "fmt ");
    check("wav16: data chunk",  str(w16, 36, 4) === "data");
    check("wav16: format is PCM",   u16(w16, 20) === 1);
    check("wav16: stereo",          u16(w16, 22) === 2);
    check("wav16: sample rate",     u32(w16, 24) === 48000);
    check("wav16: byte rate",       u32(w16, 28) === 48000 * 2 * 2);
    check("wav16: block align",     u16(w16, 32) === 4);
    check("wav16: bits per sample", u16(w16, 34) === 16);
    check("wav16: data size",       u32(w16, 40) === n * 2 * 2);
    check("wav16: total length",    w16.length === 44 + n * 2 * 2, "len=" + w16.length);
    check("wav16: riff size field", u32(w16, 4) === w16.length - 8);

    const w32 = encodeWav(L, R, 44100, 32);
    check("wav32: format is float", u16(w32, 20) === 3);
    check("wav32: sample rate",     u32(w32, 24) === 44100);
    check("wav32: bits per sample", u16(w32, 34) === 32);
    check("wav32: total length",    w32.length === 44 + n * 2 * 4, "len=" + w32.length);

    // Round-trip a 32-bit float sample: interleaved, left channel first.
    const dv = new DataView(w32.buffer, w32.byteOffset, w32.byteLength);
    approx("wav32: first left sample round-trips",  dv.getFloat32(44, true), L[0], 1e-7);
    approx("wav32: first right sample round-trips", dv.getFloat32(48, true), R[0], 1e-7);

    // 16-bit clamps rather than wrapping.
    const hot = new Float32Array([2.0, -2.0]);
    const wh = encodeWav(hot, hot, 48000, 16);
    const dvh = new DataView(wh.buffer, wh.byteOffset, wh.byteLength);
    check("wav16: clamps positive overs", dvh.getInt16(44, true) === 32767);
    check("wav16: clamps negative overs", dvh.getInt16(48, true) === -32768);
  }
```

Add `testWav();` to `run`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd audio-singularity && node test.mjs
```

Expected: `ReferenceError: encodeWav is not defined`, exit code 1.

- [ ] **Step 3: Implement the encoder**

Add to `shared-code`, after `clampParams`:

```js
// ---------------------------------------------------------------------------
// WAV encoding. Stereo only. bitDepth 16 = PCM, 32 = IEEE float.
// ---------------------------------------------------------------------------
function encodeWav(L, R, sampleRate, bitDepth) {
  const bytesPerSample = bitDepth === 32 ? 4 : 2;
  const frames = L.length;
  const dataBytes = frames * 2 * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataBytes);
  const dv = new DataView(buf);
  let o = 0;

  function writeStr(s) { for (let i = 0; i < s.length; i++) dv.setUint8(o++, s.charCodeAt(i)); }
  function writeU32(v) { dv.setUint32(o, v, true); o += 4; }
  function writeU16(v) { dv.setUint16(o, v, true); o += 2; }

  writeStr("RIFF");
  writeU32(36 + dataBytes);
  writeStr("WAVE");
  writeStr("fmt ");
  writeU32(16);
  writeU16(bitDepth === 32 ? 3 : 1);
  writeU16(2);
  writeU32(sampleRate);
  writeU32(sampleRate * 2 * bytesPerSample);
  writeU16(2 * bytesPerSample);
  writeU16(bitDepth === 32 ? 32 : 16);
  writeStr("data");
  writeU32(dataBytes);

  for (let i = 0; i < frames; i++) {
    for (const ch of [L, R]) {
      const v = ch[i];
      if (bitDepth === 32) {
        dv.setFloat32(o, v, true); o += 4;
      } else {
        const c = Math.max(-1, Math.min(1, v));
        dv.setInt16(o, c < 0 ? Math.round(c * 32768) : Math.round(c * 32767), true);
        o += 2;
      }
    }
  }
  return new Uint8Array(buf);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks pass, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: wav encoder for 16-bit pcm and 32-bit float

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Chirp voice

The black holes. Follows the real inspiral law `f ∝ (t*−t)^(−3/8)`.

**Files:**
- Modify: `audio-singularity/index.html` (`shared-code` block)

**Interfaces:**
- Consumes: `divergence`, `dbToGain`, `PHASE_*` from Task 2; `defaultParams` from Task 3.
- Produces: `chirpFreq(x, f0, expo, eps, sampleRate) -> number`. `makeChirp(sampleRate) -> voice` where a **voice** is `{ setParams(groupParams), reset(), render(L, R, frames, clock) }` and `clock` is `{ x0, x1, p, eps, mergerWidth, gateCoef }`. `render` **adds into** `L`/`R`; it never zeroes them. Every later voice has this identical shape.

- [ ] **Step 1: Write the failing tests**

Add inside the `SingularityTests` IIFE:

```js
  function testChirp() {
    const HUGE = 1e9; // large sample rate so the Nyquist clamp never bites

    // The real inspiral law, across three decades.
    for (const x of [1, 0.1, 0.01, 0.001]) {
      relApprox("chirp: power law at x=" + x,
        chirpFreq(x, 55, 0.375, 1e-9, HUGE), 55 * Math.pow(x, -0.375), 1e-3);
    }
    approx("chirp: unity at x=1", chirpFreq(1, 55, 0.375, 1e-9, HUGE), 55, 1e-9);

    // The regularization floor is the frequency ceiling.
    relApprox("chirp: ceiling at eps=1e-3",
      chirpFreq(0, 55, 0.375, 1e-3, 48000), 55 * Math.pow(1e-3, -0.375), 1e-12);
    relApprox("chirp: ceiling at eps=1e-6",
      chirpFreq(0, 55, 0.375, 1e-6, 48000), 55 * Math.pow(1e-6, -0.375), 1e-12);
    check("chirp: ceiling below eps=1e-6 is under Nyquist",
      chirpFreq(0, 55, 0.375, 1e-6, 48000) < 0.45 * 48000);

    // Beyond that, Nyquist clamps.
    approx("chirp: Nyquist clamp bites at eps=1e-9",
      chirpFreq(0, 55, 0.375, 1e-9, 48000), 0.45 * 48000, 1e-9);
    check("chirp: never exceeds Nyquist clamp",
      chirpFreq(0, 400, 0.375, 1e-12, 48000) <= 0.45 * 48000);

    // Symmetric in the aftermath.
    approx("chirp: symmetric across t*",
      chirpFreq(-0.01, 55, 0.375, 1e-9, HUGE), chirpFreq(0.01, 55, 0.375, 1e-9, HUGE), 1e-9);

    // Rendering produces sound during the approach and silence well past merger.
    const sr = 48000, n = 4096;
    const v = makeChirp(sr);
    const P = defaultParams();
    v.setParams(P.chirp);
    const L = new Float32Array(n), R = new Float32Array(n);
    v.render(L, R, n, { x0: 0.5, x1: 0.5, p: 1, eps: 1e-3, mergerWidth: 0.01, gateCoef: 0.002 });
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]));
    check("chirp: makes sound during approach", peak > 0.001, "peak=" + peak);
    check("chirp: output is finite", L.every(Number.isFinite) && R.every(Number.isFinite));

    // render adds rather than overwrites.
    const L2 = new Float32Array(n).fill(0.25), R2 = new Float32Array(n).fill(0.25);
    v.reset();
    v.render(L2, R2, n, { x0: 0.5, x1: 0.5, p: 1, eps: 1e-3, mergerWidth: 0.01, gateCoef: 0.002 });
    check("chirp: render is additive", L2[0] !== 0 && Math.abs(L2[10] - 0.25) > 1e-9);

    // Stereo detune makes the channels differ.
    v.reset();
    const L3 = new Float32Array(n), R3 = new Float32Array(n);
    v.render(L3, R3, n, { x0: 0.5, x1: 0.5, p: 1, eps: 1e-3, mergerWidth: 0.01, gateCoef: 0.002 });
    let diff = 0; for (let i = 0; i < n; i++) diff += Math.abs(L3[i] - R3[i]);
    check("chirp: detune decorrelates channels", diff > 0.01, "diff=" + diff);

    // The gate closes past merger.
    v.reset();
    const L4 = new Float32Array(n), R4 = new Float32Array(n);
    for (let b = 0; b < 40; b++) {
      L4.fill(0); R4.fill(0);
      v.render(L4, R4, n, { x0: -0.5, x1: -0.5, p: 1, eps: 1e-3, mergerWidth: 0.01, gateCoef: 0.002 });
    }
    let peak4 = 0; for (let i = 0; i < n; i++) peak4 = Math.max(peak4, Math.abs(L4[i]));
    check("chirp: gated off in aftermath", peak4 < 1e-4, "peak=" + peak4);
  }
```

Add `testChirp();` to `run`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd audio-singularity && node test.mjs
```

Expected: `ReferenceError: chirpFreq is not defined`, exit code 1.

- [ ] **Step 3: Implement the chirp**

Add to `shared-code`, after `encodeWav`:

```js
// ---------------------------------------------------------------------------
// Voices. Every voice is { setParams, reset, render(L, R, frames, clock) }.
// render ADDS into L and R. clock = { x0, x1, p, eps, mergerWidth, gateCoef }
// where x is interpolated linearly from x0 to x1 across the block, which keeps
// scrubbing and playback free of zipper noise.
// ---------------------------------------------------------------------------

const MAX_AMP_GROWTH = 16; // caps the physical f^(2/3) amplitude law

function oscShape(phase, morph) {
  const s = Math.sin(phase);
  const t = (phase / (2 * Math.PI)) % 1;
  const saw = 2 * (t < 0 ? t + 1 : t) - 1;
  return s * (1 - morph) + saw * morph;
}

function chirpFreq(x, f0, expo, eps, sampleRate) {
  return Math.min(f0 * Math.pow(Math.max(Math.abs(x), eps), -expo), 0.45 * sampleRate);
}

function makeChirp(sampleRate) {
  const MAXP = 12;
  const phL = new Float64Array(MAXP), phR = new Float64Array(MAXP);
  let P = null, gate = 1;

  return {
    setParams(p) { P = p; },
    reset() { phL.fill(0); phR.fill(0); gate = 1; },
    lastFreq: 0,
    render(L, R, frames, ck) {
      if (!P) return;
      const g = dbToGain(P.level) * 0.2;
      const nyq = 0.45 * sampleRate;
      const detune = Math.pow(2, P.detune / 1200);
      const np = Math.round(P.partials);

      for (let i = 0; i < frames; i++) {
        const x = ck.x0 + (ck.x1 - ck.x0) * (i / frames);
        const target = Math.abs(x) <= ck.mergerWidth || x < 0 ? 0 : 1;
        gate += (target - gate) * ck.gateCoef;
        const f = chirpFreq(x, P.f0, P.expo, ck.eps, sampleRate);
        this.lastFreq = f;
        if (gate < 1e-4) continue;

        const amp = Math.min(Math.pow(f / P.f0, 2 / 3), MAX_AMP_GROWTH);
        let sl = 0, sr = 0;
        for (let k = 0; k < np; k++) {
          const ratio = (k + 1) * (1 + P.inharm * k * k * 0.02);
          const fk = f * ratio;
          if (fk > nyq) break;
          const w = Math.pow(P.massRatio, -k * 0.5) / (k + 1);
          phL[k] += 2 * Math.PI * fk / sampleRate;
          phR[k] += 2 * Math.PI * fk * detune / sampleRate;
          if (phL[k] > 1e6) { phL[k] %= 2 * Math.PI; phR[k] %= 2 * Math.PI; }
          sl += w * oscShape(phL[k], P.morph);
          sr += w * oscShape(phR[k], P.morph);
        }
        const a = g * amp * gate;
        L[i] += sl * a;
        R[i] += sr * a;
      }
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks pass, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: chirp voice on the inspiral power law

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Impacts voice

The ball and the disk. Event onsets form a geometric series accumulating at `t*`. With `q = 1` the onsets have an exact closed form, `x_n = exp(−n/(R₀·T))`, which is what makes this testable rather than merely plausible.

**Files:**
- Modify: `audio-singularity/index.html` (`shared-code` block)

**Interfaces:**
- Consumes: the voice shape and `dbToGain` from Task 5; `makeRng` from Task 1.
- Produces: `MAX_EVENT_RATE = 4000`. `eventRate(x, rate0, q, eps) -> number` (already capped). `expectedEventCount(rate0, q, eps, T) -> number` (closed-form integral). `collectImpactOnsets(rate0, q, eps, T, sampleRate, maxEvents) -> number[]` returning the `x` value at each onset. `makeImpacts(sampleRate, rng) -> voice` with an extra `capBinding` boolean property and a `recentEvents` array of the last 64 onset `x` values.

- [ ] **Step 1: Write the failing tests**

Add inside the `SingularityTests` IIFE:

```js
  function testImpacts() {
    // Rate law and its hard cap.
    relApprox("impacts: rate at x=1", eventRate(1, 2, 1, 1e-3), 2, 1e-12);
    relApprox("impacts: rate at x=0.01", eventRate(0.01, 2, 1, 1e-6), 200, 1e-12);
    relApprox("impacts: floor caps rate", eventRate(0, 2, 1, 1e-3), 2000, 1e-12);
    check("impacts: hard cap binds below the floor",
      eventRate(0, 2, 1, 1e-6) === MAX_EVENT_RATE);
    check("impacts: rate never exceeds the cap",
      [1, 0.1, 1e-3, 1e-6, 0].every(x => eventRate(x, 40, 3, 1e-6) <= MAX_EVENT_RATE));

    // With q = 1 the onsets are exactly geometric: x_n = exp(-n/(rate0*T)).
    const rate0 = 2, T = 8, RT = rate0 * T;
    const onsets = collectImpactOnsets(rate0, 1, 1e-3, T, 48000, 40);
    check("impacts: produced onsets", onsets.length === 40, "got=" + onsets.length);
    for (const n of [1, 5, 20, 40]) {
      relApprox("impacts: onset " + n + " is geometric",
        onsets[n - 1], Math.exp(-n / RT), 0.01);
    }
    // Successive intervals share a constant ratio - the Zeno accumulation.
    const r = Math.exp(-1 / RT);
    for (const n of [2, 10, 30]) {
      relApprox("impacts: interval ratio at n=" + n, onsets[n] / onsets[n - 1], r, 0.02);
    }

    // Total event count matches the closed-form integral, and is finite.
    // Each pair is chosen so the hard cap does NOT bind, since the closed form
    // ignores the cap: rate0 * eps^-q must stay below MAX_EVENT_RATE.
    for (const [q, eps] of [[1, 1e-3], [1, 1e-2], [0.5, 1e-3], [2, 0.05]]) {
      const expected = expectedEventCount(rate0, q, eps, T);
      const actual = collectImpactOnsets(rate0, q, eps, T, 48000, 1e7).length;
      check("impacts: count is finite for q=" + q + " eps=" + eps, isFinite(expected) && expected > 0);
      relApprox("impacts: count matches integral q=" + q + " eps=" + eps, actual, expected, 0.03);
    }

    // Even at the smallest epsilon the count stays bounded by the cap.
    const capped = collectImpactOnsets(2, 1, 1e-6, 8, 48000, 1e7).length;
    check("impacts: capped count is bounded", capped < 4000 * 8 + 10, "count=" + capped);

    // Rendering.
    const sr = 48000, n = 8192;
    const v = makeImpacts(sr, makeRng(1));
    const P = defaultParams();
    v.setParams(P.impacts);
    const L = new Float32Array(n), R = new Float32Array(n);
    // A slow sweep so several events land inside the block.
    v.render(L, R, n, { x0: 0.02, x1: 0.015, p: 1, eps: 1e-3, mergerWidth: 0.01, gateCoef: 0.002 });
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]));
    check("impacts: makes sound", peak > 0.001, "peak=" + peak);
    check("impacts: output is finite", L.every(Number.isFinite) && R.every(Number.isFinite));
    check("impacts: reports recent events", v.recentEvents.length > 0);
    check("impacts: cap not binding at eps=1e-3", v.capBinding === false);

    v.reset();
    v.render(L, R, n, { x0: 0, x1: 0, p: 1, eps: 1e-6, mergerWidth: 0.01, gateCoef: 0.002 });
    check("impacts: reports cap binding at eps=1e-6", v.capBinding === true);
  }
```

Add `testImpacts();` to `run`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd audio-singularity && node test.mjs
```

Expected: `ReferenceError: eventRate is not defined`, exit code 1.

- [ ] **Step 3: Implement the impacts voice**

Add to `shared-code`, after `makeChirp`:

```js
// ---------------------------------------------------------------------------
// Impacts. The ball and the disk are the same voice with different decay and
// tone. Onsets accumulate geometrically at t*; eps makes the total count
// finite, and MAX_EVENT_RATE guarantees it even at the smallest eps.
//
// The rattle-to-pitch fusion around 20 Hz is emergent. Nothing special-cases it.
// ---------------------------------------------------------------------------
const MAX_EVENT_RATE = 4000;
const MAX_GRAINS = 256;

function eventRate(x, rate0, q, eps) {
  return Math.min(rate0 * Math.pow(Math.max(Math.abs(x), eps), -q), MAX_EVENT_RATE);
}

// Closed form for the number of onsets over a linear sweep x: 1 -> 0 in T
// seconds, ignoring the hard cap:
//   N = rate0 * T * ( integral of max(u,eps)^-q du over u in [0,1] )
function expectedEventCount(rate0, q, eps, T) {
  let integral;
  if (Math.abs(q - 1) < 1e-12) {
    integral = Math.log(1 / eps) + 1;
  } else {
    integral = (1 - Math.pow(eps, 1 - q)) / (1 - q) + Math.pow(eps, 1 - q);
  }
  return rate0 * T * integral;
}

// Test/analysis helper: runs the same scheduler the voice uses, over a linear
// sweep, and returns the x value at each onset.
function collectImpactOnsets(rate0, q, eps, T, sampleRate, maxEvents) {
  const dt = 1 / sampleRate;
  const total = Math.floor(T * sampleRate);
  const out = [];
  let phase = 0;
  for (let i = 0; i < total && out.length < maxEvents; i++) {
    const x = 1 - i / total;
    phase += eventRate(x, rate0, q, eps) * dt;
    while (phase >= 1 && out.length < maxEvents) { phase -= 1; out.push(x); }
  }
  return out;
}

function makeImpacts(sampleRate, rng) {
  const gPhase = new Float64Array(MAX_GRAINS);
  const gInc   = new Float64Array(MAX_GRAINS);
  const gEnv   = new Float64Array(MAX_GRAINS);
  const gCoef  = new Float64Array(MAX_GRAINS);
  const gPan   = new Float64Array(MAX_GRAINS);
  const gMix   = new Float64Array(MAX_GRAINS);
  let next = 0, schedPhase = 0, P = null;
  const voice = {
    capBinding: false,
    recentEvents: [],
    setParams(p) { P = p; },
    reset() {
      gEnv.fill(0); gPhase.fill(0); schedPhase = 0; next = 0;
      voice.recentEvents.length = 0; voice.capBinding = false;
    },
    render(L, R, frames, ck) {
      if (!P) return;
      const dt = 1 / sampleRate;
      const g = dbToGain(P.level) * 0.6;
      const nyq = 0.45 * sampleRate;
      const envCoef = Math.exp(-1 / (Math.max(P.decay, 1) * 0.001 * sampleRate));
      voice.capBinding = false;

      for (let i = 0; i < frames; i++) {
        const x = ck.x0 + (ck.x1 - ck.x0) * (i / frames);
        const uncapped = P.rate0 * Math.pow(Math.max(Math.abs(x), ck.eps), -P.q);
        if (uncapped > MAX_EVENT_RATE) voice.capBinding = true;
        // Impacts stop once the singularity has passed.
        if (x > -ck.mergerWidth) {
          schedPhase += Math.min(uncapped, MAX_EVENT_RATE) * dt;
          while (schedPhase >= 1) {
            schedPhase -= 1;
            // Pitch brightens as contact time shortens over the run.
            const drifted = P.pitch * Math.pow(2, (P.drift / 12) * (1 - Math.max(0, Math.min(1, x))));
            gPhase[next] = 0;
            gInc[next]   = 2 * Math.PI * Math.min(drifted, nyq) / sampleRate;
            gEnv[next]   = 1;
            gCoef[next]  = envCoef;
            gPan[next]   = rng();
            gMix[next]   = P.mix;
            next = (next + 1) % MAX_GRAINS;
            voice.recentEvents.push(x);
            if (voice.recentEvents.length > 64) voice.recentEvents.shift();
          }
        }

        let sl = 0, sr = 0;
        for (let k = 0; k < MAX_GRAINS; k++) {
          const e = gEnv[k];
          if (e < 1e-5) continue;
          gPhase[k] += gInc[k];
          const tone = Math.sin(gPhase[k]);
          const noise = rng() * 2 - 1;
          const s = (tone * gMix[k] + noise * (1 - gMix[k])) * e;
          gEnv[k] = e * gCoef[k];
          sl += s * (1 - gPan[k] * 0.6);
          sr += s * (1 - (1 - gPan[k]) * 0.6);
        }
        L[i] += sl * g;
        R[i] += sr * g;
      }
    }
  };
  return voice;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks pass, exit code 0. If the closed-form count checks fail by a constant factor, the scheduler's `phase` handling is off by one event; if they fail by a few percent only at small `eps`, widen nothing — investigate whether the cap is binding in a case the test assumed it would not.

- [ ] **Step 5: Commit**

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: impacts voice with geometric onset accumulation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Ringdown, Field and Swarm voices

Three voices sharing the established shape. Grouped because each is small and none is independently reviewable in a useful way.

**Files:**
- Modify: `audio-singularity/index.html` (`shared-code` block)

**Interfaces:**
- Consumes: the voice shape from Task 5; `divergence` from Task 2; `makeRng` from Task 1.
- Produces: `makeRingdown(sampleRate) -> voice` with an extra `trigger(baseFreq)` method. `makeField(sampleRate, rng) -> voice`. `makeSwarm(sampleRate, rng) -> voice` with an extra `activeCount` number property. `swarmCount(D, n0, k, nmax) -> number`.

- [ ] **Step 1: Write the failing tests**

Add inside the `SingularityTests` IIFE:

```js
  function testRingdown() {
    const sr = 48000, n = 4096;
    const v = makeRingdown(sr);
    const P = defaultParams();
    v.setParams(P.ringdown);
    const ck = { x0: -0.5, x1: -0.5, p: 1, eps: 1e-3, mergerWidth: 0.01, gateCoef: 0.002 };

    // Silent until triggered.
    const L0 = new Float32Array(n), R0 = new Float32Array(n);
    v.render(L0, R0, n, ck);
    check("ringdown: silent before trigger", L0.every(s => s === 0));

    // Sounds after triggering.
    v.trigger(700);
    const L1 = new Float32Array(n), R1 = new Float32Array(n);
    v.render(L1, R1, n, ck);
    let peak1 = 0; for (let i = 0; i < n; i++) peak1 = Math.max(peak1, Math.abs(L1[i]));
    check("ringdown: sounds after trigger", peak1 > 0.001, "peak=" + peak1);
    check("ringdown: output is finite", L1.every(Number.isFinite));

    // And decays.
    for (let b = 0; b < 20; b++) { L1.fill(0); R1.fill(0); v.render(L1, R1, n, ck); }
    let peak2 = 0; for (let i = 0; i < n; i++) peak2 = Math.max(peak2, Math.abs(L1[i]));
    check("ringdown: decays over time", peak2 < peak1 * 0.9, "p1=" + peak1 + " p2=" + peak2);

    // Higher Q decays more slowly.
    function tailPeak(qv) {
      const w = makeRingdown(sr);
      const p = defaultParams(); p.ringdown.q = qv;
      w.setParams(p.ringdown); w.trigger(700);
      const A = new Float32Array(n), B = new Float32Array(n);
      for (let b = 0; b < 15; b++) { A.fill(0); B.fill(0); w.render(A, B, n, ck); }
      let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(A[i]));
      return pk;
    }
    check("ringdown: higher Q rings longer", tailPeak(1000) > tailPeak(20));

    // reset silences it.
    v.reset();
    const L3 = new Float32Array(n), R3 = new Float32Array(n);
    v.render(L3, R3, n, ck);
    check("ringdown: reset silences", L3.every(s => s === 0));
  }

  function testField() {
    const sr = 48000, n = 4096;
    const v = makeField(sr, makeRng(1));
    const P = defaultParams();
    v.setParams(P.field);
    const L = new Float32Array(n), R = new Float32Array(n);
    v.render(L, R, n, { x0: 0.5, x1: 0.5, p: 1, eps: 1e-3, mergerWidth: 0.01, gateCoef: 0.002 });
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]));
    check("field: makes sound", peak > 1e-5, "peak=" + peak);
    check("field: output is finite", L.every(Number.isFinite) && R.every(Number.isFinite));

    // Stays finite and bounded when the divergence is extreme.
    v.reset();
    const L2 = new Float32Array(n), R2 = new Float32Array(n);
    v.render(L2, R2, n, { x0: 0, x1: 0, p: 4, eps: 1e-6, mergerWidth: 0.01, gateCoef: 0.002 });
    check("field: finite at extreme divergence", L2.every(Number.isFinite));
    let peak2 = 0; for (let i = 0; i < n; i++) peak2 = Math.max(peak2, Math.abs(L2[i]));
    check("field: filter does not blow up", peak2 < 100, "peak=" + peak2);
  }

  function testSwarm() {
    // Population growth law and its caps.
    check("swarm: at least one voice", swarmCount(1, 2, 0.6, 48) >= 1);
    check("swarm: grows with divergence",
      swarmCount(100, 2, 0.6, 48) > swarmCount(1, 2, 0.6, 48));
    check("swarm: capped at nmax", swarmCount(1e12, 2, 0.6, 48) === 48);
    check("swarm: never exceeds 64", swarmCount(1e12, 16, 2, 64) === 64);
    check("swarm: k=0 means no growth", swarmCount(1e6, 3, 0, 48) === 3);
    relApprox("swarm: obeys n0 * D^k", swarmCount(1000, 2, 0.5, 64), 2 * Math.sqrt(1000), 0.01);

    const sr = 48000, n = 8192;
    const v = makeSwarm(sr, makeRng(1));
    const P = defaultParams();
    v.setParams(P.swarm);
    const L = new Float32Array(n), R = new Float32Array(n);
    v.render(L, R, n, { x0: 0.05, x1: 0.04, p: 1, eps: 1e-3, mergerWidth: 0.01, gateCoef: 0.002 });
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]));
    check("swarm: makes sound", peak > 1e-4, "peak=" + peak);
    check("swarm: output is finite", L.every(Number.isFinite) && R.every(Number.isFinite));
    check("swarm: reports its population", v.activeCount >= 1 && v.activeCount <= 48,
      "count=" + v.activeCount);

    // Population is larger nearer the singularity.
    const early = makeSwarm(sr, makeRng(1)); early.setParams(P.swarm);
    early.render(new Float32Array(n), new Float32Array(n), n,
      { x0: 0.9, x1: 0.9, p: 1, eps: 1e-3, mergerWidth: 0.01, gateCoef: 0.002 });
    check("swarm: denser near t*", v.activeCount > early.activeCount,
      "near=" + v.activeCount + " far=" + early.activeCount);
  }
```

Add `testRingdown(); testField(); testSwarm();` to `run`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd audio-singularity && node test.mjs
```

Expected: `ReferenceError: makeRingdown is not defined`, exit code 1.

- [ ] **Step 3: Implement the three voices**

Add to `shared-code`, after `makeImpacts`:

```js
// ---------------------------------------------------------------------------
// Ringdown. Damped sinusoids, triggered once on entering MERGER. Decay time is
// tau = Q / (pi * f), which is the standard quasinormal-mode relation.
// ---------------------------------------------------------------------------
function makeRingdown(sampleRate) {
  const MAXM = 8;
  const ph = new Float64Array(MAXM), inc = new Float64Array(MAXM);
  const env = new Float64Array(MAXM), coef = new Float64Array(MAXM);
  const amp = new Float64Array(MAXM);
  let P = null;

  return {
    setParams(p) { P = p; },
    reset() { env.fill(0); ph.fill(0); },
    trigger(baseFreq) {
      if (!P) return;
      const nyq = 0.45 * sampleRate;
      const f0 = Math.max(20, baseFreq * P.ratio);
      const modes = Math.round(P.modes);
      for (let k = 0; k < MAXM; k++) {
        if (k >= modes) { env[k] = 0; continue; }
        const f = Math.min(f0 * Math.pow(P.spacing, k), nyq);
        ph[k] = 0;
        inc[k] = 2 * Math.PI * f / sampleRate;
        env[k] = 1;
        amp[k] = 1 / (k + 1);
        coef[k] = Math.exp(-Math.PI * f / (P.q * sampleRate));
      }
    },
    render(L, R, frames, ck) {
      if (!P) return;
      const g = dbToGain(P.level) * 0.35;
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let k = 0; k < MAXM; k++) {
          if (env[k] < 1e-6) continue;
          ph[k] += inc[k];
          if (ph[k] > 1e6) ph[k] %= 2 * Math.PI;
          s += Math.sin(ph[k]) * env[k] * amp[k];
          env[k] *= coef[k];
        }
        L[i] += s * g;
        R[i] += s * g;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Field. Bandpassed noise whose centre and bandwidth track the divergence.
// Negative bandwidth tracking narrows the band as t* nears, which reads as
// focusing rather than as growing noise.
// ---------------------------------------------------------------------------
function makeField(sampleRate, rng) {
  let lp = 0, low = 0, band = 0, P = null;

  return {
    setParams(p) { P = p; },
    reset() { lp = 0; low = 0; band = 0; },
    render(L, R, frames, ck) {
      if (!P) return;
      const g = dbToGain(P.level) * 0.9;
      const nyq = 0.45 * sampleRate;
      for (let i = 0; i < frames; i++) {
        const x = ck.x0 + (ck.x1 - ck.x0) * (i / frames);
        const D = divergence(x, ck.p, ck.eps);

        const fc = Math.max(20, Math.min(nyq, P.centre * Math.pow(D, P.tracking)));
        const bwOct = Math.max(0.05, Math.min(6, P.bw * Math.pow(D, P.bwTrack)));
        const Q = 1 / (2 * Math.sinh(Math.LN2 / 2 * bwOct));
        const f = Math.min(1.4, 2 * Math.sin(Math.PI * fc / sampleRate));
        const damp = Math.min(1.6, 1 / Q);

        // White to brown via a one-pole lowpass blend.
        const white = rng() * 2 - 1;
        lp = lp * 0.97 + white * 0.03;
        const src = white * (1 - P.colour) + lp * 8 * P.colour;

        // Chamberlin state-variable filter, bandpass output.
        low += f * band;
        const high = src - low - damp * band;
        band += f * high;
        if (!isFinite(low) || !isFinite(band)) { low = 0; band = 0; }

        const s = Math.max(-4, Math.min(4, band)) * g;
        L[i] += s;
        R[i] += s * 0.85;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Swarm. The AI one: not one thing getting louder, but more and more things
// arriving at once until they smear.
// ---------------------------------------------------------------------------
const SWARM_MAX = 64;

function swarmCount(D, n0, k, nmax) {
  return Math.max(1, Math.min(Math.min(nmax, SWARM_MAX), Math.round(n0 * Math.pow(D, k))));
}

function makeSwarm(sampleRate, rng) {
  const ph    = new Float64Array(SWARM_MAX);
  const inc   = new Float64Array(SWARM_MAX);
  const env   = new Float64Array(SWARM_MAX);
  const coef  = new Float64Array(SWARM_MAX);
  const timer = new Float64Array(SWARM_MAX);
  const baseR = new Float64Array(SWARM_MAX);
  const pan   = new Float64Array(SWARM_MAX);
  for (let k = 0; k < SWARM_MAX; k++) {
    baseR[k] = 2 + 6 * rng();
    timer[k] = rng() / baseR[k];
    pan[k] = rng();
  }
  let P = null;
  const voice = {
    activeCount: 1,
    setParams(p) { P = p; },
    reset() {
      env.fill(0); ph.fill(0);
      for (let k = 0; k < SWARM_MAX; k++) timer[k] = rng() / baseR[k];
      voice.activeCount = 1;
    },
    render(L, R, frames, ck) {
      if (!P) return;
      const dt = 1 / sampleRate;
      const g = dbToGain(P.level) * 0.5;
      const nyq = 0.45 * sampleRate;
      const envCoef = Math.exp(-1 / (Math.max(P.decay, 1) * 0.001 * sampleRate));

      for (let i = 0; i < frames; i++) {
        const x = ck.x0 + (ck.x1 - ck.x0) * (i / frames);
        const D = divergence(x, ck.p, ck.eps);
        const n = swarmCount(D, P.n0, P.k, P.nmax);
        voice.activeCount = n;
        const accel = Math.pow(D, 0.25);

        let sl = 0, sr = 0;
        for (let k = 0; k < n; k++) {
          timer[k] -= dt;
          if (timer[k] <= 0) {
            const jit = 1 + P.jitter * (2 * rng() - 1) * 0.5;
            timer[k] = Math.max(0.002, jit / (baseR[k] * accel));
            const f = P.band * Math.pow(2, (rng() - 0.5) * P.spread);
            ph[k] = 0;
            inc[k] = 2 * Math.PI * Math.min(f, nyq) / sampleRate;
            env[k] = 1;
            coef[k] = envCoef;
          }
          if (env[k] < 1e-5) continue;
          ph[k] += inc[k];
          const s = Math.sin(ph[k]) * env[k];
          env[k] *= coef[k];
          sl += s * (1 - pan[k] * 0.7);
          sr += s * (1 - (1 - pan[k]) * 0.7);
        }
        L[i] += sl * g;
        R[i] += sr * g;
      }
    }
  };
  return voice;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks pass, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: ringdown, field and swarm voices

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Engine, limiter, presets and offline render

Assembles the voices behind one interface, adds the limiter, defines the six presets, and produces `renderOffline` — which is what both WAV export and the heaviest tests use.

**Files:**
- Modify: `audio-singularity/index.html` (`shared-code` block)

**Interfaces:**
- Consumes: every voice factory from Tasks 5–7; `phaseFor`, `divergence`, `dbToGain` from Task 2; `defaultParams`, `clampParams` from Task 3.
- Produces:
  - `makeLimiter(sampleRate) -> { process(sample) -> number, reset() }`
  - `createEngine(params, sampleRate, seed) -> { setParams(p), setClock(x), render(L, R, frames), readMeters(), reset() }`
  - `readMeters() -> { phase, x, D, chirpHz, eventRate, swarmCount, capBinding, recentEvents }`
  - `PRESETS` — array of `{ id, name, params }` where `params` is a nested partial overlay merged onto `defaultParams()`
  - `applyPreset(id) -> params` (a full, clamped params object)
  - `makeOfflineRenderer(params, sampleRate, seed) -> { frames, L, R, advance(maxFrames) -> framesDone, done() -> boolean }` — an incremental renderer owning the only offline render loop. `advance` renders at most `maxFrames` more frames and returns the running total.
  - `renderOffline(params, sampleRate, seed) -> { L: Float32Array, R: Float32Array }` — a thin wrapper that advances the renderer to completion in one call. Renders `T + aftermath` seconds with `x` sweeping linearly from `1` to `−aftermath/T`.

  Task 12's WAV export drives the **same** `makeOfflineRenderer` a slice at a time so it can yield to the browser. There is exactly one offline render loop in the codebase, and `renderOffline`'s tests cover it.

- [ ] **Step 1: Write the failing tests**

Add inside the `SingularityTests` IIFE:

```js
  function testLimiter() {
    const lim = makeLimiter(48000);
    check("limiter: passes quiet signal through", Math.abs(lim.process(0.3) - 0.3) < 1e-6);
    let worst = 0;
    for (let i = 0; i < 20000; i++) worst = Math.max(worst, Math.abs(lim.process(Math.sin(i * 0.05) * 40)));
    check("limiter: bounds hot signal under 1.0", worst < 1.0, "worst=" + worst);
    check("limiter: hot signal is still audible", worst > 0.5, "worst=" + worst);
    check("limiter: handles non-finite input", isFinite(lim.process(NaN)) && isFinite(lim.process(Infinity)));
  }

  function testEngine() {
    const sr = 48000;
    const P = defaultParams();
    const eng = createEngine(P, sr, 1);
    const L = new Float32Array(1024), R = new Float32Array(1024);

    eng.setClock(0.5);
    eng.render(L, R, 1024);
    let peak = 0; for (let i = 0; i < 1024; i++) peak = Math.max(peak, Math.abs(L[i]));
    check("engine: makes sound in approach", peak > 1e-4, "peak=" + peak);

    // render overwrites its buffer rather than adding to it, unlike a voice.
    const dirtyL = new Float32Array(1024).fill(9), dirtyR = new Float32Array(1024).fill(9);
    eng.setClock(0.5);
    eng.render(dirtyL, dirtyR, 1024);
    check("engine: overwrites the output buffer",
      dirtyL.every(s => Math.abs(s) <= 1), "max=" + Math.max(...dirtyL));

    const m = eng.readMeters();
    check("engine: meters report phase", m.phase === PHASE_APPROACH);
    check("engine: meters report chirp frequency", m.chirpHz > 0);
    check("engine: meters report swarm count", m.swarmCount >= 1);
    relApprox("engine: meters report D", m.D, divergence(0.5, P.global.p, P.global.eps), 1e-6);

    // Crossing into MERGER triggers the ringdown; crossing back re-arms it.
    eng.setClock(0); eng.render(L, R, 1024);
    check("engine: merger phase reported", eng.readMeters().phase === PHASE_MERGER);
    eng.setClock(-0.5); eng.render(L, R, 1024);
    check("engine: aftermath phase reported", eng.readMeters().phase === PHASE_AFTERMATH);
    let tail = 0; for (let i = 0; i < 1024; i++) tail = Math.max(tail, Math.abs(L[i]));
    check("engine: aftermath still rings", tail > 1e-5, "tail=" + tail);

    // Scrubbing backward through MERGER re-arms the ringdown, so crossing again
    // fires it a second time rather than staying spent.
    const eng4 = createEngine(defaultParams(), sr, 1);
    const L4 = new Float32Array(1024), R4 = new Float32Array(1024);
    function ringPeakAfterCrossing(e) {
      e.setParams((function () { const q = defaultParams(); q.solo = "ringdown"; return q; })());
      e.setClock(0.5);  e.render(L4, R4, 1024);   // approach
      e.setClock(-0.5); e.render(L4, R4, 1024);   // cross into aftermath
      let pk = 0; for (let i = 0; i < 1024; i++) pk = Math.max(pk, Math.abs(L4[i]));
      return pk;
    }
    const firstCross = ringPeakAfterCrossing(eng4);
    check("engine: ringdown fires on first crossing", firstCross > 1e-5, "peak=" + firstCross);
    eng4.setClock(0.9); eng4.render(L4, R4, 1024);  // scrub back into APPROACH
    const secondCross = ringPeakAfterCrossing(eng4);
    check("engine: ringdown re-arms after scrubbing back", secondCross > 1e-5,
      "peak=" + secondCross);

    // Solo and mute.
    const P2 = defaultParams();
    P2.mute.chirp = true; P2.mute.impacts = true; P2.mute.ringdown = true;
    P2.mute.field = true; P2.mute.swarm = true;
    const eng2 = createEngine(P2, sr, 1);
    eng2.setClock(0.5);
    const L2 = new Float32Array(1024), R2 = new Float32Array(1024);
    eng2.render(L2, R2, 1024);
    check("engine: all muted is silent", L2.every(s => s === 0));

    const P3 = defaultParams();
    P3.solo = "field";
    const eng3 = createEngine(P3, sr, 1);
    eng3.setClock(0.5);
    const L3 = new Float32Array(1024), R3 = new Float32Array(1024);
    eng3.render(L3, R3, 1024);
    check("engine: solo produces sound", L3.some(s => s !== 0));

    // Solo overrides mute: a muted voice that is soloed is still heard.
    const P4 = defaultParams();
    P4.solo = "field"; P4.mute.field = true;
    const eng5 = createEngine(P4, sr, 1);
    eng5.setClock(0.5);
    const L5 = new Float32Array(1024), R5 = new Float32Array(1024);
    eng5.render(L5, R5, 1024);
    check("engine: solo overrides mute", L5.some(s => s !== 0));
  }

  function testPresets() {
    check("presets: six presets", PRESETS.length === 6, "n=" + PRESETS.length);
    const ids = PRESETS.map(p => p.id);
    for (const id of ["black-hole-merger", "bouncing-ball", "eulers-disk",
                      "ai-singularity", "hard-wall", "gentle-landing"]) {
      check("presets: has " + id, ids.indexOf(id) >= 0);
    }
    check("presets: ids are unique", new Set(ids).size === ids.length);
    for (const p of PRESETS) {
      check("presets: " + p.id + " has a name", typeof p.name === "string" && p.name.length > 0);
      const full = applyPreset(p.id);
      for (const g of PARAM_GROUPS) {
        for (const s of PARAM_SPEC[g].params) {
          if (s.type === "bool") continue;
          check("presets: " + p.id + " " + g + "." + s.key + " in range",
            full[g][s.key] >= s.min && full[g][s.key] <= s.max,
            "value=" + full[g][s.key]);
        }
      }
    }
    check("presets: hard wall uses the smallest epsilon",
      applyPreset("hard-wall").global.eps <= 1e-5);
    check("presets: gentle landing is heavily regularized",
      applyPreset("gentle-landing").global.eps >= 0.05);
  }

  function testOfflineRender() {
    const sr = 8000; // low rate keeps the test suite fast

    for (const preset of PRESETS) {
      const P = applyPreset(preset.id);
      P.global.T = 1.5;
      P.global.aftermath = 0.5;
      const out = renderOffline(P, sr, 1);
      const expectedFrames = Math.floor((1.5 + 0.5) * sr);
      check("offline: " + preset.id + " length", out.L.length === expectedFrames,
        "len=" + out.L.length + " expected=" + expectedFrames);
      check("offline: " + preset.id + " left is finite", out.L.every(Number.isFinite));
      check("offline: " + preset.id + " right is finite", out.R.every(Number.isFinite));
      let peak = 0;
      for (let i = 0; i < out.L.length; i++) {
        peak = Math.max(peak, Math.abs(out.L[i]), Math.abs(out.R[i]));
      }
      check("offline: " + preset.id + " peak under 1.0 with limiter", peak <= 1.0, "peak=" + peak);
      check("offline: " + preset.id + " is not silent", peak > 0.01, "peak=" + peak);
    }

    // Determinism: same seed, byte-identical output.
    const P = applyPreset("ai-singularity");
    P.global.T = 1; P.global.aftermath = 0.5;
    const a = renderOffline(P, sr, 7);
    const b = renderOffline(P, sr, 7);
    let identical = a.L.length === b.L.length;
    for (let i = 0; identical && i < a.L.length; i++) {
      if (a.L[i] !== b.L[i] || a.R[i] !== b.R[i]) identical = false;
    }
    check("offline: same seed is byte-identical", identical);

    const c = renderOffline(P, sr, 8);
    let differs = false;
    for (let i = 0; i < a.L.length; i++) if (a.L[i] !== c.L[i]) { differs = true; break; }
    check("offline: different seed differs", differs);

    // Slicing the renderer the way the WAV export does must produce byte-identical
    // audio to running it in one call. This is what lets the export share the loop.
    const sliced = makeOfflineRenderer(P, sr, 7);
    let guard = 0;
    while (!sliced.done() && guard++ < 10000) sliced.advance(777);
    check("offline: sliced render terminates", sliced.done());
    check("offline: sliced render has the same length", sliced.frames === a.L.length);
    let sameAsOneShot = true;
    for (let i = 0; i < a.L.length; i++) {
      if (sliced.L[i] !== a.L[i] || sliced.R[i] !== a.R[i]) { sameAsOneShot = false; break; }
    }
    check("offline: sliced render matches one-shot render", sameAsOneShot);

    // Limiter off can exceed 1.0 on a hostile preset - that is the point.
    const hot = applyPreset("hard-wall");
    hot.global.T = 1; hot.global.aftermath = 0.2; hot.global.limiter = false;
    hot.global.masterGain = 0;
    const h = renderOffline(hot, sr, 1);
    check("offline: hard wall stays finite without the limiter", h.L.every(Number.isFinite));
  }
```

Add `testLimiter(); testEngine(); testPresets(); testOfflineRender();` to `run`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd audio-singularity && node test.mjs
```

Expected: `ReferenceError: makeLimiter is not defined`, exit code 1.

- [ ] **Step 3: Implement the limiter, engine, presets and offline render**

Add to `shared-code`, after `makeSwarm`:

```js
// ---------------------------------------------------------------------------
// Limiter. Envelope-follower gain reduction into a soft knee. Output magnitude
// is strictly below 1.0 while enabled.
// ---------------------------------------------------------------------------
const LIMIT_THRESHOLD = 0.85;

function softClip(s) {
  const a = Math.abs(s);
  if (a <= LIMIT_THRESHOLD) return s;
  const shaped = LIMIT_THRESHOLD +
    (1 - LIMIT_THRESHOLD) * Math.tanh((a - LIMIT_THRESHOLD) / (1 - LIMIT_THRESHOLD));
  return s < 0 ? -shaped : shaped;
}

function makeLimiter(sampleRate) {
  const rel = Math.exp(-1 / (0.002 * sampleRate));
  let envelope = 0;
  return {
    reset() { envelope = 0; },
    process(s) {
      if (!isFinite(s)) return 0;
      const a = Math.abs(s);
      envelope = a > envelope ? a : envelope * rel;
      const g = envelope > LIMIT_THRESHOLD ? LIMIT_THRESHOLD / envelope : 1;
      return softClip(s * g);
    }
  };
}

// ---------------------------------------------------------------------------
// Engine. Owns the voices and the limiter, but NOT the transport: the caller
// advances x and calls setClock. That is what lets scrubbing, playback and
// offline rendering share one code path.
// ---------------------------------------------------------------------------
function createEngine(params, sampleRate, seed) {
  const rng = makeRng(seed);
  const voices = {
    chirp:    makeChirp(sampleRate),
    impacts:  makeImpacts(sampleRate, rng),
    ringdown: makeRingdown(sampleRate),
    field:    makeField(sampleRate, rng),
    swarm:    makeSwarm(sampleRate, rng),
  };
  const limL = makeLimiter(sampleRate);
  const limR = makeLimiter(sampleRate);
  let P = clampParams(params);
  let xPrev = 1, xTarget = 1;
  let prevPhase = PHASE_APPROACH;
  const meters = {
    phase: PHASE_APPROACH, x: 1, D: 1, chirpHz: 0,
    eventRate: 0, swarmCount: 1, capBinding: false, recentEvents: [],
  };

  function pushParams() {
    for (const g of VOICE_GROUPS) voices[g].setParams(P[g]);
  }
  pushParams();

  function audible(name) {
    if (P.solo) return P.solo === name;
    return !P.mute[name];
  }

  return {
    setParams(next) { P = clampParams(next); pushParams(); },
    setClock(x) { xTarget = x; },
    reset() {
      for (const g of VOICE_GROUPS) voices[g].reset();
      limL.reset(); limR.reset();
      xPrev = xTarget;
      prevPhase = phaseFor(xTarget, P.global.mergerWidth);
    },
    render(L, R, frames) {
      L.fill(0); R.fill(0);
      const mw = P.global.mergerWidth;
      const phase = phaseFor(xTarget, mw);

      // Entering MERGER from the approach fires the ringdown once, seeded with
      // the chirp's terminal frequency. Scrubbing back re-arms everything.
      if (prevPhase === PHASE_APPROACH && phase !== PHASE_APPROACH) {
        voices.ringdown.trigger(
          chirpFreq(mw, P.chirp.f0, P.chirp.expo, P.global.eps, sampleRate));
      } else if (prevPhase !== PHASE_APPROACH && phase === PHASE_APPROACH) {
        for (const g of VOICE_GROUPS) voices[g].reset();
      }
      prevPhase = phase;

      const ck = {
        x0: xPrev, x1: xTarget,
        p: P.global.p, eps: P.global.eps,
        mergerWidth: mw,
        gateCoef: 1 - Math.exp(-1 / (0.015 * sampleRate)),
      };

      for (const g of VOICE_GROUPS) if (audible(g)) voices[g].render(L, R, frames, ck);

      const mg = dbToGain(P.global.masterGain);
      if (P.global.limiter) {
        for (let i = 0; i < frames; i++) {
          L[i] = limL.process(L[i] * mg);
          R[i] = limR.process(R[i] * mg);
        }
      } else {
        for (let i = 0; i < frames; i++) {
          L[i] = isFinite(L[i]) ? L[i] * mg : 0;
          R[i] = isFinite(R[i]) ? R[i] * mg : 0;
        }
      }

      xPrev = xTarget;
      meters.phase = phase;
      meters.x = xTarget;
      meters.D = divergence(xTarget, P.global.p, P.global.eps);
      meters.chirpHz = voices.chirp.lastFreq;
      meters.eventRate = eventRate(xTarget, P.impacts.rate0, P.impacts.q, P.global.eps);
      meters.swarmCount = voices.swarm.activeCount;
      meters.capBinding = voices.impacts.capBinding;
      meters.recentEvents = voices.impacts.recentEvents;
    },
    readMeters() { return meters; },
  };
}

// ---------------------------------------------------------------------------
// Presets. Points in one parameter space, not separate models.
// ---------------------------------------------------------------------------
const PRESETS = [
  { id: "black-hole-merger", name: "Black Hole Merger", params: {
    global:   { T: 10, p: 1.0, eps: 1e-3, aftermath: 6, masterGain: -6 },
    chirp:    { f0: 45, partials: 5, massRatio: 1.6, level: -4 },
    impacts:  { level: -60 },
    ringdown: { ratio: 0.8, modes: 3, q: 300, level: -4 },
    field:    { centre: 120, tracking: 0.5, bwTrack: -0.4, level: -20 },
    swarm:    { level: -60 },
  }},
  { id: "bouncing-ball", name: "Bouncing Ball", params: {
    global:   { T: 12, p: 1.0, eps: 3e-3, aftermath: 2, masterGain: -6 },
    chirp:    { level: -60 },
    impacts:  { rate0: 1.2, q: 1.0, decay: 18, pitch: 320, drift: 14, mix: 0.35, level: -4 },
    ringdown: { level: -60 },
    field:    { level: -34 },
    swarm:    { level: -60 },
  }},
  { id: "eulers-disk", name: "Euler's Disk", params: {
    global:   { T: 16, p: 1.0, eps: 1.5e-3, aftermath: 3, masterGain: -6 },
    chirp:    { level: -60 },
    impacts:  { rate0: 3, q: 1.0, decay: 160, pitch: 240, drift: 4, mix: 0.8, level: -6 },
    ringdown: { ratio: 1.2, modes: 2, q: 600, level: -12 },
    field:    { centre: 300, tracking: 0.35, bw: 2.2, level: -26 },
    swarm:    { level: -60 },
  }},
  { id: "ai-singularity", name: "AI Singularity", params: {
    global:   { T: 20, p: 2.2, eps: 8e-4, aftermath: 6, masterGain: -8 },
    chirp:    { f0: 30, partials: 3, morph: 0.35, level: -18 },
    impacts:  { rate0: 0.8, q: 1.2, decay: 25, pitch: 900, drift: 18, mix: 0.6, level: -16 },
    ringdown: { ratio: 0.5, modes: 5, q: 400, level: -10 },
    field:    { centre: 160, tracking: 0.75, bw: 2.0, bwTrack: -0.5, colour: 0.7, level: -16 },
    swarm:    { n0: 3, k: 0.75, nmax: 56, band: 1100, spread: 2.6, decay: 70, jitter: 0.7, level: -6 },
  }},
  { id: "hard-wall", name: "Hard Wall", params: {
    global:   { T: 6, p: 3.0, eps: 1e-6, aftermath: 3, masterGain: -12 },
    chirp:    { f0: 60, partials: 8, morph: 0.6, level: -6 },
    impacts:  { rate0: 6, q: 2.0, decay: 8, pitch: 700, drift: 20, mix: 0.3, level: -6 },
    ringdown: { ratio: 0.4, modes: 6, q: 90, level: -8 },
    field:    { centre: 400, tracking: 0.9, bwTrack: 0.4, level: -12 },
    swarm:    { n0: 6, k: 1.2, nmax: 64, spread: 3.2, decay: 40, level: -8 },
  }},
  { id: "gentle-landing", name: "Gentle Landing", params: {
    global:   { T: 14, p: 0.7, eps: 0.12, aftermath: 8, masterGain: -6 },
    chirp:    { f0: 70, partials: 3, morph: 0.05, level: -8 },
    impacts:  { rate0: 1.5, q: 0.8, decay: 120, pitch: 300, drift: 6, mix: 0.75, level: -14 },
    ringdown: { ratio: 1.0, modes: 4, spacing: 1.9, q: 900, level: -4 },
    field:    { centre: 180, tracking: 0.4, bw: 1.2, bwTrack: -0.5, colour: 0.8, level: -22 },
    swarm:    { n0: 2, k: 0.4, nmax: 20, band: 700, spread: 1.4, decay: 200, level: -18 },
  }},
];

function applyPreset(id) {
  const preset = PRESETS.find(p => p.id === id);
  const out = defaultParams();
  if (!preset) return out;
  for (const g of Object.keys(preset.params)) {
    Object.assign(out[g], preset.params[g]);
  }
  return clampParams(out);
}

// ---------------------------------------------------------------------------
// Offline render. Sweeps x linearly in real time from 1 to -aftermath/T, which
// is exactly what Play does live. Knobs are frozen; only the clock moves.
//
// This is the only offline render loop. renderOffline runs it to completion in
// one call for tests; the WAV export drives it a slice per animation frame so
// the page stays responsive. Both get identical audio.
// ---------------------------------------------------------------------------
function makeOfflineRenderer(params, sampleRate, seed) {
  const P = clampParams(params);
  const T = P.global.T;
  const frames = Math.floor((T + P.global.aftermath) * sampleRate);
  const L = new Float32Array(frames), R = new Float32Array(frames);
  const eng = createEngine(P, sampleRate, seed);
  const BLOCK = 512;
  const bl = new Float32Array(BLOCK), br = new Float32Array(BLOCK);
  let cursor = 0;

  return {
    frames, L, R,
    done() { return cursor >= frames; },
    advance(maxFrames) {
      const stop = Math.min(frames, cursor + maxFrames);
      while (cursor < stop) {
        const n = Math.min(BLOCK, frames - cursor);
        eng.setClock(1 - ((cursor + n) / sampleRate) / T);
        eng.render(bl, br, n);
        L.set(bl.subarray(0, n), cursor);
        R.set(br.subarray(0, n), cursor);
        cursor += n;
      }
      return cursor;
    },
  };
}

function renderOffline(params, sampleRate, seed) {
  const r = makeOfflineRenderer(params, sampleRate, seed);
  r.advance(r.frames);
  return { L: r.L, R: r.R };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks pass, exit code 0. The `is not silent` check per preset is the one most likely to fail — if a preset comes out silent, its voice levels are all near `-60 dB` or its `T` is so short that no event fires within the test's 1.5 s.

- [ ] **Step 5: Commit**

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: engine, limiter, six presets and offline render

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Live audio, transport and minimal UI

First point at which the thing makes sound in a browser. AudioWorklet with a `ScriptProcessorNode` fallback, both running the identical engine.

**Files:**
- Modify: `audio-singularity/index.html` (markup, `<style>`, and the application `<script>`)

**Interfaces:**
- Consumes: `createEngine`, `applyPreset`, `defaultParams`, `PARAM_SPEC` from earlier tasks.
- Produces: a global `App` object in the application script with `App.params`, `App.engine`, `App.setX(x)`, `App.play()`, `App.pause()`, `App.rebuildEngine()`, `App.meters()`, and `App.analyser` (an `AnalyserNode` or `null`).

- [ ] **Step 1: Add the markup and styles**

Replace the `<body>` content before the scripts with:

```html
<header>
  <h1>Audio Singularity</h1>
  <p>Black holes, a bouncing ball, a spinning disk and the AI singularity are the same shape: something diverges at a finite time.</p>
</header>

<div class="container">
  <div class="panel transport">
    <div class="row">
      <button id="playBtn">Play</button>
      <label class="chk"><input type="checkbox" id="loopChk"> Loop</label>
      <span class="readout" id="phaseOut">APPROACH</span>
      <span class="readout" id="xOut">x = 1.000</span>
    </div>
    <div class="row">
      <label for="scrub">Time to singularity</label>
      <input type="range" id="scrub" min="0" max="1000" value="0" step="1">
    </div>
  </div>

  <div class="panel">
    <div class="row" id="presetRow"></div>
  </div>

  <div id="panels"></div>
</div>
```

Add to `<style>`:

```css
  header { text-align: center; padding: 28px 16px 6px; }
  header h1 { font-size: 2rem; font-weight: 300; letter-spacing: 0.12em; color: #b7c4ff; }
  header p { font-size: 0.85rem; color: #6f77a8; margin-top: 6px; max-width: 640px;
             margin-left: auto; margin-right: auto; line-height: 1.5; }
  .container { max-width: 980px; margin: 0 auto; padding: 16px;
               display: flex; flex-direction: column; gap: 14px; }
  .panel { background: #0a0b18; border: 1px solid #232748; border-radius: 12px; padding: 12px 14px; }
  .panel > h2 { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.14em;
                text-transform: uppercase; color: #7f88c8; margin-bottom: 10px;
                cursor: pointer; display: flex; align-items: center; gap: 10px; }
  .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .transport .row { margin-bottom: 8px; }
  .transport .row:last-child { margin-bottom: 0; }
  .transport label { font-size: 0.8rem; color: #7f88c8; }
  #scrub { flex: 1; min-width: 200px; }
  button { background: #1b1f3d; color: #cdd4ff; border: 1px solid #333a6e;
           border-radius: 7px; padding: 7px 14px; font-size: 0.85rem; cursor: pointer; }
  button:hover { background: #262c55; }
  button.active { background: #3a2f6b; border-color: #6a58c0; color: #ffffff; }
  .readout { font-family: ui-monospace, Menlo, monospace; font-size: 0.78rem;
             color: #8fa0e8; background: #10132a; padding: 4px 9px; border-radius: 5px; }
  .chk { font-size: 0.8rem; color: #7f88c8; display: flex; align-items: center; gap: 5px; }
  .params { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px 18px; }
  .param { display: flex; flex-direction: column; gap: 2px; }
  .param .lab { display: flex; justify-content: space-between; font-size: 0.74rem; color: #767ea8; }
  .param .val { font-family: ui-monospace, Menlo, monospace; color: #9fb0f0; }
  .param input[type=range] { width: 100%; }
  .voice-btns { margin-left: auto; display: flex; gap: 6px; }
  .voice-btns button { padding: 2px 9px; font-size: 0.7rem; }
  .collapsed .params { display: none; }
```

- [ ] **Step 2: Implement the audio glue**

Replace the application `<script>` with:

```html
<script>
"use strict";

const App = {
  ctx: null,
  node: null,
  analyser: null,
  engine: null,
  params: applyPreset("black-hole-merger"),
  presetId: "black-hole-merger",
  x: 1,
  playing: false,
  loop: false,
  lastTime: 0,
  usingWorklet: false,
  workletMeters: null,

  // In the worklet path the audio-thread engine is the one rendering, so it
  // owns the meters and posts them back. On the fallback path the main-thread
  // engine renders and its meters are read directly.
  meters() {
    if (this.usingWorklet) return this.workletMeters;
    return this.engine ? this.engine.readMeters() : null;
  },

  setX(x) {
    const P = this.params.global;
    this.x = Math.max(-P.aftermath / P.T, Math.min(1, x));
    if (this.engine) this.engine.setClock(this.x);
  },

  rebuildEngine() {
    if (!this.ctx) return;
    this.engine = createEngine(this.params, this.ctx.sampleRate, this.params.global.seed);
    this.engine.setClock(this.x);
    if (this.node && this.node.port) {
      this.node.port.postMessage({ type: "params", params: this.params });
    }
  },

  pushParams() {
    if (this.engine) this.engine.setParams(this.params);
    if (this.node && this.node.port) {
      this.node.port.postMessage({ type: "params", params: this.params });
    }
  },

  play() {
    this.ensureAudio().then(() => {
      if (this.x <= -this.params.global.aftermath / this.params.global.T + 1e-9) this.setX(1);
      this.playing = true;
      this.lastTime = performance.now();
      document.getElementById("playBtn").textContent = "Pause";
    });
  },

  pause() {
    this.playing = false;
    document.getElementById("playBtn").textContent = "Play";
  },

  // The transport is an automated hand on the scrub: x advances linearly in
  // real time, because a finite-time singularity genuinely arrives.
  tick() {
    if (this.playing) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const P = this.params.global;
      let nx = this.x - dt / P.T;
      const floor = -P.aftermath / P.T;
      if (nx <= floor) {
        if (this.loop) { nx = 1; if (this.engine) this.engine.reset(); }
        else { nx = floor; this.pause(); }
      }
      this.setX(nx);
    }
  },

  async ensureAudio() {
    if (this.ctx) { if (this.ctx.state === "suspended") await this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.engine = createEngine(this.params, this.ctx.sampleRate, this.params.global.seed);
    this.engine.setClock(this.x);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.35;

    const core = document.getElementById("shared-code").textContent;
    let ok = false;
    try {
      const src = core + "\n" + WORKLET_GLUE;
      const url = URL.createObjectURL(new Blob([src], { type: "application/javascript" }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.node = new AudioWorkletNode(this.ctx, "singularity-processor", { outputChannelCount: [2] });
      this.node.port.onmessage = (e) => {
        if (e.data.type === "meters") this.workletMeters = e.data.meters;
      };
      this.node.port.postMessage({ type: "init", params: this.params, seed: this.params.global.seed });
      ok = true;
      this.usingWorklet = true;
    } catch (e) {
      console.warn("AudioWorklet unavailable, falling back to ScriptProcessorNode:", e);
    }

    if (!ok) {
      // Same engine, main-thread host. Required under file:// on some browsers.
      this.node = this.ctx.createScriptProcessor(2048, 0, 2);
      this.node.onaudioprocess = (ev) => {
        const L = ev.outputBuffer.getChannelData(0);
        const R = ev.outputBuffer.getChannelData(1);
        this.engine.setClock(this.x);
        this.engine.render(L, R, L.length);
      };
      this.usingWorklet = false;
    }

    this.node.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    if (this.ctx.state === "suspended") await this.ctx.resume();
  },
};

// Worklet host. Appended to the shared-code source so the processor runs the
// identical engine; only the transport plumbing differs.
const WORKLET_GLUE = `
class SingularityProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = null;
    this.x = 1;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === "init") {
        this.engine = createEngine(d.params, sampleRate, d.seed);
      } else if (d.type === "params" && this.engine) {
        this.engine.setParams(d.params);
      } else if (d.type === "clock") {
        this.x = d.x;
      } else if (d.type === "reset" && this.engine) {
        this.engine.reset();
      }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!this.engine) return true;
    this.engine.setClock(this.x);
    this.engine.render(out[0], out[1], out[0].length);
    // Post meters back roughly every 2048 frames so the UI has something to
    // draw. The audio thread is the only place the real engine state lives.
    this.frames = (this.frames || 0) + out[0].length;
    if (this.frames >= 2048) {
      this.frames = 0;
      this.port.postMessage({ type: "meters", meters: this.engine.readMeters() });
    }
    return true;
  }
}
registerProcessor("singularity-processor", SingularityProcessor);
`;

// The transport runs on animation frames and pushes x to whichever audio path
// is live. The worklet gets it by message; the fallback reads App.x directly
// inside onaudioprocess.
function pumpClock() {
  App.tick();
  if (App.usingWorklet && App.node && App.node.port) {
    App.node.port.postMessage({ type: "clock", x: App.x });
  }
  requestAnimationFrame(pumpClock);
}
</script>
```

- [ ] **Step 3: Wire the transport and preset buttons**

Append to the application script:

```js
// The scrub slider is log-mapped across the approach so most of its travel
// covers the last decade before t*. Position 0 = x 1 (far), 1000 = deepest.
const SCRUB_MIN_X = 1e-6;
function scrubToX(v) {
  const t = v / 1000;
  if (t <= 0.85) {
    const u = t / 0.85; // 1 down to SCRUB_MIN_X, logarithmic
    return Math.pow(10, (1 - u) * Math.log10(1 / SCRUB_MIN_X)) * SCRUB_MIN_X;
  }
  const u = (t - 0.85) / 0.15; // into the aftermath
  return -u * (App.params.global.aftermath / App.params.global.T);
}
function xToScrub(x) {
  if (x >= 0) {
    const cl = Math.max(SCRUB_MIN_X, Math.min(1, x));
    const u = 1 - Math.log10(cl / SCRUB_MIN_X) / Math.log10(1 / SCRUB_MIN_X);
    return Math.round(u * 0.85 * 1000);
  }
  const span = App.params.global.aftermath / App.params.global.T || 1;
  return Math.round((0.85 + Math.min(1, -x / span) * 0.15) * 1000);
}

function buildPresetRow() {
  const row = document.getElementById("presetRow");
  row.innerHTML = "";
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.textContent = p.name;
    b.dataset.id = p.id;
    b.className = p.id === App.presetId ? "active" : "";
    b.onclick = () => {
      App.presetId = p.id;
      App.params = applyPreset(p.id);
      App.setX(1);
      App.rebuildEngine();
      buildPresetRow();
      buildPanels();
    };
    row.appendChild(b);
  }
}

document.getElementById("playBtn").onclick = () => App.playing ? App.pause() : App.play();
document.getElementById("loopChk").onchange = (e) => { App.loop = e.target.checked; };

const scrub = document.getElementById("scrub");
scrub.oninput = () => {
  App.pause();
  App.ensureAudio();
  App.setX(scrubToX(Number(scrub.value)));
};

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target.tagName !== "INPUT") {
    e.preventDefault();
    App.playing ? App.pause() : App.play();
  }
});

function refreshReadouts() {
  scrub.value = String(xToScrub(App.x));
  const m = App.meters();
  document.getElementById("phaseOut").textContent = m ? m.phase : phaseFor(App.x, App.params.global.mergerWidth);
  document.getElementById("xOut").textContent = "x = " + App.x.toFixed(App.x < 0.01 ? 6 : 3);
  requestAnimationFrame(refreshReadouts);
}

buildPresetRow();
requestAnimationFrame(pumpClock);
requestAnimationFrame(refreshReadouts);
</script>
```

`buildPanels()` is defined in Task 10; add a temporary stub `function buildPanels() {}` now and delete it in Task 10.

- [ ] **Step 4: Verify in a browser**

```bash
open audio-singularity/index.html
```

Check by hand:
1. Press Play. Sound starts, `x` counts down from 1, the phase readout moves `APPROACH → MERGER → AFTERMATH`, playback stops at the end.
2. Drag the scrub slider. Playback pauses, `x` follows, and the sound changes continuously with no clicks.
3. Hold the scrub near the far right of the approach region — the sound should be dense but stable, not silent and not runaway.
4. Click each preset. Each produces an audibly different sound.
5. Press Space. Play/pause toggles.
6. Open the console and check `App.usingWorklet`. It should be `true`.
7. **Both audio paths must be exercised before this task is done.** Force the fallback by changing the line `await this.ctx.audioWorklet.addModule(url);` to `await this.ctx.audioWorklet.addModuleNope(url);`, reload, and confirm: the console logs `AudioWorklet unavailable, falling back to ScriptProcessorNode`, `App.usingWorklet` is `false`, and the page still plays and scrubs correctly. Then revert the typo and reload.
8. Confirm no console errors on either path.

- [ ] **Step 5: Run tests and commit**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks still pass (the application script is outside `shared-code` and is not evaluated by the tests).

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: live audio, log-mapped scrub transport and presets

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Full parameter UI

All 42 controls, generated from `PARAM_SPEC`. Nothing here hardcodes a range.

**Files:**
- Modify: `audio-singularity/index.html` (application `<script>`)

**Interfaces:**
- Consumes: `PARAM_SPEC`, `PARAM_GROUPS`, `VOICE_GROUPS` from Task 3; `App` from Task 9.
- Produces: `buildPanels()` rendering every group into `#panels`, replacing the Task 9 stub.

- [ ] **Step 1: Implement the generated UI**

Delete the `function buildPanels() {}` stub and add:

```js
// Log-scaled sliders map their 0..1000 position geometrically between min and max.
function sliderToValue(spec, pos) {
  const t = pos / 1000;
  if (spec.log) return spec.min * Math.pow(spec.max / spec.min, t);
  const v = spec.min + (spec.max - spec.min) * t;
  return spec.step ? Math.round(v / spec.step) * spec.step : v;
}
function valueToSlider(spec, v) {
  if (spec.log) return Math.round(1000 * Math.log(v / spec.min) / Math.log(spec.max / spec.min));
  return Math.round(1000 * (v - spec.min) / (spec.max - spec.min));
}
function formatValue(spec, v) {
  let s;
  if (spec.log && v < 0.01) s = v.toExponential(1);
  else if (Math.abs(v) >= 100) s = v.toFixed(0);
  else if (Math.abs(v) >= 10) s = v.toFixed(1);
  else s = v.toFixed(spec.step && spec.step >= 1 ? 0 : 3);
  return s + (spec.unit ? " " + spec.unit : "");
}

function buildPanels() {
  const host = document.getElementById("panels");
  host.innerHTML = "";

  for (const g of PARAM_GROUPS) {
    const panel = document.createElement("div");
    panel.className = "panel";

    const h = document.createElement("h2");
    h.textContent = PARAM_SPEC[g].label;
    h.onclick = () => panel.classList.toggle("collapsed");
    panel.appendChild(h);

    if (VOICE_GROUPS.indexOf(g) >= 0) {
      const btns = document.createElement("span");
      btns.className = "voice-btns";
      for (const kind of ["solo", "mute"]) {
        const b = document.createElement("button");
        b.textContent = kind === "solo" ? "S" : "M";
        b.title = kind === "solo" ? "Solo" : "Mute";
        const isOn = () => kind === "solo" ? App.params.solo === g : App.params.mute[g];
        b.className = isOn() ? "active" : "";
        b.onclick = (ev) => {
          ev.stopPropagation();
          if (kind === "solo") App.params.solo = App.params.solo === g ? null : g;
          else App.params.mute[g] = !App.params.mute[g];
          App.pushParams();
          buildPanels();
        };
        btns.appendChild(b);
      }
      h.appendChild(btns);
    }

    const grid = document.createElement("div");
    grid.className = "params";

    for (const spec of PARAM_SPEC[g].params) {
      const wrap = document.createElement("div");
      wrap.className = "param";

      if (spec.type === "bool") {
        const lab = document.createElement("label");
        lab.className = "chk";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!App.params[g][spec.key];
        cb.onchange = () => {
          if (spec.key === "limiter" && !cb.checked) {
            const go = confirm(
              "Turning the limiter off lets this instrument produce very loud, " +
              "unbounded output. Lower your volume first.\n\nDisable the limiter?");
            if (!go) { cb.checked = true; return; }
          }
          App.params[g][spec.key] = cb.checked;
          App.pushParams();
        };
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(" " + spec.label));
        wrap.appendChild(lab);
        grid.appendChild(wrap);
        continue;
      }

      const lab = document.createElement("div");
      lab.className = "lab";
      const name = document.createElement("span");
      name.textContent = spec.label;
      const val = document.createElement("span");
      val.className = "val";
      val.textContent = formatValue(spec, App.params[g][spec.key]);
      lab.appendChild(name); lab.appendChild(val);

      const sl = document.createElement("input");
      sl.type = "range"; sl.min = "0"; sl.max = "1000"; sl.step = "1";
      sl.value = String(valueToSlider(spec, App.params[g][spec.key]));
      sl.oninput = () => {
        const v = sliderToValue(spec, Number(sl.value));
        App.params[g][spec.key] = v;
        val.textContent = formatValue(spec, v);
        if (g === "global" && spec.key === "seed") App.rebuildEngine();
        else App.pushParams();
        if (g === "global" && spec.key === "eps") updateEpsReadout();
      };

      wrap.appendChild(lab);
      wrap.appendChild(sl);
      grid.appendChild(wrap);
    }

    panel.appendChild(grid);
    host.appendChild(panel);
  }
  updateEpsReadout();
}

// Epsilon is the headline knob, so show its consequence: the divergence ceiling.
function updateEpsReadout() {
  const el = document.getElementById("epsOut");
  if (!el) return;
  const P = App.params.global;
  const ceiling = Math.pow(P.eps, -P.p);
  el.textContent = "ceiling ×" + (ceiling >= 1000 ? ceiling.toExponential(1) : ceiling.toFixed(0));
}

buildPanels();
```

- [ ] **Step 2: Add the epsilon ceiling readout to the transport row**

In the markup, inside the first transport `.row`, after `#xOut`:

```html
      <span class="readout" id="epsOut">ceiling ×1000</span>
```

Write that as a literal `×1000` in the HTML, not as an escape.

- [ ] **Step 3: Verify in a browser**

```bash
open audio-singularity/index.html
```

Check by hand:
1. Six panels appear. Count the controls: 8 + 8 + 7 + 5 + 6 + 8 = 42.
2. Clicking a panel heading collapses and expands it.
3. Every slider updates its numeric readout and changes the sound live while playing.
4. The `ε` slider moves geometrically — small moves near the left end change the value by tiny absolute amounts — and the ceiling readout updates.
5. **The headline check:** load `Black Hole Merger`, press Play, and listen. Then set `ε` to its minimum and replay — the same event should tear itself apart in aliasing. Set `ε` to its maximum and replay — it should resolve into a clean bell. If those two do not sound clearly different, something is wrong with how `ε` reaches the voices.
6. **The second headline check:** load `Bouncing Ball`, press Play, and listen for the rattle turning into a pitch as the events crowd. It should be a continuous transition, not a switch.
7. Solo and mute buttons work; solo overrides mute.
8. Turning off the limiter shows the confirmation dialog, and cancelling leaves it on.
9. Changing Seed and replaying `AI Singularity` gives an audibly different swarm.

- [ ] **Step 4: Run tests and commit**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks still pass.

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: spec-driven parameter panels with solo and mute

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Spectrogram and singularity clock canvases

The spectrogram makes the power law legible; the clock makes the event crowding legible.

**Files:**
- Modify: `audio-singularity/index.html` (markup, `<style>`, application `<script>`)

**Interfaces:**
- Consumes: `App.analyser`, `App.meters()`, `App.x` from Task 9; `chirpFreq` from Task 5.
- Produces: `drawSpectrogram()` and `drawClock()`, both driven from the existing `refreshReadouts` animation frame loop.

- [ ] **Step 1: Add the canvases to the markup**

Insert between the preset panel and `#panels`:

```html
  <div class="panel viz">
    <canvas id="spectro"></canvas>
  </div>
  <div class="panel viz">
    <canvas id="clock"></canvas>
    <div class="row meters">
      <span class="readout" id="mD">D = 1</span>
      <span class="readout" id="mChirp">chirp 55 Hz</span>
      <span class="readout" id="mRate">events 2.0/s</span>
      <span class="readout" id="mSwarm">swarm 2</span>
      <span class="readout warn" id="mCap" hidden>rate cap binding</span>
    </div>
  </div>
```

Add to `<style>`:

```css
  .panel.viz { padding: 0; overflow: hidden; }
  canvas#spectro { width: 100%; height: 220px; display: block; }
  canvas#clock { width: 100%; height: 90px; display: block; }
  .meters { padding: 8px 12px; gap: 8px; }
  .readout.warn { color: #ffb4b4; background: #33121c; }
```

- [ ] **Step 2: Implement the drawing**

Append to the application script:

```js
// HiDPI: size the backing store in device pixels, never CSS-stretch a
// logical-size buffer.
function fitCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(cv.clientWidth * dpr);
  const h = Math.round(cv.clientHeight * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; return true; }
  return false;
}

const SPEC_MIN_HZ = 20, SPEC_MAX_HZ = 22050;
let specData = null;

function yForHz(hz, h) {
  const t = Math.log(Math.max(SPEC_MIN_HZ, hz) / SPEC_MIN_HZ) / Math.log(SPEC_MAX_HZ / SPEC_MIN_HZ);
  return h - t * h;
}

function drawSpectrogram() {
  const cv = document.getElementById("spectro");
  const resized = fitCanvas(cv);
  const ctx = cv.getContext("2d");
  const w = cv.width, h = cv.height;
  if (resized) { ctx.fillStyle = "#05060f"; ctx.fillRect(0, 0, w, h); }
  if (!App.analyser) return;

  if (!specData || specData.length !== App.analyser.frequencyBinCount) {
    specData = new Uint8Array(App.analyser.frequencyBinCount);
  }
  App.analyser.getByteFrequencyData(specData);

  // Scroll left by one column, then draw the newest column on the right.
  ctx.drawImage(cv, -2, 0);
  ctx.fillStyle = "#05060f";
  ctx.fillRect(w - 2, 0, 2, h);

  const nyquist = App.ctx ? App.ctx.sampleRate / 2 : 24000;
  for (let y = 0; y < h; y++) {
    const t = 1 - y / h;
    const hz = SPEC_MIN_HZ * Math.pow(SPEC_MAX_HZ / SPEC_MIN_HZ, t);
    const bin = Math.min(specData.length - 1, Math.round(hz / nyquist * specData.length));
    const v = specData[bin] / 255;
    if (v < 0.02) continue;
    const r = Math.round(40 + 215 * Math.pow(v, 0.8));
    const g = Math.round(30 + 120 * Math.pow(v, 1.6));
    const b = Math.round(90 + 165 * Math.pow(v, 0.5));
    ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
    ctx.fillRect(w - 2, y, 2, 1);
  }

  // The regularization ceiling: the frequency the chirp cannot pass.
  const P = App.params;
  const sr = App.ctx ? App.ctx.sampleRate : 48000;
  const ceiling = chirpFreq(0, P.chirp.f0, P.chirp.expo, P.global.eps, sr);
  const dpr2 = window.devicePixelRatio || 1;
  const cy = yForHz(ceiling, h);
  ctx.strokeStyle = "rgba(255,150,120,0.55)";
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = Math.max(1, dpr2);
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,180,150,0.85)";
  ctx.font = (11 * dpr2) + "px ui-monospace, monospace";
  ctx.fillText("regularization ceiling " + Math.round(ceiling) + " Hz", 8, Math.max(14 * dpr2, cy - 6 * dpr2));

  // When the unclamped ceiling exceeds Nyquist the chirp folds back down the
  // spectrum. That aliasing is a real consequence of removing the
  // regularization, not a defect - so it gets named rather than hidden.
  const unclamped = P.chirp.f0 * Math.pow(P.global.eps, -P.chirp.expo);
  if (unclamped > 0.45 * sr) {
    ctx.fillStyle = "rgba(255,140,140,0.9)";
    ctx.fillText("ceiling above Nyquist — chirp is aliasing", 8, h - 8 * dpr2);
  }
}

const CLOCK_MIN_X = 1e-6;
function xToPixel(x, w) {
  const approachW = w * 0.82;
  if (x >= 0) {
    const cl = Math.max(CLOCK_MIN_X, Math.min(1, x));
    const t = 1 - Math.log10(cl / CLOCK_MIN_X) / Math.log10(1 / CLOCK_MIN_X);
    return t * approachW;
  }
  const span = App.params.global.aftermath / App.params.global.T || 1;
  return approachW + Math.min(1, -x / span) * (w - approachW);
}

function drawClock() {
  const cv = document.getElementById("clock");
  fitCanvas(cv);
  const ctx = cv.getContext("2d");
  const w = cv.width, h = cv.height;
  const dpr = window.devicePixelRatio || 1;

  ctx.fillStyle = "#070818";
  ctx.fillRect(0, 0, w, h);

  // Decade gridlines: 1, 0.1, ... 1e-6.
  ctx.font = (10 * dpr) + "px ui-monospace, monospace";
  for (let d = 0; d <= 6; d++) {
    const x = Math.pow(10, -d);
    const px = xToPixel(x, w);
    ctx.strokeStyle = "rgba(120,132,200,0.18)";
    ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h - 18 * dpr); ctx.stroke();
    ctx.fillStyle = "rgba(130,142,205,0.65)";
    ctx.fillText(d === 0 ? "1" : "1e-" + d, px + 3 * dpr, h - 6 * dpr);
  }

  // The singularity itself.
  const tstar = xToPixel(0, w);
  ctx.strokeStyle = "rgba(255,120,140,0.8)";
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath(); ctx.moveTo(tstar, 0); ctx.lineTo(tstar, h - 18 * dpr); ctx.stroke();

  // Recent impact onsets, so the crowding and fusion is visible.
  const m = App.meters();
  if (m && m.recentEvents) {
    ctx.strokeStyle = "rgba(150,230,255,0.75)";
    ctx.lineWidth = dpr;
    for (const ex of m.recentEvents) {
      const px = xToPixel(ex, w);
      ctx.beginPath();
      ctx.moveTo(px, h * 0.15);
      ctx.lineTo(px, h * 0.5);
      ctx.stroke();
    }
  }

  // Playhead.
  const px = xToPixel(App.x, w);
  ctx.fillStyle = "#ffe9a8";
  ctx.fillRect(px - dpr, 0, 2 * dpr, h - 18 * dpr);

  // Phase label.
  const phase = m ? m.phase : phaseFor(App.x, App.params.global.mergerWidth);
  ctx.fillStyle = phase === PHASE_MERGER ? "#ffb0c0"
                : phase === PHASE_AFTERMATH ? "#a8d8ff" : "#b7c4ff";
  ctx.font = "600 " + (11 * dpr) + "px ui-monospace, monospace";
  ctx.fillText(phase, 8 * dpr, 16 * dpr);
}

function drawMeters() {
  const m = App.meters();
  if (!m) return;
  document.getElementById("mD").textContent =
    "D = " + (m.D >= 1000 ? m.D.toExponential(2) : m.D.toFixed(2));
  document.getElementById("mChirp").textContent = "chirp " + Math.round(m.chirpHz) + " Hz";
  document.getElementById("mRate").textContent = "events " + m.eventRate.toFixed(1) + "/s";
  document.getElementById("mSwarm").textContent = "swarm " + m.swarmCount;
  document.getElementById("mCap").hidden = !m.capBinding;
}
```

Then extend `refreshReadouts` — replace its body's final lines so it also draws:

```js
function refreshReadouts() {
  scrub.value = String(xToScrub(App.x));
  const m = App.meters();
  document.getElementById("phaseOut").textContent = m ? m.phase : phaseFor(App.x, App.params.global.mergerWidth);
  document.getElementById("xOut").textContent = "x = " + App.x.toFixed(App.x < 0.01 ? 6 : 3);
  drawSpectrogram();
  drawClock();
  drawMeters();
  requestAnimationFrame(refreshReadouts);
}
```

- [ ] **Step 3: Verify in a browser**

```bash
open audio-singularity/index.html
```

Check by hand:
1. Load `Black Hole Merger` and press Play. The spectrogram shows a bright line **curving upward** — the power law — that then **flattens against the dashed ceiling line**. This is the single most important visual; if the trace does not visibly flatten at the dashed line, the ceiling calculation and the spectrogram's frequency mapping disagree.
2. Drag `ε` down. The dashed ceiling rises and the trace runs further before flattening. At the minimum, the `ceiling above Nyquist — chirp is aliasing` label appears and the trace visibly folds back down the spectrum.
3. Load `Bouncing Ball`. On the clock canvas, the event ticks visibly crowd toward `t*`.
4. The playhead, decade labels, and the red `t*` line are all positioned consistently with the scrub slider.
5. The meters update; `rate cap binding` appears when `ε` is at minimum on `Hard Wall`.
6. Resize the window — both canvases stay sharp, not stretched or blurry.

- [ ] **Step 4: Run tests and commit**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks still pass.

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: log spectrogram and singularity clock canvases

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: WAV export

**Files:**
- Modify: `audio-singularity/index.html` (markup, `<style>`, application `<script>`)

**Interfaces:**
- Consumes: `makeOfflineRenderer`, `clampParams`, `encodeWav` from Tasks 8, 3 and 4; `App.params`, `App.presetId` from Task 9.
- Produces: `exportWav()` — drives the shared offline renderer a slice per animation frame, then downloads. **Do not write a second render loop here**; `makeOfflineRenderer.advance` is the only one, and it is what the tests cover.

- [ ] **Step 1: Add the export controls**

Add a panel after `#panels`:

```html
  <div class="panel">
    <h2>Export</h2>
    <div class="row">
      <label class="chk">Sample rate
        <select id="expRate"><option value="48000">48000</option><option value="44100">44100</option></select>
      </label>
      <label class="chk">Bit depth
        <select id="expDepth"><option value="16">16-bit PCM</option><option value="32">32-bit float</option></select>
      </label>
      <button id="exportBtn">Export WAV</button>
      <span class="readout" id="expOut">ready</span>
    </div>
  </div>
```

Add to `<style>`:

```css
  select { background: #10132a; color: #cdd4ff; border: 1px solid #333a6e;
           border-radius: 5px; padding: 4px 7px; font-size: 0.8rem; }
```

- [ ] **Step 2: Implement chunked export**

Append to the application script:

```js
// Drives the shared offline renderer one slice per animation frame, so a
// 60 s + 20 s job at 48 kHz does not freeze the page. Knobs are frozen for the
// whole render; only the clock sweeps. The render loop itself lives in
// makeOfflineRenderer and is covered by the tests.
function exportWav() {
  const rate = Number(document.getElementById("expRate").value);
  const depth = Number(document.getElementById("expDepth").value);
  const out = document.getElementById("expOut");
  const btn = document.getElementById("exportBtn");
  btn.disabled = true;

  const P = clampParams(JSON.parse(JSON.stringify(App.params)));
  const seed = P.global.seed;
  const totalSeconds = P.global.T + P.global.aftermath;
  const renderer = makeOfflineRenderer(P, rate, seed);
  const CHUNK_FRAMES = rate; // about one second of audio per animation frame

  function step() {
    const doneFrames = renderer.advance(CHUNK_FRAMES);
    out.textContent = "rendering " + Math.round(100 * doneFrames / renderer.frames) + "%";
    if (!renderer.done()) { requestAnimationFrame(step); return; }

    const bytes = encodeWav(renderer.L, renderer.R, rate, depth);
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "audio-singularity-" + App.presetId + "-seed" + seed + ".wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    out.textContent = totalSeconds.toFixed(1) + " s exported";
    btn.disabled = false;
  }
  requestAnimationFrame(step);
}

document.getElementById("exportBtn").onclick = exportWav;
```

- [ ] **Step 3: Verify in a browser**

```bash
open audio-singularity/index.html
```

Check by hand:
1. Load `AI Singularity`, click Export WAV. Progress counts up, a file downloads.
2. Open the file in an audio player. It plays, is the expected length (`T + aftermath`), and sounds like what the live playback sounded like.
3. Export again with the same seed. The two files are identical:

```bash
shasum ~/Downloads/audio-singularity-ai-singularity-seed1.wav ~/Downloads/audio-singularity-ai-singularity-seed1\ 2.wav
```

Expected: matching hashes.

4. Export at 32-bit float and confirm the player opens it.
5. Export with `T = 60` and `aftermath = 20` and confirm the page stays responsive during the render.

- [ ] **Step 4: Run tests and commit**

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks still pass.

```bash
git add audio-singularity/index.html
git commit -m "$(cat <<'EOF'
audio-singularity: chunked offline wav export

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Screenshot, gallery entry and final verification

**Files:**
- Create: `audio-singularity/screenshot1.jpg`
- Modify: `gallery.yaml`

**Interfaces:**
- Consumes: the finished page.
- Produces: gallery integration.

- [ ] **Step 1: Capture the screenshot**

The spectrogram only has content after audio has been running, and headless Chrome will not produce audio. Capture manually instead: open the page, load `AI Singularity`, press Play, let it run until the trace is well established and the swarm meter is high, then screenshot the browser window.

```bash
open audio-singularity/index.html
```

Save the capture as `audio-singularity/screenshot1.jpg`. Match the other projects' screenshots in shape — check one for reference:

```bash
sips -g pixelWidth -g pixelHeight audio-bird-synth/screenshot1.jpg
```

Then resize to a comparable width and confirm the result:

```bash
sips -Z 1600 -s format jpeg audio-singularity/screenshot1.jpg --out audio-singularity/screenshot1.jpg
sips -g pixelWidth -g pixelHeight audio-singularity/screenshot1.jpg
```

- [ ] **Step 2: Add the gallery entry**

Append to `gallery.yaml`:

```yaml
audio-singularity: Audio Singularity
```

- [ ] **Step 3: Rebuild the gallery index**

```bash
python3 build_gallery.py
```

Expected: `index.html` regenerates without error and now references `audio-singularity`.

```bash
grep -c audio-singularity index.html
```

Expected: at least 1.

- [ ] **Step 4: Final verification**

Run the full test suite:

```bash
cd audio-singularity && node test.mjs
```

Expected: all checks pass, exit code 0.

Confirm the constraints hold:

```bash
grep -n "Math.random" audio-singularity/index.html
```

Expected: no matches inside the `shared-code` block. (Matches in the application script would also be a defect — there should be none anywhere.)

```bash
grep -nE "https?://|src=|@import" audio-singularity/index.html
```

Expected: no external resource references.

Then open the page one final time and walk the acceptance list:

1. All six presets play and sound distinct.
2. `ε` at minimum vs maximum on the same preset gives audibly, dramatically different results.
3. The `Bouncing Ball` rattle fuses into a pitch continuously.
4. The spectrogram trace flattens against the dashed ceiling.
5. Scrubbing is smooth and click-free, including across `t*` in both directions.
6. Export produces a playable, reproducible file.
7. No console errors.

- [ ] **Step 5: Commit**

```bash
git add audio-singularity/screenshot1.jpg gallery.yaml index.html
git commit -m "$(cat <<'EOF'
audio-singularity: screenshot, gallery entry and index rebuild

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance criteria

- `node test.mjs` exits 0 from inside `audio-singularity/`.
- Every spec requirement in `docs/superpowers/specs/2026-08-03-audio-singularity-design.md` has a corresponding implementation.
- The page works opened directly from `file://`, on both the AudioWorklet and `ScriptProcessorNode` paths.
- No external network requests, no build step, no dependencies.
- The two sounds the project exists to demonstrate are present and unmistakable: the regularization contrast, and the rattle-to-pitch fusion.
