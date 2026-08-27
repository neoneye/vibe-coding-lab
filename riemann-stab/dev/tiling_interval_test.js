'use strict';

const fs = require('fs');
const path = require('path');
const T = require('./tiling_research');
const A = require('./tiling_additive');
const I = require('./tiling_interval');
const JS = require('./js_provenance');

let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('  OK  ', name);
  else { failed++; console.error('  FAIL', name, detail); }
}

const certificates = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
const compactEntry = certificates.certificates.find(c => c.name === 'compact');
const compact = {knots: compactEntry.knots, a: compactEntry.a, b: compactEntry.b};
const zero = {knots: compactEntry.knots, a: compactEntry.knots.map(() => 0), b: compactEntry.knots.map(() => 0)};

const tables = I.attachTables(I.buildTables(120));

// ------------------------------------------------ one-dimensional ranges
// Everything rests on these being true enclosures.  Brute force is the only
// honest check: if a range is ever narrower than the sampled extremes, the
// whole sweep is worthless.
let wViolations = 0, dwViolations = 0, wSlack = 0;
let seed = 12345;
const random = () => { seed = (1103515245 * seed + 12345) % 2147483648; return seed / 2147483648; };
for (let trial = 0; trial < 2500; trial++) {
  const a = random() * 40;
  const b = a + random() * 4;
  let lo = Infinity, hi = -Infinity, dlo = Infinity, dhi = -Infinity;
  const steps = 1500;
  for (let s = 0; s <= steps; s++) {
    const x = a + (b - a) * s / steps;
    const v = T.overlapWeight(x);
    if (v < lo) lo = v; if (v > hi) hi = v;
    const d = T.overlapWeightDerivative(x);
    if (d < dlo) dlo = d; if (d > dhi) dhi = d;
  }
  const r = I.wRange(tables, a, b);
  const rd = I.dwRange(tables, a, b);
  if (r[0] > lo + 1e-12 || r[1] < hi - 1e-12) wViolations++;
  if (rd[0] > dlo + 1e-9 || rd[1] < dhi - 1e-9) dwViolations++;
  wSlack = Math.max(wSlack, (lo - r[0]) + (r[1] - hi));
}
check('weight range is a true enclosure', wViolations === 0, `${wViolations}`);
check('weight derivative range is a true enclosure', dwViolations === 0, `${dwViolations}`);
// This bounds how much wider the enclosure is than a 1500-point sample of the
// same interval, so it is dominated by the sampling error near a flat extremum.
// It catches a breakpoint table that misses whole monotone pieces, which would
// inflate the range grossly rather than by parts in a million.
check('weight range is not grossly inflated', wSlack < 2e-5, `${wSlack}`);

// The fast sparse-table queries must agree with the naive scan exactly.
const prepared = I.prepareCertificate(compact);
let fastMismatch = 0;
for (let trial = 0; trial < 20000; trial++) {
  const a = random() * 17;
  const b = a + random() * 3;
  const fast = I.plRangeFast(prepared, prepared.a, a, b);
  const slow = I.plRange(compact.knots, compact.a, a, b);
  if (Math.abs(fast[0] - slow[0]) > 1e-15 || Math.abs(fast[1] - slow[1]) > 1e-15) fastMismatch++;
  const fastSlope = I.slopeWithFlat(prepared, prepared.b, a, b);
  const slowSlope = I.plSlopeRange(compact.knots, compact.b, a, b);
  if (fastSlope[0] > slowSlope[0] + 1e-12 || fastSlope[1] < slowSlope[1] - 1e-12) fastMismatch++;
}
check('sparse range queries match the naive scan', fastMismatch === 0, `${fastMismatch}`);

// ------------------------------------------------------- the sweep itself
// A verifier that never fails proves nothing, so both directions are pinned.
const pass = I.verifyFloor(prepared, 0.0033, {tables, budget: 3e6, box: compactEntry.searchBox});
check('sweep completes at 0.0033 on the compact certificate', pass.complete,
  `${pass.processed} boxes, remaining ${pass.remaining}`);
check('completed sweep leaves no under-resolved box', pass.unresolved === 0);
check('completed sweep found no counterexample', pass.counterexample === null);

