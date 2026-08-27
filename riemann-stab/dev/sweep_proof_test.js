'use strict';

// End-to-end check of the proof object: regenerate it and compare to the
// committed record.  The tape is deterministic -- same certificate, same
// subdivision rule, same bytes -- so a mismatch means the sweep's behaviour
// changed, which is exactly what a recorded proof is for.
//
// The committed configuration is a small one, cube 1.6, so this runs in a
// fraction of a second on every suite run.  It is a machinery check and not a
// block floor: the tail lemma's cube for this certificate is 28.  The full-cube
// proof is 53 million nodes and 53 MB, which is regenerated on demand rather
// than committed.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {execSync} = require('child_process');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
  if (!ok) failures++;
}

console.log('=== the sweep proof object ===');

const here = __dirname;
const metaPath = path.join(here, 'sweep_proof.json');
const recorded = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

check('the committed record is the small machinery configuration',
  recorded.cube < 28, `cube ${recorded.cube}, ${recorded.nodes} nodes`);

// Regenerate into a scratch directory, NOT over the committed object.  Running
// sweep_proof.js in place restamps its commit, so the suite left the worktree
// dirty on every run -- I claimed it did not, and a review showed me it did.
// The committed artefact is the record; the test rebuilds it elsewhere and
// checks the rebuild matches.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-proof-'));
const scratchBin = path.join(scratch, 'sweep_proof.bin');
require('./sweep_proof').emit(recorded.cube, recorded.tubeRadius, false,
  recorded.target, scratchBin);
const regenerated = JSON.parse(
  fs.readFileSync(scratchBin.replace(/\.bin$/, '.json'), 'utf8'));

check('regenerating the proof reproduces the same tape, byte for byte',
  regenerated.tape_sha256 === recorded.tape_sha256,
  regenerated.tape_sha256.slice(0, 16));
check('and the same node counts',
  regenerated.nodes === recorded.nodes
  && regenerated.leaves === recorded.leaves
  && regenerated.splits === recorded.splits
  && regenerated.collapses === recorded.collapses,
  `${regenerated.nodes} nodes, ${regenerated.leaves} leaves, `
  + `${regenerated.splits} splits, ${regenerated.collapses} collapses`);
check('with nothing left unresolved', regenerated.unresolved === 0);

const tape = fs.readFileSync(path.join(here, recorded.tape));
check('the tape on disk hashes to what the record says',
  crypto.createHash('sha256').update(tape).digest('hex') === recorded.tape_sha256);

// the tape must be structurally consumable: one pass, nothing left over
let pos = 0, leaves = 0, splits = 0, collapses = 0;
const D = require('./tiling_defect');
const roots = D.partition(recorded.cube, recorded.tubeRadius);
check('the root partition is the one the record counts',
  roots.length === recorded.roots, `${roots.length} pieces`);
for (let r = 0; r < roots.length; r++) {
  let depth = 1;
  while (depth > 0) {
    if (pos >= tape.length) break;
    const op = tape[pos++];
    if (op >= 0x20) { leaves++; depth--; }
    else if (op < 0x08) { splits++; depth++; }
    else collapses++;
  }
}
check('a one-pass walk consumes the tape exactly', pos === tape.length,
  `${pos} of ${tape.length} bytes`);
check('and recovers the recorded counts',
  leaves === recorded.leaves && splits === recorded.splits
  && collapses === recorded.collapses);

console.log(failures ? `\n${failures} FAILED` : '\nPROOF OBJECT CHECKS PASS');
process.exit(failures ? 1 : 0);
