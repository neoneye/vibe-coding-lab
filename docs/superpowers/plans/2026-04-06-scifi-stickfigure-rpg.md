# Sci-Fi Stick Figure RPG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone HTML canvas game -- a sci-fi sidescroller with stick figures and FF7-style turn-based combat across 5 levels.

**Architecture:** Single HTML file with inline CSS/JS. State machine drives game flow (TITLE, EXPLORE, BATTLE states). Canvas renders at 60fps using a virtual 800x450 resolution scaled to fill the window. All game data (levels, enemies, items) defined as JS objects.

**Tech Stack:** Vanilla HTML5 Canvas, no dependencies. Single `game-scifi-rpg/index.html` file.

**Spec:** `docs/superpowers/specs/2026-04-06-scifi-stickfigure-rpg-design.md`

---

## File Structure

- Create: `game-scifi-rpg/index.html` -- the entire game in one file

The file is organized into these logical sections (all inline):
1. HTML + CSS (canvas, body styling)
2. Game constants and data (enemy types, spells, items, level definitions)
3. Utility functions (drawing stick figures, damage calc, etc.)
4. State machine + game loop
5. State implementations (TITLE, EXPLORE, BATTLE_*, LEVEL_TRANSITION, GAME_OVER)
6. Input handling
7. Initialization

---

### Task 1: HTML Skeleton, Canvas, Game Loop, State Machine, Title Screen

**Files:**
- Create: `game-scifi-rpg/index.html`

This task creates the foundational file with a working title screen. After this task, opening the file shows a title screen that responds to Enter.

- [ ] **Step 1: Create the game directory**

```bash
mkdir -p game-scifi-rpg
```

- [ ] **Step 2: Create the HTML file with canvas, CSS, game loop, state machine, and TITLE state**

Create `game-scifi-rpg/index.html` with this content:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sci-Fi Stick RPG</title>
<style>
body { margin: 0; overflow: hidden; background: #000; }
canvas { display: block; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
'use strict';

// ── Canvas Setup ──
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const VW = 800, VH = 450;
let scale = 1, offsetX = 0, offsetY = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const sx = canvas.width / VW, sy = canvas.height / VH;
  scale = Math.min(sx, sy);
  offsetX = (canvas.width - VW * scale) / 2;
  offsetY = (canvas.height - VH * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

// ── Input ──
const keys = {};
const justPressed = {};
window.addEventListener('keydown', e => {
  if (!keys[e.key]) justPressed[e.key] = true;
  keys[e.key] = true;
  e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });
function consumePress(key) {
  if (justPressed[key]) { justPressed[key] = false; return true; }
  return false;
}

// ── State Machine ──
let currentState = null;
const states = {};

function changeState(name, data) {
  currentState = name;
  if (states[name].enter) states[name].enter(data);
}

// ── Game State ──
const player = {
  hp: 100, maxHp: 100, mp: 50, maxMp: 50,
  attack: 15, defense: 5, magicMult: 1,
  x: 100, y: 0, vx: 0, vy: 0, dir: 1, walkTime: 0,
  inventory: [], gear: [],
  level: 1
};

// ── TITLE State ──
states.TITLE = {
  enter() {},
  update(dt) {
    if (consumePress('Enter')) {
      // Reset player for new game
      player.hp = 100; player.maxHp = 100;
      player.mp = 50; player.maxMp = 50;
      player.attack = 15; player.defense = 5; player.magicMult = 1;
      player.x = 100; player.y = 0; player.vx = 0; player.vy = 0;
      player.dir = 1; player.walkTime = 0;
      player.inventory = []; player.gear = [];
      player.level = 1;
      changeState('EXPLORE', { levelIndex: 0 });
    }
  },
  render(ctx) {
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, VW, VH);

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137 + 50) % VW;
      const sy = (i * 97 + 30) % (VH - 100);
      ctx.fillStyle = i % 3 === 0 ? '#3af' : '#fff';
      ctx.globalAlpha = 0.3 + (i % 5) * 0.15;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Title
    ctx.fillStyle = '#3af';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STICK QUEST', VW / 2, 140);

    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText('A Sci-Fi Adventure', VW / 2, 180);

    // Stick figure preview
    drawStickFigure(ctx, VW / 2, 280, '#0f0', 2, 0, 1);

    // Prompt
    const blink = Math.sin(Date.now() / 300) > 0;
    if (blink) {
      ctx.fillStyle = '#3af';
      ctx.font = '18px monospace';
      ctx.fillText('Press ENTER to start', VW / 2, 380);
    }

    ctx.textAlign = 'left';
  }
};

// ── Stick Figure Drawing ──
// x, y = feet position; color; size scale; walkPhase (0-1); dir (1=right, -1=left)
function drawStickFigure(ctx, x, y, color, s, walkPhase, dir) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  const headR = 6 * s;
  const bodyLen = 18 * s;
  const limbLen = 14 * s;

  const headY = y - bodyLen - headR * 2 - limbLen;
  const shoulderY = headY + headR * 2;
  const hipY = shoulderY + bodyLen;

  // Head
  ctx.beginPath();
  ctx.arc(x, headY, headR, 0, Math.PI * 2);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(x, shoulderY);
  ctx.lineTo(x, hipY);
  ctx.stroke();

  // Arms
  const armSwing = Math.sin(walkPhase * Math.PI * 2) * 0.4;
  ctx.beginPath();
  ctx.moveTo(x, shoulderY + 4 * s);
  ctx.lineTo(x + Math.sin(armSwing) * limbLen * dir, shoulderY + 4 * s + Math.cos(armSwing) * limbLen);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, shoulderY + 4 * s);
  ctx.lineTo(x - Math.sin(armSwing) * limbLen * dir, shoulderY + 4 * s + Math.cos(armSwing) * limbLen);
  ctx.stroke();

  // Legs
  const legSwing = Math.sin(walkPhase * Math.PI * 2) * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, hipY);
  ctx.lineTo(x + Math.sin(legSwing) * limbLen * 0.7, hipY + Math.cos(legSwing) * limbLen);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, hipY);
  ctx.lineTo(x - Math.sin(legSwing) * limbLen * 0.7, hipY + Math.cos(legSwing) * limbLen);
  ctx.stroke();
}

// ── Game Loop ──
let lastTime = 0;
function gameLoop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  // Clear justPressed at end of frame after state processes
  const state = states[currentState];
  if (state) {
    state.update(dt);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();
    state.render(ctx);
    ctx.restore();
  }

  Object.keys(justPressed).forEach(k => justPressed[k] = false);
  requestAnimationFrame(gameLoop);
}

// ── Start ──
changeState('TITLE');
requestAnimationFrame(gameLoop);

</script>
</body>
</html>
```

- [ ] **Step 3: Verify title screen works**

Open `game-scifi-rpg/index.html` in a browser.
Expected: Dark blue background with stars, "STICK QUEST" title in cyan, a green stick figure, and blinking "Press ENTER to start" text. Pressing Enter will error in console (EXPLORE state not yet defined) -- that's expected.

- [ ] **Step 4: Commit**

```bash
git add game-scifi-rpg/index.html
git commit -m "feat: add game skeleton with canvas, state machine, and title screen"
```

---

### Task 2: Exploration Mode -- Player Movement, Camera, Level 1

**Files:**
- Modify: `game-scifi-rpg/index.html`

Adds the EXPLORE state with player movement, jumping, gravity, camera following, parallax background, HUD, and Level 1 (Space Station Corridor). After this task, pressing Enter on the title screen loads into a scrollable level where you can walk and jump.

- [ ] **Step 1: Add level data and EXPLORE state**

Insert the following code **above** the `// ── Game Loop ──` comment in `game-scifi-rpg/index.html`:

