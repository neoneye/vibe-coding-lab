import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="physics-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'physics-core script block found');
const module = { exports: {} };
new Function('module', m[1])(module);
const P = module.exports;
assert.ok(P && P.slitSources, 'Physics exported');

const H = 480, CY = 240, BARRIER_X = 280, SCREEN_X = 700, PER_SLIT = 9;
const L = SCREEN_X - BARRIER_X; // 420

function params(over = {}) {
  return Object.assign({ slitCount: 2, sep: 100, slitWidth: 10, barrierX: BARRIER_X, cy: CY, perSlit: PER_SLIT }, over);
}

// --- slitSources geometry ---
{
  const s = P.slitSources(params());
  assert.equal(s.length, 2 * PER_SLIT, 'two slits x perSlit sources');
  const ysA = s.filter(q => q.slit === 0).map(q => q.y);
  const ysB = s.filter(q => q.slit === 1).map(q => q.y);
  assert.ok(Math.abs(ysA.reduce((a, b) => a + b) / ysA.length - (CY - 50)) < 1e-9, 'slit A centered at cy-sep/2');
  assert.ok(Math.abs(ysB.reduce((a, b) => a + b) / ysB.length - (CY + 50)) < 1e-9, 'slit B centered at cy+sep/2');
  assert.ok(Math.max(...ysA) - Math.min(...ysA) <= 10 + 1e-9, 'sources span slit width');
  assert.ok(s.every(q => q.x === BARRIER_X), 'sources sit on the barrier');
  const one = P.slitSources(params({ slitCount: 1 }));
  assert.equal(one.length, PER_SLIT, 'single slit source count');
  assert.ok(one.every(q => q.slit === 0), 'single slit uses slot 0');
}

// --- field symmetry about cy ---
{
  const s = P.slitSources(params());
  const k = 2 * Math.PI / 12;
  const up = P.fieldAt(s, k, SCREEN_X, CY - 77);
  const dn = P.fieldAt(s, k, SCREEN_X, CY + 77);
  const Iup = (up.re[0] + up.re[1]) ** 2 + (up.im[0] + up.im[1]) ** 2;
  const Idn = (dn.re[0] + dn.re[1]) ** 2 + (dn.im[0] + dn.im[1]) ** 2;
  assert.ok(Math.abs(Iup - Idn) / (Iup + Idn) < 1e-6, 'intensity symmetric about cy');
}

// --- coherent: central max + fringe spacing ~ lambda*L/d ---
{
  const lambda = 12, d = 100;
  const s = P.slitSources(params({ sep: d }));
  const I = P.screenIntensity(s, 2 * Math.PI / lambda, SCREEN_X, H, true);
  const peaks = P.findPeaks(I).filter(y => Math.abs(y - CY) < 135);
  assert.ok(peaks.length >= 4, `enough central peaks (got ${peaks.length})`);
  const best = peaks.reduce((a, b) => (I[a] > I[b] ? a : b));
  assert.ok(Math.abs(best - CY) < 6, 'brightest central fringe at cy');
  const gaps = peaks.slice(1).map((p, i) => p - peaks[i]);
  const mean = gaps.reduce((a, b) => a + b) / gaps.length;
  const expected = lambda * L / d; // 50.4
  assert.ok(Math.abs(mean - expected) / expected < 0.15,
    `fringe spacing ${mean.toFixed(1)} within 15% of ${expected.toFixed(1)}`);
}

// --- which-path (incoherent) kills fringe visibility ---
{
  const s = P.slitSources(params());
  const k = 2 * Math.PI / 12;
  const co = P.screenIntensity(s, k, SCREEN_X, H, true);
  const inc = P.screenIntensity(s, k, SCREEN_X, H, false);
  const vis = I => {
    let mx = 0, mn = Infinity;
    for (let y = CY - 100; y <= CY + 100; y++) { mx = Math.max(mx, I[y]); mn = Math.min(mn, I[y]); }
    return (mx - mn) / (mx + mn);
  };
  assert.ok(vis(co) > 0.7, `coherent visibility high (${vis(co).toFixed(2)})`);
  assert.ok(vis(inc) < 0.2, `incoherent visibility low (${vis(inc).toFixed(2)})`);
}

// --- CDF + sampling ---
{
  const s = P.slitSources(params());
  const I = P.screenIntensity(s, 2 * Math.PI / 12, SCREEN_X, H, true);
  const cdf = P.buildCDF(I);
  assert.ok(Math.abs(cdf[H - 1] - 1) < 1e-9, 'CDF ends at 1');
  for (let y = 1; y < H; y++) assert.ok(cdf[y] >= cdf[y - 1], 'CDF monotonic');
  let seed = 42;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  let sum = 0; const N = 20000;
  for (let i = 0; i < N; i++) sum += P.sampleIndex(cdf, rand());
  assert.ok(Math.abs(sum / N - CY) < 10, `sample mean ${(sum / N).toFixed(1)} near cy (symmetric P)`);
}

console.log('all physics tests passed');
