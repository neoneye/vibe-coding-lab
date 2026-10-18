// Runs the color math embedded in index.html (<script id="shared-code">) in Node.
// Usage: node test.mjs
//
// The GLSL shader is generated from the same constants and checked against this JS reference on the
// GPU by window.__cbv.gpuCheck() in the browser (every vision type, 256 colors).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
assert.ok(m, 'shared-code script block found');
const module = { exports: {} };
new Function('module', m[1])(module);
const CBV = module.exports;
const DICHROMATS = ['deuteranopia', 'protanopia', 'tritanopia'];
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok', name); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test('five vision types in the app order', () => {
  assert.deepEqual(CBV.MODES, ['normal', 'deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia']);
  for (const mode of CBV.MODES) assert.ok(CBV.INFO[mode].title && CBV.INFO[mode].stats && CBV.INFO[mode].detail);
});

test('launch-screen statistics match the sources (Webvision Table 1, MedlinePlus)', () => {
  const stat = (mode) => CBV.INFO[mode].stats.split('\n')[1];
  assert.equal(stat('normal'), '92% male - 99.5% female');
  assert.equal(stat('deuteranopia'), '1.5% male - 0.01% female');
  assert.equal(stat('protanopia'), '1% male - 0.01% female');
  assert.equal(stat('tritanopia'), '0.008% male - 0.008% female');  // not X-linked: equal in both sexes
  assert.equal(stat('achromatopsia'), '0.003% of the population');  // about 1 in 30,000
});

test('one algorithm', () => {
  assert.equal(CBV.ENGINES, undefined);
  assert.ok(!/engineCard|sevbar|severity/i.test(html), 'no algorithm or severity UI left');
  for (const k of ['0.827814015058087', '1.20800080913082', '0.313935103', '5.47213088809908']) {
    assert.ok(!html.includes(k), 'still contains ' + k);
  }
});

test('normal vision is the identity', () => {
  for (const c of [[0, 0, 0], [12, 200, 99], [255, 255, 255]]) assert.deepEqual(CBV.apply8('normal', c), c);
});

test('black stays black and white stays white for every type', () => {
  for (const mode of CBV.MODES) {
    assert.deepEqual(CBV.apply8(mode, [0, 0, 0]), [0, 0, 0], mode);
    assert.deepEqual(CBV.apply8(mode, [255, 255, 255]), [255, 255, 255], mode);
  }
});

test('grays stay gray for every dichromacy (sRGB white is the neutral axis)', () => {
  for (const mode of DICHROMATS) for (let v = 0; v <= 255; v += 15) {
    assert.deepEqual(CBV.apply8(mode, [v, v, v]), [v, v, v], `${mode} ${v}`);
  }
});

// Brettel 1997 re-implemented from libDaltonLens.c (public domain, 5-decimal constants): an independent
// reference that never touches the page's constants.
const DALTONLENS = {
  protanopia: [[0.14980, 1.19548, -0.34528, 0.10764, 0.84864, 0.04372, 0.00384, -0.00540, 1.00156],
               [0.14570, 1.16172, -0.30742, 0.10816, 0.85291, 0.03892, 0.00386, -0.00524, 1.00139], [0.00048, 0.00393, -0.00441]],
  deuteranopia: [[0.36477, 0.86381, -0.22858, 0.26294, 0.64245, 0.09462, -0.02006, 0.02728, 0.99278],
                 [0.37298, 0.88166, -0.25464, 0.25954, 0.63506, 0.10540, -0.01980, 0.02784, 0.99196], [-0.00281, -0.00611, 0.00892]],
  tritanopia: [[1.01277, 0.13548, -0.14826, -0.01243, 0.86812, 0.14431, 0.07589, 0.80500, 0.11911],
               [0.93678, 0.18979, -0.12657, 0.06154, 0.81526, 0.12320, -0.37562, 1.12767, 0.24796], [0.03901, -0.02788, -0.01113]],
};
function daltonLens(mode, c255) {
  const lin = c255.map((v) => { const f = v / 255; return f < 0.04045 ? f / 12.92 : Math.pow((f + 0.055) / 1.055, 2.4); });
  const [m1, m2, nrm] = DALTONLENS[mode];
  const M = lin[0] * nrm[0] + lin[1] * nrm[1] + lin[2] * nrm[2] >= 0 ? m1 : m2;
  return [0, 1, 2].map((r) => {
    const v = M[r * 3] * lin[0] + M[r * 3 + 1] * lin[1] + M[r * 3 + 2] * lin[2];
    if (v <= 0) return 0;
    if (v >= 1) return 255;
    return Math.round(255 * (v < 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  });
}

test('dichromacy equals Brettel 1997 as implemented by libDaltonLens (within 1 level)', () => {
  let worst = 0;
  for (const mode of DICHROMATS) for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const ours = CBV.apply8(mode, [r, g, b]), ref = daltonLens(mode, [r, g, b]);
    for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(ours[k] - ref[k]));
  }
  assert.ok(worst <= 1, 'max difference ' + worst);
});

