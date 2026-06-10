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
  // negative cycle: caught once B is small relative to the 2n-scaled cycle weight.
  // A single ScaleDown call with large B legitimately succeeds (the bump masks the
  // cycle), so we mirror SPmain: scale weights by 2n and run rounds with B halving.
  {
    const g = BNW.generateGraph({ n: 10, avgDegree: 2.7, seed: 99 });
    BNW.plantNegativeCycle(g, { seed: 99, len: 3 });
    const allV = Array.from({ length: g.n }, (_, i) => i);
    const allE = Array.from({ length: g.edges.length }, (_, i) => i);
    const scale = 2 * g.n;
    const ws = g.edges.map(e => e.weight * scale);
    const phi = new Array(g.n).fill(0);
    let mn = 0; for (const w of ws) if (w < mn) mn = w;
    let B = 1; while (2 * B < -mn) B *= 2;
    let threw = null;
    try {
      for (let b = B; b >= 1; b = Math.floor(b / 2)) {
        const wbase = allE.map(ei => ws[ei] + phi[g.edges[ei].from] - phi[g.edges[ei].to]);
        const psi = new Array(g.n).fill(0);
        const ctx = { nGlobal: g.n, edges: g.edges, wbase, psi, rng: BNW.mulberry32(1) };
        BNW.scaleDown(ctx, allV, allE, g.n, b, 0);
        for (let v = 0; v < g.n; v++) phi[v] += psi[v];
      }
    } catch (e) { threw = e; }
    check('scaleDown: negative cycle caught during scaling rounds', threw instanceof BNW.NegativeCycleError);
    if (threw instanceof BNW.NegativeCycleError) {
      const c = threw.cycleEdges;
      let sum = 0, closed = c.length > 0;
      for (let i = 0; i < c.length; i++) {
        const e = g.edges[c[i]], f = g.edges[c[(i + 1) % c.length]];
        if (e.to !== f.from) closed = false;
        sum += e.weight;
      }
      check('scaleDown: extracted cycle closed', closed);
      check('scaleDown: extracted cycle negative in original weights', sum < 0, sum);
    }
  }
}

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

// ---------- summary ----------
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
