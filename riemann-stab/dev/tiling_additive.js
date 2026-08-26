'use strict';

// Additive reversal-antisymmetric coboundary certificates for the
// overlapping seven-point functional.
//
// A state potential Phi on five consecutive gaps is *additive* when
// Phi(s) = sum_k psi_k(s_k).  The reversal lemma (Lean:
// reversal_coboundary_symmetrization) says one may assume Phi is
// reversal-antisymmetric without losing any attainable floor, and
// antisymmetrization preserves additivity.  Writing out the telescoping edge
// difference for such a Phi gives the exact normal form
//
//   R(g) = F6(g) + a(g0) + a(g5) + b(g1) + b(g4) - (a+b)(g2) - (a+b)(g3)
//
// with a, b arbitrary.  Every additive antisymmetric coboundary has this
// shape and every choice of (a, b) is one, so searching (a, b) searches the
// whole family.  Two consequences are used below as self-checks:
//
//   * R is reversal invariant by construction, so quotienting the adversarial
//     search by reflection is legal here.  (It was NOT legal for the earlier
//     oriented Walsh family; that mistake is the pinned autopsy.)
//   * On the two alternating blocks LHLHLH and HLHLHL every feature cancels,
//     so R equals F6 there for any (a, b).  The mean shifted-block energy of
//     the alternating chain is therefore a hard ceiling on this family.
//
// Nothing here is a proof.  The coefficients are floating-point search output
// and the audit is a floating-point global search.  Turning a certificate
// into a theorem still requires an interval-arithmetic sweep of the same
// inequality over all six nonnegative gaps.

const T = require('./tiling_research');

const SIGN_A = [1, 0, -1, -1, 0, 1];
const SIGN_B = [0, 1, -1, -1, 1, 0];

// Hard ceiling: the alternating two-cycle's mean shifted-block energy.
const ALTERNATING_CEILING = 0.003957393309209766;

function segmentIndex(knots, x) {
  const clamped = Math.max(knots[0], Math.min(knots[knots.length - 1], x));
  let lo = 0;
  let hi = knots.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (knots[mid] <= clamped) lo = mid; else hi = mid;
  }
  return {index: lo, clamped};
}

function piecewiseLinear(knots, values, x) {
  const {index, clamped} = segmentIndex(knots, x);
  const t0 = knots[index];
  const t1 = knots[index + 1];
  const frac = (clamped - t0) / (t1 - t0);
  return values[index] * (1 - frac) + values[index + 1] * frac;
}

function piecewiseSlope(knots, values, x) {
  // Constant extension outside the knot range: the slope vanishes there.
  if (x <= knots[0] || x >= knots[knots.length - 1]) return 0;
  const {index} = segmentIndex(knots, x);
  return (values[index + 1] - values[index]) / (knots[index + 1] - knots[index]);
}


// ------------------------------------------------------------------ gauge
// Adding a constant to `a` (or to `b`) leaves R unchanged: each function
// enters with signs (+1, +1, -1, -1) across the six gap slots.  Centering
// both functions is therefore free and shrinks every amplitude bound below.
function gaugeNormalize(certificate) {
  const center = values => {
    const shift = (Math.max(...values) + Math.min(...values)) / 2;
    return values.map(v => v - shift);
  };
  return {
    knots: certificate.knots.slice(),
    a: center(certificate.a),
    b: center(certificate.b)
  };
}

// Sup-norm bound on the total potential contribution to R.  Each of a, b and
// a+b occupies exactly two of the six slots.
function certificateAmplitude(certificate) {
  const {a, b} = certificate;
  const maxA = Math.max(...a.map(Math.abs));
  const maxB = Math.max(...b.map(Math.abs));
  const maxSum = Math.max(...a.map((v, i) => Math.abs(v + b[i])));
  return {maxA, maxB, maxSum, bound: 2 * (maxA + maxB + maxSum)};
}

// Tail lemma.  F6(g) >= (sum g)/p with every pair term nonnegative, so
//     R(g) >= (sum g)/p - amplitude.
// Hence R(g) >= floor as soon as one gap reaches p*(floor + amplitude).  The
// certificate therefore only has to be checked on the cube [0, threshold]^6 —
// this is what makes a later interval sweep a finite task, and it is why the
// gauge normalization above is worth applying before anything else.
function tailThreshold(certificate, floor, p = 3000) {
  return p * (floor + certificateAmplitude(certificate).bound);
}

function additiveReducedCost(gaps, certificate, p = 3000) {
  const {knots, a, b} = certificate;
  let value = T.blockFunctional(gaps, p);
  for (let i = 0; i < 6; i++) {
    if (SIGN_A[i]) value += SIGN_A[i] * piecewiseLinear(knots, a, gaps[i]);
    if (SIGN_B[i]) value += SIGN_B[i] * piecewiseLinear(knots, b, gaps[i]);
  }
  return value;
}

