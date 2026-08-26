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
  const motif = row.gaps || golden.periodic_candidates.find(x => x.period === row.observed_motif_period).gaps;
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
for (const observed of phase.two_interface_excess) {
  const computed = walls.find(row => row.period === observed.period).totalExcess;
  check(`period-${observed.period} pinned two-interface excess`,
    close(computed, observed.value, 3e-15), `${computed}`);
}
const kinkRow = T.runOddKinkStress({periods: [63], iterations: 3000})[0];
const lowKink = kinkRow.orientations.find(row => row.kind === 'low-low');
const highKink = kinkRow.orientations.find(row => row.kind === 'high-high');
check('low-low kink has one charged defect',
  lowKink.counts.lowLow === 1 && lowKink.counts.highHigh === 0);
check('high-high kink has opposite charged defect',
  highKink.counts.lowLow === 0 && highKink.counts.highHigh === 1);
check('low-low kink excess pin',
  close(lowKink.totalExcess, phase.period_63_kinks.low_low_excess, 2e-13));
check('high-high kink excess pin',
  close(highKink.totalExcess, phase.period_63_kinks.high_high_excess, 2e-13));
const additivityError = Math.abs(
  walls.find(row => row.period === 64).totalExcess
    - lowKink.totalExcess - highKink.totalExcess
);
check('separated two-wall excess is asymptotically additive', additivityError < 1e-10,
  `${additivityError}`);
for (const kink of kinkRow.orientations) {
  const c = kink.counts;
  check(`${kink.kind} phase-defect balance`,
    c.low - c.high === c.lowLow - c.highHigh && c.lowHigh === c.highLow);
}
const spectrum = T.periodTwoBlochSpectrum(phase.bloch_period, phase.bloch_epsilon);
const softest = Math.min(...spectrum.map(row => row.lower));
const largest = Math.max(...spectrum.map(row => row.upper));
check('period-two Bloch spectrum is strictly positive', softest > 1.66, `${softest}`);
check('softest Bloch eigenvalue pin', close(softest, phase.softest_eigenvalue, 2e-10));
check('largest Bloch eigenvalue pin', close(largest, phase.largest_eigenvalue, 2e-10));
const coercivity = T.runNonlinearCoercivityProbe();
for (const observed of phase.finite_amplitude_bloch_coercivity) {
  const computed = coercivity.find(row => row.radius === observed.radius);
  check(`radius-${observed.radius} finite-amplitude coercivity pin`,
    close(computed.ratio, observed.ratio, 8e-10), `${computed.ratio}`);
}
check('scanned finite-amplitude modes remain coercive through radius 0.15',
  coercivity.every(row => row.ratio > 0.77));
check('two-phase scope remains numerical', /not a global lower bound/.test(phase.status));


// The payoff curve is the decision-relevant object: it converts whatever floor
// a certificate actually reaches into the projected simple-zero constant, and
// says what share of the available improvement that buys.  The projection is
// strongly concave in the floor, which is why the round number 0.00395 was
// never the right scoreboard.
const payoff = golden.floor_payoff_curve;
let previousBound = -Infinity;
for (const row of payoff.rows) {
  const computed = T.floorPayoff(row.floor);
  check(`payoff pin ${row.name}`, close(computed.bound, row.bound, 5e-15), `${computed.bound}`);
  check(`captured-fraction pin ${row.name}`,
    close(computed.capturedFraction, row.capturedFraction, 5e-12), `${computed.capturedFraction}`);
  check(`payoff is monotone at ${row.name}`, computed.bound >= previousBound,
    `${computed.bound} < ${previousBound}`);
  previousBound = computed.bound;
}
// Monotonicity has to survive the integer windows-per-block jump, so sweep it.
let monotoneFailures = 0;
let sweepPrevious = -Infinity;
for (let floor = 0.0037; floor <= 0.00397; floor += 1e-6) {
  const bound = T.floorPayoff(floor).bound;
  if (bound < sweepPrevious - 1e-15) monotoneFailures++;
  sweepPrevious = bound;
}
check('projection is monotone in the certified floor', monotoneFailures === 0, `${monotoneFailures}`);


// The projection code must reproduce the externally published headline exactly,
// through completely different arithmetic: the code goes through
// windowsPerBlock / blockSize / defectCoefficient, the published form is the
// single fraction (1345000*H_MT - 2680)/1340003 that Lean pins two-sidedly.
// Agreeing to the last bit is evidence the implementation is the same formula.
const HMT = 0.6725007036794116457;
const publishedHeadline = (1345000 * HMT - 2680) / 1340003;
check('projection reproduces the published headline exactly',
  T.projectedSimpleZeroBound(19 / 5000).bound === publishedHeadline,
  `${T.projectedSimpleZeroBound(19 / 5000).bound} vs ${publishedHeadline}`);

// Same algebra at the swept floor, where Lean pins the constant as well.
const sweptProjection = T.projectedSimpleZeroBound(0.003955);
check('swept floor uses 252 windows in blocks of 258',
  sweptProjection.windowsPerBlock === 252 && sweptProjection.blockSize === 258);
check('swept projection matches its closed form',
  Math.abs(sweptProjection.bound - (258000000 * HMT - 514000) / 257003340) < 2e-16,
  `${sweptProjection.bound}`);
check('swept projection sits inside the Lean two-sided pin',
  sweptProjection.bound >= 0.6731086901411016 && sweptProjection.bound <= 0.6731086901411018,
  `${sweptProjection.bound}`);


// ------------------------------------------------------------- block size
// The block size is a free parameter of the assembly that nobody varied.  The
// search that produced these two-cycles is offline; what runs here is the
// cheap part: recompute the chain energy at the pinned gaps and push it back
// through the projection.
const scan = golden.block_size_scan;
let peak = null;
for (const row of scan.rows) {
  const energy = T.periodicChainEnergy(row.gaps, row.n, golden.p);
  check(`block size ${row.n}: chain candidate pin`, close(energy, row.value, 5e-12), `${energy}`);
  const projected = T.projectedSimpleZeroBound(energy, row.n, golden.p);
  check(`block size ${row.n}: projection pin`, close(projected.bound, row.bound, 5e-12),
    `${projected.bound}`);
  check(`block size ${row.n}: window arithmetic pin`,
    projected.windowsPerBlock === row.windowsPerBlock && projected.blockSize === row.blockSize);
  if (!peak || projected.bound > peak.bound) peak = {n: row.n, bound: projected.bound};
}
check('the projection peaks at block size eight, not seven', peak.n === 8, `${peak.n}`);
const sevenRow = scan.rows.find(r => r.n === 7);
check('block size eight beats the manuscript choice by about 1.9e-5',
  peak.bound - sevenRow.bound > 1.9e-5 && peak.bound - sevenRow.bound < 2.0e-5,
  `${peak.bound - sevenRow.bound}`);
check('block-size scan states its conditionality', /cannot check/.test(scan.note));

if (failed) {
  console.error(`${failed} tiling-research checks failed`);
  process.exit(1);
}
console.log('OVERLAPPING-BLOCK RESEARCH CHECKS PASS');
