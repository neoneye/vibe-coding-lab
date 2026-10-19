// Runs the body -> synth mapping embedded in index.html (<script id="shared-code">) in Node.
// Usage: node test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
assert.ok(m, 'shared-code script block found');
const module = { exports: {} };
new Function('module', m[1])(module);
const S = module.exports;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok', name); };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);

// Pose with both straight arms at the given shoulder angles.
const arms = (aL, aR = aL, opt) => {
  const p = S.buildPose({ lUpper: S.armDir(aL), lFore: S.armDir(aL), rUpper: S.armDir(aR), rFore: S.armDir(aR) }, opt);
  return S.measure(p.lm2, p.lm3);
};
const pitchFor = (meas, range = 12, key = 'shoulders') => S.pitchOffset(S.unit01(key, S.SOURCES[key].get(meas)), range);

test('shoulder angle reads 90° in a T-pose, 0° hanging, 180° straight up', () => {
  for (const a of [0, 30, 90, 135, 180]) {
    const mm = arms(a);
    near(mm.left.shoulder, a, 0.5, 'left'); near(mm.right.shoulder, a, 0.5, 'right');
  }
});

test('T-pose plays the base note; up raises, down lowers the pitch', () => {
  near(pitchFor(arms(90)), 0, 1e-6);
  near(pitchFor(arms(180)), 12, 0.1);
  near(pitchFor(arms(0)), -12, 0.1);
  near(pitchFor(arms(135)), 6, 0.1);
  near(pitchFor(arms(45), 24), -12, 0.1);
  let prev = -Infinity;
  for (let a = 0; a <= 180; a += 10) { const p = pitchFor(arms(a)); assert.ok(p > prev, 'monotonic at ' + a); prev = p; }
});

test('averaging both shoulders, and one arm per source', () => {
  const mm = arms(60, 120);
  near(S.SOURCES.shoulders.get(mm), 90, 0.5);
  near(S.SOURCES.leftShoulder.get(mm), 60, 0.5);
  near(S.SOURCES.rightShoulder.get(mm), 120, 0.5);
});

test('a hidden arm drops out of the average; no arms means no pitch', () => {
  const p = S.buildPose({ lUpper: S.armDir(150), lFore: S.armDir(150) });
  p.lm2[14].visibility = 0.1;  // right elbow
  const mm = S.measure(p.lm2, p.lm3);
  near(S.SOURCES.shoulders.get(mm), 150, 0.5);
  assert.equal(S.SOURCES.rightShoulder.get(mm), null);
  p.lm2[13].visibility = 0.1;
  assert.equal(S.SOURCES.shoulders.get(S.measure(p.lm2, p.lm3)), null);
});

test('image landmarks alone give the same angles for frontal arms', () => {
  const p = S.buildPose({ lUpper: S.armDir(120), lFore: S.armDir(120), rUpper: S.armDir(70), rFore: S.armDir(70) }, { aspect: 16 / 9 });
  const mm = S.measure(p.lm2, null, 16 / 9);
  near(mm.left.shoulder, 120, 0.5); near(mm.right.shoulder, 70, 0.5);
});

test('scale snapping and hysteresis', () => {
  assert.equal(S.snap(3.4, 'continuous'), 3.4);
  assert.equal(S.snap(3.4, 'chromatic'), 3);
  assert.equal(S.snap(3.4, 'major'), 4);
  assert.equal(S.snap(-1.2, 'major'), -1);   // B below the root
  assert.equal(S.snap(-2.4, 'minorPenta'), -2);
  assert.equal(S.snap(13.2, 'majorPenta'), 14);
  // Jitter around the 3/4 boundary stays on the held note until it clearly moves.
  assert.equal(S.snap(3.6, 'chromatic', 3), 3);
  assert.equal(S.snap(3.9, 'chromatic', 3), 4);
  // A held note outside the current scale is not kept.
  assert.equal(S.snap(1.2, 'major', 1), 2);
});

test('note names and frequencies', () => {
  assert.equal(S.noteName(57), 'A3'); assert.equal(S.noteName(60), 'C4'); assert.equal(S.noteName(61), 'C#4');
  near(S.midiToFreq(69), 440, 1e-9); near(S.midiToFreq(57), 220, 1e-9);
});

test('target values: idle when unmapped, span when mapped', () => {
  assert.equal(S.TARGET_VALUE.volume(null), 1); assert.equal(S.TARGET_VALUE.volume(0.25), 0.25);
  near(S.TARGET_VALUE.cutoff(0), 120, 1e-9); near(S.TARGET_VALUE.cutoff(1), 12000, 1e-6);
  assert.equal(S.TARGET_VALUE.vibrato(null), 0);
  for (const p of S.PRESETS) for (const t of S.TARGETS) {
    const src = p.map[t.key];
    assert.ok(src === 'none' || S.SOURCES[src], `${p.name}: ${t.key} -> ${src}`);
  }
});

