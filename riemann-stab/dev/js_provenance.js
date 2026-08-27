'use strict';
// Transitive provenance for the JavaScript transcripts.
//
// Every long sweep records a hash per input so a row goes stale visibly when
// something that determined it changes.  The lists were written by hand, and a
// review found the hole that guarantees: tiling_rigorous.js is required by
// tiling_interval.js (line 507) and by tiling_pair_interval.js, and appeared in
// NEITHER pair-sweep manifest.  It is the proved-enclosure arithmetic the whole
// rigorous path runs on.  A change to it left two transcripts costing 96 minutes
// and 8 minutes reading as fresh.
//
// Hand-maintained dependency lists decay because nothing forces them to be
// right.  So this walks `require('./x')` from the entry points instead, and
// dev/check_pair_sweep.js and dev/tiling_interval_test.js compare the walk
// against what a transcript declared.  Data files stay explicit -- a JSON path
// is not a require and cannot be found this way -- but code cannot go missing.

const fs = require('fs');
const path = require('path');

const LOCAL = /\brequire\(\s*['"](\.\/[^'"]+)['"]\s*\)/g;

function closure(entries, here = __dirname) {
  const seen = new Set();
  const queue = entries.slice();
  while (queue.length) {
    let name = queue.shift();
    if (!name.endsWith('.js')) name += '.js';
    name = path.basename(name);
    if (seen.has(name)) continue;
    const file = path.join(here, name);
    if (!fs.existsSync(file)) continue;
    seen.add(name);
    const src = fs.readFileSync(file, 'utf8');
    let m;
    LOCAL.lastIndex = 0;
    while ((m = LOCAL.exec(src)) !== null) queue.push(m[1]);
  }
  return [...seen].sort();
}

// Everything the entry points reach, plus the data files named explicitly.
function manifest(entries, data = [], here = __dirname) {
  return [...new Set([...closure(entries, here), ...data])].sort();
}

// What a transcript SHOULD have declared, minus what it did.  Empty is correct.
function missing(declared, entries, data = [], here = __dirname) {
  const want = manifest(entries, data, here);
  const have = new Set(Object.keys(declared));
  return want.filter(f => !have.has(f));
}

module.exports = {closure, manifest, missing};
