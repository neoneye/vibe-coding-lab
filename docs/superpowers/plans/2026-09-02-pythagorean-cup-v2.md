# Pythagorean Cup v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `pythagorean-cup/index.html` with a page that explains the cup's internals: a correct concentric cutaway with a reveal slider and clickable parts, a real 1-D hydraulic model in physical units with live pressure/flow readouts, and a seven-step guided tour that drives the same model, followed by free play.

**Architecture:** One self-contained `index.html`. A DOM-free `<script id="shared-code">` block holds `makeGeometry`, `CupModel`, and the `CupTests` registry; `test.mjs` extracts and runs it in Node. A second DOM script owns the SVG stage renderer, the tour controller, the free-play controls, the readouts and the pressure chart.

**Tech Stack:** Vanilla JS, inline SVG, CSS. No dependencies, no CDN.

**Spec:** `docs/superpowers/specs/2026-09-02-pythagorean-cup-v2-design.md`

## Global Constraints

- Single self-contained `index.html`; no external resources of any kind.
- All pure logic in `<script id="shared-code">`, runnable by `node test.mjs`; the block must never touch `document`/`window`.
- Units: cm, cm³ (shown as mL), cm³/s (shown as mL/s), cm H₂O for gauge pressure. `G = 981`.
- Geometry defaults (cm): bowl inner radius 4.0, rim z 8.0, wall 0.35; column outer r 1.1, wall 0.25, top z 6.4; holes z 0…0.35; tube bore r 0.4 (slider 0.2–0.6), tube wall 0.05, crest z 5.0 (slider 2.5–6.5); outlet z −1.4; table/foot bottom z −2.0; `Cd = 0.62`, `Cw = 0.4`; pour rate 45 cm³/s.
- Keep v1's warm palette (`--bg #f6ecd9`, `--clay #b4693a`, `--clay-dark #7e4423`, `--wine #8e2145`, `--ink #3d2c1e`).
- Commits go directly to `main`. Commit message prefix: `pythagorean-cup:`.
- Screenshot stays `pythagorean-cup/screenshot1.jpg` (gallery picks it up by name; `gallery.yaml` already has the title override — no gallery edits).
- Test runner: `cd pythagorean-cup && node test.mjs` → exit 0 and a `CupTests: N passed, 0 failed` line.

---

### Task 1: Skeleton, test harness, geometry

Replace the old page with a new shell: HTML/CSS layout with an empty stage placeholder, the shared-code block containing the test registry and `makeGeometry`, and `test.mjs`.

**Files:**
- Rewrite: `pythagorean-cup/index.html`
- Create: `pythagorean-cup/test.mjs`

**Interfaces:**
- Produces: `G`, `makeGeometry(overrides) -> geo`, `CupTests.add(name, fn)`, `CupTests.run() -> bool`, `assert(cond, msg)`, `near(a, b, eps)`.
- `geo` fields: `bowlR, rimZ, wall, colR, colWall, colTopZ, holeZ0, holeZ1, tubeR, tubeWall, crestZ, outletZ, tableZ, Cd, Cw, pourRate` plus derived `colInnerR, tubeOuterR, A_bowl, A_ann, A_tube, A_conn, V_tube`.

- [ ] **Step 1: Create `test.mjs`**

```js
// Runs the CupTests embedded in index.html's shared-code script block.
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
const ok = new Function(`${m[1]}; return CupTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Write the shared-code harness and geometry with two failing tests**

Shared-code block content (the DOM script comes later; the HTML shell is Task 5):

```js
"use strict";
// Pure hydraulic model of a Pythagorean cup. No DOM here: this block also runs in Node (test.mjs).

const G = 981; // cm/s^2

const CupTests = {
  tests: [],
  add(name, fn) { this.tests.push({ name, fn }); },
  run(log = console.log, error = console.error) {
    let failed = 0;
    for (const t of this.tests) {
      try { t.fn(); log("ok   " + t.name); }
      catch (e) { failed++; error("FAIL " + t.name + "\n     " + (e && e.message || e)); }
    }
    log(`CupTests: ${this.tests.length - failed} passed, ${failed} failed`);
    return failed === 0;
  }
};
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function near(a, b, eps, msg) {
  if (!(Math.abs(a - b) <= eps)) throw new Error((msg || "near") + `: ${a} vs ${b} (eps ${eps})`);
}

function makeGeometry(o = {}) {
  const g = Object.assign({
    bowlR: 4.0, rimZ: 8.0, wall: 0.35,
    colR: 1.1, colWall: 0.25, colTopZ: 6.4,
    holeZ0: 0.0, holeZ1: 0.35,
    tubeR: 0.4, tubeWall: 0.05, crestZ: 5.0,
    outletZ: -1.4, tableZ: -2.0,
    Cd: 0.62, Cw: 0.4, pourRate: 45
  }, o);
  deriveGeometry(g);
  return g;
}
function deriveGeometry(g) {
  g.colInnerR  = g.colR - g.colWall;
  g.tubeOuterR = g.tubeR + g.tubeWall;
  if (g.tubeOuterR >= g.colInnerR) throw new Error("tube does not fit inside the column");
  if (g.crestZ >= g.colTopZ || g.crestZ <= g.holeZ1) throw new Error("crest out of range");
  g.A_bowl = Math.PI * (g.bowlR ** 2 - g.colR ** 2);
  g.A_ann  = Math.PI * (g.colInnerR ** 2 - g.tubeOuterR ** 2);
  g.A_tube = Math.PI * g.tubeR ** 2;
  g.A_conn = g.A_bowl + g.A_ann;            // bowl + rising channel act as one vessel
  g.V_tube = g.A_tube * (g.crestZ - g.outletZ);
  return g;
}

CupTests.add("geometry: derived areas", () => {
  const g = makeGeometry();
  near(g.A_bowl, Math.PI * (16 - 1.21), 1e-9);
  near(g.A_ann, Math.PI * (0.85 ** 2 - 0.45 ** 2), 1e-9);
  near(g.A_tube, Math.PI * 0.16, 1e-9);
  near(g.V_tube, g.A_tube * 6.4, 1e-9);
});
CupTests.add("geometry: rejects impossible tubes", () => {
  let threw = false;
  try { makeGeometry({ tubeR: 0.9 }); } catch (e) { threw = true; }
  assert(threw, "tube wider than the column must throw");
});
```

