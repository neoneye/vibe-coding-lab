'use strict';

// Exhaustive branch-and-bound verifier for the additive coboundary certificate.
//
// Everything before this file searched for a low point and reported the lowest
// one found.  This file tries to prove there is nothing lower, by subdividing
// the whole cube the tail lemma leaves open until every sub-box is disposed of.
//
// Three ingredients make that possible.
//
//  1. Exact one-dimensional ranges for the weight.  w = (K/K0)^2 is nonnegative
//     with zeros exactly at the zeros of K, and between consecutive zeros it
//     rises to a single interior maximum and falls.  So min and max of w over
//     any interval are O(log n) given the zero and extremum tables.  Same for
//     w', whose sign changes are the zeros of K and of K'.
//  2. A per-term box bound.  Each pair term is bounded by its own exact range,
//     so the only slack is the dependency between terms sharing coordinates.
//  3. The monotonicity reduction.  If the enclosure of dR/dg_k over a box
//     misses zero, the minimum over that box is attained on one face, so the
//     box collapses to a face and loses a dimension.  Without this the sweep is
//     hopeless; the measured first-order slack is about 0.045 * diameter, so a
//     5e-5 margin would otherwise need boxes of diameter 1e-3 and there are
//     ~1e20 of those in the domain.
//
// SCOPE.  This is double-precision arithmetic with an explicit safety margin,
// not a directed-rounding interval library, and Math.sin/Math.cos are not
// correctly rounded.  A completed sweep here is therefore an exhaustive
// subdivision, not yet a machine-checked proof: it removes the sampling gap in
// the audited floors, it does not remove the floating-point gap.

const T = require('./tiling_research');
const A = require('./tiling_additive');

const NPTS = 7;
const PAIRS = [];
for (let i = 0; i < NPTS; i++) {
  for (let j = i + 1; j < NPTS; j++) PAIRS.push({i, j, c: 2 / (NPTS - (j - i))});
}
const SIGN_A = A.SIGN_A;
const SIGN_B = A.SIGN_B;

// ---------------------------------------------------------- critical tables
function bisect(f, a, b, iterations = 90) {
  let fa = f(a);
  for (let k = 0; k < iterations; k++) {
    const m = (a + b) / 2;
    if (fa * f(m) <= 0) b = m; else { a = m; fa = f(a); }
  }
  return (a + b) / 2;
}

function scanRoots(f, limit, step = 2e-4) {
  const roots = [];
  let previous = f(0);
  for (let x = step; x < limit; x += step) {
    const current = f(x);
    if (previous === 0) roots.push(x - step);
    else if (previous * current < 0) roots.push(bisect(f, x - step, x));
    previous = current;
  }
  return roots;
}

function derivative(f, h = 1e-5) {
  return x => (f(x + h) - f(x - h)) / (2 * h);
}

// How far the tabulated extremum of w' can fall short of the true one.
//
// The breakpoints of w' are found by scanning the sign changes of a FINITE
// DIFFERENCE second derivative with h = 1e-4, so they land within about 7.7e-9
// of the true stationary points -- measured against the interval-Newton
// certified breakpoints in dev/kernel_pieces_arb.py, which agree in count (59
// on [0, 30]) and differ by at most that.  A displacement delta at a stationary
// point costs half w'(b) delta^2 in value, and the worst over those 59
// breakpoints is 2.05e-16, at x = 1.227859.
//
// The outward rounding does not cover it: the widening there is |v| * 2.3e-16,
// and |w'| at that breakpoint is 0.123, so the rounding supplies 2.8e-17 against
// a 2.05e-16 shortfall.  The tabulated derivative range can therefore be too
// NARROW by about 1.8e-16, which is what a monotonicity test must never be
// given.
//
// WHAT THAT DOES AND DOES NOT AFFECT, because the first version of this comment
// overstated it.  dwRange is used in exactly one place, analyzeBox, which is the
// DOUBLE-PRECISION path; the rigorous analyzer goes through
// RIG.weightPairCentered and never touches these tables.  And the
// double-precision path runs the sign test with a gradient margin of 1e-11,
// which covers a 1.8e-16 shortfall by five orders of magnitude.  So nothing was
// unsound.  What was true is that the margin was doing work nobody had accounted
// for, and an audit that could not see why 1e-11 was there would not have known
// it was load-bearing.  The widening below makes the coverage explicit instead of
// incidental.
//
// The w VALUE breakpoints do not have the problem at all -- they are roots of w'
// itself, found from an exact w', and the worst value shortfall there is 4.2e-32.
//
// The constant is three times the measured worst case, and absolute rather than
// relative, because the shortfall does not scale with the value.
const DW_BREAK_SLACK = 6e-16;

