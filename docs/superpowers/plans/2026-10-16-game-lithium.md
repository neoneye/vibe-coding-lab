# Lithium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A desktop browser revival of the 2016 *Lithium* car prototype: tune a car with sliders, press Start, watch it drive itself across a flat blue/yellow 2D track, reach 10 to clear the level.

**Architecture:** One `game-lithium/index.html`. A classic `<script id="shared-code">` holds all pure logic (tracks, slider→vehicle mapping, scoring, run monitor, save sanitizing) plus the planck simulation builder, which receives planck as a parameter so Node tests drive the same code. A module script loads three.js and planck from jsdelivr, renders the sim with flat unlit meshes through an orthographic camera, and owns UI, input, sound, and persistence.

**Tech Stack:** three.js 0.170.0, planck.js 1.5.1 (`dist/planck.mjs`, Box2D port), Web Audio, plain HTML/CSS. Node (no packages) for `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-16-game-lithium-design.md`

## Global Constraints

- Directory `game-lithium/`: `index.html`, `test.mjs`, `screenshot1.jpg`, `README.md`. Gallery title "Lithium" via `gallery.yaml`.
- Imports exactly `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js` and `https://cdn.jsdelivr.net/npm/planck@1.5.1/dist/planck.mjs`.
- Colours: sky `#0000ff`, track `#ffff00`, ice `#ffff99`, grip `#ffcc00`, chassis/legs `#000000`, tyre `#5a5a5a`, hub `#e0e0e0`, gear ring `#6e6e6e`, gear disc `#9a9a9a`, cargo `#00ff00`, flame red `#ff0000` + green `#00ff00`, sparks yellow.
- Units are metres, y up, gravity −10 m/s², fixed step 1/60 s.
- Renderer pixel ratio = `devicePixelRatio`; canvas backing store in device pixels (never CSS-stretched).
- UI text: bold Helvetica (`"Helvetica Neue", Helvetica, Arial, sans-serif`), yellow for the score number and Start/Stop.
- `localStorage` key `lithium.v1`, every access in try/catch; the game must work without it.
- Commit directly to `main`; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Odd window shapes** (very wide and short, or narrow and tall, or resized mid-run): the car and track stay fully visible (at least 9 m of world height), the slider panel never covers the car in the garage.
2. **Tab hidden then shown / long frame stall:** the fixed-step loop must not run hundreds of catch-up steps or explode the physics; it caps catch-up and drops the backlog.
3. **Keyboard focus on a slider:** Enter still starts the run; Space/arrows during a run steer the car, never move a (hidden) slider or scroll the page.
4. **Corrupt or old `localStorage`** (garbage JSON, missing keys, out-of-range or NaN values, more levels unlocked than exist): load falls back to valid defaults per field.
5. **Extreme slider combinations** (all min, all max, huge wheels on short legs on a narrow chassis, max cargo): the simulation stays finite and does not explode.

Tests for 4 and 5 are in Tasks 1 and 2; 1–3 are verified in the browser in Tasks 3–4 with explicit steps.

---

### Task 1: Pure logic — tracks, vehicle config, scoring, run monitor, save

**Files:**
- Create: `game-lithium/index.html` (skeleton with the shared-code block only)
- Create: `game-lithium/test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces (globals in the shared-code script):
  - `RUNUP = 8`, `RUNOUT = 10`, `BAND = 0.6`, `FRICTION = {normal, ice, grip}`, `LEVELS`.
  - `Tracks.count`, `Tracks.name(i)`, `Tracks.build(i) → Geom`, `Tracks.bridgePlanks(bridge) → [{x,y}]`, `Tracks.groundYAt(geom, x) → number`.
  - `Geom = {name, segments:[{x0,y0,x1,y1,kind}], runs:[{kind, points:[{x,y}]}], gaps:[{x0,x1,y0,y1}], bridges:[{x0,x1,y0,y1}], walls:[{x0,y0,x1,y1}], spawnX, scoreStartX, scoreEndX, endX, minY}`.
  - `Score.scoreFor(x, geom) → 0..10`.
  - `class RunMonitor(geom)` with `.update(dt, {x,y,angle}) → null|"win"|"fell"|"flipped"|"stuck"`, `.score`, `.t`.
  - `VehicleConfig.SLIDERS`, `VehicleConfig.WHEEL_TYPES`, `.defaults()`, `.clamp(values)`, `.toPhysicsSpec(values) → Spec`.
  - `Spec = {chassis:{w,h}, posts:[{x,y,hx,hy}], legs:[{x,top,bottom,hw}], wheels:[{x,y,r,friction,type}], cargo:[{x,y,w,h}], motor:{speed,torque}, spring:{hz,damping}, fuel}` (all relative to the chassis centre).
  - `Save.KEY`, `Save.fresh()`, `Save.sanitize(raw) → {values, unlocked, best:[5], level, muted}`.
  - `LithiumTests.run(planck|null) → boolean`.

- [ ] **Step 1: Write the test runner `game-lithium/test.mjs`**

```js
// Runs LithiumTests embedded in index.html's shared-code script block.
// Usage: node test.mjs
// Physics tests also run when PLANCK_PATH points at a local planck.mjs (planck 1.5.1 dist/planck.mjs).
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) {
  console.error("shared-code block not found");
  process.exit(1);
}
const planck = process.env.PLANCK_PATH ? await import(pathToFileURL(resolve(process.env.PLANCK_PATH)).href) : null;
if (!planck) console.log("(PLANCK_PATH not set: skipping physics tests)");
const ok = new Function(`${m[1]}; return LithiumTests.run;`)()(planck);
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Write `game-lithium/index.html` with the test suite and empty implementations**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lithium</title>
</head>
<body>
<script id="shared-code">
// ---- Lithium shared code: pure logic, no DOM, no three.js. planck is injected where needed. ----
const Tracks = { count: 0, name() {}, build() {}, bridgePlanks() {}, groundYAt() {} };
const Score = { scoreFor() {} };
class RunMonitor { update() { return null; } }
const VehicleConfig = { SLIDERS: [], WHEEL_TYPES: [], defaults() {}, clamp() {}, toPhysicsSpec() {} };
const Save = { KEY: "lithium.v1", fresh() {}, sanitize() {} };

