# Next Concept Modeling (NCM) page: design

Date: 2026-11-10. Folder: `ncm/`.

## Intent

A page that trains and runs a small, faithful implementation of Next Concept
Modeling (Kumbong et al., Stanford, arXiv:2610.14162, code
github.com/HazyResearch/ncm, MIT) in the browser, with the heavy numerics in
Rust compiled to wasm. The owner wants to see the method work and be able to
poke at it: train it, watch both stages learn, generate text and watch it
sharpen from coarse to fine, and inspect what the tokenizer does to a given
text. `forward-forward/index.html` is the model for the look and the
train / pause / generate / save-weights workflow.

NCM in one paragraph: a tokenizer turns a fixed-length token window into K
levels of discrete codes, short coarse levels first and a full-length level
last (multiscale residual vector quantisation). A transformer then predicts
level k from the reconstruction built out of levels 1..k-1. All codes within
a level are predicted in one parallel forward pass, so generating a window
costs one pass per level instead of one per token.

## Decided by the owner

- Training text: Frankenstein and Shakespeare, as full texts committed as
  `.txt` files next to the page. Upload and drag-and-drop of other text stays.
- Tokens are characters.
- Faithful to the paper's structure at small size (not an MLP stand-in).
- Unconditional generation only. No prompt box, no conditional path, no
  classifier-free guidance.
- Rust for the heavy work, shipped as a separate `.wasm` file next to
  `index.html`. The page is served by GitHub Pages; not working from
  `file://` is accepted.
- A pretrained checkpoint ships with the page so everything works on open.
  Start retrains from scratch or continues. Save / Load weights.
- Views: two-stage training dashboard, coarse-to-fine reveal, tokenizer
  inspector, paper explainer.

## Goals

1. The model follows the reference code's structure (details below), small
   enough to make visible progress in a browser tab.
2. On open, with the pretrained checkpoint, Generate produces text and the
   reveal and inspector work without any training.
3. Training either stage in the page shows the numbers moving within seconds
   and the UI stays responsive.
4. The explainer says plainly what this toy is and is not.

## Non-goals

- Matching the paper's quality. The paper's TinyStories model is 36 M
  (tokenizer) + 89 M (generator) parameters on BPE tokens; this is around
  1 M parameters on characters. Expect word-shaped, partly real English, not
  coherent prose. The explainer must say so.
- Conditional tasks (summarisation, translation, Sudoku), CFG, MBR decoding,
  KV caching, BPE, multithreading, WebGPU.
- An autoregressive baseline.

## Anti-goals

- Presenting toy numbers as a reproduction of the paper's results, or
  quoting the paper's speedups as if measured here.
- A model that only memorises: the pretrained checkpoint must be trained on
  the full corpus with a held-out slice, and the page shows held-out numbers.
- Game mechanics, scores.

## Files

```
ncm/
  index.html          the page (UI, worker bootstrap, explainer)
  ncm.wasm            built from rust/, committed
  pretrained.bin      checkpoint trained offline with the same Rust code, committed
  corpus/frankenstein.txt   Project Gutenberg #84, boilerplate stripped
  corpus/shakespeare.txt    the ~1.1 MB "tiny shakespeare" plays extract
  build.sh            cargo build --release --target wasm32-unknown-unknown, copy ncm.wasm
  rust/               dependency-free crate, crate-type cdylib + rlib
    src/...           tensor ops, layers, tokenizer, generator, optimiser, wasm exports
    examples/pretrain.rs    native trainer that writes pretrained.bin
  test.mjs            node: loads ncm.wasm, runs the exported self-test and a smoke run
  screenshot1.png
```

Also: gallery entry (`gallery.yaml` / root `index.html`) and README entry,
per repo convention. Both corpora are public-domain texts; note the sources
in the page footer.

## The model

