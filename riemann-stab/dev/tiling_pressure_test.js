'use strict';

const fs = require('fs');
const path = require('path');
const P = require('./tiling_pressure');
const T = require('./tiling_research');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
  if (!ok) failures++;
}

console.log('=== pressure, mode locking, and the plateau edges ===');

// ---- the closed form, which replaces the scan
check('the kernel constant is a tan a with a = 1/sqrt(2)',
  Math.abs(P.KERNEL_C - (1 / Math.SQRT2) * Math.tan(1 / Math.SQRT2)) < 1e-18,
  P.KERNEL_C.toFixed(18));
{
  const scan = P.kernelZeros(11);
  let worst = 0, worstAsym = [];
  for (let k = 1; k <= scan.length; k++) {
    worst = Math.max(worst, Math.abs(P.kernelZeroClosed(k) - scan[k - 1]));
    if (k >= 3) {
      worstAsym.push(Math.abs(P.kernelZeroAsymptotic(k) - P.kernelZeroClosed(k)) * k ** 5);
    }
  }
  check('the closed-form zeros agree with the scan that found them', worst < 1e-9,
    `worst disagreement ${worst.toExponential(2)} over ${scan.length} zeros`);
  check('and b tan b = C really is the zero equation',
    scan.every((z, i) => Math.abs(Math.PI * z * Math.tan(Math.PI * z) - P.KERNEL_C) < 1e-9));
  check('the asymptotic z_k = k + C/(k pi^2) - (C^2 + C^3/3)/(k^3 pi^4) is O(k^-5)',
    Math.max(...worstAsym) < 3 * Math.min(...worstAsym),
    `k^5 times the error spans ${Math.min(...worstAsym).toExponential(3)} .. `
    + `${Math.max(...worstAsym).toExponential(3)} over k = 3..11`);
}

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

// ---- the resonance pressure, in closed form
// This replaces a bisection, agrees with it where that converged, and settles
// the cases it reported as "none" -- those were guessed-window artifacts.
check('the closed-form resonance pressure reproduces the bisected p_4 and p_6',
  Math.abs(P.resonancePressureClosed(4) - 7572.855986) < 1e-5
  && Math.abs(P.resonancePressureClosed(6) - 80778.412591) < 1e-4,
  `${P.resonancePressureClosed(4).toFixed(6)} and `
  + `${P.resonancePressureClosed(6).toFixed(6)}`);
check('it gives a positive pressure at k = 2, which the scan called none '
  + 'because its window started at 300',
  P.resonancePressureClosed(2) > 0 && P.resonancePressureClosed(2) < 300,
  `p_2 = ${P.resonancePressureClosed(2).toFixed(6)}`);
check('and at k = 8, which the scan called none because its window stopped '
  + 'at 520000', P.resonancePressureClosed(8) > 520000,
  `p_8 = ${P.resonancePressureClosed(8).toFixed(3)}`);
check('while k = 10 has no positive resonance pressure at all',
  P.resonancePressureClosed(10) < 0,
  `p_10 = ${P.resonancePressureClosed(10).toExponential(6)}, `
  + 'the denominator has the wrong sign');
// at an even-k resonance the period-one branch is the lower of the two; at an
// odd-k one it is not, which is the parity rule seen from the analytic side
for (const k of [2, 4, 6]) {
  const p = P.resonancePressureClosed(k);
  const g = P.kernelZeroClosed(k) / 2;
  const one = T.periodicChainEnergy([g], 7, p);
  const t = P.twoCycle(p, [g - 0.47, g + 0.47]);
  const two = T.periodicChainEnergy([t.L, t.H], 7, p);
  check(`at the k = ${k} resonance the period-one branch is the lower one`,
    one < two, `${one.toExponential(6)} against ${two.toExponential(6)}`);
}
for (const k of [3, 5, 7]) {
  const p = P.resonancePressureClosed(k);
  const g = P.kernelZeroClosed(k) / 2;
  const one = T.periodicChainEnergy([g], 7, p);
  const t = P.twoCycle(p, [g - 0.47, g + 0.47]);
  const two = T.periodicChainEnergy([t.L, t.H], 7, p);
  check(`at the k = ${k} resonance period two beats period one`, two < one,
    `by ${(one - two).toExponential(3)}`);
}

// ---- is the resonance ever exact?
// "near z_k/2" is a function of the pressure, since the branch moves inside its
// own plateau.  The sharp question is whether the offset changes sign.
const RES = [{k: 2, lo: 300, hi: 900, crosses: false},
  {k: 3, lo: 1455, hi: 3370, crosses: false},
  {k: 4, lo: 4000, hi: 25000, crosses: true},
  {k: 5, lo: 26000, hi: 45000, crosses: false},
  {k: 6, lo: 55000, hi: 120000, crosses: true}];
