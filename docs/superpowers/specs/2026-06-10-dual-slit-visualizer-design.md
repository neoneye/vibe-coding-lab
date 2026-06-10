# 2D Double-Slit Experiment Visualizer — Design

**Date:** 2026-06-10
**Location:** `2d-dual-slit-experiment/index.html` (single self-contained file, vibe-coding-lab convention)

## Purpose

An interactive page that builds intuition for the double-slit experiment: the
full quantum story. The user watches continuous wave interference, sees single
particles land one at a time and statistically reproduce the wave pattern, and
toggles a which-path detector to watch the fringes collapse.

## Requirements

- Single self-contained `index.html`, vanilla JS, no external dependencies, dark theme.
- Real-time animated wave field with interactive parameter sliders.
- Particle-by-particle detection that accumulates and converges to the wave prediction.
- Which-path detector toggle that switches between coherent and incoherent intensity.
- Light annotations: a short caption that updates with the configuration; no guided tour.

## Layout

- **Main canvas (left, ~70% width):** top-down 2D view. Wave source on the
  left edge, vertical barrier with 1 or 2 slits at mid-field, animated ripples
  rendered cyan-on-dark (brightness encodes amplitude), detection screen along
  the right edge with a live intensity glow.
- **Detection panel (right, ~30%):** vertical strip aligned with the screen:
  1. accumulated particle dots (scatter),
  2. histogram of landings,
  3. theoretical intensity curve overlay.
- **Controls:** slits 1/2 toggle; which-path detector on/off (eye icon drawn at
  the slits when on); sliders for wavelength, slit separation, slit width,
  particle fire rate (0 = waves only); Clear detections; Pause.
- **Caption strip:** 2–3 sentences that update based on (slit count, detector
  state), explaining what the current configuration demonstrates.

## Physics engine: analytic Huygens phasors

- Each slit is modeled as ~15 coherent point sources spanning the slit width.
- ψ(x,y) = Σ e^(ikr)/√r over all sources (2D cylindrical-wave falloff).
- On any parameter change, recompute per-pixel complex amplitude (two
  Float32Arrays: real, imag — equivalently amplitude/phase) once. Per frame,
  rotate the global phase by ωt and render; no per-frame summation.
- **Detector off (coherent):** intensity = |ψ₁ + ψ₂|² → fringes.
- **Detector on (incoherent):** intensity = |ψ₁|² + |ψ₂|² → two overlapping
  single-slit lumps, no fringes. Requires keeping the two slits' fields in
  separate arrays.
- **Screen distribution P(y):** the same phasor sum evaluated at the screen
  column, coherent or incoherent per the detector toggle. Particle landing
  positions are sampled from P(y) by inverse CDF, so dots always match the
  displayed wave prediction.
- Particle visualization: brief flash at the source, then a pop + persistent
  dot at the landing position. Deliberately **no trajectory** is drawn — the
  particle has no path; the caption notes this when relevant.

## Rendering

- Two `<canvas>` elements (main field, detection panel), `requestAnimationFrame` loop.
- Field rendered via `ImageData` from the precomputed arrays; animated term is
  Re(ψ e^(−iωt)) modulated by |ψ| for visual depth.
- Histogram bins ≈ 100 across screen height; theoretical curve scaled to
  histogram area for direct comparison.

## Error handling / edge cases

- Slit separation slider clamped so slits never overlap or leave the barrier.
- Wavelength clamped to ≥ 4 px so ripples stay resolvable at canvas resolution.
- With 1 slit, the detector toggle is disabled (nothing to distinguish).
- Window resize: re-derive canvas sizes and recompute the field.

## Verification

- Visual: fringe spacing on screen must match Δy ≈ λL/d for the current
  parameters (checked at a known setting before completion).
- Detector toggle: fringes visibly collapse to two lumps; histogram follows.
- Open in browser and screenshot per lab convention (`screenshot1.jpg`).

## Out of scope (YAGNI)

- FDTD / transient wavefront mode.
- Guided step-by-step tour.
- Quantum eraser, delayed choice, multi-slit gratings.
- Mobile/touch-optimized layout (desktop-first like sibling projects).