- [ ] **Step 3: Run the tests**

Run: `cd pythagorean-cup && node test.mjs`
Expected: `CupTests: 2 passed, 0 failed`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add pythagorean-cup/index.html pythagorean-cup/test.mjs
git commit -m "pythagorean-cup: v2 skeleton, test harness, concentric geometry"
```

---

### Task 2: `CupModel` — filling, communicating vessels, rim overflow, conservation

**Files:**
- Modify: `pythagorean-cup/index.html` (shared-code block)

**Interfaces:**
- Produces: `class CupModel { constructor(geo); reset(); step(dt, pouring); volumes() -> {bowl, ann, tube}; balance() -> number; fairShareVolume() -> number; setCrest(z); setBore(d_cm) }` with state fields `h, hAnn, tubeFill, phase, poured, drained, spilled, t, qOut, qWeir, lastEvent`.
- Phase values: `"filling" | "spilling" | "siphon" | "breaking" | "empty"`.

- [ ] **Step 1: Write failing tests**

```js
function pourTo(m, hTarget, dt = 0.01) {
  let guard = 0;
  while (m.h < hTarget && guard++ < 1e6) m.step(dt, true);
  return m;
}
function run(m, seconds, pouring = false, dt = 0.01) {
  for (let t = 0; t < seconds; t += dt) m.step(dt, pouring);
  return m;
}

