# 3D Game of Life Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone three.js page that runs 3D Game of Life on a wrap-around voxel world. It has a cube lattice and a tetra lattice (Kuhn, 6 tetrahedra per voxel), 3×3×3 and 5×5×5 box neighbourhoods, and Generations `S/B/C` rules with presets.

**Architecture:**

- **Pure engine (`GOL.*`)** in a `shared-code` script block, tested in Node. It holds `Uint8Array` cell states and counts neighbours with a separable wrap-around box sum over per-voxel alive counts.
- **Page module** that draws the non-dead cells with `InstancedBufferGeometry`, using one `vec4` (x, y, z, state) per instance and a small `ShaderMaterial`.
- **UI:** a left control panel.
- **Presets:** `search.mjs` reuses the engine to find presets for the combinations that have no known rules.

**Tech Stack:** three.js 0.160.0 plus OrbitControls (jsdelivr import map), vanilla JS, Node 22 for `test.mjs` / `search.mjs`, headless Chrome and the in-app Browser pane for visual checks.

**Spec:** `docs/superpowers/specs/2026-10-11-3d-game-of-life-design.md`

## Global Constraints

- The project is one self-contained `3d-game-of-life/index.html`. The only external dependency is three.js 0.160.0 from `https://cdn.jsdelivr.net/npm/three@0.160.0/`.
- Pure logic lives in `<script id="shared-code">`, with no DOM and no three.js. `test.mjs` extracts it by regex and runs `GolTests.run()`.
- Grid sizes are N ∈ {24, 32, 48, 64}. Radius r ∈ {1, 2} (3×3 / 5×5). The world requires N ≥ 2r+1.
- Max neighbour counts: cube 26 / 124, tetra 161 / 749.
- State bytes: 0 dead, 1 alive, 2…C−1 decaying. Only state 1 counts as a neighbour. Decaying cells cannot be reborn.
- Pixel ratio is `Math.min(devicePixelRatio, 2)`. The canvas is sized by CSS to the full window and `renderer.setSize(w, h, false)`, so the backing store is in device pixels.
- Commit straight to `main`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Pasting a rule from a 3D CA list such as Softology's, which ends in `/M` or `/N`.** `4/4/5/M` should just work. `.../N` should give a clear "only box (M) neighbourhoods" error, not a generic parse failure. Pinned by the "parseRule accepts /M, rejects /N" test in Task 1.
2. **A rule sized for one neighbourhood reaching a world of another.** For example, a custom tetra rule `100-160/...` is still in the field when the user switches to cube 3×3. The engine must refuse a mismatched rule rather than read past the lookup table, and the UI must reparse on every combination change. Pinned by the "World.setRule rejects a rule parsed for another neighbourhood" test in Task 1, plus `setCombo` always applying a preset in Task 4.
3. **The heaviest configuration (64³ tetra 5×5) at max speed must not freeze the tab.** Max mode runs whole steps for ≤ 12 ms per frame and always yields to rendering. Checked in Task 5, step 2.
4. **Slice at 0, Clear, or a rule that kills everything leaves zero instances.** The page must draw nothing, without WebGL errors, and recover when cells come back. Checked in Task 4, step 4.
5. **Switching lattice, neighbourhood or size repeatedly must not leak GPU memory.** `renderer.info.memory.geometries` stays flat over 20 switches. Checked in Task 4, step 5.

---

### Task 1: Engine core (rules, world, box-sum counting, Generations step)

**Files:**
- Create: `3d-game-of-life/index.html` (for now, a minimal page holding only the shared-code block)
- Create: `3d-game-of-life/test.mjs`

**Interfaces:**
- Produces globals: `GolTests` (`add(name, fn)`, `run() → boolean`), `assert(cond, msg)`, `GOL`.
- Produces on `GOL`:
  - `PERMS`: `number[6][3]`, the axis permutations.
  - `TETRA`: `number[6][4][3]`, the vertices of tetra k in the unit voxel. They are a monotone path from (0,0,0) to (1,1,1).
  - `mulberry32(seed) → () => [0,1)`.
  - `cellsPerVoxel(lattice) → 1 | 6`. Lattice is `'cube' | 'tetra'`.
  - `maxCount(lattice, r) → number` = `per·(2r+1)³ − 1`.
  - `parseRule(text, maxC) → { S: Uint8Array(maxC+1), B: Uint8Array(maxC+1), C, text } | { error: string }`.
  - `boxAxis(src, dst, N, r, axis)`: a wrap-around sliding-window sum along axis 0/1/2, on `Uint16Array`s of length N³.
  - `class World(N, lattice, r)`:
    - fields: `N, lattice, r, per, nv, nc, maxCount, state, rule, gen, alive, nonDead, changes, changed`;
    - methods: `setRule(rule)`, `clear()`, `seed(density, region, rng)`, `updateStats()`, `countVoxels() → Uint16Array` (per-voxel box sum of alive cells, self included), `step()`.
- **`world.state` is swapped on every step.** Callers must read `world.state` fresh each time and never cache the array.
- Indexing: voxel `v = x + N*(y + N*z)`; cell `c = v*per + k`.

- [ ] **Step 1: Write `test.mjs`**

```js
// Runs the GolTests embedded in index.html's shared-code script block.
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
const ok = new Function(`${m[1]}; return GolTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Write `index.html` with the harness, a stub `GOL`, and all Task 1 tests**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>3D Game of Life</title>
</head>
<body>
<script id="shared-code">
// ── Test harness ─────────────────────────────────────────────────────────
const GolTests = (() => {
  const tests = [];
  return {
    add(name, fn) { tests.push([name, fn]); },
    run() {
      let pass = 0, fail = 0;
      for (const [name, fn] of tests) {
        try { fn(); pass++; } catch (e) { fail++; console.log(`FAIL ${name}: ${e.message}`); }
      }
      console.log(`${pass} passed, ${fail} failed`);
      return fail === 0;
    },
  };
})();
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

// ── Engine ───────────────────────────────────────────────────────────────
const GOL = (() => {
  return {};
})();

// ── Tests ────────────────────────────────────────────────────────────────
const T = (() => {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const det3 = (u, v, w) =>
    u[0] * (v[1] * w[2] - v[2] * w[1]) - u[1] * (v[0] * w[2] - v[2] * w[0]) + u[2] * (v[0] * w[1] - v[1] * w[0]);
  const orient = (a, b, c, d) => det3(sub(b, a), sub(c, a), sub(d, a));
  function insideTet(p, [a, b, c, d]) {
    const s = Math.sign(orient(a, b, c, d));
    return Math.sign(orient(p, b, c, d)) === s && Math.sign(orient(a, p, c, d)) === s &&
           Math.sign(orient(a, b, p, d)) === s && Math.sign(orient(a, b, c, p)) === s;
  }
  // Brute-force per-cell neighbour count straight from the definition.
  function bruteCounts(w) {
    const { N, r, per, state } = w, out = new Uint16Array(w.nc);
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      for (let k = 0; k < per; k++) {
        const c = (x + N * (y + N * z)) * per + k;
        let s = 0;
        for (let dz = -r; dz <= r; dz++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const v = ((x + dx + N) % N) + N * (((y + dy + N) % N) + N * ((z + dz + N) % N));
          for (let kk = 0; kk < per; kk++) if (state[v * per + kk] === 1) s++;
        }
        if (state[c] === 1) s--;
        out[c] = s;
      }
    return out;
  }
  function engineCounts(w) {
    const cnt = w.countVoxels(), out = new Uint16Array(w.nc);
    for (let c = 0; c < w.nc; c++) out[c] = cnt[(c / w.per) | 0] - (w.state[c] === 1 ? 1 : 0);
    return out;
  }
  function randomStates(w, seed) {
    const rng = GOL.mulberry32(seed);
    for (let c = 0; c < w.nc; c++) w.state[c] = Math.floor(rng() * 4); // 0..3 incl. decaying
  }
  return { orient, insideTet, bruteCounts, engineCounts, randomStates };
})();

