'use strict';

// The same machinery at an arbitrary block size.
//
// The laboratory inherited n = 7 from the manuscript, and the block-size scan
// in tiling_research.golden.json says the projection actually peaks at n = 8.
// Acting on that means redoing the certificate and the sweep with one more
// gap, so everything here is written for a general block, and validated by
// reproducing the n = 7 modules exactly.
//
// For a block of m gaps the reversal-antisymmetric additive coboundaries are
// the u with u_i = u_{m-1-i} and sum u_i = 0.  Writing h = floor(m/2):
//   m even -- u_0 .. u_{h-1} free apart from sum_{i<h} u_i = 0, so h-1 of them,
//   m odd  -- u_0 .. u_{h-1} free and the middle slot u_h = -2 sum_{i<h} u_i.
// At m = 6 that is the familiar pair (a, b) with the middle slots carrying
// -(a+b); at m = 7 it is (a, b, c) with the centre carrying -2(a+b+c).

const T = require('./tiling_research');

function signMatrix(m) {
  const half = Math.floor(m / 2);
  const rows = [];
  const free = (m % 2 === 0) ? half - 1 : half;
  for (let f = 0; f < free; f++) {
    const row = new Array(m).fill(0);
    row[f] = 1;
    row[m - 1 - f] = 1;
    if (m % 2 === 0) {
      // the dependent pair is (half-1, half); it carries minus the sum
      row[half - 1] -= 1;
      row[half] -= 1;
    } else {
      row[half] -= 2;
    }
    rows.push(row);
  }
  return rows;
}

function blockPairs(n) {
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) pairs.push({i, j, c: 2 / (n - (j - i))});
  }
  return pairs;
}

function interp(knots, values, x) {
  const last = knots.length - 1;
  const t = x < knots[0] ? knots[0] : (x > knots[last] ? knots[last] : x);
  let lo = 0, hi = last;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (knots[mid] <= t) lo = mid; else hi = mid; }
  const frac = (t - knots[lo]) / (knots[lo + 1] - knots[lo]);
  return values[lo] * (1 - frac) + values[lo + 1] * frac;
}

// certificate: {knots, functions: [f0, f1, ...]} with one function per free slot
function reducedCost(gaps, certificate, p = 3000) {
  const m = gaps.length;
  const signs = certificate.signs || signMatrix(m);
  let value = T.blockFunctional(gaps, p);
  for (let f = 0; f < signs.length; f++) {
    const row = signs[f];
    for (let k = 0; k < m; k++) {
      if (row[k]) value += row[k] * interp(certificate.knots, certificate.functions[f], gaps[k]);
    }
  }
  return value;
}

function amplitude(certificate, m) {
  const signs = certificate.signs || signMatrix(m);
  let total = 0;
  for (let k = 0; k < m; k++) {
    let slotMax = 0;
    // worst case for slot k: the largest absolute value the slot can take
    const knotCount = certificate.knots.length;
    for (let idx = 0; idx < knotCount; idx++) {
      let v = 0;
      for (let f = 0; f < signs.length; f++) v += signs[f][k] * certificate.functions[f][idx];
      slotMax = Math.max(slotMax, Math.abs(v));
    }
    total += slotMax;
  }
  return total;
}

function tailThreshold(certificate, m, floor, p = 3000) {
  return p * (floor + amplitude(certificate, m));
}

module.exports = {signMatrix, blockPairs, reducedCost, amplitude, tailThreshold, interp};

// ------------------------------------------------------- general sweep
// Same subdivision as tiling_interval.js, written for m gaps instead of six:
// per-term exact one-dimensional ranges, the monotonicity reduction, widest
// coordinate bisection.
const I = require('./tiling_interval');

function plRange(knots, values, a, b) {
  const last = knots.length - 1;
  const ca = Math.max(knots[0], Math.min(knots[last], a));
  const cb = Math.max(knots[0], Math.min(knots[last], b));
  let lo = Math.min(interp(knots, values, ca), interp(knots, values, cb));
  let hi = Math.max(interp(knots, values, ca), interp(knots, values, cb));
  for (let k = 0; k <= last; k++) {
    if (knots[k] > ca && knots[k] < cb) {
      if (values[k] < lo) lo = values[k];
      if (values[k] > hi) hi = values[k];
    }
  }
  return [lo, hi];
}
function plSlopeRange(knots, values, a, b) {
  const last = knots.length - 1;
  if (a < knots[0] || b > knots[last]) return [Math.min(0, -0), 0];
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < last; k++) {
    if (knots[k + 1] <= a || knots[k] >= b) continue;
    const slope = (values[k + 1] - values[k]) / (knots[k + 1] - knots[k]);
    if (slope < lo) lo = slope;
    if (slope > hi) hi = slope;
  }
  if (lo === Infinity) { lo = 0; hi = 0; }
  return [lo, hi];
}

