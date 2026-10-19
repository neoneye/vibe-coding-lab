// Runs the scanning pipeline embedded in index.html (<script id="shared-code">) in Node.
// Usage: node test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
assert.ok(m, 'shared-code script block found');
const module = { exports: {} };
new Function('module', m[1])(module);
const H = module.exports;
let n = 0;
const test = (name, fn) => { const t0 = Date.now(); fn(); n++; console.log('ok', name, `(${Date.now() - t0} ms)`); };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

test('angle helpers', () => {
  assert.equal(H.wrap360(-30), 330); assert.equal(H.angDiff(10, 350), 20); assert.equal(H.angDiff(350, 10), -20);
  near(H.circMean([350, 10], [1, 1]), 0, 1e-9);
});

test('yaw from pose landmarks matches the turning convention, all the way round', () => {
  for (let th = 0; th < 360; th += 15) {
    const { lm2, lm3 } = H.syntheticPose(th);
    const y = H.yawFromPose(lm2, lm3);
    near(H.angDiff(y.shoulder, th), 0, 1e-6, 'shoulder ' + th);
    near(H.angDiff(y.ear, th), 0, 1e-6, 'ear ' + th);
    near(H.angDiff(y.nose, th), 0, 1e-6, 'nose ' + th);
    assert.equal(y.frontal, H.angDiff(th, 0) === 0 || Math.abs(H.angDiff(th, 0)) < 5, 'frontal only facing the camera at ' + th);
  }
  // A nose turned to image right is positive yaw.
  assert.ok(H.syntheticPose(30).lm2[0].x > 0.5);
});

// A realistic two-turn spin: uneven speed, noisy estimates, left/right swaps seen from behind,
// dropped frames. Returns the tracker plus the true yaw per record.
function simulateSpin({ seed = 1, dur = 32, flipRate = 0.25, noise = 7 } = {}) {
  const r = rng(seed), tr = new H.YawTracker(), truth = [];
  for (let t = 0; t <= dur; t += 1 / 30) {
    const u = t / dur, th = 720 * (u - Math.sin(2 * Math.PI * u) * 0.08 / Math.PI) + 4 * Math.sin(t * 3);  // speed varies
    let meas = null;
    if (r() > 0.08) {
      const back = Math.cos(th * Math.PI / 180) < -0.2;
      const { lm2, lm3 } = H.syntheticPose(th, { flipLR: back && r() < flipRate });
      const y = H.yawFromPose(lm2, lm3);
      meas = { est: H.wrap360(y.est + (r() - 0.5) * 2 * noise), frontal: y.frontal };
    }
    tr.update(t, meas);
    truth.push(th);
  }
  return { tr, truth };
}

test('yaw tracker + frontal anchors follow a noisy 720° spin', () => {
  for (const seed of [1, 2, 3]) {
    const { tr, truth } = simulateSpin({ seed });
    const corr = H.anchorCorrection(tr.records);
    assert.ok(corr.anchors.length >= 3, 'anchors at 0, 360 and 720: ' + corr.anchors.map((a) => a.target));
    let maxErr = 0;
    tr.records.forEach((rec, i) => { maxErr = Math.max(maxErr, Math.abs(corr.yaw(rec.t, rec.U) - truth[i])); });
    assert.ok(maxErr < 12, `seed ${seed}: max yaw error ${maxErr.toFixed(1)}°`);
    near(corr.yaw(tr.records.at(-1).t, tr.records.at(-1).U), truth.at(-1), 6, 'ends facing forward after two turns');
    near(truth.at(-1), 720, 5);
  }
});

test('the tracker learns either spin direction', () => {
  const tr = new H.YawTracker();
  for (let t = 0; t <= 10; t += 1 / 30) { const th = -36 * t; const { lm2, lm3 } = H.syntheticPose(th); tr.update(t, { est: H.yawFromPose(lm2, lm3).est }); }
  near(tr.U, -360, 6); assert.equal(tr.dir, -1);
});

