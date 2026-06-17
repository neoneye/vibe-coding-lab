# Selectable Optimizers (Muon default) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-selectable optimizer (Muon default, plus Adam and SGD) to the Forward-Forward char-LM page, switchable at any time including pause→switch→resume.

**Architecture:** Extend `FFLayer` so each layer carries all three optimizers' state buffers and a `step(lr, optimizer)` that branches between them; add Newton-Schulz orthogonalization helpers for Muon. Thread an `optimizer` setting through `Trainer` (default `"muon"`) and add a UI `<select>` plus a time-budgeted training loop so the page stays responsive under Muon's heavier per-step cost.

**Tech Stack:** Vanilla JavaScript, `Float64Array`, HTML5; Node only for `test.mjs`. No external libraries.

## Global Constraints

- Single self-contained `forward-forward/index.html`; works from `file://` (no server/network); no external libs; no GPU/WebGL.
- All engine logic lives in `<script id="shared-code">` and must eval cleanly under Node (no `document`/`window` at module scope); the export guard exports every engine symbol plus `FFTests`. DOM/UI code lives only in the second `<script>`.
- Determinism: randomness only via seeded `makeRng` (mulberry32); never `Math.random()` in engine code. Numeric arrays use `Float64Array`.
- Muon params: momentum `μ = 0.95`; Newton-Schulz 5 iterations with `(a,b,c) = (3.4445, −4.7750, 2.0315)`; weight update `W −= lr·√max(1, out/in)·O`. Bias under Muon uses Adam.
- `FFLayer.step`'s internal default optimizer stays `"adam"` (so existing unit tests are unchanged); the *app* defaults to Muon via the Trainer/UI.
- Optimizer is a runtime knob: NOT serialized into saved weights; `serializeNet`/`weightsCompatible` unchanged.
- Weight matrix `W` is stored flat row-major as `outDim` rows × `inDim` cols: `W[j*inDim + k]`.
- Commit after every task with message prefix `forward-forward:`.
- Run `node test.mjs` from inside the `forward-forward/` directory.

---

### Task 1: Newton-Schulz + matrix helpers

**Files:**
- Modify: `forward-forward/index.html` (shared-code block: add helpers before the export guard; add tests in the `FFTests` section; extend exports)

**Interfaces:**
- Consumes: `makeRng`.
- Produces:
  - `matMul(A, ar, ac, B, br, bc) → Float64Array` — flat row-major product of an `ar×ac` by `br×bc` matrix (requires `ac === br`), result `ar×bc`.
  - `transpose(A, rows, cols) → Float64Array` — transpose of a flat `rows×cols` matrix → `cols×rows`.
  - `frobNorm(A) → number` — Frobenius (Euclidean) norm of a flat array.
  - `newtonSchulz5(G, rows, cols) → Float64Array` — semi-orthogonalization of the flat `rows×cols` matrix `G`; returns a `rows×cols` matrix whose singular values are driven toward 1.

- [ ] **Step 1: Write the failing tests** (add inside shared-code, in the `FFTests` section before the export guard)