GolTests.add('maxCount per lattice and radius', () => {
  assert(GOL.maxCount('cube', 1) === 26 && GOL.maxCount('cube', 2) === 124);
  assert(GOL.maxCount('tetra', 1) === 161 && GOL.maxCount('tetra', 2) === 749);
});

GolTests.add('parseRule ranges and lists', () => {
  const r = GOL.parseRule(' 9-26 / 5-7,12-13,15 / 5 ', 26);
  assert(!r.error, r.error);
  assert(r.C === 5 && r.text === '9-26/5-7,12-13,15/5', r.text);
  for (let c = 0; c <= 26; c++) {
    assert(r.S[c] === (c >= 9 ? 1 : 0), `S[${c}]`);
    const inB = (c >= 5 && c <= 7) || c === 12 || c === 13 || c === 15;
    assert(r.B[c] === (inB ? 1 : 0), `B[${c}]`);
  }
});

GolTests.add('parseRule empty S or B', () => {
  const r = GOL.parseRule('/3/2', 26);
  assert(!r.error && r.S.every(x => x === 0) && r.B[3] === 1);
  const q = GOL.parseRule('4//3', 26);
  assert(!q.error && q.B.every(x => x === 0) && q.S[4] === 1);
});

GolTests.add('parseRule rejects malformed or out-of-range rules', () => {
  for (const bad of ['', '4/4', '4/4/1', '4/x/5', '27/4/5', '5-3/4/5', '4,,5/4/5', '4/4/2.5', '4/4/256', '4/4/5/M/1'])
    assert(GOL.parseRule(bad, 26).error, `accepted "${bad}"`);
  assert(/exceeds/.test(GOL.parseRule('27/4/5', 26).error));
  assert(!GOL.parseRule('26/26/2', 26).error);
});

GolTests.add('parseRule accepts /M, rejects /N', () => {
  const r = GOL.parseRule('4/4/5/M', 26);
  assert(!r.error && r.C === 5 && r.text === '4/4/5', r.error);
  assert(!GOL.parseRule('4/4/5/m', 26).error);
  assert(/box/.test(GOL.parseRule('0-6/1,3/2/N', 26).error));
});

GolTests.add('World rejects N < 2r+1', () => {
  let threw = false;
  try { new GOL.World(4, 'cube', 2); } catch { threw = true; }
  assert(threw);
  new GOL.World(5, 'cube', 2);
});

GolTests.add('World.setRule rejects a rule parsed for another neighbourhood', () => {
  const w = new GOL.World(6, 'cube', 1);
  let threw = false;
  try { w.setRule(GOL.parseRule('4/4/5', 161)); } catch { threw = true; }
  assert(threw);
  w.setRule(GOL.parseRule('4/4/5', 26));
});

GolTests.add('box-sum counts match brute force (cube/tetra, r=1/2, across the wrap)', () => {
  for (const [lat, r, N] of [['cube', 1, 3], ['cube', 1, 6], ['cube', 2, 5], ['cube', 2, 7],
                             ['tetra', 1, 3], ['tetra', 1, 4], ['tetra', 2, 5]]) {
    const w = new GOL.World(N, lat, r);
    T.randomStates(w, 11 + N);
    const a = T.bruteCounts(w), b = T.engineCounts(w);
    for (let c = 0; c < w.nc; c++) assert(a[c] === b[c], `${lat} r=${r} N=${N} cell ${c}: ${b[c]} != ${a[c]}`);
  }
});

GolTests.add('Kuhn tetrahedra partition the unit cube', () => {
  let total = 0;
  for (const t of GOL.TETRA) {
    const V = Math.abs(T.orient(...t)) / 6;
    assert(Math.abs(V - 1 / 6) < 1e-12, `volume ${V}`);
    total += V;
  }
  assert(Math.abs(total - 1) < 1e-12);
  const rng = GOL.mulberry32(7);
  for (let i = 0; i < 3000; i++) {
    const p = [rng(), rng(), rng()];
    const hits = GOL.TETRA.filter(t => T.insideTet(p, t)).length;
    assert(hits === 1, `point ${p} in ${hits} tetrahedra`);
  }
});

GolTests.add('Generations: decay 1→2→3→4→0, no rebirth while decaying', () => {
  const w = new GOL.World(5, 'cube', 1);
  w.setRule(GOL.parseRule('/1-26/5', 26)); // nothing survives; any neighbour gives birth
  const c = 2 + 5 * (2 + 5 * 2), nb = 3 + 5 * (2 + 5 * 2);
  w.state[c] = 1; w.updateStats();
  w.step(); assert(w.state[c] === 2 && w.state[nb] === 1, `step1 ${w.state[c]} ${w.state[nb]}`);
  w.step(); assert(w.state[c] === 3, `decaying cell reborn: ${w.state[c]}`);
  w.step(); assert(w.state[c] === 4);
  w.step(); assert(w.state[c] === 0);
  assert(w.gen === 4);
});

GolTests.add('C=2 is classic Life: 2x2x2 block is a still life under 5-7/6/2', () => {
  const N = 8, w = new GOL.World(N, 'cube', 1);
  w.setRule(GOL.parseRule('5-7/6/2', 26));
  for (const [x, y, z] of [[3,3,3],[4,3,3],[3,4,3],[4,4,3],[3,3,4],[4,3,4],[3,4,4],[4,4,4]])
    w.state[x + N * (y + N * z)] = 1;
  const lone = 0; w.state[lone] = 1; // isolated cell dies straight to 0 (no decay when C=2)
  w.updateStats();
  w.step();
  assert(w.state[lone] === 0, 'lone cell should die to 0');
  w.step(); w.step();
  assert(w.alive === 8 && w.nonDead === 8 && !w.changed, `alive ${w.alive} changed ${w.changed}`);
});

GolTests.add('B0 on an empty world births every cell', () => {
  const w = new GOL.World(4, 'tetra', 1);
  w.setRule(GOL.parseRule('/0/2', 161));
  w.clear(); w.step();
  assert(w.alive === w.nc, `${w.alive}/${w.nc}`);
});

GolTests.add('dynamics are translation-invariant across the wrap', () => {
  for (const [lat, r] of [['cube', 1], ['cube', 2], ['tetra', 1], ['tetra', 2]]) {
    const N = 7, m = GOL.maxCount(lat, r), f = x => Math.round(m * x);
    const rule = GOL.parseRule(`${f(0.15)}-${f(0.35)}/${f(0.2)}-${f(0.3)}/4`, m);
    const w1 = new GOL.World(N, lat, r), w2 = new GOL.World(N, lat, r);
    w1.setRule(rule); w2.setRule(rule);
    w1.seed(0.4, N, GOL.mulberry32(3));
    const per = w1.per, idx = (x, y, z) => (x % N) + N * ((y % N) + N * (z % N));
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      for (let k = 0; k < per; k++)
        w2.state[idx(x + 3, y + 5, z + 6) * per + k] = w1.state[idx(x, y, z) * per + k];
    w2.updateStats();
    for (let g = 0; g < 4; g++) {
      w1.step(); w2.step();
      if (g === 0) assert(w1.changed, `${lat} r=${r}: rule did nothing`);
    }
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      for (let k = 0; k < per; k++)
        assert(w2.state[idx(x + 3, y + 5, z + 6) * per + k] === w1.state[idx(x, y, z) * per + k],
               `${lat} r=${r} mismatch at ${x},${y},${z},${k}`);
  }
});

GolTests.add('seed fills only the centred region, reproducibly', () => {
  const w = new GOL.World(10, 'cube', 1);
  w.seed(1, 4, GOL.mulberry32(1));
  assert(w.alive === 64 && w.gen === 0, `${w.alive}`);
  assert(w.state[3 + 10 * (3 + 10 * 3)] === 1 && w.state[2 + 10 * (3 + 10 * 3)] === 0);
  const a = new GOL.World(10, 'tetra', 1), b = new GOL.World(10, 'tetra', 1);
  a.seed(0.3, 10, GOL.mulberry32(9)); b.seed(0.3, 10, GOL.mulberry32(9));
  assert(a.state.every((s, i) => s === b.state[i]));
});
</script>
</body>
</html>
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `node 3d-game-of-life/test.mjs`
Expected: every test FAILs (`GOL.maxCount is not a function` and similar), ending with `0 passed, 14 failed`.

