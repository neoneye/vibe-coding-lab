'use strict';

// Record the boxes where the sweep's bound came closest to the target.
//
// The sweep's arithmetic is mine, and rebuilding all 7.5e7 boxes of it in Arb is
// not feasible -- a python-flint box costs about half a millisecond, which is ten
// hours.  What is feasible is auditing the boxes that MATTER: the ones where the
// bound only just cleared the target, because those are the only ones where an
// unsound bound would have changed the outcome.  A bound that clears by 1e-3 can
// be wrong in the sixteenth digit without consequence; a bound that clears by
// 1e-12 cannot.
//
// This driver reruns the sweep and keeps the tightest margins it sees, plus a
// deterministic random sample for contrast.
//
// WHAT CAME OF IT, because the negative result is the useful part.  On the
// double-precision full-cube sweep the tightest discharged margins run from
// 1.001e-10 to 8.259e-10 -- right at the 1e-10 safety threshold, which is to say
// the sweep leans on that threshold in thousands of boxes.  An Arb audit of
// those boxes was written and thrown away: a straightforward Arb enclosure of R
// over them, natural extension or mean-value form, is never narrower than about
// 4e-5, which is a hundred thousand times wider than the margins it would have
// to check.  It cannot bind, and shipping it would have been a check that could
// only ever pass.
//
// The reason is that the sweep is TIGHTER than a straightforward reimplementation:
// it uses exact monotone-piece ranges for the kernel, built from precomputed
// breakpoints, where an obvious Arb version uses interval extensions.  So
// auditing the sweep against an independent base is not "do it in Arb" -- it is
// reproducing that machinery in Arb.  That is the real size of the outstanding
// item, and it is larger than it looks.

const fs = require('fs');
const path = require('path');
const PI = require('./tiling_pair_interval');
const P = require('./tiling_pair');
const I = require('./tiling_interval');
const D = require('./tiling_defect');
const A = require('./tiling_additive');

const here = __dirname;
const cand = JSON.parse(fs.readFileSync(path.join(here, 'tiling_pair.stationary.json'), 'utf8'));
const bundle = JSON.parse(fs.readFileSync(path.join(here, 'tiling_additive.certificate.json'), 'utf8'));
const certs = bundle.certificates;
const base = (Array.isArray(certs) ? certs : Object.values(certs))
  .find(e => e.name === cand.base);
const cert = P.prepare(cand, base);
const prepared = I.prepareCertificate(base);
const EALT = 0.003957393309109344;

const cube = parseFloat(process.argv[2] || '28');
const rho = parseFloat(process.argv[3] || '0.008');
const keep = parseInt(process.argv[4] || '4000', 10);
const rigorous = process.argv.includes('--rigorous');
const tables = rigorous ? null : I.attachTables(I.buildTables(120));

// a fixed-size min-heap on the margin, kept as a sorted array (keep is small)
const tight = [];
const random = [];
let seed = 20260827;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const scratch = I.newScratch();
const roots = D.partition(cube, rho);
const stack = roots.slice();
let processed = 0;
const safety = rigorous ? 0 : 1e-10;
const gradientSafety = rigorous ? 0 : 1e-11;

while (stack.length) {
  const cur = stack.pop();
  processed++;
  const lo = cur.lo, hi = cur.hi;
  let r = PI.boxBound(cert, prepared, tables, rigorous, lo, hi, scratch);
  const margin = r.bound - EALT;
  if (margin >= safety) {
    // this box was DISCHARGED by the bound; its margin is what we audit
    const row = {lo: Array.from(lo), hi: Array.from(hi), bound: r.bound, margin};
    if (tight.length < keep) {
      tight.push(row);
      tight.sort((a, b) => a.margin - b.margin);
    } else if (margin < tight[tight.length - 1].margin) {
      tight[tight.length - 1] = row;
      tight.sort((a, b) => a.margin - b.margin);
    }
    if (random.length < keep && rnd() < 1e-4) random.push(row);
    continue;
  }
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let k = 0; k < 6; k++) {
      if (hi[k] <= lo[k]) continue;
      if (r.gradLo[k] > gradientSafety) { hi[k] = lo[k]; changed = true; }
      else if (r.gradHi[k] < -gradientSafety) { lo[k] = hi[k]; changed = true; }
    }
    if (!changed) break;
    r = PI.boxBound(cert, prepared, tables, rigorous, lo, hi, scratch);
    if (r.bound >= EALT + safety) break;
  }
  if (r.bound >= EALT + safety) continue;
  let widest = -1, width = 0;
  for (let k = 0; k < 6; k++) {
    const w = hi[k] - lo[k];
    if (w > width) { width = w; widest = k; }
  }
  if (widest < 0 || width <= 1e-7) continue;
  const mid = (lo[widest] + hi[widest]) / 2;
  const leftHi = Float64Array.from(hi); leftHi[widest] = mid;
  const rightLo = Float64Array.from(lo); rightLo[widest] = mid;
  stack.push({lo: Float64Array.from(lo), hi: leftHi});
  stack.push({lo: rightLo, hi: Float64Array.from(hi)});
}

const out = {
  what: 'the boxes where the sweep bound came closest to the target, for an '
    + 'independent Arb audit',
  precision: rigorous ? 'proved enclosures' : 'double precision',
  cube, tubeRadius: rho, target: EALT, processed,
  tightest: tight.slice(0, keep),
  random: random.slice(0, keep)
};
const name = rigorous ? 'sweep_sample.rigorous.json' : 'sweep_sample.json';
fs.writeFileSync(path.join(here, name), JSON.stringify(out));
console.log(processed + ' boxes; kept ' + out.tightest.length + ' tightest (margins '
  + out.tightest[0].margin.toExponential(3) + ' .. '
  + out.tightest[out.tightest.length - 1].margin.toExponential(3) + ') and '
  + out.random.length + ' random');
