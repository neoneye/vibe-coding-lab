'use strict';

// Exhaustive subdivision for a PAIR-STATE certificate, over the search cube
// minus the two alternating tubes.
//
// Why the tube has to come out.  The pinned candidate attains its floor exactly
// at the alternating block: R(alt) = E_alt, gradient zero, Hessian positive
// definite.  A branch-and-bound cannot certify a bound that is exactly attained
// -- it would have to subdivide the basin down to where the quadratic term
// clears the target, forever.  So the tube is excluded here and has to be
// handled by a local argument instead (R = E_alt at a critical point with a
// certified positive-definite Hessian on the tube gives R >= E_alt there, and
// the alternating point sits strictly inside one knot cell, so R is smooth on a
// small enough tube even though a bilinear psi is only continuous across knot
// lines).  That local argument is NOT in this file.  What is here is the other
// half: everything outside the tube, where the minimum is strictly above the
// target and subdivision can finish.
//
// The enclosure is the additive sweep's, plus the psi ranges from
// dev/tiling_pair.js.  Both the bound and the derivative ranges add term by
// term, so this reuses the audited machinery rather than restating it.

const I = require('./tiling_interval');
const A = require('./tiling_additive');
const P = require('./tiling_pair');
const D = require('./tiling_defect');
const R = require('./tiling_rigorous');

// There is no slack constant here any more.  There used to be one, 1e-12,
// justified in a comment by the claim that "the only new error is the five
// additions" -- a hand-wave standing in for a proof, and it did not cover the
// gradient accumulations at all.  Every accumulation below is instead performed
// with the directed rounding from tiling_rigorous.js, so the bound and the two
// derivative ranges are outward at every step and nothing is left to a constant
// chosen by eye.

function boxBound(cert, prepared, tables, rigorous, lo, hi, scratch) {
  if (rigorous) I.analyzeBoxRigorous(prepared, lo, hi, scratch);
  else I.analyzeBox(tables, prepared, lo, hi, scratch);
  let bound = scratch.bound;
  const gradLo = new Float64Array(6);
  const gradHi = new Float64Array(6);
  for (let k = 0; k < 6; k++) {
    gradLo[k] = scratch.grad[2 * k];
    gradHi[k] = scratch.grad[2 * k + 1];
  }
  for (let k = 0; k < 5; k++) {
    const r = P.psiBoxRange(cert, k, lo[k], hi[k], lo[k + 1], hi[k + 1]);
    bound = R.rd(bound + r.value[0]);
    gradLo[k] = R.rd(gradLo[k] + r.dx[0]);
    gradHi[k] = R.ru(gradHi[k] + r.dx[1]);
    gradLo[k + 1] = R.rd(gradLo[k + 1] + r.dy[0]);
    gradHi[k + 1] = R.ru(gradHi[k + 1] + r.dy[1]);
  }
  return {bound, gradLo, gradHi};
}

function verifyPairFloor(cert, prepared, target, options = {}) {
  const rho = options.rho;
  if (!(rho > 0)) throw new Error('rho must be positive');
  const rigorous = !!options.rigorous;
  const tables = rigorous ? null
    : (options.tables || I.attachTables(I.buildTables(options.tableLimit || 120)));
  // The tail lemma's cube must account for the psi amplitude too: the additive
  // tailThreshold knows nothing about it.  |sum_k psi_k| <= 5 sup |psi|.
  let psiAmplitude = 0;
  for (const grid of cert.mats) {
    let m = 0;
    for (const v of grid) m = Math.max(m, Math.abs(v));
    psiAmplitude += m;
  }
  const box = options.box
    || Math.ceil(A.tailThreshold(prepared.raw, target) + 3000 * psiAmplitude);
  const safety = options.safety === undefined ? (rigorous ? 0 : 1e-10) : options.safety;
  const gradientSafety = options.gradientSafety === undefined
    ? (rigorous ? 0 : 1e-11) : options.gradientSafety;
  const minWidth = options.minWidth || 1e-7;
  const budget = options.budget || 5e6;
  const scratch = I.newScratch();

  const roots = D.partition(box, rho);
  const stack = roots.slice();
  const digest = I.newDigest();
  let processed = 0, collapsed = 0, unresolved = 0;
  let worstBound = Infinity, counterexample = null;
  const sample = [];

  while (stack.length) {
    if (processed >= budget) break;
    const current = stack.pop();
    processed++;
    const lo = current.lo, hi = current.hi;

    let r = boxBound(cert, prepared, tables, rigorous, lo, hi, scratch);
    I.stir(digest, r.bound, lo, hi);
    if (r.bound >= target + safety) continue;

    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let k = 0; k < 6; k++) {
        if (hi[k] <= lo[k]) continue;
        if (r.gradLo[k] > gradientSafety) { hi[k] = lo[k]; changed = true; collapsed++; }
        else if (r.gradHi[k] < -gradientSafety) { lo[k] = hi[k]; changed = true; collapsed++; }
      }
      if (!changed) break;
      r = boxBound(cert, prepared, tables, rigorous, lo, hi, scratch);
      if (r.bound >= target + safety) break;
    }
    if (r.bound >= target + safety) continue;
    if (r.bound < worstBound) worstBound = r.bound;

    let widest = -1, width = 0;
    for (let k = 0; k < 6; k++) {
      const wk = hi[k] - lo[k];
      if (wk > width) { width = wk; widest = k; }
    }
    if (widest < 0 || width <= minWidth) {
      const centre = Array.from({length: 6}, (_, k) => (lo[k] + hi[k]) / 2);
      const value = P.reducedCost(centre, cert);
      if (value < target) { counterexample = {gaps: centre, value}; break; }
      unresolved++;
      if (sample.length < 12) sample.push({gaps: centre, value, bound: r.bound});
      continue;
    }

    const mid = (lo[widest] + hi[widest]) / 2;
    const leftHi = Float64Array.from(hi); leftHi[widest] = mid;
    const rightLo = Float64Array.from(lo); rightLo[widest] = mid;
    stack.push({lo: Float64Array.from(lo), hi: leftHi});
    stack.push({lo: rightLo, hi: Float64Array.from(hi)});
  }

  return {
    target, rho, box, rigorous, processed, roots: roots.length, collapsed,
    remaining: stack.length,
    complete: stack.length === 0 && !counterexample && processed < budget
      && unresolved === 0,
    worstBound, unresolved, counterexample, sample,
    checksum: I.seal(digest)
  };
}

module.exports = {verifyPairFloor, boxBound};
