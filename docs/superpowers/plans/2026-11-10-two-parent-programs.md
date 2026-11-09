# Two-Parent Programs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone page where creatures with byte genomes reproduce only with two parents, in two side-by-side worlds (naive splicing vs life's way), with a birth panel that shows `A + B → C`.

**Architecture:** One `two-parent-programs/index.html`. All simulation logic lives in a `<script id="shared-code">` block (no DOM) exposing `TP` and `TPTests`. `test.mjs` runs the tests in Node. A second script holds the UI (canvas rendering, birth panel, inspector, family tree, charts). Everything is deterministic from a seed.

**Tech Stack:** Plain JavaScript, Canvas 2D, no dependencies, no build step. Node 22 for tests.

**Spec:** `docs/superpowers/specs/2026-11-09-two-parent-programs-design.md`

## Global Constraints

- Reproduction only with two parents; no single-parent copy path anywhere in the code.
- No assembly or instruction set; the genome holds traits and rules, not instructions.
- Genome is bytes (`Uint8Array`), saveable as `.bin`; gene start marker `47 45` ("GE"), end marker `4E 44` ("ND").
- Gene type = `typeByte >> 4`; the low four bits are silent.
- World grid is exactly 64 × 64.
- Lock binds key when `|lock - key| <= 8`.
- Original look only: no Thronglets name, characters, art, sounds or music.
- Faithful simulation: no score, no play-as mode; the page reports measured results, never claims fixed in the copy.
- Works from `file://`; deterministic for a given seed; checked in Chromium and Firefox; added to gallery and README.
- Copy follows the lab's writing style: plain, active voice, no em-dash asides.

## Review Focus

1. A genome with no genes, or only junk (possible after naive splicing): parsing and expression must give a creature that simply cannot act, never an exception.
2. A cut that lands inside a marker (`47|45`) or between a gene and its end marker: the gene must read as broken (no effect), and parsing continues at the next marker.
3. Genes present in one parent only (after duplication or deletion), and several genes of the same type: alignment pairs them by type and occurrence index without dropping or crashing.
4. Population collapse to 0 or 1 creature, or pinned at the cap: the world keeps ticking, charts stay drawn, the UI shows "extinct" instead of NaN rates.
5. Clicking a creature that dies while it is pinned in the birth panel or inspector: the panel keeps showing the recorded data from the conception and pedigree records, not a missing object.

Each line is pinned by a test in the task that owns the code (Tasks 1, 2, 3 and 6).

---

### Task 1: Genome format, expression and founders

**Files:**
- Create: `two-parent-programs/index.html` (skeleton page with the `shared-code` block)
- Create: `two-parent-programs/test.mjs` (same pattern as `chladni-plate/test.mjs`: extract the `shared-code` block, call `TPTests.run()`, exit 0 when it returns true)

**Interfaces:**
- Produces, on `const TP` inside `shared-code`:
  - `TP.GRID = 64`, `TP.START = [0x47, 0x45]`, `TP.END = [0x4e, 0x44]`, `TP.TOLERANCE = 8`
  - `TP.T = { MIX: 0, BODY: 1, EYE: 2, NOSE: 3, FORAGE: 4, MATE: 5, FLEE: 6 }`
  - `TP.SETTINGS = { 0: 3, 1: 3, 2: 2, 3: 2, 4: 2, 5: 3, 6: 2 }` (setting bytes per type)
  - `TP.parse(bytes: Uint8Array) -> { genes: Gene[], codingBytes: number }` where `Gene = { type: number|null, typeByte, settings: number[], start, end, broken: boolean }`; `start` is the offset of `G`, `end` the offset after `D`. A gene is broken when its settings count does not match `TP.SETTINGS[type]`, its type is unused (7..15), or the end marker is missing before the next start marker or the end of the genome.
  - `TP.express(bytes) -> Phenotype` with `{ mix: {share, cuts, rate}, body: {size, speed, metab}, eyes: [{range, key}], noses: [{range, key}], rules: [{kind: 'forage'|'mate'|'flee', a, b?, lock, geneIndex}], brokenGenes }`. Only the first unbroken mix and body gene count; missing ones fall back to `TP.DEFAULT_MIX = {share: 128, cuts: 1, rate: 4}` and `TP.DEFAULT_BODY = {size: 64, speed: 64, metab: 128}`.
  - `TP.fits(ph) -> { ok, checks: [{rule, lock, key: number|null, ok}] }`: forage needs a nose, mate and flee need an eye; a rule binds the closest key within `TP.TOLERANCE`.
  - `TP.rng(seed) -> () => number` (mulberry32), `TP.hex(bytes) -> string` (16 bytes per row, offset, hex, ASCII).
  - `TP.FOUNDERS: [{name, color, bytes: Uint8Array}]`: three lineages, `Sniffer` (nose range high, wasteful metab), `Saver` (efficient metab, short nose), `Runner` (high speed). Sniffer and Saver locks/keys bind each other's; Runner's do not bind either. Each has junk bytes between genes and its own mix gene.
  - `TP.encodeGene(type, settings, lowBits = 0) -> number[]` used to build founders and tests.