function additiveReducedCostAndGradient(gaps, certificate, p = 3000) {
  const {knots, a, b} = certificate;
  const base = T.blockFunctionalAndGradient(gaps, p);
  let value = base.value;
  const gradient = base.gradient.slice();
  for (let i = 0; i < 6; i++) {
    if (SIGN_A[i]) {
      value += SIGN_A[i] * piecewiseLinear(knots, a, gaps[i]);
      gradient[i] += SIGN_A[i] * piecewiseSlope(knots, a, gaps[i]);
    }
    if (SIGN_B[i]) {
      value += SIGN_B[i] * piecewiseLinear(knots, b, gaps[i]);
      gradient[i] += SIGN_B[i] * piecewiseSlope(knots, b, gaps[i]);
    }
  }
  return {value, gradient};
}

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// Deterministic Adam multistart over the six-gap cube.  Independent of the
// Python search that produced the coefficients, and independent of the
// pattern/DE searches already in the laboratory.
function gradientMultistart(certificate, options = {}) {
  const starts = options.starts || 3000;
  const steps = options.steps || 400;
  const maxGap = options.maxGap || 14;
  const random = lcg(options.seed || 0x9e3779b9);
  const bands = options.bands || [1.0417, 1.9795, 1.045, 1.986, 3.02, 0.6, 2.5, 4.06, 2.95, 0.35];
  let best = null;
  for (let s = 0; s < starts; s++) {
    const x = new Array(6);
    if (s % 2 === 0) {
      for (let i = 0; i < 6; i++) x[i] = 0.1 + 4.3 * random();
    } else {
      for (let i = 0; i < 6; i++) {
        x[i] = Math.max(0, bands[Math.floor(random() * bands.length)] + 0.12 * (random() - 0.5));
      }
    }
    const first = new Array(6).fill(0);
    const second = new Array(6).fill(0);
    for (let t = 1; t <= steps; t++) {
      const current = additiveReducedCostAndGradient(x, certificate);
      const rate = 0.06 * (0.1 + 0.9 * (1 - t / steps));
      for (let i = 0; i < 6; i++) {
        first[i] = 0.9 * first[i] + 0.1 * current.gradient[i];
        second[i] = 0.999 * second[i] + 0.001 * current.gradient[i] * current.gradient[i];
        const mHat = first[i] / (1 - Math.pow(0.9, t));
        const vHat = second[i] / (1 - Math.pow(0.999, t));
        x[i] = Math.max(0, Math.min(maxGap, x[i] - rate * mHat / (Math.sqrt(vHat) + 1e-12)));
      }
    }
    const polished = T.patternMinimize(
      gaps => additiveReducedCost(gaps, certificate), x, {step: 0.02, tolerance: 5e-9, maxGap});
    if (!best || polished.value < best.value) best = polished;
  }
  return best;
}

// Three independent adversaries.  The reported floor is the smallest value any
// of them reaches; a certificate is only as good as its worst adversary.
function auditAdditiveCertificate(certificate, options = {}) {
  const objective = gaps => additiveReducedCost(gaps, certificate);
  // Search the whole cube the tail lemma leaves open, not a convenient part
  // of it.  `floorGuess` only sizes the box; it never enters the verdict.
  const maxGap = options.maxGap
    || Math.ceil(tailThreshold(certificate, options.floorGuess || 0.00395));
  const results = {};
  results.bands = T.bandBasinSearch(objective, 6, {
    periodic: false,
    // Legal here: R is reversal invariant by construction (checked in tests).
    reflectionSymmetry: true,
    bandSeeds: options.bandSeeds || [1.05, 2.05, 3.2],
    maxGap,
    coarseTolerance: options.coarseTolerance || 5e-4,
    tolerance: options.tolerance || 5e-8
  });
  results.evolution = T.differentialEvolution(objective, 6, {
    seed: options.seed || 0xadd17f1e,
    generations: options.generations || 900,
    populationSize: options.populationSize || 140,
    maxGap,
    tolerance: options.tolerance || 5e-8
  });
  results.gradient = gradientMultistart(certificate, {
    starts: options.starts || 1200,
    steps: options.steps || 400,
    seed: (options.seed || 0xadd17f1e) ^ 0x5bf03,
    maxGap
  });
  let value = Infinity;
  let gaps = null;
  let source = null;
  for (const key of Object.keys(results)) {
    if (results[key].value < value) {
      value = results[key].value;
      gaps = results[key].x;
      source = key;
    }
  }
  return {value, gaps, source, maxGap, results};
}

// Structural identity: the two alternating blocks see no potential at all.
function alternatingBlocks(low = 1.041680, high = 1.979467) {
  return [
    [low, high, low, high, low, high],
    [high, low, high, low, high, low]
  ];
}

module.exports = {
  SIGN_A,
  SIGN_B,
  ALTERNATING_CEILING,
  gaugeNormalize,
  certificateAmplitude,
  tailThreshold,
  piecewiseLinear,
  piecewiseSlope,
  additiveReducedCost,
  additiveReducedCostAndGradient,
  gradientMultistart,
  auditAdditiveCertificate,
  alternatingBlocks
};
