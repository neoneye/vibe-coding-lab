# 2D City Generator (gfx_city port) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faithful port of the C++ `gfx_city` brick (Substrate-style street growth) to `2d-city-generator/index.html` with animated growth.

**Architecture:** `CityEngine` in shared-code mirrors the brick stage by stage (uint-grid with the negative-direction wrap quirk via `Uint32Array`, incrementing-seed PRNG, perpendicular branch-on-collision); the UI runs `step(speed)` per frame into a 640×640 ImageData with the big-canvas layout from `2d-ifs-fractals`.

**Tech Stack:** Vanilla JS, Canvas 2D, Node ≥18. Transcription source: `/Users/neoneye/git/opcoders_toolbox/CONTENT/TBEngine/brick_lib/gfx_city.cpp` (439 lines, fully read).

**Spec:** `docs/superpowers/specs/2026-06-12-city-generator-design.md`

---

### Task 1: Scaffold + PRNG

**Files:**
- Create: `2d-city-generator/test.mjs`
- Create: `2d-city-generator/index.html`

- [ ] **Step 1: Test runner** — standard extractor running `CityTests.run()` (same file as the siblings with `IfsTests` → `CityTests`). Run → FAIL (ENOENT).

- [ ] **Step 2: Skeleton** — standard skeleton (placeholder body; styles in Task 4) with shared-code containing `mulberry32` is NOT needed here (the engine is fully seed-hash driven); include only:

```js
"use strict";

// Bit-faithful port of the C++ random1 (Perlin-style integer hash) —
// identical to gfx_chaos's random_1d; pins below match the IFS port.
function random1(x) {
  let s = Math.imul(71, x);
  s = (Math.imul(s, 8192) ^ s) | 0;
  const t = (Math.imul(s, (Math.imul(Math.imul(s, s), 15731) | 0) + 789221) + 1376312589) & 0x7fffffff;
  return 1.0 - t / 1073741824.0;
}

function remap(v, fromMin, fromMax, toMin, toMax) {
  return toMin + ((v - fromMin) / (fromMax - fromMin)) * (toMax - toMin);
}

// Positive modulo (the C++ modulo() helper).
function mod(v, m) {
  const r = v % m;
  return r < 0 ? r + m : r;
}
```

And `CityTests` with:

```js
    // --- PRNG ---
    {
      check("random1: pinned values",
        Math.abs(random1(1) - -0.31882712710648775) < 1e-12 &&
        Math.abs(random1(7) - 0.16649853717535734) < 1e-12 &&
        Math.abs(random1(100) - 0.7281943624839187) < 1e-12);
      check("mod: positive modulo", mod(-3, 64) === 61 && mod(67, 64) === 3);
    }
```

- [ ] **Step 3: Run → PASS, commit** `"city-generator: scaffold with test runner and PRNG"`.

---

### Task 2: Engine — construction, start(), seeding

**Files:**
- Modify: `2d-city-generator/index.html` (shared-code)

- [ ] **Step 1: Failing tests**

```js
    // --- Engine: start() remaps and seeding ---
    if (typeof CityEngine !== "undefined") {
      const PARAMS = { crackSeed: 0, rotation: 0, density: 25, crackCount: 5,
        swarmCount: 25, iterations: 25, iterationSeed: 0, tileMode: true, noise: 0 };
      {
        const e = new CityEngine({ width: 640, height: 640 });
        e.start(PARAMS);
        check("start: density 25 -> 36 cracks @640", e.numberOfCracks === 36);
        check("start: iterations 25 -> 4306", e.iterationsTotal === 4306);
        check("start: crack cells seeded", e.crackCellCount() > 0 && e.crackCellCount() <= 36);
        check("start: initial agents", e.count === 5);
      }
      {
        const e = new CityEngine({ width: 640, height: 640 });
        e.start(Object.assign({}, PARAMS, { iterations: 0, noise: 50 }));
        check("start: iterations 0 -> 0 total", e.iterationsTotal === 0);
        check("start: noise 50 -> 1.0", e.iterationNoise === 1);
      }
      {
        const a = new CityEngine({ width: 128, height: 128 });
        const b = new CityEngine({ width: 128, height: 128 });
        a.start(PARAMS); b.start(PARAMS);
        let same = a.crackCellCount() === b.crackCellCount();
        for (let i = 0; i < a.grid.length && same; i++) if (a.grid[i] !== b.grid[i]) same = false;
        check("start: seeding deterministic", same);
      }
    } else {
      check("CityEngine: implemented", false);
    }
```

