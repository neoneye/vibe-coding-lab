# Spinor Belt Trick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone page at `3d-spinor-belt-trick/index.html` where a cube attached to 6 striped belts spins 0–720° (scrubber + auto-spin); belts spiral at 360° and return exactly to their start shape at 720°.

**Architecture:** All math (quaternions + the belt-trick homotopy `H(u,t) = exp(πt·â(u))·exp(πt·ẑ)`) lives in a DOM-free `<script id="shared-code">` block, unit-tested via `test.mjs` (Node) and `?test=1` (browser). A `<script type="module">` block renders the scene with Three.js: cube + wireframe room + six ribbon meshes whose vertices are rebuilt each frame from the shared-code field.

**Tech Stack:** Three.js 0.170.0 via jsdelivr CDN importmap (same as `3d-shadows`), vanilla JS, no build step.

**Spec:** `docs/superpowers/specs/2026-07-16-spinor-belt-trick-design.md`

## Global Constraints

- Single self-contained `3d-spinor-belt-trick/index.html` plus `3d-spinor-belt-trick/test.mjs`; no other files except `screenshot1.jpg`.
- Three.js pinned to `three@0.170.0` on jsdelivr, loaded via importmap exactly as in `3d-shadows/index.html`.
- The `shared-code` block must never touch the DOM (it runs in Node).
- `renderer.setPixelRatio(window.devicePixelRatio)` — user is on a retina Mac; never render at CSS pixel size.
- Clamp per-frame `dt` to 0.1 s (tab-throttling protection).
- Quaternion convention: `{w, x, y, z}`, `qExp(θ, n̂) = cos θ + sin θ·n̂` represents a rotation by `2θ` about `n̂`.
- Belt parameter `u`: 0 at the cube face, 1 at the wall anchor. Animation phase `t ∈ [0,1]` = angle/720°.
- Commits go directly to `main`, message prefix `3d-spinor-belt-trick:`, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Run all commands from `/Users/neoneye/git/vibe-coding-lab`.

---

### Task 1: Scaffold + test harness

**Files:**
- Create: `3d-spinor-belt-trick/index.html`
- Create: `3d-spinor-belt-trick/test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `SpinorTests.add(name, fn)` / `SpinorTests.run()` registry, `assert(cond, msg)`, `assertNear(actual, expected, eps, msg)`; `node 3d-spinor-belt-trick/test.mjs` exits 0 on all-pass. The HTML skeleton with the control-bar markup (`#bar`, `#play`, `#angle`, `#angleVal`, `#speed`, `#hint`) that Task 4 wires up.

- [ ] **Step 1: Write test.mjs (the failing test — index.html doesn't exist yet)**

```js
// Runs the SpinorTests embedded in index.html's shared-code script block.
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
const ok = new Function(`${m[1]}; return SpinorTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node 3d-spinor-belt-trick/test.mjs`
Expected: FAIL — `Error: ENOENT ... index.html`

- [ ] **Step 3: Write the index.html skeleton**

Full initial contents of `3d-spinor-belt-trick/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Spinor — Dirac Belt Trick</title>
<style>
  * { margin: 0; padding: 0; }
  body { background: #0d0d16; overflow: hidden; font: 13px/1.5 monospace; }
  canvas { display: block; }
  #hint {
    position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
    color: #667; pointer-events: none; text-align: center;
  }
  #bar {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 12px;
    background: rgba(20, 18, 30, 0.85); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px; padding: 10px 16px; color: #ccc;
    backdrop-filter: blur(10px); user-select: none;
  }
  #bar button {
    background: none; border: 1px solid rgba(255,255,255,0.25); color: #eee;
    border-radius: 6px; padding: 4px 10px; font: inherit; cursor: pointer;
  }
  #angle { width: min(46vw, 520px); }
  #angleVal { min-width: 4ch; text-align: right; color: #fff; }
  #bar label { display: flex; align-items: center; gap: 6px; color: #889; }
  #speed { width: 90px; }
</style>
</head>
<body>

<div id="hint">drag to orbit · scroll to zoom · slider scrubs 0–720°</div>
<div id="bar">
  <button id="play" title="play / pause">❚❚</button>
  <input type="range" id="angle" min="0" max="720" step="0.1" value="0">
  <span id="angleVal">0°</span>
  <label>speed <input type="range" id="speed" min="20" max="400" step="10" value="120"></label>
