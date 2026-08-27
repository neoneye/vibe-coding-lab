'use strict';

// A proof-carrying sweep: emit the subdivision tree, so the result can be
// CHECKED rather than merely rerun.
//
// Rerunning the sweep in a different arithmetic is the obvious way to gain
// confidence and it is not affordable -- an Arb box costs about half a
// millisecond, which is ten hours for seventy-five million of them.  A proof
// object is affordable, because it separates the search from the justification.
// The search decided which boxes to look at and in what order; that is expensive
// and nobody needs to redo it.  What has to hold is local to each node:
//
//   split k        the two children union to the parent          -- structural
//   collapse k     the derivative keeps its sign across the box  -- arithmetic
//   discharged     the bound clears the target                   -- arithmetic
//   tube           the box lies inside an excluded tube          -- structural
//
// The structural claims can be checked for every node at no arithmetic cost at
// all, and they are the ones that catch a lost region -- the failure mode where
// a sweep reports "complete" having silently dropped part of its domain.  The
// arithmetic claims are checked on a sample, in Arb, by dev/sweep_proof_arb.py.
//
// The record is one byte per node in preorder:
//
//   0x00 + k   split coordinate k at its midpoint, two children follow
//   0x08 + k   collapse coordinate k to its lower face, one child follows
//   0x10 + k   collapse coordinate k to its upper face, one child follows
//   0x20       leaf: discharged, the bound cleared the target
//   0x21       leaf: inside a tube
//   0x22       leaf: unresolved (a completed sweep emits none)
//
// The root boxes are the tube-face partition, which the checker recomputes.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execSync} = require('child_process');
const PI = require('./tiling_pair_interval');
const P = require('./tiling_pair');
const I = require('./tiling_interval');
const D = require('./tiling_defect');
const A = require('./tiling_additive');

const OP_SPLIT = 0x00, OP_LO = 0x08, OP_HI = 0x10;
const LEAF_BOUND = 0x20, LEAF_TUBE = 0x21, LEAF_OPEN = 0x22;

function emit(cube, rho, rigorous, target, out) {
  const here = __dirname;
  const cand = JSON.parse(fs.readFileSync(path.join(here, 'tiling_pair.stationary.json'), 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(path.join(here, 'tiling_additive.certificate.json'), 'utf8'));
  const certs = bundle.certificates;
  const base = (Array.isArray(certs) ? certs : Object.values(certs))
    .find(e => e.name === cand.base);
  const cert = P.prepare(cand, base);
  const prepared = I.prepareCertificate(base);
  const tables = rigorous ? null : I.attachTables(I.buildTables(120));
  const safety = rigorous ? 0 : 1e-10;
  const gradientSafety = rigorous ? 0 : 1e-11;
  const scratch = I.newScratch();

  const roots = D.partition(cube, rho);
  const tape = [];
  let leaves = 0, splits = 0, collapses = 0, open = 0;
  const started = Date.now();

  // explicit stack, so the tape comes out in preorder without recursion depth
  for (const root of roots) {
    const stack = [{lo: root.lo, hi: root.hi}];
    while (stack.length) {
      const cur = stack.pop();
      const lo = cur.lo, hi = cur.hi;
      let r = PI.boxBound(cert, prepared, tables, rigorous, lo, hi, scratch);
      if (r.bound >= target + safety) { tape.push(LEAF_BOUND); leaves++; continue; }
      let collapsed = false;
      for (let pass = 0; pass < 3 && !collapsed; pass++) {
        let changed = false;
        for (let k = 0; k < 6; k++) {
          if (hi[k] <= lo[k]) continue;
          if (r.gradLo[k] > gradientSafety) {
            tape.push(OP_HI + k); hi[k] = lo[k]; changed = true; collapses++;
          } else if (r.gradHi[k] < -gradientSafety) {
            tape.push(OP_LO + k); lo[k] = hi[k]; changed = true; collapses++;
          }
        }
        if (!changed) break;
        r = PI.boxBound(cert, prepared, tables, rigorous, lo, hi, scratch);
        if (r.bound >= target + safety) { collapsed = true; }
      }
      if (r.bound >= target + safety) { tape.push(LEAF_BOUND); leaves++; continue; }
      let widest = -1, width = 0;
      for (let k = 0; k < 6; k++) {
        const w = hi[k] - lo[k];
        if (w > width) { width = w; widest = k; }
      }
      if (widest < 0 || width <= 1e-7) { tape.push(LEAF_OPEN); open++; leaves++; continue; }
      tape.push(OP_SPLIT + widest); splits++;
      const mid = (lo[widest] + hi[widest]) / 2;
      const leftHi = Float64Array.from(hi); leftHi[widest] = mid;
      const rightLo = Float64Array.from(lo); rightLo[widest] = mid;
      // push right first so left is processed first: preorder
      stack.push({lo: rightLo, hi: Float64Array.from(hi)});
      stack.push({lo: Float64Array.from(lo), hi: leftHi});
    }
  }

  const buf = Buffer.from(tape);
  fs.writeFileSync(out, buf);
  const meta = {
    what: 'subdivision tree for the tube-excluded pair sweep, one byte per node',
    precision: rigorous ? 'proved enclosures' : 'double precision, table kernel',
    cube, tubeRadius: rho, target, safety, gradientSafety,
    roots: roots.length, nodes: tape.length, leaves, splits, collapses,
    unresolved: open,
    tape: path.basename(out),
    tape_sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    seconds: +((Date.now() - started) / 1000).toFixed(1),
    commit: execSync('git rev-parse HEAD').toString().trim()
  };
  fs.writeFileSync(out.replace(/\.bin$/, '.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(JSON.stringify(meta, null, 2));
}

if (require.main === module) {
  const cube = parseFloat(process.argv[2] || '3');
  const rho = parseFloat(process.argv[3] || '0.008');
  const rigorous = process.argv.includes('--rigorous');
  const EALT = 0.003957393309109344;
  const name = path.join(__dirname,
    'sweep_proof' + (rigorous ? '.rigorous' : '') + '.bin');
  emit(cube, rho, rigorous, EALT, name);
}

module.exports = {emit, OP_SPLIT, OP_LO, OP_HI, LEAF_BOUND, LEAF_TUBE, LEAF_OPEN};
