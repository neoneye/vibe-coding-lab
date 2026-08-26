'use strict';

// Rigorous local coercivity at the alternating two-cycle.
//
// Everything else in this directory bounds the chain energy from below by
// subdividing a six-dimensional cube.  This file does something different and
// much cheaper: it certifies that the alternating configuration is a strict
// local minimum, with an explicit spectral gap, by a ONE-dimensional
// certification in the Bloch momentum.
//
// The Hessian of the per-gap chain energy at a two-periodic configuration is a
// finite sum -- the lag truncation at six that obstructs every Fourier argument
// for the energy itself is harmless for the Hessian, because
//
//   Hhat_{ab} = 2 sum_{s=|a-b|+1}^{6} sum_{i=max(a,b)-s+1}^{min(a,b)} w''(D_{i,s})
//
// vanishes for |a-b| >= 6.  A two-site Bloch decomposition turns that into a
// 2x2 Hermitian symbol M(q), and certifying its smaller eigenvalue positive for
// every q in [0, pi] is a one-variable interval problem.
//
// What this establishes, and what it does not.  It gives the c * dist^2 half of
// a coercivity statement, locally: near the alternating state the energy grows
// quadratically at a certified rate.  It says nothing about configurations far
// from it, nothing about the wall energy between the two alternating phases,
// and nothing about the global floor.  It is a local theorem, and the global
// one is not a corollary of it.

const R = require('./tiling_rigorous');

const LAGS = 6;

// D_{i,s} at a two-periodic state, as an interval, given L and H as intervals.
function lagDistance(s, parity, L, H) {
  const P = R.iAdd(L, H);
  if (s % 2 === 0) return R.iScale(P, s / 2);
  const whole = R.iScale(P, (s - 1) / 2);
  return R.iAdd(whole, parity === 0 ? L : H);
}

// Hhat_{ab} as an interval.
function hessianEntry(a, b, L, H) {
  let acc = [0, 0];
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (let s = Math.abs(a - b) + 1; s <= LAGS; s++) {
    for (let i = hi - s + 1; i <= lo; i++) {
      const parity = ((i % 2) + 2) % 2;
      const d = lagDistance(s, parity, L, H);
      acc = R.iAdd(acc, R.weightSecondRange(d[0], d[1]));
    }
  }
  return R.iScale(acc, 2);
}

// Bloch symbol over a momentum interval [qLo, qHi].  Entries are intervals;
// the sum over cells is finite because the Hessian has range five.
function blochSymbol(qLo, qHi, L, H) {
  const zero = () => ({re: [0, 0], im: [0, 0]});
  const M = [[zero(), zero()], [zero(), zero()]];
  for (let alpha = 0; alpha < 2; alpha++) {
    for (let beta = 0; beta < 2; beta++) {
      for (let cell = -4; cell <= 4; cell++) {
        const entry = hessianEntry(alpha, 2 * cell + beta, L, H);
        if (entry[0] === 0 && entry[1] === 0) continue;
        const cosine = cell === 0 ? [1, 1] : R.cosRange(qLo * cell, qHi * cell);
        const sine = cell === 0 ? [0, 0] : R.sinRange(qLo * cell, qHi * cell);
        // cos over [qLo*cell, qHi*cell] needs the endpoints ordered
        const c = cell < 0 ? R.cosRange(qHi * cell, qLo * cell) : cosine;
        const s = cell < 0 ? R.sinRange(qHi * cell, qLo * cell) : sine;
        M[alpha][beta].re = R.iAdd(M[alpha][beta].re, R.iMul(entry, c));
        M[alpha][beta].im = R.iSub(M[alpha][beta].im, R.iMul(entry, s));
      }
    }
  }
  return M;
}

// Rigorous lower bound on the smaller eigenvalue of the Hermitian symbol.
function smallestEigenvalueLower(M) {
  const a = M[0][0].re, d = M[1][1].re;
  const sum = R.iAdd(a, d);
  const diff = R.iSub(a, d);
  const diffSquaredUpper = Math.max(diff[0] * diff[0], diff[1] * diff[1]);
  const offRe = Math.max(Math.abs(M[0][1].re[0]), Math.abs(M[0][1].re[1]));
  const offIm = Math.max(Math.abs(M[0][1].im[0]), Math.abs(M[0][1].im[1]));
  const offSquaredUpper = offRe * offRe + offIm * offIm;
  const discriminant = Math.sqrt(diffSquaredUpper + 4 * offSquaredUpper) * (1 + 4e-16);
  return (sum[0] - discriminant) / 2 - 1e-12;      // accumulation slack
}

