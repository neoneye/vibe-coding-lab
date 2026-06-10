# 2D Double-Slit Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single self-contained `index.html` that visualizes the double-slit experiment: animated wave interference, particle-by-particle detection converging to the wave prediction, and a which-path detector toggle that collapses the fringes.

**Architecture:** Analytic Huygens-phasor engine — each slit is a row of point sources; per-pixel complex amplitudes are precomputed on parameter change and animated by phase rotation. Pure-math physics lives in a `<script id="physics-core">` block (no DOM) so `test.mjs` can extract and unit-test it with Node, following the game-snake pattern. UI/rendering lives in a second `<script id="app">` block.

**Tech Stack:** Vanilla JS, two `<canvas>` elements, `node test.mjs` for physics tests. No dependencies.

**Spec:** `docs/superpowers/specs/2026-06-10-dual-slit-visualizer-design.md`

**Working directory:** `/Users/neoneye/git/vibe-coding-lab/2d-dual-slit-experiment`

## File Structure

- `2d-dual-slit-experiment/index.html` — the whole app:
  - `<style>` — dark theme layout
  - markup — header, `#field` canvas (720×480), `#screenview` canvas (260×480), `#caption`, `#controls`
  - `<script id="physics-core">` — pure functions: `slitSources`, `fieldAt`, `screenIntensity`, `buildCDF`, `sampleIndex`, `findPeaks`; exports via `module.exports` guard for Node
  - `<script id="app">` — state, precompute, render loop, particles, controls, captions
- `2d-dual-slit-experiment/test.mjs` — extracts the physics-core block from index.html, runs assertions
- `2d-dual-slit-experiment/screenshot1.jpg` — committed at the end (lab convention)

World coordinates = `#field` canvas pixels (720×480). Constants: source at (40, 240), barrier at x=280 (6 px thick), screen at x=700. Field is computed on a half-resolution grid (360×240) and upscaled.

---

### Task 1: HTML skeleton

**Files:**
- Create: `2d-dual-slit-experiment/index.html`