```javascript
// ── Level Data ──
const LEVELS = [
  { // Level 1: Space Station Corridor
    name: 'Space Station Corridor', width: 3500,
    bg: '#0a0a2a', accent: '#3af', floorColor: '#1a1a3a',
    floors: [{ x: 0, y: 380, w: 3500 }],
    exitX: 3400,
    enemies: [
      { type: 'patrol_drone', x: 600, patrolL: 500, patrolR: 800 },
      { type: 'patrol_drone', x: 1200, patrolL: 1100, patrolR: 1400 },
      { type: 'patrol_drone', x: 2000, patrolL: 1800, patrolR: 2200 },
      { type: 'patrol_drone', x: 2800, patrolL: 2600, patrolR: 3000 },
    ],
    chestX: 1600,
    decorations: [
      { type: 'pipe', x: 200, y: 100, h: 280 },
      { type: 'pipe', x: 800, y: 50, h: 330 },
      { type: 'light', x: 400, y: 340 },
      { type: 'light', x: 1000, y: 340 },
      { type: 'light', x: 1600, y: 340 },
      { type: 'light', x: 2200, y: 340 },
      { type: 'light', x: 2800, y: 340 },
      { type: 'crate', x: 1400, y: 345 },
      { type: 'crate', x: 1430, y: 345 },
      { type: 'crate', x: 1415, y: 310 },
      { type: 'terminal', x: 2400, y: 330 },
    ],
    stars: Array.from({ length: 40 }, (_, i) => ({
      x: (i * 191 + 33) % 3500,
      y: (i * 83 + 17) % 200,
      s: 1 + (i % 3),
      bright: i % 4 === 0,
    })),
    farBuildings: [
      { x: 100, w: 80, h: 120 }, { x: 500, w: 50, h: 160 },
      { x: 900, w: 90, h: 100 }, { x: 1300, w: 60, h: 140 },
      { x: 1800, w: 70, h: 130 }, { x: 2300, w: 100, h: 110 },
      { x: 2700, w: 55, h: 150 }, { x: 3100, w: 80, h: 90 },
    ],
  },
];

// ── Explore State ──
let camera = { x: 0 };
let levelEnemies = [];
let levelChest = null;
let allEnemiesDefeated = false;

states.EXPLORE = {
  enter(data) {
    const lvl = LEVELS[data.levelIndex];
    camera.x = 0;
    player.x = 100;
    player.y = lvl.floors[0].y;
    player.vy = 0;
    player.vx = 0;
    player.walkTime = 0;

    // Spawn enemies
    levelEnemies = lvl.enemies.map(e => ({
      ...e, alive: true, hp: 0, // hp set by type in battle
      dir: 1, walkTime: Math.random() * 10,
      currentX: e.x,
    }));

    // Spawn chest
    levelChest = lvl.chestX ? { x: lvl.chestX, opened: false } : null;

    allEnemiesDefeated = false;
  },

  update(dt) {
    const lvl = LEVELS[player.level - 1];
    const speed = 180;
    const gravity = 900;
    const jumpForce = -350;
    const floorY = lvl.floors[0].y;

    // Player movement
    let moving = false;
    if (keys['ArrowLeft']) { player.vx = -speed; player.dir = -1; moving = true; }
    else if (keys['ArrowRight']) { player.vx = speed; player.dir = 1; moving = true; }
    else { player.vx = 0; }

    if (moving) player.walkTime += dt * 4;
    else player.walkTime = 0;

    // Jump
    if (consumePress('ArrowUp') && player.y >= floorY) {
      player.vy = jumpForce;
    }

    // Gravity
    player.vy += gravity * dt;
    player.y += player.vy * dt;
    if (player.y >= floorY) { player.y = floorY; player.vy = 0; }

    // Horizontal movement
    player.x += player.vx * dt;
    player.x = Math.max(20, Math.min(lvl.width - 20, player.x));

    // Camera follows player with slight lead
    const targetCamX = player.x - VW / 2 + player.dir * 60;
    camera.x += (targetCamX - camera.x) * 4 * dt;
    camera.x = Math.max(0, Math.min(lvl.width - VW, camera.x));

    // Enemy patrol
    for (const e of levelEnemies) {
      if (!e.alive) continue;
      e.currentX += e.dir * 40 * dt;
      e.walkTime += dt * 3;
      if (e.currentX > e.patrolR) { e.currentX = e.patrolR; e.dir = -1; }
      if (e.currentX < e.patrolL) { e.currentX = e.patrolL; e.dir = 1; }

      // Collision with player
      if (Math.abs(player.x - e.currentX) < 25 && player.y >= floorY - 10) {
        changeState('BATTLE_START', { enemy: e });
        return;
      }
    }

    allEnemiesDefeated = levelEnemies.every(e => !e.alive);

    // Interact with chest
    if (consumePress('Enter') && levelChest && !levelChest.opened) {
      if (Math.abs(player.x - levelChest.x) < 40) {
        levelChest.opened = true;
        // Loot handled in Task 9
      }
    }

    // Level exit
    if (consumePress('Enter') && allEnemiesDefeated && player.x > lvl.exitX - 40) {
      changeState('LEVEL_TRANSITION', { nextLevel: player.level });
      return;
    }
  },

  render(ctx) {
    const lvl = LEVELS[player.level - 1];
    const cx = camera.x;

    // Background
    ctx.fillStyle = lvl.bg;
    ctx.fillRect(0, 0, VW, VH);

    // Far layer: stars
    for (const s of lvl.stars) {
      const sx = s.x - cx * 0.2;
      if (sx < -10 || sx > VW + 10) continue;
      ctx.fillStyle = s.bright ? lvl.accent : '#668';
      ctx.globalAlpha = 0.4 + (s.s - 1) * 0.2;
      ctx.fillRect(sx, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // Far layer: buildings silhouettes
    for (const b of lvl.farBuildings) {
      const bx = b.x - cx * 0.2;
      if (bx < -b.w || bx > VW + 10) continue;
      ctx.fillStyle = lvl.bg === '#0a0a2a' ? '#111133' : '#222';
      ctx.fillRect(bx, lvl.floors[0].y - b.h, b.w, b.h);
      ctx.strokeStyle = lvl.accent;
      ctx.globalAlpha = 0.3;
      ctx.strokeRect(bx, lvl.floors[0].y - b.h, b.w, b.h);
      ctx.globalAlpha = 1;
    }

    // Near layer: decorations
    for (const d of lvl.decorations) {
      const dx = d.x - cx * 0.6;
      if (dx < -100 || dx > VW + 100) continue;
      ctx.globalAlpha = 0.6;
      if (d.type === 'pipe') {
        ctx.strokeStyle = lvl.accent;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(dx, d.y); ctx.lineTo(dx, d.y + d.h); ctx.stroke();
        ctx.lineWidth = 2;
      } else if (d.type === 'light') {
        ctx.fillStyle = lvl.accent;
        ctx.fillRect(dx - 15, d.y, 30, 3);
        ctx.globalAlpha = 0.15;
        ctx.fillRect(dx - 20, d.y + 3, 40, 40);
      } else if (d.type === 'crate') {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(dx, d.y, 30, 35);
        ctx.strokeStyle = lvl.accent;
        ctx.strokeRect(dx, d.y, 30, 35);
      } else if (d.type === 'terminal') {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(dx, d.y, 20, 50);
        ctx.fillStyle = lvl.accent;
        ctx.fillRect(dx + 3, d.y + 5, 14, 10);
      }
      ctx.globalAlpha = 1;
    }

    // Floor
    ctx.fillStyle = lvl.floorColor;
    ctx.fillRect(0, lvl.floors[0].y, VW, VH - lvl.floors[0].y);
    ctx.strokeStyle = lvl.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, lvl.floors[0].y); ctx.lineTo(VW, lvl.floors[0].y); ctx.stroke();

    // Floor detail lines
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = lvl.accent;
    for (let fx = -cx % 80; fx < VW; fx += 80) {
      ctx.beginPath(); ctx.moveTo(fx, lvl.floors[0].y + 10); ctx.lineTo(fx + 40, lvl.floors[0].y + 10); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Chest
    if (levelChest) {
      const chX = levelChest.x - cx;
      if (chX > -30 && chX < VW + 30) {
        ctx.fillStyle = levelChest.opened ? '#555' : '#fa0';
        ctx.fillRect(chX - 12, lvl.floors[0].y - 20, 24, 20);
        ctx.strokeStyle = levelChest.opened ? '#777' : '#ff0';
        ctx.strokeRect(chX - 12, lvl.floors[0].y - 20, 24, 20);
        if (!levelChest.opened) {
          ctx.fillStyle = '#ff0';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('?', chX, lvl.floors[0].y - 6);
          ctx.textAlign = 'left';
        }
      }
    }

    // Exit indicator
    if (allEnemiesDefeated) {
      const ex = lvl.exitX - cx;
      if (ex > -30 && ex < VW + 30) {
        ctx.fillStyle = lvl.accent;
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 200) * 0.3;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT >', ex, lvl.floors[0].y - 30);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
    }

    // Enemies
    for (const e of levelEnemies) {
      if (!e.alive) continue;
      const ex = e.currentX - cx;
      if (ex < -30 || ex > VW + 30) continue;
      const eColor = '#f44';
      drawStickFigure(ctx, ex, lvl.floors[0].y, eColor, 1.5, e.walkTime, e.dir);
    }

    // Player
    const px = player.x - cx;
    drawStickFigure(ctx, px, player.y, '#0f0', 1.8, player.walkTime, player.dir);

    // HUD
    renderHUD(ctx);
  }
};

function renderHUD(ctx) {
  // HP Bar
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(10, 10, 160, 40);
  ctx.strokeStyle = '#3af';
  ctx.strokeRect(10, 10, 160, 40);

  ctx.fillStyle = '#0f0';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('HP', 16, 26);
  ctx.fillStyle = '#300';
  ctx.fillRect(40, 15, 120, 12);
  ctx.fillStyle = '#0f0';
  ctx.fillRect(40, 15, 120 * (player.hp / player.maxHp), 12);

  // MP Bar
  ctx.fillStyle = '#48f';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('MP', 16, 42);
  ctx.fillStyle = '#003';
  ctx.fillRect(40, 31, 120, 12);
  ctx.fillStyle = '#48f';
  ctx.fillRect(40, 31, 120 * (player.mp / player.maxMp), 12);

  // Level indicator
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('Level ' + player.level, VW - 16, 26);
  ctx.textAlign = 'left';
}
```