CupTests.add("filling: rising channel is level with the bowl, nothing leaves", () => {
  const m = pourTo(new CupModel(makeGeometry()), 3.0);
  near(m.hAnn, m.h, 1e-9, "communicating vessels");
  assert(m.phase === "filling", "phase " + m.phase);
  near(m.qOut, 0, 1e-12);
  near(m.drained, 0, 1e-12);
});
CupTests.add("filling: stop below the crest and nothing happens", () => {
  const m = pourTo(new CupModel(makeGeometry()), 4.8);
  const h0 = m.h;
  run(m, 10);
  near(m.h, h0, 1e-12);
  assert(m.phase === "filling");
});
CupTests.add("conservation: poured = drained + spilled + stored, every step", () => {
  const m = new CupModel(makeGeometry());
  for (let i = 0; i < 4000; i++) {
    m.step(0.01, i < 1800 || (i > 2500 && i < 2600));
    near(m.balance(), 0, 1e-6, "step " + i + " phase " + m.phase);
  }
});
CupTests.add("rim overflow: a firehose pins the level at the rim", () => {
  const g = makeGeometry({ pourRate: 400 });
  const m = new CupModel(g);
  run(m, 6, true);
  near(m.h, g.rimZ, 1e-9);
  assert(m.spilled > 0, "spilled");
});
CupTests.add("determinism: same inputs, same state", () => {
  const a = new CupModel(makeGeometry()), b = new CupModel(makeGeometry());
  for (let i = 0; i < 3000; i++) { const p = (i % 700) < 400; a.step(0.013, p); b.step(0.013, p); }
  assert(JSON.stringify(a.snapshot()) === JSON.stringify(b.snapshot()));
});
CupTests.add("fair share grows with the crest", () => {
  const lo = new CupModel(makeGeometry({ crestZ: 3 })), hi = new CupModel(makeGeometry({ crestZ: 6 }));
  assert(hi.fairShareVolume() > lo.fairShareVolume());
  near(hi.fairShareVolume(), 6 * hi.geo.A_conn, 1e-9);
});
```

- [ ] **Step 2: Run tests — expect `CupModel is not defined` failures**

- [ ] **Step 3: Implement the model (filling branch only; other phases arrive in Task 3)**

```js
class CupModel {
  constructor(geo) { this.geo = geo; this.reset(); }
  reset() {
    this.h = 0; this.hAnn = 0; this.tubeFill = 0; this.phase = "filling";
    this.poured = 0; this.drained = 0; this.spilled = 0; this.t = 0;
    this.qOut = 0; this.qWeir = 0; this.breakT = 0; this.lastEvent = "reset";
  }
  snapshot() {
    const { h, hAnn, tubeFill, phase, poured, drained, spilled, t, qOut, qWeir, breakT } = this;
    return { h, hAnn, tubeFill, phase, poured, drained, spilled, t, qOut, qWeir, breakT };
  }
  restore(s) { Object.assign(this, s); }
  volumes() {
    const g = this.geo;
    return { bowl: this.h * g.A_bowl, ann: this.hAnn * g.A_ann, tube: this.tubeFill * g.V_tube };
  }
  balance() {
    const v = this.volumes();
    return this.poured - this.drained - this.spilled - (v.bowl + v.ann + v.tube);
  }
  fairShareVolume() { return this.geo.crestZ * this.geo.A_conn; }
  setCrest(z) {
    const g = this.geo; g.crestZ = z; deriveGeometry(g);
    if (this.phase !== "filling" && this.phase !== "empty") this.reset();
    else this.lastEvent = "crest";
  }
  setBore(d) {
    const g = this.geo; g.tubeR = d / 2; deriveGeometry(g);
    if (this.tubeFill > 0) this.reset();
  }
  // pour into the connected vessel (bowl + rising channel); excess over the rim is spilled
  _pour(dt, pouring, area) {
    if (!pouring) return;
    const g = this.geo, dv = g.pourRate * dt;
    this.poured += dv;
    this.h += dv / area;
    if (this.h > g.rimZ) { this.spilled += (this.h - g.rimZ) * area; this.h = g.rimZ; }
  }
  step(dt, pouring) {
    const g = this.geo;
    this.t += dt; this.qOut = 0; this.qWeir = 0;
    if (this.phase === "empty" && pouring) { this.phase = "filling"; this.lastEvent = "filling"; }
    if (this.phase === "filling") {
      this._pour(dt, pouring, g.A_conn);
      this.hAnn = this.h;
      if (this.h > g.crestZ) { this.phase = "spilling"; this.lastEvent = "spilling"; }
    }
    // spilling / siphon / breaking: Task 3
  }
}
```

- [ ] **Step 4: Run tests — all six new tests pass (the conservation test never leaves `filling`/`spilling` yet, which is fine)**

- [ ] **Step 5: Commit** — `pythagorean-cup: CupModel filling phase, conservation, fair share`

---

### Task 3: Spilling, priming, siphon, air break

**Files:**
- Modify: `pythagorean-cup/index.html` (shared-code block)

**Interfaces:**
- Produces: `model.flowOut() -> qOut`, `model.primeTime` (t when the siphon locked, −1 if never), `model.residualZ()` = the equalised level after a break.

- [ ] **Step 1: Failing tests**

```js
CupTests.add("crossing the crest primes the siphon within 3 s", () => {
  const m = pourTo(new CupModel(makeGeometry()), 5.3);
  assert(m.phase === "spilling", "phase " + m.phase);
  run(m, 3, true);
  assert(m.phase === "siphon", "phase " + m.phase);
  near(m.tubeFill, 1, 1e-9);
});
CupTests.add("siphon: Torricelli with head surface-to-outlet", () => {
  const g = makeGeometry(), m = pourTo(new CupModel(g), 5.3);
  run(m, 3, true); run(m, 0.5);
  const expect = g.Cd * g.A_tube * Math.sqrt(2 * G * (m.h - g.outletZ));
  near(m.flowOut(), expect, 1e-9);
});
CupTests.add("siphon keeps running well below the crest", () => {
  const m = pourTo(new CupModel(makeGeometry()), 5.3);
  run(m, 3, true);
  while (m.h > 3.0) m.step(0.01, false);
  assert(m.phase === "siphon" && m.flowOut() > 20, "q " + m.flowOut());
  near(m.hAnn, m.geo.crestZ, 1e-9, "channel runs full to the crest");
});
CupTests.add("drains to the film under the holes and ends empty", () => {
  const g = makeGeometry(), m = pourTo(new CupModel(g), 5.3);
  run(m, 3, true); run(m, 30);
  assert(m.phase === "empty", "phase " + m.phase);
  assert(m.h < g.holeZ1 + 0.2 && m.h > 0, "residual " + m.h);
  near(m.hAnn, m.h, 1e-9);
  near(m.tubeFill, 0, 1e-9);
  near(m.drained, m.poured - m.h * g.A_conn, 1e-6);
});
CupTests.add("air break: breaking -> empty, channel levels fall to the bowl", () => {
  const g = makeGeometry(), m = pourTo(new CupModel(g), 5.3);
  run(m, 3, true);
  while (m.phase === "siphon") m.step(0.01, false);
  assert(m.phase === "breaking");
  run(m, 1);
  assert(m.phase === "empty");
  near(m.hAnn, m.h, 1e-9);
});
CupTests.add("a wider bore drains faster (~d^2)", () => {
  const q = (d) => { const g = makeGeometry({ tubeR: d / 2 }), m = pourTo(new CupModel(g), 5.3);
    run(m, 3, true); run(m, 0.2); return m.flowOut(); };
  near(q(1.0) / q(0.5), 4, 0.05);
});
CupTests.add("a hair over the line only dribbles, then settles", () => {
  const m = pourTo(new CupModel(makeGeometry()), 5.002);
  run(m, 20);
  assert(m.phase === "filling" && m.tubeFill === 0, m.phase + " " + m.tubeFill);
  assert(m.drained > 0 && m.drained < 3, "drained " + m.drained);
});
```

- [ ] **Step 2: Run — expect the priming/siphon tests to fail (phase stuck in `spilling`)**

- [ ] **Step 3: Implement the remaining phases**

Add to `reset()`: `this.primeTime = -1;`. Add `flowOut() { return this.qOut; }`. Replace the comment at the end of `step` with:

```js
    else if (this.phase === "spilling") {
      this._pour(dt, pouring, g.A_conn);
      const head = this.h - g.crestZ;
      if (head > 0.003) {
        // sharp-crested circular weir over the tube lip; the overflow forms a slug in the bore
        this.qWeir = g.Cw * 2 * Math.PI * g.tubeR * Math.sqrt(2 * G) * Math.pow(head, 1.5);
        let dv = Math.min(this.qWeir * dt, head * g.A_conn);
        this.h -= dv / g.A_conn;
        const room = (1 - this.tubeFill) * g.V_tube;
        if (dv >= room) {                       // bore full: the siphon locks
          this.drained += dv - room; this.tubeFill = 1;
          this._lock();
        } else this.tubeFill += dv / g.V_tube;
      } else {
        // surface tension holds the last film on the lip; the partial slug runs out below
        const dv = Math.min(this.tubeFill * g.V_tube, 1.2 * dt);
        this.tubeFill -= dv / g.V_tube; this.drained += dv;
        if (this.tubeFill <= 1e-12) { this.tubeFill = 0; this.phase = "filling"; this.lastEvent = "dribble"; }
      }
      this.hAnn = this.h;
    }
    else if (this.phase === "siphon") {
      const H = this.h - g.outletZ;
      this.qOut = g.Cd * g.A_tube * Math.sqrt(2 * G * H);
      this._pour(dt, pouring, g.A_bowl);
      const dv = Math.min(this.qOut * dt, this.h * g.A_bowl);
      this.h -= dv / g.A_bowl; this.drained += dv;
      this.hAnn = g.crestZ;
      if (this.h < g.holeZ1) { this.phase = "breaking"; this.breakT = 0; this.lastEvent = "breaking"; }
    }
    else if (this.phase === "breaking") {
      // air in at the holes: the slug falls out of the bore, the ring drains back into the bowl
      this.breakT += dt;
      const dTube = Math.min(this.tubeFill, dt / 0.35);
      this.tubeFill -= dTube; this.drained += dTube * g.V_tube;
      if (this.hAnn > this.h) {
        const dz = Math.min(this.hAnn - this.h, (g.crestZ / 0.5) * dt);
        const dv = dz * g.A_ann;
        this.hAnn -= dz; this.h += dv / g.A_bowl;
        if (this.hAnn < this.h) { // equalise exactly, conserving volume
          const total = this.h * g.A_bowl + this.hAnn * g.A_ann;
          this.h = this.hAnn = total / g.A_conn;
        }
      }
      if (this.tubeFill <= 1e-12 && this.hAnn <= this.h + 1e-12) {
        this.tubeFill = 0; this.phase = "empty"; this.lastEvent = "empty";
      }
      this._pour(dt, pouring, g.A_conn);   // pouring during the gulp just tops the film up
    }
  }
  _lock() {
    const g = this.geo;
    // the heap above the crest collapses into the flow: the ring now holds exactly crestZ*A_ann
    const total = this.h * g.A_conn;
    this.hAnn = g.crestZ;
    this.h = (total - g.crestZ * g.A_ann) / g.A_bowl;
    this.phase = "siphon"; this.primeTime = this.t; this.lastEvent = "siphon";
  }