const fail = I.verifyFloor(prepared, 0.006, {tables, budget: 3e6, box: compactEntry.searchBox, dive: true});
check('sweep refuses an impossible floor', !fail.complete && fail.counterexample !== null,
  `${JSON.stringify(fail.counterexample)}`);
check('the counterexample it returns is real',
  fail.counterexample && A.additiveReducedCost(fail.counterexample.gaps, compact) < 0.006,
  `${fail.counterexample && fail.counterexample.value}`);

// With the zero certificate the reduced cost is the bare block functional, so
// this is a sweep of the published local proposition rather than of the chain.
const bare = I.verifyFloor(I.prepareCertificate(zero), 0.0035, {tables, budget: 3e6, box: 16});
check('sweep completes at 0.0035 on the bare block functional', bare.complete,
  `${bare.processed} boxes`);



// On a degenerate box the analysis must reproduce the very function the
// certificate was audited against.  If these ever disagreed, the sweep would be
// bounding something else.
const degenerateFast = I.newScratch();
const degenerateRigorous = I.newScratch();
let identityError = 0, rigorousAbove = 0, rigorousBelow = 0;
for (let trial = 0; trial < 40000; trial++) {
  const point = Array.from({length: 6}, () => random() * 5);
  const lo = Float64Array.from(point), hi = Float64Array.from(point);
  I.analyzeBox(tables, prepared, lo, hi, degenerateFast);
  I.analyzeBoxRigorous(prepared, lo, hi, degenerateRigorous);
  const truth = A.additiveReducedCost(point, compact);
  identityError = Math.max(identityError, Math.abs(degenerateFast.bound - truth));
  rigorousAbove = Math.max(rigorousAbove, degenerateRigorous.bound - truth);
  rigorousBelow = Math.max(rigorousBelow, truth - degenerateRigorous.bound);
}
check('degenerate box reproduces the audited reduced cost exactly',
  identityError === 0, `${identityError}`);
check('rigorous bound never exceeds the true value', rigorousAbove <= 0, `${rigorousAbove}`);
check('rigorous bound stays within its accumulation slack',
  rigorousBelow < 5e-12, `${rigorousBelow}`);

// ------------------------------------------------------- rigorous variant
// The rigorous analysis must be weaker than the table version everywhere: its
// value bound no higher, its gradient enclosure no narrower.  If it were ever
// tighter, one of the two would be wrong.
const scratchFast = I.newScratch();
const scratchRigorous = I.newScratch();
let orderFailures = 0;
for (let trial = 0; trial < 4000; trial++) {
  const lo = new Float64Array(6);
  const hi = new Float64Array(6);
  for (let k = 0; k < 6; k++) { lo[k] = random() * 4; hi[k] = lo[k] + random() * 0.4; }
  I.analyzeBox(tables, prepared, lo, hi, scratchFast);
  I.analyzeBoxRigorous(prepared, lo, hi, scratchRigorous);
  if (scratchRigorous.bound > scratchFast.bound + 1e-12) orderFailures++;
  for (let k = 0; k < 6; k++) {
    if (scratchRigorous.grad[2 * k] > scratchFast.grad[2 * k] + 1e-10) orderFailures++;
    if (scratchRigorous.grad[2 * k + 1] < scratchFast.grad[2 * k + 1] - 1e-10) orderFailures++;
  }
}
check('rigorous box analysis is weaker than the table version everywhere',
  orderFailures === 0, `${orderFailures}`);

const rigorous = I.verifyFloorRigorous(prepared, 0.002, {budget: 2e6, box: compactEntry.searchBox});
check('rigorous sweep completes at 0.002', rigorous.complete,
  `${rigorous.processed} boxes, remaining ${rigorous.remaining}`);

// --------------------------------------------------- recorded long sweeps
// A recorded row is not evidence on its own.  Three things are checked.
//
//  1. The input hashes.  Every row records SHA-256 of the certificate entry and
//     of each source file that determines its mode's result, so a row that
//     predates a change to any of them is caught rather than silently believed.
//     This is what exposed a `compact 0.00385` row left over from before the
//     derivative sign test gained its safety margin.
//  2. Replay, for every row cheap enough to redo here.  The traversal checksum
//     is stirred once per box with that box's computed bound and shape, so
//     matching it requires performing the traversal, not knowing the answer.
//  3. For rows too expensive to replay in a test suite, the checks above and
//     nothing more.  Those rows are listed as unreplayed, with their replay
//     command, and the suite says so instead of implying they were verified.
const results = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_interval.results.json'), 'utf8'));
const sweep = require('./sweep');