Run → FAIL.

- [ ] **Step 2: Implement**

```js
// Faithful port of the gfx_city brick. Grid: Uint32Array, 10001 = empty,
// < 360 = crack direction at that cell. The Uint32Array reproduces the C++
// uint quirk: a negative direction stored via (int) cast wraps to a huge
// value and reads back as "empty".
class CityEngine {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;
    this.grid = new Uint32Array(width * height);
    this.pixels = new Uint8Array(width * height);
    this.agents = [];
    this.count = 0;            // m_agent_count: live agent slots
    this.currentSeed = 0;
    this.iterationSeed = 0;
    this.iterationsDone = 0;
    this.iterationsTotal = 0;
    this.tileMode = true;
    this.iterationNoise = 0;
    this.numberOfCracks = 0;
  }

  rand1() { return random1(this.currentSeed++); }
  rand2() { return (this.rand1() + 1) * 0.5; }

  start(raw) {
    const W = this.width, H = this.height;
    const crackSeed = raw.crackSeed * 1000 + 9298;
    this.iterationSeed = raw.iterationSeed * 10000 + 234234;
    this.tileMode = !!raw.tileMode;
    this.iterationNoise = remap(raw.noise, 0, 100, 0, 2);
    const initialCrackCount = Math.max(raw.crackCount, 1);
    const capacity = Math.max(raw.swarmCount, 3);

    {
      const v = Math.exp(remap(raw.density, 0, 100, 0, 4) * Math.log(8));
      this.numberOfCracks = Math.floor((W * H * v) / (400 * 400)) + 16;
    }
    {
      const v = remap(raw.iterations, 0, 100, 1, 5);
      this.iterationsTotal = v > 0.05 ? Math.floor((10000 * Math.log(v)) / Math.log(5)) : 0;
    }

    this.pixels.fill(0);
    this.grid.fill(10001);
    this.agents = [];
    for (let i = 0; i < capacity; i++) this.agents.push({ used: false, x: 0, y: 0, angle: 0 });
    this.count = 0;

    for (let i = 0; i < this.numberOfCracks; i++) {
      this.currentSeed = (crackSeed + i) * 10 + 34;
      const rx = Math.trunc(this.rand2() * (W - 0.9));
      const ry = Math.trunc(this.rand2() * (H - 0.9));
      const x = mod(rx, W), y = mod(ry, H);
      let dir = Math.trunc(this.rand2() * 359.1);
      dir += raw.rotation;
      this.grid[y * W + x] = mod(dir, 360);
      if (i < initialCrackCount && this.count < capacity) {
        // C++ passes dir BEFORE the modulo to the agent
        const a = this.agents[this.count];
        a.used = true; a.x = x; a.y = y; a.angle = dir;
        this.count++;
      }
    }

    this.currentSeed = this.iterationSeed;
    this.iterationsDone = 0;
  }

  crackCellCount() {
    let n = 0;
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] < 360) n++;
    return n;
  }

  streetPixelCount() {
    let n = 0;
    for (let i = 0; i < this.pixels.length; i++) n += this.pixels[i];
    return n;
  }
}
```

- [ ] **Step 3: Run → PASS, commit** `"city-generator: engine start with faithful parameter remaps and crack seeding"`.

---

### Task 3: Engine — agent movement, branching, stepping

