'use strict';

// The Arb confirmation of the local coercivity theorem is the only part of this
// directory whose arithmetic is not mine.  That makes it the most valuable
// check here and the one most likely to be silently absent, because it needs a
// package the suite cannot assume: python-flint.
//
// So the suite does two different things depending on what it finds, and says
// which.  If Arb is present it reruns the whole certification.  If not, it
// verifies that the recorded transcript was produced by the current source --
// which catches a stale result, and catches nothing else.  A matching hash is
// not a rerun and this file never calls it one.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execFileSync} = require('child_process');

const here = __dirname;
const UNITS = [
  {src: 'coercivity_arb.py', results: 'coercivity_arb.results.json'},
  {src: 'kink_arb.py', results: 'kink_arb.results.json'}
];

function findInterpreter() {
  const candidates = [];
  if (process.env.ARB_PYTHON) candidates.push(process.env.ARB_PYTHON);
  candidates.push('python3', 'python');
  for (const exe of candidates) {
    try {
      execFileSync(exe, ['-c', 'import flint'], {stdio: 'ignore'});
      return exe;
    } catch (_) { /* not this one */ }
  }
  return null;
}

const exe = findInterpreter();
let failed = false;

for (const unit of UNITS) {
  const src = path.join(here, unit.src);
  const results = path.join(here, unit.results);
  const recorded = JSON.parse(fs.readFileSync(results, 'utf8'));
  const actual = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
  console.log('-- ' + unit.src + ': ' + recorded.what);
  if (recorded.source_sha256 !== actual) {
    console.log('   TRANSCRIPT STALE');
    console.log('   recorded for source ' + recorded.source_sha256.slice(0, 16));
    console.log('   current source is   ' + actual.slice(0, 16));
    console.log('   rerun: ' + recorded.replay);
    failed = true;
    continue;
  }
  if (!exe) {
    console.log('   Arb not available here; NOT rerun.  The transcript matches the');
    console.log('   current source, which means it is not stale -- it does not mean');
    console.log('   it was checked.  To check it: pip install python-flint, then');
    console.log('   ' + recorded.replay);
    const bad = recorded.checks.filter(c => !c.ok);
    if (bad.length) { console.log('   RECORDED RUN HAD FAILURES'); failed = true; continue; }
    console.log('   recorded: ' + recorded.checks.length + ' checks, all passed');
    continue;
  }
  const before = fs.readFileSync(results, 'utf8');
  let out;
  try {
    out = execFileSync(exe, [src], {cwd: here, encoding: 'utf8'});
  } catch (e) {
    console.log((e.stdout || '') + (e.stderr || ''));
    console.log('   ARB CERTIFICATION FAILED');
    failed = true;
    continue;
  }
  process.stdout.write(out.replace(/^/gm, '   '));
  if (before !== fs.readFileSync(results, 'utf8')) {
    console.log('   RESULTS CHANGED ON RERUN -- the committed transcript was wrong');
    failed = true;
    continue;
  }
  console.log('   rerun agrees with the committed transcript.');
}

process.exit(failed ? 1 : 0);