</div>

<script id="shared-code">
"use strict";
// Quaternion math + the Dirac belt-trick homotopy. This block must not touch
// the DOM: it also runs in Node via test.mjs and via index.html?test=1.

// ---------------------------------------------------------------------------
// Test registry. Runs via `node test.mjs` or by opening index.html?test=1
// ---------------------------------------------------------------------------
const SpinorTests = {
  tests: [],
  add(name, fn) { this.tests.push({ name, fn }); },
  run(log = console.log, error = console.error) {
    let failures = 0;
    for (const { name, fn } of this.tests) {
      try { fn(); log(`ok - ${name}`); }
      catch (e) { failures++; error(`FAIL - ${name}: ${e.message}`); }
    }
    log(`${this.tests.length - failures}/${this.tests.length} passed`);
    return failures === 0;
  },
};
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function assertNear(actual, expected, eps, msg) {
  if (!(Math.abs(actual - expected) <= eps)) {
    throw new Error(`${msg || "assertNear"}: ${actual} !== ${expected} (eps ${eps})`);
  }
}

SpinorTests.add("smoke", () => assertNear(1 + 1, 2, 0));
</script>

<script>
// Browser test runner: open index.html?test=1 to see results on the page.
if (new URLSearchParams(location.search).get("test") === "1") {
  const lines = [];
  const ok = SpinorTests.run(m => lines.push(m), m => lines.push(m));
  addEventListener("DOMContentLoaded", () => {
    const pre = document.createElement("pre");
    pre.style.cssText = "position:fixed;top:40px;left:8px;z-index:99;padding:8px;" +
      "background:rgba(0,0,0,.85);font:12px monospace;color:" + (ok ? "#8f8" : "#f88");
    pre.textContent = lines.join("\n");
    document.body.appendChild(pre);
  });
}
</script>

</body>
</html>
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node 3d-spinor-belt-trick/test.mjs`
Expected: `ok - smoke` / `1/1 passed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 3d-spinor-belt-trick
git commit -m "3d-spinor-belt-trick: scaffold with shared-code test harness

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Quaternion helpers

**Files:**
- Modify: `3d-spinor-belt-trick/index.html` (shared-code block only)

**Interfaces:**
- Consumes: `SpinorTests`, `assert`, `assertNear` from Task 1.
- Produces (all pure, in shared-code):
  - `QID` — frozen identity quaternion `{w:1, x:0, y:0, z:0}`.
  - `qMul(a, b)` — Hamilton product, returns `{w,x,y,z}`.
  - `qExp(theta, nx, ny, nz)` — `cos θ + sin θ·n̂` (unit axis required); a rotation by `2θ`.
  - `qRotateVec(q, v)` — rotates array `[x,y,z]` by unit quaternion `q`, returns `[x,y,z]`.
  - `qRotationDistance(a, b)` — rotation-angle distance in radians (sign-folded, range `[0, π]`).

- [ ] **Step 1: Write the failing tests** — append to the end of the shared-code block:

```js
// ---------------------------------------------------------------------------
// Quaternions: {w, x, y, z}. qExp(θ, n̂) = cos θ + sin θ·n̂ = rotation by 2θ.
// ---------------------------------------------------------------------------

SpinorTests.add("qMul: i*j = k", () => {
  const k = qMul({ w: 0, x: 1, y: 0, z: 0 }, { w: 0, x: 0, y: 1, z: 0 });
  assertNear(k.w, 0, 1e-12); assertNear(k.x, 0, 1e-12);
  assertNear(k.y, 0, 1e-12); assertNear(k.z, 1, 1e-12);
});

SpinorTests.add("qExp(π/4, ẑ) rotates x̂ to ŷ (90° about z)", () => {
  const v = qRotateVec(qExp(Math.PI / 4, 0, 0, 1), [1, 0, 0]);
  assertNear(v[0], 0, 1e-12); assertNear(v[1], 1, 1e-12); assertNear(v[2], 0, 1e-12);
});

SpinorTests.add("qRotationDistance folds sign: dist(q, -q) = 0", () => {
  const q = qExp(0.7, 0, 1, 0);
  const nq = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
  assertNear(qRotationDistance(q, nq), 0, 1e-9);
  assertNear(qRotationDistance(QID, qExp(Math.PI / 4, 1, 0, 0)), Math.PI / 2, 1e-9);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node 3d-spinor-belt-trick/test.mjs`
