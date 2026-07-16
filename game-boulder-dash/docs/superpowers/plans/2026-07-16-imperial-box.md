# Ringside Imperial Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the emperor's box down onto the arena wall at 1.4× scale and add Praetorian guards, vexillum standards, and a purple canopy valance so it reads unmistakably as the ruler's area.

**Architecture:** All work is in `game-boulder-dash/index.html`, presentation IIFE only — the engine and `spectatorLook` are untouched, so there are no new unit tests; verification is by headless screenshot via the existing `window.__colosseum` hook. Placement changes at the `drawAudience` call site and `buildAudience`; regalia inside `drawImperialBox` so the 2.2× death screens inherit it.

**Tech Stack:** Vanilla JS, canvas 2D, headless Chrome.

**Spec:** `game-boulder-dash/docs/superpowers/specs/2026-07-16-imperial-box-design.md`

## Global Constraints

- Stands view draws the box at 1.4× with translate `(CW / 2, PF_Y - 4 - 32 * 1.4)` — scaled platform bottom flush on the arena wall ring at `PF_Y - 4`.
- Seating gap `|x - CW/2| < 115` applies to all three top tiers.
- No SPQR lettering on banners (unreadable at these scales).
- Death/game-over screens keep their existing `translate(CW / 2, 188); scale(2.2, 2.2)`.
- Caesar, Cleopatra, fan servants, columns, pediment unchanged.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Screenshot helper (both tasks)

```bash
cd /Users/neoneye/git/vibe-coding-lab/game-boulder-dash
cp index.html _shot.html
cat >> _shot.html <<'EOF'
<script>
window.__colosseum.start(1);
window.__colosseum.setCheer(0.5);
// for the death screen shot, add: window.__colosseum.setMode("deathwait");
window.__colosseum.draw(1000);
</script>
EOF
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --window-size=880,650 \
  --screenshot=/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/5663c931-e103-4af7-977b-1fe24e7e890d/scratchpad/shot.png \
  "file://$PWD/_shot.html"
rm _shot.html
```

---

### Task 1: Ringside placement at 1.4×

**Files:**
- Modify: `game-boulder-dash/index.html` — emperor-box call site in `drawAudience` (~line 1352), seat gap in `buildAudience` (~line 1127), colonnade skip in `drawStandsBase` (~line 1292)

**Interfaces:**
- Consumes: existing `drawImperialBox(t, cheer, thumb, grin)` drawn around (0,0).
- Produces: the box anchored at the arena wall; Task 2 only touches `drawImperialBox` internals.

- [ ] **Step 1: Move and scale the box.** In `drawAudience`, replace:

```js
    // emperor's temple box, top center
    ctx.save();
    ctx.translate(CW / 2, HUD_H + 30);
    drawImperialBox(t, cheer, thumb, thumb < 0);
    ctx.restore();
```

with:

```js
    // emperor's box: a 1.4× balcony flush on the arena wall — the ruler
    // sits closest to the blood
    ctx.save();
    ctx.translate(CW / 2, PF_Y - 4 - 32 * 1.4);
    ctx.scale(1.4, 1.4);
    drawImperialBox(t, cheer, thumb, thumb < 0);
    ctx.restore();
```

- [ ] **Step 2: Widen the seating gap to all tiers.** In `buildAudience`, replace:

```js
        if (Math.abs(x - CW / 2) < 78 && tier < 2) continue; // emperor box
```

with:

```js
        if (Math.abs(x - CW / 2) < 115) continue; // emperor box + guards
```

- [ ] **Step 3: Restore the outer colonnade.** The box no longer sits at the portico, so in `drawStandsBase` replace:

```js
    for (let x = 30; x < CW - 20; x += 64) {
      if (Math.abs(x - CW / 2) < 84) continue;               // temple box zone
      drawColumn(x, HUD_H + 12, 22);
    }
```

with:

```js
    for (let x = 30; x < CW - 20; x += 64) drawColumn(x, HUD_H + 12, 22);
```

- [ ] **Step 4: Verify** — `node test.mjs` passes (rendering-only change); stands screenshot via the helper: box platform touches the arena wall ring, no spectators poke through the box or its flanks, colonnade continuous along the top rim, HUD plaque clear.

- [ ] **Step 5: Commit**

```bash
git add game-boulder-dash/index.html
git commit -m "game-boulder-dash: seat Caesar ringside, 1.4x box on the arena wall"
```

---

### Task 2: Guards, standards, and canopy valance

**Files:**
- Modify: `game-boulder-dash/index.html` — inside `drawImperialBox` (~lines 1363–1400)

**Interfaces:**
- Consumes: `px(ctx, x, y, w, h, color)`; box-local coordinates (platform -58..58 wide, -14..32 tall; columns at ±63; pediment tip y = -30).
- Produces: nothing consumed later; death screens inherit automatically.

- [ ] **Step 1: Purple canopy valance.** Replace the platform's plain gold top strip:

```js
    px(ctx, -58, -14, 116, 5, "#e0b64c");
```

with:

```js
    px(ctx, -58, -14, 116, 5, "#5a2a7a");                 // canopy valance
    for (let k = -58; k < 58; k += 8) px(ctx, k, -11, 4, 2, "#e0b64c"); // gold scallops
```

(The gold strip at the platform bottom, `px(ctx, -58, 28, 116, 4, "#e0b64c")`, stays.)

- [ ] **Step 2: Praetorian guards with vexillum standards.** Insert after the gold medallion block (`ctx.arc(0, -21, 3, 0, 7); ctx.fill();`):

```js
    // Praetorian guards with vexillum standards flank the box
    const guard = (gx) => {
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
    };
    guard(-70); guard(70);
```

- [ ] **Step 3: Verify** — `node test.mjs` passes; two screenshots via the helper: (a) stands view — guards and banners flank the box, banners rise above the pediment, nothing collides with neighboring spectators at the 115 px gap; (b) deathwait view (add `window.__colosseum.setMode("deathwait");` before `draw`) — regalia crisp at 2.2×, text overlay composition intact.

- [ ] **Step 4: Commit**

```bash
git add game-boulder-dash/index.html
git commit -m "game-boulder-dash: praetorian guards, vexilla and canopy on the imperial box"
```