function buildTables(limit = 100) {
  const w = T.overlapWeight;
  const dw = T.overlapWeightDerivative;
  // Sign changes of w' are the zeros of K (where w touches zero) and the
  // interior maxima; collecting the roots of w' gives both at once.
  const wCritical = scanRoots(dw, limit);
  const ddw = derivative(dw, 1e-4);
  const dwCritical = scanRoots(ddw, limit);
  const wBreaks = Float64Array.from([0, ...wCritical, limit]);
  const dwBreaks = Float64Array.from([0, ...dwCritical, limit]);
  return {
    limit, w, dw, wBreaks, dwBreaks,
    // Values at the breakpoints, with range tables: a range query then costs
    // two kernel evaluations instead of one per breakpoint crossed.  This is
    // the difference between a sweep that finishes and one that does not.
    wAt: Float64Array.from(wBreaks, x => w(x)),
    dwAt: Float64Array.from(dwBreaks, x => dw(x)),
    wTable: null, dwTable: null
  };
}

function attachTables(tables) {
  tables.wTable = buildSparse(tables.wAt);
  tables.dwTable = buildSparse(tables.dwAt);
  return tables;
}

function indexBelow(breaks, x) {
  let lo = 0, hi = breaks.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (breaks[m] <= x) lo = m; else hi = m; }
  return lo;
}

// Range of a function that is monotone between consecutive breakpoints.
function rangeByBreaks(f, breaks, table, a, b, limit) {
  if (a >= limit) { const v = f(limit); return [v, v]; }
  if (b > limit) b = limit;
  const fa = f(a), fb = f(b);
  let lo = fa < fb ? fa : fb;
  let hi = fa > fb ? fa : fb;
  const ia = indexBelow(breaks, a);
  const ib = indexBelow(breaks, b);
  if (ia + 1 <= ib) {
    const q = sparseQuery(table, ia + 1, ib);
    if (q[0] < lo) lo = q[0];
    if (q[1] > hi) hi = q[1];
  }
  return [lo, hi];
}

function wRange(tables, a, b) {
  // w is nonnegative everywhere; past the table limit that is all we claim.
  if (b > tables.limit) {
    return [0, rangeByBreaks(tables.w, tables.wBreaks, tables.wTable, Math.min(a, tables.limit), tables.limit, tables.limit)[1]];
  }
  return rangeByBreaks(tables.w, tables.wBreaks, tables.wTable, a, b, tables.limit);
}
function dwRange(tables, a, b) {
  if (b > tables.limit) {
    const inner = rangeByBreaks(tables.dw, tables.dwBreaks, tables.dwTable, Math.min(a, tables.limit), tables.limit, tables.limit);
    return [Math.min(inner[0], -0.01), Math.max(inner[1], 0.01)];
  }
  const r = rangeByBreaks(tables.dw, tables.dwBreaks, tables.dwTable, a, b, tables.limit);
  return [r[0] - DW_BREAK_SLACK, r[1] + DW_BREAK_SLACK];
}

