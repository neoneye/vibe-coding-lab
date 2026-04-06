# Ball Puzzle Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file 3D ball puzzle game where the player tilts the world to roll a ball across floating platforms, Marble Madness style.

**Architecture:** Single `index.html` with inline CSS and JS. Three.js from CDN handles rendering. Custom physics handles gravity/tilt/collision. Level defined as data (array of platform objects). Game loop via `requestAnimationFrame`.

**Tech Stack:** Three.js (CDN), vanilla JS, HTML5 Canvas/WebGL

**Spec:** `docs/superpowers/specs/2026-04-06-ball-puzzle-game-design.md`

---

### Task 1: HTML Scaffold + Three.js Scene

**Files:**
- Create: `game-ball-puzzle/index.html`

Set up the HTML page, Three.js scene, camera, lighting, and a spinning red ball to verify rendering works.

- [ ] **Step 1: Create the HTML file with Three.js scene**

Create `game-ball-puzzle/index.html` with this content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ball Puzzle</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0a0a2e; overflow: hidden; font-family: 'Courier New', monospace; color: #fff; }
canvas { display: block; }
#hud { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; flex-direction: column; }
#message { font-size: 36px; text-shadow: 0 0 20px rgba(255,255,255,0.5); display: none; }
#controls-hint { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); text-align: center; color: #556; font-size: 13px; }
</style>
</head>
<body>
<div id="hud">
  <div id="message"></div>
  <div id="controls-hint">Arrow keys: Tilt | Space: Jump | R: Restart</div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
'use strict';

// ── Scene Setup ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a2e);
scene.fog = new THREE.FogExp2(0x0a0a2e, 0.015);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ── Camera ──
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 8, 12);
camera.lookAt(0, 0, 0);

// ── Lighting ──
const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
scene.add(dirLight);

// ── Ball ──
const ballRadius = 0.5;
const ballGeo = new THREE.SphereGeometry(ballRadius, 24, 24);
const ballMat = new THREE.MeshPhongMaterial({
  color: 0xcc2222,
  specular: 0xff6666,
  shininess: 60,
  flatShading: false
});
const ball = new THREE.Mesh(ballGeo, ballMat);
ball.castShadow = true;
ball.position.set(0, 2, 0);
scene.add(ball);

// ── Resize ──
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Render Loop (placeholder) ──
function animate() {
  requestAnimationFrame(animate);
  ball.rotation.x += 0.01;
  ball.rotation.z += 0.005;
  renderer.render(scene, camera);
}
animate();
</script>
</body>
</html>
```

- [ ] **Step 2: Open in browser to verify**

Open `game-ball-puzzle/index.html` in a browser. You should see:
- Dark blue background with fog
- A red shiny sphere slowly rotating in the center
- Controls hint text at the bottom

- [ ] **Step 3: Commit**

```bash
git add game-ball-puzzle/index.html
git commit -m "feat: scaffold ball puzzle game with Three.js scene and ball"
```

---

### Task 2: Level Geometry

**Files:**
- Modify: `game-ball-puzzle/index.html`

Add the level data structure and render platforms, bumpers, and the goal marker.

- [ ] **Step 1: Add the world group and level data**

Insert after the ball code (after `scene.add(ball);`), before the resize handler:

```javascript
// ── World Group (tilts as a unit) ──
const world = new THREE.Group();
scene.add(world);
world.add(ball);

// ── Level Data ──
const levelData = {
  platforms: [
    { x: 0, y: 0, z: 0, w: 6, h: 0.5, d: 6, bumpers: ['left','right','front','back'] },
    { x: 0, y: 0, z: -8, w: 1.5, h: 0.5, d: 6, bumpers: [] },
    { x: 0, y: 0, z: -15, w: 5, h: 0.5, d: 5, bumpers: ['left','right'] },
    { x: 3, y: 0, z: -21, w: 1.5, h: 0.5, d: 7, bumpers: [] },
    { x: 6, y: 0, z: -27, w: 6, h: 0.5, d: 6, bumpers: ['left','right','front','back'] },
  ],
  start: { x: 0, y: 1, z: 0 },
  goal: { x: 6, y: 0.5, z: -27 }
};
```

- [ ] **Step 2: Add platform and bumper rendering**

Insert after the level data:

```javascript
// ── Build Level Geometry ──
const platformMat = new THREE.MeshPhongMaterial({
  color: 0x4477aa,
  flatShading: true,
  specular: 0x222244,
  shininess: 10
});

