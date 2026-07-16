# Roman Audience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modern-looking bald spectators in game-boulder-dash with ~50% larger Roman figures (tunic / toga / stola+palla), with hair and cheer-reactive faces, in a widened stands band.

**Architecture:** All work is in `game-boulder-dash/index.html`. A pure attribute function `spectatorLook` goes in the `shared-code` script block (tested via `node test.mjs`); geometry constants and drawing live in the presentation IIFE. One parametric `drawSpectator` replaces the inline rect+circle drawing, using the file's existing `px`/`fillRect`/`arc` pixel-art style.

**Tech Stack:** Vanilla JS, canvas 2D, node test runner (`test.mjs` extracts the shared-code block), headless Chrome for visual verification.

**Spec:** `game-boulder-dash/docs/superpowers/specs/2026-07-16-roman-audience-design.md`

## Global Constraints

- Single self-contained `index.html`; no external assets or libraries.
- Garment mix: tunic ~45%, toga ~25% (15% of togas get the purple praetexta stripe), stola+palla ~30% (half with palla drawn over the head).
- `STAND` 84 → 120; tier spacing 33 px; seat pitch 21 px; side pitch 25 px; 3 tiers preserved on all four sides.
- Mouth/arms excitement threshold stays `excited > 0.45`; walkers never shout or raise arms.
- Engine, input, audio, gameplay code untouched. Emperor box figures untouched (coordinates may shift with the band).
- Commit after each task; all commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Verification helpers (used by several tasks)

The game already exposes a synchronous screenshot hook `window.__colosseum` (rAF does not advance under headless virtual time). To capture a state:

```bash
cd /Users/neoneye/git/vibe-coding-lab/game-boulder-dash
cp index.html _shot.html
cat >> _shot.html <<'EOF'
<script>
window.__colosseum.start(1);
window.__colosseum.setCheer(1);   // 0 for the idle crowd
window.__colosseum.draw(1000);
</script>
EOF
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars \
  --window-size=880,650 \
  --screenshot=/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/5663c931-e103-4af7-977b-1fe24e7e890d/scratchpad/shot.png \
  "file://$PWD/_shot.html"
rm _shot.html
```

Then Read the PNG. For a retina check add `--force-device-scale-factor=2`.

---

### Task 1: `spectatorLook` attribute function (shared-code, TDD)

**Files:**
- Modify: `game-boulder-dash/index.html` — shared-code block (add function after `fitCanvasMetrics`, ~line 432; add test inside `ColosseumTests.run`, next to the "canvas metrics" tests ~line 689)

**Interfaces:**
- Produces: `spectatorLook(rnd)` where `rnd(salt)` returns a deterministic `[0,1)` per seat. Returns `{ garment: "tunic"|"toga"|"stola", hairIdx: 0..4, pallaUp: bool, bun: bool, praetexta: bool, bald: bool }`. Task 3 consumes this.

- [ ] **Step 1: Write the failing test** inside `ColosseumTests.run`, after the last "canvas metrics" test:

```js
    test("audience: Roman garment mix with coherent accessories", () => {
      const h = (i, salt) => {
        let x = (i * 374761393 + salt * 668265263) | 0;
        x = (x ^ (x >> 13)) * 1274126177 | 0;
        return ((x ^ (x >> 16)) >>> 0) / 4294967296;
      };
      const n = { tunic: 0, toga: 0, stola: 0 };
      for (let i = 0; i < 4000; i++) {
        const L = spectatorLook((salt) => h(i, salt));
        n[L.garment]++;
        assert(L.hairIdx >= 0 && L.hairIdx < 5, "hair index in range");
        if (L.pallaUp || L.bun) assert(L.garment === "stola", "palla/bun only with a stola");
        if (L.garment === "stola") assert(L.pallaUp !== L.bun, "stola: palla up or bun, never both");
        if (L.praetexta) assert(L.garment === "toga", "purple stripe only on a toga");
        if (L.bald) assert(L.garment !== "stola", "matrons are never bald");
      }
      const f = (k) => n[k] / 4000;
      assert(Math.abs(f("tunic") - 0.45) < 0.05, `tunic share ~45%, got ${f("tunic")}`);
      assert(Math.abs(f("toga") - 0.25) < 0.05, `toga share ~25%, got ${f("toga")}`);
      assert(Math.abs(f("stola") - 0.30) < 0.05, `stola share ~30%, got ${f("stola")}`);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game-boulder-dash && node test.mjs`
