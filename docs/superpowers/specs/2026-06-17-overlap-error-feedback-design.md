# Overlap-Error Feedback (Predictive Coding) — Design

Date: 2026-06-17
Location: `forward-forward/index.html` (reshapes the model into a sliding next-byte predictor with lookahead + error feedback)
Related: [2026-06-17-autoregressive-readout-design.md](2026-06-17-autoregressive-readout-design.md), [2026-06-17-binary-ngram-readout-design.md](2026-06-17-binary-ngram-readout-design.md)

## Goal

Add a predictive-coding feedback loop: the model predicts a small **lookahead** of the next
`n` bytes at every byte position (sliding by 1 byte), and the **float discrepancy** of its
previous lookahead forecasts — `predicted_probability − true_bit`, before any thresholding —
is fed back as extra input. For trigrams (`n=3`) this is 16 extra input floats. This gives the
model a recurrent error-feedback state (a first form of short-term memory).

## What the model becomes

A **sliding next-byte predictor with an `n`-byte lookahead**:
- At each byte position `p` it predicts a lookahead `L_p` = the next `n` bytes
  `bytes[p .. p+n−1]` as `8n` bits, via the existing NADE `ARReadout`.
- Generation **commits one byte per step** (the first byte of `L_p`) and advances by 1; the
  remaining lookahead bytes exist only to produce the feedback signal.
- `n` (the token-unit selector) now means **lookahead length**; feedback width = `8·(n−1)`
  (bytes→0, bigrams→8, trigrams→16).

## Inputs and outputs

- **Context** = the previous `K` bytes as bits → `8K` bits. (`K` now counts **bytes**, not
  tokens.)
- **Feedback** = `8·(n−1)` floats in `[−1,1]` (see below).
- **FF input** = `context_bits ⊕ feedback_floats`, dim `8K + 8(n−1)`. The feedback feeds the FF
  hidden layers (it shapes the features); the NADE readout's feature input (Σ layer widths) is
  unchanged.
- **Output** = the `8n`-bit lookahead via the NADE readout (teacher-forced BCE, unchanged head).

## The feedback signal

Every byte `b_j` is forecast by `n` consecutive lookaheads: `L_j` (as its 1st/committed byte),
`L_{j−1}` (2nd byte), …, `L_{j−(n−1)}` (`n`-th byte). Once `b_j` is known, the **prior** `n−1`
forecasts (all but `L_j`) can be scored against the truth.

When the model is about to predict `L_p`, the most recently revealed byte is `b_{p−1}`. The
feedback is the per-bit float discrepancy of the `n−1` prior forecasts of `b_{p−1}`:

```
feedback = concat over k = 1 … n−1 of:
    ( σ-probs of L_{p−1−k} at byte-slot k )  −  ( true bits of b_{p−1} )
```

i.e. `predicted_probability − true_bit` per bit, an un-clamped signed float. For `n=3`,
predicting `L_p`: the two prior forecasts of `b_{p−1}` are `L_{p−2}`'s 2nd-byte slot and
`L_{p−3}`'s 3rd-byte slot → 16 floats.

**Mechanics:** keep a rolling buffer of the last `n` lookahead probability arrays (each `8n`
floats). When predicting at `p`, read the appropriate byte-slot slices for `b_{p−1}` from the
buffer, subtract the true bits of `b_{p−1}`, and concatenate. At the start of a sequence
(insufficient history) the feedback is all **zeros**.

## Training (sequential)

Training switches from sampling independent random windows to processing **contiguous byte
windows** left-to-right so the feedback chains:
- Pick a random start `s ≥ K` in the train byte stream; process `W` positions `p = s … s+W−1`
  (`W` = the batch size). For each `p`:
  - context = `bytes[p−K .. p−1]`; feedback = from the rolling buffer + true `b_{p−1}`.
  - **FF positive:** accumulate goodness on `context_bits ⊕ feedback` (real).
  - **FF negative:** accumulate goodness on a `K`-byte context drawn from **random positions**
    with **zero** feedback (real-vs-random, as today).
  - **Readout:** teacher-forced BCE on the positive features → true lookahead bits
    `bytes[p .. p+n−1]`.
  - Forward the positive input to get `L_p`'s probabilities and push them into the rolling
    buffer (for later feedback).
