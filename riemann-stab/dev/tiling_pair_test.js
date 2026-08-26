'use strict';

const fs = require('fs');
const path = require('path');
const P = require('./tiling_pair');
const A = require('./tiling_additive');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
  if (!ok) failures++;
}

console.log('=== pair-state coboundary ===');

const cand = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'tiling_pair.candidate.json'), 'utf8'));
const bundle = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
const certs = bundle.certificates;
const base = (Array.isArray(certs) ? certs : Object.values(certs))
  .find(e => e.name === cand.base);
const cert = P.prepare(cand, base);

const LOW = 1.0416801034484870;
const HIGH = 1.9794672314032244;
const EALT = 0.003957393309109344;

let seed = 20260826;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// ---- the identity everything rests on
let worst = 0;
for (let t = 0; t < 40; t++) {
  const n = 7 + Math.floor(rnd() * 13);
  const g = Array.from({length: n}, () => 0.6 + rnd() * 2.4);
  worst = Math.max(worst, P.telescopingDefect(cert, g));
}
check('the coboundary cancels over a periodic chain', worst < 1e-14,
  `max defect ${worst.toExponential(3)} over 40 rings`);

// ---- the ceiling, which is structural and applies to every telescoping form
const alt0 = [LOW, HIGH, LOW, HIGH, LOW, HIGH];
const alt1 = [HIGH, LOW, HIGH, LOW, HIGH, LOW];
const mean = (P.reducedCost(alt0, cert) + P.reducedCost(alt1, cert)) / 2;
check('the two alternating phases average to the alternating energy',
  Math.abs(mean - EALT) < 1e-14, mean.toFixed(15));

// ---- the additive family is a special case, so this is a strict widening
// psi_k(x,y) = p_k(x) + q_k(y) with q_1 = -a, q_5 = a, q_2..q_4 = 0 and
// p = (a, a+b, -a-b, -a-b, b) reproduces SIGN_A * a + SIGN_B * b exactly.
function additiveAsPairs(gaps, entry) {
  const v = x => A.piecewiseLinear(entry.knots, entry.a, x);
  const u = x => A.piecewiseLinear(entry.knots, entry.b, x);
  const p = [x => v(x), x => v(x) + u(x), x => -v(x) - u(x),
    x => -v(x) - u(x), x => u(x)];
  const q = [y => -v(y), () => 0, () => 0, () => 0, y => v(y)];
  let total = 0;
  for (let k = 0; k < 5; k++) total += p[k](gaps[k]) + q[k](gaps[k + 1]);
  return total;
}
let embedError = 0;
for (let t = 0; t < 300; t++) {
  const g = Array.from({length: 6}, () => 0.4 + rnd() * 3.0);
  const direct = A.additiveReducedCost(g, base)
    - require('./tiling_research').blockFunctional(g, 3000);
  embedError = Math.max(embedError, Math.abs(additiveAsPairs(g, base) - direct));
}
check('every additive certificate is a pair certificate', embedError < 1e-14,
  `max mismatch ${embedError.toExponential(3)} over 300 blocks`);

// ---- the candidate, audited by an adversary that shares no code with the
//      Python search that produced it
const audit = P.multistart(cert, {starts: 1500, seed: 0x13572468});
check('the JavaScript adversary reproduces the claimed floor',
  Math.abs(audit.floor - cand.adversaryFloor) < 1e-12,
  `${audit.floor.toFixed(15)} against ${cand.adversaryFloor.toFixed(15)}`);
check('and it binds at a near-alternating block, not at a defect',
  audit.gaps.every((x, i) => Math.abs(x - (i % 2 === 0 ? LOW : HIGH)) < 5e-3),
  audit.gaps.map(x => x.toFixed(5)).join(' '));
check('the candidate is above the additive record it corrects',
  audit.floor > base.floor,
  `+${(audit.floor - base.floor).toExponential(3)} on ${base.floor.toFixed(12)}`);
check('and below the structural ceiling, as it must be',
  audit.floor < EALT, `short by ${(EALT - audit.floor).toExponential(3)}`);
check('the correction is small enough to leave the tail cube alone',
  Math.max(...cand.coefficients.map(Math.abs)) < 1e-4,
  `sup |psi| = ${Math.max(...cand.coefficients.map(Math.abs)).toExponential(3)}`);

console.log(failures ? `\n${failures} FAILED` : '\nPAIR COBOUNDARY CHECKS PASS');
process.exit(failures ? 1 : 0);
