'use strict';

const fs = require('fs');
const path = require('path');
const T = require('./tiling_research');
const A = require('./tiling_additive');

let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('  OK  ', name);
  else { failed++; console.error('  FAIL', name, detail); }
}
function close(a, b, tolerance) { return Math.abs(a - b) <= tolerance; }

function lcg(seed) {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; };
}

// ---------------------------------------------------------------- gradient
const probe = [1.31, 0.72, 2.24, 3.08, 0.91, 1.83];
const demoKnots = [0, 0.4, 0.9, 1.4, 1.9, 2.4, 3.1, 4.2, 14];
const demo = {
  knots: demoKnots,
  a: [0.001, -0.002, 0.003, 0.0005, -0.001, 0.002, -0.0015, 0.0009, 0.0004],
  b: [-0.002, 0.001, 0.0004, -0.003, 0.002, 0.001, 0.0006, -0.0008, 0.0011]
};
const analytic = A.additiveReducedCostAndGradient(probe, demo).gradient;
let gradientError = 0;
for (let i = 0; i < 6; i++) {
  const left = probe.slice(); left[i] -= 1e-7;
  const right = probe.slice(); right[i] += 1e-7;
  const finite = (A.additiveReducedCost(right, demo) - A.additiveReducedCost(left, demo)) / 2e-7;
  gradientError = Math.max(gradientError, Math.abs(finite - analytic[i]));
}
check('analytic reduced-cost gradient', gradientError < 5e-9, `${gradientError}`);

// ------------------------------------------------- structural identities
// The normal form is reversal invariant, which is exactly what makes the
// reflection quotient legal in the adversarial search.  The earlier oriented
// Walsh family did NOT have this property; that is the pinned autopsy.
const random = lcg(0x1234abcd);
let reversalError = 0;
for (let trial = 0; trial < 400; trial++) {
  const gaps = Array.from({length: 6}, () => 0.1 + 4.5 * random());
  reversalError = Math.max(reversalError, Math.abs(
    A.additiveReducedCost(gaps, demo) - A.additiveReducedCost(gaps.slice().reverse(), demo)));
}
check('normal form is reversal invariant', reversalError < 1e-14, `${reversalError}`);

// On the two alternating blocks every feature cancels, so no additive
// antisymmetric certificate can ever beat the alternating chain energy.
for (const block of A.alternatingBlocks()) {
  const bare = T.blockFunctional(block, 3000);
  check(`alternating block sees no potential (${block[0] < block[1] ? 'LH' : 'HL'})`,
    close(A.additiveReducedCost(block, demo), bare, 1e-17), `${bare}`);
  check(`alternating block sits at the ceiling (${block[0] < block[1] ? 'LH' : 'HL'})`,
    close(bare, A.ALTERNATING_CEILING, 2e-15), `${bare}`);
}

// Completeness of the normal form: build an arbitrary additive potential
// Phi(s) = sum_k psi_k(s_k), antisymmetrise it under reversal, and check that
// the resulting reduced edge cost is exactly the (a, b) normal form with
// a = -psi'_1 and b = psi'_1 - psi'_2.
function makePsi(seed) {
  const random2 = lcg(seed);
  return Array.from({length: 5}, () =>
    demoKnots.map(() => 0.004 * (random2() - 0.5)));
}
function additivePotential(psi, state) {
  let out = 0;
  for (let k = 0; k < 5; k++) out += A.piecewiseLinear(demoKnots, psi[k], state[k]);
  return out;
}
function orientedReduced(psi, gaps) {
  return T.blockFunctional(gaps, 3000)
    + additivePotential(psi, gaps.slice(1))
    - additivePotential(psi, gaps.slice(0, 5));
}
const psi = makePsi(0x77aa11);
const antisymmetric = psi.map((_, k) =>
  psi[k].map((value, j) => (value - psi[4 - k][j]) / 2));
const normalForm = {
  knots: demoKnots,
  a: antisymmetric[0].map(v => -v),
  b: antisymmetric[0].map((v, j) => v - antisymmetric[1][j])
};
let normalFormError = 0;
let averagingError = 0;
for (let trial = 0; trial < 300; trial++) {
  const gaps = Array.from({length: 6}, () => 0.1 + 4.5 * random());
  normalFormError = Math.max(normalFormError, Math.abs(
    orientedReduced(antisymmetric, gaps) - A.additiveReducedCost(gaps, normalForm)));
  // The reversal lemma in action: averaging an oriented certificate with its
  // reversed copy is the same as antisymmetrising the potential.
  const averaged = (orientedReduced(psi, gaps) + orientedReduced(psi, gaps.slice().reverse())) / 2;
  averagingError = Math.max(averagingError, Math.abs(
    averaged - A.additiveReducedCost(gaps, normalForm)));
}
check('normal form reproduces every antisymmetric additive potential',
  normalFormError < 1e-14, `${normalFormError}`);
check('reversal averaging equals the antisymmetrised normal form',
  averagingError < 1e-14, `${averagingError}`);


// ------------------------------------------------------------ telescoping
// The whole point of a coboundary certificate: summing the reduced cost over
// a cyclic gap word telescopes the potential away, so a floor on R is a floor
// on the chain energy.  This is checked exactly, for both the demo potential
// and a random one.
function cyclicWindow(gaps, start) {
  return Array.from({length: 6}, (_, j) => gaps[(start + j) % gaps.length]);
}
let telescopeError = 0;
for (let period = 2; period <= 11; period++) {
  const gaps = Array.from({length: period}, (_, i) => 0.7 + ((23 * i + 5 * period) % 13) / 6);
  let mean = 0;
  for (let i = 0; i < period; i++) mean += A.additiveReducedCost(cyclicWindow(gaps, i), demo);
  mean /= period;
  telescopeError = Math.max(telescopeError, Math.abs(mean - T.periodicChainEnergy(gaps, 7, 3000)));
}
check('reduced cost telescopes to the chain energy', telescopeError < 5e-15, `${telescopeError}`);

