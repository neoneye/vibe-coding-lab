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
  {src: 'kink_arb.py', results: 'kink_arb.results.json'},
  {src: 'tube_arb.py', results: 'tube_arb.results.json'},
  {src: 'branch_arb.py', results: 'branch_arb.results.json'}
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
  console.log('-- ' + unit.src + ': ' + recorded.what);
  // The transcript must carry a hash for every file its result depends on --
  // its own source, the modules it imports, and the certificate data it reads.
  // It used to carry one hash, of its own source, so a change to
  // coercivity_arb.py (imported by three of the four) left three transcripts
  // reading as fresh.  A transcript with no such map is refused outright rather
  // than checked leniently.
  if (!recorded.inputs || typeof recorded.inputs !== 'object') {
    console.log('   TRANSCRIPT HAS NO DEPENDENCY MAP; rerun: ' + recorded.replay);
    failed = true;
    continue;
  }
  // A declared dependency map is only as good as its declaration.  Read the
  // script and check that every local module it imports and every data file it
  // opens is actually in the map -- otherwise the next omission is silent in
  // exactly the way the last one was.
  const text = fs.readFileSync(src, 'utf8');
  const needed = new Set([unit.src]);
  for (const m of text.matchAll(/^import\s+([A-Za-z_][\w]*)/gm)) {
    if (fs.existsSync(path.join(here, m[1] + '.py'))) needed.add(m[1] + '.py');
  }
  for (const m of text.matchAll(/"([\w.]+\.json)"/g)) {
    if (fs.existsSync(path.join(here, m[1]))) needed.add(m[1]);
  }
  const missing = [...needed].filter(n => !(n in recorded.inputs)
    && n !== unit.results.split('/').pop());
  if (missing.length) {
    console.log('   DEPENDENCY MAP INCOMPLETE, missing: ' + missing.join(', '));
    failed = true;
    continue;
  }

  let stale = 0;
  for (const [dep, want] of Object.entries(recorded.inputs)) {
    const path_ = path.join(here, dep);
    if (!fs.existsSync(path_)) { console.log('   MISSING ' + dep); stale++; continue; }
    const got = crypto.createHash('sha256').update(fs.readFileSync(path_)).digest('hex');
    if (got !== want) {
      console.log('   STALE ' + dep + ': recorded ' + want.slice(0, 16)
        + ', on disk ' + got.slice(0, 16));
      stale++;
    }
  }
  if (stale) {
    console.log('   TRANSCRIPT STALE (' + stale + ' of '
      + Object.keys(recorded.inputs).length + ' inputs); rerun: ' + recorded.replay);
    failed = true;
    continue;
  }
  if (!exe) {
    console.log('   Arb not available here; NOT rerun.  All '
      + Object.keys(recorded.inputs).length + ' declared inputs match, which means');
    console.log('   the transcript is not stale -- it does not mean it was checked.');
    console.log('   To check it: pip install python-flint, then');
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
