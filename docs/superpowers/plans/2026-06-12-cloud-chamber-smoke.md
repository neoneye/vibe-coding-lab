# Cloud Chamber Smoke Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a billowing, advected smoke layer to `2d-cloud-chamber/` — tracks and mist shed vapor that swirls through an animated flow field — with Amount/Swirl/Fade/Softness sliders.

**Architecture:** A second Float32Array `smoke` with independent dynamics: fed from `_deposit` and the mist loop, advected semi-Lagrangian through a deterministic sine-flow (tick-driven, precomputed 1D trig tables for speed), blurred and decayed separately, composited under the crisp track palette at render time.

**Tech Stack:** Vanilla JS, Canvas 2D, Node ≥18, headless Chrome.

**Spec:** `docs/superpowers/specs/2026-06-12-cloud-chamber-smoke-design.md`

---

### Task 1: Smoke field, feeding, mist redirect

**Files:**
- Modify: `2d-cloud-chamber/index.html` (shared-code block only)

- [ ] **Step 1: Add failing tests and update the mist test**

Inside `ChamberTests.run()`, before the final `console.log`:

```js
    // --- Smoke layer: feeding ---
    if (typeof ChamberEngine !== "undefined" && ChamberEngine.prototype.smokeMass) {
      {
        const mk = (amt) => {
          const e = new ChamberEngine({ width: 480, height: 480, rng: mulberry32(40),
            params: { smokeAmount: amt } });
          e.fireParticle("alpha", 240, 240, 0.3);
          return e.smokeMass();
        };
        const none = mk(0), low = mk(0.1), high = mk(0.5);
        check("smoke: none at amount 0", none === 0);
        check("smoke: fed by tracks, scales (" + low.toFixed(1) + " -> " + high.toFixed(1) + ")",
          low > 0 && high > low * 3);
      }
    } else {
      check("smoke: implemented", false);
    }
```

Also REPLACE the existing mist test block:

```js
      // Mist: adds ~count * 0.05 mass per step.
      {
        const e = new ChamberEngine({ width: 480, height: 480, rng: mulberry32(33),
          params: { alphaRate: 0, betaRate: 0, muonRate: 0, mist: 100, decay: 1, diffusion: 0 } });
        e.step();
        check("step: mist deposits (" + e.fieldMass().toFixed(2) + ")",
          e.fieldMass() > 4.5 && e.fieldMass() < 5.01);
      }
```

with:

```js
      // Mist: feeds the smoke layer, not the track field.
      {
        const e = new ChamberEngine({ width: 480, height: 480, rng: mulberry32(33),
          params: { alphaRate: 0, betaRate: 0, muonRate: 0, mist: 100, decay: 1, diffusion: 0,
                    swirl: 0, smokeDecay: 1, smokeDiffusion: 0 } });
        e.step();
        check("step: mist feeds smoke (" + e.smokeMass().toFixed(2) + ")",
          e.smokeMass() > 4.5 && e.smokeMass() < 5.01 && e.fieldMass() === 0);
      }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-cloud-chamber && node test.mjs`
Expected: `FAIL smoke: implemented` and `FAIL step: mist feeds smoke` (smokeMass undefined → the mist test throws or fails), exit 1. (If the run aborts on a TypeError before printing, that satisfies "red" — note it and continue.)

- [ ] **Step 3: Implement the smoke field and feeding**

In shared-code, after `const FIELD_CLAMP = 4.0;`:

```js
const SMOKE_CLAMP = 4.0;
```

In the constructor, after `this.tmp = new Float32Array(...)`:

```js
    this.smoke = new Float32Array(this.width * this.height);
    this.smokeTmp = new Float32Array(this.width * this.height);
    this.tick = 0;
```

Add the new params to the defaults object (after `mist: 60, deltaProb: 0.004,`):

```js
      smokeAmount: 0.35, swirl: 0.6, smokeDecay: 0.985, smokeDiffusion: 0.5,
```

Extend `_deposit` — after the existing field write, feed the smoke layer:

```js
  _deposit(x, y, amount) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || xi >= this.width || yi < 0 || yi >= this.height) return;
    const idx = yi * this.width + xi;
    this.field[idx] = Math.min(FIELD_CLAMP, this.field[idx] + amount);
    if (this.params.smokeAmount > 0) {
      this.smoke[idx] = Math.min(SMOKE_CLAMP, this.smoke[idx] + amount * this.params.smokeAmount);
    }
  }

  _depositSmoke(x, y, amount) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || xi >= this.width || yi < 0 || yi >= this.height) return;
    const idx = yi * this.width + xi;
    this.smoke[idx] = Math.min(SMOKE_CLAMP, this.smoke[idx] + amount);
  }
```