const LithiumTests = {
  run(planck) {
    let pass = 0, fail = 0;
    const test = (name, fn) => {
      try { fn(); pass++; } catch (e) { fail++; console.log("FAIL " + name + ": " + e.message); }
    };
    const ok = (c, msg) => { if (!c) throw new Error(msg || "assertion failed"); };
    const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, (msg || "") + ` expected ${b} got ${a}`);

    test("five levels build", () => {
      ok(Tracks.count === 5, "count " + Tracks.count);
      for (let i = 0; i < Tracks.count; i++) {
        const g = Tracks.build(i);
        ok(typeof Tracks.name(i) === "string" && Tracks.name(i).length > 0, "name");
        ok(g.scoreEndX > g.scoreStartX + 30, "level " + i + " too short");
        ok(g.spawnX < g.scoreStartX && g.spawnX > -RUNUP, "spawn inside run-up");
        ok(g.endX === g.scoreEndX + RUNOUT, "run-out");
        ok(g.walls.length === 2, "walls");
      }
    });
    test("runs are continuous polylines", () => {
      for (let i = 0; i < Tracks.count; i++) {
        const g = Tracks.build(i);
        for (const r of g.runs) {
          ok(r.points.length >= 2, "run too short");
          for (let k = 1; k < r.points.length; k++) ok(r.points[k].x > r.points[k - 1].x, "x increases");
        }
      }
    });
    test("segments chain except at gaps and bridges", () => {
      for (let i = 0; i < Tracks.count; i++) {
        const g = Tracks.build(i);
        const holes = g.gaps.length + g.bridges.length;
        let breaks = 0;
        for (let k = 1; k < g.segments.length; k++) {
          const a = g.segments[k - 1], b = g.segments[k];
          if (Math.abs(a.x1 - b.x0) > 1e-9 || Math.abs(a.y1 - b.y0) > 1e-9) breaks++;
        }
        ok(breaks === holes, `level ${i}: ${breaks} breaks, ${holes} holes`);
      }
    });
    test("level features", () => {
      ok(Tracks.build(2).gaps.length >= 3, "pitfalls has gaps");
      ok(Tracks.build(3).bridges.length === 2, "two bridges");
      const kinds = new Set(Tracks.build(4).segments.map(s => s.kind));
      ok(kinds.has("ice") && kinds.has("grip"), "friction kinds");
      const steep = Math.max(...Tracks.build(1).segments.map(s => Math.abs(Math.atan2(s.y1 - s.y0, s.x1 - s.x0))));
      near(steep * 180 / Math.PI, 35, 0.01, "steepest slope");
    });
    test("bridge planks span the gap with a sag", () => {
      const b = { x0: 10, x1: 18, y0: 2, y1: 2 };
      const p = Tracks.bridgePlanks(b);
      ok(p.length === 17, "16 planks -> 17 points, got " + p.length);
      near(p[0].x, 10, 1e-9); near(p[0].y, 2, 1e-9);
      near(p[p.length - 1].x, 18, 1e-6); near(p[p.length - 1].y, 2, 1e-6);
      ok(Math.min(...p.map(q => q.y)) < 2 - 0.3, "sags");
      const lens = [];
      for (let k = 1; k < p.length; k++) lens.push(Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y));
      ok(Math.max(...lens) - Math.min(...lens) < 0.01, "even planks");
    });
    test("groundYAt interpolates and covers gaps", () => {
      const g = Tracks.build(0);
      near(Tracks.groundYAt(g, -5), 0, 1e-9, "run-up");
      const s = g.segments[3];
      near(Tracks.groundYAt(g, (s.x0 + s.x1) / 2), (s.y0 + s.y1) / 2, 1e-9, "mid segment");
      const gp = Tracks.build(2).gaps[0];
      near(Tracks.groundYAt(Tracks.build(2), (gp.x0 + gp.x1) / 2), Math.min(gp.y0, gp.y1), 1e-9, "gap");
      near(Tracks.groundYAt(g, 1e6), g.segments[g.segments.length - 1].y1, 1e-9, "beyond end");
    });
    test("scoreFor maps 0..10 and clamps", () => {
      const g = { scoreStartX: 0, scoreEndX: 100 };
      ok(Score.scoreFor(-50, g) === 0, "before");
      ok(Score.scoreFor(0, g) === 0, "start");
      ok(Score.scoreFor(9.99, g) === 0, "just under 1");
      ok(Score.scoreFor(10, g) === 1, "exactly 1");
      ok(Score.scoreFor(55, g) === 5, "mid");
      ok(Score.scoreFor(100, g) === 10, "end");
      ok(Score.scoreFor(500, g) === 10, "after");
    });
    const flatGeom = () => ({ scoreStartX: 0, scoreEndX: 100, minY: 0,
      segments: [{ x0: -10, y0: 0, x1: 200, y1: 0, kind: "normal" }], gaps: [], bridges: [] });
    test("monitor: steady progress is fine, score never drops", () => {
      const m = new RunMonitor(flatGeom());
      let r = null;
      for (let i = 0; i < 600 && !r; i++) r = m.update(1 / 60, { x: i * 0.05, y: 1, angle: 0 });
      ok(r === null, "got " + r);
      const s = m.score;
      m.update(1 / 60, { x: 0, y: 1, angle: 0 });
      ok(m.score === s && s === 2, "score kept " + m.score);
    });
    test("monitor: no progress for 3 s is stuck", () => {
      const m = new RunMonitor(flatGeom());
      let r = null, t = 0;
      while (!r && t < 10) { r = m.update(1 / 60, { x: 5 + 0.1 * Math.sin(t * 5), y: 1, angle: 0 }); t += 1 / 60; }
      ok(r === "stuck", "got " + r);
      near(t, 3, 0.1, "after ~3 s");
    });
    test("monitor: upside down 1.5 s is flipped, brief flip is not", () => {
      let m = new RunMonitor(flatGeom()), r = null;
      for (let i = 0; i < 60; i++) r = r || m.update(1 / 60, { x: i * 0.1, y: 1, angle: Math.PI });
      for (let i = 0; i < 60; i++) r = r || m.update(1 / 60, { x: 6 + i * 0.1, y: 1, angle: 0 });
      ok(r === null, "brief flip " + r);
      m = new RunMonitor(flatGeom()); r = null;
      let i = 0;
      while (!r && i < 300) { r = m.update(1 / 60, { x: i * 0.1, y: 1, angle: -3 }); i++; }
      ok(r === "flipped" && i >= 90 && i <= 92, "flipped at " + i + " " + r);
    });
    test("monitor: falling into a pit, and win at 10", () => {
      const g = Tracks.build(2), gp = g.gaps[0];
      const m = new RunMonitor(g);
      ok(m.update(1 / 60, { x: (gp.x0 + gp.x1) / 2, y: Math.min(gp.y0, gp.y1) - 4.5, angle: 0 }) === "fell", "pit");
      const m2 = new RunMonitor(flatGeom());
      ok(m2.update(1 / 60, { x: -100, y: -6, angle: 0 }) === "fell", "below minY");
      const m3 = new RunMonitor(flatGeom());
      ok(m3.update(1 / 60, { x: 100, y: 1, angle: 0 }) === "win", "win");
    });
    test("sliders: defaults in range, clamp handles junk", () => {
      const d = VehicleConfig.defaults();
      ok(VehicleConfig.SLIDERS.length === 11, "11 sliders");
      for (const s of VehicleConfig.SLIDERS) ok(d[s.key] >= s.min && d[s.key] <= s.max && Number.isInteger(d[s.key]), s.key);
      const c = VehicleConfig.clamp({ rearRadius: 99, frontRadius: -4, motorSpeed: "7", cargo: NaN, fuel: 2.6, bogus: 1 });
      ok(c.rearRadius === 12 && c.frontRadius === 3 && c.motorSpeed === 7, "clamped");
      ok(c.cargo === d.cargo && c.fuel === 3 && !("bogus" in c), "junk");
      ok(JSON.stringify(VehicleConfig.clamp(null)) === JSON.stringify(d), "null -> defaults");
    });
    test("default spec reproduces the Car6 vehicle", () => {
      const s = VehicleConfig.toPhysicsSpec(VehicleConfig.defaults());
      near(s.chassis.w, 4, 1e-9); near(s.chassis.h, 0.4, 1e-9);
      near(s.wheels[0].x, -1.2, 1e-9); near(s.wheels[1].x, 1.2, 1e-9);
      near(s.wheels[0].r, 0.5, 1e-9); near(s.wheels[0].y, -0.2 - 0.8, 1e-9);
      ok(s.wheels[0].type === "hex" && s.cargo.length === 4, "hex wheels, 4 cargo");
      near(s.motor.torque, 80, 1e-9);
    });
    test("cargo never overlaps and stays between the posts", () => {
      for (let w = 2; w <= 6; w++) for (let n = 0; n <= 6; n++) {
        const s = VehicleConfig.toPhysicsSpec({ ...VehicleConfig.defaults(), chassisWidth: w, cargo: n });
        ok(s.cargo.length === n, "count");
        const inner = w / 2 - 0.2;
        for (let k = 0; k < n; k++) {
          const c = s.cargo[k];
          ok(c.x - c.w / 2 >= -inner - 1e-9 && c.x + c.w / 2 <= inner + 1e-9, `w${w} n${n} block ${k} out`);
          if (k > 0) { const p = s.cargo[k - 1]; ok(p.x + p.w / 2 <= c.x - c.w / 2 + 1e-9, "overlap"); }
          near(c.y - c.h / 2, s.chassis.h / 2 + 0.01, 1e-9, "rests on bed");
        }
      }
    });
    test("save sanitize survives junk", () => {
      const f = Save.fresh();
      ok(f.unlocked === 1 && f.level === 0 && f.best.length === 5 && f.muted === false, "fresh");
      const s = Save.sanitize({ values: { cargo: 99 }, unlocked: 42, best: [3, "x", 99], level: 7, muted: 1 });
      ok(s.values.cargo === 6 && s.unlocked === 5, "values/unlocked");
      ok(JSON.stringify(s.best) === "[3,0,10,0,0]", "best " + JSON.stringify(s.best));
      ok(s.level === 4 && s.muted === true, "level/muted");
      for (const junk of [null, 5, "x", [], { unlocked: -3, level: -1 }]) {
        const j = Save.sanitize(junk);
        ok(j.unlocked === 1 && j.level === 0 && j.best.length === 5, "junk " + JSON.stringify(junk));
      }
    });

    if (planck) LithiumTests.physics(planck, test, ok);
    console.log(`${pass} passed, ${fail} failed`);
    return fail === 0;
  },
  physics() {},
};
</script>
</body>
</html>
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `node game-lithium/test.mjs`
Expected: many `FAIL` lines (e.g. `FAIL five levels build: count 0`), last line `0 passed, 15 failed` or similar, exit code 1.

- [ ] **Step 4: Replace the stub declarations (everything above `const LithiumTests`) with the implementation**

