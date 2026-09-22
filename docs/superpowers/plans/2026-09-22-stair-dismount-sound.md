# Stair Dismount Sound Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add synthesized punch, scream, thud, grunt and bonk sounds to `3d-stair-dismount/index.html`, with a Sound checkbox and an M hotkey.

**Architecture:** Pure decision helpers (`Dismount.sfx`) live in the `<script id="shared-code">` block and are covered by `DismountTests`, which `test.mjs` runs in Node. An inline `audio` object in the module script builds Web Audio graphs on demand and is called from four existing hooks: `doPush`, `drainImpacts`, `frame`, and the two places the dismount ends. Audio reads physics state, never writes it.

**Tech Stack:** Vanilla ES module, Web Audio API, Rapier 3D 0.20 contact-force events (already wired), Node for tests.

## Global Constraints

- Single `index.html`; no sample files, no new dependencies. Spec: "Everything is synthesized with Web Audio, no sample files".
- `node 3d-stair-dismount/test.mjs` must stay green after every task.
- Sound must never touch Rapier or `state.push`, so retry stays deterministic.
- Thresholds in newtons: `thud: 400` (equals `score.threshold`), `grunt: 1200`, `loud: 4000`. Cooldown `0.08` s. Scream-rate floor `0.25`. Push gain `0.35 + 0.65 · percent/100`.
- Timbre randomness uses `Math.random` only.
- Commits go straight to `main`, message prefix `3d-stair-dismount:`, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Pure `Dismount.sfx` helpers with self-tests

**Files:**
- Modify: `3d-stair-dismount/index.html:319-338` (add `sfx` after `score`, export it)
- Modify: `3d-stair-dismount/index.html:465-487` (add `testSfx`, register it in `run`)

**Interfaces:**
- Produces: `Dismount.sfx = { thresholds, cooldown, impactGain(force), impactKind(partName, force), allow(last, partName, t), screamRate(slowmo), pushGain(percent) }`. Task 2 calls all of these.

- [ ] **Step 1: Write the failing tests**

Insert after the closing `}` of `testScore()` (currently line 487, just before `function run()`):

```js
  function testSfx() {
    const X = Dismount.sfx;
    check('sfx: thud threshold matches score threshold', X.thresholds.thud === Dismount.score.threshold);
    check('sfx: gain zero at threshold', X.impactGain(400) === 0 && X.impactGain(100) === 0);
    check('sfx: gain monotonic', X.impactGain(600) < X.impactGain(1200) && X.impactGain(1200) < X.impactGain(3000));
    check('sfx: gain one at loud and above', near(X.impactGain(4000), 1, 1e-12) && X.impactGain(10000) === 1);
    check('sfx: kinds', X.impactKind('foot', 300) === 'none' && X.impactKind('foot', 500) === 'thud'
      && X.impactKind('foot', 1500) === 'grunt' && X.impactKind('head', 500) === 'bonk' && X.impactKind('head', 300) === 'none');
    let last = {};
    check('sfx: cooldown blocks a repeat', X.allow(last, 'foot', 1.00) && !X.allow(last, 'foot', 1.02));
    last = {};
    check('sfx: cooldown expires', X.allow(last, 'foot', 1.00) && X.allow(last, 'foot', 1.10));
    last = {};
    check('sfx: cooldown is per part', X.allow(last, 'foot', 1.00) && X.allow(last, 'hand', 1.00));
    last = {};
    check('sfx: head exempt from cooldown', X.allow(last, 'head', 1.00) && X.allow(last, 'head', 1.02));
    check('sfx: scream rate', X.screamRate(1) === 1 && X.screamRate(0.1) === 0.25 && X.screamRate(0.5) === 0.5);
    check('sfx: push gain endpoints', near(X.pushGain(0), 0.35, 1e-12) && near(X.pushGain(100), 1, 1e-12) && X.pushGain(150) === 1);
  }
```

