'use strict';

// The pair sweep is far too large for a suite to replay, so the suite checks
// what it can: that the recorded row was produced by the sources now on disk,
// and that the row says what it is.  A matching hash is not a rerun and this
// file never calls it one.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const here = __dirname;
const ROWS = ['tiling_pair.sweep.json', 'tiling_pair.sweep.rigorous.json'];
let bad = 0;

for (const file of ROWS) {
  const full = path.join(here, file);
  if (!fs.existsSync(full)) { console.log('  MISSING ' + file); bad++; continue; }
  const row = JSON.parse(fs.readFileSync(full, 'utf8'));
  let stale = 0;
  for (const [src, recorded] of Object.entries(row.inputs)) {
    const actual = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(here, src))).digest('hex').slice(0, 16);
    if (actual !== recorded) {
      console.log(`  STALE ${src}: recorded ${recorded}, on disk ${actual}`);
      stale++;
    }
  }
  console.log('-- ' + file);
  if (stale) {
    console.log('   TRANSCRIPT STALE (' + stale + ' sources); rerun: ' + row.replay);
    bad++;
    continue;
  }
  console.log('   ' + row.precision);
  console.log('   cube ' + row.cube + ', tube radius ' + row.tubeRadius
    + ', target ' + row.target);
  console.log('   ' + row.boxes.toLocaleString('en-US') + ' boxes, '
    + row.collapses.toLocaleString('en-US') + ' collapses, complete=' + row.complete
    + ', unresolved=' + row.unresolved + ', ' + row.seconds + 's');
  console.log('   ' + row.caveat);
  console.log('   NOT rerun here; the hashes match, which means the row is not stale.');
  if (!row.complete || row.unresolved || row.counterexample) {
    console.log('   RECORDED SWEEP DID NOT COMPLETE');
    bad++;
  }
}
if (bad) process.exit(1);
console.log('pair sweep transcripts OK');
