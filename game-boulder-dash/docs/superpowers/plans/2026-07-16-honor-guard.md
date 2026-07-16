# Praetorian Honor Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Line three additional banner-bearing Praetorians per side of the imperial box in the stands view, without changing the death screens.

**Architecture:** All in `game-boulder-dash/index.html`, presentation IIFE. The `guard()` closure inside `drawImperialBox` becomes a standalone `drawPraetorian(gx)`; the stands view calls it six more times inside the existing 1.4× box transform; the seating gap widens. Rendering-only — no engine or `spectatorLook` changes, so verification is by headless screenshot.

**Tech Stack:** Vanilla JS, canvas 2D, headless Chrome.

**Spec:** `game-boulder-dash/docs/superpowers/specs/2026-07-16-honor-guard-design.md`

## Global Constraints

- Honor line at box-local x = ±95, ±120, ±145 inside the 1.4× transform (real ≈ ±133/168/203 from canvas center), same ground level as the box.
- Seating gap in `buildAudience`: `|x - CW/2| < 215`, all three top tiers.
- Death/game-over screens unchanged: `drawImperialBox` still draws only the ±70 pair.
- Guard appearance identical to the existing pair (red tunic, bronze cuirass/helmet, red crest, full vexillum standard).
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Extract `drawPraetorian` and add the honor line

**Files:**
- Modify: `game-boulder-dash/index.html` — `drawImperialBox` guard closure (~line 1380), box call site in `drawAudience` (~line 1355), seat gap in `buildAudience` (~line 1127)

**Interfaces:**
- Consumes: `px(ctx, x, y, w, h, color)`; box-local coordinates.
- Produces: `drawPraetorian(gx)` — draws one guard + standard around box-local (gx, ground = 32).

- [ ] **Step 1: Extract the helper.** In `drawImperialBox`, the block starting `// Praetorian guards with vexillum standards flank the box` defines `const guard = (gx) => { ... }; guard(-70); guard(70);`. Move the arrow function out of `drawImperialBox` to just above it as a named function, keeping the body byte-identical:

```js
  // One Praetorian guard with a vexillum standard, in imperial-box-local
  // coordinates (ground at y = 32). Used flanking the box and, in the
  // stands view, as the honor line along the arena wall.
  function drawPraetorian(gx) {
    const inner = gx < 0 ? 4 : -4;                       // pole in the inner hand
    px(ctx, gx + inner - 1, -38, 2, 68, "#6a4a2a");      // pole, ground to sky
    px(ctx, gx + inner - 7, -38, 14, 2, "#8a5a2a");      // crossbar
    px(ctx, gx + inner - 6, -36, 12, 14, "#a32a2a");     // banner cloth
    ctx.strokeStyle = "#e0b64c"; ctx.lineWidth = 1;
    ctx.strokeRect(gx + inner - 5.5, -35.5, 11, 13);     // gold border
    ctx.fillStyle = "#e0b64c";                           // gold roundel
    ctx.beginPath(); ctx.arc(gx + inner, -29, 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = "#c9955e";                           // legs
    ctx.fillRect(gx - 3, 27, 2.5, 5);
    ctx.fillRect(gx + 0.5, 27, 2.5, 5);
    px(ctx, gx - 5, 14, 10, 13, "#a32a2a");              // red tunic
    px(ctx, gx - 4, 15, 8, 6, "#b08a3a");                // bronze cuirass
    ctx.fillStyle = "#c9955e";
    ctx.beginPath(); ctx.arc(gx, 10, 3.6, 0, 7); ctx.fill();   // head
    ctx.fillStyle = "#b08a3a";                           // bronze helmet
    ctx.beginPath(); ctx.arc(gx, 9, 3.8, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    px(ctx, gx - 1, 3.5, 2, 4, "#a32a2a");               // red crest
    px(ctx, gx - 2, 8.5, 1.5, 1.5, "#3a2418");           // eyes
    px(ctx, gx + 1, 8.5, 1.5, 1.5, "#3a2418");
  }
```

In `drawImperialBox`, the old block shrinks to:

```js
    // Praetorian guards with vexillum standards flank the box
    drawPraetorian(-70); drawPraetorian(70);
```

- [ ] **Step 2: Add the honor line in the stands view.** In `drawAudience`, extend the box block:

```js
    ctx.save();
    ctx.translate(CW / 2, PF_Y - 4 - 32 * 1.4);
    ctx.scale(1.4, 1.4);
    drawImperialBox(t, cheer, thumb, thumb < 0);
    // honor line: three more banner-bearers per side along the arena wall
    for (const gx of [95, 120, 145]) { drawPraetorian(-gx); drawPraetorian(gx); }
    ctx.restore();
```

- [ ] **Step 3: Widen the cordon.** In `buildAudience`, replace:

```js
        if (Math.abs(x - CW / 2) < 115) continue; // emperor box + guards
```

with:

```js
        if (Math.abs(x - CW / 2) < 215) continue; // imperial box + honor line
```

- [ ] **Step 4: Verify** — `node test.mjs` passes; stands screenshot (`__colosseum.start(1); setCheer(0.5); draw(1000)`): six new evenly spaced guards with red banners, no spectators behind banners or poles, box unchanged; deathwait screenshot (`setMode("deathwait")` before draw): still exactly two guards.

- [ ] **Step 5: Commit**

```bash
git add game-boulder-dash/index.html
git commit -m "game-boulder-dash: praetorian honor line flanks the imperial box"
```