In `step()`, change the mist loop to feed smoke:

```js
    for (let i = 0; i < p.mist; i++) {
      this._depositSmoke(this.rng() * W, this.rng() * H, 0.05);
    }
```

Add `smokeMass()` next to `fieldMass()`:

```js
  smokeMass() {
    let s = 0;
    for (let i = 0; i < this.smoke.length; i++) s += this.smoke[i];
    return s;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-cloud-chamber && node test.mjs`
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-cloud-chamber/index.html
git commit -m "cloud-chamber: smoke field fed by tracks and mist"
```

---

### Task 2: Smoke dynamics — advection, blur, decay

**Files:**
- Modify: `2d-cloud-chamber/index.html` (shared-code block only)

- [ ] **Step 1: Add failing tests**

Inside `ChamberTests.run()`, after the smoke-feeding block:

```js
    // --- Smoke dynamics ---
    if (typeof ChamberEngine !== "undefined" && ChamberEngine.prototype._advectSmoke) {
      const blank = () => new ChamberEngine({ width: 100, height: 100, rng: mulberry32(42),
        params: { alphaRate: 0, betaRate: 0, muonRate: 0, mist: 0, decay: 1, diffusion: 0 } });
      // Still air (swirl 0) is the identity.
      {
        const e = blank();
        e.params.swirl = 0; e.params.smokeDiffusion = 0; e.params.smokeDecay = 1;
        e.smoke[50 * 100 + 50] = 2; e.smoke[20 * 100 + 70] = 1;
        e.step();
        check("smoke: still air is identity",
          e.smoke[50 * 100 + 50] === 2 && e.smoke[20 * 100 + 70] === 1
          && Math.abs(e.smokeMass() - 3) < 1e-6);
      }
      // Swirl advects: centroid of a blob moves.
      {
        const e = blank();
        e.params.swirl = 1.5; e.params.smokeDiffusion = 0; e.params.smokeDecay = 1;
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) e.smoke[(50 + dy) * 100 + 40 + dx] = 1;
        const centroid = () => {
          let m = 0, cx = 0, cy = 0;
          for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
            const v = e.smoke[y * 100 + x]; m += v; cx += v * x; cy += v * y;
          }
          return { x: cx / m, y: cy / m };
        };
        const c0 = centroid();
        for (let s = 0; s < 10; s++) e.step();
        const c1 = centroid();
        const moved = Math.hypot(c1.x - c0.x, c1.y - c0.y);
        check("smoke: swirl advects (" + moved.toFixed(1) + " cells)", moved >= 2);
      }
      // Smoke decays by its own factor.
      {
        const e = blank();
        e.params.swirl = 0; e.params.smokeDiffusion = 0; e.params.smokeDecay = 0.9;
        for (let i = 0; i < e.smoke.length; i++) e.smoke[i] = 1;
        const before = e.smokeMass();
        e.step();
        check("smoke: decays", Math.abs(e.smokeMass() - before * 0.9) / (before * 0.9) < 1e-2);
      }
      // Determinism including the smoke layer.
      {
        const mk = () => {
          const e = new ChamberEngine({ width: 200, height: 200, rng: mulberry32(43) });
          e.addSource(60, 60);
          for (let s = 0; s < 30; s++) e.step();
          return e.smokeMass();
        };
        check("smoke: deterministic", mk() === mk());
      }
    } else {
      check("smoke dynamics: implemented", false);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-cloud-chamber && node test.mjs`
Expected: `FAIL smoke dynamics: implemented`, exit 1.

- [ ] **Step 3: Generalize the blur and implement advection**

Replace `_diffuseAndDecay()` with a generalized helper plus two thin wrappers:

```js
  _diffuseAndDecay() {
    [this.field, this.tmp] = this._blurDecay(this.field, this.tmp,
      this.params.diffusion, this.params.decay);
  }

  _smokeDiffuseDecay() {
    [this.smoke, this.smokeTmp] = this._blurDecay(this.smoke, this.smokeTmp,
      this.params.smokeDiffusion, this.params.smokeDecay);
  }

  // 3x3 box blur blended by `diffusion`, multiplied by `decay`. Edge-clamped.
  _blurDecay(src, tmp, diffusion, decay) {
    const W = this.width, H = this.height, t = src, out = tmp;
    for (let y = 0; y < H; y++) {
      const yu = Math.max(0, y - 1) * W, yc = y * W, yd = Math.min(H - 1, y + 1) * W;
      for (let x = 0; x < W; x++) {
        const xl = Math.max(0, x - 1), xr = Math.min(W - 1, x + 1);
        const blurred = (t[yu + xl] + t[yu + x] + t[yu + xr]
                       + t[yc + xl] + t[yc + x] + t[yc + xr]
                       + t[yd + xl] + t[yd + x] + t[yd + xr]) / 9;
        const c = t[yc + x];
        out[yc + x] = (c + (blurred - c) * diffusion) * decay;
      }
    }
    return [out, t];
  }

  // Semi-Lagrangian advection of the smoke through an animated swirl flow:
  //   vx = swirl * (sin(y*0.013 + t*0.011) + 0.5*sin((x+y)*0.021 - t*0.017))
  //   vy = swirl * (cos(x*0.011 - t*0.013) + 0.5*cos((x-y)*0.019 + t*0.019) + 0.35)
  // The +0.35 is a gentle downdraft. 1D trig tables keep it cheap.
  _advectSmoke() {
    const { swirl } = this.params;
    if (swirl === 0) return;
    const W = this.width, H = this.height, src = this.smoke, out = this.smokeTmp;
    const t = this.tick;
    const rowSin = new Float32Array(H);
    for (let y = 0; y < H; y++) rowSin[y] = Math.sin(y * 0.013 + t * 0.011);
    const diagSin = new Float32Array(W + H);
    for (let i = 0; i < W + H; i++) diagSin[i] = Math.sin(i * 0.021 - t * 0.017);
    const colCos = new Float32Array(W);
    for (let x = 0; x < W; x++) colCos[x] = Math.cos(x * 0.011 - t * 0.013);
    const adiagCos = new Float32Array(W + H);
    for (let i = 0; i < W + H; i++) adiagCos[i] = Math.cos((i - H) * 0.019 + t * 0.019);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const vx = swirl * (rowSin[y] + 0.5 * diagSin[x + y]);
        const vy = swirl * (colCos[x] + 0.5 * adiagCos[x - y + H] + 0.35);
        let sx = x - vx, sy = y - vy;
        if (sx < 0) sx = 0; else if (sx > W - 1.001) sx = W - 1.001;
        if (sy < 0) sy = 0; else if (sy > H - 1.001) sy = H - 1.001;
        const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
        const i00 = y0 * W + x0;
        out[y * W + x] = src[i00] * (1 - fx) * (1 - fy) + src[i00 + 1] * fx * (1 - fy)
                       + src[i00 + W] * (1 - fx) * fy + src[i00 + W + 1] * fx * fy;
      }
    }
    this.smoke = out;
    this.smokeTmp = src;
  }
