# Simulate Hand (27-DoF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained `simulate-hand/index.html` that renders a 3D humanoid hand with 27 slider-driven DoF, grasps a sphere/cube/pencil kinematically, and visualizes skin pressure (vertex-color heatmap) and per-actuator stress (skeleton overlay + slider bars).

**Architecture:** All pure logic (vec/quat math, DoF table, skeleton, forward kinematics, SDFs, skin sensors, contact/pressure, grasp state machine, canned poses, actuator stress) lives in a classic `<script id="shared-code">` block tested by `test.mjs` under node. A separate `<script type="module">` does three.js rendering (procedural SkinnedMesh hand, objects, heatmap splatting, skeleton overlay), UI panel, and tweens.

**Tech Stack:** three.js 0.170 from jsdelivr via import map (`OrbitControls`, `RoundedBoxGeometry`, `BufferGeometryUtils` addons), vanilla JS/CSS, node for tests. Spec: `docs/superpowers/specs/2026-07-15-simulate-hand-design.md`.

## Global Constraints

- Single page `simulate-hand/index.html`; only external dependency is the three.js CDN import map (repo convention, see `3d-shadows/index.html`).
- All pure logic in **one classic `<script id="shared-code">`** — no `import`/`export`/`type="module"` inside it, so `test.mjs` can run it via `new Function`. `function` declarations and `const` at top level only.
- Tests registered with the in-file **`HandTests.add(name, fn)`** harness; run via **`node test.mjs`** which extracts the block and calls `HandTests.run()`.
- Units: **1 unit = 1 cm**, y-up, ground plane at y=0. Angles in **radians**.
- Hand frame at zero pose: wrist root at `WRIST_HOME = [0, 14, 0]`, fingers point +Y, palm surface faces +Z. Thumb on +X side.
- DoF order (slider order and pose-array order) is fixed: wrist 6 (tx, ty, tz, pitch, yaw, roll), thumb 5 (CMC spread, CMC flex, MCP spread, MCP flex, IP flex), then index/middle/ring/pinky 4 each (MCP spread, MCP flex, PIP flex, DIP flex) = **27**.
- Commit after every task on `main`. End commit messages with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Paths relative to repo root `/Users/neoneye/git/vibe-coding-lab`.

---

## File Structure

```
simulate-hand/
  index.html   # shared-code block (logic + HandTests) + module script (three.js render + UI)
  test.mjs     # extracts shared-code, runs HandTests.run()
  tune.mjs     # debug printer: contact/grasp summary per object for pose tuning
```

Shared-code interfaces (all global, classic script):

- `v3add/v3sub/v3scale/v3dot/v3cross/v3len/v3norm(a[,b])` — arrays `[x,y,z]`.
- `qaa(axis, angle) -> q` (`[x,y,z,w]`), `qmul(a,b)`, `qconj(q)`, `qrot(q,v)`, `qrotInv(q,v)`.
- `DOF_TABLE` — 27 entries `{name, group, bone, kind:'t'|'r', axis, min, max, def}`.
- `SKELETON` — 17 entries `{name, parent, pos, len, radius, bind?}`; `DESCENDANTS[b]` — array of bone indices at/below b; `digitOf(bone) -> 'palm'|'thumb'|'index'|'middle'|'ring'|'pinky'`.
- `WRIST_HOME = [0, 14, 0]`.
- `computePose(angles[27]) -> {world: [{pos,quat}]x17, locals: [{pos,quat}]x17, dofFrames: [{jointPos, axis}]x27}`.
- `tipPos(world, tipBoneIdx) -> [x,y,z]` — fingertip of a distal bone.
- `sdfSphere(p, r)`, `sdfBox(p, h)`, `sdfCapsuleY(p, half, r)` — local-frame SDFs.
- `OBJ_DEFS` — `{sphere:{r,ready,restY,quat0}, cube:{h,ready,restY,quat0}, pencil:{r,half,ready,restY,quat0}}`.
- `objSdf(obj, pWorld)`, `objNormal(obj, pWorld)` — `obj = {type, pos, quat}`.
- `generateSensors() -> [{bone, offset, normal, digit}]` (~170 sensors).
- `sensorWorld(world, s) -> {pos, normal}`.
- `computeContacts(world, sensors, obj) -> [{sensor, pos, pressure, n}]`; constants `K_PRESSURE=40`, `P_CLAMP=80`.
- `evalGrasp(contacts, sensors) -> {force, opposition, groups}`; `updateGrasp(state, g)` with attach force≥30 ∧ opposition≥0.25 ∧ groups≥2, detach force<10 (hysteresis).
- `relToRoot(rootWorld, obj) -> {pos, quat}`, `applyRel(rootWorld, rel) -> {pos, quat}`.
- `POSES` — `{open, sphere, cube, pencil}` arrays of 27 angles.
- `computeStress(world, dofFrames, contacts, sensors, angles) -> stress[27]`.
- `HandTests` — `{add, run, assert, assertApprox}`.

---

## Task 1: Scaffold page, test harness, math, DoF table, skeleton