- [ ] **Step 4: Replace the stub `GOL` with the engine**

Replace `const GOL = (() => {\n  return {};\n})();` with:

```js
const GOL = (() => {
  // Kuhn/Freudenthal triangulation: tetra k = monotone path (0,0,0) → (1,1,1) adding axes in PERMS[k] order.
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const TETRA = PERMS.map(p => {
    const v = [0, 0, 0], out = [[0, 0, 0]];
    for (const ax of p) { v[ax] = 1; out.push(v.slice()); }
    return out;
  });

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const cellsPerVoxel = lattice => (lattice === 'tetra' ? 6 : 1);
  const maxCount = (lattice, r) => cellsPerVoxel(lattice) * (2 * r + 1) ** 3 - 1;

  // "S/B/C", optionally followed by "/M" (box neighbourhood) as in common 3D CA rule lists.
  function parseRule(text, maxC) {
    const parts = String(text).replace(/\s+/g, '').split('/');
    if (parts.length === 4) {
      if (/^n$/i.test(parts[3])) return { error: 'Only box (M) neighbourhoods are supported, not von Neumann (N)' };
      if (!/^m$/i.test(parts[3])) return { error: `Unknown neighbourhood "${parts[3]}"` };
      parts.pop();
    }
    if (parts.length !== 3) return { error: 'Rule must be S/B/C, e.g. 4/4/5' };
    const tables = [];
    for (let i = 0; i < 2; i++) {
      const t = new Uint8Array(maxC + 1);
      if (parts[i] !== '') for (const tok of parts[i].split(',')) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(tok);
        if (!m) return { error: `Bad ${i ? 'birth' : 'survival'} entry "${tok}"` };
        const a = +m[1], b = m[2] === undefined ? a : +m[2];
        if (a > b) return { error: `Backwards range "${tok}"` };
        if (b > maxC) return { error: `${b} exceeds the max neighbour count ${maxC}` };
        for (let c = a; c <= b; c++) t[c] = 1;
      }
      tables.push(t);
    }
    if (!/^\d+$/.test(parts[2])) return { error: 'State count C must be a whole number' };
    const C = +parts[2];
    if (C < 2 || C > 255) return { error: 'State count C must be 2..255' };
    return { S: tables[0], B: tables[1], C, text: parts.join('/') };
  }

  // Wrap-around sliding-window sum of radius r along one axis of an N³ grid.
  function boxAxis(src, dst, N, r, axis) {
    const st = axis === 0 ? 1 : axis === 1 ? N : N * N;  // stride along the summed axis
    const s1 = axis === 0 ? N : 1;                       // strides of the two other axes
    const s2 = axis === 2 ? N : N * N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const base = i * s1 + j * s2;
      let sum = 0;
      for (let d = -r; d <= r; d++) sum += src[base + ((d + N) % N) * st];
      for (let t = 0; t < N; t++) {
        dst[base + t * st] = sum;
        sum += src[base + ((t + r + 1) % N) * st] - src[base + ((t - r + N) % N) * st];
      }
    }
  }

  class World {
    constructor(N, lattice, r) {
      if (N < 2 * r + 1) throw new Error(`N=${N} is too small for radius ${r}`);
      this.N = N; this.lattice = lattice; this.r = r;
      this.per = cellsPerVoxel(lattice);
      this.nv = N * N * N; this.nc = this.nv * this.per;
      this.maxCount = maxCount(lattice, r);
      this.state = new Uint8Array(this.nc);
      this.next = new Uint8Array(this.nc);
      this.a = new Uint16Array(this.nv);
      this.b = new Uint16Array(this.nv);
      this.rule = null;
      this.gen = 0; this.alive = 0; this.nonDead = 0; this.changes = 0; this.changed = false;
    }
    setRule(rule) {
      if (!rule || rule.error || rule.S.length !== this.maxCount + 1)
        throw new Error('rule was parsed for a different neighbourhood');
      this.rule = rule;
    }
    clear() { this.state.fill(0); this.gen = 0; this.updateStats(); }
    seed(density, region, rng) {
      const { N, per, state } = this;
      state.fill(0);
      const L = Math.max(1, Math.min(N, Math.round(region))), o = (N - L) >> 1;
      for (let z = o; z < o + L; z++) for (let y = o; y < o + L; y++) for (let x = o; x < o + L; x++) {
        const base = (x + N * (y + N * z)) * per;
        for (let k = 0; k < per; k++) if (rng() < density) state[base + k] = 1;
      }
      this.gen = 0; this.updateStats();
    }
    updateStats() {
      let alive = 0, nonDead = 0;
      const st = this.state;
      for (let c = 0; c < st.length; c++) { const s = st[c]; if (s) { nonDead++; if (s === 1) alive++; } }
      this.alive = alive; this.nonDead = nonDead; this.changes = 0; this.changed = false;
    }
    // Per-voxel count of alive cells in the (2r+1)³ voxel block, the voxel itself included.
    countVoxels() {
      const { N, r, per, state, a, b, nv } = this;
      if (per === 1) for (let v = 0; v < nv; v++) a[v] = state[v] === 1 ? 1 : 0;
      else for (let v = 0, c = 0; v < nv; v++) {
        let s = 0;
        for (let k = 0; k < 6; k++, c++) if (state[c] === 1) s++;
        a[v] = s;
      }
      boxAxis(a, b, N, r, 0); boxAxis(b, a, N, r, 1); boxAxis(a, b, N, r, 2);
      return b;
    }
    step() {
      const { per, state, next, nv } = this, { S, B, C } = this.rule;
      const cnt = this.countVoxels();
      let alive = 0, nonDead = 0, changes = 0;
      for (let v = 0, c = 0; v < nv; v++) {
        const n = cnt[v];
        for (let k = 0; k < per; k++, c++) {
          const s = state[c];
          let ns;
          if (s === 0) ns = B[n];
          else if (s === 1) ns = S[n - 1] ? 1 : (C === 2 ? 0 : 2);
          else ns = s + 1 >= C ? 0 : s + 1;
          next[c] = ns;
          if (ns) { nonDead++; if (ns === 1) alive++; }
          if (ns !== s) changes++;
        }
      }
      this.state = next; this.next = state;
      this.alive = alive; this.nonDead = nonDead; this.changes = changes; this.changed = changes > 0;
      this.gen++;
    }
  }

  return { PERMS, TETRA, mulberry32, cellsPerVoxel, maxCount, parseRule, boxAxis, World };
})();
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `node 3d-game-of-life/test.mjs`
Expected: `14 passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add 3d-game-of-life/index.html 3d-game-of-life/test.mjs
git commit -m "3d-game-of-life: engine core with box-sum counting, Kuhn tetra lattice and Generations rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Preset evaluation, `search.mjs` and the preset table

**Files:**
- Modify: `3d-game-of-life/index.html` (shared-code: add `evaluate`, `PRESETS` and `presetsFor` to `GOL`, and add tests)
- Create: `3d-game-of-life/search.mjs`

**Interfaces:**
- Consumes: `GOL.World`, `GOL.parseRule`, `GOL.mulberry32`, `GOL.maxCount` (Task 1).
- Produces on `GOL`:
  - `PRESETS`: `Array<{ name, lattice: 'cube'|'tetra', r: 1|2, rule: string, density: number, fill: number }>`. `fill` is the seed-region edge as a fraction of N.
  - `presetsFor(lattice, r) → preset[]`, in table order. The first entry is the default for that combination.
  - `evaluate(preset, { N = 32, gens = 300, window = 50, seed = 1 } = {}) → { ok, alive, frac, lastChange, activity, reason? }`.
    - `frac` is nonDead / nc after `gens` generations.
    - `activity` is the mean of `changes / nc` over the last `window` generations.
    - `ok` = `alive > 0 && frac < 0.5 && lastChange >= gens - window`.

