// Runs the birefringence physics core embedded in index.html (<script id="physics-core">) in Node.
// Usage: node test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="physics-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'physics-core script block found');
const module = { exports: {} };
new Function('module', m[1])(module);
const BF = module.exports;
const { dot, len, sub, add, mul, norm } = BF.v;
const deg = Math.PI / 180;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok', name); };

const C = BF.MATERIALS.calcite;

test('calcite cleavage rhomb geometry', () => {
  const f = BF.rhombFrame();
  near(Math.acos(dot(f.u1, f.u2)) / deg, 101.92, 1e-9, 'face angle on the table');
  near(Math.acos(dot(f.u1, f.u3)) / deg, 101.92, 1e-9, 'face angle u1-u3');
  near(Math.acos(dot(f.u2, f.u3)) / deg, 101.92, 1e-9, 'face angle u2-u3');
  near(f.u1[2], 0, 1e-12, 'u1 lies on the table');
  near(f.u2[2], 0, 1e-12, 'u2 lies on the table');
  const a = BF.anglesFromAxis(f.axis);
  near(a.tilt, 44.6, 0.05, 'optic axis 44.6 deg from the face normal');
  // the axis leans along the short diagonal u1+u2
  const diag = norm(add(f.u1, f.u2));
  near(Math.atan2(diag[1], diag[0]) / deg, a.az, 1e-6, 'axis azimuth along the short diagonal');
});

test('walk-off formula: calcite at 44.6 deg is about 6.2 deg', () => {
  const r = BF.walkoff(44.6 * deg, C.no, C.ne);
  near(r / deg, 6.23, 0.02, 'walk-off angle');
  near(Math.tan(r), 0.109, 0.001, 'shift per mm of thickness');
  near(BF.walkoff(0, C.no, C.ne), 0, 1e-12, 'no walk-off along the axis');
  near(BF.walkoff(90 * deg, C.no, C.ne), 0, 1e-12, 'no walk-off across the axis');
  near(BF.walkoff(40 * deg, 1.5, 1.5), 0, 1e-12, 'isotropic: none');
});

test('index ellipsoid: e-wave index along and across the axis', () => {
  near(BF.nTheta(0, C.no, C.ne), C.no, 1e-12, 'along the axis it behaves ordinarily');
  near(BF.nTheta(90 * deg, C.no, C.ne), C.ne, 1e-12, 'across the axis it is n_e');
});

test('vector refraction matches the walk-off formula for every tilt', () => {
  for (const tilt of [5, 20, 44.6, 60, 80]) {
    const a = BF.axisFromAngles(tilt, 30);
    const k = BF.insideK([0, 0, 0], [0, 0, -1], 1, a, C.no, C.ne);
    near(len(k), BF.nTheta(tilt * deg, C.no, C.ne), 1e-12, `|k| = n(theta) at ${tilt}`);
    const s = BF.rayDir(k, 1, a, C.no, C.ne);
    near(Math.acos(-s[2]), BF.walkoff(tilt * deg, C.no, C.ne), 1e-9, `walk-off at ${tilt}`);
    // the e-ray stays in the plane of k and the optic axis (perpendicular to the o-polarization)
    near(dot(s, BF.polarization(k, 0, a)), 0, 1e-9, 'e-ray stays in the principal plane');
  }
});

test('Huygens tangent point equals the walk-off direction', () => {
  for (const tilt of [10, 44.6, 70]) {
    const t = BF.huygensTangent(tilt, C.no, C.ne);
    near(Math.atan2(Math.abs(t[0]), -t[1]), BF.walkoff(tilt * deg, C.no, C.ne), 1e-9, `tilt ${tilt}`);
    near(-t[1], 1 / BF.nTheta(tilt * deg, C.no, C.ne), 1e-9, 'wavefront depth = 1/n(theta)');
  }
});

