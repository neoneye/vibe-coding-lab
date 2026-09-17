# Unit Fractions Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth "Unit fractions" tab to `continued-fractions/index.html` expanding a constant as a greedy sum of distinct unit fractions, with the same exact arithmetic and honest cutoff as the rest of the page.

**Architecture:** Two pure functions in the existing `<script id="shared-code">` block's `CF` namespace — one interval-carrying greedy expansion, one row builder — then one table-only panel in the page script. No canvas.

**Tech Stack:** Vanilla HTML/CSS/JS, `BigInt`, Node ≥ 18 for tests. No dependencies.

## Global Constraints

- Everything goes in the existing `continued-fractions/index.html`; still one self-contained file working from `file://`.
- All displayed denominators, partial sums and errors computed in exact `BigInt` rational arithmetic.
- A denominator is emitted only when `⌈1/r_lo⌉ = ⌈1/r_hi⌉` across the whole enclosure; the integer part only when `⌊lo⌋ = ⌊hi⌋`.
- The ellipsis appears exactly when `stopReason !== 'exact'`, matching the Simple tab.
- Style follows the existing page: `--fg:#111; --muted:#666; --border:#ccc; --bg:#fff; --accent:#1a5fb4`; existing `.chips`, `.chip`, `.tablewrap`, `.status`, `.terms`, `.mono` classes.
- Tests run with `node continued-fractions/test.mjs` and must exit 0. The suite currently has 88 tests.
- Commit directly to `main`. Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: The greedy expansion

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat` (`make/fromInt/add/sub/div/cmp/isZero/floor/toDecimalString`), `CF.ratCeil`, `CF.constant`, `CF.sci`.
- Produces:
  - `CF.unitFractions(lo: Rat, hi: Rat, maxTerms: number) -> {whole: BigInt, dens: BigInt[], stopReason: 'exact'|'precision-exhausted'|'max-terms'}`
  - `CF.unitFractionRows(key: string, maxTerms: number) -> {whole: BigInt, rows, stopReason}` where each row is
    `{k: number, den: BigInt, digits: number, partial: Rat, partialStr: string, error: Rat, errorStr: string}`
    and `partial` includes `whole`.

**The algorithm.** Split off the integer part, then repeatedly take `n = ⌈1/r⌉` — the
smallest denominator whose unit fraction does not overshoot the remainder — and subtract
`1/n`. Both enclosure endpoints are carried through the subtraction so the remainder stays
an interval and the certainty test is exact.

- [ ] **Step 1: Write the failing tests**

Append inside the `shared-code` block, after the last existing `XTests.test(...)` call:

```js
XTests.test('greedy unit fractions of the shipped constants', () => {
  const run = (key, n) => {
    const k = CF.constant(key);
    return CF.unitFractions(k.exact || k.lo, k.exact || k.hi, n);
  };
  const pi = run('pi', 5);
  XTests.eq(pi.whole, 3n);
  XTests.eq(pi.dens.join(','), '8,61,5020,128541455,162924332716605980');
  XTests.eq(run('e', 5).dens.join(','), '2,5,55,9999,3620211523');
  XTests.eq(run('sqrt2', 5).dens.join(','), '3,13,253,218201,61323543802');
});

XTests.test('each denominator is the smallest that does not overshoot', () => {
  // Greediness checked directly: 1/n fits under the remainder, 1/(n-1) does not.
  const k = CF.constant('pi');
  const r = CF.unitFractions(k.lo, k.hi, 4);
  let rem = CF.Rat.sub(k.lo, CF.Rat.fromInt(r.whole));
  for (const n of r.dens) {
    XTests.ok(CF.Rat.cmp(CF.Rat.make(1n, n), rem) <= 0, `1/${n} overshot the remainder`);
    if (n > 1n) {
      XTests.ok(CF.Rat.cmp(CF.Rat.make(1n, n - 1n), rem) > 0,
                `1/${n - 1n} would also have fitted, so ${n} was not greedy`);
    }
    rem = CF.Rat.sub(rem, CF.Rat.make(1n, n));
  }
});

