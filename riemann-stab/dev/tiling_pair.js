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
  const low = A.ALTERNATING_CEILING ? 1.0416801034484870 : 1.0416801034484870;
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

module.exports = {prepare, reducedCost, reducedCostAndGradient, multistart,
  telescopingDefect, bilinear};