const found = RES.map(r => ({...r, p: P.resonantPressure(r.k, r.lo, r.hi)}));
// NOTE: this test is about whether the WINNING branch's offset changes sign
// inside the plateau window, which is a different and weaker question than
// whether a resonant configuration exists.  dev/resonance_arb.py answers the
// latter analytically and finds resonances at k = 2, 3, 5 and 8 that this scan
// misses because they lie outside the windows below.
check('inside these windows the offset changes sign only at k = 4 and k = 6',
  found.every(r => (r.p !== null) === r.crosses),
  found.map(r => `k=${r.k}:${r.p === null ? 'none' : r.p.toFixed(3)}`).join(' '));
check('and the two that do are period-one branches',
  found.filter(r => r.p !== null).every(r => r.k % 2 === 0));
check('inside these windows the period-two offsets keep one sign -- which is '
  + 'a fact about the windows, not about resonance',
  found.filter(r => r.k % 2 === 1).every(r =>
    P.resonanceOffset(r.lo, r.k) > 0 && P.resonanceOffset(r.hi, r.k) > 0),
  'the k = 3 resonance is real and sits at p = 1155.32, below this window');
const k4 = found.find(r => r.k === 4).p;
check('the k = 4 crossing agrees with the Arb computation of it',
  Math.abs(k4 - 7572.855986) < 1e-4, `${k4.toFixed(6)} against 7572.855986`);

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
// The upper crossing IS a phase boundary -- dev/interface_arb.py gives it a
// positive tension and dev/staircase_arb.py shows periods five and seven do not
// undercut it.  The lower one is not: a certified period-five orbit lies below
// both branches there.  Bracketing an interval is all this pair of numbers does.
check('and the lower crossing is recorded as not being a boundary either',
  /lower crossing is therefore not a phase boundary/i.test(
    fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8')),
  'the page must say so, since a crossing that is not a transition reads as one');

// ------------------------------- the page's staircase numbers, against Arb
// The page now says the lower crossing is NOT a phase boundary and quotes
// certified margins for it.  A number quoted on a page and a number in a
// transcript drift apart silently; this is the only thing that stops that.
{
  const rec = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'staircase_arb.results.json'), 'utf8'));
  const page = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  const mid = str => parseFloat(String(str).replace(/[[\]]/g, '').split('+/-')[0]);

  const e2 = mid(rec.lower_crossing['2'].energy);
  const e3 = mid(rec.lower_crossing['3'].energy);
  const e5 = mid(rec.lower_crossing['5'].energy);
  check('the transcript has period five below both branches at the lower crossing',
    e5 < e2 && e5 < e3, `${e5} vs ${e2}, ${e3}`);
  check('and the page quotes that margin',
    page.includes('4.18428'), 'e5 - e2 = -4.18428e-7');
  check('the page quotes the negative tension there',
    page.includes('1.0460708'), 'tau_eff(5) = -1.0460708e-6');

  const c = parseFloat(rec.c);
  const u5 = mid(rec.upper_crossing['5'].energy);
  const u7 = mid(rec.upper_crossing['7'].energy);
  check('the transcript has period five and seven ABOVE c at p*',
    u5 > c && u7 > c, `${u5 - c}, ${u7 - c}`);
  check('and the page quotes both margins',
    page.includes('1.69462') && page.includes('5.51479'));

  // The window, and the mediants that would have made it a staircase.
  const wl = rec.window['1452.0'], wr = rec.window['1457.0'];
  check('the transcript brackets the period-five window from below',
    mid(wl['3']) < mid(wl['5']), `e3 - e5 = ${mid(wl['3']) - mid(wl['5'])}`);
  check('and from above',
    mid(wr['2']) < mid(wr['5']), `e2 - e5 = ${mid(wr['2']) - mid(wr['5'])}`);
  check('the page quotes the window and says 5 = 3 + 2',
    page.includes('1452.44') && page.includes('1456.17')
    && /5 = 3 \+ 2/.test(page));
  check('the page records that both mediants LOSE, so it is not a staircase',
    page.includes('5.73192') && page.includes('6.72987')
    && /is not a staircase/i.test(page));

  const d2 = mid(rec.p1000['2'].energy), d4 = mid(rec.p1000['4'].energy);
  check('the transcript has period four below the period-two branch at p = 1000',
    d4 < d2, `${d4 - d2}`);
  check('and the page quotes that margin', page.includes('1.2684'));
}

console.log(failures ? `\n${failures} FAILED` : '\nPRESSURE CHECKS PASS');
process.exit(failures ? 1 : 0);
