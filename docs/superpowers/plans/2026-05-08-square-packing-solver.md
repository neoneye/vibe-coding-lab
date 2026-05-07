# Square Packing Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file standalone HTML page that runs a simulated-annealing solver to pack N unit squares (with arbitrary rotation) into the smallest possible square or rectangle, with a live-animated canvas and minimal monochrome UI.

**Architecture:** One file at `packing/index.html` with inline `<style>` and inline `<script>`. Pure vanilla JS, no dependencies, no build step. State is a flat array of `{x, y, θ}` records plus a container `{w, h}`. Solver runs in `requestAnimationFrame`, K annealing steps per frame, with K controlled by a speed slider. Rendering is plain Canvas 2D.

**Tech Stack:** HTML5, vanilla JS (ES2020), Canvas 2D. No CDN, no libs.

**Spec:** `docs/superpowers/specs/2026-05-08-square-packing-solver-design.md`

**Testing approach:** Pure geometry/energy functions are tested inline via `console.assert` calls inside a `runTests()` function that executes when the page is loaded with `?test=1`. Visual correctness (rendering, animation, UI) is verified by opening the page in a browser. There is no separate test file — this is a single-file project by design.

---

### Task 1: HTML Scaffold + Layout + Empty Canvas

**Files:**
- Create: `packing/index.html`

Build the static page skeleton: title, mode tabs, both control panels (only one visible at a time), Run/Stop/Reset buttons, speed slider, canvas, status line. No JS logic yet beyond hooking up the tab toggle.

- [ ] **Step 1: Create the HTML file**