check('recorded sweeps declare their arithmetic honestly', /double precision/.test(results.scope));

const REPLAY_BUDGET_BOXES = 3.5e5;    // keeps the suite near a minute
let replayed = 0, unreplayed = 0, staleInputs = 0, checksumMismatches = 0;
const allRows = [...results.runs, ...(results.rigorousRuns || [])];
for (const row of allRows) {
  if (!row.inputs || !row.checksum) {
    staleInputs++;                    // pre-transcript row: no evidence at all
    continue;
  }
  const entry = sweep.certificateEntry(row.certificate);
  const current = sweep.inputHashes(entry, row.mode);
  for (const key of Object.keys(row.inputs)) {
    if (current[key] !== row.inputs[key]) staleInputs++;
  }
  if (row.boxes <= REPLAY_BUDGET_BOXES) {
    const prepared = I.prepareCertificate({knots: entry.knots, a: entry.a, b: entry.b});
    const rerun = row.mode === 'fast'
      ? I.verifyFloor(prepared, row.target, {tables, budget: 6e8, box: entry.searchBox})
      : I.verifyFloorRigorous(prepared, row.target, {budget: 6e8, box: entry.searchBox});
    if (rerun.checksum !== row.checksum || rerun.processed !== row.boxes
        || rerun.complete !== row.complete) checksumMismatches++;
    replayed++;
  } else {
    unreplayed++;
  }
}
// A detector that never fires proves nothing, so the detector is tested: a row
// with one digit of its checksum changed, and a row whose certificate hash is
// wrong, must both be caught.
{
  const row = allRows.find(r => r.boxes <= REPLAY_BUDGET_BOXES);
  const entry = sweep.certificateEntry(row.certificate);
  const prepared = I.prepareCertificate({knots: entry.knots, a: entry.a, b: entry.b});
  const rerun = row.mode === 'fast'
    ? I.verifyFloor(prepared, row.target, {tables, budget: 6e8, box: entry.searchBox})
    : I.verifyFloorRigorous(prepared, row.target, {budget: 6e8, box: entry.searchBox});
  const tampered = row.checksum.replace(/^./, c => c === 'a' ? 'b' : 'a');
  check('a tampered checksum is caught', rerun.checksum !== tampered, `${tampered}`);
  const honest = sweep.inputHashes(entry, row.mode);
  const forged = Object.assign({}, row.inputs, {certificate: '0'.repeat(16)});
  check('a forged certificate hash is caught',
    Object.keys(forged).some(k => honest[k] !== forged[k]));
  // and the checksum must actually depend on the traversal, not just its length
  const neighbour = row.mode === 'fast'
    ? I.verifyFloor(prepared, row.target * 0.999, {tables, budget: 6e8, box: entry.searchBox})
    : I.verifyFloorRigorous(prepared, row.target * 0.999, {budget: 6e8, box: entry.searchBox});
  check('the checksum separates two nearby traversals',
    neighbour.checksum !== rerun.checksum);
}

// The row manifests are walked from sweep.js the same way sweep.js builds them,
// so an incomplete DECLARATION fails here and not only a changed declared file.
// tiling_rigorous.js was the one that got away: required unconditionally by
// tiling_interval.js, absent from every fast row's manifest.
{
  const rows = [...results.runs, ...results.rigorousRuns];
  const short = rows.filter(r => JS.missing(r.inputs, ['sweep.js'], [], __dirname).length);
  check('every recorded row declares everything sweep.js loads',
    short.length === 0,
    short.length
      ? `${short.length} rows missing ${JS.missing(short[0].inputs, ['sweep.js'], [], __dirname).join(', ')}`
      : '');
}

check('every recorded row carries a transcript', staleInputs === 0,
  `${staleInputs} rows with missing or stale input hashes`);
