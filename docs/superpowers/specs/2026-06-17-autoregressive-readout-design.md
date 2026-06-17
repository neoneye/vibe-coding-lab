# Autoregressive (NADE) Bit-Readout — Design

Date: 2026-06-17
Location: `forward-forward/index.html` (replaces the independent-bit readout)
Related: [2026-06-17-binary-ngram-readout-design.md](2026-06-17-binary-ngram-readout-design.md)

## Goal

Fix the degenerate, incoherent output of the binary n-gram model (byte-soup / repeated
bytes) by replacing the **independent-bit** readout with an **autoregressive** one. The
current head predicts each of a token's `8n` bits independently, so it models per-bit
marginals but not the joint over a token's bits — at ~72% per-bit accuracy the chance of a
whole correct byte-triple is `0.72²⁴ ≈ 0.03%`, hence exact-token accuracy ≈ 0% and incoherent
bytes. An autoregressive (NADE-style) head models the joint and can commit to coherent bytes.

## Architecture

A NADE-style autoregressive readout over the `M = 8n` token bits, conditioned on the FF
features `h` (the concatenation of the L2-normalized hidden-layer activations; dim
`R = Σ layer widths`). For bit `i ∈ [0, M)`:

```
logit_i = c_i + Σ_{r} V[i][r]·h[r] + Σ_{k<i} U[i][k]·bit_k
p_i     = sigmoid(logit_i)
bit_i   = (p_i > 0.5)            # greedy; or sampled at generation
```

Parameters:
- **`V`** — `M × R` (flat `Float64Array`, row-major `V[i*R + r]`): features → per-bit logit.
- **`U`** — `M × M` (flat, row-major `U[i*M + k]`), used **lower-triangular only** (`k < i`):
  earlier-bit → bit-`i` dependencies. Entries with `k ≥ i` are never read and never updated.
- **`c`** — `M` biases (`Float64Array`).

`U` is what makes bytes coherent: once the high bits of a byte fix "this is a lowercase
letter," `U` lets the low bits commit to a consistent letter; across bytes within a token,
later bytes' bits can depend on earlier bytes' bits.

This remains a **shallow local head**: trained with Adam by binary cross-entropy, with **no
backprop into the FF hidden stack** (the FF layers keep their goodness training under the
selected Muon/Adam/SGD optimizer).

## Class: `ARReadout` (replaces `Readout`)

`new ARReadout(featDim, outDim, rng)` where `featDim = R`, `outDim = M = 8n`.
- He-style init for `V` (`scale = sqrt(1/featDim)`); `U` and `c` initialized to 0.
- Adam state (`m`/`v`/`t`) and gradient accumulators (`dV`, `dU`, `dc`, `count`) for `V`, `U`, `c`.
- Methods:
  - `logitsTeacher(features, bits) → Float64Array(M)` — for each `i`, `c_i + V_i·features +
    Σ_{k<i} U[i][k]·bits[k]`, using the supplied `bits` as the conditioning (teacher forcing).
  - `accumulate(features, targetBits)` — computes teacher-forced logits and `p_i`; for each
    `i`, `g_i = p_i − targetBits_i`; accumulates `dc_i += g_i`, `dV[i][r] += g_i·features[r]`,
    and `dU[i][k] += g_i·targetBits_k` for `k < i`; increments `count`.
  - `step(lr)` — one bias-corrected Adam step over `V`, the lower-triangular entries of `U`,
    and `c` (gradients averaged over `count`), then `zeroGrad()`. (`U[i][k]` for `k ≥ i` stay
    exactly 0 because their gradients are never accumulated.)
  - `zeroGrad()`.
  - `greedy(features) → { bits: Float64Array(M), probs: Float64Array(M) }` — ancestral decode:
    for `i = 0…M−1`, `logit_i = c_i + V_i·features + Σ_{k<i} U[i][k]·decided_k`,
    `probs_i = sigmoid(logit_i)`, `bits_i = (probs_i > 0.5)`; feed each decided bit forward.
  - `sample(features, temp, rng) → Float64Array(M)` — ancestral, but `bits_i = temp ≤ 0 ?
    (p_i > 0.5) : sampleBit(p_i, temp, rng)` (reuses the existing `sampleBit`).

