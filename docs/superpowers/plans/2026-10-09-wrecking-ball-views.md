# Wrecking Ball Cab and Ball Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a crane-operator Cab view and a stabilised Ball-rider view to the 3D wrecking ball simulator, switchable with buttons and the C key.

**Architecture:** Pure direction math (`Wreck.view`) lives in the shared-code block and is unit tested by `WreckTests` via `node test.mjs`. The page code gains a `state.view` mode, and `updateCamera(dt)` dispatches on it: Orbit is unchanged, Cab places the camera at an eye point on `slewGroup`, and Ball places it relative to the ball body along a smoothed horizontal heading. The cab window frame is real Three.js geometry on `slewGroup`, toggled with the view.

**Tech Stack:** Single-file `3d-wrecking-ball/index.html`, Three.js and Rapier (already loaded), Node for `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-09-wrecking-ball-views-design.md`

## Global Constraints

- Everything stays in `3d-wrecking-ball/index.html` (self-contained page); tests run with `node 3d-wrecking-ball/test.mjs`.
- Views: `'orbit' | 'cab' | 'ball'`; C cycles orbit → cab → ball → orbit.
- Cab head yaw offset clamped to ±120°, final gaze pitch to −60°…+70°; double-click resets the head.
- First-person field of view 20°–75°, default 50°; Orbit always 50°.
- Near plane 0.05 in Cab and Ball, 0.5 in Orbit.
- Ball gaze: velocity above 1.5 m/s horizontal, target below 0.5 m/s, linear blend between; smoothing tau 0.3 s; pitch −12°.
- Commits go straight to `main` with the message prefix `3d-wrecking-ball:`.

## Review Focus

- Switching views while dragging the ball: the ball must be released the same way as on pointer-up (the camera change otherwise leaves the ball kinematic). Pinned in Task 2, Step 4 (`setView` calls `endPointer()`).
- Pressing C while typing in a slider/input: must not switch views. Pinned in Task 2, Step 4 (C is handled after the existing INPUT/SELECT guard).
- The ball sitting at rest (zero velocity) or right on the target centre: the gaze must still be a unit vector, never NaN. Pinned in Task 1 tests (zero inputs).
- Ball velocity exactly reversing at an impact: smoothing must not produce NaN or freeze on opposite vectors. Pinned in Task 1 tests (opposite vectors).
- Window resize in a first-person view: aspect must update without resetting the view's fov/near. Pinned in Task 2, Step 4 (the resize handler only touches aspect, unchanged).

---

### Task 1: `Wreck.view` direction math

**Files:**
- Modify: `3d-wrecking-ball/index.html` — inside the `Wreck` IIFE before `const assets = {` (~line 592), the `return { … }` export (~line 600), and `WreckTests.run` before the final `console.log('WreckTests: …')` (~line 708)
- Test: `3d-wrecking-ball/test.mjs` (unchanged runner)

**Interfaces:**
- Produces:
  - `Wreck.view.ballGaze(vel: [x,y,z], toTarget: [x,y,z]) → [x, z]`, a unit horizontal direction
  - `Wreck.view.smoothDir(cur: [x,z], want: [x,z], dt: number, tau: number) → [x, z]`, a unit vector
  - `Wreck.view.clampHead(yaw: number, pitch: number) → { yaw, pitch }` in radians
  - Constants `Wreck.view.FAST = 1.5`, `Wreck.view.SLOW = 0.5`, `Wreck.view.YAW_MAX = 120°`, `Wreck.view.PITCH_MIN = −60°`, `Wreck.view.PITCH_MAX = 70°` (radians)

- [ ] **Step 1: Write the failing tests** — add to `WreckTests.run` just before `console.log('WreckTests: ' …)`:

```js
    // ---- view math
    {
      const V = W.view, D = Math.PI / 180;
      const unit = (d, msg) => T.near(Math.hypot(d[0], d[1]), 1, 1e-9, msg + ' unit');
      let d = V.ballGaze([3, 0, 0], [0, 0, 5]);
      T.near(d[0], 1, 1e-9, 'fast ball looks along velocity'); T.near(d[1], 0, 1e-9, 'fast ball z');
      d = V.ballGaze([0.2, 0, 0], [0, 0, 5]);
      T.near(d[0], 0, 1e-9, 'slow ball looks at target x'); T.near(d[1], 1, 1e-9, 'slow ball looks at target z');
      d = V.ballGaze([1, 0, 0], [0, 0, 1]);
      T.near(d[0], Math.SQRT1_2, 1e-9, 'midway blend x'); T.near(d[1], Math.SQRT1_2, 1e-9, 'midway blend z');
      d = V.ballGaze([0, -5, 0], [0, 0, -2]);
      T.near(d[1], -1, 1e-9, 'vertical speed is ignored');
      d = V.ballGaze([0, 0, 0], [0, 3, 0]);
      T.near(d[0], 0, 1e-9, 'all-zero gaze x'); T.near(d[1], 1, 1e-9, 'all-zero gaze falls back to +z');
      d = V.ballGaze([0, 0, -4], [0, 0, 0]);
      T.near(d[1], -1, 1e-9, 'fast ball on the target centre');
      d = V.ballGaze([-1, 0, 0], [1, 0, 0]);
      T.near(d[0], 1, 1e-9, 'cancelling blend falls back to the target');
      unit(d, 'cancelling blend');
      const c170 = [Math.sin(170 * D), Math.cos(170 * D)], m170 = [Math.sin(-170 * D), Math.cos(-170 * D)];
      d = V.smoothDir([0, 1], [1, 0], 0, 0.3);
      T.near(d[1], 1, 1e-9, 'dt 0 keeps the current direction');
      d = V.smoothDir([0, 1], [1, 0], 100, 0.3);
      T.near(d[0], 1, 1e-9, 'long dt reaches the wanted direction');
      d = V.smoothDir([0, 1], [1, 0], 0.3 * Math.LN2, 0.3);
      T.near(d[0], Math.SQRT1_2, 1e-9, 'half-life turns halfway x'); T.near(d[1], Math.SQRT1_2, 1e-9, 'half-life turns halfway z');
      d = V.smoothDir([0, 1], [0, -1], 0.3 * Math.LN2, 0.3);
      T.near(Math.abs(d[0]), 1, 1e-9, 'opposite vectors turn a quarter'); unit(d, 'opposite vectors');
      d = V.smoothDir(c170, m170, 0.3 * Math.LN2, 0.3);
      T.near(d[1], -1, 1e-9, 'turns the short way across 180°');
      let h = V.clampHead(3, 0);
      T.near(h.yaw, 120 * D, 1e-12, 'yaw clamps right'); T.near(h.pitch, 0, 1e-12, 'pitch untouched');
      h = V.clampHead(-3, 2);
      T.near(h.yaw, -120 * D, 1e-12, 'yaw clamps left'); T.near(h.pitch, 70 * D, 1e-12, 'pitch clamps up');
      h = V.clampHead(0, -2);
      T.near(h.pitch, -60 * D, 1e-12, 'pitch clamps down');
      h = V.clampHead(0.5, -0.2);
      T.near(h.yaw, 0.5, 1e-12, 'yaw in range'); T.near(h.pitch, -0.2, 1e-12, 'pitch in range');
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node 3d-wrecking-ball/test.mjs`
Expected: a TypeError, because `W.view` is undefined (exit code 1).

- [ ] **Step 3: Implement** — insert before `const assets = {` inside the `Wreck` IIFE:

```js
  // ------------------------------------------------------------ view math
  // Horizontal directions are [x, z] unit vectors; heading angle = atan2(x, z).
  const view = (() => {
    const DEG = Math.PI / 180;
    const FAST = 1.5, SLOW = 0.5;
    const YAW_MAX = 120 * DEG, PITCH_MIN = -60 * DEG, PITCH_MAX = 70 * DEG;
    const norm = (x, z) => { const l = Math.hypot(x, z); return l > 1e-9 ? [x / l, z / l] : null; };
    // Where the ball rider looks: along the horizontal velocity when the ball is
    // moving, toward the target when it is nearly still, blended in between.
    function ballGaze(vel, toTarget) {
      const s = Math.hypot(vel[0], vel[2]);
      const v = norm(vel[0], vel[2]), t = norm(toTarget[0], toTarget[2]);
      const w = Math.max(0, Math.min(1, (s - SLOW) / (FAST - SLOW)));
      const mix = v && t ? norm(w * v[0] + (1 - w) * t[0], w * v[1] + (1 - w) * t[1]) : null;
      return mix || (w < 1 && t) || v || t || [0, 1];
    }
    // Turn cur toward want by 1 - exp(-dt/tau) of the angle, the short way round.
    function smoothDir(cur, want, dt, tau) {
      const a = Math.atan2(cur[0], cur[1]);
      let d = Math.atan2(want[0], want[1]) - a;
      d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
      const b = a + d * (1 - Math.exp(-dt / tau));
      return [Math.sin(b), Math.cos(b)];
    }
    function clampHead(yaw, pitch) {
      return { yaw: Math.max(-YAW_MAX, Math.min(YAW_MAX, yaw)), pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch)) };
    }
    return { FAST, SLOW, YAW_MAX, PITCH_MIN, PITCH_MAX, ballGaze, smoothDir, clampHead };
  })();

```

