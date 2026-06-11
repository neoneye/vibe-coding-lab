# 2D Slime Mold (Physarum) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone `2d-slime-mold/index.html` running a Physarum agent simulation — emergent trail networks, click-to-feed food sources, presets, palettes — with a deterministic Node-tested engine.

**Architecture:** `SlimeEngine` (typed-array agents + Float32Array toroidal trail grid) lives in `<script id="shared-code">` together with `mulberry32`, `PRESETS`, and `SlimeTests`; `test.mjs` extracts the block via regex and runs `SlimeTests.run()` under Node (same as `game-snake/` and `2d-monte-carlo-pi/`). UI is a separate `<script>` rendering the trail through a palette LUT into a 320×320 ImageData scaled to a 640×640 display canvas.

**Tech Stack:** Vanilla JS, Canvas 2D, Node ≥18 for tests, headless Chrome for screenshots.

**Spec:** `docs/superpowers/specs/2026-06-11-slime-mold-design.md`

---

### Task 1: Scaffold, test runner, seeded PRNG

**Files:**
- Create: `2d-slime-mold/test.mjs`
- Create: `2d-slime-mold/index.html`

- [ ] **Step 1: Write the test runner**

`2d-slime-mold/test.mjs`:

```js
// Runs the SlimeTests embedded in index.html's shared-code script block.
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
const ok = new Function(`${m[1]}; return SlimeTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: FAIL — `ENOENT ... index.html`.

- [ ] **Step 3: Create index.html skeleton with PRNG tests**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>2D Slime Mold</title>
<style>
/* styles added in Task 6 */
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