// Piecewise-linear range queries.  The knot grid is fixed for a certificate,
// so sparse range-min/max tables make every query O(1); without them the knot
// scan dominates the whole sweep.
function buildSparse(values) {
  const n = values.length;
  const levels = Math.max(1, Math.floor(Math.log2(n)) + 1);
  const mins = [Float64Array.from(values)];
  const maxs = [Float64Array.from(values)];
  for (let L = 1; L < levels; L++) {
    const span = 1 << L;
    const count = n - span + 1;
    if (count <= 0) break;
    const pmin = new Float64Array(count), pmax = new Float64Array(count);
    const prevMin = mins[L - 1], prevMax = maxs[L - 1];
    for (let i = 0; i < count; i++) {
      pmin[i] = Math.min(prevMin[i], prevMin[i + (span >> 1)]);
      pmax[i] = Math.max(prevMax[i], prevMax[i + (span >> 1)]);
    }
    mins.push(pmin); maxs.push(pmax);
  }
  return {mins, maxs, n};
}
function sparseQuery(table, a, b) {           // inclusive [a, b]
  if (a > b) return null;
  const L = 31 - Math.clz32(b - a + 1);
  const lo = Math.min(table.mins[L][a], table.mins[L][b - (1 << L) + 1]);
  const hi = Math.max(table.maxs[L][a], table.maxs[L][b - (1 << L) + 1]);
  return [lo, hi];
}

// Precompute everything a certificate needs for fast box analysis.
function prepareCertificate(cert) {
  const knots = Float64Array.from(cert.knots);
  const slopes = new Float64Array(knots.length - 1);
  for (let k = 0; k < slopes.length; k++) {
    slopes[k] = 0;
  }
  const make = values => {
    const arr = Float64Array.from(values);
    const sl = new Float64Array(arr.length - 1);
    for (let k = 0; k < sl.length; k++) sl[k] = (arr[k + 1] - arr[k]) / (knots[k + 1] - knots[k]);
    return {values: arr, slopes: sl, valueTable: buildSparse(arr), slopeTable: buildSparse(sl)};
  };
  return {knots, a: make(cert.a), b: make(cert.b), raw: cert};
}

function knotIndexBelow(knots, x) {
  let lo = 0, hi = knots.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (knots[m] <= x) lo = m; else hi = m; }
  return lo;
}
function interp(knots, values, x) {
  const i = knotIndexBelow(knots, x);
  const t = (x - knots[i]) / (knots[i + 1] - knots[i]);
  return values[i] * (1 - t) + values[i + 1] * t;
}

function plRangeFast(prepared, part, a, b) {
  const knots = prepared.knots, last = knots.length - 1;
  const ca = a < knots[0] ? knots[0] : (a > knots[last] ? knots[last] : a);
  const cb = b < knots[0] ? knots[0] : (b > knots[last] ? knots[last] : b);
  const va = interp(knots, part.values, ca), vb = interp(knots, part.values, cb);
  let lo = va < vb ? va : vb, hi = va > vb ? va : vb;
  // knots strictly inside (ca, cb)
  let first = knotIndexBelow(knots, ca) + 1;
  let lastIn = knotIndexBelow(knots, cb);
  if (knots[lastIn] >= cb) lastIn -= 1;
  if (first <= lastIn) {
    const q = sparseQuery(part.valueTable, first, lastIn);
    if (q[0] < lo) lo = q[0];
    if (q[1] > hi) hi = q[1];
  }
  return [lo, hi];
}

function plSlopeRangeFast(prepared, part, a, b) {
  const knots = prepared.knots, last = knots.length - 1;
  if (a < knots[0] || b > knots[last]) return [Math.min(0, -0), Math.max(0, 0)] && slopeWithFlat(prepared, part, a, b);
  const i = knotIndexBelow(knots, a);
  let j = knotIndexBelow(knots, b);
  if (knots[j] >= b) j -= 1;
  if (j < i) j = i;
  return sparseQuery(part.slopeTable, i, Math.min(j, part.slopes.length - 1));
}
function slopeWithFlat(prepared, part, a, b) {
  const knots = prepared.knots, last = knots.length - 1;
  const outside = a < knots[0] || b > knots[last];
  let lo = outside ? 0 : Infinity, hi = outside ? 0 : -Infinity;
  const ca = Math.max(a, knots[0]), cb = Math.min(b, knots[last]);
  if (cb > ca) {
    const i = knotIndexBelow(knots, ca);
    let j = knotIndexBelow(knots, cb);
    if (knots[j] >= cb) j -= 1;
    if (j < i) j = i;
    const q = sparseQuery(part.slopeTable, i, Math.min(j, part.slopes.length - 1));
    if (q[0] < lo) lo = q[0];
    if (q[1] > hi) hi = q[1];
  }
  if (lo === Infinity) { lo = 0; hi = 0; }
  return [lo, hi];
}

