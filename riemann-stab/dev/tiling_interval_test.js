'use strict';

const fs = require('fs');
const path = require('path');
const T = require('./tiling_research');
const A = require('./tiling_additive');
const I = require('./tiling_interval');

let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('  OK  ', name);
  else { failed++; console.error('  FAIL', name, detail); }
}

const certificates = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
const compactEntry = certificates.certificates.find(c => c.name === 'compact');
const compact = {knots: compactEntry.knots, a: compactEntry.a, b: compactEntry.b};
const zero = {knots: compactEntry.knots, a: compactEntry.knots.map(() => 0), b: compactEntry.knots.map(() => 0)};

const tables = I.attachTables(I.buildTables(120));

// ------------------------------------------------ one-dimensional ranges
// Everything rests on these being true enclosures.  Brute force is the only
// honest check: if a range is ever narrower than the sampled extremes, the
// whole sweep is worthless.
let wViolations = 0, dwViolations = 0, wSlack = 0;
let seed = 12345;
const random = () => { seed = (1103515245 * seed + 12345) % 2147483648; return seed / 2147483648; };
for (let trial = 0; trial < 2500; trial++) {
  const a = random() * 40;
  const b = a + random() * 4;
  let lo = Infinity, hi = -Infinity, dlo = Infinity, dhi = -Infinity;
  const steps = 1500;
  for (let s = 0; s <= steps; s++) {
    const x = a + (b - a) * s / steps;
    const v = T.overlapWeight(x);
    if (v < lo) lo = v; if (v > hi) hi = v;
    const d = T.overlapWeightDerivative(x);
    if (d < dlo) dlo = d; if (d > dhi) dhi = d;
  }
  const r = I.wRange(tables, a, b);
  const rd = I.dwRange(tables, a, b);
  if (r[0] > lo + 1e-12 || r[1] < hi - 1e-12) wViolations++;
  if (rd[0] > dlo + 1e-9 || rd[1] < dhi - 1e-9) dwViolations++;
  wSlack = Math.max(wSlack, (lo - r[0]) + (r[1] - hi));
}
check('weight range is a true enclosure', wViolations === 0, `${wViolations}`);
check('weight derivative range is a true enclosure', dwViolations === 0, `${dwViolations}`);
// This bounds how much wider the enclosure is than a 1500-point sample of the
// same interval, so it is dominated by the sampling error near a flat extremum.
// It catches a breakpoint table that misses whole monotone pieces, which would
// inflate the range grossly rather than by parts in a million.
check('weight range is not grossly inflated', wSlack < 2e-5, `${wSlack}`);

// The fast sparse-table queries must agree with the naive scan exactly.
const prepared = I.prepareCertificate(compact);
let fastMismatch = 0;
for (let trial = 0; trial < 20000; trial++) {
  const a = random() * 17;
  const b = a + random() * 3;
  const fast = I.plRangeFast(prepared, prepared.a, a, b);
  const slow = I.plRange(compact.knots, compact.a, a, b);
  if (Math.abs(fast[0] - slow[0]) > 1e-15 || Math.abs(fast[1] - slow[1]) > 1e-15) fastMismatch++;
  const fastSlope = I.slopeWithFlat(prepared, prepared.b, a, b);
  const slowSlope = I.plSlopeRange(compact.knots, compact.b, a, b);
  if (fastSlope[0] > slowSlope[0] + 1e-12 || fastSlope[1] < slowSlope[1] - 1e-12) fastMismatch++;
}
check('sparse range queries match the naive scan', fastMismatch === 0, `${fastMismatch}`);

// ------------------------------------------------------- the sweep itself
// A verifier that never fails proves nothing, so both directions are pinned.
const pass = I.verifyFloor(prepared, 0.0033, {tables, budget: 3e6, box: compactEntry.searchBox});
check('sweep completes at 0.0033 on the compact certificate', pass.complete,
  `${pass.processed} boxes, remaining ${pass.remaining}`);
check('completed sweep leaves no under-resolved box', pass.unresolved === 0);
check('completed sweep found no counterexample', pass.counterexample === null);

const fail = I.verifyFloor(prepared, 0.006, {tables, budget: 3e6, box: compactEntry.searchBox, dive: true});
check('sweep refuses an impossible floor', !fail.complete && fail.counterexample !== null,
  `${JSON.stringify(fail.counterexample)}`);
check('the counterexample it returns is real',
  fail.counterexample && A.additiveReducedCost(fail.counterexample.gaps, compact) < 0.006,
  `${fail.counterexample && fail.counterexample.value}`);

// With the zero certificate the reduced cost is the bare block functional, so
// this is a sweep of the published local proposition rather than of the chain.
const bare = I.verifyFloor(I.prepareCertificate(zero), 0.0035, {tables, budget: 3e6, box: 16});
check('sweep completes at 0.0035 on the bare block functional', bare.complete,
  `${bare.processed} boxes`);

// --------------------------------------------------- recorded long sweeps
const results = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_interval.results.json'), 'utf8'));
check('recorded sweeps declare their arithmetic honestly', /double precision/.test(results.scope));
for (const row of results.runs) {
  const entry = certificates.certificates.find(c => c.name === row.certificate);
  const reference = row.certificate === 'bare' ? 0.003826231218593872 : entry.floor;
  if (row.complete) {
    check(`recorded completion at ${row.target} (${row.certificate}) is below the audited floor`,
      row.target < reference, `${row.target} vs ${reference}`);
  } else {
    check(`recorded refusal at ${row.target} (${row.certificate}) is above the audited floor`,
      row.target > reference - 1e-9, `${row.target} vs ${reference}`);
  }
}
const best = results.runs.filter(r => r.complete).reduce((a, r) => Math.max(a, r.target), 0);
check('best verified floor beats the published 19/5000 certificate', best > 19 / 5000, `${best}`);
const payoff = T.floorPayoff(best);
check('best verified floor pin', Math.abs(best - results.bestVerifiedFloor) < 1e-15, `${best}`);
check('projected constant pin',
  Math.abs(payoff.bound - results.bestVerifiedBound) < 5e-15, `${payoff.bound}`);

if (failed) {
  console.error(`${failed} interval-sweep checks failed`);
  process.exit(1);
}
console.log('INTERVAL SWEEP CHECKS PASS');