**Files:**
- Modify: `2d-city-generator/index.html` (shared-code)

- [ ] **Step 1: Failing tests**

```js
    // --- Engine: movement, branching, collision ---
    if (typeof CityEngine !== "undefined" && CityEngine.prototype.step) {
      const PARAMS = { crackSeed: 0, rotation: 0, density: 25, crackCount: 5,
        swarmCount: 25, iterations: 25, iterationSeed: 0, tileMode: true, noise: 0 };
      // Perpendicular branching: restart off a single known crack.
      {
        const e = new CityEngine({ width: 64, height: 64 });
        e.start(Object.assign({}, PARAMS, { density: 0, crackCount: 1, iterations: 50 }));
        e.grid.fill(10001);
        for (let x = 0; x < 64; x++) e.grid[32 * 64 + x] = 0;   // crack row, direction 0 (probe can't miss)
        e.currentSeed = 5;
        const agent = e.agents[0];
        e.restartAgent(agent);
        const d = mod(Math.round(Math.abs(agent.angle)), 360);
        const diff = Math.min(d, 360 - d);
        check("branch: perpendicular 90±2 (" + agent.angle.toFixed(1) + ")",
          agent.used && diff >= 88 && diff <= 92);
      }
      // Collision with a differently-angled crack stops and spawns.
      {
        const e = new CityEngine({ width: 64, height: 64 });
        e.start(Object.assign({}, PARAMS, { tileMode: false, crackCount: 1 }));
        e.grid.fill(10001);
        for (let y = 0; y < 64; y++) e.grid[y * 64 + 40] = 90;   // vertical crack line
        e.count = 1;
        const a = e.agents[0];
        a.used = true; a.x = 35.5; a.y = 32; a.angle = 0;
        e.currentSeed = 7;
        const before = e.count;
        for (let i = 0; i < 20; i++) e.moveAgent(e.agents[0], 0);
        check("collision: agent restarted and swarm grew", e.count === before + 1);
      }
      // Tile wrap: pixel plots on the opposite edge.
      {
        const e = new CityEngine({ width: 64, height: 64 });
        e.start(Object.assign({}, PARAMS, { crackCount: 1 }));
        e.grid.fill(10001);
        e.count = 1;
        const a = e.agents[0];
        a.used = true; a.x = 63.5; a.y = 32; a.angle = 0;
        e.currentSeed = 9;
        for (let i = 0; i < 3; i++) e.moveAgent(e.agents[0], 0);
        check("tile: wrapped pixel at left edge", e.pixels[32 * 64 + 0] === 1);
      }
      // Non-tile: leaving the canvas restarts the agent.
      {
        const e = new CityEngine({ width: 64, height: 64 });
        e.start(Object.assign({}, PARAMS, { tileMode: false, crackCount: 1 }));
        e.grid.fill(10001);
        e.grid[10 * 64 + 10] = 45;    // give the probe something to find
        e.count = 1;
        const a = e.agents[0];
        a.used = true; a.x = 63.5; a.y = 32; a.angle = 0;
        e.currentSeed = 11;
        for (let i = 0; i < 5; i++) e.moveAgent(e.agents[0], 0);
        check("bounds: agent no longer cruising straight out",
          !(e.agents[0].used && e.agents[0].angle === 0));
      }
      // Full determinism + progressive equivalence.
      {
        const mk = () => { const e = new CityEngine({ width: 128, height: 128 }); e.start(PARAMS); return e; };
        const a = mk(); a.finish();
        const b = mk(); while (b.iterationsDone < b.iterationsTotal) b.step(137);
        let same = a.streetPixelCount() === b.streetPixelCount() && a.streetPixelCount() > 0;
        for (let i = 0; i < a.pixels.length && same; i++) if (a.pixels[i] !== b.pixels[i]) same = false;
        check("run: deterministic, progressive == finish (" + a.streetPixelCount() + " px)", same);
      }
    } else {
      check("step: implemented", false);
    }
```