test('view selection keeps the steadiest frame per bin and pass', () => {
  const frames = [{ yaw: 10.5, speed: 30 }, { yaw: 11, speed: 10 }, { yaw: 371, speed: 50 }, { yaw: 2, speed: 5 }, { yaw: null, speed: 0 }];
  const v = H.selectViews(frames, 2);
  assert.deepEqual(v.map((f) => f.yaw), [2, 11, 371]);
  // Counter-clockwise spins have negative yaw; passes still split at one turn.
  assert.deepEqual(H.selectViews([{ yaw: -11, speed: 1 }, { yaw: -370, speed: 1 }, { yaw: -11.5, speed: 0 }], 2).map((f) => f.yaw), [-11.5, -370]);
});

test('mask clean-up keeps the head blob only', () => {
  const S2 = 20, m = new Uint8Array(S2 * S2);
  for (let y = 2; y < 12; y++) for (let x = 6; x < 14; x++) m[y * S2 + x] = 1;  // head
  m[18 * S2 + 1] = m[18 * S2 + 2] = 1;                                        // a hand in the corner
  const k = H.keepComponent(m, S2, 10, 5);
  assert.equal(k.reduce((s, x) => s + x, 0), 80); assert.equal(k[18 * S2 + 1], 0);
  assert.equal(H.keepComponent(new Uint8Array(4), 2, 0, 0).reduce((s, x) => s + x, 0), 0);
});

const S = 96;
const synViews = (count, jitter = 0, seed = 7) => {
  const r = rng(seed), views = [];
  for (let k = 0; k < count; k++) {
    const theta = (720 * k) / count, err = (r() - 0.5) * 2 * jitter;
    // The crop drifts: axis anywhere near the middle, crown a few pixels down.
    const img = H.renderSynthetic(theta + err, S, S, { cx: S / 2 + (r() - 0.5) * 10, top: (r() - 0.5) * 4 + 2 });
    views.push({ theta, ...img });
  }
  return views;
};

test('synthetic render: nose to image right at +90°, silhouettes align on the cranium', () => {
  const front = H.renderSynthetic(0, S, S), side = H.renderSynthetic(90, S, S);
  const extent = (mask, row) => { let lo = S, hi = -1; for (let u = 0; u < S; u++) if (mask[row * S + u]) { lo = Math.min(lo, u); hi = Math.max(hi, u); } return [lo, hi]; };
  const noseRow = Math.round(80 * S / 160);
  const [l, r] = extent(side.mask, noseRow);
  assert.ok(r - S / 2 > S / 2 - l, 'profile sticks out to the right');
  const ref = H.silhouetteRef(front.mask, S, S);
  near(ref.cx, S / 2, 1); near(ref.top, 2 * S / 160, 2);
  const ref2 = H.silhouetteRef(H.renderSynthetic(90, S, S, { cx: 40 }).mask, S, S);
  // The cranium sits 6/160 of the crop behind the turning axis, so in profile its centre is that far off.
  near(ref2.cx, 40 - 6 * S / 160, 1.5, 'cranium centre in profile');
});

test('carving the synthetic head reproduces its volume (two passes, drifting crops)', () => {
  const views = synViews(180, 0);
  const rec = H.reconstruct(views, { W: S, H: S, N: 64 });
  const { dims: { nx, ny, nz }, step, origin } = rec.carved;
  let inter = 0, uni = 0;
  for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const X = origin.x + ix * step, Y = origin.y + iy * step, Z = origin.z + iz * step;
    // The reconstruction is centred on the cranium (Z offset) with Y = 0 at the crown.
    const k = S / 160, Yt = Y + 2 * k, Zt = Z - 6 * k;
    const a = rec.occ[(iy * nz + iz) * nx + ix] === 1, b = H.synInside(X, Yt, Zt, S, S) && Yt < S - 4;
    if (a && b) inter++; if (a || b) uni++;
  }
  const iou = inter / uni;
  assert.ok(iou > 0.85, 'IoU ' + iou.toFixed(3));
  assert.ok(rec.indices.length > 3000, 'a real mesh: ' + rec.indices.length / 3 + ' triangles');
  assert.ok(H.meshVolume(rec.positions, rec.indices) > 0, 'triangles face outward');
});