```js
FFTests.add("matMul and transpose compute known results", () => {
  // A = [[1,2,3],[4,5,6]] (2x3), B = [[1,0],[0,1],[1,1]] (3x2) => [[4,5],[10,11]]
  const A = Float64Array.from([1,2,3,4,5,6]);
  const B = Float64Array.from([1,0,0,1,1,1]);
  const C = matMul(A,2,3,B,3,2);
  FFTests.assert(C.join(",") === "4,5,10,11", "matMul result " + C.join(","));
  const T = transpose(A,2,3); // 3x2: [[1,4],[2,5],[3,6]]
  FFTests.assert(T.join(",") === "1,4,2,5,3,6", "transpose result " + T.join(","));
});

FFTests.add("newtonSchulz5 yields a near-semi-orthogonal matrix", () => {
  const rng = makeRng(123), rows = 4, cols = 6;
  const G = new Float64Array(rows*cols);
  for (let i=0;i<G.length;i++) G[i] = rng()*2 - 1;
  const X = newtonSchulz5(G, rows, cols);
  // With rows<=cols, X*X^T should be close to the rows x rows identity.
  const XXt = matMul(X, rows, cols, transpose(X, rows, cols), cols, rows);
  let maxDev = 0;
  for (let i=0;i<rows;i++) for (let j=0;j<rows;j++) {
    const target = i===j ? 1 : 0;
    maxDev = Math.max(maxDev, Math.abs(XXt[i*rows+j] - target));
  }
  FFTests.assert(maxDev < 0.3, "X*X^T should be near identity, maxDev=" + maxDev.toFixed(3));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL `matMul is not defined`.

- [ ] **Step 3: Implement the helpers** (add inside shared-code, before the `FFTests` additions / export guard)

```js
function matMul(A, ar, ac, B, br, bc) {
  const C = new Float64Array(ar * bc);
  for (let i = 0; i < ar; i++) {
    const aRow = i * ac, cRow = i * bc;
    for (let k = 0; k < ac; k++) {
      const a = A[aRow + k];
      if (a === 0) continue;
      const bRow = k * bc;
      for (let j = 0; j < bc; j++) C[cRow + j] += a * B[bRow + j];
    }
  }
  return C;
}

function transpose(A, rows, cols) {
  const T = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) T[j * rows + i] = A[i * cols + j];
  return T;
}

function frobNorm(A) { let s = 0; for (let i = 0; i < A.length; i++) s += A[i] * A[i]; return Math.sqrt(s); }

function newtonSchulz5(G, rows, cols) {
  const a = 3.4445, b = -4.7750, c = 2.0315;
  const norm = frobNorm(G) + 1e-7;
  let X = new Float64Array(G.length);
  for (let i = 0; i < G.length; i++) X[i] = G[i] / norm;
  let r = rows, cc = cols, transposed = false;
  if (rows > cols) { X = transpose(X, rows, cols); r = cols; cc = rows; transposed = true; }
  // X is r x cc with r <= cc
  for (let it = 0; it < 5; it++) {
    const Xt = transpose(X, r, cc);          // cc x r
    const A = matMul(X, r, cc, Xt, cc, r);   // r x r
    const AA = matMul(A, r, r, A, r, r);     // r x r
    const B = new Float64Array(r * r);
    for (let i = 0; i < r * r; i++) B[i] = b * A[i] + c * AA[i];
    const BX = matMul(B, r, r, X, r, cc);    // r x cc
    for (let i = 0; i < r * cc; i++) X[i] = a * X[i] + BX[i];
  }
  if (transposed) X = transpose(X, r, cc);   // back to rows x cols
  return X;
}
```

- [ ] **Step 4: Extend the export guard** — add `matMul, transpose, frobNorm, newtonSchulz5` to the `module.exports = { ... }` object.

- [ ] **Step 5: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all tests pass (2 new tests added; total count rises by 2). If the `newtonSchulz5` test's `maxDev` is unexpectedly large (≥0.3), do NOT loosen the tolerance — re-check the coefficient signs and the transpose handling; a correct implementation reaches well under 0.3 for this seeded matrix.

- [ ] **Step 6: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: Newton-Schulz + matrix helpers for Muon"
```

---

### Task 2: FFLayer optimizer support (Muon / Adam / SGD)

**Files:**
- Modify: `forward-forward/index.html` (shared-code: `FFLayer` constructor + `step`; add an Adam helper; add tests)

**Interfaces:**
- Consumes: `newtonSchulz5`, `sigmoid` (existing).
- Produces:
  - `FFLayer` constructor additionally allocates `this.Bw` (Muon momentum, length of `W`), `this.vW2` (SGD velocity for `W`), `this.vb2` (SGD velocity for `b`).
  - `FFLayer.step(lr, optimizer = "adam")` — applies one update using `optimizer ∈ {"muon","adam","sgd"}`, then zeroes gradients. Adam = current behavior on `W` and `b`; SGD = momentum (`μ=0.95`) on `W` and `b`; Muon = Newton-Schulz orthogonalized momentum on `W` and Adam on `b`.
  - `FFLayer._adamArray(param, dArr, m, v, lr, n, bc1, bc2)` — private helper applying a bias-corrected Adam step elementwise across `param`.