```

Note the `breaking` branch pours into `A_conn` while `hAnn` may still exceed `h`; this is fine for conservation because `_pour` only ever adds to `h`, and the equalisation step re-computes from totals.

- [ ] **Step 4: Run — all tests pass, including the earlier conservation test now that every phase exists**

Expected: `CupTests: 15 passed, 0 failed`.

- [ ] **Step 5: Commit** — `pythagorean-cup: weir priming, Torricelli siphon, air break`

---

### Task 4: Pressure profile

**Files:**
- Modify: `pythagorean-cup/index.html` (shared-code block)

**Interfaces:**
- Produces: `model.pressureProfile() -> { pts: [{s, z, p, seg}], sTotal, stations: {surface, holes, crest, outlet} }` where `seg ∈ "bowl"|"ann"|"tube"`, `p` in cm H₂O gauge; `model.pressureAt(name)` for `name ∈ "holes"|"crest"|"outlet"`; `CM_H2O_TO_KPA = 0.0980665`.

- [ ] **Step 1: Failing tests**

```js
CupTests.add("pressure: static column below the crest", () => {
  const m = pourTo(new CupModel(makeGeometry()), 3.0);
  near(m.pressureAt("holes"), m.h - 0.175, 1e-9);
  near(m.pressureAt("outlet"), 0, 1e-9, "dry outlet reads atmospheric");
});
CupTests.add("pressure: suction at the crest while the siphon runs", () => {
  const m = pourTo(new CupModel(makeGeometry()), 5.3);
  run(m, 3, true);
  while (m.h > 4.0) m.step(0.01, false);
  assert(m.pressureAt("crest") < -1, "crest " + m.pressureAt("crest"));
  near(m.pressureAt("outlet"), 0, 1e-9, "free jet");
  const prof = m.pressureProfile();
  assert(prof.pts.every(p => Number.isFinite(p.p)));
  assert(prof.pts[0].seg === "bowl" && prof.pts[prof.pts.length - 1].seg === "tube");
});
```

- [ ] **Step 2: Implement**

```js
const CM_H2O_TO_KPA = 0.0980665;
CupModel.prototype.pressureProfile = function (n = 48) {
  const g = this.geo, h = this.h, holeZ = (g.holeZ0 + g.holeZ1) / 2;
  const flowing = this.phase === "siphon";
  const q = flowing ? this.qOut : 0;
  const vAnn = q / g.A_ann, vTube = q / g.A_tube;
  const annTop = flowing ? g.crestZ : Math.min(this.hAnn, g.crestZ);
  const Lbowl = Math.max(0, h - holeZ), Lann = Math.max(0, annTop - holeZ);
  const Ltube = flowing ? (g.crestZ - g.outletZ) : 0;
  const Lflow = Lann + Ltube;
  const H = h - g.outletZ;
  const lossTotal = flowing ? Math.max(0, H - vTube * vTube / (2 * G)) : 0;
  const pts = [];
  const push = (seg, s, z, v, sFlow) => {
    const loss = Lflow > 0 ? lossTotal * (sFlow / Lflow) : 0;
    pts.push({ seg, s, z, p: (h - z) - v * v / (2 * G) - loss });
  };
  const nb = Math.max(2, Math.round(n * Lbowl / (Lbowl + Lflow + 1e-9)));
  for (let i = 0; i <= nb; i++) { const z = h - Lbowl * i / nb; push("bowl", Lbowl * i / nb, z, 0, 0); }
  const na = Math.max(2, Math.round(n * Lann / (Lbowl + Lflow + 1e-9)));
  for (let i = 1; i <= na; i++) { const f = i / na, z = holeZ + Lann * f; push("ann", Lbowl + Lann * f, z, vAnn, Lann * f); }
  if (flowing) {
    const nt = Math.max(2, n - nb - na);
    for (let i = 0; i <= nt; i++) { const f = i / nt, z = g.crestZ - Ltube * f; push("tube", Lbowl + Lann + Ltube * f, z, vTube, Lann + Ltube * f); }
  }
  return { pts, sTotal: Lbowl + Lann + Ltube,
           stations: { surface: 0, holes: Lbowl, crest: Lbowl + Lann, outlet: Lbowl + Lann + Ltube } };
};
CupModel.prototype.pressureAt = function (name) {
  const g = this.geo, h = this.h, holeZ = (g.holeZ0 + g.holeZ1) / 2;
  if (name === "holes") return h >= holeZ ? h - holeZ : 0;
  if (name === "outlet") return 0;
  if (name === "crest") {
    if (this.phase !== "siphon") return this.hAnn >= g.crestZ ? h - g.crestZ : 0;
    const prof = this.pressureProfile();
    const p = prof.pts.find(pt => pt.seg === "tube");
    return p ? p.p : 0;
  }
  return 0;
};
```

- [ ] **Step 3: Run — `CupTests: 17 passed, 0 failed`. Commit** — `pythagorean-cup: pressure profile along the siphon path`

---

### Task 5: Stage — section, exterior, reveal, parts, plan-view inset

**Files:**
- Modify: `pythagorean-cup/index.html` (HTML shell, CSS, DOM script)

**Interfaces:**
- Produces (DOM script): `const PX = 34` (px per cm), `X0 = 260`, `Y0 = 380`; `sx(cm)`, `sz(cm)` (z up → y down); `buildStatic(geo)` rebuilds every geometry-dependent static path (called on crest/bore change); `setReveal(frac)`; `highlightPart(name|null)`; `PARTS` table `{ name, title, text }` for the eight parts.

- [ ] **Step 1: Layout**

`.wrap` → `header` (h1 "The Pythagorean Cup", subtitle "How a cup drinks itself — cut open, measured, explained") → `.card` with `.scene` (SVG `#stage`, `viewBox="0 0 520 500"`) and `.panel` (tabs `Guided tour` / `Free play`, tab bodies) → `.readouts` strip under the scene → `.chartWrap` (hidden unless pressure view). Reuse v1's CSS variables and card styling.

