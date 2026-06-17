# Binary n-gram Tokens + FF Bit-Readout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-hot character model with a dense binary representation so the Forward-Forward net trains on bytes/bigrams/trigrams (n∈{1,2,3}), emitting the next token's 8n bits via a shallow readout head on FF-trained features.

**Architecture:** Tokenize the corpus into non-overlapping n-byte tokens, each 8n bits. FF hidden layers are trained by goodness on real-vs-random-position contexts (selected optimizer governs them). A linear 8n-sigmoid `Readout` head maps the concatenated L2-normalized hidden activations to the next token's bits (BCE, Adam, no backprop through the stack). Prediction/generation is one forward pass per token.

**Tech Stack:** Vanilla JavaScript, `Float64Array`, `TextEncoder`/`TextDecoder` (standard in Node and browsers); Node only for `test.mjs`. No external libraries.

## Global Constraints

- Single self-contained `forward-forward/index.html`; works from `file://`; no external libs; no GPU/WebGL.
- All engine logic in `<script id="shared-code">`, evals cleanly under Node (no `document`/`window` at module scope; `TextEncoder`/`TextDecoder` are allowed — they are not DOM APIs). Export guard exports every engine symbol plus `FFTests`. UI code only in the second `<script>`.
- Determinism: randomness only via seeded `makeRng` (mulberry32); never `Math.random()` in engine code. Numeric arrays use `Float64Array`.
- Token unit `n ∈ {1,2,3}`; token = `n` UTF-8 bytes; `8n` bits MSB-first (`bit b of byte v = (v >> (7-b)) & 1`), values `0/1`. Non-overlapping split; trailing `len % n` bytes dropped.
- FF input = previous `K` tokens as bits = `K·8n` bits (no candidate in the input). Positive = real contiguous window; negative = `K` tokens from random positions.
- Readout: `8n` sigmoid neurons; input = concat of L2-normalized hidden-layer activations (dim = Σ layer widths); BCE loss; Adam; bit = `p > 0.5`; shallow local head (no backprop into FF layers).
- Optimizer selector (Muon/Adam/SGD) governs the FF hidden layers only; the readout always uses Adam.
- The one-hot path is removed entirely (no vocabulary mode retained).
- Commit after every task with message prefix `forward-forward:`. Run `node test.mjs` from inside `forward-forward/`.
- The page UI is fully functional again from Task 6 onward; intermediate engine tasks (1–5) are validated by `node test.mjs` (the UI script is not Node-tested).

---

### Task 1: Byte/bit tokenizer

**Files:**
- Modify: `forward-forward/index.html` (shared-code: add tokenizer functions before the export guard; add tests; extend exports)

**Interfaces:**
- Produces:
  - `textToBytes(text) → Uint8Array` (UTF-8).
  - `bytesToText(bytes) → string` (tolerant UTF-8 decode; accepts `Uint8Array` or number array).
  - `tokenizeBytes(bytes, n) → number[][]` — non-overlapping `n`-byte tokens; trailing remainder dropped.
  - `tokenToBits(token, n) → Float64Array` (length `8n`, MSB-first, 0/1).
  - `bitsToToken(bits, n) → number[]` — `8n` bits (threshold 0.5) → `n` byte values.
  - `encodeContextBits(contextTokens, K, n) → Float64Array` — concat of the last `K` token bit-vectors, left-padded with zero tokens; length `K·8n`.

- [ ] **Step 1: Write the failing tests** (add inside shared-code, in the `FFTests` section)