Expected: 3 FAIL lines (`qMul is not defined` etc.), exit 1.

- [ ] **Step 3: Write the implementation** — insert directly under the `// Quaternions` banner comment, above the new tests:

```js
const QID = Object.freeze({ w: 1, x: 0, y: 0, z: 0 });

function qMul(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

function qExp(theta, nx, ny, nz) {
  const s = Math.sin(theta);
  return { w: Math.cos(theta), x: s * nx, y: s * ny, z: s * nz };
}

function qRotateVec(q, v) {
  // v' = q · (0, v) · q̄   (q must be unit)
  const p = qMul(qMul(q, { w: 0, x: v[0], y: v[1], z: v[2] }),
                 { w: q.w, x: -q.x, y: -q.y, z: -q.z });
  return [p.x, p.y, p.z];
}

function qRotationDistance(a, b) {
  const dot = Math.abs(a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z);
  return 2 * Math.acos(Math.min(1, dot));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node 3d-spinor-belt-trick/test.mjs`
Expected: `4/4 passed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 3d-spinor-belt-trick/index.html
git commit -m "3d-spinor-belt-trick: quaternion helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Belt-trick homotopy

**Files:**
- Modify: `3d-spinor-belt-trick/index.html` (shared-code block only)

**Interfaces:**
- Consumes: `qMul`, `qExp`, `qRotateVec`, `qRotationDistance`, `QID` from Task 2.
- Produces (all pure, in shared-code):
  - `beltQuat(u, t)` — the field `H(u,t)`; `u ∈ [0,1]` (0 = cube face, 1 = wall), `t ∈ [0,1]` (angle/720°). Returns `{w,x,y,z}`.
  - `cubeQuat(t)` — cube orientation, `= beltQuat(0, t)`.
  - `beltPoint(u, t, face, wall)` — position `[x,y,z]` of the belt point at `u`; `face`/`wall` are `[x,y,z]` rest endpoints.

- [ ] **Step 1: Write the failing tests** — append to the end of the shared-code block:

```js
// ---------------------------------------------------------------------------
// Belt-trick homotopy:  H(u,t) = exp(πt·â(u)) · exp(πt·ẑ),
// â(u) = (sin πu, 0, cos πu).
//   u=0 (cube):  H = exp(2πt·ẑ)  → cube rotates 4πt = 720°·t about z.
//   u=1 (wall):  H = exp(−πt·ẑ)·exp(πt·ẑ) = 1  → anchors never move.
//   t=0, t=1:    H = 1 everywhere → belts return exactly after 720°.
// ---------------------------------------------------------------------------

SpinorTests.add("cube end: H(0,t) = rotation by 4πt about z", () => {
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const d = qRotationDistance(beltQuat(0, t), qExp(2 * Math.PI * t, 0, 0, 1));
    assertNear(d, 0, 1e-9, `t=${t}`);
  }
});

SpinorTests.add("wall end never moves: H(1,t) = identity", () => {
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    assertNear(qRotationDistance(beltQuat(1, t), QID), 0, 1e-6, `t=${t}`);
  }
});

SpinorTests.add("belts return after 720°: H(u,0) = H(u,1) = identity", () => {
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    assertNear(qRotationDistance(beltQuat(u, 0), QID), 0, 1e-9, `u=${u} t=0`);
    assertNear(qRotationDistance(beltQuat(u, 1), QID), 0, 1e-6, `u=${u} t=1`);
  }
});

SpinorTests.add("belts are genuinely twisted at 360°", () => {
  assert(qRotationDistance(beltQuat(0.5, 0.5), QID) > 1.0,
    "belt midpoint should be far from identity at t=0.5");
});

SpinorTests.add("field is continuous in u and t", () => {
  const N = 64;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j < N; j++) {
      const u = i / N, t = j / N;
      const q = beltQuat(u, t);
      assert(qRotationDistance(q, beltQuat(Math.min(1, u + 1 / N), t)) < 0.35,
        `u-step too large at u=${u} t=${t}`);
      assert(qRotationDistance(q, beltQuat(u, t + 1 / N)) < 0.35,
        `t-step too large at u=${u} t=${t}`);
    }
  }
});

