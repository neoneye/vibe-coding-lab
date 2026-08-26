'use strict';

// The half of the proof a branch-and-bound cannot do.
//
// The pinned pair certificate attains its floor exactly at the alternating
// block: R(alt) = E_alt, gradient zero, Hessian positive definite.  Subdivision
// can never certify a bound that is exactly attained -- it would chase a
// quadratic term down to a target it never clears -- so the alternating tube
// has to come out of the sweep and be handled here, by the argument that the
// exactness makes available rather than blocks:
//
//   R(alt + u) >= R(alt) - ||grad R(alt)||_2 ||u||_2 + (lambda/2) ||u||_2^2
//
// with lambda a certified lower bound on the smallest eigenvalue of the Hessian
// over the tube.  If R(alt) >= E_alt - eps and the gradient is tiny, that gives
// R >= E_alt - eps on the whole tube.
//
// Smoothness is the thing to be careful about.  A piecewise-linear additive
// potential and a bilinear psi are only CONTINUOUS across their knot lines --
// their gradients jump there -- so a Taylor argument is valid only on a tube
// that stays inside one cell of BOTH grids in every coordinate.  This file
// checks that containment rather than assuming it, and refuses a radius that
// breaks it.  Inside one cell the additive part is linear (no second
// derivative) and psi is bilinear (second derivative only in its own cross
// term, constant), so the Hessian is F6's plus five constants.

const RIG = require('./tiling_rigorous');
const I = require('./tiling_interval');
const P = require('./tiling_pair');

const NPTS = 7;
const PAIRS = [];
for (let i = 0; i < NPTS; i++) {
  for (let j = i + 1; j < NPTS; j++) PAIRS.push({i, j, c: 2 / (NPTS - (j - i))});
}

// d^2 F6 / dg_a dg_b over a box: the pair (i, j) contributes c * w''(d_ij) to
// every (a, b) with i <= a, b < j, because d_ij depends on exactly those gaps.
function blockHessianRange(lo, hi) {
  const H = [];
  for (let a = 0; a < 6; a++) H.push(new Array(6).fill(0).map(() => [0, 0]));
  const plo = [0], phi = [0];
  for (let k = 0; k < 6; k++) {
    plo.push(RIG.rd(plo[k] + lo[k]));
    phi.push(RIG.ru(phi[k] + hi[k]));
  }
  for (const {i, j, c} of PAIRS) {
    const second = RIG.weightSecondRange(RIG.rd(plo[j] - phi[i]), RIG.ru(phi[j] - plo[i]));
    const term = RIG.iScale(second, c);      // outward; c = 2/(N-s) is inexact
    for (let a = i; a < j; a++) {
      for (let b = i; b < j; b++) {
        H[a][b] = RIG.iAdd(H[a][b], term);
      }
    }
  }
  return H;
}

// psi_k contributes only d^2/dx dy, and on one cell that is constant -- but not
// exactly representable.  This used to return the plain double
// (c11 - c10 - c01 + c00) / (hx * hy), three roundings, and the caller inserted
// it as the DEGENERATE interval [cross, cross].  A rounded number presented as
// an exact enclosure is the one thing interval arithmetic exists to prevent, and
// a reviewer named this as the most blatant instance in the file.  It returns
// intervals now.
function psiCrossTerms(cert, gaps) {
  const out = [];
  for (let k = 0; k < 5; k++) {
    const i = requireInteriorCell(cert.knots, gaps[k]);
    const j = requireInteriorCell(cert.knots, gaps[k + 1]);
    const J = cert.J;
    const c00 = cert.mats[k][i * J + j], c01 = cert.mats[k][i * J + j + 1];
    const c10 = cert.mats[k][(i + 1) * J + j], c11 = cert.mats[k][(i + 1) * J + j + 1];
    const hx = RIG.iSub([cert.knots[i + 1], cert.knots[i + 1]],
      [cert.knots[i], cert.knots[i]]);
    const hy = RIG.iSub([cert.knots[j + 1], cert.knots[j + 1]],
      [cert.knots[j], cert.knots[j]]);
    const numerator = RIG.iAdd(RIG.iSub(RIG.iSub([c11, c11], [c10, c10]),
      [c01, c01]), [c00, c00]);
    out.push(RIG.iDiv(numerator, RIG.iMul(hx, hy)));
  }
  return out;
}

