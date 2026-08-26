'use strict';

// Pair-state coboundary certificates, and an independent evaluation of them.
//
// The additive family cannot reach the alternating chain energy.  Its best
// member stops at 0.003957227285, and dev/tiling_defect.js says where the
// missing 1.66e-7 goes: three near-degenerate basins, one of them a high-high
// defect block that the chain charges a certified wall tension of 1.47e-4 and
// the block relaxation charges essentially nothing.  A potential that sees only
// individual gaps cannot price an ADJACENCY, so it has to lift the high-high
// defect without noticing that it is one.
//
// For any state potential Phi on five consecutive gaps,
//
//   R(g) = F6(g) + Phi(g_2..g_6) - Phi(g_1..g_5)
//
// telescopes, so min R bounds the per-gap chain energy from below.  Taking
// Phi(s) = sum_{j=1..4} phi_j(s_j, s_{j+1}) gives the normal form used here:
//
//   R(g) = F6(g) + sum_{k=1..5} psi_k(g_k, g_{k+1}),   sum_k psi_k = 0.
//
// psi_k(x,y) = u_k(x) + v_k(y) recovers the additive family exactly, so this is
// a strict widening, and what it adds is the ability to price (low, low)
// differently from (high, high).
//
// THE CEILING IS STRUCTURAL AND UNCHANGED.  F6 is reversal-invariant and the
// two alternating blocks are reverses of each other, so the coboundary cancels
// between them and
//
//   min_g R(g) <= (R(alt, phase 0) + R(alt, phase 1)) / 2 = F6(alt) = E_alt
//
// for EVERY telescoping certificate, additive or not.  Reaching E_alt is the
// whole game -- it would say the alternating chain is the minimiser, which is
// the crystallization statement.  Exceeding it is impossible.
//
// What this file is for: to evaluate a candidate from the Python search with
// code that shares nothing with it, and to check the two identities everything
// rests on.  It does NOT sweep anything.  A candidate here is a candidate.

const T = require('./tiling_research');
const A = require('./tiling_additive');
const R = require('./tiling_rigorous');

const SIGN_A = A.SIGN_A;
const SIGN_B = A.SIGN_B;

function clampIndex(knots, x) {
  const last = knots.length - 1;
  if (x <= knots[0]) return {i: 0, f: 0, h: knots[1] - knots[0], clamped: true};
  if (x >= knots[last]) {
    return {i: last - 1, f: 1, h: knots[last] - knots[last - 1], clamped: true};
  }
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (knots[mid] <= x) lo = mid; else hi = mid;
  }
  const h = knots[lo + 1] - knots[lo];
  return {i: lo, f: (x - knots[lo]) / h, h, clamped: false};
}

// psi_k as a J x J bilinear grid, stored row-major in a flat array.
function bilinear(knots, grid, J, x, y) {
  const px = clampIndex(knots, x), py = clampIndex(knots, y);
  const c00 = grid[px.i * J + py.i], c01 = grid[px.i * J + py.i + 1];
  const c10 = grid[(px.i + 1) * J + py.i], c11 = grid[(px.i + 1) * J + py.i + 1];
  const left = (1 - py.f) * c00 + py.f * c01;
  const right = (1 - py.f) * c10 + py.f * c11;
  const value = (1 - px.f) * left + px.f * right;
  const dx = px.clamped ? 0 : (right - left) / px.h;
  const bottom = (1 - px.f) * c00 + px.f * c10;
  const top = (1 - px.f) * c01 + px.f * c11;
  const dy = py.clamped ? 0 : (top - bottom) / py.h;
  return {value, dx, dy};
}

function prepare(candidate, base) {
  const knots = candidate.knots;
  const J = knots.length;
  const free = candidate.free;
  const mats = [];
  for (let k = 0; k < free; k++) {
    mats.push(candidate.coefficients.slice(k * J * J, (k + 1) * J * J));
  }
  const tail = new Array(J * J).fill(0);
  for (const m of mats) for (let i = 0; i < J * J; i++) tail[i] -= m[i];
  return {knots, J, mats: mats.concat([tail]), base};
}

function reducedCostAndGradient(gaps, cert) {
  const {value, gradient} = T.blockFunctionalAndGradient(gaps, 3000);
  let total = value;
  const grad = gradient.slice();
  const b = cert.base;
  for (let i = 0; i < 6; i++) {
    if (SIGN_A[i]) {
      total += SIGN_A[i] * A.piecewiseLinear(b.knots, b.a, gaps[i]);
      grad[i] += SIGN_A[i] * A.piecewiseSlope(b.knots, b.a, gaps[i]);
    }
    if (SIGN_B[i]) {
      total += SIGN_B[i] * A.piecewiseLinear(b.knots, b.b, gaps[i]);
      grad[i] += SIGN_B[i] * A.piecewiseSlope(b.knots, b.b, gaps[i]);
    }
  }
  for (let k = 0; k < 5; k++) {
    const r = bilinear(cert.knots, cert.mats[k], cert.J, gaps[k], gaps[k + 1]);
    total += r.value;
    grad[k] += r.dx;
    grad[k + 1] += r.dy;
  }
  return {value: total, gradient: grad};
}

