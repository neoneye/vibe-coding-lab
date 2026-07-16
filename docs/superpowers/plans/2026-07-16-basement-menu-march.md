# Basement Menu March Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hand-composed chiptune march plays on every non-play screen (title, pause, dead, win) of `3d-game-basement/index.html`; gameplay stays music-free.

**Architecture:** Two gain buses replace the current "suspend the whole AudioContext on pause" behavior: `gameBus` (hum, lamp buzz, all sfx — ducked to 0 while paused) and `musicBus` (a lookahead step-sequencer playing a 16-bar E-minor march from hand-written pattern strings). A per-frame `updateMusic()` decides `music plays iff (mode !== 'play' || paused)`, with a 1 s hold after death/win so the existing stingers land first. Spec: `docs/superpowers/specs/2026-07-16-basement-menu-march-design.md`.

**Tech Stack:** Vanilla JS + WebAudio inside the single `index.html`. Verification via playwright-core driving headless Chromium (project `3d-game-basement:verify` skill conventions).

## Global Constraints

- `3d-game-basement/index.html` stays fully self-contained: no assets, no libraries, all audio procedural.
- Music never sounds during active play (`mode === 'play' && !paused`).
- The march restarts from step 0 each time it starts (hook-first is deliberate).
- M toggles music, session-only (no localStorage).
- Verify scripts are disposable — they live in the session scratchpad, never in the repo. Scratch dir used below: `/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/10374aa8-c796-461e-9ca2-7ec5ba979754/scratchpad/basement-music` (call it `$SCRATCH`).
- Existing `screenshot1.jpg` shows gameplay; the title-text change does NOT require refreshing it.
- Every check script must assert zero `pageerror` events.
- Commits go directly to `main`, message style `3d-game-basement: <what>`, ending with the Claude co-author line.

## Verify-script boilerplate

Every check script below starts with this prelude (repeated verbatim in each file so tasks are independent):

```js
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';

const cacheDir = homedir() + '/Library/Caches/ms-playwright';
const shell = readdirSync(cacheDir).filter(d => d.startsWith('chromium_headless_shell')).sort().pop();
const executablePath = `${cacheDir}/${shell}/chrome-headless-shell-mac-arm64/chrome-headless-shell`;

const browser = await chromium.launch({ executablePath, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

let failed = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name);
  if (!cond) failed = 1;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
```

and ends with this epilogue:

```js
check('no page errors', errors.length === 0);
if (errors.length) console.log(errors.join('\n'));
await browser.close();
process.exit(failed);
```

---

### Task 1: Audio buses + pause rework

Replace `AC.suspend()`-on-pause with a `gameBus` duck, and add the (silent for now) `musicBus`.

**Files:**
- Modify: `3d-game-basement/index.html` (audio section ~lines 890–948, main loop pause block ~lines 2160–2165, `__dbg` line ~2202)
- Test: `$SCRATCH/check1.mjs`

**Interfaces:**
- Produces: globals `gameBus`, `musicBus` (GainNodes, non-null whenever `AC` is non-null; `musicBus.gain` starts at 0). `__dbg.setPaused(bool)` and `__dbg.getBuses() → {game, music}` (gain values, `-1` before audio init). Later tasks connect sequencer voices to `musicBus` and ramp its gain.

- [ ] **Step 1: One-time scratch setup + write the failing test**

```bash
mkdir -p "$SCRATCH" && cd "$SCRATCH" && npm install playwright-core
```

Write `$SCRATCH/check1.mjs` — boilerplate prelude, then:

```js
await page.goto('file:///Users/neoneye/git/vibe-coding-lab/3d-game-basement/index.html?auto&debug');
await sleep(300);
await page.mouse.click(480, 300);          // user gesture → audioInit
await sleep(300);
check('audio running after click', await page.evaluate(() => __dbg.getAudioState()) === 'running');

await page.evaluate(() => __dbg.setPaused(true));
await sleep(500);
check('AC still running while paused', await page.evaluate(() => __dbg.getAudioState()) === 'running');
check('gameBus ducked while paused', (await page.evaluate(() => __dbg.getBuses())).game < 0.05);

await page.evaluate(() => __dbg.setPaused(false));
await sleep(500);
check('gameBus restored after unpause', (await page.evaluate(() => __dbg.getBuses())).game > 0.9);
```