// Certify min over q in [0, pi] of the smaller eigenvalue, for every (L, H) in
// the given boxes.  Adaptive bisection in q; returns the certified gap or the
// interval where it failed.
function certifyGap(L, H, options = {}) {
  const target = options.target === undefined ? 1.5 : options.target;
  const minWidth = options.minWidth || 1e-9;
  const budget = options.budget || 2e5;
  const stack = [[0, Math.PI * (1 + 4e-16)]];
  let processed = 0, worst = Infinity, worstAt = null, failure = null;
  while (stack.length) {
    if (processed >= budget) break;
    const [qLo, qHi] = stack.pop();
    processed++;
    const lower = smallestEigenvalueLower(blochSymbol(qLo, qHi, L, H));
    if (lower >= target) continue;
    if (lower < worst) { worst = lower; worstAt = [qLo, qHi]; }
    if (qHi - qLo <= minWidth) { failure = {qLo, qHi, lower}; break; }
    const mid = (qLo + qHi) / 2;
    stack.push([qLo, mid]);
    stack.push([mid, qHi]);
  }
  return {
    target, processed, complete: stack.length === 0 && !failure && processed < budget,
    failure, worst, worstAt
  };
}

module.exports = {hessianEntry, blochSymbol, smallestEigenvalueLower, certifyGap, lagDistance};

// ------------------------------------------------- the critical point itself
// Certifying the spectrum over a box says the energy is convex there.  It does
// not say the alternating critical point is IN the box -- for that the gradient
// has to be shown to vanish somewhere inside, which is a Krawczyk test on the
// two-variable system
//
//   dE/dL = dE/dH = 0,   E(L,H) = alpha (L+H)/2 + sum_{s<=6} [w(D_s^0)+w(D_s^1)].
//
// Together the two give what a local minimum means: a critical point exists and
// is unique in the box, and every point of the box has Hessian at least the
// certified gap, so that critical point is a strict local minimum with
// quadratic growth at half that rate.
const ALPHA = 6 / 3000;

function gradientInterval(L, H) {
  const P = R.iAdd(L, H);
  let dL = [ALPHA / 2, ALPHA / 2], dH = [ALPHA / 2, ALPHA / 2];
  for (let s = 1; s <= LAGS; s++) {
    if (s % 2 === 0) {
      const d = R.iScale(P, s / 2);
      const term = R.iScale(R.weightDerivRange(d[0], d[1]), 2 * (s / 2));
      dL = R.iAdd(dL, term);
      dH = R.iAdd(dH, term);
    } else {
      const whole = R.iScale(P, (s - 1) / 2);
      const withL = R.iAdd(whole, L), withH = R.iAdd(whole, H);
      const wL = R.weightDerivRange(withL[0], withL[1]);
      const wH = R.weightDerivRange(withH[0], withH[1]);
      dL = R.iAdd(dL, R.iAdd(R.iScale(wL, (s + 1) / 2), R.iScale(wH, (s - 1) / 2)));
      dH = R.iAdd(dH, R.iAdd(R.iScale(wH, (s + 1) / 2), R.iScale(wL, (s - 1) / 2)));
    }
  }
  return [dL, dH];
}

function jacobianInterval(L, H) {
  const P = R.iAdd(L, H);
  let LL = [0, 0], LH = [0, 0], HH = [0, 0];
  for (let s = 1; s <= LAGS; s++) {
    if (s % 2 === 0) {
      const d = R.iScale(P, s / 2);
      const term = R.iScale(R.weightSecondRange(d[0], d[1]), 2 * (s / 2) * (s / 2));
      LL = R.iAdd(LL, term); LH = R.iAdd(LH, term); HH = R.iAdd(HH, term);
    } else {
      const whole = R.iScale(P, (s - 1) / 2);
      const withL = R.iAdd(whole, L), withH = R.iAdd(whole, H);
      const wL = R.weightSecondRange(withL[0], withL[1]);
      const wH = R.weightSecondRange(withH[0], withH[1]);
      const big = (s + 1) / 2, small = (s - 1) / 2;
      LL = R.iAdd(LL, R.iAdd(R.iScale(wL, big * big), R.iScale(wH, small * small)));
      HH = R.iAdd(HH, R.iAdd(R.iScale(wH, big * big), R.iScale(wL, small * small)));
      LH = R.iAdd(LH, R.iScale(R.iAdd(wL, wH), big * small));
    }
  }
  return [[LL, LH], [LH, HH]];
}

