#!/usr/bin/env node
'use strict';

// Long-running sweep driver, and the only thing that may write a row into
// tiling_interval.results.json.
//
//   node dev/sweep.js fast     compact 0.0039 0.00394
//   node dev/sweep.js rigorous sharp   0.003952
//   node dev/sweep.js fast     bare    0.0038
//
// `bare` is the zero potential, for which the reduced cost is the isolated
// block functional -- that run is the control reproducing the published
// Proposition F6.
//
// WHY A TRANSCRIPT.  A recorded `complete: true` is worth nothing on its own:
// a test that only reads the row back will accept an invented or stale one.
// Each run therefore emits
//
//   * a traversal checksum, stirred once per box with that box's computed
//     bound and shape, so reproducing the value requires performing the
//     traversal rather than knowing the answer;
//   * SHA-256 of every input that determines the result -- the certificate
//     entry as canonical JSON, and each source file that defines the bound --
//     so a row goes stale visibly the moment any of them changes;
//   * every parameter and every terminal field, so nothing that decided the
//     outcome is left implicit;
//   * the replay command and the git commit the run was made at, so checking a
//     row is copy and paste and its provenance is not guesswork.
//
// The suite verifies the hashes on every row and replays the cheap rows in
// full.  Expensive rows it cannot replay; it says so rather than implying
// otherwise.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const I = require('./tiling_interval');

// Only the sources that actually determine a given mode's result are hashed,
// so a row goes stale when something relevant changes and not otherwise.  The
// fast path never touches tiling_rigorous.js.
const SOURCES = {
  fast: ['sweep.js', 'tiling_interval.js', 'tiling_research.js', 'tiling_additive.js'],
  rigorous: ['sweep.js', 'tiling_interval.js', 'tiling_rigorous.js',
    'tiling_research.js', 'tiling_additive.js']
};

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// Canonical form: key order fixed, numbers as their shortest round-tripping
// decimal, so the hash tracks the values rather than the file's formatting.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return typeof value === 'number' ? String(value) : JSON.stringify(value);
}

function inputHashes(entry, mode) {
  const hashes = {certificate: sha256(canonical(entry))};
  for (const file of SOURCES[mode]) {
    hashes[file] = sha256(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  }
  return hashes;
}

// Provenance only -- recorded, never compared, since a row stays valid across
// commits that do not touch a hashed source.
function headCommit() {
  try {
    return require('child_process')
      .execSync('git rev-parse --short HEAD', {cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore']})
      .toString().trim();
  } catch (error) {
    return 'unknown';
  }
}

function certificateEntry(name) {
  const shipped = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
  if (name !== 'bare') return shipped.certificates.find(c => c.name === name);
  const reference = shipped.certificates.find(c => c.name === 'compact');
  return {
    name: 'bare', knots: reference.knots,
    a: reference.knots.map(() => 0), b: reference.knots.map(() => 0),
    searchBox: 16, floor: 0.003826231218593872,
    note: 'zero potential: the reduced cost is the bare block functional'
  };
}

module.exports = {sha256, canonical, inputHashes, certificateEntry, SOURCES};

if (require.main !== module) return;

const mode = process.argv[2];
const name = process.argv[3];
const targets = process.argv.slice(4).map(Number);
if (!['fast', 'rigorous'].includes(mode) || !name || !targets.length) {
  console.error('usage: node dev/sweep.js {fast|rigorous} {compact|record|sharp|bare} target...');
  process.exit(2);
}
const entry = certificateEntry(name);
if (!entry) { console.error('unknown certificate', name); process.exit(2); }

const prepared = I.prepareCertificate({knots: entry.knots, a: entry.a, b: entry.b});
const tables = mode === 'fast' ? I.attachTables(I.buildTables(120)) : null;
const hashes = inputHashes(entry, mode);

for (const target of targets) {
  const started = Date.now();
  const result = mode === 'fast'
    ? I.verifyFloor(prepared, target, {tables, budget: 6e8, box: entry.searchBox})
    : I.verifyFloorRigorous(prepared, target, {budget: 6e8, box: entry.searchBox});
  console.log(JSON.stringify({
    mode, certificate: name, target,
    box: entry.searchBox,
    boxes: result.processed, collapsed: result.collapsed,
    complete: result.complete, remaining: result.remaining,
    unresolved: result.unresolved,
    counterexample: result.counterexample ? result.counterexample.value : null,
    checksum: result.checksum,
    seconds: +((Date.now() - started) / 1000).toFixed(1),
    inputs: hashes,
    replay: `node dev/sweep.js ${mode} ${name} ${target}`,
    commit: headCommit(),
    engine: `${process.version} ${process.platform}-${process.arch}`
  }));
  if (!result.complete) break;
}