then the epilogue.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "$SCRATCH" && node check1.mjs`
Expected: FAIL — `__dbg.setPaused is not a function` (page error) or `AC still running while paused` fails because the old code suspends the context.

- [ ] **Step 3: Implement the buses**

In `index.html`:

(a) Declaration line ~891:

```js
let AC = null, gameBus = null, musicBus = null, humNodes = null, lampBuzz = null, lampHumLevel = 0;
```

(b) In `audioInit()`, right after the `if (!AC) return;` guard, create the buses:

```js
  gameBus = AC.createGain(); gameBus.connect(AC.destination);
  musicBus = AC.createGain(); musicBus.gain.value = 0; musicBus.connect(AC.destination);
```

(c) Reroute all five game-audio sinks from `AC.destination` to `gameBus` (leave the two bus `connect(AC.destination)` calls from (b) alone):
- hum: `flt.connect(g); g.connect(gameBus);`
- lamp buzz: `bf.connect(bg); bg.connect(gameBus);`
- `tone()`: `o.connect(g); g.connect(gameBus);`
- `noiseBurst()`: `flt.connect(g); g.connect(gameBus);`
- `doorCreak()`: `bp.connect(g); g.connect(gameBus);`

(d) In `frame()`, replace the whole pause/suspend block

```js
  // pause silences everything: park the whole AudioContext
  if (AC) {
    const wantAudio = !(mode === 'play' && paused);
    if (!wantAudio && AC.state === 'running') AC.suspend();
    else if (wantAudio && AC.state === 'suspended') AC.resume();
  }
```

with:

```js
  // pause ducks the game bus; menu/pause music rides its own bus
  if (AC) {
    const gameAudible = !(mode === 'play' && paused);
    gameBus.gain.setTargetAtTime(gameAudible ? 1 : 0, AC.currentTime, 0.05);
  }