- [ ] **Step 1: Write the failing tests** (add to the `FFTests` section)

```js
FFTests.add("FFLayer Muon raises goodness on positive, lowers on negative", () => {
  const rng = makeRng(7);
  const layer = new FFLayer(6, 8, rng);
  const xPos = Float64Array.from([1, 0, 0, 1, 0, 1]);
  const theta = 8;
  const g0 = layer.goodness(layer.forward(xPos));
  for (let i = 0; i < 120; i++) { layer.zeroGrad(); layer.accumulate(xPos, true, theta); layer.step(0.1, "muon"); }
  const g1 = layer.goodness(layer.forward(xPos));
  FFTests.assert(g1 > g0, `muon positive goodness should rise (${g0} -> ${g1})`);

  const xNeg = Float64Array.from([0, 1, 1, 0, 1, 0]);
  const n0 = layer.goodness(layer.forward(xNeg));
  for (let i = 0; i < 120; i++) { layer.zeroGrad(); layer.accumulate(xNeg, false, theta); layer.step(0.1, "muon"); }
  const n1 = layer.goodness(layer.forward(xNeg));
  FFTests.assert(n1 < n0, `muon negative goodness should fall (${n0} -> ${n1})`);
});

FFTests.add("FFLayer SGD raises goodness on a positive sample", () => {
  const layer = new FFLayer(6, 8, makeRng(5));
  const xPos = Float64Array.from([1, 0, 1, 0, 1, 0]);
  const g0 = layer.goodness(layer.forward(xPos));
  for (let i = 0; i < 80; i++) { layer.zeroGrad(); layer.accumulate(xPos, true, 8); layer.step(0.02, "sgd"); }
  FFTests.assert(layer.goodness(layer.forward(xPos)) > g0, "sgd should raise positive goodness");
});

FFTests.add("FFLayer optimizer switch (muon->adam) is safe and keeps learning", () => {
  const layer = new FFLayer(6, 8, makeRng(9));
  const xPos = Float64Array.from([1, 1, 0, 0, 1, 0]);
  const g0 = layer.goodness(layer.forward(xPos));
  for (let i = 0; i < 60; i++) { layer.zeroGrad(); layer.accumulate(xPos, true, 8); layer.step(0.1, "muon"); }
  for (let i = 0; i < 60; i++) { layer.zeroGrad(); layer.accumulate(xPos, true, 8); layer.step(0.01, "adam"); }
  FFTests.assert(layer.goodness(layer.forward(xPos)) > g0, "switching muon->adam should not throw and should keep raising goodness");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL — the Muon/SGD/switch tests fail because `step` ignores the optimizer arg (still pure Adam) or because the new behavior is absent. (They may not throw, but at least one assertion about Muon/SGD must fail before implementation; if all three happen to pass against pure-Adam by luck, proceed anyway — the implementation below is still required.)

- [ ] **Step 3: Add the new buffers to the constructor** — in `FFLayer`'s constructor, immediately after the line `this.dW = new Float64Array(this.W.length); this.db = new Float64Array(outDim);`, add:

```js
    this.Bw = new Float64Array(this.W.length);   // Muon momentum buffer (matrix)
    this.vW2 = new Float64Array(this.W.length);  // SGD velocity for W
    this.vb2 = new Float64Array(outDim);         // SGD velocity for b
