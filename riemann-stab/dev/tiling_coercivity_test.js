'use strict';

const T = require('./tiling_research');
const C = require('./tiling_coercivity');

let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('  OK  ', name);
  else { failed++; console.error('  FAIL', name, detail); }
}

const L0 = 1.041680, H0 = 1.979467;

// The exact Hessian must agree with the finite-difference routine already in
// the laboratory.  They share no code: one differentiates the analytic
// gradient numerically, the other assembles w'' terms in closed form.
const reference = T.periodTwoBlochSpectrum(64);
let worstAgreement = 0;
for (const row of reference) {
  const M = C.blochSymbol(row.q, row.q, [L0, L0], [H0, H0]);
  const lower = C.smallestEigenvalueLower(M);
  worstAgreement = Math.max(worstAgreement, Math.abs(lower - row.lower));
}
check('exact Bloch symbol agrees with the finite-difference spectrum',
  worstAgreement < 1e-7, `${worstAgreement}`);

// A spectrum routine that reported everything positive would be useless, so the
// bound has to be tight enough to fail at a target the spectrum does not meet.
const tooHigh = C.certifyGap([L0, L0], [H0, H0], {target: 1.7, budget: 2e4});
check('certification fails at a target the spectrum does not reach',
  !tooHigh.complete, `${tooHigh.worst}`);

// The certification proper: every momentum, and every two-periodic state in a
// box around the critical point.
const HALF = 1e-4;
const box = {L: [L0 - HALF, L0 + HALF], H: [H0 - HALF, H0 + HALF]};
const certified = C.certifyGap(box.L, box.H, {target: 1.6});
check('spectral gap at least 1.6 for every momentum and every state in the box',
  certified.complete, `worst ${certified.worst} at ${certified.worstAt}`);
check('and the certification is cheap', certified.processed < 5000,
  `${certified.processed} momentum intervals`);

// Krawczyk: the critical point is actually in there.
const proof = C.krawczyk([L0 - 1e-6, L0 + 1e-6], [H0 - 1e-6, H0 + 1e-6]);
check('a unique two-periodic critical point exists in the box', proof.proved,
  `${JSON.stringify(proof.K)}`);
check('the Krawczyk image is strictly inside its box',
  proof.K[0][0] > L0 - 1e-6 && proof.K[0][1] < L0 + 1e-6);
// It must also fail when it should: too tight a box cannot contain the image.
const tooTight = C.krawczyk([L0 - 1e-9, L0 + 1e-9], [H0 - 1e-9, H0 + 1e-9]);
check('and fails on a box too small to contain the zero', !tooTight.proved);

// Iterating Krawczyk pins the critical point to the last bit of a double.
const refined = C.refineCriticalPoint([L0 - 1e-6, L0 + 1e-6], [H0 - 1e-6, H0 + 1e-6]);
check('the critical point refines to a certified enclosure', refined.proved);
check('and that enclosure is tight',
  refined.L[1] - refined.L[0] < 1e-14 && refined.H[1] - refined.H[0] < 1e-14,
  `${refined.L[1] - refined.L[0]}, ${refined.H[1] - refined.H[0]}`);
const gradient = C.gradientInterval(refined.L, refined.H);
check('the gradient enclosure over it contains zero',
  gradient[0][0] <= 0 && gradient[0][1] >= 0 && gradient[1][0] <= 0 && gradient[1][1] >= 0,
  `${JSON.stringify(gradient)}`);

// And a finding worth pinning: the (L, H) quoted throughout the laboratory to
// six decimals is a rounding, and its energy sits ABOVE the true minimum.
check('the six-decimal values are a rounding of the certified point',
  Math.abs(refined.L[0] - L0) > 1e-8 && Math.abs(refined.H[0] - H0) > 1e-8,
  `${refined.L[0]} vs ${L0}`);
const atRounded = T.periodicChainEnergy([L0, H0]);
const atRefined = T.periodicChainEnergy([(refined.L[0] + refined.L[1]) / 2,
  (refined.H[0] + refined.H[1]) / 2]);
check('and the certified point has the lower energy of the two',
  atRefined < atRounded, `${atRefined} vs ${atRounded}`);

if (failed) {
  console.error(`${failed} coercivity checks failed`);
  process.exit(1);
}
console.log('LOCAL COERCIVITY CHECKS PASS');