- [ ] **Step 1: Write failing tests in `TPTests.run()`**

```js
// parse finds genes between markers and skips junk
const g = TP.parse(new Uint8Array([0x13, ...TP.encodeGene(1, [96,80,40]), 0xa1, ...TP.encodeGene(2, [12,0x3c])]));
eq(g.genes.length, 2); eq(g.genes[0].type, 1); eq(g.genes[1].settings.join(), '12,60');
// low bits are silent
eq(TP.express(new Uint8Array(TP.encodeGene(1, [9,9,9], 0x7))).body.size, 9);
// broken: missing end marker, wrong length, unused type
ok(TP.parse(new Uint8Array([0x47,0x45,0x10,1,2,3])).genes[0].broken);
ok(TP.parse(new Uint8Array(TP.encodeGene(1, [1,2]))).genes[0].broken);
ok(TP.parse(new Uint8Array(TP.encodeGene(9, [1,2]))).genes[0].broken);
// a cut inside a marker reads as junk, the next gene still parses (Review Focus 2)
const cut = new Uint8Array([0x47, ...TP.encodeGene(3, [20, 0x40])]);
eq(TP.parse(cut).genes.filter(x => !x.broken).length, 1);
// empty and junk-only genomes express to a creature with no rules (Review Focus 1)
eq(TP.express(new Uint8Array(0)).rules.length, 0);
eq(TP.express(new Uint8Array([1,2,3,4,5])).rules.length, 0);
// lock and key
ok(TP.fits(TP.express(Uint8Array.from([...TP.encodeGene(3,[20,0x3c]), ...TP.encodeGene(4,[30,0x3d])]))).ok);
ok(!TP.fits(TP.express(Uint8Array.from([...TP.encodeGene(3,[20,0x3c]), ...TP.encodeGene(4,[30,0x92])]))).ok);
ok(!TP.fits(TP.express(Uint8Array.from(TP.encodeGene(4,[30,0x3d])))).ok);   // rule with no sensor
// founders: each fits itself; Sniffer×Saver genes bind; Runner's do not bind theirs
for (const f of TP.FOUNDERS) ok(TP.fits(TP.express(f.bytes)).ok, f.name);
```

- [ ] **Step 2: Run** `node two-parent-programs/test.mjs`. Expected: FAIL (`TP` not defined).
- [ ] **Step 3: Implement** `TP.parse`, `TP.express`, `TP.fits`, `TP.encodeGene`, `TP.rng`, `TP.hex`, `TP.FOUNDERS` as specified above. Founders are written with `encodeGene` plus fixed junk; add a cross-founder test asserting the Sniffer nose key binds the Saver forage lock.
- [ ] **Step 4: Run** `node two-parent-programs/test.mjs`. Expected: `TPTests: N passed, 0 failed`.
- [ ] **Step 5: Commit** `git add two-parent-programs && git commit -m "two-parent-programs: byte genome, expression, lock and key"`

---

### Task 2: Reproduction: aligned mix, naive splice, gentle mutation

**Files:**
- Modify: `two-parent-programs/index.html` (`shared-code` block)

