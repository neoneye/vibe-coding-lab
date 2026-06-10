# BNW 2022 Negative-Weight SSSP — Design

Date: 2026-06-10
Project: `2d-shortest-path/`

## Goal

Replace the existing Bellman-Ford demo (`index.html`) with a self-contained demo of the
Bernstein–Nanongkai–Wulff-Nilsen 2022 algorithm ("Negative-Weight Single-Source Shortest
Paths in Near-linear Time", FOCS 2022 best paper). The implementation is faithful to the
paper's structure — not a simplified sketch — and the visualization steps through the
algorithm's phases.

## Decisions made during brainstorming

- Algorithm: **BNW 2022** (over BCF 2023 and Fineman 2024).
- Deliverable: **replace** the old `index.html` (it was not a good demo).
- Demo focus: **algorithm phases** (LDD clusters, scaling, potentials), not raw speed or a sandbox.
- Fidelity: **faithful** — real ScaleDown recursion, LDD, ElimNeg, verified against Bellman-Ford.

## Architecture

Follows the snake-project pattern (self-contained HTML, engine testable in Node):

- `index.html` — everything in one file:
  - `<script id="shared-code">` block: the pure-JS engine (no DOM access).
  - Visualization code (D3 v7 from CDN) below it.
- `test.mjs` — Node test runner. Extracts the shared-code block from `index.html`,
  evaluates it, and verifies the engine against a reference Bellman-Ford.

## Engine components

All integer edge weights; graph represented as `{ n, edges: [{from, to, weight}] }`
with adjacency lists built internally.

- **`SPmain(graph, source)`** — top level (paper Alg. 2):
  1. Scale all weights by `2n`.
  2. Run rounds of `ScaleDown`, halving the negativity bound `B` each round
     (~`log2(nW)` rounds), accumulating a potential function `φ`.
  3. All reduced weights `w(u,v) + φ(u) − φ(v)` are now ≥ 0; run plain Dijkstra
     with reduced weights.
  4. Return `{ dist, parent }` (shortest-path tree) or `{ negativeCycle }`.

- **`ScaleDown(G, Δ, B)`** — recursive core (paper Alg. 1):
  - Base case (`Δ` small): run `ElimNeg` directly.
  - Otherwise: build the rounded non-negative graph, run **LDD** with diameter
    `~ΔB/2`; Phase 1: recurse on each SCC of the decomposed graph with smaller `Δ`;
    Phase 2: make inter-SCC DAG edges non-negative via potentials from a topological
    order (`FixDAGEdges`); Phase 3: eliminate the remaining LDD-cut negative edges
    with `ElimNeg`.

- **`LDD(G, d)`** — randomized low-diameter decomposition: ball-growing with
  geometrically distributed radii; returns the set of cut edges such that each
  remaining weakly-connected component has weak diameter ≤ d.

- **`ElimNeg(G, φ)`** — Dijkstra/Bellman-Ford hybrid: alternates a Dijkstra pass
  (non-negative edges) with a single relaxation pass over negative edges, repeating
  until no distance changes; produces potentials eliminating the negative edges.

- **Negative cycles**: the paper's main theorem assumes none. Pragmatic guard:
  if a round fails to reduce negativity (or final validation finds a reduced
  weight < 0), report a negative cycle; extract a concrete cycle (walk parent
  pointers from a still-relaxable vertex, Bellman-Ford style) for the viz to
  highlight. Work bounds inside ElimNeg prevent non-termination.

- **Instrumentation**: engine accepts an optional `trace: true` flag and returns a
  structured trace object: per-round `{B, clusters, cuts, phiAfter, minBefore,
  minAfter, stats}` plus final `{settleOrder, parentEdge, phi, negativeCycle}`.
  Tests run with tracing off. The viz replays the trace.

## Visualization

- Random generated graph, ~30–60 nodes, planar-ish layout, mix of negative edges
  (red) and non-negative edges (gray). No negative cycle by construction;
  an **"insert negative cycle"** toggle demos detection.
- **Phase stepper** (step button + auto-play + speed control):
  1. Original graph; negative edges highlighted.
  2. LDD: clusters colored, cut edges dashed.
  3. Recursion: active cluster pulsing, recursion depth indicator.
  4. Potentials: φ values shown on nodes; edge labels switch to reduced weights
     (visibly all ≥ 0).
  5. Final Dijkstra: settle wave from source; shortest-path tree highlighted.
- Info panel: one or two sentences explaining the current phase; legend;
  "New graph" and "Re-run" buttons.

## Testing (`node test.mjs`)

- Reference Bellman-Ford (also used for cycle extraction verification).
- ~500 random graphs across sizes (5–200 nodes), densities, and weight ranges
  (all-negative-capable): BNW distances must exactly equal Bellman-Ford's.
- Graphs with planted negative cycles: both must flag a cycle; the extracted
  cycle must have negative total weight and be a real cycle in the graph.
- Invariant assertion: after SPmain's scaling rounds, every reduced weight ≥ 0.
- Determinism: engine takes an injectable RNG (seeded) so tests are reproducible.

## Out of scope

- The paper's constant-out-degree preprocessing and exact log-factor bookkeeping
  (correctness-relevant structure only; asymptotic constants don't matter here).
- BCF 2023 improvements, Fineman 2024.
- Graph editing UI (sandbox was considered and rejected).