function reducedCost(gaps, cert) {
  return reducedCostAndGradient(gaps, cert).value;
}

// Gradient multistart, deliberately not the Adam loop the Python search uses.
function multistart(cert, options = {}) {
  const starts = options.starts || 4000;
  const iterations = options.iterations || 900;
  let seed = options.seed || 0x5eed1234;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const low = 1.0416801034484870;
  const high = 1.9794672314032244;
  const fixed = [
    [low, high, low, high, low, high],
    [high, low, high, low, high, low],
    [high, low, high, high, low, high],
    [low, high, low, low, high, low],
    [1.98135, 1.04247, 1.98414, 1.04602, 2.95584, 1.04705]
  ];
  let best = Infinity, bestG = null;
  for (let s = 0; s < starts + fixed.length; s++) {
    let g;
    if (s < fixed.length) g = fixed[s].slice();
    else if (s % 3 === 0) g = Array.from({length: 6}, () => 0.35 + rnd() * 3.3);
    else g = Array.from({length: 6}, () => (rnd() < 0.5
      ? 0.95 + rnd() * 0.3 : 1.8 + rnd() * 0.6));
    let step = 0.02;
    let value = reducedCost(g, cert);
    for (let it = 0; it < iterations; it++) {
      const {gradient} = reducedCostAndGradient(g, cert);
      const trial = g.map((x, i) => Math.min(12, Math.max(0.02, x - step * gradient[i])));
      const v = reducedCost(trial, cert);
      if (v < value) { g = trial; value = v; step *= 1.06; }
      else step *= 0.55;
      if (step < 1e-15) break;
    }
    if (value < best) { best = value; bestG = g; }
  }
  return {floor: best, gaps: bestG};
}

// The identity the whole construction rests on: the coboundary must cancel over
// a periodic chain.  If it does not, every floor reported anywhere is a bound
// on nothing.
function telescopingDefect(cert, gaps) {
  const n = gaps.length;
  let sumR = 0, sumF = 0;
  for (let i = 0; i < n; i++) {
    const block = Array.from({length: 6}, (_, j) => gaps[(i + j) % n]);
    sumR += reducedCost(block, cert);
    sumF += T.blockFunctional(block, 3000);
  }
  return Math.abs(sumR / n - sumF / n);
}

// ----------------------------------------------------- interval enclosures
// A bilinear function on one knot cell is a CONVEX COMBINATION of the four
// corner values -- the weights (1-u)(1-v), (1-u)v, u(1-v), uv are nonnegative
// and sum to one -- so its range over that cell is exactly the min and max of
// those corners.  A box covering several cells is a union of cells, so the
// range over it is enclosed by the min and max of the grid values over the
// covering index rectangle.  Exact on a single cell, and a slight over-
// enclosure only where a box ends part way through one.
//
// The same argument gives the derivatives.  On a cell, d/dx is
// (1-v)(c10-c00)/h + v(c11-c01)/h: a convex combination of the two edge slopes,
// so its range is the min and max of those two.  Across cells, take the extremes
// over every covered cell.  A bilinear function is only continuous, not C1, so
// these slopes jump at knot lines -- which is fine for a range but is why no
// argument here may assume R is differentiable across one.
// The right endpoint needs the right-closed convention.  With the left-closed
// one, a box that is exactly one cell reports a span of two cells and drags in
// the neighbouring corners -- sound, but it loses the one case where the
// enclosure is exact, which is the case the subdivision spends its time in.
function cellIndexRight(knots, x) {
  const last = knots.length - 1;
  if (x <= knots[0]) return 0;
  if (x >= knots[last]) return last - 1;
  const i = cellIndex(knots, x);
  return (x === knots[i] && i > 0) ? i - 1 : i;
}

function cellSpan(knots, a, b) {
  const last = knots.length - 1;
  const lo = Math.max(0, Math.min(last - 1, cellIndex(knots, a)));
  const hi = Math.max(0, Math.min(last - 1, cellIndexRight(knots, b)));
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

function cellIndex(knots, x) {
  const last = knots.length - 1;
  if (x <= knots[0]) return 0;
  if (x >= knots[last]) return last - 1;
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (knots[mid] <= x) lo = mid; else hi = mid;
  }
  return lo;
}