- [ ] **Step 1: Add the failing preset tests** (append them to the tests section of shared-code)

```js
GolTests.add('every preset parses for its own neighbourhood', () => {
  assert(GOL.PRESETS.length > 0);
  for (const p of GOL.PRESETS) {
    const r = GOL.parseRule(p.rule, GOL.maxCount(p.lattice, p.r));
    assert(!r.error, `${p.name}: ${r.error}`);
    assert(p.density > 0 && p.density <= 1 && p.fill > 0 && p.fill <= 1, p.name);
  }
});

GolTests.add('at least 4 presets per lattice/neighbourhood', () => {
  for (const lat of ['cube', 'tetra']) for (const r of [1, 2]) {
    const n = GOL.presetsFor(lat, r).length;
    assert(n >= 4, `${lat} r=${r} has ${n} presets`);
  }
});

GolTests.add('every preset stays alive, below 50% and active for 300 generations (N=32)', () => {
  for (const p of GOL.PRESETS) {
    const e = GOL.evaluate(p);
    assert(e.ok, `${p.name} (${p.lattice} r=${p.r} ${p.rule}): alive ${e.alive} frac ${e.frac?.toFixed(3)} lastChange ${e.lastChange} ${e.reason || ''}`);
  }
});
```

- [ ] **Step 2: Run the tests and confirm the new ones fail**

Run: `node 3d-game-of-life/test.mjs`
Expected: 3 FAIL lines (`GOL.PRESETS` undefined), ending with `14 passed, 3 failed`.

- [ ] **Step 3: Add `evaluate`, `presetsFor` and the known cube 3×3 presets to `GOL`**

Inside the `GOL` IIFE, before `return`, add:

```js
  // Presets: cube r=1 entries are well-known 26-neighbour rules; the rest come from search.mjs.
  const PRESETS = [
    { name: 'Amoeba',      lattice: 'cube', r: 1, rule: '9-26/5-7,12-13,15/5', density: 0.35, fill: 0.5 },
    { name: '445',         lattice: 'cube', r: 1, rule: '4/4/5',               density: 0.35, fill: 0.3 },
    { name: 'Clouds',      lattice: 'cube', r: 1, rule: '13-26/13-14,17-19/2', density: 0.5,  fill: 1.0 },
    { name: 'Pyroclastic', lattice: 'cube', r: 1, rule: '4-7/6-8/10',          density: 0.35, fill: 0.4 },
    { name: 'Builder',     lattice: 'cube', r: 1, rule: '2,6,9/4,6,8-9/10',    density: 0.35, fill: 0.3 },
    { name: 'Bays 4555',   lattice: 'cube', r: 1, rule: '4-5/5/2',             density: 0.3,  fill: 0.4 },
    { name: 'Bays 5766',   lattice: 'cube', r: 1, rule: '5-7/6/2',             density: 0.3,  fill: 0.4 },
  ];
  const presetsFor = (lattice, r) => PRESETS.filter(p => p.lattice === lattice && p.r === r);

  function evaluate(preset, { N = 32, gens = 300, window = 50, seed = 1 } = {}) {
    const w = new World(N, preset.lattice, preset.r);
    const rule = parseRule(preset.rule, w.maxCount);
    if (rule.error) return { ok: false, reason: rule.error };
    w.setRule(rule);
    w.seed(preset.density, preset.fill * N, mulberry32(seed));
    let lastChange = -1, act = 0;
    for (let g = 0; g < gens; g++) {
      w.step();
      if (w.changed) lastChange = g;
      if (g >= gens - window) act += w.changes / w.nc;
    }
    const frac = w.nonDead / w.nc;
    return { ok: w.alive > 0 && frac < 0.5 && lastChange >= gens - window,
             alive: w.alive, frac, lastChange, activity: act / window };
  }
```

and change the return line to:

```js
  return { PERMS, TETRA, mulberry32, cellsPerVoxel, maxCount, parseRule, boxAxis, World, PRESETS, presetsFor, evaluate };
```

- [ ] **Step 4: Check the known cube 3×3 presets**

Run: `node 3d-game-of-life/test.mjs`
Expected: the "at least 4 presets" test fails for the three empty combinations. Look at the "every preset stays alive" output for cube r=1 entries. For each failing known rule, try `fill` ∈ {0.2, 0.3, 0.5, 1.0} and `density` ∈ {0.2, 0.35, 0.5} with a quick one-off:

```bash
node -e '
const fs=require("fs");const h=fs.readFileSync("3d-game-of-life/index.html","utf8");
const G=new Function(h.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1]+";return GOL;")();
const name=process.argv[1];const base=G.PRESETS.find(p=>p.name===name);
for(const fill of [0.2,0.3,0.5,1])for(const density of [0.2,0.35,0.5]){const e=G.evaluate({...base,fill,density});console.log(fill,density,e.ok,e.alive,e.frac.toFixed(3),e.activity.toFixed(4));}
' "445"
```

Pick the passing combination with the highest `activity` and a `frac` between 0.02 and 0.3. If nothing passes, delete that preset from the table. Keep at least 4 cube r=1 presets. Amoeba stays first if it passes; otherwise the best passing preset moves first, because it becomes the page default.

- [ ] **Step 5: Write `search.mjs`**

```js
// Random-searches S/B/C rules for one lattice/neighbourhood using the shared-code engine.
// Prints candidates that pass GOL.evaluate (N=32, 300 gens), best activity first.
// Usage: node search.mjs <cube|tetra> <1|2> [tries=300] [seed=1]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const GOL = new Function(`${html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1]}; return GOL;`)();

const [lattice = "tetra", rArg = "1", triesArg = "300", seedArg = "1"] = process.argv.slice(2);
const r = +rArg, maxC = GOL.maxCount(lattice, r), rng = GOL.mulberry32(+seedArg);
const uni = (lo, hi) => lo + rng() * (hi - lo);
const pickOf = arr => arr[Math.floor(rng() * arr.length)];

// Scale a 26-neighbour rule's counts to this neighbourhood by density fraction.
function scaleRule(rule, from, to) {
  const [S, B, C] = rule.split("/");
  const sc = part => part === "" ? "" : part.split(",").map(tok => {
    const [a, b = a] = tok.split("-").map(Number);
    const lo = Math.round((a / from) * to), hi = Math.max(lo, Math.round((b / from) * to));
    return lo === hi ? `${lo}` : `${lo}-${hi}`;
  }).join(",");
  return `${sc(S)}/${sc(B)}/${C}`;
}
function band(fLo, fHi) {
  const lo = Math.max(1, Math.round(fLo * maxC)), hi = Math.min(maxC, Math.max(lo, Math.round(fHi * maxC)));
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
}

const candidates = [];
for (const p of GOL.presetsFor("cube", 1))
  candidates.push({ name: `${p.name} (scaled)`, lattice, r, rule: scaleRule(p.rule, 26, maxC), density: p.density, fill: p.fill });
for (let i = 0; i < +triesArg; i++) {
  const s0 = uni(0.03, 0.5), b0 = uni(0.03, 0.4);
  const S = band(s0, s0 + uni(0, 0.3)), B = band(b0, b0 + uni(0, 0.12));
  candidates.push({ name: `rand${i}`, lattice, r, rule: `${S}/${B}/${pickOf([2, 3, 4, 5, 6, 8, 10])}`,
                    density: pickOf([0.2, 0.3, 0.4, 0.5]), fill: pickOf([0.3, 0.5, 0.7, 1.0]) });
}

const passed = [];
for (const c of candidates) {
  const quick = GOL.evaluate(c, { N: 24, gens: 150 });       // cheap filter
  if (!quick.ok) continue;
  const e = GOL.evaluate(c);                                 // the real acceptance test
  if (e.ok) passed.push({ ...c, frac: +e.frac.toFixed(3), activity: +e.activity.toFixed(4) });
}
passed.sort((a, b) => b.activity - a.activity);
console.log(`${lattice} r=${r} maxCount=${maxC}: ${passed.length}/${candidates.length} passed`);
for (const p of passed.slice(0, 20)) console.log(JSON.stringify(p));
```