**Files:**
- Create: `simulate-hand/index.html`
- Create: `simulate-hand/test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `HandTests`, v3/quat helpers, `DOF_TABLE`, `SKELETON`, `DESCENDANTS`, `digitOf`, `WRIST_HOME`.

- [ ] **Step 1: Create `test.mjs`** (same extraction pattern as `game-snake/test.mjs`):

```js
// Runs the HandTests embedded in index.html's shared-code script block.
// Usage: node test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) { console.error("shared-code block not found"); process.exit(1); }
const ok = new Function(`${m[1]}; return HandTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Create `index.html`** with HTML shell, CSS stub, and the shared-code block containing the harness (copy the `GeoTests` IIFE pattern from `3d-geo-guess/index.html` renamed `HandTests`, with `add/run/assert/assertApprox`), math helpers, and data tables:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>27-DoF Hand Simulator</title>
<style>
  /* panel styles land in Task 8; keep minimal reset here */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { overflow: hidden; background: #0b0e13; font-family: ui-monospace, monospace; color: #ccc; }
  canvas { display: block; }
</style>
</head>
<body>
<script id="shared-code">
'use strict';
// ---- Test harness ----
const HandTests = (() => {
  const tests = []; let cur = '';
  function add(name, fn) { tests.push({ name, fn }); }
  function assert(cond, msg) { if (!cond) throw new Error(msg || ('assert failed in ' + cur)); }
  function assertApprox(a, b, eps, msg) {
    if (Math.abs(a - b) > (eps == null ? 1e-6 : eps))
      throw new Error((msg ? msg + ': ' : '') + 'expected ' + b + ' got ' + a);
  }
  function run() {
    let pass = 0, fail = 0;
    for (const t of tests) {
      cur = t.name;
      try { t.fn(); pass++; console.log('  ok   -', t.name); }
      catch (e) { fail++; console.error('  FAIL -', t.name + ':', e.message); }
    }
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    return fail === 0;
  }
  return { add, run, assert, assertApprox };
})();

// ---- vec3 / quat ----
function v3add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function v3sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function v3scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
function v3dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function v3cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function v3len(a) { return Math.hypot(a[0], a[1], a[2]); }
function v3norm(a) { const l = v3len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }
function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

function qaa(axis, angle) {
  const s = Math.sin(angle / 2);
  return [axis[0]*s, axis[1]*s, axis[2]*s, Math.cos(angle / 2)];
}
function qmul(a, b) {
  return [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2],
  ];
}
function qconj(q) { return [-q[0], -q[1], -q[2], q[3]]; }
function qrot(q, v) {
  const u = [q[0], q[1], q[2]];
  const t = v3scale(v3cross(u, v), 2);
  return v3add(v3add(v, v3scale(t, q[3])), v3cross(u, t));
}
function qrotInv(q, v) { return qrot(qconj(q), v); }

// ---- skeleton (17 bones, units cm, fingers +Y, palm faces +Z) ----
const WRIST_HOME = [0, 14, 0];
const THUMB_BIND = qmul(qaa([0, 0, 1], -1.0), qaa([1, 0, 0], 0.55));
const SKELETON = [
  { name: 'root',    parent: -1, pos: [0, 0, 0],       len: 0,   radius: 1.6 },
  { name: 'palm',    parent: 0,  pos: [0, 1.0, 0],     len: 9.0, radius: 1.4 },
  { name: 'thumb1',  parent: 1,  pos: [3.1, 0.6, 0.4], len: 4.6, radius: 1.15, bind: THUMB_BIND },
  { name: 'thumb2',  parent: 2,  pos: [0, 4.6, 0],     len: 3.2, radius: 1.05 },
  { name: 'thumb3',  parent: 3,  pos: [0, 3.2, 0],     len: 2.8, radius: 0.95 },
  { name: 'index1',  parent: 1,  pos: [3.0, 8.2, 0],   len: 4.5, radius: 0.88 },
  { name: 'index2',  parent: 5,  pos: [0, 4.5, 0],     len: 2.6, radius: 0.80 },
  { name: 'index3',  parent: 6,  pos: [0, 2.6, 0],     len: 2.4, radius: 0.72 },
  { name: 'middle1', parent: 1,  pos: [1.0, 8.6, 0],   len: 5.0, radius: 0.92 },
  { name: 'middle2', parent: 8,  pos: [0, 5.0, 0],     len: 3.0, radius: 0.84 },
  { name: 'middle3', parent: 9,  pos: [0, 3.0, 0],     len: 2.6, radius: 0.76 },
  { name: 'ring1',   parent: 1,  pos: [-1.0, 8.3, 0],  len: 4.6, radius: 0.86 },
  { name: 'ring2',   parent: 11, pos: [0, 4.6, 0],     len: 2.8, radius: 0.78 },
  { name: 'ring3',   parent: 12, pos: [0, 2.8, 0],     len: 2.5, radius: 0.70 },
  { name: 'pinky1',  parent: 1,  pos: [-2.9, 7.4, 0],  len: 3.6, radius: 0.72 },
  { name: 'pinky2',  parent: 14, pos: [0, 3.6, 0],     len: 2.2, radius: 0.66 },
  { name: 'pinky3',  parent: 15, pos: [0, 2.2, 0],     len: 2.1, radius: 0.60 },
];
const DIGIT_OF_BONE = ['palm', 'palm', 'thumb', 'thumb', 'thumb',
  'index', 'index', 'index', 'middle', 'middle', 'middle',
  'ring', 'ring', 'ring', 'pinky', 'pinky', 'pinky'];
function digitOf(bone) { return DIGIT_OF_BONE[bone]; }
const DESCENDANTS = SKELETON.map((_, b) => {
  const out = [];
  for (let i = 0; i < SKELETON.length; i++) {
    let j = i;
    while (j >= 0) { if (j === b) { out.push(i); break; } j = SKELETON[j].parent; }
  }
  return out;
});

// ---- 27 DoF ----
function fingerDofs(name, b) {
  return [
    { name: name + ' MCP spread', group: name, bone: b,     kind: 'r', axis: [0,0,1], min: -0.35, max: 0.35, def: 0 },
    { name: name + ' MCP flex',   group: name, bone: b,     kind: 'r', axis: [1,0,0], min: -0.30, max: 1.60, def: 0.15 },
    { name: name + ' PIP flex',   group: name, bone: b + 1, kind: 'r', axis: [1,0,0], min: 0.00,  max: 1.90, def: 0.20 },
    { name: name + ' DIP flex',   group: name, bone: b + 2, kind: 'r', axis: [1,0,0], min: 0.00,  max: 1.40, def: 0.10 },
  ];
}
const DOF_TABLE = [
  { name: 'Wrist X',     group: 'Wrist', bone: 0, kind: 't', axis: [1,0,0], min: -12, max: 12, def: 0 },
  { name: 'Wrist Y',     group: 'Wrist', bone: 0, kind: 't', axis: [0,1,0], min: -10, max: 14, def: 0 },
  { name: 'Wrist Z',     group: 'Wrist', bone: 0, kind: 't', axis: [0,0,1], min: -12, max: 12, def: 0 },
  { name: 'Wrist pitch', group: 'Wrist', bone: 0, kind: 'r', axis: [1,0,0], min: -1.0, max: 1.0, def: 0 },
  { name: 'Wrist yaw',   group: 'Wrist', bone: 0, kind: 'r', axis: [0,1,0], min: -1.2, max: 1.2, def: 0 },
  { name: 'Wrist roll',  group: 'Wrist', bone: 0, kind: 'r', axis: [0,0,1], min: -1.6, max: 1.6, def: 0 },
  { name: 'Thumb CMC spread', group: 'Thumb', bone: 2, kind: 'r', axis: [0,0,1], min: -0.5,  max: 0.8, def: 0.15 },
  { name: 'Thumb CMC flex',   group: 'Thumb', bone: 2, kind: 'r', axis: [1,0,0], min: -0.3,  max: 1.0, def: 0.10 },
  { name: 'Thumb MCP spread', group: 'Thumb', bone: 3, kind: 'r', axis: [0,0,1], min: -0.35, max: 0.35, def: 0 },
  { name: 'Thumb MCP flex',   group: 'Thumb', bone: 3, kind: 'r', axis: [1,0,0], min: -0.1,  max: 1.1, def: 0.10 },
  { name: 'Thumb IP flex',    group: 'Thumb', bone: 4, kind: 'r', axis: [1,0,0], min: -0.3,  max: 1.5, def: 0.10 },
  ...fingerDofs('Index', 5), ...fingerDofs('Middle', 8),
  ...fingerDofs('Ring', 11), ...fingerDofs('Pinky', 14),
];
function defaultAngles() { return DOF_TABLE.map(d => d.def); }
</script>
<script type="module">
// rendering + UI added in Tasks 7-9
</script>
</body>
</html>
```

- [ ] **Step 3: Add Task-1 tests at the bottom of the shared-code block** (before `</script>`):

```js
HandTests.add('quat: 90deg about X takes Y to Z', () => {
  const v = qrot(qaa([1,0,0], Math.PI/2), [0,1,0]);
  HandTests.assertApprox(v[0], 0, 1e-9); HandTests.assertApprox(v[1], 0, 1e-9);
  HandTests.assertApprox(v[2], 1, 1e-9);
});
HandTests.add('quat: qmul composes, qrotInv inverts', () => {
  const q = qmul(qaa([0,1,0], 0.7), qaa([1,0,0], -0.3));
  const v = [1, 2, 3], w = qrotInv(q, qrot(q, v));
  for (let i = 0; i < 3; i++) HandTests.assertApprox(w[i], v[i], 1e-9);
});
HandTests.add('DOF_TABLE has 27 valid entries', () => {
  HandTests.assert(DOF_TABLE.length === 27, 'expected 27 DoF, got ' + DOF_TABLE.length);
  const names = new Set();
  for (const d of DOF_TABLE) {
    HandTests.assert(d.min < d.def + 1e-9 && d.def < d.max + 1e-9, 'bad range: ' + d.name);
    HandTests.assert(!names.has(d.name), 'dup name: ' + d.name); names.add(d.name);
    HandTests.assert(d.bone >= 0 && d.bone < 17, 'bad bone: ' + d.name);
  }
});
HandTests.add('SKELETON: 17 bones, parents precede children, digits mapped', () => {
  HandTests.assert(SKELETON.length === 17);
  SKELETON.forEach((b, i) => HandTests.assert(b.parent < i, 'parent order: ' + b.name));
  HandTests.assert(DESCENDANTS[0].length === 17, 'root descends all');
  HandTests.assert(DESCENDANTS[5].length === 3, 'index1 has 3');
  HandTests.assert(digitOf(4) === 'thumb' && digitOf(16) === 'pinky');
});
```

- [ ] **Step 4: Run `node simulate-hand/test.mjs`** — expect 4 passing, 0 failed.
- [ ] **Step 5: Commit** — `git add simulate-hand && git commit -m "simulate-hand: scaffold, math, DoF table, skeleton"` (with trailer).

---

## Task 2: Forward kinematics

**Files:**
- Modify: `simulate-hand/index.html` (shared-code block)

**Interfaces:**
- Consumes: `SKELETON`, `DOF_TABLE`, math helpers.
- Produces: `computePose(angles)`, `tipPos(world, boneIdx)`.

- [ ] **Step 1: Write failing tests** (append to shared-code tests):

```js
HandTests.add('FK: neutral pose index fingertip position', () => {
  const { world } = computePose(new Array(27).fill(0));
  const tip = tipPos(world, 7); // index3
  HandTests.assertApprox(tip[0], 3.0, 1e-6);
  HandTests.assertApprox(tip[1], 14 + 1 + 8.2 + 4.5 + 2.6 + 2.4, 1e-6);
  HandTests.assertApprox(tip[2], 0, 1e-6);
});
HandTests.add('FK: MCP flexion curls index toward palm side (+Z), monotonic', () => {
  let prevZ = -1;
  for (const f of [0.3, 0.6, 0.9, 1.2]) {
    const a = new Array(27).fill(0); a[12] = f; // Index MCP flex
    const tip = tipPos(computePose(a).world, 7);
    HandTests.assert(tip[2] > prevZ, 'z should grow with flexion');
    prevZ = tip[2];
  }
  HandTests.assert(prevZ > 5, 'flexed tip well past palm plane');
});
HandTests.add('FK: full fist brings fingertip near palm', () => {
  const a = new Array(27).fill(0);
  a[12] = 1.5; a[13] = 1.8; a[14] = 1.3; // index MCP/PIP/DIP
  const tip = tipPos(computePose(a).world, 7);
  const palmCenter = [1.5, 14 + 5.5, 0];
  HandTests.assert(v3len(v3sub(tip, palmCenter)) < 7, 'fist tip near palm');
});
HandTests.add('FK: wrist translation shifts every bone equally', () => {
  const a = new Array(27).fill(0); a[0] = 5; a[1] = -3; a[2] = 2;
  const w0 = computePose(new Array(27).fill(0)).world;
  const w1 = computePose(a).world;
  for (let b = 0; b < 17; b++) {
    const d = v3sub(w1[b].pos, w0[b].pos);
    HandTests.assertApprox(d[0], 5, 1e-9); HandTests.assertApprox(d[1], -3, 1e-9);
    HandTests.assertApprox(d[2], 2, 1e-9);
  }
});
HandTests.add('FK: wrist yaw swings fingertips around Y at the wrist', () => {
  const a = new Array(27).fill(0); a[4] = Math.PI / 2;
  const tip = tipPos(computePose(a).world, 7);
  HandTests.assert(Math.abs(tip[2]) > 1, 'yaw moves tip in z (x lever arm)');
  HandTests.assertApprox(tip[1], 14 + 1 + 8.2 + 4.5 + 2.6 + 2.4, 1e-6, 'height unchanged');
});
HandTests.add('FK: thumb points sideways at neutral, opposes when flexed', () => {
  const zero = tipPos(computePose(new Array(27).fill(0)).world, 4);
  HandTests.assert(zero[0] > 5, 'thumb tip on +X side at zero pose');
  const a = new Array(27).fill(0);
  a[6] = 0.6; a[7] = 0.8; a[9] = 0.6; a[10] = 0.5;
  const opp = tipPos(computePose(a).world, 4);
  HandTests.assert(opp[2] > 2, 'opposed thumb comes in front of palm (+Z)');
  HandTests.assert(opp[0] < zero[0] - 2, 'opposed thumb moves toward palm center');
});
HandTests.add('FK: dofFrames axes are unit and jointPos matches bone origin', () => {
  const { world, dofFrames } = computePose(defaultAngles());
  for (let j = 0; j < 27; j++) {
    HandTests.assertApprox(v3len(dofFrames[j].axis), 1, 1e-9, DOF_TABLE[j].name);
  }
  const d = v3sub(dofFrames[12].jointPos, world[5].pos);
  HandTests.assert(v3len(d) < 1e-9, 'index MCP frame at index1 origin');
});
```

- [ ] **Step 2: Run tests** — expect the 7 new tests FAIL (`computePose is not defined`).
- [ ] **Step 3: Implement FK** in shared-code (above the tests):

```js
function computePose(angles) {
  const world = [], locals = [];
  const dofFrames = new Array(DOF_TABLE.length);
  for (let b = 0; b < SKELETON.length; b++) {
    const bone = SKELETON[b];
    const parent = bone.parent >= 0 ? world[bone.parent] : { pos: [0,0,0], quat: [0,0,0,1] };
    let lpos = bone.pos.slice();
    let lquat = bone.bind ? bone.bind.slice() : [0, 0, 0, 1];
    if (b === 0) {
      lpos = v3add(WRIST_HOME, [angles[0], angles[1], angles[2]]);
      for (let j = 0; j < 3; j++) dofFrames[j] = { jointPos: lpos.slice(), axis: DOF_TABLE[j].axis.slice() };
    }
    const jointPos = v3add(parent.pos, qrot(parent.quat, lpos));
    for (let j = 0; j < DOF_TABLE.length; j++) {
      const d = DOF_TABLE[j];
      if (d.bone !== b || d.kind !== 'r') continue;
      const wq = qmul(parent.quat, lquat);
      dofFrames[j] = { jointPos, axis: v3norm(qrot(wq, d.axis)) };
      lquat = qmul(lquat, qaa(d.axis, clamp(angles[j], d.min, d.max)));
    }
    world.push({ pos: jointPos, quat: qmul(parent.quat, lquat) });
    locals.push({ pos: lpos, quat: lquat });
  }
  return { world, locals, dofFrames };
}
function tipPos(world, b) {
  return v3add(world[b].pos, qrot(world[b].quat, [0, SKELETON[b].len, 0]));
}
```

- [ ] **Step 4: Run tests** — all pass. If the thumb qualitative test fails, tune `THUMB_BIND` angles (first the Z rotation in `[-1.3,-0.8]`, then X in `[0.4,0.7]`) until it passes; do not weaken the test.
- [ ] **Step 5: Commit** — `simulate-hand: forward kinematics for 17-bone skeleton`.

---

## Task 3: Object SDFs and normals

**Files:**
- Modify: `simulate-hand/index.html` (shared-code block)

**Interfaces:**
- Consumes: math helpers.
- Produces: `sdfSphere/sdfBox/sdfCapsuleY`, `OBJ_DEFS`, `objSdf(obj,p)`, `objNormal(obj,p)`.

- [ ] **Step 1: Write failing tests:**

```js
HandTests.add('SDF: sphere inside/outside distances', () => {
  HandTests.assertApprox(sdfSphere([0, 0, 5], 3), 2, 1e-9);
  HandTests.assertApprox(sdfSphere([0, 1, 0], 3), -2, 1e-9);
});
HandTests.add('SDF: box face, corner, inside', () => {
  HandTests.assertApprox(sdfBox([4, 0, 0], [2, 2, 2]), 2, 1e-9);
  HandTests.assertApprox(sdfBox([3, 3, 3], [2, 2, 2]), Math.sqrt(3), 1e-9);
  HandTests.assertApprox(sdfBox([0, 0, 1], [2, 2, 2]), -1, 1e-9);
});
HandTests.add('SDF: capsule caps and side', () => {
  HandTests.assertApprox(sdfCapsuleY([0, 0, 2], 5, 1), 1, 1e-9);
  HandTests.assertApprox(sdfCapsuleY([0, 7, 0], 5, 1), 1, 1e-9);
  HandTests.assertApprox(sdfCapsuleY([0, 3, 0], 5, 1), -1, 1e-9);
});
HandTests.add('SDF: objSdf respects object pose, objNormal matches analytic', () => {
  const obj = { type: 'sphere', pos: [10, 20, 30], quat: qaa([0, 1, 0], 0.9) };
  HandTests.assertApprox(objSdf(obj, [10, 20, 34]), 4 - OBJ_DEFS.sphere.r, 1e-6);
  const n = objNormal(obj, [10, 20, 34]);
  HandTests.assertApprox(n[0], 0, 1e-3); HandTests.assertApprox(n[1], 0, 1e-3);
  HandTests.assertApprox(n[2], 1, 1e-3);
});
HandTests.add('SDF: rotated cube face distance', () => {
  const obj = { type: 'cube', pos: [0, 0, 0], quat: qaa([0, 1, 0], Math.PI / 4) };
  const h = OBJ_DEFS.cube.h[0];
  // point along rotated +X face normal
  const p = qrot(obj.quat, [h + 1.5, 0, 0]);
  HandTests.assertApprox(objSdf(obj, p), 1.5, 1e-6);
});
HandTests.add('OBJ_DEFS: ready positions sit in front of the palm', () => {
  for (const k of ['sphere', 'cube', 'pencil']) {
    const r = OBJ_DEFS[k].ready;
    HandTests.assert(r[2] > 1.5 && r[1] > 16 && r[1] < 26, k + ' ready pos plausible');
  }
});
```

- [ ] **Step 2: Run tests** — new tests FAIL.
- [ ] **Step 3: Implement:**

```js
function sdfSphere(p, r) { return v3len(p) - r; }
function sdfBox(p, h) {
  const q = [Math.abs(p[0]) - h[0], Math.abs(p[1]) - h[1], Math.abs(p[2]) - h[2]];
  const outside = v3len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]);
  return outside + Math.min(Math.max(q[0], q[1], q[2]), 0);
}
function sdfCapsuleY(p, half, r) {
  const y = clamp(p[1], -half, half);
  return v3len([p[0], p[1] - y, p[2]]) - r;
}
const OBJ_DEFS = {
  sphere: { r: 3.0,  ready: [0.6, 20.0, 4.2], restY: 3.0,  quat0: [0, 0, 0, 1] },
  cube:   { h: [2.4, 2.4, 2.4], ready: [0.6, 20.0, 4.0], restY: 2.4, quat0: [0, 0, 0, 1] },
  pencil: { r: 0.45, half: 9.0, ready: [1.2, 21.0, 3.4], restY: 0.45,
            quat0: qaa([0, 0, 1], Math.PI / 2) }, // held/lying horizontally
};
function objSdf(obj, p) {
  const l = qrotInv(obj.quat, v3sub(p, obj.pos));
  const d = OBJ_DEFS[obj.type];
  if (obj.type === 'sphere') return sdfSphere(l, d.r);
  if (obj.type === 'cube') return sdfBox(l, d.h);
  return sdfCapsuleY(l, d.half, d.r);
}
function objNormal(obj, p) {
  const e = 1e-3;
  return v3norm([
    objSdf(obj, [p[0] + e, p[1], p[2]]) - objSdf(obj, [p[0] - e, p[1], p[2]]),
    objSdf(obj, [p[0], p[1] + e, p[2]]) - objSdf(obj, [p[0], p[1] - e, p[2]]),
    objSdf(obj, [p[0], p[1], p[2] + e]) - objSdf(obj, [p[0], p[1], p[2] - e]),
  ]);
}
```

- [ ] **Step 4: Run tests** — all pass.
- [ ] **Step 5: Commit** — `simulate-hand: analytic SDFs for sphere, cube, pencil`.

---

## Task 4: Skin sensors and contact model

**Files:**
- Modify: `simulate-hand/index.html` (shared-code block)

**Interfaces:**
- Consumes: `SKELETON`, `computePose`, `objSdf`, `objNormal`.
- Produces: `generateSensors()`, `sensorWorld(world, s)`, `computeContacts(world, sensors, obj)`, `K_PRESSURE`, `P_CLAMP`.

- [ ] **Step 1: Write failing tests:**

```js
HandTests.add('sensors: count in range, fingertips denser than proximal', () => {
  const ss = generateSensors();
  HandTests.assert(ss.length >= 150 && ss.length <= 260, 'got ' + ss.length);
  const per = {}; ss.forEach(s => per[s.bone] = (per[s.bone] || 0) + 1);
  HandTests.assert(per[7] > per[5], 'index distal denser than proximal');
  HandTests.assert(per[1] >= 20, 'palm has a grid');
  ss.forEach(s => HandTests.assertApprox(v3len(s.normal), 1, 1e-6));
});
HandTests.add('sensors: palmar bias — normals face +Z at zero pose', () => {
  const { world } = computePose(new Array(27).fill(0));
  const ss = generateSensors();
  let fwd = 0;
  for (const s of ss) { if (sensorWorld(world, s).normal[2] > 0.2) fwd++; }
  HandTests.assert(fwd / ss.length > 0.7, 'most sensors face palm side');
});
HandTests.add('contact: sphere pressed onto palm produces palm contacts', () => {
  const { world } = computePose(new Array(27).fill(0));
  const obj = { type: 'sphere', pos: [0.6, 19.5, 3.6], quat: [0,0,0,1] };
  const cs = computeContacts(world, generateSensors(), obj);
  HandTests.assert(cs.length > 0, 'expected contacts');
  HandTests.assert(cs.some(c => digitOf(generateSensors()[c.sensor].bone) === 'palm'), 'palm touched');
  cs.forEach(c => HandTests.assert(c.pressure > 0 && c.pressure <= P_CLAMP));
});
HandTests.add('contact: deeper penetration -> higher pressure', () => {
  const { world } = computePose(new Array(27).fill(0));
  const ss = generateSensors();
  const p1 = computeContacts(world, ss, { type: 'sphere', pos: [0.6, 19.5, 4.0], quat: [0,0,0,1] });
  const p2 = computeContacts(world, ss, { type: 'sphere', pos: [0.6, 19.5, 3.2], quat: [0,0,0,1] });
  const sum = cs => cs.reduce((a, c) => a + c.pressure, 0);
  HandTests.assert(sum(p2) > sum(p1), 'closer sphere presses harder');
});
HandTests.add('contact: pencil touches far fewer sensors than sphere', () => {
  const a = defaultAngles();
  const { world } = computePose(a);
  const ss = generateSensors();
  const sp = computeContacts(world, ss, { type: 'sphere', pos: OBJ_DEFS.sphere.ready.slice(), quat: [0,0,0,1] });
  const pc = computeContacts(world, ss, { type: 'pencil', pos: [1.2, 20.0, 2.2], quat: OBJ_DEFS.pencil.quat0.slice() });
  HandTests.assert(pc.length > 0, 'pencil makes some contact');
  HandTests.assert(pc.length < Math.max(sp.length, 8), 'pencil band is thin');
});
```

- [ ] **Step 2: Run tests** — FAIL (`generateSensors is not defined`).
- [ ] **Step 3: Implement:**

```js
const K_PRESSURE = 40, P_CLAMP = 80;
function generateSensors() {
  const sensors = [];
  for (let iy = 0; iy < 5; iy++) {          // palm 5x5 grid on front face
    for (let ix = 0; ix < 5; ix++) {
      sensors.push({ bone: 1, digit: 'palm',
        offset: [-2.6 + ix * 1.4, 1.6 + iy * 1.6, 1.35], normal: [0, 0, 1] });
    }
  }
  const RING_ANGLES = [-1.05, -0.35, 0.35, 1.05]; // radians around palmar side
  const chains = [[2, 3, 4], [5, 6, 7], [8, 9, 10], [11, 12, 13], [14, 15, 16]];
  for (const chain of chains) {
    for (let k = 0; k < 3; k++) {
      const b = chain[k], { len, radius } = SKELETON[b];
      const digit = digitOf(b);
      const fracs = k === 2 ? [0.25, 0.55, 0.85] : [0.3, 0.7];
      for (const f of fracs) {
        for (const a of RING_ANGLES) {
          sensors.push({ bone: b, digit,
            offset: [Math.sin(a) * radius, len * f, Math.cos(a) * radius],
            normal: v3norm([Math.sin(a), 0, Math.cos(a)]) });
        }
      }
      if (k === 2) sensors.push({ bone: b, digit,               // fingertip pad
        offset: [0, len + radius * 0.5, radius * 0.3],
        normal: v3norm([0, 0.8, 0.6]) });
    }
  }
  return sensors;
}
function sensorWorld(world, s) {
  const w = world[s.bone];
  return { pos: v3add(w.pos, qrot(w.quat, s.offset)), normal: qrot(w.quat, s.normal) };
}
function computeContacts(world, sensors, obj) {
  const out = [];
  for (let i = 0; i < sensors.length; i++) {
    const { pos, normal } = sensorWorld(world, sensors[i]);
    const d = objSdf(obj, pos);
    if (d >= 0) continue;
    const n = objNormal(obj, pos);
    if (v3dot(normal, n) > 0.25) continue;   // sensor faces away from surface
    out.push({ sensor: i, pos, pressure: Math.min(-d * K_PRESSURE, P_CLAMP), n });
  }
  return out;
}
```

- [ ] **Step 4: Run tests** — all pass. The two placement-sensitive tests (`sphere pressed onto palm`, `pencil thin band`) may need the test object positions nudged ±1 cm to actually intersect; adjust the *test positions*, not the model, and keep assertions qualitative.
- [ ] **Step 5: Commit** — `simulate-hand: skin sensors and SDF contact model`.

---

## Task 5: Grasp logic and canned poses (with tuning harness)

**Files:**
- Modify: `simulate-hand/index.html` (shared-code block)
- Create: `simulate-hand/tune.mjs`

**Interfaces:**
- Consumes: `computeContacts`, `computePose`, `OBJ_DEFS`, `defaultAngles`.
- Produces: `evalGrasp(contacts, sensors)`, `updateGrasp(state, g)`, `relToRoot`, `applyRel`, `POSES`, `GRASP` thresholds.

- [ ] **Step 1: Write failing tests:**

```js
HandTests.add('grasp: open hand near object -> no attach', () => {
  const ss = generateSensors();
  const { world } = computePose(defaultAngles());
  const obj = { type: 'sphere', pos: OBJ_DEFS.sphere.ready.slice(), quat: [0,0,0,1] };
  const g = evalGrasp(computeContacts(world, ss, obj), ss);
  const st = { attached: false };
  updateGrasp(st, g);
  HandTests.assert(!st.attached, 'open hand must not grasp');
});
HandTests.add('grasp: each canned pose attaches its object', () => {
  const ss = generateSensors();
  for (const k of ['sphere', 'cube', 'pencil']) {
    const { world } = computePose(POSES[k]);
    const obj = { type: k, pos: OBJ_DEFS[k].ready.slice(), quat: OBJ_DEFS[k].quat0.slice() };
    const g = evalGrasp(computeContacts(world, ss, obj), ss);
    const st = { attached: false };
    updateGrasp(st, g);
    HandTests.assert(st.attached,
      k + ': force=' + g.force.toFixed(1) + ' opp=' + g.opposition.toFixed(2) + ' groups=' + g.groups);
  }
});
HandTests.add('grasp: hysteresis — light residual contact keeps hold, none releases', () => {
  const st = { attached: true };
  updateGrasp(st, { force: 15, opposition: 0.1, groups: 1 });
  HandTests.assert(st.attached, 'force 15 above detach threshold');
  updateGrasp(st, { force: 2, opposition: 0, groups: 0 });
  HandTests.assert(!st.attached, 'force 2 releases');
});
HandTests.add('grasp: attach transform round-trips through root motion', () => {
  const a = POSES.sphere.slice();
  const root0 = computePose(a).world[0];
  const obj = { type: 'sphere', pos: OBJ_DEFS.sphere.ready.slice(), quat: [0,0,0,1] };
  const rel = relToRoot(root0, obj);
  a[0] = 6; a[1] = 8; a[4] = 0.8; // move + yaw the wrist
  const root1 = computePose(a).world[0];
  const moved = applyRel(root1, rel);
  const back = applyRel(root0, rel);
  HandTests.assert(v3len(v3sub(back.pos, obj.pos)) < 1e-9, 'identity round-trip');
  HandTests.assert(v3len(v3sub(moved.pos, obj.pos)) > 4, 'object follows wrist');
});
HandTests.add('contacts: cube grasp normals axis-aligned, sphere normals diverse', () => {
  const ss = generateSensors();
  const axisAligned = n => Math.max(Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])) > 0.95;
  const cubeObj = { type: 'cube', pos: OBJ_DEFS.cube.ready.slice(), quat: [0,0,0,1] };
  const cubeCs = computeContacts(computePose(POSES.cube).world, ss, cubeObj);
  HandTests.assert(cubeCs.length > 0, 'cube contacts exist');
  const aligned = cubeCs.filter(c => axisAligned(c.n)).length;
  HandTests.assert(aligned / cubeCs.length > 0.6, 'cube pressure follows faces/edges');
  const sphObj = { type: 'sphere', pos: OBJ_DEFS.sphere.ready.slice(), quat: [0,0,0,1] };
  const sphCs = computeContacts(computePose(POSES.sphere).world, ss, sphObj);
  HandTests.assert(sphCs.some(c => !axisAligned(c.n)), 'sphere normals are radial/diverse');
});
HandTests.add('poses: all 27 entries within DoF limits', () => {
  for (const k of Object.keys(POSES)) {
    HandTests.assert(POSES[k].length === 27, k);
    POSES[k].forEach((v, j) => HandTests.assert(
      v >= DOF_TABLE[j].min - 1e-9 && v <= DOF_TABLE[j].max + 1e-9,
      k + '[' + j + '] ' + DOF_TABLE[j].name));
  }
});
```

- [ ] **Step 2: Run tests** — FAIL.
- [ ] **Step 3: Implement grasp + poses:**

```js
const GRASP = { attachForce: 30, attachOpp: 0.25, attachGroups: 2, detachForce: 10 };
function evalGrasp(contacts, sensors) {
  let force = 0; const net = [0, 0, 0]; const groups = new Set();
  for (const c of contacts) {
    force += c.pressure;
    net[0] += c.n[0] * c.pressure; net[1] += c.n[1] * c.pressure; net[2] += c.n[2] * c.pressure;
    if (c.pressure > 2) groups.add(sensors[c.sensor].digit);
  }
  if (force < 1e-9) return { force: 0, opposition: 0, groups: 0 };
  return { force, opposition: 1 - v3len(net) / force, groups: groups.size };
}
function updateGrasp(state, g) {
  if (!state.attached) {
    if (g.force >= GRASP.attachForce && g.opposition >= GRASP.attachOpp && g.groups >= GRASP.attachGroups)
      state.attached = true;
  } else if (g.force < GRASP.detachForce) {
    state.attached = false;
  }
  return state;
}
function relToRoot(root, obj) {
  return { pos: qrotInv(root.quat, v3sub(obj.pos, root.pos)),
           quat: qmul(qconj(root.quat), obj.quat) };
}
function applyRel(root, rel) {
  return { pos: v3add(root.pos, qrot(root.quat, rel.pos)),
           quat: qmul(root.quat, rel.quat) };
}
function makePose(over) {
  const a = defaultAngles();
  for (const [j, v] of over) a[j] = v;
  return a;
}
// DoF indices: 6..10 thumb, 11..14 index, 15..18 middle, 19..22 ring, 23..26 pinky
const POSES = {
  open: defaultAngles(),
  sphere: makePose([[6, 0.55], [7, 0.55], [9, 0.55], [10, 0.45],
    [11, 0.05], [12, 0.75], [13, 0.85], [14, 0.45],
    [16, 0.80], [17, 0.90], [18, 0.45],
    [19, -0.05], [20, 0.80], [21, 0.90], [22, 0.45],
    [23, -0.10], [24, 0.75], [25, 0.85], [26, 0.45]]),
  cube: makePose([[6, 0.50], [7, 0.45], [9, 0.45], [10, 0.35],
    [11, 0.05], [12, 0.60], [13, 0.70], [14, 0.35],
    [16, 0.65], [17, 0.75], [18, 0.35],
    [19, -0.05], [20, 0.65], [21, 0.75], [22, 0.35],
    [23, -0.10], [24, 0.60], [25, 0.70], [26, 0.35]]),
  pencil: makePose([[6, 0.65], [7, 0.75], [9, 0.70], [10, 0.60],
    [11, 0.00], [12, 0.95], [13, 1.05], [14, 0.70],
    [16, 1.00], [17, 1.10], [18, 0.80],
    [19, -0.05], [20, 1.45], [21, 1.85], [22, 1.30],
    [23, -0.10], [24, 1.45], [25, 1.85], [26, 1.30]]),
};
```

- [ ] **Step 4: Create `tune.mjs`** — debug printer to guide pose/ready-position tuning:

```js
// Prints grasp diagnostics per object for the canned poses. Usage: node tune.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const src = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1];
new Function(src + `;
const ss = generateSensors();
for (const k of ['sphere', 'cube', 'pencil']) {
  const { world } = computePose(POSES[k]);
  const obj = { type: k, pos: OBJ_DEFS[k].ready.slice(), quat: OBJ_DEFS[k].quat0.slice() };
  const cs = computeContacts(world, ss, obj);
  const g = evalGrasp(cs, ss);
  const per = {};
  cs.forEach(c => { const d = ss[c.sensor].digit; per[d] = (per[d] || 0) + 1; });
  console.log(k, '=> force', g.force.toFixed(1), 'opp', g.opposition.toFixed(2),
    'groups', g.groups, 'contacts', cs.length, per);
  for (const b of [4, 7, 10, 13, 16]) {
    console.log('   tip', DIGIT_OF_BONE[b], 'sdf', objSdf(obj, tipPos(world, b)).toFixed(2));
  }
}`)();
```

- [ ] **Step 5: Tune until the attach test passes.** Run `node simulate-hand/tune.mjs`; for each object adjust, in this order: (1) `OBJ_DEFS[k].ready` position (move the object into the closing fingers), (2) the pose flexion values, (3) only as a last resort `GRASP.attachForce` down to no less than 20. Target: force ≥ 40, opposition ≥ 0.3, groups ≥ 3 for sphere/cube; pencil may sit at groups 2 (thumb+index) with force ≥ 30. Re-run `node simulate-hand/test.mjs` until all pass.
- [ ] **Step 6: Commit** — `simulate-hand: grasp detection, canned poses, tuning harness`.

---

## Task 6: Actuator stress

**Files:**
- Modify: `simulate-hand/index.html` (shared-code block)

**Interfaces:**
- Consumes: `DESCENDANTS`, `dofFrames`, `computeContacts`.
- Produces: `computeStress(world, dofFrames, contacts, sensors, angles) -> number[27]`, `STRESS_VIS_MAX = 400`, `LIMIT_K = 150`.

- [ ] **Step 1: Write failing tests:**

```js
HandTests.add('stress: zero without contacts or limit strain', () => {
  const a = defaultAngles();
  const { world, dofFrames } = computePose(a);
  const s = computeStress(world, dofFrames, [], generateSensors(), a);
  HandTests.assert(s.every(v => v === 0), 'all zero');
});
HandTests.add('stress: joint at its limit strains even with no contact', () => {
  const a = defaultAngles(); a[13] = DOF_TABLE[13].max; // Index PIP maxed
  const { world, dofFrames } = computePose(a);
  const s = computeStress(world, dofFrames, [], generateSensors(), a);
  HandTests.assert(s[13] > 0, 'limit strain on PIP');
  HandTests.assert(s[12] === 0, 'MCP unaffected');
});
HandTests.add('stress: grasping the sphere loads finger flexors and wrist', () => {
  const ss = generateSensors();
  const a = POSES.sphere;
  const { world, dofFrames } = computePose(a);
  const obj = { type: 'sphere', pos: OBJ_DEFS.sphere.ready.slice(), quat: [0,0,0,1] };
  const cs = computeContacts(world, ss, obj);
  const s = computeStress(world, dofFrames, cs, ss, a);
  HandTests.assert(s[12] > 0, 'index MCP flex loaded');
  HandTests.assert(s[3] + s[4] + s[5] > 0, 'wrist rotations feel the grip');
});
HandTests.add('stress: squeezing deeper raises flexor stress', () => {
  const ss = generateSensors();
  const obj = { type: 'sphere', pos: OBJ_DEFS.sphere.ready.slice(), quat: [0,0,0,1] };
  const load = pose => {
    const { world, dofFrames } = computePose(pose);
    const cs = computeContacts(world, ss, obj);
    return computeStress(world, dofFrames, cs, ss, pose)[12];
  };
  const deeper = POSES.sphere.slice(); deeper[12] = Math.min(DOF_TABLE[12].max, deeper[12] + 0.25);
  HandTests.assert(load(deeper) > load(POSES.sphere), 'more flexion -> more stress');
});
```

- [ ] **Step 2: Run tests** — FAIL.
- [ ] **Step 3: Implement:**

```js
const STRESS_VIS_MAX = 400, LIMIT_K = 150;
function computeStress(world, dofFrames, contacts, sensors, angles) {
  const stress = new Array(DOF_TABLE.length).fill(0);
  for (let j = 0; j < DOF_TABLE.length; j++) {
    const d = DOF_TABLE[j];
    const { jointPos, axis } = dofFrames[j];
    let v = 0;
    if (d.kind === 't') {
      for (const c of contacts) v += c.pressure * v3dot(c.n, axis);
      v = Math.abs(v);
    } else {
      const desc = DESCENDANTS[d.bone];
      for (const c of contacts) {
        if (!desc.includes(sensors[c.sensor].bone)) continue;
        const r = v3sub(c.pos, jointPos);
        const F = v3scale(c.n, c.pressure);
        v += v3dot(v3cross(r, F), axis);
      }
      v = Math.abs(v);
    }
    const span = d.max - d.min, m = 0.06 * span;
    const a = clamp(angles[j], d.min, d.max);
    if (a > d.max - m) v += LIMIT_K * (a - (d.max - m)) / m;
    if (a < d.min + m) v += LIMIT_K * ((d.min + m) - a) / m;
    stress[j] = v;
  }
  return stress;
}
```

Optimization note: convert `DESCENDANTS` lookups to `Set` once at startup if profiling shows cost; at 27×~30 contacts it is irrelevant — keep the simple version.

- [ ] **Step 4: Run tests** — all pass (`node simulate-hand/test.mjs`, expect ~26 passing).
- [ ] **Step 5: Commit** — `simulate-hand: per-actuator stress from contact torques and limit strain`.

---

## Task 7: three.js scene and skinned hand mesh

**Files:**
- Modify: `simulate-hand/index.html` (module script + import map in `<head>`)

**Interfaces:**
- Consumes: `SKELETON`, `computePose`, shared globals (classic script → visible to module).
- Produces: module-scope `scene, camera, renderer, controls, handMesh, threeBones[17], objectMeshes, setObject(type), renderOnce()`, and `window.__engineReady` flag for smoke checks.

No node test (rendering); verified by the screenshot smoke check in Step 4.

- [ ] **Step 1: Add the import map to `<head>`** (before the module script runs):

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
} }
</script>
```

- [ ] **Step 2: Replace the placeholder module script** with scene setup + hand construction:

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const SKIN = new THREE.Color(0.91, 0.72, 0.60);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  document.body.insertAdjacentHTML('beforeend',
    '<p style="padding:2em">WebGL is unavailable in this browser — the hand simulator cannot run.</p>');
  throw e;
}
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e13);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 500);
camera.position.set(20, 26, 36);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 18, 0);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0x8899bb, 0x223, 0.9));
const sun = new THREE.DirectionalLight(0xffeedd, 1.6);
sun.position.set(25, 45, 25);
sun.castShadow = true;
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -10;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48),
  new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(60, 30, 0x2a3242, 0x1c2230));

// ---- bones (bind pose = all angles zero) ----
const bindPose = computePose(new Array(27).fill(0));
const threeBones = SKELETON.map((b, i) => {
  const bone = new THREE.Bone();
  bone.name = b.name;
  const l = bindPose.locals[i];
  bone.position.fromArray(l.pos);
  bone.quaternion.fromArray(l.quat);
  return bone;
});
SKELETON.forEach((b, i) => { if (b.parent >= 0) threeBones[b.parent].add(threeBones[i]); });

// ---- geometry parts, authored in bind-pose world space, rigid-bound per bone ----
function bindPart(geo, boneIdx) {
  const w = bindPose.world[boneIdx];
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(w.pos),
    new THREE.Quaternion().fromArray(w.quat), new THREE.Vector3(1, 1, 1));
  geo.applyMatrix4(m);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(
    new Uint16Array(n * 4).map((_, k) => (k % 4 === 0 ? boneIdx : 0)), 4));
  const sw = new Float32Array(n * 4); for (let k = 0; k < n; k++) sw[k * 4] = 1;
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}
const parts = [];
parts.push(bindPart(new RoundedBoxGeometry(7.2, 9.6, 2.7, 4, 1.1)
  .translate(0.1, 4.8, 0), 1));                       // palm
parts.push(bindPart(new RoundedBoxGeometry(4.2, 3.2, 2.5, 3, 1.0)
  .translate(0, -0.4, 0), 0));                        // wrist stub
for (let b = 2; b < SKELETON.length; b++) {
  const { len, radius } = SKELETON[b];
  parts.push(bindPart(new THREE.CapsuleGeometry(radius, len, 4, 14)
    .translate(0, len / 2, 0), b));                   // phalanx spans joint->joint
}
const handGeo = BufferGeometryUtils.mergeGeometries(parts);
const nv = handGeo.attributes.position.count;
const colors = new Float32Array(nv * 3);
for (let i = 0; i < nv; i++) { colors[i*3] = SKIN.r; colors[i*3+1] = SKIN.g; colors[i*3+2] = SKIN.b; }
handGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const handMesh = new THREE.SkinnedMesh(handGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 }));
handMesh.castShadow = true;
handMesh.add(threeBones[0]);
handMesh.bind(new THREE.Skeleton(threeBones));
scene.add(handMesh);

// ---- objects ----
function hexPencil() {
  const g = new THREE.CylinderGeometry(OBJ_DEFS.pencil.r, OBJ_DEFS.pencil.r,
    OBJ_DEFS.pencil.half * 2 - 1.6, 6);
  const tip = new THREE.CylinderGeometry(0.02, OBJ_DEFS.pencil.r, 1.6, 6)
    .translate(0, OBJ_DEFS.pencil.half - 0.8, 0);
  return BufferGeometryUtils.mergeGeometries([g, tip]);
}
const objectMeshes = {
  sphere: new THREE.Mesh(new THREE.SphereGeometry(OBJ_DEFS.sphere.r, 40, 24),
    new THREE.MeshStandardMaterial({ color: 0x4ea1ff, roughness: 0.35 })),
  cube: new THREE.Mesh(new RoundedBoxGeometry(4.8, 4.8, 4.8, 3, 0.25),
    new THREE.MeshStandardMaterial({ color: 0xff9b42, roughness: 0.5 })),
  pencil: new THREE.Mesh(hexPencil(),
    new THREE.MeshStandardMaterial({ color: 0xf3c93e, roughness: 0.6 })),
};
for (const m of Object.values(objectMeshes)) { m.castShadow = true; m.visible = false; scene.add(m); }

const sim = {
  angles: defaultAngles(),
  obj: null,                      // {type, pos, quat} shared-code object state
  grasp: { attached: false }, rel: null,
  sensors: generateSensors(),
};
function setObject(type) {
  for (const [k, m] of Object.entries(objectMeshes)) m.visible = k === type;
  sim.obj = { type, pos: OBJ_DEFS[type].ready.slice(), quat: OBJ_DEFS[type].quat0.slice() };
  sim.grasp.attached = false; sim.rel = null;
}

function applyPoseToBones(pose) {
  for (let i = 0; i < threeBones.length; i++) {
    threeBones[i].position.fromArray(pose.locals[i].pos);
    threeBones[i].quaternion.fromArray(pose.locals[i].quat);
  }
}
function renderOnce() {
  const pose = computePose(sim.angles);
  applyPoseToBones(pose);
  if (sim.obj) {
    objectMeshes[sim.obj.type].position.fromArray(sim.obj.pos);
    objectMeshes[sim.obj.type].quaternion.fromArray(sim.obj.quat);
  }
  controls.update();
  renderer.render(scene, camera);
  return pose;
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
setObject('sphere');
renderOnce();
window.__engineReady = true;
(function loop() { requestAnimationFrame(loop); renderOnce(); })();
```

