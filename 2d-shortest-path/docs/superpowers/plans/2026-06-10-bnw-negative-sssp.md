# BNW 2022 Negative-Weight SSSP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `index.html` with a faithful implementation of the Bernstein–Nanongkai–Wulff-Nilsen 2022 near-linear negative-weight SSSP algorithm, plus a D3 phase visualization, verified against Bellman-Ford via `test.mjs`.

**Architecture:** Pure-JS engine lives in a `<script id="shared-code">` block inside `index.html` (no DOM access), exposing a `BNW` namespace. A D3 viz script below it replays the engine's structured trace. `test.mjs` extracts the shared-code block with a regex, evaluates it with `new Function`, and property-tests the engine against an independent Bellman-Ford reference.

**Tech Stack:** Vanilla JS (ES2020), D3 v7 from CDN (viz only), Node ≥ 18 for tests (no dependencies).

**Working directory:** `/Users/neoneye/git/vibe-coding-lab/2d-shortest-path` — all paths below are relative to it. Run tests with `node test.mjs`; expected output ends with `0 failed` and exit code 0.

---

## Algorithm crib sheet (read before implementing)

Paper: Bernstein, Nanongkai, Wulff-Nilsen, *Negative-Weight Single-Source Shortest Paths in Near-linear Time*, arXiv:2203.03456.

- **Potentials:** `w_φ(u,v) = w(u,v) + φ(u) − φ(v)`. Potentials never change which paths are shortest, and cycle weights are invariant (telescoping).
- **SPmain:** scale weights by `2n`; pick `B` = power of two with `2B ≥ −min(w)`; run `ScaleDown` rounds with bounds `B, B/2, …, 1`, each guaranteeing reduced weights `≥ −bound`; finally all reduced weights `≥ −1`, so `w*(e) = reduced + 1 ≥ 0` and plain Dijkstra finishes. The ×2n scaling guarantees the +1 shift cannot reorder paths whose original weights differ.
- **ScaleDown(G, Δ, B):** input weights `≥ −2B`, output potential making them `≥ −B`. Uses the *bumped* weight `w^B(e) = w(e) + B if w(e) < 0 else w(e)` (so target = `w^B_ψ ≥ 0`). Phase 0: LDD on `max(0, w^B)` with diameter `d = ΔB/2` → cut set. Phase 1: recurse with `Δ/2` on each SCC of the kept graph (induced subgraphs keep all intra edges, including cut ones). Phase 2: FixDAGEdges makes kept cross-SCC edges non-negative via per-SCC offsets in topological order. Phase 3: ElimNeg (Dijkstra/Bellman-Ford hybrid from a virtual source) eliminates every remaining negative edge; its distances `d̂ ≤ 0` are added to the potential.
- **KEY INVARIANT for debugging:** correctness is *unconditional* on LDD quality and Δ — any cut set and any recursion produce a valid potential, because Phase 3 unconditionally fixes whatever is left. LDD/recursion only affect *speed*. If distances are wrong, the bug is in ElimNeg, FixDAGEdges, potential bookkeeping, or SPmain — never in LDD's randomness.
- **One shared `psi` array per round:** within a round, every recursive ScaleDown call reads frozen round-base weights `wbase` and accumulates into the same `psi`. Phase-1 recursion happens before the caller writes `psi`, and sibling SCCs have disjoint vertex sets, so reads/writes never interfere.
- **Negative cycles:** potentials can't exist, so some ElimNeg keeps relaxing forever; cap Bellman-Ford phases at `|verts| + 2` and then extract a concrete cycle with a textbook synchronous Bellman-Ford predecessor walk. Bumped weights satisfy `w^B ≥ w`, so a cycle negative under `w^B_ψ` is negative under original `w`.

**Engine conventions (used by every task):**
- Graph: `{ n, edges }` with `edges[i] = { from, to, weight }`, integer weights, parallel edges and self-loops allowed.
- Subgraph views: a `verts` array + `edgeIdxs` array of indices into the single master `edges` array (edge indices are global everywhere, so traces and cycles always reference master edges). All per-vertex arrays are sized `nGlobal`.
- Weight functions: closures `ei => number` so potentials apply live.

---

### Task 1: Scaffold — new index.html shell + test harness

**Files:**
- Rewrite: `index.html`
- Create: `test.mjs`

- [ ] **Step 1: Replace index.html with the scaffold**

Overwrite `index.html` entirely with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Negative-Weight SSSP in Near-Linear Time — BNW 2022</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<script id="shared-code">
'use strict';
const BNW = (() => {

  class NegativeCycleError extends Error {
    constructor(cycleEdges) { super('negative cycle detected'); this.cycleEdges = cycleEdges; }
  }

  return { NegativeCycleError };
})();
if (typeof globalThis !== 'undefined') globalThis.BNW = BNW;
</script>
</head>
<body>
<p>Visualization arrives in Task 10.</p>
</body>
</html>
```

- [ ] **Step 2: Create test.mjs harness with a failing-then-passing API test**

```js
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) { console.error('FATAL: shared-code block not found'); process.exit(1); }
const BNW = new Function(`${m[1]}; return BNW;`)();

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; }
  else { failed++; console.error(`FAIL: ${name}`, extra === undefined ? '' : extra); }
}

// ---------- reference implementations ----------

// Bellman-Ford from a super-source (distance 0 to every vertex). Detects any negative cycle in the graph.
function bfAll(n, edges) {
  const dist = new Array(n).fill(0);
  for (let pass = 0; pass < n; pass++) {
    let changed = false;
    for (const e of edges) {
      if (dist[e.from] + e.weight < dist[e.to]) { dist[e.to] = dist[e.from] + e.weight; changed = true; }
    }
    if (!changed) return { dist, negativeCycle: false };
  }
  for (const e of edges) {
    if (dist[e.from] + e.weight < dist[e.to]) return { dist, negativeCycle: true };
  }
  return { dist, negativeCycle: false };
}

// Bellman-Ford single-source distances (valid when no negative cycle exists).
function bfFrom(n, edges, s) {
  const dist = new Array(n).fill(Infinity);
  dist[s] = 0;
  for (let pass = 0; pass < n; pass++) {
    let changed = false;
    for (const e of edges) {
      if (dist[e.from] !== Infinity && dist[e.from] + e.weight < dist[e.to]) {
        dist[e.to] = dist[e.from] + e.weight; changed = true;
      }
    }
    if (!changed) break;
  }
  return dist;
}

// ---------- Task 1: API ----------
check('BNW namespace exists', typeof BNW === 'object' && BNW !== null);
check('NegativeCycleError exported', typeof BNW.NegativeCycleError === 'function');

// ---------- summary ----------
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

All later tasks insert their test sections **before** the `// ---------- summary ----------` line, and insert engine functions **before** the `return {` line of the IIFE (adding their names to the returned object).

- [ ] **Step 3: Run tests**