```js
FFTests.add("tokenToBits/bitsToToken round-trip for n=1,2,3", () => {
  const rng = makeRng(1);
  for (const n of [1, 2, 3]) {
    const token = []; for (let j = 0; j < n; j++) token.push(Math.floor(rng() * 256));
    const bits = tokenToBits(token, n);
    FFTests.assert(bits.length === 8 * n, "bit length 8n for n=" + n);
    FFTests.assert(bitsToToken(bits, n).join(",") === token.join(","), "round-trip n=" + n);
  }
  // MSB-first check: byte 0x80 = 1000 0000
  FFTests.assert(tokenToBits([0x80], 1).join("") === "10000000", "MSB-first");
});

FFTests.add("tokenizeBytes splits non-overlapping and drops remainder", () => {
  const toks = tokenizeBytes(Uint8Array.from([1,2,3,4,5,6,7]), 2);
  FFTests.assert(toks.length === 3, "7 bytes / 2 => 3 tokens (remainder dropped)");
  FFTests.assert(toks[2].join(",") === "5,6", "third token is [5,6]");
});

FFTests.add("textToBytes/bytesToText round-trip ASCII and multibyte", () => {
  FFTests.assert(bytesToText(textToBytes("hi")) === "hi", "ascii round-trip");
  const e = textToBytes("é"); // é = 0xC3 0xA9
  FFTests.assert(e.length === 2 && e[0] === 0xC3 && e[1] === 0xA9, "utf-8 two bytes");
  FFTests.assert(bytesToText(e) === "é", "multibyte round-trip");
});

FFTests.add("encodeContextBits length and left-pad", () => {
  const x = encodeContextBits([[0x80]], 3, 1); // 1 token, K=3, n=1 => length 24
  FFTests.assert(x.length === 3 * 8, "length K*8n");
  let firstZero = true; for (let i = 0; i < 16; i++) if (x[i] !== 0) firstZero = false;
  FFTests.assert(firstZero, "left-padded slots are zero");
  FFTests.assert(x[16] === 1, "last slot holds the token's MSB");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL `tokenToBits is not defined`.

- [ ] **Step 3: Implement the tokenizer** (add inside shared-code, before the test additions / export guard)

```js
function textToBytes(text) { return new TextEncoder().encode(text); }
function bytesToText(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  return new TextDecoder("utf-8", { fatal: false }).decode(u);
}
function tokenizeBytes(bytes, n) {
  const tokens = [], count = Math.floor(bytes.length / n);
  for (let t = 0; t < count; t++) {
    const tok = [];
    for (let j = 0; j < n; j++) tok.push(bytes[t * n + j]);
    tokens.push(tok);
  }
  return tokens;
}
function tokenToBits(token, n) {
  const bits = new Float64Array(8 * n);
  for (let j = 0; j < n; j++) {
    const v = token[j] | 0;
    for (let b = 0; b < 8; b++) bits[j * 8 + b] = (v >> (7 - b)) & 1;
  }
  return bits;
}
function bitsToToken(bits, n) {
  const token = [];
  for (let j = 0; j < n; j++) {
    let v = 0;
    for (let b = 0; b < 8; b++) if (bits[j * 8 + b] > 0.5) v |= (1 << (7 - b));
    token.push(v);
  }
  return token;
}
function encodeContextBits(contextTokens, K, n) {
  const bpt = 8 * n;
  const toks = contextTokens.length > K ? contextTokens.slice(contextTokens.length - K) : contextTokens;
  const x = new Float64Array(K * bpt);
  const start = K - toks.length;
  for (let t = 0; t < toks.length; t++) {
    const bits = tokenToBits(toks[t], n);
    const off = (start + t) * bpt;
    for (let i = 0; i < bpt; i++) x[off + i] = bits[i];
  }
  return x;
}
```

- [ ] **Step 4: Extend exports** — add `textToBytes, bytesToText, tokenizeBytes, tokenToBits, bitsToToken, encodeContextBits` to `module.exports`.

- [ ] **Step 5: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all pass (4 new tests; existing suite still green).

- [ ] **Step 6: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: byte/bit n-gram tokenizer"
```

---

### Task 2: Readout head

**Files:**
- Modify: `forward-forward/index.html` (shared-code: add `Readout` class; add test; extend exports)

**Interfaces:**
- Produces: `class Readout` — `new Readout(featDim, outDim, rng)`; `predict(features) → Float64Array` (sigmoid probs length `outDim`); `accumulate(features, targetBits)`; `step(lr)`; `zeroGrad()`. BCE+sigmoid gradient: `dlogit_i = p_i − target_i`.

- [ ] **Step 1: Write the failing test**

```js
FFTests.add("Readout overfits a fixed feature->bits mapping", () => {
  const rng = makeRng(4), featDim = 10, outDim = 8;
  const feats = new Float64Array(featDim); for (let i = 0; i < featDim; i++) feats[i] = rng() * 2 - 1;
  const target = Float64Array.from([1,0,1,1,0,0,1,0]);
  const ro = new Readout(featDim, outDim, rng);
  for (let i = 0; i < 300; i++) { ro.zeroGrad(); ro.accumulate(feats, target); ro.step(0.1); }
  const p = ro.predict(feats);
  let ok = true; for (let i = 0; i < outDim; i++) if ((p[i] > 0.5 ? 1 : 0) !== target[i]) ok = false;
  FFTests.assert(ok, "readout should reproduce the target bits, p=" + Array.from(p).map(x=>x.toFixed(2)).join(","));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL `Readout is not defined`.

- [ ] **Step 3: Implement `Readout`**

```js
class Readout {
  constructor(featDim, outDim, rng) {
    this.featDim = featDim; this.outDim = outDim;
    this.Wr = new Float64Array(outDim * featDim);
    this.br = new Float64Array(outDim);
    const scale = Math.sqrt(1 / featDim);
    for (let i = 0; i < this.Wr.length; i++) this.Wr[i] = (rng() * 2 - 1) * scale;
    this.mW = new Float64Array(this.Wr.length); this.vW = new Float64Array(this.Wr.length);
    this.mb = new Float64Array(outDim); this.vb = new Float64Array(outDim);
    this.t = 0;
    this.dW = new Float64Array(this.Wr.length); this.db = new Float64Array(outDim);
    this.count = 0;
  }
  predict(features) {
    const { featDim, outDim, Wr, br } = this;
    const p = new Float64Array(outDim);
    for (let i = 0; i < outDim; i++) {
      let z = br[i]; const base = i * featDim;
      for (let j = 0; j < featDim; j++) z += Wr[base + j] * features[j];
      p[i] = 1 / (1 + Math.exp(-z));
    }
    return p;
  }
  zeroGrad() { this.dW.fill(0); this.db.fill(0); this.count = 0; }
  accumulate(features, targetBits) {
    const p = this.predict(features);
    const { featDim, dW, db } = this;
    for (let i = 0; i < this.outDim; i++) {
      const g = p[i] - targetBits[i]; // dL/dlogit for sigmoid + BCE
      db[i] += g; const base = i * featDim;
      for (let j = 0; j < featDim; j++) dW[base + j] += g * features[j];
    }
    this.count++;
  }
  step(lr) {
    if (this.count === 0) return;
    const b1 = 0.9, b2 = 0.999, eps = 1e-8, n = this.count;
    this.t++;
    const bc1 = 1 - Math.pow(b1, this.t), bc2 = 1 - Math.pow(b2, this.t);
    for (let i = 0; i < this.Wr.length; i++) {
      const g = this.dW[i] / n;
      this.mW[i] = b1 * this.mW[i] + (1 - b1) * g; this.vW[i] = b2 * this.vW[i] + (1 - b2) * g * g;
      this.Wr[i] -= lr * (this.mW[i] / bc1) / (Math.sqrt(this.vW[i] / bc2) + eps);
    }
    for (let i = 0; i < this.outDim; i++) {
      const g = this.db[i] / n;
      this.mb[i] = b1 * this.mb[i] + (1 - b1) * g; this.vb[i] = b2 * this.vb[i] + (1 - b2) * g * g;
      this.br[i] -= lr * (this.mb[i] / bc1) / (Math.sqrt(this.vb[i] / bc2) + eps);
    }
    this.zeroGrad();
  }
}
```

- [ ] **Step 4: Extend exports** — add `Readout`.

- [ ] **Step 5: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all pass (1 new test).

- [ ] **Step 6: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: sigmoid bit-readout head"
```