Create `packing/index.html` with this content:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Square Packing Solver</title>
  <style>
    :root {
      --fg: #111;
      --muted: #666;
      --border: #ccc;
      --bg: #fff;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--fg);
      font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .app {
      max-width: 720px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }
    .tabs {
      display: flex;
      gap: 0;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .tab {
      padding: 8px 16px;
      background: none;
      border: 1px solid transparent;
      border-bottom: none;
      cursor: pointer;
      font: inherit;
      color: var(--muted);
    }
    .tab.active {
      color: var(--fg);
      border-color: var(--border);
      background: var(--bg);
      position: relative;
      top: 1px;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 20px;
      align-items: center;
      padding: 12px 0;
    }
    .controls.hidden { display: none; }
    .controls label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
    }
    .controls input[type="number"] {
      width: 64px;
      padding: 4px 6px;
      font: inherit;
      border: 1px solid var(--border);
      border-radius: 2px;
    }
    .controls input[type="range"] {
      width: 160px;
    }
    .controls button {
      padding: 6px 14px;
      font: inherit;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      cursor: pointer;
    }
    .controls button:hover { background: #f4f4f4; }
    canvas {
      display: block;
      width: 100%;
      height: 480px;
      border: 1px solid var(--border);
      background: var(--bg);
      margin: 12px 0;
    }
    .status {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 12px;
      color: var(--muted);
      white-space: pre;
    }
  </style>
</head>
<body>
  <div class="app">
    <h1>Square Packing Solver</h1>

    <div class="tabs">
      <button class="tab active" data-mode="min">Min container</button>
      <button class="tab" data-mode="max">Max squares</button>
    </div>

    <div class="controls" id="controls-min">
      <label>N: <input type="number" id="input-n" min="1" max="200" value="11"></label>
      <label><input type="radio" name="shape" value="square" checked> square</label>
      <label><input type="radio" name="shape" value="rect"> rect</label>
    </div>

    <div class="controls hidden" id="controls-max">
      <label>W: <input type="number" id="input-w" min="0.1" step="0.1" value="5"></label>
      <label>H: <input type="number" id="input-h" min="0.1" step="0.1" value="5"></label>
    </div>

    <div class="controls">
      <label>Speed: <input type="range" id="input-speed" min="0" max="100" value="50"></label>
      <button id="btn-run">Run</button>
      <button id="btn-stop">Stop</button>
      <button id="btn-reset">Reset</button>
    </div>

    <canvas id="canvas" width="680" height="480"></canvas>

    <div class="status" id="status">idle</div>
  </div>

  <script>
    'use strict';

    // === Tab toggle ===
    const tabs = document.querySelectorAll('.tab');
    const panelMin = document.getElementById('controls-min');
    const panelMax = document.getElementById('controls-max');
    function setMode(mode) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
      panelMin.classList.toggle('hidden', mode !== 'min');
      panelMax.classList.toggle('hidden', mode !== 'max');
    }
    tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `packing/index.html` in a browser. Expected:
- Title "Square Packing Solver" at top.
- Two tabs: "Min container" (active) and "Max squares".
- Min panel shows: N input (default 11), shape radios.
- Speed slider, Run/Stop/Reset buttons.
- Empty white canvas with grey border.
- Status line shows "idle".
- Clicking "Max squares" tab swaps the panel to W/H inputs.

- [ ] **Step 3: Commit**

```bash
git add packing/index.html
git commit -m "feat(packing): add static HTML scaffold for square packing solver"
```

---

### Task 2: Geometry — Square Corners and SAT Overlap

**Files:**
- Modify: `packing/index.html` (add geometry helpers and inline tests)

Add pure helper functions for computing the 4 corners of a rotated square and for testing pairwise overlap via the Separating Axis Theorem (SAT). Add an inline `runTests()` function that runs when the URL contains `?test=1`.

- [ ] **Step 1: Add geometry helpers and tests**

Inside the `<script>` tag, **before** the `// === Tab toggle ===` line, insert:

```javascript
    // === Geometry ===

    // Returns the 4 corners of a unit square centered at (x, y) rotated by theta.
    function squareCorners(x, y, theta) {
      const c = Math.cos(theta), s = Math.sin(theta);
      // half-side = 0.5 (unit square)
      const dx = [-0.5, 0.5, 0.5, -0.5];
      const dy = [-0.5, -0.5, 0.5, 0.5];
      const out = new Array(4);
      for (let i = 0; i < 4; i++) {
        out[i] = [x + dx[i] * c - dy[i] * s, y + dx[i] * s + dy[i] * c];
      }
      return out;
    }

    // Project polygon (array of [x,y]) onto axis [ax, ay], returns [min, max].
    function project(poly, ax, ay) {
      let lo = Infinity, hi = -Infinity;
      for (const [px, py] of poly) {
        const d = px * ax + py * ay;
        if (d < lo) lo = d;
        if (d > hi) hi = d;
      }
      return [lo, hi];
    }

    // SAT penetration depth between two convex polys. Returns 0 if disjoint,
    // else the minimum penetration depth (a positive number).
    function satPenetration(polyA, polyB) {
      let minOverlap = Infinity;
      const polys = [polyA, polyB];
      for (const poly of polys) {
        for (let i = 0; i < poly.length; i++) {
          const [x1, y1] = poly[i];
          const [x2, y2] = poly[(i + 1) % poly.length];
          // edge axis = (x2-x1, y2-y1); normal = (-dy, dx) normalized
          let nx = -(y2 - y1), ny = (x2 - x1);
          const len = Math.hypot(nx, ny);
          if (len === 0) continue;
          nx /= len; ny /= len;
          const [aLo, aHi] = project(polyA, nx, ny);
          const [bLo, bHi] = project(polyB, nx, ny);
          const overlap = Math.min(aHi, bHi) - Math.max(aLo, bLo);
          if (overlap <= 0) return 0; // separating axis found → disjoint
          if (overlap < minOverlap) minOverlap = overlap;
        }
      }
      return minOverlap;
    }

    // === Inline tests (run with ?test=1) ===
    function runTests() {
      const log = (ok, msg) => console[ok ? 'log' : 'error'](`${ok ? '✓' : '✗'} ${msg}`);
      const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

      // squareCorners: axis-aligned unit square at origin
      let corners = squareCorners(0, 0, 0);
      log(near(corners[0][0], -0.5) && near(corners[0][1], -0.5), 'corner 0 of unit square at origin');
      log(near(corners[2][0], 0.5) && near(corners[2][1], 0.5), 'corner 2 of unit square at origin');

      // squareCorners: rotated 45°
      corners = squareCorners(0, 0, Math.PI / 4);
      const r = Math.SQRT1_2; // 1/sqrt(2) ≈ 0.707
      log(near(corners[0][0], 0) && near(corners[0][1], -r), '45° rotated corner 0 is (0, -1/√2)');

      // SAT: two disjoint axis-aligned unit squares, far apart
      let A = squareCorners(0, 0, 0);
      let B = squareCorners(10, 0, 0);
      log(satPenetration(A, B) === 0, 'disjoint squares: penetration 0');

      // SAT: identical squares fully overlap; penetration ≈ 1 (full side)
      A = squareCorners(0, 0, 0);
      B = squareCorners(0, 0, 0);
      log(near(satPenetration(A, B), 1, 1e-6), 'identical squares: penetration 1');

      // SAT: shifted by 0.3 along x; penetration = 1 - 0.3 = 0.7
      A = squareCorners(0, 0, 0);
      B = squareCorners(0.3, 0, 0);
      log(near(satPenetration(A, B), 0.7, 1e-6), 'overlap 0.7 along x');

      // SAT: just touching (shifted by 1.0); penetration ≈ 0
      A = squareCorners(0, 0, 0);
      B = squareCorners(1.0, 0, 0);
      log(satPenetration(A, B) <= 1e-9, 'just-touching squares: penetration ~0');
    }

    if (new URLSearchParams(location.search).has('test')) {
      runTests();
    }
```

- [ ] **Step 2: Run tests in browser**

Open `packing/index.html?test=1` and check the browser console. Expected: six `✓` lines, zero `✗` lines.

- [ ] **Step 3: Commit**

```bash
git add packing/index.html
git commit -m "feat(packing): add square corners and SAT penetration with inline tests"
```

---

### Task 3: Energy Function and Initial State

**Files:**
- Modify: `packing/index.html`

Add `computeEnergy(squares, container)` that returns 0 for a feasible packing and a positive penalty otherwise. Add an `initState(n, w, h)` that creates N squares at random positions and angles inside a w×h container. Extend `runTests()` with energy assertions.

- [ ] **Step 1: Add energy and init helpers**

Inside the `<script>` tag, immediately after the SAT helpers and before `// === Inline tests`, insert:

```javascript
    // === Energy ===

    // Energy = sum of squared pairwise penetration depths
    //        + sum over corners of squared signed distance outside container.
    // Energy = 0 means a valid packing.
    function computeEnergy(squares, container) {
      const n = squares.length;
      const polys = squares.map(s => squareCorners(s.x, s.y, s.theta));

      let e = 0;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const d = satPenetration(polys[i], polys[j]);
          if (d > 0) e += d * d;
        }
      }

      const w = container.w, h = container.h;
      for (const poly of polys) {
        for (const [x, y] of poly) {
          if (x < 0)      e += x * x;
          else if (x > w) e += (x - w) * (x - w);
          if (y < 0)      e += y * y;
          else if (y > h) e += (y - h) * (y - h);
        }
      }

      return e;
    }

    // === State init ===

    function initSquares(n, w, h) {
      const out = new Array(n);
      for (let i = 0; i < n; i++) {
        out[i] = {
          x: 0.5 + Math.random() * (w - 1),
          y: 0.5 + Math.random() * (h - 1),
          theta: Math.random() * Math.PI / 2,
        };
      }
      return out;
    }

    function initialContainerSide(n) {
      return Math.ceil(Math.sqrt(n)) + 0.3;
    }
```

- [ ] **Step 2: Add energy tests**

Inside `runTests()`, just before the closing `}`, append:

```javascript
      // Energy: a single square fully inside container has energy 0
      let sqs = [{ x: 1, y: 1, theta: 0 }];
      let cont = { w: 5, h: 5 };
      log(computeEnergy(sqs, cont) === 0, 'energy 0 for single inside square');

      // Energy: a square poking out the right side
      sqs = [{ x: 4.7, y: 1, theta: 0 }]; // right edge at 5.2, w=5
      cont = { w: 5, h: 5 };
      log(computeEnergy(sqs, cont) > 0, 'energy > 0 when square pokes out');

      // Energy: two overlapping squares
      sqs = [{ x: 1, y: 1, theta: 0 }, { x: 1.3, y: 1, theta: 0 }];
      cont = { w: 5, h: 5 };
      log(computeEnergy(sqs, cont) > 0, 'energy > 0 when squares overlap');

      // Energy: two non-overlapping inside squares
      sqs = [{ x: 1, y: 1, theta: 0 }, { x: 3, y: 1, theta: 0 }];
      cont = { w: 5, h: 5 };
      log(computeEnergy(sqs, cont) === 0, 'energy 0 for two disjoint inside squares');
```

- [ ] **Step 3: Run tests in browser**

Open `packing/index.html?test=1`. Expected: 10 total `✓` lines, zero `✗` lines.

- [ ] **Step 4: Commit**

```bash
git add packing/index.html
git commit -m "feat(packing): add energy function and initial state helpers"
```

---

### Task 4: Renderer + Animation Loop Skeleton

**Files:**
- Modify: `packing/index.html`

Add a renderer that draws the container and all squares. Wire up Run/Stop/Reset buttons to a `requestAnimationFrame` loop that, for now, just redraws (no annealing yet). On page load, initialize state with N=11 in a generous square container so the user sees something.

- [ ] **Step 1: Add renderer and rAF loop**

Inside the `<script>` tag, replace the `// === Tab toggle ===` block and everything after it with:

```javascript
    // === Renderer ===

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const status = document.getElementById('status');

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function render(state) {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      ctx.clearRect(0, 0, cssW, cssH);

      const margin = 20;
      const { w, h } = state.container;
      const scale = Math.min((cssW - 2 * margin) / w, (cssH - 2 * margin) / h);
      const ox = (cssW - w * scale) / 2;
      const oy = (cssH - h * scale) / 2;

      // container
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox, oy, w * scale, h * scale);

      // squares
      ctx.lineWidth = 1;
      for (const s of state.squares) {
        ctx.save();
        ctx.translate(ox + s.x * scale, oy + s.y * scale);
        ctx.rotate(s.theta);
        ctx.strokeRect(-0.5 * scale, -0.5 * scale, scale, scale);
        ctx.restore();
      }
    }

    // === State ===

    function makeInitialState(mode, params) {
      if (mode === 'min') {
        const n = params.n;
        const side = initialContainerSide(n);
        const w = side, h = side; // shape handled later
        return {
          mode: 'min',
          shape: params.shape,
          container: { w, h },
          squares: initSquares(n, w, h),
          best: null,
          iter: 0,
          T: 1.0,
        };
      } else {
        const w = params.w, h = params.h;
        const n = Math.max(1, Math.floor(w * h));
        return {
          mode: 'max',
          container: { w, h },
          squares: initSquares(n, w, h),
          best: null,
          iter: 0,
          T: 1.0,
        };
      }
    }

    let state = makeInitialState('min', { n: 11, shape: 'square' });
    let running = false;
    let rafId = null;

    function tick() {
      if (!running) return;
      // (annealing happens here in a later task)
      state.iter++;
      render(state);
      updateStatus();
      rafId = requestAnimationFrame(tick);
    }

    function updateStatus() {
      const { w, h } = state.container;
      const e = computeEnergy(state.squares, state.container);
      status.textContent =
        `mode=${state.mode}  n=${state.squares.length}  ` +
        `container=${w.toFixed(3)}×${h.toFixed(3)}  ` +
        `area=${(w * h).toFixed(3)}  energy=${e.toFixed(4)}  ` +
        `iter=${state.iter}  T=${state.T.toFixed(4)}`;
    }

    // === Controls ===

    const tabs = document.querySelectorAll('.tab');
    const panelMin = document.getElementById('controls-min');
    const panelMax = document.getElementById('controls-max');
    let currentMode = 'min';

    function setMode(mode) {
      currentMode = mode;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
      panelMin.classList.toggle('hidden', mode !== 'min');
      panelMax.classList.toggle('hidden', mode !== 'max');
      doReset();
    }
    tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));

    function readParams() {
      if (currentMode === 'min') {
        const n = Math.max(1, parseInt(document.getElementById('input-n').value, 10) || 1);
        const shape = document.querySelector('input[name="shape"]:checked').value;
        return { n, shape };
      } else {
        const w = Math.max(0.1, parseFloat(document.getElementById('input-w').value) || 1);
        const h = Math.max(0.1, parseFloat(document.getElementById('input-h').value) || 1);
        return { w, h };
      }
    }

    function doReset() {
      running = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      state = makeInitialState(currentMode, readParams());
      render(state);
      updateStatus();
    }

    function doRun() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    }

    function doStop() {
      running = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }

    document.getElementById('btn-run').addEventListener('click', doRun);
    document.getElementById('btn-stop').addEventListener('click', doStop);
    document.getElementById('btn-reset').addEventListener('click', doReset);

    document.getElementById('input-n').addEventListener('change', doReset);
    document.querySelectorAll('input[name="shape"]').forEach(r =>
      r.addEventListener('change', doReset));
    document.getElementById('input-w').addEventListener('change', doReset);
    document.getElementById('input-h').addEventListener('change', doReset);

    // Initial render
    render(state);
    updateStatus();
```

- [ ] **Step 2: Verify in browser**

Open `packing/index.html`. Expected:
- Canvas shows a square container with 11 small randomly-rotated black-outlined squares scattered (and likely overlapping) inside.
- Status line shows `mode=min n=11 container=4.300×4.300 area=18.490 energy=...` (energy will be > 0 because squares overlap).
- Click Run: status's `iter` field increments rapidly. (Squares don't move yet — annealing not implemented.)
- Click Stop: iter freezes.
- Click Reset: squares re-randomize.
- Switch to "Max squares" tab: 25 squares appear in a 5×5 container.
- Switch back to "Min container": 11 squares again.

