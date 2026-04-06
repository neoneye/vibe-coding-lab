# Sci-Fi Stick Figure RPG Sidescroller

A standalone HTML page featuring a 2D sidescroller with stick figure characters, sci-fi setting, and FF7-style turn-based combat. Single file, canvas-based, keyboard-only controls.

## Architecture

**Single HTML file** with inline CSS and JS. Canvas rendering at 60fps. Virtual resolution 800x450 scaled to fill the window.

**State machine** with states:
- `TITLE` -- title screen, press key to start
- `EXPLORE` -- sidescroller movement, visible enemies
- `BATTLE_START` -- transition animation into battle
- `BATTLE` -- turn-based menu combat (Attack/Magic/Items/Flee)
- `BATTLE_ANIMATE` -- playing attack/spell animations
- `BATTLE_END` -- victory screen, loot drop
- `LEVEL_TRANSITION` -- screen between levels
- `GAME_OVER` -- death screen, restart option

Each state has `enter()`, `update(dt)`, `render(ctx)`, and `handleInput(key)` functions stored in a states object. The game loop dispatches to the current state.

## Exploration Mode

**Camera:** Follows the player horizontally with slight lead in movement direction. Levels are 3000-5000px wide.

**Player stick figure:** Drawn procedurally on canvas with lines -- head circle, body, arms, legs. Walk animation by cycling leg/arm angles. Faces left/right based on direction.

**Level data structure:** Each level is a data object:
- `width` -- total level length
- `floors` -- array of platform segments `{x, y, width}`
- `enemies` -- array of enemy spawn positions and types
- `background` -- color theme and decoration objects (buildings, crates, terminals)
- `exitX` -- x position that triggers level transition (after all enemies defeated)

**Enemies:** Red stick figures patrolling back and forth on their platform segment. Walking into an enemy's collision box starts a battle.

**HUD overlay:** HP bar, MP bar, current level number, inventory icon.

**Controls:**
- Arrow Left/Right -- move
- Arrow Up -- jump
- Enter -- interact (loot chests, level exit)

## Battle System

**Transition:** Screen flashes white, fades into battle arena with level-appropriate sci-fi backdrop.

**Layout:** Player on left, enemy on right. Battle menu panel at bottom of screen.

**Turn order:** Player first, then simple back-and-forth turns.

**Turn flow:**
1. Player selects action from menu
2. Attack animation plays
3. Damage applied, numbers shown briefly
4. Enemy turn -- enemy picks a random valid action
5. Repeat until one side's HP hits 0

**Menu navigation (keyboard):**
- Left/Right -- cycle top-level options (Attack, Magic, Items, Flee)
- Enter -- select
- Escape -- back out of submenu
- Up/Down -- navigate submenus (spell list, item list)

**Attack:** Basic melee strike. Damage = player attack - enemy defense, +/- 15% random range.

**Magic (costs MP):**
- **EMP Blast** -- tech, medium damage, chance to stun (enemy skips next turn). 10 MP.
- **Plasma Surge** -- tech, high damage. 20 MP.
- **Psi Shield** -- psionic, reduces incoming damage for 3 turns. 15 MP.
- **Mind Drain** -- psionic, damages enemy and restores some MP. 12 MP.

**Items (from inventory, found via loot):**
- **Nano Kit** -- restores 50 HP
- **Energy Cell** -- restores 30 MP
- **Stim Pack** -- boosts attack for current battle
- **EMP Grenade** -- guaranteed stun, single use

**Status effects:**
- **Stun** -- skip next turn
- **Confuse** -- 50% chance attack hits self instead, lasts 2 turns
- **Attack boost** -- +50% attack damage for rest of battle (from Stim Pack)
- **Defense boost** -- incoming damage halved for 3 turns (from Psi Shield)

**Flee:** 60% success chance. Failure gives enemy a free turn.

**Enemy AI:** Random selection from available attacks, weighted toward basic attack. Some enemies have one special move.

## Levels

5 levels with increasing difficulty:

1. **Space Station Corridor** -- dark blue/grey, fluorescent lights, pipes. Easy patrol drones. Tutorial feel.
2. **Cargo Bay** -- crates, containers, dim lighting. Tougher drones + security bots.
3. **Reactor Core** -- orange/red glow, hazard markings. Fire-type enemies, shielded bots.
4. **Alien Habitat** -- green/purple bio-organic, strange flora. Psionic aliens, fast creatures.
5. **Command Bridge** -- sleek, bright. Mix of all enemy types + final boss (Commander AI).

## Enemies

| Enemy | HP | Attack | Defense | Special | Levels |
|---|---|---|---|---|---|
| Patrol Drone | 30 | 8 | 2 | None | 1-2 |
| Security Bot | 50 | 12 | 5 | Shield Bash (stun) | 2-3 |
| Fire Turret | 40 | 15 | 3 | Flame Burst (high dmg) | 3 |
| Psi Lurker | 45 | 10 | 4 | Mind Scramble (confuse) | 4 |
| Xenomorph | 60 | 18 | 6 | Acid Spit | 4-5 |
| Commander AI | 150 | 20 | 10 | All specials, 2 actions/turn | 5 (boss) |

## Loot & Progression

**Player starting stats:** 100 HP, 50 MP, 15 Attack, 5 Defense.

**Loot drops:** Defeated enemies have 40% chance to drop a random consumable item. One guaranteed loot chest per level (mid-level).

**Gear upgrades (from chests):**
- **Laser Blade** (Level 2 chest) -- +5 attack
- **Reflex Armor** (Level 3 chest) -- +3 defense
- **Psi Amplifier** (Level 4 chest) -- magic does 1.5x damage
- **Nano Core** (Level 5 boss drop) -- +30 max HP

## Visuals

**Stick figures:** Canvas line art. Circle for head, lines for body/arms/legs.
- Player: green
- Enemies: red/orange/purple depending on type
- Animations: walk cycle (legs alternate), attack swing (arm arc), hit flash (white frame), death (collapse)

**Parallax backgrounds (2 layers):**
- Far layer: stars/distant structures at 20% scroll speed
- Near layer: level-specific elements (pipes, crates, panels) at 60% speed
- Floor: solid ground with detail lines

**Color palettes:**
1. Space Station: `#0a0a2a` bg, `#3af` accent
2. Cargo Bay: `#1a1a1a` bg, `#fa3` accent
3. Reactor Core: `#2a0a0a` bg, `#f84` accent
4. Alien Habitat: `#0a2a1a` bg, `#a4f` accent
5. Command Bridge: `#0a1a3a` bg, `#fff` accent

**Battle screen:** Flat backdrop matching level palette. Floor line with subtle grid pattern.

**No audio.** Pure canvas/visual experience.

## Controls Summary

| Context | Key | Action |
|---|---|---|
| Explore | Left/Right | Move |
| Explore | Up | Jump |
| Explore | Enter | Interact |
| Battle | Left/Right | Cycle menu options |
| Battle | Up/Down | Navigate submenu |
| Battle | Enter | Select |
| Battle | Escape | Back |
| Title/Game Over | Enter | Start/Restart |
