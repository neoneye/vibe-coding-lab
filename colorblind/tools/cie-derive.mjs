// Derives the simulation constants from CIE tables and writes them into ../index.html.
//
// Data (CVRL, http://www.cvrl.org):
//   curl -sSfL http://www.cvrl.org/database/data/cmfs/ciexyz31_1.csv -o /tmp/ciexyz31_1.csv   # CIE 1931 2° CMFs
//   curl -sSfL http://www.cvrl.org/database/data/cmfs/ciexyzjv.csv -o /tmp/ciexyzjv.csv       # Judd-Vos modified CMFs
//   curl -sSfL http://www.cvrl.org/database/data/lum/scvle_1.csv -o /tmp/scvle_1.csv          # CIE 1951 scotopic V'(λ)
// Usage:
//   node tools/cie-derive.mjs /tmp/ciexyz31_1.csv /tmp/ciexyzjv.csv /tmp/scvle_1.csv
import { readFileSync, writeFileSync } from 'node:fs';

const csv = (p) => new Map(readFileSync(p, 'utf8').trim().split(/\r?\n/)
  .map((l) => l.split(',').map(Number)).map((r) => [r[0], r.slice(1)]));
const [cie31, juddVos, scotopic] = process.argv.slice(2, 5).map(csv);

const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const mv = (A, v) => A.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function inv3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [[A, -(b * i - c * h), b * f - c * e], [B, a * i - c * g, -(a * f - c * d)], [C, -(a * h - b * g), a * e - b * d]]
    .map((r) => r.map((v) => v / det));
}
const fix = (v, n = 6) => v.toFixed(n);

// sRGB (IEC 61966-2-1) linear RGB -> CIE 1931 XYZ, D65.
const XYZ_FROM_RGB = [[0.4123908, 0.3575843, 0.1804808], [0.2126390, 0.7151687, 0.0721923], [0.0193308, 0.1191948, 0.9505322]];
// Linear sRGB -> Judd-Vos XYZ, and Smith & Pokorny (1975) cone fundamentals from Judd-Vos XYZ,
// as used by Viénot, Brettel & Mollon (1999) and DaltonLens.
const XYZJV_FROM_RGB = [[0.409568, 0.355041, 0.179167], [0.213389, 0.706743, 0.0798680], [0.0186297, 0.114620, 0.912367]];
const LMS_FROM_XYZJV = [[0.15514, 0.54312, -0.03286], [-0.15514, 0.45684, 0.03286], [0, 0, 0.01608]];

// ---------------------------------------------------------------------------------------------
// 1. Brettel, Viénot & Mollon (1997). The missing cone k is replaced so that the color lands on one of
//    two half-planes. Each half-plane is spanned by the neutral axis (sRGB white) and an anchor
//    wavelength: 475/575 nm for protan and deutan, 485/660 nm for tritan. The half-plane is chosen by
//    the side of the separating plane (neutral axis + missing-cone axis) the color lies on.
// ---------------------------------------------------------------------------------------------
const lmsFromRgb = mul(LMS_FROM_XYZJV, XYZJV_FROM_RGB);
const rgbFromLms = inv3(lmsFromRgb);
const W = mv(lmsFromRgb, [1, 1, 1]);
const TYPES = { protanopia: [0, [475, 575]], deuteranopia: [1, [475, 575]], tritanopia: [2, [485, 660]] };
const brettel = {};
for (const [mode, [k, anchors]] of Object.entries(TYPES)) {
  const axis = [0, 0, 0]; axis[k] = 1;
  const sepLms = cross(W, axis);
  const planes = anchors.map((nm) => {
    const A = mv(LMS_FROM_XYZJV, juddVos.get(nm));
    const n = cross(W, A);
    const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    P[k] = [0, 1, 2].map((c) => (c === k ? 0 : -n[c] / n[k]));
    return { nm, side: Math.sign(dot(sepLms, A)), mat: mul(rgbFromLms, mul(P, lmsFromRgb)).flat() };
  });
  if (planes[0].side === planes[1].side) throw new Error(`${mode}: both anchors on the same side`);
  const pos = planes.find((p) => p.side > 0), neg = planes.find((p) => p.side < 0);
  // dot(sepRgb, rgb) == dot(sepLms, lms), so the side can be tested directly on linear RGB.
  const sepRgb = [0, 1, 2].map((c) => dot(sepLms, [lmsFromRgb[0][c], lmsFromRgb[1][c], lmsFromRgb[2][c]]));
  const len = Math.hypot(...sepRgb);
  brettel[mode] = { pos: pos.mat, neg: neg.mat, sep: sepRgb.map((v) => v / len), posNm: pos.nm, negNm: neg.nm };
}