- [ ] **Step 2: Verify exploration mode works**

Open `game-scifi-rpg/index.html` in browser. Press Enter on title screen.
Expected: Player spawns in a dark blue sci-fi corridor. Arrow Left/Right moves the stick figure, Arrow Up jumps. Camera follows. Parallax stars and buildings scroll at different speeds. Red enemy stick figures patrol. HUD shows HP/MP bars top-left, level number top-right. Walking into an enemy will error (BATTLE_START not yet defined) -- expected.

- [ ] **Step 3: Commit**

```bash
git add game-scifi-rpg/index.html
git commit -m "feat: add exploration mode with player, camera, enemies, and Level 1"
```

---

### Task 3: Battle System Core -- Transition, Layout, Menu, Attack, Enemy Turn

**Files:**
- Modify: `game-scifi-rpg/index.html`

Adds BATTLE_START transition, BATTLE state with full menu navigation, Attack action, damage calculation, enemy AI turn, BATTLE_ANIMATE state, and BATTLE_END state. After this task, walking into an enemy triggers a full battle with Attack working.

- [ ] **Step 1: Add enemy type definitions and battle data**

Insert the following **above** the `// ── Level Data ──` comment:

```javascript
// ── Enemy Types ──
const ENEMY_TYPES = {
  patrol_drone: {
    name: 'Patrol Drone', hp: 30, attack: 8, defense: 2,
    color: '#f44', specials: [], xpLabel: 'LV.1'
  },
  security_bot: {
    name: 'Security Bot', hp: 50, attack: 12, defense: 5,
    color: '#f84', specials: [{ name: 'Shield Bash', damage: 10, effect: 'stun', chance: 0.3 }],
    xpLabel: 'LV.2'
  },
  fire_turret: {
    name: 'Fire Turret', hp: 40, attack: 15, defense: 3,
    color: '#f64', specials: [{ name: 'Flame Burst', damage: 22, effect: null, chance: 0.25 }],
    xpLabel: 'LV.3'
  },
  psi_lurker: {
    name: 'Psi Lurker', hp: 45, attack: 10, defense: 4,
    color: '#a4f', specials: [{ name: 'Mind Scramble', damage: 8, effect: 'confuse', chance: 0.3 }],
    xpLabel: 'LV.3'
  },
  xenomorph: {
    name: 'Xenomorph', hp: 60, attack: 18, defense: 6,
    color: '#f4a', specials: [{ name: 'Acid Spit', damage: 20, effect: null, chance: 0.3 }],
    xpLabel: 'LV.4'
  },
  commander_ai: {
    name: 'Commander AI', hp: 150, attack: 20, defense: 10,
    color: '#fff', boss: true, actionsPerTurn: 2,
    specials: [
      { name: 'Shield Bash', damage: 10, effect: 'stun', chance: 0.2 },
      { name: 'Flame Burst', damage: 22, effect: null, chance: 0.2 },
      { name: 'Mind Scramble', damage: 8, effect: 'confuse', chance: 0.2 },
      { name: 'Acid Spit', damage: 20, effect: null, chance: 0.2 },
    ],
    xpLabel: 'BOSS'
  },
};

// ── Spells ──
const SPELLS = [
  { name: 'EMP Blast', cost: 10, damage: 18, effect: 'stun', effectChance: 0.5, type: 'tech' },
  { name: 'Plasma Surge', cost: 20, damage: 35, effect: null, effectChance: 0, type: 'tech' },
  { name: 'Psi Shield', cost: 15, damage: 0, effect: 'defenseBoost', effectChance: 1, type: 'psionic' },
  { name: 'Mind Drain', cost: 12, damage: 15, mpRestore: 10, effect: null, effectChance: 0, type: 'psionic' },
];

// ── Items ──
const ITEM_TYPES = {
  nano_kit: { name: 'Nano Kit', desc: 'Restore 50 HP', type: 'heal', value: 50 },
  energy_cell: { name: 'Energy Cell', desc: 'Restore 30 MP', type: 'mp', value: 30 },
  stim_pack: { name: 'Stim Pack', desc: 'Boost ATK this battle', type: 'buff', effect: 'attackBoost' },
  emp_grenade: { name: 'EMP Grenade', desc: 'Stun enemy', type: 'stun', effect: 'stun' },
};

// ── Gear ──
const GEAR_TYPES = {
  laser_blade: { name: 'Laser Blade', desc: '+5 Attack', stat: 'attack', value: 5 },
  reflex_armor: { name: 'Reflex Armor', desc: '+3 Defense', stat: 'defense', value: 3 },
  psi_amplifier: { name: 'Psi Amplifier', desc: '1.5x Magic', stat: 'magicMult', value: 1.5, set: true },
  nano_core: { name: 'Nano Core', desc: '+30 Max HP', stat: 'maxHp', value: 30 },
};
```

- [ ] **Step 2: Add battle state variables and helper functions**

Insert the following **above** the `// ── Explore State ──` comment:

```javascript
// ── Battle State ──
let battleEnemy = null;  // { ...ENEMY_TYPE data, currentHp }
let battleEnemyRef = null; // reference to levelEnemies entry
let battleMenu = { top: 0, sub: -1, subMenu: null }; // menu cursor
let battleTurn = 'player'; // 'player' | 'enemy'
let battleLog = [];  // array of { text, timer }
let battleAnim = null; // { type, timer, ... }
let playerEffects = { stun: 0, confuse: 0, attackBoost: false, defenseBoost: 0 };
let enemyEffects = { stun: 0 };
let battleLoot = null;

const BATTLE_MENU_ITEMS = ['Attack', 'Magic', 'Items', 'Flee'];

function calcDamage(atk, def) {
  const base = Math.max(1, atk - def);
  const variance = base * 0.15;
  return Math.round(base + (Math.random() * variance * 2 - variance));
}

function addBattleLog(text) {
  battleLog.push({ text, timer: 2 });
}
```