function verifyFloorGeneral(certificate, m, target, options = {}) {
  const p = options.p || 3000;
  const tables = options.tables || I.attachTables(I.buildTables(options.tableLimit || 400));
  const signs = certificate.signs || signMatrix(m);
  const pairs = blockPairs(m + 1);
  const box = options.box || Math.ceil(tailThreshold(certificate, m, target, p));
  const safety = options.safety === undefined ? 1e-10 : options.safety;
  const gradientSafety = options.gradientSafety === undefined ? 1e-11 : options.gradientSafety;
  const minWidth = options.minWidth || 1e-7;
  const budget = options.budget || 5e6;

  const plo = new Float64Array(m + 1), phi = new Float64Array(m + 1);
  const grad = new Float64Array(2 * m);

  function analyze(lo, hi) {
    plo[0] = 0; phi[0] = 0;
    for (let k = 0; k < m; k++) { plo[k + 1] = plo[k] + lo[k]; phi[k + 1] = phi[k] + hi[k]; }
    let bound = plo[m] / p;
    for (let k = 0; k < m; k++) { grad[2 * k] = 1 / p; grad[2 * k + 1] = 1 / p; }
    for (let q = 0; q < pairs.length; q++) {
      const {i, j, c} = pairs[q];
      const a = plo[j] - plo[i], b = phi[j] - phi[i];
      bound += c * I.wRange(tables, a, b)[0];
      const d = I.dwRange(tables, a, b);
      const dLow = c * d[0], dHigh = c * d[1];
      for (let k = i; k < j; k++) { grad[2 * k] += dLow; grad[2 * k + 1] += dHigh; }
    }
    for (let k = 0; k < m; k++) {
      for (let f = 0; f < signs.length; f++) {
        const w = signs[f][k];
        if (!w) continue;
        const r = plRange(certificate.knots, certificate.functions[f], lo[k], hi[k]);
        bound += w > 0 ? w * r[0] : w * r[1];
        const sl = plSlopeRange(certificate.knots, certificate.functions[f], lo[k], hi[k]);
        grad[2 * k] += w > 0 ? w * sl[0] : w * sl[1];
        grad[2 * k + 1] += w > 0 ? w * sl[1] : w * sl[0];
      }
    }
    return bound;
  }

  const stack = [{lo: new Float64Array(m).fill(0), hi: new Float64Array(m).fill(box)}];
  let processed = 0, collapsed = 0, unresolved = 0;
  let counterexample = null;
  while (stack.length) {
    if (processed >= budget) break;
    const current = stack.pop();
    processed++;
    const lo = current.lo, hi = current.hi;
    let bound = analyze(lo, hi);
    if (bound >= target + safety) continue;
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let k = 0; k < m; k++) {
        if (hi[k] <= lo[k]) continue;
        if (grad[2 * k] > gradientSafety) { hi[k] = lo[k]; changed = true; collapsed++; }
        else if (grad[2 * k + 1] < -gradientSafety) { lo[k] = hi[k]; changed = true; collapsed++; }
      }
      if (!changed) break;
      bound = analyze(lo, hi);
      if (bound >= target + safety) break;
    }
    if (bound >= target + safety) continue;
    let widest = -1, width = 0;
    for (let k = 0; k < m; k++) {
      const wk = hi[k] - lo[k];
      if (wk > width) { width = wk; widest = k; }
    }
    if (widest < 0 || width <= minWidth) {
      const centre = Array.from({length: m}, (_, k) => (lo[k] + hi[k]) / 2);
      const value = reducedCost(centre, certificate, p);
      if (value < target) { counterexample = {gaps: centre, value}; break; }
      unresolved++;
      continue;
    }
    const mid = (lo[widest] + hi[widest]) / 2;
    const leftHi = Float64Array.from(hi); leftHi[widest] = mid;
    const rightLo = Float64Array.from(lo); rightLo[widest] = mid;
    stack.push({lo: Float64Array.from(lo), hi: leftHi});
    stack.push({lo: rightLo, hi: Float64Array.from(hi)});
  }
  return {
    m, target, box, processed, collapsed, remaining: stack.length,
    complete: stack.length === 0 && !counterexample && processed < budget && unresolved === 0,
    unresolved, counterexample
  };
}
module.exports.verifyFloorGeneral = verifyFloorGeneral;

