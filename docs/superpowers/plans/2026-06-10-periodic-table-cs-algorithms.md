# Periodic Table of CS Algorithms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A self-contained `index.html` showing ~94 CS building blocks (algorithms, data structures, paradigms) as a periodic-table-styled, color-coded, clickable reference.

**Architecture:** Single HTML file. Dataset (`CATEGORIES`, `ELEMENTS`) plus `DataTests` live in a `<script id="shared-code">` block so `test.mjs` can validate it in Node without a browser. A second inline script renders category regions of element tiles, a hover tooltip, a modal detail card, and three composable filters (search, complexity class, category).

**Tech Stack:** Vanilla HTML/CSS/JS, no dependencies. `node test.mjs` for dataset tests. Headless Chrome for screenshots.

**Spec:** `docs/superpowers/specs/2026-06-10-periodic-table-cs-algorithms-design.md`

**Project dir:** `education-periodic-table-computer-science-algorithms/`

---

## The dataset (reference for Tasks 1–2)

Element object shape (every field required unless noted):

```js
{
  symbol: "Qs",                 // unique, 1-2 chars
  name: "Quicksort",
  category: "sorting",          // key into CATEGORIES
  year: "1959",                 // string; "ancient" etc. allowed
  inventor: "Tony Hoare",
  time: { best: "O(n log n)", average: "O(n log n)", worst: "O(n²)" },
  space: "O(log n)",
  complexityClass: "O(n log n)", // one of CLASSES below (average time)
  description: "Partition around a pivot ...",  // one paragraph
  uses: ["General-purpose sorting", "Library sort routines"],
  related: ["Me", "Hs", "Dc"],  // existing symbols
  pseudocode: "quicksort(A, lo, hi):\n  ..."   // optional field
}
```

`complexityClass` allowed values (also the legend):
`["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)", "varies"]`

Categories (key, display name, color hue):

| key | name | hue |
|---|---|---|
| sorting | Sorting | 4 (red) |
| searching | Searching | 28 (orange) |
| graphs | Graphs | 48 (yellow) |
| strings | Strings | 88 (lime) |
| dp | Dynamic Programming | 140 (green) |
| structures | Data Structures | 175 (teal) |
| paradigms | Paradigms | 205 (blue) |
| math | Math & Numeric | 235 (indigo) |
| compression | Compression | 270 (purple) |
| crypto | Crypto & Hashing | 300 (magenta) |
| ml | ML & Optimization | 330 (pink) |
| systems | Concurrency & Systems | 0 sat 0 (gray) |

Colors are produced as `hsl(hue 55% 55%)` accents on dark tiles; systems uses a gray.

Full element list (atomic number = position in this list, 1-based). Every
entry gets full data per the shape above; pseudocode for all algorithm entries,
omitted for paradigms and plain structures where it adds nothing.

Sorting: 1 Bu Bubble Sort O(n²) · 2 In Insertion Sort O(n²) · 3 Se Selection Sort O(n²) · 4 Sl Shell Sort varies · 5 Me Merge Sort O(n log n) · 6 Qs Quicksort O(n log n) · 7 Hs Heapsort O(n log n) · 8 Co Counting Sort O(n) · 9 Ra Radix Sort O(n) · 10 Bk Bucket Sort O(n) · 11 Tm Timsort O(n log n)

Searching: 12 Ls Linear Search O(n) · 13 Bs Binary Search O(log n) · 14 Te Ternary Search O(log n) · 15 Ip Interpolation Search O(log n) · 16 Jp Jump Search O(n) [O(√n) shown in card] · 17 Ex Exponential Search O(log n) · 18 Qk Quickselect O(n)

Graphs: 19 Bf Breadth-First Search O(n) [V+E in card] · 20 Df Depth-First Search O(n) · 21 Dj Dijkstra O(n log n) · 22 Be Bellman-Ford O(n²) · 23 Fw Floyd-Warshall varies [O(V³)] · 24 As A* Search varies · 25 Pr Prim O(n log n) · 26 Kr Kruskal O(n log n) · 27 To Topological Sort O(n) · 28 Tj Tarjan SCC O(n) · 29 Ks Kosaraju SCC O(n) · 30 Uf Union-Find O(log n) [α(n) in card] · 31 Ek Edmonds-Karp varies [O(VE²)]

Strings: 32 Km Knuth-Morris-Pratt O(n) · 33 Rk Rabin-Karp O(n) · 34 Bm Boyer-Moore O(n) · 35 Za Z-Algorithm O(n) · 36 Ah Aho-Corasick O(n) · 37 Mn Manacher O(n) · 38 Sa Suffix Array O(n log n) · 39 Ed Edit Distance O(n²)