## Training / prediction flow (Trainer)

- `stepBatch` (unchanged in shape): per positive sample, compute FF features of the real
  context (`net.readoutFeatures(rp.acts)`) and call `readout.accumulate(feats, tokenToBits
  (target, n))` (teacher-forced). Negative random-position context still trains the FF layers.
  After the batch, `readout.step(this.lr)` (Adam). FF layers step with the selected optimizer.
- `predictBits(context) → { bits, probs }` — `net.forwardAll` → `readoutFeatures` →
  `readout.greedy(features)`. Metrics use `.bits`; the UI panel uses `.probs`.
- `evalBitAccuracy(count)` / `evalTokenAccuracy(count)` — unchanged logic, but they call the
  new `predictBits` and read `.bits` (greedy, free-running — honest generation-time accuracy).
- `generate(trainer, seedText, lengthTokens, temp, rng)` — per token, `readout.sample(feats,
  temp, rng)` (ancestral) instead of independent per-bit thresholding.

## Persistence

`serializeModel` stores `readout: { V, U, c }` (arrays) instead of `{ Wr, br }`.
`deserializeModel` restores them with typed-array `.set`. `modelCompatible` is unchanged
(checks `n`, `inDim`, and per-layer widths — these pin `R` and `M`, hence the head shapes).

## UI

No structural change. The per-bit probability panel now shows the **ancestral greedy**
`probs` from `predictBits`. Token-unit selector, optimizer selector, save/load, charts, and
the bit/token-accuracy stats all keep working and benefit automatically.

## Testing (`test.mjs`)

- **NADE overfit (the key regression):** train `ARReadout` on **one fixed feature vector**
  paired *equally often* with **two targets whose per-bit marginals are all 0.5** — e.g.
  `0x0F = 00001111` and `0xF0 = 11110000` (every bit is 0 in one target and 1 in the other).
  An independent-bit head would learn `p_i ≈ 0.5` for all bits → greedy threshold gives an
  **invalid** token (`0x00`), matching neither target. NADE learns the bit-to-bit dependencies
  (`U`), so greedy decode commits to a **valid** token. Assert the greedy decode exactly equals
  one of the two trained targets. This is the test that distinguishes NADE from the old head.
- **Lower-triangular `U` respected:** `logit_i` is unaffected by `bits[k]` for `k ≥ i`
  (flip a future bit → `greedy`/`logitsTeacher` value for bit `i` unchanged), and after
  training, `U[i][k] == 0` for all `k ≥ i`.
- **Trainer end-to-end:** on a repeating byte pattern, exact-token accuracy rises clearly
  above 0 after training (the old head sat at ~0%).
- **serialize/deserialize:** preserves greedy predictions; `modelCompatible` still rejects a
  different `n`.
- Existing FF / optimizer / Newton-Schulz / tokenizer tests stay green; `generate` still
  returns seed + `lengthTokens·n` bytes.

## Expected effect

Exact-token accuracy should rise off ~0% and generated bytes become real characters instead
of byte-soup, because the head can now produce coherent bytes. Compute cost is negligible
(~`M` sequential dot-products per token at generation; teacher-forced training is a single
pass per sample). We will verify empirically and compare before/after on a trigram run.

## Non-goals

- No MLP/non-linear head (linear NADE first; revisit only if it under-fits).
- No change to the FF hidden-layer training, the optimizer selector, or the tokenizer.
- No backprop through the FF stack. No GPU/WebGL; no external libs; still works from `file://`.
- This addresses output coherence, not long-term memory beyond the K-token window (a separate,
  later concern).