check('every replayable row replays to the same checksum', checksumMismatches === 0,
  `${checksumMismatches}`);
const replayedModes = new Set(allRows.filter(r => r.boxes <= REPLAY_BUDGET_BOXES).map(r => r.mode));
check('both modes have at least one row replayed in full',
  replayedModes.has('fast') && replayedModes.has('rigorous'),
  `replayed modes: ${[...replayedModes].join(', ') || 'none'}`);
console.log(`         (${replayed} rows replayed in full, ${unreplayed} too large to replay here)`);

for (const row of allRows) {
  const reference = row.certificate === 'bare'
    ? 0.003826231218593872
    : certificates.certificates.find(c => c.name === row.certificate).floor;
  if (row.complete) {
    check(`recorded completion at ${row.target} (${row.mode} ${row.certificate})`,
      row.target < reference, `${row.target} vs ${reference}`);
  } else {
    check(`recorded refusal at ${row.target} (${row.mode} ${row.certificate})`,
      row.target > reference - 1e-9, `${row.target} vs ${reference}`);
  }
}
// The distinction the field names now carry.  A floor is "replayed" only if the
// suite redid its traversal here; "transcripted" means the row is authenticated
// but too large to redo in a test.  Calling the second one verified is what let
// a stale row stand, so the pins are separate and both are asserted.
const REPLAYABLE = r => r.complete && r.certificate !== 'bare' && r.boxes <= REPLAY_BUDGET_BOXES;
const TRANSCRIPTED = r => r.complete && r.certificate !== 'bare';
const bestOf = (rows, pred) => {
  const values = rows.filter(pred).map(r => r.target);
  return values.length ? Math.max(...values) : null;
};
check('replayed fast floor pin',
  bestOf(results.runs, REPLAYABLE) === results.bestReplayedFastFloor,
  `${bestOf(results.runs, REPLAYABLE)}`);
check('transcripted fast floor pin',
  bestOf(results.runs, TRANSCRIPTED) === results.bestTranscriptedFastFloor,
  `${bestOf(results.runs, TRANSCRIPTED)}`);
check('replayed rigorous floor pin',
  bestOf(results.rigorousRuns, REPLAYABLE) === results.bestReplayedRigorousFloor,
  `${bestOf(results.rigorousRuns, REPLAYABLE)}`);
check('transcripted rigorous floor pin',
  bestOf(results.rigorousRuns, TRANSCRIPTED) === results.bestTranscriptedRigorousFloor,
  `${bestOf(results.rigorousRuns, TRANSCRIPTED)}`);
check('the file refuses to call anything simply "verified"',
  /Nothing here is called "verified"/.test(results.naming));
// The rigorous rung is the one that would carry a claim, so its status is
// asserted explicitly rather than inferred from a maximum.
// The rigorous rung is the one that would carry a claim, so where it stands
// relative to the published local floor is asserted explicitly rather than left
// to be inferred from a maximum.  It currently reaches 19/5000 and does not
// exceed it: matching the published certificate, not improving on it.
check('the rigorous ladder reaches the published local floor',
  results.bestTranscriptedRigorousFloor >= 19 / 5000 - 1e-12,
  `${results.bestTranscriptedRigorousFloor}`);
check('and does not yet exceed it',
  results.bestTranscriptedRigorousFloor <= 19 / 5000 + 1e-12,
  `${results.bestTranscriptedRigorousFloor} -- if this fires the ladder moved and both surfaces need updating`);