```

- [ ] **Step 4: Replace `step(lr)` with the multi-optimizer version + Adam helper**

Replace the entire existing `step(lr) { ... }` method with:

```js
  _adamArray(param, dArr, m, v, lr, n, bc1, bc2) {
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    for (let i = 0; i < param.length; i++) {
      const g = dArr[i] / n;
      m[i] = b1 * m[i] + (1 - b1) * g;
      v[i] = b2 * v[i] + (1 - b2) * g * g;
      param[i] -= lr * (m[i] / bc1) / (Math.sqrt(v[i] / bc2) + eps);
    }
  }
  step(lr, optimizer = "adam") {
    if (this.count === 0) return;
    const n = this.count, mu = 0.95;
    if (optimizer === "sgd") {
      for (let i = 0; i < this.W.length; i++) { this.vW2[i] = mu * this.vW2[i] + this.dW[i] / n; this.W[i] -= lr * this.vW2[i]; }
      for (let j = 0; j < this.outDim; j++) { this.vb2[j] = mu * this.vb2[j] + this.db[j] / n; this.b[j] -= lr * this.vb2[j]; }
    } else if (optimizer === "muon") {
      for (let i = 0; i < this.W.length; i++) this.Bw[i] = mu * this.Bw[i] + this.dW[i] / n;
      const O = newtonSchulz5(this.Bw, this.outDim, this.inDim);
      const scale = lr * Math.sqrt(Math.max(1, this.outDim / this.inDim));
      for (let i = 0; i < this.W.length; i++) this.W[i] -= scale * O[i];
      this.t++;
      const bc1 = 1 - Math.pow(0.9, this.t), bc2 = 1 - Math.pow(0.999, this.t);
      this._adamArray(this.b, this.db, this.mb, this.vb, lr, n, bc1, bc2); // bias via Adam
    } else { // adam (default)
      this.t++;
      const bc1 = 1 - Math.pow(0.9, this.t), bc2 = 1 - Math.pow(0.999, this.t);
      this._adamArray(this.W, this.dW, this.mW, this.vW, lr, n, bc1, bc2);
      this._adamArray(this.b, this.db, this.mb, this.vb, lr, n, bc1, bc2);
    }
    this.zeroGrad();
  }
```

- [ ] **Step 5: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all tests pass, including the three new ones AND the pre-existing `FFLayer goodness rises ... after updates` Adam test (which calls `step(0.05)` → defaults to Adam, unchanged). If the Muon positive-goodness test does not rise, do NOT weaken the assertion — increase the iteration count (Muon's per-step magnitude on a single rank-1 sample is small by design); the update *direction* is correct, so more iterations must raise it.

- [ ] **Step 6: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: FFLayer Muon/Adam/SGD optimizer selection"
```

---

### Task 3: Trainer optimizer wiring

**Files:**
- Modify: `forward-forward/index.html` (shared-code: `Trainer` constructor + `stepBatch`; add a test)

**Interfaces:**
- Consumes: `FFLayer.step(lr, optimizer)`.
- Produces:
  - `Trainer` constructor reads `cfg.optimizer` into `this.optimizer` (default `"muon"`).
  - `Trainer.stepBatch` calls `layer.step(this.lr, this.optimizer)` for each layer.

- [ ] **Step 1: Write the failing test** (add to the `FFTests` section)

```js
FFTests.add("Trainer defaults to Muon and learns on a repeating pattern", () => {
  const text = "abcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc";
  const tr = new Trainer({
    text, K: 3, layerSizes: [24, 24], theta: 24, lr: 0.05,
    batchSize: 16, negPerPos: 1, valFraction: 0.25, vocabCap: 8, seed: 11
  });
  FFTests.assert(tr.optimizer === "muon", "default optimizer should be muon");
  const before = tr.evalAccuracy(20);
  let sepBefore = 0, last;
  for (let i = 0; i < 400; i++) last = tr.stepBatch();
  const after = tr.evalAccuracy(20);
  const gp = last.gPos.reduce((a,b)=>a+b,0)/last.gPos.length;
  const gn = last.gNeg.reduce((a,b)=>a+b,0)/last.gNeg.length;
  FFTests.assert(after > before || gp > gn,
    `muon should learn (before=${before.toFixed(2)}, after=${after.toFixed(2)}, gp=${gp.toFixed(1)}, gn=${gn.toFixed(1)})`);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL on `default optimizer should be muon` (Trainer has no `optimizer` field yet → `undefined !== "muon"`).

- [ ] **Step 3: Wire the optimizer into Trainer**

In the `Trainer` constructor, after the line `this.batchSize = cfg.batchSize; this.negPerPos = cfg.negPerPos;`, add:

```js
    this.optimizer = cfg.optimizer || "muon";