- [ ] **Step 3: Add BATTLE_START, BATTLE, BATTLE_ANIMATE, and BATTLE_END states**

Insert the following **above** the `function renderHUD` line:

```javascript
// ── BATTLE_START State ──
let battleStartTimer = 0;

states.BATTLE_START = {
  enter(data) {
    battleStartTimer = 0;
    battleEnemyRef = data.enemy;
    const etype = ENEMY_TYPES[data.enemy.type];
    battleEnemy = { ...etype, currentHp: etype.hp };
    battleMenu = { top: 0, sub: -1, subMenu: null };
    battleTurn = 'player';
    battleLog = [];
    battleAnim = null;
    battleLoot = null;
    playerEffects = { stun: 0, confuse: 0, attackBoost: false, defenseBoost: 0 };
    enemyEffects = { stun: 0 };
  },
  update(dt) {
    battleStartTimer += dt;
    if (battleStartTimer > 0.6) changeState('BATTLE');
  },
  render(ctx) {
    // Flash white then fade
    const t = battleStartTimer / 0.6;
    const lvl = LEVELS[player.level - 1];
    ctx.fillStyle = lvl.bg;
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = `rgba(255,255,255,${1 - t})`;
    ctx.fillRect(0, 0, VW, VH);
  }
};

// ── BATTLE State ──
states.BATTLE = {
  enter() {},

  update(dt) {
    // Update log timers
    battleLog = battleLog.filter(l => { l.timer -= dt; return l.timer > 0; });

    if (battleAnim) return; // animation playing, wait

    // Check win/lose
    if (battleEnemy.currentHp <= 0) {
      changeState('BATTLE_END', { won: true });
      return;
    }
    if (player.hp <= 0) {
      changeState('GAME_OVER');
      return;
    }

    // Enemy turn
    if (battleTurn === 'enemy') {
      doEnemyTurn();
      return;
    }

    // Player turn -- menu input
    if (battleMenu.subMenu === null) {
      // Top-level menu
      if (consumePress('ArrowLeft')) battleMenu.top = (battleMenu.top - 1 + 4) % 4;
      if (consumePress('ArrowRight')) battleMenu.top = (battleMenu.top + 1) % 4;
      if (consumePress('Enter')) {
        if (battleMenu.top === 0) { // Attack
          doPlayerAttack();
        } else if (battleMenu.top === 1) { // Magic
          battleMenu.subMenu = 'magic';
          battleMenu.sub = 0;
        } else if (battleMenu.top === 2) { // Items
          battleMenu.subMenu = 'items';
          battleMenu.sub = 0;
        } else if (battleMenu.top === 3) { // Flee
          doFlee();
        }
      }
    } else {
      // Sub-menu navigation
      if (consumePress('Escape')) {
        battleMenu.subMenu = null;
        battleMenu.sub = -1;
        return;
      }
      const list = battleMenu.subMenu === 'magic' ? SPELLS : player.inventory;
      if (list.length === 0) {
        addBattleLog('Nothing available!');
        battleMenu.subMenu = null;
        battleMenu.sub = -1;
        return;
      }
      if (consumePress('ArrowUp')) battleMenu.sub = (battleMenu.sub - 1 + list.length) % list.length;
      if (consumePress('ArrowDown')) battleMenu.sub = (battleMenu.sub + 1) % list.length;
      if (consumePress('Enter')) {
        if (battleMenu.subMenu === 'magic') {
          doPlayerMagic(battleMenu.sub);
        } else {
          doPlayerItem(battleMenu.sub);
        }
      }
    }
  },

  render(ctx) {
    renderBattleScene(ctx);
  }
};

function doPlayerAttack() {
  // Confuse check
  if (playerEffects.confuse > 0 && Math.random() < 0.5) {
    const dmg = calcDamage(player.attack, player.defense);
    player.hp = Math.max(0, player.hp - dmg);
    addBattleLog('Confused! Hit yourself for ' + dmg + '!');
    playerEffects.confuse--;
    battleAnim = { type: 'playerHit', timer: 0.5 };
    setTimeout(() => { battleAnim = null; battleTurn = 'enemy'; }, 500);
    return;
  }

  let atk = player.attack;
  if (playerEffects.attackBoost) atk = Math.floor(atk * 1.5);
  const dmg = calcDamage(atk, battleEnemy.defense);
  battleEnemy.currentHp = Math.max(0, battleEnemy.currentHp - dmg);
  addBattleLog('Attack! ' + dmg + ' damage!');
  battleAnim = { type: 'playerAttack', timer: 0.5 };
  setTimeout(() => { battleAnim = null; battleTurn = 'enemy'; }, 500);
}

function doPlayerMagic(index) {
  const spell = SPELLS[index];
  if (player.mp < spell.cost) {
    addBattleLog('Not enough MP!');
    return;
  }
  player.mp -= spell.cost;
  battleMenu.subMenu = null;

  if (spell.damage > 0) {
    let dmg = Math.round(spell.damage * player.magicMult);
    battleEnemy.currentHp = Math.max(0, battleEnemy.currentHp - dmg);
    addBattleLog(spell.name + '! ' + dmg + ' damage!');
  }
  if (spell.mpRestore) {
    player.mp = Math.min(player.maxMp, player.mp + spell.mpRestore);
    addBattleLog('Restored ' + spell.mpRestore + ' MP!');
  }
  if (spell.effect === 'stun' && Math.random() < spell.effectChance) {
    enemyEffects.stun = 1;
    addBattleLog('Enemy stunned!');
  }
  if (spell.effect === 'defenseBoost') {
    playerEffects.defenseBoost = 3;
    addBattleLog('Defense boosted for 3 turns!');
  }

  battleAnim = { type: 'magic', timer: 0.6 };
  setTimeout(() => { battleAnim = null; battleTurn = 'enemy'; }, 600);
}

function doPlayerItem(index) {
  if (player.inventory.length === 0) return;
  const item = player.inventory[index];
  player.inventory.splice(index, 1);
  battleMenu.subMenu = null;

  if (item.type === 'heal') {
    player.hp = Math.min(player.maxHp, player.hp + item.value);
    addBattleLog('Used ' + item.name + '! +' + item.value + ' HP');
  } else if (item.type === 'mp') {
    player.mp = Math.min(player.maxMp, player.mp + item.value);
    addBattleLog('Used ' + item.name + '! +' + item.value + ' MP');
  } else if (item.type === 'buff') {
    playerEffects.attackBoost = true;
    addBattleLog('Used ' + item.name + '! ATK boosted!');
  } else if (item.type === 'stun') {
    enemyEffects.stun = 1;
    addBattleLog('Used ' + item.name + '! Enemy stunned!');
  }

  battleAnim = { type: 'item', timer: 0.4 };
  setTimeout(() => { battleAnim = null; battleTurn = 'enemy'; }, 400);
}

function doFlee() {
  if (Math.random() < 0.6) {
    addBattleLog('Escaped!');
    setTimeout(() => { changeState('EXPLORE', { levelIndex: player.level - 1 }); }, 600);
  } else {
    addBattleLog('Failed to flee!');
    battleTurn = 'enemy';
  }
}

function doEnemyTurn() {
  // Stun check
  if (enemyEffects.stun > 0) {
    enemyEffects.stun--;
    addBattleLog(battleEnemy.name + ' is stunned!');
    battleAnim = { type: 'enemyStun', timer: 0.5 };
    setTimeout(() => { battleAnim = null; battleTurn = 'player'; decrementPlayerEffects(); }, 500);
    return;
  }

  const actions = battleEnemy.boss ? (battleEnemy.actionsPerTurn || 1) : 1;
  let delay = 0;

  for (let a = 0; a < actions; a++) {
    setTimeout(() => {
      if (player.hp <= 0) return;
      // Choose action: basic attack or special
      let useSpecial = false;
      let special = null;
      if (battleEnemy.specials.length > 0) {
        for (const s of battleEnemy.specials) {
          if (Math.random() < s.chance) { useSpecial = true; special = s; break; }
        }
      }

      let def = player.defense;
      if (playerEffects.defenseBoost > 0) def = Math.floor(def * 2);

      if (useSpecial) {
        const dmg = calcDamage(special.damage, def);
        player.hp = Math.max(0, player.hp - dmg);
        addBattleLog(battleEnemy.name + ' uses ' + special.name + '! ' + dmg + ' damage!');
        if (special.effect === 'stun') playerEffects.stun = 1;
        if (special.effect === 'confuse') playerEffects.confuse = 2;
      } else {
        const dmg = calcDamage(battleEnemy.attack, def);
        player.hp = Math.max(0, player.hp - dmg);
        addBattleLog(battleEnemy.name + ' attacks! ' + dmg + ' damage!');
      }

      battleAnim = { type: 'enemyAttack', timer: 0.5 };
    }, delay);
    delay += 600;
  }

  setTimeout(() => {
    battleAnim = null;
    decrementPlayerEffects();
    battleTurn = 'player';
  }, delay);
}

function decrementPlayerEffects() {
  if (playerEffects.defenseBoost > 0) playerEffects.defenseBoost--;
  if (playerEffects.confuse > 0) playerEffects.confuse--;
}

// ── BATTLE_END State ──
let battleEndTimer = 0;

states.BATTLE_END = {
  enter(data) {
    battleEndTimer = 0;
    battleEnemyRef.alive = false;

    // Loot drop (40% chance)
    battleLoot = null;
    if (Math.random() < 0.4) {
      const itemKeys = Object.keys(ITEM_TYPES);
      const key = itemKeys[Math.floor(Math.random() * itemKeys.length)];
      battleLoot = { ...ITEM_TYPES[key] };
      player.inventory.push(battleLoot);
    }
  },
  update(dt) {
    battleEndTimer += dt;
    if (consumePress('Enter') && battleEndTimer > 0.5) {
      changeState('EXPLORE', { levelIndex: player.level - 1 });
    }
  },
  render(ctx) {
    renderBattleScene(ctx);

    // Victory overlay
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', VW / 2, 160);

    if (battleLoot) {
      ctx.fillStyle = '#fa0';
      ctx.font = '18px monospace';
      ctx.fillText('Loot: ' + battleLoot.name, VW / 2, 210);
    } else {
      ctx.fillStyle = '#888';
      ctx.font = '18px monospace';
      ctx.fillText('No loot dropped', VW / 2, 210);
    }

    ctx.fillStyle = '#3af';
    ctx.font = '14px monospace';
    ctx.fillText('Press ENTER to continue', VW / 2, 280);
    ctx.textAlign = 'left';
  }
};

// ── Battle Rendering ──
function renderBattleScene(ctx) {
  const lvl = LEVELS[player.level - 1];

  // Background
  ctx.fillStyle = lvl.bg;
  ctx.fillRect(0, 0, VW, VH);

  // Grid floor
  ctx.strokeStyle = lvl.accent;
  ctx.globalAlpha = 0.15;
  const floorY = 320;
  for (let gx = 0; gx < VW; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, floorY); ctx.lineTo(gx, VH); ctx.stroke();
  }
  for (let gy = floorY; gy < VH; gy += 20) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(VW, gy); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Floor line
  ctx.strokeStyle = lvl.accent;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(VW, floorY); ctx.stroke();

  // Player stick figure (left side)
  const pAnim = battleAnim && battleAnim.type === 'playerAttack' ? 0.5 : 0;
  drawStickFigure(ctx, 180, floorY, '#0f0', 2.5, pAnim, 1);

  // Hit flash on player
  if (battleAnim && battleAnim.type === 'enemyAttack') {
    ctx.fillStyle = 'rgba(255,0,0,0.3)';
    ctx.fillRect(130, floorY - 100, 100, 100);
  }

  // Enemy stick figure (right side)
  if (battleEnemy.currentHp > 0) {
    drawStickFigure(ctx, 600, floorY, battleEnemy.color, 2.5, 0, -1);

    // Hit flash on enemy
    if (battleAnim && (battleAnim.type === 'playerAttack' || battleAnim.type === 'magic')) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(550, floorY - 100, 100, 100);
    }

    // Enemy name + HP
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(battleEnemy.name + ' ' + battleEnemy.xpLabel, 600, floorY - 100);

    ctx.fillStyle = '#300';
    ctx.fillRect(540, floorY - 90, 120, 8);
    ctx.fillStyle = '#f44';
    ctx.fillRect(540, floorY - 90, 120 * (battleEnemy.currentHp / battleEnemy.hp), 8);
    ctx.textAlign = 'left';
  }

  // Battle menu panel
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 350, VW, 100);
  ctx.strokeStyle = lvl.accent;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 350); ctx.lineTo(VW, 350); ctx.stroke();

  // Top-level menu
  const menuY = 372;
  const menuW = 120;
  const menuStartX = (VW - 4 * menuW - 30) / 2;
  const symbols = ['⚔', '✧', '◆', '↺'];
  const colors = [lvl.accent, '#a4f', '#4fa', '#888'];

  for (let i = 0; i < 4; i++) {
    const mx = menuStartX + i * (menuW + 10);
    const selected = battleMenu.top === i && battleMenu.subMenu === null;
    ctx.fillStyle = selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(mx, menuY - 14, menuW, 28);
    ctx.strokeStyle = selected ? '#fff' : colors[i];
    ctx.strokeRect(mx, menuY - 14, menuW, 28);
    ctx.fillStyle = selected ? '#fff' : colors[i];
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(symbols[i] + ' ' + BATTLE_MENU_ITEMS[i], mx + menuW / 2, menuY + 4);
  }
  ctx.textAlign = 'left';

  // Sub-menu
  if (battleMenu.subMenu === 'magic') {
    renderSubMenu(ctx, SPELLS.map(s => s.name + ' (' + s.cost + 'MP)'), battleMenu.sub, menuStartX + menuW + 10, 340);
  } else if (battleMenu.subMenu === 'items') {
    const names = player.inventory.map(i => i.name);
    renderSubMenu(ctx, names.length > 0 ? names : ['(empty)'], battleMenu.sub, menuStartX + 2 * (menuW + 10), 340);
  }

  // Player stats in battle menu
  ctx.fillStyle = '#0f0';
  ctx.font = '11px monospace';
  ctx.fillText('HP ' + player.hp + '/' + player.maxHp + '  MP ' + player.mp + '/' + player.maxMp, 16, 438);

  // Status effects
  let statusX = 200;
  ctx.font = '10px monospace';
  if (playerEffects.attackBoost) { ctx.fillStyle = '#fa0'; ctx.fillText('ATK↑', statusX, 438); statusX += 45; }
  if (playerEffects.defenseBoost > 0) { ctx.fillStyle = '#4fa'; ctx.fillText('DEF↑' + playerEffects.defenseBoost, statusX, 438); statusX += 50; }
  if (playerEffects.confuse > 0) { ctx.fillStyle = '#f4f'; ctx.fillText('CONFUSED', statusX, 438); statusX += 70; }

  // Battle log
  ctx.font = '12px monospace';
  for (let i = 0; i < battleLog.length; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, battleLog[i].timer)})`;
    ctx.textAlign = 'right';
    ctx.fillText(battleLog[i].text, VW - 16, 438 - i * 16);
  }
  ctx.textAlign = 'left';
}