test('light saturated blues are not clipped', () => {
  const sky = CBV.apply8('deuteranopia', [90, 180, 255]);
  assert.ok(sky[0] > 100, 'keeps its red component: ' + sky);
});

test('achromatopsia follows rod (scotopic) sensitivity in linear light', () => {
  const g = (c) => CBV.apply8('achromatopsia', c);
  assert.deepEqual(g([255, 0, 0]), [0, 0, 0], 'rods do not see deep red');
  assert.ok(g([0, 0, 255])[0] > g([255, 0, 0])[0] + 100, 'blue is far brighter than red for rods');
  assert.ok(g([0, 255, 0])[0] > g([0, 0, 255])[0], 'green brightest');
  const rod = CBV.CORRECTED.rod;
  assert.ok(Math.abs(rod[0] + rod[1] + rod[2] - 1) < 1e-12, 'white maps to 1');
});

test('the test-card dot plate: orange "42" and green background get closer for red-green types', () => {
  const FIG = ['#f9bb82', '#eba170', '#fccd84', '#e8975f'].map(hex);
  const BG = ['#9ca594', '#acb4a5', '#bbb964', '#d7daaa', '#e5d57d', '#d1d6af'].map(hex);
  const mean = (list) => [0, 1, 2].map((k) => list.reduce((s, c) => s + c[k], 0) / list.length);
  const sep = (mode) => dist(mean(FIG.map((c) => CBV.apply(mode, c))), mean(BG.map((c) => CBV.apply(mode, c))));
  for (const mode of ['deuteranopia', 'protanopia']) assert.ok(sep(mode) < sep('normal') * 0.75, `${mode}: ${sep(mode)} vs ${sep('normal')}`);
});

// Characterization pins: output for a few colors.
const COLORS = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255], [128, 64, 32], [40, 160, 90], [200, 200, 200]];
const PINS = {
  deuteranopia: [[164, 139, 0], [241, 209, 46], [0, 87, 254], [255, 243, 22], [209, 223, 255], [103, 161, 252], [98, 85, 28], [147, 134, 94], [200, 200, 200]],
  protanopia: [[108, 92, 12], [255, 237, 0], [0, 56, 255], [255, 250, 0], [238, 242, 255], [0, 107, 255], [84, 73, 33], [167, 150, 89], [200, 200, 200]],
  tritanopia: [[255, 0, 78], [121, 233, 255], [0, 98, 136], [255, 238, 241], [71, 248, 255], [239, 102, 122], [130, 59, 69], [77, 149, 172], [200, 200, 200]],
  achromatopsia: [[0, 0, 0], [210, 210, 210], [175, 175, 175], [199, 199, 199], [255, 255, 255], [161, 161, 161], [43, 43, 43], [142, 142, 142], [200, 200, 200]],
};
test('characterization pins', () => {
  for (const [mode, want] of Object.entries(PINS)) assert.deepEqual(COLORS.map((c) => CBV.apply8(mode, c)), want, mode);
});

console.log(`\n${n} tests passed`);
