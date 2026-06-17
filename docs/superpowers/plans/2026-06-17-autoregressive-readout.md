# Autoregressive (NADE) Bit-Readout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the independent-bit readout with an autoregressive (NADE-style) one so the binary n-gram model produces coherent bytes instead of byte-soup, lifting exact-token accuracy off ~0%.

**Architecture:** A NADE head predicts each of a token's M=8n bits in order from the FF features `h` (dim R = Σ layer widths) and the already-decided earlier bits: `logit_i = c_i + V_i·h + Σ_{k<i} U[i][k]·bit_k`, with lower-triangular `U`. Teacher-forced BCE training (Adam), ancestral decode at generation; the FF hidden stack is unchanged (goodness, selected optimizer). The head stays shallow/local (no backprop into FF).

**Tech Stack:** Vanilla JavaScript, `Float64Array`; Node only for `test.mjs`. No external libraries.

## Global Constraints

- Single self-contained `forward-forward/index.html`; works from `file://`; no external libs; no GPU/WebGL.
- Engine logic in `<script id="shared-code">`, evals under Node (no document/window at module scope). Export guard exports engine symbols + FFTests. UI only in the second `<script>`.
- Determinism: randomness only via seeded `makeRng`; never `Math.random()` in engine. Float64Array.
- `M = outDim = 8n`; `R = featDim = Σ layer widths`. `V` is `M×R` flat row-major (`V[i*R+r]`); `U` is `M×M` flat row-major (`U[i*M+k]`), used **lower-triangular only** (`k<i`); `c` length `M`.
- NADE logit: `logit_i = c_i + Σ_r V[i*R+r]·h[r] + Σ_{k<i} U[i*M+k]·bit_k`. BCE+sigmoid gradient `dL/dlogit_i = p_i − y_i`.
- The readout is Adam-trained (β1=0.9, β2=0.999, ε=1e-8, bias-corrected); NO backprop into the FF hidden layers. The Muon/Adam/SGD selector governs only the FF hidden layers.
- `predictBits(context)` returns a probabilities `Float64Array` of length M (the **greedy ancestral** probs — each conditioned on the thresholded earlier bits); thresholding it at 0.5 yields the greedy token. Generation uses true ancestral **sampling**.
- Commit after every task with message prefix `forward-forward:`. Run `node test.mjs` from inside `forward-forward/`.

---

### Task 1: ARReadout class (NADE head)

**Files:**
- Modify: `forward-forward/index.html` (shared-code: add `class ARReadout` near the existing `Readout`; add tests; export `ARReadout`). Do NOT remove `Readout` yet (Task 2 does the switch).

**Interfaces:**
- Consumes: `sampleBit` (existing).
- Produces:
  - `new ARReadout(featDim, outDim, rng)` — `featDim=R`, `outDim=M`. He-init `V` (`scale=sqrt(1/R)`); `U`, `c` zero. Adam buffers + grad accumulators for `V`, `U`, `c`.
  - `logitsTeacher(features, bits) → Float64Array(M)` — `logit_i` using `bits` as conditioning.
  - `accumulate(features, targetBits)` — teacher-forced BCE gradient accumulation; `count++`.
  - `step(lr)` — bias-corrected Adam over `V`, `U`, `c` (grads averaged over `count`), then `zeroGrad()`.
  - `zeroGrad()`.
  - `greedyProbs(features) → Float64Array(M)` — ancestral greedy probabilities (bit_i = probs_i>0.5 fed forward).
  - `sample(features, temp, rng) → Float64Array(M)` — ancestral sampling (temp≤0 ⇒ greedy bit, else `sampleBit`).

- [ ] **Step 1: Write the failing tests** (add inside shared-code, in the `FFTests` section)