test('One Euro filter: holds still input, follows a step', () => {
  const f = new S.OneEuro();
  let y;
  for (let i = 0; i < 60; i++) y = f.filter(90 + (i % 2 ? 1.5 : -1.5), i / 30);  // ±1.5° jitter at 30 fps
  near(y, 90, 1.0, 'jitter damped');
  for (let i = 60; i < 90; i++) y = f.filter(150, i / 30);                     // one second after a jump
  near(y, 150, 1.0, 'step followed');
});

test('elbow angle reads back from the skeleton, any shoulder angle', () => {
  for (const [a, e] of [[90, 170], [90, 90], [150, 60], [30, 120]]) {
    const p = S.buildPose({ lUpper: S.armDir(a), lFore: S.armDir(a + 180 - e), rUpper: S.armDir(a), rFore: S.armDir(a + 180 - e) });
    const mm = S.measure(p.lm2, p.lm3);
    near(mm.left.elbow, e, 0.5, 'left'); near(mm.right.elbow, e, 0.5, 'right');
    near(mm.left.shoulder, a, 0.5, 'shoulder unaffected');
  }
});

test('elbows set the duty cycle: straight = pure saw / 50% square, bent = triangle / thin pulse', () => {
  const duty = (voice, elbow) => S.TARGET_VALUE[voice + 'Duty'](S.unit01('leftElbow', elbow));
  near(duty('saw', 170), 1, 1e-9); near(duty('saw', 40), 0.5, 1e-9);
  near(duty('square', 170), 0.5, 1e-9); near(duty('square', 40), 0.05, 1e-9);
  near(duty('saw', 180), 1, 1e-9, 'clamped past straight');
  assert.ok(duty('square', 100) > duty('square', 70), 'monotonic');
  assert.equal(S.TARGET_VALUE.sawDuty(null), 1); assert.equal(S.TARGET_VALUE.squareDuty(null), 0.5);
});

test('default preset: left arm -> saw, right arm -> square, elbows -> duty', () => {
  assert.deepEqual(S.VOICES.map((v) => v.key), ['saw', 'square']);
  const d = S.PRESETS[0].map;
  assert.equal(d.sawPitch, 'leftShoulder'); assert.equal(d.sawDuty, 'leftElbow');
  assert.equal(d.squarePitch, 'rightShoulder'); assert.equal(d.squareDuty, 'rightElbow');
});

test('duty-cycle waveforms', () => {
  const { saw, square } = S.WAVES;
  near(saw(0.25, 1), -0.5, 1e-12); near(saw(0.999, 1), 0.998, 1e-9);        // plain rising saw
  near(saw(0.25, 0.5), 0, 1e-12); near(saw(0.5, 0.5), 1, 1e-12);            // triangle
  near(saw(0.75, 0.5), 0, 1e-12);
  assert.equal(square(0.1, 0.2), 1); assert.equal(square(0.3, 0.2), -1);
  // Mean of a d-duty pulse is 2d - 1.
  let mean = 0; for (let i = 0; i < 1000; i++) mean += square((i + 0.5) / 1000, 0.2) / 1000;
  near(mean, -0.6, 1e-9);
});

test('Fourier coefficients reproduce the waves (PeriodicWave input)', () => {
  // Square with duty d: first harmonic magnitude (4/pi)|sin(pi d)|.
  for (const d of [0.5, 0.25, 0.05]) {
    const { real, imag } = S.waveCoeffs('square', d);
    near(Math.hypot(real[1], imag[1]), 4 / Math.PI * Math.sin(Math.PI * d), 2e-3, 'square d=' + d);
  }
  // Plain saw: b_n = -2/(n pi), no cosine terms.
  const sw = S.waveCoeffs('saw', 1);
  for (const k of [1, 2, 5]) { near(sw.imag[k], -2 / (k * Math.PI), 2e-3, 'saw b' + k); near(sw.real[k], 0, 2e-3); }
  // Triangle: odd harmonics only, falling as 1/n^2.
  const tri = S.waveCoeffs('saw', 0.5);
  near(Math.hypot(tri.real[2], tri.imag[2]), 0, 1e-3);
  near(Math.hypot(tri.real[1], tri.imag[1]), 8 / (Math.PI ** 2), 2e-3);
  // Resynthesis away from the edges matches the waveform.
  const { real, imag } = S.waveCoeffs('saw', 0.7);
  for (const p of [0.2, 0.5, 0.85]) {
    let v = 0; for (let k = 1; k < real.length; k++) v += real[k] * Math.cos(2 * Math.PI * k * p) + imag[k] * Math.sin(2 * Math.PI * k * p);
    near(v, S.WAVES.saw(p, 0.7), 0.01, 'p=' + p);
  }
  assert.equal(S.quantDuty(0.123), 0.12); assert.equal(S.quantDuty(1.3), 1);
});

console.log(`${n} tests passed`);