Run → FAIL.

- [ ] **Step 2: Implement** — add to `CityEngine`:

```js
  _advance(agent, len) {
    if (!agent.used) return;
    const rads = (agent.angle * Math.PI) / 180;
    agent.x += len * Math.cos(rads);
    agent.y += len * Math.sin(rads);
  }

  moveAgent(agent, agentIndex) {
    const W = this.width, H = this.height;
    if (!agent.used) { this.restartAgent(agent); return; }
    this._advance(agent, 0.42);

    // first agents wobble most (tiers from the C++)
    let randAmount;
    if (agentIndex < 2) randAmount = 5;
    else if (agentIndex < 4) randAmount = 4;
    else if (agentIndex < 8) randAmount = 3;
    else if (agentIndex < 16) randAmount = 2;
    else randAmount = 1;
    randAmount *= this.iterationNoise;
    agent.angle = (agent.angle + this.rand1() * randAmount) % 360;

    const x = agent.x, y = agent.y, dir = agent.angle;
    const z = 0.33;
    let cx = Math.trunc(x + this.rand1() * z);
    let cy = Math.trunc(y + this.rand1() * z);
    if (this.tileMode) { cx = mod(cx, W); cy = mod(cy, H); }

    if (cx < 0 || cx >= W || cy < 0 || cy >= H) {
      this.restartAgent(agent);
      this.insertAgent();
    } else {
      const gdir = this.grid[cy * W + cx];
      if (gdir > 10000 || Math.abs(gdir - dir) < 5) {
        this.grid[cy * W + cx] = Math.trunc(dir);   // Uint32Array wraps negatives, as the C++ uint did
      } else if (Math.abs(gdir - dir) > 2) {
        this.restartAgent(agent);
        this.insertAgent();
      }
    }

    if (this.tileMode) {
      agent.x = agent.x % W;   // fmod semantics: may stay negative, as in C++
      agent.y = agent.y % H;
    }

    let dx = Math.trunc(x), dy = Math.trunc(y);
    if (this.tileMode) { dx = mod(dx, W); dy = mod(dy, H); }
    if (dx >= 0 && dx < W && dy >= 0 && dy < H) this.pixels[dy * W + dx] = 1;
  }

  insertAgent() {
    if (this.count >= this.agents.length) return;
    this.restartAgent(this.agents[this.count]);
    this.count++;
  }

  restartAgent(agent) {
    const found = this.findStartPoint();
    if (!found) { agent.used = false; agent.x = 0; agent.y = 0; agent.angle = 0; return; }
    this.initAgent(agent, found.x, found.y, found.dir);
  }

  initAgent(agent, x, y, dir) {
    const adj = 90 + this.rand1() * 2;
    dir += this.rand1() < 0 ? adj : -adj;
    dir = dir % 360;
    agent.used = true; agent.x = x; agent.y = y; agent.angle = dir;
    this._advance(agent, 0.61);
  }

  // probe up to 1000 random cells for an existing crack
  findStartPoint() {
    const W = this.width, H = this.height;
    for (let i = 0; i < 1000; i++) {
      const rx = Math.trunc(this.rand2() * (W - 0.9));
      const ry = Math.trunc(this.rand2() * (H - 0.9));
      const x = mod(rx, W), y = mod(ry, H);
      const dir = this.grid[y * W + x];
      if (dir >= 360) continue;
      return { x, y, dir };
    }
    return null;
  }

  step(n) {
    for (let i = 0; i < n && this.iterationsDone < this.iterationsTotal; i++) {
      for (let j = 0; j < this.count; j++) this.moveAgent(this.agents[j], j);
      this.iterationsDone++;
    }
  }

  finish() {
    this.step(this.iterationsTotal - this.iterationsDone);
  }

  usedAgentCount() {
    let n = 0;
    for (let j = 0; j < this.count; j++) if (this.agents[j].used) n++;
    return n;
  }
```

