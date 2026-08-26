'use strict';

// Rigorous enclosures for the Montgomery-Taylor kernel.
//
// The branch-and-bound sweep in tiling_interval.js is exhaustive but runs in
// plain double precision, and leans on Math.sin, which is not correctly
// rounded and carries no proved error bound.  This file removes both leans:
//
//   * sine and cosine are implemented here, by Cody-Waite argument reduction
//     against a four-term split of pi/2 followed by a truncated Taylor series
//     whose remainder is bounded by its first omitted term.  Every step's
//     rounding error is accounted for, and the result is returned as an
//     interval, never as a bare double.
//   * every arithmetic operation rounds outward by one unit in the last place,
//     which is sound because IEEE 754 addition, subtraction, multiplication
//     and division are correctly rounded.
//   * the range of the weight over an interval is obtained by natural interval
//     extension of the defining formula, so it assumes nothing about where the
//     kernel's zeros or extrema are.  That is looser than the breakpoint table
//     the fast sweep uses, and it is the price of not having to certify the
//     table's monotone-piece structure separately.
//
// What is still assumed: that the JavaScript engine implements IEEE 754
// double arithmetic for + - * / (it does, per the language specification), and
// that this file has no bugs.  The second is what the cross-validation against
// mpmath's interval arithmetic in the test file is for.

const F64 = new Float64Array(1);
const U64 = new BigUint64Array(F64.buffer);

function nextUp(x) {
  if (Number.isNaN(x)) return x;
  if (x === Infinity) return x;
  if (x === 0) return 5e-324;
  F64[0] = x;
  U64[0] += (x > 0 ? 1n : -1n);
  return F64[0];
}
function nextDown(x) {
  if (Number.isNaN(x)) return x;
  if (x === -Infinity) return x;
  if (x === 0) return -5e-324;
  F64[0] = x;
  U64[0] += (x > 0 ? -1n : 1n);
  return F64[0];
}

// Fast sound outward rounding.  Every IEEE 754 basic operation is correctly
// rounded, so the true result of one operation differs from the computed
// double v by at most ulp(v)/2 <= |v| * 2^-53.  Widening by |v| * 2.3e-16 is
// more than twice that, and the widening step's own rounding cannot eat the
// margin.  This avoids nextUp/nextDown, whose BigInt bit twiddling is far too
// slow for the tens of millions of boxes the sweep visits.
// The relative term alone is NOT universally outward: below the smallest normal
// double, |v| * EPSD underflows to zero and the widening vanishes.  Concretely
// iMul([5e-324, 5e-324], [0.5, 0.5]) returned [0, 0] while the exact product is
// 2.5e-324, excluding the truth.  The absolute floor below fixes that for every
// magnitude at once: DENORM_GUARD is far above the whole subnormal range and
// utterly negligible against any quantity this file computes, the smallest of
// which (the accumulation slack) is 1e-12.
// PRECONDITION.  rd/ru are outward for every finite double, subnormals
// included, but not across overflow: if an operation returns +/-Infinity the
// widening produces NaN.  Nothing here can overflow -- every quantity is a
// weight in [0,1], a derivative bounded by a small constant, or a sum of at
// most thirty-five such terms over a box whose coordinates are bounded by the
// tail lemma at about 28 -- and the test file asserts that bound empirically
// rather than leaving it as an assumption.
const EPSD = 2.3e-16;
const DENORM_GUARD = 1e-320;
const rd = v => v - (Math.abs(v) * EPSD + DENORM_GUARD);
const ru = v => v + (Math.abs(v) * EPSD + DENORM_GUARD);

