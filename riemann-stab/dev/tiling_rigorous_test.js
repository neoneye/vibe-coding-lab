'use strict';

const fs = require('fs');
const path = require('path');
const T = require('./tiling_research');
const I = require('./tiling_interval');
const R = require('./tiling_rigorous');

let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('  OK  ', name);
  else { failed++; console.error('  FAIL', name, detail); }
}

let seed = 987654321;
const random = () => { seed = (1103515245 * seed + 12345) % 2147483648; return seed / 2147483648; };


// ------------------------------------------------- outward rounding
// The relative widening is not outward on its own: below the smallest normal
// double, |v| * EPSD underflows and the widening vanishes.  This is the case
// that caught it.
const subnormalProduct = R.iMul([5e-324, 5e-324], [0.5, 0.5]);
check('interval product encloses a subnormal exact result',
  subnormalProduct[0] <= 2.5e-324 && 2.5e-324 <= subnormalProduct[1],
  `${JSON.stringify(subnormalProduct)}`);

// Outwardness across every magnitude regime, subnormals included.  Overflow is
// excluded deliberately: rd/ru give NaN there, and the range assertion below is
// what rules overflow out for this code rather than an assumption.
const magnitudes = [0, 5e-324, 1e-320, 1e-310, 1e-308, 1e-300, 1e-100, 1e-16,
  1, 1e3, 1e16, 1e100, 1e300];
let outwardFailures = 0;
for (const a of magnitudes) {
  for (const b of magnitudes) {
    for (const sign of [1, -1]) {
      for (const op of [(x, y) => x * y, (x, y) => x + y, (x, y) => x - y]) {
        const v = op(sign * a, b);
        if (!Number.isFinite(v)) continue;
        const lo = R.rd(v), hi = R.ru(v);
        if (!(lo <= v && v <= hi)) outwardFailures++;
        if (v !== 0 && !(lo < v && v < hi)) outwardFailures++;
      }
    }
  }
}
check('outward rounding is outward at every finite magnitude', outwardFailures === 0,
  `${outwardFailures}`);

// And the precondition that rules out overflow: every quantity the box analysis
// produces stays far inside the finite range.
const I2 = require('./tiling_interval');
const shippedForRange = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
const widestCert = shippedForRange.certificates.reduce((a, c) => c.searchBox > a.searchBox ? c : a);
const preparedForRange = I2.prepareCertificate(
  {knots: widestCert.knots, a: widestCert.a, b: widestCert.b});
const rangeScratch = I2.newScratch();
let biggest = 0, nonFinite = 0;
for (let trial = 0; trial < 20000; trial++) {
  const lo = new Float64Array(6), hi = new Float64Array(6);
  for (let k = 0; k < 6; k++) {
    lo[k] = random() * widestCert.searchBox;
    hi[k] = Math.min(widestCert.searchBox, lo[k] + random() * widestCert.searchBox);
  }
  I2.analyzeBoxRigorous(preparedForRange, lo, hi, rangeScratch);
  if (!Number.isFinite(rangeScratch.bound)) nonFinite++;
  biggest = Math.max(biggest, Math.abs(rangeScratch.bound));
  for (let k = 0; k < 12; k++) {
    if (!Number.isFinite(rangeScratch.grad[k])) nonFinite++;
    biggest = Math.max(biggest, Math.abs(rangeScratch.grad[k]));
  }
}
check('box analysis never produces a non-finite quantity', nonFinite === 0, `${nonFinite}`);
// Observed maximum is about 1.6e3 -- a derivative enclosure over a box wide
// enough that the natural extension is loose.  That is three hundred orders of
// magnitude below overflow, which is what the precondition needs.
check('and stays hundreds of orders below overflow', biggest < 1e6, `${biggest}`);

// ------------------------------------------------------------ trigonometry
// The declared error bound is what every "proved enclosure" claim downstream
// rests on, so it is checked against an INDEPENDENT oracle: mpmath at 60
// digits -- a different implementation, in a different language, on a different
// algorithm.  Comparing against the engine's own Math.sin would be close to
// circular, since the whole reason sine is implemented here is not to depend on
// it.  The oracle is biased towards the delicate cases -- multiples of pi/2 and
// tiny offsets from them, where argument reduction cancels catastrophically;
// the pi/4 branch boundary; the composed kernel arguments; magnitudes out to
// 400 -- because a uniform random sample never reaches them.  Regenerate with
// tiling_trig_oracle.py.
const oracle = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_trig.oracle.json'), 'utf8'));
check('oracle is the boundary-biased one, not a uniform sample',
  oracle.rows.length > 5000 && /biased/.test(oracle.note), `${oracle.rows.length}`);