- [ ] **Step 3: Run inline tests**

Open `packing/index.html?test=1`. Expected: 10 `✓` lines in console (page also renders normally).

- [ ] **Step 4: Commit**

```bash
git add packing/index.html
git commit -m "feat(packing): add canvas renderer and rAF skeleton with run/stop/reset"
```

---

### Task 5: Simulated Annealing Core

**Files:**
- Modify: `packing/index.html`

Implement the annealing inner loop: propose a move, compute energy delta, Metropolis acceptance, geometric cooling. All six move types from the spec. Speed slider controls steps-per-frame.

- [ ] **Step 1: Add annealing functions**

Inside the `<script>` tag, immediately after the `// === State ===` block and before `let state = makeInitialState(...)`, insert:

```javascript
    // === Annealing ===

    const COOLING = 0.9995;
    const T_MIN = 1e-4;

    // Gaussian sample using Box–Muller.
    function gauss() {
      const u = 1 - Math.random();
      const v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // Returns { undo() } — applies a move in place; caller can revert.
    function proposeMove(state) {
      const sqs = state.squares;
      const n = sqs.length;
      if (n === 0) return { undo() {} };
      const r = Math.random();

      if (r < 0.30) {
        // small translate
        const i = (Math.random() * n) | 0;
        const ox = sqs[i].x, oy = sqs[i].y;
        sqs[i].x += gauss() * 0.1;
        sqs[i].y += gauss() * 0.1;
        return { undo() { sqs[i].x = ox; sqs[i].y = oy; } };
      } else if (r < 0.45) {
        // large translate
        const i = (Math.random() * n) | 0;
        const ox = sqs[i].x, oy = sqs[i].y;
        sqs[i].x += gauss() * 0.5;
        sqs[i].y += gauss() * 0.5;
        return { undo() { sqs[i].x = ox; sqs[i].y = oy; } };
      } else if (r < 0.65) {
        // small rotate
        const i = (Math.random() * n) | 0;
        const ot = sqs[i].theta;
        sqs[i].theta += gauss() * 0.1;
        return { undo() { sqs[i].theta = ot; } };
      } else if (r < 0.75) {
        // large rotate
        const i = (Math.random() * n) | 0;
        const ot = sqs[i].theta;
        sqs[i].theta = Math.random() * Math.PI / 2;
        return { undo() { sqs[i].theta = ot; } };
      } else if (r < 0.90) {
        // swap positions
        if (n < 2) return { undo() {} };
        let i = (Math.random() * n) | 0;
        let j = (Math.random() * n) | 0;
        while (j === i) j = (Math.random() * n) | 0;
        const ax = sqs[i].x, ay = sqs[i].y;
        const bx = sqs[j].x, by = sqs[j].y;
        sqs[i].x = bx; sqs[i].y = by;
        sqs[j].x = ax; sqs[j].y = ay;
        return { undo() { sqs[i].x = ax; sqs[i].y = ay; sqs[j].x = bx; sqs[j].y = by; } };
      } else {
        // random reset
        const i = (Math.random() * n) | 0;
        const ox = sqs[i].x, oy = sqs[i].y, ot = sqs[i].theta;
        const w = state.container.w, h = state.container.h;
        sqs[i].x = Math.random() * w;
        sqs[i].y = Math.random() * h;
        sqs[i].theta = Math.random() * Math.PI / 2;
        return { undo() { sqs[i].x = ox; sqs[i].y = oy; sqs[i].theta = ot; } };
      }
    }

    function annealStep(state) {
      const eOld = computeEnergy(state.squares, state.container);
      const move = proposeMove(state);
      const eNew = computeEnergy(state.squares, state.container);
      const dE = eNew - eOld;
      if (dE > 0 && Math.random() >= Math.exp(-dE / Math.max(state.T, T_MIN))) {
        move.undo();
      }
      state.T *= COOLING;
      if (state.T < T_MIN) state.T = T_MIN;
      state.iter++;
      state.lastEnergy = computeEnergy(state.squares, state.container);
    }

    function stepsForSpeed(speed) {
      // speed: 0..100 → steps per frame: 1..~5000 (log scale)
      const t = speed / 100;
      return Math.max(1, Math.round(Math.exp(Math.log(1) * (1 - t) + Math.log(5000) * t)));
    }
```

