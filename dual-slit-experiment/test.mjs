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
  return Object.assign({ slitCount: 2, sep: 100, widths: [10, 10, 10], midPos: 0, barrierX: BARRIER_X, cy: CY, perSlit: PER_SLIT }, over);
}

function groupYs(srcs, slit) { return srcs.filter(q => q.slit === slit).map(q => q.y); }
function center(ys) { return ys.reduce((a, b) => a + b) / ys.length; }
function span(ys) { return Math.max(...ys) - Math.min(...ys); }

// --- slitSources geometry: 2 slits ---
{
  const s = P.slitSources(params());
  assert.equal(s.length, 2 * PER_SLIT, 'two slits x perSlit sources');
  assert.ok(Math.abs(center(groupYs(s, 0)) - (CY - 50)) < 1e-9, 'slit A centered at cy-sep/2');
  assert.ok(Math.abs(center(groupYs(s, 1)) - (CY + 50)) < 1e-9, 'slit B centered at cy+sep/2');
  assert.ok(span(groupYs(s, 0)) <= 10 + 1e-9, 'sources span slit width');
  assert.ok(s.every(q => q.x === BARRIER_X), 'sources sit on the barrier');
  const one = P.slitSources(params({ slitCount: 1 }));
  assert.equal(one.length, PER_SLIT, 'single slit source count');
  assert.ok(one.every(q => q.slit === 0), 'single slit uses slot 0');
  assert.ok(Math.abs(center(groupYs(one, 0)) - CY) < 1e-9, 'single slit centered at cy');
}

// --- slitSources geometry: 3 slits, per-slit widths, midPos ---
{
  const widths = [6, 10, 20];
  const s0 = P.slitSources(params({ slitCount: 3, widths, midPos: 0 }));
  assert.equal(s0.length, 3 * PER_SLIT, 'three slits x perSlit sources');
  assert.ok(Math.abs(center(groupYs(s0, 0)) - (CY - 50)) < 1e-9, 'top slit at cy-sep/2');
  assert.ok(Math.abs(center(groupYs(s0, 1)) - CY) < 1e-9, 'midPos 0: middle slit at cy');
  assert.ok(Math.abs(center(groupYs(s0, 2)) - (CY + 50)) < 1e-9, 'bottom slit at cy+sep/2');
  assert.ok(Math.abs(span(groupYs(s0, 0)) - 6) < 1e-9, 'top slit width respected');
  assert.ok(Math.abs(span(groupYs(s0, 1)) - 10) < 1e-9, 'middle slit width respected');
  assert.ok(Math.abs(span(groupYs(s0, 2)) - 20) < 1e-9, 'bottom slit width respected');

  // midPos -1: middle slit adjacent to top slit (2 px wall between edges)
  const sT = P.slitSources(params({ slitCount: 3, widths, midPos: -1 }));
  const expTop = (CY - 50) + (6 + 10) / 2 + 2;
  assert.ok(Math.abs(center(groupYs(sT, 1)) - expTop) < 1e-9, `midPos -1: middle adjacent to top (${expTop})`);

  // midPos +1: middle slit adjacent to bottom slit
  const sB = P.slitSources(params({ slitCount: 3, widths, midPos: 1 }));
  const expBot = (CY + 50) - (20 + 10) / 2 - 2;
  assert.ok(Math.abs(center(groupYs(sB, 1)) - expBot) < 1e-9, `midPos +1: middle adjacent to bottom (${expBot})`);

  // midPos -0.5: halfway between center and adjacent-to-top
  const sH = P.slitSources(params({ slitCount: 3, widths, midPos: -0.5 }));
  assert.ok(Math.abs(center(groupYs(sH, 1)) - (CY + expTop) / 2) < 1e-9, 'midPos interpolates linearly');

  // cramped geometry: offsets clamp to zero instead of crossing
  const sC = P.slitSources(params({ slitCount: 3, sep: 30, widths: [24, 24, 24], midPos: -1 }));
  assert.ok(center(groupYs(sC, 1)) <= CY + 1e-9, 'cramped: middle never crosses past center');
}

// --- field symmetry about cy (2 slits) ---
{
  const s = P.slitSources(params());
  const k = 2 * Math.PI / 12;
  const up = P.fieldAt(s, k, SCREEN_X, CY - 77);
  const dn = P.fieldAt(s, k, SCREEN_X, CY + 77);
  const sum = f => (f.re[0] + f.re[1] + f.re[2]) ** 2 + (f.im[0] + f.im[1] + f.im[2]) ** 2;
  assert.ok(Math.abs(sum(up) - sum(dn)) / (sum(up) + sum(dn)) < 1e-6, 'intensity symmetric about cy');
}

// --- 3 slits symmetric config: screen intensity symmetric ---
{
  const s = P.slitSources(params({ slitCount: 3, midPos: 0 }));
  const I = P.screenIntensity(s, 2 * Math.PI / 12, SCREEN_X, H, true);
  for (const off of [33, 77, 120]) {
    const a = I[CY - off], b = I[CY + off - 1]; // I[y] sampled at y+0.5: mirror of CY-off is CY+off-1
    assert.ok(Math.abs(a - b) / (a + b) < 0.02, `3-slit intensity symmetric at ±${off}`);
  }
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

// --- which-path (incoherent) kills fringe visibility, 2 and 3 slits ---
{
  const k = 2 * Math.PI / 12;
  const vis = I => {
    let mx = 0, mn = Infinity;
    for (let y = CY - 100; y <= CY + 100; y++) { mx = Math.max(mx, I[y]); mn = Math.min(mn, I[y]); }
    return (mx - mn) / (mx + mn);
  };
  for (const slitCount of [2, 3]) {
    const s = P.slitSources(params({ slitCount }));
    const co = P.screenIntensity(s, k, SCREEN_X, H, true);
    const inc = P.screenIntensity(s, k, SCREEN_X, H, false);
    assert.ok(vis(co) > 0.7, `${slitCount}-slit coherent visibility high (${vis(co).toFixed(2)})`);
    assert.ok(vis(inc) < 0.2, `${slitCount}-slit incoherent visibility low (${vis(inc).toFixed(2)})`);
  }
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
