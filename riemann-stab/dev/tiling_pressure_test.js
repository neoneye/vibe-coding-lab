'use strict';

const P = require('./tiling_pressure');
const T = require('./tiling_research');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
  if (!ok) failures++;
}

console.log('=== pressure, mode locking, and the plateau edges ===');

// ---- the kernel's zeros are the free distances
const zeros = P.kernelZeros(8);
check('the kernel has zeros approaching integer spacing from below',
  zeros.length >= 7
  && Math.abs(zeros[0] - 1.057278) < 1e-5
  && Math.abs(zeros[2] - 3.020243) < 1e-5
  && zeros[5] - zeros[4] > zeros[1] - zeros[0]
  && zeros[5] - zeros[4] < 1,
  zeros.slice(0, 4).map(z => z.toFixed(6)).join(' ') + ' ...');
check('and w really does vanish there, so those distances are free',
  Math.abs(P.kernel(zeros[2])) < 1e-12,
  `|K(z3)| = ${Math.abs(P.kernel(zeros[2])).toExponential(2)}`);

// ---- the lock: on the period-two plateau the lag-two distance sits on z3
let worstOffset = 0;
for (const p of [1500, 2000, 2500, 3000, 3400]) {
  const t = P.twoCycle(p);
  worstOffset = Math.max(worstOffset, Math.abs(t.lagTwo - zeros[2]));
}
check('across the whole period-two plateau the lag-two distance stays on a zero',
  worstOffset < 2e-3,
  `worst offset from z3 = ${worstOffset.toExponential(3)} over p in [1500, 3400]`);

// ---- the law across branches: the branch value is near z_k/2, and which of
// period one and period two wins tracks the parity of k.
//
// An earlier version of this block ASSIGNED the period in the table and then
// checked it against the parity, which checks nothing: the test was reading back
// its own input.  Here the period is DETERMINED at each k by relaxing both and
// comparing, and the parity is what is checked.
const BRANCHES = [{k: 2, p: 600}, {k: 3, p: 2400}, {k: 4, p: 12000},
  {k: 5, p: 33000}];
const errors = [];
for (const {k, p} of BRANCHES) {
  const half = zeros[k - 1] / 2;
  const one = P.relax([half], p, 60000);
  const t = P.twoCycle(p, [half - 0.47, half + 0.47]);
  const twoValue = T.periodicChainEnergy([t.L, t.H], 7, p);
  const period = (one.value <= twoValue + 1e-14) ? 1 : 2;
  const gaps = period === 1 ? one.gaps : [t.L, t.H];
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  errors.push({k, period, mean, half, err: Math.abs(mean - half),
    naive: Math.abs(mean - k / 2), margin: Math.abs(one.value - twoValue)});
}
check('each branch sits near a halved zero of the kernel',
  errors.every(e => e.err < 2e-3),
  errors.map(e => `k=${e.k}: ${e.err.toExponential(2)}`).join('  '));
check('nearer the halved ZERO than the half-integer, by an order of magnitude',
  errors.every(e => e.err < e.naive / 8),
  errors.map(e => `k=${e.k}: ${(e.naive / e.err).toFixed(0)}x`).join('  '));
check('and the agreement sharpens as k grows, which a coincidence would not',
  errors[3].err < errors[0].err / 10,
  `${errors[0].err.toExponential(2)} at k=2 down to ${errors[3].err.toExponential(2)} at k=5`);
check('the period that wins is the parity of k -- determined here, not assumed',
  errors.every(e => e.period === (e.k % 2 === 0 ? 1 : 2)),
  errors.map(e => `k=${e.k}->${e.period} (by ${e.margin.toExponential(1)})`).join('  '));

