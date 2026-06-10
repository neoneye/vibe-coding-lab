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

// ---------- summary ----------
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