Expected: FAIL with `spectatorLook is not defined`

- [ ] **Step 3: Implement** in the shared-code block, right after `fitCanvasMetrics`:

```js
// Roman garment/hair attributes for one spectator seat. rnd(salt) must be a
// deterministic [0,1) source for the seat, so a seat always dresses the same.
function spectatorLook(rnd) {
  const g = rnd(21);
  const look = {
    garment: g < 0.45 ? "tunic" : g < 0.70 ? "toga" : "stola",
    hairIdx: Math.floor(rnd(22) * 5),
    pallaUp: false, bun: false, praetexta: false, bald: false,
  };
  if (look.garment === "toga") look.praetexta = rnd(23) < 0.15;
  if (look.garment === "stola") {
    look.pallaUp = rnd(24) < 0.5;
    look.bun = !look.pallaUp;
  } else {
    look.bald = rnd(25) < 0.1;
  }
  return look;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd game-boulder-dash && node test.mjs`
Expected: all tests `ok`, including the new one.

- [ ] **Step 5: Commit**

```bash
git add game-boulder-dash/index.html
git commit -m "game-boulder-dash: spectatorLook picks Roman garments per seat"
```

---

### Task 2: Widen the stands band and respace the seating

**Files:**
- Modify: `game-boulder-dash/index.html` — constants (~line 857), `WINE_STALL` + `buildAudience` (~lines 1094–1138), `drawStandsBase` tier pads (~line 1170)

**Interfaces:**
- Consumes: nothing new.
- Produces: `STAND = 120` (canvas 864×630 derived); seat coordinates spaced for 12 px-wide figures; `WINE_STALL = { x: CW - 180, y: CH - 64 }`. Task 3 draws figures at these seats.

- [ ] **Step 1: Update the constants** (line ~857):

```js
  const STAND = 120;                       // stands margin on all sides
```
(`CW`/`CH` are derived — update their trailing comments to `// 864` and `// 630`.)

- [ ] **Step 2: Respace `buildAudience` and the wine stall.** Replace `WINE_STALL` and the seat loops:

```js
  const WINE_STALL = { x: CW - 180, y: CH - 64 };
```

In `add`: jitter becomes `(hash(i, 5) - 0.5) * 9` for x and `(hash(i, 6) - 0.5) * 5` for y; the stall clear-zone becomes `x > WINE_STALL.x - 16 && x < WINE_STALL.x + 68 && y > WINE_STALL.y - 20`; `wrange` becomes `60 + hash(i, 10) * 100`.

```js
    // top stands: 3 tiers above playfield (leave gap for emperor box)
    for (let tier = 0; tier < 3; tier++) {
      const y = PF_Y - 20 - tier * 33;
      for (let x = PF_X - STAND + 20 + (tier % 2) * 10; x < PF_X + PF_W + STAND - 20; x += 21) {
        if (Math.abs(x - CW / 2) < 78 && tier < 2) continue; // emperor box
        add(x, y, tier);
      }
    }
    // bottom stands: 3 tiers
    for (let tier = 0; tier < 3; tier++) {
      const y = PF_Y + PF_H + 26 + tier * 33;
      for (let x = PF_X - STAND + 20 + (tier % 2) * 10; x < PF_X + PF_W + STAND - 20; x += 21) {
        add(x, y, tier);
      }
    }
    // side stands: 3 columns each
    for (let tier = 0; tier < 3; tier++) {
      for (let y = PF_Y + 22 + (tier % 2) * 12; y < PF_Y + PF_H - 8; y += 25) {
        add(PF_X - 22 - tier * 33, y, tier, "y");
        add(PF_X + PF_W + 22 + tier * 33, y, tier, "y");
      }
    }
```

- [ ] **Step 3: Scale `drawStandsBase` tier steps** to the deeper band:

```js
    const tiers = [
      { pad: 0, c: "#4a4033" },
      { pad: 38, c: "#564a3a" },
      { pad: 76, c: "#635543" },
    ];
```

- [ ] **Step 4: Verify** — `node test.mjs` still passes (engine untouched); take a cheer-state screenshot with the helper above and Read it. Expected: wider stands, old small figures spaced out on the new grid (interim state — sparse is fine), wine stall clear of seats, emperor box not overlapping tiers 0–1, nothing clipped at the outer roof bands.