// Outward-rounded interval arithmetic.  An interval is a plain [lo, hi] pair.
const iAdd = (x, y) => [rd(x[0] + y[0]), ru(x[1] + y[1])];
const iSub = (x, y) => [rd(x[0] - y[1]), ru(x[1] - y[0])];
function iMul(x, y) {
  const a = x[0] * y[0], b = x[0] * y[1], c = x[1] * y[0], d = x[1] * y[1];
  return [rd(Math.min(a, b, c, d)), ru(Math.max(a, b, c, d))];
}
function iDiv(x, y) {
  if (y[0] <= 0 && y[1] >= 0) return [-Infinity, Infinity];
  const a = x[0] / y[0], b = x[0] / y[1], c = x[1] / y[0], d = x[1] / y[1];
  return [rd(Math.min(a, b, c, d)), ru(Math.max(a, b, c, d))];
}
const iScale = (x, k) => (k >= 0
  ? [rd(x[0] * k), ru(x[1] * k)]
  : [rd(x[1] * k), ru(x[0] * k)]);
const iNeg = x => [-x[1], -x[0]];
const iWiden = (x, e) => [rd(x[0] - e), ru(x[1] + e)];
const iHull = (x, y) => [Math.min(x[0], y[0]), Math.max(x[1], y[1])];
function iSquare(x) {
  if (x[0] >= 0) return [rd(x[0] * x[0]), ru(x[1] * x[1])];
  if (x[1] <= 0) return [rd(x[1] * x[1]), ru(x[0] * x[0])];
  return [0, ru(Math.max(x[0] * x[0], x[1] * x[1]))];
}

// ---------------------------------------------------------------- constants
// pi/2 split so that each piece has at most 33 significant bits; the sum of
// the four is pi/2 to better than 1e-40.
const PIO2_1 = 1.57079632673412561417e+00;
const PIO2_2 = 6.07710050650619224932e-11;
const PIO2_3 = 2.02226624879595063154e-21;
const PIO2_4 = 8.47842766036889956997e-32;
const PI_LO = 3.141592653589793, PI_HI = 3.1415926535897936;
const SQRT2_LO = 1.4142135623730949, SQRT2_HI = 1.4142135623730952;
const I_PI = [PI_LO, PI_HI];
const I_TWO_PI = [nextDown(2 * PI_LO), nextUp(2 * PI_HI)];
const I_PI_HALF = [nextDown(PI_LO / 2), nextUp(PI_HI / 2)];
const I_SQRT2 = [1.4142135623730949, 1.4142135623730952];
const TWO_OVER_PI = 0.6366197723675814;

// Bound on the total error of sinPoint/cosPoint.
//
// Derivation.  Argument reduction: x - k*PIO2_1 is exact by Sterbenz (PIO2_1
// carries 33 significant bits and |k| <= 2^12, so the product is exact, and the
// operands lie within a factor of two), followed by three correctly rounded
// subtractions of small quantities from a value below pi/4, each losing at most
// half an ulp of ~0.8, so under 2e-16; the four-term split represents pi/2 to
// better than 1e-31, contributing under 1e-28 at |k| <= 2^12.  Series
// truncation is below the first omitted term, under 1e-21 on |r| <= pi/4.  The
// Horner evaluation runs ten steps on a running value bounded by one, so at
// most ten half-ulps, under 1.2e-15.  Total under about 1.5e-15.
//
// Measurement.  Against 6174 high-precision oracle rows biased towards the
// delicate cases -- multiples of pi/2 and tiny offsets from them, the pi/4
// branch boundary, the composed kernel arguments, and magnitudes out to 400 --
// the worst true error of the midpoint is 9.99e-16, consistent with the
// derivation.  (For comparison the engine's own Math.sin reaches 1.11e-16 on
// the same rows; this implementation is less accurate and is used anyway
// because its error is bounded by an argument rather than by a vendor's
// reputation.)
//
// The declared bound is 8e-15: eight times the worst observed and five times
// the derived bound.  It is negligible downstream -- the accumulation slack
// alone is 1e-12 and the sweep margins are ~1e-6 -- so there is no reason to
// run it tight.  The test asserts both containment against the oracle and that
// the observed worst stays under a quarter of this, so an accuracy regression
// fails rather than silently eating the headroom.
const TRIG_ERROR = 8e-15;
const MAX_TRIG_ARGUMENT = 4096;

