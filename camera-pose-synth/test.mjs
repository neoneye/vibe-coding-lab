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
  near(S.TARGET_VALUE.cutoff(null), 2600, 30, 'cutoff slider default');
  near(S.TARGET_VALUE.resonance(0), 0.7, 1e-9); near(S.TARGET_VALUE.resonance(1), 24, 1e-9);
  assert.equal(S.TARGET_VALUE.reverb(0.4), 0.4); assert.equal(S.TARGET_VALUE.modDepth(null), 0.5);
  for (const key of Object.keys(S.KNOBS)) assert.ok(S.TARGETS.some((t) => t.key === key), 'knob is mappable: ' + key);
  assert.equal(S.TARGET_VALUE.vibrato(null), 0);
  for (const p of S.PRESETS) for (const t of S.TARGETS) {
    const src = p.map[t.key];
    assert.ok(src === 'none' || S.SOURCES[src], `${p.name}: ${t.key} -> ${src}`);
  }
  for (const p of S.PRESETS) assert.ok(!p.mod || S.MOD_MODES.some((m) => m.key === p.mod), p.name + ' mod mode');
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

test('elbows set the duty cycle over the full 0..100%', () => {
  const duty = (voice, elbow) => S.TARGET_VALUE[voice + 'Duty'](S.unit01('leftElbow', elbow));
  for (const voice of ['saw', 'square']) {
    near(duty(voice, 40), 0, 1e-9, voice + ' fully bent');
    near(duty(voice, 105), 0.5, 1e-9, voice + ' half way');
    near(duty(voice, 170), 1, 1e-9, voice + ' straight');
    near(duty(voice, 20), 0, 1e-9, 'clamped below'); near(duty(voice, 180), 1, 1e-9, 'clamped above');
    assert.ok(duty(voice, 100) > duty(voice, 70), 'monotonic');
  }
  assert.equal(S.TARGET_VALUE.sawDuty(null), 1); assert.equal(S.TARGET_VALUE.squareDuty(null), 0.5);
  // The extreme saw duties are clean ramps: 0% falls, 100% rises.
  near(S.WAVES.saw(0.25, 0), 0.5, 1e-12); near(S.WAVES.saw(0.25, 1), -0.5, 1e-12);
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

test('modulation routing per mode', () => {
  const fs = 220, fq = 330;
  const mix = S.modRouting('mix', 1, fs, fq);
  assert.deepEqual(mix, { sawBase: 1, sawByQ: 0, sqBase: 1, sqByS: 0, fmToSaw: 0, fmToSq: 0, sawOut: 1, sqOut: 1, sync: false, syncRatio: 1 });
  const sy = S.modRouting('sync', 0.5, fs, fq);
  assert.equal(sy.sync, true); near(sy.syncRatio, 2, 1e-12); assert.equal(sy.sqOut, 0);
  // Depth 0 is the plain mix for every mode (apart from which voice is heard).
  for (const { key } of S.MOD_MODES) {
    const r = S.modRouting(key, 0, fs, fq, true);
    assert.equal(r.sawByQ + r.sqByS + r.fmToSaw + r.fmToSq, 0, key);
    assert.equal(r.sawBase, 1, key); assert.equal(r.sqBase, 1, key);
  }
  // Ring at full depth: saw out = S * Q exactly; the square itself is muted unless heard.
  const ring = S.modRouting('ring', 1, fs, fq);
  assert.equal(ring.sawBase, 0); assert.equal(ring.sawByQ, 1); assert.equal(ring.sqOut, 0);
  assert.equal(S.modRouting('ring', 1, fs, fq, true).sqOut, 1);
  // AM at full depth swings the carrier gain between 0 and 1.
  const am = S.modRouting('amSaw', 1, fs, fq);
  near(am.sawBase - am.sawByQ, 0, 1e-12); near(am.sawBase + am.sawByQ, 1, 1e-12);
  const am2 = S.modRouting('amSquare', 0.5, fs, fq);
  near(am2.sqBase, 0.75, 1e-12); near(am2.sqByS, 0.25, 1e-12); assert.equal(am2.sawOut, 0);
  // FM deviation = depth x index x modulator frequency.
  near(S.modRouting('fmSaw', 0.5, fs, fq).fmToSaw, 0.5 * S.FM_INDEX * fq, 1e-9);
  near(S.modRouting('fmSquare', 1, fs, fq).fmToSq, S.FM_INDEX * fs, 1e-9);
  const x = S.modRouting('crossFm', 1, fs, fq);
  assert.ok(x.fmToSaw > 0 && x.fmToSq > 0 && x.sawOut === 1 && x.sqOut === 1);
  near(S.modRouting('ring', 2, fs, fq).sawByQ, 1, 1e-12, 'depth clamped');
});

test('ring modulation of the two waves is their product (signal check)', () => {
  // Simulate the VCA equation over one second at 8 kHz and compare with S*Q.
  const r = S.modRouting('ring', 1, 220, 330);
  let err = 0;
  for (let i = 0; i < 8000; i++) {
    const t = i / 8000, sv = S.WAVES.saw((t * 220) % 1, 1), qv = S.WAVES.square((t * 330) % 1, 0.5);
    err = Math.max(err, Math.abs(sv * (r.sawBase + r.sawByQ * qv) - sv * qv));
  }
  near(err, 0, 1e-12);
});

test('head tilt reads the ear line against the shoulders', () => {
  const p = S.buildPose({});
  near(S.measure(p.lm2, p.lm3).headTilt, 0, 1e-9, 'level');
  // Rotate the ears by 20 degrees around their midpoint in the image.
  const tilt = (deg) => {
    const q = S.buildPose({}), c = { x: (q.lm2[7].x + q.lm2[8].x) / 2, y: (q.lm2[7].y + q.lm2[8].y) / 2 }, r = deg * Math.PI / 180;
    for (const i of [7, 8]) {
      const dx = q.lm2[i].x - c.x, dy = q.lm2[i].y - c.y;
      q.lm2[i] = { ...q.lm2[i], x: c.x + dx * Math.cos(r) - dy * Math.sin(r), y: c.y + dx * Math.sin(r) + dy * Math.cos(r) };
    }
    return S.measure(q.lm2, q.lm3);
  };
  near(tilt(20).headTilt, 20, 1e-6); near(tilt(-15).headTilt, -15, 1e-6);
  near(S.unit01('headTilt', tilt(-30).headTilt), 0, 1e-6); near(S.unit01('headTilt', tilt(30).headTilt), 1, 1e-6);
});

// ---------------- Play logic ----------------

test('clap trigger: fires once per clap, needs hands apart again', () => {
  const g = S.GESTURES.clap();
  const seq = [1.2, 1.0, 0.6, 0.3, 0.2, 0.25, 0.5, 0.9, 1.1, 0.4, 0.3, 0.2];
  const fired = seq.map((v, i) => g.update(v, i * 0.05));
  assert.deepEqual(fired.map((f, i) => (f ? i : -1)).filter((i) => i >= 0), [3, 10]);
  // Hands held together (prayer) never re-fire.
  const h = S.GESTURES.clap();
  let count = 0; for (let i = 0; i < 100; i++) count += h.update(i < 5 ? 1 : 0.2, i * 0.05) ? 1 : 0;
  assert.equal(count, 1);
  assert.equal(S.GESTURES.clap().update(null, 0), false);
});

test('stomp trigger: foot lifted then landed', () => {
  const g = S.GESTURES.stomp();
  const lift = [0, 0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.02, 0, 0];
  assert.deepEqual(lift.map((v, i) => g.update(v, i / 30)).indexOf(true), 7);
});

test('punch: fast forward wrist movement fires, slow does not', () => {
  const v = new S.Velocity(0.03);
  const g = S.GESTURES.punch();
  let fired = false;
  for (let i = 0; i <= 60; i++) fired ||= g.update(v.update(i * 0.01, i / 30), i / 30);  // 0.3 T/s
  assert.equal(fired, false, 'slow reach');
  const v2 = new S.Velocity(0.03), g2 = S.GESTURES.punch();
  let at = -1;
  for (let i = 0; i <= 30; i++) { const x = i < 10 ? 0 : Math.min(1.2, (i - 10) * 0.15); if (g2.update(v2.update(x, i / 30), i / 30) && at < 0) at = i; }
  assert.ok(at > 10 && at < 16, 'punch fired at frame ' + at);
});

test('freeze: still arm latches, resting keeps the note, raising releases', () => {
  const f = new S.Freeze();
  let r, t = 0;
  for (; t < 0.5; t += 1 / 30) r = f.update(120, 'A', t);
  assert.equal(r.held, false, 'not yet');
  for (; t < 1.0; t += 1 / 30) r = f.update(120 + 0.1 * Math.sin(t * 40), 'A', t);
  assert.equal(r.held, true, 'latched after holding still');
  for (let a = 120; a >= 5; a -= 10, t += 1 / 30) r = f.update(a, 'other', t);
  assert.equal(r.held, true); assert.equal(r.value, 'A', 'sustains while the arm drops');
  r = f.update(null, 'gone', t += 1 / 30); assert.equal(r.value, 'A', 'sustains out of frame');
  for (let a = 5; a <= 40; a += 5, t += 1 / 30) r = f.update(a, 'live', t);
  assert.equal(r.held, false, 'raising the arm again plays live'); assert.equal(r.value, 'live');
  // Raising the arm above the frozen angle while it is still up also releases; lowering never does.
  const g = new S.Freeze(); t = 0;
  for (; t < 1.2; t += 1 / 30) g.update(100, 'B', t);
  assert.equal(g.update(104, 'x', t).held, true, 'small wobble keeps it');
  assert.equal(g.update(70, 'x', t + 0.03).held, true, 'lowering keeps it');
  assert.equal(g.update(112, 'x', t + 0.06).held, false, 'raising past the frozen angle releases');
  // Arms hanging down never latch.
  const h = new S.Freeze(); t = 0; let any = false;
  for (; t < 3; t += 1 / 30) any ||= h.update(10, 'down', t).held;
  assert.equal(any, false);
});

test('swell decays', () => {
  const sw = new S.Swell(0.3);
  assert.equal(sw.value(0), 0);
  sw.hit(1); near(sw.value(1), 1, 1e-12); near(sw.value(1.3), Math.exp(-1), 1e-9);
});

test('arpeggiator chords and patterns', () => {
  const major = S.SCALES.major;
  assert.deepEqual(S.arpChord(0, major), [0, 4, 7, 12]);      // I
  assert.deepEqual(S.arpChord(2, major), [2, 5, 9, 14]);      // ii (minor)
  assert.deepEqual(S.arpChord(-1.2, major), [-1, 2, 5, 11]);  // vii° below the root
  assert.deepEqual(S.arpChord(3.4, null), [3, 7, 10, 15]);    // continuous: major triad
  const c = [0, 4, 7, 12];
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => S.arpNote(c, 'up', k)), [0, 4, 7, 12, 0]);
  assert.deepEqual([0, 1, 2, 3].map((k) => S.arpNote(c, 'down', k)), [12, 7, 4, 0]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((k) => S.arpNote(c, 'upDown', k)), [0, 4, 7, 12, 7, 4, 0]);
  assert.deepEqual([0, 1, 2].map((k) => S.arpNote(c, 'octaves', k)), [0, 12, 0]);
  for (let k = 0; k < 50; k++) assert.ok(c.includes(S.arpNote(c, 'random', k)));
  assert.equal(S.arpNote(c, 'random', 9), S.arpNote(c, 'random', 9), 'random is reproducible');
  near(S.TARGET_VALUE.arpRate(0), 2, 1e-12); near(S.TARGET_VALUE.arpRate(1), 16, 1e-12);
});