SpinorTests.add("belt endpoints: cube end tracks cube, wall end fixed", () => {
  const face = [0.51, 0, 0], wall = [2.96, 0, 0];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const cubeEnd = beltPoint(0, t, face, wall);
    const expected = qRotateVec(cubeQuat(t), face);
    for (let k = 0; k < 3; k++) assertNear(cubeEnd[k], expected[k], 1e-9, `cube end t=${t}`);
    const wallEnd = beltPoint(1, t, face, wall);
    for (let k = 0; k < 3; k++) assertNear(wallEnd[k], wall[k], 1e-6, `wall end t=${t}`);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node 3d-spinor-belt-trick/test.mjs`
Expected: the 6 new tests FAIL (`beltQuat is not defined`), exit 1.

- [ ] **Step 3: Write the implementation** — insert directly under the `// Belt-trick homotopy` banner comment, above the new tests:

```js
function beltQuat(u, t) {
  const swing = qExp(Math.PI * t, Math.sin(Math.PI * u), 0, Math.cos(Math.PI * u));
  const spin = qExp(Math.PI * t, 0, 0, 1);
  return qMul(swing, spin);
}

function cubeQuat(t) { return beltQuat(0, t); }

function beltPoint(u, t, face, wall) {
  const rest = [
    face[0] + (wall[0] - face[0]) * u,
    face[1] + (wall[1] - face[1]) * u,
    face[2] + (wall[2] - face[2]) * u,
  ];
  return qRotateVec(beltQuat(u, t), rest);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node 3d-spinor-belt-trick/test.mjs`
Expected: `10/10 passed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 3d-spinor-belt-trick/index.html
git commit -m "3d-spinor-belt-trick: belt-trick homotopy H(u,t) with property tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Three.js scene, animation loop, controls

**Files:**
- Modify: `3d-spinor-belt-trick/index.html`

**Interfaces:**
- Consumes: `cubeQuat(t)` from shared-code (plain script scope, visible to the module script); `#bar` control markup from Task 1.
- Produces: importmap + module script with `scene`, `camera`, `renderer`, `controls`, `cube`, constants `ROOM = 6`, `CUBE = 1`; `renderFrame()`; global animation state (`angleDeg`, `playing`); `?angle=NNN` param (start paused at that angle); synchronous first paint. Task 5 will add belt meshes and extend `renderFrame()`.

- [ ] **Step 1: Add the importmap and module script** — insert before `</body>`, after the test-runner script:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }
}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ROOM = 6;   // room (wall-to-wall) size
const CUBE = 1;   // cube edge length

// --- Renderer / scene / camera ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d16);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(4.2, 3.0, 6.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxDistance = 14;

// --- Lights ---
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(4, 6, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0x8899ff, 0.5);
fill.position.set(-5, -2, -4);
scene.add(fill);

// --- Room: wireframe box + anchor plates on each wall ---
scene.add(new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM, ROOM, ROOM)),
  new THREE.LineBasicMaterial({ color: 0x333a55 })
));

const DIRS = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
const plateMat = new THREE.MeshLambertMaterial({ color: 0x232838 });
for (const d of DIRS) {
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), plateMat);
  plate.scale.set(d[0] ? 0.06 : 0.6, d[1] ? 0.06 : 0.6, d[2] ? 0.06 : 0.6);
  plate.position.set(d[0] * ROOM / 2, d[1] * ROOM / 2, d[2] * ROOM / 2);
  scene.add(plate);
}

// --- Cube (BoxGeometry material order: +x, −x, +y, −y, +z, −z) ---
const FACE_COLORS = [0xe74c3c, 0x27ae60, 0x3498db, 0xf1c40f, 0xe67e22, 0x9b59b6];
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(CUBE, CUBE, CUBE),
  FACE_COLORS.map(c => new THREE.MeshLambertMaterial({ color: c }))
);
scene.add(cube);

// --- Controls / animation state ---
const angleSlider = document.getElementById("angle");
const angleVal = document.getElementById("angleVal");
const speedSlider = document.getElementById("speed");
const playBtn = document.getElementById("play");

let angleDeg = 0;
let playing = true;

function setPlaying(p) {
  playing = p;
  playBtn.textContent = p ? "❚❚" : "▶";
}