- [ ] **Step 3: Run → PASS, commit** `"city-generator: agent movement, perpendicular branching, collision spawning"`.

---

### Task 4: UI

**Files:**
- Modify: `2d-city-generator/index.html` (style, body, UI script)

- [ ] **Step 1: Styles** — copy the `2d-ifs-fractals` stylesheet (post-layout-update version: `.canvas-wrap`, scrollable `.controls`, `button.tool` rule not needed). Add nothing else.

- [ ] **Step 2: Body**

```html
<h1>2D City Generator</h1>
<p class="subtitle">Streets grow like cracks: agents crawl, collide, and branch at right angles into a city plan. Substrate-inspired.</p>
<div class="layout">
  <div class="panel canvas-wrap">
    <canvas id="display-canvas" width="640" height="640"></canvas>
  </div>
  <div class="controls">
    <fieldset class="panel">
      <legend>Actions</legend>
      <div class="buttons">
        <button id="regen-btn">Regenerate</button>
        <button id="finish-btn">Finish</button>
        <button id="pause-btn">Pause</button>
      </div>
    </fieldset>
    <fieldset class="panel">
      <legend>Cracks</legend>
      <label class="slider">Crack seed: <span id="crack-seed-value"></span>
        <input type="range" id="crack-seed" min="0" max="400" step="1" value="0">
      </label>
      <label class="slider">Crack rotation: <span id="rotation-value"></span>°
        <input type="range" id="rotation" min="-180" max="180" step="1" value="0">
      </label>
      <label class="slider">Crack density: <span id="density-value"></span>
        <input type="range" id="density" min="0" max="100" step="1" value="25">
      </label>
      <label class="slider">Crack count: <span id="crack-count-value"></span>
        <input type="range" id="crack-count" min="0" max="20" step="1" value="5">
      </label>
    </fieldset>
    <fieldset class="panel">
      <legend>Growth</legend>
      <label class="slider">Swarm count: <span id="swarm-count-value"></span>
        <input type="range" id="swarm-count" min="0" max="100" step="1" value="25">
      </label>
      <label class="slider">Iterations: <span id="iterations-value"></span>
        <input type="range" id="iterations" min="0" max="100" step="1" value="25">
      </label>
      <label class="slider">Iteration seed: <span id="iteration-seed-value"></span>
        <input type="range" id="iteration-seed" min="0" max="400" step="1" value="0">
      </label>
      <label class="slider">Iteration noise: <span id="noise-value"></span>
        <input type="range" id="noise" min="0" max="100" step="1" value="0">
      </label>
      <label class="slider"><input type="checkbox" id="tile" checked> Tile</label>
      <label class="slider">Speed (iter/frame): <span id="speed-value"></span>
        <input type="range" id="speed" min="1" max="200" step="1" value="30">
      </label>
    </fieldset>
    <fieldset class="panel">
      <legend>State</legend>
      <table class="readout">
        <tr><td>Iterations</td><td id="readout-iter">0 / 0</td></tr>
        <tr><td>Agents</td><td id="readout-agents">0</td></tr>
        <tr><td>Street pixels</td><td id="readout-px">0</td></tr>
      </table>
    </fieldset>
  </div>
</div>
```

- [ ] **Step 3: UI script**