Run: `node test.mjs`
Expected: `2 passed, 0 failed`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add index.html test.mjs
git commit -m "feat(bnw): scaffold shared-code engine shell and test harness"
```

---

### Task 2: RNG, MinHeap, adjacency, Dijkstra

**Files:** Modify: `index.html` (shared-code), `test.mjs`

- [ ] **Step 1: Add failing tests** (insert before the summary section of `test.mjs`)

```js
// ---------- Task 2: heap + dijkstra ----------
{
  check('mulberry32 deterministic', BNW.mulberry32(42)() === BNW.mulberry32(42)());
  const h = new BNW.MinHeap();
  const rng = BNW.mulberry32(7);
  const keys = Array.from({ length: 200 }, () => Math.floor(rng() * 1000) - 500);
  for (const k of keys) h.push(k, `v${k}`);
  const popped = [];
  while (h.size > 0) popped.push(h.pop().key);
  const sorted = [...keys].sort((a, b) => a - b);
  check('MinHeap pops in sorted order', popped.every((k, i) => k === sorted[i]));

  // diamond graph: 0->1 (1), 0->2 (4), 1->2 (1), 2->3 (1), plus unreachable vertex 4
  const edges = [
    { from: 0, to: 1, weight: 1 }, { from: 0, to: 2, weight: 4 },
    { from: 1, to: 2, weight: 1 }, { from: 2, to: 3, weight: 1 },
  ];
  const allE = [0, 1, 2, 3];
  const { out } = BNW.viewAdjacency(5, edges, allE);
  const r = BNW.dijkstra(5, edges, out, [{ v: 0, d: 0 }], ei => edges[ei].weight);
  check('dijkstra distances', JSON.stringify(r.dist) === JSON.stringify([0, 1, 2, 3, Infinity]));
  check('dijkstra settles source first', r.settled[0] === 0);
  check('dijkstra parent tree', edges[r.parentEdge[3]].from === 2 && edges[r.parentEdge[2]].from === 1);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.mjs`
Expected: FAIL lines mentioning mulberry32/MinHeap (TypeError-free failures require the functions to exist; a thrown TypeError is also an acceptable failure signal here), exit 1.

- [ ] **Step 3: Implement** (insert into the IIFE before `return {`; extend return object to `{ NegativeCycleError, mulberry32, MinHeap, viewAdjacency, dijkstra }`)

```js
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class MinHeap {
    constructor() { this.keys = []; this.vals = []; }
    get size() { return this.keys.length; }
    push(key, val) {
      const k = this.keys, v = this.vals;
      let i = k.length; k.push(key); v.push(val);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (k[p] <= k[i]) break;
        [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
        i = p;
      }
    }
    pop() {
      const k = this.keys, v = this.vals;
      const key = k[0], val = v[0];
      const lk = k.pop(), lv = v.pop();
      if (k.length > 0) {
        k[0] = lk; v[0] = lv;
        let i = 0;
        for (;;) {
          let s = i; const l = 2 * i + 1, r = l + 1;
          if (l < k.length && k[l] < k[s]) s = l;
          if (r < k.length && k[r] < k[s]) s = r;
          if (s === i) break;
          [k[s], k[i]] = [k[i], k[s]]; [v[s], v[i]] = [v[i], v[s]];
          i = s;
        }
      }
      return { key, val };
    }
  }

  // adjacency lists over a subset of global edge indices; arrays sized nGlobal
  function viewAdjacency(nGlobal, edges, edgeIdxs) {
    const out = Array.from({ length: nGlobal }, () => []);
    const inn = Array.from({ length: nGlobal }, () => []);
    for (const ei of edgeIdxs) { out[edges[ei].from].push(ei); inn[edges[ei].to].push(ei); }
    return { out, inn };
  }

  // Dijkstra; weightOf(ei) must be >= 0 for all relaxed edges. sources: [{v, d}].
  function dijkstra(nGlobal, edges, out, sources, weightOf) {
    const dist = new Array(nGlobal).fill(Infinity);
    const parentEdge = new Array(nGlobal).fill(-1);
    const done = new Uint8Array(nGlobal);
    const heap = new MinHeap();
    for (const s of sources) { if (s.d < dist[s.v]) dist[s.v] = s.d; heap.push(s.d, s.v); }
    const settled = [];
    while (heap.size > 0) {
      const { key, val: v } = heap.pop();
      if (done[v] || key > dist[v]) continue;
      done[v] = 1; settled.push(v);
      for (const ei of out[v]) {
        const e = edges[ei];
        const nd = dist[v] + weightOf(ei);
        if (nd < dist[e.to]) { dist[e.to] = nd; parentEdge[e.to] = ei; heap.push(nd, e.to); }
      }
    }
    return { dist, parentEdge, settled };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.mjs`
Expected: `7 passed, 0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add index.html test.mjs
git commit -m "feat(bnw): rng, min-heap, view adjacency, dijkstra"
```

---

### Task 3: Graph generator + planted negative cycle

**Files:** Modify: `index.html` (shared-code), `test.mjs`

- [ ] **Step 1: Add failing tests**

```js
// ---------- Task 3: generator ----------
{
  let anyNegativeEdge = false;
  for (let seed = 1; seed <= 50; seed++) {
    const g = BNW.generateGraph({ n: 20, avgDegree: 2.5, seed });
    check(`gen ${seed}: edge endpoints valid`,
      g.edges.every(e => e.from >= 0 && e.from < g.n && e.to >= 0 && e.to < g.n));
    check(`gen ${seed}: no negative cycle`, bfAll(g.n, g.edges).negativeCycle === false);
    check(`gen ${seed}: source 0 reaches all`, bfFrom(g.n, g.edges, 0).every(d => d !== Infinity));
    if (g.edges.some(e => e.weight < 0)) anyNegativeEdge = true;
    const cyc = BNW.plantNegativeCycle(g, { seed, len: 3 });
    check(`gen ${seed}: planted cycle detected`, bfAll(g.n, g.edges).negativeCycle === true);
    check(`gen ${seed}: planted indices valid`, cyc.every(ei => ei >= 0 && ei < g.edges.length));
  }
  check('generator produces negative edges', anyNegativeEdge);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.mjs` — Expected: failures (generateGraph undefined), exit 1.

- [ ] **Step 3: Implement** (add to IIFE + exports `generateGraph, plantNegativeCycle`)

```js
  // Random graph with negative edges but no negative cycle, by construction:
  // w(u,v) = h(v) - h(u) + noise with noise >= 0; cycle weights telescope to sum(noise) >= 0.
  // A random arborescence rooted at 0 guarantees vertex 0 reaches everything.
  function generateGraph(opts = {}) {
    const n = opts.n ?? 40;
    const avgDegree = opts.avgDegree ?? 2.6;
    const seed = opts.seed ?? 1;
    const spread = opts.spread ?? 30;
    const noise = opts.noise ?? 24;
    const rng = mulberry32(seed);
    const h = Array.from({ length: n }, () => Math.floor(rng() * spread));
    const edges = [];
    const addEdge = (u, v) => edges.push({ from: u, to: v, weight: h[v] - h[u] + Math.floor(rng() * noise) });
    for (let v = 1; v < n; v++) addEdge(Math.floor(rng() * v), v);
    const extra = Math.max(0, Math.round(n * avgDegree) - (n - 1));
    for (let k = 0; k < extra; k++) {
      const u = Math.floor(rng() * n), v = Math.floor(rng() * n);
      if (u !== v) addEdge(u, v);
    }
    return { n, edges };
  }

  // Appends a directed cycle with total weight <= -1. Returns the new edge indices.
  function plantNegativeCycle(graph, opts = {}) {
    const seed = opts.seed ?? 2;
    const len = Math.max(1, Math.min(opts.len ?? 3, graph.n));
    const rng = mulberry32(seed);
    const verts = [];
    while (verts.length < len) {
      const v = Math.floor(rng() * graph.n);
      if (!verts.includes(v)) verts.push(v);
    }
    const idxs = [];
    for (let i = 0; i < len; i++) {
      idxs.push(graph.edges.length);
      graph.edges.push({
        from: verts[i], to: verts[(i + 1) % len],
        weight: i < len - 1 ? 2 : -(2 * (len - 1)) - 1,
      });
    }
    return idxs;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.mjs` — Expected: `0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add index.html test.mjs
git commit -m "feat(bnw): seeded graph generator with no-negative-cycle guarantee + cycle planting"
```

---

### Task 4: ElimNeg + negative-cycle extraction

**Files:** Modify: `index.html` (shared-code), `test.mjs`

- [ ] **Step 1: Add failing tests**

```js
// ---------- Task 4: elimNeg ----------
{
  for (let seed = 1; seed <= 40; seed++) {
    const g = BNW.generateGraph({ n: 5 + (seed % 20), avgDegree: 2.8, seed });
    const allV = Array.from({ length: g.n }, (_, i) => i);
    const allE = Array.from({ length: g.edges.length }, (_, i) => i);
    const r = BNW.elimNeg(g.n, g.edges, allV, allE, ei => g.edges[ei].weight);
    const ref = bfAll(g.n, g.edges);
    check(`elimNeg ${seed}: matches super-source BF`,
      r.dist && r.dist.every((d, i) => d === ref.dist[i]), { got: r.dist, want: ref.dist });
  }
  for (let seed = 1; seed <= 40; seed++) {
    const g = BNW.generateGraph({ n: 5 + (seed % 12), avgDegree: 2.8, seed });
    BNW.plantNegativeCycle(g, { seed, len: 1 + (seed % 4) });
    const allV = Array.from({ length: g.n }, (_, i) => i);
    const allE = Array.from({ length: g.edges.length }, (_, i) => i);
    const r = BNW.elimNeg(g.n, g.edges, allV, allE, ei => g.edges[ei].weight);
    const c = r.negativeCycle;
    check(`elimNeg cycle ${seed}: reported`, Array.isArray(c) && c.length > 0);
    if (Array.isArray(c) && c.length > 0) {
      let sum = 0, closed = true;
      for (let i = 0; i < c.length; i++) {
        const e = g.edges[c[i]], f = g.edges[c[(i + 1) % c.length]];
        if (e.to !== f.from) closed = false;
        sum += e.weight;
      }
      check(`elimNeg cycle ${seed}: closed`, closed);
      check(`elimNeg cycle ${seed}: negative`, sum < 0, sum);
    }
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.mjs` — Expected: elimNeg failures, exit 1.

- [ ] **Step 3: Implement** (add to IIFE + exports `elimNeg, findNegativeCycle`)

```js
  // Textbook synchronous Bellman-Ford from a virtual super-source, used only to
  // extract a concrete negative cycle once elimNeg's pass cap trips.
  function findNegativeCycle(nGlobal, edges, verts, edgeIdxs, weightOf) {
    const dist = new Array(nGlobal).fill(Infinity);
    const parentEdge = new Array(nGlobal).fill(-1);
    for (const v of verts) dist[v] = 0;
    let last = -1;
    for (let pass = 0; pass <= verts.length; pass++) {
      last = -1;
      for (const ei of edgeIdxs) {
        const e = edges[ei];
        if (dist[e.from] + weightOf(ei) < dist[e.to]) {
          dist[e.to] = dist[e.from] + weightOf(ei); parentEdge[e.to] = ei; last = e.to;
        }
      }
      if (last === -1) return null;
    }
    let v = last;
    for (let i = 0; i < verts.length; i++) v = edges[parentEdge[v]].from;
    const cycle = [];
    let u = v;
    do { const ei = parentEdge[u]; cycle.push(ei); u = edges[ei].from; } while (u !== v);
    cycle.reverse();
    return cycle;
  }

  // BNW Algorithm 3: alternating Dijkstra phases (non-negative edges) and
  // Bellman-Ford phases (negative out-edges of vertices settled in the last
  // Dijkstra phase), from a virtual source with 0-weight edges to every vertex.
  // No negative cycle => at most |verts| BF phases are needed; the cap detects cycles.
  function elimNeg(nGlobal, edges, verts, edgeIdxs, weightOf) {
    const { out } = viewAdjacency(nGlobal, edges, edgeIdxs);
    const dist = new Array(nGlobal).fill(Infinity);
    const heap = new MinHeap();
    for (const v of verts) { dist[v] = 0; heap.push(0, v); }
    let bfPasses = 0;
    while (heap.size > 0) {
      const marked = new Set();
      while (heap.size > 0) {
        const { key, val: v } = heap.pop();
        if (key > dist[v] || marked.has(v)) continue;
        marked.add(v);
        for (const ei of out[v]) {
          const w = weightOf(ei);
          if (w < 0) continue;
          const e = edges[ei];
          if (dist[v] + w < dist[e.to]) { dist[e.to] = dist[v] + w; heap.push(dist[e.to], e.to); }
        }
      }
      bfPasses++;
      if (bfPasses > verts.length + 2) {
        const cycle = findNegativeCycle(nGlobal, edges, verts, edgeIdxs, weightOf);
        if (!cycle) throw new Error('internal: pass cap exceeded but no negative cycle found');
        return { negativeCycle: cycle };
      }
      for (const v of marked) {
        for (const ei of out[v]) {
          const w = weightOf(ei);
          if (w >= 0) continue;
          const e = edges[ei];
          if (dist[v] + w < dist[e.to]) { dist[e.to] = dist[v] + w; heap.push(dist[e.to], e.to); }
        }
      }
    }
    return { dist, passes: bfPasses };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.mjs` — Expected: `0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add index.html test.mjs
git commit -m "feat(bnw): ElimNeg dijkstra/bellman-ford hybrid with negative-cycle extraction"
```

---

### Task 5: Tarjan SCC + FixDAGEdges

**Files:** Modify: `index.html` (shared-code), `test.mjs`

- [ ] **Step 1: Add failing tests**

```js
// ---------- Task 5: SCC + FixDAGEdges ----------
{
  // brute-force SCC check on small graphs via Floyd-Warshall reachability
  for (let seed = 1; seed <= 30; seed++) {
    const g = BNW.generateGraph({ n: 8, avgDegree: 3.0, seed });
    const allV = Array.from({ length: g.n }, (_, i) => i);
    const allE = Array.from({ length: g.edges.length }, (_, i) => i);
    const reach = Array.from({ length: g.n }, (_, i) => allV.map(j => i === j));
    for (const e of g.edges) reach[e.from][e.to] = true;
    for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++)
      if (reach[i][k] && reach[k][j]) reach[i][j] = true;
    const { comps, compOf } = BNW.sccsOfView(g.n, g.edges, allV, allE);
    check(`scc ${seed}: partition covers all`, comps.flat().sort((a, b) => a - b).join() === allV.join());
    let ok = true;
    for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
      const same = reach[i][j] && reach[j][i];
      if (same !== (compOf.get(i) === compOf.get(j))) ok = false;
    }
    check(`scc ${seed}: matches mutual reachability`, ok);
    check(`scc ${seed}: topological order`,
      allE.every(ei => compOf.get(g.edges[ei].from) <= compOf.get(g.edges[ei].to)));
  }

  // FixDAGEdges on a handcrafted condensation: comps [[0],[1],[2,3]]
  const edges = [
    { from: 0, to: 1, weight: -3 },  // cross 0 -> 1
    { from: 1, to: 2, weight: -5 },  // cross 1 -> 2
    { from: 2, to: 3, weight: 1 },   // intra
    { from: 3, to: 2, weight: 2 },   // intra
  ];
  const psi = [0, 0, 0, 0];
  const comps = [[0], [1], [2, 3]];
  const compOf = new Map([[0, 0], [1, 1], [2, 2], [3, 2]]);
  BNW.fixDagEdges(4, edges, [0, 1, 2, 3], comps, compOf, ei => edges[ei].weight, psi);
  const red = ei => edges[ei].weight + psi[edges[ei].from] - psi[edges[ei].to];
  check('fixDagEdges: all edges non-negative', [0, 1, 2, 3].every(ei => red(ei) >= 0),
    [0, 1, 2, 3].map(red));
  check('fixDagEdges: intra edges unchanged', red(2) === 1 && red(3) === 2);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.mjs` — Expected: SCC failures, exit 1.

- [ ] **Step 3: Implement** (add to IIFE + exports `sccsOfView, fixDagEdges`)

```js
  // Iterative Tarjan over a view. Returns comps in TOPOLOGICAL order of the
  // condensation (Tarjan emits reverse topological order; we reverse it) and a
  // Map from vertex to component index.
  function sccsOfView(nGlobal, edges, verts, edgeIdxs) {
    const { out } = viewAdjacency(nGlobal, edges, edgeIdxs);
    const index = new Map(), low = new Map(), onStack = new Set(), stack = [];
    const comps = [];
    let counter = 0;
    const visit = (root) => {
      const work = [[root, 0]];
      index.set(root, counter); low.set(root, counter); counter++;
      stack.push(root); onStack.add(root);
      while (work.length > 0) {
        const frame = work[work.length - 1];
        const u = frame[0];
        if (frame[1] < out[u].length) {
          const x = edges[out[u][frame[1]++]].to;
          if (!index.has(x)) {
            index.set(x, counter); low.set(x, counter); counter++;
            stack.push(x); onStack.add(x);
            work.push([x, 0]);
          } else if (onStack.has(x)) {
            low.set(u, Math.min(low.get(u), index.get(x)));
          }
        } else {
          work.pop();
          if (work.length > 0) {
            const parent = work[work.length - 1][0];
            low.set(parent, Math.min(low.get(parent), low.get(u)));
          }
          if (low.get(u) === index.get(u)) {
            const comp = [];
            for (;;) { const w = stack.pop(); onStack.delete(w); comp.push(w); if (w === u) break; }
            comps.push(comp);
          }
        }
      }
    };
    for (const v of verts) if (!index.has(v)) visit(v);
    comps.reverse();
    const compOf = new Map();
    comps.forEach((comp, i) => comp.forEach(v => compOf.set(v, i)));
    return { comps, compOf };
  }

  // BNW Phase 2: per-SCC offsets in topological order make every cross-SCC edge
  // of the kept (DAG) graph non-negative; intra-SCC edges are untouched because
  // both endpoints get the same offset.
  function fixDagEdges(nGlobal, edges, keptEdgeIdxs, comps, compOf, weightOf, psi) {
    const { inn } = viewAdjacency(nGlobal, edges, keptEdgeIdxs);
    const offset = new Array(comps.length).fill(0);
    for (let j = 0; j < comps.length; j++) {
      let off = 0;
      for (const v of comps[j]) {
        for (const ei of inn[v]) {
          const i = compOf.get(edges[ei].from);
          if (i === j) continue;
          const cand = offset[i] + weightOf(ei);
          if (cand < off) off = cand;
        }
      }
      offset[j] = off;
    }
    for (let j = 0; j < comps.length; j++) for (const v of comps[j]) psi[v] += offset[j];
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.mjs` — Expected: `0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add index.html test.mjs
git commit -m "feat(bnw): tarjan SCCs in topological order + FixDAGEdges potentials"
```

---

### Task 6: Low-diameter decomposition

**Files:** Modify: `index.html` (shared-code), `test.mjs`

- [ ] **Step 1: Add failing tests**

```js
// ---------- Task 6: LDD ----------
{
  for (let seed = 1; seed <= 30; seed++) {
    const g = BNW.generateGraph({ n: 25, avgDegree: 3.0, seed });
    const allV = Array.from({ length: g.n }, (_, i) => i);
    const allE = Array.from({ length: g.edges.length }, (_, i) => i);
    const wNN = ei => Math.max(0, g.edges[ei].weight);
    const ctx = { nGlobal: g.n, edges: g.edges, rng: BNW.mulberry32(seed) };
    const cuts = [];
    BNW.lowDiamDecomposition(ctx, allV, allE, wNN, 40, cuts);
    check(`ldd ${seed}: cut indices valid`, cuts.every(ei => allE.includes(ei)));
    check(`ldd ${seed}: no duplicate cuts`, new Set(cuts).size === cuts.length);
    // determinism with same seed
    const ctx2 = { nGlobal: g.n, edges: g.edges, rng: BNW.mulberry32(seed) };
    const cuts2 = [];
    BNW.lowDiamDecomposition(ctx2, allV, allE, wNN, 40, cuts2);
    check(`ldd ${seed}: deterministic`, cuts.join() === cuts2.join());
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.mjs` — Expected: LDD failures, exit 1.

- [ ] **Step 3: Implement** (add to IIFE + exports `ballAround, lowDiamDecomposition`)

```js
  // Vertices within weighted distance r of v: dir 'out' follows edges forward
  // (adj must be out-lists), dir 'in' follows them backward (adj must be in-lists).
  function ballAround(nGlobal, edges, adj, v, r, weightOf, alive, dir) {
    const dist = new Map([[v, 0]]);
    const seen = new Set();
    const heap = new MinHeap();
    heap.push(0, v);
    const ball = [];
    while (heap.size > 0) {
      const { key, val: u } = heap.pop();
      if (seen.has(u) || key > dist.get(u)) continue;
      seen.add(u); ball.push(u);
      for (const ei of adj[u]) {
        const e = edges[ei];
        const x = dir === 'out' ? e.to : e.from;
        if (!alive[x]) continue;
        const nd = key + weightOf(ei);
        if (nd <= r && nd < (dist.has(x) ? dist.get(x) : Infinity)) { dist.set(x, nd); heap.push(nd, x); }
      }
    }
    return ball;
  }

  // BNW low-diameter decomposition (randomized ball-carving). Appends cut edge
  // indices to `cuts`. ANY output is correct for ScaleDown (it only affects
  // speed): light vertices get geometric-radius balls carved out (cutting the
  // boundary in the carve direction and recursing inside); heavy vertices stay
  // as the core. Capping R at d/4 keeps every carved ball <= 0.7|verts|, which
  // guarantees the recursion shrinks.
  function lowDiamDecomposition(ctx, verts, edgeIdxs, weightNN, d, cuts) {
    const { nGlobal, edges, rng } = ctx;
    if (verts.length <= 1) return;
    const { out, inn } = viewAdjacency(nGlobal, edges, edgeIdxs);
    const alive = new Uint8Array(nGlobal);
    for (const v of verts) alive[v] = 1;
    const radius = Math.max(1, d / 4);
    const limit = 0.7 * verts.length;
    const lightDir = new Map();
    for (const v of verts) {
      if (ballAround(nGlobal, edges, out, v, radius, weightNN, alive, 'out').length <= limit) lightDir.set(v, 'out');
      else if (ballAround(nGlobal, edges, inn, v, radius, weightNN, alive, 'in').length <= limit) lightDir.set(v, 'in');
    }
    const p = Math.min(1, (4 * Math.log(Math.max(verts.length, 2))) / radius);
    for (const v of verts) {
      if (!alive[v] || !lightDir.has(v)) continue;
      const dir = lightDir.get(v);
      let R = Math.floor(Math.log(1 - rng()) / Math.log(1 - p)) + 1;
      if (!(R >= 1)) R = 1;
      if (R > radius) R = Math.floor(radius);
      const adj = dir === 'out' ? out : inn;
      const ball = ballAround(nGlobal, edges, adj, v, R, weightNN, alive, dir);
      const inBall = new Uint8Array(nGlobal);
      for (const u of ball) inBall[u] = 1;
      for (const u of ball) {
        for (const ei of (dir === 'out' ? out[u] : inn[u])) {
          const e = edges[ei];
          const x = dir === 'out' ? e.to : e.from;
          if (alive[x] && !inBall[x]) cuts.push(ei);
        }
      }
      const ballEdges = edgeIdxs.filter(ei => inBall[edges[ei].from] && inBall[edges[ei].to]);
      for (const u of ball) alive[u] = 0;
      lowDiamDecomposition(ctx, ball, ballEdges, weightNN, d, cuts);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.mjs` — Expected: `0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add index.html test.mjs
git commit -m "feat(bnw): randomized low-diameter decomposition via ball carving"
```

---

### Task 7: ScaleDown recursion

**Files:** Modify: `index.html` (shared-code), `test.mjs`

- [ ] **Step 1: Add failing tests**

```js
// ---------- Task 7: scaleDown ----------
{
  for (let seed = 1; seed <= 60; seed++) {
    const g = BNW.generateGraph({ n: 4 + (seed % 30), avgDegree: 2.7, seed });
    const allV = Array.from({ length: g.n }, (_, i) => i);
    const allE = Array.from({ length: g.edges.length }, (_, i) => i);
    const wbase = g.edges.map(e => e.weight);
    let mn = 0; for (const w of wbase) if (w < mn) mn = w;
    let B = 1; while (2 * B < -mn) B *= 2;
    const psi = new Array(g.n).fill(0);
    const ctx = { nGlobal: g.n, edges: g.edges, wbase, psi, rng: BNW.mulberry32(seed) };
    BNW.scaleDown(ctx, allV, allE, g.n, B, 0);
    const ok = allE.every(ei => wbase[ei] + psi[g.edges[ei].from] - psi[g.edges[ei].to] >= -B);
    check(`scaleDown ${seed}: reduced weights >= -B`, ok, { B });
  }
  // negative cycle: must throw NegativeCycleError
  {
    const g = BNW.generateGraph({ n: 10, avgDegree: 2.7, seed: 99 });
    BNW.plantNegativeCycle(g, { seed: 99, len: 3 });
    const allV = Array.from({ length: g.n }, (_, i) => i);
    const allE = Array.from({ length: g.edges.length }, (_, i) => i);
    const wbase = g.edges.map(e => e.weight);
    let mn = 0; for (const w of wbase) if (w < mn) mn = w;
    let B = 1; while (2 * B < -mn) B *= 2;
    const ctx = { nGlobal: g.n, edges: g.edges, wbase, psi: new Array(g.n).fill(0), rng: BNW.mulberry32(1) };
    let threw = null;
    try { BNW.scaleDown(ctx, allV, allE, g.n, B, 0); } catch (e) { threw = e; }
    check('scaleDown: throws NegativeCycleError', threw instanceof BNW.NegativeCycleError);
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.mjs` — Expected: scaleDown failures, exit 1.

- [ ] **Step 3: Implement** (add to IIFE + export `scaleDown`)

```js
  // BNW Algorithm 1. Requires wbase(e) >= -2B on the view; ensures
  // wbase(e) + psi(u) - psi(v) >= -B afterwards (throws NegativeCycleError if a
  // negative cycle makes that impossible). All recursion levels of one round
  // share ctx.wbase, ctx.psi and B; only delta shrinks.
  function scaleDown(ctx, verts, edgeIdxs, delta, B, depth) {
    const { nGlobal, edges, wbase, psi } = ctx;
    const bump = ei => (wbase[ei] < 0 ? wbase[ei] + B : wbase[ei]);
    const wB = ei => bump(ei) + psi[edges[ei].from] - psi[edges[ei].to];
    if (ctx.stats) { ctx.stats.calls++; if (depth > ctx.stats.maxDepth) ctx.stats.maxDepth = depth; }
    if (!edgeIdxs.some(ei => wB(ei) < 0)) {
      if (depth === 0 && ctx.roundTrace) { ctx.roundTrace.clusters = [verts.slice()]; ctx.roundTrace.cuts = []; }
      return;
    }
    if (delta > 2 && verts.length > 1) {
      const d = Math.max(1, (delta * B) / 2);
      const wNN = ei => Math.max(0, bump(ei));
      const cuts = [];
      lowDiamDecomposition(ctx, verts, edgeIdxs, wNN, d, cuts);
      const cutSet = new Set(cuts);
      const kept = edgeIdxs.filter(ei => !cutSet.has(ei));
      const { comps, compOf } = sccsOfView(nGlobal, edges, verts, kept);
      for (const comp of comps) {
        if (comp.length <= 1) continue;
        const inComp = new Set(comp);
        const intra = edgeIdxs.filter(ei => inComp.has(edges[ei].from) && inComp.has(edges[ei].to));
        if (!intra.some(ei => wB(ei) < 0)) continue;
        scaleDown(ctx, comp, intra, Math.floor(delta / 2), B, depth + 1);
      }
      fixDagEdges(nGlobal, edges, kept, comps, compOf, wB, psi);
      if (depth === 0 && ctx.roundTrace) {
        ctx.roundTrace.clusters = comps.map(c => c.slice());
        ctx.roundTrace.cuts = cuts.slice();
      }
    } else if (depth === 0 && ctx.roundTrace) {
      ctx.roundTrace.clusters = [verts.slice()]; ctx.roundTrace.cuts = [];
    }
    const res = elimNeg(nGlobal, edges, verts, edgeIdxs, wB);
    if (res.negativeCycle) throw new NegativeCycleError(res.negativeCycle);
    for (const v of verts) psi[v] += res.dist[v];
    if (ctx.stats) ctx.stats.elimNegPasses += res.passes;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.mjs` — Expected: `0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add index.html test.mjs
git commit -m "feat(bnw): ScaleDown recursion (LDD + SCC recursion + DAG fix + ElimNeg)"
```

---

### Task 8: SPmain (shortestPaths) + full equivalence suite

**Files:** Modify: `index.html` (shared-code), `test.mjs`

- [ ] **Step 1: Add failing tests**

```js
// ---------- Task 8: shortestPaths ----------
function checkGraph(name, graph, source) {
  const ref = bfAll(graph.n, graph.edges);
  const res = BNW.shortestPaths(graph, source, { seed: 7 });
  if (ref.negativeCycle) {
    check(`${name}: cycle flagged`, Array.isArray(res.negativeCycle) && res.negativeCycle.length > 0);
    if (Array.isArray(res.negativeCycle) && res.negativeCycle.length > 0) {
      const c = res.negativeCycle;
      let sum = 0, closed = true;
      for (let i = 0; i < c.length; i++) {
        const e = graph.edges[c[i]], f = graph.edges[c[(i + 1) % c.length]];
        if (e.to !== f.from) closed = false;
        sum += e.weight;
      }
      check(`${name}: cycle closed`, closed);
      check(`${name}: cycle negative`, sum < 0, sum);
    }
  } else {
    check(`${name}: no false cycle`, res.negativeCycle === null);
    if (res.negativeCycle === null) {
      const want = bfFrom(graph.n, graph.edges, source);
      check(`${name}: distances match BF`, res.dist.every((d, i) => d === want[i]),
        { got: res.dist, want });
    }
  }
}

{
  // size tiers; each graph tested from source 0
  for (let seed = 1; seed <= 200; seed++) checkGraph(`sp small ${seed}`, BNW.generateGraph({ n: 2 + (seed % 38), avgDegree: 2.7, seed }), 0);
  for (let seed = 1; seed <= 40; seed++) checkGraph(`sp mid ${seed}`, BNW.generateGraph({ n: 41 + (seed % 50), avgDegree: 2.5, seed }), 0);
  for (let seed = 1; seed <= 8; seed++) checkGraph(`sp big ${seed}`, BNW.generateGraph({ n: 100 + seed * 7, avgDegree: 2.4, seed }), 0);
  // planted negative cycles
  for (let seed = 1; seed <= 60; seed++) {
    const g = BNW.generateGraph({ n: 3 + (seed % 30), avgDegree: 2.7, seed });
    BNW.plantNegativeCycle(g, { seed, len: 1 + (seed % 4) });
    checkGraph(`sp cycle ${seed}`, g, 0);
  }
  // handcrafted edge cases
  checkGraph('sp: single vertex', { n: 1, edges: [] }, 0);
  checkGraph('sp: single negative edge', { n: 2, edges: [{ from: 0, to: 1, weight: -5 }] }, 0);
  checkGraph('sp: negative self-loop', { n: 2, edges: [{ from: 0, to: 1, weight: 3 }, { from: 1, to: 1, weight: -1 }] }, 0);
  checkGraph('sp: zero-weight 2-cycle (NOT negative)', { n: 2, edges: [{ from: 0, to: 1, weight: 3 }, { from: 1, to: 0, weight: -3 }] }, 0);
  checkGraph('sp: parallel edges', { n: 2, edges: [{ from: 0, to: 1, weight: 5 }, { from: 0, to: 1, weight: -2 }] }, 0);
  checkGraph('sp: unreachable vertex', { n: 3, edges: [{ from: 0, to: 1, weight: -4 }, { from: 2, to: 1, weight: 1 }] }, 0);
  checkGraph('sp: all-negative DAG', { n: 4, edges: [
    { from: 0, to: 1, weight: -1 }, { from: 1, to: 2, weight: -2 },
    { from: 0, to: 2, weight: -4 }, { from: 2, to: 3, weight: -3 }] }, 0);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.mjs` — Expected: shortestPaths failures, exit 1.

- [ ] **Step 3: Implement** (add to IIFE + export `shortestPaths`)

```js
  // BNW Algorithm 2 (SPmain). Returns { dist, parentEdge, negativeCycle, trace }.
  // dist uses original (unscaled) weights; negativeCycle is a list of global
  // edge indices forming a closed walk with negative total original weight.
  function shortestPaths(graph, source, opts = {}) {
    const n = graph.n, edges = graph.edges;
    const rng = mulberry32(opts.seed === undefined ? 0xC0FFEE : opts.seed);
    const wantTrace = !!opts.trace;
    const scale = 2 * Math.max(1, n);
    const trace = wantTrace
      ? { scale, rounds: [], settleOrder: null, parentEdge: null, phi: null, negativeCycle: null }
      : null;
    const ws = edges.map(e => e.weight * scale);
    const phi = new Array(n).fill(0);
    const allVerts = Array.from({ length: n }, (_, i) => i);
    const allEdges = Array.from({ length: edges.length }, (_, i) => i);
    let minW = 0;
    for (const w of ws) if (w < minW) minW = w;
    let B = 1;
    while (2 * B < -minW) B *= 2;
    try {
      for (let b = B; b >= 1; b = Math.floor(b / 2)) {
        const wbase = allEdges.map(ei => ws[ei] + phi[edges[ei].from] - phi[edges[ei].to]);
        let mn = 0;
        for (const w of wbase) if (w < mn) mn = w;
        if (mn >= -b) continue; // this round's guarantee already holds
        const psi = new Array(n).fill(0);
        const ctx = {
          nGlobal: n, edges, wbase, psi, rng,
          stats: { calls: 0, maxDepth: 0, elimNegPasses: 0 },
          roundTrace: wantTrace ? {} : null,
        };
        scaleDown(ctx, allVerts, allEdges, n, b, 0);
        for (let v = 0; v < n; v++) phi[v] += psi[v];
        if (wantTrace) {
          let after = 0;
          for (const ei of allEdges) {
            const w = ws[ei] + phi[edges[ei].from] - phi[edges[ei].to];
            if (w < after) after = w;
          }
          trace.rounds.push({
            B: b, minBefore: mn, minAfter: after,
            clusters: ctx.roundTrace.clusters || [allVerts.slice()],
            cuts: ctx.roundTrace.cuts || [],
            phiAfter: phi.slice(), stats: ctx.stats,
          });
        }
      }
      const wstar = ei => ws[ei] + phi[edges[ei].from] - phi[edges[ei].to] + 1;
      for (const ei of allEdges) {
        if (wstar(ei) < 0) throw new Error('internal: invariant violated, reduced weight < 0');
      }
      const { out } = viewAdjacency(n, edges, allEdges);
      const { parentEdge, settled } = dijkstra(n, edges, out, [{ v: source, d: 0 }], wstar);
      const dist = new Array(n).fill(Infinity);
      dist[source] = 0;
      for (const v of settled) {
        if (v === source || parentEdge[v] === -1) continue;
        const e = edges[parentEdge[v]];
        dist[v] = dist[e.from] + e.weight;
      }
      if (wantTrace) { trace.settleOrder = settled; trace.parentEdge = parentEdge.slice(); trace.phi = phi.slice(); }
      return { dist, parentEdge, negativeCycle: null, trace };
    } catch (err) {
      if (err instanceof NegativeCycleError) {
        if (wantTrace) trace.negativeCycle = err.cycleEdges;
        return { dist: null, parentEdge: null, negativeCycle: err.cycleEdges, trace };
      }
      throw err;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.mjs`
Expected: `0 failed`, exit 0. If the suite takes longer than ~60s, reduce the mid/big tier counts (e.g. 40→20, 8→4) — note it in the commit message.

- [ ] **Step 5: Commit**

```bash
git add index.html test.mjs
git commit -m "feat(bnw): SPmain scaling loop, final dijkstra, exact distance recovery"
```

---

### Task 9: Trace assertions

**Files:** Modify: `test.mjs` only (trace collection was already wired in Tasks 7–8)

- [ ] **Step 1: Add tests**

```js
// ---------- Task 9: trace ----------
{
  const g = BNW.generateGraph({ n: 36, avgDegree: 2.6, seed: 5 });
  const res = BNW.shortestPaths(g, 0, { seed: 5, trace: true });
  const t = res.trace;
  check('trace exists', t !== null && Array.isArray(t.rounds));
  check('trace has rounds (graph has negative edges)',
    !g.edges.some(e => e.weight < 0) || t.rounds.length > 0);
  for (const [i, r] of t.rounds.entries()) {
    const flat = r.clusters.flat().sort((a, b) => a - b);
    check(`trace round ${i}: clusters partition vertices`,
      flat.length === g.n && flat.every((v, j) => v === j));
    check(`trace round ${i}: bound met`, r.minAfter >= -r.B, r);
    check(`trace round ${i}: cuts valid`, r.cuts.every(ei => ei >= 0 && ei < g.edges.length));
    check(`trace round ${i}: phi snapshot length`, r.phiAfter.length === g.n);
  }
  check('trace settle order starts at source', t.settleOrder[0] === 0);
  check('trace phi present', Array.isArray(t.phi) && t.phi.length === g.n);

  const g2 = BNW.generateGraph({ n: 12, avgDegree: 2.6, seed: 6 });
  BNW.plantNegativeCycle(g2, { seed: 6, len: 3 });
  const res2 = BNW.shortestPaths(g2, 0, { seed: 6, trace: true });
  check('trace records negative cycle', Array.isArray(res2.trace.negativeCycle)
    && res2.trace.negativeCycle === res2.negativeCycle);
}
```

- [ ] **Step 2: Run tests**

Run: `node test.mjs` — Expected: `0 failed`, exit 0 (trace plumbing already exists; if any check fails, fix the plumbing in `scaleDown`/`shortestPaths`).

- [ ] **Step 3: Commit**

```bash
git add test.mjs
git commit -m "test(bnw): structured trace assertions"
```

---

### Task 10: Visualization

**Files:** Modify: `index.html` (body + CSS + viz script; do NOT touch the shared-code block)

- [ ] **Step 1: Add CSS to `<head>`** (after the d3 script tag, before shared-code)

```html
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f7fa; color: #333; }
  .container { max-width: 1100px; margin: 0 auto; }
  h1 { text-align: center; color: #2c3e50; font-size: 1.5em; }
  .subtitle { text-align: center; color: #7f8c8d; margin-bottom: 16px; }
  .controls { display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
  button { padding: 8px 16px; background: #3498db; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
  button:hover { background: #2980b9; }
  button:disabled { background: #bdc3c7; cursor: not-allowed; }
  label.toggle { display: flex; align-items: center; gap: 5px; user-select: none; }
  #stepLabel { font-weight: bold; min-width: 110px; text-align: center; }
  .panel { background: #fff; border-radius: 8px; padding: 14px; box-shadow: 0 2px 10px rgba(0,0,0,.1); margin-bottom: 14px; }
  #info { border-left: 4px solid #3498db; background: #e8f4fc; border-radius: 0 4px 4px 0; min-height: 3.2em; }
  svg { display: block; width: 100%; height: auto; }
  .legend { display: flex; justify-content: center; gap: 18px; flex-wrap: wrap; font-size: .9em; color: #555; margin-bottom: 8px; }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .swatch { width: 18px; height: 4px; display: inline-block; border-radius: 2px; }
</style>
```

- [ ] **Step 2: Replace `<body>` content** (the Task 1 placeholder) with:

```html
<div class="container">
  <h1>Negative-Weight Shortest Paths in Near-Linear Time</h1>
  <div class="subtitle">Bernstein–Nanongkai–Wulff-Nilsen (FOCS 2022) — low-diameter decomposition + scaling + potentials, then plain Dijkstra</div>
  <div class="controls">
    <button id="newGraph">New graph</button>
    <label class="toggle"><input type="checkbox" id="plantCycle"> plant a negative cycle</label>
    <button id="prev">◀ Prev</button>
    <span id="stepLabel"></span>
    <button id="next">Next ▶</button>
    <button id="play">▶ Auto-play</button>
  </div>
  <div class="legend">
    <span><span class="swatch" style="background:#e74c3c"></span> negative edge</span>
    <span><span class="swatch" style="background:#bbb"></span> non-negative edge</span>
    <span><span class="swatch" style="background:#999;border:1px dashed #555"></span> LDD cut edge</span>
    <span><span class="swatch" style="background:#27ae60"></span> shortest-path tree</span>
  </div>
  <div class="panel" id="info"></div>
  <div class="panel"><svg id="graph" viewBox="0 0 960 560"></svg></div>
</div>
<script>
// viz script from Step 3 goes here
</script>
```

- [ ] **Step 3: Write the viz script** (inside the `<script>` tag at the end of `<body>`)

```js
'use strict';
const W = 960, H = 560, NODE_R = 13;
const palette = d3.schemeTableau10;
const state = { seed: 1, graph: null, result: null, steps: [], stepIndex: 0, playing: false, playTimer: null, animTimer: null, pos: null };

function regenerate() {
  const graph = BNW.generateGraph({ n: 36, avgDegree: 2.4, seed: state.seed });
  if (document.getElementById('plantCycle').checked) BNW.plantNegativeCycle(graph, { seed: state.seed, len: 3 });
  state.graph = graph;
  state.result = BNW.shortestPaths(graph, 0, { seed: state.seed, trace: true });
  state.pos = layout(graph);
  state.steps = buildSteps(state.result);
  state.stepIndex = 0;
  stopAnim();
  render();
}

function layout(graph) {
  const nodes = Array.from({ length: graph.n }, (_, i) => ({ id: i }));
  const links = graph.edges.map(e => ({ source: e.from, target: e.to }));
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).distance(75).strength(0.6))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collide', d3.forceCollide(NODE_R * 2))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();
  return nodes.map(d => ({
    x: Math.max(NODE_R + 2, Math.min(W - NODE_R - 2, d.x)),
    y: Math.max(NODE_R + 2, Math.min(H - NODE_R - 2, d.y)),
  }));
}

function buildSteps(result) {
  const steps = [{ kind: 'original' }];
  for (let r = 0; r < result.trace.rounds.length; r++) {
    steps.push({ kind: 'ldd', r });
    steps.push({ kind: 'potentials', r });
  }
  steps.push(result.negativeCycle ? { kind: 'cycle' } : { kind: 'dijkstra' });
  return steps;
}

function describeStep(step) {
  const t = state.result.trace, R = t.rounds.length;
  switch (step.kind) {
    case 'original':
      return `The input graph (36 nodes). Red edges have negative weight. BNW computes exact shortest paths from source 0 (double ring) in near-linear time — Bellman-Ford needs O(mn). Internally all weights are scaled ×${t.scale}; each round below halves the worst negativity bound B.`;
    case 'ldd': {
      const r = t.rounds[step.r];
      return `Round ${step.r + 1}/${R} — B = ${r.B}. Low-diameter decomposition: random ball-carving cuts the dashed edges, splitting the graph into colored strongly-connected clusters. ScaleDown recurses into each cluster with half the budget (${r.stats.calls} recursive calls, depth ${r.stats.maxDepth}, ${r.stats.elimNegPasses} ElimNeg passes).`;
    }
    case 'potentials': {
      const r = t.rounds[step.r];
      return `Round ${step.r + 1}/${R} done. Recursion + DAG-fixing + ElimNeg produced potentials φ (under each node). Edge labels now show the reduced weight w(u,v)+φ(u)−φ(v) in scaled units: worst edge went from ${r.minBefore} to ${r.minAfter} (guaranteed ≥ −${r.B}). Potentials never change which paths are shortest.`;
    }
    case 'dijkstra':
      return `Every reduced weight is now ≥ 0 (after a harmless +1 shift absorbed by the ×${t.scale} scaling), so plain Dijkstra finishes the job. Nodes light up in settle order; green edges form the shortest-path tree. Node labels show true distances in original weights.`;
    case 'cycle':
      return `A negative cycle was detected (bold red): no potential function can make its edges non-negative — total weight around it is negative no matter what. BNW reports the concrete cycle instead of looping forever. Distances are undefined.`;
  }
}

function edgePath(e, i) {
  const a = state.pos[e.from], b = state.pos[e.to];
  if (e.from === e.to) {
    return `M ${a.x} ${a.y - NODE_R} a ${NODE_R} ${NODE_R} 0 1 1 ${NODE_R} ${NODE_R}`;
  }
  // bend each edge slightly so parallel/reciprocal edges stay visible
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const off = 14 + (i % 3) * 6;
  const mx = (a.x + b.x) / 2 - (dy / len) * off, my = (a.y + b.y) / 2 + (dx / len) * off;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

function render(animSettledCount) {
  const step = state.steps[state.stepIndex];
  const { graph, result } = state;
  const t = result.trace;
  const svg = d3.select('#graph');
  svg.selectAll('*').remove();
  svg.append('defs').append('marker')
    .attr('id', 'arrow').attr('viewBox', '0 -5 10 10').attr('refX', 22).attr('refY', 0)
    .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#999');

  const round = (step.kind === 'ldd' || step.kind === 'potentials') ? t.rounds[step.r] : null;
  const cutSet = step.kind === 'ldd' ? new Set(round.cuts) : new Set();
  const cycleSet = step.kind === 'cycle' ? new Set(result.negativeCycle) : new Set();
  const clusterOf = new Map();
  if (step.kind === 'ldd') round.clusters.forEach((c, i) => c.forEach(v => clusterOf.set(v, i)));
  const treeSet = new Set();
  const settledSet = new Set();
  if (step.kind === 'dijkstra') {
    const upTo = animSettledCount === undefined ? t.settleOrder.length : animSettledCount;
    for (let i = 0; i < upTo; i++) {
      const v = t.settleOrder[i];
      settledSet.add(v);
      if (t.parentEdge[v] !== -1) treeSet.add(t.parentEdge[v]);
    }
  }
  const phiNow = step.kind === 'potentials' ? round.phiAfter
    : step.kind === 'dijkstra' ? t.phi : null;

  const edgeLabel = (e, ei) => {
    if (phiNow) return String(e.weight * t.scale + phiNow[e.from] - phiNow[e.to]);
    return String(e.weight);
  };
  const edgeColor = (e, ei) => {
    if (cycleSet.has(ei)) return '#c0392b';
    if (treeSet.has(ei)) return '#27ae60';
    if (cutSet.has(ei)) return '#999';
    const w = phiNow ? e.weight * t.scale + phiNow[e.from] - phiNow[e.to] : e.weight;
    return w < 0 ? '#e74c3c' : '#bbb';
  };

  const eg = svg.append('g');
  graph.edges.forEach((e, ei) => {
    eg.append('path').attr('d', edgePath(e, ei)).attr('fill', 'none')
      .attr('stroke', edgeColor(e, ei))
      .attr('stroke-width', cycleSet.has(ei) || treeSet.has(ei) ? 3.5 : 1.6)
      .attr('stroke-dasharray', cutSet.has(ei) ? '5,4' : null)
      .attr('marker-end', 'url(#arrow)');
    const a = state.pos[e.from], b = state.pos[e.to];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const off = 14 + (ei % 3) * 6;
    eg.append('text')
      .attr('x', (a.x + b.x) / 2 - (dy / len) * off * 0.75)
      .attr('y', (a.y + b.y) / 2 + (dx / len) * off * 0.75)
      .attr('font-size', 9).attr('text-anchor', 'middle')
      .attr('fill', edgeColor(e, ei) === '#bbb' ? '#888' : edgeColor(e, ei))
      .text(edgeLabel(e, ei));
  });

  const ng = svg.append('g');
  for (let v = 0; v < graph.n; v++) {
    const p = state.pos[v];
    const fill = step.kind === 'ldd' ? palette[clusterOf.get(v) % palette.length]
      : step.kind === 'dijkstra' && settledSet.has(v) ? '#27ae60'
      : '#3498db';
    ng.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', NODE_R)
      .attr('fill', fill).attr('stroke', '#2c3e50').attr('stroke-width', 1.5);
    if (v === 0) ng.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', NODE_R + 4)
      .attr('fill', 'none').attr('stroke', '#2c3e50').attr('stroke-width', 1.5);
    ng.append('text').attr('x', p.x).attr('y', p.y + 4)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#fff').attr('font-weight', 'bold')
      .text(v);
    let sub = null;
    if (step.kind === 'potentials') sub = `φ=${phiNow[v]}`;
    if (step.kind === 'dijkstra' && settledSet.has(v) && result.dist) {
      sub = result.dist[v] === Infinity ? '∞' : `d=${result.dist[v]}`;
    }
    if (sub !== null) ng.append('text').attr('x', p.x).attr('y', p.y + NODE_R + 12)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#555').text(sub);
  }

  document.getElementById('info').textContent = describeStep(step);
  document.getElementById('stepLabel').textContent = `step ${state.stepIndex + 1} / ${state.steps.length}`;
  document.getElementById('prev').disabled = state.stepIndex === 0;
  document.getElementById('next').disabled = state.stepIndex === state.steps.length - 1;
}

function stopAnim() {
  if (state.animTimer) { clearInterval(state.animTimer); state.animTimer = null; }
}

function enterStep() {
  stopAnim();
  const step = state.steps[state.stepIndex];
  if (step.kind === 'dijkstra') {
    let count = 0;
    const total = state.result.trace.settleOrder.length;
    render(0);
    state.animTimer = setInterval(() => {
      count++;
      render(count);
      if (count >= total) stopAnim();
    }, 140);
  } else {
    render();
  }
}

function go(delta) {
  state.stepIndex = Math.max(0, Math.min(state.steps.length - 1, state.stepIndex + delta));
  enterStep();
}

document.getElementById('prev').onclick = () => go(-1);
document.getElementById('next').onclick = () => go(1);
document.getElementById('newGraph').onclick = () => { state.seed++; regenerate(); };
document.getElementById('plantCycle').onchange = () => regenerate();
document.getElementById('play').onclick = () => {
  state.playing = !state.playing;
  document.getElementById('play').textContent = state.playing ? '⏸ Pause' : '▶ Auto-play';
  if (state.playing) {
    state.playTimer = setInterval(() => {
      if (state.stepIndex >= state.steps.length - 1) {
        clearInterval(state.playTimer); state.playing = false;
        document.getElementById('play').textContent = '▶ Auto-play';
        return;
      }
      go(1);
    }, 2200);
  } else {
    clearInterval(state.playTimer);
  }
};

regenerate();
```

- [ ] **Step 4: Verify engine untouched**

Run: `node test.mjs`
Expected: `0 failed`, exit 0.

- [ ] **Step 5: Manual browser check**

Run: `open index.html`
Verify: graph renders with red negative edges; Prev/Next steps through LDD cluster colorings and potential updates; the final step animates Dijkstra and shows distances; checking "plant a negative cycle" + New graph shows the bold red cycle step; no console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(bnw): D3 phase-stepper visualization (LDD clusters, potentials, dijkstra, cycle)"
```

---

### Task 11: Final verification & wrap-up

- [ ] **Step 1: Full test run**

Run: `node test.mjs`
Expected: all checks pass, `0 failed`, exit 0. Note the total runtime; if > 60s, trim the Task 8 tier counts and re-run.

- [ ] **Step 2: Fresh-browser sanity pass**

Run: `open index.html` — click through all steps on 3 different graphs (New graph ×3), once with the cycle toggle on. No console errors.

- [ ] **Step 3: Use superpowers:verification-before-completion skill, then superpowers:finishing-a-development-branch skill**

Confirm test output before claiming success; then follow the finishing skill for final integration.
