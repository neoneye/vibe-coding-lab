# Overlap-Error Feedback (Predictive Coding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the model into a sliding next-byte predictor with an n-byte lookahead, feeding back the float discrepancy (`predicted_probability − true_bit`) of its previous overlapping forecasts as `8(n−1)` extra inputs.

**Architecture:** At every byte position the model predicts the next `n` bytes (8n bits, existing NADE `ARReadout`). When a byte is revealed, the prior `n−1` forecasts of it are scored against the truth, producing `8(n−1)` signed floats fed as extra FF input. Training processes contiguous byte windows (so the feedback chains); generation commits one byte per step. FF layers, optimizers, and the NADE readout are reused.

**Tech Stack:** Vanilla JavaScript, `Float64Array`; Node only for `test.mjs`. No external libraries.

## Global Constraints

- Single self-contained `forward-forward/index.html`; works from `file://`; no external libs; no GPU/WebGL.
- Engine in `<script id="shared-code">`, evals under Node (no document/window at module scope). Export guard exports engine symbols + FFTests. UI only in the second `<script>`.
- Determinism: randomness only via seeded `makeRng`; never `Math.random()` in engine. Float64Array.
- `n` = lookahead length (token-unit selector). `K` = number of context **bytes**. FF `inDim = 8K + 8(n−1)`. Feedback width = `8(n−1)` (bytes→0, bigrams→8, trigrams→16).
- Feedback value = `predicted_probability − true_bit` (un-clamped signed float in [−1,1]). When predicting at position `p`, it scores the prior forecasts of the just-revealed byte `b_{p−1}`: for `k = 1 … n−1`, use `predBuffer[k]` (the lookahead predicted `k+1` steps ago = `L_{p−1−k}`) at **byte-slot k** (bits `[8k … 8k+7]`). No history ⇒ zero feedback.
- `predBuffer` is a rolling list of the last `n` lookahead probability arrays; `predBuffer[0]` is the most recent.
- The model commits ONE byte per step (first byte of the lookahead). Metrics are **next-byte** (the committed byte).
- No backprop into the FF stack; feedback is an input signal. The Muon/Adam/SGD selector governs FF hidden layers; the readout uses Adam.
- Commit after every task with message prefix `forward-forward:`. Run `node test.mjs` from inside `forward-forward/`.

---

### Task 1: Feedback helpers

**Files:**
- Modify: `forward-forward/index.html` (shared-code: add `concatFloat`, `bytesContextBits`, `computeFeedback`; add tests; extend exports). Additive — do not modify existing functions.

**Interfaces:**
- Consumes: `tokenToBits` (existing).
- Produces:
  - `concatFloat(a, b) → Float64Array` — concatenation of two `Float64Array`s.
  - `bytesContextBits(bytes, p, K) → Float64Array(8K)` — bits of `bytes[p−K … p−1]` (MSB-first), zero for indices `< 0`.
  - `computeFeedback(predBuffer, revealedByteBits, n) → Float64Array(8(n−1))` — for `k=1…n−1`, `predBuffer[k][8k+b] − revealedByteBits[b]`; zero where `predBuffer[k]` is missing.

- [ ] **Step 1: Write the failing tests** (add inside shared-code, in the `FFTests` section)