```js
// ---- Lithium shared code: pure logic, no DOM, no three.js. planck is injected where needed. ----
const RUNUP = 8;     // flat metres before score 0
const RUNOUT = 10;   // flat metres after score 10, then a wall
const WALL_H = 8;
const BAND = 0.6;    // drawn thickness of the yellow track band
const FRICTION = { normal: 0.9, ice: 0.05, grip: 1.6 };

// Each level is the 2016 prototype's `slopes` format: segment angles in degrees, each segment segLen
// metres wide. Objects add features: {a, f} friction kind, {gap: w} a pit, {bridge: w} a rope bridge.
const LEVELS = [
  { name: "Bumps", segLen: 3,
    slopes: [0, 5, -5, 0, 8, 4, -6, -8, 0, 6, 10, 0, -10, -4, 0, 5, 8, -3, -8, 0, 6, -6, 0, 10, 0, -8, 0, 4, 0, 0] },
  { name: "Steep places", segLen: 3,
    slopes: [0, 10, 20, 30, 20, 0, -20, -30, 0, 0, 15, 25, 35, 35, 10, 0, -25, -35, -20, 0, 10, 30, 35, 20, 0, -30, -15, 0, 0, 0] },
  { name: "Pitfalls", segLen: 3,
    slopes: [0, 5, 0, { gap: 1.5 }, 0, -5, 5, 0, { gap: 2.5 }, 0, 10, 0, -10, { gap: 2 }, 0, 0, 15, 0, { gap: 3.5 }, -10, 0, 5, 0, { gap: 2.5 }, 0, 0] },
  { name: "Rope bridge", segLen: 3,
    slopes: [0, 0, 5, 0, { bridge: 8 }, 0, -5, 10, 15, 0, { bridge: 12 }, 0, -10, 0, 5, 0, 0] },
  { name: "Friction varies", segLen: 3,
    slopes: [0, 0, { a: 10, f: "ice" }, { a: 15, f: "ice" }, 0, { a: 20, f: "grip" }, { a: 30, f: "grip" }, 0, -10,
      { a: -20, f: "ice" }, 0, { a: 15, f: "ice" }, 25, 0, { a: 30, f: "grip" }, { a: 35, f: "grip" }, 0,
      { a: -15, f: "ice" }, { a: 20, f: "ice" }, 0, 0] },
];

const Tracks = {
  count: LEVELS.length,
  name(i) { return LEVELS[i].name; },

  build(i) {
    const L = LEVELS[i];
    const segments = [], runs = [], gaps = [], bridges = [];
    let cur = null, x = 0, y = 0;
    const addSeg = (x0, y0, x1, y1, kind) => {
      segments.push({ x0, y0, x1, y1, kind });
      if (!cur || cur.kind !== kind) { cur = { kind, points: [{ x: x0, y: y0 }] }; runs.push(cur); }
      cur.points.push({ x: x1, y: y1 });
    };
    addSeg(-RUNUP, 0, 0, 0, "normal");
    for (const e of L.slopes) {
      if (typeof e === "object" && (e.gap || e.bridge)) {
        const w = e.gap || e.bridge;
        const drop = e.gap ? (e.drop ?? 0.3) : 0;
        (e.gap ? gaps : bridges).push({ x0: x, x1: x + w, y0: y, y1: y - drop });
        x += w; y -= drop; cur = null;
        continue;
      }
      const a = typeof e === "number" ? e : e.a;
      const kind = (typeof e === "object" && e.f) || "normal";
      const dy = Math.tan(a * Math.PI / 180) * L.segLen;
      addSeg(x, y, x + L.segLen, y + dy, kind);
      x += L.segLen; y += dy;
    }
    const scoreEndX = x;
    addSeg(x, y, x + RUNOUT, y, "normal");
    const walls = [
      { x0: -RUNUP, y0: 0, x1: -RUNUP, y1: WALL_H },
      { x0: x + RUNOUT, y0: y, x1: x + RUNOUT, y1: y + WALL_H },
    ];
    const minY = Math.min(...segments.map(s => Math.min(s.y0, s.y1)));
    return { name: L.name, segments, runs, gaps, bridges, walls,
      spawnX: -RUNUP / 2, scoreStartX: 0, scoreEndX, endX: x + RUNOUT, minY };
  },

  // Plank joint points along a sagging parabola (sag 6% of span), ~0.5 m planks of equal chord length.
  bridgePlanks(b) {
    const w = b.x1 - b.x0, sag = 0.06 * w, N = 400;
    const pts = [], cum = [0];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push({ x: b.x0 + w * t, y: b.y0 + (b.y1 - b.y0) * t - 4 * sag * t * (1 - t) });
      if (i > 0) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    const n = Math.ceil(w / 0.5 - 1e-9), total = cum[N], out = [];
    let j = 0;
    for (let k = 0; k <= n; k++) {
      const s = total * k / n;
      while (j < N - 1 && cum[j + 1] < s) j++;
      const f = Math.min(1, (s - cum[j]) / (cum[j + 1] - cum[j]));
      out.push({ x: pts[j].x + (pts[j + 1].x - pts[j].x) * f, y: pts[j].y + (pts[j + 1].y - pts[j].y) * f });
    }
    return out;
  },

  // Track surface height under x. Over a gap or bridge: the lower rim. Outside the track: nearest end.
  groundYAt(geom, x) {
    for (const s of geom.segments) if (x >= s.x0 && x <= s.x1) return s.y0 + (s.y1 - s.y0) * (x - s.x0) / (s.x1 - s.x0);
    for (const h of [...geom.gaps, ...geom.bridges]) if (x > h.x0 && x < h.x1) return Math.min(h.y0, h.y1);
    const first = geom.segments[0], last = geom.segments[geom.segments.length - 1];
    return x < first.x0 ? first.y0 : last.y1;
  },
};

const Score = {
  scoreFor(x, geom) {
    const f = (x - geom.scoreStartX) / (geom.scoreEndX - geom.scoreStartX);
    return Math.max(0, Math.min(10, Math.floor(10 * f + 1e-9)));
  },
};

// Watches one run. Ends it as stuck (< 0.3 m new progress in 3 s), flipped (|angle| > 120° for 1.5 s),
// fell (4 m under the track surface, or 5 m under its lowest point), or win (score 10).
class RunMonitor {
  constructor(geom) {
    this.geom = geom; this.t = 0; this.score = 0;
    this.bestX = -Infinity; this.gainX = null; this.gainT = 0; this.flipT = 0;
  }
  update(dt, s) {
    this.t += dt;
    if (this.gainX === null) { this.gainX = s.x; this.gainT = this.t; }
    if (s.x > this.bestX) this.bestX = s.x;
    if (this.bestX > this.gainX + 0.3) { this.gainX = this.bestX; this.gainT = this.t; }
    this.score = Math.max(this.score, Score.scoreFor(this.bestX, this.geom));
    if (this.score >= 10) return "win";
    if (s.y < this.geom.minY - 5 || s.y < Tracks.groundYAt(this.geom, s.x) - 4) return "fell";
    const a = Math.atan2(Math.sin(s.angle), Math.cos(s.angle));
    this.flipT = Math.abs(a) > 2 * Math.PI / 3 ? this.flipT + dt : 0;
    if (this.flipT > 1.5 + 1e-9) return "flipped";
    if (this.t - this.gainT > 3) return "stuck";
    return null;
  }
}

const WHEEL_TYPES = [
  { name: "smooth", friction: 0.6 },
  { name: "hex", friction: 0.9 },
  { name: "gear", friction: 1.4 },
];
const SLIDERS = [
  { key: "rearRadius", label: "Rear wheel", min: 3, max: 12, def: 5, show: v => (v / 10).toFixed(1) + " m" },
  { key: "frontRadius", label: "Front wheel", min: 3, max: 12, def: 5, show: v => (v / 10).toFixed(1) + " m" },
  { key: "wheelType", label: "Wheel type", min: 0, max: 2, def: 1, show: v => WHEEL_TYPES[v].name },
  { key: "motorSpeed", label: "Motor speed", min: 2, max: 14, def: 6, show: v => v + " rad/s" },
  { key: "motorTorque", label: "Motor torque", min: 1, max: 10, def: 4, show: v => v * 20 + " N·m" },
  { key: "legLength", label: "Leg length", min: 1, max: 8, def: 4, show: v => (v * 0.2).toFixed(1) + " m" },
  { key: "chassisWidth", label: "Chassis width", min: 2, max: 6, def: 4, show: v => v + " m" },
  { key: "chassisHeight", label: "Chassis height", min: 1, max: 5, def: 2, show: v => (v * 0.2).toFixed(1) + " m" },
  { key: "suspension", label: "Suspension", min: 1, max: 10, def: 4, show: v => v + " Hz" },
  { key: "cargo", label: "Cargo", min: 0, max: 6, def: 4, show: v => v + (v === 1 ? " block" : " blocks") },
  { key: "fuel", label: "Booster fuel", min: 0, max: 5, def: 2, show: v => v + " s" },
];
// Cargo block sizes (w, h) in metres; the first four are the Car6 blocks (15x10, 20x40, 25x30, 15x20 px at 50 px/m).
const CARGO_BLOCKS = [[0.3, 0.2], [0.4, 0.8], [0.5, 0.6], [0.3, 0.4], [0.3, 0.3], [0.25, 0.5]];

const VehicleConfig = {
  SLIDERS, WHEEL_TYPES,
  defaults() {
    const v = {};
    for (const s of SLIDERS) v[s.key] = s.def;
    return v;
  },
  clamp(values) {
    const out = {};
    for (const s of SLIDERS) {
      let x = Math.round(Number(values == null ? NaN : values[s.key]));
      if (!Number.isFinite(x)) x = s.def;
      out[s.key] = Math.max(s.min, Math.min(s.max, x));
    }
    return out;
  },
  toPhysicsSpec(values) {
    const v = VehicleConfig.clamp(values);
    const w = v.chassisWidth, h = v.chassisHeight * 0.2, leg = v.legLength * 0.2;
    const wx = Math.max(w / 2 - 0.8, 0.3 * w);
    const wt = WHEEL_TYPES[v.wheelType];
    const axleY = -h / 2 - leg;
    const wheels = [
      { x: -wx, y: axleY, r: v.rearRadius / 10, friction: wt.friction, type: wt.name },
      { x: wx, y: axleY, r: v.frontRadius / 10, friction: wt.friction, type: wt.name },
    ];
    const posts = [-1, 1].map(sx => ({ x: sx * (w / 2 - 0.1), y: h / 2 + 0.15, hx: 0.1, hy: 0.15 }));
    const legs = wheels.map(wh => ({ x: wh.x, top: -h / 2, bottom: axleY, hw: 0.1 }));
    // Cargo packed left to right, centred on the bed, squeezed to fit between the posts.
    const blocks = CARGO_BLOCKS.slice(0, v.cargo), gap = 0.04, room = w - 0.5;
    const total = blocks.reduce((s, b) => s + b[0], 0) + gap * Math.max(0, blocks.length - 1);
    const k = total > room ? room / total : 1;
    const cargo = [];
    let x = -total * k / 2;
    for (const [bw, bh] of blocks) {
      cargo.push({ x: x + bw * k / 2, y: h / 2 + 0.01 + bh / 2, w: bw * k, h: bh });
      x += (bw + gap) * k;
    }
    return { chassis: { w, h }, posts, legs, wheels, cargo,
      motor: { speed: v.motorSpeed, torque: v.motorTorque * 20 },
      spring: { hz: v.suspension, damping: 0.7 }, fuel: v.fuel };
  },
};

const Save = {
  KEY: "lithium.v1",
  fresh() {
    return { values: VehicleConfig.defaults(), unlocked: 1, best: [0, 0, 0, 0, 0], level: 0, muted: false };
  },
  sanitize(raw) {
    const s = Save.fresh();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return s;
    s.values = VehicleConfig.clamp(raw.values);
    const int = (x, lo, hi, d) => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    s.unlocked = int(raw.unlocked, 1, Tracks.count, 1);
    if (Array.isArray(raw.best)) s.best = s.best.map((_, i) => int(raw.best[i], 0, 10, 0));
    s.level = int(raw.level, 0, s.unlocked - 1, 0);
    s.muted = !!raw.muted;
    return s;
  },
};
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `node game-lithium/test.mjs`
Expected: `(PLANCK_PATH not set: skipping physics tests)` then `15 passed, 0 failed`, exit code 0.
If the steepest-slope or pitfall-gap tests fail, fix the implementation, not the test.

- [ ] **Step 6: Commit**

```bash
git add game-lithium/index.html game-lithium/test.mjs
git commit -m "game-lithium: tracks, vehicle sliders, scoring and run monitor with tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: planck simulation and headless physics tests

**Files:**
- Modify: `game-lithium/index.html` (shared-code block: add `createSim`, `Sim.runHeadless`, `SOLUTIONS`; replace `physics() {}` in `LithiumTests`)