- [ ] **Step 6: Run the search for the three missing combinations**

Run each command (they can run in parallel, in the background):

```bash
node 3d-game-of-life/search.mjs cube 2 300 1
node 3d-game-of-life/search.mjs tetra 1 300 1
node 3d-game-of-life/search.mjs tetra 2 300 1
```

Expected: each prints `N/M passed` and up to 20 JSON lines. If a combination prints fewer than 4, rerun it with seed 2 and 600 tries.

- [ ] **Step 7: Pick 4–6 presets per combination and add them to `PRESETS`**

For each combination choose varied candidates:

- at least one with C = 2 (classic) and at least one with C ≥ 5 (decay trails);
- `frac` spread between about 0.02 and 0.35;
- prefer the scaled versions of known rules when they pass.

Before naming one, watch it briefly. The page renderer does not exist yet, so judge from numbers: run `GOL.evaluate` with `gens` 100/200/300 and note whether the population grows, shrinks or holds steady. Then name it after its behaviour: `Tetra Amoeba` for a scaled Amoeba, otherwise a short descriptive name such as `Coral`, `Foam`, `Embers`, `Slow Bloom` or `Lattice Rain`. Every name must be unique across the whole table.

Order the entries within each combination with the most visually active preset first, because it becomes that combination's default. Add them to `PRESETS` grouped by combination: cube r=1, cube r=2, tetra r=1, tetra r=2.

- [ ] **Step 8: Run the tests**

Run: `node 3d-game-of-life/test.mjs`
Expected: `17 passed, 0 failed`. The preset test takes several seconds because the tetra presets each run 300 generations of 196k cells.

- [ ] **Step 9: Commit**

```bash
git add 3d-game-of-life/index.html 3d-game-of-life/search.mjs
git commit -m "3d-game-of-life: preset acceptance test, rule search script and presets for all four combinations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Renderer and main loop (three.js, instanced cells, URL params, debug handle)

**Files:**
- Modify: `3d-game-of-life/index.html` (add styles, the canvas, the readout, the import map and the page module after the shared-code block)

**Interfaces:**
- Consumes: `GOL.World`, `GOL.parseRule`, `GOL.presetsFor`, `GOL.TETRA`, `GOL.mulberry32` (Tasks 1–2).
- Produces, in page-module scope, for Task 4 to wire up:
  - `sim`: `{ world, rule, lattice, r, N, playing, gps, density, fill, presetIndex }`. `gps` 61 means "max".
  - `view`: `{ layers, sliceAxis: 0|1|2, sliceValue: number, colorMode: 0|1 }`.
  - `setCombo(lattice, r, N)`: builds a new world and layers and applies preset 0.
  - `applyPreset(i)`: sets the rule, density and fill, then reseeds.
  - `applyRule(text) → error string | null`: does not reseed.
  - `reseed(seed?)`, `clearWorld()`, `stepOnce()`.
  - `markDirty()`, `updateReadout()`.
  - `controls` (OrbitControls), `material`.
- Produces `window.__gol = { sim, view, GOL, renderer, step(n), render(), setCombo, applyPreset, applyRule }`.
- URL params: `lattice=cube|tetra`, `r=1|2`, `n=24|32|48|64`, `preset=<index within combination>`, `seed=<int>`, `gen=<pre-steps>`, `play=0`, `rotate=0`, `ui=0` (hides the panel and readout, for gallery shots).

- [ ] **Step 1: Add the styles, canvas and readout**

In `<head>`, after `<title>`:

```html
<style>
  :root { --bg:#07080c; --panel:rgba(14,16,24,0.9); --fg:#d8dce8; --dim:#8a90a2; --accent:#7fd4ff; --err:#ff8a8a; --line:#ffffff18; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; background: var(--bg); color: var(--fg);
    font: 13px/1.45 system-ui, -apple-system, sans-serif; }
  #view { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
  #readout { position: fixed; right: 12px; bottom: 12px; padding: 6px 10px; border-radius: 8px;
    background: var(--panel); border: 1px solid var(--line); font: 12px/1.4 ui-monospace, Menlo, monospace;
    color: var(--dim); pointer-events: none; }
  body.noui #panel, body.noui #readout, body.noui #panelToggle { display: none !important; }
</style>
```

In `<body>`, before `<script id="shared-code">`:

```html
<canvas id="view"></canvas>
<div id="readout"></div>
```

- [ ] **Step 2: Add the import map and page module after the shared-code `</script>`**

```html
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = new URLSearchParams(location.search);
if (params.get('ui') === '0') document.body.classList.add('noui');

// ── Renderer, camera ─────────────────────────────────────────────────────
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080c);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 4000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = params.get('rotate') !== '0';
controls.autoRotateSpeed = 0.6;