let roundTripFailures = 0, oracleFailures = 0, consumed = 0, consumedAt = null;
let comparisonRows = 0;
for (const [xString, sinString, cosString] of oracle.rows) {
  const x = Number(xString);
  if (String(x) !== String(Number(String(x)))) roundTripFailures++;
  const sinTruth = Number(sinString), cosTruth = Number(cosString);
  const s = R.sinPoint(x), c = R.cosPoint(x);
  if (!(s[0] <= sinTruth && sinTruth <= s[1])) oracleFailures++;
  if (!(c[0] <= cosTruth && cosTruth <= c[1])) oracleFailures++;
  // How much of the declared bound is actually consumed.  Measurable only where
  // the interval is not clamped at +/-1: clamping shifts the midpoint by up to
  // half the bound and would read as inaccuracy that is not there.
  for (const pair of [[s, sinTruth], [c, cosTruth]]) {
    if (pair[0][0] <= -1 || pair[0][1] >= 1) continue;
    comparisonRows++;
    const error = Math.abs((pair[0][0] + pair[0][1]) / 2 - pair[1]);
    if (error > consumed) { consumed = error; consumedAt = x; }
  }
}
check('every oracle x round-trips through a double', roundTripFailures === 0,
  `${roundTripFailures}`);
check('sine and cosine enclosures contain the 60-digit truth everywhere',
  oracleFailures === 0, `${oracleFailures}`);
check('the comparison exercised most of the oracle', comparisonRows > 8000,
  `${comparisonRows}`);
// Containment alone would still pass if accuracy degraded until it filled the
// bound, so the headroom itself is asserted.
check('worst true error stays under a quarter of the declared bound',
  consumed < R.TRIG_ERROR / 4,
  `${consumed} at x=${consumedAt}, bound ${R.TRIG_ERROR}`);

// Agreement with the engine is kept as a sanity check only: it says the two
// implementations describe the same function, not that either is accurate.
let engineDisagreements = 0, widest = 0;
for (let trial = 0; trial < 50000; trial++) {
  const x = (random() - 0.5) * 800;
  const s = R.sinPoint(x), c = R.cosPoint(x);
  if (Math.sin(x) < s[0] || Math.sin(x) > s[1]) engineDisagreements++;
  if (Math.cos(x) < c[0] || Math.cos(x) > c[1]) engineDisagreements++;
  widest = Math.max(widest, s[1] - s[0]);
}
check('engine sine and cosine land inside the enclosures', engineDisagreements === 0,
  `${engineDisagreements}`);
check('trig enclosures stay narrow', widest < 2e-14, `${widest}`);

// The enclosure must never be narrower than the true range.
let rangeFailures = 0;
for (let t = 0; t < 4000; t++) {
  // pair distances reach 6 * 16 = 96 gaps, so sinc arguments reach ~300;
  // validate over the range actually used, not a tenth of it
  const a = (random() - 0.5) * 800;
  const b = a + random() * 8;
  const r = R.sinRange(a, b);
  const rc = R.cosRange(a, b);
  let lo = Infinity, hi = -Infinity, clo = Infinity, chi = -Infinity;
  for (let s = 0; s <= 2000; s++) {
    const x = a + (b - a) * s / 2000;
    const v = Math.sin(x);
    if (v < lo) lo = v; if (v > hi) hi = v;
    const c = Math.cos(x);
    if (c < clo) clo = c; if (c > chi) chi = c;
  }
  if (r[0] > lo + 1e-12 || r[1] < hi - 1e-12) rangeFailures++;
  if (rc[0] > clo + 1e-12 || rc[1] < chi - 1e-12) rangeFailures++;
}
check('sine and cosine ranges enclose a dense sample over the arguments actually used',
  rangeFailures === 0, `${rangeFailures}`);

