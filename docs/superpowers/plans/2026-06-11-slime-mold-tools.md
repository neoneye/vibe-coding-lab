# Slime Mold Interaction Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Food/Drag/Slime tool palette to `2d-slime-mold/` with clear add/remove feedback, brush-circle dragging of trail/agents/food, and paint-to-spawn slime.

**Architecture:** Two new tested engine methods (`addAgents`, `translateRegion`) go in the shared-code block; the UI script gains a tool system (pointer events, cursor state, transient effects list, brush rendering) and the frame loop is restructured to always render so feedback works while paused.

**Tech Stack:** Vanilla JS, Canvas 2D, Node ≥18 for tests, headless Chrome for screenshots.

**Spec:** `docs/superpowers/specs/2026-06-11-slime-mold-tools-design.md`

---

### Task 1: Engine — addAgents

**Files:**
- Modify: `2d-slime-mold/index.html` (shared-code block only)

- [ ] **Step 1: Add failing tests**

Inside `SlimeTests.run()`, before the final `console.log`:

```js
    // --- addAgents ---
    if (typeof SlimeEngine !== "undefined" && SlimeEngine.prototype.addAgents) {
      const e = new SlimeEngine({ width: 64, height: 64, agentCount: 10, rng: mulberry32(12),
        params: { deposit: 0.5, decay: 1, diffusion: 0 } });
      const ret = e.addAgents(32, 32, 8, 50);
      check("addAgents: count grows and returns total", ret === 60 && e.agents.length === 180);
      let confined = true, headingsOk = true;
      for (let i = 10; i < 60; i++) {
        const dx = e.agents[i * 3] - 32, dy = e.agents[i * 3 + 1] - 32, h = e.agents[i * 3 + 2];
        if (dx * dx + dy * dy > 8 * 8 + 1e-4) confined = false;
        if (h < 0 || h >= 2 * Math.PI) headingsOk = false;
      }
      check("addAgents: spawns confined to brush disk", confined);
      check("addAgents: headings in range", headingsOk);
      check("addAgents: deposits visible trail", e.trailMass() > 0);
    } else {
      check("addAgents: implemented", false);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: `FAIL addAgents: implemented`, exit 1.

- [ ] **Step 3: Implement addAgents**

Add to `SlimeEngine` (after `clearFood`):

```js
  // Spawn `count` agents uniformly inside the disk (cx, cy, radius) with
  // random headings, depositing immediately so painting is visible while
  // paused. Returns the new total agent count.
  addAgents(cx, cy, radius, count) {
    const oldN = this.agents.length / 3;
    const next = new Float32Array((oldN + count) * 3);
    next.set(this.agents);
    for (let i = oldN; i < oldN + count; i++) {
      const r = radius * Math.sqrt(this.rng());
      const theta = this.rng() * 2 * Math.PI;
      const x = this._wrap(cx + Math.cos(theta) * r, this.width);
      const y = this._wrap(cy + Math.sin(theta) * r, this.height);
      next[i * 3] = x;
      next[i * 3 + 1] = y;
      next[i * 3 + 2] = this.rng() * 2 * Math.PI;
      const idx = Math.floor(y) * this.width + Math.floor(x);
      this.trail[idx] = Math.min(TRAIL_CLAMP, this.trail[idx] + this.params.deposit);
    }
    this.agents = next;
    return oldN + count;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-slime-mold/index.html
git commit -m "slime-mold: addAgents engine method for slime painting"
```

---

### Task 2: Engine — translateRegion

**Files:**
- Modify: `2d-slime-mold/index.html` (shared-code block only)

- [ ] **Step 1: Add failing tests**

Inside `SlimeTests.run()`, after the addAgents block:

```js
    // --- translateRegion ---
    if (typeof SlimeEngine !== "undefined" && SlimeEngine.prototype.translateRegion) {
      // Trail mass moves, source empties, total conserved.
      {
        const e = new SlimeEngine({ width: 64, height: 64, agentCount: 0, rng: mulberry32(13) });
        e.trail[20 * 64 + 20] = 2; e.trail[21 * 64 + 20] = 1;
        const before = e.trailMass();
        e.translateRegion(20, 20.5, 5, 10, 6);
        check("translate: mass conserved", Math.abs(e.trailMass() - before) < 1e-3);
        check("translate: destination holds mass",
          Math.abs(e.trail[26 * 64 + 30] - 2) < 1e-6 && Math.abs(e.trail[27 * 64 + 30] - 1) < 1e-6);
        check("translate: source emptied", e.trail[20 * 64 + 20] === 0 && e.trail[21 * 64 + 20] === 0);
      }
      // Agents: inside moves by delta, outside untouched.
      {
        const e = new SlimeEngine({ width: 64, height: 64, agentCount: 2, rng: mulberry32(14) });
        e.agents[0] = 20; e.agents[1] = 20;
        e.agents[3] = 50; e.agents[4] = 50;
        e.translateRegion(20, 20, 5, 3, 4);
        check("translate: agent inside moves",
          Math.abs(e.agents[0] - 23) < 1e-4 && Math.abs(e.agents[1] - 24) < 1e-4);
        check("translate: agent outside unmoved", e.agents[3] === 50 && e.agents[4] === 50);
      }
      // Food: inside moves, outside not.
      {
        const e = new SlimeEngine({ width: 64, height: 64, agentCount: 0, rng: mulberry32(15) });
        e.addFood(20, 20); e.addFood(50, 50);
        e.translateRegion(20, 20, 5, 3, 4);
        check("translate: food inside moves", e.foods[0].x === 23 && e.foods[0].y === 24);
        check("translate: food outside unmoved", e.foods[1].x === 50 && e.foods[1].y === 50);
      }
      // Wrap: blob pushed across the right edge reappears near x=0.
      {
        const e = new SlimeEngine({ width: 64, height: 64, agentCount: 0, rng: mulberry32(16) });
        e.trail[10 * 64 + 62] = 1.5;
        const before = e.trailMass();
        e.translateRegion(62, 10, 3, 4, 0);
        check("translate: wraps across edge",
          Math.abs(e.trailMass() - before) < 1e-3 && Math.abs(e.trail[10 * 64 + 2] - 1.5) < 1e-6);
      }
    } else {
      check("translateRegion: implemented", false);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: `FAIL translateRegion: implemented`, exit 1.

- [ ] **Step 3: Implement translateRegion**

Add to `SlimeEngine` (after `addAgents`):

```js
  // Translate trail mass, agents, and food inside the disk (cx, cy, radius)
  // by (dx, dy), wrapping toroidally. Cell membership uses the cell's integer
  // coordinate; agent/food membership uses Euclidean distance (no wrap).
  translateRegion(cx, cy, radius, dx, dy) {
    const W = this.width, H = this.height, r2 = radius * radius;
    // Trail: gather disk cells, zero them, scatter-add at wrapped destinations.
    const x0 = Math.floor(cx - radius), x1 = Math.ceil(cx + radius);
    const y0 = Math.floor(cy - radius), y1 = Math.ceil(cy + radius);
    const moved = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ddx = x - cx, ddy = y - cy;
        if (ddx * ddx + ddy * ddy > r2) continue;
        const xi = Math.floor(this._wrap(x, W)), yi = Math.floor(this._wrap(y, H));
        const idx = yi * W + xi;
        if (this.trail[idx] === 0) continue;
        moved.push(x + dx, y + dy, this.trail[idx]);
        this.trail[idx] = 0;
      }
    }
    for (let i = 0; i < moved.length; i += 3) {
      const xi = Math.floor(this._wrap(moved[i], W));
      const yi = Math.floor(this._wrap(moved[i + 1], H));
      const idx = yi * W + xi;
      this.trail[idx] = Math.min(TRAIL_CLAMP, this.trail[idx] + moved[i + 2]);
    }
    // Agents.
    const a = this.agents, n = a.length / 3;
    for (let i = 0; i < n; i++) {
      const ddx = a[i * 3] - cx, ddy = a[i * 3 + 1] - cy;
      if (ddx * ddx + ddy * ddy > r2) continue;
      a[i * 3] = this._wrap(a[i * 3] + dx, W);
      a[i * 3 + 1] = this._wrap(a[i * 3 + 1] + dy, H);
    }
    // Food.
    for (const food of this.foods) {
      const ddx = food.x - cx, ddy = food.y - cy;
      if (ddx * ddx + ddy * ddy > r2) continue;
      food.x = this._wrap(food.x + dx, W);
      food.y = this._wrap(food.y + dy, H);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add 2d-slime-mold/index.html
git commit -m "slime-mold: translateRegion engine method for the drag tool"
```

---

### Task 3: UI — tool palette, pointer system, feedback rendering

**Files:**
- Modify: `2d-slime-mold/index.html` (style, body, UI script)

- [ ] **Step 1: Add tool-button CSS**

In `<style>`, after the `button:hover` rule:

```css
button.tool.active { background: var(--accent); color: #0b0e13; border-color: var(--accent); font-weight: 600; }
```

- [ ] **Step 2: Add the Tool fieldset and hint id**

Replace:

```html
    <p class="hint">Click: add food · click a food ring: remove it</p>
```

with:

```html
    <p class="hint" id="hint">Click: add food · click a highlighted ring: remove it</p>
```

Insert before the Preset fieldset:

```html
    <fieldset class="panel">
      <legend>Tool</legend>
      <div class="buttons">
        <button id="tool-food" class="tool active">Food</button>
        <button id="tool-drag" class="tool">Drag</button>
        <button id="tool-slime" class="tool">Slime</button>
      </div>
      <label class="slider">Brush size: <span id="brush-size-value"></span>
        <input type="range" id="brush-size" min="8" max="60" step="1" value="24">
      </label>
    </fieldset>
```

- [ ] **Step 3: Replace the click handler with the tool system**

In the UI script, replace the old canvas click listener:

```js
display.addEventListener("click", (ev) => {
  const rect = display.getBoundingClientRect();
  const gx = ((ev.clientX - rect.left) / rect.width) * GRID;
  const gy = ((ev.clientY - rect.top) / rect.height) * GRID;
  if (!engine.removeFoodNear(gx, gy, 6)) engine.addFood(gx, gy);
});
```

with:

```js
// --- Tool system ---
const HINTS = {
  food: "Click: add food · click a highlighted ring: remove it",
  drag: "Drag to move trail, agents and food inside the circle",
  slime: "Click or drag to paint fresh slime",
};
let tool = "food";
const toolButtons = {
  food: document.getElementById("tool-food"),
  drag: document.getElementById("tool-drag"),
  slime: document.getElementById("tool-slime"),
};
for (const [name, btn] of Object.entries(toolButtons)) {
  btn.addEventListener("click", () => {
    tool = name;
    for (const b of Object.values(toolButtons)) b.classList.remove("active");
    btn.classList.add("active");
    document.getElementById("hint").textContent = HINTS[name];
  });
}
const brushInput = document.getElementById("brush-size");
const brushRadius = () => Number(brushInput.value);
const brushValueEl = document.getElementById("brush-size-value");
brushInput.addEventListener("input", () => { brushValueEl.textContent = brushInput.value; });
brushValueEl.textContent = brushInput.value;

const cursor = { x: 0, y: 0, inside: false, down: false };
const effects = [];
const MAX_AGENTS = 80000;

function toGrid(ev) {
  const rect = display.getBoundingClientRect();
  return { x: ((ev.clientX - rect.left) / rect.width) * GRID,
           y: ((ev.clientY - rect.top) / rect.height) * GRID };
}

function paintSlime(x, y) {
  const count = Math.min(150, MAX_AGENTS - engine.agents.length / 3);
  if (count <= 0) return;
  const total = engine.addAgents(x, y, brushRadius(), count);
  agentInput.value = total;
  document.getElementById("agents-value").textContent = total.toLocaleString();
}

display.addEventListener("pointerdown", (ev) => {
  const g = toGrid(ev);
  cursor.x = g.x; cursor.y = g.y; cursor.inside = true; cursor.down = true;
  display.setPointerCapture(ev.pointerId);
  if (tool === "food") {
    if (engine.removeFoodNear(g.x, g.y, 6)) effects.push({ type: "remove", x: g.x, y: g.y, age: 0 });
    else { engine.addFood(g.x, g.y); effects.push({ type: "add", x: g.x, y: g.y, age: 0 }); }
  } else if (tool === "slime") {
    paintSlime(g.x, g.y);
  }
});
display.addEventListener("pointermove", (ev) => {
  const g = toGrid(ev);
  if (cursor.down) {
    if (tool === "drag") {
      engine.translateRegion(cursor.x, cursor.y, brushRadius(), g.x - cursor.x, g.y - cursor.y);
    } else if (tool === "slime") {
      paintSlime(g.x, g.y);
    }
  }
  cursor.x = g.x; cursor.y = g.y; cursor.inside = true;
});
display.addEventListener("pointerup", () => { cursor.down = false; });
display.addEventListener("pointerleave", () => { cursor.inside = false; cursor.down = false; });
```

- [ ] **Step 4: Replace the food rendering with feedback-aware overlays**

In `render()`, replace:

```js
  displayCtx.strokeStyle = "rgba(255,255,255,0.9)";
  displayCtx.lineWidth = 2;
  for (const food of engine.foods) {
    displayCtx.beginPath();
    displayCtx.arc(food.x * SCALE, food.y * SCALE, 9, 0, 2 * Math.PI);
    displayCtx.stroke();
  }
```

with:

```js
  // Food markers: filled dot + ring; red highlight when the food tool would remove.
  let hoveredFood = null;
  if (tool === "food" && cursor.inside) {
    for (const food of engine.foods) {
      if ((food.x - cursor.x) ** 2 + (food.y - cursor.y) ** 2 <= 36) { hoveredFood = food; break; }
    }
  }
  for (const food of engine.foods) {
    const fx = food.x * SCALE, fy = food.y * SCALE;
    const hovered = food === hoveredFood;
    const color = hovered ? "rgba(255,80,80,0.95)" : "rgba(255,255,255,0.9)";
    displayCtx.fillStyle = color;
    displayCtx.beginPath();
    displayCtx.arc(fx, fy, 4, 0, 2 * Math.PI);
    displayCtx.fill();
    displayCtx.strokeStyle = color;
    displayCtx.lineWidth = 2;
    displayCtx.beginPath();
    displayCtx.arc(fx, fy, hovered ? 12 : 9, 0, 2 * Math.PI);
    displayCtx.stroke();
  }
  // Ghost ring: where a food-tool click would add.
  if (tool === "food" && cursor.inside && !hoveredFood) {
    displayCtx.strokeStyle = "rgba(255,255,255,0.35)";
    displayCtx.lineWidth = 2;
    displayCtx.beginPath();
    displayCtx.arc(cursor.x * SCALE, cursor.y * SCALE, 9, 0, 2 * Math.PI);
    displayCtx.stroke();
  }
  // Brush circle for drag/slime tools.
  if ((tool === "drag" || tool === "slime") && cursor.inside) {
    displayCtx.strokeStyle = cursor.down ? "rgba(90,169,255,0.9)" : "rgba(255,255,255,0.5)";
    displayCtx.lineWidth = 1.5;
    displayCtx.beginPath();
    displayCtx.arc(cursor.x * SCALE, cursor.y * SCALE, brushRadius() * SCALE, 0, 2 * Math.PI);
    displayCtx.stroke();
  }
  // Transient add/remove pulses.
  const EFFECT_LIFE = 25;
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    const t = fx.age / EFFECT_LIFE;
    displayCtx.lineWidth = 3;
    displayCtx.beginPath();
    if (fx.type === "add") {
      displayCtx.strokeStyle = `rgba(255,255,255,${1 - t})`;
      displayCtx.arc(fx.x * SCALE, fx.y * SCALE, 9 + t * 30, 0, 2 * Math.PI);
    } else {
      displayCtx.strokeStyle = `rgba(255,80,80,${1 - t})`;
      displayCtx.arc(fx.x * SCALE, fx.y * SCALE, Math.max(1, 12 * (1 - t)), 0, 2 * Math.PI);
    }
    displayCtx.stroke();
    fx.age++;
    if (fx.age > EFFECT_LIFE) effects.splice(i, 1);
  }
```

- [ ] **Step 5: Restructure the frame loop to always render**

Replace:

```js
function frame() {
  if (running) {
    engine.step();
    render();
    updateReadout();
  }
  requestAnimationFrame(frame);
}
```

with:

```js
function frame() {
  if (running) engine.step();
  render();
  updateReadout();
  requestAnimationFrame(frame);
}
```

- [ ] **Step 6: Run tests**

Run: `cd 2d-slime-mold && node test.mjs`
Expected: `ALL TESTS PASSED` (UI changes must not touch shared-code).

- [ ] **Step 7: Commit**

```bash
git add 2d-slime-mold/index.html
git commit -m "slime-mold: tool palette with food feedback, drag and slime brushes"
```

---

### Task 4: Visual verification

**Files:**
- Possibly modify: `2d-slime-mold/index.html` (only if defects found)

- [ ] **Step 1: Layout screenshot**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --screenshot=/tmp/slime-tools.png --window-size=1060,900 --virtual-time-budget=8000 \
  "file:///Users/neoneye/git/vibe-coding-lab/2d-slime-mold/index.html"
```

Read it: Tool fieldset with Food active (highlighted), Brush size slider, hint text present, simulation running.

- [ ] **Step 2: Interaction screenshot via temporary script**

Headless Chrome can't hover or click, so append a TEMP block at the end of the UI script to simulate state, then screenshot, then delete it:

```js
// TEMP visual verification
engine.addFood(80, 80);
effects.push({ type: "add", x: 80, y: 80, age: 5 });
effects.push({ type: "remove", x: 240, y: 240, age: 5 });
tool = "slime";
cursor.x = 160; cursor.y = 160; cursor.inside = true;
paintSlime(160, 160);
```

Screenshot again with the same command. Verify: food dot+ring at upper-left, expanding white pulse around it, red shrinking pulse at lower-right, brush circle at center, and a fresh slime burst spreading from the center. Then **delete the TEMP block**, re-run `node test.mjs`, and re-screenshot to confirm the page is clean.

- [ ] **Step 3: Final commit (only if fixes were needed)**

If Step 2 revealed defects, fix them, re-verify, then:

```bash
git add 2d-slime-mold/index.html
git commit -m "slime-mold: visual fixes from tool verification"
```