const bumperMat = new THREE.MeshPhongMaterial({
  color: 0x44bb44,
  flatShading: true,
  specular: 0x226622,
  shininess: 20
});

const platforms = []; // store for collision

levelData.platforms.forEach(p => {
  // Platform box
  const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
  const mesh = new THREE.Mesh(geo, platformMat);
  mesh.position.set(p.x, p.y, p.z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  world.add(mesh);

  // Store collision data
  platforms.push({
    mesh,
    minX: p.x - p.w / 2, maxX: p.x + p.w / 2,
    topY: p.y + p.h / 2,
    minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2,
    w: p.w, h: p.h, d: p.d,
    bumpers: p.bumpers
  });

  // Bumpers (thin raised edges)
  const bumperH = 0.4;
  const bumperW = 0.2;
  const sides = {
    left:  { pos: [p.x - p.w/2 + bumperW/2, p.y + p.h/2 + bumperH/2, p.z], size: [bumperW, bumperH, p.d] },
    right: { pos: [p.x + p.w/2 - bumperW/2, p.y + p.h/2 + bumperH/2, p.z], size: [bumperW, bumperH, p.d] },
    front: { pos: [p.x, p.y + p.h/2 + bumperH/2, p.z + p.d/2 - bumperW/2], size: [p.w, bumperH, bumperW] },
    back:  { pos: [p.x, p.y + p.h/2 + bumperH/2, p.z - p.d/2 + bumperW/2], size: [p.w, bumperH, bumperW] },
  };

  p.bumpers.forEach(side => {
    const s = sides[side];
    const bGeo = new THREE.BoxGeometry(s.size[0], s.size[1], s.size[2]);
    const bMesh = new THREE.Mesh(bGeo, bumperMat);
    bMesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
    bMesh.castShadow = true;
    world.add(bMesh);
  });
});

// ── Goal Marker ──
const goalGeo = new THREE.CylinderGeometry(0.3, 0.5, 1.5, 6);
const goalMat = new THREE.MeshPhongMaterial({
  color: 0xffdd44,
  emissive: 0xffaa00,
  emissiveIntensity: 0.5,
  flatShading: true
});
const goalMesh = new THREE.Mesh(goalGeo, goalMat);
goalMesh.position.set(levelData.goal.x, levelData.goal.y + 0.75, levelData.goal.z);
goalMesh.castShadow = true;
world.add(goalMesh);

// Goal light
const goalLight = new THREE.PointLight(0xffdd44, 1, 8);
goalLight.position.set(levelData.goal.x, levelData.goal.y + 2, levelData.goal.z);
world.add(goalLight);
```

- [ ] **Step 3: Update ball to be inside world group and at start position**

The ball was already added to `world` above. Update its starting position. Find the line `ball.position.set(0, 2, 0);` and change it to:

```javascript
ball.position.set(levelData.start.x, levelData.start.y, levelData.start.z);
```

Note: since `ball` is now added to `world` group (in step 1), remove the earlier `scene.add(ball)` line — the ball is added to `world` instead.

- [ ] **Step 4: Make goal marker rotate in the render loop**

In the `animate()` function, add before `renderer.render`:

```javascript
goalMesh.rotation.y += 0.02;
```

- [ ] **Step 5: Open in browser to verify**

You should see:
- Five blue platforms floating in space
- Green bumper edges on the first, third, and fifth platforms
- A rotating yellow hexagonal beacon on the last platform
- The red ball sitting on the first platform

- [ ] **Step 6: Commit**

```bash
git add game-ball-puzzle/index.html
git commit -m "feat: add level geometry with platforms, bumpers, and goal marker"
```

---

### Task 3: Input System

**Files:**
- Modify: `game-ball-puzzle/index.html`

Track arrow keys for tilt and space for jump.

- [ ] **Step 1: Add input tracking**

Insert after the scene setup section (after `scene.add(dirLight);`), before the ball code:

```javascript
// ── Input ──
const keys = { left: false, right: false, up: false, down: false, space: false, r: false };

window.addEventListener('keydown', e => {
  switch (e.code) {
    case 'ArrowLeft':  keys.left = true; break;
    case 'ArrowRight': keys.right = true; break;
    case 'ArrowUp':    keys.up = true; break;
    case 'ArrowDown':  keys.down = true; break;
    case 'Space':      keys.space = true; e.preventDefault(); break;
    case 'KeyR':       keys.r = true; break;
  }
});

window.addEventListener('keyup', e => {
  switch (e.code) {
    case 'ArrowLeft':  keys.left = false; break;
    case 'ArrowRight': keys.right = false; break;
    case 'ArrowUp':    keys.up = false; break;
    case 'ArrowDown':  keys.down = false; break;
    case 'Space':      keys.space = false; break;
    case 'KeyR':       keys.r = false; break;
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add game-ball-puzzle/index.html
git commit -m "feat: add keyboard input tracking for tilt, jump, and restart"
```

---

### Task 4: Physics — Tilt, Gravity, and Ball Movement

**Files:**
- Modify: `game-ball-puzzle/index.html`

Implement the core tilt-the-world physics: arrow keys tilt the world group, gravity rolls the ball.

- [ ] **Step 1: Add physics state variables**

Insert after the input section, before the ball code:

```javascript
// ── Physics State ──
const physics = {
  velocity: new THREE.Vector3(0, 0, 0),
  grounded: false,
  tiltX: 0,      // current world tilt on X axis (forward/back)
  tiltZ: 0,      // current world tilt on Z axis (left/right)
  gravity: -20,
  maxTilt: 0.09,  // ~5 degrees in radians
  tiltSpeed: 0.003,
  tiltDamping: 0.92,
  friction: 0.98,
  jumpForce: 8,
  fallThreshold: -20
};
```

- [ ] **Step 2: Add the physics update function**

Insert after the physics state:

```javascript
// ── Physics Update ──
function updatePhysics(dt) {
  // Clamp dt to avoid physics explosions on tab-switch
  dt = Math.min(dt, 0.05);

  // ── Tilt ──
  if (keys.up)    physics.tiltX += physics.tiltSpeed;
  if (keys.down)  physics.tiltX -= physics.tiltSpeed;
  if (keys.left)  physics.tiltZ -= physics.tiltSpeed;
  if (keys.right) physics.tiltZ += physics.tiltSpeed;

  // Damping when keys not pressed
  if (!keys.up && !keys.down)  physics.tiltX *= physics.tiltDamping;
  if (!keys.left && !keys.right) physics.tiltZ *= physics.tiltDamping;

  // Clamp tilt
  physics.tiltX = Math.max(-physics.maxTilt, Math.min(physics.maxTilt, physics.tiltX));
  physics.tiltZ = Math.max(-physics.maxTilt, Math.min(physics.maxTilt, physics.tiltZ));

  // Apply tilt to world group
  world.rotation.x = physics.tiltX;
  world.rotation.z = physics.tiltZ;

  // ── Gravity (affected by tilt) ──
  // Tilt creates a horizontal gravity component
  const gravX = Math.sin(physics.tiltZ) * -physics.gravity * 0.5;
  const gravZ = Math.sin(physics.tiltX) * physics.gravity * 0.5;

  physics.velocity.x += gravX * dt;
  physics.velocity.z += gravZ * dt;
  physics.velocity.y += physics.gravity * dt;

  // ── Friction ──
  if (physics.grounded) {
    physics.velocity.x *= physics.friction;
    physics.velocity.z *= physics.friction;
  }

  // ── Jump ──
  if (keys.space && physics.grounded) {
    physics.velocity.y = physics.jumpForce;
    physics.grounded = false;
    keys.space = false; // consume the press
  }

  // ── Move Ball ──
  ball.position.x += physics.velocity.x * dt;
  ball.position.y += physics.velocity.y * dt;
  ball.position.z += physics.velocity.z * dt;

  // ── Visual spin ──
  ball.rotation.x += physics.velocity.z * dt * 2;
  ball.rotation.z -= physics.velocity.x * dt * 2;

  // ── Collision Detection ──
  physics.grounded = false;

  for (const plat of platforms) {
    // Check if ball is within platform XZ bounds (with ball radius margin)
    const onPlatX = ball.position.x + ballRadius > plat.minX && ball.position.x - ballRadius < plat.maxX;
    const onPlatZ = ball.position.z + ballRadius > plat.minZ && ball.position.z - ballRadius < plat.maxZ;

    if (onPlatX && onPlatZ) {
      // Landing on top
      const topY = plat.topY + ballRadius;
      if (ball.position.y <= topY && ball.position.y > topY - 1.0 && physics.velocity.y <= 0) {
        ball.position.y = topY;
        physics.velocity.y = 0;
        physics.grounded = true;
      }
    }

    // ── Bumper Collisions ──
    if (ball.position.y > plat.topY && ball.position.y < plat.topY + 0.9) {
      const bumperBounce = 0.6;
      const cx = plat.mesh.position.x;
      const cz = plat.mesh.position.z;

      if (plat.bumpers.includes('left') && onPlatZ) {
        const edge = plat.minX + 0.2;
        if (ball.position.x - ballRadius < edge && ball.position.x > plat.minX - ballRadius) {
          ball.position.x = edge + ballRadius;
          physics.velocity.x = Math.abs(physics.velocity.x) * bumperBounce;
        }
      }
      if (plat.bumpers.includes('right') && onPlatZ) {
        const edge = plat.maxX - 0.2;
        if (ball.position.x + ballRadius > edge && ball.position.x < plat.maxX + ballRadius) {
          ball.position.x = edge - ballRadius;
          physics.velocity.x = -Math.abs(physics.velocity.x) * bumperBounce;
        }
      }
      if (plat.bumpers.includes('front') && onPlatX) {
        const edge = plat.maxZ - 0.2;
        if (ball.position.z + ballRadius > edge && ball.position.z < plat.maxZ + ballRadius) {
          ball.position.z = edge - ballRadius;
          physics.velocity.z = -Math.abs(physics.velocity.z) * bumperBounce;
        }
      }
      if (plat.bumpers.includes('back') && onPlatX) {
        const edge = plat.minZ + 0.2;
        if (ball.position.z - ballRadius < edge && ball.position.z > plat.minZ - ballRadius) {
          ball.position.z = edge + ballRadius;
          physics.velocity.z = Math.abs(physics.velocity.z) * bumperBounce;
        }
      }
    }
  }

  // ── Fall Detection ──
  if (ball.position.y < physics.fallThreshold) {
    return 'fell';
  }

  // ── Goal Detection ──
  const dx = ball.position.x - levelData.goal.x;
  const dz = ball.position.z - levelData.goal.z;
  if (Math.sqrt(dx * dx + dz * dz) < 1.2 && physics.grounded) {
    return 'goal';
  }

  return null;
}
```

- [ ] **Step 3: Update the animate loop to use physics**

Replace the existing `animate()` function:

```javascript
// ── Game Loop ──
let lastTime = 0;

function animate(time) {
  requestAnimationFrame(animate);
  const dt = lastTime ? (time - lastTime) / 1000 : 0.016;
  lastTime = time;

  goalMesh.rotation.y += 0.02;
  updatePhysics(dt);

  renderer.render(scene, camera);
}
animate(0);
```

- [ ] **Step 4: Open in browser to verify**

You should be able to:
- Press arrow keys and see the world visually tilt
- The ball rolls due to gravity on the tilted surface
- The ball stays on platforms (doesn't fall through)
- The ball bounces off green bumpers
- Press space to jump
- Ball falls into the void if it goes off the edge

- [ ] **Step 5: Commit**

```bash
git add game-ball-puzzle/index.html
git commit -m "feat: add tilt-the-world physics with collision and bumpers"
```

---

### Task 5: Third-Person Camera

**Files:**
- Modify: `game-ball-puzzle/index.html`

Implement smooth third-person camera that follows the ball.

- [ ] **Step 1: Add camera follow function**

Insert after the `updatePhysics` function, before the game loop:

```javascript
// ── Camera Follow ──
const cameraOffset = new THREE.Vector3(0, 8, 12);
const cameraLookOffset = new THREE.Vector3(0, 0, -2);
const cameraLerp = 0.05;

function updateCamera() {
  // Get ball world position (accounts for world group tilt)
  const ballWorld = new THREE.Vector3();
  ball.getWorldPosition(ballWorld);

  // Target position: behind and above the ball
  const target = ballWorld.clone().add(cameraOffset);
  camera.position.lerp(target, cameraLerp);

  // Look at the ball (slightly ahead)
  const lookTarget = ballWorld.clone().add(cameraLookOffset);
  camera.lookAt(lookTarget);
}
```

- [ ] **Step 2: Update the animate loop to use camera follow**

In the `animate()` function, add `updateCamera();` after `updatePhysics(dt);`:

```javascript
updatePhysics(dt);
updateCamera();
```

- [ ] **Step 3: Open in browser to verify**

Camera should smoothly follow the ball as you tilt the world and roll around. It should stay behind and above, with gentle damping.

- [ ] **Step 4: Commit**

```bash
git add game-ball-puzzle/index.html
git commit -m "feat: add smooth third-person follow camera"
```

---

### Task 6: Game State Machine

**Files:**
- Modify: `game-ball-puzzle/index.html`

Implement READY / PLAYING / WIN / GAME OVER states with HUD messages.

- [ ] **Step 1: Add game state management**

Insert after the camera follow code, before the game loop:

```javascript
// ── Game State ──
let gameState = 'READY'; // READY, PLAYING, WIN, GAMEOVER

const messageEl = document.getElementById('message');
const controlsEl = document.getElementById('controls-hint');

function showMessage(text, color) {
  messageEl.style.display = 'block';
  messageEl.style.color = color || '#fff';
  messageEl.textContent = text;
}

function hideMessage() {
  messageEl.style.display = 'none';
}

function resetBall() {
  ball.position.set(levelData.start.x, levelData.start.y, levelData.start.z);
  physics.velocity.set(0, 0, 0);
  physics.tiltX = 0;
  physics.tiltZ = 0;
  physics.grounded = false;
  world.rotation.x = 0;
  world.rotation.z = 0;
}

function startGame() {
  gameState = 'PLAYING';
  hideMessage();
  resetBall();
}

function winGame() {
  gameState = 'WIN';
  showMessage('You Win! Press R to restart', '#44ff44');
  physics.velocity.set(0, 0, 0);
}

function gameOver() {
  gameState = 'GAMEOVER';
  showMessage('Game Over! Press R to restart', '#ff4444');
}

// Initial state
showMessage('Press any key to start', '#aaaaff');
```

- [ ] **Step 2: Replace the animate loop with state-aware version**

Replace the game loop:

```javascript
// ── Game Loop ──
let lastTime = 0;

function animate(time) {
  requestAnimationFrame(animate);
  const dt = lastTime ? (time - lastTime) / 1000 : 0.016;
  lastTime = time;

  goalMesh.rotation.y += 0.02;

  if (gameState === 'READY') {
    // Wait for any key
    const anyKey = keys.left || keys.right || keys.up || keys.down || keys.space;
    if (anyKey) startGame();
  }

  if (gameState === 'PLAYING') {
    const result = updatePhysics(dt);
    if (result === 'fell') gameOver();
    if (result === 'goal') winGame();
  }

  if ((gameState === 'WIN' || gameState === 'GAMEOVER') && keys.r) {
    keys.r = false;
    gameState = 'READY';
    resetBall();
    showMessage('Press any key to start', '#aaaaff');
  }

  updateCamera();
  renderer.render(scene, camera);
}
animate(0);
```

- [ ] **Step 3: Open in browser to verify**

Full game loop:
- "Press any key to start" shown on load
- Arrow key starts the game, ball rolls
- Rolling off the edge shows "Game Over! Press R to restart"
- Reaching the yellow goal shows "You Win! Press R to restart"
- R key resets back to the ready state

- [ ] **Step 4: Commit**

```bash
git add game-ball-puzzle/index.html
git commit -m "feat: add game state machine with ready, playing, win, and game over"
```

---

### Task 7: Visual Polish

**Files:**
- Modify: `game-ball-puzzle/index.html`

Add checker pattern on platforms, a subtle grid on the bottom of the void, and edge glow to make the Marble Madness aesthetic pop.

- [ ] **Step 1: Add a checker pattern to platforms using vertex colors**

Replace the single `platformMat` definition with two alternating materials and update the level builder. Replace the platform creation inside `levelData.platforms.forEach`:

```javascript
// ── Build Level Geometry ──
const platformMat1 = new THREE.MeshPhongMaterial({
  color: 0x4477aa,
  flatShading: true,
  specular: 0x222244,
  shininess: 10
});
const platformMat2 = new THREE.MeshPhongMaterial({
  color: 0x336699,
  flatShading: true,
  specular: 0x222244,
  shininess: 10
});

const bumperMat = new THREE.MeshPhongMaterial({
  color: 0x44bb44,
  flatShading: true,
  specular: 0x226622,
  shininess: 20
});

const platforms = [];

levelData.platforms.forEach((p, i) => {
  const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
  const mesh = new THREE.Mesh(geo, i % 2 === 0 ? platformMat1 : platformMat2);
  mesh.position.set(p.x, p.y, p.z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  world.add(mesh);
```

Keep the rest of the forEach body unchanged (collision data storage and bumper creation).

- [ ] **Step 2: Add edge highlight lines to platforms**

Add after the bumper creation inside the forEach, before the closing `});`:

```javascript
  // Edge highlight
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x6699cc, transparent: true, opacity: 0.3 });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  wireframe.position.copy(mesh.position);
  world.add(wireframe);
```

- [ ] **Step 3: Add a subtle void plane far below**

Insert after the goal light creation:

```javascript
// ── Void plane (visual only) ──
const voidGeo = new THREE.PlaneGeometry(200, 200);
const voidMat = new THREE.MeshBasicMaterial({ color: 0x050515, transparent: true, opacity: 0.8 });
const voidPlane = new THREE.Mesh(voidGeo, voidMat);
voidPlane.rotation.x = -Math.PI / 2;
voidPlane.position.y = -25;
world.add(voidPlane);
```

- [ ] **Step 4: Open in browser to verify**

Platforms should alternate between two shades of blue with subtle edge lines. There's a dark void below. The overall feel should be cleaner and more Marble Madness-like.

- [ ] **Step 5: Commit**

```bash
git add game-ball-puzzle/index.html
git commit -m "feat: add visual polish — alternating platform colors, edge lines, void plane"
```

---

### Task 8: Final Tuning and Playtesting

**Files:**
- Modify: `game-ball-puzzle/index.html`

Final adjustments: tune physics constants for good feel, ensure level is beatable, adjust camera.

- [ ] **Step 1: Playtest and tune physics values**

These values may need adjustment after playing. Start with these and iterate:

- `physics.gravity`: -20 (increase to make ball heavier/faster)
- `physics.maxTilt`: 0.09 (~5 degrees, increase for more tilt range)
- `physics.tiltSpeed`: 0.003 (increase for faster tilt response)
- `physics.friction`: 0.98 (lower = more friction = easier control)
- `physics.jumpForce`: 8 (adjust so ball can clear small gaps)
- `cameraOffset`: (0, 8, 12) (adjust for better view of the level)
- `cameraLerp`: 0.05 (increase for snappier camera, decrease for smoother)

Play through the level several times. The ball should feel weighty but responsive. Bridges should be challenging but not impossible.

- [ ] **Step 2: Adjust level layout if needed**

If bridges are too hard or too easy, adjust widths in `levelData.platforms`:
- Bridge width of 1.5 is moderately challenging
- Increase to 2.0 for easier bridges
- Decrease to 1.0 for harder bridges

If platforms are too far apart, adjust Z spacing.

- [ ] **Step 3: Verify all game states work**

Test each flow:
1. Load page → see "Press any key to start"
2. Press arrow key → game starts, ball rolls
3. Roll off edge → "Game Over! Press R to restart"
4. Press R → back to ready state
5. Start again → navigate to goal → "You Win!"
6. Press R → back to ready state

- [ ] **Step 4: Commit**

```bash
git add game-ball-puzzle/index.html
git commit -m "feat: tune physics and level for good gameplay feel"
```

---

## Summary

| Task | Description | Key Deliverable |
|------|-------------|----------------|
| 1 | HTML scaffold + Three.js scene | Rendering pipeline, red ball visible |
| 2 | Level geometry | Platforms, bumpers, goal marker |
| 3 | Input system | Arrow keys, space, R tracked |
| 4 | Physics | Tilt, gravity, collision, jump, fall/goal detection |
| 5 | Camera | Smooth third-person follow |
| 6 | Game states | READY → PLAYING → WIN / GAMEOVER cycle |
| 7 | Visual polish | Alternating colors, edge lines, void plane |
| 8 | Final tuning | Playable, balanced, polished |