Change the `run()` loop list from `[testStairs, testRagdoll, testScore]` to `[testStairs, testRagdoll, testScore, testSfx]`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node 3d-stair-dismount/test.mjs`
Expected: output contains `FAIL testSfx threw — TypeError: Cannot read properties of undefined` and exit code 1.

- [ ] **Step 3: Implement `sfx`**

Insert after the closing `};` of the `score` object (currently line 336) and before `return { DEG, box, ... }`:

```js
  // --- sound decisions -----------------------------------------------------
  // Pure: decide what to play. The audio module in the page decides how.
  const sfx = {
    thresholds: { thud: score.threshold, grunt: 1200, loud: 4000 },
    cooldown: 0.08,           // s between sounds from the same body part
    // 0 at the thud threshold, sqrt-shaped up to 1 at `loud`, clamped.
    impactGain(force) {
      const { thud, loud } = sfx.thresholds;
      if (force <= thud) return 0;
      return Math.min(1, Math.sqrt((force - thud) / (loud - thud)));
    },
    // Extra layer on top of the body thud: 'bonk' for the head, 'grunt' for
    // hard hits elsewhere, 'thud' alone for light ones.
    impactKind(partName, force) {
      if (force < sfx.thresholds.thud) return 'none';
      if (partName === 'head') return 'bonk';
      return force >= sfx.thresholds.grunt ? 'grunt' : 'thud';
    },
    // Per-part rate limit; `last` maps part name → last allowed time and is
    // mutated when the sound is allowed. Head hits are never dropped.
    allow(last, partName, t) {
      if (partName !== 'head' && last[partName] !== undefined && t - last[partName] < sfx.cooldown) return false;
      last[partName] = t;
      return true;
    },
    screamRate(slowmo) { return Math.max(0.25, slowmo); },
    pushGain(percent) { return Math.min(1, 0.35 + 0.65 * Math.max(0, percent) / 100); },
  };
```

Change the return line to:

```js
  return { DEG, box, cyl, wedge, wedgeVertices, aabb, aabbOverlap, topAt, covers, supportHeight, stairs, ragdoll, score, sfx };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node 3d-stair-dismount/test.mjs`
Expected: last line `DismountTests: N/N passed` with no `FAIL` lines, exit code 0. N is the previous count plus 11.

- [ ] **Step 5: Commit**

```bash
git add 3d-stair-dismount/index.html
git commit -m "3d-stair-dismount: pure sfx decision helpers with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Audio module and physics hooks

**Files:**
- Modify: `3d-stair-dismount/index.html:616-619` (add `kindByCollider` beside `boneByCollider`)
- Modify: `3d-stair-dismount/index.html:629-645` (record env collider kinds in `buildWorld`)
- Modify: `3d-stair-dismount/index.html:750-760` (`doPush` hook)
- Modify: `3d-stair-dismount/index.html:772-782` (`drainImpacts` hook)
- Modify: `3d-stair-dismount/index.html:800-810` (`finishDismount` hook)
- Modify: `3d-stair-dismount/index.html:1008-1025` (`frame` hook)
- Add: new section "Audio" placed right after the Scoring section (after `refreshDamage`, before "Simulation loop").

**Interfaces:**
- Consumes: `Dismount.sfx` from Task 1; `bones`, `boneByCollider`, `state`, `H` already in the page.
- Produces: `audio.init()`, `audio.setEnabled(on)`, `audio.punch(percent)`, `audio.startScream()`, `audio.updateScream(speed, slowmo)`, `audio.stopScream()`, `audio.impact(partName, force, envKind, t)`, `audio.flush()`. Task 3 uses `setEnabled`, `stopScream` and `audio.supported`.

- [ ] **Step 1: Add the collider-kind map and record it**

Change lines 617-618 to:

```js
const bones = [];                 // { part, body, collider, mesh, material, index }
const boneByCollider = new Map();
const kindByCollider = new Map(); // env collider handle → solid kind ('step'|'landing'|'floor'|'wall'|'post')
```

In `buildWorld`, replace `world.createCollider(cd, env);` inside the solids loop with:

```js
    const envCol = world.createCollider(cd, env);
    kindByCollider.set(envCol.handle, o.kind);
```

