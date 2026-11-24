# Spartan Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A two-player, one-keyboard voxel fighting game: Spartan gladiators fight through three levels (fists → sword and shield → beasts) in a Roman arena in front of Caesar, earning reward moves and chopping arms.

**Architecture:** `game-spartan-arena/index.html` has two scripts. A classic `<script id="shared-code">` holds the pure-JS game core (`SA`: rig table, PNG→voxel mesher, input queue, fixed-tick simulation of the whole match, and `SATests`), which runs unchanged in Node via `test.mjs`. A `<script type="module">` holds the three.js presentation: it loads the PNG slice sheets, builds the voxel meshes and skeletons, renders at low resolution with nearest-neighbour upscaling, poses the rigs from simulation state, and turns `match.events` into effects, HUD and sound. The PNGs are first drawn by a Node generator, `tools/make_art.mjs`, which has no dependencies.

**Tech Stack:** three.js 0.170.0 from `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js` via an importmap (the repo's usual version); Web Audio; Node 22 (`node:zlib` for PNG encoding in the generator and for reading PNG headers in tests). No other dependencies and no physics library.

**Spec:** `docs/superpowers/specs/2026-11-24-spartan-arena-design.md`

## Global Constraints

- Folder `game-spartan-arena/`: `index.html`, `test.mjs`, `README.md`, `screenshot1.jpg`, `voxels/<model>/<part>.png`, `backdrop.png`, `tools/make_art.mjs`.
- Slice sheet: one PNG per part, 15 slices in one row, sheet size (15·W) × H; slice 0 = nearest the camera; alpha < 128 = empty; slices are side views of a model facing right (+x).
- Joint pivots and offsets live in the rig table (`SA.MODELS`) in `index.html`, never in the images.
- The generator never overwrites an existing PNG unless run with `--force`.
- Original content only: no Mortal Kombat names, characters, catchphrases or logos. The finishing move is called **Caesar's verdict**; the word "fatality" never appears.
- Gore is cartoon only: chunky red voxel cubes and stains that fade by the next round.
- Pixel look: the scene renders to a low-resolution target scaled up by a whole number with nearest-neighbour filtering. The canvas backing store is sized in device pixels (retina Mac).
- Runs over http (GitHub Pages; locally `python3 -m http.server 8000` from the repo root). Opening from `file://` shows an explanatory message, not a blank page.
- Controls: P1 = A/D move, W jump, S crouch, F punch/slash, G kick, H special. P2 = ←/→ move, ↑ jump, ↓ crouch, `.` punch/slash, `/` kick, Right Shift special. Block = hold away from the opponent. M = sound on/off.
- Simulation runs at a fixed 60 ticks per second; key presses are queued so quick taps are never lost.

## Review Focus

1. **Both players mashing at once.** Two players pressing keys in the same frame must both register, and a tap shorter than one tick must still act. → Task 5 test "taps shorter than a tick still fire" and "both players' presses in the same tick both act".
2. **Tab switch or focus loss mid-fight.** Keys held when the window loses focus must not stay held, and the long frame gap when you come back must not fast-forward the fight. → Task 5 tests "releaseAll clears held keys" and "ticksFor clamps a long gap to 5 ticks".
3. **Fighting at the arena wall.** A fighter pushed into the wall or jumped over there must never leave the arena or get stuck inside the other fighter. → Task 5 test "fighters never overlap or leave the arena at the wall".
4. **An edited PNG with the wrong size, or a missing one.** The page must name the file and the expected size instead of going blank. → Task 2 test "checkSheet reports wrong size" and Task 3's loader overlay.
5. **Odd window sizes.** A narrow or short window must still show both fighters and a HUD whose text doesn't overlap. → Task 11 browser check at 1280×720, 800×600 and 375×812.

---

### Task 1: Folder, test harness and the slice mesher

**Files:**
- Create: `game-spartan-arena/index.html` (just enough page to hold the `shared-code` block)
- Create: `game-spartan-arena/test.mjs`

**Interfaces:**
- Produces: global `SA` (a namespace object) and `SATests.run() -> boolean`, both defined in `<script id="shared-code">`.
- Produces: `SA.meshSlices(rgba, sheetW, sheetH, slices = 15, recolor = null) -> { positions: Float32Array, normals: Float32Array, colors: Float32Array, indices: Uint32Array, voxels: number, faces: number }`.
  - Voxel coordinates: pixel (sx, sy) of slice s becomes the unit cube at `x = sx % W`, `y = H - 1 - sy`, `z = slices - 1 - s`, where `W = sheetW / slices`. So slice 0 has the largest z, nearest the camera, and +y is up.
  - Only faces between a filled and an empty voxel are emitted, as 2 triangles each.
  - Colours are sRGB in 0..1. The renderer converts them to linear.
  - `recolor` is a `Map<number, number>` (0xRRGGBB → 0xRRGGBB) applied before emitting colours.
- Produces: `SA.rng(seed) -> () => number`, a deterministic generator (mulberry32) returning [0, 1).

- [ ] **Step 1: Write the failing tests**

`test.mjs` follows `game-blast-yard/test.mjs` exactly, using `SATests` in place of `BYTests`. Then it does the PNG checks added in Task 2. The tests go in `SATests.run()`, with a `check(name, cond, info)` helper:

```js
// one red voxel in a 1x1x15 sheet, slice 0
const one = new Uint8Array(15 * 4); one.set([255, 0, 0, 255], 0);
let m = SA.meshSlices(one, 15, 1);
check("a lone voxel has 6 faces", m.voxels === 1 && m.faces === 6 && m.indices.length === 36);
check("slice 0 is the front (largest z)", Math.max(...m.positions.filter((_, i) => i % 3 === 2)) === 15);
// two voxels side by side in the same slice share a hidden face
const two = new Uint8Array(30 * 4); two.set([9, 9, 9, 255], 0); two.set([9, 9, 9, 255], 4);
m = SA.meshSlices(two, 30, 1);
check("touching voxels hide their shared faces", m.voxels === 2 && m.faces === 10);
// the same pixel in slices 0 and 1 is a 1x1x2 column
const col = new Uint8Array(15 * 4); col.set([9, 9, 9, 255], 0); col.set([9, 9, 9, 255], 4);
check("stacked slices join in depth", SA.meshSlices(col, 15, 1).faces === 10);
const faint = new Uint8Array(15 * 4); faint.set([9, 9, 9, 100], 0);
check("alpha below 128 is empty", SA.meshSlices(faint, 15, 1).voxels === 0);
m = SA.meshSlices(one, 15, 1, 15, new Map([[0xff0000, 0x0000ff]]));
check("recolor maps key colours", m.colors[0] === 0 && m.colors[2] === 1);
const r1 = SA.rng(7), r2 = SA.rng(7);
check("rng is deterministic", r1() === r2() && r1() === r2());
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node game-spartan-arena/test.mjs`
Expected: it exits non-zero with `SA is not defined` or FAIL lines.

- [ ] **Step 3: Implement `SA.meshSlices` and `SA.rng` in the shared-code block**

- [ ] **Step 4: Run the tests and see them pass**

Run: `node game-spartan-arena/test.mjs`
Expected: every line starts with `ok`, and the exit code is 0.

- [ ] **Step 5: Commit**

```bash
git add game-spartan-arena && git commit -m "spartan-arena: test harness and slice mesher"
```

### Task 2: Rig table and the art generator

**Files:**
- Modify: `game-spartan-arena/index.html` (shared-code block: `SA.MODELS`, `SA.checkSheet`)
- Create: `game-spartan-arena/tools/make_art.mjs`
- Create: `game-spartan-arena/voxels/**.png` and `game-spartan-arena/backdrop.png` (generated)
- Modify: `game-spartan-arena/test.mjs` (PNG header checks)

**Interfaces:**
- Produces: `SA.MODELS[model] = { parts: { [partName]: Part }, root: partName }`, where
  ```
  Part = {
    sheet: "torso",           // file voxels/<model>/<sheet>.png
    w, h,                     // slice width and height in voxels
    pivot: [x, y, z],         // in the part's voxel coordinates (see Task 1)
    parent: partName | null,
    at: [x, y, z],            // where the pivot sits, in the parent's voxel coordinates
    rest: [rx, ry, rz],       // optional rest rotation in degrees (the shield uses ry = 90 so its slices show the face)
    level: 2,                 // optional: shown only from this level on (helmet, sword, shield)
  }
  ```
  Several parts may use the same `sheet` (left and right limbs). A model may stack two sheets at different `at` z offsets to be thicker than 15 (the elephant's body).
- Produces: `SA.sheetPaths() -> [{ model, sheet, path, w, h }]`, one entry per distinct sheet. `path` is relative to the game folder.
- Produces: `SA.checkSheet(entry, pngW, pngH) -> null | string`. The message names the file and the expected `(15·w)×h` size.
- Produces: `SA.TEAM_KEYS = [0xa02424, 0xd03a30, 0xf06a50]` (the red team's cloak, crest and tunic shades, as drawn in the PNGs) and `SA.teamRecolor(team) -> Map | null`. Team 0 returns `null`; team 1 maps the keys to `[0x24409a, 0x3060d0, 0x5a8af0]`.

**Gladiator rig (starting values; tune by eye later).** The model faces +x and its depth is centred on z = 7:

| part | sheet | w×h | pivot | parent @ at |
|---|---|---|---|---|
| hips | hips | 12×7 | [6,3,7] | root |
| torso | torso | 14×16 | [7,0,7] | hips @ [6,6,7] |
| head | head | 10×10 | [5,0,7] | torso @ [8,16,7] |
| helmet (level 2) | helmet | 12×15 | [6,1,7] | head @ [5,0,7] |
| armNearUpper / armFarUpper | upperArm | 5×11 | [2,10,7] | torso @ [7,14,13] / [7,14,1] |
| armNearLower / armFarLower | forearm | 5×11 | [2,10,7] | the upper arm @ [2,0,7] |
| legNearUpper / legFarUpper | thigh | 6×11 | [3,10,7] | hips @ [6,0,10] / [6,0,4] |
| legNearLower / legFarLower | shin | 9×12 | [3,11,7] | the thigh @ [3,0,7] |
| sword (level 2) | sword | 5×26 | [2,3,7] | armFarLower @ [2,1,7] |
| shield (level 2) | shield | 24×24 | [12,12,7] | armNearLower @ [2,5,7], rest [0,90,0] |

The near arm (towards the camera) is the shield arm and the far arm is the sword arm.

Other models use the same format. Exact sizes are the implementer's call:
- **caesar:** a seated body, head with laurel, `thumbArm` and a `thumb` part that rotates up or down
- **spectator:** body, head, `armL`, `armR`; tinted per instance
- **lion:** body, head with mane, 4 legs (front and back sheets), tail
- **elephant:** `bodyFront` and `bodyBack` stacked, head, trunk (two segments), 4 legs, ear, tail
- **gladius:** a single part for the sword Caesar throws in Level 1; it can share the gladiator's sword sheet

`backdrop.png` is 640×200: far crowd, arches, a temple and the sky.

- [ ] **Step 1: Write the failing tests**

In `SATests`:
```js
const e = SA.sheetPaths().find(p => p.model === "gladiator" && p.sheet === "torso");
check("sheet entry has its path", e && e.path === "voxels/gladiator/torso.png" && e.w === 14 && e.h === 16);
check("checkSheet accepts the right size", SA.checkSheet(e, 210, 16) === null);
check("checkSheet reports wrong size", /torso\.png.*210.*16/.test(SA.checkSheet(e, 200, 16) || ""));
check("every part's parent exists", Object.values(SA.MODELS).every(M => Object.values(M.parts).every(p => p.parent === null || p.parent in M.parts)));
check("blue team recolors all three keys", SA.teamRecolor(1).size === 3 && SA.teamRecolor(0) === null);
```
In `test.mjs`, after `SATests`: for every `SA.sheetPaths()` entry, read the file, check the PNG signature, take width and height from the IHDR chunk (bytes 16–23), and print `FAIL` when `SA.checkSheet` returns a message. Do the same for `backdrop.png` at 640×200.

- [ ] **Step 2: Run the tests and see them fail**

Run: `node game-spartan-arena/test.mjs`
Expected: FAIL lines for the missing `SA.MODELS` and the missing PNGs.

- [ ] **Step 3: Add `SA.MODELS`, `SA.sheetPaths`, `SA.checkSheet`, `SA.TEAM_KEYS` and `SA.teamRecolor` to the shared-code block**

- [ ] **Step 4: Write `tools/make_art.mjs`**

- It loads `SA` from `index.html`'s shared-code block in the same way as `test.mjs`.
- `writePng(path, w, h, rgba)` writes an 8-bit RGBA PNG: IHDR, one IDAT compressed with `zlib.deflateSync` (filter byte 0 per row), IEND, and CRC32 per chunk.
- For each sheet there is a drawing function `(x, y, z) -> 0xRRGGBB | null` in the part's voxel coordinates. Fill the slices from it.
- **Gladiator look:**
  - skin and tunic, with the tunic drawn in `TEAM_KEYS` shades
  - leather pteruges on the hips
  - a bronze Corinthian helmet with a crest in `TEAM_KEYS`
  - a bronze round shield whose front slice carries a Λ
  - a steel gladius with a brown grip
- Use 2–4 shades per material for a pixel-art feel, with a darker outline on silhouette edges.
- It skips any file that already exists, prints `kept <path>`, and overwrites only with `--force`.

- [ ] **Step 5: Generate the art and run the tests**

Run: `node game-spartan-arena/tools/make_art.mjs && node game-spartan-arena/test.mjs`
Expected: it prints `wrote …` lines, and then every test is `ok`. Running `make_art.mjs` a second time prints only `kept …` lines.

- [ ] **Step 6: Commit**

```bash
git add game-spartan-arena && git commit -m "spartan-arena: rig table and generated voxel art"
```

### Task 3: Renderer: low-res pixel pipeline, voxel rigs and a model viewer

**Files:**
- Modify: `game-spartan-arena/index.html` (module script, CSS, importmap)

**Interfaces:**
- Consumes: `SA.meshSlices`, `SA.MODELS`, `SA.sheetPaths`, `SA.checkSheet`, `SA.teamRecolor`.
- Produces (in the module):
  - `loadSheets() -> Promise<Map<"model/sheet", {w, h, rgba}>>`. It uses `fetch` → `createImageBitmap` → `OffscreenCanvas.getContext('2d').getImageData`. On any failure it shows `#error` with the list of messages. On `location.protocol === 'file:'` it shows the "run via `python3 -m http.server`" text without trying to load.
  - `buildRig(model, team) -> Rig`, where `Rig = { root: THREE.Group, joints: { [part]: THREE.Group }, meshes: { [part]: THREE.Mesh } }`. Each joint group sits at its `at` offset (relative to the parent's pivot), and each mesh is offset by `-pivot`. One `MeshLambertMaterial({ vertexColors: true })` is shared. Meshes cast and receive shadows. Geometries are cached per sheet and team.
  - `applyPose(rig, pose)`, where `pose = { [part]: [rx, ry, rz] }` in degrees is added on top of `rest`.
  - `renderer`, `scene`, `camera`, `pixelScale` and `resize()`. The scene renders into a `WebGLRenderTarget` of size `ceil(deviceW / k) × ceil(deviceH / k)`, with `k = max(1, round(deviceH / 216))`, `NearestFilter` and `SRGBColorSpace` output. A fullscreen quad then draws it to the canvas, whose backing store is `innerWidth·dpr × innerHeight·dpr`.
- Lighting: a `DirectionalLight` (warm, about `0xffe2b0`) from the upper front-left with `castShadow` and a 2048 shadow map whose frustum covers the arena, plus a `HemisphereLight` (sky `0x9fc4ff`, ground `0xc8a060`).
- Fighters stand yawed **25° towards the camera** from pure profile so the voxel depth and the shield face read. When facing left, the yaw is 180° − 25°.

- [ ] **Step 1: Build the pipeline and `?view=<model>`**

`?view=gladiator&team=1&level=2` shows that model on a sand plane, turning slowly. Number keys 1–9 pick a pose from a small test list so you can check the pivots.

- [ ] **Step 2: Verify in the browser**

Start the gitignored `.claude/launch.json` "static" server (port 8765) with `preview_start`, then open `http://127.0.0.1:8765/game-spartan-arena/?view=gladiator&level=2`.

Expected:
- crisp square pixels at a whole-number scale
- the shield face shows the Λ
- self-shadows: an arm shadow falls on the torso
- no gaps at the joints in the rest pose
- the blue team (`&team=1`) is blue where the red one is red

Also check `?view=lion`, `?view=elephant` and `?view=caesar`. Rename `voxels/gladiator/head.png` temporarily and check that the error overlay names it, then rename it back.

- [ ] **Step 3: Commit**

```bash
git add game-spartan-arena && git commit -m "spartan-arena: pixel renderer, voxel rigs and model viewer"
```

### Task 4: The arena, Caesar and the crowd

**Files:**
- Modify: `game-spartan-arena/index.html` (module script)

**Interfaces:**
- Consumes: `buildRig`, `applyPose`, `scene`.
- Produces: `arena = { update(dt, mood), setThumb('up' | 'down' | 'none'), stain(x, z, size), clearStains(), gateOpen(t01), cameraFor(xs: number[]) }`. `mood` is one of `'calm' | 'cheer' | 'roar' | 'boo'`.

**Layout:** sim x runs from −200 to +200 voxels, and fighters walk at z = 0.
- **Sand floor:** a voxel-styled box from x −260 to 260 and z −40 to 30, with per-voxel colour noise from a seeded RNG. Stains are dark red decals that fade over the next round.
- **Back wall:** at z = −40, about 30 voxels high, built from stone-coloured cube blocks. It has the beast gate (a portcullis that slides up) at x = 0.
- **Caesar's box:** above the wall at x = 0, with a purple awning, Caesar seated, and two guards (gladiator rigs in neutral grey).
- **Crowd:** 3 rows of instanced spectator rigs behind the wall, about 120 people, with per-instance tint and phase. They sway when calm, stand with their arms up for `cheer` and `roar`, and shake their fists for `boo`.
- **Backdrop:** `backdrop.png` on an unlit plane far behind, with nearest filtering.
- **Camera:** `cameraFor(xs)` keeps all fighters (and the animal) inside the middle 70% of the frame. It eases towards a target x and zoom. The camera sits a little above chest height and looks slightly down. It never shows beyond the arena's ends.

- [ ] **Step 1: Build the arena and add `?view=arena`**

In this view, keys C, R, B and T cycle the moods and the thumb.

- [ ] **Step 2: Verify in the browser at `?view=arena`**

Expected:
- the backdrop fills the top of the frame with no seam against the crowd rows
- Caesar is clearly visible and his thumb turns
- the crowd animates
- the gate slides open
- shadows from the wall and the crowd fall on the sand

- [ ] **Step 3: Commit**

```bash
git add game-spartan-arena && git commit -m "spartan-arena: arena, Caesar's box and crowd"
```

### Task 5: Input queue and fighter movement

**Files:**
- Modify: `game-spartan-arena/index.html` (shared-code)

**Interfaces:**
- Produces:
  - `new SA.InputQueue()` with methods:
    - `down(action)`: ignored if the action is already held, which also heals repeated keydowns
    - `up(action)`
    - `releaseAll()`
    - `take() -> TickInput`
  - `TickInput = { held: Acts, pressed: Acts, released: Acts }`, where `Acts = { left, right, up, down, punch, kick, special }` are booleans. `take()` delivers at most one queued press per action per tick. Extra presses wait in a FIFO capped at 8 entries.
  - `SA.ticksFor(elapsedMs, carryMs) -> { ticks, carryMs }`: 60 Hz, at most 5 ticks per call; when clamped, the excess carry is dropped.
  - `SA.createMatch({ seed, level = 1, round = 1, phase = 'fight' }) -> Match`
  - `SA.step(match, [TickInput, TickInput])`: one tick. It clears and then refills `match.events`.
- `Fighter = { id, team, x, y, vx, vy, facing: 1 | -1, health: 100, state, st, move, arms: { sword: { wound, on }, shield: { wound, on } }, hasSword, charge, thunder, rewards: [], stamina: 100 }`. `state` is one of `'idle' | 'walk' | 'jump' | 'crouch' | 'block' | 'attack' | 'hit' | 'down' | 'dazed' | 'salute' | 'victory' | 'ko'`, and `st` is the number of ticks spent in the current state.
- Body: 14 wide, 54 tall standing and 34 crouching. Walk speed 1.6 voxels per tick, jump vy = 5.2, gravity 0.3 per tick² (apex ≈ 45). Fighters start at x = ±60 facing each other.
- **Facing:** while grounded, a fighter faces the opponent. Facing flips the tick the fighter lands, or when the opponent passes behind. The renderer animates the turn.
- **Push:** grounded bodies can't overlap; overlapping bodies are pushed apart equally, and a body against the wall pushes the other one. Arena bounds are ±200 minus half the body width.

- [ ] **Step 1: Write the failing tests**

```js
const q = new SA.InputQueue(); q.down("punch"); q.up("punch");
check("taps shorter than a tick still fire", q.take().pressed.punch === true && q.take().pressed.punch === false);
q.down("left"); q.down("left");
check("repeat keydowns are one press", q.take().pressed.left && !q.take().pressed.left);
q.releaseAll(); check("releaseAll clears held keys", !q.take().held.left);
check("ticksFor clamps a long gap to 5 ticks", SA.ticksFor(5000, 0).ticks === 5);
check("ticksFor keeps the remainder", Math.abs(SA.ticksFor(20, 0).carryMs - (20 - 1000 / 60)) < 1e-9);
// movement helpers: I(acts) builds a TickInput with held = acts and pressed = acts on the first tick
let m = SA.createMatch({ seed: 1 }); runTicks(m, 30, [I({ right: 1 }), I({})]);
check("walking moves right", m.fighters[0].x > -60 + 30);
m = SA.createMatch({ seed: 1 }); runTicks(m, 400, [I({ right: 1 }), I({ right: 1 })]);
check("fighters never overlap or leave the arena at the wall", Math.abs(m.fighters[0].x - m.fighters[1].x) >= 14 - 1e-6 && m.fighters.every(f => Math.abs(f.x) <= 193));
m = SA.createMatch({ seed: 1 }); m.fighters[1].x = -45; runTicks(m, 60, [I({ up: 1, right: 1 }), I({})]);
check("jumping over the opponent turns both round", m.fighters[0].x > m.fighters[1].x && m.fighters[0].facing === -1 && m.fighters[1].facing === 1);
m = SA.createMatch({ seed: 1 }); runTicks(m, 1, [I({ up: 1 }), I({ up: 1 })]);
check("both players' presses in the same tick both act", m.fighters.every(f => f.vy > 0));
```

- [ ] **Step 2: Run the tests and see them fail** (`node game-spartan-arena/test.mjs` → FAIL)
- [ ] **Step 3: Implement the input queue, `ticksFor`, `createMatch` and the movement part of `step`**
- [ ] **Step 4: Run the tests and see them pass**
- [ ] **Step 5: Commit** (`spartan-arena: input queue and fighter movement`)

### Task 6: Combat: moves, hits, blocks, KO and the round clock

**Files:**
- Modify: `game-spartan-arena/index.html` (shared-code)

**Interfaces:**
- Produces: `SA.MOVES[name] = { startup, active, recovery, damage, reach, y0, y1, height: 'high' | 'mid' | 'low', knock, sword: bool }`. The hitbox is `x .. x + facing·reach`, with height `y0..y1` measured from the fighter's feet. Starting values (tune in play):

| move | input | start/active/recover | dmg | notes |
|---|---|---|---|---|
| punch | punch (Level 1, or after losing the sword) | 4/3/8 | 5 | mid |
| kick | kick | 7/4/12 | 7 | mid, longer reach |
| sweep | down + kick | 8/4/16 | 6 | low; knocks down |
| jumpKick | kick in the air | 3/8/until landing | 8 | high |
| slash | punch with a sword | 6/4/12 | 10 | mid, sword |
| jumpSlash | punch in the air with a sword | 4/6/until landing | 11 | high, sword |
| charged | hold punch ≥ 60 ticks after a slash, then release | 10/5/22 | 22 | high, sword, big knockback |

- **Hurt zones** (from the feet; crouching scales them to 34/54): legs 0–18 (low), body 18–40 (mid), head 40–54 (high). A low attack can't hit a jumping fighter, and a high attack misses a crouching fighter.
- **Block:** holding away from the opponent while idle, walking or crouching. A plain block takes 50% damage. A shield block (shield arm still attached, Level ≥ 2, `stamina > 0`) takes 10%, costs 12 stamina per block, and stamina regenerates 0.25 per tick. A crouching block covers low and mid; a standing block covers mid and high.
- **Hitstun:** 14 ticks, knockback `knock` in vx. A knockdown sets `down` for 40 ticks with invulnerability.
- **Round clock:** 99 s = 5940 ticks.
  - KO at health ≤ 0 starts phase `'verdict'` with the winner set.
  - At time-out, more health wins; equal health is a draw and the round is replayed (event `'draw'`).
  - Both fighters KO'd on the same tick is a draw.
- **Events:**
  - `{ type: 'hit', who, by, dmg, zone, x, y }`
  - `{ type: 'block', who, shield }`
  - `{ type: 'ko', who }`
  - `{ type: 'timeout' }`
  - `{ type: 'draw' }`
  - `{ type: 'whiff', who }`
  - `{ type: 'boo' }`, emitted when neither fighter has attacked for 6 s

- [ ] **Step 1: Write the failing tests**

```js
// helpers: face(m, dist) places the fighters dist apart facing each other; press(name) is a TickInput pressing one action
let m = SA.createMatch({ seed: 1 }); face(m, 20); runTicks(m, 20, k => [k === 0 ? press("punch") : I({}), I({})]);
check("a punch in reach hits for 5", m.fighters[1].health === 95);
m = SA.createMatch({ seed: 1 }); face(m, 20); runTicks(m, 20, k => [k === 0 ? press("punch") : I({}), I({ right: 1 })]);
check("blocking halves fist damage", m.fighters[1].health === 97.5);
m = SA.createMatch({ seed: 1, level: 2 }); face(m, 24); runTicks(m, 25, k => [k === 0 ? press("punch") : I({}), I({ right: 1 })]);
check("a shield block takes 10% of a slash", m.fighters[1].health === 99 && m.fighters[1].stamina === 88);
m = SA.createMatch({ seed: 1 }); face(m, 20); runTicks(m, 30, k => [k === 0 ? press("kick", { down: 1 }) : I({ down: 1 }), I({ up: 1 })]);
check("a sweep misses a jumping fighter", m.fighters[1].health === 100);
m = SA.createMatch({ seed: 1 }); m.fighters[1].health = 3; face(m, 20); runTicks(m, 20, k => [k === 0 ? press("punch") : I({}), I({})]);
check("KO starts Caesar's verdict", m.phase === "verdict" && m.winner === 0);
m = SA.createMatch({ seed: 1 }); m.timer = 1; m.fighters[0].health = 50; runTicks(m, 2, [I({}), I({})]);
check("time-out goes to more health", m.phase === "verdict" && m.winner === 1);
m = SA.createMatch({ seed: 1 }); m.timer = 1; runTicks(m, 2, [I({}), I({})]);
check("equal health at time-out replays the round", m.events.some(e => e.type === "draw") && m.round === 1 && m.phase === "fight");
```

- [ ] **Step 2: Run the tests and see them fail**
- [ ] **Step 3: Implement `SA.MOVES` and the combat in `step`**
- [ ] **Step 4: Run the tests and see them pass**
- [ ] **Step 5: Commit** (`spartan-arena: moves, blocks, KO and round clock`)

### Task 7: Arms, chopping and Caesar's verdict

**Files:**
- Modify: `game-spartan-arena/index.html` (shared-code)

**Rules (spec "Arm chopping"):**
- **Wounds:**
  - Sword hits at `mid` height add +25 to the **shield arm** wound.
  - Sword hits at `high` height add +25 to the **sword arm** wound.
  - A shield block adds +10 to the shield arm.
  - Fists, kicks and animals add nothing.
- **A charged strike that lands** targets the shield arm if the defender is blocking, and the sword arm otherwise. If that arm's wound is at least 60, the arm comes off: `on = false`, with event `{ type: 'chop', who, arm, x, y, mid: true }`.
- **Losing the shield arm:** shield blocks become plain blocks.
- **Losing the sword arm:** no sword moves. `punch` falls back to the fist punch, and sword reward cards do nothing.
- **Verdict phase** (360 ticks):
  - The loser is `dazed` and kneeling, with no input.
  - The winner moves freely; pressing punch within reach 24 of the loser chops the loser's sword arm, or the shield arm if the sword arm is already gone, and emits `{ type: 'chop', verdict: true }`.
  - At phase start it emits `{ type: 'thumbsDown' }`.
  - In **Level 1**, it also adds `match.props.push({ kind: 'gladius', x, y: 120, vy: 0 })`, which falls and lands 40 voxels from the winner towards the loser. The winner picks it up by walking over it (`hasSword = true`, only for the verdict).
  - Then comes phase `'roundEnd'` (120 ticks). It is followed by the next round, or by `'draft'` or `'champion'` (Task 8).
  - At the start of each round, health, arms, wounds, stamina, `hasSword` (true from Level 2 on), positions, props and stains are reset.

- [ ] **Step 1: Write the failing tests**

```js
let m = SA.createMatch({ seed: 1, level: 2 }); m.fighters[1].arms.sword.wound = 60; face(m, 24);
chargeAndRelease(m, 0);  // helper: slash, hold punch 60 ticks, release, run 30 ticks
check("a charged strike on a wounded arm chops it mid-fight", !m.fighters[1].arms.sword.on && m.log.some(e => e.type === "chop" && e.mid));
m = SA.createMatch({ seed: 1, level: 2 }); m.fighters[1].arms.sword.wound = 35; face(m, 24); chargeAndRelease(m, 0);
check("a charged strike on a fresh arm only wounds it", m.fighters[1].arms.sword.on && m.fighters[1].arms.sword.wound === 60);
m = SA.createMatch({ seed: 1, level: 2 }); m.fighters[0].arms.sword.on = false; face(m, 24); runTicks(m, 20, k => [k === 0 ? press("punch") : I({}), I({})]);
check("no sword arm means fist punches", m.fighters[1].health === 95);
m = SA.createMatch({ seed: 1, level: 2 }); m.fighters[1].arms.shield.on = false; face(m, 24); runTicks(m, 25, k => [k === 0 ? press("punch") : I({}), I({ right: 1 })]);
check("no shield arm means a plain block", m.fighters[1].health === 95);
m = SA.createMatch({ seed: 1, level: 2 }); m.fighters[1].health = 0; runTicks(m, 1, [I({}), I({})]); face(m, 20);
runTicks(m, 5, k => [k === 0 ? press("punch") : I({}), I({})]);
check("the verdict takes the sword arm", !m.fighters[1].arms.sword.on && m.log.some(e => e.type === "chop" && e.verdict));
m = SA.createMatch({ seed: 1, level: 1 }); m.fighters[1].health = 0; runTicks(m, 1, [I({}), I({})]);
check("in Level 1 Caesar throws a gladius", m.props.some(p => p.kind === "gladius"));
```
`match.log` is an append-only array of every event since `createMatch`, kept for tests and debugging. Cap it at 2000 entries.

- [ ] **Step 2: Run the tests and see them fail**
- [ ] **Step 3: Implement the wounds, the chop, arm loss and the verdict phase**
- [ ] **Step 4: Run the tests and see them pass**
- [ ] **Step 5: Commit** (`spartan-arena: arm wounds, chops and Caesar's verdict`)

### Task 8: Match flow and the reward draft

**Files:**
- Modify: `game-spartan-arena/index.html` (shared-code)

**Interfaces:**
- Phases: `'title' → 'salute' → 'fight' → 'verdict' → 'roundEnd' → ('fight' | 'draft' | 'champion')`. The draft leads to `'salute'` for the next level.
  - `salute`: 150 ticks, skippable when either player presses punch or kick; event `{ type: 'salute' }`.
  - `title`: any punch or kick starts the match.
- `match.roundWins = [[0, 0], [0, 0], [0, 0]]`, indexed by level then player. A level is won at 2 round wins.
- `match.levelWins = [0, 0]`. All three levels are always played. After Level 3, `match.champion` is the player with more level wins, and the phase becomes `'champion'`. Punch in `'champion'` starts a new match at `'salute'`.
- `SA.CARDS = ['swordThrow', 'leap', 'furyFists', 'whirlwind', 'thunder', 'shieldBash']`.
- **Draft:**
  - `match.draft = { cards: [3 names], order: [winner, loser], turn: 0, cursor: [1, 1], taken: [] }`.
  - The 3 cards are drawn with `match.rng` from `CARDS`, excluding cards either player already owns.
  - Left and right move the current picker's cursor over the cards that are not taken; punch confirms. The pick is pushed onto `fighter.rewards`, with event `{ type: 'pick', who, card }`.
  - After both picks, the next level starts.

- [ ] **Step 1: Write the failing tests**

```js
let m = SA.createMatch({ seed: 3 }); winRound(m, 0); winRound(m, 0);   // helper: set the loser's health to 0 and skip the verdict and roundEnd
check("two round wins take the level", m.levelWins[0] === 1 && m.phase === "draft");
check("the level winner picks first", m.draft.order[0] === 0 && m.draft.cards.length === 3 && new Set(m.draft.cards).size === 3);
const first = m.draft.cards[m.draft.cursor[0]]; pick(m, 0);
check("the loser picks from the two left", m.draft.turn === 1 && !availableFor(m).includes(first) && availableFor(m).length === 2);
pick(m, 1);
check("after both picks the next level salutes", m.level === 2 && m.phase === "salute" && m.fighters.every(f => f.rewards.length === 1));
winRound(m, 1); winRound(m, 0); winRound(m, 1);
check("a level can go to three rounds", m.levelWins[1] === 1 && m.phase === "draft");
check("owned cards are not offered again", m.draft.cards.every(c => !m.fighters[0].rewards.includes(c) && !m.fighters[1].rewards.includes(c)));
pick(m, 1); pick(m, 0); winRound(m, 0); winRound(m, 0);
check("Level 3 is always played and decides the champion", m.phase === "champion" && m.champion === 0);
```
(`availableFor` and `pick` are small test helpers: `pick` presses punch for the current picker.)

- [ ] **Step 2: Run the tests and see them fail**
- [ ] **Step 3: Implement the phases, levels and draft**
- [ ] **Step 4: Run the tests and see them pass**
- [ ] **Step 5: Commit** (`spartan-arena: match flow and reward draft`)

### Task 9: Reward moves

**Files:**
- Modify: `game-spartan-arena/index.html` (shared-code)

**Binding:** Special uses `rewards[0]`, and down + Special uses `rewards[1]`. Sword cards do nothing (event `whiff`) without the sword arm or without `hasSword`.

| card | behaviour (starting numbers) |
|---|---|
| swordThrow | Adds the prop `{ kind: 'thrownSword', owner, x, y: 36, vx: 7·facing }`. It deals 14 damage on hitting the opponent or the animal, then drops to the sand. `hasSword = false` until the owner walks over it; meanwhile `punch` is the fist punch |
| leap | On the ground: a jump with vy = 7.4 (apex ≈ 91, 2× normal). In the air: a stomp falling at vy = −10 that deals 16 on landing on the opponent |
| furyFists | 5 hits, 4 ticks apart, 4 damage each, mid; the shield fist and the sword pommel in Levels 2–3. Needs at least one arm |
| whirlwind | A 360° spin over 24 ticks; hits on both sides within reach 22 for 12 damage with knockback 6. Event `{ type: 'spin', who }` so the renderer spins the rig |
| thunder | Usable when `thunder ≥ 100`. Each landed sword hit adds 20 (shown on the HUD). Discharge: a 30-voxel beam in front, 25 damage, blocks take 50%, then `thunder = 0`. Event `{ type: 'thunder', who }` |
| shieldBash | A dash of 3 voxels per tick for 15 ticks; stuns for 30 ticks and does 6 damage on contact. Needs the shield arm |

- [ ] **Step 1: Write the failing tests**

One test per card. Each gives a fighter the card in `rewards[0]`, places the fighters with `face(m, d)`, presses special, and asserts:
- "sword throw hits at range and leaves the thrower unarmed": the defender is at 100 − 14 and the thrower has `hasSword === false`. Walking over the sword gives it back.
- "leap jumps about twice as high": the peak y is more than 1.8× the normal jump's peak.
- "fury fists land five hits": 5 `hit` events, health 80.
- "whirlwind hits behind too": an opponent placed behind takes 12.
- "thunder needs a full charge": nothing happens at `thunder = 80`; at 100 it does 25 damage and `thunder === 0`.
- "shield bash needs the shield arm": with `arms.shield.on = false` it emits a `whiff` and does no damage.
- "down + special uses the second card".

- [ ] **Step 2: Run the tests and see them fail**
- [ ] **Step 3: Implement the six cards**
- [ ] **Step 4: Run the tests and see them pass**
- [ ] **Step 5: Commit** (`spartan-arena: reward moves`)

### Task 10: The beasts (Level 3)

**Files:**
- Modify: `game-spartan-arena/index.html` (shared-code)

**Interfaces:**
- `match.animal = null | { kind: 'lion' | 'elephant', x, y, vx, vy, facing, health, maxHealth, state, st, target }`.
  - `state` is one of `'enter' | 'stalk' | 'attack' | 'recover' | 'hurt' | 'dead'`.
  - The lion comes out in rounds 1 and 3, the elephant in round 2.
  - At fight tick 180 it emits `{ type: 'gate' }`. The animal is in `enter` at x = 0 for 60 ticks: it can't be hit and does no harm while the renderer walks it out of the gate.
- **Targeting:** the nearest gladiator that isn't KO'd. It switches only when the other gladiator is closer by more than 30 voxels.
- **Lion:** health 60, body 34 × 20. It stalks at 2.2 per tick, then pounces when within 70 (a leap with vx 5, vy 5) for 12 damage, or swipes with a claw within 22 for 8 damage. It recovers for 40 ticks after each attack.
- **Elephant:** health 140, body 50 × 56, which the normal jump apex of about 44 can't clear but `leap` can. It stalks at 1.0 per tick, then charges at 4.5 when within 120, trampling for 18 damage with a knockdown. Within 30 it swipes its trunk: 10 damage and a toss (vy 6, vx 5 away). It recovers for 70 ticks.
- **Gladiators hit the animal:** any active hitbox overlapping the animal's body deals the move's damage, and hitting both the opponent and the animal with one move counts for both. The animal can't block. Animals never wound arms.
- **Death:** when an animal dies, the killer gets `health = min(100, health + 20)` and the event is `{ type: 'animalKill', by }`. Pushing works between the animal and the gladiators like the body collision between gladiators.
- **Round result:** when one gladiator's health reaches 0 (by any cause), the other wins the round. If both gladiators fall on the same tick, it's a draw and the round is replayed.

- [ ] **Step 1: Write the failing tests**

```js
let m = SA.createMatch({ seed: 1, level: 3, round: 1 }); runTicks(m, 181, [I({}), I({})]);
check("the lion comes out in round 1", m.animal && m.animal.kind === "lion" && m.log.some(e => e.type === "gate"));
m = SA.createMatch({ seed: 1, level: 3, round: 2 }); runTicks(m, 181, [I({}), I({})]);
check("the elephant comes out in round 2", m.animal.kind === "elephant");
m = SA.createMatch({ seed: 1, level: 3 }); spawnAnimal(m, "lion", 0); m.fighters[0].x = -20; m.fighters[1].x = 50; SA.step(m, [I({}), I({})]);
check("the beast goes for the nearest", m.animal.target === 0);
m.fighters[0].x = -40; m.fighters[1].x = 30; SA.step(m, [I({}), I({})]);
check("targeting has hysteresis", m.animal.target === 0);
m = SA.createMatch({ seed: 1, level: 3 }); spawnAnimal(m, "lion", 18); m.animal.health = 4; m.fighters[0].health = 50; m.fighters[0].x = 0; m.fighters[0].facing = 1;
runTicks(m, 20, k => [k === 0 ? press("punch") : I({}), I({})]);
check("killing the beast refills 20 health", m.animal.state === "dead" && m.fighters[0].health === 70);
m = SA.createMatch({ seed: 1, level: 3 }); spawnAnimal(m, "elephant", 30); m.fighters[0].x = 0;
runTicks(m, 40, [I({ up: 1, right: 1 }), I({})]);
check("a normal jump can't clear the elephant", m.fighters[0].x < 30);
m = SA.createMatch({ seed: 1, level: 3 }); m.fighters[1].health = 1; spawnAnimal(m, "lion", m.fighters[1].x + 10); forceAnimalAttack(m, 1); runTicks(m, 60, [I({}), I({})]);
check("a gladiator killed by the beast loses the round", m.winner === 0);
```

- [ ] **Step 2: Run the tests and see them fail**
- [ ] **Step 3: Implement the animal AI, the shared hit resolution, the kill bonus and the round results**
- [ ] **Step 4: Run the tests and see them pass**
- [ ] **Step 5: Commit** (`spartan-arena: lion and elephant`)

### Task 11: Bringing it to life: animation, effects, HUD and screens

**Files:**
- Modify: `game-spartan-arena/index.html` (module script)

**Interfaces:**
- Consumes: the `Match` from Tasks 5–10, `buildRig`, `applyPose`, `arena`.
- **Main loop:** `requestAnimationFrame` → `SA.ticksFor` → `SA.step` for each tick with `queues[i].take()` → handle `match.events` → pose rigs → render.
  - `window.blur` calls `releaseAll()` on both queues.
  - Key mapping is listed in Global Constraints, using `KeyboardEvent.code`. `preventDefault` stops the arrows, `/` and Space from scrolling or opening find-in-page.
- **Poses:** `ANIMS[stateOrMove] = [{ t: ticks, pose }]`, interpolated with smoothstep between keys. There are poses for:
  - movement: idle (breathing), walk cycle, jump, crouch
  - defence: block (plain or shield-up)
  - each move in `SA.MOVES` and each reward card
  - reactions: hit, down, dazed (kneeling), salute (fist or sword raised to Caesar), victory, ko
  - the animals: lion stalk, pounce, swipe and dead; elephant walk, charge, trunk swipe and dead
  - Caesar: idle, lean forward on `chop` and `ko`, thumb down on `thumbsDown`, applause on `champion`
- **Turning:** the yaw eases to its target (25° or 155°) over 10 ticks through the camera-facing side. `spin` adds 360° over 24 ticks.
- **Effects from events:**
  - `chop`: detach the arm's joint groups (upper, lower, and the sword or shield on it) into a free prop with spin; it arcs with gravity, bounces with restitution 0.3, and lies on the sand until the round ends. Also spawn 40–60 red 1-voxel cubes that arc and settle, plus `arena.stain`.
  - `hit`: a few blood cubes for sword hits and dust for fists.
  - `thunder`: a white-blue beam of voxel cubes plus a light flash.
  - `gladius` and `thrownSword` props: drawn with the sword sheet.
- **Crowd and Caesar:**
  - `hit` with dmg ≥ 10, `chop`, `animalKill` and `ko` → `cheer` or `roar`
  - `boo` → `boo`
  - `thumbsDown` → `arena.setThumb('down')`
- **HUD:** drawn into a canvas at the render target's resolution, upscaled with `image-rendering: pixelated`. Text uses a built-in 5×7 pixel font (`FONT` glyph table in the module). It shows:
  - health bars with the players' names "RED" and "BLUE"
  - round pips
  - the level name: "LEVEL 1: THE BEGINNERS", "LEVEL 2: SWORD AND SHIELD", "LEVEL 3: THE BEASTS"
  - the 99 timer
  - reward slots with their keys under each bar
  - the thunder meter when owned
  - the animal's health bar under the timer in Level 3
- **Screens** (HUD canvas over the live arena):
  - **title:** the "SPARTAN ARENA" logo, the key help for both players, and "press punch or kick to fight"
  - **salute:** "AVE CAESAR"
  - **verdict:** "CAESAR'S VERDICT"
  - **draft:** 3 cards with an icon, name and one-line effect, each player's cursor in their colour, and whose pick it is
  - **champion:** "<RED|BLUE> IS CHAMPION OF THE ARENA" and "punch for a rematch"
- **Review params:**
  - `?level=&round=&phase=&seed=`
  - `?demo=1`: both players are driven by a seeded script that walks, attacks and blocks at random, for smoke tests and screenshots
  - `?pose=<anim>&t=<tick>`: freezes a pose in the arena
  - `window.__sa = { match, step(n), render() }`, so screenshots can be driven synchronously (rAF stalls in a hidden pane)

- [ ] **Step 1: Build the loop, input, poses and HUD; play a Level 1 round by hand in the browser**
- [ ] **Step 2: Add effects, crowd and Caesar reactions, screens and the review params**
- [ ] **Step 3: Verify in the browser** (static server on 8765)

Expected:
- `?demo=1` runs through all three levels without console errors, using `__sa.step` to fast-forward
- `?phase=draft` shows readable cards
- `?level=3` shows the gate opening and the lion
- `?level=2` plus `__sa` forcing a chop shows the arm flying and a stain
- HUD text never overlaps at 1280×720, 800×600 and 375×812 (`resize_window`); check `scrollWidth` against `documentElement.clientWidth`
- both fighters stay in frame at the far ends of the arena

Take screenshots as proof.

- [ ] **Step 4: Commit** (`spartan-arena: animation, effects, HUD and screens`)

### Task 12: Sound

**Files:**
- Modify: `game-spartan-arena/index.html` (module script)

**Interfaces:**
- `audio = { ctx, master, play(name, opts), setMood(mood), musicEl }`. It is created on the first keydown (autoplay policy). M toggles `master.gain` and `musicEl.muted`. The state is kept in `localStorage['spartan-arena-sound']` inside try/catch.
- **Synthesised sounds:**

| sound | how it's made |
|---|---|
| punch / kick thud | short noise burst through a lowpass, plus a sine drop |
| block | noise + bandpass |
| shield clang | 3 detuned square partials, fast decay |
| sword whoosh | filtered noise sweep |
| chop | a clang, then a wet low thud |
| crowd bed | pink noise through a bandpass; its gain follows the mood; `roar` and `cheer` swell, `boo` adds a low formant |
| lion roar | sawtooth at 90 Hz with vibrato through a formant filter |
| elephant trumpet | a sawtooth glide from 300 to 600 Hz with a bandpass |
| gate | a low rumble with ratchet clicks |
| thunder | a noise crack + a low boom |
| card pick | a short square blip |

- **Music slot:** `<audio id="music" src="music.mp3" loop preload="none">`. It plays only if the file exists: a HEAD fetch at start checks, and nothing happens on a 404. There is no music file in this commit.
- Expose `audio` on `window.__sa` for checking.

- [ ] **Step 1: Implement the sounds and wire them to events**
- [ ] **Step 2: Verify in the browser:** with an `AnalyserNode` on `master`, RMS > 0 after `__sa` forces a `hit` event, and 0 after pressing M.
- [ ] **Step 3: Commit** (`spartan-arena: synthesised sound and music slot`)

### Task 13: README, gallery and final check

**Files:**
- Create: `game-spartan-arena/README.md`
- Create: `game-spartan-arena/screenshot1.jpg`
- Modify: `index.html` (gallery, via `python3 build_gallery.py`) and the top-level `README.md` (one entry in the games list, in the style of `game-blast-yard`)

**README sections:**
- what the game is
- controls for both players
- the three levels
- reward cards
- arm chopping and Caesar's verdict
- **Run locally:** `python3 -m http.server 8000` from the repo root, then `http://localhost:8000/game-spartan-arena/`. Explain why `file://` doesn't work.
- **Editing the voxels:**
  - the sheet format and that slice 0 is the front
  - transparency means empty
  - team key colours, with hex values
  - pivots live in `SA.MODELS`; changing a part's size means changing its `w`/`h` there
  - `node tools/make_art.mjs` keeps edited files, and `--force` regenerates everything
- **Music:** drop `music.mp3` next to `index.html`.
- **Tuning numbers:** a table of the final damage values and timings.
- **Review URL params**
- **Note:** this experiment is an `index.html` plus PNGs, by design.

- [ ] **Step 1: Write the README and the top-level README entry; take `screenshot1.jpg`**

Take the screenshot as a mid-fight frame in Level 2 with the crowd and Caesar visible, from `?level=2&demo=1` driven by `__sa`. Run `python3 build_gallery.py`.

- [ ] **Step 2: Full check**

- `node game-spartan-arena/test.mjs` → all `ok`.
- In the Browser pane, play the title screen → Level 1 → draft → Level 2 → draft → Level 3 → champion with `?demo=1` fast-forwarding. Check:
  - no overlapping text or missing margins
  - the gallery card shows the screenshot
- In Firefox (headless screenshot of `?level=2&phase=fight&seed=1`), check the layout. Memory note: headless Firefox WebGL2 screenshots may be black. If so, note it and rely on Chromium.

- [ ] **Step 3: Commit** (`spartan-arena: README, gallery entry and screenshot`)
