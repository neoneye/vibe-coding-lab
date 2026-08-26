'use strict';

// Driver for the tube-excluded pair sweep.  Emits a transcript so a recorded
// row can be told apart from a rerun one.
//
//   node dev/sweep_pair.js <cube> <tubeRadius> [--rigorous]
//
// The cube argument matters: the tail lemma's cube for this certificate is 28,
// and anything smaller is an exhaustive check over part of the space, not a
// block floor.  The transcript says which it was.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execSync} = require('child_process');
const PI = require('./tiling_pair_interval');
const P = require('./tiling_pair');
const I = require('./tiling_interval');

const SOURCES = ['sweep_pair.js', 'tiling_pair.js', 'tiling_pair_interval.js',
  'tiling_interval.js', 'tiling_research.js', 'tiling_additive.js',
  'tiling_defect.js', 'tiling_pair.stationary.json',
  'tiling_additive.certificate.json'];

const cube = parseFloat(process.argv[2] || '3');
const rho = parseFloat(process.argv[3] || '0.008');
const rigorous = process.argv.includes('--rigorous');

const here = __dirname;
const cand = JSON.parse(fs.readFileSync(path.join(here, 'tiling_pair.stationary.json'), 'utf8'));
const bundle = JSON.parse(fs.readFileSync(path.join(here, 'tiling_additive.certificate.json'), 'utf8'));
const certs = bundle.certificates;
const base = (Array.isArray(certs) ? certs : Object.values(certs))
  .find(e => e.name === cand.base);
const cert = P.prepare(cand, base);
const prepared = I.prepareCertificate(base);
const tables = rigorous ? null : I.attachTables(I.buildTables(120));
const EALT = 0.003957393309109344;

const started = Date.now();
const r = PI.verifyPairFloor(cert, prepared, EALT,
  {rho, tables, rigorous, box: cube, budget: 2e9});

const hashes = {};
for (const f of SOURCES) {
  hashes[f] = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(here, f))).digest('hex').slice(0, 16);
}
const out = {
  what: 'exhaustive subdivision of the pinned pair candidate, over the cube minus the alternating tubes',
  caveat: cube >= 28 ? 'full tail-lemma cube'
    : 'the cube is ' + cube + ", not the tail lemma's 28: blocks with a gap between "
      + cube + ' and 28 are not covered, so this is NOT a block floor',
  precision: rigorous ? 'proved enclosures' : 'double precision, table kernel, safety 1e-10',
  target: EALT, cube, tubeRadius: rho,
  complete: r.complete, boxes: r.processed, collapses: r.collapsed,
  unresolved: r.unresolved, counterexample: r.counterexample,
  checksum: r.checksum, seconds: +((Date.now() - started) / 1000).toFixed(1),
  replay: 'node dev/sweep_pair.js ' + cube + ' ' + rho + (rigorous ? ' --rigorous' : ''),
  commit: execSync('git rev-parse HEAD').toString().trim(),
  inputs: hashes
};
const name = rigorous ? 'tiling_pair.sweep.rigorous.json' : 'tiling_pair.sweep.json';
fs.writeFileSync(path.join(here, name), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