playBtn.addEventListener("click", () => setPlaying(!playing));
angleSlider.addEventListener("input", () => {
  setPlaying(false);          // scrubbing takes over from auto-spin
  angleDeg = parseFloat(angleSlider.value);
  renderFrame();
});

// ?angle=360 → start paused at that angle (also used for headless screenshots)
const params = new URLSearchParams(location.search);
if (params.has("angle")) {
  angleDeg = Math.max(0, Math.min(720, parseFloat(params.get("angle")) || 0));
  setPlaying(false);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Render ---
function renderFrame() {
  const t = angleDeg / 720;
  const q = cubeQuat(t);
  cube.quaternion.set(q.x, q.y, q.z, q.w);
  angleSlider.value = angleDeg;
  angleVal.textContent = `${Math.round(angleDeg)}°`;
  controls.update();
  renderer.render(scene, camera);
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);   // clamp after tab throttling
  lastTime = now;
  if (playing) angleDeg = (angleDeg + parseFloat(speedSlider.value) * dt) % 720;
  renderFrame();
  requestAnimationFrame(loop);
}

renderFrame();                 // synchronous first paint (headless screenshots)
requestAnimationFrame(loop);
</script>
```

- [ ] **Step 2: Verify the math tests still pass**

Run: `node 3d-spinor-belt-trick/test.mjs`
Expected: `10/10 passed`.

- [ ] **Step 3: Verify in the browser**

Run: `open 3d-spinor-belt-trick/index.html`
Expected: colored cube spinning twice per cycle inside a wireframe room with 6 wall plates; slider scrubs and pauses; play button resumes; orbit + zoom work. Also check `open "file:///Users/neoneye/git/vibe-coding-lab/3d-spinor-belt-trick/index.html?test=1"` shows `10/10 passed` in green.

- [ ] **Step 4: Commit**

```bash
git add 3d-spinor-belt-trick/index.html
git commit -m "3d-spinor-belt-trick: Three.js scene, spin loop, scrubber controls

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Belt ribbons

**Files:**
- Modify: `3d-spinor-belt-trick/index.html` (module script)

**Interfaces:**
- Consumes: `beltQuat(u, t)`, `beltPoint(u, t, face, wall)` from shared-code; `scene`, `DIRS`, `ROOM`, `CUBE`, `renderFrame()` from Task 4.
- Produces: `belts` array and `updateBelts(t)`, called from `renderFrame()`.

- [ ] **Step 1: Add belt construction** — insert into the module script after the cube block, before `// --- Controls / animation state ---`:

```js
// --- Belts: one ribbon per cube face, from face center to wall anchor ---
const SEG = 64;            // samples along each belt
const HALF_W = 0.14;       // ribbon half-width

function makeStripeTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 8;
  const g = c.getContext("2d");
  g.fillStyle = "#d97b29";           // belt front body
  g.fillRect(0, 0, 64, 8);
  g.fillStyle = "#f5e9d0";           // center stripe
  g.fillRect(24, 0, 16, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const frontMat = new THREE.MeshLambertMaterial({ map: makeStripeTexture(), side: THREE.FrontSide });
const backMat = new THREE.MeshLambertMaterial({ color: 0x30507a, side: THREE.BackSide });

// Ribbon width direction at rest, one per entry in DIRS (must be ⊥ to it).
const WIDTH_DIRS = [[0,1,0], [0,1,0], [1,0,0], [1,0,0], [1,0,0], [1,0,0]];

const belts = DIRS.map((d, di) => {
  const face = d.map(c => c * (CUBE / 2 + 0.01));
  const wall = d.map(c => c * (ROOM / 2 - 0.04));
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((SEG + 1) * 2 * 3);
  const uvs = new Float32Array((SEG + 1) * 2 * 2);
  const indices = [];
  for (let i = 0; i <= SEG; i++) {
    uvs[(i * 2) * 2] = 0;     uvs[(i * 2) * 2 + 1] = i / SEG;
    uvs[(i * 2 + 1) * 2] = 1; uvs[(i * 2 + 1) * 2 + 1] = i / SEG;
    if (i < SEG) {
      const a = i * 2, b = i * 2 + 1, c2 = i * 2 + 2, e = i * 2 + 3;
      indices.push(a, b, c2, b, e, c2);
    }
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  scene.add(new THREE.Mesh(geometry, frontMat));
  scene.add(new THREE.Mesh(geometry, backMat));
  return { face, wall, w0: WIDTH_DIRS[di], geometry };
});

function updateBelts(t) {
  for (const belt of belts) {
    const pos = belt.geometry.attributes.position.array;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const center = beltPoint(u, t, belt.face, belt.wall);
      const wv = qRotateVec(beltQuat(u, t), belt.w0);
      pos[i * 6 + 0] = center[0] - wv[0] * HALF_W;
      pos[i * 6 + 1] = center[1] - wv[1] * HALF_W;
      pos[i * 6 + 2] = center[2] - wv[2] * HALF_W;
      pos[i * 6 + 3] = center[0] + wv[0] * HALF_W;
      pos[i * 6 + 4] = center[1] + wv[1] * HALF_W;
      pos[i * 6 + 5] = center[2] + wv[2] * HALF_W;
    }
    belt.geometry.attributes.position.needsUpdate = true;
    belt.geometry.computeVertexNormals();
    belt.geometry.computeBoundingSphere();
  }
}
```