- [ ] **Step 2: SVG layers, bottom to top, each a `<g id>`**

`bg` (parchment, table at `sz(tableZ)`), `puddle`, `section` (cut ceramic, fill `#e9d7bb`, with a diagonal hatch `<pattern id="hatch">` overlay at 25 % opacity — the standard drafting cue for a cut surface), `liquid`, `particles`, `annot` (crest dashed line, hole labels, leader lines), `parts` (transparent hit shapes with `data-part`), `exterior` (opaque cup silhouette with a left-to-right clay gradient and a soft highlight, clipped by `<clipPath id="revealClip"><rect id="revealRect"/></clipPath>`; plus `#cutEdge` line with hatch), `jug`, `inset` (plan view).

Section shapes from `geo` (all via `sx/sz`; right half mirrors left):

```js
function buildStatic(g) {
  const L = (r) => sx(-r), R = (r) => sx(r);
  // bowl walls + floor + foot ring, as one evenodd path per side
  const bowlLeft = `M${L(g.bowlR + g.wall)},${sz(g.rimZ)} H${L(g.bowlR)} V${sz(0)} H${L(g.colR)} V${sz(-g.wall)} H${L(g.bowlR + g.wall)} Z`;
  // foot: ring wall from z=-wall down to tableZ at radius 2.3..2.6, recess under the floor in the middle
  const footLeft = `M${L(2.6)},${sz(-g.wall)} H${L(2.3)} V${sz(g.tableZ)} H${L(2.6)} Z`;
  // stem block around the tube: from floor down to outletZ, radius 1.1
  const stemLeft = `M${L(1.1)},${sz(-g.wall)} H${L(g.tubeOuterR)} V${sz(g.outletZ)} H${L(1.1)} Z`;
  // column shell: wall strip from floor to colTopZ, with the hole gap at holeZ0..holeZ1
  const colLeft = `M${L(g.colR)},${sz(g.colTopZ)} H${L(g.colInnerR)} V${sz(g.holeZ1)} H${L(g.colR)} Z`;
  const dome = `M${L(g.colR)},${sz(g.colTopZ)} Q${sx(0)},${sz(g.colTopZ + 0.9)} ${R(g.colR)},${sz(g.colTopZ)} Z`;
  // inner tube wall: from crestZ down to outletZ
  const tubeLeft = `M${L(g.tubeOuterR)},${sz(g.crestZ)} H${L(g.tubeR)} V${sz(g.outletZ)} H${L(g.tubeOuterR)} Z`;
  setD("secBowlL", bowlLeft); setD("secBowlR", mirror(bowlLeft)); /* … same for foot, stem, col, tube */
  setD("secDome", dome);
  // crest line + fill line
  setAttr("crestLine", { x1: sx(-g.bowlR), x2: sx(g.bowlR), y1: sz(g.crestZ), y2: sz(g.crestZ) });
}
```

