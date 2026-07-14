# 2D Tesla Valve Rework — Design

**Date:** 2026-07-15
**Directory:** `2d-tesla-valve/`
**Deliverable:** Full rework of the existing self-contained `index.html` + `test.mjs`. The old contents are replaced entirely (git history keeps the previous version).

## Problem

The current page (commits `356f989`, `82935a0`) does not demonstrate a Tesla valve. Its "geometry" is a row of near-closed circles with diagonal tongues hanging from the ceiling above an open lane, and its "fluid" is independent ballistic particles pushed by a constant force. Particles slide along the open bottom lane in **both** directions; the diodicity in its tests comes from particles getting stuck in decorative traps, not from Tesla-valve physics. Visually and physically it is unconvincing.

## Concept

Rebuild the page around a **real fluid simulation** in the **authentic valvular-conduit geometry** from Tesla's 1920 patent (US 1,329,559). Two identical valves run simultaneously in stacked canvases — one pumped forward, one pumped reverse, with the same pump strength. Tracer particles ride the actual computed flow field. The forward stream visibly races along the main channel; the reverse stream is split into the loop branches, redirected back against itself, and visibly chokes. The measured flow rates and their ratio (the **diodicity**) are displayed live and *emerge from the physics* — nothing is scripted.

Plain-language framing for non-engineers: a Tesla valve does not fully block reverse flow; it makes reverse flow much **harder** than forward flow, with no moving parts. The page's intro text says exactly that, and the live ratio quantifies it.

## Decisions (settled during brainstorming)

1. **Simulation approach:** Real fluid sim (lattice-Boltzmann) + tracer particles, not a reworked bouncing-particle demo. Chosen for genuinely emergent, convincing behavior.
2. **Presentation:** Both directions shown at once in two stacked canvases (FORWARD / REVERSE) with a shared diodicity readout — the asymmetry is visible without any interaction.

## Physics

- **Method:** D2Q9 lattice-Boltzmann (BGK collision, bounce-back walls, Guo-style body force). Standard, compact, and stable — well suited to a self-contained JS page with typed arrays (`Float32Array`).
- **Grid:** ~384×128 cells per sim (tunable constants). Two sims ≈ 100k cells total; several LBM steps per animation frame is comfortably real-time in JS.
- **Driving & boundaries:** The channel is **periodic in x** (the valve units sit between straight end runs that wrap around), driven by a constant body force along ±x applied to fluid cells. This avoids fragile inlet/outlet boundary conditions and makes the flow measurement trivial.
- **Measurement:** Volumetric flow rate `Q` = sum of x-velocity across a vertical cross-section in the straight run, time-averaged over a short window. Diodicity = `Q_forward / Q_reverse` (both driven with equal force magnitude).
- **Reynolds number caveat (the key physical risk):** Tesla-valve asymmetry is an inertial effect; at low Re, Stokes flow is reversible and diodicity → 1. The implementation must reach Re ≈ 100+ (relaxation time τ ≈ 0.51–0.56, peak lattice velocity ≈ 0.05–0.15, channel width ≈ 14–20 cells). A dedicated **tuning step** during implementation sweeps pump force (and τ if needed) via a headless script and picks defaults where measured diodicity is strong and the sim is stable. The displayed ratio is whatever the fluid actually does; real valves achieve roughly 1.5–4×, and that is the honest target range.
- **Stability guards:** clamp local velocity; if any cell goes non-finite, the sim auto-resets (and a test asserts this never happens at default settings for a long run).

## Geometry

- Parametric builder `buildValveMask(params) -> {solid: Uint8Array, width, height, probes}` produces a boolean wall/fluid mask.
- Construction: the channel is the union of **thick polyline strokes** (capsules): one main path plus, per valve unit (4–5 units), a **loop branch** that leaves the main path and rejoins it at a sharp angle aimed against the reverse direction — the classic teardrop-island look emerges as the un-stroked region between main path and loop.
- Forward (+x by convention) flow passes the branch mouths smoothly; reverse flow is bisected at each junction, sent around the loop, and re-injected against the oncoming stream.
- Parameters (unit count, channel width, loop radius, branch angles) are constants chosen during tuning; the builder is pure and unit-testable (connectivity, no leaks, mirror-symmetry of the two sims' masks is *not* required — both sims share one mask).

## Components (logical units)

All pure logic lives in the single `<script id="shared-code">` block, mirrored by `test.mjs` (repo convention). Rendering/UI is DOM code, not unit-tested.

- **`geometry`** — `buildValveMask(params)`; helpers for stroking capsules into the grid; flood-fill connectivity check helper.
- **`LBM`** — class holding distributions, mask, force; `step()`, `reset()`, `flowRate(x)` (cross-section flux), `velocityAt(x, y)` (bilinear-sampled), `stats()` (max speed, finite check).
- **`tracers`** — particle pool advected through the LBM velocity field (RK2 or simple substepped Euler); respawn when a particle enters a wall cell, exits, or exceeds max age; deterministic RNG (`makeRng` seeded) for testability.
- **`meter`** — small time-averaging helper for flow rate and diodicity readouts.
- **render/UI (DOM)** — two canvases; per-canvas: wall rendering from the mask, faint speed-field shading inside the channel, tracer dots colored by speed, flow-rate readout, direction arrow; shared: big "≈ N.N× easier forward" readout, controls.

## UI

- Header: title + 2–3 sentence plain-language explanation (one-way *ease*, not one-way *blocking*; no moving parts).
- Two stacked canvases labeled **FORWARD →** and **← REVERSE**, same valve, same pump.
- Controls panel: **Pump strength** slider (maps to body-force magnitude within the tuned stable range), **Tracer count** slider, **Pause**, **Reset**.
- Readout panel: flow rate per direction, live diodicity ratio, note that both valves are identical and equally pumped.
- Dev/screenshot hooks kept from the old page: `?prewarm=N` advances both sims N seconds synchronously before first paint (repo convention for headless screenshots).

## Testing (`test.mjs`)

Mirrors the shared-code block (extract-and-import pattern already used in this repo).

1. **Geometry:** fluid region is a single connected component that wraps x-periodically; channel has no leaks to the outer border walls; min channel width ≥ a threshold.
2. **LBM sanity:** mass conserved to float tolerance over many steps; straight-channel (no valve) flow under body force develops a parabolic-ish profile with positive net flux (Poiseuille sanity).
3. **Stability:** at default settings, 10k+ steps stay finite with bounded max velocity.
4. **Diodicity (the money test):** with identical default settings, time-averaged `Q_forward > 1.5 × Q_reverse` (threshold set conservatively below the tuned value so the test is robust).
5. **Tracers:** advected particles never occupy wall cells; deterministic under a fixed seed.

## Implementation risks

- **Diodicity too weak at reachable Re:** mitigated by the tuning sweep; if the classic geometry underperforms on a coarse grid, increase unit sharpness (branch re-entry angle) or channel Re before compromising on honesty. The test threshold (1.5×) is set after tuning.
- **Performance:** if two 384×128 sims can't hold 60 fps with several substeps, drop to 320×96 and/or fewer substeps — visual smoothness matters more than raw step rate.

## Out of scope

- Particle-size physics from the old page (meaningless for tracers riding a flow field).
- Mobile touch controls beyond what the sliders already give; the page stays a desktop-first demo like the rest of the repo.