**Interfaces:**
- Consumes: `Tracks.build`, `Tracks.bridgePlanks`, `VehicleConfig.toPhysicsSpec`, `RunMonitor`, `FRICTION` (Task 1).
- Produces:
  - `createSim(pl, levelIndex, values, opts = {}) → Sim`.
  - `Sim = {geom, spec, world, chassis, wheels:[Body], cargo:[Body], planks:[Body], mass, fuel (getter), running (getter), t, start(), stop(), step(input={boost:false, tilt:0}) → {boosting, impact}, state() → {x,y,angle}, wheelSpeed() → rad/s}`.
  - Body user data: `{kind: "ground"|"chassis"|"wheel"|"cargo"|"plank", ...}`; wheels also `{type, r}`, planks also `{len}`.
  - `Sim.runHeadless(pl, level, values, {maxT = 90, input = () => ({})}) → {result, score, t}`.
  - `SOLUTIONS[level] = {values, note}`: one known-passing slider set per level (Task 6 tunes them).
- `opts.motorSpeed` overrides the slider speed (tests only).

- [ ] **Step 1: Fetch planck for Node into the scratchpad (not the repo)**

```bash
mkdir -p "$SCRATCH/planck" && curl -s -o "$SCRATCH/planck/planck.mjs" https://cdn.jsdelivr.net/npm/planck@1.5.1/dist/planck.mjs
```
(`$SCRATCH` = the session scratchpad directory.)

- [ ] **Step 2: Write the failing physics tests — replace `physics() {},` in `LithiumTests` with**

```js
  physics(pl, test, ok) {
    test("sim builds every level and the car settles on the run-up", () => {
      for (let i = 0; i < Tracks.count; i++) {
        const sim = createSim(pl, i, VehicleConfig.defaults());
        for (let k = 0; k < 120; k++) sim.step();
        const s = sim.state();
        ok(Math.abs(s.x - sim.geom.spawnX) < 0.5 && s.y > 0.3 && s.y < 3 && Math.abs(s.angle) < 0.2,
          `level ${i} settled at ${JSON.stringify(s)}`);
      }
    });
    test("bridges hold their planks", () => {
      const sim = createSim(pl, 3, VehicleConfig.defaults());
      ok(sim.planks.length === 16 + 24, "planks " + sim.planks.length);
      for (let k = 0; k < 120; k++) sim.step();
      const lowest = Math.min(...sim.planks.map(b => b.getPosition().y));
      ok(lowest > sim.geom.minY - 3, "planks fell: " + lowest);
    });
    test("zero motor speed ends stuck", () => {
      const r = Sim.runHeadless(pl, 0, VehicleConfig.defaults(), { maxT: 10, opts: { motorSpeed: 0 } });
      ok(r.result === "stuck", JSON.stringify(r));
    });
    test("every level has a known slider solution", () => {
      ok(SOLUTIONS.length === Tracks.count, "one per level");
      ok(JSON.stringify(VehicleConfig.clamp(SOLUTIONS[0].values)) === JSON.stringify(VehicleConfig.defaults()), "level 1 = defaults");
      for (let i = 0; i < Tracks.count; i++) {
        const r = Sim.runHeadless(pl, i, SOLUTIONS[i].values, { maxT: 120 });
        ok(r.result === "win", `level ${i + 1}: ${JSON.stringify(r)}`);
      }
    });
    test("extreme sliders stay finite", () => {
      const S = VehicleConfig.SLIDERS, lo = {}, hi = {};
      for (const s of S) { lo[s.key] = s.min; hi[s.key] = s.max; }
      const combos = [lo, hi,
        { ...hi, legLength: 1, chassisWidth: 2, chassisHeight: 1 },
        { ...lo, legLength: 8, chassisWidth: 6, cargo: 6, motorTorque: 10, motorSpeed: 14 },
        { ...hi, rearRadius: 3, frontRadius: 12, suspension: 1 }];
      for (const v of combos) for (const lvl of [1, 3]) {
        const sim = createSim(pl, lvl, v);
        sim.start();
        for (let k = 0; k < 600; k++) sim.step({ boost: k % 120 < 30, tilt: k % 200 < 50 ? 1 : 0 });
        const s = sim.state(), vel = sim.chassis.getLinearVelocity();
        ok([s.x, s.y, s.angle, vel.x, vel.y].every(Number.isFinite), "NaN " + JSON.stringify(v));
        ok(Math.hypot(vel.x, vel.y) < 60, "exploded " + JSON.stringify(v));
      }
    });
  },
```

- [ ] **Step 3: Run with planck and watch them fail**

Run: `PLANCK_PATH="$SCRATCH/planck/planck.mjs" node game-lithium/test.mjs`
Expected: the 15 Task 1 tests pass; the 5 physics tests fail with `createSim is not defined` / `Sim is not defined` / `SOLUTIONS is not defined`; exit 1.

- [ ] **Step 4: Add the simulation to the shared-code block, just before `const LithiumTests`**

```js
// Builds the planck world for one level and one slider set. Wheel motors start braked (speed 0):
// the garage shows the car resting on its suspension; start() releases them.
function createSim(pl, levelIndex, values, opts = {}) {
  const geom = Tracks.build(levelIndex);
  const spec = VehicleConfig.toPhysicsSpec(values);
  const world = new pl.World({ gravity: pl.Vec2(0, -10) });

  const ground = world.createBody({ type: "static" });
  ground.setUserData({ kind: "ground" });
  for (const run of geom.runs) {
    ground.createFixture(new pl.Chain(run.points.map(p => pl.Vec2(p.x, p.y)), false), { friction: FRICTION[run.kind] });
  }
  for (const wl of geom.walls) ground.createFixture(new pl.Edge(pl.Vec2(wl.x0, wl.y0), pl.Vec2(wl.x1, wl.y1)), { friction: 0.5 });

  const planks = [];
  for (const b of geom.bridges) {
    const pts = Tracks.bridgePlanks(b);
    let prev = ground;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const body = world.createDynamicBody({ position: pl.Vec2((p0.x + p1.x) / 2, (p0.y + p1.y) / 2), angle: Math.atan2(p1.y - p0.y, p1.x - p0.x) });
      body.createFixture(new pl.Box(len / 2, 0.1, pl.Vec2(0, -0.1), 0), { density: 20, friction: 0.9 });
      body.setUserData({ kind: "plank", len });
      world.createJoint(new pl.RevoluteJoint({}, prev, body, pl.Vec2(p0.x, p0.y)));
      prev = body;
      planks.push(body);
    }
    world.createJoint(new pl.RevoluteJoint({}, prev, ground, pl.Vec2(b.x1, b.y1)));
  }

  // The car. The run-up is flat at y = 0; lift the chassis so the lower wheel just clears it.
  const x0 = geom.spawnX;
  const lift = Math.max(...spec.wheels.map(w => w.r - w.y)) + 0.05;
  const chassis = world.createDynamicBody({ position: pl.Vec2(x0, lift) });
  chassis.setUserData({ kind: "chassis" });
  chassis.createFixture(new pl.Box(spec.chassis.w / 2, spec.chassis.h / 2), { density: 20, friction: 0.6 });
  for (const p of spec.posts) chassis.createFixture(new pl.Box(p.hx, p.hy, pl.Vec2(p.x, p.y), 0), { density: 20, friction: 0.6 });
  // Legs add mass but never collide (filterMaskBits 0); they are drawn to the axle.
  for (const l of spec.legs) {
    chassis.createFixture(new pl.Box(l.hw, (l.top - l.bottom) / 2, pl.Vec2(l.x, (l.top + l.bottom) / 2), 0), { density: 10, filterMaskBits: 0 });
  }
  const wheels = [], joints = [];
  for (const w of spec.wheels) {
    const wb = world.createDynamicBody({ position: pl.Vec2(x0 + w.x, lift + w.y) });
    wb.createFixture(new pl.Circle(w.r), { density: 6, friction: w.friction, filterGroupIndex: -1 });
    wb.setUserData({ kind: "wheel", type: w.type, r: w.r });
    joints.push(world.createJoint(new pl.WheelJoint({
      enableMotor: true, motorSpeed: 0, maxMotorTorque: spec.motor.torque,
      frequencyHz: spec.spring.hz, dampingRatio: spec.spring.damping,
    }, chassis, wb, wb.getPosition(), pl.Vec2(0, 1))));
    wheels.push(wb);
  }
  const cargo = spec.cargo.map(c => {
    const b = world.createDynamicBody({ position: pl.Vec2(x0 + c.x, lift + c.y) });
    b.createFixture(new pl.Box(c.w / 2, c.h / 2), { density: 8, friction: 0.7 });
    b.setUserData({ kind: "cargo" });
    return b;
  });
  const mass = [chassis, ...wheels, ...cargo].reduce((s, b) => s + b.getMass(), 0);

  // Strongest contact impulse on the car during the last step, for the thump sound.
  let impact = 0;
  const carKinds = new Set(["chassis", "wheel", "cargo"]);
  world.on("post-solve", (contact, imp) => {
    const ka = contact.getFixtureA().getBody().getUserData()?.kind;
    const kb = contact.getFixtureB().getBody().getUserData()?.kind;
    if (!carKinds.has(ka) && !carKinds.has(kb)) return;
    const n = (imp.normalImpulses[0] || 0) + (imp.normalImpulses[1] || 0);
    if (n > impact) impact = n;
  });

  let fuel = spec.fuel, running = false;
  const BOOST_ACC = 18;  // m/s² of booster thrust per kg of car
  const TILT_ACC = 6;    // N·m of tilt torque per kg of car
  const sim = {
    geom, spec, world, chassis, wheels, cargo, planks, mass, t: 0,
    get fuel() { return fuel; },
    get running() { return running; },
    start() {
      running = true;
      const speed = opts.motorSpeed ?? spec.motor.speed;
      for (const j of joints) j.setMotorSpeed(-speed);  // negative = clockwise = drive right
    },
    stop() {
      running = false;
      for (const j of joints) j.setMotorSpeed(0);
    },
    step(input = {}) {
      impact = 0;
      let boosting = false;
      if (running && input.boost && fuel > 0) {
        const f = chassis.getWorldVector(pl.Vec2(1, 0));
        chassis.applyForceToCenter(pl.Vec2(f.x * BOOST_ACC * mass, f.y * BOOST_ACC * mass), true);
        fuel = Math.max(0, fuel - 1 / 60);
        boosting = true;
      }
      if (running && input.tilt) chassis.applyTorque(-input.tilt * TILT_ACC * mass, true);
      world.step(1 / 60, 10, 8);
      sim.t += 1 / 60;
      return { boosting, impact: impact / mass };
    },
    state() {
      const p = chassis.getPosition();
      return { x: p.x, y: p.y, angle: chassis.getAngle() };
    },
    wheelSpeed() {
      return wheels.reduce((s, w) => s + Math.abs(w.getAngularVelocity()), 0) / wheels.length;
    },
  };
  return sim;
}

const Sim = {
  // Runs one level without rendering: settle 1 s braked, then drive until the monitor ends the run.
  runHeadless(pl, level, values, { maxT = 90, input = () => ({}), opts = {} } = {}) {
    const sim = createSim(pl, level, values, opts);
    for (let k = 0; k < 60; k++) sim.step();
    sim.start();
    const mon = new RunMonitor(sim.geom);
    let result = null;
    while (!result && mon.t < maxT) {
      sim.step(input(mon.t, sim));
      result = mon.update(1 / 60, sim.state());
    }
    return { result: result || "timeout", score: mon.score, t: Math.round(mon.t * 10) / 10 };
  },
};

// One known-passing slider set per level, sliders only (no booster or tilt input). Level 1 is the
// default car. Task 6 tunes these by search; the test proves every level is passable.
const SOLUTIONS = [
  { note: "the Car6 default car", values: VehicleConfig.defaults() },
  { note: "big grippy wheels, no cargo", values: { ...VehicleConfig.defaults(), rearRadius: 8, frontRadius: 8, wheelType: 2, motorTorque: 8, cargo: 0, chassisWidth: 5, suspension: 3 } },
  { note: "a long chassis spans the pits", values: { ...VehicleConfig.defaults(), chassisWidth: 6, rearRadius: 7, frontRadius: 7, motorSpeed: 10, motorTorque: 6, wheelType: 2 } },
  { note: "slow and grippy over the bridges", values: { ...VehicleConfig.defaults(), motorSpeed: 5, wheelType: 2 } },
  { note: "heavy and fast on ice", values: { ...VehicleConfig.defaults(), wheelType: 2, motorSpeed: 12, motorTorque: 8, cargo: 6 } },
];
```

