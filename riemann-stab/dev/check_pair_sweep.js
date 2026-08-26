'use strict';

// The pair sweep is far too large for a suite to replay, so the suite checks
// what it can: that the recorded row was produced by the sources now on disk,
// and that the row says what it is.  A matching hash is not a rerun and this
// file never calls it one.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const here = __dirname;
const row = JSON.parse(fs.readFileSync(path.join(here, 'tiling_pair.sweep.json'), 'utf8'));

let stale = 0;
for (const [file, recorded] of Object.entries(row.inputs)) {
  const actual = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(here, file))).digest('hex').slice(0, 16);
  if (actual !== recorded) {
    console.log(`  STALE ${file}: recorded ${recorded}, on disk ${actual}`);
    stale++;
  }
}
if (stale) {
  console.log('PAIR SWEEP TRANSCRIPT STALE (' + stale + ' sources)');
  console.log('  rerun: ' + row.replay);
  process.exit(1);
}

console.log('  recorded: ' + row.precision);
console.log('  cube ' + row.cube + ', tube radius ' + row.tubeRadius
  + ', target ' + row.target);
console.log('  ' + row.boxes.toLocaleString('en-US') + ' boxes, '
  + row.collapses.toLocaleString('en-US') + ' collapses, complete=' + row.complete
  + ', unresolved=' + row.unresolved);
console.log('  ' + row.caveat);
console.log('  NOT rerun here; the hashes match, which means the row is not stale.');

if (!row.complete || row.unresolved || row.counterexample) {
  console.log('RECORDED SWEEP DID NOT COMPLETE');
  process.exit(1);
}
if (row.cube >= 28) {
  console.log('  (full tail-lemma cube)');
}
console.log('pair sweep transcript OK');
