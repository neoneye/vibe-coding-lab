#!/usr/bin/env node
'use strict';

// Long-running sweep driver.  The suite only runs the cheap sweeps; the ones
// whose numbers are quoted in TILING_DUAL_RESEARCH.md and pinned in
// tiling_interval.results.json take minutes to hours and live here.
//
//   node dev/sweep.js fast     compact 0.0039 0.00394 0.003949
//   node dev/sweep.js rigorous compact 0.0038 0.0039
//   node dev/sweep.js fast     bare    0.0038
//
// `bare` is the zero potential, for which the reduced cost is the isolated
// block functional -- that run is the control that reproduces the published
// Proposition F6.  Each target runs to completion or to a counterexample;
// the driver stops at the first target it cannot clear.

const fs = require('fs');
const path = require('path');
const I = require('./tiling_interval');

const mode = process.argv[2];
const name = process.argv[3];
const targets = process.argv.slice(4).map(Number);
if (!['fast', 'rigorous'].includes(mode) || !name || !targets.length) {
  console.error('usage: node dev/sweep.js {fast|rigorous} {compact|record|bare} target...');
  process.exit(2);
}

const shipped = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
const reference = shipped.certificates.find(c => c.name === 'compact');
const entry = name === 'bare'
  ? {name: 'bare', knots: reference.knots, a: reference.knots.map(() => 0),
     b: reference.knots.map(() => 0), searchBox: 16}
  : shipped.certificates.find(c => c.name === name);
if (!entry) { console.error('unknown certificate', name); process.exit(2); }

const prepared = I.prepareCertificate({knots: entry.knots, a: entry.a, b: entry.b});
const tables = mode === 'fast' ? I.attachTables(I.buildTables(120)) : null;

for (const target of targets) {
  const started = Date.now();
  const result = mode === 'fast'
    ? I.verifyFloor(prepared, target, {tables, budget: 6e8, box: entry.searchBox})
    : I.verifyFloorRigorous(prepared, target, {budget: 6e8, box: entry.searchBox});
  console.log(JSON.stringify({
    mode, certificate: name, target,
    boxes: result.processed, collapsed: result.collapsed,
    complete: result.complete, remaining: result.remaining, unresolved: result.unresolved,
    counterexample: result.counterexample ? result.counterexample.value : null,
    seconds: +((Date.now() - started) / 1000).toFixed(1)
  }));
  if (!result.complete) break;
}