function reduce(x) {
  const k = Math.round(x * TWO_OVER_PI);
  let r = x - k * PIO2_1;      // exact: operands within a factor of two
  r = r - k * PIO2_2;
  r = r - k * PIO2_3;
  r = r - k * PIO2_4;
  return {k: ((k % 4) + 4) % 4, r};
}
// Taylor series in z = r^2.  The series alternate with decreasing terms on
// |r| <= pi/4, so the truncation error is below the first omitted term:
// (pi/4)^21/21! < 1e-22 for sine, (pi/4)^20/20! < 1e-21 for cosine.
const SIN_COEFF = [1, -1 / 6, 1 / 120, -1 / 5040, 1 / 362880, -1 / 39916800,
  1 / 6227020800, -1 / 1307674368000, 1 / 355687428096000, -1 / 121645100408832000];
const COS_COEFF = [1, -1 / 2, 1 / 24, -1 / 720, 1 / 40320, -1 / 3628800,
  1 / 479001600, -1 / 87178291200, 1 / 20922789888000, -1 / 6402373705728000];
function horner(z, coefficients) {
  let acc = coefficients[coefficients.length - 1];
  for (let i = coefficients.length - 2; i >= 0; i--) acc = acc * z + coefficients[i];
  return acc;
}
function sinPoly(r) { return r * horner(r * r, SIN_COEFF); }
function cosPoly(r) { return horner(r * r, COS_COEFF); }

function sinPoint(x) {         // interval enclosing sin(x) for a double x
  if (!(Math.abs(x) <= MAX_TRIG_ARGUMENT)) throw new Error('argument too large for reduction');
  const {k, r} = reduce(x);
  let v;
  if (k === 0) v = sinPoly(r);
  else if (k === 1) v = cosPoly(r);
  else if (k === 2) v = -sinPoly(r);
  else v = -cosPoly(r);
  return [Math.max(-1, v - TRIG_ERROR), Math.min(1, v + TRIG_ERROR)];
}
function cosPoint(x) {
  if (!(Math.abs(x) <= MAX_TRIG_ARGUMENT)) throw new Error('argument too large for reduction');
  const {k, r} = reduce(x);
  let v;
  if (k === 0) v = cosPoly(r);
  else if (k === 1) v = -sinPoly(r);
  else if (k === 2) v = -cosPoly(r);
  else v = sinPoly(r);
  return [Math.max(-1, v - TRIG_ERROR), Math.min(1, v + TRIG_ERROR)];
}

// Range of sin over [a, b].  An extremum is included whenever it cannot be
// ruled out, so the enclosure is never too narrow.
function sinRange(a, b) {
  if (b - a >= 2 * PI_LO) return [-1, 1];
  const ea = sinPoint(a), eb = sinPoint(b);
  let lo = Math.min(ea[0], eb[0]);
  let hi = Math.max(ea[1], eb[1]);
  // maxima at pi/2 + 2k pi, minima at -pi/2 + 2k pi
  const nMax = Math.floor((a - PI_HI / 2) / (2 * PI_LO)) - 1;
  for (let k = nMax; k <= nMax + 3; k++) {
    const p = [nextDown(PI_LO / 2 + 2 * k * (k >= 0 ? PI_LO : PI_HI)),
               nextUp(PI_HI / 2 + 2 * k * (k >= 0 ? PI_HI : PI_LO))];
    if (p[1] >= a && p[0] <= b) hi = 1;
    const q = [nextDown(-PI_HI / 2 + 2 * k * (k >= 0 ? PI_LO : PI_HI)),
               nextUp(-PI_LO / 2 + 2 * k * (k >= 0 ? PI_HI : PI_LO))];
    if (q[1] >= a && q[0] <= b) lo = -1;
  }
  return [Math.max(-1, lo), Math.min(1, hi)];
}
function cosRange(a, b) {
  return sinRange(nextDown(a + PI_LO / 2), nextUp(b + PI_HI / 2));
}