// Krawczyk: with m the box centre and C an approximate inverse Jacobian,
//   K(X) = m - C F(m) + (I - C J(X)) (X - m).
// K(X) strictly inside X proves a unique zero of F in X.
function krawczyk(L, H) {
  const mL = (L[0] + L[1]) / 2, mH = (H[0] + H[1]) / 2;
  const Fm = gradientInterval([mL, mL], [mH, mH]);
  const Jm = jacobianInterval([mL, mL], [mH, mH]);
  const a = (Jm[0][0][0] + Jm[0][0][1]) / 2, b = (Jm[0][1][0] + Jm[0][1][1]) / 2;
  const d = (Jm[1][1][0] + Jm[1][1][1]) / 2;
  const det = a * d - b * b;
  if (Math.abs(det) < 1e-12) return {proved: false, reason: 'singular Jacobian'};
  const C = [[d / det, -b / det], [-b / det, a / det]];
  const J = jacobianInterval(L, H);
  // I - C J, as intervals
  const E = [[null, null], [null, null]];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      let acc = [i === j ? 1 : 0, i === j ? 1 : 0];
      for (let k = 0; k < 2; k++) acc = R.iSub(acc, R.iScale(J[k][j], C[i][k]));
      E[i][j] = acc;
    }
  }
  const rL = R.iSub(L, [mL, mL]), rH = R.iSub(H, [mH, mH]);
  const CF = [C[0][0] * ((Fm[0][0] + Fm[0][1]) / 2) + C[0][1] * ((Fm[1][0] + Fm[1][1]) / 2),
              C[1][0] * ((Fm[0][0] + Fm[0][1]) / 2) + C[1][1] * ((Fm[1][0] + Fm[1][1]) / 2)];
  const KL = R.iAdd(R.iAdd([mL - CF[0], mL - CF[0]], R.iMul(E[0][0], rL)), R.iMul(E[0][1], rH));
  const KH = R.iAdd(R.iAdd([mH - CF[1], mH - CF[1]], R.iMul(E[1][0], rL)), R.iMul(E[1][1], rH));
  const inside = KL[0] > L[0] && KL[1] < L[1] && KH[0] > H[0] && KH[1] < H[1];
  return {proved: inside, K: [KL, KH], box: [L, H]};
}
module.exports.gradientInterval = gradientInterval;
module.exports.jacobianInterval = jacobianInterval;
module.exports.krawczyk = krawczyk;

// Iterating Krawczyk tightens the enclosure: the image intersected with the box
// is itself a valid enclosure of the same unique zero.  Two steps take a
// halfwidth of 1e-6 down to the last bit of a double, after which the test can
// no longer prove containment in a box that narrow -- which is the resolution
// limit, not a failure.
function refineCriticalPoint(L, H, iterations) {
  let best = {L, H, proved: false};
  for (let step = 0; step < (iterations || 12); step++) {
    const attempt = krawczyk(L, H);
    if (!attempt.proved) break;
    best = {L, H, proved: true};
    const nextL = [Math.max(L[0], attempt.K[0][0]), Math.min(L[1], attempt.K[0][1])];
    const nextH = [Math.max(H[0], attempt.K[1][0]), Math.min(H[1], attempt.K[1][1])];
    const shrank = (nextL[1] - nextL[0]) < (L[1] - L[0]) || (nextH[1] - nextH[0]) < (H[1] - H[0]);
    L = nextL; H = nextH;
    best = {L, H, proved: true};
    if (!shrank) break;
  }
  return best;
}
module.exports.refineCriticalPoint = refineCriticalPoint;