`mirror(d)` negates x by re-parsing the numbers: simpler to build both sides with a `side` sign parameter (`X(side, r) = sx(side * r)`) — do that rather than string mirroring.

Hit shapes (`parts` group): rects covering bowl walls, column shell, hole gaps, annulus strips, tube bore, crest lip, stem, outlet. `PARTS`:

```js
const PARTS = [
  { name: "bowl",    title: "Bowl",                 text: "Holds the drink. Its free surface is what sets every pressure inside the cup." },
  { name: "column",  title: "Central column",        text: "A hollow shell, closed at the top. From the drinker's side it is just a little dome." },
  { name: "holes",   title: "Intake holes",          text: "Openings at the base of the shell. Whatever is in the bowl can flow in here — and air can get in once the bowl is nearly dry." },
  { name: "annulus", title: "Rising channel (ring)", text: "The ring-shaped gap between the shell and the inner tube. Liquid climbs here, level with the bowl." },
  { name: "crest",   title: "Crest — the fair-share line", text: "The open top of the inner tube. Fill above this and the drink spills into the tube." },
  { name: "tube",    title: "Inner tube (falling channel)", text: "A narrow bore running from the crest straight down through the stem." },
  { name: "stem",    title: "Stem passage",          text: "The tube continues through the solid stem; nothing to see from outside." },
  { name: "outlet",  title: "Outlet",                text: "A hole under the foot. The siphon discharges here onto the table — or your lap." }
];
```

`highlightPart(name)` toggles `.lit` on the matching hit shape (CSS: `fill: rgba(255,214,120,.45); stroke: #b3541e`) and writes title/text into `#partTitle/#partText`; hovering a legend row in the panel does the same.

Plan-view inset (top-left, centre (62,62), 1 cm = 11 px): circles for `bowlR+wall`, `bowlR`, `colR`, `colInnerR`, `tubeOuterR`, `tubeR`; caption "seen from above at the dashed height". Wet rings are filled wine-coloured in Task 6.

- [ ] **Step 3: Reveal**

```js
function setReveal(frac) {              // 0 = all exterior, 1 = full section
  const left = 90, right = 430;         // x-range of the cup incl. jug margin
  const cut = right - (right - left) * frac;
  revealRect.setAttribute("x", cut); revealRect.setAttribute("width", right - cut + 60);
  cutEdge.setAttribute("x1", cut); cutEdge.setAttribute("x2", cut);
  cutEdge.style.visibility = frac > 0 && frac < 1 ? "visible" : "hidden";
}
```
The exterior group is drawn *inside* the clip so it covers `[cut, right]`; the section shows on the left of the cut. A range input `#revealRange` (0–100) drives it; the tour animates it with `requestAnimationFrame` tweens.

- [ ] **Step 4: Verify visually**