- [ ] **Step 1: Write the skeleton** (layout, styles, controls markup, empty script blocks)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Double-Slit Experiment</title>
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:#0b0e14; color:#cdd6e4; font-family:-apple-system,'Segoe UI',sans-serif; display:flex; flex-direction:column; align-items:center; min-height:100vh; }
header { text-align:center; padding:14px 16px 6px; }
h1 { margin:0; font-size:22px; font-weight:600; letter-spacing:0.5px; }
#subtitle { margin:4px 0 0; font-size:13px; color:#7d8aa0; }
#stage { display:flex; gap:10px; padding:10px; width:100%; max-width:1020px; justify-content:center; }
canvas { background:#06080d; border-radius:8px; border:1px solid #1c2433; display:block; max-width:100%; height:auto; }
#field { flex:0 1 720px; min-width:0; }
#screenview { flex:0 1 260px; min-width:0; }
#caption { width:calc(100% - 20px); max-width:1000px; min-height:44px; margin:2px 10px; padding:10px 14px; font-size:14px; line-height:1.45; color:#aab8cc; background:#10151f; border:1px solid #1c2433; border-radius:8px; }
#controls { display:flex; flex-wrap:wrap; gap:14px 22px; align-items:flex-start; justify-content:center; padding:12px 16px 20px; max-width:1000px; }
.ctl { display:flex; flex-direction:column; gap:3px; font-size:12px; color:#8fa0b8; }
.ctl .val { color:#e6edf7; font-variant-numeric:tabular-nums; }
input[type=range] { width:130px; }
button { background:#1a2334; color:#dbe6f5; border:1px solid #2b3850; border-radius:6px; padding:6px 14px; font-size:13px; cursor:pointer; }
button:hover { background:#233048; }
button.active { background:#2c4a76; border-color:#4a6da0; }
button:disabled { opacity:0.4; cursor:default; }
.btngroup { display:flex; gap:6px; }
</style>
</head>
<body>
<header>
  <h1>Double-Slit Experiment</h1>
  <p id="subtitle">waves, particles, and what happens when you peek</p>
</header>
<div id="stage">
  <canvas id="field" width="720" height="480"></canvas>
  <canvas id="screenview" width="260" height="480"></canvas>
</div>
<div id="caption"></div>
<div id="controls">
  <div class="ctl">slits
    <div class="btngroup">
      <button id="slits1">1 slit</button>
      <button id="slits2" class="active">2 slits</button>
    </div>
  </div>
  <div class="ctl">which-path detector
    <div class="btngroup"><button id="detector">off</button></div>
  </div>
  <div class="ctl"><span>wavelength λ <span class="val" id="lambdaVal"></span></span>
    <input type="range" id="lambda" min="8" max="36" step="1" value="16">
  </div>
  <div class="ctl"><span>slit separation d <span class="val" id="sepVal"></span></span>
    <input type="range" id="sep" min="40" max="160" step="2" value="90">
  </div>
  <div class="ctl"><span>slit width w <span class="val" id="slitWidthVal"></span></span>
    <input type="range" id="slitWidth" min="4" max="24" step="1" value="12">
  </div>
  <div class="ctl"><span>particles/sec <span class="val" id="rateVal"></span></span>
    <input type="range" id="rate" min="0" max="300" step="5" value="60">
  </div>
  <div class="ctl">&nbsp;
    <div class="btngroup">
      <button id="clear">clear</button>
      <button id="pause">pause</button>
    </div>
  </div>
</div>
<script id="physics-core">
// Task 2
</script>
<script id="app">
// Tasks 3-5
</script>
</body>
</html>
```

- [ ] **Step 2: Open in browser, confirm layout renders** (two dark canvases side by side, controls below)

Run: `open /Users/neoneye/git/vibe-coding-lab/2d-dual-slit-experiment/index.html`

- [ ] **Step 3: Commit**

```bash
git add 2d-dual-slit-experiment/index.html
git commit -m "feat(dual-slit): page skeleton with layout and controls"
```

---

### Task 2: Physics core (TDD)

**Files:**
- Create: `2d-dual-slit-experiment/test.mjs`
- Modify: `2d-dual-slit-experiment/index.html` (fill `<script id="physics-core">`)

- [ ] **Step 1: Write the failing tests**

`test.mjs` — extracts the physics block from index.html and asserts. Uses a seeded LCG so sampling tests are deterministic.

```js
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="physics-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'physics-core script block found');
const module = { exports: {} };
new Function('module', m[1])(module);
const P = module.exports;
assert.ok(P && P.slitSources, 'Physics exported');

const H = 480, CY = 240, BARRIER_X = 280, SCREEN_X = 700, PER_SLIT = 9;
const L = SCREEN_X - BARRIER_X; // 420

function params(over = {}) {
  return Object.assign({ slitCount: 2, sep: 100, slitWidth: 10, barrierX: BARRIER_X, cy: CY, perSlit: PER_SLIT }, over);
}

// --- slitSources geometry ---
{
  const s = P.slitSources(params());
  assert.equal(s.length, 2 * PER_SLIT, 'two slits x perSlit sources');
  const ysA = s.filter(q => q.slit === 0).map(q => q.y);
  const ysB = s.filter(q => q.slit === 1).map(q => q.y);
  assert.ok(Math.abs(ysA.reduce((a, b) => a + b) / ysA.length - (CY - 50)) < 1e-9, 'slit A centered at cy-sep/2');
  assert.ok(Math.abs(ysB.reduce((a, b) => a + b) / ysB.length - (CY + 50)) < 1e-9, 'slit B centered at cy+sep/2');
  assert.ok(Math.max(...ysA) - Math.min(...ysA) <= 10 + 1e-9, 'sources span slit width');
  assert.ok(s.every(q => q.x === BARRIER_X), 'sources sit on the barrier');
  const one = P.slitSources(params({ slitCount: 1 }));
  assert.equal(one.length, PER_SLIT, 'single slit source count');
  assert.ok(one.every(q => q.slit === 0), 'single slit uses slot 0');
}

// --- field symmetry about cy ---
{
  const s = P.slitSources(params());
  const k = 2 * Math.PI / 12;
  const up = P.fieldAt(s, k, SCREEN_X, CY - 77);
  const dn = P.fieldAt(s, k, SCREEN_X, CY + 77);
  const Iup = (up.re[0] + up.re[1]) ** 2 + (up.im[0] + up.im[1]) ** 2;
  const Idn = (dn.re[0] + dn.re[1]) ** 2 + (dn.im[0] + dn.im[1]) ** 2;
  assert.ok(Math.abs(Iup - Idn) / (Iup + Idn) < 1e-6, 'intensity symmetric about cy');
}

// --- coherent: central max + fringe spacing ~ lambda*L/d ---
{
  const lambda = 12, d = 100;
  const s = P.slitSources(params({ sep: d }));
  const I = P.screenIntensity(s, 2 * Math.PI / lambda, SCREEN_X, H, true);
  const peaks = P.findPeaks(I).filter(y => Math.abs(y - CY) < 135);
  assert.ok(peaks.length >= 4, `enough central peaks (got ${peaks.length})`);
  // central peak is the global max of the central region
  const best = peaks.reduce((a, b) => (I[a] > I[b] ? a : b));
  assert.ok(Math.abs(best - CY) < 6, 'brightest central fringe at cy');
  const gaps = peaks.slice(1).map((p, i) => p - peaks[i]);
  const mean = gaps.reduce((a, b) => a + b) / gaps.length;
  const expected = lambda * L / d; // 50.4
  assert.ok(Math.abs(mean - expected) / expected < 0.15,
    `fringe spacing ${mean.toFixed(1)} within 15% of ${expected.toFixed(1)}`);
}

// --- which-path (incoherent) kills fringe visibility ---
{
  const s = P.slitSources(params());
  const k = 2 * Math.PI / 12;
  const co = P.screenIntensity(s, k, SCREEN_X, H, true);
  const inc = P.screenIntensity(s, k, SCREEN_X, H, false);
  const vis = I => {
    let mx = 0, mn = Infinity;
    for (let y = CY - 100; y <= CY + 100; y++) { mx = Math.max(mx, I[y]); mn = Math.min(mn, I[y]); }
    return (mx - mn) / (mx + mn);
  };
  assert.ok(vis(co) > 0.7, `coherent visibility high (${vis(co).toFixed(2)})`);
  assert.ok(vis(inc) < 0.2, `incoherent visibility low (${vis(inc).toFixed(2)})`);
}

// --- CDF + sampling ---
{
  const s = P.slitSources(params());
  const I = P.screenIntensity(s, 2 * Math.PI / 12, SCREEN_X, H, true);
  const cdf = P.buildCDF(I);
  assert.ok(Math.abs(cdf[H - 1] - 1) < 1e-9, 'CDF ends at 1');
  for (let y = 1; y < H; y++) assert.ok(cdf[y] >= cdf[y - 1], 'CDF monotonic');
  let seed = 42;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  let sum = 0; const N = 20000;
  for (let i = 0; i < N; i++) sum += P.sampleIndex(cdf, rand());
  assert.ok(Math.abs(sum / N - CY) < 10, `sample mean ${(sum / N).toFixed(1)} near cy (symmetric P)`);
}

console.log('all physics tests passed');
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd 2d-dual-slit-experiment && node test.mjs`
Expected: FAIL — `Physics exported` assertion (block contains only a comment).

- [ ] **Step 3: Implement the physics-core block**

Replace the `<script id="physics-core">` body in `index.html`:

```html
<script id="physics-core">
// Pure double-slit math. No DOM. Huygens: each slit = perSlit coherent point
// sources; 2D cylindrical waves e^{ikr}/sqrt(r).
const Physics = {
  slitSources({ slitCount, sep, slitWidth, barrierX, cy, perSlit }) {
    const centers = slitCount === 1 ? [cy] : [cy - sep / 2, cy + sep / 2];
    const srcs = [];
    centers.forEach((c, slit) => {
      for (let i = 0; i < perSlit; i++) {
        const f = perSlit === 1 ? 0 : i / (perSlit - 1) - 0.5;
        srcs.push({ x: barrierX, y: c + f * slitWidth, slit });
      }
    });
    return srcs;
  },
  // Per-slit complex field sums at one point: {re:[A,B], im:[A,B]}
  fieldAt(sources, k, px, py) {
    const re = [0, 0], im = [0, 0];
    for (const s of sources) {
      const r = Math.max(Math.hypot(px - s.x, py - s.y), 0.5);
      const a = 1 / Math.sqrt(r);
      re[s.slit] += a * Math.cos(k * r);
      im[s.slit] += a * Math.sin(k * r);
    }
    return { re, im };
  },
  // Intensity profile down the screen column. coherent=false models a
  // which-path measurement: |psi1|^2 + |psi2|^2 instead of |psi1+psi2|^2.
  screenIntensity(sources, k, screenX, height, coherent) {
    const I = new Float64Array(height);
    for (let y = 0; y < height; y++) {
      const f = Physics.fieldAt(sources, k, screenX, y + 0.5);
      I[y] = coherent
        ? (f.re[0] + f.re[1]) ** 2 + (f.im[0] + f.im[1]) ** 2
        : f.re[0] ** 2 + f.im[0] ** 2 + f.re[1] ** 2 + f.im[1] ** 2;
    }
    return I;
  },
  buildCDF(I) {
    const c = new Float64Array(I.length);
    let t = 0;
    for (let i = 0; i < I.length; i++) { t += I[i]; c[i] = t; }
    if (t > 0) for (let i = 0; i < c.length; i++) c[i] /= t;
    return c;
  },
  sampleIndex(cdf, u) {
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
    return lo;
  },
  findPeaks(I) {
    let mx = 0;
    for (let i = 0; i < I.length; i++) mx = Math.max(mx, I[i]);
    const p = [];
    for (let i = 1; i < I.length - 1; i++)
      if (I[i] > I[i - 1] && I[i] >= I[i + 1] && I[i] > 0.2 * mx) p.push(i);
    return p;
  }
};
if (typeof module !== 'undefined') module.exports = Physics;
</script>
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd 2d-dual-slit-experiment && node test.mjs`
Expected: `all physics tests passed`

- [ ] **Step 5: Commit**

```bash
git add 2d-dual-slit-experiment/index.html 2d-dual-slit-experiment/test.mjs
git commit -m "feat(dual-slit): Huygens phasor physics core with node tests"
```

---

### Task 3: Wave-field rendering

**Files:**
- Modify: `2d-dual-slit-experiment/index.html` (fill `<script id="app">`)

- [ ] **Step 1: Implement precompute + animated field render**

Replace the `<script id="app">` body. Stubs (`fireParticles`, `drawPops`, `drawPanel`, `updateCaption`, `syncControls`) are filled in Tasks 4–5.

```html
<script id="app">
'use strict';
const fieldC = document.getElementById('field');
const fctx = fieldC.getContext('2d');
const W = fieldC.width, H = fieldC.height;
const GS = 2, GW = W / GS, GH = H / GS;          // half-res sim grid
const SRC = { x: 40, y: H / 2 };
const BARRIER_X = 280, BARRIER_W = 6, SCREEN_X = 700;
const PER_SLIT = 9;

const state = { slits: 2, sep: 90, slitWidth: 12, lambda: 16, rate: 60, detector: false, paused: false };

let reA, imA, reB, imB, envArr, screenI, cdf, maxScreenI = 0;
let sources = [], kNum = 0;

const gcan = document.createElement('canvas');
gcan.width = GW; gcan.height = GH;
const gctx = gcan.getContext('2d');
const gimg = gctx.createImageData(GW, GH);

const glowCan = document.createElement('canvas');
glowCan.width = 1; glowCan.height = H;
const glowCtx = glowCan.getContext('2d');

function incoherent() { return state.detector && state.slits === 2; }

function recompute() {
  // keep slits from overlapping
  if (state.slits === 2 && state.slitWidth > state.sep - 16) state.slitWidth = state.sep - 16;
  kNum = 2 * Math.PI / state.lambda;
  sources = Physics.slitSources({ slitCount: state.slits, sep: state.sep,
    slitWidth: state.slitWidth, barrierX: BARRIER_X, cy: H / 2, perSlit: PER_SLIT });
  const n = GW * GH;
  reA = new Float32Array(n); imA = new Float32Array(n);
  reB = new Float32Array(n); imB = new Float32Array(n);
  const srcNorm = 3.2 / PER_SLIT;
  for (let gy = 0; gy < GH; gy++) {
    const y = gy * GS + GS / 2;
    for (let gx = 0; gx < GW; gx++) {
      const x = gx * GS + GS / 2;
      const i = gy * GW + gx;
      if (x > BARRIER_X - BARRIER_W / 2 && x < BARRIER_X + BARRIER_W / 2) continue;
      if (x < BARRIER_X) {
        const r = Math.max(Math.hypot(x - SRC.x, y - SRC.y), 0.5);
        const a = 2.2 / Math.sqrt(r);
        reA[i] = a * Math.cos(kNum * r); imA[i] = a * Math.sin(kNum * r);
      } else {
        const f = Physics.fieldAt(sources, kNum, x, y);
        reA[i] = f.re[0] * srcNorm; imA[i] = f.im[0] * srcNorm;
        reB[i] = f.re[1] * srcNorm; imB[i] = f.im[1] * srcNorm;
      }
    }
  }
  computeEnv();
  screenI = Physics.screenIntensity(sources, kNum, SCREEN_X, H, !incoherent());
  cdf = Physics.buildCDF(screenI);
  maxScreenI = 0;
  for (let y = 0; y < H; y++) maxScreenI = Math.max(maxScreenI, screenI[y]);
  buildGlow();
  updateCaption();
  syncControls();
}

function computeEnv() {
  envArr = new Float32Array(GW * GH);
  const inc = incoherent();
  for (let i = 0; i < envArr.length; i++) {
    envArr[i] = inc
      ? Math.sqrt(reA[i] * reA[i] + imA[i] * imA[i] + reB[i] * reB[i] + imB[i] * imB[i])
      : Math.hypot(reA[i] + reB[i], imA[i] + imB[i]);
  }
}

function buildGlow() {
  const img = glowCtx.createImageData(1, H);
  for (let y = 0; y < H; y++) {
    const a = maxScreenI > 0 ? screenI[y] / maxScreenI : 0;
    const p = y * 4;
    img.data[p] = 255; img.data[p + 1] = 190; img.data[p + 2] = 90;
    img.data[p + 3] = Math.round(a * 215);
  }
  glowCtx.putImageData(img, 0, 0);
}

let thetaB = 0;  // extra phase on slit B; random-walks when "watched"
function drawField(tSec) {
  const om = kNum * 110;                       // ripples travel ~110 px/s
  const c = Math.cos(om * tSec), s = Math.sin(om * tSec);
  let cB = c, sB = s;
  if (incoherent()) {
    thetaB += (Math.random() - 0.5) * 0.9;     // measurement scrambles relative phase
    cB = Math.cos(om * tSec + thetaB); sB = Math.sin(om * tSec + thetaB);
  }
  const d = gimg.data;
  for (let i = 0; i < GW * GH; i++) {
    const v = reA[i] * c + imA[i] * s + reB[i] * cB + imB[i] * sB;
    const ve = Math.tanh(v * 1.1);
    const ee = Math.tanh(envArr[i] * 0.9);
    const p = i * 4;
    d[p]     = Math.max(0, 10 + ee * 35 + ve * 25);
    d[p + 1] = Math.max(0, 16 + ee * 95 + ve * 75);
    d[p + 2] = Math.max(0, 26 + ee * 150 + ve * 105);
    d[p + 3] = 255;
  }
  gctx.putImageData(gimg, 0, 0);
  fctx.imageSmoothingEnabled = true;
  fctx.drawImage(gcan, 0, 0, W, H);
  fctx.drawImage(glowCan, SCREEN_X, 0, W - SCREEN_X, H);
  drawBarrier();
  drawSource(tSec);
}

function drawBarrier() {
  const cy = H / 2;
  const centers = state.slits === 1 ? [cy] : [cy - state.sep / 2, cy + state.sep / 2];
  const xb = BARRIER_X - BARRIER_W / 2;
  const segs = [0];
  centers.forEach(c => segs.push(c - state.slitWidth / 2, c + state.slitWidth / 2));
  segs.push(H);
  fctx.fillStyle = '#46536b';
  for (let i = 0; i < segs.length; i += 2) fctx.fillRect(xb, segs[i], BARRIER_W, segs[i + 1] - segs[i]);
  if (incoherent()) centers.forEach(c => drawEye(BARRIER_X + 18, c));
}

function drawEye(x, y) {
  fctx.strokeStyle = '#ffb454'; fctx.fillStyle = '#ffb454'; fctx.lineWidth = 1.5;
  fctx.beginPath(); fctx.ellipse(x, y, 9, 5.5, 0, 0, Math.PI * 2); fctx.stroke();
  fctx.beginPath(); fctx.arc(x, y, 2.6, 0, Math.PI * 2); fctx.fill();
}

function drawSource(t) {
  fctx.fillStyle = '#9fe3ff';
  fctx.beginPath(); fctx.arc(SRC.x, SRC.y, 3.5 + Math.sin(t * 6) * 0.8, 0, Math.PI * 2); fctx.fill();
}

// ---- stubs completed in Tasks 4-5 ----
function fireParticles(dt) {}
function drawPops(t) {}
function drawPanel() {}
function updateCaption() {}
function syncControls() {}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!state.paused) {
    const tSec = now / 1000;
    fireParticles(dt);
    drawField(tSec);
    drawPops(tSec);
    drawPanel();
  }
  requestAnimationFrame(frame);
}
recompute();
requestAnimationFrame(frame);
</script>
```

- [ ] **Step 2: Verify in browser**

Run: `open /Users/neoneye/git/vibe-coding-lab/2d-dual-slit-experiment/index.html`
Expected: circular ripples spread from the source, pass the two slits, and a fringed interference fan fills the right side; amber glow stripes on the right edge with a bright central band.

- [ ] **Step 3: Run physics tests still pass**

Run: `cd 2d-dual-slit-experiment && node test.mjs`
Expected: `all physics tests passed`

- [ ] **Step 4: Commit**

```bash
git add 2d-dual-slit-experiment/index.html
git commit -m "feat(dual-slit): animated Huygens wave field with barrier and screen glow"
```

---

### Task 4: Particles + detection panel

**Files:**
- Modify: `2d-dual-slit-experiment/index.html` (replace the three stubs `fireParticles`, `drawPops`, `drawPanel` in `#app`; add panel state above them)

- [ ] **Step 1: Replace stubs with particle firing, landing pops, and the detection panel**

Delete the stub `function fireParticles(dt) {}`, `function drawPops(t) {}`, `function drawPanel() {}` lines and insert:

```js
// ---- particles & detection panel ----
const panelC = document.getElementById('screenview');
const pctx = panelC.getContext('2d');
const PW = panelC.width, PH = panelC.height;
const NBINS = 96;
const DOT_X0 = 8, DOT_X1 = 76, HIST_X0 = 92;
let bins = new Float32Array(NBINS), dots = [], pops = [];
let totalCount = 0, fireAcc = 0, flashT = -1;

function fireParticles(dt) {
  if (!cdf || maxScreenI === 0) return;
  fireAcc += state.rate * dt;
  const n = Math.floor(fireAcc);
  fireAcc -= n;
  if (n > 0) flashT = performance.now() / 1000;
  for (let j = 0; j < n; j++) {
    const y = Physics.sampleIndex(cdf, Math.random()) + Math.random() - 0.5;
    pops.push({ y, t0: performance.now() / 1000 });
    dots.push({ x: DOT_X0 + Math.random() * (DOT_X1 - DOT_X0), y });
    if (dots.length > 6000) dots.splice(0, dots.length - 6000);
    bins[Math.max(0, Math.min(NBINS - 1, Math.floor(y / H * NBINS)))]++;
    totalCount++;
  }
  if (pops.length > 80) pops.splice(0, pops.length - 80);
}

function drawPops(t) {
  for (const p of pops) {
    const age = t - p.t0;
    if (age < 0 || age > 0.5) continue;
    fctx.strokeStyle = 'rgba(255,210,120,' + (1 - age / 0.5).toFixed(3) + ')';
    fctx.lineWidth = 1.5;
    fctx.beginPath(); fctx.arc(SCREEN_X + 8, p.y, 3 + age * 26, 0, Math.PI * 2); fctx.stroke();
  }
  if (flashT >= 0) {
    const age = t - flashT;
    if (age < 0.18) {
      fctx.fillStyle = 'rgba(220,250,255,' + ((1 - age / 0.18) * 0.9).toFixed(3) + ')';
      fctx.beginPath(); fctx.arc(SRC.x, SRC.y, 7, 0, Math.PI * 2); fctx.fill();
    }
  }
}

function drawPanel() {
  pctx.clearRect(0, 0, PW, PH);
  pctx.fillStyle = '#7d8aa0'; pctx.font = '11px sans-serif';
  pctx.fillText('hits', 30, 14);
  pctx.fillText('histogram + theory (n=' + totalCount + ')', HIST_X0, 14);
  pctx.fillStyle = 'rgba(255,205,110,0.75)';
  for (const d of dots) pctx.fillRect(d.x, d.y * PH / H - 0.75, 1.5, 1.5);
  pctx.strokeStyle = '#1c2433';
  pctx.beginPath(); pctx.moveTo(84, 0); pctx.lineTo(84, PH); pctx.stroke();
  let maxBin = 1;
  for (let b = 0; b < NBINS; b++) maxBin = Math.max(maxBin, bins[b]);
  const bh = PH / NBINS, barMax = PW - HIST_X0 - 8;
  pctx.fillStyle = 'rgba(120,190,255,0.55)';
  for (let b = 0; b < NBINS; b++) {
    pctx.fillRect(HIST_X0, b * bh + 0.5, bins[b] / maxBin * barMax, bh - 1);
  }
  if (totalCount > 0 && cdf) {
    // expected counts per bin, same scale as the bars
    pctx.strokeStyle = 'rgba(255,160,80,0.9)'; pctx.lineWidth = 1.5;
    pctx.beginPath();
    for (let b = 0; b < NBINS; b++) {
      const yLo = Math.floor(b * H / NBINS), yHi = Math.min(H - 1, Math.floor((b + 1) * H / NBINS) - 1);
      const prob = cdf[yHi] - (yLo > 0 ? cdf[yLo - 1] : 0);
      const len = Math.min(barMax, totalCount * prob / maxBin * barMax);
      const py = (b + 0.5) * bh;
      if (b === 0) pctx.moveTo(HIST_X0 + len, py); else pctx.lineTo(HIST_X0 + len, py);
    }
    pctx.stroke();
  }
}
```

- [ ] **Step 2: Verify in browser**

Run: `open /Users/neoneye/git/vibe-coding-lab/2d-dual-slit-experiment/index.html`
Expected: source flashes, amber rings pop on the screen edge, dots accumulate in the panel in stripes matching the glow, histogram bars grow and hug the orange theory curve.

- [ ] **Step 3: Commit**

```bash
git add 2d-dual-slit-experiment/index.html
git commit -m "feat(dual-slit): particle detection, histogram, and theory overlay"
```

---

### Task 5: Controls, captions, clamps

**Files:**
- Modify: `2d-dual-slit-experiment/index.html` (replace `updateCaption`/`syncControls` stubs; append wiring code before `recompute()` call)

- [ ] **Step 1: Replace the two remaining stubs and add control wiring**

Delete `function updateCaption() {}` and `function syncControls() {}` and insert:

```js
// ---- captions & controls ----
const captions = {
  one: 'One slit open: the wave spreads out from the slit (diffraction) and particles pile up in a single broad band. Nothing to interfere with — no fringes.',
  two: 'Both slits open: each particle’s wave passes through BOTH slits at once. Where crest meets crest the wavelets reinforce (bright fringes); where crest meets trough they cancel (dark gaps). Each particle lands at ONE random spot — no trajectory is drawn because it has none — yet thousands of them trace out the wave’s interference pattern.',
  watched: 'Detector on: we now know which slit each particle used. That information destroys the superposition — the two wavelets’ relative phase is scrambled (watch the fringes jitter and wash out) — and the pattern collapses into two overlapping single-slit bands. Looking changes the outcome.'
};
function updateCaption() {
  document.getElementById('caption').textContent =
    state.slits === 1 ? captions.one : (state.detector ? captions.watched : captions.two);
}

const els = {};
['slits1', 'slits2', 'detector', 'lambda', 'sep', 'slitWidth', 'rate', 'clear', 'pause',
 'lambdaVal', 'sepVal', 'slitWidthVal', 'rateVal'].forEach(id => els[id] = document.getElementById(id));

function syncControls() {
  els.slits1.classList.toggle('active', state.slits === 1);
  els.slits2.classList.toggle('active', state.slits === 2);
  els.detector.disabled = state.slits === 1;
  els.detector.textContent = state.detector && state.slits === 2 ? 'on' : 'off';
  els.detector.classList.toggle('active', state.detector && state.slits === 2);
  els.lambda.value = state.lambda;     els.lambdaVal.textContent = state.lambda + ' px';
  els.sep.value = state.sep;           els.sepVal.textContent = state.sep + ' px';
  els.slitWidth.value = state.slitWidth; els.slitWidthVal.textContent = state.slitWidth + ' px';
  els.rate.value = state.rate;         els.rateVal.textContent = String(state.rate);
}

function clearDetections() {
  bins.fill(0); dots = []; pops = []; totalCount = 0; fireAcc = 0;
}

els.slits1.addEventListener('click', () => { state.slits = 1; clearDetections(); recompute(); });
els.slits2.addEventListener('click', () => { state.slits = 2; clearDetections(); recompute(); });
els.detector.addEventListener('click', () => { state.detector = !state.detector; clearDetections(); recompute(); });
els.lambda.addEventListener('input', () => { state.lambda = +els.lambda.value; clearDetections(); recompute(); });
els.sep.addEventListener('input', () => { state.sep = +els.sep.value; clearDetections(); recompute(); });
els.slitWidth.addEventListener('input', () => { state.slitWidth = +els.slitWidth.value; clearDetections(); recompute(); });
els.rate.addEventListener('input', () => { state.rate = +els.rate.value; syncControls(); });
els.clear.addEventListener('click', clearDetections);
els.pause.addEventListener('click', () => {
  state.paused = !state.paused;
  els.pause.textContent = state.paused ? 'resume' : 'pause';
  els.pause.classList.toggle('active', state.paused);
  last = performance.now();
});
```

Note: `clearDetections` references `bins`/`dots`/`pops` defined in the particles section (Task 4), so this block must come after it — both live inside `#app` before the final `recompute(); requestAnimationFrame(frame);` lines.

- [ ] **Step 2: Verify in browser** — every control:

1. 1 slit → single broad band, detector disabled, caption changes.
2. 2 slits → fringes return.
3. Detector on → ripples right of barrier jitter, fringes wash out, glow shows two lumps, eye icons appear, dots build two lumps.
4. Wavelength up → wider fringe spacing. Separation up → narrower spacing.
5. Rate 0 → waves only. Pause freezes. Clear empties panel.

- [ ] **Step 3: Run physics tests still pass**

Run: `cd 2d-dual-slit-experiment && node test.mjs`
Expected: `all physics tests passed`

- [ ] **Step 4: Commit**

```bash
git add 2d-dual-slit-experiment/index.html
git commit -m "feat(dual-slit): controls, which-path detector, adaptive captions"
```

---

### Task 6: Verification + screenshot

**Files:**
- Create: `2d-dual-slit-experiment/screenshot1.jpg`

- [ ] **Step 1: Run full test suite**

Run: `cd 2d-dual-slit-experiment && node test.mjs`
Expected: `all physics tests passed`

- [ ] **Step 2: Headless screenshot for visual check**

```bash
cd 2d-dual-slit-experiment
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --window-size=1040,760 --virtual-time-budget=4000 \
  --screenshot=shot.png "file://$PWD/index.html"
```

Inspect `shot.png` (Read tool). Check: visible fringes right of barrier, central bright band on screen glow, fringe count plausible for λ=16, d=90, L=420 (Δy ≈ 75 px → ~5 bright bands across 480 px). Adjust render gains (`tanh` multipliers, `srcNorm`, `2.2` incident amplitude) if the field is washed out or too dark, re-shoot until it reads clearly.

- [ ] **Step 3: Convert and keep the screenshot (lab convention)**

```bash
sips -s format jpeg -s formatOptions 85 shot.png --out screenshot1.jpg && rm shot.png
```

- [ ] **Step 4: Commit**

```bash
git add 2d-dual-slit-experiment/screenshot1.jpg
git commit -m "feat(dual-slit): screenshot"
```