module.exports = {
  nextUp, nextDown, rd, ru, iAdd, iSub, iMul, iDiv, iScale, iNeg, iWiden, iHull, iSquare,
  I_PI, I_TWO_PI, I_PI_HALF, I_SQRT2, TRIG_ERROR,
  sinPoint, cosPoint, sinRange, cosRange
};

// ------------------------------------------------------------------- sinc
// sinc(z) = sin(z)/z, even, and strictly decreasing on [0, pi].  Near zero the
// quotient loses all its digits, so the series is used there instead; its
// truncation error is below (1/2)^18/19! < 1e-22 on |z| <= 1/2.
const SINC_COEFF = [1, -1 / 6, 1 / 120, -1 / 5040, 1 / 362880, -1 / 39916800,
  1 / 6227020800, -1 / 1307674368000, 1 / 355687428096000];
// sinc'(z) = sum_{n>=1} (-1)^n 2n z^(2n-1) / (2n+1)!, odd.
const SINCD_COEFF = [-1 / 3, 1 / 30, -1 / 840, 1 / 45360, -1 / 3991680,
  1 / 518918400, -1 / 93405312000, 1 / 22230464256000];
const SERIES_LIMIT = 0.5;
const SERIES_ERROR = 1e-20;

function sincPoint(t) {                 // interval enclosing sinc(t)
  const a = Math.abs(t);
  if (a <= SERIES_LIMIT) {
    return iWiden([horner(a * a, SINC_COEFF), horner(a * a, SINC_COEFF)],
      Math.abs(horner(a * a, SINC_COEFF)) * 1e-15 + SERIES_ERROR);
  }
  return iDiv(sinPoint(a), [a, a]);
}

// Range of sinc over [lo, hi], using evenness to work on |z|.
function sincRange(lo, hi) {
  const p = (lo <= 0 && hi >= 0) ? 0 : Math.min(Math.abs(lo), Math.abs(hi));
  const q = Math.max(Math.abs(lo), Math.abs(hi));
  return sincRangeNonneg(p, q);
}
function sincRangeNonneg(p, q) {
  if (q <= PI_LO) {                     // monotone decreasing on [0, pi]
    return [sincPoint(q)[0], sincPoint(p)[1]];
  }
  if (p < PI_LO) {
    return iHull(sincRangeNonneg(p, PI_LO), sincRangeNonneg(PI_LO, q));
  }
  return iDiv(sinRange(p, q), [p, q]);
}

function sincDerivRange(lo, hi) {
  if (lo >= -SERIES_LIMIT && hi <= SERIES_LIMIT) {
    const z = [lo, hi];
    const z2 = iSquare(z);
    let acc = [SINCD_COEFF[SINCD_COEFF.length - 1], SINCD_COEFF[SINCD_COEFF.length - 1]];
    for (let i = SINCD_COEFF.length - 2; i >= 0; i--) {
      acc = iAdd(iMul(acc, z2), [SINCD_COEFF[i], SINCD_COEFF[i]]);
    }
    return iWiden(iMul(acc, z), SERIES_ERROR);
  }
  if (lo < -SERIES_LIMIT && hi > -SERIES_LIMIT) {
    return iHull(sincDerivRange(lo, -SERIES_LIMIT), sincDerivRange(-SERIES_LIMIT, hi));
  }
  if (lo < SERIES_LIMIT && hi > SERIES_LIMIT) {
    return iHull(sincDerivRange(lo, SERIES_LIMIT), sincDerivRange(SERIES_LIMIT, hi));
  }
  // |z| >= 1/2 throughout: (z cos z - sin z) / z^2
  const z = [lo, hi];
  return iDiv(iSub(iMul(z, cosRange(lo, hi)), sinRange(lo, hi)), iSquare(z));
}