test('ordinary wave obeys Snell; e-wave reduces to it when n_o = n_e', () => {
  const N = [0, 0, 1], d = norm([Math.sin(35 * deg), 0, -Math.cos(35 * deg)]);
  const kt = sub(d, mul(N, dot(d, N)));
  const k = BF.insideK(kt, [0, 0, -1], 0, [0, 0, 1], 1.5, 1.5);
  near(Math.sin(Math.acos(-k[2] / len(k))) * 1.5, Math.sin(35 * deg), 1e-12, 'Snell');
  const ke = BF.insideK(kt, [0, 0, -1], 1, norm([0.3, 0.5, 0.8]), 1.5, 1.5);
  for (let i = 0; i < 3; i++) near(ke[i], k[i], 1e-12, 'isotropic e = o');
});

test('a parallel slab returns both rays parallel to how they came in', () => {
  const a = BF.axisFromAngles(44.6, 20);
  const d = norm([0.3, -0.2, -0.9]);
  for (const mode of [0, 1]) {
    const top = [0, 0, 1], bottom = [0, 0, -1];
    const k = BF.insideK(sub(d, mul(top, dot(d, top))), bottom, mode, a, C.no, C.ne);
    const out = BF.exitDir(k, bottom);
    for (let i = 0; i < 3; i++) near(out[i], d[i], 1e-12, `mode ${mode} exits parallel`);
  }
});

test('polarizations of the two modes are perpendicular', () => {
  const a = BF.axisFromAngles(44.6, 10);
  const k = BF.insideK([0.2, 0.1, 0], [0, 0, -1], 1, a, C.no, C.ne);
  near(dot(BF.polarization(k, 0, a), BF.polarization(k, 1, a)), 0, 1e-12, 'o perp e');
});

test('traced through the rhomb: o lands straight below, e shifted by thickness * tan(rho)', () => {
  const ax = BF.anglesFromAxis(BF.rhombFrame().axis);
  for (const rotation of [0, 37, -120]) {
    const cr = BF.buildCrystal({ shape: 'rhomb', length: 60, width: 45, thickness: 30, rotation, x: 5, y: -3, tilt: ax.tilt, azimuth: ax.az });
    near(cr.center[0], 5, 1e-9, 'centred at x');
    near(cr.center[1], -3, 1e-9, 'centred at y');
    const ro = [cr.center[0], cr.center[1], 200], rd = [0, 0, -1];
    const hit = BF.intersect(cr, ro, rd);
    assert.equal(hit.face, 1, 'enters through the top');
    const p = add(ro, mul(rd, hit.t));
    near(p[2], 30, 1e-9, 'top face at the thickness');
    const o = BF.traceMode(cr, p, rd, hit.face, 0, C.no, C.ne);
    const e = BF.traceMode(cr, p, rd, hit.face, 1, C.no, C.ne);
    assert.equal(o.kind, 'paper'); assert.equal(e.kind, 'paper');
    near(Math.hypot(o.xy[0] - p[0], o.xy[1] - p[1]), 0, 1e-9, 'o straight down');
    const shift = Math.hypot(e.xy[0] - p[0], e.xy[1] - p[1]);
    near(shift, 30 * Math.tan(BF.walkoff(ax.tilt * deg, C.no, C.ne)), 1e-9, 'e shift');
    // the shift points along the optic axis's horizontal direction (it rotates with the crystal)
    const dirShift = Math.atan2(e.xy[1] - p[1], e.xy[0] - p[0]);
    near(Math.cos(dirShift - Math.atan2(cr.axis[1], cr.axis[0])), 1, 1e-9, 'shift along the axis azimuth');
  }
});