test('colour lands on the right side (left hair green, right hair purple, face skin)', () => {
  const rec = H.reconstruct(synViews(120, 0), { W: S, H: S, N: 56 });
  let gL = 0, pL = 0, gR = 0, pR = 0, skin = 0, skinN = 0;
  const p = rec.positions, c = rec.colors;
  for (let i = 0; i < p.length / 3; i++) {
    const X = p[3 * i], Y = p[3 * i + 1], Z = p[3 * i + 2], r = c[3 * i], g = c[3 * i + 1], b = c[3 * i + 2];
    if (Y < 0.3 * S && Z < 0) { if (X > 0.15 * S) { gL += g; pL += (r + b) / 2; } if (X < -0.15 * S) { gR += g; pR += (r + b) / 2; } }
    if (Z > 0.18 * S && Y > 0.5 * S && Y < 0.62 * S) { skin += r - b; skinN++; }
  }
  assert.ok(gL > pL, 'left side hair is green'); assert.ok(pR > gR, 'right side hair is purple');
  assert.ok(skinN > 0 && skin / skinN > 0.15, 'face is skin coloured');
});

test('redundancy: a few broken masks do not dent the head', () => {
  const views = synViews(180, 0);
  for (const k of [10, 50, 90, 130]) views[k].mask.fill(0, 0, (S * S) >> 1);  // top half missing
  views.forEach((v) => { v.top = undefined; });
  const good = H.reconstruct(synViews(180, 0), { W: S, H: S, N: 48 }), bad = H.reconstruct(views, { W: S, H: S, N: 48 });
  const count = (o) => o.reduce((s, x) => s + x, 0);
  near(count(bad.occ) / count(good.occ), 1, 0.03);
});

test('exports', () => {
  const rec = H.reconstruct(synViews(60, 0), { W: S, H: S, N: 32 });
  const obj = H.toOBJ(rec, 2), ply = H.toPLY(rec, 2);
  const nv = rec.positions.length / 3, nf = rec.indices.length / 3;
  assert.equal(obj.split('\n').filter((l) => l.startsWith('v ')).length, nv);
  assert.equal(obj.split('\n').filter((l) => l.startsWith('f ')).length, nf);
  assert.match(ply, new RegExp(`element vertex ${nv}\\n`)); assert.match(ply, new RegExp(`element face ${nf}\\n`));
  assert.equal(obj.split('\n').find((l) => l.startsWith('v ')).split(' ').length, 7, 'x y z r g b');
});

// ---------------- Full body ----------------
const BW = 120, BH = 168;
const bodyViews = (count, seed = 11) => {
  const r = rng(seed), views = [];
  for (let k = 0; k < count; k++) {
    const theta = (720 * k) / count;
    views.push({ theta, ...H.renderSynthetic(theta, BW, BH, { cx: BW / 2 + (r() - 0.5) * 8, top: (r() - 0.5) * 4, model: 'body' }) });
  }
  return views;
};

test('body grid is tall, not cubic', () => {
  const g = H.gridFor({ NY: 96, W: BW, H: BH });
  assert.equal(g.dims.ny, 96); assert.equal(g.dims.nx, Math.round(96 * BW / BH)); assert.equal(g.dims.nz, g.dims.nx);
  near(g.step * g.dims.ny, BH, 1e-9);
});

test('body render: A-pose silhouette, torso band finds the axis', () => {
  const front = H.renderSynthetic(0, BW, BH, { model: 'body' });
  const ref = H.silhouetteRef(front.mask, BW, BH, { mode: 'body' });
  near(ref.cx, BW / 2, 1); near(ref.top, H.synModel('body', BW, BH).crownY, 1.5);
  assert.ok(ref.bottom > 0.9 * BH, 'feet near the bottom of the crop');
  // Arms stand clear of the torso in the front view: a gap at hip height between arm and body.
  const row = Math.round(0.45 * BH / 1.12 + 0.04 * BH);
  let runs = 0, prev = 0;
  for (let u = 0; u < BW; u++) { const m = front.mask[row * BW + u]; if (m && !prev) runs++; prev = m; }
  assert.equal(runs, 3, 'arm, torso, arm');
  // A known axis from the pose model wins over the silhouette.
  assert.equal(H.silhouetteRef(front.mask, BW, BH, { mode: 'body', cxHint: 42 }).cx, 42);
});