// Reference (slow) versions, kept because the tests compare against them.
function plRange(knots, values, a, b) {
  const last = knots.length - 1;
  const ca = Math.max(knots[0], Math.min(knots[last], a));
  const cb = Math.max(knots[0], Math.min(knots[last], b));
  let lo = Math.min(A.piecewiseLinear(knots, values, ca), A.piecewiseLinear(knots, values, cb));
  let hi = Math.max(A.piecewiseLinear(knots, values, ca), A.piecewiseLinear(knots, values, cb));
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
  let lo = Infinity, hi = -Infinity;
  if (a < knots[0] || b > knots[last]) { lo = 0; hi = 0; }
  for (let k = 0; k < last; k++) {
    if (knots[k + 1] <= a || knots[k] >= b) continue;
    const slope = (values[k + 1] - values[k]) / (knots[k + 1] - knots[k]);
    if (slope < lo) lo = slope;
    if (slope > hi) hi = slope;
  }
  if (lo === Infinity) { lo = 0; hi = 0; }
  return [lo, hi];
}

// -------------------------------------------------------------- box bounds
// One pass over the box computes every pair distance interval once and reuses
// it for both the value bound and the six derivative enclosures.  The pair
// distances come from prefix sums, so the whole analysis is 21 weight-range
// queries plus 21 derivative-range queries.
function analyzeBox(tables, cert, lo, hi, out) {
  // `cert` here is the PREPARED certificate from prepareCertificate.
  const plo = out.plo, phi = out.phi;
  plo[0] = 0; phi[0] = 0;
  for (let k = 0; k < 6; k++) { plo[k + 1] = plo[k] + lo[k]; phi[k + 1] = phi[k] + hi[k]; }

  let bound = plo[6] / 3000;
  const grad = out.grad;
  for (let k = 0; k < 6; k++) { grad[2 * k] = 1 / 3000; grad[2 * k + 1] = 1 / 3000; }

  for (let p = 0; p < PAIRS.length; p++) {
    const {i, j, c} = PAIRS[p];
    const a = plo[j] - plo[i];
    const b = phi[j] - phi[i];
    bound += c * wRange(tables, a, b)[0];
    const d = dwRange(tables, a, b);
    const dLow = c * d[0], dHigh = c * d[1];
    for (let k = i; k < j; k++) { grad[2 * k] += dLow; grad[2 * k + 1] += dHigh; }
  }

  for (let k = 0; k < 6; k++) {
    if (SIGN_A[k]) {
      const r = plRangeFast(cert, cert.a, lo[k], hi[k]);
      bound += SIGN_A[k] > 0 ? r[0] : -r[1];
      const sl = slopeWithFlat(cert, cert.a, lo[k], hi[k]);
      grad[2 * k] += SIGN_A[k] > 0 ? sl[0] : -sl[1];
      grad[2 * k + 1] += SIGN_A[k] > 0 ? sl[1] : -sl[0];
    }
    if (SIGN_B[k]) {
      const r = plRangeFast(cert, cert.b, lo[k], hi[k]);
      bound += SIGN_B[k] > 0 ? r[0] : -r[1];
      const sl = slopeWithFlat(cert, cert.b, lo[k], hi[k]);
      grad[2 * k] += SIGN_B[k] > 0 ? sl[0] : -sl[1];
      grad[2 * k + 1] += SIGN_B[k] > 0 ? sl[1] : -sl[0];
    }
  }
  out.bound = bound;
  return out;
}

function newScratch() {
  return {plo: new Float64Array(7), phi: new Float64Array(7), grad: new Float64Array(12), bound: 0};
}

function boxLowerBound(tables, cert, lo, hi, scratch) {
  return analyzeBox(tables, cert, lo, hi, scratch || newScratch()).bound;
}

function gradientRange(tables, cert, lo, hi, k, scratch) {
  const s = analyzeBox(tables, cert, lo, hi, scratch || newScratch());
  return [s.grad[2 * k], s.grad[2 * k + 1]];
}