- [ ] **Step 2: Wire annealing into the rAF loop**

Replace the `tick()` function (currently just incrementing `iter` and rendering) with:

```javascript
    function tick() {
      if (!running) return;
      const speed = parseInt(document.getElementById('input-speed').value, 10);
      const steps = stepsForSpeed(speed);
      for (let i = 0; i < steps; i++) annealStep(state);
      render(state);
      updateStatus();
      rafId = requestAnimationFrame(tick);
    }
```

- [ ] **Step 3: Update status to use cached energy**

In `updateStatus()`, replace the `const e = computeEnergy(...)` line with:

```javascript
      const e = state.lastEnergy ?? computeEnergy(state.squares, state.container);
```

- [ ] **Step 4: Verify in browser**

Open `packing/index.html`. Click Run. Expected:
- Squares visibly slide and rotate around the canvas.
- Status's `energy` field decreases over time (with fluctuations).
- After ~10 seconds at speed 50, energy is close to 0 (squares no longer overlap and stay inside the container, though they don't pack tightly yet — container doesn't shrink yet).
- Drag speed slider to max: animation accelerates dramatically; iter jumps fast.
- Drag speed slider to min: each frame moves only one square slightly.

- [ ] **Step 5: Commit**

```bash
git add packing/index.html
git commit -m "feat(packing): add simulated annealing inner loop with all six move types"
```