```

In `Trainer.stepBatch`, change the line:

```js
    for (const layer of this.net.layers) layer.step(this.lr);
```

to:

```js
    for (const layer of this.net.layers) layer.step(this.lr, this.optimizer);
```

- [ ] **Step 4: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all tests pass. (Note: the earlier Task-5 overfit test from the base project constructs a Trainer without `optimizer`, so it now trains with Muon by default — confirm it still passes; its assertion is the lenient `after > before || after > chance*1.5`. If it regresses, do not weaken it — verify Task 2's Muon path is correct.)

- [ ] **Step 5: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: Trainer optimizer wiring (default Muon)"
```

---

### Task 4: UI — optimizer selector, time-budgeted loop, LR default

**Files:**
- Modify: `forward-forward/index.html` (controls markup; the second UI `<script>`)

**Interfaces:**
- Consumes (globals from shared-code): `Trainer`.
- Produces: an Optimizer `<select id="optimizer">` wired so `Ctrl.build()` passes it to the Trainer and the loop re-reads it live; a time-budgeted training loop; corrected steps/sec; LR default `0.02`.

- [ ] **Step 1: Add the Optimizer select to the controls markup**

In the controls panel, immediately BEFORE the `Learning rate` row (the line `<div class="row"><label style="flex:1">Learning rate</label>...`), insert:

```html
    <label>Optimizer</label>
    <select id="optimizer">
      <option value="muon" selected>Muon (orthogonalized)</option>
      <option value="adam">Adam</option>
      <option value="sgd">SGD + momentum</option>
    </select>
```

- [ ] **Step 2: Raise the LR slider default to 0.02**

Change the Learning-rate slider markup from:

```html
    <div class="row"><label style="flex:1">Learning rate</label><span class="val" id="lrVal">0.010</span></div>
    <input type="range" id="lr" min="1" max="100" value="10">
```

to:

```html
    <div class="row"><label style="flex:1">Learning rate</label><span class="val" id="lrVal">0.020</span></div>
    <input type="range" id="lr" min="1" max="100" value="20">
```

- [ ] **Step 3: Register the `optimizer` DOM ref**

In the UI script's `S` ref-builder array (the `[...].forEach(id => S[id] = document.getElementById(id))` list), add `"optimizer"` to the array.

- [ ] **Step 4: Pass the optimizer into the Trainer in `Ctrl.build()`**

In `Ctrl.build()`, add `optimizer: S.optimizer.value,` to the `new Trainer({ ... })` config object (e.g., right after the `text: store.get(store.active),` line).

- [ ] **Step 5: Replace the fixed-count loop with a time-budgeted loop + live optimizer read**

Replace the existing `loop()` method:

```js
  loop() {
    if (!this.running) return;
    let last = null;
    for (let i = 0; i < 20; i++) { last = this.trainer.stepBatch(); this.stepCount++; }
    this.trainer.lr = lrValue(); // allow live LR tweaks
    this.updateStats(last);
    this.raf = requestAnimationFrame(() => this.loop());
  },
```

with:

```js
  loop() {
    if (!this.running) return;
    let last = null, steps = 0;
    const tStart = performance.now();
    do {
      this.trainer.lr = lrValue();                 // live LR
      this.trainer.optimizer = S.optimizer.value;  // live optimizer switch
      last = this.trainer.stepBatch();
      this.stepCount++; steps++;
    } while (steps < 64 && performance.now() - tStart < 16);
    this.lastTickSteps = steps;
    this.updateStats(last);
    this.raf = requestAnimationFrame(() => this.loop());
  },
```

- [ ] **Step 6: Add `lastTickSteps` to the `Ctrl` object and fix steps/sec**

In the `Ctrl` object literal header, add `lastTickSteps: 0,` alongside the other fields (e.g., after `stepCount: 0,`).