---

### Task 3: FFNet readout features

**Files:**
- Modify: `forward-forward/index.html` (shared-code: add two methods to `FFNet`; add test)

**Interfaces:**
- Consumes: `l2normalize`, `FFNet.forwardAll`.
- Produces:
  - `FFNet.readoutDim() → number` — sum of layer widths (`Σ layer.outDim`).
  - `FFNet.readoutFeatures(acts) → Float64Array` — concatenation of `l2normalize(a)` for each layer activation array `a` in `acts` (length = `readoutDim()`).

- [ ] **Step 1: Write the failing test**

```js
FFTests.add("FFNet.readoutFeatures concatenates normalized layer activations", () => {
  const net = new FFNet({ inDim: 12, layerSizes: [8, 6], rng: makeRng(2) });
  const x = new Float64Array(12); for (let i = 0; i < 12; i++) x[i] = (i % 3) ? 1 : 0;
  const { acts } = net.forwardAll(x);
  const feats = net.readoutFeatures(acts);
  FFTests.assert(net.readoutDim() === 14, "readoutDim = 8 + 6");
  FFTests.assert(feats.length === 14, "features length = readoutDim");
  // first 8 entries form a unit vector (or zero if the layer was all-zero)
  let norm0 = 0; for (let i = 0; i < 8; i++) norm0 += feats[i] * feats[i];
  FFTests.assert(Math.abs(Math.sqrt(norm0) - 1) < 1e-6 || norm0 === 0, "layer-0 slice is unit-norm");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL `net.readoutDim is not a function`.

- [ ] **Step 3: Implement** — add these two methods inside the `FFNet` class (e.g. after `forwardAll`):

```js
  readoutDim() { let s = 0; for (const l of this.layers) s += l.outDim; return s; }
  readoutFeatures(acts) {
    const out = new Float64Array(this.readoutDim());
    let off = 0;
    for (const a of acts) { const u = l2normalize(a); out.set(u, off); off += u.length; }
    return out;
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all pass (1 new test).

- [ ] **Step 5: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: FFNet readout features"
```

---

### Task 4: Binary Trainer + generation (engine switch)

**Files:**
- Modify: `forward-forward/index.html` (shared-code: rewrite the `Trainer` class body and the `generate` function; add `sampleBit`; replace the Trainer/generate tests). The one-hot helper functions remain defined (dead) until Task 5 — do NOT remove them here.

**Interfaces:**
- Consumes: `textToBytes`, `bytesToText`, `tokenizeBytes`, `tokenToBits`, `bitsToToken`, `encodeContextBits`, `FFNet` (`forwardAll`, `readoutDim`, `readoutFeatures`), `FFLayer`, `Readout`, `l2normalize`, `makeRng`.
- Produces:
  - `Trainer` rewritten: `new Trainer(cfg)` with `cfg = {text, n, K, theta, lr, batchSize, valFraction, seed, optimizer?, layerSizes}`. Fields: `n`, `bitsPerTok` (`8n`), `inDim` (`K·8n`), `K`, `theta`, `lr`, `optimizer` (default `"muon"`), `net`, `readout`, `trainTokens`, `valTokens`, `examplesSeen`.
    - `stepBatch() → {lossPos, lossNeg, gPos:number[], gNeg:number[]}` — trains hidden layers (positive real window / negative random-position context) and the readout (real-context features → next-token bits).
    - `predictBits(context) → Float64Array` — `8n` probabilities for the next token given a token array `context`.
    - `evalBitAccuracy(count) → number`, `evalTokenAccuracy(count) → number`.
  - `generate(trainer, seedText, lengthTokens, temp, rng) → string`.
  - `sampleBit(p, temp, rng) → 0|1`.

- [ ] **Step 1: Replace the Trainer/generate tests with binary versions**

Delete these existing tests (they exercise the old one-hot Trainer/generate):
- `"Trainer overfits a trivial repeating pattern above chance"`
- `"generate returns a string of the requested length"`
- `"Trainer defaults to Muon and learns on a repeating pattern"`

Add in their place:

```js
FFTests.add("binary Trainer readout learns a repeating byte pattern", () => {
  const text = "abcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc";
  const tr = new Trainer({ text, n: 1, K: 3, layerSizes: [32, 32], theta: 32, lr: 0.03,
    batchSize: 16, valFraction: 0.25, seed: 11, optimizer: "adam" });
  FFTests.assert(tr.n === 1 && tr.bitsPerTok === 8, "byte mode bitsPerTok=8");
  const before = tr.evalBitAccuracy(20);
  for (let i = 0; i < 500; i++) tr.stepBatch();
  const after = tr.evalBitAccuracy(20);
  FFTests.assert(tr.examplesSeen === 500 * 16, "examplesSeen tracked");
  FFTests.assert(after > 0.85 || after > before + 0.2,
    `bit accuracy should rise (before=${before.toFixed(2)} after=${after.toFixed(2)})`);
});

FFTests.add("binary Trainer defaults to Muon and trains", () => {
  const text = "abcabcabcabcabcabcabcabcabcabc";
  const tr = new Trainer({ text, n: 1, K: 3, layerSizes: [24, 24], theta: 24, lr: 0.03,
    batchSize: 16, valFraction: 0.25, seed: 7 });
  FFTests.assert(tr.optimizer === "muon", "default optimizer muon");
  const before = tr.evalBitAccuracy(15);
  for (let i = 0; i < 400; i++) tr.stepBatch();
  const after = tr.evalBitAccuracy(15);
  FFTests.assert(after > 0.6 || after > before + 0.1,
    `muon should train the readout (before=${before.toFixed(2)} after=${after.toFixed(2)})`);
});

FFTests.add("generate returns seed prefix and grows by tokens*n bytes", () => {
  const text = "abcabcabcabcabcabc";
  const tr = new Trainer({ text, n: 1, K: 3, layerSizes: [16], theta: 16, lr: 0.03,
    batchSize: 8, valFraction: 0.2, seed: 5, optimizer: "adam" });
  for (let i = 0; i < 100; i++) tr.stepBatch();
  const out = generate(tr, "ab", 10, 0.5, makeRng(2));
  FFTests.assert(out.startsWith("ab"), "starts with seed");
  FFTests.assert([...new TextEncoder().encode(out)].length === 2 + 10, "byte length = seed + tokens*n");
});

FFTests.add("FF goodness separates real from random-position contexts", () => {
  const text = "the quick brown fox jumps over the lazy dog the quick brown fox";
  const tr = new Trainer({ text, n: 1, K: 4, layerSizes: [32, 32], theta: 32, lr: 0.03,
    batchSize: 16, valFraction: 0.2, seed: 3, optimizer: "adam" });
  let last; for (let i = 0; i < 400; i++) last = tr.stepBatch();
  const gp = last.gPos.reduce((a,b)=>a+b,0), gn = last.gNeg.reduce((a,b)=>a+b,0);
  FFTests.assert(gp > gn, `positive goodness should exceed negative (gp=${gp.toFixed(1)} gn=${gn.toFixed(1)})`);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL — the new tests fail (old `Trainer` signature/`generate` mismatch; `evalBitAccuracy` not defined).

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
    this.inDim = this.K * this.bitsPerTok;
    const bytes = textToBytes(cfg.text);
    this.tokens = tokenizeBytes(bytes, this.n);
    const split = Math.max(this.K + 1, Math.floor(this.tokens.length * (1 - cfg.valFraction)));
    this.trainTokens = this.tokens.slice(0, split);
    this.valTokens = this.tokens.slice(Math.max(0, split - this.K));
    this.net = new FFNet({ inDim: this.inDim, layerSizes: cfg.layerSizes, rng: this.rng });
    this.readout = new Readout(this.net.readoutDim(), this.bitsPerTok, this.rng);
    this.examplesSeen = 0;
  }
  realContextAt(stream, pos) { return { context: stream.slice(pos - this.K, pos), target: stream[pos] }; }
  randomContext(stream) {
    const ctx = [];
    for (let i = 0; i < this.K; i++) ctx.push(stream[Math.floor(this.rng() * stream.length)]);
    return ctx;
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
  stepBatch() {
    const L = this.net.layers.length;
    for (const layer of this.net.layers) layer.zeroGrad();
    this.readout.zeroGrad();
    const gPos = new Array(L).fill(0), gNeg = new Array(L).fill(0);
    let lossPos = 0, lossNeg = 0;
    for (let s = 0; s < this.batchSize; s++) {
      const pos = this.K + Math.floor(this.rng() * (this.trainTokens.length - this.K));
      const { context, target } = this.realContextAt(this.trainTokens, pos);
      const xPos = encodeContextBits(context, this.K, this.n);
      const rp = this._accumPath(xPos, true);
      for (let i = 0; i < L; i++) gPos[i] += rp.goods[i]; lossPos += rp.loss;
      const feats = this.net.readoutFeatures(rp.acts);
      this.readout.accumulate(feats, tokenToBits(target, this.n));
      const negCtx = this.randomContext(this.trainTokens);
      const xNeg = encodeContextBits(negCtx, this.K, this.n);
      const rn = this._accumPath(xNeg, false);
      for (let i = 0; i < L; i++) gNeg[i] += rn.goods[i]; lossNeg += rn.loss;
    }
    for (const layer of this.net.layers) layer.step(this.lr, this.optimizer);
    this.readout.step(this.lr);
    this.examplesSeen += this.batchSize;
    for (let i = 0; i < L; i++) { gPos[i] /= this.batchSize; gNeg[i] /= this.batchSize; }
    return { lossPos: lossPos / this.batchSize, lossNeg: lossNeg / this.batchSize, gPos, gNeg };
  }
  predictBits(context) {
    const x = encodeContextBits(context, this.K, this.n);
    const { acts } = this.net.forwardAll(x);
    return this.readout.predict(this.net.readoutFeatures(acts));
  }
  evalBitAccuracy(count) {
    if (this.valTokens.length <= this.K + 1) return 0;
    let correct = 0, total = 0;
    for (let s = 0; s < count; s++) {
      const pos = this.K + Math.floor(this.rng() * (this.valTokens.length - this.K));
      const { context, target } = this.realContextAt(this.valTokens, pos);
      const p = this.predictBits(context), tb = tokenToBits(target, this.n);
      for (let i = 0; i < p.length; i++) { if ((p[i] > 0.5 ? 1 : 0) === tb[i]) correct++; total++; }
    }
    return total ? correct / total : 0;
  }
  evalTokenAccuracy(count) {
    if (this.valTokens.length <= this.K + 1) return 0;
    let correct = 0, total = 0;
    for (let s = 0; s < count; s++) {
      const pos = this.K + Math.floor(this.rng() * (this.valTokens.length - this.K));
      const { context, target } = this.realContextAt(this.valTokens, pos);
      const p = this.predictBits(context), tb = tokenToBits(target, this.n);
      let all = true; for (let i = 0; i < p.length; i++) if ((p[i] > 0.5 ? 1 : 0) !== tb[i]) { all = false; break; }
      if (all) correct++; total++;
    }
    return total ? correct / total : 0;
  }
}
```

- [ ] **Step 4: Replace `generate` and add `sampleBit`**

Replace the entire existing `function generate(...) { ... }` with:

```js
function sampleBit(p, temp, rng) {
  const pc = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  const logit = Math.log(pc / (1 - pc));
  const p2 = 1 / (1 + Math.exp(-logit / temp));
  return rng() < p2 ? 1 : 0;
}
function generate(trainer, seedText, lengthTokens, temp, rng) {
  const n = trainer.n, K = trainer.K;
  const seedBytes = Array.from(textToBytes(seedText));
  const ctx = tokenizeBytes(seedBytes, n);
  const outBytes = seedBytes.slice();
  for (let i = 0; i < lengthTokens; i++) {
    const p = trainer.predictBits(ctx.slice(-K));
    const bits = new Float64Array(p.length);
    for (let b = 0; b < p.length; b++) bits[b] = temp <= 0 ? (p[b] > 0.5 ? 1 : 0) : sampleBit(p[b], temp, rng);
    const tok = bitsToToken(bits, n);
    ctx.push(tok);
    for (const byte of tok) outBytes.push(byte);
  }
  return bytesToText(Uint8Array.from(outBytes));
}
```

- [ ] **Step 5: Update exports** — add `sampleBit` to `module.exports` (`Trainer` and `generate` are already exported). Leave the one-hot helpers in the export list for now (removed in Task 5).

- [ ] **Step 6: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all pass. If `binary Trainer readout learns...` does not reach the bit-accuracy bar, do NOT weaken the assertion — increase the step count (the readout direction is correct; more steps must raise it). The dead one-hot tests (buildVocab/encode/predictDistribution/etc.) still pass because those functions remain defined.

- [ ] **Step 7: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: binary Trainer + bit-readout generation"
```

---

### Task 5: Model serialization + remove the one-hot path

**Files:**
- Modify: `forward-forward/index.html` (shared-code: add model serialization; remove dead one-hot functions, `FFNet.predictDistribution/sample/totalGoodness`, and their tests; update exports)

**Interfaces:**
- Consumes: `Trainer` (`net`, `readout`, `n`, `inDim`).
- Produces:
  - `serializeModel(trainer) → object` — `{n, inDim, layerSizes, layers:[{W,b}], readout:{Wr,br}}`.
  - `modelCompatible(obj, trainer) → boolean` — true iff `obj.n`, `obj.inDim`, and per-layer widths match `trainer`.
  - `deserializeModel(trainer, obj)` — overwrites `trainer.net` layer weights and `trainer.readout` from `obj` (caller checks `modelCompatible` first).
- Removes: `buildVocab`, `charToIndex`, `inputDim`, `encode`, `padContextIndices`, `softmax`, `FFNet.predictDistribution`, `FFNet.sample`, `FFNet.totalGoodness`, `serializeNet`, `deserializeNet`, `weightsCompatible` (and their tests).

- [ ] **Step 1: Replace the serialization test and remove now-obsolete one-hot tests**

Delete these tests:
- `"buildVocab caps size and reserves UNK at 0"`
- `"encode produces one-hots of correct dimension"`
- `"padContextIndices fixes length"`
- `"FFNet.predictDistribution returns a valid distribution over vocab"`
- `"softmax sums to 1 and is non-negative"`
- `"serialize/deserialize preserves predictions"`
- `"weightsCompatible accepts matching, rejects mismatched K/vocab"`

Add the new serialization test:

```js
FFTests.add("serializeModel/deserializeModel preserve readout predictions; modelCompatible checks n", () => {
  const text = "abcabcabcabcabcabcabcabc";
  const cfg = { text, n: 1, K: 3, layerSizes: [16, 16], theta: 16, lr: 0.03, batchSize: 8, valFraction: 0.2, seed: 1, optimizer: "adam" };
  const a = new Trainer(cfg);
  for (let i = 0; i < 50; i++) a.stepBatch();
  const obj = serializeModel(a);
  const b = new Trainer(cfg); // fresh, same shape
  FFTests.assert(modelCompatible(obj, b), "same-config model is compatible");
  deserializeModel(b, obj);
  const ctx = a.trainTokens.slice(3, 6);
  const pa = a.predictBits(ctx), pb = b.predictBits(ctx);
  for (let i = 0; i < pa.length; i++) FFTests.approx(pa[i], pb[i], 1e-9, "readout prediction preserved");
  const other = new Trainer(Object.assign({}, cfg, { n: 2 }));
  FFTests.assert(!modelCompatible(obj, other), "different n must be incompatible");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL `serializeModel is not defined`.

- [ ] **Step 3: Add the model serialization functions** (place where `serializeNet` was)

```js
function serializeModel(trainer) {
  return {
    n: trainer.n, inDim: trainer.inDim,
    layerSizes: trainer.net.layers.map(l => l.outDim),
    layers: trainer.net.layers.map(l => ({ W: Array.from(l.W), b: Array.from(l.b) })),
    readout: { Wr: Array.from(trainer.readout.Wr), br: Array.from(trainer.readout.br) }
  };
}
function modelCompatible(obj, trainer) {
  if (!obj || obj.n !== trainer.n || obj.inDim !== trainer.inDim) return false;
  if (!Array.isArray(obj.layerSizes) || obj.layerSizes.length !== trainer.net.layers.length) return false;
  for (let i = 0; i < obj.layerSizes.length; i++) if (obj.layerSizes[i] !== trainer.net.layers[i].outDim) return false;
  return true;
}
function deserializeModel(trainer, obj) {
  obj.layers.forEach((ld, i) => { trainer.net.layers[i].W.set(ld.W); trainer.net.layers[i].b.set(ld.b); });
  trainer.readout.Wr.set(obj.readout.Wr); trainer.readout.br.set(obj.readout.br);
}
```

- [ ] **Step 4: Delete the dead one-hot functions**

Remove these function definitions entirely: `buildVocab`, `charToIndex`, `inputDim`, `encode`, `padContextIndices`, `softmax`, `serializeNet`, `deserializeNet`, `weightsCompatible`. Inside `class FFNet`, remove the `predictDistribution`, `sample`, and `totalGoodness` methods (keep `forwardAll`, `readoutDim`, `readoutFeatures`).

- [ ] **Step 5: Update the export guard**

Set the `module.exports` object to exactly:

```js
  module.exports = { makeRng, FFTests, sigmoid, FFLayer, l2normalize, FFNet, Trainer, generate, sampleBit,
    BUILTIN_CORPORA, CorpusStore, matMul, transpose, frobNorm, newtonSchulz5,
    textToBytes, bytesToText, tokenizeBytes, tokenToBits, bitsToToken, encodeContextBits, Readout,
    serializeModel, deserializeModel, modelCompatible };
```

- [ ] **Step 6: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all pass; the removed functions' tests are gone, the new serialization test passes. Grep to confirm no lingering engine references: `grep -n "buildVocab\|predictDistribution\|weightsCompatible\|softmax\|inputDim\|padContextIndices" index.html` should show only matches inside the second (UI) `<script>` (handled in Task 6), not in the shared-code block.

- [ ] **Step 7: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: model serialization; remove one-hot path"
```

---

### Task 6: UI rework (token-unit selector, bit panel, metrics, save/load)

**Files:**
- Modify: `forward-forward/index.html` (controls markup; stats markup; the second UI `<script>`)

**Interfaces:**
- Consumes (globals): `Trainer`, `generate`, `serializeModel`, `deserializeModel`, `modelCompatible`, `makeRng`.
- Produces: a working page using the binary engine — Token-unit selector, per-bit probability panel, bit/token accuracy stats, readout-based generation, model save/load.

- [ ] **Step 1: Add a Token-unit select to the controls markup**

Immediately BEFORE the `<label>Optimizer</label>` line, insert:

```html
    <label>Token unit</label>
    <select id="tokenUnit">
      <option value="1" selected>Bytes (8-bit)</option>
      <option value="2">Bigrams (16-bit)</option>
      <option value="3">Trigrams (24-bit)</option>
    </select>
```

- [ ] **Step 2: Update the stats markup label**

Change the stat row:

```html
      <div class="stat"><span>Val accuracy (top-1)</span><span id="acc">–</span></div>
```

to:

```html
      <div class="stat"><span>Bit acc / token acc</span><span id="acc">–</span></div>
```

- [ ] **Step 3: Register the new DOM ref**

Add `"tokenUnit"` to the `S` ref-builder array.

- [ ] **Step 4: Wire `n` into `Ctrl.build()`**

In `Ctrl.build()`, in the `new Trainer({ ... })` config: remove the `negPerPos: 1, valFraction: 0.1, vocabCap: 60,` fragment and replace with `valFraction: 0.1, n: parseInt(S.tokenUnit.value, 10),` (keep the other fields: `text`, `K`, `layerSizes`, `theta`, `lr`, `batchSize`, `optimizer`, `seed`). The resulting object must contain: `text, K, layerSizes, theta, lr, batchSize, optimizer, n, valFraction, seed`.

- [ ] **Step 5: Update stats (bit + token accuracy) in `Ctrl.updateStats`**

In the `if (this.stepCount % 10 === 0)` block, replace the accuracy lines:

```js
      const acc = t.evalAccuracy(40);
      S.acc.textContent = (acc * 100).toFixed(1) + "%";
```

with:

```js
      const bitAcc = t.evalBitAccuracy(40), tokAcc = t.evalTokenAccuracy(40);
      const acc = bitAcc;
      S.acc.textContent = (bitAcc * 100).toFixed(1) + "% / " + (tokAcc * 100).toFixed(1) + "%";
```

(`acc` is still pushed into `this.history` for the chart — leave the `this.history.push({ acc, gp, gn })` line as-is.)

- [ ] **Step 6: Replace `refreshDistribution` with a per-bit panel**

Replace the whole `refreshDistribution` function with:

```js
function refreshDistribution() {
  if (!Ctrl.trainer) return;
  const t = Ctrl.trainer;
  const seedBytes = Array.from(new TextEncoder().encode(S.prompt.value));
  const ctx = tokenizeBytes(seedBytes, t.n).slice(-t.K);
  const p = t.predictBits(ctx);
  S.dist.innerHTML = "";
  for (let i = 0; i < p.length; i++) {
    const bar = document.createElement("div"); bar.className = "bar";
    bar.style.height = (p[i] * 100) + "%";
    bar.title = "bit " + i + " (byte " + Math.floor(i / 8) + ", b" + (i % 8) + ") p=" + p[i].toFixed(2);
    S.dist.appendChild(bar);
  }
}
```

(`tokenizeBytes` is a shared-code global, available here.)

- [ ] **Step 7: Update the Generate handler**

Replace the `S.generate.onclick` handler body with:

```js
S.generate.onclick = () => {
  if (!Ctrl.trainer) return;
  const t = Ctrl.trainer;
  const tokens = Math.max(1, Math.round(parseInt(S.genlen.value, 10) / t.n));
  const out = generate(t, S.prompt.value, tokens, parseInt(S.temp.value, 10) / 100, makeRng((Date.now() & 0xffff) | 1));
  S.genOut.textContent = out;
  refreshDistribution();
};
```

- [ ] **Step 8: Update the live-sample line in `Ctrl.updateStats`**

Replace the live-sample generation line (inside the `% 30 === 0` block) — currently calling the old `generate(t.net, t.vocab, ...)` — with:

```js
        S.liveSample.textContent = generate(t, S.prompt.value || "the", Math.max(8, Math.round(60 / t.n)), 0.7, makeRng(this.stepCount + 1));
```

- [ ] **Step 9: Update Save/Load handlers to model-level serialization**

Replace the `S.save.onclick`, `S.load.onclick`, and `S.loadFile.onchange` handlers with:

```js
S.save.onclick = () => {
  if (!Ctrl.trainer) return;
  const blob = new Blob([JSON.stringify(serializeModel(Ctrl.trainer))], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ff-model.json"; a.click();
};
S.load.onclick = () => S.loadFile.click();
S.loadFile.onchange = async (e) => {
  const f = e.target.files[0]; if (!f || !Ctrl.trainer) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!modelCompatible(obj, Ctrl.trainer)) { setStatus("model doesn't match current settings"); e.target.value = ""; return; }
    deserializeModel(Ctrl.trainer, obj);
  } catch (err) { setStatus("invalid model file"); e.target.value = ""; return; }
  refreshDistribution(); setStatus("model loaded");
  e.target.value = "";
};
```

- [ ] **Step 10: Verify engine intact + page works**

Run: `cd forward-forward && node test.mjs`
Expected: same pass count as after Task 5 (engine untouched by this UI task).

Confirm no UI references to removed engine symbols remain:
`grep -n "evalAccuracy\|predictDistribution\|\.vocab\|vocabCap\|serializeNet\|deserializeNet\|weightsCompatible\|buildVocab\|charToIndex" index.html` → expect **no matches**.

Headless render:
```bash
cd /Users/neoneye/git/vibe-coding-lab/forward-forward && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1180,1000 --virtual-time-budget=4000 --screenshot="/tmp/ff-bits.png" "file://$PWD/index.html" 2>&1 | head -8 ; ls -la /tmp/ff-bits.png
```
Expected: non-empty PNG; the Token-unit dropdown (Bytes default) and Optimizer dropdown both render. (If no headless browser, report DONE_WITH_CONCERNS and rely on the grep + `node test.mjs`.)

- [ ] **Step 11: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: UI for binary token units + bit panel + model save/load"
```

---

### Task 7: Screenshot + final verification

**Files:**
- Modify: `forward-forward/screenshot1.png`
- Modify (only if needed): `forward-forward/index.html`

**Interfaces:** none.

- [ ] **Step 1: Full test run**

Run: `cd forward-forward && node test.mjs`
Expected: all pass, exit 0. Record the count.

- [ ] **Step 2: Diagnostic — confirm bit/token accuracy rises (Node)**

Create `/tmp/ff-bits-diag.mjs`:

```js
import { readFileSync } from "node:fs";
const html = readFileSync("index.html","utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
const { Trainer, BUILTIN_CORPORA } = new Function(`${m[1]}; return { Trainer, BUILTIN_CORPORA };`)();
for (const n of [1,2,3]) {
  const tr = new Trainer({ text: BUILTIN_CORPORA[0].text, n, K: 8, layerSizes:[128,128,128], theta:128, lr:0.02, batchSize:32, valFraction:0.1, seed:1234, optimizer:"muon" });
  let line = `n=${n}: `;
  for (let k=0;k<=800;k+=400){ if(k>0) for(let i=0;i<400;i++) tr.stepBatch(); line += `[${k}: bit=${(tr.evalBitAccuracy(40)*100).toFixed(0)}% tok=${(tr.evalTokenAccuracy(40)*100).toFixed(0)}%] `; }
  console.log(line);
}
```

Run: `cd forward-forward && node /tmp/ff-bits-diag.mjs`
Expected: bit-accuracy clearly above 50% and rising for n=1 (bytes) within ~800 steps; n=2,3 lower but bit-accuracy should still exceed ~50%. Record the numbers. If n=1 bit-accuracy stays ~50% (no learning), STOP and report — that signals a readout/training bug.

- [ ] **Step 3: Regenerate the screenshot (Bytes default, shows Token-unit + bit panel, real trained run)**

Use the repo's synchronous-driver technique (rAF does not advance under headless virtual time). Drive REAL training (no synthetic data); delete the temp file after:

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

Open/Read `forward-forward/screenshot1.png`. Confirm: the **Token unit** dropdown ("Bytes (8-bit)") and **Optimizer** dropdown both show; the stats show "Bit acc / token acc"; the next-char-distribution area shows the per-bit probability bars; the chart shows curves. If empty/0%, raise `STEPS` and recapture. If genuinely unable, fall back to idle capture and note it — do NOT fabricate.

- [ ] **Step 5: Commit**

```bash
git add forward-forward/screenshot1.png
git commit -m "forward-forward: screenshot for binary n-gram token model"
```

---

## Self-Review

**Spec coverage:**
- Token unit n∈{1,2,3}, UTF-8 bytes, non-overlapping, 8n bits MSB-first → Task 1 ✓
- Remove one-hot/vocab path → Task 5 ✓
- FF input = K·8n context bits; positive real / negative random-position → Task 4 (Trainer) ✓
- Hidden layers FF goodness with selected optimizer → Task 4 (reuses `layer.step(lr, optimizer)`) ✓
- Readout: 8n sigmoid, concat normalized hidden acts, BCE, Adam, no deep backprop, >0.5 bit → Tasks 2,3,4 ✓
- Prediction/generation: direct bits, threshold + per-bit temperature sampling → Task 4 (`generate`/`sampleBit`) ✓
- UI: token-unit selector, per-bit panel, generation, save/load → Task 6 ✓
- Stats: goodness separation + bit-accuracy + exact-token accuracy → Tasks 4 (metrics) + 6 (display) ✓
- Persistence: serialize readout + n; modelCompatible checks n+inDim → Task 5 ✓
- Tests: tokenizer round-trip, readout overfit, goodness separation, generate, serialization, optimizer still governs hidden layers (existing Muon/NS tests untouched) → Tasks 1–5 ✓
- Screenshot reflects new controls → Task 7 ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. Screenshot `STEPS`=800 is concrete with a diagnostic gate (Task 7 Step 2).

**Type consistency:** `Trainer(cfg{n,...})`, `trainer.n/bitsPerTok/inDim/net/readout`, `predictBits(context)→Float64Array`, `evalBitAccuracy/evalTokenAccuracy`, `generate(trainer, seedText, lengthTokens, temp, rng)`, `sampleBit(p,temp,rng)`, `Readout(featDim,outDim,rng)` with `predict/accumulate/step/zeroGrad`, `FFNet.readoutDim()/readoutFeatures(acts)`, `serializeModel(trainer)`/`modelCompatible(obj,trainer)`/`deserializeModel(trainer,obj)`, `S.tokenUnit` are used consistently across tasks. Token = `n`-length byte array everywhere; bits are `Float64Array` length `8n`. The optimizer selector continues to drive `layer.step(this.lr, this.optimizer)` (unchanged from the Muon feature).