and add `view` to the export line:

```js
  return { MATERIALS, Q_ID, qYaw, qRoll, qPitch, qMul, rotate, axes, aabb, obbOverlap, volume, wallCourses, place, ring, Structure, assets, BOND_EPS, view };
```

Note on the "cancelling blend" test: with `vel [-1,0,0]` (w = 0.5) and target `[1,0,0]`, the mix is zero, so `mix` is null and `w < 1 && t` returns the target. For the opposite-vector smoothing test, `d = ±π`, and either sign gives `|x| = 1`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node 3d-wrecking-ball/test.mjs`
Expected: `WreckTests: N passed, 0 failed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add 3d-wrecking-ball/index.html
git commit -m "3d-wrecking-ball: view math for the cab and ball cameras, with tests"
```

---

### Task 2: View switching and Cab view

**Files:**
- Modify: `3d-wrecking-ball/index.html` — World card HTML (~line 77–86), `#hint` (~line 100), globals (~line 795), crane build block (~lines 809–870), camera section (~lines 887–895), input section (~lines 1381–1448), `syncVisuals`/`frame` (~lines 1514–1570), `window.__wreck` (~line 1582)

**Interfaces:**
- Consumes: `W.view.clampHead` (Task 1), with the page-scope alias `const W = Wreck`.
- Produces: `state.view`, `setView(name)`, `cycleView()`, `updateCamera(dt = 1 / 60)`, `syncVisuals(dt)`, `fpFov`, `head = { yaw, pitch }`, `cabMesh`, `cabFrame`, `__wreck.setView`, `__wreck.view`, and the `VIEWS` array `['orbit', 'cab', 'ball']`. Task 3 adds the `'ball'` branch to `updateCamera`.

- [ ] **Step 1: HTML and hint.** In the World card body, after the `cSound` check line, add:

```html
      <label>View <span class="val">C cycles</span></label>
      <div class="grid3" id="viewButtons"><button data-view="orbit">Orbit</button><button data-view="cab">Cab</button><button data-view="ball">Ball</button></div>
```

In `<style>`, after the `.grid2 button` rule:

```css
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 4px; }
  .grid3 button { width: 100%; }
```

- [ ] **Step 2: State and globals.** Add `view: 'orbit'` to `state` (`mortar: 1, slowmo: 1, shadows: true, follow: false, view: 'orbit',`). Change `let ballMesh = null, chainMesh = null, hookMesh = null;` to:

```js
let ballMesh = null, chainMesh = null, hookMesh = null, cabMesh = null, cabFrame = null;
```

- [ ] **Step 3: Cab mesh reference and window frame.** In the crane block, replace `const cab = new THREE.Mesh(` … `slewGroup.add(cab);` with a version that stores `cabMesh`, then build the frame right after it:

```js
  cabMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 1.6), new THREE.MeshStandardMaterial({ color: 0x3a5f7a, roughness: 0.3, metalness: 0.4 }));
  cabMesh.position.set(1.0, 2.5, 1.2); cabMesh.castShadow = true;
  slewGroup.add(cabMesh);
  // operator's cab seen from inside: pillars, roof rim, sill, dashboard, levers
  cabFrame = new THREE.Group();
  cabFrame.position.copy(cabMesh.position);
  cabFrame.visible = false;
  {
    const bar = (sx, sy, sz, x, y, z, mat = dark) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; cabFrame.add(m);
      return m;
    };
    const hx = 0.66, hz = 0.76, hy = 0.75;                     // half extents of the cab
    for (const x of [-hx, hx]) for (const z of [-hz, hz]) bar(0.07, 1.5, 0.07, x, 0, z);
    for (const y of [hy, -0.2]) {                              // roof rim and window sill
      bar(1.4, 0.06, 0.06, 0, y, -hz); bar(1.4, 0.06, 0.06, 0, y, hz);
      bar(0.06, 0.06, 1.6, -hx, y, 0); bar(0.06, 0.06, 1.6, hx, y, 0);
    }
    bar(0.06, 0.06, 1.6, 0, hy, 0);                            // roof crossbar
    bar(1.4, 0.04, 1.6, 0, -hy, 0);                            // floor
    bar(1.2, 0.35, 0.3, 0, -0.35, hz - 0.18, steel);           // dashboard
    const lever = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), knob = new THREE.SphereGeometry(0.045, 10, 8);
    for (const x of [-0.32, 0.32]) {
      const g = new THREE.Group();
      g.position.set(x, -0.45, 0.15); g.rotation.x = 0.35;
      const s = new THREE.Mesh(lever, dark); s.position.y = 0.17; g.add(s);
      const k = new THREE.Mesh(knob, steel); k.position.y = 0.36; g.add(k);
      cabFrame.add(g);
    }
  }
  slewGroup.add(cabFrame);
```

- [ ] **Step 4: Camera dispatch, view switching, input.** Replace the camera section (`const cam = …` through the end of `updateCamera`) with:

```js
const cam = { az: 0.55, el: 0.32, dist: 55, target: new THREE.Vector3() };
const VIEWS = ['orbit', 'cab', 'ball'];
const HINTS = {
  orbit: 'drag empty space to orbit &middot; wheel to zoom<br>drag the ball to pull it back &middot; C changes view',
  cab: 'operator&rsquo;s seat &middot; drag to look around &middot; double-click to recentre<br>wheel to zoom &middot; drag the ball to pull it back &middot; C changes view',
  ball: 'riding the ball &middot; space shoves it<br>wheel to zoom &middot; C changes view',
};
const CAB_EYE = new THREE.Vector3(1.05, 2.8, 1.3);  // slewGroup local, inside the cab
let fpFov = 50;
const head = { yaw: 0, pitch: 0 };
const cabGaze = new THREE.Vector3(0, 0, 1), camDir = new THREE.Vector3();
function setView(name) {
  if (!VIEWS.includes(name)) return;
  if (grabbed || dragging) endPointer();
  state.view = name;
  const fp = name !== 'orbit';
  camera.near = fp ? 0.05 : 0.5;
  camera.fov = fp ? fpFov : 50;
  camera.updateProjectionMatrix();
  cabMesh.visible = name !== 'cab';
  cabFrame.visible = name === 'cab';
  if (name === 'cab') { head.yaw = 0; head.pitch = 0; }
  $('hint').innerHTML = HINTS[name];
  for (const b of document.querySelectorAll('#viewButtons button')) b.classList.toggle('on', b.dataset.view === name);
}
function cycleView() { setView(VIEWS[(VIEWS.indexOf(state.view) + 1) % VIEWS.length]); }
function updateCamera(dt = 1 / 60) {
  if (state.view === 'cab') return updateCabCamera(dt);
  const tgt = state.follow && ballBody ? tmpP.copy(ballBody.translation()) : centre;
  cam.target.lerp(tgt, 0.15);
  const ce = Math.cos(cam.el);
  camera.position.set(cam.target.x + cam.dist * Math.sin(cam.az) * ce, cam.target.y + cam.dist * Math.sin(cam.el), cam.target.z + cam.dist * Math.cos(cam.az) * ce);
  camera.lookAt(cam.target);
}
// Operator's eye in the cab: watches the ball (smoothed), plus the head offset.
function updateCabCamera(dt) {
  craneGroup.updateMatrixWorld(true);
  camera.position.copy(CAB_EYE).applyMatrix4(slewGroup.matrixWorld);
  if (ballBody) {
    camDir.copy(ballBody.translation()).sub(camera.position).normalize();
    cabGaze.lerp(camDir, 1 - Math.exp(-dt / 0.25)).normalize();
  }
  const yaw = Math.atan2(cabGaze.x, cabGaze.z) + head.yaw;
  const pitch = W.view.clampHead(0, Math.asin(clamp(cabGaze.y, -1, 1)) + head.pitch).pitch;
  camDir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(camDir.add(camera.position));
}
```