---

### Task 6: Mode A — Container Shrinking + Best Tracking

**Files:**
- Modify: `packing/index.html`

When energy is 0 (feasible), shrink the container. Record the best feasible container dimensions. If shrinking pushes the system infeasible and it cannot recover, restore to the best feasible size.

- [ ] **Step 1: Add shrink logic**

Inside the `<script>` tag, immediately after the `function annealStep(state) { ... }` definition, insert:

```javascript
    const SHRINK_FACTOR = 0.998;
    const RECOVER_BUDGET = 10000;

    function recordBestIfFeasible(state) {
      if (state.mode !== 'min') return;
      if (state.lastEnergy > 1e-9) return;
      const { w, h } = state.container;
      const area = w * h;
      if (state.best === null || area < state.best.area) {
        state.best = {
          area,
          w, h,
          squares: state.squares.map(s => ({ x: s.x, y: s.y, theta: s.theta })),
        };
        state.stuckSince = state.iter;
      }
    }

    function shrinkIfFeasible(state) {
      if (state.mode !== 'min') return;
      if (state.lastEnergy > 1e-9) return;
      if (state.shape === 'square') {
        const ns = state.container.w * SHRINK_FACTOR;
        state.container.w = ns;
        state.container.h = ns;
      } else {
        // shrink longer side
        if (state.container.w >= state.container.h) {
          state.container.w *= SHRINK_FACTOR;
        } else {
          state.container.h *= SHRINK_FACTOR;
        }
      }
    }

    function maybeRecover(state) {
      if (state.mode !== 'min') return;
      if (state.best === null) return;
      if (state.lastEnergy <= 1e-9) {
        state.stuckSince = state.iter;
        return;
      }
      if (state.iter - (state.stuckSince ?? 0) > RECOVER_BUDGET) {
        // restore best feasible
        state.container.w = state.best.w;
        state.container.h = state.best.h;
        for (let i = 0; i < state.squares.length; i++) {
          state.squares[i].x = state.best.squares[i].x;
          state.squares[i].y = state.best.squares[i].y;
          state.squares[i].theta = state.best.squares[i].theta;
        }
        state.lastEnergy = 0;
        state.stuckSince = state.iter;
        // bump T to encourage exploration after restore
        state.T = Math.max(state.T, 0.05);
      }
    }
```