**Interfaces:**
- Consumes: `TP.parse`, `TP.express`, `TP.fits`, `TP.rng` (Task 1).
- Produces:
  - `TP.mixAligned(a: Uint8Array, b: Uint8Array, rand, opts = { mixEvolves: true }) -> Conception` and `TP.mixNaive(a, b, rand) -> Conception`.
  - `Conception = { bytes: Uint8Array, origin: Uint8Array /* per byte: 0 = parent A, 1 = parent B, 2 = mutated */, usedMixOf: 0|1|null, plan: [{type, occurrence, from: 0|1|null}], cutA?, cutB?, mutations: [{offset, kind}] }`. `kind` is one of `'nudge' | 'silent' | 'junk' | 'duplicate' | 'delete' | 'marker'`.
  - `TP.mutate(bytes, origin, rate, rand) -> { bytes, origin, mutations }`.
  - `TP.conceive(a, b, mode: 'naive'|'aligned', rand, opts = { fitCheck: true, mixEvolves: true }) -> { born: boolean, conception: Conception, fit: ReturnType<TP.fits>|null }`. Naive mode: `born` is always true and `fit` is null. Aligned mode with `fitCheck: false`: `born` true, `fit` still computed for display.
- Algorithm decisions the tests do not fully pin:
  - Alignment key is `(type, occurrence index of that type)`. A gene present in one parent only is taken when the plan picks that parent for its slot, otherwise left out.
  - Each gene carries the junk bytes that precede it in its own parent; trailing junk comes from parent A.
  - Coin flip: `usedMixOf = rand() < 0.5 ? 0 : 1`; that parent is "a". `share/255` is the chance a slot comes from "a". With `cuts = k > 0`, draw k cut positions between slots and alternate blocks, starting with "a" when `rand() < share/255`.
  - With `mixEvolves: false`, the child's mix gene is forced back to `TP.DEFAULT_MIX` values.
  - Mutation probability per coding byte is `rate / 2000`. Kinds per event: nudge ±1..3 on a setting byte (70 %), silent low-bit flip on a type byte (10 %), random junk byte (10 %), duplicate a whole gene (4 %), delete a gene (4 %), damage one marker byte (2 %). Junk bytes always mutate at the same per-byte probability with kind `'junk'`.

- [ ] **Step 1: Write failing tests**

```js
const R = TP.rng(5), [S, V, U] = TP.FOUNDERS.map(f => f.bytes);
// two parents of the same lineage always give a child that fits
for (let i = 0; i < 50; i++) ok(TP.conceive(S, S, 'aligned', R).born);
// aligned mix keeps one gene per slot, each from one of the two parents
const c = TP.mixAligned(S, V, R);
ok(c.plan.every(p => p.from === 0 || p.from === 1)); ok(c.usedMixOf === 0 || c.usedMixOf === 1);
ok([...c.origin].every(o => o <= 2));
// incompatible lineages: some conceptions fail the fit check, and with fitCheck off they are born
let failed = 0; for (let i = 0; i < 200; i++) if (!TP.conceive(S, U, 'aligned', R).born) failed++;
ok(failed > 0);
for (let i = 0; i < 50; i++) ok(TP.conceive(S, U, 'aligned', R, { fitCheck: false, mixEvolves: true }).born);
// naive: child is A[0..cutA) + B[cutB..), always born
const n = TP.mixNaive(S, V, R);
eq(n.bytes.length, n.cutA + (V.length - n.cutB));
// mutation is gentle: at rate 4, almost every child keeps every founder gene type
let intact = 0; for (let i = 0; i < 200; i++) { const m = TP.mutate(S, new Uint8Array(S.length), 4, R); if (TP.express(m.bytes).rules.length === TP.express(S).rules.length) intact++; }
ok(intact >= 190);
// gene-count mismatch and duplicates do not break alignment (Review Focus 3)
const dup = Uint8Array.from([...S, ...TP.encodeGene(3, [40, 0x3c])]);
ok(TP.mixAligned(dup, V, R).bytes.length > 0);
// determinism
eq(TP.hex(TP.mixAligned(S, V, TP.rng(9)).bytes), TP.hex(TP.mixAligned(S, V, TP.rng(9)).bytes));
```

