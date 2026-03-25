# Speed of Light — Relativity of Simultaneity Experiment

## Overview

A standalone interactive HTML page demonstrating how the order of two events (A, B) can depend on the observer's reference frame. Users explore the relativity of simultaneity through an animated physical scene and a synchronized Minkowski spacetime diagram.

## Architecture

Single `index.html` file. No external dependencies. Pure Canvas rendering with `requestAnimationFrame`. Matches existing repo conventions (dark theme, sidebar + main area layout).

## Page Layout

```
┌─────────────┬────────────────────────────────┐
│  SIDEBAR    │  ANIMATED SCENE (canvas)       │
│  (~280px)   │  1D spatial view with observers │
│             │  and flashing events            │
│  Title      ├────────────────────────────────┤
│  Velocity   │  SPACETIME DIAGRAM (canvas)    │
│  slider     │  Minkowski diagram with both    │
│  Presets    │  reference frames               │
│  Info panel │                                │
└─────────────┴────────────────────────────────┘
```

- **Sidebar**: 280px fixed width, `#111827` background, scrollable
- **Main area**: flex-grow, split vertically 50/50 for two canvases
- **Responsive**: canvases resize with window

## Visual Style

Clean minimal: dark background (`#111827`), subtle grid (`rgba(107,114,128,0.15)`), muted gray axes (`#6b7280`), flat event colors (red `#ef4444` for A, blue `#3b82f6` for B). No glow effects. Focus on clarity and readability.

## Components

### 1. Animated Scene (top canvas)

A 1D spatial view showing the physical scenario in real time:

- **Rest frame observer**: labeled circle "S" (stationary) at center
- **Moving frame observer**: labeled circle "M", slides left/right based on velocity
- **Event A** (red dot) and **Event B** (blue dot) at their spatial positions
- **Animation timeline**: spans t = 0 to t = 6 coordinate time, at 1 unit per second wall-clock time, looping continuously. Events flash as a growing/fading circle for 0.3s when the time indicator passes their t-coordinate. Slider changes restart the animation from t = 0.
- **Time indicator** bar at bottom shows current t value
- **Banner** at top: "Observer sees: A then B" / "B then A" / "Simultaneous"
- Desktop-first; mobile not targeted

### 2. Spacetime Diagram (bottom canvas)

Standard Minkowski diagram:

- **Rest frame axes**: solid gray (x horizontal, t vertical)
- **Moving frame axes**: dashed, tilted by `arctan(v/c)` toward light cone
- **Light cone**: 45° yellow dashed lines from origin
- **Event A** (red dot) and **Event B** (blue dot) at (x, t) coordinates
- **Lines of simultaneity**: horizontal in rest frame, tilted in moving frame
- **Connecting line** between events A and B, colored by separation type: teal (`#2dd4bf`) for spacelike (reversible), amber (`#f59e0b`) for timelike (absolute)
- **Coordinate viewport**: fixed range x ∈ [−5, 5], t ∈ [−1, 6], scaled to fit canvas
- Subtle grid in rest frame coordinates

### 3. Sidebar Controls

**Velocity slider**:
- Range: -0.9c to +0.9c, continuous
- Real-time updates to both canvases
- Displays current value as fraction of c

**Preset buttons** (snap events to positions and set slider to a default velocity):

| Preset | Event A (x,t) | Event B (x,t) | Purpose |
|--------|---------------|---------------|---------|
| Simultaneous | (−2, 3) | (2, 3) | Same time in rest frame, different in moving frame |
| Causally connected | (0, 1) | (1, 4) | Timelike — order cannot be reversed |
| Spacelike separated | (−2, 2) | (2, 3) | Spacelike — slider starts at 0.5c to show reversed order immediately |

Each preset shows a brief explanation of what it demonstrates.

**Info panel** (dynamically updated):
- Spacetime interval: s² = −(Δt)² + (Δx)²
- Separation type: Spacelike / Timelike / Lightlike
- Rest frame order: A before B / B before A / Simultaneous
- Moving frame order: same, from Lorentz-transformed times
- Verdict: "Order CAN be reversed" (teal `#2dd4bf`) or "Order is ABSOLUTE" (amber `#f59e0b`)

## Physics Engine

All computations in natural units (c = 1):

- **Lorentz transformation**: t' = γ(t − vx), x' = γ(x − vt)
- **Lorentz factor**: γ = 1/√(1 − v²)
- **Event ordering**: determined by sign of Δt' = γ(Δt − vΔx)
- **Spacetime interval**: s² = −(Δt)² + (Δx)²
  - s² > 0 → spacelike (order reversible)
  - s² < 0 → timelike (order absolute)
  - s² = 0 → lightlike

## Interaction Flow

1. Page loads with "Simultaneous" preset (v = 0)
2. User sees two events at same time in rest frame
3. User drags velocity slider → moving frame axes tilt, lines of simultaneity rotate
4. Animated scene replays showing events in new order
5. Info panel updates verdict in real time
6. User clicks other presets to explore different configurations

## Technology

- Single `index.html`, no build step, no dependencies
- Two `<canvas>` elements, rendered via 2D context
- `requestAnimationFrame` loop for animation
- Standard DOM for sidebar (sliders, buttons, text)
- All state in a single JS object, mutated by slider/preset handlers

## File Structure

```
2d-speed-of-light/
  index.html          # The entire experiment
```