// ------------------------------------------------------- traversal digest
// A recorded "complete: true" is worth nothing on its own: an invented row
// passes any test that only reads it back.  This digest is stirred once per box
// with that box's computed bound and its coordinates, so reproducing the value
// requires actually performing the traversal.  It is not a security primitive
// -- it is a replay check, and cheap enough (a handful of integer ops against
// the thousands of floating-point ops each box already costs) to leave on.
const DIGEST_VIEW = new DataView(new ArrayBuffer(8));

function newDigest() { return {a: 0x811c9dc5 | 0, b: 0x01000193 | 0, n: 0}; }

function mixWord(digest, word) {
  digest.a = Math.imul(digest.a ^ word, 0x01000193) | 0;
  digest.b = (Math.imul(digest.b + word, 0x85ebca6b) ^ (digest.a >>> 13)) | 0;
}

function stir(digest, bound, lo, hi) {
  digest.n++;
  DIGEST_VIEW.setFloat64(0, bound);
  mixWord(digest, DIGEST_VIEW.getInt32(0));
  mixWord(digest, DIGEST_VIEW.getInt32(4));
  for (let k = 0; k < 6; k++) {
    DIGEST_VIEW.setFloat64(0, hi[k] - lo[k]);
    mixWord(digest, DIGEST_VIEW.getInt32(0) ^ Math.imul(k + 1, 0x9e3779b9));
  }
}

function seal(digest) {
  const a = (digest.a >>> 0).toString(16).padStart(8, '0');
  const b = (digest.b >>> 0).toString(16).padStart(8, '0');
  return `${a}${b}:${digest.n}`;
}

// ------------------------------------------------------- branch and bound
// Depth-first subdivision of the cube.  A box is disposed of when its lower
// bound clears the target; otherwise the monotonicity reduction collapses
// whatever coordinates it can and the widest remaining coordinate is halved.
function verifyFloor(cert, target, options = {}) {
  const tables = options.tables || buildTables(options.tableLimit || 120);
  if (!tables.wTable) attachTables(tables);
  const prepared = cert.knots instanceof Float64Array ? cert : prepareCertificate(cert);
  const box = options.box || Math.ceil(A.tailThreshold(prepared.raw, target));
  // Double-precision slack.  A box bound sums about thirty terms of size <= 2,
  // and the kernel is evaluated through Math.sin, so a few 1e-13 of error is
  // possible; 1e-10 is far above that and far below any margin that matters.
  const safety = options.safety === undefined ? 1e-10 : options.safety;
  const minWidth = options.minWidth || 1e-7;
  const budget = options.budget || 5e6;
  const scratch = newScratch();
  const probe = newScratch();
  // Dive-first doubles the per-box cost, so it is off by default: it pays for
  // itself only when there is a counterexample to find, not when the whole
  // subdivision has to be exhausted anyway.
  const dive = !!options.dive;
  const gradientSafety = options.gradientSafety === undefined ? 1e-11 : options.gradientSafety;

  const stack = [{lo: new Float64Array(6).fill(0), hi: new Float64Array(6).fill(box)}];
  let processed = 0, collapsed = 0, deepest = 0, unresolved = 0, unresolvedVolume = 0;
  let worstBound = Infinity;
  let counterexample = null;
  const sample = [];
  const digest = newDigest();

  while (stack.length) {
    if (processed >= budget) break;
    const current = stack.pop();
    processed++;
    if (stack.length > deepest) deepest = stack.length;
    const lo = current.lo, hi = current.hi;

    analyzeBox(tables, prepared, lo, hi, scratch);
    stir(digest, scratch.bound, lo, hi);
    if (scratch.bound >= target + safety) continue;

    // Monotonicity reduction: a coordinate whose derivative keeps its sign
    // across the box moves to the face where the minimum must lie.
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let k = 0; k < 6; k++) {
        if (hi[k] <= lo[k]) continue;
        // The sign test needs its own margin: a derivative enclosure that
        // straddles zero by less than the arithmetic's own error must not be
        // allowed to collapse a box.
        if (scratch.grad[2 * k] > gradientSafety) { hi[k] = lo[k]; changed = true; collapsed++; }
        else if (scratch.grad[2 * k + 1] < -gradientSafety) { lo[k] = hi[k]; changed = true; collapsed++; }
      }
      if (!changed) break;
      analyzeBox(tables, prepared, lo, hi, scratch);
      if (scratch.bound >= target + safety) { changed = false; break; }
    }
    if (scratch.bound >= target + safety) continue;
    if (scratch.bound < worstBound) worstBound = scratch.bound;

    let widest = -1, width = 0;
    for (let k = 0; k < 6; k++) {
      const wk = hi[k] - lo[k];
      if (wk > width) { width = wk; widest = k; }
    }
    if (widest < 0 || width <= minWidth) {
      const centre = Array.from({length: 6}, (_, k) => (lo[k] + hi[k]) / 2);
      const value = A.additiveReducedCost(centre, prepared.raw);
      if (value < target) { counterexample = {gaps: centre, value}; break; }
      unresolved++;
      let volume = 1;
      for (let k = 0; k < 6; k++) volume *= Math.max(hi[k] - lo[k], 0);
      unresolvedVolume += volume;
      if (sample.length < 12) sample.push({gaps: centre, value, bound: scratch.bound});
      continue;
    }

    const mid = (lo[widest] + hi[widest]) / 2;
    const leftHi = Float64Array.from(hi); leftHi[widest] = mid;
    const rightLo = Float64Array.from(lo); rightLo[widest] = mid;
    const left = {lo: Float64Array.from(lo), hi: leftHi};
    const right = {lo: rightLo, hi: Float64Array.from(hi)};
    if (dive) {
      // Explore the more promising half first.  Irrelevant when the sweep has
      // to finish anyway, decisive when there is a counterexample to find.
      const lb = boxLowerBound(tables, prepared, left.lo, left.hi, probe);
      const rb = boxLowerBound(tables, prepared, right.lo, right.hi, probe);
      if (lb <= rb) { stack.push(right); stack.push(left); }
      else { stack.push(left); stack.push(right); }
    } else {
      stack.push(left);
      stack.push(right);
    }
  }

  return {
    target, box, processed, collapsed, deepest,
    remaining: stack.length,
    // A box that hit the minimum width was never *proved*, only sampled, so it
    // blocks completeness exactly like a leftover stack entry does.
    complete: stack.length === 0 && !counterexample && processed < budget && unresolved === 0,
    worstBound, unresolved, unresolvedVolume, counterexample, sample,
    checksum: seal(digest)
  };
}

