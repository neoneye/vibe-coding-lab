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