```js
FFTests.add("ARReadout (NADE) commits to a valid token where independent bits cannot", () => {
  const rng = makeRng(4), featDim = 6, outDim = 8;
  const feats = new Float64Array(featDim); for (let i = 0; i < featDim; i++) feats[i] = rng() * 2 - 1;
  const A = Float64Array.from([0,0,0,0,1,1,1,1]); // 0x0F
  const B = Float64Array.from([1,1,1,1,0,0,0,0]); // 0xF0  (per-bit marginals all 0.5)
  const ro = new ARReadout(featDim, outDim, rng);
  for (let i = 0; i < 600; i++) { ro.zeroGrad(); ro.accumulate(feats, A); ro.accumulate(feats, B); ro.step(0.05); }
  const probs = ro.greedyProbs(feats);
  const bits = Float64Array.from(probs, p => p > 0.5 ? 1 : 0);
  const eq = (x, y) => { for (let i = 0; i < 8; i++) if (x[i] !== y[i]) return false; return true; };
  FFTests.assert(eq(bits, A) || eq(bits, B), "greedy decode must equal a valid trained token, got " + Array.from(bits).join(""));
});

FFTests.add("ARReadout U is strictly lower-triangular (future bits ignored)", () => {
  const ro = new ARReadout(5, 8, makeRng(1));
  const feats = Float64Array.from([0.2, -0.5, 0.1, 0.3, -0.2]);
  const target = Float64Array.from([1,0,1,1,0,0,1,0]);
  for (let i = 0; i < 50; i++) { ro.zeroGrad(); ro.accumulate(feats, target); ro.step(0.05); }
  const M = 8; let okZero = true;
  for (let i = 0; i < M; i++) for (let k = i; k < M; k++) if (ro.U[i * M + k] !== 0) okZero = false;
  FFTests.assert(okZero, "U[i][k] must stay exactly 0 for k>=i");
  const b1 = Float64Array.from([1,0,1,0,0,0,0,0]);
  const b2 = Float64Array.from([1,0,1,0,0,1,0,0]); // bit 5 flipped
  const z1 = ro.logitsTeacher(feats, b1), z2 = ro.logitsTeacher(feats, b2);
  FFTests.approx(z1[2], z2[2], 1e-12, "logit of bit 2 must ignore bit 5");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL `ARReadout is not defined`.

- [ ] **Step 3: Implement `ARReadout`** (add inside shared-code, before the test additions / export guard)

```js
class ARReadout {
  constructor(featDim, outDim, rng) {
    this.featDim = featDim; this.outDim = outDim; // R, M
    const M = outDim, R = featDim;
    this.V = new Float64Array(M * R);
    this.U = new Float64Array(M * M); // lower-triangular entries (k<i) used
    this.c = new Float64Array(M);
    const scale = Math.sqrt(1 / R);
    for (let i = 0; i < this.V.length; i++) this.V[i] = (rng() * 2 - 1) * scale;
    this.mV = new Float64Array(this.V.length); this.vV = new Float64Array(this.V.length);
    this.mU = new Float64Array(this.U.length); this.vU = new Float64Array(this.U.length);
    this.mc = new Float64Array(M); this.vc = new Float64Array(M);
    this.t = 0;
    this.dV = new Float64Array(this.V.length); this.dU = new Float64Array(this.U.length); this.dc = new Float64Array(M);
    this.count = 0;
  }
  _logit(i, features, bits) {
    const R = this.featDim, M = this.outDim;
    let z = this.c[i]; const vb = i * R;
    for (let r = 0; r < R; r++) z += this.V[vb + r] * features[r];
    const ub = i * M;
    for (let k = 0; k < i; k++) z += this.U[ub + k] * bits[k];
    return z;
  }
  logitsTeacher(features, bits) {
    const M = this.outDim, z = new Float64Array(M);
    for (let i = 0; i < M; i++) z[i] = this._logit(i, features, bits);
    return z;
  }
  zeroGrad() { this.dV.fill(0); this.dU.fill(0); this.dc.fill(0); this.count = 0; }
  accumulate(features, targetBits) {
    const R = this.featDim, M = this.outDim;
    for (let i = 0; i < M; i++) {
      const z = this._logit(i, features, targetBits);
      const p = 1 / (1 + Math.exp(-z));
      const g = p - targetBits[i];
      this.dc[i] += g;
      const vb = i * R; for (let r = 0; r < R; r++) this.dV[vb + r] += g * features[r];
      const ub = i * M; for (let k = 0; k < i; k++) this.dU[ub + k] += g * targetBits[k];
    }
    this.count++;
  }
  _adam(param, grad, m, v, lr, n, bc1, bc2) {
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    for (let idx = 0; idx < param.length; idx++) {
      const gg = grad[idx] / n;
      m[idx] = b1 * m[idx] + (1 - b1) * gg; v[idx] = b2 * v[idx] + (1 - b2) * gg * gg;
      param[idx] -= lr * (m[idx] / bc1) / (Math.sqrt(v[idx] / bc2) + eps);
    }
  }
  step(lr) {
    if (this.count === 0) return;
    const n = this.count; this.t++;
    const bc1 = 1 - Math.pow(0.9, this.t), bc2 = 1 - Math.pow(0.999, this.t);
    this._adam(this.V, this.dV, this.mV, this.vV, lr, n, bc1, bc2);
    this._adam(this.U, this.dU, this.mU, this.vU, lr, n, bc1, bc2); // dU=0 for k>=i, so those stay 0
    this._adam(this.c, this.dc, this.mc, this.vc, lr, n, bc1, bc2);
    this.zeroGrad();
  }
  greedyProbs(features) {
    const M = this.outDim, bits = new Float64Array(M), probs = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      const p = 1 / (1 + Math.exp(-this._logit(i, features, bits)));
      probs[i] = p; bits[i] = p > 0.5 ? 1 : 0;
    }
    return probs;
  }
  sample(features, temp, rng) {
    const M = this.outDim, bits = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      const p = 1 / (1 + Math.exp(-this._logit(i, features, bits)));
      bits[i] = temp <= 0 ? (p > 0.5 ? 1 : 0) : sampleBit(p, temp, rng);
    }
    return bits;
  }
}
```

- [ ] **Step 4: Extend exports** — add `ARReadout` to `module.exports` (keep `Readout` for now).

- [ ] **Step 5: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all pass (2 new tests). If the NADE-commits test fails, do NOT weaken it — increase the iteration count (the bit-to-bit dependencies need enough steps to form); the data is deterministic-given-bit-0 so it must converge to a valid token.

- [ ] **Step 6: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: autoregressive (NADE) bit-readout class"
```