Run: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --screenshot=/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/0dbd92a9-a805-46f1-99f9-f91582564913/scratchpad/stage.png --window-size=1200,900 "file:///Users/neoneye/git/vibe-coding-lab/pythagorean-cup/index.html?reveal=100"` then Read the PNG. Expected: section with hatched ceramic, hollow column, inner tube to the outlet under the foot, inset rings. Also `?reveal=0` shows a plain cup. `node test.mjs` still 17/0.

- [ ] **Step 5: Commit** — `pythagorean-cup: cutaway stage, reveal slider, clickable parts, plan-view inset`

---

### Task 6: Liquid rendering, main loop, readouts, free play, narration

**Files:**
- Modify: `pythagorean-cup/index.html` (DOM script + panel HTML)

**Interfaces:**
- Produces: `App = { model, speed, pouring, mode: "tour"|"play", pressureView, labels }`, `render()`, `tick(now)`, `setStatus(text, cls)`, `NARRATION` table keyed by `model.lastEvent`.

- [ ] **Step 1: Liquid shapes (rebuilt every frame from `model`)**

- Bowl liquid: two polygons, left `[sx(-bowlR), sz(0)] → [sx(-colR), sz(0)] → surface wave points → …` and right mirrored; the surface is `wavePoints(y, t, amp)` as in v1 (amp 0 under `prefers-reduced-motion`); during `siphon` add a dimple of depth `min(0.25cm, 0.03·h)` centred on each hole side.
- Annulus liquid: two rects from `sz(0)` up to `sz(min(hAnn, crestZ + (phase==="spilling" ? h-crestZ : 0)))`.
- Tube slug: rect from `sz(crestZ)` down by `tubeFill·(crestZ − outletZ)` cm; during `breaking` it shrinks from the top (`y = sz(crestZ) + (1 − tubeFill)·len`).
- Outlet stream: visible when `qOut > 0` or `breaking`; width `∝ sqrt(qOut)`; from `sz(outletZ)` to `sz(tableZ)`.
- Rim overflow: visible when `spilled` increased this frame; two thin streams down the outside of the bowl to the table.
- Puddle: `rx` grows with `drained` (`12 + 0.35·drained` px, capped 150), fades on reset.
- Inset rings: annulus ring wet iff `hAnn ≥ 2.5`; bore wet iff `phase === "siphon"`; bowl ring wet iff `h ≥ 2.5`.

- [ ] **Step 2: Main loop and speed**

```js
let last = performance.now();
function tick(now) {
  let dt = Math.min(0.05, (now - last) / 1000) * App.speed; last = now;
  if (App.running) { for (let i = 0; i < 4; i++) App.model.step(dt / 4, App.pouring); }
  onEvents(); render(); requestAnimationFrame(tick);
}
```
`onEvents()` compares `model.lastEvent` with the previous one and calls `setStatus(NARRATION[event])`.

```js
const NARRATION = {
  filling:  ["Liquid enters the ring through the holes and rises level with the bowl.", ""],
  crest:    ["Fair-share line moved.", ""],
  spilling: ["Over the crest — it spills into the inner tube.", "warn"],
  dribble:  ["Barely over the line: a dribble, and the lip's film holds. Pour a little more.", "warn"],
  siphon:   ["The bore is full. Siphon locked — the head is now the full drop to the outlet.", "danger"],
  breaking: ["Air gets in at the holes. The siphon gulps and breaks.", "danger"],
  empty:    ["Drained. Only the film below the holes is left.", "ok"],
  reset:    ["Hold the pour button to fill the cup.", ""]
};
```

- [ ] **Step 3: Readouts strip** (updated in `render()` at ≤ 10 Hz to avoid text jitter)

`Level in bowl 4.21 cm` · `Ring 5.00 cm` · `Flow out 35 mL/s` · `Crest gauge −4.8 cm H₂O` (title attribute shows kPa) · `Poured 240 mL · Drained 190 mL · Kept 50 mL` · phase badge.

- [ ] **Step 4: Free-play panel**

Hold-to-pour button (pointerdown/up + Space/Enter as in v1), Reset, sliders: crest (`2.5–6.5`, step 0.1 → `model.setCrest(v); buildStatic(geo)`), bore (`4–12 mm` → `model.setBore(v/10); buildStatic(geo)`), speed (`0.25/1/3` segmented), toggles: pressure view, labels, and the reveal range. Free-play mode sets `App.running = true`.

- [ ] **Step 5: Verify**

`node test.mjs` (17/0). Headless: temp `_shot.html` copy that, on load, runs `for (…) App.model.step(0.01, true)` to `h = 5.3`, then 2 s more, then `render()`; screenshot; expect wine in the bowl, the ring, the slug in the tube and a stream under the foot. Delete the temp file.

- [ ] **Step 6: Commit** — `pythagorean-cup: live liquid rendering, readouts, free play`

---

### Task 7: Pressure colouring and the pressure chart

**Files:**
- Modify: `pythagorean-cup/index.html`

Load the `dataviz` skill before writing the chart (repo-wide rule for any chart).

- [ ] **Step 1: Colour ramp** — `pressureColor(p)`: diverging, clamp `p` to ±8 cm H₂O; negative → `#3f6fb5` (suction), zero → `#9a5f7a` (neutral wine), positive → `#c23b3b`. Applied as `<linearGradient gradientUnits="userSpaceOnUse">` stops along each liquid region (bowl and ring: vertical, from `pressureProfile().pts` in that segment; tube: vertical). When the pressure view is off the liquid uses the plain wine gradient.

- [ ] **Step 2: Chart** — inline SVG (`#pChart`, 520×150) under the readouts, shown when the pressure view is on. x = `s` (0…`sTotal`), y = `p` (−10…+10 cm H₂O, zero line labelled "atmospheric"). Station ticks: surface, holes, crest, outlet. A single line (stroke `--ink`) with the crest sample dotted in the ramp colour. Axis labels 11 px, no legend needed. Text below: "Pressure along the path. Below the line is suction: the liquid in the tube pulls, the atmosphere on the drink pushes."

- [ ] **Step 3: Verify** with the `_shot.html` trick at `h = 4` mid-siphon and pressure view on; expect the ring coloured warm at the bottom → cool near the crest, the tube cool, and the chart dipping below zero at the crest. Commit — `pythagorean-cup: pressure colouring and along-the-path chart`

---

### Task 8: Guided tour

**Files:**
- Modify: `pythagorean-cup/index.html`

**Interfaces:**
- Produces: `TOUR` array of `{ title, text, apply(ctx) }`; `Tour.go(i)`, `Tour.next()`, `Tour.prev()`; `ctx = { model, setReveal(frac, animate), setRunning(bool), setSpeed(x), setPouring(bool), pressureView(bool), highlight([...names]), leaders(bool), stopWhen(pred) }`.

- [ ] **Step 1: Step table** (text is final copy; keep each under 90 words)