- [ ] **Step 5: Commit**

```bash
git add game-boulder-dash/index.html
git commit -m "game-boulder-dash: widen stands band for larger spectators"
```

---

### Task 3: Roman spectator rendering (garments, hair, faces)

**Files:**
- Modify: `game-boulder-dash/index.html` — palettes + `buildAudience` push (~lines 1090–1114), new `drawSpectator` before `drawAudience`, `drawAudience` body (~lines 1219–1253), wine vendor in `drawStandsBase` (~line 1200)

**Interfaces:**
- Consumes: `spectatorLook(rnd)` (Task 1), seat coordinates (Task 2).
- Produces: `drawSpectator(s, wx, wy, excited, bob, walking, hasCup)` — presentation-only, no later consumers.

- [ ] **Step 1: Add palettes** next to `TUNICS`/`SKINS`:

```js
  const STOLAS = ["#7a5a8a", "#a06a4a", "#5a7a9a", "#8a4a4a", "#6a8a5a"];
  const PALLAS = ["#e0d6c2", "#c9a34a", "#7a8aa0", "#a05a3a"];
  const HAIRS  = ["#241a12", "#4a3220", "#7a4a26", "#8a8578", "#3a2a1e"];
```

- [ ] **Step 2: Assign the look in `buildAudience`.** Inside `add`, before `spectators.push`:

```js
      const look = spectatorLook((salt) => hash(i, salt));
```

and add to the pushed object:

```js
        look,
        hairC: HAIRS[look.hairIdx],
        stolaC: STOLAS[Math.floor(hash(i, 11) * STOLAS.length)],
        pallaC: PALLAS[Math.floor(hash(i, 12) * PALLAS.length)],
```

- [ ] **Step 3: Add `drawSpectator`** immediately before `drawAudience`:

```js
  // One Roman spectator: garment (tunic / toga / stola+palla), hair, and a
  // face that follows the crowd's mood. wy is the torso anchor, as before.
  function drawSpectator(s, wx, wy, excited, bob, walking, hasCup) {
    const L = s.look;
    if (L.garment === "tunic") {
      ctx.fillStyle = s.skin;                          // bare lower legs
      ctx.fillRect(wx - 4, wy + 3, 3, 5);
      ctx.fillRect(wx + 1, wy + 3, 3, 5);
      ctx.fillStyle = s.tunic;
      ctx.fillRect(wx - 6, wy - 4, 12, 8);             // knee-length tunic
      px(ctx, wx - 6, wy - 1, 12, 1, "#00000040");     // belt
    } else if (L.garment === "toga") {
      ctx.fillStyle = L.praetexta ? "#ede7d6" : "#e3dbc6";
      ctx.fillRect(wx - 6, wy - 4, 12, 12);            // ankle-length wool
      const drape = L.praetexta ? "#7a3aa0" : "#cfc4a8";
      px(ctx, wx - 6, wy - 4, 3, 8, drape);            // fold over the left shoulder
      ctx.strokeStyle = drape; ctx.lineWidth = 2;      // sinus across the chest
      ctx.beginPath();
      ctx.moveTo(wx - 4, wy - 4); ctx.lineTo(wx + 6, wy + 4);
      ctx.stroke();
    } else {                                           // stola + palla
      ctx.fillStyle = s.stolaC;
      ctx.fillRect(wx - 6, wy - 4, 12, 12);
      px(ctx, wx - 6, wy - 4, 12, 3, s.pallaC);        // palla over the shoulders
    }
    // head
    ctx.fillStyle = s.skin;
    ctx.beginPath(); ctx.arc(wx, wy - 8, 4, 0, 7); ctx.fill();
    // hair, or the palla drawn up over the head
    if (L.garment === "stola" && L.pallaUp) {
      ctx.fillStyle = s.pallaC;
      ctx.beginPath(); ctx.arc(wx, wy - 8.5, 4.6, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
    } else if (L.bald) {
      px(ctx, wx - 5, wy - 9, 2, 3, s.hairC);          // fringe at the temples
      px(ctx, wx + 3, wy - 9, 2, 3, s.hairC);
    } else {
      ctx.fillStyle = s.hairC;
      ctx.beginPath(); ctx.arc(wx, wy - 9, 4, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      if (L.bun) px(ctx, wx - 1.5, wy - 14.5, 3, 3, s.hairC);
    }
    // face: eyes always, mouth follows the crowd's mood
    px(ctx, wx - 2.5, wy - 9, 1.5, 1.5, "#3a2418");
    px(ctx, wx + 1, wy - 9, 1.5, 1.5, "#3a2418");
    if (!walking && excited > 0.45) {
      ctx.fillStyle = "#5a2420";                       // roaring open mouth
      ctx.beginPath(); ctx.ellipse(wx, wy - 5.5, 1.4, 2, 0, 0, 7); ctx.fill();
    } else if (bob > 0.5) {
      px(ctx, wx - 1, wy - 6, 2, 1, "#7a4a3a");        // chatting with a neighbor
    }
    if (hasCup) {
      px(ctx, wx + 6, wy - 4, 4, 4, "#8a2a3a");        // cup of wine
      px(ctx, wx + 6, wy - 5, 4, 1.5, "#e0b64c");
    }
    // arms up when cheering (walkers have their hands full)
    if (!walking && excited > 0.45 && bob > -0.2) {
      ctx.strokeStyle = s.skin; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(wx - 6, wy - 2); ctx.lineTo(wx - 10, wy - 13);
      ctx.moveTo(wx + 6, wy - 2); ctx.lineTo(wx + 10, wy - 13);
      ctx.stroke();
    }
  }
```