test('effort meter ignores jitter, counts real movement', () => {
  const e = new S.Effort(0.02), r = S.rng(5);
  for (let i = 0; i < 300; i++) e.update('l', { x: (r() - 0.5) * 0.01, y: (r() - 0.5) * 0.01, z: 0 });
  assert.equal(e.total, 0, 'jitter of ±5 mm adds nothing');
  for (let i = 0; i <= 100; i++) e.update('l', { x: i * 0.01, y: 0, z: 0 });  // 1 m, slowly
  near(e.total, 1, 0.03);
});

test('finger reach and piano notes', () => {
  // A flat hand: wrist at origin, knuckles at y=-1, tips at y=-2; thumb out to the side.
  const hand = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  [[5, 8, -0.3], [9, 12, -0.1], [13, 16, 0.1], [17, 20, 0.3]].forEach(([b, t, x]) => {
    hand[b] = { x, y: -1, z: 0 }; hand[b + 1] = { x, y: -1.4, z: 0 }; hand[b + 2] = { x, y: -1.7, z: 0 }; hand[t] = { x, y: -2, z: 0 };
  });
  hand[2] = { x: -0.5, y: -0.5, z: 0 }; hand[4] = { x: -1.1, y: -0.9, z: 0 };
  const open = S.fingerReach(hand);
  assert.ok(open.slice(1).every((r) => r > 1.7), 'fingers extended');
  assert.ok(open[0] > 1.25, 'thumb extended ' + open[0]);
  hand[8] = { x: -0.3, y: -0.9, z: 0.4 };  // curl the index finger
  assert.ok(S.fingerReach(hand)[1] < 1.45, 'curled index');
  assert.deepEqual(S.pianoNotes(null), [-12, -10, -8, -5, -3, 0, 2, 4, 7, 9]);
  assert.deepEqual(S.pianoNotes(S.SCALES.minor).slice(0, 8), [-12, -10, -9, -7, -5, -4, -2, 0]);
});