```

In `step()`, after the mist loop, replace `this._diffuseAndDecay();` with:

```js
    this._advectSmoke();
    this._smokeDiffuseDecay();
    this._diffuseAndDecay();
    this.tick++;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-cloud-chamber && node test.mjs`
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-cloud-chamber/index.html
git commit -m "cloud-chamber: smoke advection through animated swirl flow"
```

---

### Task 3: UI — smoke sliders and composite rendering

**Files:**
- Modify: `2d-cloud-chamber/index.html` (body markup and UI script)

- [ ] **Step 1: Add the Smoke fieldset**

Insert after the "Chamber" fieldset (before the "State" fieldset):

```html
    <fieldset class="panel">
      <legend>Smoke</legend>
      <label class="slider">Amount: <span id="smoke-amount-value"></span>
        <input type="range" id="smoke-amount" min="0" max="1" step="0.05" value="0.35">
      </label>
      <label class="slider">Swirl: <span id="swirl-value"></span>
        <input type="range" id="swirl" min="0" max="2" step="0.05" value="0.6">
      </label>
      <label class="slider">Fade: <span id="smoke-decay-value"></span>
        <input type="range" id="smoke-decay" min="0.95" max="0.999" step="0.001" value="0.985">
      </label>
      <label class="slider">Softness: <span id="smoke-diffusion-value"></span>
        <input type="range" id="smoke-diffusion" min="0" max="1" step="0.05" value="0.5">
      </label>
    </fieldset>
```

- [ ] **Step 2: Wire the sliders**

In the `SLIDERS` array, after the `mist` entry, add:

```js
  { id: "smoke-amount",    param: "smokeAmount",    fmt: (v) => v.toFixed(2) },
  { id: "swirl",           param: "swirl",          fmt: (v) => v.toFixed(2) },
  { id: "smoke-decay",     param: "smokeDecay",     fmt: (v) => v.toFixed(3) },
  { id: "smoke-diffusion", param: "smokeDiffusion", fmt: (v) => v.toFixed(2) },
```

Update Clear chamber to clear both layers — replace:

```js
document.getElementById("clear-btn").addEventListener("click", () => engine.field.fill(0));
```

with:

```js
document.getElementById("clear-btn").addEventListener("click", () => {
  engine.field.fill(0);
  engine.smoke.fill(0);
});
```

- [ ] **Step 3: Composite smoke into the render**

In `render()`, replace the pixel loop:

```js
  const data = image.data, t = engine.field;
  for (let i = 0; i < t.length; i++) {
    const v = Math.min(1, t[i] / FIELD_CLAMP);
    const idx = (255 * Math.pow(v, GAMMA)) | 0;
    data[i * 4] = palette[idx * 3];
    data[i * 4 + 1] = palette[idx * 3 + 1];
    data[i * 4 + 2] = palette[idx * 3 + 2];
    data[i * 4 + 3] = 255;
  }
```

with:

```js
  const data = image.data, t = engine.field, sm = engine.smoke;
  for (let i = 0; i < t.length; i++) {
    const v = Math.min(1, t[i] / FIELD_CLAMP);
    const idx = (255 * Math.pow(v, GAMMA)) | 0;
    const s = Math.pow(Math.min(1, sm[i] / SMOKE_CLAMP), 0.6);
    data[i * 4] = palette[idx * 3] + s * 95;
    data[i * 4 + 1] = palette[idx * 3 + 1] + s * 115;
    data[i * 4 + 2] = palette[idx * 3 + 2] + s * 150;
    data[i * 4 + 3] = 255;
  }
```

(Uint8ClampedArray clamps the sums at 255.)

- [ ] **Step 4: Run tests**

Run: `cd 2d-cloud-chamber && node test.mjs`
Expected: `ALL TESTS PASSED` — UI edits must not touch shared-code.

- [ ] **Step 5: Commit**

```bash
git add 2d-cloud-chamber/index.html
git commit -m "cloud-chamber: smoke sliders and composite vapor rendering"
```

---

### Task 4: Visual verification and gallery screenshot refresh

**Files:**
- Modify: `2d-cloud-chamber/screenshot1.png`
- Possibly modify: `2d-cloud-chamber/index.html` (visual constants only)

- [ ] **Step 1: TEMP forced-track screenshot with smoke**

Append before the final `requestAnimationFrame(frame);`:

```js
// TEMP visual verification
engine.addSource(120, 360);
engine.params.swirl = 1.0;
for (let i = 0; i < 6; i++) engine.fireParticle("alpha", 120, 360, i * 1.05);
engine.fireParticle("muon", 0, 100, 0.15);
engine.fireParticle("muon", 460, 470, -2.6);
engine.params.bField = 1.5;
for (let i = 0; i < 3; i++) engine.fireParticle("beta", 300 + i * 40, 200, 1 + i);
engine.params.bField = 0;
for (let i = 0; i < 14; i++) engine.step();
engine.fireParticle("alpha", 120, 360, -0.5);
engine.fireParticle("alpha", 120, 360, 2.2);
engine.fireParticle("muon", 30, 0, 1.25);
engine.params.bField = 1.5;
engine.fireParticle("beta", 360, 330, 2.5, 25);
engine.params.bField = 0;
for (let i = 0; i < 2; i++) engine.step();
```

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --screenshot=/tmp/chamber-smoke.png --window-size=1060,980 --virtual-time-budget=2000 \
  "file:///Users/neoneye/git/vibe-coding-lab/2d-cloud-chamber/index.html"
```

Read it: tracks should now trail soft blue vapor that visibly drifts/billows; mist should be a soft moving haze, not static speckle. Tune the smoke tint, SMOKE gamma (0.6), or default `smokeAmount` if the vapor is invisible or overwhelms the tracks — report any change.

- [ ] **Step 2: Refresh the gallery screenshot**

Capture the same composition into `2d-cloud-chamber/screenshot1.png` (same command, output path swapped). Read it to confirm. Then **delete the TEMP block** and re-run `node test.mjs` → `ALL TESTS PASSED`.

- [ ] **Step 3: Commit**

```bash
git add 2d-cloud-chamber
git commit -m "cloud-chamber: smoke visual verification and gallery refresh"
```
