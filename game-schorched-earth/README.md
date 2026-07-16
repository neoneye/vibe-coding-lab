# Scorched Earth

A standalone turn-based artillery game in the spirit of the 1991 classic.
Pure HTML + JS + CSS — no backend, no build step, no dependencies, no assets.

## Run

Open `index.html` in any modern browser. That's it.

## Play

- **2–4 tanks** per battle, each slot **Human or AI** — so 0, 1, or 2+ human
  players. Humans share the keyboard (hotseat). Presets: *1P vs AI*,
  *2P Hotseat*, *AI Battle* (watch the CPUs fight).
- Pick a **country** per tank (Iran, Ukraine, Russia, USA, …) — the flag is
  painted on the hull. Cosmetic only; everyone fights fair.
- Matches run 1, 3, or 5 rounds; last tank alive wins the round.

## Controls

| Key | Action |
|---|---|
| ← / → | Aim left / right (hold to sweep, Shift for fine) |
| ↑ / ↓ | Power up / down |
| Tab / Shift+Tab | Cycle weapon |
| Space | Fire |
| M | Toggle sound |
| F | Fullscreen |
| Esc | Leave fullscreen, else quit to menu |

The HUD buttons mirror everything for mouse play.

## Weapons

Baby Missile (unlimited) · Missile ×10 · Big Nuke ×2 · Dirt Bomb ×3 (piles
dirt instead of damage) · Roller ×5 (rolls downhill before detonating) ·
MIRV ×2 (splits into 5 warheads at apex). Ammo replenishes every round.

Wind changes each turn and bends every shot. Terrain is fully destructible;
tanks undermined by a blast fall and take fall damage.

## Development

Core math (terrain, ballistics, AI) is pure functions — sanity-check with:

```bash
node check.js
```