Note the root-bone subtlety: `threeBones[0]` local position must be `WRIST_HOME + wrist translation` — `computePose` already returns exactly that in `locals[0].pos`, and the SkinnedMesh sits at scene origin, so bind and animated poses line up. Geometry is authored in bind world space, matching the bind skeleton (`handMesh.bind` with no offset matrix).

- [ ] **Step 3: Run logic tests still green** — `node simulate-hand/test.mjs`.
- [ ] **Step 4: Smoke check in headless Chrome** (CDN needs network):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --window-size=1280,800 --virtual-time-budget=6000 \
  --screenshot=/tmp/hand-t7.png "file:///Users/neoneye/git/vibe-coding-lab/simulate-hand/index.html"
```

Read `/tmp/hand-t7.png` — expect a skin-toned hand above a dark grid with a blue sphere floating in front of the palm, no console errors (`--enable-logging=stderr` to confirm). Iterate on geometry offsets (palm box translate, wrist stub) until it reads as a hand.
- [ ] **Step 5: Commit** — `simulate-hand: three.js scene with procedural skinned hand`.

---

## Task 8: Control panel UI (27 sliders, objects, buttons, readouts)

**Files:**
- Modify: `simulate-hand/index.html` (CSS + panel HTML + module script wiring)

**Interfaces:**
- Consumes: `DOF_TABLE`, `sim.angles`, `setObject`, `POSES`.
- Produces: `ui = {sliderEls[27], valueEls[27], stressEls[27], setSliders(angles), readout(...), buttons}`; `startTween(target[, onDone])`.

- [ ] **Step 1: Add panel CSS** to the `<style>` block:

```css
#panel { position: absolute; top: 0; left: 0; bottom: 0; width: 300px;
  overflow-y: auto; background: rgba(10, 13, 19, 0.92); padding: 12px 14px;
  border-right: 1px solid #232b3a; font-size: 12px; }
