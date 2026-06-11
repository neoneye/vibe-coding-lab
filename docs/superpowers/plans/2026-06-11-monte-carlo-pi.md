# Monte Carlo π Estimator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone `2d-monte-carlo-pi/index.html` that estimates π by sampling random points against four inscribed shapes, with live convergence chart and adjustable parameters.

**Architecture:** All math (PRNG, shape definitions, estimator, tests) lives in a `<script id="shared-code">` block inside `index.html`; `test.mjs` extracts that block with a regex and runs `PiTests.run()` under Node (same mechanism as `game-snake/`). UI code is a separate `<script>` in the same file. No dependencies, no build step.

**Tech Stack:** Vanilla JS, Canvas 2D, Node ≥18 for tests, headless Chrome for the gallery screenshot.

**Spec:** `docs/superpowers/specs/2026-06-11-monte-carlo-pi-design.md`

---

### Task 1: Scaffold, test runner, seeded PRNG

**Files:**
- Create: `2d-monte-carlo-pi/test.mjs`
- Create: `2d-monte-carlo-pi/index.html`

- [ ] **Step 1: Write the test runner**

`2d-monte-carlo-pi/test.mjs`:

```js
// Runs the PiTests embedded in index.html's shared-code script block.
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
const ok = new Function(`${m[1]}; return PiTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd 2d-monte-carlo-pi && node test.mjs`
Expected: FAIL — `ENOENT ... index.html` (file doesn't exist yet).

- [ ] **Step 3: Create the index.html skeleton with PRNG tests**

`2d-monte-carlo-pi/index.html` — the shared-code block contains `mulberry32` plus a `PiTests` harness with PRNG tests. Body is a placeholder; UI comes in Task 4.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>2D Monte Carlo π</title>
<style>
/* styles added in Task 4 */
</style>
</head>
<body>
<p>UI under construction.</p>
<script id="shared-code">
"use strict";

// Deterministic PRNG (mulberry32). Returns floats in [0, 1).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PiTests = {
  run() {
    const failures = [];
    const check = (name, cond) => {
      console.log((cond ? "PASS" : "FAIL") + " " + name);
      if (!cond) failures.push(name);
    };

    // --- PRNG ---
    {
      const a = mulberry32(42), b = mulberry32(42);
      let same = true, inRange = true;
      for (let i = 0; i < 1000; i++) {
        const va = a(), vb = b();
        if (va !== vb) same = false;
        if (va < 0 || va >= 1) inRange = false;
      }
      check("prng: deterministic for equal seeds", same);
      check("prng: values in [0,1)", inRange);
      check("prng: different seeds differ", mulberry32(1)() !== mulberry32(2)());
    }

    console.log(failures.length === 0 ? "ALL TESTS PASSED" : failures.length + " FAILURES");
    return failures.length === 0;
  },
};
</script>
<script>
// UI added in Task 4.
</script>
</body>
</html>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-monte-carlo-pi && node test.mjs`
Expected: `PASS prng: ...` ×3, `ALL TESTS PASSED`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-monte-carlo-pi
git commit -m "monte-carlo-pi: scaffold with test runner and seeded PRNG"
```

---

### Task 2: Shape definitions

**Files:**
- Modify: `2d-monte-carlo-pi/index.html` (shared-code block only)

All shapes live in the unit square [0,1]×[0,1]. Canvas mapping is `(x, y) → (x·s, y·s)` (y-down; fine since sampling is symmetric).

- [ ] **Step 1: Add failing shape tests**

Inside `PiTests.run()`, after the PRNG section, before the final `console.log`:

```js
    // --- Shape geometry probes ---
    {
      const probes = {
        circle:  { inside: [[0.5, 0.5], [0.5, 0.05]], outside: [[0.02, 0.02], [0.98, 0.98]] },
        quarter: { inside: [[0.1, 0.1], [0.7, 0.7]],  outside: [[0.8, 0.7], [0.99, 0.99]] },
        ellipse: { inside: [[0.5, 0.5], [0.95, 0.5]], outside: [[0.5, 0.2], [0.05, 0.3]] },
        annulus: { inside: [[0.5, 0.2], [0.85, 0.5]], outside: [[0.5, 0.5], [0.98, 0.98]] },
      };
      check("shapes: 4 defined", typeof SHAPES !== "undefined" && SHAPES.length === 4);
      for (const shape of (typeof SHAPES === "undefined" ? [] : SHAPES)) {
        const p = probes[shape.key];
        check(shape.key + ": probe points", p &&
          p.inside.every(([x, y]) => shape.contains(x, y)) &&
          p.outside.every(([x, y]) => !shape.contains(x, y)));
      }
    }

    // --- Area fraction matches contains() empirically ---
    if (typeof SHAPES !== "undefined") {
      for (const shape of SHAPES) {
        const rng = mulberry32(42);
        const N = 200000;
        let hits = 0;
        for (let i = 0; i < N; i++) if (shape.contains(rng(), rng())) hits++;
        const frac = hits / N;
        check(shape.key + ": empirical fraction near areaFraction (" + frac.toFixed(4) + ")",
          Math.abs(frac - shape.areaFraction) < 0.01);
        check(shape.key + ": piFromRatio inverts areaFraction",
          Math.abs(shape.piFromRatio(shape.areaFraction) - Math.PI) < 1e-12);
      }
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-monte-carlo-pi && node test.mjs`
Expected: `FAIL shapes: 4 defined`, `1 FAILURES`, exit 1.

- [ ] **Step 3: Implement SHAPES**

In shared-code, after `mulberry32`, before `PiTests`:

```js
// All shapes are inscribed in the unit square [0,1]x[0,1]. Sampling that
// square uniformly, hits/samples estimates areaFraction, and piFromRatio
// inverts that to an estimate of pi. draw() renders the outline; s = canvas px.
const SHAPES = [
  {
    key: "circle",
    label: "Circle in square",
    formula: "π ≈ 4 · hits ⁄ samples",
    explanation: "A circle of radius ½ has area π(½)² = π/4, so it covers π/4 of the unit square.",
    areaFraction: Math.PI / 4,
    contains(x, y) { const dx = x - 0.5, dy = y - 0.5; return dx * dx + dy * dy <= 0.25; },
    piFromRatio(r) { return 4 * r; },
    draw(ctx, s) {
      ctx.beginPath();
      ctx.arc(0.5 * s, 0.5 * s, 0.5 * s, 0, 2 * Math.PI);
      ctx.stroke();
    },
  },
  {
    key: "quarter",
    label: "Quarter circle",
    formula: "π ≈ 4 · hits ⁄ samples",
    explanation: "A quarter of a radius-1 circle fits exactly in the unit square; its area is π·1²/4 = π/4.",
    areaFraction: Math.PI / 4,
    contains(x, y) { return x * x + y * y <= 1; },
    piFromRatio(r) { return 4 * r; },
    draw(ctx, s) {
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI / 2);
      ctx.stroke();
    },
  },
  {
    key: "ellipse",
    label: "Ellipse",
    formula: "π ≈ 8 · hits ⁄ samples",
    explanation: "Ellipse area is π·a·b. With semi-axes ½ × ¼ it covers π/8 of the square. Fun fact: any ellipse covers π/4 of its own bounding rectangle, no matter how squashed.",
    areaFraction: Math.PI / 8,
    contains(x, y) {
      const nx = (x - 0.5) / 0.5, ny = (y - 0.5) / 0.25;
      return nx * nx + ny * ny <= 1;
    },
    piFromRatio(r) { return 8 * r; },
    draw(ctx, s) {
      ctx.beginPath();
      ctx.ellipse(0.5 * s, 0.5 * s, 0.5 * s, 0.25 * s, 0, 0, 2 * Math.PI);
      ctx.stroke();
    },
  },
  {
    key: "annulus",
    label: "Annulus (ring)",
    formula: "π ≈ (16⁄3) · hits ⁄ samples",
    explanation: "A ring with outer radius ½ and inner radius ¼ has area π(¼ − ¹⁄₁₆) = 3π/16.",
    areaFraction: (3 * Math.PI) / 16,
    contains(x, y) {
      const dx = x - 0.5, dy = y - 0.5, d2 = dx * dx + dy * dy;
      return d2 <= 0.25 && d2 >= 0.0625;
    },
    piFromRatio(r) { return (16 / 3) * r; },
    draw(ctx, s) {
      ctx.beginPath();
      ctx.arc(0.5 * s, 0.5 * s, 0.5 * s, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0.5 * s, 0.5 * s, 0.25 * s, 0, 2 * Math.PI);
      ctx.stroke();
    },
  },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-monte-carlo-pi && node test.mjs`
Expected: all `PASS`, `ALL TESTS PASSED`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-monte-carlo-pi/index.html
git commit -m "monte-carlo-pi: four shape definitions with area-fraction tests"
```

---

### Task 3: Estimator

**Files:**
- Modify: `2d-monte-carlo-pi/index.html` (shared-code block only)

- [ ] **Step 1: Add failing estimator tests**

Inside `PiTests.run()`, after the area-fraction section:

```js
    // --- Estimator ---
    {
      check("estimator: class exists", typeof Estimator !== "undefined");
      if (typeof Estimator !== "undefined") {
        for (const shape of SHAPES) {
          const est = new Estimator(shape, mulberry32(7));
          est.step(200000);
          check(shape.key + ": converges at 200k (" + est.estimate().toFixed(4) + ")",
            Math.abs(est.estimate() - Math.PI) < 0.05);
        }
        const a = new Estimator(SHAPES[0], mulberry32(123));
        const b = new Estimator(SHAPES[0], mulberry32(123));
        a.step(1000); b.step(1000);
        check("estimator: deterministic with equal seeds",
          a.hits === b.hits && a.samples === b.samples);
        const c = new Estimator(SHAPES[0], mulberry32(5));
        check("estimator: NaN before sampling", Number.isNaN(c.estimate()));
        const batch = c.step(50);
        check("estimator: step returns batch with inside flags",
          batch.length === 50 && batch.every(p =>
            p.x >= 0 && p.x < 1 && p.y >= 0 && p.y < 1 && typeof p.inside === "boolean"));
        c.reset();
        check("estimator: reset zeroes counts", c.samples === 0 && c.hits === 0);
      }
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-monte-carlo-pi && node test.mjs`
Expected: `FAIL estimator: class exists`, exit 1.

- [ ] **Step 3: Implement Estimator**

In shared-code, after `SHAPES`, before `PiTests`:

```js
// Samples uniform points in the unit square and counts hits in the shape.
class Estimator {
  constructor(shape, rng) {
    this.shape = shape;
    this.rng = rng || Math.random;
    this.reset();
  }
  reset() {
    this.samples = 0;
    this.hits = 0;
  }
  // Sample n points; returns the batch for plotting.
  step(n) {
    const pts = new Array(n);
    for (let i = 0; i < n; i++) {
      const x = this.rng(), y = this.rng();
      const inside = this.shape.contains(x, y);
      if (inside) this.hits++;
      pts[i] = { x, y, inside };
    }
    this.samples += n;
    return pts;
  }
  estimate() {
    return this.samples === 0 ? NaN : this.shape.piFromRatio(this.hits / this.samples);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-monte-carlo-pi && node test.mjs`
Expected: all `PASS`, `ALL TESTS PASSED`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-monte-carlo-pi/index.html
git commit -m "monte-carlo-pi: estimator with convergence and determinism tests"
```

---

### Task 4: UI — canvas, controls, readout

**Files:**
- Modify: `2d-monte-carlo-pi/index.html` (styles, body, UI script)

No automated test for this task; verification is manual (Step 3).

- [ ] **Step 1: Replace `<style>`, body markup, and the UI `<script>`**

Replace the `<style>` contents:

```css
:root {
  --bg: #11141a; --panel: #1a1f29; --border: #2c3442;
  --text: #dde3ee; --muted: #8a94a6;
  --green: #3ecf6e; --red: #e05555; --accent: #5aa9ff;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 16px; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
h1 { font-size: 1.3rem; margin: 0 0 4px; }
.subtitle { color: var(--muted); margin: 0 0 16px; font-size: 0.9rem; }
.layout { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
.panel {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 8px; padding: 12px;
}
#sim-canvas { display: block; background: #0b0e13; border: 1px solid var(--border); }
.controls { width: 360px; display: flex; flex-direction: column; gap: 12px; }
fieldset { border: 1px solid var(--border); border-radius: 6px; margin: 0; padding: 8px 12px; }
legend { color: var(--muted); font-size: 0.8rem; padding: 0 4px; }
.shape-option { display: block; margin: 4px 0; cursor: pointer; }
.shape-info { font-size: 0.85rem; color: var(--muted); margin: 8px 0 0; }
.shape-info .formula { color: var(--accent); font-size: 1rem; display: block; margin-bottom: 4px; }
label.slider { display: block; font-size: 0.85rem; margin: 6px 0; }
label.slider input { width: 100%; }
.buttons { display: flex; gap: 8px; }
button {
  flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--border);
  background: #232a37; color: var(--text); font-size: 0.9rem; cursor: pointer;
}
button:hover { background: #2c3545; }
table.readout { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
table.readout td { padding: 3px 0; }
table.readout td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
#pi-estimate { color: var(--green); font-weight: 600; }
#chart-canvas { display: block; width: 100%; }
</style>
```

Replace the placeholder body markup (keep both script blocks below it):

```html
<h1>2D Monte Carlo π</h1>
<p class="subtitle">Throw random points at a square. Any inscribed shape whose area involves π turns the hit ratio into an estimate of π.</p>
<div class="layout">
  <div class="panel">
    <canvas id="sim-canvas" width="480" height="480"></canvas>
  </div>
  <div class="controls">
    <fieldset class="panel">
      <legend>Shape</legend>
      <div id="shape-options"></div>
      <p class="shape-info"><span class="formula" id="shape-formula"></span><span id="shape-explanation"></span></p>
    </fieldset>
    <fieldset class="panel">
      <legend>Parameters</legend>
      <label class="slider">Points per frame: <span id="speed-value"></span>
        <input type="range" id="speed" min="0" max="4" step="0.25" value="2">
      </label>
      <label class="slider">Point size: <span id="size-value"></span> px
        <input type="range" id="point-size" min="1" max="4" step="1" value="2">
      </label>
      <div class="buttons">
        <button id="pause-btn">Pause</button>
        <button id="reset-btn">Reset</button>
      </div>
    </fieldset>
    <fieldset class="panel">
      <legend>Estimate</legend>
      <table class="readout">
        <tr><td>Samples</td><td id="samples">0</td></tr>
        <tr><td>Hits</td><td id="hits">0</td></tr>
        <tr><td>π estimate</td><td id="pi-estimate">—</td></tr>
        <tr><td>|error|</td><td id="pi-error">—</td></tr>
      </table>
    </fieldset>
    <fieldset class="panel">
      <legend>Convergence (log scale)</legend>
      <canvas id="chart-canvas" width="336" height="150"></canvas>
    </fieldset>
  </div>
</div>
```

Replace the UI `<script>` (the one after shared-code):

```js
"use strict";
const sim = document.getElementById("sim-canvas");
const simCtx = sim.getContext("2d");
const S = sim.width;

const speedInput = document.getElementById("speed");
const sizeInput = document.getElementById("point-size");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");

let shape = SHAPES[0];
let estimator = null;
let running = true;
let series = [];          // [samples, estimate] checkpoints for the chart (Task 5)
let nextCheckpoint = 1;

function pointsPerFrame() { return Math.round(10 ** Number(speedInput.value)); }
function pointSize() { return Number(sizeInput.value); }

// Build shape radio buttons from SHAPES — the UI hard-codes no shape math.
const shapeOptions = document.getElementById("shape-options");
for (const s of SHAPES) {
  const label = document.createElement("label");
  label.className = "shape-option";
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "shape";
  radio.value = s.key;
  radio.checked = s === shape;
  radio.addEventListener("change", () => { shape = s; reset(); });
  label.append(radio, " " + s.label);
  shapeOptions.append(label);
}

function drawOutline() {
  simCtx.strokeStyle = "#5aa9ff";
  simCtx.lineWidth = 2;
  shape.draw(simCtx, S);
}

function reset() {
  estimator = new Estimator(shape, mulberry32((Math.random() * 2 ** 32) >>> 0));
  series = [];
  nextCheckpoint = 1;
  simCtx.fillStyle = "#0b0e13";
  simCtx.fillRect(0, 0, S, S);
  drawOutline();
  document.getElementById("shape-formula").textContent = shape.formula;
  document.getElementById("shape-explanation").textContent = shape.explanation;
  updateReadout();
  drawChart();
}

function updateReadout() {
  document.getElementById("samples").textContent = estimator.samples.toLocaleString();
  document.getElementById("hits").textContent = estimator.hits.toLocaleString();
  const est = estimator.estimate();
  document.getElementById("pi-estimate").textContent = Number.isNaN(est) ? "—" : est.toFixed(6);
  document.getElementById("pi-error").textContent =
    Number.isNaN(est) ? "—" : Math.abs(est - Math.PI).toFixed(6);
}

function drawChart() { /* implemented in Task 5 */ }

function updateLabels() {
  document.getElementById("speed-value").textContent = pointsPerFrame().toLocaleString();
  document.getElementById("size-value").textContent = pointSize();
}
speedInput.addEventListener("input", updateLabels);
sizeInput.addEventListener("input", updateLabels);

pauseBtn.addEventListener("click", () => {
  running = !running;
  pauseBtn.textContent = running ? "Pause" : "Resume";
});
resetBtn.addEventListener("click", reset);

function frame() {
  if (running) {
    const r = pointSize();
    const batch = estimator.step(pointsPerFrame());
    for (const p of batch) {
      simCtx.fillStyle = p.inside ? "#3ecf6e" : "#e05555";
      simCtx.fillRect(p.x * S - r / 2, p.y * S - r / 2, r, r);
    }
    drawOutline();
    while (estimator.samples >= nextCheckpoint) {
      series.push([estimator.samples, estimator.estimate()]);
      nextCheckpoint = Math.max(nextCheckpoint + 1, Math.ceil(nextCheckpoint * 1.15));
    }
    updateReadout();
    drawChart();
  }
  requestAnimationFrame(frame);
}

updateLabels();
reset();
requestAnimationFrame(frame);
```

- [ ] **Step 2: Run tests to confirm nothing broke**

Run: `cd 2d-monte-carlo-pi && node test.mjs`
Expected: `ALL TESTS PASSED` (UI changes must not touch shared-code).

- [ ] **Step 3: Manual verification in headless Chrome**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --screenshot=/tmp/mc-pi-check.png --window-size=1000,760 --virtual-time-budget=4000 \
  "file:///Users/neoneye/git/vibe-coding-lab/2d-monte-carlo-pi/index.html"
```

Read `/tmp/mc-pi-check.png` and confirm: green points inside the circle, red outside, outline visible, readout shows a π estimate near 3.14, controls render. Fix any rendering issues before committing.

- [ ] **Step 4: Commit**

```bash
git add 2d-monte-carlo-pi/index.html
git commit -m "monte-carlo-pi: interactive UI with canvas, controls, readout"
```

---

### Task 5: Convergence chart

**Files:**
- Modify: `2d-monte-carlo-pi/index.html` (UI script only)

- [ ] **Step 1: Implement drawChart**

Replace the `function drawChart() { /* implemented in Task 5 */ }` stub:

```js
const chart = document.getElementById("chart-canvas");
const chartCtx = chart.getContext("2d");

function drawChart() {
  const W = chart.width, H = chart.height, PAD = 6;
  chartCtx.fillStyle = "#0b0e13";
  chartCtx.fillRect(0, 0, W, H);
  const yMin = Math.PI - 0.7, yMax = Math.PI + 0.7;
  const yOf = (v) => {
    const c = Math.min(yMax, Math.max(yMin, v));
    return H - PAD - ((c - yMin) / (yMax - yMin)) * (H - 2 * PAD);
  };
  // Reference line at true pi.
  chartCtx.strokeStyle = "#8a94a6";
  chartCtx.setLineDash([4, 4]);
  chartCtx.beginPath();
  chartCtx.moveTo(0, yOf(Math.PI));
  chartCtx.lineTo(W, yOf(Math.PI));
  chartCtx.stroke();
  chartCtx.setLineDash([]);
  chartCtx.fillStyle = "#8a94a6";
  chartCtx.font = "10px sans-serif";
  chartCtx.fillText("π", 4, yOf(Math.PI) - 3);
  if (series.length < 2) return;
  const maxN = series[series.length - 1][0];
  const logMax = Math.log(Math.max(maxN, 10));
  const xOf = (n) => PAD + (Math.log(Math.max(n, 1)) / logMax) * (W - 2 * PAD);
  chartCtx.strokeStyle = "#3ecf6e";
  chartCtx.lineWidth = 1.5;
  chartCtx.beginPath();
  series.forEach(([n, est], i) => {
    if (i === 0) chartCtx.moveTo(xOf(n), yOf(est));
    else chartCtx.lineTo(xOf(n), yOf(est));
  });
  chartCtx.stroke();
}
```

Note: `chart`/`chartCtx` must be declared before `reset()` runs (place this block above the `reset` definition, or simply above the `updateLabels(); reset();` startup lines — `function drawChart` hoists, but `chart` must be initialized before first call).

- [ ] **Step 2: Run tests, then re-screenshot**

Run: `cd 2d-monte-carlo-pi && node test.mjs` → `ALL TESTS PASSED`.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --screenshot=/tmp/mc-pi-chart.png --window-size=1000,760 --virtual-time-budget=6000 \
  "file:///Users/neoneye/git/vibe-coding-lab/2d-monte-carlo-pi/index.html"
```

Read the screenshot: convergence line should wobble toward and hug the dashed π line.

- [ ] **Step 3: Commit**

```bash
git add 2d-monte-carlo-pi/index.html
git commit -m "monte-carlo-pi: convergence chart with log-x axis and pi reference line"
```

---

### Task 6: Gallery integration

**Files:**
- Create: `2d-monte-carlo-pi/screenshot1.png` (from headless Chrome; gallery accepts .png)
- Modify: `gallery.yaml`
- Modify: `index.html` (repo root, regenerated by script)

- [ ] **Step 1: Capture the gallery screenshot**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --screenshot=/Users/neoneye/git/vibe-coding-lab/2d-monte-carlo-pi/screenshot1.png \
  --window-size=1000,760 --virtual-time-budget=8000 \
  "file:///Users/neoneye/git/vibe-coding-lab/2d-monte-carlo-pi/index.html"
```

Read the file to confirm it shows a populated simulation (thousands of points, chart converged near π).

- [ ] **Step 2: Add title override**

Append to `gallery.yaml`:

```yaml
2d-monte-carlo-pi: 2D Monte Carlo π
```

- [ ] **Step 3: Rebuild the gallery**

Run: `cd /Users/neoneye/git/vibe-coding-lab && python3 build_gallery.py`
Expected: root `index.html` regenerated with a `2d-monte-carlo-pi` card.

- [ ] **Step 4: Final full test run**

Run: `cd 2d-monte-carlo-pi && node test.mjs`
Expected: `ALL TESTS PASSED`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-monte-carlo-pi/screenshot1.png gallery.yaml index.html
git commit -m "monte-carlo-pi: add to gallery"
```