- [ ] **Step 5: Run with planck**

Run: `PLANCK_PATH="$SCRATCH/planck/planck.mjs" node game-lithium/test.mjs`
Expected: all tests pass except possibly "every level has a known slider solution" for levels 2–5 (the starting guesses are untuned). Level 1 (defaults) must win; if it does not, change the physics constants in `createSim` (densities, `FRICTION.normal`) rather than the test. Remaining solution failures are expected here and are fixed in Task 6 Step 1, so note which levels fail and continue. Also run without `PLANCK_PATH` and confirm the 15 pure tests still pass.

- [ ] **Step 6: Commit**

```bash
git add game-lithium/index.html
git commit -m "game-lithium: planck simulation, headless runner and physics tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Flat three.js renderer and live garage preview

**Files:**
- Modify: `game-lithium/index.html` (add `<style>`, the canvas, the module script)

**Interfaces:**
- Consumes: `createSim`, `Tracks`, `BAND`, `VehicleConfig` (Tasks 1–2).
- Produces (inside the module script, used by Tasks 4–5): `C` colour table, `M(color)`, `polyMesh(points, color, z)`, `rectPts(cx, cy, hx, hy)`, `buildWorld()` (fills `world.static`, `world.dynamic`), `disposeWorld()`, `updateCamera(dt, snap)`, `render()`, `resize()`, globals `sim`, `scene`, `camera`, `renderer`, `level`, `values`, `mode`, `chassisGroup`, `flameGroup`.

- [ ] **Step 1: Add the style and canvas inside `<head>`/`<body>` (before the shared-code script)**

```html
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #0000ff; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #fff; user-select: none; }
  #view { position: fixed; inset: 0; display: block; }
</style>
```
```html
<canvas id="view"></canvas>
```

- [ ] **Step 2: Add the module script after the shared-code script**

```html
<script type="module">
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import * as planck from "https://cdn.jsdelivr.net/npm/planck@1.5.1/dist/planck.mjs";

const C = {
  sky: 0x0000ff, track: 0xffff00, ice: 0xffff99, grip: 0xffcc00, black: 0x000000,
  tyre: 0x5a5a5a, hub: 0xe0e0e0, gearRing: 0x6e6e6e, gearDisc: 0x9a9a9a, cargo: 0x00ff00,
  red: 0xff0000, green: 0x00ff00, spark: 0xffff00,
};
const KIND_COLOR = { normal: C.track, ice: C.ice, grip: C.grip };
const MIN_VIEW_H = 9, VIEW_W = 18;

const canvas = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setClearColor(C.sky);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

// At least VIEW_W metres wide and MIN_VIEW_H metres tall, whatever the window shape.
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(w, h);
  let halfW = VIEW_W / 2, halfH = halfW * h / w;
  if (halfH * 2 < MIN_VIEW_H) { halfH = MIN_VIEW_H / 2; halfW = halfH * w / h; }
  camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}
addEventListener("resize", () => { resize(); updateCamera(0, true); render(); });

const materials = new Map();
function M(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshBasicMaterial({ color }));
  return materials.get(color);
}
function polyMesh(points, color, z) {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, p.y)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), M(color));
  m.position.z = z;
  return m;
}
function rectPts(cx, cy, hx, hy) {
  return [{ x: cx - hx, y: cy - hy }, { x: cx + hx, y: cy - hy }, { x: cx + hx, y: cy + hy }, { x: cx - hx, y: cy + hy }];
}
function circleMesh(r, color, z) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), M(color));
  m.position.z = z;
  return m;
}
function ngonPts(r, n, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) }); }
  return pts;
}
// Gear outline like the prototype's cog wheels: flat-topped teeth around a disc.
function gearPts(rOut, rIn, teeth) {
  const pts = [], step = 2 * Math.PI / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [f, r] of [[0, rIn], [0.15, rOut], [0.5, rOut], [0.65, rIn]]) {
      pts.push({ x: r * Math.cos(a + f * step), y: r * Math.sin(a + f * step) });
    }
  }
  return pts;
}
function spoke(r, z) { return polyMesh([{ x: 0, y: -0.03 }, { x: r, y: -0.03 }, { x: r, y: 0.03 }, { x: 0, y: 0.03 }], C.black, z); }

function wheelObject(w) {
  const g = new THREE.Group();
  if (w.type === "gear") {
    g.add(polyMesh(gearPts(w.r, w.r * 0.86, Math.max(8, Math.round(w.r * 20))), C.gearRing, 2));
    g.add(circleMesh(w.r * 0.78, C.gearDisc, 2.1));
    g.add(spoke(w.r * 0.75, 2.2));
  } else if (w.type === "hex") {
    g.add(circleMesh(w.r, C.tyre, 2));
    g.add(polyMesh(ngonPts(w.r * 0.42, 6, 0.3), C.hub, 2.1));
  } else {
    g.add(circleMesh(w.r, C.tyre, 2));
    g.add(circleMesh(w.r * 0.35, C.hub, 2.1));
    g.add(spoke(w.r * 0.9, 2.2));
  }
  return g;
}

// Scene objects: `static` never moves (track, walls); `dynamic` follows a planck body.
const world = { static: [], dynamic: [] };
let chassisGroup = null, flameGroup = null;

function buildWorld() {
  const geom = sim.geom, spec = sim.spec;
  for (const s of geom.segments) {
    // Adjacent quads at different angles leave the small notches the SpriteKit track showed.
    const m = polyMesh([{ x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }, { x: s.x1, y: s.y1 - BAND }, { x: s.x0, y: s.y0 - BAND }], KIND_COLOR[s.kind], 0);
    world.static.push(m);
  }
  for (const wl of geom.walls) {
    const dir = wl.x0 < 0 ? -1 : 1;
    world.static.push(polyMesh(rectPts(wl.x0 + dir * BAND / 2, (wl.y0 + wl.y1) / 2 - BAND / 2, BAND / 2, (wl.y1 - wl.y0) / 2 + BAND / 2), C.track, 0));
  }
  for (const o of world.static) scene.add(o);

  chassisGroup = new THREE.Group();
  chassisGroup.add(polyMesh(rectPts(0, 0, spec.chassis.w / 2, spec.chassis.h / 2), C.black, 1));
  for (const p of spec.posts) chassisGroup.add(polyMesh(rectPts(p.x, p.y, p.hx, p.hy), C.black, 1));
  for (const l of spec.legs) chassisGroup.add(polyMesh(rectPts(l.x, (l.top + l.bottom) / 2, l.hw, (l.top - l.bottom) / 2), C.black, 0.9));
  flameGroup = new THREE.Group();
  flameGroup.visible = false;
  chassisGroup.add(flameGroup);
  world.dynamic.push({ body: sim.chassis, obj: chassisGroup });
  sim.wheels.forEach((b, i) => world.dynamic.push({ body: b, obj: wheelObject(spec.wheels[i]) }));
  sim.cargo.forEach((b, i) => {
    const c = spec.cargo[i];
    world.dynamic.push({ body: b, obj: polyMesh(rectPts(0, 0, c.w / 2, c.h / 2), C.cargo, 1.5) });
  });
  for (const b of sim.planks) {
    const len = b.getUserData().len;
    world.dynamic.push({ body: b, obj: polyMesh(rectPts(0, -0.1, len / 2 - 0.02, 0.1), C.track, 0.2) });
  }
  for (const d of world.dynamic) scene.add(d.obj);
  syncBodies();
}

function disposeWorld() {
  const all = [...world.static, ...world.dynamic.map(d => d.obj)];
  for (const o of all) {
    scene.remove(o);
    o.traverse(n => { if (n.geometry) n.geometry.dispose(); });  // materials are shared, kept
  }
  world.static = []; world.dynamic = [];
}

function syncBodies() {
  for (const d of world.dynamic) {
    const p = d.body.getPosition();
    d.obj.position.set(p.x, p.y, 0);
    d.obj.rotation.z = d.body.getAngle();
  }
}