// ----------------------------------------------------------------- kernel
// K(x) = (sinc((sqrt2 - 2 pi x)/2) + sinc((sqrt2 + 2 pi x)/2)) / 2
function kernelArguments(a, b) {
  const x = [a, b];
  const twoPiX = iMul(I_TWO_PI, x);
  return {
    left: iScale(iSub(I_SQRT2, twoPiX), 0.5),
    right: iScale(iAdd(I_SQRT2, twoPiX), 0.5)
  };
}
function kernelRange(a, b) {
  const z = kernelArguments(a, b);
  return iScale(iAdd(sincRange(z.left[0], z.left[1]), sincRange(z.right[0], z.right[1])), 0.5);
}
function kernelDerivRange(a, b) {
  const z = kernelArguments(a, b);
  const left = sincDerivRange(z.left[0], z.left[1]);
  const right = sincDerivRange(z.right[0], z.right[1]);
  return iMul(iScale(I_PI, 0.5), iSub(right, left));
}

const K0 = sincPoint(SQRT2_HI / 2)[0] < sincPoint(SQRT2_LO / 2)[0]
  ? [sincPoint(SQRT2_HI / 2)[0], sincPoint(SQRT2_LO / 2)[1]]
  : [sincPoint(SQRT2_LO / 2)[0], sincPoint(SQRT2_HI / 2)[1]];
const K0_SQUARED = iSquare(K0);

// w = (K/K0)^2 and w' = 2 K K' / K0^2, as ranges over [a, b].
function weightRange(a, b) {
  return iDiv(iSquare(kernelRange(a, b)), K0_SQUARED);
}
function weightDerivRange(a, b) {
  return iDiv(iScale(iMul(kernelRange(a, b), kernelDerivRange(a, b)), 2), K0_SQUARED);
}

module.exports.sincPoint = sincPoint;
module.exports.sincRange = sincRange;
module.exports.sincDerivRange = sincDerivRange;
module.exports.kernelRange = kernelRange;
module.exports.kernelDerivRange = kernelDerivRange;
module.exports.weightRange = weightRange;
module.exports.weightDerivRange = weightDerivRange;
module.exports.K0 = K0;

// --------------------------------------------------------- centered forms
// The natural interval extension is first order: its slack grows like the
// interval width even where the weight is flat, which makes it about thirty
// times looser than the exact monotone-piece range the fast sweep uses.  The
// centered (mean value) form is second order,
//     f([a,b])  subset  f(m) + f'([a,b]) * [-rho, rho],
// so its slack is the width times the *variation* of f', which does vanish
// where f is flat.  The second derivative only enters that second-order term,
// so a natural extension is accurate enough for it.
//
// sinc''(z) = -sin(z)/z - 2 cos(z)/z^2 + 2 sin(z)/z^3,
// series -1/3 + z^2/10 - z^4/168 + ...
const SINCDD_COEFF = [-1 / 3, 1 / 10, -1 / 168, 1 / 6480, -1 / 443520,
  1 / 46702080, -1 / 6974263296, 1 / 1394852659200];

function sincSecondRange(lo, hi) {
  if (lo >= -SERIES_LIMIT && hi <= SERIES_LIMIT) {
    const z2 = iSquare([lo, hi]);
    let acc = [SINCDD_COEFF[SINCDD_COEFF.length - 1], SINCDD_COEFF[SINCDD_COEFF.length - 1]];
    for (let i = SINCDD_COEFF.length - 2; i >= 0; i--) {
      acc = iAdd(iMul(acc, z2), [SINCDD_COEFF[i], SINCDD_COEFF[i]]);
    }
    return iWiden(acc, SERIES_ERROR);
  }
  if (lo < -SERIES_LIMIT && hi > -SERIES_LIMIT) {
    return iHull(sincSecondRange(lo, -SERIES_LIMIT), sincSecondRange(-SERIES_LIMIT, hi));
  }
  if (lo < SERIES_LIMIT && hi > SERIES_LIMIT) {
    return iHull(sincSecondRange(lo, SERIES_LIMIT), sincSecondRange(SERIES_LIMIT, hi));
  }
  const z = [lo, hi];
  const s = sinRange(lo, hi), c = cosRange(lo, hi);
  const z2 = iSquare(z);
  const z3 = iMul(z2, z);
  return iAdd(iAdd(iNeg(iDiv(s, z)), iScale(iDiv(c, z2), -2)), iScale(iDiv(s, z3), 2));
}