function requireInteriorCell(knots, x) {
  const last = knots.length - 1;
  if (x <= knots[0] || x >= knots[last]) throw new Error('outside the knot range');
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (knots[mid] <= x) lo = mid; else hi = mid;
  }
  return lo;
}

// Largest r for which [x - r, x + r] stays strictly inside one cell of `knots`.
function cellClearance(knots, x) {
  const i = requireInteriorCell(knots, x);
  return Math.min(x - knots[i], knots[i + 1] - x);
}

// Cholesky as a positive-definiteness test, with a margin big enough to absorb
// its own arithmetic.  A floating-point Cholesky of a symmetric M completes with backward error at
// most about n * u * ||M||.  Rather than assert that a fixed margin covers it,
// the margin is computed from the matrix in hand and the caller is told what it
// was: PIVOT_FACTOR * n * u * ||M||_inf, with a factor of fifty.
const UNIT_ROUNDOFF = 1.1102230246251565e-16;
const PIVOT_FACTOR = 50;

function pivotMargin(M, n) {
  let norm = 0;
  for (let i = 0; i < n; i++) {
    let row = 0;
    for (let j = 0; j < n; j++) row += Math.abs(M[i][j]);
    if (row > norm) norm = row;
  }
  return PIVOT_FACTOR * n * UNIT_ROUNDOFF * norm;
}

function choleskyPositive(M, n, margin) {
  const L = [];
  for (let i = 0; i < n; i++) L.push(new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let acc = M[i][j];
      for (let k = 0; k < j; k++) acc -= L[i][k] * L[j][k];
      // one ulp-scale margin per accumulated term, taken against the pivot
      if (i === j) {
        if (!(acc > margin)) return false;
        L[i][j] = Math.sqrt(acc);
      } else {
        L[i][j] = acc / L[j][j];
      }
    }
  }
  return true;
}

// lambda_min(H) >= s - ||radius||_F, with s the largest shift that still passes
// a verified Cholesky on the midpoint.
function smallestEigenvalueLower(H, n) {
  // The midpoint may be any point; what matters is that the radius covers the
  // distance from it to both ends, INCLUDING the rounding of the midpoint
  // itself.  Computing rad as (hi - lo)/2 in plain doubles does not.
  const mid = [];
  let pert = 0;
  for (let a = 0; a < n; a++) {
    mid.push([]);
    for (let b = 0; b < n; b++) {
      const m = (H[a][b][0] + H[a][b][1]) / 2;
      mid[a].push(m);
      const r = Math.max(RIG.ru(H[a][b][1] - m), RIG.ru(m - H[a][b][0]), 0);
      pert = RIG.ru(pert + RIG.ru(r * r));
    }
  }
  pert = RIG.ru(Math.sqrt(pert));
  let lo = 0, hi = 10;
  for (let it = 0; it < 60; it++) {
    const s = (lo + hi) / 2;
    const shifted = mid.map((row, a) => row.map((v, b) => a === b ? v - s : v));
    if (choleskyPositive(shifted, n, pivotMargin(shifted, n))) lo = s; else hi = s;
  }
  // the bisection's lo is a shift that PASSED, so lambda_min(mid) >= lo; the
  // subtraction is rounded down
  return RIG.rd(lo - pert);
}