Dynamic Programming: 40 Mz Memoization O(n) · 41 Kn 0/1 Knapsack O(n²) [O(nW)] · 42 Lc Longest Common Subsequence O(n²) · 43 Li Longest Increasing Subsequence O(n log n) · 44 Cc Coin Change O(n²) · 45 Ss Subset Sum O(n²) · 46 Mc Matrix Chain Multiplication varies [O(n³)]

Data Structures: 47 Ar Array O(1) · 48 Ll Linked List O(n) · 49 St Stack O(1) · 50 Qu Queue O(1) · 51 Dq Deque O(1) · 52 Ht Hash Table O(1) · 53 Bt Binary Search Tree O(log n) · 54 Av AVL Tree O(log n) · 55 Rb Red-Black Tree O(log n) · 56 He Binary Heap O(log n) · 57 Tr Trie O(n) [O(m) key length] · 58 Sg Segment Tree O(log n) · 59 Fe Fenwick Tree O(log n) · 60 Sk Skip List O(log n) · 61 Bl Bloom Filter O(1) · 62 Gp Adjacency List O(1)

Paradigms (no pseudocode, time/space "varies"): 63 Dc Divide & Conquer · 64 Gr Greedy · 65 Ba Backtracking · 66 Bb Branch & Bound · 67 Rn Randomized · 68 Tp Two Pointers · 69 Sw Sliding Window — all complexityClass "varies" except Tp/Sw which are "O(n)"

Math & Numeric: 70 Gc Euclid's GCD O(log n) · 71 Si Sieve of Eratosthenes O(n log n) [n log log n] · 72 Fx Fast Exponentiation O(log n) · 73 Ka Karatsuba varies [O(n^1.585)] · 74 Ff Fast Fourier Transform O(n log n) · 75 Nw Newton's Method varies

Compression: 76 Rl Run-Length Encoding O(n) · 77 Hu Huffman Coding O(n log n) · 78 Lz LZ77 O(n) · 79 Ac Arithmetic Coding O(n)

Crypto & Hashing: 80 Sh SHA-256 O(n) · 81 Mr Miller-Rabin O(log n) [k log³n] · 82 Dh Diffie-Hellman O(log n) · 83 Rs RSA varies

ML & Optimization: 84 Gd Gradient Descent varies · 85 Kc k-Means O(n) [per iteration] · 86 Nn k-Nearest Neighbors O(n) · 87 Nb Naive Bayes O(n) · 88 Sn Simulated Annealing varies

Concurrency & Systems: 89 Mx Mutex O(1) · 90 Sm Semaphore O(1) · 91 Lr LRU Cache O(1) · 92 Ch Consistent Hashing O(log n) · 93 Mp MapReduce O(n) · 94 Rf Raft Consensus varies

`related` links must form a sensible web: sorts ↔ Dc/He, graph algorithms ↔ Gp/Uf/He, DP entries ↔ Mz, crypto ↔ math, etc. Every element gets 2–4 related symbols.

---

### Task 1: Test harness, skeleton, categories, dataset validation

**Files:**
- Create: `education-periodic-table-computer-science-algorithms/test.mjs`
- Create: `education-periodic-table-computer-science-algorithms/index.html`

- [ ] **Step 1: Write test.mjs (the failing test)**

```js
// Runs the DataTests embedded in index.html's shared-code script block.
// Usage: node test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) {
  console.error("shared-code block not found");
  process.exit(1);
}
const ok = new Function(`${m[1]}; return DataTests.run();`)();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd education-periodic-table-computer-science-algorithms && node test.mjs`
Expected: FAIL (no such file index.html → ENOENT)

- [ ] **Step 3: Write index.html skeleton with shared-code block**

HTML5 skeleton: `<title>Periodic Table of Computer Science Algorithms</title>`, dark-theme `<body>`, empty `<main id="app">`, then the shared-code block containing `CLASSES`, `CATEGORIES` (all 12 from the table above, each `{ name, hue, blurb }` — systems gets `gray: true`), an `ELEMENTS` array seeded with the 11 sorting elements (full data per the shape), and `DataTests`:

```js
const CLASSES = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)", "varies"];

const CATEGORIES = {
  sorting:     { name: "Sorting",               hue: 4,   blurb: "Arranging items into order." },
  searching:   { name: "Searching",             hue: 28,  blurb: "Locating items in collections." },
  graphs:      { name: "Graphs",                hue: 48,  blurb: "Traversal, paths, connectivity, flow." },
  strings:     { name: "Strings",               hue: 88,  blurb: "Pattern matching and text processing." },
  dp:          { name: "Dynamic Programming",   hue: 140, blurb: "Optimal substructure + overlapping subproblems." },
  structures:  { name: "Data Structures",       hue: 175, blurb: "Ways to organize data for fast operations." },
  paradigms:   { name: "Paradigms",             hue: 205, blurb: "General strategies for designing algorithms." },
  math:        { name: "Math & Numeric",        hue: 235, blurb: "Number theory and numerical methods." },
  compression: { name: "Compression",           hue: 270, blurb: "Encoding data in fewer bits." },
  crypto:      { name: "Crypto & Hashing",      hue: 300, blurb: "Secrecy, integrity, and fingerprints." },
  ml:          { name: "ML & Optimization",     hue: 330, blurb: "Learning from data, searching solution spaces." },
  systems:     { name: "Concurrency & Systems", hue: 0, gray: true, blurb: "Coordinating work across threads and machines." },
};

const ELEMENTS = [ /* sorting elements 1-11, full data */ ];

const DataTests = {
  run() {
    const errors = [];
    const symbols = new Set();
    const required = ["symbol", "name", "category", "year", "inventor", "time", "space", "complexityClass", "description", "uses", "related"];
    for (const el of ELEMENTS) {
      const id = el.symbol || el.name || "?";
      for (const f of required) {
        if (el[f] === undefined || el[f] === null || el[f] === "") errors.push(`${id}: missing ${f}`);
      }
      if (!/^[A-Z][a-z]?$/.test(el.symbol || "")) errors.push(`${id}: bad symbol`);
      if (symbols.has(el.symbol)) errors.push(`${id}: duplicate symbol`);
      symbols.add(el.symbol);
      if (!CATEGORIES[el.category]) errors.push(`${id}: unknown category ${el.category}`);
      if (!CLASSES.includes(el.complexityClass)) errors.push(`${id}: bad complexityClass ${el.complexityClass}`);
      if (!el.time || !el.time.best || !el.time.average || !el.time.worst) errors.push(`${id}: incomplete time`);
      if (!Array.isArray(el.uses) || el.uses.length === 0) errors.push(`${id}: uses empty`);
      if (!Array.isArray(el.related) || el.related.length === 0) errors.push(`${id}: related empty`);
      if (el.description && el.description.length < 60) errors.push(`${id}: description too short`);
    }
    for (const el of ELEMENTS) {
      for (const r of el.related || []) {
        if (!symbols.has(r)) errors.push(`${el.symbol}: related '${r}' does not exist`);
        if (r === el.symbol) errors.push(`${el.symbol}: self-reference in related`);
      }
    }
    for (const e of errors) console.error("FAIL: " + e);
    console.log(errors.length === 0 ? `PASS: ${ELEMENTS.length} elements valid` : `${errors.length} errors`);
    return errors.length === 0;
  },
};
```

Note: while only sorting elements exist, their `related` may only reference other sorting symbols (fix cross-category refs in Task 2).

- [ ] **Step 4: Run test to verify it passes**

Run: `node test.mjs` — Expected: `PASS: 11 elements valid`, exit 0

- [ ] **Step 5: Commit**

```bash
git add education-periodic-table-computer-science-algorithms
git commit -m "feat(periodic-table-cs): test harness, categories, sorting elements"
```

### Task 2: Full dataset (remaining 83 elements)

**Files:**
- Modify: `education-periodic-table-computer-science-algorithms/index.html` (shared-code block only)

- [ ] **Step 1: Strengthen the test first**

Add to `DataTests.run()` before the error report:

```js
if (ELEMENTS.length < 90) errors.push(`only ${ELEMENTS.length} elements, want >= 90`);
const usedCats = new Set(ELEMENTS.map(e => e.category));
for (const k of Object.keys(CATEGORIES)) {
  if (!usedCats.has(k)) errors.push(`category ${k} has no elements`);
}
```

Run: `node test.mjs` — Expected: FAIL (`only 11 elements...`, missing categories)

- [ ] **Step 2: Author the remaining 83 elements**

Append elements 12–94 exactly as listed in "The dataset" section above, in
that order, each with complete real data (year, inventor, complexities,
≥60-char description, uses, related, pseudocode for algorithms). Keep entries
compact (one field per line max; pseudocode as `\n`-joined string or template
literal). Add cross-category `related` links from sorting elements now that
targets exist (e.g. Me → Dc, Hs → He).