// The zero certificate reduces to the bare block functional, whose global
// minimum is the published isolated-block candidate.
const zero = {knots: demoKnots, a: demoKnots.map(() => 0), b: demoKnots.map(() => 0)};
const bareAudit = A.auditAdditiveCertificate(zero, {starts: 240, generations: 400});
check('zero certificate recovers the isolated-block minimum',
  close(bareAudit.value, 0.003826231218593872, 5e-9), `${bareAudit.value}`);
check('isolated-block minimum clears the published 19/5000 floor',
  bareAudit.value > 19 / 5000, `${bareAudit.value}`);


// ------------------------------------------------------- shipped certificates
// Each shipped certificate is re-audited here from scratch, over the whole cube
// its own tail lemma leaves open, by three adversaries that share no code with
// the linear program that produced it.
const shipped = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
check('certificate file agrees with the module ceiling',
  shipped.ceiling === A.ALTERNATING_CEILING);

const byName = {};
for (const entry of shipped.certificates) {
  byName[entry.name] = entry;
  const cert = {knots: entry.knots, a: entry.a, b: entry.b};
  const amplitude = A.certificateAmplitude(cert);
  check(`${entry.name}: amplitude pin`, close(amplitude.bound, entry.amplitude, 1e-15),
    `${amplitude.bound}`);
  // The audited cube must contain everything the tail lemma does not dispose of.
  check(`${entry.name}: audited cube covers the tail threshold`,
    A.tailThreshold(cert, entry.floor) <= entry.searchBox,
    `${A.tailThreshold(cert, entry.floor)} > ${entry.searchBox}`);
  check(`${entry.name}: certificate is gauge normalised`,
    Math.abs(Math.max(...cert.a) + Math.min(...cert.a)) < 1e-15
    && Math.abs(Math.max(...cert.b) + Math.min(...cert.b)) < 1e-15);
  const audit = A.auditAdditiveCertificate(cert, {
    starts: 900, generations: 700, maxGap: entry.searchBox
  });
  check(`${entry.name}: audited floor pin`, close(audit.value, entry.floor, 5e-9), `${audit.value}`);
  check(`${entry.name}: floor stays under the structural ceiling`,
    entry.floor < shipped.ceiling, `${entry.floor}`);
  // Telescoping turns the audited floor into a chain floor, so no periodic
  // configuration the laboratory knows about may sit below it.
  for (const period of [2, 3, 5, 9]) {
    const gaps = Array.from({length: period}, (_, i) => (i % 2 ? 1.979467 : 1.041680));
    let mean = 0;
    for (let i = 0; i < period; i++) {
      mean += A.additiveReducedCost(
        Array.from({length: 6}, (_, j) => gaps[(i + j) % period]), cert);
    }
    check(`${entry.name}: period-${period} chain clears the audited floor`,
      mean / period >= entry.floor - 1e-12, `${mean / period}`);
  }
}


// The tail lemma is the one part of the sweep that is not established by
// subdivision, so it gets its own check: the declared amplitude really does
// bound the total potential contribution, and past the threshold the reduced
// cost really does clear the target.
for (const entry of shipped.certificates) {
  const cert = {knots: entry.knots, a: entry.a, b: entry.b};
  const bound = A.certificateAmplitude(cert).bound;
  let worstPotential = 0;
  for (let trial = 0; trial < 40000; trial++) {
    const gaps = Array.from({length: 6}, () => random() * 40);
    const potential = A.additiveReducedCost(gaps, cert) - T.blockFunctional(gaps, 3000);
    worstPotential = Math.max(worstPotential, Math.abs(potential));
  }
  check(`${entry.name}: amplitude really bounds the potential contribution`,
    worstPotential <= bound, `${worstPotential} > ${bound}`);

  const threshold = A.tailThreshold(cert, 0.0039);
  let tailViolations = 0;
  let tailMinimum = Infinity;
  for (let trial = 0; trial < 40000; trial++) {
    const gaps = Array.from({length: 6}, () => random() * 3);
    gaps[Math.floor(random() * 6)] = threshold + random() * 200;
    const value = A.additiveReducedCost(gaps, cert);
    if (value < 0.0039) tailViolations++;
    tailMinimum = Math.min(tailMinimum, value);
  }
  check(`${entry.name}: past the tail threshold the floor holds`,
    tailViolations === 0, `${tailViolations}, min ${tailMinimum}`);
}

check('record certificate beats the previous best coboundary candidate',
  byName.record.floor > 0.003923427087, `${byName.record.floor}`);
check('record certificate lands within 2e-7 of the ceiling',
  shipped.ceiling - byName.record.floor < 2e-7, `${shipped.ceiling - byName.record.floor}`);
check('compact certificate clears the 0.00395 programme target',
  byName.compact.floor > 0.00395, `${byName.compact.floor}`);
check('compact certificate is the cheaper interval-sweep target',
  byName.compact.amplitude < byName.record.amplitude
  && byName.compact.searchBox < byName.record.searchBox);
check('certificate scope stays numerical', /not a proof/.test(shipped.note));

if (failed) {
  console.error(`${failed} additive-certificate checks failed`);
  process.exit(1);
}
console.log('ADDITIVE CERTIFICATE CHECKS PASS');