---

### Task 2: Switch Trainer/generation/serialization to ARReadout

**Files:**
- Modify: `forward-forward/index.html` (shared-code: `Trainer` readout wiring, `predictBits`, add `sampleToken`, `generate`; `serializeModel`/`deserializeModel`; remove `class Readout` + its test; add a Trainer exact-token-accuracy test; update exports)

**Interfaces:**
- Consumes: `ARReadout`, `encodeContextBits`, `tokenToBits`, `bitsToToken`, `textToBytes`, `bytesToText`, `tokenizeBytes`.
- Produces:
  - `Trainer.readout` is now an `ARReadout`.
  - `Trainer.predictBits(context) → Float64Array` — greedy ancestral probabilities.
  - `Trainer.sampleToken(context, temp, rng) → Float64Array(M)` — ancestral sampled bits.
  - `serializeModel.readout = { V, U, c }`; `deserializeModel` restores them.

- [ ] **Step 1: Replace the Readout overfit test and add a Trainer token-accuracy test**

Delete the existing test titled `"Readout overfits a fixed feature->bits mapping"` (it constructs `new Readout(...)`).

Add:

```js
FFTests.add("binary Trainer exact-token accuracy rises above zero (AR readout)", () => {
  const text = "abcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc";
  const tr = new Trainer({ text, n: 1, K: 3, layerSizes: [32, 32], theta: 32, lr: 0.03,
    batchSize: 16, valFraction: 0.25, seed: 11, optimizer: "adam" });
  const before = tr.evalTokenAccuracy(20);
  for (let i = 0; i < 600; i++) tr.stepBatch();
  const after = tr.evalTokenAccuracy(20);
  FFTests.assert(after > 0.5, `exact-token accuracy should rise well above 0 (before=${before.toFixed(2)} after=${after.toFixed(2)})`);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd forward-forward && node test.mjs`
Expected: FAIL — the new token-accuracy test fails (the old independent `Readout` cannot reach >0.5 exact-token accuracy), confirming the regression target. (It may also error if `Readout` was already removed — implement Step 3-6 then re-run.)

- [ ] **Step 3: Point the Trainer at ARReadout**