- [ ] **Step 3: Run test to verify it passes**

Run: `node test.mjs` — Expected: `PASS: 94 elements valid`, exit 0

- [ ] **Step 4: Commit**

```bash
git add -u && git commit -m "feat(periodic-table-cs): full 94-element dataset"
```

### Task 3: Grid rendering and tile styling

**Files:**
- Modify: `education-periodic-table-computer-science-algorithms/index.html` (CSS in `<style>`, UI code in a second `<script>` after shared-code)

- [ ] **Step 1: Page chrome + CSS**

Dark theme: `body { background:#0f1115; color:#e8eaf0; font-family: system-ui, sans-serif; }`. Header with title + subtitle. Each category renders as a region:

```html
<section class="region" style="--hue:4">
  <h2>Sorting <span class="blurb">Arranging items into order.</span></h2>
  <div class="tiles"> ...tiles... </div>
</section>
```

Tile markup and core CSS:

```html
<button class="tile" data-symbol="Qs" style="--hue:4">
  <span class="num">6</span>
  <span class="sym">Qs</span>
  <span class="name">Quicksort</span>
  <span class="cx">O(n log n)</span>
</button>
```

```css
.regions { display:flex; flex-wrap:wrap; gap:18px; align-items:flex-start; }
.region { border:1px solid hsl(var(--hue) 40% 35% / .6); border-radius:10px; padding:10px 12px 12px; }
.region.gray { border-color:hsl(0 0% 45% / .6); }
.tiles { display:grid; grid-template-columns:repeat(auto-fill, 72px); gap:6px; }
.tile { width:72px; height:78px; border-radius:6px; cursor:pointer; position:relative;
  background:hsl(var(--hue) 45% 16%); border:1px solid hsl(var(--hue) 55% 42%);
  color:inherit; display:flex; flex-direction:column; align-items:center; padding:2px 3px; }
.tile .num { position:absolute; top:2px; left:5px; font-size:9px; opacity:.6; }
.tile .sym { font-size:22px; font-weight:700; margin-top:12px; color:hsl(var(--hue) 70% 70%); }
.tile .name { font-size:8.5px; text-align:center; line-height:1.1; overflow:hidden; }
.tile .cx { font-size:8px; opacity:.65; margin-top:auto; }
.tile:hover { transform:translateY(-2px); border-color:hsl(var(--hue) 80% 65%); z-index:2; }
.tile.dim { opacity:.18; }
.tile.hit { box-shadow:0 0 0 2px hsl(var(--hue) 90% 65%); }
```

Gray category: tiles get `filter:saturate(0)` via a `.gray` class, or use `--hue` with 0% saturation variants — simplest is a `.tile.gray { background:hsl(0 0% 18%); border-color:hsl(0 0% 45%); }` override plus `.tile.gray .sym { color:hsl(0 0% 75%); }`.

- [ ] **Step 2: Render code**

```js
const app = document.getElementById("app");
const byCategory = {};
ELEMENTS.forEach((el, i) => {
  el.num = i + 1;
  (byCategory[el.category] ??= []).push(el);
});
const regionsDiv = document.createElement("div");
regionsDiv.className = "regions";
for (const [key, cat] of Object.entries(CATEGORIES)) {
  const section = document.createElement("section");
  section.className = "region" + (cat.gray ? " gray" : "");
  section.style.setProperty("--hue", cat.hue);
  section.innerHTML = `<h2>${cat.name} <span class="blurb">${cat.blurb}</span></h2><div class="tiles"></div>`;
  const tiles = section.querySelector(".tiles");
  for (const el of byCategory[key] || []) tiles.appendChild(makeTile(el, cat));
  regionsDiv.appendChild(section);
}
app.appendChild(regionsDiv);
```

`makeTile` builds the button markup shown in Step 1 (use `textContent` for data values; no innerHTML with element data).

- [ ] **Step 3: Verify visually**

Open in headless Chrome, screenshot, inspect:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --screenshot=/tmp/ptcs.png --window-size=1600,1200 "file://$PWD/index.html"
```

Expected: 12 colored regions, 94 tiles, periodic-table-cell look.

- [ ] **Step 4: Commit**

```bash
git add -u && git commit -m "feat(periodic-table-cs): category grid and tile rendering"
```

### Task 4: Tooltip and modal detail card

**Files:**
- Modify: `education-periodic-table-computer-science-algorithms/index.html`

- [ ] **Step 1: Tooltip**

One absolutely-positioned `#tooltip` div, shown on tile `mouseenter` (name + average complexity), hidden on `mouseleave`; positioned near the tile via `getBoundingClientRect`, clamped to viewport.

