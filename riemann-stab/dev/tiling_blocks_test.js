'use strict';

const fs = require('fs');
const path = require('path');
const T = require('./tiling_research');
const A = require('./tiling_additive');
const I = require('./tiling_interval');
const B = require('./tiling_blocks');

let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('  OK  ', name);
  else { failed++; console.error('  FAIL', name, detail); }
}
let seed = 24680; const random = () => { seed = (1103515245 * seed + 12345) % 2147483648; return seed / 2147483648; };

// The general sign matrix must reproduce the hand-derived six-gap one.
check('six-gap sign matrix matches the specialised module',
  JSON.stringify(B.signMatrix(6)) === JSON.stringify([A.SIGN_A, A.SIGN_B]),
  JSON.stringify(B.signMatrix(6)));
check('seven-gap sign matrix is the odd-block form',
  JSON.stringify(B.signMatrix(7)) ===
  JSON.stringify([[1, 0, 0, -2, 0, 0, 1], [0, 1, 0, -2, 0, 1, 0], [0, 0, 1, -2, 1, 0, 0]]),
  JSON.stringify(B.signMatrix(7)));
for (const m of [4, 5, 6, 7, 8, 9]) {
  const rows = B.signMatrix(m);
  let ok = true;
  for (const row of rows) {
    if (row.reduce((a, b) => a + b, 0) !== 0) ok = false;          // telescoping
    for (let k = 0; k < m; k++) if (row[k] !== row[m - 1 - k]) ok = false;  // reversal
  }
  check(`block ${m}: every free direction telescopes and is reversal symmetric`, ok);
}

const certificates = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
const compactEntry = certificates.certificates.find(c => c.name === 'compact');
const compact = {knots: compactEntry.knots, a: compactEntry.a, b: compactEntry.b};
const general = {knots: compactEntry.knots, functions: [compactEntry.a, compactEntry.b]};

let worst = 0;
for (let trial = 0; trial < 30000; trial++) {
  const g = Array.from({length: 6}, () => random() * 6);
  worst = Math.max(worst, Math.abs(B.reducedCost(g, general) - A.additiveReducedCost(g, compact)));
}
check('general reduced cost agrees with the specialised one', worst < 1e-15, `${worst}`);
check('general amplitude agrees with the specialised one',
  Math.abs(B.amplitude(general, 6) - A.certificateAmplitude(compact).bound) < 1e-18);

// The general sweep must reproduce the specialised sweep box for box.
const tables = I.attachTables(I.buildTables(400));
const prepared = I.prepareCertificate(compact);
for (const target of [0.003, 0.0033]) {
  const generalRun = B.verifyFloorGeneral(general, 6, target,
    {tables, budget: 2e6, box: compactEntry.searchBox});
  const specialised = I.verifyFloor(prepared, target,
    {tables, budget: 2e6, box: compactEntry.searchBox});
  check(`general sweep reproduces the specialised one at ${target}`,
    generalRun.complete && specialised.complete && generalRun.processed === specialised.processed,
    `${generalRun.processed} vs ${specialised.processed}`);
}

// Seven gaps: the block size the scan says the projection actually peaks at.
const golden = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_research.golden.json'), 'utf8'));
const seven = golden.block_seven;
const sevenValue = T.blockFunctional(seven.isolated_block.gaps, golden.p);
check('seven-gap isolated block minimum pin',
  Math.abs(sevenValue - seven.isolated_block.value) < 5e-11, `${sevenValue}`);
check('seven-gap block minimum sits below the eight-point chain candidate',
  sevenValue < seven.chain_candidate, `${sevenValue} vs ${seven.chain_candidate}`);

const flat = seven.zero_certificate;
const zero = {knots: flat.knots, functions: [0, 1, 2].map(() => flat.knots.map(() => 0))};
const sevenSweep = B.verifyFloorGeneral(zero, 7, flat.target,
  {tables, budget: 2e6, box: flat.box});
check(`seven-dimensional sweep completes at ${flat.target}`, sevenSweep.complete,
  `${sevenSweep.processed} boxes`);
check('seven-dimensional sweep box-count pin',
  sevenSweep.processed === flat.boxes, `${sevenSweep.processed}`);

if (failed) {
  console.error(`${failed} general-block checks failed`);
  process.exit(1);
}
console.log('GENERAL BLOCK CHECKS PASS');