function renderSubMenu(ctx, items, selected, x, bottomY) {
  const h = items.length * 24 + 10;
  const y = bottomY - h;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(x, y, 180, h);
  ctx.strokeStyle = '#3af';
  ctx.strokeRect(x, y, 180, h);

  for (let i = 0; i < items.length; i++) {
    const iy = y + 8 + i * 24;
    if (i === selected) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x + 2, iy - 4, 176, 22);
    }
    ctx.fillStyle = i === selected ? '#fff' : '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText((i === selected ? '> ' : '  ') + items[i], x + 8, iy + 12);
  }
}
```

- [ ] **Step 2: Add placeholder states for LEVEL_TRANSITION and GAME_OVER**

Insert the following **above** the `// ── Battle Rendering ──` comment:

```javascript
// ── LEVEL_TRANSITION State ──
let transTimer = 0;

states.LEVEL_TRANSITION = {
  enter(data) {
    transTimer = 0;
    player.level = data.nextLevel + 1;
  },
  update(dt) {
    transTimer += dt;
    if (consumePress('Enter') && transTimer > 0.5) {
      if (player.level > LEVELS.length) {
        changeState('VICTORY');
      } else {
        changeState('EXPLORE', { levelIndex: player.level - 1 });
      }
    }
  },
  render(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#3af';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Level ' + player.level, VW / 2, 180);
    if (player.level <= LEVELS.length) {
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.fillText(LEVELS[player.level - 1].name, VW / 2, 220);
    }
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Press ENTER', VW / 2, 300);
    ctx.textAlign = 'left';
  }
};

// ── GAME_OVER State ──
states.GAME_OVER = {
  enter() {},
  update(dt) {
    if (consumePress('Enter')) changeState('TITLE');
  },
  render(ctx) {
    ctx.fillStyle = '#1a0000';
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', VW / 2, 180);
    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.fillText('Press ENTER to return to title', VW / 2, 240);
    ctx.textAlign = 'left';
  }
};

// ── VICTORY State ──
states.VICTORY = {
  enter() {},
  update(dt) {
    if (consumePress('Enter')) changeState('TITLE');
  },
  render(ctx) {
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU WIN!', VW / 2, 160);
    ctx.fillStyle = '#3af';
    ctx.font = '18px monospace';
    ctx.fillText('The station is secure.', VW / 2, 210);
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Press ENTER for title screen', VW / 2, 280);
    ctx.textAlign = 'left';
  }
};
```