// ------------------------------------------------------------------ kernel
check('K(0) enclosure brackets the laboratory value',
  R.K0[0] <= T.mtKernel(0) && T.mtKernel(0) <= R.K0[1], `${R.K0}`);
check('K(0) enclosure is narrow', R.K0[1] - R.K0[0] < 1e-13, `${R.K0[1] - R.K0[0]}`);

let pointFailures = 0, pointWidth = 0, derivWidth = 0;
for (let t = 0; t < 120000; t++) {
  const x = random() * 60;
  const w = R.weightRange(x, x);
  const d = R.weightDerivRange(x, x);
  const wt = T.overlapWeight(x), dt = T.overlapWeightDerivative(x);
  if (wt < w[0] || wt > w[1]) pointFailures++;
  if (dt < d[0] || dt > d[1]) pointFailures++;
  pointWidth = Math.max(pointWidth, w[1] - w[0]);
  derivWidth = Math.max(derivWidth, d[1] - d[0]);
}
check('weight and derivative enclosures contain the laboratory values',
  pointFailures === 0, `${pointFailures}`);
check('pointwise weight enclosure is narrow', pointWidth < 1e-12, `${pointWidth}`);
check('pointwise derivative enclosure is narrow', derivWidth < 1e-11, `${derivWidth}`);


// The second derivative drives the centered forms' remainder term, so it gets
// its own check against a finite difference of the first derivative.
let secondFailures = 0, secondWidth = 0;
for (let trial = 0; trial < 40000; trial++) {
  const x = 0.05 + random() * 40;
  const h = 1e-5;
  const finite = (T.overlapWeightDerivative(x + h) - T.overlapWeightDerivative(x - h)) / (2 * h);
  const enclosure = R.weightSecondRange(x, x);
  if (finite < enclosure[0] - 1e-4 || finite > enclosure[1] + 1e-4) secondFailures++;
  secondWidth = Math.max(secondWidth, enclosure[1] - enclosure[0]);
}
check('second-derivative enclosure agrees with a finite difference',
  secondFailures === 0, `${secondFailures}`);
check('second-derivative enclosure is narrow', secondWidth < 1e-10, `${secondWidth}`);

// The fused pair form must match what the separate pieces would give, and must
// contain the exact table ranges.
let pairFailures = 0;
for (let trial = 0; trial < 40000; trial++) {
  const a = random() * 40;
  const b = a + random() * 0.5;
  const pair = R.weightPairCentered(a, b);
  const wide = R.weightRange(a, b);
  const wideD = R.weightDerivRange(a, b);
  if (pair.w[0] < wide[0] - 1e-12 || pair.w[1] > wide[1] + 1e-12) pairFailures++;
  if (pair.dw[0] < wideD[0] - 1e-10 || pair.dw[1] > wideD[1] + 1e-10) pairFailures++;
  if (pair.w[0] < 0) pairFailures++;
}
check('fused centered pair form refines the natural extension without escaping it',
  pairFailures === 0, `${pairFailures}`);

// -------------------------------------------- containment of the fast table
// The fast sweep uses exact monotone-piece ranges in double precision.  Those
// must lie inside the rigorous enclosures; if they ever escaped, the fast
// sweep would be claiming something the rigorous arithmetic cannot support.
const tables = I.attachTables(I.buildTables(120));
let containmentFailures = 0;
for (let t = 0; t < 20000; t++) {
  const a = random() * 40;
  const b = a + random() * 2;
  const rigorous = R.weightRange(a, b);
  const fast = I.wRange(tables, a, b);
  if (rigorous[0] > fast[0] + 1e-12 || rigorous[1] < fast[1] - 1e-12) containmentFailures++;
  const rigorousD = R.weightDerivRange(a, b);
  const fastD = I.dwRange(tables, a, b);
  if (rigorousD[0] > fastD[0] + 1e-10 || rigorousD[1] < fastD[1] - 1e-10) containmentFailures++;
}
check('fast table ranges lie inside the rigorous enclosures',
  containmentFailures === 0, `${containmentFailures}`);

if (failed) {
  console.error(`${failed} rigorous-arithmetic checks failed`);
  process.exit(1);
}
console.log('RIGOROUS ARITHMETIC CHECKS PASS');