// The tube certificate.  `evaluate` supplies R and its gradient at a point --
// passed in rather than imported so that this file works for an additive
// certificate as well as a pair one.
//
// The arithmetic base here is tiling_rigorous.js, which is mine: hand-written
// transcendentals with error constants I chose.  The Arb reimplementation
// covers the CHAIN coercivity theorem, not this one.  Whatever this file
// certifies is therefore certified modulo that base, the same footing every
// sweep in this directory stands on and a weaker footing than dev/coercivity_arb.py.
function certifyTube(options) {
  const {cert, alt, radius, evaluate, ceiling, additiveKnots} = options;
  // 1. the tube must stay inside one cell of both grids, in every coordinate
  let clearance = Infinity;
  for (const x of alt) {
    clearance = Math.min(clearance, cellClearance(cert.knots, x));
    if (additiveKnots) clearance = Math.min(clearance, cellClearance(additiveKnots, x));
  }
  if (!(radius < clearance)) {
    return {holds: false, reason: 'tube crosses a knot line', clearance};
  }

  // 2. the Hessian over the tube.  The natural extension of w'' over the whole
  // tube is far too loose -- it goes negative by radius 0.005 -- so the tube is
  // covered by sub-boxes and lambda is the worst over the cover.  That is a
  // valid bound on the Hessian everywhere in the tube, which is what the Taylor
  // argument needs (the segment from the centre to any point stays inside).
  const cuts = options.subdivisions || 3;
  const cross = psiCrossTerms(cert, alt);
  const step = (2 * radius) / cuts;
  const lo = new Array(6), hi = new Array(6);
  let lambda = Infinity;
  const walk = (k) => {
    if (lambda <= 0) return;
    if (k === 6) {
      const H = blockHessianRange(lo, hi);
      for (let m = 0; m < 5; m++) {
        H[m][m + 1] = RIG.iAdd(H[m][m + 1], cross[m]);
        H[m + 1][m] = RIG.iAdd(H[m + 1][m], cross[m]);
      }
      const v = smallestEigenvalueLower(H, 6);
      if (v < lambda) lambda = v;
      return;
    }
    for (let c = 0; c < cuts; c++) {
      lo[k] = alt[k] - radius + c * step;
      hi[k] = lo[k] + step;
      walk(k + 1);
    }
  };
  walk(0);

  // 3. the value and gradient at the centre, ENCLOSED rather than evaluated.
  // A double evaluation here would leave the whole conclusion resting on an
  // unbounded floating-point number, which is the mistake this directory keeps
  // making.  analyzeBoxRigorous wants a non-degenerate box -- at lo == hi the
  // piecewise-linear slope drops out and the gradient it reports is F6's alone
  // -- so the enclosure is taken over a pinhole box around the centre instead.
  const centre = evaluate(alt);
  const value = centre.lower;
  const gradNorm = centre.gradNorm;
  const deficit = RIG.ru(ceiling - value);  // how far R(alt) sits below E_alt

  // R(alt+u) - E_alt >= -deficit - gradNorm * t + (lambda/2) t^2, t = ||u||_2.
  // The worst case over t >= 0 is at t = gradNorm / lambda.
  const worst = lambda > 0
    ? RIG.rd(-deficit - RIG.ru(RIG.ru(gradNorm * gradNorm) / (2 * lambda)))
    : -Infinity;
  // The honest output is not a boolean against some threshold I picked: it is
  // the floor this argument certifies on the tube.  Whether that floor is good
  // enough is the caller's question, and the number that limits it is the
  // rigorous point evaluation's own slack, not anything about the geometry.
  return {
    holds: lambda > 0,
    floor: ceiling + worst,
    shortfall: -worst,
    radius, clearance, lambda, value, deficit, gradNorm, worst
  };
}

// Enclosure of R and its gradient at a point, via a pinhole box.
function encloseCentre(cert, prepared, alt, delta) {
  const lo = Float64Array.from(alt.map(x => x - delta));
  const hi = Float64Array.from(alt.map(x => x + delta));
  const scratch = I.newScratch();
  I.analyzeBoxRigorous(prepared, lo, hi, scratch);
  // Every accumulation directed outward.  A `- 1e-15` used to stand at the end
  // in place of doing this; a constant subtracted at the end does not cover
  // errors made along the way, and covered none of the gradient at all.
  let lower = scratch.bound;
  const gLo = new Float64Array(6), gHi = new Float64Array(6);
  for (let k = 0; k < 6; k++) {
    gLo[k] = scratch.grad[2 * k];
    gHi[k] = scratch.grad[2 * k + 1];
  }
  for (let k = 0; k < 5; k++) {
    const r = P.psiBoxRange(cert, k, lo[k], hi[k], lo[k + 1], hi[k + 1]);
    lower = RIG.rd(lower + r.value[0]);
    gLo[k] = RIG.rd(gLo[k] + r.dx[0]);
    gHi[k] = RIG.ru(gHi[k] + r.dx[1]);
    gLo[k + 1] = RIG.rd(gLo[k + 1] + r.dy[0]);
    gHi[k + 1] = RIG.ru(gHi[k + 1] + r.dy[1]);
  }
  let sq = 0;
  for (let k = 0; k < 6; k++) {
    const m = Math.max(Math.abs(gLo[k]), Math.abs(gHi[k]));
    sq = RIG.ru(sq + RIG.ru(m * m));
  }
  return {lower, gradNorm: RIG.ru(Math.sqrt(sq)), delta};
}

module.exports = {blockHessianRange, psiCrossTerms, cellClearance,
  choleskyPositive, pivotMargin, smallestEigenvalueLower, certifyTube,
  encloseCentre};