- [ ] **Step 2: Hook shrink/recover into the tick**

Replace the `tick()` function with:

```javascript
    function tick() {
      if (!running) return;
      const speed = parseInt(document.getElementById('input-speed').value, 10);
      const steps = stepsForSpeed(speed);
      for (let i = 0; i < steps; i++) {
        annealStep(state);
        recordBestIfFeasible(state);
        shrinkIfFeasible(state);
        maybeRecover(state);
      }
      render(state);
      updateStatus();
      rafId = requestAnimationFrame(tick);
    }
```

- [ ] **Step 3: Update status to show best**

Replace `updateStatus()` with:

```javascript
    function updateStatus() {
      const { w, h } = state.container;
      const e = state.lastEnergy ?? computeEnergy(state.squares, state.container);
      const feasible = e <= 1e-9 ? '✓' : '✗';
      let bestStr = 'best=—';
      if (state.best) {
        if (state.mode === 'min' && state.shape === 'square') {
          bestStr = `best: side=${state.best.w.toFixed(3)} area=${state.best.area.toFixed(3)}`;
        } else if (state.mode === 'min') {
          bestStr = `best: w=${state.best.w.toFixed(3)} h=${state.best.h.toFixed(3)} area=${state.best.area.toFixed(3)}`;
        }
      }
      const fill = state.squares.length / (w * h);
      status.textContent =
        `${bestStr}  fill=${(fill * 100).toFixed(1)}%\n` +
        `mode=${state.mode}  n=${state.squares.length}  ` +
        `cur=${w.toFixed(3)}×${h.toFixed(3)}  e=${e.toFixed(4)} ${feasible}  ` +
        `iter=${state.iter}  T=${state.T.toFixed(4)}`;
    }
```