In `Ctrl.updateStats`, replace the steps/sec line:

```js
    if (this.lastTick) S.sps.textContent = Math.round(20000 / (now - this.lastTick));
```

with:

```js
    if (this.lastTick) S.sps.textContent = Math.round((this.lastTickSteps || 0) * 1000 / (now - this.lastTick));
```

- [ ] **Step 7: Verify engine intact + page renders**

Run: `cd forward-forward && node test.mjs`
Expected: same pass count as after Task 3 (engine untouched by this UI task).

Then headless render (best-effort):
```bash
cd /Users/neoneye/git/vibe-coding-lab/forward-forward && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1180,1000 --virtual-time-budget=4000 --screenshot="/tmp/ff-opt.png" "file://$PWD/index.html" 2>&1 | head -5 ; ls -la /tmp/ff-opt.png
```
Expected: a non-empty PNG; the Optimizer dropdown appears above Learning rate with "Muon (orthogonalized)" selected. (If no headless browser is available, report DONE_WITH_CONCERNS and rely on `node test.mjs` + careful re-reading.)

- [ ] **Step 8: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: optimizer selector + time-budgeted training loop"
```

---

### Task 5: Regenerate screenshot + final verification

**Files:**
- Modify: `forward-forward/screenshot1.png`
- Modify (only if needed): `forward-forward/index.html`

**Interfaces:** none.

- [ ] **Step 1: Full test run**

Run: `cd forward-forward && node test.mjs`
Expected: all tests pass, exit 0. Record the final pass count.

- [ ] **Step 2: Sanity-check that Muon learns in a bounded number of steps (Node diagnostic)**

Create `/tmp/ff-muon-diag.mjs`:

```js
import { readFileSync } from "node:fs";
const html = readFileSync("index.html","utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
const { Trainer, BUILTIN_CORPORA } = new Function(`${m[1]}; return { Trainer, BUILTIN_CORPORA };`)();
const tr = new Trainer({ text: BUILTIN_CORPORA[0].text, K: 8, layerSizes:[128,128,128], theta:128, lr:0.02, batchSize:32, negPerPos:1, valFraction:0.1, vocabCap:60, seed:1234, optimizer:"muon" });
let last;
for (let k=0;k<=800;k+=200){ if(k>0) for(let i=0;i<200;i++) last=tr.stepBatch(); const acc=tr.evalAccuracy(40); console.log(`${k} steps: acc=${(acc*100).toFixed(1)}%`); }
```

Run: `cd forward-forward && node /tmp/ff-muon-diag.mjs`
Expected: accuracy rises above ~2% chance within ~800 steps (it should reach roughly 8–20%). Note the step count where it becomes visibly non-zero; use a value at/above that for the screenshot in Step 3. If accuracy stays at 0% through 800 steps, STOP and report — that indicates a Muon scaling/LR problem to investigate before shipping.

- [ ] **Step 3: Capture a trained-state screenshot showing the Muon default**

Build a temporary auto-driver page that drives REAL synchronous training (per the repo's headless-screenshot technique — rAF does not advance under headless virtual time). Choose `STEPS` = the value validated in Step 2 (e.g. 800; raise if Step 2 showed learning needs more):

```bash
cd /Users/neoneye/git/vibe-coding-lab/forward-forward
node -e '
const fs=require("fs"); let html=fs.readFileSync("index.html","utf8");
const driver=`<script>
window.addEventListener("load",()=>{
  try{
    Ctrl.build(); const t=Ctrl.trainer; const STEPS=800; let last;
    for(let s=0;s<STEPS;s++){ last=t.stepBatch(); Ctrl.stepCount=(Ctrl.stepCount||0)+1;
      if(Ctrl.stepCount%20===0){ const acc=t.evalAccuracy(15);
        const gp=last.gPos.reduce((a,b)=>a+b,0)/last.gPos.length;
        const gn=last.gNeg.reduce((a,b)=>a+b,0)/last.gNeg.length;
        Ctrl.history.push({acc,gp,gn}); } }
    const h=Ctrl.history[Ctrl.history.length-1];
    document.getElementById("examples").textContent=t.examplesSeen.toLocaleString();
    document.getElementById("acc").textContent=(h.acc*100).toFixed(1)+"%";
    document.getElementById("good").textContent=h.gp.toFixed(1)+" / "+h.gn.toFixed(1);
    document.getElementById("status").textContent="paused";
    document.getElementById("sps").textContent="—";
    document.getElementById("prompt").value="To be";
    drawChart(); refreshDistribution();
    document.getElementById("liveSample").textContent=generate(t.net,t.vocab,"the ",90,0.6,makeRng(7),t.K);
    document.getElementById("genOut").textContent=generate(t.net,t.vocab,"To be",150,0.6,makeRng(11),t.K);
    document.title="FFOK acc="+(h.acc*100).toFixed(1);
  }catch(e){document.getElementById("status").textContent="ERR:"+e.message;document.title="FFERR "+e.message;}
});
</script>
</body>`;
html=html.replace("</body>",driver); fs.writeFileSync("_shot.html",html); console.log("wrote _shot.html");
'
timeout 300 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1180,1040 --virtual-time-budget=200000 --screenshot="$PWD/screenshot1.png" "file://$PWD/_shot.html" 2>/dev/null
echo "exit=$?"; rm -f _shot.html; ls -la screenshot1.png
```

(Verify `_shot.html` was removed and is not staged. If Chrome isn't at that path, locate it via `which google-chrome chromium`.)

- [ ] **Step 4: Inspect the screenshot**

Open/Read `forward-forward/screenshot1.png`. Confirm: the new **Optimizer** dropdown shows "Muon (orthogonalized)"; the Learning rate reads 0.020; the chart shows separated goodness curves and a rising accuracy curve; generated text shows learned structure. If the chart is empty or accuracy is 0%, raise `STEPS` and recapture. If after reasonable attempts the chart cannot be populated, fall back to an idle-state capture and note it.

- [ ] **Step 5: Commit**

```bash
git add forward-forward/screenshot1.png
git commit -m "forward-forward: screenshot with Muon-default optimizer selector"
```

---

## Self-Review

**Spec coverage:**
- Muon update (momentum → Newton-Schulz → scaled update), 5 iters, coefficients, `√max(1,out/in)` scale → Task 1 (NS) + Task 2 (step) ✓
- Bias falls back to Adam under Muon → Task 2 ✓
- Adam unchanged; SGD momentum → Task 2 ✓
- All optimizer buffers coexist; switch is safe / carry-over (no reset) → Task 2 (buffers + switch test) ✓
- Trainer default `"muon"` → Task 3 ✓
- UI selector (Muon default/Adam/SGD), live read, pause-optional → Task 4 ✓
- Time-budgeted loop for responsiveness; steps/sec corrected → Task 4 ✓
- LR default raised to 0.02 → Task 4 ✓
- Optimizer not serialized; serializeNet/weightsCompatible unchanged → no task touches them (correct) ✓
- Tests: NS semi-orthogonality, matMul/transpose, Muon trains, SGD trains, switch-safe, existing green → Tasks 1–3 ✓
- Screenshot reflects new control + Muon default → Task 5 ✓

**Placeholder scan:** No TBD/TODO. All code steps contain complete code. The screenshot `STEPS` value is concretely 800 with a validated fallback rule (Step 2 gates it).

**Type consistency:** `step(lr, optimizer)`, `this.optimizer`, `this.Bw/vW2/vb2`, `_adamArray(param,dArr,m,v,lr,n,bc1,bc2)`, `newtonSchulz5(G, rows, cols)`, `matMul(A,ar,ac,B,br,bc)`, `transpose(A,rows,cols)`, `S.optimizer`, `Ctrl.lastTickSteps` are used consistently across tasks. `W` layout (`outDim×inDim`, `W[j*inDim+k]`) matches the `newtonSchulz5(this.Bw, this.outDim, this.inDim)` call in Task 2.