const cam = { x: 0, y: 0 };
function panelWorldWidth() {
  const panel = document.getElementById("panel");
  if (!panel || mode !== "garage") return 0;
  return panel.getBoundingClientRect().right / innerWidth * (camera.right - camera.left);
}
function updateCamera(dt, snap) {
  const s = sim.state();
  const tx = mode === "garage" ? s.x - panelWorldWidth() / 2 : s.x + 2;
  const ty = Math.max(s.y + 0.5, sim.geom.minY - 2);
  if (snap) { cam.x = tx; cam.y = ty; }
  else { const k = 1 - Math.exp(-dt * 4); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; }
  camera.position.set(cam.x, cam.y, 5);
}

function render() {
  syncBodies();
  renderer.render(scene, camera);
}

// ---- state (Task 4 replaces the bootstrap below with the game flow) ----
let level = 0, values = VehicleConfig.defaults(), mode = "garage", sim = null;
function rebuild() {
  if (sim) disposeWorld();
  sim = createSim(planck, level, values);
  buildWorld();
  updateCamera(0, true);
}
resize();
rebuild();
const STEP = 1 / 60;
let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) { sim.step(); acc -= STEP; n++; }
  if (n === 5) acc = 0;  // drop the backlog after a stall instead of catching up
  updateCamera(dt, false);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__lithium = { get sim() { return sim; }, render, THREE, planck };
</script>
```

- [ ] **Step 3: Verify in the Browser pane**

Use the gitignored `.claude/launch.json` "static" server (http on 8765, see memory note on Browser pane localStorage) or open the file directly.
- `preview_start` the static server, navigate to `/game-lithium/`.
- `read_console_messages` → no errors.
- Screenshot: blue background, flat yellow run-up, black chassis with two posts and legs, two grey wheels with light hexagon hubs, four green blocks on the bed. The car drops in and settles; nothing jitters.
- `javascript_tool`: `__lithium.sim.state()` → `x ≈ -4`, `y` about 1.2–1.4, angle ≈ 0.
- `resize_window` to 1600×500 and 500×1000 (Review Focus 1): the car stays fully visible both times. Reset with preset desktop.

- [ ] **Step 4: Run tests (unchanged logic must still pass) and commit**

Run: `node game-lithium/test.mjs` → `15 passed, 0 failed`.

```bash
git add game-lithium/index.html
git commit -m "game-lithium: flat three.js renderer with the car resting in the garage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Game flow, UI, input, persistence

**Files:**
- Modify: `game-lithium/index.html` (HTML overlay, CSS, replace the Task 3 bootstrap section)

**Interfaces:**
- Consumes: everything from Task 3; `RunMonitor`, `Save`, `VehicleConfig.SLIDERS`, `Tracks.name` (Task 1).
- Produces: `startRun()`, `stopRun()`, `endRun(reason)`, `winRun()`, `tick()`, `keys` (held key set), `save` object, `persist()`, `ui` element table, `setButton()`, `updateHud()`, `__lithium` debug handle with `step(n, input)`, `start()`, `setLevel(i)`, `setValues(v)`.
- Task 5 hooks: `tick()` calls `afterStep(result)` and `render()` calls `drawEffects(dt)`. Task 4 defines both as no-ops.

- [ ] **Step 1: Add the overlay HTML after the canvas**

```html
<div id="score">0</div>
<div id="caption"></div>
<div id="fuel"><div id="fuelFill"></div></div>
<div id="panel">
  <div id="levels"></div>
  <div id="sliders"></div>
  <button id="reset" type="button">reset car</button>
</div>
<button id="go" type="button">Start</button>
<div id="help">Enter start/stop · Space booster · ← → tilt · 1–5 level · M mute</div>
<div id="stats"></div>
```

- [ ] **Step 2: Add the overlay CSS to the `<style>` block**

```css
#score { position: fixed; top: 3vh; left: 0; right: 0; text-align: center; color: #ff0; font-weight: 700;
  font-size: clamp(56px, 13vh, 150px); line-height: 1; pointer-events: none; }
#caption { position: fixed; top: calc(3vh + clamp(56px, 13vh, 150px) + 6px); left: 0; right: 0; text-align: center;
  color: #ff0; font-weight: 700; font-size: clamp(16px, 2.6vh, 26px); pointer-events: none; }
#fuel { position: fixed; top: calc(3vh + clamp(56px, 13vh, 150px) + 44px); left: 50%; width: 160px; margin-left: -80px;
  height: 6px; background: rgba(255,255,255,0.25); display: none; pointer-events: none; }
#fuelFill { height: 100%; width: 100%; background: #ff0; }
#go { position: fixed; bottom: 4vh; left: 50%; transform: translateX(-50%); background: none; border: 0; padding: 0 0.2em;
  color: #ff0; font: 700 clamp(56px, 12vh, 140px)/1 "Helvetica Neue", Helvetica, Arial, sans-serif; cursor: pointer; }
#go:focus-visible { outline: 3px solid #fff; }
#panel { position: fixed; top: 0; left: 0; bottom: 0; width: 300px; padding: 18px 20px; box-sizing: border-box;
  background: rgba(0, 0, 90, 0.35); overflow-y: auto; }
#panel.hidden, #help.hidden { display: none; }
#levels { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
#levels button { flex: 1 1 100%; text-align: left; background: none; border: 1px solid rgba(255,255,255,0.35);
  color: #fff; font: 13px "Helvetica Neue", Helvetica, Arial, sans-serif; padding: 5px 8px; cursor: pointer; }
#levels button.current { border-color: #ff0; color: #ff0; }
#levels button:disabled { opacity: 0.35; cursor: default; }
.row { margin: 0 0 10px; font-size: 13px; }
.row .top { display: flex; justify-content: space-between; margin-bottom: 4px; }
.row .val { color: #ff0; }
input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 22px; background: none; margin: 0; }
input[type=range]::-webkit-slider-runnable-track { height: 2px;
  background: linear-gradient(to right, #3d8bff 0 var(--p), #c8c8c8 var(--p) 100%); }
input[type=range]::-moz-range-track { height: 2px; background: #c8c8c8; }
input[type=range]::-moz-range-progress { height: 2px; background: #3d8bff; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; margin-top: -9px;
  border-radius: 50%; background: #fff; border: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
input[type=range]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 0; }
#reset { background: none; border: 0; color: rgba(255,255,255,0.7); font-size: 12px; text-decoration: underline;
  cursor: pointer; padding: 0; }
#help { position: fixed; left: 12px; bottom: 8px; font-size: 12px; color: rgba(255,255,255,0.75); pointer-events: none; }
#panel:not(.hidden) ~ #help { left: 312px; }
#stats { position: fixed; right: 6px; bottom: 6px; padding: 2px 6px; background: rgba(0,0,0,0.25);
  font: 11px Menlo, Monaco, monospace; color: #fff; pointer-events: none; }
```

- [ ] **Step 3: Replace the Task 3 bootstrap (from `// ---- state` to the end of the module script) with the game flow**

```js
// ---- state ----
let save = Save.fresh();
try { save = Save.sanitize(JSON.parse(localStorage.getItem(Save.KEY) || "null")); } catch (e) { /* no storage */ }
function persist() {
  save.values = values; save.level = level;
  try { localStorage.setItem(Save.KEY, JSON.stringify(save)); } catch (e) { /* no storage */ }
}
let level = save.level, values = save.values, mode = "garage", sim = null, monitor = null;
let lastResult = "", lastScore = 0;

const ui = {
  score: document.getElementById("score"), caption: document.getElementById("caption"),
  fuel: document.getElementById("fuel"), fuelFill: document.getElementById("fuelFill"),
  panel: document.getElementById("panel"), levels: document.getElementById("levels"),
  sliders: document.getElementById("sliders"), reset: document.getElementById("reset"),
  go: document.getElementById("go"), help: document.getElementById("help"), stats: document.getElementById("stats"),
};

function rebuild() {
  if (sim) disposeWorld();
  sim = createSim(planck, level, values);
  buildWorld();
  updateCamera(0, true);
}

// Sliders: one row per VehicleConfig.SLIDERS entry; any change rebuilds the preview car.
const sliderInputs = {};
for (const s of VehicleConfig.SLIDERS) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<div class="top"><span>${s.label}</span><span class="val"></span></div>`;
  const input = document.createElement("input");
  Object.assign(input, { type: "range", min: s.min, max: s.max, step: 1 });
  input.setAttribute("aria-label", s.label);
  input.addEventListener("input", () => {
    values = { ...values, [s.key]: Number(input.value) };
    syncSliders(); persist(); rebuild();
  });
  row.appendChild(input);
  ui.sliders.appendChild(row);
  sliderInputs[s.key] = { input, val: row.querySelector(".val"), s };
}
function syncSliders() {
  for (const { input, val, s } of Object.values(sliderInputs)) {
    input.value = values[s.key];
    input.style.setProperty("--p", ((values[s.key] - s.min) / (s.max - s.min) * 100) + "%");
    val.textContent = s.show(values[s.key]);
  }
}
ui.reset.addEventListener("click", () => { values = VehicleConfig.defaults(); syncSliders(); persist(); rebuild(); });