// ------------------------------------------------------- general audit
// Independent adversaries for a general-block certificate, mirroring
// auditAdditiveCertificate: the deterministic three-basin word enumeration, a
// differential-evolution run, and a gradient multistart.  A certificate is
// only as good as its worst adversary.
function slopeAt(knots, values, x) {
  const last = knots.length - 1;
  if (x <= knots[0] || x >= knots[last]) return 0;
  let lo = 0, hi = last;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (knots[mid] <= x) lo = mid; else hi = mid; }
  return (values[lo + 1] - values[lo]) / (knots[lo + 1] - knots[lo]);
}

function reducedCostAndGradient(gaps, certificate, p = 3000) {
  const m = gaps.length;
  const signs = certificate.signs || signMatrix(m);
  const base = T.blockFunctionalAndGradient(gaps, p);
  let value = base.value;
  const gradient = base.gradient.slice();
  for (let f = 0; f < signs.length; f++) {
    for (let k = 0; k < m; k++) {
      const weight = signs[f][k];
      if (!weight) continue;
      value += weight * interp(certificate.knots, certificate.functions[f], gaps[k]);
      gradient[k] += weight * slopeAt(certificate.knots, certificate.functions[f], gaps[k]);
    }
  }
  return {value, gradient};
}

function lcg(seed) {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; };
}

function auditGeneral(certificate, m, options = {}) {
  const p = options.p || 3000;
  const maxGap = options.maxGap || Math.ceil(tailThreshold(certificate, m, options.floorGuess || 0.006, p));
  const objective = gaps => reducedCost(gaps, certificate, p);
  const results = {};
  results.bands = T.bandBasinSearch(objective, m, {
    periodic: false, reflectionSymmetry: true, maxGap,
    bandSeeds: options.bandSeeds || [1.05, 2.05, 3.2],
    coarseTolerance: 5e-4, tolerance: 5e-8
  });
  results.evolution = T.differentialEvolution(objective, m, {
    seed: options.seed || 0xb10c8, generations: options.generations || 900,
    populationSize: options.populationSize || 160, maxGap, tolerance: 5e-8
  });
  const random = lcg((options.seed || 0xb10c8) ^ 0x51de);
  const bands = [1.0408, 1.9776, 1.044, 1.975, 3.02, 0.6, 2.5, 4.06, 2.95, 0.35];
  let best = null;
  for (let s = 0; s < (options.starts || 900); s++) {
    const x = new Array(m);
    for (let k = 0; k < m; k++) {
      x[k] = (s % 2 === 0)
        ? 0.1 + 4.3 * random()
        : Math.max(0, bands[Math.floor(random() * bands.length)] + 0.12 * (random() - 0.5));
    }
    const first = new Array(m).fill(0), second = new Array(m).fill(0);
    for (let t = 1; t <= (options.steps || 400); t++) {
      const current = reducedCostAndGradient(x, certificate, p);
      const rate = 0.06 * (0.1 + 0.9 * (1 - t / (options.steps || 400)));
      for (let k = 0; k < m; k++) {
        first[k] = 0.9 * first[k] + 0.1 * current.gradient[k];
        second[k] = 0.999 * second[k] + 0.001 * current.gradient[k] * current.gradient[k];
        const mHat = first[k] / (1 - Math.pow(0.9, t));
        const vHat = second[k] / (1 - Math.pow(0.999, t));
        x[k] = Math.max(0, Math.min(maxGap, x[k] - rate * mHat / (Math.sqrt(vHat) + 1e-12)));
      }
    }
    const polished = T.patternMinimize(objective, x, {step: 0.02, tolerance: 5e-9, maxGap});
    if (!best || polished.value < best.value) best = polished;
  }
  results.gradient = best;
  let value = Infinity, gaps = null, source = null;
  for (const key of Object.keys(results)) {
    if (results[key].value < value) { value = results[key].value; gaps = results[key].x; source = key; }
  }
  return {value, gaps, source, maxGap, results};
}
module.exports.reducedCostAndGradient = reducedCostAndGradient;
module.exports.auditGeneral = auditGeneral;

// Each free direction's sign row sums to zero, so adding a constant to any of
// the functions leaves the reduced cost unchanged.  Centring them is therefore
// free and shrinks the amplitude -- and with it the cube the tail lemma leaves
// open -- by a large factor.  A search that only ever looked inside a small box
// will otherwise emit a certificate that is worthless outside it.
function gaugeNormalize(certificate) {
  return {
    knots: certificate.knots.slice(),
    signs: certificate.signs,
    functions: certificate.functions.map(values => {
      const shift = (Math.max(...values) + Math.min(...values)) / 2;
      return values.map(v => v - shift);
    })
  };
}
module.exports.gaugeNormalize = gaugeNormalize;