Add `kindByCollider.clear();` on its own line directly after `eventQueue = new RAPIER.EventQueue(true);` so a stairs change drops the old handles.

- [ ] **Step 2: Add the audio module**

Insert after `refreshDamage()` and before the `// Simulation loop` banner:

```js
// ---------------------------------------------------------------------------
// Audio — synthesized with Web Audio, no samples. Reads physics, never writes.
// ---------------------------------------------------------------------------
const audio = {
  ctx: null, master: null, noise: null, scream: null,
  supported: !!(window.AudioContext || window.webkitAudioContext),
  enabled: false,            // true once init() succeeded and state.sound is on
  last: {},                  // part name → sim time of last allowed sound
  pending: [],               // impacts collected this tick, flushed strongest first
  init() {
    if (this.ctx || !this.supported) return this.enabled = !!this.ctx && state.sound;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = state.sound ? 0.8 : 0;
      this.master.connect(this.ctx.destination);
      const n = Math.floor(this.ctx.sampleRate * 2);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch (e) { this.supported = false; this.ctx = null; return this.enabled = false; }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.enabled = state.sound;
  },
  setEnabled(on) {
    state.sound = on;
    if (on) this.init(); else this.stopScream();
    if (!this.ctx) return;
    if (on && this.ctx.state === 'suspended') this.ctx.resume();
    this.enabled = on;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(on ? 0.8 : 0, t + 0.05);
  },
  rate() { return Dismount.sfx.screamRate(state.slowmo); },
  // Filtered white-noise burst with a 5 ms attack and exponential decay.
  burst(dur, type, freq, q, peak) {
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = this.rate();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  },
  // Oscillator with a pitch sweep through a low-pass, same envelope shape.
  tone(dur, type, f0, f1, lp, peak) {
    const ctx = this.ctx, t0 = ctx.currentTime, r = this.rate();
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0 * r, t0);
    o.frequency.exponentialRampToValueAtTime(f1 * r, t0 + dur);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  punch(percent) {
    if (!this.init()) return;
    const k = Dismount.sfx.pushGain(percent);
    this.burst(0.06, 'lowpass', 180, 0.8, 0.9 * k);
    this.burst(0.03, 'bandpass', 900, 6, 0.5 * k);
  },
  // Two detuned saws through a formant band-pass, vibrato from an LFO.
  startScream() {
    if (!this.init()) return;
    this.stopScream();
    const ctx = this.ctx, t0 = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.35, t0 + 0.12);
    const formant = ctx.createBiquadFilter(); formant.type = 'bandpass'; formant.frequency.value = 1100; formant.Q.value = 3;
    formant.connect(g); g.connect(this.master);
    const oscs = [ctx.createOscillator(), ctx.createOscillator()];
    oscs[0].type = 'sawtooth'; oscs[1].type = 'sawtooth';
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
    const depth = ctx.createGain(); depth.gain.value = 25;
    lfo.connect(depth);
    for (const o of oscs) { depth.connect(o.frequency); o.connect(formant); o.start(t0); }
    lfo.start(t0);
    this.scream = { gain: g, oscs, lfo, base: 330 };
    this.updateScream(0, state.slowmo);
  },
  updateScream(speed, slowmo) {
    const s = this.scream;
    if (!s || !this.ctx) return;
    const base = 330 + 190 * Math.min(1, speed / 8);
    const r = Dismount.sfx.screamRate(slowmo);
    const t = this.ctx.currentTime;
    s.oscs[0].frequency.setTargetAtTime(base * r, t, 0.05);
    s.oscs[1].frequency.setTargetAtTime(base * 1.5 * r, t, 0.05);
  },
  stopScream() {
    const s = this.scream;
    if (!s || !this.ctx) { this.scream = null; return; }
    const t = this.ctx.currentTime;
    s.gain.gain.cancelScheduledValues(t);
    s.gain.gain.setValueAtTime(s.gain.gain.value, t);
    s.gain.gain.linearRampToValueAtTime(0.0001, t + 0.2);
    for (const o of s.oscs) o.stop(t + 0.25);
    s.lfo.stop(t + 0.25);
    this.scream = null;
  },
  // Called once per contact event inside the fixed tick; actual playback
  // happens in flush() so a full-body flop plays the 6 strongest only.
  impact(partName, force, envKind, t) {
    if (!this.enabled) return;
    const kind = Dismount.sfx.impactKind(partName, force);
    if (kind === 'none' || !Dismount.sfx.allow(this.last, partName, t)) return;
    this.pending.push({ partName, force, envKind, kind });
  },
  flush() {
    const list = this.pending; this.pending = [];
    if (!this.enabled || !list.length) return;
    list.sort((a, b) => b.force - a.force);
    for (const it of list.slice(0, 6)) {
      const k = Dismount.sfx.impactGain(it.force);
      this.burst(0.09, 'lowpass', 240, 0.8, 0.9 * k);
      if (it.envKind === 'step' || it.envKind === 'landing') this.burst(0.04, 'bandpass', 1400 + (Math.random() * 600 - 300), 5, 0.3 * k);
      if (it.kind === 'grunt') this.tone(0.14, 'sawtooth', 140, 95, 700, 0.6 * k);
      if (it.kind === 'bonk') { this.tone(0.12, 'sine', 620, 300, 4000, 0.8 * k); this.burst(0.025, 'bandpass', 3000, 8, 0.4 * k); }
    }
  },
};
```