- [ ] **Step 2: Call it from renderFrame** — in `renderFrame()`, insert after `cube.quaternion.set(q.x, q.y, q.z, q.w);`:

```js
  updateBelts(t);
```

- [ ] **Step 3: Verify tests still pass, then verify in the browser**

Run: `node 3d-spinor-belt-trick/test.mjs`
Expected: `10/10 passed`.

Run: `open 3d-spinor-belt-trick/index.html`
Expected: six striped ribbons attached cube-face → wall plate. At 0° all straight; auto-spin swings them around the cube smoothly with no pop; scrub to 360° → visibly spiraled; scrub to 720° → straight again, identical to 0°. Orbit around to check back faces are the contrasting blue.

- [ ] **Step 4: Commit**

```bash
git add 3d-spinor-belt-trick/index.html
git commit -m "3d-spinor-belt-trick: striped ribbon belts driven by the homotopy field

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Screenshot, gallery, final verification

**Files:**
- Create: `3d-spinor-belt-trick/screenshot1.jpg`
- Modify: `index.html` (repo root, regenerated by `build_gallery.py`)

**Interfaces:**
- Consumes: `?angle=NNN` param from Task 4 (paused, synchronous first paint).
- Produces: gallery entry (auto-title "3D Spinor Belt Trick" — no `gallery.yaml` override needed).

- [ ] **Step 1: Full test suite passes**

Run: `node 3d-spinor-belt-trick/test.mjs`
Expected: `10/10 passed`, exit 0.

- [ ] **Step 2: Headless screenshots at the three key angles**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE="file:///Users/neoneye/git/vibe-coding-lab/3d-spinor-belt-trick/index.html"
SCRATCH="/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/e4c6d9c5-f109-42bd-8032-0cadfd6eed34/scratchpad"
for a in 0 360 720; do
  "$CHROME" --headless=new --use-angle=swiftshader --window-size=1200,800 \
    --virtual-time-budget=5000 --screenshot="$SCRATCH/spinor-$a.png" "$BASE?angle=$a"
done
```

Read the three PNGs and check: belts straight at 0°, spiraled at 360°, straight again at 720° (0° and 720° should look identical). If WebGL fails to initialize headless, retry without `--use-angle=swiftshader`.

- [ ] **Step 3: Gallery screenshot + rebuild**

Use the most interesting frame (360°, belts spiraled) as the thumbnail:

```bash
"$CHROME" --headless=new --use-angle=swiftshader --window-size=1000,750 \
  --virtual-time-budget=5000 --screenshot="$SCRATCH/spinor-thumb.png" "$BASE?angle=360"
sips -s format jpeg -s formatOptions 85 "$SCRATCH/spinor-thumb.png" \
  --out 3d-spinor-belt-trick/screenshot1.jpg
python3 build_gallery.py
```

Expected: `build_gallery.py` reports the new project; root `index.html` diff contains a "3D Spinor Belt Trick" card.

- [ ] **Step 4: Commit**

```bash
git add 3d-spinor-belt-trick/screenshot1.jpg index.html
git commit -m "3d-spinor-belt-trick: gallery entry with screenshot

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