test('steep rays bounce inside (total internal reflection) and still end somewhere', () => {
  const cr = BF.buildCrystal({ shape: 'box', length: 20, width: 20, thickness: 40, rotation: 0, x: 0, y: 0, tilt: 44.6, azimuth: 0 });
  const ro = [-100, 0, 35], rd = norm([1, 0, -0.05]);
  const hit = BF.intersect(cr, ro, rd);
  assert.ok(hit && hit.face >= 2, 'enters through a side');
  const p = add(ro, mul(rd, hit.t));
  for (const mode of [0, 1]) {
    const r = BF.traceMode(cr, p, rd, hit.face, mode, C.no, C.ne);
    assert.ok(r.kind === 'paper' || r.kind === 'out', `mode ${mode} resolves (${r.kind})`);
  }
});

test('intersect misses rays that pass beside the crystal', () => {
  const cr = BF.buildCrystal({ shape: 'box', length: 20, width: 20, thickness: 10, rotation: 0, x: 0, y: 0, tilt: 44.6, azimuth: 0 });
  assert.equal(BF.intersect(cr, [50, 0, 100], [0, 0, -1]), null);
  assert.ok(BF.intersect(cr, [0, 0, 100], [0, 0, -1]));
});

// ---- two stacked crystals
const AX = BF.anglesFromAxis(BF.rhombFrame().axis);
const stackOf = (extra) => BF.buildStack(Object.assign({ shape: 'rhomb', length: 62, width: 46, thickness: 30, rotation: 18, x: 0, y: 0,
  tilt: AX.tilt, azimuth: AX.az, stack: true, rotation2: 0, thickness2: 30, plate: 'none', plateAngle: 0 }, extra));
// Look straight down through the middle of crystal 2's top face.
const topView = st => {
  const c2 = st.c2, top = add(add(c2.O, mul(add(c2.e1, c2.e2), 0.5)), c2.e3);
  const paths = BF.traceStack(st, [top[0], top[1], 300], [0, 0, -1], C.no, C.ne);
  return { paths, images: BF.images(paths), top };
};
const S1 = 30 * Math.tan(BF.walkoff(AX.tilt * deg, C.no, C.ne));
const brightness = ims => ims.map(i => i.w).sort((a, b) => a - b);

test('stack: crystal 2 rests on crystal 1, centred on its top face', () => {
  const st = stackOf({ rotation2: 45 });
  near(st.c2.planes[0].D, -30, 1e-9, 'crystal 2 bottom plane at z = 30');
  near(st.c2.planes[1].D, 60, 1e-9, 'crystal 2 top plane at z = 60');
  const top1 = add(add(st.c1.O, mul(add(st.c1.e1, st.c1.e2), 0.5)), st.c1.e3);
  const bot2 = add(st.c2.O, mul(add(st.c2.e1, st.c2.e2), 0.5));
  for (let i = 0; i < 3; i++) near(bot2[i], top1[i], 1e-9, 'contact centres coincide');
  assert.equal(st.c2.onTable, false);
});

test('stack: same orientation gives 2 images, twice the shift (like one thick crystal)', () => {
  const { images, paths } = topView(stackOf({ rotation2: 0 }));
  near(paths.reduce((a, q) => a + q.w, 0), 1, 1e-9, 'all the light arrives');
  assert.equal(images.length, 2);
  near(images[0].w, 0.5, 1e-9, 'half'); near(images[1].w, 0.5, 1e-9, 'half');
  const d = Math.hypot(images[0].xy[0] - images[1].xy[0], images[0].xy[1] - images[1].xy[1]);
  near(d, 2 * S1, 1e-6, 'separation = 2 x single-crystal shift');
});

test('stack: turned 180 deg, the second crystal undoes the first: 1 image', () => {
  const { images, top } = topView(stackOf({ rotation2: 180 }));
  assert.equal(images.length, 1);
  near(images[0].w, 1, 1e-9, 'all the light in one image');
  near(Math.hypot(images[0].xy[0] - top[0], images[0].xy[1] - top[1]), 0, 1e-6, 'straight below the eye');
});