test('carving the synthetic body (A-pose, two passes)', () => {
  const rec = H.reconstruct(bodyViews(180), { W: BW, H: BH, N: 96, mode: 'body' });
  const { dims: { nx, ny, nz }, step, origin } = rec.carved, crown = H.synModel('body', BW, BH).crownY;
  let inter = 0, uni = 0;
  for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const X = origin.x + ix * step, Y = origin.y + iy * step + crown, Z = origin.z + iz * step;
    const a = rec.occ[(iy * nz + iz) * nx + ix] === 1, b = H.synInside(X, Y, Z, BW, BH, 'body') && Y < BH - 2;
    if (a && b) inter++; if (a || b) uni++;
  }
  const iou = inter / uni;
  assert.ok(iou > 0.8, 'IoU ' + iou.toFixed(3));
  assert.ok(H.meshVolume(rec.positions, rec.indices) > 0, 'triangles face outward');
  // The arms survive: the mesh spans the A-pose (hand to hand), not just the torso.
  const s0 = BH / 1.12, armSpan = 2 * (0.165 + Math.sin(25 * Math.PI / 180) * 0.36 + 0.024);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < rec.positions.length; i += 3) { lo = Math.min(lo, rec.positions[i]); hi = Math.max(hi, rec.positions[i]); }
  near((hi - lo) / s0, armSpan, 0.06, 'A-pose span in body heights');
  // Colour: green shirt on the person's left, purple on the right, yellow logo on the chest front.
  const p = rec.positions, c = rec.colors, s = BH / 1.12;
  let gL = 0, gR = 0, nL = 0, nR = 0, logo = 0, nLogo = 0;
  for (let i = 0; i < p.length / 3; i++) {
    const X = p[3 * i] / s, Y = (p[3 * i + 1]) / s, Z = p[3 * i + 2] / s, g = c[3 * i + 1], b = c[3 * i + 2];
    if (Y > 0.2 && Y < 0.35 && Z < -0.02) { if (X > 0.06) { gL += g - b; nL++; } if (X < -0.06) { gR += g - b; nR++; } }
    if (Math.abs(X) < 0.02 && Y > 0.22 && Y < 0.26 && Z > 0.05) { logo += (c[3 * i] + g) / 2 - b; nLogo++; }
  }
  assert.ok(nL && nR && gL / nL > 0 && gR / nR < 0, 'left shirt green, right shirt purple');
  assert.ok(nLogo && logo / nLogo > 0.25, 'yellow logo on the chest');
});

test('body: silhouette yaw refinement recovers arms lost to tracking drift', () => {
  const r = rng(5), views = [];
  for (let k = 0; k < 300; k++) { const th = k * 2.4, err = 5 * Math.sin(k / 23) + (r() - 0.5) * 4; views.push({ theta: th, ...H.renderSynthetic(th + err, BW, BH, { model: 'body', cx: BW / 2 + (r() - 0.5) * 8 }) }); }
  const span = (rec) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < rec.positions.length; i += 3) { lo = Math.min(lo, rec.positions[i]); hi = Math.max(hi, rec.positions[i]); } return (hi - lo) / (BH / 1.12); };
  const off = span(H.reconstruct(views, { W: BW, H: BH, N: 96, mode: 'body', refine: false }));
  const on = span(H.reconstruct(views, { W: BW, H: BH, N: 96, mode: 'body' }));
  console.log(`    span without / with refinement: ${off.toFixed(3)} / ${on.toFixed(3)} (A-pose 0.68)`);
  assert.ok(on > off + 0.08, `span ${off.toFixed(3)} -> ${on.toFixed(3)}`);
  assert.ok(on > 0.5, 'arms largely back: ' + on.toFixed(3));
});

test('mask clean-up works on tall crops', () => {
  const W2 = 10, H2 = 30, m = new Uint8Array(W2 * H2);
  for (let y = 0; y < 25; y++) m[y * W2 + 5] = 1;      // a long vertical body
  m[29 * W2 + 0] = 1;                                  // speck
  const k = H.keepComponent(m, W2, 5, 12);
  assert.equal(k.reduce((s, x) => s + x, 0), 25);
});

console.log(`${n} tests passed`);
