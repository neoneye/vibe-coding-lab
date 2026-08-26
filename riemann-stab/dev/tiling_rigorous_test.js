'use strict';

const T = require('./tiling_research');
const I = require('./tiling_interval');
const R = require('./tiling_rigorous');

let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('  OK  ', name);
  else { failed++; console.error('  FAIL', name, detail); }
}

let seed = 987654321;
const random = () => { seed = (1103515245 * seed + 12345) % 2147483648; return seed / 2147483648; };

// ------------------------------------------------------------ trigonometry
// The declared error bound is what everything downstream rests on, so it is
// checked against the engine's own sine and, in the recorded cross-check, once
// against 60-digit mpmath values.
let trigFailures = 0, trigDeviation = 0, widest = 0;
for (let t = 0; t < 200000; t++) {
  const x = (random() - 0.5) * 800;
  const s = R.sinPoint(x), c = R.cosPoint(x);
  if (Math.sin(x) < s[0] || Math.sin(x) > s[1]) trigFailures++;
  if (Math.cos(x) < c[0] || Math.cos(x) > c[1]) trigFailures++;
  trigDeviation = Math.max(trigDeviation, Math.abs((s[0] + s[1]) / 2 - Math.sin(x)));
  widest = Math.max(widest, s[1] - s[0]);
}
check('sine and cosine enclosures contain the engine values', trigFailures === 0, `${trigFailures}`);
check('midpoint agrees with the engine to a few ulps', trigDeviation < 1e-15, `${trigDeviation}`);
check('trig enclosures stay narrow', widest < 5e-15, `${widest}`);

// The enclosure must never be narrower than the true range.
let rangeFailures = 0;
for (let t = 0; t < 4000; t++) {
  // pair distances reach 6 * 16 = 96 gaps, so sinc arguments reach ~300;
  // validate over the range actually used, not a tenth of it
  const a = (random() - 0.5) * 800;
  const b = a + random() * 8;
  const r = R.sinRange(a, b);
  const rc = R.cosRange(a, b);
  let lo = Infinity, hi = -Infinity, clo = Infinity, chi = -Infinity;
  for (let s = 0; s <= 2000; s++) {
    const x = a + (b - a) * s / 2000;
    const v = Math.sin(x);
    if (v < lo) lo = v; if (v > hi) hi = v;
    const c = Math.cos(x);
    if (c < clo) clo = c; if (c > chi) chi = c;
  }
  if (r[0] > lo + 1e-12 || r[1] < hi - 1e-12) rangeFailures++;
  if (rc[0] > clo + 1e-12 || rc[1] < chi - 1e-12) rangeFailures++;
}
check('sine and cosine ranges enclose a dense sample over the arguments actually used',
  rangeFailures === 0, `${rangeFailures}`);

// ------------------------------------------------------------------ kernel
check('K(0) enclosure brackets the laboratory value',
  R.K0[0] <= T.mtKernel(0) && T.mtKernel(0) <= R.K0[1], `${R.K0}`);
check('K(0) enclosure is narrow', R.K0[1] - R.K0[0] < 1e-14, `${R.K0[1] - R.K0[0]}`);

let pointFailures = 0, pointWidth = 0, derivWidth = 0;
for (let t = 0; t < 120000; t++) {
  const x = random() * 60;
  const w = R.weightRange(x, x);
  const d = R.weightDerivRange(x, x);
  const wt = T.overlapWeight(x), dt = T.overlapWeightDerivative(x);
  if (wt < w[0] || wt > w[1]) pointFailures++;
  if (dt < d[0] || dt > d[1]) pointFailures++;
  pointWidth = Math.max(pointWidth, w[1] - w[0]);
  derivWidth = Math.max(derivWidth, d[1] - d[0]);
}
check('weight and derivative enclosures contain the laboratory values',
  pointFailures === 0, `${pointFailures}`);
check('pointwise weight enclosure is narrow', pointWidth < 1e-12, `${pointWidth}`);
check('pointwise derivative enclosure is narrow', derivWidth < 1e-11, `${derivWidth}`);

// -------------------------------------------- containment of the fast table
// The fast sweep uses exact monotone-piece ranges in double precision.  Those
// must lie inside the rigorous enclosures; if they ever escaped, the fast
// sweep would be claiming something the rigorous arithmetic cannot support.
const tables = I.attachTables(I.buildTables(120));
let containmentFailures = 0;
for (let t = 0; t < 20000; t++) {
  const a = random() * 40;
  const b = a + random() * 2;
  const rigorous = R.weightRange(a, b);
  const fast = I.wRange(tables, a, b);
  if (rigorous[0] > fast[0] + 1e-12 || rigorous[1] < fast[1] - 1e-12) containmentFailures++;
  const rigorousD = R.weightDerivRange(a, b);
  const fastD = I.dwRange(tables, a, b);
  if (rigorousD[0] > fastD[0] + 1e-10 || rigorousD[1] < fastD[1] - 1e-10) containmentFailures++;
}
check('fast table ranges lie inside the rigorous enclosures',
  containmentFailures === 0, `${containmentFailures}`);

if (failed) {
  console.error(`${failed} rigorous-arithmetic checks failed`);
  process.exit(1);
}
console.log('RIGOROUS ARITHMETIC CHECKS PASS');