- [ ] **Step 3: Fix the flee EXPLORE re-entry**

The `doFlee` function calls `changeState('EXPLORE', ...)` which currently re-initializes enemies. Change the `EXPLORE.enter` function so it can re-enter without respawning enemies when returning from a fled battle. Replace the `states.EXPLORE.enter` function body:

```javascript
  enter(data) {
    const lvl = LEVELS[data.levelIndex];
    if (!data.returning) {
      camera.x = 0;
      player.x = 100;
      player.y = lvl.floors[0].y;
      player.vy = 0;
      player.vx = 0;
      player.walkTime = 0;

      levelEnemies = lvl.enemies.map(e => ({
        ...e, alive: true,
        dir: 1, walkTime: Math.random() * 10,
        currentX: e.x,
      }));

      levelChest = lvl.chestX ? { x: lvl.chestX, opened: false } : null;
      allEnemiesDefeated = false;
    } else {
      // Returning from fled battle -- move player slightly away
      player.x += player.dir * 60;
    }
  },
```

Then update the `doFlee` and `BATTLE_END` enter functions to pass `returning: true`:

In `doFlee`, change the changeState call to:
```javascript
setTimeout(() => { changeState('EXPLORE', { levelIndex: player.level - 1, returning: true }); }, 600);
```

In `states.BATTLE_END.update`, change the changeState call to:
```javascript
changeState('EXPLORE', { levelIndex: player.level - 1, returning: true });
```

- [ ] **Step 4: Verify full battle flow**

Open in browser. Walk into a red enemy.
Expected: Screen flashes white, then battle screen appears. You see your green stick figure on the left, red enemy on the right with name and HP bar. Bottom panel has Attack/Magic/Items/Flee menu. Left/Right cycles, Enter selects Attack. Damage numbers appear in battle log. Enemy attacks back. When enemy HP hits 0, "VICTORY!" overlay with possible loot drop. Press Enter returns to exploration. If player HP hits 0, red GAME OVER screen appears.

- [ ] **Step 5: Commit**

```bash
git add game-scifi-rpg/index.html
git commit -m "feat: add complete battle system with attack, magic, items, flee, and enemy AI"
```

---

### Task 4: Loot Chests, Gear Upgrades, and Inventory Integration

**Files:**
- Modify: `game-scifi-rpg/index.html`

Adds gear drops from chests (one guaranteed per level), gear equipping (auto-applied stat boosts), and chest interaction in exploration mode. After this task, pressing Enter near a chest gives a gear item that boosts stats.

- [ ] **Step 1: Add chest gear mapping per level**

Insert the following after the `GEAR_TYPES` object definition:

```javascript
const LEVEL_CHEST_GEAR = [
  null,            // Level 1: no gear (just consumable)
  'laser_blade',   // Level 2
  'reflex_armor',  // Level 3
  'psi_amplifier', // Level 4
  null,            // Level 5: boss drops nano_core
];
```

- [ ] **Step 2: Update chest interaction in EXPLORE state**

In the `states.EXPLORE.update` function, find the chest interaction block (`// Interact with chest`) and replace it with:

```javascript
    // Interact with chest
    if (consumePress('Enter') && levelChest && !levelChest.opened) {
      if (Math.abs(player.x - levelChest.x) < 40) {
        levelChest.opened = true;
        const gearKey = LEVEL_CHEST_GEAR[player.level - 1];
        if (gearKey && !player.gear.includes(gearKey)) {
          const gear = GEAR_TYPES[gearKey];
          player.gear.push(gearKey);
          if (gear.set) {
            player[gear.stat] = gear.value; // set directly (magicMult)
          } else {
            player[gear.stat] += gear.value; // add to stat
          }
          if (gear.stat === 'maxHp') player.hp += gear.value; // also heal the bonus
          levelChest.lootName = gear.name;
        } else {
          // Give a random consumable
          const itemKeys = Object.keys(ITEM_TYPES);
          const key = itemKeys[Math.floor(Math.random() * itemKeys.length)];
          player.inventory.push({ ...ITEM_TYPES[key] });
          levelChest.lootName = ITEM_TYPES[key].name;
        }
        levelChest.showTimer = 2;
      }
    }
```

- [ ] **Step 3: Add loot popup rendering in exploration**

In `states.EXPLORE.render`, after the chest rendering block, add:

```javascript
    // Chest loot popup
    if (levelChest && levelChest.showTimer > 0) {
      levelChest.showTimer -= 1/60; // approximate
      const chX = levelChest.x - cx;
      ctx.fillStyle = `rgba(250,170,0,${Math.min(1, levelChest.showTimer)})`;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Got: ' + levelChest.lootName + '!', chX, lvl.floors[0].y - 45);
      ctx.textAlign = 'left';
    }
```

- [ ] **Step 4: Add boss loot (Nano Core) to BATTLE_END**

In `states.BATTLE_END.enter`, after the random loot drop block, add:

```javascript
    // Boss drops Nano Core
    if (battleEnemy.boss && !player.gear.includes('nano_core')) {
      const gear = GEAR_TYPES.nano_core;
      player.gear.push('nano_core');
      player[gear.stat] += gear.value;
      player.hp += gear.value;
      battleLoot = { name: gear.name + ' (GEAR)' };
    }
```

- [ ] **Step 5: Verify chest and gear system**

Open in browser, play through Level 1. Find the chest (mid-level, golden box with "?"). Press Enter near it.
Expected: Chest turns grey, popup shows what you got. Since Level 1 has no gear, it gives a random consumable. The item appears in your Items menu during the next battle.

- [ ] **Step 6: Commit**

```bash
git add game-scifi-rpg/index.html
git commit -m "feat: add loot chests, gear upgrades, and inventory system"
```