The head yaw offset is clamped where it changes, in the pointer handler below. `W` is the page-scope `const W = Wreck` (line ~780). `dragging` and `endPointer` are declared later in the input section; `setView` only reads them at call time, after the module has finished evaluating.

In `pointerdown`, make the ball view inert and keep the existing grab for orbit and cab:

```js
renderer.domElement.addEventListener('pointerdown', e => {
  lastX = e.clientX; lastY = e.clientY;
  if (state.view === 'ball') return;
  pointerToNdc(e);
  …existing body unchanged from `raycaster.setFromCamera(ndc, camera);` through `dragging = true; }`…
  renderer.domElement.setPointerCapture(e.pointerId);
});
```

(Move the existing `lastX = e.clientX; lastY = e.clientY;` line to the top of the handler as shown.)

In `pointermove`, change the `else if (dragging)` branch to:

```js
  } else if (dragging && state.view === 'cab') {
    head.yaw = W.view.clampHead(head.yaw + (e.clientX - lastX) * 0.004, 0).yaw;
    head.pitch = clamp(head.pitch + (e.clientY - lastY) * 0.004, -1.3, 1.3);
  } else if (dragging) {
```

and keep the existing orbit body under that last `else if (dragging)`.

Replace the wheel handler with:

```js
renderer.domElement.addEventListener('wheel', e => {
  if (state.view === 'orbit') cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 8, 300);
  else { fpFov = clamp(fpFov * Math.exp(e.deltaY * 0.0012), 20, 75); camera.fov = fpFov; camera.updateProjectionMatrix(); }
  e.preventDefault();
}, { passive: false });
renderer.domElement.addEventListener('dblclick', () => { if (state.view === 'cab') { head.yaw = 0; head.pitch = 0; } });
```

In the keydown handler, after the INPUT/SELECT guard and before the Space line, add:

```js
  if (e.code === 'KeyC') { if (!e.repeat) cycleView(); return; }
```

Add button wiring next to the other UI listeners (after the `cFollow` listener):

```js
for (const b of document.querySelectorAll('#viewButtons button')) b.addEventListener('click', () => setView(b.dataset.view));
```

- [ ] **Step 5: Pass dt through.** Change `function syncVisuals() {` to `function syncVisuals(dt) {` and its `updateCamera();` to `updateCamera(dt);`. In `frame`, change `syncVisuals();` to `syncVisuals(real);`. After the startup lines `updateCamera(); cam.target.copy(centre);`, add `setView('orbit');` so the buttons and hint start in sync.

- [ ] **Step 6: Debug handle.** In `window.__wreck` add:

```js
  setView,
  get view() { return state.view; },
  head,
```

- [ ] **Step 7: Unit tests still pass**

Run: `node 3d-wrecking-ball/test.mjs`
Expected: `0 failed`.

- [ ] **Step 8: Visual check of the Cab view.** Start the `static` preview (`preview_start {name: "static"}`) and navigate to `http://127.0.0.1:8765/3d-wrecking-ball/index.html`. The Browser pane pauses rAF while hidden, so drive it synchronously with `javascript_tool`:

```js
await window.__wreckReady; __wreck.setView('cab'); __wreck.step(30); [__wreck.view, document.getElementById('hint').textContent]
```
 Take a screenshot. Expected: pillars and sill frame the view, the dashboard and levers are at the bottom, the boom lattice is up and to the left, and the ball hangs ahead. Check the console for errors. Then `__wreck.setView('orbit'); __wreck.step(1)` and confirm with a screenshot that the Orbit view looks the same as before. (Until Task 3, 'ball' renders with the orbit math.) If a pillar sits in the middle of the view or the boom lines cut through the eye, adjust `CAB_EYE` (x between 0.9 and 1.3, z between 1.1 and 1.5) and re-check.

- [ ] **Step 9: Commit**

```bash
git add 3d-wrecking-ball/index.html
git commit -m "3d-wrecking-ball: view switcher (C key) and the crane operator's cab view"
```

---

### Task 3: Ball view

**Files:**
- Modify: `3d-wrecking-ball/index.html` — camera section added in Task 2