test('loop recorder plays frames back by time, wrapping', () => {
  const rec = new S.LoopRecorder(2);
  for (let i = 0; i < 60; i++) rec.add(10 + i / 30, { id: i });
  assert.equal(rec.done(11.9), false); assert.equal(rec.done(12), true);
  assert.equal(rec.frameAt(0).id, 0); assert.equal(rec.frameAt(1.0).id, 30);
  assert.equal(rec.frameAt(2.5).id, 15, 'wraps'); assert.equal(rec.frameAt(-0.5).id, 45);
});

test('Pose Hero: on-pitch play scores, off-pitch misses', () => {
  const song = { bpm: 60, notes: [[0, 1], [4, 1], [7, 1]] };
  const play = (fn) => { const g = new S.HeroGame(song, 1); for (let t = 0; t <= 4.2; t += 1 / 30) g.update(t, fn(t)); return g; };
  const perfect = play((t) => { const n = S.songTimeline(song, 1).find((x) => t >= x.start && t < x.start + x.dur); return n ? [n.semis + 0.2] : []; });
  assert.ok(perfect.done); near(perfect.accuracy, 1, 0.06);
  assert.deepEqual(perfect.notes.map((x) => x.judged), ['Perfect', 'Perfect', 'Perfect']); assert.equal(perfect.best, 3);
  const flat = play(() => [0]);  // one held note: first note hit, the others missed
  assert.deepEqual(flat.notes.map((x) => x.judged), ['Perfect', 'Miss', 'Miss']); assert.equal(flat.streak, 0);
  const two = play(() => [7, 0]);  // either voice may hit the note
  assert.equal(two.notes[0].judged, 'Perfect'); assert.equal(two.notes[2].judged, 'Perfect');
  for (const k of Object.keys(S.SONGS)) assert.ok(S.SONGS[k].notes.every(([s]) => Math.abs(s) <= 12), k + ' fits ±1 octave');
});