- [ ] **Step 4: Rewrite the spectator loop in `drawAudience`** — keep the walker math, delegate all drawing:

```js
    for (const s of spectators) {
      const excited = Math.min(1, cheer * s.zeal);
      const bob = Math.sin(crowdPhase * (0.8 + s.zeal * 0.3) + s.phase);
      let wx = s.x, wy = s.y + bob * (1.4 + excited * 3.5);
      let hasCup = false, walking = false;
      if (s.walker) {
        // pacing to the wine seller and back (triangle wave along the row)
        const u = (crowdPhase * s.wspeed + s.phase) % 2;
        const tri = u < 1 ? u : 2 - u;
        const off = (tri - 0.5) * s.wrange;
        if (s.axis === "x") wx += off; else wy = s.y + off;
        wy += Math.sin(crowdPhase * 6 + s.phase) * 1.2; // footsteps
        hasCup = u >= 1;                                // returning with wine
        walking = true;
      }
      drawSpectator(s, wx, wy, excited, bob, walking, hasCup);
    }
```

(The old inline body/head/cup/arms drawing is removed — `drawSpectator` owns it now.)

- [ ] **Step 5: Give the wine vendor eyes** (he already has hair) — in `drawStandsBase` after his hair rect:

```js
    px(ctx, wsx + 24.5, wsy + 6, 1.5, 1.5, "#3a2418");
    px(ctx, wsx + 28, wsy + 6, 1.5, 1.5, "#3a2418");
```

- [ ] **Step 6: Verify** — `node test.mjs` passes; screenshots via the helper: once with `setCheer(0)` (idle: closed/absent mouths, arms down, togas/stolas/tunics distinguishable, hair visible, some head-pallas) and once with `setCheer(1)` (roaring mouths, raised arms, walkers unaffected). Read both PNGs and check for clipping at tier edges, the emperor box, and the wine stall.

- [ ] **Step 7: Commit**

```bash
git add game-boulder-dash/index.html
git commit -m "game-boulder-dash: Roman crowd with togas, stolas, hair and faces"
```

---

### Task 4: Final verification and screenshot refresh

**Files:**
- Modify: `game-boulder-dash/screenshot1.jpg` (regenerate)

- [ ] **Step 1: Full test run** — `cd game-boulder-dash && node test.mjs`; expected: all pass.

- [ ] **Step 2: Retina check** — repeat the cheer screenshot with `--force-device-scale-factor=2`; Read it; figures must be crisp (no half-pixel smearing of the 1.5 px eye rects is expected — they are intentional subpixel detail).

- [ ] **Step 3: Regenerate `screenshot1.jpg`** from a cheer-state headless capture at `--window-size=880,650`:

```bash
sips -s format jpeg -s formatOptions 85 \
  /private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/5663c931-e103-4af7-977b-1fe24e7e890d/scratchpad/shot.png \
  --out /Users/neoneye/git/vibe-coding-lab/game-boulder-dash/screenshot1.jpg
```

- [ ] **Step 4: Commit**

```bash
git add game-boulder-dash/screenshot1.jpg
git commit -m "game-boulder-dash: refresh screenshot with the Roman crowd"
```