const SlimeTests = {
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
    }

    console.log(failures.length === 0 ? "ALL TESTS PASSED" : failures.length + " FAILURES");
    return failures.length === 0;
  },
};
</script>
<script>
// UI added in Task 6.
</script>
</body>
</html>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: 2× PASS, `ALL TESTS PASSED`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-slime-mold
git commit -m "slime-mold: scaffold with test runner and seeded PRNG"
```

---

### Task 2: Engine skeleton — construction, agents, reset

**Files:**
- Modify: `2d-slime-mold/index.html` (shared-code block only)

- [ ] **Step 1: Add failing tests**

Inside `SlimeTests.run()`, before the final `console.log`:

```js
    // --- Engine construction & agents ---
    {
      check("engine: class exists", typeof SlimeEngine !== "undefined");
      if (typeof SlimeEngine !== "undefined") {
        const e = new SlimeEngine({ width: 64, height: 48, agentCount: 100, rng: mulberry32(1) });
        check("engine: agent array sized", e.agents.length === 300);
        let bounds = true;
        for (let i = 0; i < 100; i++) {
          const x = e.agents[i * 3], y = e.agents[i * 3 + 1], h = e.agents[i * 3 + 2];
          if (x < 0 || x >= 64 || y < 0 || y >= 48 || h < 0 || h >= 2 * Math.PI) bounds = false;
        }
        check("engine: agents within bounds", bounds);
        check("engine: trail sized and zero", e.trail.length === 64 * 48 && e.trailMass() === 0);
        check("engine: networks preset is default", e.params.sensorDistance === 9);

        const firstX = e.agents[0];
        e.setAgentCount(150);
        check("engine: grow preserves existing agents", e.agents.length === 450 && e.agents[0] === firstX);
        e.setAgentCount(10);
        check("engine: shrink keeps prefix", e.agents.length === 30 && e.agents[0] === firstX);

        e.trail[5] = 1.5;
        e.reset();
        check("engine: reset clears trail and rescatters", e.trailMass() === 0 && e.agents.length === 30 && e.steps === 0);
      }
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: `FAIL engine: class exists`, exit 1.

- [ ] **Step 3: Implement PRESETS, TRAIL_CLAMP, and the engine skeleton**

In shared-code, after `mulberry32`, before `SlimeTests`:

```js
// Named parameter sets producing visually distinct morphologies.
// Angles in radians, distances in trail-grid cells.
const PRESETS = {
  networks:    { sensorAngle: 30 * Math.PI / 180, sensorDistance: 9,  turnAngle: 25 * Math.PI / 180, stepSize: 1.0, deposit: 0.6, decay: 0.92, diffusion: 0.55 },
  cells:       { sensorAngle: 45 * Math.PI / 180, sensorDistance: 18, turnAngle: 45 * Math.PI / 180, stepSize: 1.2, deposit: 0.8, decay: 0.90, diffusion: 0.40 },
  waves:       { sensorAngle: 15 * Math.PI / 180, sensorDistance: 25, turnAngle: 12 * Math.PI / 180, stepSize: 1.6, deposit: 0.5, decay: 0.95, diffusion: 0.65 },
  fingerprint: { sensorAngle: 60 * Math.PI / 180, sensorDistance: 4,  turnAngle: 60 * Math.PI / 180, stepSize: 0.8, deposit: 0.9, decay: 0.88, diffusion: 0.30 },
};

const TRAIL_CLAMP = 5.0;

// Physarum simulation on a toroidal trail grid. Agents are stored flat:
// agents[i*3] = x, agents[i*3+1] = y, agents[i*3+2] = heading.
class SlimeEngine {
  constructor(opts) {
    this.width = opts.width;
    this.height = opts.height;
    this.rng = opts.rng || Math.random;
    this.params = Object.assign(
      { foodDeposit: 0.4, foodRadius: 4 },
      PRESETS.networks,
      opts.params || {}
    );
    this.trail = new Float32Array(this.width * this.height);
    this.tmp = new Float32Array(this.width * this.height);
    this.foods = [];
    this.steps = 0;
    this.agents = new Float32Array(0);
    this.setAgentCount(opts.agentCount || 0);
  }

  setAgentCount(n) {
    const old = this.agents;
    const oldN = old.length / 3;
    const next = new Float32Array(n * 3);
    next.set(old.subarray(0, Math.min(oldN, n) * 3));
    for (let i = oldN; i < n; i++) {
      next[i * 3] = this.rng() * this.width;
      next[i * 3 + 1] = this.rng() * this.height;
      next[i * 3 + 2] = this.rng() * 2 * Math.PI;
    }
    this.agents = next;
  }

  reset() {
    this.trail.fill(0);
    this.steps = 0;
    const n = this.agents.length / 3;
    this.agents = new Float32Array(0);
    this.setAgentCount(n);
  }

  trailMass() {
    let s = 0;
    for (let i = 0; i < this.trail.length; i++) s += this.trail[i];
    return s;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-slime-mold/index.html
git commit -m "slime-mold: engine skeleton with agents, presets, reset"
```

---

### Task 3: Movement, deposit, diffusion, decay, clamp

**Files:**
- Modify: `2d-slime-mold/index.html` (shared-code block only)

In this task `step()` ignores sensing (always moves straight); sensing arrives in Task 4.

- [ ] **Step 1: Add failing tests**

Inside `SlimeTests.run()`, after the engine-construction block:

```js
    // --- Movement, deposit, diffusion, decay ---
    if (typeof SlimeEngine !== "undefined" && SlimeEngine.prototype.step) {
      // Toroidal wrap: agent at right edge heading +x reappears on the left.
      {
        const e = new SlimeEngine({ width: 64, height: 64, agentCount: 1, rng: mulberry32(2),
          params: { sensorDistance: 0, stepSize: 1.0, deposit: 0.5, decay: 1, diffusion: 0 } });
        e.agents[0] = 63.9; e.agents[1] = 32; e.agents[2] = 0;
        e.step();
        check("step: toroidal wrap", Math.abs(e.agents[0] - 0.9) < 1e-4 && Math.abs(e.agents[1] - 32) < 1e-4);
      }
      // Deposit: decay 1, diffusion 0 -> one step adds n * deposit mass.
      {
        const e = new SlimeEngine({ width: 64, height: 64, agentCount: 100, rng: mulberry32(3),
          params: { sensorDistance: 0, deposit: 0.5, decay: 1, diffusion: 0 } });
        e.step();
        check("step: mass grows by n*deposit (" + e.trailMass().toFixed(3) + ")",
          Math.abs(e.trailMass() - 50) < 1e-3);
        check("step: counter increments", e.steps === 1);
      }
      // Decay: no agents -> mass shrinks by exactly the decay factor.
      {
        const e = new SlimeEngine({ width: 32, height: 32, agentCount: 0, rng: mulberry32(4),
          params: { decay: 0.9, diffusion: 0 } });
        for (let i = 0; i < e.trail.length; i++) e.trail[i] = 1;
        const before = e.trailMass();
        e.step();
        check("step: decay shrinks mass", Math.abs(e.trailMass() - before * 0.9) < 1e-2);
      }
      // Diffusion conserves mass on the torus (decay 1, full diffusion).
      {
        const e = new SlimeEngine({ width: 32, height: 32, agentCount: 0, rng: mulberry32(5),
          params: { decay: 1, diffusion: 1 } });
        const r = mulberry32(6);
        for (let i = 0; i < e.trail.length; i++) e.trail[i] = r();
        const before = e.trailMass();
        e.step();
        check("step: diffusion conserves mass", Math.abs(e.trailMass() - before) / before < 1e-3);
      }
      // Clamp: huge deposits on a tiny grid never exceed TRAIL_CLAMP.
      {
        const e = new SlimeEngine({ width: 8, height: 8, agentCount: 200, rng: mulberry32(7),
          params: { sensorDistance: 0, deposit: 10, decay: 1, diffusion: 0 } });
        for (let s = 0; s < 30; s++) e.step();
        let maxV = 0;
        for (let i = 0; i < e.trail.length; i++) maxV = Math.max(maxV, e.trail[i]);
        check("step: trail clamped", maxV <= TRAIL_CLAMP + 1e-6);
      }
    } else {
      check("step: implemented", false);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: `FAIL step: implemented`, exit 1.

- [ ] **Step 3: Implement movement and the diffusion pass**

Add methods to `SlimeEngine` (sensing comes in Task 4; `_stampFood` in Task 5 — call neither yet):

```js
  _wrap(v, size) {
    v %= size;
    return v < 0 ? v + size : v;
  }

  step() {
    const { stepSize, deposit } = this.params;
    const W = this.width, H = this.height;
    const a = this.agents;
    const n = a.length / 3;
    for (let i = 0; i < n; i++) {
      const h = a[i * 3 + 2];
      const x = this._wrap(a[i * 3] + Math.cos(h) * stepSize, W);
      const y = this._wrap(a[i * 3 + 1] + Math.sin(h) * stepSize, H);
      a[i * 3] = x;
      a[i * 3 + 1] = y;
      const idx = Math.floor(y) * W + Math.floor(x);
      this.trail[idx] = Math.min(TRAIL_CLAMP, this.trail[idx] + deposit);
    }
    this._diffuseAndDecay();
    this.steps++;
  }

  _diffuseAndDecay() {
    const { diffusion, decay } = this.params;
    const W = this.width, H = this.height, t = this.trail, out = this.tmp;
    for (let y = 0; y < H; y++) {
      const yu = (y === 0 ? H - 1 : y - 1) * W;
      const yc = y * W;
      const yd = (y === H - 1 ? 0 : y + 1) * W;
      for (let x = 0; x < W; x++) {
        const xl = x === 0 ? W - 1 : x - 1;
        const xr = x === W - 1 ? 0 : x + 1;
        const blurred = (t[yu + xl] + t[yu + x] + t[yu + xr]
                       + t[yc + xl] + t[yc + x] + t[yc + xr]
                       + t[yd + xl] + t[yd + x] + t[yd + xr]) / 9;
        const c = t[yc + x];
        out[yc + x] = (c + (blurred - c) * diffusion) * decay;
      }
    }
    this.trail = out;
    this.tmp = t;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-slime-mold/index.html
git commit -m "slime-mold: agent movement, deposit, toroidal diffusion and decay"
```

---

### Task 4: Sensing and steering

**Files:**
- Modify: `2d-slime-mold/index.html` (shared-code block only)

- [ ] **Step 1: Add failing steering test**

Inside `SlimeTests.run()`, after the movement block:

```js
    // --- Sensing steers agents toward trails ---
    if (typeof SlimeEngine !== "undefined" && SlimeEngine.prototype.step) {
      // A persistent 3-cell-thick horizontal trail line at y=64. Agents start
      // parallel within sensor reach; with sensing they converge to the line,
      // without (sensorDistance 0) they hold their y forever.
      const meanDist = (sensorDistance) => {
        const e = new SlimeEngine({ width: 128, height: 128, agentCount: 200, rng: mulberry32(8),
          params: { sensorDistance, sensorAngle: 30 * Math.PI / 180, turnAngle: 25 * Math.PI / 180,
                    stepSize: 1, deposit: 0, decay: 1, diffusion: 0 } });
        const r = mulberry32(9);
        for (let i = 0; i < 200; i++) {
          e.agents[i * 3] = r() * 128;
          e.agents[i * 3 + 1] = 64 + (r() * 16 - 8);
          e.agents[i * 3 + 2] = 0;
        }
        const stamp = () => {
          for (let x = 0; x < 128; x++)
            for (let dy = -1; dy <= 1; dy++) e.trail[(64 + dy) * 128 + x] = 3;
        };
        for (let s = 0; s < 50; s++) { stamp(); e.step(); }
        let sum = 0;
        for (let i = 0; i < 200; i++) sum += Math.abs(e.agents[i * 3 + 1] - 64);
        return sum / 200;
      };
      const sensing = meanDist(10), control = meanDist(0);
      check("sensing: agents converge to trail line (" + sensing.toFixed(2) + " vs " + control.toFixed(2) + ")",
        sensing < control * 0.6);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: `FAIL sensing: ...` (without sensing both runs behave identically), exit 1.

- [ ] **Step 3: Implement sensing**

Add a trail-sampling helper to `SlimeEngine` and extend `step()`. Replace the agent loop body in `step()`:

```js
  _trailAt(x, y) {
    const xi = Math.floor(this._wrap(x, this.width));
    const yi = Math.floor(this._wrap(y, this.height));
    return this.trail[yi * this.width + xi];
  }
```

And in `step()`, replace:

```js
    for (let i = 0; i < n; i++) {
      const h = a[i * 3 + 2];
```

with:

```js
    const { sensorAngle, sensorDistance, turnAngle } = this.params;
    for (let i = 0; i < n; i++) {
      let h = a[i * 3 + 2];
      if (sensorDistance > 0) {
        const px = a[i * 3], py = a[i * 3 + 1];
        const f = this._trailAt(px + Math.cos(h) * sensorDistance, py + Math.sin(h) * sensorDistance);
        const l = this._trailAt(px + Math.cos(h - sensorAngle) * sensorDistance, py + Math.sin(h - sensorAngle) * sensorDistance);
        const r = this._trailAt(px + Math.cos(h + sensorAngle) * sensorDistance, py + Math.sin(h + sensorAngle) * sensorDistance);
        if (f >= l && f >= r) {
          // forward strongest: keep heading
        } else if (l > r) {
          h -= turnAngle;
        } else if (r > l) {
          h += turnAngle;
        } else {
          h += this.rng() < 0.5 ? -turnAngle : turnAngle;
        }
        a[i * 3 + 2] = h;
      }
```

(The movement/deposit lines that follow stay unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: all PASS — the sensing run's mean distance should be well under 60% of control.

- [ ] **Step 5: Commit**

```bash
git add 2d-slime-mold/index.html
git commit -m "slime-mold: three-sensor steering toward trails"
```

---

### Task 5: Food sources and determinism

**Files:**
- Modify: `2d-slime-mold/index.html` (shared-code block only)

- [ ] **Step 1: Add failing tests**

Inside `SlimeTests.run()`, after the sensing block:

```js
    // --- Food ---
    if (typeof SlimeEngine !== "undefined" && SlimeEngine.prototype.addFood) {
      {
        const e = new SlimeEngine({ width: 64, height: 64, agentCount: 0, rng: mulberry32(10),
          params: { decay: 1, diffusion: 0, foodDeposit: 0.4, foodRadius: 4 } });
        e.addFood(32, 32);
        e.step();
        let cells = 0;
        for (let dy = -4; dy <= 4; dy++)
          for (let dx = -4; dx <= 4; dx++)
            if (dx * dx + dy * dy <= 16) cells++;
        check("food: stamp adds foodDeposit per cell in radius",
          Math.abs(e.trailMass() - cells * 0.4) < 1e-3);
        check("food: removeFoodNear hits", e.removeFoodNear(33, 33, 6) === true && e.foods.length === 0);
        check("food: removeFoodNear misses", e.removeFoodNear(10, 10, 6) === false);
        e.addFood(5, 5); e.addFood(50, 50);
        e.clearFood();
        check("food: clearFood empties", e.foods.length === 0);
      }
      // Determinism: identical seeds + identical food -> identical state.
      {
        const make = () => {
          const e = new SlimeEngine({ width: 64, height: 64, agentCount: 500, rng: mulberry32(11) });
          e.addFood(20, 20);
          for (let s = 0; s < 20; s++) e.step();
          return e;
        };
        const a = make(), b = make();
        check("determinism: equal trail mass and first agent",
          a.trailMass() === b.trailMass() && a.agents[0] === b.agents[0] && a.agents[2] === b.agents[2]);
      }
    } else {
      check("food: implemented", false);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: `FAIL food: implemented`, exit 1.

- [ ] **Step 3: Implement food**

Add methods to `SlimeEngine`:

```js
  addFood(x, y) {
    this.foods.push({ x, y });
  }

  removeFoodNear(x, y, r) {
    let best = -1, bestD = r * r;
    for (let i = 0; i < this.foods.length; i++) {
      const dx = this.foods[i].x - x, dy = this.foods[i].y - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) { bestD = d; best = i; }
    }
    if (best < 0) return false;
    this.foods.splice(best, 1);
    return true;
  }

  clearFood() {
    this.foods = [];
  }

  _stampFood() {
    const { foodDeposit, foodRadius } = this.params;
    const W = this.width, H = this.height;
    const r = Math.ceil(foodRadius), r2 = foodRadius * foodRadius;
    for (const food of this.foods) {
      const cx = Math.round(food.x), cy = Math.round(food.y);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const xi = Math.floor(this._wrap(cx + dx, W));
          const yi = Math.floor(this._wrap(cy + dy, H));
          const idx = yi * W + xi;
          this.trail[idx] = Math.min(TRAIL_CLAMP, this.trail[idx] + foodDeposit);
        }
      }
    }
  }
```

And in `step()`, insert `this._stampFood();` between the agent loop and `this._diffuseAndDecay();`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-slime-mold/index.html
git commit -m "slime-mold: food sources with pheromone stamping, determinism test"
```

---

### Task 6: UI — rendering, controls, interaction

**Files:**
- Modify: `2d-slime-mold/index.html` (styles, body, UI script)

No automated test; verification is the screenshot in Step 4.

- [ ] **Step 1: Replace the `<style>` contents**

```css
:root {
  --bg: #11141a; --panel: #1a1f29; --border: #2c3442;
  --text: #dde3ee; --muted: #8a94a6; --accent: #5aa9ff;
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
#display-canvas { display: block; background: #000; border: 1px solid var(--border); cursor: crosshair; }
.controls { width: 340px; display: flex; flex-direction: column; gap: 12px; }
fieldset { border: 1px solid var(--border); border-radius: 6px; margin: 0; padding: 8px 12px; }
legend { color: var(--muted); font-size: 0.8rem; padding: 0 4px; }
label.slider { display: block; font-size: 0.85rem; margin: 6px 0; }
label.slider input { width: 100%; }
select {
  width: 100%; padding: 6px; border-radius: 6px; background: #232a37;
  color: var(--text); border: 1px solid var(--border); font-size: 0.9rem;
}
.buttons { display: flex; gap: 8px; margin-top: 8px; }
button {
  flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--border);
  background: #232a37; color: var(--text); font-size: 0.9rem; cursor: pointer;
}
button:hover { background: #2c3545; }
table.readout { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
table.readout td { padding: 3px 0; }
table.readout td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.hint { font-size: 0.8rem; color: var(--muted); margin: 8px 0 0; }
```

- [ ] **Step 2: Replace the placeholder body markup** (keep both script blocks)

```html
<h1>2D Slime Mold</h1>
<p class="subtitle">Physarum polycephalum: thousands of agents follow and reinforce pheromone trails. Click the canvas to drop food — the mold builds transport networks to reach it.</p>
<div class="layout">
  <div class="panel">
    <canvas id="display-canvas" width="640" height="640"></canvas>
    <p class="hint">Click: add food · click a food ring: remove it</p>
  </div>
  <div class="controls">
    <fieldset class="panel">
      <legend>Preset</legend>
      <select id="preset">
        <option value="networks">Networks</option>
        <option value="cells">Cells</option>
        <option value="waves">Waves</option>
        <option value="fingerprint">Fingerprint</option>
      </select>
    </fieldset>
    <fieldset class="panel">
      <legend>Parameters</legend>
      <label class="slider">Agents: <span id="agents-value"></span>
        <input type="range" id="agent-count" min="5000" max="80000" step="1000" value="30000">
      </label>
      <label class="slider">Sensor angle: <span id="sensor-angle-value"></span>°
        <input type="range" id="sensor-angle" min="5" max="90" step="1" value="30">
      </label>
      <label class="slider">Sensor distance: <span id="sensor-distance-value"></span>
        <input type="range" id="sensor-distance" min="1" max="30" step="1" value="9">
      </label>
      <label class="slider">Turn angle: <span id="turn-angle-value"></span>°
        <input type="range" id="turn-angle" min="5" max="90" step="1" value="25">
      </label>
      <label class="slider">Step size: <span id="step-size-value"></span>
        <input type="range" id="step-size" min="0.2" max="2.5" step="0.1" value="1.0">
      </label>
      <label class="slider">Deposit: <span id="deposit-value"></span>
        <input type="range" id="deposit" min="0.1" max="1.5" step="0.05" value="0.6">
      </label>
      <label class="slider">Decay: <span id="decay-value"></span>
        <input type="range" id="decay" min="0.80" max="0.99" step="0.005" value="0.92">
      </label>
      <label class="slider">Diffusion: <span id="diffusion-value"></span>
        <input type="range" id="diffusion" min="0" max="1" step="0.05" value="0.55">
      </label>
      <div class="buttons">
        <button id="pause-btn">Pause</button>
        <button id="reset-btn">Reset</button>
        <button id="clear-food-btn">Clear food</button>
      </div>
    </fieldset>
    <fieldset class="panel">
      <legend>Palette</legend>
      <select id="palette">
        <option value="amber">Amber</option>
        <option value="cyan">Cyan</option>
        <option value="mono">Mono</option>
      </select>
    </fieldset>
    <fieldset class="panel">
      <legend>State</legend>
      <table class="readout">
        <tr><td>Agents</td><td id="readout-agents">0</td></tr>
        <tr><td>Food sources</td><td id="readout-food">0</td></tr>
        <tr><td>Steps</td><td id="readout-steps">0</td></tr>
      </table>
    </fieldset>
  </div>
</div>
```

- [ ] **Step 3: Replace the UI `<script>`**

```js
"use strict";
const GRID = 320;
const display = document.getElementById("display-canvas");
const displayCtx = display.getContext("2d");
const SCALE = display.width / GRID;

const offscreen = document.createElement("canvas");
offscreen.width = GRID;
offscreen.height = GRID;
const offCtx = offscreen.getContext("2d");
const image = offCtx.createImageData(GRID, GRID);

const engine = new SlimeEngine({
  width: GRID, height: GRID, agentCount: 30000,
  rng: mulberry32((Math.random() * 2 ** 32) >>> 0),
});
let running = true;

// --- Palettes: 256-entry RGB lookup built from gradient stops ---
const PALETTE_STOPS = {
  amber: [[0, 0, 0], [80, 20, 0], [230, 120, 10], [255, 200, 80], [255, 255, 230]],
  cyan:  [[0, 0, 0], [0, 40, 60], [0, 150, 170], [120, 240, 255], [240, 255, 255]],
  mono:  [[0, 0, 0], [255, 255, 255]],
};
function buildPalette(stops) {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(t));
    const f = t - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
  }
  return lut;
}
let palette = buildPalette(PALETTE_STOPS.amber);
document.getElementById("palette").addEventListener("change", (ev) => {
  palette = buildPalette(PALETTE_STOPS[ev.target.value]);
});

// --- Sliders: id -> param, with degree conversion where needed ---
const SLIDERS = [
  { id: "sensor-angle",    param: "sensorAngle",    deg: true,  fmt: (v) => v },
  { id: "sensor-distance", param: "sensorDistance", deg: false, fmt: (v) => v },
  { id: "turn-angle",      param: "turnAngle",      deg: true,  fmt: (v) => v },
  { id: "step-size",       param: "stepSize",       deg: false, fmt: (v) => v.toFixed(1) },
  { id: "deposit",         param: "deposit",        deg: false, fmt: (v) => v.toFixed(2) },
  { id: "decay",           param: "decay",          deg: false, fmt: (v) => v.toFixed(3) },
  { id: "diffusion",       param: "diffusion",      deg: false, fmt: (v) => v.toFixed(2) },
];
for (const s of SLIDERS) {
  const input = document.getElementById(s.id);
  const valueEl = document.getElementById(s.id + "-value");
  const apply = () => {
    const v = Number(input.value);
    engine.params[s.param] = s.deg ? (v * Math.PI) / 180 : v;
    valueEl.textContent = s.fmt(v);
  };
  input.addEventListener("input", apply);
  apply();
}
const agentInput = document.getElementById("agent-count");
const applyAgents = () => {
  engine.setAgentCount(Number(agentInput.value));
  document.getElementById("agents-value").textContent = Number(agentInput.value).toLocaleString();
};
agentInput.addEventListener("input", applyAgents);
applyAgents();

document.getElementById("preset").addEventListener("change", (ev) => {
  const p = PRESETS[ev.target.value];
  for (const s of SLIDERS) {
    const v = s.deg ? Math.round((p[s.param] * 180) / Math.PI) : p[s.param];
    document.getElementById(s.id).value = v;
    document.getElementById(s.id).dispatchEvent(new Event("input"));
  }
});

// --- Buttons & canvas interaction ---
document.getElementById("pause-btn").addEventListener("click", (ev) => {
  running = !running;
  ev.target.textContent = running ? "Pause" : "Resume";
});
document.getElementById("reset-btn").addEventListener("click", () => engine.reset());
document.getElementById("clear-food-btn").addEventListener("click", () => engine.clearFood());
display.addEventListener("click", (ev) => {
  const rect = display.getBoundingClientRect();
  const gx = ((ev.clientX - rect.left) / rect.width) * GRID;
  const gy = ((ev.clientY - rect.top) / rect.height) * GRID;
  if (!engine.removeFoodNear(gx, gy, 6)) engine.addFood(gx, gy);
});

// --- Render loop ---
const GAMMA = 0.45;
function render() {
  const data = image.data, t = engine.trail;
  for (let i = 0; i < t.length; i++) {
    const v = Math.min(1, t[i] / TRAIL_CLAMP);
    const idx = (255 * Math.pow(v, GAMMA)) | 0;
    data[i * 4] = palette[idx * 3];
    data[i * 4 + 1] = palette[idx * 3 + 1];
    data[i * 4 + 2] = palette[idx * 3 + 2];
    data[i * 4 + 3] = 255;
  }
  offCtx.putImageData(image, 0, 0);
  displayCtx.imageSmoothingEnabled = true;
  displayCtx.drawImage(offscreen, 0, 0, display.width, display.height);
  displayCtx.strokeStyle = "rgba(255,255,255,0.9)";
  displayCtx.lineWidth = 2;
  for (const food of engine.foods) {
    displayCtx.beginPath();
    displayCtx.arc(food.x * SCALE, food.y * SCALE, 9, 0, 2 * Math.PI);
    displayCtx.stroke();
  }
}

function updateReadout() {
  document.getElementById("readout-agents").textContent = (engine.agents.length / 3).toLocaleString();
  document.getElementById("readout-food").textContent = engine.foods.length;
  document.getElementById("readout-steps").textContent = engine.steps.toLocaleString();
}

function frame() {
  if (running) {
    engine.step();
    render();
    updateReadout();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 4: Run tests, then verify visually in headless Chrome**

Run: `cd 2d-slime-mold && node test.mjs` → `ALL TESTS PASSED`.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --screenshot=/tmp/slime-check.png --window-size=1060,820 --virtual-time-budget=20000 \
  "file:///Users/neoneye/git/vibe-coding-lab/2d-slime-mold/index.html"
```

Read `/tmp/slime-check.png`: trail structure should be visible (amber filaments), controls rendered, readout counting steps. Headless captures run few frames, so patterns will be embryonic — verify structure exists, not maturity. If the canvas is solid black or solid white, debug the palette/clamp mapping before committing.

- [ ] **Step 5: Commit**

```bash
git add 2d-slime-mold/index.html
git commit -m "slime-mold: interactive UI with palettes, presets, click-to-feed"
```

---

### Task 7: Visual tuning pass and gallery integration

**Files:**
- Create: `2d-slime-mold/screenshot1.png`
- Modify: `gallery.yaml`
- Modify: `index.html` (repo root, regenerated)
- Possibly modify: `2d-slime-mold/index.html` (PRESETS values only)

- [ ] **Step 1: Let the simulation mature, screenshot each preset**

Headless Chrome only runs a handful of frames, so for tuning capture a long-running instance: append a temporary auto-advance — instead, run the page in headless Chrome with a large `--virtual-time-budget` and check; if patterns are still embryonic, add `for (let i = 0; i < 400; i++) engine.step();` as a temporary warm-up line right before `requestAnimationFrame(frame);`, screenshot all four presets (edit the `value` attribute of the preset select or call the change handler), confirm each looks visually distinct, then **remove the warm-up line**. Tune PRESETS values if a preset fails to produce its morphology (spec allows this; tests don't depend on preset values except `sensorDistance: 9` as the networks default).

- [ ] **Step 2: Capture the gallery screenshot**

With the (temporary) warm-up in place for a mature pattern:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --screenshot=/Users/neoneye/git/vibe-coding-lab/2d-slime-mold/screenshot1.png \
  --window-size=1060,860 --virtual-time-budget=20000 \
  "file:///Users/neoneye/git/vibe-coding-lab/2d-slime-mold/index.html"
```

Read the file: it must show developed amber filament networks. Then remove the warm-up line and re-run `node test.mjs`.

- [ ] **Step 3: Gallery registration**

Append to `gallery.yaml`:

```yaml
2d-slime-mold: 2D Slime Mold
```

Run: `cd /Users/neoneye/git/vibe-coding-lab && python3 build_gallery.py`
Expected: 32 entries, `2d-slime-mold` card present.

- [ ] **Step 4: Final test run**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: `ALL TESTS PASSED`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-slime-mold gallery.yaml index.html
git commit -m "slime-mold: visual tuning and gallery integration"
```