Source of truth is the reference code (`models/quant.py`, `models/vae.py`,
`models/next_concept.py`, `config/eval/tinystories.yaml`). Where the paper
text and the code differ, follow the code. Sizes below are starting points
(builder's call to tune, see "Left to the builder").

### Stage 1: tokenizer (multiscale residual VQ-VAE)

- Input: a window of L = 64 characters. Vocabulary = the characters present
  in the bundled corpora (fixed table shipped with the checkpoint; unknown
  characters in uploaded text map to a fallback).
- Encoder: token embedding + position embedding only, no transformer blocks
  (the reference uses `enc_layers=0`). Then a parameter-free group norm and
  the quantiser. Latent width d around 64.
- Quantiser, K levels with lengths such as `[1, 4, 8, 12, 16, 24, 32, 48, 64]`
  (first level 1, last level L, as in the reference). Per level, working on
  the current residual:
  - downsample to the level length by area pooling (level 1: a learned
    strided conv initialised to area pooling, with a straight-through
    estimator at that level only);
  - pick the nearest codebook entry per position (separate codebook per
    level, around 256 entries);
  - upsample back to L by linear interpolation (level 1: learned transposed
    conv initialised to repeat), then `0.5*h + 0.5*conv3(h)`, one conv per
    level;
  - add to the running reconstruction, subtract from the residual.
- Codebooks are updated by EMA of assigned vectors (decay 0.95-0.99, with
  the reference's Laplace smoothing), not by gradient. Dead-code restart is
  allowed if utilisation collapses.
- Loss: decoder cross-entropy + mean over levels of
  `0.25 * mse(sg(z_hat_k), z) + mse(z_hat_k, sg(z))`. The decoder receives
  `z + sg(z_hat - z)`.
- Nested ("fine-level") dropout: with probability 0.5 the decoder is given
  the reconstruction truncated at a uniformly random level, so coarse levels
  must carry meaning. This is what makes the reveal readable.
- Decoder: one transformer block (pre-norm, self-attention with QK norm,
  MLP), final norm, linear to character logits.

### Stage 2: generator (next-concept transformer)

- The tokenizer is frozen. Each training window is encoded to codes; the
  input for level k is the cumulative reconstruction from levels 1..k-1,
  area-pooled to the length of level k, projected to the hidden width.
- Level 1 (a single code) is not predicted by the transformer. As in the
  reference (`predict_level0: false`, `level0_unigram`), it is sampled from
  the empirical distribution of level-1 codes over the training data, which
  is stored in the checkpoint.
- One learned prefix position (the reference's `prefix_len: 1`) that every
  level can attend to.
- Pre-norm transformer, around 4 blocks, width around 128, 4 heads, RoPE
  with positions restarting at 0 for each level, QK norm, a learned level
  embedding added to the input.
- Attention is block-diagonal: a position attends to the prefix and to
  positions of its own level only. In training all levels go through in one
  pass as one sequence with this mask (implementation may process each level
  block separately, which is equivalent and cheaper).
- Output heads are tied to the frozen codebooks: logits are
  `(2 h.E - |E|^2) / scale * exp(learned log temperature)` after a linear
  projection of the hidden state to width d.
- Loss: cross-entropy per code, weighted per level by
  `w_k proportional to l_k^(-alpha)`; alpha is a control, default 0 (every
  code weighted equally).
- Conditioning corruption: while building the inputs, each conditioning code
  is replaced by a uniformly random code of the same level with a per-level
  rate that decreases linearly from coarse to fine; the mean rate is a
  control, default 0.5. Targets stay clean. The paper describes this as a
  shifted linear decrease with mean 0.5 but the released code has no
  training loop, so the exact schedule is this page's choice (design
  author's call, not the owner's): an independent draw per code; rate
  `mean + delta` at the coarsest conditioning level falling linearly to
  `mean - delta` at the finest, mean taken over levels, clamped to [0, 0.95];
  delta starts at 0.3 and is tuned by measurement. The level-1 rate must
  stay well below 1 so the generator keeps using the level-1 code. The
  explainer states that the exact schedule is ours.
- Optimiser for both stages: AdamW, warmup then cosine to a floor, gradient
  clipping at norm 1.

### Generation

Sample the level-1 code from the stored distribution. For each further
level: pool the running reconstruction to the level length, one forward
pass, sample every code of the level independently (temperature, top-k),
add the level's contribution to the reconstruction. Finally the decoder
gives characters by argmax. The page reports the number of transformer
passes (K-1) next to the window length, with no speed claims beyond that.

## Rust / wasm

- Dependency-free crate, f32, hand-written forward and backward passes for
  each layer (no general autograd needed; a small set of ops with explicit
  backward functions is enough). wasm built with `+simd128`.
- Plain C-ABI exports (no wasm-bindgen), in the style of
  `swarm-genetic-programming/rust`: create model from a config, set corpus
  bytes, train N steps of stage 1 or 2 and return stats, encode a window to
  codes, decode with a level cutoff, generate with per-level snapshots,
  export / import weights, run self-test.
- Deterministic given a seed, in wasm and native alike.
- Correctness: `cargo test` with finite-difference gradient checks for every
  layer and for both full losses on a tiny configuration, plus exactness
  tests (encode then decode-from-codes equals the training-time forward;
  block-diagonal mask really blocks cross-level attention).
- `examples/pretrain.rs` runs natively, trains stage 1 then stage 2 on the
  two corpora with a held-out slice, prints held-out metrics, writes
  `pretrained.bin`. The checkpoint format is a small versioned binary:
  config, character table, level-1 code distribution, tensors.

## The page

Dark two-column layout and control styling of forward-forward. wasm runs in
a Web Worker so training never blocks the UI; the page posts commands and
receives stats, samples and snapshots.

Left column, controls:
- Corpus (Frankenstein + Shakespeare, each alone, uploaded file).
- Model shape (latent width, codebook size, generator blocks / width).
  Changing shape means retraining from scratch; the page says so.
- Stage selector: Tokenizer / Generator. Start, Pause, Reset, Save weights,
  Load weights, Restore pretrained.
- Learning rate, batch size, nested-dropout probability (stage 1), alpha and
  mean corruption (stage 2).
- Parameter counts for both models.

Right column, panels:
1. **Training dashboard.** Status, windows seen, steps/s. Stage 1: loss,
   held-out character reconstruction accuracy at full depth and per level
   cutoff, codebook utilisation per level. Stage 2: held-out loss and code
   accuracy per level. A loss chart per stage. The generator cannot start
   until a tokenizer exists; retraining the tokenizer invalidates the
   generator and the page says so and resets it.
2. **Generate.** Temperature, top-k, seed, Generate. Shows several windows.
3. **Coarse-to-fine reveal.** For one generated window: a row per level with
   the codes chosen at that level (small coloured cells, hue from code
   index) and the text the decoder gives if generation stopped there.
   Step / play controls.
4. **Tokenizer inspector.** Type or pick 64 characters of text: its codes
   per level, the reconstruction at each level cutoff with wrong characters
   marked, and per-level codebook usage histograms.
5. **What this is.** Short explainer: the method, a diagram of levels, the
   differences from the paper (characters not BPE, about 1 M parameters,
   64-character windows, unconditional only), what the page's numbers do
   and do not show, links to the paper and code, corpus sources.

No image export is planned.

## Success criteria

- `cargo test` passes including gradient checks; `node test.mjs` passes.
- Pretrained tokenizer: held-out full-depth reconstruction accuracy of at
  least 95 %, and accuracy rising with level cutoff.
- Pretrained generator: held-out loss clearly below the uniform and unigram
  code baselines at every level; samples are mostly word-shaped with common
  English words. If this cannot be reached at a size that still trains
  visibly in the browser, report the measured numbers and what was tried
  instead of tuning the claim.
- In-browser training from scratch shows stage-1 accuracy climbing within
  about ten seconds on the owner's Mac.
- Verified in the Browser pane over http (and Firefox layout where
  possible): no overlapping text, sane margins, no console errors.

## Left to the builder

- Exact sizes (L, level schedule, widths, block counts, codebook sizes),
  learning rates and step counts, chosen by measurement. The paper's
  hyperparameters (AdamW beta2 0.95, EMA decay 0.95, commitment 0.25,
  nested dropout 0.5, corruption mean 0.5) are the defaults to start from.
- Internal structure of the Rust crate and the worker message protocol.
- Colours and layout details within the forward-forward look.
- How long to pretrain offline (keep it under roughly an hour of machine
  time) and whether `pretrained.bin` is stored as f32 or f16 (keep it under
  about 5 MB).