- [ ] **Step 3: Add `state.sound` and wire the hooks**

In `state` (line 525) change `follow: true, shadows: true,` to `follow: true, shadows: true, sound: true,`.

In `doPush`, after `b.body.applyImpulseAtPoint(...)` add:

```js
  audio.punch(state.push.force);
  audio.startScream();
```

In `drainImpacts`, replace the callback body with:

```js
  eventQueue.drainContactForceEvents(e => {
    const b1 = boneByCollider.get(e.collider1()), b2 = boneByCollider.get(e.collider2());
    if (!!b1 === !!b2) return;                       // skip self contacts and env-env
    const bone = b1 || b2;
    const envHandle = b1 ? e.collider2() : e.collider1();
    const force = e.totalForceMagnitude();
    const pts = Dismount.score.impactPoints(bone.part.weight, force, H);
    if (pts <= 0) return;
    state.damage[bone.part.name] += pts;
    state.total += pts;
    audio.impact(bone.part.name, force, kindByCollider.get(envHandle), state.simTime);
  });
  audio.flush();
```

In `finishDismount`, add `audio.stopScream();` as the first line after `state.phase = 'over';`.

In `frame`, inside `if (state.phase !== 'aim') { ... }` after `if (n) updateUI();` add:

```js
    if (state.phase === 'falling' && audio.scream) {
      const pelvis = bones.find(b => b.part.name === 'pelvis');
      const v = pelvis ? pelvis.body.linvel() : { x: 0, y: 0, z: 0 };
      audio.updateScream(Math.hypot(v.x, v.y, v.z), state.slowmo);
    }
```

- [ ] **Step 4: Run the Node tests and a syntax check**

Run: `node 3d-stair-dismount/test.mjs`
Expected: all pass, exit 0.

Run: `node --check <(sed -n '/<script type="module">/,/<\/script>/p' 3d-stair-dismount/index.html | sed '1d;$d')` is unreliable because of the top-level `await`; instead extract to a scratch file and check as a module:

```bash
sed -n '/<script type="module">/,/<\/script>/p' 3d-stair-dismount/index.html | sed '1d;$d' > /private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/84e7bf62-bca5-4ce9-8041-d55dfc30c163/scratchpad/page.mjs && node --check /private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/84e7bf62-bca5-4ce9-8041-d55dfc30c163/scratchpad/page.mjs && echo SYNTAX OK
```

Expected: `SYNTAX OK`.

- [ ] **Step 5: Commit**