// Cross-check against libDaltonLens.c (public domain), which rounds to 5 decimals.
const DALTONLENS = {
  protanopia: [[0.14980, 1.19548, -0.34528, 0.10764, 0.84864, 0.04372, 0.00384, -0.00540, 1.00156],
               [0.14570, 1.16172, -0.30742, 0.10816, 0.85291, 0.03892, 0.00386, -0.00524, 1.00139], [0.00048, 0.00393, -0.00441]],
  deuteranopia: [[0.36477, 0.86381, -0.22858, 0.26294, 0.64245, 0.09462, -0.02006, 0.02728, 0.99278],
                 [0.37298, 0.88166, -0.25464, 0.25954, 0.63506, 0.10540, -0.01980, 0.02784, 0.99196], [-0.00281, -0.00611, 0.00892]],
  tritanopia: [[1.01277, 0.13548, -0.14826, -0.01243, 0.86812, 0.14431, 0.07589, 0.80500, 0.11911],
               [0.93678, 0.18979, -0.12657, 0.06154, 0.81526, 0.12320, -0.37562, 1.12767, 0.24796], [0.03901, -0.02788, -0.01113]],
};
console.log('Brettel 1997 (Smith-Pokorny, Judd-Vos, sRGB white neutral) vs libDaltonLens:');
for (const [mode, b] of Object.entries(brettel)) {
  const [dl1, dl2, dlSep] = DALTONLENS[mode];
  const sepLen = Math.hypot(...dlSep);
  const sepAgree = dot(b.sep, dlSep.map((v) => v / sepLen));
  // DaltonLens uses matrix 1 where dot(rgb, sep) >= 0, so it must equal our "pos" plane.
  const d1 = Math.max(...dl1.map((v, i) => Math.abs(v - b.pos[i])));
  const d2 = Math.max(...dl2.map((v, i) => Math.abs(v - b.neg[i])));
  console.log(`  ${mode.padEnd(12)} + side ${b.posNm} nm: ${d1.toExponential(1)}   - side ${b.negNm} nm: ${d2.toExponential(1)}   separating normals cos ${fix(sepAgree, 6)}`);
  if (d1 > 2e-5 || d2 > 2e-5 || sepAgree < 0.9999) throw new Error('does not match DaltonLens');
}

// ---------------------------------------------------------------------------------------------
// 2. Check of the 2011 app constants: its RGB_LMS is Hunt-Pointer-Estevez x sRGB, normalized to D65.
// ---------------------------------------------------------------------------------------------
const APP_RGB_LMS = [[0.313935103, 0.639568792, 0.046522135], [0.155302922, 0.757959424, 0.086726804], [0.017721646, 0.109451824, 0.872768110]];
const HPE = [[0.4002, 0.7076, -0.0808], [-0.2263, 1.1653, 0.0457], [0, 0, 0.9182]];
const hpeDiff = Math.max(...mul(HPE, XYZ_FROM_RGB).flat().map((v, i) => Math.abs(v - APP_RGB_LMS.flat()[i])));
console.log(`RGB_LMS vs Hunt-Pointer-Estevez x sRGB: max diff ${hpeDiff.toExponential(1)}`);
const appXyzLms = mul(APP_RGB_LMS, inv3(XYZ_FROM_RGB));
const hpePlane = (k, i, j, nm) => {
  const A = mv(appXyzLms, cie31.get(nm));
  return mv(inv3([[1, 1, 0], [A[i], A[j], 0], [0, 0, 1]]), [1, A[k], 0])[0];
};
console.log('plane coefficient vs the same planes from Brettel\'s anchors in HPE space:');
console.log(`  deuteranopia app 0.8278 / 0.8195, anchors 575/475 nm give ${fix(hpePlane(1, 0, 2, 575), 4)} / ${fix(hpePlane(1, 0, 2, 475), 4)}`);
console.log(`  protanopia   app 1.2080 / 1.2202, anchors 575/475 nm give ${fix(hpePlane(0, 1, 2, 575), 4)} / ${fix(hpePlane(0, 1, 2, 475), 4)}`);
console.log(`  tritanopia   app -0.5254 / -0.8750, anchors 660/485 nm give ${fix(hpePlane(2, 0, 1, 660), 4)} / ${fix(hpePlane(2, 0, 1, 485), 4)}`);

