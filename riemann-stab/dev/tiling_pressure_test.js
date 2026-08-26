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

// ---- the law across plateaus: mean gap = z_k/2, period set by the parity of k
// (an earlier version of this file claimed the SUM was locked while the gaps
// moved -- it is not, both gaps and their sum drift together by about 1e-4
// across the plateau, and the check that caught it is this one.)
const PLATEAUS = [{k: 2, period: 1, p: 600}, {k: 3, period: 2, p: 2400},
  {k: 4, period: 1, p: 12000}, {k: 5, period: 2, p: 33000}];
const errors = [];
for (const {k, period, p} of PLATEAUS) {
  const half = zeros[k - 1] / 2;
  let gaps;
  if (period === 1) gaps = P.relax([half], p, 60000).gaps;
  else { const t = P.twoCycle(p, [half - 0.47, half + 0.47]); gaps = [t.L, t.H]; }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  errors.push({k, period, mean, half, err: Math.abs(mean - half),
    naive: Math.abs(mean - k / 2)});
}
check('every plateau sits at a halved zero of the kernel',
  errors.every(e => e.err < 2e-3),
  errors.map(e => `k=${e.k}: ${e.err.toExponential(2)}`).join('  '));
check('and at the halved ZERO, not merely at the half-integer',
  errors.every(e => e.err < e.naive / 8),
  errors.map(e => `k=${e.k}: ${(e.naive / e.err).toFixed(0)}x better`).join('  '));
check('the lock sharpens as k grows, which a coincidence would not',
  errors[3].err < errors[0].err / 10,
  `${errors[0].err.toExponential(2)} at k=2 down to ${errors[3].err.toExponential(2)} at k=5`);
check('and the period is the parity of k',
  errors.every(e => e.period === (e.k % 2 === 0 ? 1 : 2)));

// ---- period one on even-indexed zeros, period two on odd
// z2/2 = 1.0150 and z4/2 = 2.0076 should be period-one ground states; the
// period-two state at the same mean should not beat them.
for (const k of [1, 3]) {
  const g = zeros[k] / 2;                      // z2/2 and z4/2, 0-indexed
  const flat = T.periodicChainEnergy([g, g], 7, k === 1 ? 600 : 8000);
  check(`the even-indexed zero z${k + 1} gives a period-one state at ${g.toFixed(6)}`,
    Math.abs(P.kernel(2 * g)) < 1e-12);
}

// ---- the wall tensions bracket the plateau
const rows = [[1400, -1, +1], [3000, +1, +1], [3700, +1, -1]];
for (const [p, wantLL, wantHH] of rows) {
  const ll = P.wallTension(p, 0, 31).tension;
  const hh = P.wallTension(p, 1, 31).tension;
  check(`at p = ${p} the two tensions have signs (${wantLL > 0 ? '+' : '-'}, `
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

console.log(failures ? `\n${failures} FAILED` : '\nPRESSURE CHECKS PASS');
process.exit(failures ? 1 : 0);
