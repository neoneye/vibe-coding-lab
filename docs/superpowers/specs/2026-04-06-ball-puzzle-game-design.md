# Ball Puzzle Game — Design Spec

A standalone HTML canvas game inspired by Super Monkey Ball and Marble Madness. The player steers a ball across floating platforms by tilting the world, avoiding falls and navigating narrow bridges to reach a goal.

## Technology

- Single `index.html` file, all code inline
- Three.js loaded from CDN (rendering, camera, lighting, geometry)
- Custom lightweight physics (no physics engine dependency)
- No textures — flat-shaded geometry with bold colors

## Controls

| Input | Action |
|-------|--------|
| Arrow keys | Tilt the world (~5° max on each axis) |
| Space | Jump (only when grounded) |
| R | Restart level |

Tilt-the-world mechanic: arrow keys adjust the world's rotation, shifting the effective gravity vector. The ball rolls naturally due to gravity, not direct movement. Releasing keys returns tilt to neutral with damping.

## Physics Model

### Ball
- Sphere with position and velocity vectors
- Damping/friction applied each frame to prevent infinite sliding
- Visual spin derived from velocity direction (cosmetic only, not simulated)

### Gravity & Tilt
- Base gravity: downward (negative Y)
- Arrow keys rotate the world on X and Z axes (up to ~5°)
- Effective gravity = base gravity rotated by current tilt angles
- Tilt returns to zero when keys released (spring-like damping)

### Collision Detection
- Ball vs. platform: axis-aligned bounding box (AABB) checks
- When ball overlaps a platform top surface: snap ball Y to platform top, zero downward velocity, mark as grounded
- Bumper collision: reflect ball velocity along bumper normal with energy loss

### Jump
- Space key adds upward velocity impulse when ball is grounded
- Grounded flag cleared on jump, re-set on platform landing
- Single jump only (no double jump)

### Fall Detection
- If ball.y drops below a threshold (e.g., -20), trigger game over
- No recovery — falling is terminal

## Visual Style — Marble Madness

Flat-shaded geometric surfaces with bold, distinct colors. No textures.

| Element | Appearance |
|---------|-----------|
| Ball | Red sphere with Phong shading, specular highlight |
| Platforms | Blue/gray flat-shaded boxes, slight height variation for visual interest |
| Narrow bridges | Same material as platforms but narrower geometry |
| Bumpers | Green raised edges along platform sides |
| Goal | Yellow glowing beacon/marker (emissive material or point light) |
| Background | Dark gradient (deep blue/purple), no skybox |
| Lighting | One directional light (sun) + ambient light for consistent flat-shaded look |

## Camera

- Third-person follow camera, positioned behind and above the ball
- Smooth interpolation (lerp) to avoid jarring movement
- Camera looks at ball position
- Does not rotate with world tilt — stays fixed orientation so the player sees the world tilting

## Level 1 Layout

A linear path with increasing difficulty:

1. **Start platform** — wide, safe area where ball spawns. Bumpers on all edges.
2. **Narrow bridge 1** — straight, no bumpers. Tests basic balance.
3. **Medium platform** — wider area with bumpers on left/right edges. A rest point.
4. **Narrow bridge 2** — angled/curved. Harder to navigate.
5. **Final platform** — wide area with the goal marker.

Level is defined as an array of platform objects, each with position, size, and optional bumper configuration. This makes it easy to add more levels later.

```
[START]
   |
===+===          Wide starting platform (bumpers all sides)
   |
---+---          Narrow bridge (no bumpers)
   |
===+===+===      Medium platform (bumpers left/right)
        |
     ---+---     Narrow bridge (angled)
        |
     ===+===     Final platform
        |
     [GOAL]
```

## Game States

```
READY ──(any key)──▶ PLAYING ──(reach goal)──▶ WIN
                        │                        │
                        ▼                        │
                   (fall off)                    │
                        │                        │
                        ▼                        │
                    GAME OVER ◀──────────────────┘
                        │
                      (R key)
                        │
                        ▼
                      READY
```

### State Details

- **READY**: Ball at start position. Camera shows the level. HUD displays "Press any key to start". World tilt disabled.
- **PLAYING**: Full control. HUD shows timer (optional). Physics active.
- **WIN**: Ball reached goal area. HUD displays "You Win! Press R to restart". Freeze ball. Optional celebration effect (ball glow or particles).
- **GAME OVER**: Ball fell below threshold. HUD displays "Game Over! Press R to restart". Camera stays at last position.

## HUD

Minimal overlay using HTML elements positioned over the canvas:

- Game state messages (center screen, large text)
- Controls hint at bottom: "Arrow keys: Tilt | Space: Jump | R: Restart"
- Optional: timer showing elapsed seconds during PLAYING state

## File Structure

```
game-ball-puzzle/
  index.html    # Everything — HTML, CSS, JS, game code
```

## Future Extensibility (not in scope now)

- Multiple levels with progression
- Moving platforms
- Collectibles/scoring
- Level editor
- Mobile touch controls