In the `Trainer` constructor, change:

```js
    this.readout = new Readout(this.net.readoutDim(), this.bitsPerTok, this.rng);
```

to:

```js
    this.readout = new ARReadout(this.net.readoutDim(), this.bitsPerTok, this.rng);
```

- [ ] **Step 4: Update `predictBits` and add `sampleToken`**

Replace the `predictBits` method:

```js
  predictBits(context) {
    const x = encodeContextBits(context, this.K, this.n);
    const { acts } = this.net.forwardAll(x);
    return this.readout.predict(this.net.readoutFeatures(acts));
  }
```

with:

```js
  predictBits(context) {
    const x = encodeContextBits(context, this.K, this.n);
    const { acts } = this.net.forwardAll(x);
    return this.readout.greedyProbs(this.net.readoutFeatures(acts));
  }
  sampleToken(context, temp, rng) {
    const x = encodeContextBits(context, this.K, this.n);
    const { acts } = this.net.forwardAll(x);
    return this.readout.sample(this.net.readoutFeatures(acts), temp, rng);
  }
```

- [ ] **Step 5: Update `generate` to ancestral sampling**

Replace the entire `generate` function with:

```js
function generate(trainer, seedText, lengthTokens, temp, rng) {
  const n = trainer.n, K = trainer.K;
  const seedBytes = Array.from(textToBytes(seedText));
  const ctx = tokenizeBytes(seedBytes, n);
  const outBytes = seedBytes.slice();
  for (let i = 0; i < lengthTokens; i++) {
    const bits = trainer.sampleToken(ctx.slice(-K), temp, rng);
    const tok = bitsToToken(bits, n);
    ctx.push(tok);
    for (const byte of tok) outBytes.push(byte);
  }
  return bytesToText(Uint8Array.from(outBytes));
}
```

- [ ] **Step 6: Update serialization for V/U/c**

Replace `serializeModel`'s readout line and `deserializeModel`'s readout lines. New `serializeModel`:

```js
function serializeModel(trainer) {
  return {
    n: trainer.n, inDim: trainer.inDim,
    layerSizes: trainer.net.layers.map(l => l.outDim),
    layers: trainer.net.layers.map(l => ({ W: Array.from(l.W), b: Array.from(l.b) })),
    readout: { V: Array.from(trainer.readout.V), U: Array.from(trainer.readout.U), c: Array.from(trainer.readout.c) }
  };
}
```

New `deserializeModel`:

```js
function deserializeModel(trainer, obj) {
  obj.layers.forEach((ld, i) => { trainer.net.layers[i].W.set(ld.W); trainer.net.layers[i].b.set(ld.b); });
  trainer.readout.V.set(obj.readout.V); trainer.readout.U.set(obj.readout.U); trainer.readout.c.set(obj.readout.c);
}
```

- [ ] **Step 7: Remove the old `Readout` class and update exports**

Delete the entire `class Readout { ... }` definition. In `module.exports`, remove `Readout` (keep `ARReadout`).

- [ ] **Step 8: Run to verify pass**

Run: `cd forward-forward && node test.mjs`
Expected: all pass. The new exact-token-accuracy test now passes (AR head reaches >0.5 on the deterministic pattern); the existing bit-accuracy / generate / goodness-separation / serialize tests stay green (`predictBits` still returns a probs `Float64Array`, so the metrics, the serialize round-trip, and the UI panel are unaffected). If the token-accuracy test does not pass, do NOT weaken it — increase the step count.

- [ ] **Step 9: Confirm no dangling `Readout` references**

Run: `grep -n "new Readout\|class Readout\| Readout\b" forward-forward/index.html` → expect only matches naming `ARReadout` (no bare `Readout`).

- [ ] **Step 10: Commit**

```bash
git add forward-forward/index.html
git commit -m "forward-forward: switch model to autoregressive bit-readout"
```

---

### Task 3: Verify coherence improvement + screenshot

**Files:**
- Modify: `forward-forward/screenshot1.png`
- Modify (only if needed): `forward-forward/index.html`

**Interfaces:** none.

- [ ] **Step 1: Full test run**

Run: `cd forward-forward && node test.mjs`
Expected: all pass, exit 0. Record the count.