- After the window: step every FF layer with the selected optimizer (Muon/Adam/SGD) and step
  the readout with Adam. `examplesSeen += W`. The rolling buffer is local to the window (reset
  at each window start).

Context and targets are true bytes (teacher-forced); only the feedback channel is
model-derived, so training stays stable (no full free-running rollout).

## Generation

- Maintain the last `K` committed bytes and the rolling prediction buffer.
- Each step: compute feedback (from the buffer + the last committed byte) → assemble input →
  FF forward → readout → lookahead probs → **commit the first byte** (greedy or per-bit
  temperature sampling via `sampleBit`) → append to output → push the lookahead probs to the
  buffer → slide the context. Produces one byte per step.

## Metrics & UI

- Accuracy metrics become **next-byte** (the committed first byte): `evalBitAccuracy` over its
  8 bits and `evalTokenAccuracy` = exact-byte match. (Measured on held-out byte positions.)
- The per-bit probability panel shows the **predicted next byte** (first 8 bits of the
  lookahead). The token-unit selector label conveys "lookahead length"; the goodness/optimizer
  controls, charts, save/load are unchanged in shape.
- Generation length is in bytes (1 byte/step).

## Persistence

`serializeModel` is unchanged in structure but the FF layer-0 weights are now wider
(`inDim = 8K + 8(n−1)`). `modelCompatible` already checks `n`, `inDim`, and per-layer widths,
which pin the new shape; no new fields needed (the readout still serializes `V/U/c`).

## Components

- **Feedback helper (shared-code):** `bytesContextBits(bytes, startIndex, K) → Float64Array(8K)`
  (context bytes → bits, zero-padded at stream start); `computeFeedback(predBuffer,
  revealedByteBits, n) → Float64Array(8(n−1))` (the float-discrepancy slices); a rolling buffer
  of the last `n` lookahead prob arrays.
- **Trainer:** rebuilt around the byte stream and sequential windows; `inDim = 8K + 8(n−1)`;
  `stepBatch` runs a contiguous window with the feedback buffer; `predictNextByteProbs(...)` for
  metrics; `evalBitAccuracy`/`evalTokenAccuracy` over the committed next byte.
- **generate:** rewritten for one-byte-per-step with the feedback loop.
- FF layers, optimizers, and the NADE `ARReadout` are reused unchanged.

## Testing (`test.mjs`)

- `computeFeedback` correctness: for `n=3`, given a known prediction buffer and a known revealed
  byte, the 16 floats equal `prob − bit` for the two prior byte-slots; values are un-clamped
  floats (e.g. a 0.7 prob vs true 1 → −0.3), and at sequence start feedback is all zeros.
- Feedback wiring: `inDim === 8K + 8(n−1)`; with `n=1` the feedback width is 0 and the model
  reduces to a plain sliding next-byte predictor.
- **The feedback is wired into the computation:** a single forward pass with non-zero feedback
  produces different lookahead probabilities than the same context with the feedback zeroed
  (proves the `8(n−1)` feedback inputs actually reach the network), and the feedback dims are
  non-zero mid-window during training.
- **Sanity learning:** next-byte bit-accuracy rises above chance on a repeating byte pattern
  after training.
- `generate` returns seed + `length` bytes (one byte per step); deterministic with a seeded rng.
- serialize/deserialize round-trips and `modelCompatible` rejects a different `n` (different inDim).
- Existing FF / optimizer / NADE / tokenizer tests stay green.

## Honest note

This adds a genuine recurrent error-feedback state — the first real "memory" in the model — and
is a worthwhile experiment. It is unlikely to fix coherence on the ~1 KB built-in corpus (still
data/feature-limited); the real test is a larger uploaded text.

## Non-goals

- No change to the NADE readout, the FF goodness optimizer selector, or the corpus loader.
- No backprop through the FF stack; feedback is an input signal, not a trained recurrent weight.
- No GPU/WebGL; no external libs; still works from `file://`.
