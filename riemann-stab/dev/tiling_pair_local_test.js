'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./tiling_pair_local');
const P = require('./tiling_pair');
const I = require('./tiling_interval');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
  if (!ok) failures++;
}

console.log('=== the tube a sweep cannot do ===');

const cand = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'tiling_pair.stationary.json'), 'utf8'));
const bundle = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'tiling_additive.certificate.json'), 'utf8'));
const certs = bundle.certificates;
const base = (Array.isArray(certs) ? certs : Object.values(certs))
  .find(e => e.name === cand.base);
const cert = P.prepare(cand, base);
const prepared = I.prepareCertificate(base);
const EALT = 0.003957393309109344;
const LOW = 1.0416801034484870;
const HIGH = 1.9794672314032244;
const alt = [LOW, HIGH, LOW, HIGH, LOW, HIGH];

// ---- the Hessian enclosure, against finite differences
const H = L.blockHessianRange(alt.map(x => x - 1e-9), alt.map(x => x + 1e-9));
const T = require('./tiling_research');
const h = 1e-5;
let hessBad = 0;
for (let i = 0; i < 6; i++) {
  for (let j = 0; j < 6; j++) {
    const at = (a, b) => {
      const g = alt.slice();
      g[i] += a * h;
      g[j] += b * h;
      return T.blockFunctional(g, 3000);
    };
    const fd = (at(1, 1) - at(1, -1) - at(-1, 1) + at(-1, -1)) / (4 * h * h);
    if (fd < H[i][j][0] - 1e-4 || fd > H[i][j][1] + 1e-4) hessBad++;
  }
}
check('the block Hessian enclosure agrees with a finite difference',
  hessBad === 0, '36 entries');

// ---- the smoothness precondition is checked, not assumed
const clearance = Math.min(
  ...alt.map(x => L.cellClearance(cert.knots, x)),
  ...alt.map(x => L.cellClearance(base.knots, x)));
check('the alternating gaps sit strictly inside a cell of both grids',
  clearance > 0.02, `clearance ${clearance.toFixed(6)}`);
const tooWide = L.certifyTube({cert, alt, radius: clearance * 1.01, ceiling: EALT,
  additiveKnots: base.knots, subdivisions: 2,
  evaluate: () => L.encloseCentre(cert, prepared, alt, 1e-10)});
check('and a tube that crosses a knot line is refused, not certified',
  tooWide.holds === false && tooWide.reason === 'tube crosses a knot line');

// ---- the centre enclosure has to be tight enough to be worth anything: the
//      true gradient there is a cancellation of terms a thousand times larger
const centre = L.encloseCentre(cert, prepared, alt, 1e-10);
check('R at the alternating block is enclosed from below', centre.lower > 0,
  `E_alt - lower = ${(EALT - centre.lower).toExponential(3)}`);
check('and its gradient enclosure is tight, not the sum of the term ranges',
  centre.gradNorm < 1e-8, `|grad| <= ${centre.gradNorm.toExponential(3)}`);

// ---- the tube itself
for (const [radius, subdivisions] of [[0.003, 3], [0.005, 4], [0.008, 6]]) {
  const r = L.certifyTube({cert, alt, radius, ceiling: EALT,
    additiveKnots: base.knots, subdivisions,
    evaluate: () => L.encloseCentre(cert, prepared, alt, 1e-10)});
  check(`the Hessian is positive definite over the radius-${radius} tube`,
    r.holds && r.lambda > 0, `lambda >= ${r.lambda.toFixed(6)}`);
  check(`so R >= E_alt - ${r.shortfall.toExponential(3)} there`,
    r.shortfall < 1e-10,
    'the limit is the rigorous point evaluation, not the geometry');
}

// ---- and the covering has to be a covering: one box is not enough
const coarse = L.certifyTube({cert, alt, radius: 0.008, ceiling: EALT,
  additiveKnots: base.knots, subdivisions: 1,
  evaluate: () => L.encloseCentre(cert, prepared, alt, 1e-10)});
check('a single undivided box does not certify the wide tube, and says so',
  !coarse.holds, `lambda ${coarse.lambda.toFixed(4)} over one box`);

console.log(failures ? `\n${failures} FAILED` : '\nTUBE CHECKS PASS');
process.exit(failures ? 1 : 0);
