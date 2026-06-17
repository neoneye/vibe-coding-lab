# Forward-Forward Next-Char Language Model — Design

Date: 2026-06-17
Location: `forward-forward/index.html` (single self-contained page, no GPU, no external libs)

## Goal

Implement Geoffrey Hinton's **Forward-Forward (FF)** training algorithm as a standalone
HTML page that trains a **character-level next-char language model** with no backpropagation
across layers and no GPU. The user can control the number of layers, watch training stats
live, **pause** at any point, run **predictions/generation** with the current weights, then
**resume** training to further improve the weights.

## Core algorithm: FF cast as next-char prediction

Forward-Forward trains each layer **locally**: there is no end-to-end backward pass. Each
layer maximizes a *goodness* score on **positive** inputs and minimizes it on **negative**
inputs.

- **Goodness** of a layer = sum of squared activations: `g = Σ aᵢ²` where `a = ReLU(W·x + b)`.
- We frame next-char prediction as FF classification in which the "label" is the
  **candidate next character**.

### Input encoding

- **Vocabulary** `V`: built from the active corpus, capped to the top-N most frequent
  characters (default cap ~60); all other chars map to a single `<UNK>` symbol. `V` is the
  vocab size including `<UNK>`.
- **Context window** `K`: the previous `K` characters, each as a one-hot of length `V`,
  concatenated → `K·V` dims.
- **Candidate** next char: one-hot of length `V`.
- **Network input** `x` = `[context one-hots] ⊕ [candidate one-hot]`, dim `(K+1)·V`.

### Positive vs. negative samples

- **Positive** = `(context, true next char)`.
- **Negative** = `(context, wrong next char)` — sample a wrong char (default 1 negative per
  positive; uniform or frequency-weighted from vocab, excluding the true char).

### Layer training (the FF part)

- Each hidden layer: `a = ReLU(W·x_norm + b)`, `g = Σ aᵢ²`.
- The **first** hidden layer receives the raw encoded input `x`. Every subsequent layer
  receives the **L2-normalized** activation vector of the previous layer (Hinton's
  normalization so a layer cannot trivially propagate goodness via raw magnitude).
- **Local logistic loss** per layer, with goodness threshold `θ`:
  - positive: `loss⁺ = log(1 + exp(-(g − θ)))`   (push `g` above `θ`)
  - negative: `loss⁻ = log(1 + exp(+(g − θ)))`   (push `g` below `θ`)
- Only that layer's own weights are updated (per-layer **Adam**). No gradient flows between
  layers — this is the defining FF property.

### Prediction / generation

- For a given context, run one forward pass **per candidate char** in the vocab; accumulate
  **total goodness** = sum of per-layer goodness over the hidden layers (option to exclude
  the first layer).
- `probabilities = softmax(totalGoodness / temperature)` over the vocabulary.
- **Argmax** = next-char prediction. **Sampling** from the distribution + feeding the chosen
  char back into the context = autoregressive **generation**.

### Approach decision

One-hot context is used rather than learned embeddings. Embeddings would need their own
training signal and complicate the pure-FF story; one-hot keeps the demo faithful to FF and
cheap on CPU.

## Components

All in a single `index.html`. The engine lives in `<script id="shared-code">` (per repo
convention) and exposes a `module.exports`/global guard so `test.mjs` can run `FFTests.run()`.

- **Encoder / Vocab** — builds the char vocab from the active corpus (frequency cap + `<UNK>`),
  encodes a context window and candidate char into the input vector; decodes indices back to
  chars.
- **FFLayer** — holds `W`, `b`; methods: `forward(x) → activations`, `goodness(a)`, and a
  local `update(xPos, xNeg)` that computes the logistic-loss gradient for this layer only and
  applies an Adam step.
- **FFNet** — stacks `L` `FFLayer`s; handles per-layer L2 normalization between layers,
  accumulates goodness, and provides `predictDistribution(context)` and `sample(context, temp)`.
- **Trainer** — samples positive/negative batches from the active corpus, steps each layer,
  records stats. Runs in **chunked ticks** via `setTimeout` so the UI stays responsive and
  **pause = stop scheduling / resume = restart scheduling**. Weights persist in JS memory
  across pause → predict → resume.
- **Corpus manager** — a few **tiny built-in corpora** (so the page works on first load and is
  screenshot-able) plus **file upload / drag-drop** for user `.txt` files (Shakespeare,
  Mary Shelley, …). Maintains a train/val split per corpus.
- **UI / Charts** — vanilla JS + canvas; controls, live stat readouts, sparkline charts, and
  the prediction panel.

## UI

### Controls
- **# hidden layers** (the primary requested knob)
- layer width, context window `K`, learning rate, goodness threshold `θ`, batch size,
  negatives-per-positive
- corpus selector + **upload/drag-drop**; train/val split
- **Start / Pause / Resume / Reset**

### Live training stats
- examples seen, steps, wall-clock / steps-per-sec
- per-layer **mean positive goodness vs. mean negative goodness** (should separate over time)
- per-layer loss
- held-out **next-char top-1 accuracy** (argmax goodness == true char on a val sample)
- a small generated-text sample, refreshed periodically
- sparkline charts for goodness separation and accuracy over time

### Prediction panel (works any time, especially when paused)
- **seed prompt** textbox → **next-char probability bar chart** over the vocab
- **Generate** button → autoregressive rollout of a passage, with a **temperature** slider
  and length control
- **Resume** training afterward to keep improving the same weights

### Bonus (optional, include if low-cost)
- **Save / Load weights** as a downloaded/uploaded JSON, for persistence across reloads.

## Defaults (CPU-friendly)
`K=8`, vocab cap ~60, **3 hidden layers × width 128**, Adam `lr=0.01`, `θ = layer width`,
batch 32, 1 negative per positive, temperature 1.0.

## Testing (`test.mjs`)
`test.mjs` extracts the `<script id="shared-code">` block and runs `FFTests.run()`:
- encoder round-trip and correct input dimensionality `(K+1)·V`
- one-hot vectors have exactly one 1
- vocab frequency cap + `<UNK>` mapping behaves correctly
- a layer's goodness **increases** on a positive sample after an update, and **decreases** on
  a negative sample after an update
- `softmax` output sums to 1 and is non-negative
- tiny **end-to-end overfit** sanity check: on a trivial repeating pattern, top-1 next-char
  accuracy rises above chance after a short training burst

## Non-goals
- No GPU / WebGL compute.
- No external ML libraries.
- No server requirement (must work opened directly from `file://`).
- Cross-reload persistence is optional (bonus JSON save/load only).
