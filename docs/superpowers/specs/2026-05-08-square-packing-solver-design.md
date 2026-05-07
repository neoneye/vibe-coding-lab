# Square Packing Solver — Standalone HTML Page

## Goal

A single self-contained HTML file at `packing/index.html` that lets a user explore the classic square-packing problem: how do you pack N unit squares (allowed to rotate at any angle) into the smallest possible rectangle or square? The page runs a simulated-annealing solver in the browser, animates the search live, and reports the best layout it has found.

## Modes

The page has two modes, switched by a tab toggle at the top:

**Mode A — "Min container for N squares"**
- User input: `N` (positive integer, default `11`).
- User input: container shape — `square` or `rect` (radio).
- Objective: minimize the container's area while fitting all N unit squares.
- Square shape minimizes side length `s` (area = `s²`).
- Rect shape minimizes area `w · h`; both `w` and `h` are search variables.

**Mode B — "Max squares in container"**
- User input: container width `W` and height `H` (positive numbers, in unit-square units).
- Objective: maximize the number of unit squares that fit.

Each mode has its own controls panel; the canvas, status line, and Run/Stop/Reset buttons are shared.

## Solver

Simulated annealing, single thread, driven by `requestAnimationFrame`. Each frame runs `K` annealing steps, where `K` is set by a speed slider (range roughly 1 step/frame on the slow end, ~5000 steps/frame on the fast end). Between frames the canvas redraws.

### State

- `squares: [{x, y, θ}, …]` — center position and rotation angle of each unit square. Side length is fixed at 1 in solver units.
- `container: {w, h}` — current container dimensions in solver units. In Mode A square shape, `w === h`.

### Energy function

Energy = `overlap_penalty + boundary_penalty`. Energy = 0 means a valid (feasible) packing.

- **Overlap penalty**: for each pair of squares, use SAT (Separating Axis Theorem) on oriented bounding boxes to find the minimum penetration depth `d`. Sum `d²` over all overlapping pairs. Squared penetration gives a smooth gradient that anneals well.
- **Boundary penalty**: for each square, compute the four corner positions and sum `max(0, -x)² + max(0, x - w)² + max(0, -y)² + max(0, y - h)²` over the four corners.

Pairwise check is `O(n²)` per evaluation. For the target N ≤ ~30 this is fine; no spatial index needed.

### Moves

Each annealing step picks one of the following move types uniformly at random:

1. **Small translate** — pick one square, add Gaussian noise (σ = 0.1) to `x` and `y`.
2. **Large translate** — pick one square, add Gaussian noise (σ = 0.5).
3. **Small rotate** — pick one square, add Gaussian noise (σ = 0.1 rad) to `θ`.
4. **Large rotate** — pick one square, replace `θ` with a uniform random angle in `[0, π/2)`.
5. **Swap** — pick two squares, swap their `(x, y)` (rotations stay).
6. **Random reset** — pick one square, place it uniformly at random inside the container with a random angle.

Standard Metropolis acceptance: `ΔE ≤ 0` always accepted; `ΔE > 0` accepted with probability `exp(-ΔE / T)`. Cooling is geometric: `T ← T · 0.9995` per step, with periodic reheats (every ~20k steps `T` is reset to a fraction of the initial `T`) to escape local minima.

### Mode A objective coupling

When energy reaches 0 (feasible), the container is shrunk a small step and annealing continues at the new size:

- Square shape: `s ← s · 0.998`.
- Rect shape: shrink the longer side by `×0.998`. (Random alternation between width and height also tried; longer-side gives slightly tighter rectangles in informal testing.)

Best-feasible container dimensions are remembered. If shrinking makes the system infeasible, annealing tries to recover; if it cannot recover within ~10k steps, the container is restored to the best known feasible size and the search continues.

### Mode B objective coupling

Maintain a current count `n`. Initial `n = floor(W · H)`. If energy stays positive for ~10k steps, drop to `n − 1` (remove a random square). If energy reaches 0 and stays 0 for ~5k steps, try `n + 1` (add a square at a random feasible-looking spot). Best feasible `n` is remembered and shown.

## Rendering

Single `<canvas>` element, sized responsively (container drawn with ~20px margin inside canvas). Each frame:

1. Clear canvas (white background).
2. Stroke the container rectangle (1px black).
3. For each square: `ctx.save(); ctx.translate(cx, cy); ctx.rotate(θ); ctx.strokeRect(-0.5*scale, -0.5*scale, scale, scale); ctx.restore();` — black outline, no fill.
4. The "best so far" layout is stored separately and rendered as a faint grey overlay if it differs from the current state. (Optional; if it adds clutter, drop it.)

A status line below the canvas shows:

- Mode A square: `best: side=3.877  area=15.03  fill=N/area`
- Mode A rect: `best: w=3.10  h=4.85  area=15.03  fill=N/area`
- Mode B: `best: 18 squares fit  fill=18/(W·H)`
- Always: `iter=48,210  T=0.018  feasible ✓/✗`

## UI

Minimal, clean, monochrome (white background, black squares, thin black borders, dark grey text). Sans-serif system font.

```
┌──────────────────────────────────────────────────────────┐
│  Square Packing Solver                                   │
│                                                          │
│  [Min container]  [ Max squares ]      ← tab toggle      │
│                                                          │
│  Mode A:  N: [ 11 ]   Shape: (•) square ( ) rect         │
│  Mode B:  W: [ 5.0 ]  H: [ 7.2 ]                         │
│                                                          │
│  Speed: ▬▬▬●▬▬▬   [ Run ] [ Stop ] [ Reset ]             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│             ┌─────────────────┐                          │
│             │  ◆ ◇ ◆          │   ← canvas               │
│             │   ◇ ◆ ◇         │                          │
│             │  ◆ ◇ ◆          │                          │
│             └─────────────────┘                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  best: side=3.877  area=15.03  fill=73.2%                │
│  iter=48,210  T=0.018  feasible ✓                        │
└──────────────────────────────────────────────────────────┘
```

Only the active mode's controls are visible (the other mode's row is hidden). Defaults: N = 11, shape = square, W = 5, H = 5, speed slider centered.

## Buttons

- **Run** — start (or resume) the annealing loop.
- **Stop** — pause the loop. Squares freeze in place. Run resumes from the same state.
- **Reset** — abandon current state; reinitialize squares at random positions in a generously-sized starting container; reset T to initial value; clear best-so-far.

Changing N, mode, or container shape implicitly resets the solver. Changing the speed slider does not reset.

## Initial layout

When (re)initialized:

- Mode A: container starts at side `s₀ = ⌈√N⌉ + 0.3` (square) or `w₀ = h₀ = ⌈√N⌉ + 0.3` (rect). Squares placed at uniformly random positions inside, with random rotations.
- Mode B: container is the user-specified W×H. Initial count = `floor(W·H)`. Squares placed uniformly at random with random rotations.

Initial temperature `T₀ = 1.0`. (Tunable; pick by short experimentation during implementation.)

## Files

- `packing/index.html` — the entire app: HTML + inline `<style>` + inline `<script>`. No external assets, no build step, no dependencies.

## What is NOT in scope

- No save/load, no URL state, no export PNG.
- No comparison against published optima.
- No worker thread.
- No multiple parallel restarts; a single Reset click is the manual equivalent.
- No mobile-specific layout (the page should still be usable on mobile, but desktop is the target).

## Honest expectations

Simulated annealing is a heuristic. For small N (≤ ~20) it should find good packings within seconds. For larger N it will find decent layouts but not provably optimal ones. The status line says "best" rather than "optimal" — this is deliberate.