**Interfaces:**
- Consumes: `Wreck.view.ballGaze`, `Wreck.view.smoothDir` (Task 1); `updateCamera(dt)`, `state.view`, `centre`, `ballBody`, `state.radius` (Task 2 and existing code)
- Produces: `updateBallCamera(dt)` and `ballHeading` (`[x, z]`)

- [ ] **Step 1: Implement.** Under `updateCabCamera`, add:

```js
// Riding the ball: upright, ignores spin, looks where the ball is going.
const BALL_CAM = { up: 0.35, back: 0.8, side: 0.3, pitch: -12 * DEG };
let ballHeading = [0, -1];
function updateBallCamera(dt) {
  const p = ballBody.translation(), v = ballBody.linvel();
  const want = W.view.ballGaze([v.x, v.y, v.z], [centre.x - p.x, 0, centre.z - p.z]);
  ballHeading = W.view.smoothDir(ballHeading, want, dt, 0.3);
  const [hx, hz] = ballHeading, r = state.radius;
  // right of the heading (screen right) is (-hz, hx) for a camera looking along (hx, hz)
  camera.position.set(
    p.x - hx * BALL_CAM.back * r - hz * BALL_CAM.side * r,
    p.y + r + BALL_CAM.up,
    p.z - hz * BALL_CAM.back * r + hx * BALL_CAM.side * r);
  const cp = Math.cos(BALL_CAM.pitch);
  camDir.set(hx * cp, Math.sin(BALL_CAM.pitch), hz * cp).add(camera.position);
  camera.lookAt(camDir);
}
```

Then in `updateCamera`, after the cab line, add:

```js
  if (state.view === 'ball' && ballBody) return updateBallCamera(dt);
```

In `setView`, when entering the ball view, snap the heading so the first frame doesn't swing in from a stale direction:

```js
  if (name === 'ball' && ballBody) {
    const p = ballBody.translation(), v = ballBody.linvel();
    ballHeading = W.view.ballGaze([v.x, v.y, v.z], [centre.x - p.x, 0, centre.z - p.z]);
  }
```

(`setView` is declared before `ballHeading`, but it only runs after the module has finished evaluating, so the `let` is initialised by then.)

Check the screen-right sign: for a camera looking along +Z (`hx=0, hz=1`), screen right is −X. The offset `(-hz, hx) = (-1, 0)` points to −X, so it's correct.

- [ ] **Step 2: Unit tests still pass**

Run: `node 3d-wrecking-ball/test.mjs`
Expected: `0 failed`.

- [ ] **Step 3: Visual check of the Ball view, at rest and mid-swing.** In the Browser pane:

```js
__wreck.load('castle'); __wreck.setView('ball'); __wreck.step(20); __wreck.view
```

Screenshot: the target should be ahead, the ball's top curve along the bottom of the frame, and the chain rising off-centre. Then:

```js
__wreck.shove(); __wreck.step(40);
```

Screenshot: the view should face the swing direction, with no roll. `__wreck.ballScreen()` should return finite numbers (a NaN camera would make them NaN). Check the console for errors. If the ball fills more than about a third of the frame or is invisible, tune `BALL_CAM.up`, `back` and `pitch`. If the chain is dead centre, increase `side`. Record any final values in the spec.

- [ ] **Step 4: Commit**

```bash
git add 3d-wrecking-ball/index.html docs/superpowers/specs/2026-10-09-wrecking-ball-views-design.md
git commit -m "3d-wrecking-ball: ride the wrecking ball — stabilised ball view"
```

---

### Task 4: Final pass

**Files:**
- Modify: `3d-wrecking-ball/index.html` (only if fixes are needed)

- [ ] **Step 1: Interaction checks in the Browser pane.** In each view, check:
  - The C key cycles in order, and the `on` button highlight follows.
  - C typed while a slider has focus does nothing.
  - Arrow/WASD/QE keys move the crane while in Cab, and the view turns with slew. Use `__wreck.keys.add('KeyA'); __wreck.drive(1); __wreck.keys.delete('KeyA'); __wreck.step(5)`, then take a screenshot.
  - Double-click in Cab recentres the head.
  - Switching to Orbit restores the old framing (fov 50, near 0.5).
  - Resizing the window keeps the current view.
- [ ] **Step 2: Run the tests one last time:** `node 3d-wrecking-ball/test.mjs` → `0 failed`.
- [ ] **Step 3: Commit any fixes**, using the message prefix `3d-wrecking-ball:`.