```js
const TOUR = [
 { title: "1 · From the outside",
   text: "A bowl on a stem, with a small dome rising from the middle of the floor. That dome is all a drinker ever sees. There is a hole under the foot, but who looks there?",
   apply: c => { c.model.reset(); c.setReveal(0, true); c.setRunning(false); c.pressureView(false); c.highlight([]); } },
 { title: "2 · Cut it open",
   text: "The dome is a hollow shell. Inside it stands a narrow tube that runs straight down through the stem to the hole under the foot. The shell has openings at its base. The inset shows the same thing from above: the two gaps you see in the section are one ring.",
   apply: c => { c.setReveal(1, true); c.leaders(true); c.highlight(["column","tube","holes"]); } },
 { title: "3 · Filling",
   text: "Pour, and the drink slips through the openings and climbs the ring — always exactly level with the bowl, because both sides feel the same air pressure on top and the same liquid below. Nothing leaves the outlet: the tube is still dry.",
   apply: c => { c.leaders(false); c.model.reset(); c.setSpeed(1); c.setPouring(true); c.setRunning(true); c.highlight(["annulus"]); c.stopWhen(m => m.h >= 4.0, () => c.setPouring(false)); } },
 { title: "4 · The fair-share line",
   text: "The only height that matters is the open top of the inner tube — the crest. Stop below it and the cup is an ordinary cup: you keep every drop. Pythagoras is said to have set this line as a fair share of wine.",
   apply: c => { c.setPouring(false); c.setRunning(false); c.model.reset(); pourModelTo(c.model, c.model.geo.crestZ - 0.1); c.highlight(["crest"]); } },
 { title: "5 · Over the top",
   text: "A little more, and the drink spills over the lip into the tube. In a bore this narrow the overflow does not free-fall: it seals the tube and pushes the air out ahead of it. The instant the bore is full from crest to outlet, the flow readout jumps from a trickle to the full siphon rate. (Slowed 4×.)",
   apply: c => { c.setSpeed(0.25); c.setPouring(true); c.setRunning(true); c.highlight(["tube"]); c.stopWhen(m => m.phase === "siphon", () => { c.setPouring(false); c.setRunning(false); }); } },
 { title: "6 · Why it keeps going",
   text: "Locked, the liquid in the tube is one continuous rope from the bowl's surface down to the outlet. What pulls is that whole drop, not the crest. The pressure at the crest falls below atmospheric — see the chart dip — so the atmosphere pressing on the drink pushes it up the ring to fill the gap. The level sinks far below the line and the siphon does not care.",
   apply: c => { c.setSpeed(1); c.pressureView(true); c.setPouring(false); c.model.reset(); pourModelTo(c.model, c.model.geo.crestZ + 0.3); primeModel(c.model); c.setRunning(true); c.highlight(["crest","outlet"]); c.stopWhen(m => m.phase === "empty", () => c.setRunning(false)); } },
 { title: "7 · Nothing left",
   text: "When the surface drops to the intake holes, air is sucked in, the rope snaps and the last of it gulps out. All that stays is the film below the holes. Fair share, or nothing — now try it yourself.",
   apply: c => { c.pressureView(false); c.highlight(["holes"]); if (c.model.phase !== "empty") { /* fast-forward */ pourModelTo(c.model, c.model.geo.crestZ + 0.3); primeModel(c.model); while (c.model.phase !== "empty") c.model.step(0.01, false); } c.setRunning(false); } }
];
```

`pourModelTo(m, h)` and `primeModel(m)` are DOM-side helpers that step the model synchronously (`dt = 0.01`) — same code as the test helpers.

- [ ] **Step 2: Controller** — step dots, Prev/Next, "Try it yourself" on the last step switches the tab to Free play (`App.mode = "play"`, `App.running = true`). Switching tabs cancels any pending `stopWhen`. Leader lines for step 2: eight numbered labels placed around the section with straight leader lines to the part centres (`annot` group; hidden otherwise). The tour is the default tab on load; `?play=1` opens Free play.

- [ ] **Step 3: Verify** — headless with `?step=N` (a URL hook that calls `Tour.go(N)` then, in `_shot.html`, pumps the model synchronously for steps 3/5/6) for N = 1, 2, 5, 6; read each PNG. Expect: 1 plain cup; 2 cutaway with eight numbered leaders; 5 slug part-way down the tube; 6 pressure colouring + chart dipping. Commit — `pythagorean-cup: guided tour`

---

### Task 9: Polish, screenshot, final checks

**Files:**
- Modify: `pythagorean-cup/index.html`
- Replace: `pythagorean-cup/screenshot1.jpg`

- [ ] **Step 1: Decoration** — jug tilt + stream into the bowl on the left side while pouring (from v1, retargeted), impact ripples, 60-droplet pool riding the path (bowl → hole → up the ring → over the crest → down the tube → out) using the model's `q` for speed; all skipped under `prefers-reduced-motion`. Footnote under the panel: the three honest simplifications from the spec.
- [ ] **Step 2: `window.__shot(name)`** — `name ∈ "outside"|"cutaway"|"filling"|"prime"|"siphon"|"empty"`: applies the matching tour step, pumps the model synchronously to the intended state, renders once. Driven by `?shot=name`.
- [ ] **Step 3: Screenshot** — `--headless --screenshot --window-size=1500,940 "…/index.html?shot=siphon"` (mid-siphon, pressure view on, tour step 6 card visible), convert to JPEG (`sips -s format jpeg -s formatOptions 82`) as `screenshot1.jpg`. Read it back and check it against the spec's anatomy table.
- [ ] **Step 4: Final checks** — `node test.mjs` → 17/0; headless console has no errors (`--enable-logging=stderr` and grep for `Uncaught`); `git status` shows only the intended files; `python3 build_gallery.py` is **not** needed (same directory name and screenshot name).
- [ ] **Step 5: Commit** — `pythagorean-cup: v2 — cutaway anatomy, real siphon hydraulics, guided tour`

## Self-review notes

- Spec coverage: anatomy table → Task 5; model phases → Tasks 2–3; pressure → Tasks 4 & 7; tour → Task 8; free play/readouts/narration → Task 6; simplifications footnote and `__shot` → Task 9; tests 1–12 of the spec map to Tasks 2, 3, 4 (the spec's "drain-rate ∝ d²" is the bore test in Task 3).
- Names used across tasks: `makeGeometry`, `deriveGeometry`, `CupModel.step(dt, pouring)`, `flowOut()`, `pressureAt()`, `pressureProfile()`, `setCrest()`, `setBore()`, `buildStatic()`, `setReveal()`, `highlightPart()`, `App`, `TOUR`, `Tour.go()`.
