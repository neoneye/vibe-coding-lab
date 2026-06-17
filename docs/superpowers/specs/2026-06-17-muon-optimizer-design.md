# Selectable Optimizers (Muon default) — Design

Date: 2026-06-17
Location: `forward-forward/index.html` (extends the existing Forward-Forward char-LM page)
Related: [2026-06-17-forward-forward-char-lm-design.md](2026-06-17-forward-forward-char-lm-design.md)

## Goal

Let the user choose the optimizer used to train the Forward-Forward network, defaulting to
**Muon**. Offer three: **Muon** (default), **Adam** (the existing optimizer), and **SGD**
(classic momentum). The optimizer can be changed at any time — including the
**pause → switch → resume** flow — and training continues on the same weights.

## Background: Muon

Muon (MomentUm Orthogonalized by Newton-Schulz) buffers the gradient with momentum, then
**orthogonalizes** the gradient *matrix* via a Newton-Schulz iteration that drives all
singular values toward 1, producing a well-conditioned update. Orthogonalization is only
defined for 2D matrices, so Muon applies to each FF layer's weight matrix `W` (out×in); the
1D bias `b` falls back to Adam.

This pairs naturally with Forward-Forward: every layer already computes its **own local
goodness gradient** (no backprop across layers), and Muon simply orthogonalizes that
per-layer gradient. No cross-layer coupling is introduced.

## Update rules

Let `dW` (out×in) and `db` (out) be the accumulated, batch-averaged gradients in a layer's
`step`. `lr` is the learning rate; `μ = 0.95` is the momentum coefficient.

### Muon (default) — applied to `W`; `b` uses Adam
1. Momentum buffer: `Bw ← μ·Bw + dW`.
2. `O = newtonSchulz5(Bw)` where `newtonSchulz5(G)`:
   - `X ← G / (‖G‖_F + 1e-7)` (Frobenius norm).
   - If `rows > cols`, transpose `X` (operate on the shorter dimension as rows).
   - Repeat 5×: `A = X·Xᵀ`; `X ← a·X + (b·A + c·A·A)·X` with `(a,b,c) = (3.4445, −4.7750, 2.0315)`.
   - Undo the transpose if applied.
3. `W ← W − lr · √max(1, out/in) · O`.
4. `b` ← Adam update (identical to the Adam rule below, on `db`).

### Adam — applied to `W` and `b` (unchanged from current code)
Bias-corrected Adam (`β1=0.9, β2=0.999, ε=1e-8`), using state `mW,vW,mb,vb,t`.

### SGD — classic momentum, applied to `W` and `b`
`vW ← μ·vW + dW; W ← W − lr·vW` (and the same for `b` with `vb`).

## Switching behavior

- Each `FFLayer` holds **all optimizers' state simultaneously**: Adam (`mW,vW,mb,vb,t`), Muon
  momentum (`Bw`), SGD velocity (`vW2`/`vb2`). The selected optimizer touches only its own
  buffers, so switching is seamless and reversible (Muon → Adam → Muon).
- The training loop re-reads the optimizer selection every tick, so a change takes effect on
  the next step. **Pause is optional** — the deliberate pause → switch → resume flow and a
  live mid-training switch both work.
- **Momentum carries over** (no reset on switch). An optimizer that has not run yet starts
  with zero buffers (a brief cold-start transient), which is the natural, honest behavior.

## Performance tradeoff

Newton-Schulz is several matrix multiplies per layer per step, so in pure-JS / `Float64Array`
Muon is substantially heavier per step than Adam (~10–30×); steps/sec drop noticeably when
Muon is selected. To keep the UI responsive regardless of optimizer, the chunked training
loop changes from a **fixed 20 steps/frame** to a **~16 ms time budget per frame**: it runs
`stepBatch` in a `while` loop until ~16 ms of wall-clock has elapsed (with a small minimum of
1 step and a sane max), then yields to `requestAnimationFrame`. Fast optimizers (Adam/SGD)
do many steps/frame; Muon does as many as fit the budget. Stats/`stepCount` increment per
actual step as before.

The default learning rate is raised slightly (slider default → `0.02`) since Muon prefers a
bit more than Adam; both are verified to learn at that default. The LR slider stays single
and shared (no separate Muon LR) — documented, YAGNI.

## Components and interfaces

All in `forward-forward/index.html`. Engine changes in `<script id="shared-code">`; UI in the
second `<script>`.

- **Helpers (shared-code):**
  - `matMul(A, ar, ac, B, br, bc) → Float64Array` — flat row-major matrix multiply (`ac===br`).
  - `transpose(A, rows, cols) → Float64Array`.
  - `frobNorm(A) → number`.
  - `newtonSchulz5(G, rows, cols) → Float64Array` — semi-orthogonalization as above.
- **FFLayer:**
  - New buffers in the constructor: `Bw` (Muon momentum, size of `W`); `vW2`, `vb2` (SGD
    velocity). Existing Adam buffers retained.
  - `step(lr, optimizer = "adam")` branches on `optimizer ∈ {"muon","adam","sgd"}`. Internal
    default stays `"adam"` so existing unit tests (`step(0.05)`) keep exercising Adam; the
    *app* defaults to Muon via the Trainer/UI. Each branch ends by zeroing the gradient
    accumulators (current `zeroGrad()` behavior).
  - Factor out the Adam update into a small private routine reused by Adam-on-`W`,
    Adam-on-`b`, and Muon's bias path (DRY).
- **Trainer:** constructor accepts `optimizer` (default `"muon"`), stored as `this.optimizer`;
  `stepBatch` passes `this.optimizer` to each `layer.step(this.lr, this.optimizer)`.
- **UI:** an Optimizer `<select id="optimizer">` (options: `Muon` selected by default, `Adam`,
  `SGD`) in the controls panel. `Ctrl.build()` reads it into the Trainer; the loop sets
  `this.trainer.optimizer = S.optimizer.value` each tick (mirrors the live LR read). The
  control is enabled during training (live switch) and labeled near the LR slider.

## Persistence

Optimizer choice is a runtime knob, **not** serialized into saved weights (`serializeNet`
unchanged). `weightsCompatible` unchanged. Loading weights does not alter the selected
optimizer.

## Testing (`test.mjs`)

New tests added to `FFTests` (engine, run under Node):
- **`newtonSchulz5` semi-orthogonality:** for a random non-square matrix, the result `X`
  satisfies `‖X·Xᵀ·X − X‖_F` small (singular values ≈ 1), confirming orthogonalization.
- **`matMul`/`transpose` correctness:** a known small product and a transpose round-trip.
- **Muon trains:** a layer stepped with `optimizer="muon"` on a fixed positive sample sees
  goodness **rise**, and on a negative sample sees goodness **fall** (mirrors the Adam test).
- **SGD trains:** likewise, a layer stepped with `optimizer="sgd"` moves goodness the
  intended direction.
- **Switch safety:** stepping a layer alternately with `"muon"` then `"adam"` does not throw
  and continues to move goodness in the intended direction (buffers coexist).
- All **existing** tests remain green (Adam path, overfit, generation, save/load, compat).

## Non-goals

- No separate per-optimizer learning-rate control.
- No serialization of optimizer state.
- No GPU/WebGL; no external libraries; still works from `file://`.
