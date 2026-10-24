# AdamW vs Muon: design

Date: 2026-10-25. Directory: `adamw-vs-muon/`.

## Intent

The owner asked for a standalone page that demonstrates the AdamW and Muon optimizers on some training data. The loss should be visible, and the user should be able to pause training, interact with the model, resume, and interact again. Every choice below was my call.

## Shape

- **A duel, not a toggle.** Two copies of one network start from bit-identical weights and train on the same minibatches in the same order. One copy uses AdamW. The other uses Muon on its hidden matrices and AdamW, with the same settings, on everything else. Any difference between them comes from the optimizer.
- **Two tasks**, each with its own run, hyperparameters and snapshots:
  - *Spiral classifier*: a 2→64→64→64→4 tanh MLP on 2D points. Datasets: 2-, 3- and 4-arm spirals, moons, rings, checkerboard, or empty (paint your own). Interaction: live decision maps for both models, hover probabilities, and clicks that add or erase training points.
  - *Name generator*: a makemore-style character MLP (embedding, then context×emb→64→27) on 738 first names, 10% held out. Interaction: next-letter distribution after a prefix, per-letter likelihood of a name, and samples that complete the prefix. Each sample is tagged as copied from training, a real held-out name, or invented. Both models sample with the same random numbers.
- **Pause snapshots**: each pause records both models: map thumbnails for the spiral, fixed-seed samples for names. Each pause also adds a marker on the loss chart. This is the "interact, resume, interact again" record.
- **Loss chart**: smoothed train loss, a faint raw min/max band, held-out loss as dots, log or linear y, and a hover readout. Below the chart, a line says which model is ahead and how much sooner it reached the other's current loss.
- **Shape of the last update**: the normalised singular values of the last update to a chosen matrix, for both models, with effective rank and RMS. This is the plot that shows what Muon does differently.
- **Explainer**: the update rules, a plot of the Newton–Schulz quintic iterated 1…5 times, and honest notes.

## Engine

The engine is plain JS in a `shared-code` block, tested from Node by `test.mjs`.

- Hand-written forward and backward passes, gradient-checked against finite differences.
- AdamW with bias correction and decoupled weight decay. Biases are not decayed.
- Muon in its current reference form:
  - lerp momentum with optional Nesterov
  - quintic Newton–Schulz, (3.4445, −4.7750, 2.0315), 5 steps, run on the wide orientation
  - update scale √max(1, out/in), or Moonlight's 0.2·√max(out, in)
  - decoupled weight decay
- Singular values by cyclic Jacobi on the Gram matrix.
- Muon covers hidden matrices only. An opt-in checkbox extends it to the input layer, output layer and embedding, never to biases.

## Defaults

Learning rates were picked separately for each optimizer by a small sweep on seed 1:

- Spiral: AdamW 0.01, Muon 0.03, weight decay 0.01. The spiral uses r·12 radians of turn, tight enough that both models plateau near ln 3 before breaking out. On the easier r·3.8 spiral, both solved it in under 200 steps and nothing was visible.
- Names: AdamW 0.004, Muon 0.005, weight decay 0.1, context 3. The dataset is small, so held-out loss turns upward after about 1k steps, and the chart shows it.

## Findings worth keeping

- In these tiny nets the momentum of a 64×64 hidden matrix has a very low stable rank. Its singular values fall to 1e-4…1e-9 of the largest. Five Newton–Schulz steps lift σ by at most about 480×, so Muon's update spectrum is high across a few dozen directions, not flat across all 64. The explainer says so, rather than claiming a flat line.
- Cost: one 64×64 Newton–Schulz takes about 3.5 ms in JS. The "opt ms" column shows it. The page renders one decision map per UI tick while training (40², alternating models) and both at 96² on pause.
- The Browser pane serves file:// as data:, so URL hooks (`?task=names&steps=600&snaps=200`) only work over http.