function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ── Cell material: per-instance vec4 (x, y, z, state) ────────────────────
const material = new THREE.ShaderMaterial({
  uniforms: { uN: { value: 48 }, uC: { value: 2 }, uMode: { value: 0 } },
  vertexShader: `
    attribute vec4 aCell;
    uniform float uN, uC, uMode;
    varying vec3 vColor;
    const vec3 LIGHT = vec3(0.4575, 0.7625, 0.4575); // normalized (0.45, 0.75, 0.45), view space
    void main() {
      vec3 p = position + aCell.xyz - 0.5 * uN;
      vec3 n = normalize(normalMatrix * normal);
      float diff = max(dot(n, LIGHT), 0.0);
      float t = uC > 2.0 ? (aCell.w - 1.0) / (uC - 1.0) : 0.0;   // 0 alive → ~1 nearly gone
      vec3 base, ember;
      if (uMode < 0.5) {
        base = 0.22 + 0.78 * (aCell.xyz + 0.5) / uN;               // hue from position
        ember = vec3(0.55, 0.15, 0.08);
      } else {
        base = vec3(1.0, 0.93, 0.62);                              // warm white = alive
        ember = mix(vec3(1.0, 0.42, 0.08), vec3(0.32, 0.05, 0.28), t);
      }
      vec3 col = mix(base, ember, clamp(t * 1.6, 0.0, 1.0)) * (1.0 - 0.5 * t);
      vColor = col * (0.34 + 0.76 * diff);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `
    varying vec3 vColor;
    void main() { gl_FragColor = vec4(vColor, 1.0); }`,
});

// ── Geometry ─────────────────────────────────────────────────────────────
function cubeGeometry() {
  const g = new THREE.BoxGeometry(0.86, 0.86, 0.86);
  g.translate(0.5, 0.5, 0.5);
  return g;
}
function tetraGeometry(k) {
  const V = GOL.TETRA[k].map(v => new THREE.Vector3(...v));
  const cen = V.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(0.25);
  const P = V.map(v => v.clone().sub(cen).multiplyScalar(0.8).add(cen));
  const pos = [];
  for (const f of [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]) {
    let [a, b, c] = f.map(i => P[i]);
    const opp = P[6 - f[0] - f[1] - f[2]];
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(new THREE.Vector3().subVectors(opp, a)) > 0) [b, c] = [c, b]; // face outward
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals(); // non-indexed → flat face normals
  return g;
}
function makeLayer(src, cap) {
  const geo = new THREE.InstancedBufferGeometry().copy(src);
  const buf = new Float32Array(cap * 4);
  const attr = new THREE.InstancedBufferAttribute(buf, 4);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aCell', attr);
  geo.instanceCount = 0;
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, geo, attr, buf };
}

// ── Simulation + view state ──────────────────────────────────────────────
const MAX_GPS = 61;
const sim = { world: null, rule: null, lattice: 'cube', r: 1, N: 48, playing: params.get('play') !== '0',
              gps: 12, density: 0.35, fill: 0.5, presetIndex: 0 };
const view = { layers: [], frame: null, sliceAxis: 1, sliceValue: 48, colorMode: 0 };
let dirty = true, stepMs = 0;
const markDirty = () => { dirty = true; };

function buildLayers() {
  const w = sim.world;
  for (const L of view.layers) { scene.remove(L.mesh); L.geo.dispose(); }
  const srcs = w.lattice === 'cube' ? [cubeGeometry()] : GOL.TETRA.map((_, k) => tetraGeometry(k));
  view.layers = srcs.map(src => { const L = makeLayer(src, w.nv); src.dispose(); scene.add(L.mesh); return L; });
  if (view.frame) { scene.remove(view.frame); view.frame.geometry.dispose(); view.frame.material.dispose(); }
  view.frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w.N, w.N, w.N)),
                                      new THREE.LineBasicMaterial({ color: 0x3a4660 }));
  scene.add(view.frame);
  material.uniforms.uN.value = w.N;
  view.sliceValue = w.N;
  camera.position.set(1.3, 0.95, 1.6).normalize().multiplyScalar(w.N * 2.3);
  controls.target.set(0, 0, 0);
  controls.update();
}

function refill() {
  const w = sim.world, { N, per } = w, st = w.state;
  const ax = view.sliceAxis, lim = view.sliceValue;
  const counts = new Array(per).fill(0), bufs = view.layers.map(L => L.buf);
  for (let z = 0, c = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((ax === 0 ? x : ax === 1 ? y : z) >= lim) { c += per; continue; }
    for (let k = 0; k < per; k++, c++) {
      const s = st[c];
      if (!s) continue;
      const b = bufs[k], i = counts[k]++ * 4;
      b[i] = x; b[i + 1] = y; b[i + 2] = z; b[i + 3] = s;
    }
  }
  view.layers.forEach((L, k) => {
    L.geo.instanceCount = counts[k];
    L.mesh.visible = counts[k] > 0;
    if (counts[k] > 0) {
      L.attr.clearUpdateRanges();
      L.attr.addUpdateRange(0, counts[k] * 4);
      L.attr.needsUpdate = true;
    }
  });
  material.uniforms.uC.value = sim.rule ? sim.rule.C : 2;
  material.uniforms.uMode.value = view.colorMode;
}

const readout = document.getElementById('readout');
function updateReadout() {
  const w = sim.world, f = n => n.toLocaleString('en-US');
  readout.textContent = `gen ${f(w.gen)} · alive ${f(w.alive)} · cells ${f(w.nonDead)} · ${stepMs.toFixed(1)} ms/step`;
}

// ── Actions ──────────────────────────────────────────────────────────────
function applyRule(text) {
  const rule = GOL.parseRule(text, sim.world.maxCount);
  if (rule.error) return rule.error;
  sim.rule = rule;
  sim.world.setRule(rule);
  markDirty();
  return null;
}
function reseed(seed = (Math.random() * 2 ** 32) >>> 0) {
  sim.world.seed(sim.density, sim.fill * sim.N, GOL.mulberry32(seed));
  markDirty();
}
function clearWorld() { sim.world.clear(); markDirty(); }
function applyPreset(i, seed) {
  const list = GOL.presetsFor(sim.lattice, sim.r);
  const p = list[Math.max(0, Math.min(list.length - 1, i))];
  sim.presetIndex = list.indexOf(p);
  sim.density = p.density; sim.fill = p.fill;
  const err = applyRule(p.rule);
  if (err) throw new Error(`preset ${p.name}: ${err}`);
  reseed(seed);
}
function setCombo(lattice, r, N, presetIndex = 0, seed) {
  sim.lattice = lattice; sim.r = r; sim.N = N;
  sim.world = new GOL.World(N, lattice, r);
  sim.rule = null;
  buildLayers();
  applyPreset(presetIndex, seed);
}
function stepOnce() {
  const t0 = performance.now();
  sim.world.step();
  stepMs = stepMs ? stepMs * 0.8 + (performance.now() - t0) * 0.2 : performance.now() - t0;
  markDirty();
}

// ── Loop ─────────────────────────────────────────────────────────────────
let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (sim.playing && sim.world.rule) {
    if (sim.gps >= MAX_GPS) {
      const t0 = performance.now();
      do stepOnce(); while (performance.now() - t0 < 12);
    } else {
      acc += dt * sim.gps;
      let n = 0;
      while (acc >= 1 && n < 4) { stepOnce(); acc -= 1; n++; }
      if (n === 4) acc = 0;
    }
  }
  if (dirty) { refill(); updateReadout(); dirty = false; }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ── Boot ─────────────────────────────────────────────────────────────────
{
  const lat = params.get('lattice') === 'tetra' ? 'tetra' : 'cube';
  const r = params.get('r') === '2' ? 2 : 1;
  const n = [24, 32, 48, 64].includes(+params.get('n')) ? +params.get('n') : 48;
  const seed = params.has('seed') ? +params.get('seed') >>> 0 : undefined;
  setCombo(lat, r, n, +params.get('preset') || 0, seed);
  const pre = Math.min(2000, +params.get('gen') || 0);
  for (let g = 0; g < pre; g++) stepOnce();
  refill(); updateReadout(); dirty = false;
  controls.update();
  renderer.render(scene, camera); // complete first frame (headless screenshots)
}
window.__gol = {
  sim, view, GOL, renderer, setCombo, applyPreset, applyRule,
  step(n = 1) { for (let i = 0; i < n; i++) stepOnce(); refill(); updateReadout(); dirty = false; },
  render() { controls.update(); renderer.render(scene, camera); },
};
requestAnimationFrame(frame);
</script>
```

- [ ] **Step 3: Run the unit tests (the shared-code block must still be clean)**

Run: `node 3d-game-of-life/test.mjs`
Expected: `17 passed, 0 failed`.

- [ ] **Step 4: Check the page in the Browser pane**

Start the server with `preview_start { name: "static" }`, then navigate to `http://localhost:8765/3d-game-of-life/index.html`. Make sure the pane tab is visible (`tabs_select`), because a hidden pane pauses rAF. Then:

- `read_console_messages { onlyErrors: true }`. Expected: none.
- Take a screenshot. Expected: coloured cubes inside a dim wireframe box, slowly rotating, with the readout at the bottom right.
- `javascript_tool`: `const g=__gol; const a=g.sim.world.gen; await new Promise(r=>setTimeout(r,1500)); [a, g.sim.world.gen]`. Expected: the second number is larger. If it is not, the pane is hidden; front the tab.
- Navigate to `?lattice=tetra&r=1&n=32&seed=5&gen=40&rotate=0`. Take a screenshot. Expected: faceted tetrahedra with visible gaps between them, lit, with no black or inside-out faces. Then `javascript_tool` → `__gol.view.layers.map(L=>L.geo.instanceCount)`. Expected: 6 non-zero numbers.
- Navigate to `?lattice=tetra&r=2&n=32&seed=5&gen=40&rotate=0` and `?lattice=cube&r=2&n=32&seed=5&gen=40&rotate=0`. Expected: each shows cells and has no console errors.
- Zoom (`computer` zoom on a region) at the box edge. Expected: structures that cross a face of the box continue at the opposite face, which shows the wrap. This is a sanity look only; the wrap itself is proven by the translation-invariance test.

If tetra faces render black, flip the winding test (`> 0` → `< 0`) in `tetraGeometry`, reload and recheck.

- [ ] **Step 5: Commit**

```bash
git add 3d-game-of-life/index.html
git commit -m "3d-game-of-life: instanced cube/tetra renderer, main loop, URL params and debug handle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Control panel (combination, presets, rule, size, playback, seeding, slice, colour, keys)

**Files:**
- Modify: `3d-game-of-life/index.html` (panel styles and markup, plus the wiring at the end of the page module)

**Interfaces:**
- Consumes from Task 3 (page-module scope): `sim`, `view`, `MAX_GPS`, `setCombo`, `applyPreset`, `applyRule`, `reseed`, `clearWorld`, `stepOnce`, `markDirty`, `controls`, `GOL`.
- Produces: a panel with the element IDs listed in Step 2, and `syncPanel()`, which sets every control from `sim` and `view`.

- [ ] **Step 1: Add the panel styles** (append inside `<style>`)

```css
  #panel { position: fixed; top: 12px; left: 12px; bottom: 12px; width: 284px; overflow-y: auto;
    padding: 14px 14px 10px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; flex-direction: column; gap: 10px; }
  #panel h1 { font-size: 16px; font-weight: 650; letter-spacing: 0.01em; }
  #panel .sub, #panel .hint, #panel .keys { color: var(--dim); font-size: 12px; }
  #panel label { display: flex; flex-direction: column; gap: 4px; color: var(--dim); font-size: 12px; }
  #panel label > span.v { color: var(--fg); float: right; }
  #panel .lab { display: flex; justify-content: space-between; }
  #panel .lab b { color: var(--fg); font-weight: 500; }
  .seg { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .seg button { border: 0; border-radius: 0; background: transparent; }
  .seg button.on { background: #7fd4ff22; color: var(--accent); }
  .row { display: flex; gap: 6px; }
  .row > * { flex: 1; }
  .inline { display: flex; gap: 6px; }
  .inline > input[type=text], .inline > input:not([type]) { flex: 1; min-width: 0; }
  button, select, input { font: inherit; color: var(--fg); }
  button { padding: 6px 10px; border-radius: 7px; border: 1px solid var(--line); background: #ffffff0c; cursor: pointer; }
  button:hover { background: #ffffff18; }
  select, input:not([type=range]):not([type=checkbox]) { padding: 5px 7px; border-radius: 7px; border: 1px solid var(--line); background: #0b0d14; }
  input#rule { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  input[type=range] { width: 100%; accent-color: var(--accent); }
  .check { flex-direction: row !important; align-items: center; gap: 8px !important; color: var(--fg) !important; }
  .err { color: var(--err); font-size: 12px; min-height: 1em; }
  #panelToggle { display: none; position: fixed; top: 12px; left: 12px; z-index: 2; width: 40px; height: 40px;
    background: var(--panel); font-size: 18px; }
  @media (max-width: 700px) {
    #panelToggle { display: block; }
    #panel { display: none; top: 60px; left: 16px; right: 16px; width: auto; bottom: 56px; }
    body.panel-open #panel { display: flex; }
    #readout { left: 16px; right: 16px; text-align: center; }
  }
```

- [ ] **Step 2: Add the panel markup** (in `<body>`, after `<div id="readout"></div>`)

```html
<button id="panelToggle" aria-label="Toggle controls">☰</button>
<aside id="panel">
  <div>
    <h1>3D Game of Life</h1>
    <p class="sub">Wrap-around voxel world of cubes or tetrahedra</p>
  </div>
  <div class="seg" id="latticeSeg"><button data-v="cube">Cubes</button><button data-v="tetra">Tetrahedra</button></div>
  <div class="seg" id="nbhdSeg"><button data-v="1">3×3×3</button><button data-v="2">5×5×5</button></div>
  <p class="hint" id="nbhdHint"></p>
  <label>Preset <select id="preset"></select></label>
  <label>Rule — survive / birth / states
    <div class="inline"><input id="rule" spellcheck="false" autocomplete="off"><button id="applyRule">Apply</button></div>
  </label>
  <p class="err" id="ruleErr"></p>
  <label>Grid
    <select id="size"><option value="24">24³</option><option value="32">32³</option><option value="48">48³</option><option value="64">64³</option></select>
  </label>
  <div class="row"><button id="play">Pause</button><button id="step">Step</button></div>
  <label><span class="lab">Speed <b id="speedVal"></b></span><input type="range" id="speed" min="1" max="61"></label>
  <label><span class="lab">Seed density <b id="densityVal"></b></span><input type="range" id="density" min="1" max="100"></label>
  <label><span class="lab">Seed region <b id="fillVal"></b></span><input type="range" id="fill" min="5" max="100"></label>
  <div class="row"><button id="reseed">Reseed</button><button id="clear">Clear</button></div>
  <label><span class="lab">Slice <b id="sliceVal"></b></span>
    <div class="inline">
      <select id="sliceAxis"><option value="0">x</option><option value="1">y</option><option value="2">z</option></select>
      <input type="range" id="slice" min="0" max="48">
    </div>
  </label>
  <label>Colour <select id="colorMode"><option value="0">by position</option><option value="1">by state</option></select></label>
  <label class="check"><input type="checkbox" id="rotate"> Auto-rotate</label>
  <p class="keys">Space play/pause · . step · R reseed · drag to orbit, scroll to zoom</p>
</aside>
```

- [ ] **Step 3: Wire up the panel** (in the page module, insert before `requestAnimationFrame(frame);` at the end)

```js
// ── Panel ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const pct = v => `${Math.round(v * 100)}%`;
function syncPanel() {
  for (const b of $('latticeSeg').children) b.classList.toggle('on', b.dataset.v === sim.lattice);
  for (const b of $('nbhdSeg').children) b.classList.toggle('on', +b.dataset.v === sim.r);
  $('nbhdHint').textContent = `${sim.world.maxCount} neighbours per cell · ${sim.world.nc.toLocaleString('en-US')} cells`;
  const list = GOL.presetsFor(sim.lattice, sim.r);
  $('preset').innerHTML = list.map((p, i) => `<option value="${i}">${p.name}</option>`).join('') +
    '<option value="-1" disabled>— custom rule —</option>';
  $('preset').value = String(sim.presetIndex);
  $('rule').value = sim.rule ? sim.rule.text : '';
  $('ruleErr').textContent = '';
  $('size').value = String(sim.N);
  $('play').textContent = sim.playing ? 'Pause' : 'Play';
  $('speed').value = sim.gps; $('speedVal').textContent = sim.gps >= MAX_GPS ? 'max' : `${sim.gps} gen/s`;
  $('density').value = Math.round(sim.density * 100); $('densityVal').textContent = pct(sim.density);
  $('fill').value = Math.round(sim.fill * 100); $('fillVal').textContent = pct(sim.fill);
  $('sliceAxis').value = String(view.sliceAxis);
  $('slice').max = sim.N; $('slice').value = view.sliceValue;
  $('sliceVal').textContent = view.sliceValue >= sim.N ? 'off' : `${'xyz'[view.sliceAxis]} < ${view.sliceValue}`;
  $('colorMode').value = String(view.colorMode);
  $('rotate').checked = controls.autoRotate;
}
function changeCombo(lattice, r, N) { setCombo(lattice, r, N); syncPanel(); }

$('latticeSeg').addEventListener('click', e => { const v = e.target.dataset.v; if (v && v !== sim.lattice) changeCombo(v, sim.r, sim.N); });
$('nbhdSeg').addEventListener('click', e => { const v = +e.target.dataset.v; if (v && v !== sim.r) changeCombo(sim.lattice, v, sim.N); });
$('size').addEventListener('change', e => changeCombo(sim.lattice, sim.r, +e.target.value));
$('preset').addEventListener('change', e => { applyPreset(+e.target.value); syncPanel(); });
function submitRule() {
  const err = applyRule($('rule').value);
  $('ruleErr').textContent = err || '';
  if (err) return;
  const list = GOL.presetsFor(sim.lattice, sim.r);
  const i = list.findIndex(p => GOL.parseRule(p.rule, sim.world.maxCount).text === sim.rule.text);
  sim.presetIndex = i;
  $('preset').value = String(i);
  $('rule').value = sim.rule.text;
}
$('applyRule').addEventListener('click', submitRule);
$('rule').addEventListener('keydown', e => { if (e.key === 'Enter') submitRule(); });
$('play').addEventListener('click', () => { sim.playing = !sim.playing; syncPanel(); });
$('step').addEventListener('click', () => { sim.playing = false; stepOnce(); syncPanel(); });
$('speed').addEventListener('input', e => { sim.gps = +e.target.value; syncPanel(); });
$('density').addEventListener('input', e => { sim.density = +e.target.value / 100; $('densityVal').textContent = pct(sim.density); });
$('fill').addEventListener('input', e => { sim.fill = +e.target.value / 100; $('fillVal').textContent = pct(sim.fill); });
$('reseed').addEventListener('click', () => reseed());
$('clear').addEventListener('click', () => { clearWorld(); });
$('sliceAxis').addEventListener('change', e => { view.sliceAxis = +e.target.value; markDirty(); syncPanel(); });
$('slice').addEventListener('input', e => { view.sliceValue = +e.target.value; markDirty(); syncPanel(); });
$('colorMode').addEventListener('change', e => { view.colorMode = +e.target.value; markDirty(); });
$('rotate').addEventListener('change', e => { controls.autoRotate = e.target.checked; });
$('panelToggle').addEventListener('click', () => document.body.classList.toggle('panel-open'));
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, select, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); sim.playing = !sim.playing; syncPanel(); }
  else if (e.key === '.') { sim.playing = false; stepOnce(); syncPanel(); }
  else if (e.key === 'r' || e.key === 'R') reseed();
});
syncPanel();
Object.assign(window.__gol, { syncPanel, changeCombo });
```

Also, so that Space does not re-click a button that still has focus after a click, add this single document-level listener right after the `keydown` listener:

```js
document.addEventListener('click', e => { if (e.target.tagName === 'BUTTON') e.target.blur(); });
```

- [ ] **Step 4: Verify the controls in the Browser pane** (covers Review Focus 2 and 4)

Reload `http://localhost:8765/3d-game-of-life/index.html` with the tab fronted. Check each item with `computer` clicks or `form_input`, plus `read_page` or `javascript_tool` readbacks:

1. Click **Tetrahedra**. Expected: the hint reads `161 neighbours per cell · 663,552 cells`, the preset list shows the tetra 3×3 presets, tetrahedra are drawn, and there are no console errors.
2. Type `100-160/40-60/5` into the rule field and press Enter, then click **Cubes**. Expected: no error. The rule field shows the first cube 3×3 preset's rule, and the world runs (`__gol.sim.world.gen` increases).
3. Type `4/4/5/M` and Apply. Expected: accepted; the field normalises to `4/4/5` and the preset select shows "445" if that preset is present. Type `0-6/1,3/2/N`. Expected: the error line mentions "box", and the previous rule stays active.
4. Type `27/4/5`. Expected: the error says `27 exceeds the max neighbour count 26`.
5. Drag the slice to 0. Expected: no cells are drawn, only the box, and no console errors. Every `__gol.view.layers[*].geo.instanceCount` is 0. Drag it back to max; the cells reappear.
6. Click **Clear**. Expected: empty, with the readout at `alive 0 · cells 0`. Click **Reseed**; cells return and keep evolving.
7. Set speed to max. Expected: the label shows `max` and the generation climbs fast while orbit dragging stays smooth.
8. Press Space with the canvas focused. Expected: it pauses. Press `.`, and the generation increments by 1. Press `R`, and the world reseeds.
9. Switch colour to "by state". Expected: alive cells turn warm white, with orange-to-purple trails for presets where C > 2.
10. `resize_window { preset: "mobile" }` and reload. Expected: the panel is hidden, the ☰ button shows, tapping it opens the panel full width with a 16px margin, and there is no horizontal scroll. Then `resize_window { preset: "desktop" }`.

Fix any failure in the wiring code and recheck it.

- [ ] **Step 5: Check for GPU memory leaks** (Review Focus 5)

`javascript_tool`:

```js
const g = __gol; const m0 = { ...g.renderer.info.memory };
for (let i = 0; i < 20; i++) { g.changeCombo(i % 2 ? 'tetra' : 'cube', 1 + (i % 4 > 1 ? 1 : 0), [24, 32][i % 2]); g.render(); }
g.changeCombo('cube', 1, 48); g.render();
({ m0, m1: { ...g.renderer.info.memory } })
```

Expected: `m1.geometries` equals `m0.geometries` (± 1).

- [ ] **Step 6: Run the unit tests and commit**

Run: `node 3d-game-of-life/test.mjs`. Expected: `17 passed, 0 failed`.

```bash
git add 3d-game-of-life/index.html
git commit -m "3d-game-of-life: control panel with lattice, neighbourhood, presets, rule field, seeding, slice and keys

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Performance check, gallery screenshot and entry

**Files:**
- Create: `3d-game-of-life/screenshot1.jpg` (1600×1000)
- Modify: `index.html` (repo root gallery, regenerated by `build_gallery.py`)

**Interfaces:**
- Consumes: the URL params and `window.__gol` from Task 3.

- [ ] **Step 1: Measure the performance target** (spec: 48³ tetra 3×3 ≥ 5 gen/s including the refill)

In the Browser pane, at `http://localhost:8765/3d-game-of-life/index.html?lattice=tetra&r=1&n=48&play=0`:

```js
const g = __gol; const t0 = performance.now(); g.step(20); const ms = (performance.now() - t0) / 20; ({ ms, gps: 1000 / ms })
```

Expected: `gps` ≥ 5. If it is lower, profile `refill` against `step`, using `performance.now()` around each in a one-off console check. Then optimise the slower one. For example, in `step`, hoist `B`/`S` lookups for the `per === 1` path into a separate loop without the inner `k` loop. Rerun the unit tests after any engine change.

- [ ] **Step 2: Check the heaviest configuration stays responsive** (Review Focus 3)

At `?lattice=tetra&r=2&n=64` with the tab fronted, set speed to max through `form_input` on `#speed` (value 61). Wait 3 s, then take a screenshot and use `javascript_tool` → `__gol.sim.world.gen`. Expected:

- the generation keeps increasing;
- a `left_click_drag` on the canvas rotates the view within that same call;
- the readout's ms/step is shown.

Record the ms/step in the final report.

- [ ] **Step 3: Take the gallery screenshot**

With the static server running, take two candidates and pick the better-looking one:

```bash
SCRATCH=/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/2ce0befc-08bd-45a5-b12f-fb14995d2782/scratchpad
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1600,1087 --virtual-time-budget=15000 --screenshot="$SCRATCH/gol-cube.png" "http://127.0.0.1:8765/3d-game-of-life/index.html?lattice=cube&r=1&n=48&seed=7&gen=120&play=0&rotate=0&ui=0"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1600,1087 --virtual-time-budget=15000 --screenshot="$SCRATCH/gol-tetra.png" "http://127.0.0.1:8765/3d-game-of-life/index.html?lattice=tetra&r=1&n=32&seed=7&gen=120&play=0&rotate=0&ui=0"
```

Run each in the background, because headless can hang. Look at both PNGs. Expected: a lit 3D structure that fills about 60–80% of the frame, with no UI visible. If one is black or empty, take the shot from the Browser pane instead, using the `drawImage`-to-1600×1000 upload route described in memory.

Convert the chosen one:

```bash
sips -s format jpeg -s formatOptions 85 -z 1000 1600 "$SCRATCH/gol-tetra.png" --out 3d-game-of-life/screenshot1.jpg
```

Use the cube PNG instead if it looked better. Confirm the size with `sips -g pixelWidth -g pixelHeight 3d-game-of-life/screenshot1.jpg`; expected `1600` × `1000`.

- [ ] **Step 4: Regenerate the gallery**

Run: `python3 build_gallery.py && git diff --stat index.html`
Expected: the root `index.html` gains a `3d-game-of-life` card titled "3D Game of Life".

- [ ] **Step 5: Run the final tests and commit**

Run: `node 3d-game-of-life/test.mjs`. Expected: `17 passed, 0 failed`.

```bash
git add 3d-game-of-life/screenshot1.jpg index.html
git commit -m "3d-game-of-life: screenshot and gallery entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Stop the static server with `preview_stop`.