```js
FFTests.add("bytesContextBits length, bits, and zero-pad", () => {
  const bytes = Uint8Array.from([0x80, 0x01]); // 10000000, 00000001
  const x = bytesContextBits(bytes, 2, 2);
  FFTests.assert(x.length === 16, "length 8K");
  FFTests.assert(x[0] === 1 && x[8 + 7] === 1, "MSB of byte0 and LSB of byte1 set");
  const y = bytesContextBits(bytes, 1, 2); // first slot is index -1 => zero
  let pad = true; for (let i = 0; i < 8; i++) if (y[i] !== 0) pad = false;
  FFTests.assert(pad && y[8] === 1, "left slot zero-padded, second slot = byte0");
});

FFTests.add("computeFeedback float discrepancy (unclamped), zeros when missing", () => {
  const n = 3;
  const L1 = new Float64Array(24); for (let b = 0; b < 8; b++) L1[8 + b] = 0.7;  // slot1 probs
  const L2 = new Float64Array(24); for (let b = 0; b < 8; b++) L2[16 + b] = 0.2; // slot2 probs
  const predBuffer = [new Float64Array(24), L1, L2]; // [0]=most recent (unused), [1], [2]
  const revealed = tokenToBits([0xFF], 1); // all ones
  const fb = computeFeedback(predBuffer, revealed, n);
  FFTests.assert(fb.length === 16, "feedback width 8(n-1)");
  FFTests.approx(fb[0], 0.7 - 1, 1e-9, "slot1: 0.7 - 1 = -0.3 (unclamped float)");
  FFTests.approx(fb[8], 0.2 - 1, 1e-9, "slot2: 0.2 - 1 = -0.8");
  const fb0 = computeFeedback([], revealed, n);
  let allZero = true; for (const v of fb0) if (v !== 0) allZero = false;
  FFTests.assert(allZero, "no history => zero feedback");
  FFTests.assert(computeFeedback([], tokenToBits([0], 1), 1).length === 0, "n=1 => width 0");
});

FFTests.add("concatFloat concatenates", () => {
  const c = concatFloat(Float64Array.from([1, 2]), Float64Array.from([3]));
  FFTests.assert(c.length === 3 && c[0] === 1 && c[2] === 3, "concat");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL `bytesContextBits is not defined`.

- [ ] **Step 3: Implement the helpers** (add inside shared-code, before the test additions / export guard)

```js
function concatFloat(a, b) {
  const out = new Float64Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length);
  return out;
}
function bytesContextBits(bytes, p, K) {
  const x = new Float64Array(8 * K);
  for (let i = 0; i < K; i++) {
    const idx = p - K + i;
    if (idx < 0) continue;
    const v = bytes[idx];
    for (let b = 0; b < 8; b++) x[i * 8 + b] = (v >> (7 - b)) & 1;
  }
  return x;
}
function computeFeedback(predBuffer, revealedByteBits, n) {
  const out = new Float64Array(8 * (n - 1));
  for (let k = 1; k < n; k++) {
    const pred = predBuffer[k];
    if (!pred) continue;
    const off = (k - 1) * 8, slot = k * 8;
    for (let b = 0; b < 8; b++) out[off + b] = pred[slot + b] - revealedByteBits[b];
  }
  return out;
}
```

- [ ] **Step 4: Extend exports** — add `concatFloat, bytesContextBits, computeFeedback` to `module.exports`.

- [ ] **Step 5: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all pass (3 new tests).

- [ ] **Step 6: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: feedback helpers (context bits, float discrepancy)"
```

---

### Task 2: Sliding feedback Trainer + generation

**Files:**
- Modify: `forward-forward/index.html` (shared-code: rewrite the `Trainer` class body and `generate`; replace the Trainer/generate/serialize tests; add feedback-wiring + inDim tests)

**Interfaces:**
- Consumes: `concatFloat`, `bytesContextBits`, `computeFeedback`, `textToBytes`, `bytesToText`, `tokenToBits`, `FFNet`, `ARReadout`, `l2normalize`, `makeRng`.
- Produces:
  - `Trainer` rebuilt around the byte stream. Fields: `n`, `K`, `theta`, `lr`, `batchSize`, `optimizer`, `bitsPerTok=8n`, `feedbackDim=8(n−1)`, `inDim=8K+8(n−1)`, `bytes`, `trainBytes`, `split`, `valStart`, `net`, `readout`, `examplesSeen`.
    - `stepBatch() → {lossPos, lossNeg, gPos, gNeg}` — sequential contiguous window with the feedback buffer.
    - `predictNextByteProbs(seedText) → Float64Array(8)` — greedy next-byte probabilities after warming the feedback buffer over the seed tail.
    - `evalNextByte(count) → {bit, byte}`; `evalBitAccuracy(count) → number` (= `.bit`); `evalTokenAccuracy(count) → number` (= `.byte`).
    - `randomContextBits() → Float64Array(8K)`.
  - `generate(trainer, seedText, lengthBytes, temp, rng) → string` — one byte per step with the feedback loop.

- [ ] **Step 1: Replace the Trainer/generate/serialize tests**

