# 2D Chladni Plate: design

Date: 2026-10-24. Directory: `2d-chladni-plate/`.

## Intent

Sand on a vibrating plate. You tune a sound, the plate resonates, and the sand jumps off the moving parts and snaps onto the still lines. The owner was taken by the idea and asked for "lots of parameters", sound on/off, and four specific explorations:

1. **Plate shape matters**: square, triangle, oval, circle, star, plus, and more.
2. **Two kinds of sand**: heavy sand goes to the still lines. Light powder goes to the most-moving spots (Chladni's lycopodium, which Faraday explained in 1831).
3. **Rich sounds, not just a sine**: sawtooth and other waves, a mix of two notes, and a short sample (about 0.5 s) that repeats.
4. **Mounted at two locations, in sync or out of sync**: the two mounts can move together, opposite, a quarter-cycle apart, or slowly drift.

The owner skipped the remaining design questions and said "go ahead". Every choice below that the owner didn't state is marked *(my call)*.

## Goals

- Real plate physics. The modes come from an eigen-solve of a thin (Kirchhoff) plate on a grid, so any outline costs the same to compute, including a drawn one.
- Time-domain modal response at audio rate, so any signal works (tones, sweeps, noise, loops, a friction bow). The same simulation drives the sand and the sound.
- Sand reacts to the time-averaged shaking at every point, including coherent cross-terms. That gives degenerate-mode figures on the square, beating, and rotating waves from phased mounts.
- Lots of parameters, grouped and collapsible, plus presets that show off each of the four explorations.
- Sound on/off, off by default (browsers need a click to start audio anyway).

## Non-goals and anti-goals

- Not a game, and no scoring.
- No library dependencies. One self-contained `index.html` that works from `file://`.
- The sand must not be a fake pattern painted from a formula. It has to come out of the simulated vibration field.

## Physics model

**Plate.** Free-edge Kirchhoff plate on an N×N grid of nodes. A node is inside if its centre is inside the outline. The discrete bending energy sums the terms that fit inside the plate: w_xx², w_yy², 2ν·w_xx·w_yy, and 2(1−ν)·w_xy² (twist at cell corners). This gives a symmetric stiffness matrix S with natural free-edge conditions. The mass is uniform per node. Frequencies scale as ω = Ω/L²·√(D/ρh) with D = Eh³/12(1−ν²), so size, thickness, E and ρ rescale without a new solve. Shape, grid, ν, mode count and constraints do need a re-solve.

**Constraints.** A *clamp* is a small disc held still (Chladni's bolt). A *post* is a disc attached to a shaker that moves it up and down (the modern demo). Both remove their nodes from the eigenproblem. Each post also has a static influence shape ψ (the plate shape when that post moves one unit and the others hold), solved with the same factorisation. Total motion = Σ ψ_d·u_d + Σ φ_i·q_i (base-excitation modal analysis).

**Drivers A and B.** Each one is a post (prescribed acceleration in g) or a point force (N), with gain, phase (0° in sync, 180° out) and drift (Hz, so the phase rotates slowly). Every source supplies the signal and its Hilbert transform (s, ŝ), so a phase shift is cos θ·s − sin θ·ŝ for any signal. Synthesised tones get ŝ analytically. Loops and noise are stored as periodic buffers, and their Hilbert transform comes from an FFT.

**Eigen-solver** *(my call)*. Shift-invert block Krylov (block size 4, so degenerate pairs on the square aren't missed). It uses a banded Cholesky of S+εI, full re-orthogonalisation, Rayleigh–Ritz with S, and dense tred2/tql2. It runs in chunks so the page stays responsive.

**Modal response.** Each mode is a damped oscillator with exact zero-order-hold discretisation at the audio rate. Damping ζ is uniform (a parameter). A free plate's three rigid modes get a soft suspension (a few Hz) so they don't drift.

**Field for the sand.** Per audio chunk, accumulate the covariance C of all channel accelerations (modes + posts) and smooth it with an exponential window τ (sand response time). Mean-square acceleration is E(x) = Σ C_cc' ψ_c(x)ψ_c'(x). It's evaluated through an eigendecomposition of C, which is low-rank for tones. Peak acceleration in g is A = √(2E)/g.

**Sand** *(heuristic, stated plainly on the page)*. Heavy grains only move where A > threshold (≈1 g). They random-walk with step ∝ √(A−thr) and drift down the gradient of A, so they freeze in the low-motion bands. Light powder drifts *up* the gradient of A² (a stand-in for Faraday's air currents), so it forms heaps at the antinodes. Each grain type has a mass slider (0 = powder, 1 = sand) that blends the two behaviours, plus a count and a colour. Edge behaviour is walls or spill-off.

**Bow** *(my call: Chladni's own method)*. A friction bow at a draggable point, with stick-slip friction solved implicitly each sample against the plate's one-step point admittance.

**Sound.** A contact mic at a draggable point plays the plate acceleration there, mixed with the dry drive signal. It goes through a tanh limiter and a volume control. ScriptProcessorNode (works from `file://`). When sound is on, the audio callback drives the simulation clock. When it's off, the animation loop does.

## Page

- Big plate canvas, rendered at device-pixel resolution. Markers can be dragged: posts/drivers A and B, clamps, bow, mic. A clamp or post drop re-solves the modes; a point-driver drop doesn't.
- A spectrum strip of mode lines (lit by how strongly each is excited) and the source marker. Click to tune, or click a line to lock onto that mode.
- A mode gallery (thumbnails of mode shapes). Click one to tune to it.
- Collapsible parameter groups: Plate, Mounts, Sound source, Sand, Physics, View, Audio.
- Presets: Chladni's square, circle rings, sand + powder, two posts in sync / out of sync, rotating wave, drifting pair, sawtooth, beating notes, drum loop on a star, Chladni's bow, guitar top, sweep.
- Shapes: square, rectangle, circle, ellipse, regular polygon, star, plus, annulus, guitar top, heart, and a custom outline you draw. Each has its own parameters and a rotation.
- Keys: Space pause, M sound, R re-scatter sand, ←/→ previous/next resonance, H heat overlay.
- An explainer and an honesty panel: what is computed exactly, and what is heuristic.

## Testing

A `ChladniTests` runner inside `<script id="shared-code">`, run by `test.mjs`. It checks:

- the dense eigensolver and banded Cholesky
- a free-free strip against Euler–Bernoulli beam ratios
- the free square against Leissa's ratios, including its degenerate pair
- the free circle against Leissa's ratios
- mode orthonormality and residuals
- clamp and post behaviour: rigid modes removed, ψ = 1 for a single post
- the in-sync/out-of-sync selection rule
- that the mode being driven dominates at resonance
- that the covariance field matches a brute-force time average
- that heavy grains move to nodes and powder to antinodes
- that the bow self-oscillates and stays bounded
- that every preset shape is connected with exactly three rigid modes