// --------------------------------- the tables against certified breakpoints
// The sweep finds its w' breakpoints by scanning sign changes of a FINITE
// DIFFERENCE second derivative.  dev/kernel_pieces_arb.py finds the same
// breakpoints by interval Newton in Arb and proves w'' vanishes on each
// enclosure, so it is the authority the scan can be measured against.  This
// check exists because that measurement is the entire justification for the
// constant DW_BREAK_SLACK, and a justification nobody re-runs decays.
{
  const cert = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'kernel_pieces_arb.results.json'), 'utf8'));
  const LIM = cert.limit;
  const small = I.attachTables(I.buildTables(LIM));
  // The sweep's tables are padded: 0 at the front (twice, for w, since 0 is
  // both the left edge and a zero of K) and the scan limit at the back.  Arb
  // lists only the interior stationary points, so compare interiors.
  const inRange = xs => Array.from(new Set(Array.from(xs).filter(x => x > 0 && x < LIM)))
    .sort((a, b) => a - b);
  const mine = {w: inRange(small.wBreaks), d: inRange(small.dwBreaks)};
  const byMid = ps => ps.map(b => b.mid).filter(x => x > 0 && x < LIM).sort((a, b) => a - b);
  const theirs = {w: byMid(cert.w_break_points), d: byMid(cert.wd_break_points)};
  const certD = cert.wd_break_points.slice().sort((a, b) => a.mid - b.mid)
    .filter(b => b.mid > 0 && b.mid < LIM);
  check('the transcript carries the certified breakpoints, not just their count',
    Array.isArray(cert.w_break_points) && Array.isArray(cert.wd_break_points));
  check('the sweep finds the same number of w breakpoints as Arb certifies',
    mine.w.length === theirs.w.length, `${mine.w.length} vs ${theirs.w.length}`);
  check("and the same number of w' breakpoints",
    mine.d.length === theirs.d.length, `${mine.d.length} vs ${theirs.d.length}`);

  const gap = (a, b) => a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0);
  if (mine.w.length === theirs.w.length) {
    // These are roots of an exact w', so they should be near machine accurate.
    check('the w breakpoints agree to better than 1e-13',
      gap(mine.w, theirs.w) < 1e-13, `worst ${gap(mine.w, theirs.w).toExponential(3)}`);
  }
  if (mine.d.length === theirs.d.length) {
    const worstPos = gap(mine.d, theirs.d);
    // The finite difference used h = 1e-4, and a centred difference of a smooth
    // function displaces a stationary point by O(h^2) -- so 1e-8 is the size to
    // expect, and the measured worst is 7.7e-9.  Asserting 1e-7 leaves room for
    // the scan grid to change without turning this into a tripwire, while still
    // failing loudly if someone loosens h.
    check("the w' breakpoints agree to better than 1e-7",
      worstPos < 1e-7, `worst ${worstPos.toExponential(3)}`);

    // The point of the whole check: how much w' VALUE that displacement can
    // cost.  w'' vanishes at a certified breakpoint b, so
    //   |w'(b + d) - w'(b)| <= max|third derivative| / 2 * d^2
    // over the neighbourhood, and w3 in the transcript is a certified bound on
    // that third derivative within 1e-6 of b -- comfortably wider than any d here.
    let worstLoss = 0, outside = 0;
    for (let i = 0; i < mine.d.length; i++) {
      const b = certD[i];
      const d = Math.abs(mine.d[i] - b.mid) + b.rad;
      if (d > 1e-6) { outside++; continue; }
      worstLoss = Math.max(worstLoss, 0.5 * b.w3 * d * d);
    }
    check('every displacement stays inside the neighbourhood w3 was certified on',
      outside === 0, `${outside} outside`);
    check("and the widening covers the w' value it can cost",
      I.DW_BREAK_SLACK > worstLoss,
      `slack ${I.DW_BREAK_SLACK.toExponential(3)} vs loss ${worstLoss.toExponential(3)}`);
    // Not merely covered: covered with room, so that a small drift in the scan
    // does not silently eat the margin.
    check('with at least a factor of two to spare',
      I.DW_BREAK_SLACK > 2 * worstLoss,
      `ratio ${(I.DW_BREAK_SLACK / worstLoss).toFixed(1)}`);
  }

  // And the widening must actually reach the caller -- it would be easy to
  // define the constant and then return the untouched tabulated range.
  const rr = I.dwRange(small, 1.2, 1.26);
  const raw = I.rangeByBreaks(small.dw, small.dwBreaks, small.dwTable, 1.2, 1.26, small.limit);
  check('dwRange returns the widened range, not the raw tabulated one',
    rr[0] < raw[0] && rr[1] > raw[1], `${rr[0]} vs ${raw[0]}`);
}

if (failed) {
  console.error(`${failed} interval-sweep checks failed`);
  process.exit(1);
}
console.log('INTERVAL SWEEP CHECKS PASS');