- [ ] **Step 2: Run** `node two-parent-programs/test.mjs`. Expected: FAIL (`TP.mixAligned` not a function).
- [ ] **Step 3: Implement** `TP.mutate`, `TP.mixAligned`, `TP.mixNaive`, `TP.conceive` as specified.
- [ ] **Step 4: Run** the tests. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -am "two-parent-programs: aligned mix, naive splice, gentle mutation"`

---

### Task 3: The world

**Files:**
- Modify: `two-parent-programs/index.html` (`shared-code` block)

**Interfaces:**
- Consumes: `TP.conceive`, `TP.express`, `TP.FOUNDERS`, `TP.rng`.
- Produces `class TP.World`:
  - `new TP.World({ mode: 'naive'|'aligned', seed: number, fitCheck = true, mixEvolves = true, founders = TP.FOUNDERS, perLineage = 20 })`
  - `world.tick()`, `world.time`, `world.walls: Uint8Array(64*64)`, `world.food: Uint8Array(64*64)`
  - `world.creatures: Creature[]` with `{ id, x, y, energy, age, bytes, ph, parents: [id, id] | null, lineage: number[] /* share of genes from each founder lineage, sums to 1 */, eaten, early /* food eaten in first 200 ticks, or until death */, state: 'alive' }`
  - `world.records: Map<id, { parents, bytes, lineage, born, died, cause: 'starved'|'old'|null, early, x, y }>` (kept after death; pedigree and the inspector read from here)
  - `world.events: [{ t, kind: 'birth'|'failed'|'death', ids, conception?, fit?, cause? }]` (last 500 kept)
  - `world.lastConception = { t, parents: [idA, idB], parentBytes: [Uint8Array, Uint8Array], conception: Conception, fit, born: boolean, childId: number|null }` (most recent birth or failure; a copy, so it outlives the creatures)
  - `world.stats`: running totals `{ conceptions, failed, births, deaths: {starved, old}, adults /* children reaching age 100 */, betterThanBoth, judged }` plus `world.series: [{ t, pop, meanRate, bestRate, betterShare, mixedShare, meanShare, meanCuts }]` sampled every 50 ticks.
- Numbers (starting points, tune in Task 4): start energy 60; tick cost `0.15 + metab/255 * 0.35 + speed/255 * 0.25 + size/255 * 0.25`; food worth 18; max age 600; mating needs both creatures adjacent, both with an active mate rule (energy above its threshold), energy ≥ 30, age ≥ 60, and no mating in the last 40 ticks; a birth costs each parent 20 energy and the child starts with 40; a failed conception costs each 5; population cap 400.
- Food: three patches whose centres move on a slow circle (one lap per 3000 ticks, the seasons); each tick spawn food near a patch centre with probability `0.9 / (1 + pop / 150)`, spread Gaussian with sigma 6, never on walls.
- Behaviour each tick: rules in genome order; forage acts when energy < `a`, steering to the nearest food within its bound nose's range (`range/16 + 2` cells); mate acts when energy > `a`, steering to the nearest creature within the bound eye's range; flee acts when a creature bigger by `a` is within the eye's range. A rule whose lock binds nothing does nothing. Otherwise wander. Speed sets the chance of moving this tick (`0.3 + speed/255 * 0.7`). Rules bind as in `TP.fits`, also in naive mode (a naive child with broken bindings simply cannot use those rules).
- "Better than both": when a child's `early` is final (age 200 or death), compare with both parents' final `early`; count in `betterThanBoth` if strictly greater than both, and count every judged child in `judged`.

- [ ] **Step 1: Write failing tests**

```js
const w1 = new TP.World({ mode: 'aligned', seed: 3 }), w2 = new TP.World({ mode: 'aligned', seed: 3 });
for (let i = 0; i < 500; i++) { w1.tick(); w2.tick(); }
eq(w1.creatures.map(c => c.x + ',' + c.y).join(), w2.creatures.map(c => c.x + ',' + c.y).join());   // determinism
eq(w1.stats.conceptions, w1.stats.births + w1.stats.failed);
ok(w1.stats.births > 0);
for (const c of w1.creatures) if (c.parents) eq(c.parents.length, 2);                                // two parents, always
ok(w1.creatures.every(c => c.x >= 0 && c.x < 64 && c.y >= 0 && c.y < 64 && !w1.walls[c.y * 64 + c.x]));
ok(w1.creatures.length <= 400);
// records survive death (Review Focus 5)
const dead = [...w1.records.values()].find(r => r.died !== null); ok(dead && dead.bytes.length >= 0);
// an emptied world keeps ticking without NaN (Review Focus 4)
const w3 = new TP.World({ mode: 'naive', seed: 1 }); w3.creatures.length = 0;
for (let i = 0; i < 60; i++) w3.tick(); ok(w3.series.every(s => !Number.isNaN(s.meanRate)));
// lineage shares sum to 1
for (const c of w1.creatures) ok(Math.abs(c.lineage.reduce((a, b) => a + b, 0) - 1) < 1e-9);
```

- [ ] **Step 2: Run** the tests. Expected: FAIL (`TP.World` not a constructor).
- [ ] **Step 3: Implement** `TP.World` per the interface and numbers above. Use one `TP.rng(seed)` per world for everything, so runs reproduce.
- [ ] **Step 4: Run** the tests. Expected: all pass.
- [ ] **Step 5: Commit** `git commit -am "two-parent-programs: world with drifting food, mating and records"`

---

### Task 4: Tuning and the honest experiment

**Files:**
- Modify: `two-parent-programs/index.html` (numbers and founders in `shared-code`)
- Create: `two-parent-programs/experiment.mjs` (prints a report; not a test)

**Interfaces:**
- Consumes: `TP.World`.
- Produces: `TP.experiment(seed, ticks) -> { naive: Summary, aligned: Summary }` with `Summary = { pop, births, failed, adultsShare, betterShare, meanRateStart, meanRateEnd, extinctAt: number|null }`, used by the page's "What happened" box.

- [ ] **Step 1: Write `experiment.mjs`** that runs `TP.experiment(seed, 6000)` for seeds 1..5 and prints one table row per seed and mode.
- [ ] **Step 2: Run** `node two-parent-programs/experiment.mjs`. Record the numbers.
- [ ] **Step 3: Tune** the Task 3 numbers and the founders until, for most seeds, both worlds survive 6000 ticks without extinction and without sitting at the cap more than half the time. Tune for a living world only: never tune to make one mode win. If naive splicing does as well as life's way, keep that result.
- [ ] **Step 4: Add tests** pinning the tuned behaviour: `TP.experiment(1, 3000)` has `extinctAt === null` in the aligned world and `births > 50` in both; print (do not assert) the comparison.
- [ ] **Step 5: Run** the tests and `experiment.mjs`. Expected: tests pass; paste the report table into the commit message.
- [ ] **Step 6: Commit** `git commit -am "two-parent-programs: tuned numbers and experiment report"`

---

### Task 5: The page shell, the worlds and the creatures

**Files:**
- Modify: `two-parent-programs/index.html` (HTML, CSS, UI script)

**Interfaces:**
- Consumes: `TP.World`, `TP.express`.
- Produces in the UI script: `drawCreature(ctx, creature, px, py, scale, t)`, `drawWorld(canvas, world, t)`, `state = { worlds: [naiveWorld, alignedWorld], running, speed, seed, selected: {world, id} | null, pinned: conception record | null }`, `window.__tp` debug handle with `{ state, step(n) }` for headless screenshots.

- [ ] **Step 1: Layout**: title "Two-Parent Programs", a short lede, two world panels side by side (naive left, life's way right; stacked below 900 px), controls (run/pause, speed 1–8 ticks per frame, reset, seed, and in the life's-way panel the toggles "Fit check" and "Mix genes evolve"). Retro 1990s window chrome drawn in CSS (title bars, bevelled borders), our own design.
- [ ] **Step 2: Sprites**: each creature is drawn on a 64 × 64 grid canvas scaled with `image-rendering: pixelated` and a HiDPI backing store (device-pixel size, as in `game-boulder-dash`). The body is a round blob whose radius follows `size`, legs follow `speed`, eyes follow the bound eye's `range`, colour is the lineage mix (weighted blend of the founder colours). Starving creatures fade below 15 energy, creatures past age 500 grey out.
- [ ] **Step 3: Events in the world**: a birth draws a line between the parents and an egg that hatches over 20 frames; a failed conception draws a grey puff over 15 frames. Both are driven from `world.events`.
- [ ] **Step 4: Verify** in the Browser pane: both worlds run, no console errors, creatures visibly differ by lineage and body. Take one screenshot.
- [ ] **Step 5: Commit** `git commit -am "two-parent-programs: worlds, sprites and life events"`

---

### Task 6: Birth panel, inspector and family tree

**Files:**
- Modify: `two-parent-programs/index.html` (UI script, CSS)

**Interfaces:**
- Consumes: `world.lastConception`, `world.records`, `TP.parse`, `TP.fits`, `TP.hex`.
- Produces: `TP.pedigree(world, id, depth) -> Array<Array<record|null>>` in `shared-code` (level k has `2^k` slots, `null` beyond founders), and in the UI `renderBirthPanel(record, progress /* 0..1 */)`, `renderInspector(world, id)`, `renderTree(world, id, depth = 3)`.

- [ ] **Step 1: Birth panel**: `A + B → C`. Each genome is a strip of byte cells (one cell per byte, coloured by gene type, junk grey, markers dark). The animation moves the chosen genes from the parents' strips into the child's strip in plan order, tinting each by parent (A blue, B amber, mutated bytes outlined). Then each lock and key lights ✓ or ✗, then the egg or the puff. Show the coin flip ("mix gene from A") and the mix settings. Controls: pause, replay, follow latest, and "pin" when a creature is clicked. The panel reads only from the stored conception record, so a parent or child that has died still displays (Review Focus 5).
- [ ] **Step 2: Inspector**: genome as a hex dump (`TP.hex`), gene rows with what each gene means in words, origin colours, energy, age, foraging rate, cause of death, and a "Save .bin" button (Blob download).
- [ ] **Step 3: Family tree**: two parents, four grandparents and eight great-grandparents from `world.records`; founders shown as their lineage name; missing ancestors (founders' parents) drawn as an empty slot.
- [ ] **Step 4: Add tests**: after 800 ticks `world.lastConception` has two `parentBytes`, a `conception.plan` and, in aligned mode, a `fit`; `TP.pedigree(world, id, 3)` returns levels of 1, 2, 4 and 8 slots, with `null` above founders.
- [ ] **Step 5: Verify** in the Browser pane: click a creature, the panel and tree follow it; let it die and confirm the panels still show it. Screenshot.
- [ ] **Step 6: Commit** `git commit -am "two-parent-programs: birth panel, inspector and family tree"`

---

### Task 7: Charts, explanations and prior art

**Files:**
- Modify: `two-parent-programs/index.html`

**Interfaces:**
- Consumes: `world.series`, `world.stats`, `TP.experiment` summary shape.

- [ ] **Step 1: Counters** per world: population, conceptions, failed, births, deaths by cause, share of children reaching adulthood, children better than both parents (`betterThanBoth / judged`), or "extinct" when the population is 0.
- [ ] **Step 2: Charts** (canvas, both worlds overlaid in the same axes, labelled by the theme's text colour): population; mean and best foraging rate; share of children better than both parents; share of creatures with genes from two or more founder lineages; mean mix share and cuts (life's way only).
- [ ] **Step 3: Text**: "How it works" (genome bytes and markers, mix gene, lock and key, gentle mutation, the two worlds), "What happened" filled live from the counters (no fixed claims), and "Has this worked before?" with the references from the spec's prior-art list.
- [ ] **Step 4: Verify** in the Browser pane at desktop and 375 px width: no horizontal scroll, no overlapping labels, legends readable. Screenshot.
- [ ] **Step 5: Commit** `git commit -am "two-parent-programs: charts and explanations"`

---

### Task 8: Ship

**Files:**
- Create: `two-parent-programs/screenshot1.jpg` (1600 × 1000)
- Modify: `README.md` (entry under "2D", alphabetical), `gallery.yaml` (`two-parent-programs: Two-Parent Programs`), `index.html` (via `python3 build_gallery.py`)

- [ ] **Step 1: Run** `node two-parent-programs/test.mjs`. Expected: all pass.
- [ ] **Step 2: Check** the page in Chromium and in Firefox (headless Firefox for layout; canvas content verified in the Browser pane).
- [ ] **Step 3: Screenshot** with headless Chrome after `__tp.step(1500)` so both worlds are populated and the birth panel shows a conception.
- [ ] **Step 4: Gallery and README**, then `python3 build_gallery.py`.
- [ ] **Step 5: Commit** `git add -A two-parent-programs README.md gallery.yaml index.html docs/superpowers && git commit -m "two-parent-programs: two parents, one child"`
