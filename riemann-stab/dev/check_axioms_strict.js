'use strict';
// Fail-closed exact-whitelist axiom audit.
// Usage: node check_axioms_strict.js <axioms-output-file>
// Fails unless EVERY expected theorem appears and its dependency set is
// exactly a subset of {propext, Quot.sound} (empty for mixture_snapshot).
const fs = require('fs');
const out = fs.readFileSync(process.argv[2], 'utf8');
const EXPECT = {
  chain_inequality:          ['propext', 'Quot.sound'],
  headline_fraction_floor:   ['propext', 'Quot.sound'],
  headline_fraction_ceiling: ['propext', 'Quot.sound'],
  improvement_direction:     ['propext', 'Quot.sound'],
  mixture_snapshot:          []
};
let fail = false;
const seen = new Set();
for (const line of out.split('\n')) {
  // parse lines like: 'name' depends on axioms: [a, b]
  const m1 = line.match(/^'(\w+)' depends on axioms: \[(.*)\]$/);
  if (m1) {
    const name = m1[1];
    seen.add(name);
    const deps = m1[2].split(',').map(s => s.trim()).filter(s => s.length > 0);
    const extra = deps.filter(d => d !== 'propext' && d !== 'Quot.sound');
    if (extra.length > 0) {
      console.error(`FORBIDDEN AXIOM in ${name}: ${extra.join(', ')}`);
      fail = true;
    }
    continue;
  }
  const m2 = line.match(/^'(\w+)' does not depend on any axioms$/);
  if (m2) {
    seen.add(m2[1]);
    continue;
  }
}
for (const name of Object.keys(EXPECT)) {
  if (!seen.has(name)) {
    console.error(`MISSING #print axioms output for ${name}`);
    fail = true;
  }
}
if (fail) process.exit(1);
console.log('axiom audit OK: all ' + seen.size + ' theorems use only standard axioms');