- [ ] **Step 2: Modal card**

`<dialog id="card">` styled as a zperiod-style info card. `openCard(el)` fills:

- header: big symbol in a colored box, atomic number, name, category chip
- properties grid: year, inventor, best/average/worst time, space
- description paragraph; "Typical uses" bullet list
- "Related" row of chips — each chip is a button; click → `openCard(bySymbol(chipSym))`
- pseudocode in `<pre>` (section hidden when `el.pseudocode` is absent)
- prev/next arrow buttons cycling atomic-number order (wrap around); ArrowLeft/ArrowRight keys do the same while open; Esc and backdrop-click close (native `dialog` Esc + a click handler checking `event.target === dialog`)

All element data inserted via `textContent`.

- [ ] **Step 3: Verify**

Headless-Chrome screenshot with a card forced open:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --screenshot=/tmp/ptcs-card.png --window-size=1600,1200 \
  --run-all-compositor-stages-before-draw --virtual-time-budget=2000 \
  "file://$PWD/index.html#Qs"
```

Support a location-hash deep link: on load, if `location.hash` names a symbol, open its card (this both enables the screenshot and is a nice feature). Verify card shows all fields + pseudocode; verify a paradigm (e.g. `#Gr`) hides the pseudocode section.

- [ ] **Step 4: Commit**

```bash
git add -u && git commit -m "feat(periodic-table-cs): tooltip and modal detail card"
```

### Task 5: Search and legend filters

**Files:**
- Modify: `education-periodic-table-computer-science-algorithms/index.html`

- [ ] **Step 1: Controls bar**

Below the header: search `<input type="search" placeholder="Search algorithms…">`, complexity chips (one per `CLASSES` entry), category chips (one per category, in its color). Chips are toggle buttons; at most one complexity chip and one category chip active at a time (clicking active one clears it).

- [ ] **Step 2: Filter logic**

```js
const state = { q: "", cls: null, cat: null };
function applyFilters() {
  const q = state.q.trim().toLowerCase();
  for (const el of ELEMENTS) {
    const matchQ = !q || el.name.toLowerCase().includes(q) || el.symbol.toLowerCase() === q
      || CATEGORIES[el.category].name.toLowerCase().includes(q)
      || el.complexityClass.toLowerCase().includes(q);
    const matchCls = !state.cls || el.complexityClass === state.cls;
    const matchCat = !state.cat || el.category === state.cat;
    const show = matchQ && matchCls && matchCat;
    el.tileEl.classList.toggle("dim", !show);
    el.tileEl.classList.toggle("hit", show && Boolean(q || state.cls || state.cat));
  }
}
```

Search input → `state.q` on `input` event; chips set `state.cls`/`state.cat` and toggle an `.active` class. All three compose (AND).

- [ ] **Step 3: Verify**

Headless screenshots: `?` can't drive input, so verify interactively-equivalent paths — temporarily check via DevTools-less route: append a test hook `window.__setFilter = (q, cls, cat) => { ... applyFilters(); }` is NOT needed; instead verify by screenshot after adding `#Qs`-style hash check plus manual screenshot of default state, and run `node test.mjs` (still passes). Visual check: load page, screenshot, confirm chips render.

- [ ] **Step 4: Commit**

```bash
git add -u && git commit -m "feat(periodic-table-cs): search and legend filters"
```

### Task 6: Screenshot, gallery, final verification

**Files:**
- Create: `education-periodic-table-computer-science-algorithms/screenshot1.jpg`
- Modify: `gallery.yaml`, regenerate gallery via `build_gallery.py`

- [ ] **Step 1: Final test run**

Run: `node test.mjs` — Expected: `PASS: 94 elements valid`

- [ ] **Step 2: Screenshot**

Headless Chrome PNG at 1600×1200, convert to `screenshot1.jpg` (match other projects: `sips -s format jpeg /tmp/ptcs.png --out screenshot1.jpg` on macOS).

- [ ] **Step 3: Gallery title override**

Add to `gallery.yaml`: `education-periodic-table-computer-science-algorithms: Periodic Table of CS Algorithms` and run `python3 build_gallery.py` (check script usage first; commit regenerated `index.html` at repo root if it changes).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(periodic-table-cs): screenshot and gallery entry"
```
