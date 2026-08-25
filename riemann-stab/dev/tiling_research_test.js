'use strict';

const fs = require('fs');
const path = require('path');
const T = require('./tiling_research');
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'tiling_research.golden.json'), 'utf8'));

let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('  OK  ', name);
  else { failed++; console.error('  FAIL', name, detail); }
}
function close(a, b, tolerance) { return Math.abs(a - b) <= tolerance; }

check('normalized kernel w(0)=1', close(T.overlapWeight(0), 1, 2e-15));
check('kernel is even', close(T.overlapWeight(1.2345), T.overlapWeight(-1.2345), 2e-15));

// This is the exact combinatorial reindexing on which the research direction rests.
for (let period = 1; period <= 9; period++) {
  const gaps = Array.from({length: period}, (_, i) => 0.83 + ((17 * i + 3 * period) % 11) / 5);
  const direct = T.periodicBlockAverage(gaps, golden.n, golden.p);
  const reindexed = T.periodicChainEnergy(gaps, golden.n, golden.p);
  check(`block-average identity, period ${period}`, close(direct, reindexed, 2e-13), `${direct} vs ${reindexed}`);
}

const local = T.blockFunctional(golden.isolated_block.gaps, golden.p);
check('isolated F7 candidate pin', close(local, golden.isolated_block.value, 2e-9), `${local}`);

for (const row of golden.periodic_candidates) {
  const direct = T.periodicBlockAverage(row.gaps, golden.n, golden.p);
  const reindexed = T.periodicChainEnergy(row.gaps, golden.n, golden.p);
  check(`period-${row.period} candidate identity`, close(direct, reindexed, 2e-13));
  check(`period-${row.period} candidate pin`, close(reindexed, row.value, 2e-9), `${reindexed}`);
}

const projection = T.projectedSimpleZeroBound(
  golden.conditional_projection.assumed_global_floor, golden.n, golden.p
);
check('published assembly anchor at c=19/5000',
  close(T.projectedSimpleZeroBound(19 / 5000).bound, 0.6730085279277798, 2e-15));
check('conditional 0.00395 projection pin',
  close(projection.bound, golden.conditional_projection.projected_simple_zero_bound, 2e-15));

check('golden status says numerical only', /no certified global lower bound/.test(golden.status));

if (failed) {
  console.error(`${failed} tiling-research checks failed`);
  process.exit(1);
}
console.log('OVERLAPPING-BLOCK RESEARCH CHECKS PASS');
