'use strict';

// The compiled tape checker (dev/tapecheck, Rust + inari intervals) on the small
// sharp tape, every obligation, and agreement with the Python/Arb checker's
// committed transcript of the same tape.  Needs cargo; without it the step says
// so and passes vacuously -- the same convention as check_arb.js without Arb.

const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync, spawnSync} = require('child_process');
const crypto = require('crypto');

const here = __dirname;
let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
  if (!ok) failures++;
}

console.log('=== the compiled tape checker ===');
const cargo = spawnSync('cargo', ['--version'], {encoding: 'utf8'});
if (cargo.status !== 0) {
  console.log('  cargo not available here; the compiled checker is NOT built or run.');
  process.exit(0);
}
const crate = path.join(here, 'tapecheck');
try {
  execFileSync('cargo', ['build', '--release', '--quiet'], {cwd: crate, stdio: 'inherit'});
} catch (e) {
  check('the checker builds', false, 'cargo build failed');
  process.exit(1);
}
check('the checker builds', true);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tapecheck-'));
const out = path.join(scratch, 'small.results.json');
const run = spawnSync(path.join(crate, 'target', 'release', 'tapecheck'),
  ['--meta=sweep_proof_sharp_small.json', '--out=' + out], {cwd: here, encoding: 'utf8'});
const res = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
check('the small sharp tape checks completely', run.status === 0 && res && res.status === 'complete',
  res ? `${res.leaf_sample.confirmed} leaves, ${res.collapse_sample.confirmed} collapses confirmed, ` +
        `${res.sub_boxes_evaluated} boxes, ${res.seconds.toFixed(1)} s` : (run.stdout + run.stderr).slice(-400));
const py = JSON.parse(fs.readFileSync(path.join(here, 'sweep_proof_sharp_small.results.json'), 'utf8'));
check('and agrees with the Python/Arb checker\'s committed transcript on every count',
  res && py.status === 'complete' && res.tape_sha256 === py.tape_sha256
  && res.leaf_sample.confirmed === py.leaf_sample.confirmed
  && res.collapse_sample.confirmed === py.collapse_sample.confirmed
  && res.leaf_sample.refuted === 0 && res.collapse_sample.refuted === 0);
check('its sources are hashed at start and unchanged at the end',
  res && res.sources_unchanged_during_run === true && res.inputs['tapecheck/src/main.rs']);

// the committed full-tape records must have been produced from the sources on disk now
for (const rec of ['tapecheck_sharp_full.results.json', 'tapecheck_pair_full.results.json']) {
  const p = path.join(here, rec);
  if (!fs.existsSync(p)) continue;
  const r = JSON.parse(fs.readFileSync(p, 'utf8'));
  let stale = [];
  for (const [dep, want] of Object.entries(r.inputs)) {
    const raw = fs.readFileSync(path.join(here, dep));
    const hashed = dep.endsWith('.json')
      ? Buffer.from(raw.toString('binary').split('\n').filter(ln => !/^\s*"(commit|seconds)":/.test(ln)).join('\n'), 'binary')
      : raw;
    if (crypto.createHash('sha256').update(hashed).digest('hex') !== want) stale.push(dep);
  }
  check(`${rec} was produced from the sources on disk (${Object.keys(r.inputs).length} inputs) and reads complete`,
    stale.length === 0 && r.status === 'complete' && r.sources_unchanged_during_run === true
    && r.leaf_sample.beyond_resolution === 0 && r.leaf_sample.refuted === 0
    && r.collapse_sample.beyond_resolution === 0 && r.collapse_sample.refuted === 0,
    stale.length ? 'stale: ' + stale.join(', ') : `${r.leaf_sample.confirmed} leaves, ${r.collapse_sample.confirmed} collapses, ${Math.round(r.seconds)} s`);
}

// a negative control: the forged one-byte tube-leaf tape must be refused
const tape = Buffer.from([0x21]);
const meta = Object.assign(JSON.parse(fs.readFileSync(path.join(here, 'sweep_proof_sharp_small.json'), 'utf8')), {
  cube: 0.5, tubeRadius: 0, target: 1000, roots: 1, nodes: 1, leaves: 1, splits: 0, collapses: 0,
  tape: path.join(scratch, 'forged.bin'), tape_sha256: crypto.createHash('sha256').update(tape).digest('hex')});
fs.writeFileSync(meta.tape, tape);
const metaPath = path.join(scratch, 'forged.json');
fs.writeFileSync(metaPath, JSON.stringify(meta));
const forged = spawnSync(path.join(crate, 'target', 'release', 'tapecheck'),
  ['--meta=' + metaPath, '--out=' + path.join(scratch, 'forged.results.json')], {cwd: here, encoding: 'utf8'});
check('a forged one-byte tube-leaf tape is refused', forged.status === 1);

console.log(failures ? `\n${failures} FAILED` : '\nTAPECHECK PASS');
process.exit(failures ? 1 : 0);