function kernelSecondRange(a, b) {
  const z = kernelArguments(a, b);
  const piSquared = iMul(I_PI, I_PI);
  return iScale(iMul(piSquared,
    iAdd(sincSecondRange(z.left[0], z.left[1]), sincSecondRange(z.right[0], z.right[1]))), 0.5);
}

// w'' = 2 (K'^2 + K K'') / K0^2
function weightSecondRange(a, b) {
  const k = kernelRange(a, b);
  const kp = kernelDerivRange(a, b);
  const kpp = kernelSecondRange(a, b);
  return iDiv(iScale(iAdd(iSquare(kp), iMul(k, kpp)), 2), K0_SQUARED);
}

const iIntersect = (x, y) => [Math.max(x[0], y[0]), Math.min(x[1], y[1])];

// Both centered enclosures from one pass.  Computing them separately evaluates
// the kernel family nine times per pair; this evaluates it five times, and the
// sweep asks for both on every pair of every box.
function weightPairCentered(a, b) {
  const kab = kernelRange(a, b);
  const kpab = kernelDerivRange(a, b);
  const wNatural = iDiv(iSquare(kab), K0_SQUARED);
  const dwNatural = iDiv(iScale(iMul(kab, kpab), 2), K0_SQUARED);
  if (b <= a) return {w: [Math.max(0, wNatural[0]), wNatural[1]], dw: dwNatural};

  const m = 0.5 * (a + b);
  const rho = ru(Math.max(m - a, b - m));
  const span = [-rho, rho];

  const km = kernelRange(m, m);
  const kpm = kernelDerivRange(m, m);
  const wm = iDiv(iSquare(km), K0_SQUARED);
  const dwm = iDiv(iScale(iMul(km, kpm), 2), K0_SQUARED);

  const kppab = kernelSecondRange(a, b);
  const ddw = iDiv(iScale(iAdd(iSquare(kpab), iMul(kab, kppab)), 2), K0_SQUARED);

  const halfSq = ru(0.5 * rho * rho);

  const dw = iIntersect(iAdd(dwm, iMul(ddw, span)), dwNatural);

  // Second-order Taylor with remainder beats the first-order centered form for
  // the value: w(x) = w(m) + w'(m)(x-m) + w''(xi)(x-m)^2/2, so
  //     w([a,b]) subset w(m) + w'(m)*[-rho,rho] + w''([a,b])*[0, rho^2/2].
  // The centered form's second-order term is 2*rho^2*|w''|; this one is
  // rho^2*|w''|.  Measured effect on the sweep: 0.1% fewer boxes, not the
  // factor of eight a sixth-power argument would predict.  Kept only because
  // every quantity it needs is already computed, so it costs nothing.
  //
  // The obvious next step -- the same treatment for the derivative, with a
  // third-derivative remainder -- was implemented, validated against finite
  // differences, measured, and removed: 0.4% fewer boxes for 1.7x the wall
  // clock, since it needs two more kernel evaluations per pair per box.  So
  // the rigorous sweep's ~1.8x box overhead over the exact-range version is
  // not a question of local expansion order, and raising the order further is
  // the wrong place to look.
  const halfSquare = halfSq;
  const taylor = iAdd(iAdd(wm, iMul(dwm, span)), iMul(ddw, [0, halfSquare]));
  const centered = iAdd(wm, iMul(dw, span));
  const w = iIntersect(iIntersect(taylor, centered), wNatural);
  return {w: [Math.max(0, w[0]), w[1]], dw};
}
module.exports.sincSecondRange = sincSecondRange;
module.exports.kernelSecondRange = kernelSecondRange;
module.exports.weightSecondRange = weightSecondRange;
module.exports.weightPairCentered = weightPairCentered;