Delete these existing tests:
- `"binary Trainer readout learns a repeating byte pattern"`
- `"binary Trainer defaults to Muon and trains"`
- `"generate returns seed prefix and grows by tokens*n bytes"`
- `"FF goodness separates real from random-position contexts"`
- `"binary Trainer exact-token accuracy rises above zero (AR readout)"`
- `"serializeModel/deserializeModel preserve readout predictions; modelCompatible checks n"`

Add in their place:

```js
FFTests.add("Trainer inDim = 8K + 8(n-1); feedback width scales with n", () => {
  const t1 = new Trainer({ text: "abcabcabcabc", n: 1, K: 4, layerSizes: [8], theta: 8, lr: 0.02, batchSize: 4, valFraction: 0.25, seed: 1 });
  FFTests.assert(t1.inDim === 8 * 4 && t1.feedbackDim === 0, "n=1 => no feedback");
  const t3 = new Trainer({ text: "abcabcabcabcabcabc", n: 3, K: 4, layerSizes: [8], theta: 8, lr: 0.02, batchSize: 4, valFraction: 0.25, seed: 1 });
  FFTests.assert(t3.inDim === 8 * 4 + 16 && t3.feedbackDim === 16, "n=3 => 16 feedback inputs");
});

FFTests.add("feedback inputs actually reach the network", () => {
  const t = new Trainer({ text: "the quick brown fox jumps over the lazy dog the end", n: 3, K: 4, layerSizes: [16, 16], theta: 16, lr: 0.02, batchSize: 8, valFraction: 0.2, seed: 2 });
  for (let i = 0; i < 50; i++) t.stepBatch();
  const ctx = bytesContextBits(t.bytes, 10, t.K);
  const xZero = concatFloat(ctx, new Float64Array(16));
  const fb = new Float64Array(16); for (let i = 0; i < 16; i++) fb[i] = (i % 2) ? 0.5 : -0.5;
  const xFb = concatFloat(ctx, fb);
  const pZero = t.readout.greedyProbs(t.net.readoutFeatures(t.net.forwardAll(xZero).acts));
  const pFb = t.readout.greedyProbs(t.net.readoutFeatures(t.net.forwardAll(xFb).acts));
  let diff = 0; for (let i = 0; i < pZero.length; i++) diff = Math.max(diff, Math.abs(pZero[i] - pFb[i]));
  FFTests.assert(diff > 1e-6, "changing the feedback inputs must change the output, diff=" + diff);
});

FFTests.add("Trainer next-byte bit-accuracy rises on a repeating pattern (n=3 lookahead)", () => {
  const text = "abcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc";
  const tr = new Trainer({ text, n: 3, K: 6, layerSizes: [32, 32], theta: 32, lr: 0.03, batchSize: 16, valFraction: 0.25, seed: 11, optimizer: "adam" });
  const before = tr.evalBitAccuracy(20);
  for (let i = 0; i < 500; i++) tr.stepBatch();
  const after = tr.evalBitAccuracy(20);
  FFTests.assert(tr.examplesSeen === 500 * 16, "examplesSeen tracked");
  FFTests.assert(after > 0.85 || after > before + 0.2, `next-byte bit accuracy should rise (before=${before.toFixed(2)} after=${after.toFixed(2)})`);
});

FFTests.add("Trainer defaults to Muon and FF goodness separates", () => {
  const text = "the quick brown fox jumps over the lazy dog the quick brown fox jumps";
  const tr = new Trainer({ text, n: 3, K: 6, layerSizes: [32, 32], theta: 32, lr: 0.02, batchSize: 16, valFraction: 0.2, seed: 3 });
  FFTests.assert(tr.optimizer === "muon", "default optimizer muon");
  let last; for (let i = 0; i < 300; i++) last = tr.stepBatch();
  const gp = last.gPos.reduce((a, b) => a + b, 0), gn = last.gNeg.reduce((a, b) => a + b, 0);
  FFTests.assert(gp > gn, `positive goodness should exceed negative (gp=${gp.toFixed(1)} gn=${gn.toFixed(1)})`);
});

FFTests.add("generate returns seed + length bytes (one byte per step)", () => {
  const text = "abcabcabcabcabcabcabc";
  const tr = new Trainer({ text, n: 3, K: 4, layerSizes: [16], theta: 16, lr: 0.03, batchSize: 8, valFraction: 0.2, seed: 5, optimizer: "adam" });
  for (let i = 0; i < 100; i++) tr.stepBatch();
  const out = generate(tr, "ab", 10, 0.5, makeRng(2));
  FFTests.assert(out.startsWith("ab"), "starts with seed");
  FFTests.assert([...new TextEncoder().encode(out)].length === 2 + 10, "byte length = seed + lengthBytes");
});

FFTests.add("serializeModel/deserializeModel preserve next-byte predictions; modelCompatible checks n", () => {
  const cfg = { text: "abcabcabcabcabcabcabcabc", n: 3, K: 4, layerSizes: [16, 16], theta: 16, lr: 0.03, batchSize: 8, valFraction: 0.2, seed: 1, optimizer: "adam" };
  const a = new Trainer(cfg);
  for (let i = 0; i < 50; i++) a.stepBatch();
  const obj = serializeModel(a);
  const b = new Trainer(cfg);
  FFTests.assert(modelCompatible(obj, b), "same-config compatible");
  deserializeModel(b, obj);
  const pa = a.predictNextByteProbs("abc"), pb = b.predictNextByteProbs("abc");
  for (let i = 0; i < pa.length; i++) FFTests.approx(pa[i], pb[i], 1e-9, "next-byte prediction preserved");
  const other = new Trainer(Object.assign({}, cfg, { n: 2 }));
  FFTests.assert(!modelCompatible(obj, other), "different n => incompatible (different inDim)");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL — new tests fail (`t.bytes` undefined / `predictNextByteProbs` not a function / `evalBitAccuracy` semantics).

- [ ] **Step 3: Replace the `Trainer` class body**

Replace the entire existing `class Trainer { ... }` with:

```js
class Trainer {
  constructor(cfg) {
    this.n = cfg.n || 1;
    this.K = cfg.K; this.theta = cfg.theta; this.lr = cfg.lr;
    this.batchSize = cfg.batchSize;
    this.optimizer = cfg.optimizer || "muon";
    this.seed = cfg.seed; this.rng = makeRng(cfg.seed);
    this.bitsPerTok = 8 * this.n;
    this.feedbackDim = 8 * (this.n - 1);
    this.inDim = 8 * this.K + this.feedbackDim;
    this.bytes = textToBytes(cfg.text);
    this.split = Math.max(this.K + 1, Math.floor(this.bytes.length * (1 - cfg.valFraction)));
    this.trainBytes = this.bytes.slice(0, this.split);
    this.valStart = this.split;
    this.net = new FFNet({ inDim: this.inDim, layerSizes: cfg.layerSizes, rng: this.rng });
    this.readout = new ARReadout(this.net.readoutDim(), this.bitsPerTok, this.rng);
    this.examplesSeen = 0;
  }
  randomContextBits() {
    const x = new Float64Array(8 * this.K);
    for (let i = 0; i < this.K; i++) {
      const v = this.trainBytes[Math.floor(this.rng() * this.trainBytes.length)];
      for (let b = 0; b < 8; b++) x[i * 8 + b] = (v >> (7 - b)) & 1;
    }
    return x;
  }
  _accumPath(x, isPositive) {
    const goods = [], acts = []; let loss = 0, input = x;
    for (let i = 0; i < this.net.layers.length; i++) {
      const r = this.net.layers[i].accumulate(input, isPositive, this.theta);
      goods.push(r.g); acts.push(r.a); loss += r.loss;
      input = l2normalize(r.a);
    }
    return { goods, acts, loss };
  }
  _features(x) { return this.net.readoutFeatures(this.net.forwardAll(x).acts); }
  stepBatch() {
    const L = this.net.layers.length, n = this.n, K = this.K;
    for (const layer of this.net.layers) layer.zeroGrad();
    this.readout.zeroGrad();
    const gPos = new Array(L).fill(0), gNeg = new Array(L).fill(0);
    let lossPos = 0, lossNeg = 0;
    const lastValid = this.trainBytes.length - n;        // need bytes[p .. p+n-1]
    const span = lastValid - K;
    let start = K;
    if (span > this.batchSize) start = K + Math.floor(this.rng() * (span - this.batchSize));
    const steps = Math.max(1, Math.min(this.batchSize, lastValid - start + 1));
    const predBuffer = [];
    for (let w = 0; w < steps; w++) {
      const p = start + w;
      const revealed = p > 0 ? this.trainBytes[p - 1] : 0;
      const feedback = computeFeedback(predBuffer, tokenToBits([revealed], 1), n);
      const xPos = concatFloat(bytesContextBits(this.trainBytes, p, K), feedback);
      const rp = this._accumPath(xPos, true);
      for (let i = 0; i < L; i++) gPos[i] += rp.goods[i]; lossPos += rp.loss;
      const feats = this.net.readoutFeatures(rp.acts);
      const tok = []; for (let j = 0; j < n; j++) tok.push(this.trainBytes[p + j]);
      this.readout.accumulate(feats, tokenToBits(tok, n));
      const xNeg = concatFloat(this.randomContextBits(), new Float64Array(this.feedbackDim));
      const rn = this._accumPath(xNeg, false);
      for (let i = 0; i < L; i++) gNeg[i] += rn.goods[i]; lossNeg += rn.loss;
      const probs = this.readout.greedyProbs(feats);
      predBuffer.unshift(probs); if (predBuffer.length > n) predBuffer.pop();
    }
    for (const layer of this.net.layers) layer.step(this.lr, this.optimizer);
    this.readout.step(this.lr);
    this.examplesSeen += this.batchSize;
    for (let i = 0; i < L; i++) { gPos[i] /= steps; gNeg[i] /= steps; }
    return { lossPos: lossPos / steps, lossNeg: lossNeg / steps, gPos, gNeg };
  }
  predictNextByteProbs(seedText) {
    const n = this.n, K = this.K;
    const bytes = Array.from(textToBytes(seedText));
    const predBuffer = [];
    const start = Math.max(0, bytes.length - n);
    for (let p = start; p <= bytes.length; p++) {
      const revealed = p > 0 ? bytes[p - 1] : 0;
      const feedback = computeFeedback(predBuffer, tokenToBits([revealed], 1), n);
      const probs = this.readout.greedyProbs(this._features(concatFloat(bytesContextBits(bytes, p, K), feedback)));
      if (p === bytes.length) return probs.slice(0, 8);
      predBuffer.unshift(probs); if (predBuffer.length > n) predBuffer.pop();
    }
    return this.readout.greedyProbs(this._features(new Float64Array(this.inDim))).slice(0, 8);
  }
  evalNextByte(count) {
    const n = this.n, K = this.K;
    const lo = Math.max(K, this.valStart), hi = this.bytes.length - 1;
    if (hi - lo < 1) return { bit: 0, byte: 0 };
    let start = lo; const span = hi - lo;
    if (span > count) start = lo + Math.floor(this.rng() * (span - count));
    const predBuffer = [];
    let cB = 0, tB = 0, cBy = 0, tBy = 0;
    for (let w = 0; w < count && start + w <= hi; w++) {
      const p = start + w;
      const feedback = computeFeedback(predBuffer, tokenToBits([this.bytes[p - 1]], 1), n);
      const probs = this.readout.greedyProbs(this._features(concatFloat(bytesContextBits(this.bytes, p, K), feedback)));
      const trueBits = tokenToBits([this.bytes[p]], 1);
      let all = true;
      for (let b = 0; b < 8; b++) { const bit = probs[b] > 0.5 ? 1 : 0; if (bit === trueBits[b]) cB++; else all = false; tB++; }
      if (all) cBy++; tBy++;
      predBuffer.unshift(probs); if (predBuffer.length > n) predBuffer.pop();
    }
    return { bit: tB ? cB / tB : 0, byte: tBy ? cBy / tBy : 0 };
  }
  evalBitAccuracy(count) { return this.evalNextByte(count).bit; }
  evalTokenAccuracy(count) { return this.evalNextByte(count).byte; }
}
```

- [ ] **Step 4: Replace `generate`**

Replace the entire existing `function generate(...) { ... }` with:

```js
function generate(trainer, seedText, lengthBytes, temp, rng) {
  const n = trainer.n, K = trainer.K;
  const out = Array.from(textToBytes(seedText));
  const predBuffer = [];
  for (let i = 0; i < lengthBytes; i++) {
    const p = out.length;
    const revealed = p > 0 ? out[p - 1] : 0;
    const feedback = computeFeedback(predBuffer, tokenToBits([revealed], 1), n);
    const feats = trainer.net.readoutFeatures(trainer.net.forwardAll(concatFloat(bytesContextBits(out, p, K), feedback)).acts);
    const bits = trainer.readout.sample(feats, temp, rng);
    out.push(bitsToToken(bits.slice(0, 8), 1)[0]);
    const probs = trainer.readout.greedyProbs(feats);
    predBuffer.unshift(probs); if (predBuffer.length > n) predBuffer.pop();
  }
  return bytesToText(Uint8Array.from(out));
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all pass. If the next-byte bit-accuracy test does not pass, do NOT weaken it — increase the step count (the readout direction is correct on the deterministic pattern). `serializeModel`/`deserializeModel`/`modelCompatible` are unchanged (they store layer W/b sized by the new `inDim`, plus the readout `V/U/c`).

- [ ] **Step 6: Confirm the old token-window API is gone from the engine**

Run: `grep -n "realContextAt\|\.tokens\b\|trainTokens\|valTokens\|sampleToken\|predictBits" forward-forward/index.html`
Expected: no matches inside the `<script id="shared-code">` block (matches may remain in the UI `<script>` — fixed in Task 3).

- [ ] **Step 7: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: sliding feedback Trainer + one-byte generation"
```

---

### Task 3: UI — next-byte panel, generation, labels

**Files:**
- Modify: `forward-forward/index.html` (the second UI `<script>`; the stats markup label)

**Interfaces:**
- Consumes (globals): `Trainer`, `generate`, `serializeModel`, `deserializeModel`, `modelCompatible`, `makeRng`, `Trainer.predictNextByteProbs`.
- Produces: a working page using the feedback Trainer — next-byte probability panel, byte-length generation, next-byte accuracy stats.

- [ ] **Step 1: Update the accuracy stat label**

Change the stats row:

```html
      <div class="stat"><span>Bit acc / token acc</span><span id="acc">–</span></div>
```

to:

```html
      <div class="stat"><span>Next-byte bit / exact acc</span><span id="acc">–</span></div>
```

- [ ] **Step 2: Replace `refreshDistribution` with the next-byte panel**

Replace the whole `refreshDistribution` function with:

```js
function refreshDistribution() {
  if (!Ctrl.trainer) return;
  const t = Ctrl.trainer;
  const p = t.predictNextByteProbs(S.prompt.value);
  S.dist.innerHTML = "";
  for (let i = 0; i < p.length; i++) {
    const bar = document.createElement("div"); bar.className = "bar";
    bar.style.height = (p[i] * 100) + "%";
    bar.title = "next-byte bit " + i + " p=" + p[i].toFixed(2);
    S.dist.appendChild(bar);
  }
}
```

- [ ] **Step 3: Update the Generate handler to byte length**

Replace the `S.generate.onclick` handler with:

```js
S.generate.onclick = () => {
  if (!Ctrl.trainer) return;
  const t = Ctrl.trainer;
  const out = generate(t, S.prompt.value, parseInt(S.genlen.value, 10), parseInt(S.temp.value, 10) / 100, makeRng((Date.now() & 0xffff) | 1));
  S.genOut.textContent = out;
  refreshDistribution();
};
```

- [ ] **Step 4: Update the live-sample line in `Ctrl.updateStats`**

Replace the live-sample generation line (inside the `% 30 === 0` block) with:

```js
        S.liveSample.textContent = generate(t, S.prompt.value || "the", 60, 0.7, makeRng(this.stepCount + 1));
```

- [ ] **Step 5: Verify engine intact + page works**

Run: `cd forward-forward && node test.mjs`
Expected: same pass count as after Task 2 (engine untouched by this UI task).

Confirm no UI references to removed Trainer API remain:
`grep -n "predictBits\|sampleToken\|tokenizeBytes\|\.tokens\b\|evalAccuracy" forward-forward/index.html` → expect no matches (the engine still defines `tokenizeBytes` as a utility, but the UI must not call the removed `predictBits`/`sampleToken`). If `tokenizeBytes(` appears in the UI script, it is leftover — remove it per Step 2.

Headless render:
```bash
cd /Users/neoneye/git/vibe-coding-lab/forward-forward && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1180,1000 --virtual-time-budget=4000 --screenshot="/tmp/ff-fb.png" "file://$PWD/index.html" 2>&1 | head -8 ; ls -la /tmp/ff-fb.png
```
Expected: non-empty PNG; the page renders (Token-unit + Optimizer dropdowns, stats labeled "Next-byte bit / exact acc"). (If no headless browser, report DONE_WITH_CONCERNS and rely on grep + `node test.mjs`.)

- [ ] **Step 6: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: UI for next-byte feedback model"
```

---

### Task 4: Verify + screenshot

**Files:**
- Modify: `forward-forward/screenshot1.png`
- Modify (only if needed): `forward-forward/index.html`

**Interfaces:** none.

- [ ] **Step 1: Full test run**

Run: `cd forward-forward && node test.mjs`
Expected: all pass, exit 0. Record the count.

- [ ] **Step 2: Diagnostic — feedback model, next-byte accuracy (Node)**

Create `/tmp/ff-fb-diag.mjs`:

```js
import { readFileSync } from "node:fs";
const html = readFileSync("index.html","utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
const { Trainer, BUILTIN_CORPORA, generate, makeRng } = new Function(`${m[1]}; return { Trainer, BUILTIN_CORPORA, generate, makeRng };`)();
for (const n of [1, 3]) {
  const tr = new Trainer({ text: BUILTIN_CORPORA[0].text, n, K: 16, layerSizes:[128,128,128], theta:128, lr:0.02, batchSize:32, valFraction:0.1, seed:1234, optimizer:"adam" });
  for (let i=0;i<2500;i++) tr.stepBatch();
  console.log(`n=${n}: next-byte bit=${(tr.evalBitAccuracy(60)*100).toFixed(1)}% exact=${(tr.evalTokenAccuracy(60)*100).toFixed(1)}%  inDim=${tr.inDim}  sample=${JSON.stringify(generate(tr,"To be",40,0.5,makeRng(7)))}`);
}
```

Run: `cd forward-forward && node /tmp/ff-fb-diag.mjs`
Expected: next-byte bit-accuracy is above ~50% for both; `inDim` for n=3 is `8·16 + 16 = 144`; the n=3 sample contains real characters/words (varied, not single-byte repetition). Record the numbers + samples. If next-byte bit-accuracy is ~50% (no learning), STOP and report.

- [ ] **Step 3: Regenerate the screenshot (Bytes default, real trained run)**

Use the synchronous-driver technique (rAF does not advance under headless virtual time); drive REAL training; delete the temp file after. (The driver's `evalBitAccuracy`/`evalTokenAccuracy` are now next-byte; the stat string and panel come from the live code.)

```bash
cd /Users/neoneye/git/vibe-coding-lab/forward-forward
node -e '
const fs=require("fs"); let html=fs.readFileSync("index.html","utf8");
const driver=`<script>
window.addEventListener("load",()=>{
  try{
    Ctrl.build(); const t=Ctrl.trainer; const STEPS=800; let last;
    for(let s=0;s<STEPS;s++){ last=t.stepBatch(); Ctrl.stepCount=(Ctrl.stepCount||0)+1;
      if(Ctrl.stepCount%20===0){ const acc=t.evalBitAccuracy(15);
        const gp=last.gPos.reduce((a,b)=>a+b,0)/last.gPos.length;
        const gn=last.gNeg.reduce((a,b)=>a+b,0)/last.gNeg.length;
        Ctrl.history.push({acc,gp,gn}); } }
    const bit=t.evalBitAccuracy(40), tok=t.evalTokenAccuracy(40);
    document.getElementById("examples").textContent=t.examplesSeen.toLocaleString();
    document.getElementById("acc").textContent=(bit*100).toFixed(1)+"% / "+(tok*100).toFixed(1)+"%";
    const h=Ctrl.history[Ctrl.history.length-1];
    document.getElementById("good").textContent=h.gp.toFixed(1)+" / "+h.gn.toFixed(1);
    document.getElementById("status").textContent="paused";
    document.getElementById("sps").textContent="—";
    document.getElementById("prompt").value="the ";
    drawChart(); refreshDistribution();
    document.getElementById("liveSample").textContent=generate(t,"the ",60,0.6,makeRng(7));
    document.getElementById("genOut").textContent=generate(t,"the ",90,0.6,makeRng(11));
    document.title="FFOK bit="+(bit*100).toFixed(1);
  }catch(e){document.getElementById("status").textContent="ERR:"+e.message;document.title="FFERR "+e.message;}
});
</script>
</body>`;
html=html.replace("</body>",driver); fs.writeFileSync("_shot.html",html); console.log("wrote _shot.html");
'
timeout 300 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1180,1060 --virtual-time-budget=200000 --screenshot="$PWD/screenshot1.png" "file://$PWD/_shot.html" 2>/dev/null
echo "exit=$?"; rm -f _shot.html; ls -la screenshot1.png
```

- [ ] **Step 4: Inspect the screenshot**

Open/Read `forward-forward/screenshot1.png`. Confirm a real trained byte-mode run: Token unit "Bytes (8-bit)", Optimizer Muon, "Next-byte bit / exact acc" with real numbers, per-bit bar panel (8 bars), chart curves. Confirm `_shot.html` is gone and `git status` shows only `screenshot1.png`. If empty/0%, raise STEPS and recapture; if genuinely unable, fall back to idle and note it — do NOT fabricate.

- [ ] **Step 5: Commit**

```bash
git add forward-forward/screenshot1.png
git commit -m "forward-forward: screenshot for next-byte feedback model"
```

---

## Self-Review

**Spec coverage:**
- Sliding next-byte predictor with n-byte lookahead; commit one byte/step → Task 2 (Trainer/generate) ✓
- Context = K bytes; feedback = 8(n−1) float discrepancies `prob − true_bit`; inDim = 8K+8(n−1) → Tasks 1, 2 ✓
- Feedback indexing (prior forecasts of the just-revealed byte, byte-slot k) + rolling buffer + zeros at start → Tasks 1 (computeFeedback) + 2 (predBuffer threading) ✓
- Sequential contiguous-window training; FF negatives zero-feedback; readout teacher-forced → Task 2 (stepBatch) ✓
- Generation one byte/step with feedback loop → Task 2 (generate) ✓
- Metrics next-byte (bit + exact); per-bit panel = next byte; byte-length generation → Tasks 2 (eval) + 3 (UI) ✓
- Persistence unchanged (inDim/widths pin shape) → no task needed; serialize test updated in Task 2 ✓
- Tests: computeFeedback float discrepancy + zeros, context bits, inDim/feedback width, feedback-reaches-network, next-byte accuracy rises, goodness separates, generate byte length, serialize round-trip; existing FF/optimizer/NADE green → Tasks 1, 2 ✓
- Diagnostic + screenshot → Task 4 ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. Screenshot STEPS=800 with a diagnostic gate (Task 4 Step 2).

**Type consistency:** `Trainer` fields (`n,K,inDim,feedbackDim,bytes,trainBytes,split,valStart,net,readout`), `stepBatch`, `predictNextByteProbs(seedText)→Float64Array(8)`, `evalNextByte/evalBitAccuracy/evalTokenAccuracy`, `randomContextBits`, `_features`, `generate(trainer, seedText, lengthBytes, temp, rng)`, helpers `concatFloat/bytesContextBits/computeFeedback` are used consistently. `predBuffer[k]` indexing matches `computeFeedback` (slot k, k=1…n−1). The UI consumes `predictNextByteProbs` (8 probs) and byte-length `generate`. `serializeModel`/`modelCompatible`/`deserializeModel` are unchanged and shape-pinned by `inDim` + widths + readout `V/U/c`.