// ---- the wall tensions change sign, but not at the branch crossings
const rows = [[1400, -1, +1], [3000, +1, +1], [3700, +1, -1]];
for (const [p, wantLL, wantHH] of rows) {
  const ll = P.wallTension(p, 0, 31).tension;
  const hh = P.wallTension(p, 1, 31).tension;
  check(`at p = ${p} the isolated-wall excesses have signs (${wantLL > 0 ? '+' : '-'}, `
    + `${wantHH > 0 ? '+' : '-'})`,
    Math.sign(ll) === wantLL && Math.sign(hh) === wantHH,
    `tau_LL = ${ll.toExponential(3)}, tau_HH = ${hh.toExponential(3)}`);
}

// ---- and at p = 3000 they reproduce the certified Arb values
const ll3000 = P.wallTension(3000, 0, 63).tension;
const hh3000 = P.wallTension(3000, 1, 63).tension;
check('at p = 3000 they reproduce the tensions certified in Arb',
  Math.abs(ll3000 - 0.0010927864577243426) < 1e-11
  && Math.abs(hh3000 - 0.00014708549748144325) < 1e-11,
  `${ll3000.toExponential(10)} and ${hh3000.toExponential(10)}`);
check('and p = 3000 is much nearer the high-high end than the low-low one',
  ll3000 / hh3000 > 7 && ll3000 / hh3000 < 8,
  `ratio ${(ll3000 / hh3000).toFixed(3)}`);

// ---- the ground state really does change period at the edges
const twoAt = p => T.periodicChainEnergy([P.twoCycle(p).L, P.twoCycle(p).H], 7, p);
for (const [p, beatable] of [[1400, true], [2000, false], [3600, true]]) {
  let best = Infinity;
  for (const q of [3, 4]) {
    const seeds = [
      Array.from({length: q}, (_, i) => i % q === q - 1 ? 1.98 : 1.04),
      Array.from({length: q}, (_, i) => i % q === 0 ? 1.04 : 1.98)
    ];
    for (const s of seeds) best = Math.min(best, P.relax(s, p, 20000).value);
  }
  const two = twoAt(p);
  check(`at p = ${p} a period-3 or -4 state ${beatable ? 'beats' : 'does not beat'}`
    + ' the alternating one', (best < two - 1e-12) === beatable,
    `difference ${(best - two).toExponential(3)}`);
}

// ---- the optimal pressure is the phase boundary
const crossover = P.periodCrossover();
check('the period-two state loses to period three at a definite pressure',
  Math.abs(crossover - 3370.4507) < 0.01, `p = ${crossover.toFixed(6)}`);
check('and that is well below where a single wall stops costing',
  crossover < 3521.8 && P.wallTension(crossover, 1, 31).tension > 0,
  `tau_HH there = ${P.wallTension(crossover, 1, 31).tension.toExponential(3)}, `
  + 'so walls attract');

const at3000 = P.projectionAt(3000).bound;
const atStar = P.projectionAt(crossover).bound;
check('the projection is larger at the crossover than at the inherited p = 3000',
  atStar > at3000, `${atStar.toFixed(12)} against ${at3000.toFixed(12)}, `
  + `+${(atStar - at3000).toExponential(3)}`);
// An earlier version compared only two points forty units away, which cannot
// tell a maximum from a plateau or from a sawtooth peak -- the projection has
// integer steps in windowsPerBlock and is not smooth.  This scans.
let scanned = 0, better = 0;
for (let p = crossover - 200; p <= crossover + 200; p += 10) {
  scanned++;
  if (P.projectionAt(p).bound > atStar + 1e-15) better++;
}
check('and nothing within 200 either side beats it, on a grid of 10',
  better === 0, `${scanned} points scanned, ${better} better`);
check('the two crossings bracket an interval, and the wall zeros lie OUTSIDE it',
  P.lowerCrossover() > 1425.709927 && crossover < 3521.815455,
  `branches cross at ${P.lowerCrossover().toFixed(3)} and ${crossover.toFixed(3)}; `
  + 'wall zeros at 1425.710 and 3521.815 sit outside both ends, so they are '
  + 'metastability limits and not phase boundaries');

console.log(failures ? `\n${failures} FAILED` : '\nPRESSURE CHECKS PASS');
process.exit(failures ? 1 : 0);