XTests.test('partial sums climb toward the target and never pass it', () => {
  for (const key of ['pi', 'e', 'sqrt2', 'phi', 'ln2', 'gamma', 'cbrt2']) {
    const { rows } = CF.unitFractionRows(key, 5);
    const x = CF.constant(key).lo;
    let prev = null;
    for (const row of rows) {
      XTests.ok(CF.Rat.cmp(row.partial, x) < 0, `${key} row ${row.k} passed the target`);
      if (prev) XTests.ok(CF.Rat.cmp(row.partial, prev) > 0, `${key} row ${row.k} did not climb`);
      prev = row.partial;
    }
  }
});

XTests.test('denominators strictly increase', () => {
  for (const key of ['pi', 'e', 'sqrt2', 'gamma']) {
    const { rows } = CF.unitFractionRows(key, 5);
    for (let i = 1; i < rows.length; i++) {
      XTests.ok(rows[i].den > rows[i - 1].den,
                `${key}: ${rows[i].den} did not exceed ${rows[i - 1].den}`);
    }
  }
});

XTests.test('a rational terminates exactly', () => {
  const k = CF.constant('r355_113');
  const r = CF.unitFractions(k.exact, k.exact, 40);
  XTests.eq(r.stopReason, 'exact');
  let sum = CF.Rat.fromInt(r.whole);
  for (const n of r.dens) sum = CF.Rat.add(sum, CF.Rat.make(1n, n));
  XTests.eq(CF.Rat.cmp(sum, k.exact), 0, 'partial sum did not reach 355/113');
});

XTests.test('the expansion stops when the enclosure cannot determine a denominator', () => {
  const lo = CF.Rat.fromDecimalString('3.14159');
  const hi = CF.Rat.add(lo, CF.Rat.make(1n, 100000n));
  const r = CF.unitFractions(lo, hi, 20);
  XTests.eq(r.stopReason, 'precision-exhausted');
  XTests.ok(r.dens.length < 5, `expected a short expansion, got ${r.dens.length}`);
  XTests.eq(r.dens.slice(0, 2).join(','), '8,61');
});

XTests.test('the integer part is withheld when the enclosure straddles an integer', () => {
  const lo = CF.Rat.fromDecimalString('2.9999');
  const hi = CF.Rat.fromDecimalString('3.0001');
  const r = CF.unitFractions(lo, hi, 5);
  XTests.eq(r.stopReason, 'precision-exhausted');
  XTests.eq(r.dens.length, 0);
});