#panel h1 { font-size: 14px; color: #fff; margin-bottom: 8px; }
#readouts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 8px 0; }
#readouts .card { background: #131926; border: 1px solid #232b3a; border-radius: 6px;
  padding: 6px 8px; }
#readouts .card b { display: block; color: #8cf; font-size: 15px; }
#state.grasped { color: #7f7; } #state.free { color: #999; }
.btnrow { display: flex; gap: 6px; margin: 6px 0; flex-wrap: wrap; }
button { background: #1b2333; color: #cde; border: 1px solid #2c3850;
  border-radius: 6px; padding: 6px 10px; cursor: pointer; font: inherit; }
button:hover { background: #24304a; }
button.active { background: #2c4a7a; border-color: #4a7ac0; color: #fff; }
details { margin-top: 8px; border-top: 1px solid #1c2230; padding-top: 6px; }
summary { cursor: pointer; color: #9ab; font-weight: bold; }
.dof { margin: 7px 0 2px; }
.dof label { display: flex; justify-content: space-between; color: #bcd; }
.dof label span { color: #8cf; }
.dof input[type=range] { width: 100%; }
.stress { height: 4px; background: #1a2130; border-radius: 2px; overflow: hidden; }
.stress i { display: block; height: 100%; width: 0%; background: #4a4; }
label.chk { display: block; margin-top: 8px; color: #bcd; cursor: pointer; }
```

- [ ] **Step 2: Add panel markup** right after `<body>`:

```html
<div id="panel">
  <h1>27-DoF Hand Simulator</h1>
  <div class="btnrow" id="objects">
    <button data-obj="sphere">Sphere</button>
    <button data-obj="cube">Cube</button>
    <button data-obj="pencil">Pencil</button>
  </div>
  <div class="btnrow">
    <button id="grasp">Grasp</button>
    <button id="release">Release</button>
    <button id="reset">Reset pose</button>
  </div>
  <div id="readouts">
    <div class="card">Grip force<b id="force">0</b></div>
    <div class="card">Max pressure<b id="maxp">0</b></div>
    <div class="card">Contacts<b id="ncontacts">0</b></div>
    <div class="card">State<b id="state" class="free">free</b></div>
  </div>
  <label class="chk"><input type="checkbox" id="skeleton"> Show actuator skeleton</label>
  <div id="sliders"></div>
</div>
```

- [ ] **Step 3: Build sliders + tween in the module script:**

```js
const ui = { sliderEls: [], valueEls: [], stressEls: [] };
{
  const wrap = document.getElementById('sliders');
  const groups = {};
  DOF_TABLE.forEach((d, j) => {
    if (!groups[d.group]) {
      const det = document.createElement('details');
      det.open = true;
      det.innerHTML = `<summary>${d.group}</summary>`;
      wrap.appendChild(det);
      groups[d.group] = det;
    }
    const row = document.createElement('div');
    row.className = 'dof';
    row.innerHTML = `<label>${d.name}<span></span></label>
      <input type="range" min="${d.min}" max="${d.max}" step="0.01" value="${d.def}">
      <div class="stress"><i></i></div>`;
    groups[d.group].appendChild(row);
    const inp = row.querySelector('input');
    inp.addEventListener('input', () => {
      tween.active = false;                    // manual override cancels tween
      sim.angles[j] = parseFloat(inp.value);
    });
    ui.sliderEls.push(inp);
    ui.valueEls.push(row.querySelector('span'));
    ui.stressEls.push(row.querySelector('.stress i'));
  });
}
function setSliders(angles) {
  angles.forEach((v, j) => { ui.sliderEls[j].value = v; });
}
const tween = { active: false, t0: 0, dur: 900, from: null, to: null, onDone: null };
function startTween(target, onDone) {
  tween.active = true; tween.t0 = performance.now();
  tween.from = sim.angles.slice(); tween.to = target.slice(); tween.onDone = onDone || null;
}
function stepTween(now) {
  if (!tween.active) return;
  let t = (now - tween.t0) / tween.dur;
  if (t >= 1) { t = 1; tween.active = false; }
  const s = t * t * (3 - 2 * t); // smoothstep
  for (let j = 0; j < 27; j++) sim.angles[j] = tween.from[j] + (tween.to[j] - tween.from[j]) * s;
  setSliders(sim.angles);
  if (!tween.active && tween.onDone) tween.onDone();
}
document.querySelectorAll('#objects button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#objects button').forEach(x => x.classList.toggle('active', x === b));
    setObject(b.dataset.obj);
  });
});
document.getElementById('grasp').addEventListener('click', () => {
  if (sim.obj) startTween(POSES[sim.obj.type]);
});
document.getElementById('release').addEventListener('click', () => startTween(POSES.open));
document.getElementById('reset').addEventListener('click', () => startTween(POSES.open));
```

Call `stepTween(now)` at the top of the render loop (change the rAF loop to pass `performance.now()`), and initialize sliders from `sim.angles`. Mark the Sphere object button `.active` at startup. Readout elements (`#force`, `#maxp`, `#ncontacts`, `#state`) are updated in Task 9 when contacts are computed each frame.

- [ ] **Step 4: Verify** — headless screenshot again; expect left panel with 6 groups × sliders (Wrist 6, Thumb 5, fingers 4 each), buttons, readout cards. `node simulate-hand/test.mjs` still green.
- [ ] **Step 5: Commit** — `simulate-hand: control panel with 27 DoF sliders and grasp buttons`.

---

## Task 9: Heatmap, skeleton overlay, grasp/release integration

**Files:**
- Modify: `simulate-hand/index.html` (module script)

**Interfaces:**
- Consumes: everything above.
- Produces: full interactive behavior; `window.__shot(name)` test hook; `?shot=<obj>` URL param.

- [ ] **Step 1: Pressure heatmap.** Precompute sensor→vertex splat map in bind space (same-bone vertices within radius), then per frame reset touched vertices and splat contact pressures:

```js
const RAMP = [[0.27,0.46,0.71],[0.67,0.85,0.91],[1.0,1.0,0.75],[0.99,0.68,0.38],[0.84,0.19,0.15]];
function rampColor(t) {
  const x = clamp(t, 0, 1) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i;
  return [0, 1, 2].map(k => RAMP[i][k] + (RAMP[i + 1][k] - RAMP[i][k]) * f);
}
const splatMap = (() => {                       // per sensor: [{vi, w}, ...]
  const posAttr = handGeo.attributes.position, skinIdx = handGeo.attributes.skinIndex;
  const R = 1.8;
  return sim.sensors.map(s => {
    const sw = sensorWorld(bindPose.world, s);
    const out = [];
    for (let vi = 0; vi < posAttr.count; vi++) {
      if (skinIdx.getX(vi) !== s.bone) continue;
      const dx = posAttr.getX(vi) - sw.pos[0], dy = posAttr.getY(vi) - sw.pos[1],
            dz = posAttr.getZ(vi) - sw.pos[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < R) out.push({ vi, w: (1 - d / R) ** 2 });
    }
    return out;
  });
})();
const heat = new Float32Array(nv);
let touched = [];
function paintHeat(contacts) {
  const colAttr = handGeo.attributes.color;
  for (const vi of touched) {
    heat[vi] = 0;
    colAttr.setXYZ(vi, SKIN.r, SKIN.g, SKIN.b);
  }
  touched = [];
  for (const c of contacts) {
    for (const { vi, w } of splatMap[c.sensor]) {
      if (heat[vi] === 0) touched.push(vi);
      heat[vi] = Math.min(1, heat[vi] + (c.pressure / 60) * w);
    }
  }
  for (const vi of touched) {
    const t = heat[vi], rc = rampColor(t), mix = Math.min(1, t * 4);
    colAttr.setXYZ(vi,
      SKIN.r + (rc[0] - SKIN.r) * mix,
      SKIN.g + (rc[1] - SKIN.g) * mix,
      SKIN.b + (rc[2] - SKIN.b) * mix);
  }
  colAttr.needsUpdate = true;
}
```

- [ ] **Step 2: Skeleton overlay** — one small sphere per bone colored by the max stress of its DoFs, plus line segments to children; `depthTest: false`, toggled by the checkbox:

```js
const overlay = new THREE.Group();
overlay.visible = false;
const jointMats = SKELETON.map(() => new THREE.MeshBasicMaterial({
  color: 0x33cc55, transparent: true, opacity: 0.95, depthTest: false }));
const jointSpheres = SKELETON.map((b, i) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), jointMats[i]);
  m.renderOrder = 10; overlay.add(m); return m;
});
const linePos = new Float32Array((SKELETON.length - 1) * 6);
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
const lines = new THREE.LineSegments(lineGeo,
  new THREE.LineBasicMaterial({ color: 0x557799, depthTest: false, transparent: true }));
lines.renderOrder = 9; overlay.add(lines);
scene.add(overlay);
document.getElementById('skeleton').addEventListener('change',
  e => { overlay.visible = e.target.checked; });
function updateOverlay(pose, stress) {
  let li = 0;
  for (let b = 0; b < SKELETON.length; b++) {
    jointSpheres[b].position.fromArray(pose.world[b].pos);
    let s = 0;
    DOF_TABLE.forEach((d, j) => { if (d.bone === b) s = Math.max(s, stress[j]); });
    const t = Math.min(1, s / STRESS_VIS_MAX);
    jointMats[b].color.setHSL(0.33 * (1 - t), 0.85, 0.5);
    if (SKELETON[b].parent >= 0) {
      linePos.set(pose.world[SKELETON[b].parent].pos, li); li += 3;
      linePos.set(pose.world[b].pos, li); li += 3;
    }
  }
  lineGeo.attributes.position.needsUpdate = true;
}
```

- [ ] **Step 3: Main loop integration** — replace the Task-7 loop with the full simulation frame:

```js
const fall = { active: false, v: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  stepTween(now);
  const pose = computePose(sim.angles);
  applyPoseToBones(pose);
  let contacts = [], stress = new Array(27).fill(0);
  if (sim.obj) {
    if (sim.grasp.attached && sim.rel) {
      const t = applyRel(pose.world[0], sim.rel);
      sim.obj.pos = t.pos; sim.obj.quat = t.quat;
    }
    contacts = computeContacts(pose.world, sim.sensors, sim.obj);
    const g = evalGrasp(contacts, sim.sensors);
    const was = sim.grasp.attached;
    updateGrasp(sim.grasp, g);
    if (!was && sim.grasp.attached) { sim.rel = relToRoot(pose.world[0], sim.obj); fall.active = false; }
    if (was && !sim.grasp.attached) { sim.rel = null; fall.active = true; fall.v = 0; }
    if (fall.active) {                                   // simple gravity drop
      fall.v += 981 * 0.016;                             // cm/s^2
      sim.obj.pos[1] -= fall.v * 0.016;
      const rest = OBJ_DEFS[sim.obj.type].restY;
      if (sim.obj.pos[1] <= rest) {
        sim.obj.pos[1] = rest; fall.active = false;
        sim.obj.quat = OBJ_DEFS[sim.obj.type].quat0.slice();  // settle flat
      }
    }
    stress = computeStress(pose.world, pose.dofFrames, contacts, sim.sensors, sim.angles);
    objectMeshes[sim.obj.type].position.fromArray(sim.obj.pos);
    objectMeshes[sim.obj.type].quaternion.fromArray(sim.obj.quat);
    const force = contacts.reduce((a, c) => a + c.pressure, 0);
    const maxp = contacts.reduce((a, c) => Math.max(a, c.pressure), 0);
    document.getElementById('force').textContent = force.toFixed(0);
    document.getElementById('maxp').textContent = maxp.toFixed(1);
    document.getElementById('ncontacts').textContent = contacts.length;
    const st = document.getElementById('state');
    st.textContent = sim.grasp.attached ? 'grasped' : 'free';
    st.className = sim.grasp.attached ? 'grasped' : 'free';
  }
  paintHeat(contacts);
  for (let j = 0; j < 27; j++) {
    const t = Math.min(1, stress[j] / STRESS_VIS_MAX);
    ui.stressEls[j].style.width = (t * 100).toFixed(1) + '%';
    ui.stressEls[j].style.background = `hsl(${120 * (1 - t)}, 70%, 45%)`;
    ui.valueEls[j].textContent = sim.angles[j].toFixed(2);
  }
  updateOverlay(pose, stress);
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
```

Remove the old Task-7 `(function loop(){...})()` and its trailing `renderOnce()`; keep `renderOnce` as a helper for the shot hook. On `setObject`, also reset `fall.active = false`.

- [ ] **Step 4: Screenshot/test hook** — synchronous state driver (per the rAF-under-virtual-time memory):

```js
window.__shot = function (name) {           // 'sphere' | 'cube' | 'pencil' | 'open'
  if (name !== 'open') {
    setObject(name);
    sim.angles = POSES[name].slice();
  } else {
    sim.angles = POSES.open.slice();
  }
  setSliders(sim.angles);
  tween.active = false;
  frameOnceForShot();
};
function frameOnceForShot() { frame(performance.now()); }
const shotParam = new URLSearchParams(location.search).get('shot');
if (shotParam) window.__shot(shotParam);
```

(`frame` schedules another rAF — harmless under virtual time; the synchronous call guarantees one full contact+heatmap+render pass.)

- [ ] **Step 5: Verify end-to-end in headless Chrome:**

```bash
for o in sphere cube pencil; do
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
    --window-size=1280,800 --virtual-time-budget=8000 \
    --screenshot=/tmp/hand-$o.png \
    "file:///Users/neoneye/git/vibe-coding-lab/simulate-hand/index.html?shot=$o"
done
```

Read all three images. Expected: fingers wrapped around each object, visible red/yellow pressure blooms at contact regions that differ per object (round patch for sphere, edge-aligned for cube, thin band for pencil), state readout `grasped`, stress bars lit for flexed DoFs. Iterate on splat radius / `pressure/60` scaling until blooms are clearly visible but not saturated. Also verify `node simulate-hand/test.mjs` green.
- [ ] **Step 6: Commit** — `simulate-hand: pressure heatmap, stress overlay, grasp integration`.

---

## Task 10: Final verification, gallery screenshot, docs touch-up

**Files:**
- Create: `simulate-hand/screenshot1.png`
- Modify: none expected (fixes only if verification fails)

- [ ] **Step 1: Full test run** — `node simulate-hand/test.mjs`: all tests pass (expect ~30).
- [ ] **Step 2: Interactive verification** — headless screenshots of (a) `?shot=sphere`, (b) the default page (open hand, no params — expect no pressure blooms), and (c) a slider-driven state: copy `index.html` to a temp `_verify.html` (scratchpad) whose init appends a script that runs `window.__shot('sphere')` followed by `ui.sliderEls[12].value = 1.35; ui.sliderEls[12].dispatchEvent(new Event('input')); frame(performance.now())` — expect deeper red bloom and a longer Index MCP stress bar than in (a). Delete the temp file afterwards.
- [ ] **Step 3: Gallery screenshot** — capture the sphere grasp at a flattering angle: temporarily set camera via URL param or just use the `?shot=sphere` capture; save the best frame as `simulate-hand/screenshot1.png` (1280×800). Rebuild gallery if the repo flow requires it (`python3 build_gallery.py` — check `docs/` output is regenerated) and include it in the commit.
- [ ] **Step 4: Update memory/docs if conventions emerged** — none expected.
- [ ] **Step 5: Final commit** — `simulate-hand: gallery screenshot and final polish` (with trailer). Working tree clean.