```js
"use strict";
const GRID = 640;
const display = document.getElementById("display-canvas");
const displayCtx = display.getContext("2d");
const offscreen = document.createElement("canvas");
offscreen.width = GRID;
offscreen.height = GRID;
const offCtx = offscreen.getContext("2d");
const image = offCtx.createImageData(GRID, GRID);

const engine = new CityEngine({ width: GRID, height: GRID });
let running = true;

function resizeCanvas() {
  const wrap = display.parentElement;
  const avail = Math.max(320, Math.min(
    wrap.clientWidth - 26,
    window.innerHeight - display.getBoundingClientRect().top - 40
  ));
  const size = Math.floor(avail);
  if (display.width !== size) {
    display.width = size;
    display.height = size;
  }
}
window.addEventListener("resize", resizeCanvas);

const SLIDERS = [
  { id: "crack-seed",     key: "crackSeed" },
  { id: "rotation",       key: "rotation" },
  { id: "density",        key: "density" },
  { id: "crack-count",    key: "crackCount" },
  { id: "swarm-count",    key: "swarmCount" },
  { id: "iterations",     key: "iterations" },
  { id: "iteration-seed", key: "iterationSeed" },
  { id: "noise",          key: "noise" },
];

function currentParams() {
  const p = { tileMode: document.getElementById("tile").checked };
  for (const s of SLIDERS) {
    const v = Number(document.getElementById(s.id).value);
    p[s.key] = v;
    document.getElementById(s.id + "-value").textContent = v;
  }
  return p;
}

function restart() {
  engine.start(currentParams());
  running = true;
  document.getElementById("pause-btn").textContent = "Pause";
}

for (const s of SLIDERS) document.getElementById(s.id).addEventListener("input", restart);
document.getElementById("tile").addEventListener("change", restart);
document.getElementById("speed").addEventListener("input", () => {
  document.getElementById("speed-value").textContent = document.getElementById("speed").value;
});
document.getElementById("regen-btn").addEventListener("click", restart);
document.getElementById("finish-btn").addEventListener("click", () => { engine.finish(); });
document.getElementById("pause-btn").addEventListener("click", (ev) => {
  running = !running;
  ev.target.textContent = running ? "Pause" : "Resume";
});

// paper white / near-black streets
const BG = [244, 241, 234], FG = [26, 26, 26];
function render() {
  const data = image.data, px = engine.pixels;
  for (let i = 0; i < px.length; i++) {
    const c = px[i] ? FG : BG;
    data[i * 4] = c[0];
    data[i * 4 + 1] = c[1];
    data[i * 4 + 2] = c[2];
    data[i * 4 + 3] = 255;
  }
  offCtx.putImageData(image, 0, 0);
  displayCtx.imageSmoothingEnabled = true;
  displayCtx.drawImage(offscreen, 0, 0, display.width, display.height);
}

function frame() {
  if (running && engine.iterationsDone < engine.iterationsTotal) {
    engine.step(Number(document.getElementById("speed").value));
  }
  render();
  document.getElementById("readout-iter").textContent =
    engine.iterationsDone.toLocaleString() + " / " + engine.iterationsTotal.toLocaleString();
  document.getElementById("readout-agents").textContent = engine.usedAgentCount();
  document.getElementById("readout-px").textContent = engine.streetPixelCount().toLocaleString();
  requestAnimationFrame(frame);
}

document.getElementById("speed-value").textContent = document.getElementById("speed").value;
resizeCanvas();
restart();
requestAnimationFrame(frame);
```

(Note: `streetPixelCount()` per frame is a 410k-element sum — fine at 60fps.)

- [ ] **Step 4: Test, screenshot, verify** — `node test.mjs` → ALL PASS; headless screenshot at `--window-size=1400,1000 --virtual-time-budget=10000`; verify street network growing (black filigree on paper white), controls present. Commit `"city-generator: animated growth UI"`.

---

### Task 5: Gallery

**Files:**
- Create: `2d-city-generator/screenshot1.png`
- Modify: `gallery.yaml`, root `index.html` (regenerated)

- [ ] **Step 1: Gallery screenshot** — TEMP line `engine.finish();` after `restart();`, screenshot (a finished city), delete the TEMP line, re-test.

- [ ] **Step 2: Register and commit**

```bash
printf '2d-city-generator: 2D City Generator\n' >> gallery.yaml
python3 build_gallery.py   # expect 35 entries
cd 2d-city-generator && node test.mjs
git add 2d-city-generator gallery.yaml index.html
git commit -m "city-generator: gallery integration"
```