- [ ] **Step 2: Before/after diagnostic (Node)** — confirm the AR head improves trigram coherence

Create `/tmp/ff-ar-diag.mjs`:

```js
import { readFileSync } from "node:fs";
const html = readFileSync("index.html","utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
const { Trainer, BUILTIN_CORPORA, generate, makeRng } = new Function(`${m[1]}; return { Trainer, BUILTIN_CORPORA, generate, makeRng };`)();
for (const n of [1,3]) {
  const tr = new Trainer({ text: BUILTIN_CORPORA[0].text, n, K: 8, layerSizes:[128,128,128], theta:128, lr:0.02, batchSize:32, valFraction:0.1, seed:1234, optimizer:"adam" });
  for (let i=0;i<2500;i++) tr.stepBatch();
  console.log(`n=${n}: bit=${(tr.evalBitAccuracy(60)*100).toFixed(1)}% token=${(tr.evalTokenAccuracy(60)*100).toFixed(1)}%  sample=${JSON.stringify(generate(tr,"To be",30,0.6,makeRng(7)))}`);
}
```

Run: `cd forward-forward && node /tmp/ff-ar-diag.mjs`
Expected: exact-token accuracy is clearly **above 0%** (the old independent head sat at ~0%), and the generated samples contain real characters / words rather than repeated-byte soup. Record the numbers and samples. (Token accuracy on the ~1KB corpus will still be modest, but should be visibly non-zero and the text more coherent — that is the win. If token accuracy is still ~0% AND samples are still pure soup, STOP and report — the AR head is not engaging.)

- [ ] **Step 3: Regenerate the screenshot (Bytes default, real trained AR run)**

Use the synchronous-driver technique (rAF does not advance under headless virtual time). Drive REAL training; delete the temp file after:

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

Open/Read `forward-forward/screenshot1.png`. Confirm it shows a real trained byte-mode run: Token unit "Bytes (8-bit)", Optimizer Muon, "Bit acc / token acc" with real numbers, the per-bit bar panel, chart curves. Confirm `_shot.html` is not present and `git status` shows only `screenshot1.png`. If the chart is empty/0%, raise STEPS and recapture; if genuinely unable, fall back to idle and note it — do NOT fabricate.

- [ ] **Step 5: Commit**

```bash
git add forward-forward/screenshot1.png
git commit -m "forward-forward: screenshot for autoregressive bit-readout"
```

---

## Self-Review

**Spec coverage:**
- NADE logit (c + V·h + U·earlier-bits), lower-triangular U → Task 1 (`_logit`, accumulate, step) ✓
- Teacher-forced BCE + Adam, no backprop into FF → Task 1 (accumulate/step) ✓
- greedy (metrics/panel) + ancestral sample (generation) → Task 1 (`greedyProbs`/`sample`), Task 2 (`predictBits`/`sampleToken`/`generate`) ✓
- Class rename Readout → ARReadout → Tasks 1 (add) + 2 (remove old) ✓
- Serialization stores V/U/c; modelCompatible unchanged → Task 2 ✓
- UI benefits automatically (predictBits still returns a probs Float64Array; no UI edit) → confirmed in Task 2 Step 8 ✓
- Tests: NADE-commits-to-valid-token (key regression), lower-triangular U, Trainer exact-token-accuracy rises, existing FF/optimizer/tokenizer/serialize green → Tasks 1, 2 ✓
- Empirical coherence verification + screenshot → Task 3 ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. Screenshot STEPS=800 with a diagnostic gate (Task 3 Step 2).

**Type consistency:** `ARReadout(featDim,outDim,rng)` with `V/U/c`, `logitsTeacher`, `accumulate`, `step`, `greedyProbs`, `sample`; `Trainer.predictBits → Float64Array(probs)`, `Trainer.sampleToken(context,temp,rng) → Float64Array(bits)`; `generate(trainer, seedText, lengthTokens, temp, rng)`; `serializeModel.readout = {V,U,c}`. `M=8n`, `R=Σ widths`. `predictBits` return type (probs Float64Array) is unchanged from the prior independent head, so `evalBitAccuracy`/`evalTokenAccuracy`/`refreshDistribution`/the serialize test all consume it unchanged.
