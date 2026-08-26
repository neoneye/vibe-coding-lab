'use strict';

const fs = require('fs');
const path = require('path');
const P = require('./tiling_pair');
const PI = require('./tiling_pair_interval');
const I = require('./tiling_interval');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
  if (!ok) failures++;
}

console.log('=== bilinear enclosures and the pair sweep ===');

const cand = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'tiling_pair.stationary.json'), 'utf8'));
const bundle = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
const certs = bundle.certificates;
const base = (Array.isArray(certs) ? certs : Object.values(certs))
  .find(e => e.name === cand.base);
const cert = P.prepare(cand, base);
const prepared = I.prepareCertificate(base);
const tables = I.attachTables(I.buildTables(120));
const EALT = 0.003957393309109344;

let seed = 20260826;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// ---- the enclosure itself: value and both slopes, on boxes that span cells,
//      sit inside cells, and run off the clamped ends
let bad = 0;
let widest = 0;
for (let t = 0; t < 20000; t++) {
  const k = Math.floor(rnd() * 5);
  const a = rnd() * 14, b = a + rnd() * rnd() * 3;
  const c = rnd() * 14, d = c + rnd() * rnd() * 3;
  const R = P.psiBoxRange(cert, k, a, b, c, d);
  widest = Math.max(widest, R.value[1] - R.value[0]);
  for (let s = 0; s < 8; s++) {
    const x = a + rnd() * (b - a), y = c + rnd() * (d - c);
    const v = P.bilinear(cert.knots, cert.mats[k], cert.J, x, y);
    if (v.value < R.value[0] - 1e-15 || v.value > R.value[1] + 1e-15) bad++;
    if (v.dx < R.dx[0] - 1e-12 || v.dx > R.dx[1] + 1e-12) bad++;
    if (v.dy < R.dy[0] - 1e-12 || v.dy > R.dy[1] + 1e-12) bad++;
  }
}
check('the bilinear box enclosure holds, value and both slopes', bad === 0,
  `20000 boxes x 8 samples, widest value range ${widest.toExponential(3)}`);

// A single cell is the case the enclosure is EXACT on: the four corners are the
// range, because a bilinear function there is a convex combination of them.
let cellBad = 0;
for (let t = 0; t < 3000; t++) {
  const k = Math.floor(rnd() * 5);
  const i = Math.floor(rnd() * (cert.J - 1));
  const j = Math.floor(rnd() * (cert.J - 1));
  const a = cert.knots[i], b = cert.knots[i + 1];
  const c = cert.knots[j], d = cert.knots[j + 1];
  const R = P.psiBoxRange(cert, k, a, b, c, d);
  const corners = [cert.mats[k][i * cert.J + j], cert.mats[k][i * cert.J + j + 1],
    cert.mats[k][(i + 1) * cert.J + j], cert.mats[k][(i + 1) * cert.J + j + 1]];
  if (Math.abs(R.value[1] - Math.max(...corners)) > 1e-15) cellBad++;
}
check('and on a single cell the upper end is exactly the largest corner',
  cellBad === 0);

// ---- the box bound for the whole reduced cost
let boundBad = 0;
for (let t = 0; t < 3000; t++) {
  const lo = new Float64Array(6), hi = new Float64Array(6);
  for (let k = 0; k < 6; k++) { lo[k] = 0.4 + rnd() * 3; hi[k] = lo[k] + rnd() * rnd() * 0.6; }
  const scratch = I.newScratch();
  const r = PI.boxBound(cert, prepared, tables, false, lo, hi, scratch);
  for (let s = 0; s < 6; s++) {
    const g = Array.from({length: 6}, (_, k) => lo[k] + rnd() * (hi[k] - lo[k]));
    if (P.reducedCost(g, cert) < r.bound - 1e-12) boundBad++;
    const grad = P.reducedCostAndGradient(g, cert).gradient;
    for (let k = 0; k < 6; k++) {
      if (grad[k] < r.gradLo[k] - 1e-9 || grad[k] > r.gradHi[k] + 1e-9) boundBad++;
    }
  }
}
check('the reduced-cost box bound and its gradient ranges hold', boundBad === 0,
  '3000 boxes x 6 samples');

// ---- the sweep runs, on a target it can actually clear
const easy = PI.verifyPairFloor(cert, prepared, 0.0035,
  {rho: 0.05, tables, box: 3, budget: 3e7});
check('the tube-excluded pair sweep completes on a truncated cube', easy.complete,
  `${easy.processed} boxes, ${easy.collapsed} collapses, cube 3, target 0.0035`);

// ---- and refuses a target the certificate does not clear
const hard = PI.verifyPairFloor(cert, prepared, EALT + 1e-5,
  {rho: 0.05, tables, box: 3, budget: 3e7});
check('and refuses one above the certificate floor', !hard.complete,
  hard.counterexample
    ? `counterexample ${hard.counterexample.value.toFixed(15)}` : 'budget');

console.log(failures ? `\n${failures} FAILED` : '\nPAIR SWEEP CHECKS PASS');
process.exit(failures ? 1 : 0);