function gridRange(grid, J, i0, i1, j0, j1) {
  let min = Infinity, max = -Infinity;
  for (let i = i0; i <= i1 + 1; i++) {
    const row = i * J;
    for (let j = j0; j <= j1 + 1; j++) {
      const v = grid[row + j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return [min, max];
}

function slopeRangeX(knots, grid, J, i0, i1, j0, j1) {
  let min = Infinity, max = -Infinity;
  for (let i = i0; i <= i1; i++) {
    const h = knots[i + 1] - knots[i];
    for (let j = j0; j <= j1 + 1; j++) {
      const v = (grid[(i + 1) * J + j] - grid[i * J + j]) / h;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return [min, max];
}

function slopeRangeY(knots, grid, J, i0, i1, j0, j1) {
  let min = Infinity, max = -Infinity;
  for (let j = j0; j <= j1; j++) {
    const h = knots[j + 1] - knots[j];
    for (let i = i0; i <= i1 + 1; i++) {
      const v = (grid[i * J + j + 1] - grid[i * J + j]) / h;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return [min, max];
}

// A clamped coordinate contributes no slope, and the value there is the edge
// value, which the index clamp already delivers.
function clampedBelow(knots, x) { return x <= knots[0]; }
function clampedAbove(knots, x) { return x >= knots[knots.length - 1]; }

// The range of a bilinear psi over a box that lies inside one knot cell.
//
// This replaces a centered (mean value) form that was here before and was not
// sound: it computed psi at the box centre, a spread from the slope ranges, and
// returned `at - spread`, every step in ordinary rounded arithmetic, the result
// used as a LOWER BOUND.  A reviewer was right to call that "ordinary rounded
// arithmetic used as an exact enclosure".
//
// The replacement is sound, tighter, and about as fast.  A bilinear function
// restricted to a sub-rectangle of one cell is still bilinear there, so its
// range is exactly the min and max of its values at the FOUR BOX CORNERS -- not
// the cell corners, which is what the natural grid range uses and which stays
// O(2e-5) loose however small the box gets.
//
// The four values are computed in plain doubles and the hull widened by a bound
// that is derived rather than chosen.  Write M for the largest absolute corner
// coefficient of the cell.  Each corner value is a convex combination of the
// four coefficients, so every intermediate is bounded by M in absolute value.
// The evaluation is: two subtractions and two divisions for u and v (each
// carrying relative error at most 2 * 2^-53, and entering the result multiplied
// by a coefficient difference of at most 2M), then ten multiply-adds whose
// intermediates are bounded by M.  Charging 2^-53 per operation and 2M * 4 *
// 2^-53 for the u and v errors gives a total below 24 * M * 2^-53; the constant
// below is 32, a third again on top of that, plus an absolute floor that covers
// the subnormal range where a relative bound vanishes.
const BILINEAR_OPS = 32;
const BILINEAR_FLOOR = 1e-300;

function cellCornerRange(cert, k, i, j, aLo, aHi, bLo, bHi) {
  const t = cert.knots, J = cert.J, grid = cert.mats[k];
  const t0 = t[i], t1 = t[i + 1], s0 = t[j], s1 = t[j + 1];
  const hx = t1 - t0, hy = s1 - s0;
  const c00 = grid[i * J + j], c01 = grid[i * J + j + 1];
  const c10 = grid[(i + 1) * J + j], c11 = grid[(i + 1) * J + j + 1];
  const M = Math.max(Math.abs(c00), Math.abs(c01), Math.abs(c10), Math.abs(c11));
  const clamp = z => z < 0 ? 0 : (z > 1 ? 1 : z);
  const uA = clamp((aLo - t0) / hx), uB = clamp((aHi - t0) / hx);
  const vA = clamp((bLo - s0) / hy), vB = clamp((bHi - s0) / hy);
  let lo = Infinity, hi = -Infinity;
  for (const u of [uA, uB]) {
    const left = c00 + u * (c10 - c00);
    const right = c01 + u * (c11 - c01);
    for (const v of [vA, vB]) {
      const value = left + v * (right - left);
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    }
  }
  const slack = BILINEAR_OPS * M * Number.EPSILON / 2 + BILINEAR_FLOOR;
  return [lo - slack, hi + slack];
}

// Inside a single cell the slopes are EXACTLY linear in the other coordinate:
// d/dx is ((1-v)(c10-c00) + v(c11-c01))/hx with v the fractional position in y.
// Taking the min and max over the two edges instead, as the multi-cell path
// must, leaves an O(1) overestimate that does not shrink as the box shrinks --
// fatal for anything needing a tight gradient at a point, where the true value
// is a cancellation of terms a thousand times larger.  Every step below is
// outward-rounded: the fractions round, the corner differences round, and the
// division rounds.
function singleCellSlopes(cert, k, i, j, aLo, aHi, bLo, bHi) {
  const t = cert.knots, J = cert.J, grid = cert.mats[k];
  const hx = t[i + 1] - t[i], hy = t[j + 1] - t[j];
  const c00 = grid[i * J + j], c01 = grid[i * J + j + 1];
  const c10 = grid[(i + 1) * J + j], c11 = grid[(i + 1) * J + j + 1];
  const clampX = aLo <= t[0] || aHi >= t[t.length - 1];
  const clampY = bLo <= t[0] || bHi >= t[t.length - 1];
  const uLo = Math.max(0, Math.min(1, R.rd(R.rd(aLo - t[i]) / hx)));
  const uHi = Math.max(0, Math.min(1, R.ru(R.ru(aHi - t[i]) / hx)));
  const vLo = Math.max(0, Math.min(1, R.rd(R.rd(bLo - t[j]) / hy)));
  const vHi = Math.max(0, Math.min(1, R.ru(R.ru(bHi - t[j]) / hy)));
  const dxAt = v => R.iDiv(R.iAdd(
    R.iMul(R.iSub([1, 1], [v, v]), R.iSub([c10, c10], [c00, c00])),
    R.iMul([v, v], R.iSub([c11, c11], [c01, c01]))), [hx, hx]);
  const dyAt = u => R.iDiv(R.iAdd(
    R.iMul(R.iSub([1, 1], [u, u]), R.iSub([c01, c01], [c00, c00])),
    R.iMul([u, u], R.iSub([c11, c11], [c10, c10]))), [hy, hy]);
  let dx = R.iHull(dxAt(vLo), dxAt(vHi));
  let dy = R.iHull(dyAt(uLo), dyAt(uHi));
  if (clampX) dx = [Math.min(dx[0], 0), Math.max(dx[1], 0)];
  if (clampY) dy = [Math.min(dy[0], 0), Math.max(dy[1], 0)];
  return {dx, dy};
}

function psiBoxRange(cert, k, aLo, aHi, bLo, bHi) {
  const [i0, i1] = cellSpan(cert.knots, aLo, aHi);
  const [j0, j1] = cellSpan(cert.knots, bLo, bHi);
  const value = gridRange(cert.mats[k], cert.J, i0, i1, j0, j1);
  let dx, dy;
  if (i0 === i1 && j0 === j1) {
    const exact = singleCellSlopes(cert, k, i0, j0, aLo, aHi, bLo, bHi);
    dx = exact.dx;
    dy = exact.dy;
    // inside one cell the corner hull IS the range, and beats the grid one by
    // however much the cell varies; no need to compute both
    const corners = cellCornerRange(cert, k, i0, j0, aLo, aHi, bLo, bHi);
    value[0] = corners[0];
    value[1] = corners[1];
  } else {
    dx = slopeRangeX(cert.knots, cert.mats[k], cert.J, i0, i1, j0, j1);
    dy = slopeRangeY(cert.knots, cert.mats[k], cert.J, i0, i1, j0, j1);
  }
  // where the box reaches outside the knots the slope there is zero, so the
  // range has to include zero (the single-cell path already did this)
  if (!(i0 === i1 && j0 === j1)) {
    if (clampedBelow(cert.knots, aLo) || clampedAbove(cert.knots, aHi)) {
      dx = [Math.min(dx[0], 0), Math.max(dx[1], 0)];
    }
    if (clampedBelow(cert.knots, bLo) || clampedAbove(cert.knots, bHi)) {
      dy = [Math.min(dy[0], 0), Math.max(dy[1], 0)];
    }
  }
  // The grid values are stored doubles, so the natural value range is exact;
  // the slopes and the centered form are not -- they are divisions and
  // subtractions.  The rigorous path runs with a gradient margin of zero, where
  // a slope range straddling zero by less than its own rounding could collapse
  // a box onto the wrong face.  Widen outward.  The amounts are around 1e-20
  // against slopes of 1e-4, so this costs nothing and closes the hole.
  const slack = 1e-15;
  dx = [dx[0] - Math.abs(dx[0]) * slack - 1e-300,
    dx[1] + Math.abs(dx[1]) * slack + 1e-300];
  dy = [dy[0] - Math.abs(dy[0]) * slack - 1e-300,
    dy[1] + Math.abs(dy[1]) * slack + 1e-300];
  value[0] -= Math.abs(value[0]) * slack + 1e-300;
  value[1] += Math.abs(value[1]) * slack + 1e-300;
  return {value, dx, dy};
}

module.exports = {prepare, reducedCost, reducedCostAndGradient, multistart,
  telescopingDefect, bilinear, psiBoxRange, cellIndex, cellIndexRight, cellSpan,
  cellCornerRange};