XTests.test('unitFractionRows reports digits and shrinking error', () => {
  const { rows } = CF.unitFractionRows('pi', 5);
  XTests.eq(rows[0].den, 8n);
  XTests.eq(rows[0].digits, 1);
  XTests.eq(rows[3].digits, 9);            // 128541455
  XTests.eq(rows[4].digits, 18);           // 162924332716605980
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].error, b = rows[i].error;
    XTests.ok(CF.Rat.cmp(b, a) < 0, `error did not shrink at row ${i}`);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.unitFractions is not a function`.

- [ ] **Step 3: Implement**

Add inside the `CF` IIFE, before the final `return {...}`:

```js
  // ---- greedy unit fractions (the Egyptian-fraction algorithm) ----
  //
  // Take the largest unit fraction that still fits under the remainder, repeatedly:
  // n = ceil(1/r) is the smallest denominator whose 1/n does not overshoot. Both
  // enclosure endpoints are carried through, so the remainder stays an interval and
  // "is this denominator certain?" is an exact question.

  const unitFractions = (lo, hi, maxTerms) => {
    const fl = Rat.floor(lo), fh = Rat.floor(hi);
    if (fl !== fh) return { whole: 0n, dens: [], stopReason: 'precision-exhausted' };
    const whole = fl;
    let a = Rat.sub(lo, Rat.fromInt(whole)), b = Rat.sub(hi, Rat.fromInt(whole));
    const dens = [];
    for (let i = 0; i < maxTerms; i++) {
      if (Rat.isZero(a) && Rat.isZero(b)) return { whole, dens, stopReason: 'exact' };
      if (Rat.isZero(a) || Rat.isZero(b)) return { whole, dens, stopReason: 'precision-exhausted' };
      const na = ratCeil(Rat.div(Rat.fromInt(1), a)), nb = ratCeil(Rat.div(Rat.fromInt(1), b));
      if (na !== nb) return { whole, dens, stopReason: 'precision-exhausted' };
      dens.push(na);
      // r - 1/n on both endpoints. The map is increasing, so the order is preserved.
      a = Rat.sub(a, Rat.make(1n, na));
      b = Rat.sub(b, Rat.make(1n, nb));
    }
    return { whole, dens, stopReason: 'max-terms' };
  };

  const unitFractionRows = (key, maxTerms) => {
    const k = constant(key);
    const x = k.exact || k.lo;
    const r = k.exact
      ? unitFractions(k.exact, k.exact, maxTerms)
      : unitFractions(k.lo, k.hi, maxTerms);
    let partial = Rat.fromInt(r.whole);
    const rows = r.dens.map((den, i) => {
      partial = Rat.add(partial, Rat.make(1n, den));
      const error = Rat.sub(x, partial);
      return {
        k: i + 1, den, digits: den.toString().length,
        partial, partialStr: Rat.toDecimalString(partial, 20),
        error, errorStr: sci(error, 5),
      };
    });
    return { whole: r.whole, rows, stopReason: r.stopReason };
  };
```

Extend the IIFE's `return {...}` with:

```js
           unitFractions, unitFractionRows,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 96 tests passed`

If `greedy unit fractions of the shipped constants` fails on the fifth denominator, check
`maxTerms` first — the fifth term for π needs the remainder to still be certain, and if the
enclosure runs out the array is simply shorter. A shorter array is a correct result, not a
bug; shorten the expected string to what the enclosure supports and note the count.

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: greedy unit-fraction expansion with an interval cutoff

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The Unit fractions tab

**Files:**
- Modify: `continued-fractions/index.html` (tab bar, panel markup, page script)

**Interfaces:**
- Consumes: `CF.CONSTANTS`, `CF.constant`, `CF.unitFractionRows`, `CF.convergentRowsFor`,
  `CF.Rat`, `CF.sci`, plus the existing `el(id)`, `state`, `STOP_REASON`.
- Produces: DOM ids `#uf-chips`, `#uf-expansion`, `#uf-status`, `#uf-table`, `#uf-compare`.

- [ ] **Step 1: Add the tab button and panel**

Add a fifth button after the Euler product button in the tab bar:

```html
    <button class="tab" data-panel="unit">Unit fractions</button>
```

Add the panel after the Euler panel's closing `</div>`:

```html
  <div class="panel" id="panel-unit">
    <div class="chips" id="uf-chips"></div>
    <div class="terms" id="uf-expansion"></div>
    <p class="status" id="uf-status"></p>
    <div class="tablewrap"><table id="uf-table"></table></div>
    <p class="status" id="uf-compare"></p>
  </div>
```

- [ ] **Step 2: Render the expansion and table**

Add to the page script, before the `document.querySelectorAll('.tab')` wiring:

```js
  // ---------- Unit fractions tab ----------
  state.unit = { key: 'pi' };
  const UF_MAX_TERMS = 12;

  function renderUnit() {
    const s = state.unit;
    el('uf-chips').innerHTML = CF.CONSTANTS
      .map(c => `<button class="chip ${c.key === s.key ? 'active' : ''}" data-key="${c.key}">${c.label}</button>`)
      .join('');
    el('uf-chips').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      s.key = b.dataset.key; renderUnit();
    }));

    const k = CF.constant(s.key);
    const { whole, rows, stopReason } = CF.unitFractionRows(s.key, UF_MAX_TERMS);
    const continues = stopReason !== 'exact';

    el('uf-expansion').textContent = `${k.label} = ${whole}` +
      rows.map(r => ` + 1/${r.den}`).join('') + (continues ? ' + …' : '');

    el('uf-table').innerHTML =
      '<tr><th>k</th><th>nₖ</th><th>digits</th><th>partial sum</th><th>error</th></tr>' +
      rows.map(r => {
        const d = String(r.den);
        const shown = d.length <= 18 ? d : d.slice(0, 8) + '…' + d.slice(-8);
        return `<tr><td>${r.k}</td><td class="mono" title="${d}">${shown}</td>` +
               `<td>${r.digits}</td><td class="mono">${r.partialStr.slice(0, 18)}</td>` +
               `<td class="mono">${r.errorStr}</td></tr>`;
      }).join('');

    el('uf-status').textContent =
      `${rows.length} unit fractions — ` +
      (stopReason === 'exact'
        ? 'the value is rational, so the sum closes exactly and these are all there are.'
        : stopReason === 'precision-exhausted'
        ? 'everything the stored 60 digits determine. The remainder roughly squares at each ' +
          'step, so the expansion is short because it converges fast, not because the page gave up.'
        : `stopped at the display limit of ${UF_MAX_TERMS}.`);

    renderUnitCompare(rows);
  }
```

- [ ] **Step 3: Render the computed comparison line**

```js
  // How many regular continued-fraction terms are needed to match the accuracy the
  // unit-fraction sum reached? Computed, not asserted.
  function renderUnitCompare(rows) {
    const box = el('uf-compare');
    if (!rows.length) { box.textContent = ''; return; }
    const s = state.unit;
    const target = rows[rows.length - 1].error;
    const absT = target.n < 0n ? CF.Rat.neg(target) : target;
    const cf = CF.convergentRowsFor(s.key, 40, 'floor').rows;
    const hit = cf.find(r => {
      const a = r.error.n < 0n ? CF.Rat.neg(r.error) : r.error;
      return CF.Rat.cmp(a, absT) <= 0;
    });
    const maxDigits = Math.max(...rows.map(r => r.digits));
    const cfDigits = hit ? Math.max(...cf.slice(0, hit.n + 1).map(r => String(r.a).length)) : 0;
    box.textContent =
      `${rows.length} unit fractions reach an error of ${CF.sci(absT, 4)}. ` +
      (hit
        ? `The regular continued fraction needs ${hit.n + 1} terms to match it — but its ` +
          `largest term has ${cfDigits} digits, where the largest denominator here has ${maxDigits}. ` +
          'Fast convergence bought with exploding denominators.'
        : 'The regular continued fraction does not match it within the terms this page can certify.');
  }

  el('uf-chips') && renderUnit();
```

- [ ] **Step 4: Run the tests and smoke-test**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 96 tests passed`

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --enable-logging=stderr \
  "file://$PWD/continued-fractions/index.html" 2>&1 | grep -ci "uncaught"
```

Expected: 0.

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --dump-dom \
  "file://$PWD/continued-fractions/index.html" 2>/dev/null | grep -o "1/128541455" | head -1
```

Expected: `1/128541455`.

- [ ] **Step 5: Look at the tab**

```bash
cd /Users/neoneye/git/vibe-coding-lab && SC="${TMPDIR:-/tmp}/cf_unit.html" && \
  sed 's|  document.querySelectorAll(.\.tab.).forEach(t => t.addEventListener|  setTimeout(()=>document.querySelector(".tab[data-panel=unit]").click(),0);\n  document.querySelectorAll(".tab").forEach(t => t.addEventListener|' \
  continued-fractions/index.html > "$SC" && \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --virtual-time-budget=5000 --window-size=1000,700 --screenshot="${TMPDIR:-/tmp}/cf_unit.png" \
  "file://$SC" 2>/dev/null && echo "${TMPDIR:-/tmp}/cf_unit.png"
```

Read the PNG and confirm: the expansion line reads `π = 3 + 1/8 + 1/61 + 1/5020 + … `, the
digits column climbs 1, 2, 4, 9, 18, the error column falls to about 1e-18 or beyond, and
the comparison line names a continued-fraction term count. Fix anything that does not match
before committing.

- [ ] **Step 6: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: unit fractions tab, a constant as a sum of unit fractions

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Refresh the screenshot

**Files:**
- Modify: `continued-fractions/screenshot1.jpg`

- [ ] **Step 1: Recapture**

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --window-size=1100,900 \
  --screenshot="${TMPDIR:-/tmp}/cf_shot.png" "file://$PWD/continued-fractions/index.html" 2>/dev/null && \
  sips -s format jpeg -s formatOptions 82 "${TMPDIR:-/tmp}/cf_shot.png" \
  --out continued-fractions/screenshot1.jpg >/dev/null && ls -la continued-fractions/screenshot1.jpg
```

Expected: a JPEG under 300 KB. Read it and confirm five tabs are visible.

- [ ] **Step 2: Confirm the gallery needs no rebuild**

```bash
cd /Users/neoneye/git/vibe-coding-lab && python3 build_gallery.py >/dev/null && git diff --stat index.html
```

Expected: no change to `index.html`.

- [ ] **Step 3: Final test run**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 96 tests passed`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add continued-fractions/screenshot1.jpg
git commit -m "continued-fractions: refresh screenshot for the unit fractions tab

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
