'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = require('./tiling_defect');
const I = require('./tiling_interval');
const A = require('./tiling_additive');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
  if (!ok) failures++;
}

console.log('=== tube-restricted block sweep ===');

const bundle = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
const sharp = Object.values(bundle.certificates).find(c => c.name === 'sharp');
const prepared = I.prepareCertificate(sharp);
const tables = I.attachTables(I.buildTables(120));

const EALT = 0.003957393309109344;      // dev/coercivity_arb.py, rigorously enclosed

// ---- the partition is exactly the cube minus the two tubes
const RHO = 0.05;
const BOX = 4;
const pieces = D.partition(BOX, RHO);
let mismatched = 0;
let seed = 20260826;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let trial = 0; trial < 4000; trial++) {
  const g = Array.from({length: 6}, () => rnd() * BOX);
  const inTube = [0, 1].some(p => {
    const c = D.centres(p);
    return g.every((x, i) => Math.abs(x - c[i]) <= RHO);
  });
  const covered = pieces.some(b => g.every((x, i) => x >= b.lo[i] && x <= b.hi[i]));
  if (covered === inTube) mismatched++;
}
check('the partition covers exactly the complement of the two tubes',
  mismatched === 0, `${pieces.length} pieces, 4000 sample points`);

let overlapping = 0;
for (const b of pieces) {
  for (const p of [0, 1]) {
    if (D.containedIn(b.lo, b.hi, D.centres(p), RHO)) overlapping++;
  }
}
check('no piece lies inside a tube', overlapping === 0);

// Every piece must be disjoint from both tubes, not merely not-contained --
// that is what makes the monotonicity reduction valid on it, and it is the
// property the first version of this file did not have.
let straddling = 0;
for (const b of pieces) {
  for (const p of [0, 1]) {
    if (!D.disjointFrom(b.lo, b.hi, D.centres(p), RHO)) straddling++;
  }
}
check('and every piece has interior disjoint from both, so the reduction stays valid',
  straddling === 0);

// ---- a restricted sweep that completes
// A machinery check on a truncated cube, not a certificate: box 6 is well
// below the tail threshold, so completing here proves nothing about the block
// floor and is not quoted as if it did.
const easy = D.verifyDefectFloor(prepared, 0.0036, {rho: 0.003, tables, box: 3, budget: 4e7});
check('the restricted sweep runs to completion on a truncated cube',
  easy.complete, `${easy.processed} boxes, ${easy.collapsed} collapses`);

// ---- and one that must not
const alt = [D.LOW, D.HIGH, D.LOW, D.HIGH, D.LOW, D.HIGH];
check('the reduced cost at an alternating block is the alternating energy',
  Math.abs(A.additiveReducedCost(alt, sharp) - EALT) < 1e-12,
  A.additiveReducedCost(alt, sharp).toFixed(15));

// The structural finding this file exists for: outside the tube the binding
// block is a high-high defect, and it is BELOW the alternating energy, so the
// sweep must refuse the alternating energy as a target and hand back that
// block rather than completing.
const hard = D.verifyDefectFloor(prepared, EALT, {rho: 0.003, tables, box: 3, budget: 4e7});
check('and refuses the alternating energy, outside the tube', !hard.complete);
check('the block it refuses on is a high-high defect',
  hard.counterexample !== null
  && (() => {
    const g = hard.counterexample.gaps;
    const mid = (D.LOW + D.HIGH) / 2;
    const sym = g.map(x => x > mid ? 1 : 0);
    let hh = 0;
    for (let i = 0; i + 1 < 6; i++) if (sym[i] === 1 && sym[i + 1] === 1) hh++;
    return hh === 1;
  })(),
  hard.counterexample ? hard.counterexample.gaps.map(x => x.toFixed(4)).join(' ') : 'none');

console.log(failures ? `\n${failures} FAILED` : '\nDEFECT SWEEP CHECKS PASS');
process.exit(failures ? 1 : 0);