```bash
git add 3d-stair-dismount/index.html
git commit -m "3d-stair-dismount: synthesized punch, scream, thud, grunt and bonk

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Sound checkbox, M hotkey, reset hook

**Files:**
- Modify: `3d-stair-dismount/index.html:91` (checkbox in World card)
- Modify: `3d-stair-dismount/index.html:96-101` (`.keys` row)
- Modify: `3d-stair-dismount/index.html:920` (checkbox listener)
- Modify: `3d-stair-dismount/index.html:929-941` (keydown handler)
- Modify: `3d-stair-dismount/index.html:875` (`resetFigure`)
- Modify: `3d-stair-dismount/index.html:1032-1038` (boot: disable checkbox when unsupported)

**Interfaces:**
- Consumes: `audio.setEnabled(on)`, `audio.stopScream()`, `audio.supported`, `state.sound` from Task 2.

- [ ] **Step 1: Markup**

After the follow-camera checkbox line add:

```html
      <div class="check"><input type="checkbox" id="cSound" checked><span>Sound</span></div>
```

In `.keys`, after the `1-4` row add:

```html
        <b>M</b><span>sound on / off</span>
```

- [ ] **Step 2: Wiring**

After the `cFollow` listener add:

```js
$('cSound').addEventListener('change', e => { audio.setEnabled(e.target.checked); });
```

In the keydown handler, after the `Escape` branch add:

```js
  else if (k === 'm' || k === 'M') { $('cSound').checked = !state.sound; audio.setEnabled(!state.sound); }
```

Change `resetFigure` to:

```js
function resetFigure() { audio.stopScream(); loadStairs(state.stairsKey, { keepCamera: true }); }
```

In the boot block, after `syncSliders();` add:

```js
  if (!audio.supported) { $('cSound').checked = false; $('cSound').disabled = true; $('cSound').title = 'Web Audio unavailable'; state.sound = false; }
```

- [ ] **Step 3: Node tests and syntax check**

Same two commands as Task 2 Step 4. Expected: all pass, `SYNTAX OK`.

- [ ] **Step 4: Commit**

```bash
git add 3d-stair-dismount/index.html
git commit -m "3d-stair-dismount: sound checkbox and M hotkey

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Browser verification

**Files:** none modified unless a bug is found.

- [ ] **Step 1: Serve and load**

Use the Browser pane `preview_start` with the gitignored `.claude/launch.json` entry named `static` (http.server on 8765; create the entry if it is missing, per the memory note). Navigate to `http://localhost:8765/3d-stair-dismount/`.

- [ ] **Step 2: Push with a real gesture and check the console**

Click the `Push (space)` button with `computer` (find it with `find` query "Push"). Wait 3 s. Then `read_console_messages` with `onlyErrors: true`. Expected: no errors. Run via `javascript_tool`:

```js
({ phase: window.__dismount.state.phase, total: Math.round(window.__dismount.state.total), sound: window.__dismount.state.sound, checked: document.querySelector('#cSound').checked })
```

Expected: `sound: true`, `checked: true`, `total > 0` once the body has hit something. Listen in the pane for the punch, the scream and the thuds.

- [ ] **Step 3: Toggle with M**

Press `m` via `computer` `key`, run the probe above: expected `sound: false`, `checked: false`, and the scream stops. Press `m` again: `sound: true`, `checked: true`. Press `Escape`, then click Push again: scream restarts.

- [ ] **Step 4: Determinism**

Before the audio commits, record a score: `git stash` is not needed; instead check out `b926890` of the file into scratch and compare? Simpler: in the current page run

```js
const d = window.__dismount; d.reset(); d.push(); d.step(3000); const a = Math.round(d.state.total); d.retry(); d.step(3000); ({ a, b: Math.round(d.state.total), same: a === Math.round(d.state.total) })
```

Expected: `same: true`.

- [ ] **Step 5: Slow-mo pitch**

Set `#sSlow` to 0.25 via `form_input`, dispatch an `input` event, push with the button, and listen: the scream should be about two octaves lower and drawn out. No code assertion; note the result in the final report.

- [ ] **Step 6: Nothing to commit unless fixes were needed.** If fixes were needed, rerun Node tests and commit with prefix `3d-stair-dismount:`.