---

### Task 5: Levels 2-5 with Enemy Variety and Boss Fight

**Files:**
- Modify: `game-scifi-rpg/index.html`

Adds level data for levels 2-5, each with unique palette, decorations, enemy types, and the Commander AI boss on Level 5. After this task, the full 5-level game is playable from start to finish.

- [ ] **Step 1: Add levels 2-5 to the LEVELS array**

Append these objects inside the `LEVELS` array, after the Level 1 object:

```javascript
  { // Level 2: Cargo Bay
    name: 'Cargo Bay', width: 3800,
    bg: '#1a1a1a', accent: '#fa3', floorColor: '#2a2a1a',
    floors: [{ x: 0, y: 380, w: 3800 }],
    exitX: 3700,
    enemies: [
      { type: 'patrol_drone', x: 500, patrolL: 400, patrolR: 700 },
      { type: 'security_bot', x: 1100, patrolL: 1000, patrolR: 1300 },
      { type: 'patrol_drone', x: 1800, patrolL: 1600, patrolR: 2000 },
      { type: 'security_bot', x: 2500, patrolL: 2300, patrolR: 2700 },
      { type: 'security_bot', x: 3200, patrolL: 3000, patrolR: 3400 },
    ],
    chestX: 1900,
    decorations: [
      { type: 'crate', x: 300, y: 345 }, { type: 'crate', x: 330, y: 345 },
      { type: 'crate', x: 315, y: 310 }, { type: 'crate', x: 700, y: 345 },
      { type: 'crate', x: 1300, y: 345 }, { type: 'crate', x: 1330, y: 345 },
      { type: 'crate', x: 2100, y: 345 }, { type: 'crate', x: 2130, y: 345 },
      { type: 'crate', x: 2115, y: 310 }, { type: 'crate', x: 2145, y: 310 },
      { type: 'light', x: 600, y: 340 }, { type: 'light', x: 1500, y: 340 },
      { type: 'light', x: 2400, y: 340 }, { type: 'light', x: 3300, y: 340 },
    ],
    stars: Array.from({ length: 20 }, (_, i) => ({
      x: (i * 211 + 50) % 3800, y: (i * 67 + 10) % 150, s: 1 + (i % 2), bright: i % 5 === 0,
    })),
    farBuildings: [
      { x: 200, w: 100, h: 80 }, { x: 600, w: 70, h: 100 },
      { x: 1100, w: 120, h: 70 }, { x: 1700, w: 80, h: 110 },
      { x: 2200, w: 90, h: 90 }, { x: 2800, w: 110, h: 75 },
      { x: 3300, w: 60, h: 120 },
    ],
  },
  { // Level 3: Reactor Core
    name: 'Reactor Core', width: 4000,
    bg: '#2a0a0a', accent: '#f84', floorColor: '#3a1a0a',
    floors: [{ x: 0, y: 380, w: 4000 }],
    exitX: 3900,
    enemies: [
      { type: 'security_bot', x: 600, patrolL: 450, patrolR: 750 },
      { type: 'fire_turret', x: 1200, patrolL: 1100, patrolR: 1350 },
      { type: 'fire_turret', x: 2000, patrolL: 1850, patrolR: 2150 },
      { type: 'security_bot', x: 2700, patrolL: 2550, patrolR: 2850 },
      { type: 'fire_turret', x: 3400, patrolL: 3250, patrolR: 3550 },
    ],
    chestX: 2100,
    decorations: [
      { type: 'pipe', x: 400, y: 80, h: 300 }, { type: 'pipe', x: 900, y: 120, h: 260 },
      { type: 'pipe', x: 1600, y: 60, h: 320 }, { type: 'pipe', x: 2400, y: 100, h: 280 },
      { type: 'pipe', x: 3100, y: 70, h: 310 },
      { type: 'terminal', x: 800, y: 330 }, { type: 'terminal', x: 1800, y: 330 },
      { type: 'terminal', x: 3000, y: 330 },
      { type: 'light', x: 500, y: 340 }, { type: 'light', x: 1400, y: 340 },
      { type: 'light', x: 2300, y: 340 }, { type: 'light', x: 3200, y: 340 },
    ],
    stars: Array.from({ length: 15 }, (_, i) => ({
      x: (i * 277 + 40) % 4000, y: (i * 53 + 20) % 120, s: 1 + (i % 2), bright: i % 3 === 0,
    })),
    farBuildings: [
      { x: 300, w: 60, h: 140 }, { x: 800, w: 80, h: 100 },
      { x: 1400, w: 100, h: 160 }, { x: 2000, w: 70, h: 130 },
      { x: 2600, w: 90, h: 110 }, { x: 3200, w: 50, h: 170 },
    ],
  },
  { // Level 4: Alien Habitat
    name: 'Alien Habitat', width: 4200,
    bg: '#0a2a1a', accent: '#a4f', floorColor: '#1a3a2a',
    floors: [{ x: 0, y: 380, w: 4200 }],
    exitX: 4100,
    enemies: [
      { type: 'psi_lurker', x: 700, patrolL: 550, patrolR: 850 },
      { type: 'psi_lurker', x: 1500, patrolL: 1350, patrolR: 1650 },
      { type: 'xenomorph', x: 2200, patrolL: 2050, patrolR: 2400 },
      { type: 'psi_lurker', x: 2900, patrolL: 2750, patrolR: 3100 },
      { type: 'xenomorph', x: 3600, patrolL: 3450, patrolR: 3800 },
    ],
    chestX: 2400,
    decorations: [
      { type: 'pipe', x: 300, y: 200, h: 180 }, { type: 'pipe', x: 1000, y: 150, h: 230 },
      { type: 'pipe', x: 1800, y: 180, h: 200 }, { type: 'pipe', x: 2600, y: 160, h: 220 },
      { type: 'pipe', x: 3400, y: 190, h: 190 },
      { type: 'light', x: 500, y: 340 }, { type: 'light', x: 1200, y: 340 },
      { type: 'light', x: 2000, y: 340 }, { type: 'light', x: 3000, y: 340 },
      { type: 'light', x: 3800, y: 340 },
    ],
    stars: Array.from({ length: 30 }, (_, i) => ({
      x: (i * 151 + 70) % 4200, y: (i * 71 + 15) % 180, s: 1 + (i % 3), bright: i % 4 === 0,
    })),
    farBuildings: [
      { x: 200, w: 90, h: 100 }, { x: 700, w: 60, h: 140 },
      { x: 1300, w: 110, h: 80 }, { x: 1900, w: 75, h: 120 },
      { x: 2500, w: 100, h: 90 }, { x: 3100, w: 65, h: 150 },
      { x: 3700, w: 85, h: 110 },
    ],
  },
  { // Level 5: Command Bridge
    name: 'Command Bridge', width: 5000,
    bg: '#0a1a3a', accent: '#fff', floorColor: '#1a2a4a',
    floors: [{ x: 0, y: 380, w: 5000 }],
    exitX: 4900,
    enemies: [
      { type: 'security_bot', x: 600, patrolL: 450, patrolR: 750 },
      { type: 'xenomorph', x: 1300, patrolL: 1100, patrolR: 1500 },
      { type: 'fire_turret', x: 2000, patrolL: 1850, patrolR: 2200 },
      { type: 'psi_lurker', x: 2800, patrolL: 2600, patrolR: 3000 },
      { type: 'xenomorph', x: 3500, patrolL: 3300, patrolR: 3700 },
      { type: 'commander_ai', x: 4500, patrolL: 4300, patrolR: 4700 },
    ],
    chestX: 2500,
    decorations: [
      { type: 'terminal', x: 400, y: 330 }, { type: 'terminal', x: 1000, y: 330 },
      { type: 'terminal', x: 1700, y: 330 }, { type: 'terminal', x: 2400, y: 330 },
      { type: 'terminal', x: 3100, y: 330 }, { type: 'terminal', x: 3800, y: 330 },
      { type: 'terminal', x: 4400, y: 330 },
      { type: 'light', x: 300, y: 340 }, { type: 'light', x: 900, y: 340 },
      { type: 'light', x: 1500, y: 340 }, { type: 'light', x: 2100, y: 340 },
      { type: 'light', x: 2700, y: 340 }, { type: 'light', x: 3300, y: 340 },
      { type: 'light', x: 3900, y: 340 }, { type: 'light', x: 4500, y: 340 },
    ],
    stars: Array.from({ length: 50 }, (_, i) => ({
      x: (i * 107 + 25) % 5000, y: (i * 89 + 12) % 200, s: 1 + (i % 3), bright: i % 3 === 0,
    })),
    farBuildings: [
      { x: 200, w: 70, h: 130 }, { x: 700, w: 100, h: 90 },
      { x: 1200, w: 60, h: 160 }, { x: 1800, w: 90, h: 110 },
      { x: 2400, w: 80, h: 140 }, { x: 3000, w: 110, h: 80 },
      { x: 3600, w: 70, h: 150 }, { x: 4200, w: 95, h: 100 },
    ],
  },
```