test('Simon says: listen, repeat, grow, and time out', () => {
  const g = new S.SimonGame({ seed: 3, timeout: 4 });
  g.start(0);
  let t = 0, r;
  const heard = [];
  for (; t < 5; t += 1 / 30) { r = g.update(t, []); if (r.guide !== null && heard[heard.length - 1] !== r.guide) heard.push(r.guide); if (r.phase !== 'listen') break; }
  assert.deepEqual(heard, g.seq, 'the guide plays the phrase');
  assert.equal(r.phase, 'play');
  // Repeat it correctly.
  for (const target of [...g.seq]) for (let k = 0; k < 15; k++) { t += 1 / 30; r = g.update(t, [target + 0.1]); }
  assert.equal(r.phase, 'success');
  for (let k = 0; k < 45; k++) { t += 1 / 30; r = g.update(t, []); }
  assert.equal(g.seq.length, 2, 'a note was added'); assert.equal(r.phase, 'listen');
  // Now do nothing: listen, then time out.
  let over = null;
  for (let k = 0; k < 400 && !over; k++) { t += 1 / 30; r = g.update(t, []); over = r.events.find((e) => e.type === 'over'); }
  assert.ok(over); assert.equal(over.score, 1);
  assert.ok(g.seq.every((x) => Math.abs(x) <= 7 && S.SCALES.major.includes(((x % 12) + 12) % 12)));
});

test('hard sync oscillator: locks to the master period, stays bounded', () => {
  const sr = 48000, osc = new S.SyncOsc(sr), out = new Float32Array(sr / 2);
  osc.render(out, 100, 100 * 2.37);  // master period = 480 samples
  let maxDiff = 0, peak = 0, mean = 0;
  for (let i = 4800; i < out.length - 480; i++) { maxDiff = Math.max(maxDiff, Math.abs(out[i] - out[i + 480])); }
  for (const v of out) { peak = Math.max(peak, Math.abs(v)); mean += v / out.length; }
  assert.ok(maxDiff < 1e-3, 'periodic at the master rate: ' + maxDiff);
  assert.ok(peak <= 1.05, 'bounded: ' + peak);
  // Without sync (slave below master... equal) it is a plain saw at the slave rate.
  const o2 = new S.SyncOsc(sr), b = new Float32Array(4800); o2.render(b, 10, 100);
  near(b[240], 2 * (241 * 100 / sr % 1) - 1, 1e-6);
  // The worklet gets the class as source text.
  assert.ok(String(S.SyncOsc).startsWith('class SyncOsc'));
});

console.log(`${n} tests passed`);