- [ ] **Step 4: Verify in browser**

Open `packing/index.html`. With defaults (N=11, square), click Run. Speed mid. Expected:
- Squares organize, energy hits 0, then container starts visibly shrinking.
- Status's `best:` line updates as the container shrinks.
- Squares occasionally tilt — final layout for N=11 is known to require tilted squares to be optimal (~3.877 side).
- After ~30 seconds, `best: side=` should be in the range ~3.9–4.5 (heuristic — won't always reach optimal).
- Switch to "rect": container is no longer constrained to square; the longer side gradually shortens.

- [ ] **Step 5: Commit**

```bash
git add packing/index.html
git commit -m "feat(packing): shrink container when feasible, track best, recover when stuck"
```

---

### Task 7: Mode B — Max Squares in Fixed Container

**Files:**
- Modify: `packing/index.html`

When mode = 'max', maintain a count `n`. If energy stays positive too long, drop one square. If energy stays at 0 long enough, try adding one. Track the best `n` achieved.

- [ ] **Step 1: Add count-adjustment logic**

Inside the `<script>` tag, immediately after the `function maybeRecover(state) { ... }` definition, insert:

```javascript
    const DROP_BUDGET = 10000;
    const ADD_BUDGET = 5000;

    function recordBestCount(state) {
      if (state.mode !== 'max') return;
      if (state.lastEnergy > 1e-9) return;
      const n = state.squares.length;
      if (state.best === null || n > state.best.n) {
        state.best = {
          n,
          squares: state.squares.map(s => ({ x: s.x, y: s.y, theta: s.theta })),
        };
        state.stuckSince = state.iter;
      }
    }

    function adjustCount(state) {
      if (state.mode !== 'max') return;
      const { w, h } = state.container;
      const since = state.iter - (state.stuckSince ?? 0);
      if (state.lastEnergy > 1e-9 && since > DROP_BUDGET && state.squares.length > 1) {
        // remove one random square
        const i = (Math.random() * state.squares.length) | 0;
        state.squares.splice(i, 1);
        state.stuckSince = state.iter;
      } else if (state.lastEnergy <= 1e-9 && since > ADD_BUDGET) {
        // try adding a square at random position+angle
        state.squares.push({
          x: Math.random() * w,
          y: Math.random() * h,
          theta: Math.random() * Math.PI / 2,
        });
        state.stuckSince = state.iter;
        state.T = Math.max(state.T, 0.05);
      }
    }
```

- [ ] **Step 2: Hook count-adjustment into the tick**

Replace the `tick()` function with:

```javascript
    function tick() {
      if (!running) return;
      const speed = parseInt(document.getElementById('input-speed').value, 10);
      const steps = stepsForSpeed(speed);
      for (let i = 0; i < steps; i++) {
        annealStep(state);
        recordBestIfFeasible(state);
        recordBestCount(state);
        shrinkIfFeasible(state);
        maybeRecover(state);
        adjustCount(state);
      }
      render(state);
      updateStatus();
      rafId = requestAnimationFrame(tick);
    }
```

- [ ] **Step 3: Extend status for max mode**

In `updateStatus()`, replace the `let bestStr = ...` block (everything from `let bestStr` through the closing `}` of the `if (state.best)` chain) with:

```javascript
      let bestStr = 'best=—';
      if (state.best) {
        if (state.mode === 'min' && state.shape === 'square') {
          bestStr = `best: side=${state.best.w.toFixed(3)} area=${state.best.area.toFixed(3)}`;
        } else if (state.mode === 'min') {
          bestStr = `best: w=${state.best.w.toFixed(3)} h=${state.best.h.toFixed(3)} area=${state.best.area.toFixed(3)}`;
        } else {
          bestStr = `best: ${state.best.n} squares`;
        }
      }
```

- [ ] **Step 4: Verify in browser**

Open `packing/index.html`. Click "Max squares" tab. Defaults W=5, H=5. Click Run. Expected:
- 25 squares scattered, lots of overlap (energy high).
- After a few seconds, count drops (one square removed at a time) until energy can reach 0.
- For W=5, H=5, the trivially-fitting count is 25, so it should stabilize at 25 if annealing converges (or close — sometimes it gets stuck at 24 with arbitrary rotations).
- Try W=5, H=7.2: count rises into the 35–36 range over time.
- Status shows `best: NN squares`.

- [ ] **Step 5: Commit**

```bash
git add packing/index.html
git commit -m "feat(packing): add max-squares mode with count-adjustment heuristic"
```

---

### Task 8: Periodic Reheats

**Files:**
- Modify: `packing/index.html`

Annealing gets stuck in local minima as T decays. Add periodic reheats: every ~20k steps, bump T back up by a fraction of its initial value. This implements the "periodic reheats" behavior from the spec.

- [ ] **Step 1: Add reheat logic**

Inside the `<script>` tag, immediately after the `const T_MIN = 1e-4;` line, append:

```javascript
    const REHEAT_INTERVAL = 20000;
    const REHEAT_T = 0.3;
```

Then, inside `annealStep`, replace the lines:

```javascript
      state.T *= COOLING;
      if (state.T < T_MIN) state.T = T_MIN;
      state.iter++;
      state.lastEnergy = computeEnergy(state.squares, state.container);
```

with:

```javascript
      state.T *= COOLING;
      if (state.T < T_MIN) state.T = T_MIN;
      state.iter++;
      if (state.iter % REHEAT_INTERVAL === 0 && state.T < REHEAT_T) {
        state.T = REHEAT_T;
      }
      state.lastEnergy = computeEnergy(state.squares, state.container);
```

- [ ] **Step 2: Verify in browser**

Open `packing/index.html`. Click Run with N=11, square shape, max speed. Expected:
- After T decays small, you see periodic spikes of disorder (squares scrambling slightly more) about every 20k iterations.
- Watch the `best:` value over a couple of minutes — it should keep slowly improving (not plateau as quickly as before).
- Status's T value visibly jumps every ~20k iterations.

- [ ] **Step 3: Commit**

```bash
git add packing/index.html
git commit -m "feat(packing): add periodic reheats to escape local minima"
```

---

### Task 9: Polish — Defaults, Layout, Final Verification

**Files:**
- Modify: `packing/index.html`

Final tightening pass: make sure defaults are right, layout is clean on load, status line is readable, both modes work end-to-end. No new feature work — just confirming the spec is met.

- [ ] **Step 1: Auto-run on page load**

Inside the `<script>` tag, at the very end of the script (after all the `addEventListener` calls and the initial `render(state); updateStatus();` lines), append:

```javascript
    // Start with the solver running so the user immediately sees activity.
    doRun();
```

- [ ] **Step 2: Verify all spec requirements end-to-end**

Open `packing/index.html` (no query string). Walk through:

- [x] Loads with Min container active, N=11, shape=square. Solver auto-runs.
- [x] Squares visible, animate, container shrinks over time. Tilted layouts appear.
- [x] Click Stop: animation freezes. Click Run: resumes. Click Reset: starts over.
- [x] Drag speed slider min↔max: speed scales smoothly.
- [x] Switch shape to "rect": container becomes rectangular and shrinks both dimensions.
- [x] Switch tab to Max squares: 5×5 container with squares; count adjusts to a feasible best.
- [x] Change W to 5, H to 7.2: more squares, count grows over time.
- [x] Status shows best and current state, with a feasibility check.
- [x] Open `packing/index.html?test=1`: 10 `✓` lines in console.

- [ ] **Step 3: Commit**

```bash
git add packing/index.html
git commit -m "feat(packing): auto-start solver on load"
```

---

## Self-Review Notes

Spec coverage check:

- Mode A (square + rect, minimize area, N input, default 11) — Tasks 4, 6.
- Mode B (W×H input, maximize count) — Tasks 4, 7.
- Simulated annealing with 6 move types, geometric cooling, reheats — Tasks 5, 8.
- Energy = sum of squared SAT penetrations + squared boundary excess — Tasks 2, 3.
- Live animation, speed slider, run/stop/reset — Tasks 4, 5.
- Status line: best, fill ratio, iter, T, feasibility — Tasks 4, 6, 7.
- Single self-contained HTML file at `packing/index.html`, no deps — every task.
- Minimal monochrome styling — Task 1.
- Inline tests for pure functions, gated by `?test=1` — Tasks 2, 3.

Out-of-scope items from spec (no save/load, no export PNG, no worker, no mobile-specific) — correctly absent from the plan.