test('stack: turned 45 deg gives 4 equal images in a parallelogram', () => {
  const { images, paths } = topView(stackOf({ rotation2: 45 }));
  assert.equal(images.length, 4);
  for (const im of images) near(im.w, 0.25, 1e-9, 'quarter brightness');
  near(paths.reduce((a, q) => a + q.w, 0), 1, 1e-9, 'all the light arrives');
  const at = mm => images.find(i => i.paths[0][0] === mm[0] && i.paths[0][1] === mm[1]).xy;
  const oo = at([0, 0]), oe = at([0, 1]), eo = at([1, 0]), ee = at([1, 1]);
  const s1 = sub([...eo, 0], [...oo, 0]), s2 = sub([...oe, 0], [...oo, 0]);
  near(len(s1), S1, 1e-6, 'crystal-1 shift'); near(len(s2), S1, 1e-6, 'crystal-2 shift');
  near(Math.acos(dot(s1, s2) / (len(s1) * len(s2))) / deg, 45, 1e-6, 'shifts 45 deg apart');
  near(ee[0], oo[0] + s1[0] + s2[0], 1e-6, 'parallelogram x'); near(ee[1], oo[1] + s1[1] + s2[1], 1e-6, 'parallelogram y');
});

test('stack: same orientation + half-wave plate at 22.5 deg gives 3 images, 1/4 1/2 1/4 in a row', () => {
  const { images } = topView(stackOf({ rotation2: 0, plate: 'hwp', plateAngle: 22.5 }));
  assert.equal(images.length, 3);
  assert.deepEqual(brightness(images).map(w => Math.round(w * 1e9) / 1e9), [0.25, 0.25, 0.5]);
  const mid = images.find(i => Math.abs(i.w - 0.5) < 1e-9);
  assert.equal(mid.paths.length, 2, 'the middle image is o-then-e plus e-then-o');
  const [a, b] = images.filter(i => i !== mid).map(i => i.xy);
  near(mid.xy[0], (a[0] + b[0]) / 2, 1e-6, 'middle x'); near(mid.xy[1], (a[1] + b[1]) / 2, 1e-6, 'middle y');
  near(Math.hypot(a[0] - b[0], a[1] - b[1]), 2 * S1, 1e-6, 'outer images 2 shifts apart');
});

test('stack: a 45 deg rotator does the same as the 22.5 deg half-wave plate; a 90 deg rotator merges into 1', () => {
  assert.deepEqual(brightness(topView(stackOf({ plate: 'rot', plateAngle: 45 })).images).map(w => Math.round(w * 1e9) / 1e9), [0.25, 0.25, 0.5]);
  const im = topView(stackOf({ plate: 'rot', plateAngle: 90 })).images;
  assert.equal(im.length, 1); near(im[0].w, 1, 1e-9, 'one image');
});

test('stack: Malus weights follow cos^2 of the angle between the crystals', () => {
  for (const r of [10, 30, 60, 80]) {
    const { paths } = topView(stackOf({ rotation2: r }));
    const w = mm => paths.find(q => q.modes[0] === mm[0] && q.modes[1] === mm[1]).w;
    near(w([0, 0]), 0.5 * Math.cos(r * deg) ** 2, 1e-9, `o->o at ${r}`);
    near(w([0, 1]), 0.5 * Math.sin(r * deg) ** 2, 1e-9, `o->e at ${r}`);
    near(w([1, 1]), 0.5 * Math.cos(r * deg) ** 2, 1e-9, `e->e at ${r}`);
  }
});

test('stack: oblique eye rays still conserve the light', () => {
  const st = stackOf({ rotation2: 45, plate: 'hwp', plateAngle: 10 });
  for (const d of [norm([0.15, -0.1, -1]), norm([-0.2, 0.25, -1])]) {
    const ro = add(st.c2.center, mul(d, -300));
    const paths = BF.traceStack(st, ro, d, C.no, C.ne);
    assert.equal(paths.length, 4);
    near(paths.reduce((a, q) => a + q.w, 0), 1, 0.02, 'brightness adds up');
  }
});

console.log(`\n${n} tests passed`);
