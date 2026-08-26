'use strict';

const fs = require('fs');
const path = require('path');
const B = require('./tiling_bellman');
const golden = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'tiling_research.golden.json'), 'utf8'
));

let failed = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('  OK  ', name);
  else { failed++; console.error('  FAIL', name, detail); }
}
function close(a, b, tolerance) { return Math.abs(a - b) <= tolerance; }

const finite = golden.finite_state_dual;
const solution = B.solveBellman(finite.alphabet);
check('binary Bellman residual closes', solution.upper - solution.lower < 2e-15,
  `${solution.lower} .. ${solution.upper}`);
check('binary Bellman lower pin', close(solution.lower, finite.bellman_lower, 2e-15));
check('binary greedy cycle pin',
  JSON.stringify(B.greedyCycle(solution).gaps) === JSON.stringify(finite.greedy_cycle));

// Every Walsh edge feature is Phi(next)-Phi(previous), hence its cyclic sum
// vanishes independently of the coefficients.  This is the algebraic bridge
// from a local reduced-cost inequality to a long-chain average.
const masks = B.walshMasks(5);
const chain = Array.from({length: 19}, (_, i) => 0.8 + ((13 * i + 7) % 17) / 9);
const sums = new Float64Array(masks.length);
for (let i = 0; i < chain.length; i++) {
  const block = Array.from({length: 6}, (_, j) => chain[(i + j) % chain.length]);
  const features = B.walshEdgeFeatures(block, masks);
  for (let k = 0; k < features.length; k++) sums[k] += features[k];
}
check('five-gap Walsh coboundary telescopes',
  Math.max(...Array.from(sums, Math.abs)) < 8e-15);

// Regression for the most important falsification in this study.  The
// oriented potential destroys reversal symmetry, so quotienting by reversal
// hid this counterexample to the initially promising >0.00395 candidate.
const withdrawn = golden.withdrawn_oriented_candidate;
const value = B.linearReducedCost(withdrawn.counterexample_gaps, withdrawn.coefficients);
const reverseValue = B.linearReducedCost(
  withdrawn.counterexample_gaps.slice().reverse(), withdrawn.coefficients
);
check('withdrawn candidate counterexample pin',
  close(value, withdrawn.counterexample_value, 2e-15), `${value}`);
check('reflected word has different reduced cost',
  close(reverseValue, withdrawn.reverse_value, 2e-15) && Math.abs(value - reverseValue) > 4e-4);
check('withdrawn candidate really misses 0.00395', value < 0.00395);
check('linear coefficients lie in telescoping subspace',
  Math.abs(withdrawn.coefficients.reduce((a, b) => a + b, 0)) < 2e-19);
check('dual-search scope remains numerical', /no family optimum/.test(golden.continuous_dual_search.status));

if (failed) {
  console.error(`${failed} tiling-dual checks failed`);
  process.exit(1);
}
console.log('TILING BELLMAN/COBOUNDARY CHECKS PASS');
