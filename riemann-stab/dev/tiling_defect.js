'use strict';

// The block floor, away from the alternating configuration.
//
// Everything else here bounds the reduced cost R from below by ONE number, good
// for every six-gap block at once.  That number has a hard ceiling: the best
// certificate this family admits has LP floor 0.003957227285, which is 1.66e-7
// BELOW the alternating chain energy 0.003957393309109.  So no sweep against
// any certificate here can ever prove that the alternating chain is the
// minimiser -- the uniform bound is short by construction, and no amount of
// subdivision closes a gap the certificate does not have.
//
// But the shortfall is not spread out.  It is concentrated in a small tube
// around the alternating blocks, and outside that tube the same certificate is
// comfortably ABOVE the alternating energy.  This file certifies that: the same
// subdivision, over the search cube MINUS the two alternating tubes.
//
//   T_p(rho) = { g : |g_i - c_i^p| <= rho for every i },  c^p alternating with
//              phase p, so T_0 and T_1 are the two phases' tubes.
//
// A box entirely inside T_0 or T_1 is skipped -- and the result is then a floor
// on the complement, which is what it is reported as.  Two soundness points that
// the uniform sweep does not have to think about:
//
//   * the monotonicity reduction is only valid when minimising over a WHOLE box.
//     On a box that straddles a tube boundary the minimum over the complement
//     need not lie on the face the derivative points to, so the reduction is
//     disabled there and the box is split instead;
//   * a box is split at a tube FACE when it straddles one, so straddling boxes
//     resolve into inside/outside in a few splits rather than by bisecting
//     towards the boundary forever.
//
// What this gives, and what it does not.  It is the defect half of a Peierls
// bound: blocks that are not near-alternating cost strictly more than the
// alternating energy, by a certified margin.  It is not a Peierls bound.  The
// near-alternating blocks still carry a deficit, averaging cannot pay for it
// with a vanishing density of defect blocks, and closing that needs a
// decomposition that uses the coercivity theorem inside the tube rather than
// the block relaxation -- which nothing here does.

const I = require('./tiling_interval');
const A = require('./tiling_additive');

// The certified two-cycle, from dev/coercivity_arb.py.  These are a DEFINITION
// of where the tube sits, not an approximation to anything: the theorem proved
// below is about the complement of the tube around these stated numbers.
const LOW = 1.0416801034484870;
const HIGH = 1.9794672314032244;

function centres(phase) {
  const c = new Float64Array(6);
  for (let i = 0; i < 6; i++) c[i] = ((i + phase) % 2 === 0) ? LOW : HIGH;
  return c;
}
const CENTRES = [centres(0), centres(1)];

function containedIn(lo, hi, c, rho) {
  for (let i = 0; i < 6; i++) {
    if (lo[i] < c[i] - rho || hi[i] > c[i] + rho) return false;
  }
  return true;
}

// Disjoint INTERIORS, not disjoint closures.  A piece of the partition can
// share a face with a tube, and the strict test would call that an overlap.  It
// is not one that matters: R is continuous, so the infimum over a box minus one
// of its own faces is the minimum over the box, and the monotonicity reduction
// is valid exactly when that identity holds.
function disjointFrom(lo, hi, c, rho) {
  for (let i = 0; i < 6; i++) {
    if (hi[i] <= c[i] - rho || lo[i] >= c[i] + rho) return true;
  }
  return false;
}

// Partition the search cube so that every piece is either INSIDE a tube or
// DISJOINT from both, by cutting each coordinate at the tube faces.  This is
// what makes the restriction cheap and, more importantly, sound: the
// monotonicity reduction is only valid when minimising over a whole box -- on a
// box that straddles a tube boundary, collapsing to a face can move points into
// the tube, and the minimum over the complement is not the minimum over the
// face.  After this partition no box straddles anything, so the reduction runs
// exactly as it does in the uniform sweep.
//
// Five intervals per coordinate (the two tube slabs and the three gaps between
// and around them) gives 5^6 = 15625 pieces, of which two are the tubes.
function partition(box, rho) {
  const cuts = new Set([0, box]);
  for (const c of CENTRES) {
    for (let i = 0; i < 6; i++) {
      for (const v of [c[i] - rho, c[i] + rho]) {
        if (v > 0 && v < box) cuts.add(v);
      }
    }
  }
  const edges = Array.from(cuts).sort((x, y) => x - y);
  const slabs = [];
  for (let i = 0; i + 1 < edges.length; i++) slabs.push([edges[i], edges[i + 1]]);

  const out = [];
  const lo = new Float64Array(6), hi = new Float64Array(6);
  const walk = (k) => {
    if (k === 6) {
      for (const c of CENTRES) if (containedIn(lo, hi, c, rho)) return;
      out.push({lo: Float64Array.from(lo), hi: Float64Array.from(hi)});
      return;
    }
    for (const [a, b] of slabs) { lo[k] = a; hi[k] = b; walk(k + 1); }
  };
  walk(0);
  return out;
}

function verifyDefectFloor(cert, target, options = {}) {
  const rho = options.rho;
  if (!(rho > 0)) throw new Error('rho must be positive');
  const rigorous = !!options.rigorous;
  const tables = rigorous ? null
    : (options.tables || I.attachTables(I.buildTables(options.tableLimit || 120)));
  const prepared = cert.knots instanceof Float64Array ? cert : I.prepareCertificate(cert);
  const box = options.box || Math.ceil(A.tailThreshold(prepared.raw, target));
  const safety = options.safety === undefined ? (rigorous ? 0 : 1e-10) : options.safety;
  const gradientSafety = options.gradientSafety === undefined
    ? (rigorous ? 0 : 1e-11) : options.gradientSafety;
  const minWidth = options.minWidth || 1e-7;
  const budget = options.budget || 5e6;
  const scratch = I.newScratch();
  const analyze = rigorous
    ? (lo, hi) => I.analyzeBoxRigorous(prepared, lo, hi, scratch)
    : (lo, hi) => I.analyzeBox(tables, prepared, lo, hi, scratch);

  const roots = partition(box, rho);
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

    analyze(lo, hi);
    I.stir(digest, scratch.bound, lo, hi);
    if (scratch.bound >= target + safety) continue;

    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let k = 0; k < 6; k++) {
        if (hi[k] <= lo[k]) continue;
        if (scratch.grad[2 * k] > gradientSafety) { hi[k] = lo[k]; changed = true; collapsed++; }
        else if (scratch.grad[2 * k + 1] < -gradientSafety) { lo[k] = hi[k]; changed = true; collapsed++; }
      }
      if (!changed) break;
      analyze(lo, hi);
      if (scratch.bound >= target + safety) break;
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
      if (sample.length < 12) sample.push({gaps: centre, value, bound: scratch.bound});
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

module.exports = {LOW, HIGH, centres, containedIn, disjointFrom, partition,
  verifyDefectFloor};