module.exports = {
  PAIRS, buildTables, attachTables, verifyFloor, DW_BREAK_SLACK, rangeByBreaks, newDigest, stir, seal, verifyFloorRigorous, analyzeBoxRigorous, analyzeBox, newScratch, prepareCertificate,
  plRangeFast, slopeWithFlat, wRange, dwRange, plRange, plSlopeRange,
  boxLowerBound, gradientRange
};

// ------------------------------------------------------ rigorous variant
// Same subdivision, but every kernel range comes from tiling_rigorous.js:
// proved trigonometric error bounds, outward-rounded arithmetic, centered
// forms.  Slower and slacker than the table version, and the only version
// whose completion means anything beyond "double precision found nothing".
const RIG = require('./tiling_rigorous');
const PL_SLACK = 1e-15;      // rounding of the piecewise-linear interpolation

function analyzeBoxRigorous(cert, lo, hi, out) {
  const plo = out.plo, phi = out.phi;
  plo[0] = 0; phi[0] = 0;
  for (let k = 0; k < 6; k++) { plo[k + 1] = plo[k] + lo[k]; phi[k + 1] = phi[k] + hi[k]; }

  // Accumulation slack.  The per-term enclosures are outward rounded, but the
  // running sum below is not: about thirty-five additions and multiplications
  // on a total of magnitude under fifty, each losing at most half an ulp, is
  // under 2e-13.  Subtracting 1e-12 once covers it with room to spare, and is
  // negligible against the 1e-6 margins that decide anything.
  const ACCUMULATION_SLACK = 1e-12;
  let bound = plo[6] / 3000;
  const grad = out.grad;
  for (let k = 0; k < 6; k++) { grad[2 * k] = 1 / 3000; grad[2 * k + 1] = 1 / 3000; }

  for (let p = 0; p < PAIRS.length; p++) {
    const {i, j, c} = PAIRS[p];
    const a = plo[j] - plo[i];
    const b = phi[j] - phi[i];
    const pair = RIG.weightPairCentered(a, b);
    bound += c * pair.w[0];
    const dLow = c * pair.dw[0], dHigh = c * pair.dw[1];
    for (let k = i; k < j; k++) { grad[2 * k] += dLow; grad[2 * k + 1] += dHigh; }
  }

  for (let k = 0; k < 6; k++) {
    if (SIGN_A[k]) {
      const r = plRangeFast(cert, cert.a, lo[k], hi[k]);
      bound += (SIGN_A[k] > 0 ? r[0] : -r[1]) - PL_SLACK;
      const sl = slopeWithFlat(cert, cert.a, lo[k], hi[k]);
      grad[2 * k] += (SIGN_A[k] > 0 ? sl[0] : -sl[1]) - PL_SLACK;
      grad[2 * k + 1] += (SIGN_A[k] > 0 ? sl[1] : -sl[0]) + PL_SLACK;
    }
    if (SIGN_B[k]) {
      const r = plRangeFast(cert, cert.b, lo[k], hi[k]);
      bound += (SIGN_B[k] > 0 ? r[0] : -r[1]) - PL_SLACK;
      const sl = slopeWithFlat(cert, cert.b, lo[k], hi[k]);
      grad[2 * k] += (SIGN_B[k] > 0 ? sl[0] : -sl[1]) - PL_SLACK;
      grad[2 * k + 1] += (SIGN_B[k] > 0 ? sl[1] : -sl[0]) + PL_SLACK;
    }
  }
  out.bound = bound - ACCUMULATION_SLACK;
  for (let k = 0; k < 6; k++) {
    grad[2 * k] -= ACCUMULATION_SLACK;
    grad[2 * k + 1] += ACCUMULATION_SLACK;
  }
  return out;
}

