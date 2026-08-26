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

const gradientProbe = [0.91, 1.27, 2.03, 1.11, 2.41, 0.77, 1.62, 2.18, 1.34];
const analytic = T.periodicChainEnergyAndGradient(gradientProbe).gradient;
const epsilon = 1e-6;
let gradientError = 0;
for (let i = 0; i < gradientProbe.length; i++) {
  const left = gradientProbe.slice(); left[i] -= epsilon;
  const right = gradientProbe.slice(); right[i] += epsilon;
  const finiteDifference = (T.periodicChainEnergy(right) - T.periodicChainEnergy(left)) / (2 * epsilon);
  gradientError = Math.max(gradientError, Math.abs(finiteDifference - analytic[i]));
}
check('analytic periodic gradient', gradientError < 2e-10, `${gradientError}`);

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

for (const row of golden.long_period_stress) {
  const motif = golden.periodic_candidates.find(x => x.period === row.observed_motif_period).gaps;
  const gaps = Array.from({length: row.period}, (_, i) => motif[i % motif.length]);
  check(`period-${row.period} stress motif pin`,
    close(T.periodicChainEnergy(gaps), row.value, 2e-9));
}

const projection = T.projectedSimpleZeroBound(
  golden.conditional_projection.assumed_global_floor, golden.n, golden.p
);
check('published assembly anchor at c=19/5000',
  close(T.projectedSimpleZeroBound(19 / 5000).bound, 0.6730085279277798, 2e-15));
check('conditional 0.00395 projection pin',
  close(projection.bound, golden.conditional_projection.projected_simple_zero_bound, 2e-15));

check('golden status says numerical only', /no certified global lower bound/.test(golden.status));

const phase = golden.two_phase_probe;
const walls = T.runDomainWallStress({periods: [32, 48, 64], iterations: 3000});
for (const observed of phase.wall_tension) {
  const computed = walls.find(row => row.period === observed.period).wallTension;
  check(`period-${observed.period} pinned wall tension`,
    close(computed, observed.value, 3e-15), `${computed}`);
}
const spectrum = T.periodTwoBlochSpectrum(phase.bloch_period, phase.bloch_epsilon);
const softest = Math.min(...spectrum.map(row => row.lower));
const largest = Math.max(...spectrum.map(row => row.upper));
check('period-two Bloch spectrum is strictly positive', softest > 1.66, `${softest}`);
check('softest Bloch eigenvalue pin', close(softest, phase.softest_eigenvalue, 2e-10));
check('largest Bloch eigenvalue pin', close(largest, phase.largest_eigenvalue, 2e-10));
check('two-phase scope remains numerical', /not a global lower bound/.test(phase.status));

if (failed) {
  console.error(`${failed} tiling-research checks failed`);
  process.exit(1);
}
console.log('OVERLAPPING-BLOCK RESEARCH CHECKS PASS');