function renderLevels() {
  ui.levels.innerHTML = "";
  for (let i = 0; i < Tracks.count; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${i + 1}  ${Tracks.name(i)}` + (i < save.unlocked ? `  ·  best ${save.best[i]}` : "");
    b.disabled = i >= save.unlocked;
    if (i === level) b.classList.add("current");
    b.addEventListener("click", () => setLevel(i));
    ui.levels.appendChild(b);
  }
}
function setLevel(i) {
  if (mode !== "garage" || i < 0 || i >= save.unlocked) return;
  level = i; lastResult = ""; lastScore = 0;
  persist(); renderLevels(); rebuild(); updateHud();
}

function updateHud() {
  ui.score.textContent = mode === "garage" ? lastScore : monitor ? monitor.score : 0;
  ui.caption.textContent = mode === "garage"
    ? (lastResult || `level ${level + 1} · ${Tracks.name(level)}` + (save.best[level] ? ` · best ${save.best[level]}` : ""))
    : mode === "over" ? lastResult : "";
  const showFuel = mode === "run" && sim.spec.fuel > 0;
  ui.fuel.style.display = showFuel ? "block" : "none";
  if (showFuel) ui.fuelFill.style.width = (sim.fuel / sim.spec.fuel * 100) + "%";
  ui.go.textContent = mode === "run" ? "Stop" : "Start";
  ui.go.style.visibility = mode === "over" || mode === "win" ? "hidden" : "visible";
  ui.panel.classList.toggle("hidden", mode !== "garage");
}

function startRun() {
  if (document.activeElement) document.activeElement.blur();
  rebuild();
  sim.start();
  monitor = new RunMonitor(sim.geom);
  mode = "run";
  sound.ensure();
  updateHud();
}
function stopRun() {
  mode = "garage"; monitor = null;
  rebuild(); renderLevels(); updateHud();
}
function recordBest(score) {
  if (score > save.best[level]) save.best[level] = score;
  persist();
}
let overTimer = 0;
function endRun(reason) {
  mode = "over";
  lastScore = monitor.score;
  lastResult = `out at ${monitor.score} · ${reason}`;
  recordBest(monitor.score);
  updateHud();
  clearTimeout(overTimer);
  overTimer = setTimeout(() => { if (mode === "over") stopRun(); }, 1500);
}
// The prototype's winnerSequence: the background flashes white/black, then the next level opens.
function winRun() {
  mode = "win";
  recordBest(10);
  lastScore = 10;
  updateHud();
  sound.win();
  const seq = [1, 0, 1, 0, 1, 0, 1, 0, 1];
  let i = 0;
  const flash = () => {
    renderer.setClearColor(seq[i] ? 0xffffff : 0x000000);
    render();
    i++;
    if (i < seq.length) { setTimeout(flash, i < 2 ? 50 : 30); return; }
    setTimeout(() => {
      renderer.setClearColor(C.sky);
      const next = level + 1;
      if (next < Tracks.count) {
        save.unlocked = Math.max(save.unlocked, next + 1);
        level = next; lastScore = 0; lastResult = `level ${next} cleared!`;
      } else {
        lastResult = "all tracks done!";
      }
      persist();
      stopRun();
    }, 300);
  };
  flash();
}

// ---- input ----
const keys = new Set();
addEventListener("keydown", e => {
  if (e.code === "Enter" || e.code === "NumpadEnter") {
    e.preventDefault();
    if (e.repeat) return;
    if (mode === "garage") startRun(); else if (mode === "run") stopRun();
    return;
  }
  if (e.code === "KeyM") { sound.toggleMute(); save.muted = sound.muted; persist(); return; }
  if (e.code === "KeyR" && mode === "run") { startRun(); return; }
  if (mode === "garage" && /^Digit[1-5]$/.test(e.code)) { setLevel(Number(e.code.slice(5)) - 1); return; }
  if (mode === "run" && ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) {
    e.preventDefault();
    keys.add(e.code);
  }
});
addEventListener("keyup", e => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
ui.go.addEventListener("click", () => { if (mode === "garage") startRun(); else if (mode === "run") stopRun(); });

// ---- loop ----
function afterStep(r) { /* Task 5: sound and sparks */ }
function drawEffects(dt) { /* Task 5: flame and sparks */ }
const sound = { ensure() {}, win() {}, toggleMute() {}, muted: save.muted, update() {} };  // Task 5 replaces

function tick() {
  if (mode === "garage") { sim.step(); return; }
  if (mode !== "run") return;  // over / win: the car is frozen
  const input = { boost: keys.has("Space"), tilt: (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0) };
  const r = sim.step(input);
  afterStep(r);
  const res = monitor.update(1 / 60, sim.state());
  if (res === "win") winRun(); else if (res) endRun(res);
}

const STEP = 1 / 60;
let acc = 0, last = performance.now(), fps = 60, statT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) { tick(); acc -= STEP; n++; }
  if (n === 5) acc = 0;  // drop the backlog after a stall instead of catching up
  updateCamera(dt, false);
  drawEffects(dt);
  render();
  if (mode === "run") updateHud();
  if (dt > 0) fps += (1 / dt - fps) * 0.05;
  statT += dt;
  if (statT > 0.25) {
    statT = 0;
    let nodes = 0;
    scene.traverse(() => nodes++);
    ui.stats.textContent = `nodes:${nodes} draws:${renderer.info.render.calls}  ${fps.toFixed(1)} fps`;
  }
  requestAnimationFrame(frame);
}

resize();
syncSliders();
renderLevels();
rebuild();
updateHud();
requestAnimationFrame(frame);

// Debug handle for headless screenshots (rAF does not advance under virtual time).
window.__lithium = {
  get sim() { return sim; }, get mode() { return mode; },
  start: startRun, setLevel, render,
  setValues(v) { values = VehicleConfig.clamp(v); syncSliders(); rebuild(); },
  step(n, input = {}) {
    for (let i = 0; i < n; i++) {
      if (mode === "run") { const r = sim.step(input); afterStep(r); const res = monitor.update(1 / 60, sim.state()); if (res) { if (res === "win") winRun(); else endRun(res); break; } }
      else sim.step();
      updateCamera(1 / 60, false);
    }
    updateHud(); drawEffects(0); render();
  },
};
```

Note: `render()` from Task 3 keeps its body (`syncBodies(); renderer.render(scene, camera);`); `drawEffects` always runs just before it.

- [ ] **Step 4: Verify in the Browser pane**

- Reload `/game-lithium/` on the static server. Console clean.
- Garage: the panel shows 5 level buttons (only level 1 enabled), 11 sliders with values. Drag "Front wheel" to max: the preview car rebuilds with a big front wheel and settles.
- Click Start → the panel hides, the number counts up as the car drives; the button reads Stop.
- Press Stop → back in the garage, car reset.
- Set Motor speed to 2 and Motor torque to 1 on level 1, Start → after ~3 s without progress the caption reads `out at N · stuck`, and 1.5 s later the garage is back with the caption kept.
- Review Focus 3: click a slider (focus it), press Enter → the run starts; during the run press Space/arrows → the page does not scroll and no slider moves.
- Review Focus 4: in `javascript_tool` run `localStorage.setItem("lithium.v1", "{bad json")` and reload → the garage loads with defaults. Then `localStorage.setItem("lithium.v1", JSON.stringify({unlocked: 99, level: 3, values: {cargo: 40}}))`, reload → levels 1–5 unlocked, level 4 selected, cargo 6.
- Review Focus 2: `javascript_tool` busy-loop 2 s (`const t=performance.now(); while(performance.now()-t<2000){}`) during a run → the car continues normally afterwards (no jump/explosion).
- Run the default car through level 1 to 10 → white/black flash, level 2 unlocked and selected, caption "level 1 cleared!".

- [ ] **Step 5: Run tests and commit**

Run: `node game-lithium/test.mjs` → `15 passed, 0 failed`.

```bash
git add game-lithium/index.html
git commit -m "game-lithium: garage sliders, Start/Stop, run monitor, win flash, levels and save

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Booster flame, sparks, and sound

**Files:**
- Modify: `game-lithium/index.html` (module script: flame meshes in `buildWorld`, replace the `afterStep`/`drawEffects`/`sound` stubs)

**Interfaces:**
- Consumes: `flameGroup`, `chassisGroup`, `sim.spec`, `sim.wheelSpeed()`, `sim.chassis`, `mode`, `save.muted` (Tasks 3–4); `step()` result `{boosting, impact}` (Task 2).
- Produces: `class Sound` with `ensure()`, `update(running, wheelSpeed, boosting)`, `thump(strength)`, `win()`, `toggleMute()`, `muted`; `let boosting`.

- [ ] **Step 1: Build the flame inside `buildWorld()` right after `flameGroup` is created**

```js
  // Booster flame (screenshot 1): a red triangle at the rear of the chassis, a long green one behind it,
  // a small yellow square at its tip.
  const rx = -spec.chassis.w / 2, hy = spec.chassis.h / 2;
  flameGroup.add(polyMesh([{ x: rx, y: hy * 0.8 }, { x: rx, y: -hy }, { x: rx - 0.55, y: -hy - 0.35 }], C.red, 0.8));
  const green = polyMesh([{ x: 0, y: 0 }, { x: 0.12, y: -0.22 }, { x: -1.1, y: -0.75 }], C.green, 0.7);
  green.position.set(rx - 0.5, -hy - 0.28, 0.7);
  green.name = "greenFlame";
  flameGroup.add(green);
  const tip = polyMesh(rectPts(0, 0, 0.07, 0.07), C.spark, 0.75);
  tip.name = "flameTip";
  tip.position.set(rx - 0.5 - 1.1, -hy - 0.28 - 0.75, 0.75);
  flameGroup.add(tip);
```

- [ ] **Step 2: Replace the `afterStep`, `drawEffects`, and `sound` stubs**

```js
// ---- effects ----
let boosting = false;
const sparks = [];
const sparkGeo = new THREE.PlaneGeometry(0.07, 0.07);
for (let i = 0; i < 40; i++) {
  const m = new THREE.Mesh(sparkGeo, M(C.spark));
  m.visible = false;
  m.position.z = 0.6;
  scene.add(m);
  sparks.push({ m, vx: 0, vy: 0, life: 0 });
}
let sparkIx = 0;
function emitSpark() {
  const tip = flameGroup.getObjectByName("flameTip");
  if (!tip) return;
  const p = new THREE.Vector3();
  tip.getWorldPosition(p);
  const back = sim.chassis.getWorldVector(planck.Vec2(-1, 0));
  const s = sparks[sparkIx++ % sparks.length];
  s.m.position.set(p.x, p.y, 0.6);
  s.vx = back.x * (2 + Math.random() * 2) + (Math.random() - 0.5);
  s.vy = back.y * (2 + Math.random() * 2) - Math.random();
  s.life = 0.5 + Math.random() * 0.3;
  s.m.visible = true;
}
function afterStep(r) {
  boosting = r.boosting;
  if (boosting && Math.random() < 0.5) emitSpark();
  if (r.impact > 1.2) sound.thump(r.impact);
}
function drawEffects(dt) {
  if (flameGroup) {
    flameGroup.visible = boosting && mode === "run";
    const g = flameGroup.getObjectByName("greenFlame");
    if (g) g.scale.set(0.8 + Math.random() * 0.4, 1, 1);
  }
  for (const s of sparks) {
    if (!s.m.visible) continue;
    s.life -= dt;
    if (s.life <= 0) { s.m.visible = false; continue; }
    s.vy -= 6 * dt;
    s.m.position.x += s.vx * dt;
    s.m.position.y += s.vy * dt;
  }
  sound.update(mode === "run", sim ? sim.wheelSpeed() : 0, boosting && mode === "run");
  if (mode !== "run") boosting = false;
}

// ---- sound ----
class Sound {
  constructor(muted) { this.ctx = null; this.muted = muted; this.lastThump = 0; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);
    // Motor hum: sawtooth through a lowpass, pitch follows wheel speed.
    this.motor = ctx.createOscillator();
    this.motor.type = "sawtooth";
    this.motor.frequency.value = 45;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 380;
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(lp).connect(this.motorGain).connect(this.master);
    this.motor.start();
    // One second of white noise, shared by the booster hiss and the thumps.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noise; hiss.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.8;
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 0;
    hiss.connect(bp).connect(this.boostGain).connect(this.master);
    hiss.start();
  }
  update(running, wheelSpeed, boost) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.motor.frequency.setTargetAtTime(45 + wheelSpeed * 9, t, 0.05);
    this.motorGain.gain.setTargetAtTime(running ? 0.05 : 0, t, 0.1);
    this.boostGain.gain.setTargetAtTime(boost ? 0.2 : 0, t, 0.03);
  }
  thump(strength) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastThump < 0.08) return;
    this.lastThump = t;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 260;
    const g = this.ctx.createGain();
    const v = 0.5 * Math.min(1, strength / 4);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.8, 0.2);
  }
  win() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.08, t0 + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.09 + 0.12);
      o.connect(g).connect(this.master);
      o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.13);
    });
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }
}
const sound = new Sound(save.muted);
```
Also add `sound.ensure()` to the Start button click and to the first `keydown` (so the audio context is created by a user gesture): in the keydown listener's first line add `sound.ensure();`, and in the `ui.go` click handler add `sound.ensure();` before starting.

- [ ] **Step 3: Verify in the Browser pane**

- Start a run, hold Space: the red + green flame shows behind the chassis, flickers, yellow sparks fall away, the fuel bar shrinks to empty after the slider's seconds, then the flame stops even with Space held.
- Hold ← in a run: the car tilts nose-up; → nose-down.
- Sound (pane visible, real time): add `get audio() { return sound; }` to `__lithium`. During a run, connect an AnalyserNode to `__lithium.audio.master` from `javascript_tool` and confirm RMS > 0 while driving and ≈ 0 after pressing M (memory note "Web Audio verification via analyser"; gain readbacks lie right after ramps, so meter the signal).
- Console clean.

- [ ] **Step 4: Run tests and commit**

Run: `node game-lithium/test.mjs` → `15 passed, 0 failed`.

```bash
git add game-lithium/index.html
git commit -m "game-lithium: booster flame and sparks, tilt, motor/booster/thump sound

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tune the levels, screenshot, README, gallery