```

(e) Extend `__dbg` (the object literal at the bottom, inside the `?debug` guard) with:

```js
setPaused: p => { paused = p; },
getBuses: () => ({ game: gameBus ? gameBus.gain.value : -1, music: musicBus ? musicBus.gain.value : -1 }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "$SCRATCH" && node check1.mjs`
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/neoneye/git/vibe-coding-lab
git add 3d-game-basement/index.html
git commit -m "3d-game-basement: split audio into game/music buses; pause ducks instead of suspending

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Music engine + march composition

The sequencer and the hand-composed 16-bar march. After this task the engine exists and is testable via `__dbg`, but nothing in the game calls it yet (that's Task 3) — a harmless intermediate state.

**Files:**
- Modify: `3d-game-basement/index.html` (insert a `// ---- music` section immediately after the `sfx` object literal, before the `// ---- state` section; extend `__dbg`)
- Test: `$SCRATCH/check2.mjs`

**Interfaces:**
- Consumes: `AC`, `musicBus` from Task 1.
- Produces: `musicStart()`, `musicStop()` (both safe to call anytime; no-ops without `AC` / when already in that state), `toggleMusicMute()`, boolean `musicMuted`, and `__dbg.getMusic() → { on, muted, step, gain, steps: [lead, harmony, bass, drums] }` where each `steps` entry must be 128.

- [ ] **Step 1: Write the failing test**

Write `$SCRATCH/check2.mjs` — boilerplate prelude, then:

```js
await page.goto('file:///Users/neoneye/git/vibe-coding-lab/3d-game-basement/index.html?auto&debug');
await sleep(300);
await page.mouse.click(480, 300);          // gesture → audioInit
await sleep(200);

const m0 = await page.evaluate(() => __dbg.getMusic());
check('tracks all parse to 128 steps', m0.steps.every(s => s === 128));
check('music off initially', m0.on === false);

await page.evaluate(() => __dbg.musicStart());
await sleep(800);
const m1 = await page.evaluate(() => __dbg.getMusic());
check('music on after start', m1.on === true);
check('sequencer advances', m1.step >= 2);
check('musicBus faded up', m1.gain > 0.5);

await page.evaluate(() => __dbg.musicStop());
await sleep(600);
const m2 = await page.evaluate(() => __dbg.getMusic());
check('music off after stop', m2.on === false);
check('musicBus faded down', m2.gain < 0.1);
```

then the epilogue.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "$SCRATCH" && node check2.mjs`
Expected: FAIL — page error `__dbg.getMusic is not a function`.

- [ ] **Step 3: Implement engine + composition**

Insert after the `sfx = { ... };` object:

```js
// ---------------------------------------------------------------- music
// "March of the Marble Floor" — the menu/pause march. 16 bars of E minor,
// 126 BPM, 8th-note grid (8 tokens per bar, 128 steps). Structure
// A A' B A'': a rising 4-note fanfare hook (E-G-B-E) answered by falling
// phrases; B-major bars give the dominant its military bite.
// Tokens: pitch+octave starts a note, '.' extends it, '-' is a rest,
// '|' is a cosmetic bar line. Drums: K kick, S snare.
const MARCH = { bpm: 126 };
MARCH.lead = [
  'E4 .  G4 .  B4 .  E5 .  | D5 .  B4 D5  B4 .  G4  . | C5 .  A4 C5  A4 .  F#4 . | B4 .   .   .  B3 . B3  .',
  'E4 .  G4 .  B4 .  E5 .  | D5 .  B4 D5  B4 .  G4  . | C5 .  A4 C5  A4 .  F#4 . | B4 A4  G4 F#4 E4 . .   .',
  'G4 .  G4 A4 B4 .  B4 .  | C5 .  B4 A4  B4 .  G4  . | A4 .  A4 B4  C5 .  C5  . | D#5 .  C#5 B4 A4 . F#4 .',
  'E4 .  G4 .  B4 .  E5 .  | D5 .  B4 D5  B4 .  G4  . | C5 .  A4 C5  A4 .  F#4 . | E5 .   B4  .  E4 . .   .',
].join(' | ');
// off-beat chord stabs; progression Em G Am B / Em G Am Em / C G Am B / Em G Am Em
MARCH.harmony = [
  '- G3 - G3 - G3 - G3 | - B3 - B3 - B3 - B3 | - C4 - C4 - C4 - C4 | - D#4 - D#4 - D#4 - D#4',
  '- G3 - G3 - G3 - G3 | - B3 - B3 - B3 - B3 | - C4 - C4 - C4 - C4 | - G3  - G3  - G3  - G3',
  '- E4 - E4 - E4 - E4 | - B3 - B3 - B3 - B3 | - C4 - C4 - C4 - C4 | - D#4 - D#4 - D#4 - D#4',
  '- G3 - G3 - G3 - G3 | - B3 - B3 - B3 - B3 | - C4 - C4 - C4 - C4 | - G3  - G3  - G3  - G3',
].join(' | ');
// oom-pah root/fifth quarters over the same progression
MARCH.bass = [
  'E2 . B2 . E2 . B2 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | B2 . F#3 . B2 . F#3 .',
  'E2 . B2 . E2 . B2 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | E2 . B2  . E2 . B2  .',
  'C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | B2 . F#3 . B2 . F#3 .',
  'E2 . B2 . E2 . B2 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | E2 . B2  . E2 . B2  .',
].join(' | ');
// kick on 1/3, snare on 2/4; roll fills close each 4-bar phrase
MARCH.drums = [
  'K - S - K - S - | K - S - K - S - | K - S - K - S - | K - S - K - S S',
  'K - S - K - S - | K - S - K - S - | K - S - K - S - | K - S - K - S S',
  'K - S - K - S - | K - S - K - S - | K - S - K - S - | K - S - K - S S',
  'K - S - K - S - | K - S - K - S - | K - S - K - S - | K - S - S S S S',
].join(' | ');

const NOTE_SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function parseTrack(s) {
  const notes = []; let steps = 0;
  for (const tok of s.split(/\s+/)) {
    if (tok === '' || tok === '|') continue;
    if (tok === '.') { if (notes.length) notes[notes.length - 1].dur++; steps++; continue; }
    if (tok === '-') { steps++; continue; }
    const m = /^([A-G]#?)(\d)$/.exec(tok);
    const semi = NOTE_SEMI[m[1]] + 12 * (+m[2] + 1);
    notes.push({ step: steps, dur: 1, freq: 440 * Math.pow(2, (semi - 69) / 12) });
    steps++;
  }
  return { notes, steps };
}
function parseDrums(s) {
  const hits = []; let steps = 0;
  for (const tok of s.split(/\s+/)) {
    if (tok === '' || tok === '|') continue;
    if (tok === 'K' || tok === 'S') hits.push({ step: steps, kind: tok });
    steps++;
  }
  return { hits, steps };
}
const marchLead = parseTrack(MARCH.lead), marchHarm = parseTrack(MARCH.harmony),
      marchBass = parseTrack(MARCH.bass), marchDrums = parseDrums(MARCH.drums);
const MARCH_STEPS = marchLead.steps;
const MARCH_STEP_DUR = 60 / MARCH.bpm / 2;        // one 8th note

// scheduled chip voice: sustain then quick release, into musicBus
function mnote(freq, t0, dur, type, vol) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0);
  g.gain.setValueAtTime(vol, t0 + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(musicBus);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function mkick(t0) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t0);
  o.frequency.exponentialRampToValueAtTime(40, t0 + 0.09);
  g.gain.setValueAtTime(0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
  o.connect(g); g.connect(musicBus);
  o.start(t0); o.stop(t0 + 0.12);
}
function msnare(t0) {
  const n = (AC.sampleRate * 0.08) | 0, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
  const g = AC.createGain(); g.gain.value = 0.3;
  src.connect(f); f.connect(g); g.connect(musicBus);
  src.start(t0);
}

let musicOn = false, musicMuted = false, musicTimer = null, musicStep = 0, musicNextT = 0;
function musicTick() {
  if (!AC) return;
  const ahead = AC.currentTime + 0.18;
  while (musicNextT < ahead) {
    const t = musicNextT, s = musicStep;
    for (const n of marchLead.notes) if (n.step === s) mnote(n.freq, t, n.dur * MARCH_STEP_DUR - 0.03, 'square', 0.05);
    for (const n of marchHarm.notes) if (n.step === s) mnote(n.freq, t, 0.12, 'sawtooth', 0.022);
    for (const n of marchBass.notes) if (n.step === s) mnote(n.freq, t, 0.2, 'triangle', 0.11);
    for (const h of marchDrums.hits) if (h.step === s) (h.kind === 'K' ? mkick : msnare)(t);
    musicStep = (s + 1) % MARCH_STEPS;
    musicNextT = t + MARCH_STEP_DUR;
  }
}
function musicStart() {
  if (musicOn || !AC) return;
  musicOn = true;
  musicStep = 0; musicNextT = AC.currentTime + 0.05;   // always restart at the hook
  musicBus.gain.cancelScheduledValues(AC.currentTime);
  musicBus.gain.setTargetAtTime(musicMuted ? 0 : 1, AC.currentTime, 0.06);
  musicTimer = setInterval(musicTick, 30);
  musicTick();
}
function musicStop() {
  if (!musicOn) return;
  musicOn = false;
  clearInterval(musicTimer); musicTimer = null;
  musicBus.gain.cancelScheduledValues(AC.currentTime);
  musicBus.gain.setTargetAtTime(0, AC.currentTime, 0.12);   // ~0.4s fade-out
}
function toggleMusicMute() {
  musicMuted = !musicMuted;
  if (AC && musicOn) musicBus.gain.setTargetAtTime(musicMuted ? 0 : 1, AC.currentTime, 0.06);
  say(musicMuted ? 'MUSIC OFF — M TO RESTORE' : 'MUSIC ON');
}
```

Note: `musicStop()` is only reachable when `musicOn` is true, which requires `AC` — the `AC` uses inside it are safe.

Extend `__dbg` with:

```js
musicStart, musicStop,
getMusic: () => ({ on: musicOn, muted: musicMuted, step: musicStep,
                   gain: musicBus ? musicBus.gain.value : -1,
                   steps: [marchLead.steps, marchHarm.steps, marchBass.steps, marchDrums.steps] }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "$SCRATCH" && node check2.mjs`
Expected: all PASS (in particular `tracks all parse to 128 steps` — if that fails, a pattern string has a miscounted bar; every bar must have exactly 8 tokens).

- [ ] **Step 5: Commit**

```bash
cd /Users/neoneye/git/vibe-coding-lab
git add 3d-game-basement/index.html
git commit -m "3d-game-basement: chiptune march engine — 16-bar E-minor march on a lookahead sequencer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: State integration — music on menus/pause, M mute, keyboard audio init

**Files:**
- Modify: `3d-game-basement/index.html` (keydown handler ~line 1035, `frame()` right after the gameBus block, title screen controls line, music section from Task 2)
- Test: `$SCRATCH/check3.mjs`

**Interfaces:**
- Consumes: `musicStart()`, `musicStop()`, `toggleMusicMute()`, `__dbg.setPaused`, `__dbg.getMusic`, `__dbg.getBuses` from Tasks 1–2.
- Produces: `updateMusic(dt)` called once per frame; no new external surface.

- [ ] **Step 1: Write the failing test**

Write `$SCRATCH/check3.mjs` — boilerplate prelude, then (note: `?debug` only, no `?auto` — we start on the title screen):

```js
await page.goto('file:///Users/neoneye/git/vibe-coding-lab/3d-game-basement/index.html?debug');
await sleep(300);
await page.keyboard.press('KeyQ');         // any key is a gesture → audio + title music
await sleep(500);
check('title music after keypress', (await page.evaluate(() => __dbg.getMusic())).on === true);

await page.mouse.click(480, 300);          // title click → startGame → play
await sleep(600);
check('mode is play', await page.evaluate(() => __dbg.getMode()) === 'play');
check('music stops in play', (await page.evaluate(() => __dbg.getMusic())).on === false);

await page.evaluate(() => __dbg.setPaused(true));
await sleep(500);
const p = await page.evaluate(() => ({ m: __dbg.getMusic(), b: __dbg.getBuses() }));
check('music plays while paused', p.m.on === true);
check('game bus silent while paused', p.b.game < 0.05);

await page.keyboard.press('KeyM');
await sleep(500);
check('M mutes', (await page.evaluate(() => __dbg.getMusic())).muted === true);
check('musicBus near zero when muted', (await page.evaluate(() => __dbg.getMusic())).gain < 0.1);
await page.keyboard.press('KeyM');
await sleep(300);
check('M unmutes', (await page.evaluate(() => __dbg.getMusic())).muted === false);

await page.evaluate(() => __dbg.setPaused(false));
await sleep(300);
check('music stops on unpause', (await page.evaluate(() => __dbg.getMusic())).on === false);

await page.evaluate(() => __dbg.setMode('dead'));
await sleep(300);
check('death grace: no music at 0.3s', (await page.evaluate(() => __dbg.getMusic())).on === false);
await sleep(1200);
check('death grace: music at 1.5s', (await page.evaluate(() => __dbg.getMusic())).on === true);
```

then the epilogue.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "$SCRATCH" && node check3.mjs`
Expected: FAIL at `title music after keypress` (nothing starts music yet).

- [ ] **Step 3: Implement integration**

(a) At the end of the music section from Task 2, add the per-frame rule:

```js
// music plays on every non-play surface; a 1s hold after death/win lets
// the sting/win jingle land before the march re-enters
let musicHoldT = 0, musicPrevMode = 'title';
function updateMusic(dt) {
  if ((mode === 'dead' || mode === 'win') && musicPrevMode === 'play') musicHoldT = 1.0;
  musicPrevMode = mode;
  if (musicHoldT > 0) musicHoldT -= dt;
  if ((mode !== 'play' || paused) && musicHoldT <= 0) musicStart();
  else musicStop();
}
```

(b) In `frame()`, immediately after the gameBus duck block from Task 1, add:

```js
  updateMusic(dt);
```

(c) In the `keydown` listener, make any key a valid audio gesture and wire M — the first three lines below are new, before the existing `Tab` line:

```js
document.addEventListener('keydown', (e) => {
  keysDown[e.code] = true;
  audioInit();
  if (AC && AC.state === 'suspended') AC.resume();
  if (e.code === 'KeyM' && !e.repeat) toggleMusicMute();
  if (e.code === 'Tab') e.preventDefault();
  ...
```

(everything from the `Tab` line on is unchanged; `KeyM` sits above the `if (mode !== 'play') return;` gate so it works on every screen).

(d) Title screen controls line — change

```js
  centerText(gctx, '1/2/3 WEAPONS · SHIFT SNEAK · TAB MAP', 139, 8, '#7d786a', '');
```

to

```js
  centerText(gctx, '1/2/3 WEAPONS · SHIFT SNEAK · TAB MAP · M MUSIC', 139, 8, '#7d786a', '');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "$SCRATCH" && node check3.mjs`
Expected: all PASS.

- [ ] **Step 5: Update check2 for the new frame rule, re-run Tasks 1–2 checks (regression)**

check2.mjs's direct `__dbg.musicStart()` call now fights `updateMusic()` — in unpaused play mode the frame loop stops music every frame, so `music on after start` would fail. Update `$SCRATCH/check2.mjs`: replace the `__dbg.musicStart()` call with `__dbg.setPaused(true)` and the `__dbg.musicStop()` call with `__dbg.setPaused(false)`, keeping every assertion unchanged (pausing now legitimately starts the march, unpausing stops it).

Run: `cd "$SCRATCH" && node check1.mjs && node check2.mjs`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/neoneye/git/vibe-coding-lab
git add 3d-game-basement/index.html
git commit -m "3d-game-basement: march plays on title/pause/dead/win, M mutes, any key starts audio

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Docs + full-flow verification + owner listen

**Files:**
- Modify: `3d-game-basement/README.md` (Controls table ~line 19, features bullet ~line 55)
- Test: full pass of `check1.mjs` + `check2.mjs` + `check3.mjs`, plus a real-browser listen

- [ ] **Step 1: Update README**

Add a row to the Controls table after the `F` row:

```markdown
| M | music on/off (title, pause, dead, win screens) |
```

Change the features bullet

```markdown
- WebAudio-synthesized sound (hum, shots, alarm, stings).
```

to

```markdown
- WebAudio-synthesized sound (hum, shots, alarm, stings) plus a sequenced
  16-bar chiptune march on the title/pause/dead/win screens — gameplay
  itself stays music-free.
```

- [ ] **Step 2: Full verification run**

Run: `cd "$SCRATCH" && node check1.mjs && node check2.mjs && node check3.mjs`
Expected: every line PASS, zero page errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/neoneye/git/vibe-coding-lab
git add 3d-game-basement/README.md
git commit -m "3d-game-basement: document menu march + M mute

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Owner listen (final quality gate)**

Run: `open /Users/neoneye/git/vibe-coding-lab/3d-game-basement/index.html`

Ask the owner to listen on the title screen (press any key to start audio) and while paused. "Catchy" is a human judgment — if the hook doesn't stick, iterate on `MARCH.lead` (the pattern strings are the whole composition; bars are 8 tokens each) and re-run `node check2.mjs` to confirm the 128-step invariant still holds.