function verifyFloorRigorous(cert, target, options = {}) {
  const prepared = cert.knots instanceof Float64Array ? cert : prepareCertificate(cert);
  const box = options.box || Math.ceil(A.tailThreshold(prepared.raw, target));
  const minWidth = options.minWidth || 1e-7;
  const budget = options.budget || 5e6;
  const scratch = newScratch();

  const stack = [{lo: new Float64Array(6).fill(0), hi: new Float64Array(6).fill(box)}];
  let processed = 0, collapsed = 0, unresolved = 0;
  let worstBound = Infinity;
  let counterexample = null;
  const digest = newDigest();

  while (stack.length) {
    if (processed >= budget) break;
    const current = stack.pop();
    processed++;
    const lo = current.lo, hi = current.hi;

    analyzeBoxRigorous(prepared, lo, hi, scratch);
    stir(digest, scratch.bound, lo, hi);
    if (scratch.bound >= target) continue;

    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let k = 0; k < 6; k++) {
        if (hi[k] <= lo[k]) continue;
        if (scratch.grad[2 * k] > 0) { hi[k] = lo[k]; changed = true; collapsed++; }
        else if (scratch.grad[2 * k + 1] < 0) { lo[k] = hi[k]; changed = true; collapsed++; }
      }
      if (!changed) break;
      analyzeBoxRigorous(prepared, lo, hi, scratch);
      if (scratch.bound >= target) break;
    }
    if (scratch.bound >= target) continue;
    if (scratch.bound < worstBound) worstBound = scratch.bound;

    let widest = -1, width = 0;
    for (let k = 0; k < 6; k++) {
      const wk = hi[k] - lo[k];
      if (wk > width) { width = wk; widest = k; }
    }
    if (widest < 0 || width <= minWidth) {
      const centre = Array.from({length: 6}, (_, k) => (lo[k] + hi[k]) / 2);
      const value = A.additiveReducedCost(centre, prepared.raw);
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
    target, box, processed, collapsed, remaining: stack.length,
    complete: stack.length === 0 && !counterexample && processed < budget && unresolved === 0,
    worstBound, unresolved, counterexample, checksum: seal(digest)
  };
}