// ---------------------------------------------------------------------------------------------
// 3. Achromatopsia (rod monochromacy): rods follow the CIE 1951 scotopic curve V'(λ). Least-squares fit
//    V' ≈ a x̄ + b ȳ + c z̄ over 380-780 nm, then express it on linear sRGB with white = 1.
// ---------------------------------------------------------------------------------------------
const rows = [], ys = [];
for (let nm = 380; nm <= 780; nm++) if (cie31.has(nm) && scotopic.has(nm)) { rows.push(cie31.get(nm)); ys.push(scotopic.get(nm)[0]); }
const AtA = [0, 1, 2].map((p) => [0, 1, 2].map((q) => rows.reduce((s, r) => s + r[p] * r[q], 0)));
const Aty = [0, 1, 2].map((p) => rows.reduce((s, r, n) => s + r[p] * ys[n], 0));
const abc = mv(inv3(AtA), Aty);
const rms = Math.sqrt(rows.reduce((s, r, n) => s + (dot(r, abc) - ys[n]) ** 2, 0) / rows.length);
const rodRaw = [0, 1, 2].map((c) => dot(abc, [XYZ_FROM_RGB[0][c], XYZ_FROM_RGB[1][c], XYZ_FROM_RGB[2][c]]));
const rodSum = rodRaw[0] + rodRaw[1] + rodRaw[2];
const rod = rodRaw.map((v) => v / rodSum);
console.log(`Scotopic fit: V' ≈ ${fix(abc[0], 4)} X + ${fix(abc[1], 4)} Y + ${fix(abc[2], 4)} Z (RMS residual ${fix(rms, 3)} of peak 1)`);
console.log(`  rod weights on linear sRGB: ${rod.map((v) => fix(v)).join(', ')}`);

// ---------------------------------------------------------------------------------------------
// Write the block into index.html.
// ---------------------------------------------------------------------------------------------
const num = (v) => (Math.abs(v) < 5e-13 ? '0' : v.toPrecision(12).replace(/\.?0+$/, '').replace(/\.?0+e/, 'e'));
const arr = (a) => '[' + a.map(num).join(', ') + ']';
const lines = [
  '  // BEGIN corrected-constants (generated by tools/cie-derive.mjs, do not edit by hand)',
  '  // Brettel 1997 on linear sRGB: Smith-Pokorny cones, Judd-Vos XYZ, sRGB white as the neutral axis.',
  '  // pos is used where dot(rgb, sep) >= 0, neg elsewhere. Matrices are row-major.',
  '  const CORRECTED = {',
];
for (const [mode, b] of Object.entries(brettel)) {
  lines.push(`    ${mode}: { // ${b.posNm} nm on the + side, ${b.negNm} nm on the - side`,
    `      pos: ${arr(b.pos)},`, `      neg: ${arr(b.neg)},`, `      sep: ${arr(b.sep)},`, '    },');
}
lines.push(`    // Rod monochromacy: CIE 1951 scotopic V'(λ) fitted to CIE 1931 XYZ, on linear sRGB, white = 1.`,
  `    rod: ${arr(rod)},`, '  };', '  // END corrected-constants');

const htmlPath = new URL('../index.html', import.meta.url);
const html = readFileSync(htmlPath, 'utf8');
const re = /  \/\/ BEGIN corrected-constants[\s\S]*?\/\/ END corrected-constants/;
if (!re.test(html)) throw new Error('markers not found in index.html');
writeFileSync(htmlPath, html.replace(re, lines.join('\n')));
console.log('updated index.html');