- [ ] **Step 2: Verify all 5 levels are playable**

Open in browser. Play through or test by modifying `player.level` in console.
Expected: Each level has its distinct color palette. Level 2 has crates and amber tones. Level 3 has pipes and red glow. Level 4 has purple accents. Level 5 is bright with white accents and ends with Commander AI boss. After beating the boss, VICTORY screen shows.

- [ ] **Step 3: Commit**

```bash
git add game-scifi-rpg/index.html
git commit -m "feat: add levels 2-5 with unique themes, enemies, and boss fight"
```

---

### Task 6: Polish -- Damage Numbers, Animations, and Controls Hint

**Files:**
- Modify: `game-scifi-rpg/index.html`

Adds floating damage numbers in battle, a controls hint on the title screen, an "enemies remaining" indicator, and smooth stick figure attack animations. After this task, the game is complete and polished.

- [ ] **Step 1: Add floating damage numbers system**

Add the following variable after the `let battleLoot = null;` line:

```javascript
let floatingNumbers = []; // { text, x, y, vy, timer, color }
```

Add this function after `addBattleLog`:

```javascript
function addFloatingNumber(text, x, y, color) {
  floatingNumbers.push({ text, x, y, vy: -60, timer: 1.2, color });
}
```

In `renderBattleScene`, right before the `// Battle menu panel` comment, add:

```javascript
  // Floating damage numbers
  for (let i = floatingNumbers.length - 1; i >= 0; i--) {
    const fn = floatingNumbers[i];
    fn.y += fn.vy * (1/60);
    fn.timer -= 1/60;
    if (fn.timer <= 0) { floatingNumbers.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, fn.timer * 2);
    ctx.fillStyle = fn.color;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(fn.text, fn.x, fn.y);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
```

Then update the damage-dealing functions to spawn floating numbers. In `doPlayerAttack`, after the line `addBattleLog('Attack! ' + dmg + ' damage!');`, add:

```javascript
  addFloatingNumber('-' + dmg, 600, 240, '#ff4');
```

In `doPlayerAttack`'s confuse block, after `addBattleLog('Confused!...')`, add:

```javascript
  addFloatingNumber('-' + dmg, 180, 240, '#f4f');
```

In `doPlayerMagic`, after the damage log line (`addBattleLog(spell.name + '!...')`), add:

```javascript
    addFloatingNumber('-' + dmg, 600, 240, '#a4f');
```

In `doEnemyTurn`, after each `player.hp = Math.max(0, player.hp - dmg)` line (both special and basic attack), add:

```javascript
      addFloatingNumber('-' + dmg, 180, 240, '#f44');
```

In the `doPlayerItem` heal block, after the HP restore, add:

```javascript
    addFloatingNumber('+' + item.value, 180, 240, '#0f0');
```

In the `doPlayerItem` MP block, after the MP restore, add:

```javascript
    addFloatingNumber('+' + item.value, 180, 240, '#48f');
```

- [ ] **Step 2: Add controls hint to title screen**

In `states.TITLE.render`, before the final `ctx.textAlign = 'left';`, add:

```javascript
    ctx.fillStyle = '#556';
    ctx.font = '12px monospace';
    ctx.fillText('Arrow Keys: Move  |  Enter: Select  |  Esc: Back', VW / 2, 420);
```

- [ ] **Step 3: Add enemies-remaining indicator to exploration HUD**

In `renderHUD`, after the level indicator block, add:

```javascript
  // Enemies remaining
  const alive = levelEnemies.filter(e => e.alive).length;
  ctx.fillStyle = alive > 0 ? '#f44' : '#0f0';
  ctx.textAlign = 'right';
  ctx.fillText(alive > 0 ? 'Enemies: ' + alive : 'All clear!', VW - 16, 44);
  ctx.textAlign = 'left';
```

- [ ] **Step 4: Clear floating numbers on battle start**

In `states.BATTLE_START.enter`, add:

```javascript
    floatingNumbers = [];
```

- [ ] **Step 5: Verify everything works end-to-end**

Open in browser and play through. 
Expected: Title screen shows controls hint. Exploration shows enemies remaining. Battles show floating damage numbers (yellow for player attacks, purple for magic, red for enemy damage, green for healing). Full game flows from title -> 5 levels -> victory.

- [ ] **Step 6: Commit**

```bash
git add game-scifi-rpg/index.html
git commit -m "feat: add floating damage numbers, HUD polish, and controls hint"
```

---

### Task 7: Final Integration Test and README

**Files:**
- Modify: `game-scifi-rpg/index.html` (if any fixes needed)

Full playthrough verification. No code changes expected unless bugs are found.

- [ ] **Step 1: Full playthrough test**

Open `game-scifi-rpg/index.html` in browser and verify:

1. **Title screen:** Shows title, stick figure, blinking prompt, controls hint. Enter starts game.
2. **Level 1 exploration:** Walk left/right, jump, camera follows, parallax scrolling, enemies patrol, HUD shows HP/MP/level/enemies count.
3. **Battle trigger:** Walking into enemy starts battle with flash transition.
4. **Battle - Attack:** Select Attack, damage dealt to enemy, floating number appears, enemy attacks back.
5. **Battle - Magic:** Open Magic submenu (Up/Down to navigate), cast EMP Blast (costs 10 MP, may stun), Plasma Surge (20 MP, high damage), Psi Shield (15 MP, defense boost icon appears), Mind Drain (12 MP, damages + restores MP).
6. **Battle - Items:** Use Nano Kit (heals HP), Energy Cell (restores MP), Stim Pack (ATK boost icon), EMP Grenade (stuns enemy).
7. **Battle - Flee:** 60% chance to escape. Failure gives enemy free turn.
8. **Victory screen:** Shows loot if dropped, press Enter returns to exploration.
9. **Chest:** Mid-level golden box, press Enter to open, shows what you got.
10. **Level exit:** After all enemies defeated, "EXIT >" marker appears at end of level. Press Enter to transition.
11. **Level transition:** Shows next level name, press Enter to continue.
12. **All 5 levels:** Each has distinct color theme and enemy types.
13. **Boss fight (Level 5):** Commander AI has 150 HP, 2 actions per turn, uses all special attacks.
14. **Victory:** After boss, level transition leads to "YOU WIN!" screen.
15. **Game Over:** If HP hits 0, red game over screen, Enter returns to title.
16. **New game:** Starting over resets all stats, inventory, and gear.

- [ ] **Step 2: Fix any bugs found during playthrough**

Address any issues discovered. Common things to check:
- Menu cursor wraps correctly
- Escape backs out of submenus
- Items are consumed when used
- Gear bonuses persist between battles
- Status effects decrement correctly

- [ ] **Step 3: Commit any fixes**

```bash
git add game-scifi-rpg/index.html
git commit -m "fix: address playthrough issues"
```

(Skip this step if no fixes were needed.)