**Files:**
- Modify: `game-lithium/index.html` (`SOLUTIONS`, possibly `LEVELS` and slider ranges, URL screenshot params)
- Create: `game-lithium/README.md`, `game-lithium/screenshot1.jpg`
- Modify: `gallery.yaml`
- Create (scratch, not committed): `$SCRATCH/search.mjs`

**Interfaces:**
- Consumes: `Sim.runHeadless`, `SOLUTIONS`, `VehicleConfig` (Task 2).
- Produces: a passing physics suite; the gallery entry.

- [ ] **Step 1: Find a slider solution per level with a random search script**

```js
// $SCRATCH/search.mjs — usage: node search.mjs <path to index.html> <path to planck.mjs> <level 0-4> [tries]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const [, , htmlPath, planckPath, lvl, tries = "300"] = process.argv;
const html = readFileSync(htmlPath, "utf8");
const code = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1];
const api = new Function(`${code}; return { Sim, VehicleConfig, SOLUTIONS };`)();
const pl = await import(pathToFileURL(planckPath).href);
const level = Number(lvl);
let best = null;
const cur = api.Sim.runHeadless(pl, level, api.SOLUTIONS[level].values, { maxT: 120 });
console.log("current solution:", JSON.stringify(cur));
for (let i = 0; i < Number(tries); i++) {
  const v = {};
  for (const s of api.VehicleConfig.SLIDERS) v[s.key] = s.min + Math.floor(Math.random() * (s.max - s.min + 1));
  v.fuel = 0;  // sliders alone must suffice
  const r = api.Sim.runHeadless(pl, level, v, { maxT: 120 });
  if (r.result === "win" && (!best || r.t < best.r.t)) { best = { v, r }; console.log("win", JSON.stringify(r), JSON.stringify(v)); }
}
console.log(best ? "BEST " + JSON.stringify(best.v) : "no winner found");
```

Run for each level that failed in Task 2 Step 5:
`node "$SCRATCH/search.mjs" game-lithium/index.html "$SCRATCH/planck/planck.mjs" 1 300`

- If winners exist: put one (prefer one that differs from the defaults in only a few sliders — readable as a "lesson", e.g. "gear wheels and low speed") into `SOLUTIONS[level]` with a short `note`.
- If no winner in 300 tries: the level is too hard. Soften it in `LEVELS` (lower the steepest angles by 5°, shorten the widest gap by 0.5 m, or shorten an ice stretch) and rerun. Keep each level's character (steep stays steep, pits stay pits, two bridges, ice + grip). Keep the 35° steepest slope test in sync if the max angle changes.
- Also check difficulty from the other side: the default car must **not** win levels 2–5 (`Sim.runHeadless(pl, i, VehicleConfig.defaults())`); otherwise the slider puzzle is empty. Make the level harder if the default car wins it.

- [ ] **Step 2: Run the full suite with physics**

Run: `PLANCK_PATH="$SCRATCH/planck/planck.mjs" node game-lithium/test.mjs`
Expected: `20 passed, 0 failed`.

- [ ] **Step 3: Playtest in the Browser pane**

Play each level with its solution and with a couple of your own slider settings: does a run feel readable (the car visible, the number counting, Stop works)? Check the booster can rescue a nearly-good car on the pitfalls. Adjust `BOOST_ACC`, `TILT_ACC`, or the camera look-ahead only if a run is unreadable or the booster is useless/overpowered; re-run Step 2 after any change.

- [ ] **Step 4: Add screenshot URL parameters**

At the end of the module script:
```js
// ?shot=1&level=N&t=SECONDS : start a run on level N and advance it synchronously t seconds (for headless screenshots).
const q = new URLSearchParams(location.search);
if (q.has("shot")) {
  const lv = Math.max(0, Math.min(Tracks.count - 1, Number(q.get("level")) || 0));
  save.unlocked = Math.max(save.unlocked, lv + 1);
  level = lv;
  values = VehicleConfig.clamp(SOLUTIONS[lv].values);
  syncSliders(); renderLevels();
  startRun();
  window.__lithium.step(Math.round((Number(q.get("t")) || 6) * 60), { boost: q.has("boost") });
}
```

- [ ] **Step 5: Take the screenshot**

Use plain `--headless=new` (real GPU, see memory note on SwiftShader artefacts), served over http so the CDN modules load:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1400,900 \
  --virtual-time-budget=8000 --screenshot="$SCRATCH/shot.png" "http://localhost:8765/game-lithium/?shot=1&level=1&t=5"
sips -s format jpeg -s formatOptions 80 "$SCRATCH/shot.png" --out game-lithium/screenshot1.jpg
```
Open the JPEG and check: blue sky, yellow steep track, the car mid-climb, the yellow number at the top, "Stop" at the bottom. If the frame shows the garage or an empty scene, raise `t` or choose another level and retake.

- [ ] **Step 6: README and gallery**

`game-lithium/README.md`:
```markdown
# Lithium

A desktop revival of *Lithium*, an unfinished iOS car prototype from 2016 (SpriteKit). Tune the car with
sliders, press Start, and watch it drive itself. Reach 10 to clear the track. The idea comes from the
2016 concept deck: *it's addictive to tweak sliders over and over and see how the new vehicle behaves
and if it passes the track.*

- **Garage:** 11 sliders. Wheel sizes front and rear, wheel type, motor speed and torque, leg length,
  chassis width and height, suspension, cargo, booster fuel.
- **Run:** Enter or click Start/Stop. Hold Space for the booster and use ← → to tilt.
  M mutes, R restarts a run, 1–5 picks an unlocked level.
- **Levels:** Bumps, Steep places, Pitfalls, Rope bridge, Friction varies. Every level can be cleared
  with sliders alone; `test.mjs` checks one solution per level headless.

Built with three.js (flat orthographic rendering) and planck.js (Box2D port: wheel joints with a
suspension spring and a motor).

## Tests

    node test.mjs                                  # pure logic
    PLANCK_PATH=/path/to/planck.mjs node test.mjs  # plus headless physics (planck 1.5.1 dist/planck.mjs)

## Screenshot

    index.html?shot=1&level=1&t=5   # starts a run on level 2 and advances 5 s synchronously
```
Add any deferred items found during playtesting under a `## Known issues` heading.

`gallery.yaml`: add the line `game-lithium: Lithium` with the other `game-` overrides.

Rebuild the gallery the way the repo does it: run `python3 build_gallery.py` and check that `git diff index.html` shows only the new Lithium card.

- [ ] **Step 7: Final checks and commit**

Run: `node game-lithium/test.mjs` and `PLANCK_PATH="$SCRATCH/planck/planck.mjs" node game-lithium/test.mjs`. Both must exit 0.

```bash
git add game-lithium gallery.yaml index.html
git commit -m "game-lithium: tuned levels, screenshot, README and gallery entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
