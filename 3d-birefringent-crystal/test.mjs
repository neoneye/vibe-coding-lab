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

console.log(`\n${n} tests passed`);
