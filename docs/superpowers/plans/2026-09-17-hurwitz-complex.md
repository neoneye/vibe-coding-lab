# Hurwitz Complex Continued Fractions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add exact Gaussian-rational arithmetic and a sixth "Complex" tab to `continued-fractions/index.html`, expanding complex constants as Hurwitz continued fractions over the Gaussian integers.

**Architecture:** A `CRat` type of two `Rat`s in the existing `<script id="shared-code">` block, a disk-shaped enclosure (centre plus rational radius) because inversion does not preserve rectangles in ℂ, the Hurwitz expansion and its convergents, then one tab with a table and a complex-plane canvas.

**Tech Stack:** Vanilla HTML/CSS/JS, `BigInt`, `<canvas>`, Node ≥ 18 for tests. No dependencies.

## Global Constraints

- Everything goes in the existing `continued-fractions/index.html`; still one self-contained file working from `file://`.
- All terms, convergents and errors computed in exact `BigInt` rational arithmetic via `Rat` and `CRat`. Doubles only for drawing coordinates.
- A term is emitted only when every point of the enclosing disk rounds to the same Gaussian integer.
- Radius propagation must never be optimistic: where `|r|` is needed it is replaced by a rational **lower** bound, which can only enlarge the radius.
- The ellipsis appears exactly when `stopReason !== 'exact'`, matching the other tabs.
- Canvases sized in device pixels via the existing `fitCanvas(canvas, cssW, cssH)`.
- Tests run with `node continued-fractions/test.mjs` and must exit 0. The suite currently has 96 tests.
- Commit directly to `main`. Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Gaussian rationals and a rational square-root lower bound

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.isqrt`, `CF.ratRound`.
- Produces:
  - `CF.cOf(re: Rat, im: Rat) -> CRat` where `CRat = {re: Rat, im: Rat}`
  - `CF.cAdd/cSub/cMul(a: CRat, b: CRat) -> CRat`
  - `CF.cNormSq(z: CRat) -> Rat`
  - `CF.cInv(z: CRat) -> CRat` — throws on zero
  - `CF.cIsZero(z: CRat) -> boolean`
  - `CF.cNearestGaussian(z: CRat) -> CRat` — `ratRound` on each part
  - `CF.cStr(z: CRat, digits: number) -> string` — `"a+bi"` form for display
  - `CF.ratSqrtLower(m: Rat, digits: number) -> Rat` — a rational `L ≥ 0` with `L² ≤ m`

- [ ] **Step 1: Write the failing tests**

Append inside the `shared-code` block, after the last existing `XTests.test(...)` call:

```js
XTests.test('Gaussian rational arithmetic is exact', () => {
  const R = CF.Rat, i = (n) => R.fromInt(n);
  const a = CF.cOf(i(3), i(4)), b = CF.cOf(i(1), i(-2));
  XTests.eq(CF.cStr(CF.cAdd(a, b), 0), '4+2i');
  XTests.eq(CF.cStr(CF.cSub(a, b), 0), '2+6i');
  // (3+4i)(1-2i) = 3 - 6i + 4i + 8 = 11 - 2i
  XTests.eq(CF.cStr(CF.cMul(a, b), 0), '11-2i');
  XTests.eq(R.toDecimalString(CF.cNormSq(a), 0), '25');
});

XTests.test('complex inversion round-trips exactly', () => {
  const R = CF.Rat;
  const z = CF.cOf(R.make(3n, 7n), R.make(-2n, 5n));
  const back = CF.cInv(CF.cInv(z));
  XTests.eq(R.cmp(back.re, z.re), 0);
  XTests.eq(R.cmp(back.im, z.im), 0);
  const one = CF.cMul(z, CF.cInv(z));
  XTests.eq(R.toDecimalString(one.re, 6), '1.000000');
  XTests.eq(R.toDecimalString(one.im, 6), '0.000000');
});

XTests.test('nearest Gaussian integer rounds each part', () => {
  const R = CF.Rat;
  XTests.eq(CF.cStr(CF.cNearestGaussian(CF.cOf(R.make(7n, 2n), R.make(-7n, 2n))), 0), '4-3i');
  XTests.eq(CF.cStr(CF.cNearestGaussian(CF.cOf(R.make(1n, 3n), R.make(5n, 3n))), 0), '0+2i');
});

XTests.test('ratSqrtLower never overestimates', () => {
  const R = CF.Rat;
  for (const [n, d] of [[2n, 1n], [1n, 2n], [7n, 3n], [1n, 1000000n], [123456n, 7n]]) {
    const m = R.make(n, d);
    const L = CF.ratSqrtLower(m, 30);
    XTests.ok(R.cmp(R.mul(L, L), m) <= 0, `L^2 exceeded m for ${n}/${d}`);
    // and it is not uselessly small: (L + 10^-30)^2 must exceed m
    const up = R.add(L, R.make(1n, 10n ** 30n));
    XTests.ok(R.cmp(R.mul(up, up), m) > 0, `L was far too small for ${n}/${d}`);
  }
  XTests.eq(R.toDecimalString(CF.ratSqrtLower(R.fromInt(0), 10), 4), '0.0000');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.cOf is not a function`.

- [ ] **Step 3: Implement**

Add inside the `CF` IIFE, before the final `return {...}`:

```js
  // ---- Gaussian rationals: complex numbers with exact rational parts ----

  const cOf = (re, im) => ({ re, im });
  const cAdd = (a, b) => cOf(Rat.add(a.re, b.re), Rat.add(a.im, b.im));
  const cSub = (a, b) => cOf(Rat.sub(a.re, b.re), Rat.sub(a.im, b.im));
  const cMul = (a, b) => cOf(
    Rat.sub(Rat.mul(a.re, b.re), Rat.mul(a.im, b.im)),
    Rat.add(Rat.mul(a.re, b.im), Rat.mul(a.im, b.re)));
  const cNormSq = (z) => Rat.add(Rat.mul(z.re, z.re), Rat.mul(z.im, z.im));
  const cIsZero = (z) => Rat.isZero(z.re) && Rat.isZero(z.im);
  const cInv = (z) => {
    if (cIsZero(z)) throw new Error('complex division by zero');
    const n = cNormSq(z);
    return cOf(Rat.div(z.re, n), Rat.div(Rat.neg(z.im), n));   // conj(z)/|z|^2
  };
  const cNearestGaussian = (z) => cOf(Rat.fromInt(ratRound(z.re)), Rat.fromInt(ratRound(z.im)));
  const cStr = (z, digits) => {
    const re = Rat.toDecimalString(z.re, digits);
    const imAbs = Rat.toDecimalString(z.im.n < 0n ? Rat.neg(z.im) : z.im, digits);
    return `${re}${z.im.n < 0n ? '-' : '+'}${imAbs}i`;
  };

  // A rational L >= 0 with L^2 <= m. Used wherever |r| is needed: substituting a LOWER
  // bound for a magnitude can only enlarge an error radius, never shrink it, so the
  // enclosure stays valid. floor(sqrt(n*s^2/d))/s satisfies (L/s)^2 <= n/d by construction.
  const ratSqrtLower = (m, digits) => {
    if (m.n <= 0n) return Rat.fromInt(0);
    const s = 10n ** BigInt(digits);
    return Rat.make(isqrt((m.n * s * s) / m.d), s);
  };
```

Extend the IIFE's `return {...}` with:

```js
           cOf, cAdd, cSub, cMul, cNormSq, cInv, cIsZero, cNearestGaussian, cStr, ratSqrtLower,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 100 tests passed`

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: exact Gaussian rationals and a sqrt lower bound

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The Hurwitz expansion with a disk enclosure

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: Task 1's complex operations, plus `CF.Rat`, `CF.constant`, `CF.ratSqrt`, `CF.trunc`.
- Produces:
  - `CF.COMPLEX_CONSTANTS` — array of `{key, label}` in display order:
    `pi_e_i` / `'π + e·i'`, `rot8` / `'(1+i)/√2'`, `quad7` / `'(1+i√7)/2'`,
    `g45` / `'(3+4i)/5'`, `gamma_phi` / `'γ + φ·i'`, `ln2_sqrt3` / `'ln 2 + √3·i'`.
  - `CF.complexConstant(key) -> {key, label, centre: CRat, delta: Rat}` — `delta` is `0`
    for the exact Gaussian rational `g45` and `10^-48` otherwise.
  - `CF.hurwitzTerms(centre: CRat, delta: Rat, maxTerms: number) -> {terms: CRat[], stopReason: 'exact'|'precision-exhausted'|'max-terms'}`
  - `CF.hurwitzConvergents(terms: CRat[]) -> {A: CRat, B: CRat}[]`
  - `CF.hurwitzRows(key: string, maxTerms: number) -> {rows, stopReason}` where each row is
    `{k, term: CRat, A: CRat, B: CRat, value: CRat, valueStr: string, errStr: string, errSq: Rat}`.

**The two rules that make this honest:**

1. **Certainty.** With a disk of radius `δ` about `ẑ`, a term is certain only when
   `|re(ẑ) − round(re(ẑ))| + δ < ½` and the same for the imaginary part. When `δ = 0`
   the value is exact and the rounding is certain by definition — the test is skipped,
   because a part sitting exactly on `½` rounds deterministically (halves up) yet would
   fail a strict `< ½` comparison.
2. **Propagation.** After `r = ẑ − a`, inversion gives
   `δ' = δ / (L·(L − δ))` where `L = ratSqrtLower(|r|², 40) ≤ |r|`. If `δ ≥ L` the disk
   may contain the origin, the inversion is unbounded, and the expansion stops.

- [ ] **Step 1: Write the failing tests**

```js
XTests.test('Hurwitz expansion of pi + e i', () => {
  const r = CF.hurwitzTerms(CF.complexConstant('pi_e_i').centre,
                            CF.complexConstant('pi_e_i').delta, 4);
  XTests.eq(r.terms.map(t => CF.cStr(t, 0)).join(' '), '3+3i 1+3i 2+1i 1+5i');
});

XTests.test('a Gaussian rational terminates exactly', () => {
  const k = CF.complexConstant('g45');
  XTests.eq(CF.Rat.isZero(k.delta), true, 'g45 must ship exactly');
  const r = CF.hurwitzTerms(k.centre, k.delta, 20);
  XTests.eq(r.stopReason, 'exact');
  XTests.eq(r.terms.map(t => CF.cStr(t, 0)).join(' '), '1+1i -2+1i');
  const cs = CF.hurwitzConvergents(r.terms);
  const last = cs[cs.length - 1];
  const v = CF.cMul(last.A, CF.cInv(last.B));
  XTests.eq(CF.Rat.cmp(v.re, k.centre.re), 0);
  XTests.eq(CF.Rat.cmp(v.im, k.centre.im), 0);
});

XTests.test('(1+i)/sqrt2 is periodic from the second term', () => {
  const k = CF.complexConstant('rot8');
  const r = CF.hurwitzTerms(k.centre, k.delta, 9);
  XTests.eq(r.terms.map(t => CF.cStr(t, 0)).join(' '),
            '1+1i -2+2i 2+2i -2+2i 2+2i -2+2i 2+2i -2+2i 2+2i');
});

XTests.test('every remainder obeys the |r|^2 <= 1/2 bound', () => {
  // Coordinate-wise rounding puts the remainder in a square of half-width 1/2,
  // so |r|^2 <= 1/4 + 1/4. Checked exactly, not in floating point.
  for (const c of CF.COMPLEX_CONSTANTS) {
    const k = CF.complexConstant(c.key);
    const r = CF.hurwitzTerms(k.centre, k.delta, 8);
    let z = k.centre;
    for (const t of r.terms) {
      const rem = CF.cSub(z, t);
      XTests.ok(CF.Rat.cmp(CF.cNormSq(rem), CF.Rat.make(1n, 2n)) <= 0,
                `${c.key}: |r|^2 exceeded 1/2`);
      if (CF.cIsZero(rem)) break;
      z = CF.cInv(rem);
    }
  }
});

XTests.test('convergent error strictly decreases', () => {
  for (const c of CF.COMPLEX_CONSTANTS) {
    const { rows } = CF.hurwitzRows(c.key, 8);
    for (let i = 1; i < rows.length; i++) {
      XTests.ok(CF.Rat.cmp(rows[i].errSq, rows[i - 1].errSq) < 0,
                `${c.key}: error did not shrink at row ${i}`);
    }
  }
});

XTests.test('a fat disk withholds terms', () => {
  const k = CF.complexConstant('pi_e_i');
  const tight = CF.hurwitzTerms(k.centre, k.delta, 12);
  const fat = CF.hurwitzTerms(k.centre, CF.Rat.make(1n, 1000n), 12);
  XTests.eq(fat.stopReason, 'precision-exhausted');
  XTests.ok(fat.terms.length < tight.terms.length,
            `fat disk gave ${fat.terms.length} terms, tight gave ${tight.terms.length}`);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.complexConstant is not a function`.

- [ ] **Step 3: Implement the constants**

Add inside the `CF` IIFE:

```js
  // ---- Hurwitz continued fractions over the Gaussian integers ----

  const COMPLEX_CONSTANTS = [
    { key: 'pi_e_i',     label: 'π + e·i' },
    { key: 'rot8',       label: '(1+i)/√2' },
    { key: 'quad7',      label: '(1 + i√7)/2' },
    { key: 'g45',        label: '(3+4i)/5' },
    { key: 'gamma_phi',  label: 'γ + φ·i' },
    { key: 'ln2_sqrt3',  label: 'ln 2 + √3·i' },
  ];

  const COMPLEX_DELTA = Rat.make(1n, 10n ** 48n);

  const complexConstant = (key) => {
    const meta = COMPLEX_CONSTANTS.find(c => c.key === key);
    if (!meta) throw new Error('unknown complex constant ' + key);
    const c = (k) => trunc(constant(k).lo, 50);
    const half = Rat.make(1n, 2n);
    let centre, delta = COMPLEX_DELTA;
    if (key === 'pi_e_i') centre = cOf(c('pi'), c('e'));
    else if (key === 'rot8') { const h = Rat.mul(c('sqrt2'), half); centre = cOf(h, h); }
    else if (key === 'quad7') centre = cOf(half, Rat.mul(trunc(ratSqrt(7n, 50), 50), half));
    else if (key === 'g45') { centre = cOf(Rat.make(3n, 5n), Rat.make(4n, 5n)); delta = Rat.fromInt(0); }
    else if (key === 'gamma_phi') centre = cOf(c('gamma'), c('phi'));
    else centre = cOf(c('ln2'), c('sqrt3'));
    return { key, label: meta.label, centre, delta };
  };
```

- [ ] **Step 4: Implement the expansion and convergents**

```js
  const hurwitzTerms = (centre, delta, maxTerms) => {
    const terms = [];
    const half = Rat.make(1n, 2n);
    const absR = (r) => (r.n < 0n ? Rat.neg(r) : r);
    let z = centre, d = delta;
    for (let i = 0; i < maxTerms; i++) {
      const a = cNearestGaussian(z);
      // With d = 0 the value is exact and the rounding is certain by definition. The
      // strict test below would wrongly reject a part sitting exactly on 1/2, which
      // ratRound resolves deterministically (halves up).
      if (!Rat.isZero(d)) {
        const dr = absR(Rat.sub(z.re, a.re)), di = absR(Rat.sub(z.im, a.im));
        if (Rat.cmp(Rat.add(dr, d), half) >= 0 || Rat.cmp(Rat.add(di, d), half) >= 0) {
          return { terms, stopReason: 'precision-exhausted' };
        }
      }
      terms.push(a);
      const r = cSub(z, a);
      if (cIsZero(r)) return { terms, stopReason: 'exact' };
      if (!Rat.isZero(d)) {
        const L = ratSqrtLower(cNormSq(r), 40);          // L <= |r|
        if (Rat.cmp(d, L) >= 0) return { terms, stopReason: 'precision-exhausted' };
        d = Rat.div(d, Rat.mul(L, Rat.sub(L, d)));       // |1/r - 1/r_hat| bound
      }
      z = cInv(r);
    }
    return { terms, stopReason: 'max-terms' };
  };

  // A_k = a_k A_{k-1} + A_{k-2}; no sign choice - nearest-Gaussian rounding already
  // minimises the remainder in both coordinates, so every numerator is +1.
  const hurwitzConvergents = (terms) => {
    let Am2 = cOf(Rat.fromInt(0), Rat.fromInt(0)), Am1 = cOf(Rat.fromInt(1), Rat.fromInt(0));
    let Bm2 = cOf(Rat.fromInt(1), Rat.fromInt(0)), Bm1 = cOf(Rat.fromInt(0), Rat.fromInt(0));
    const out = [];
    for (const a of terms) {
      const A = cAdd(cMul(a, Am1), Am2), B = cAdd(cMul(a, Bm1), Bm2);
      out.push({ A, B });
      Am2 = Am1; Am1 = A; Bm2 = Bm1; Bm1 = B;
    }
    return out;
  };

  const hurwitzRows = (key, maxTerms) => {
    const k = complexConstant(key);
    const e = hurwitzTerms(k.centre, k.delta, maxTerms);
    const cs = hurwitzConvergents(e.terms);
    const rows = cs.map((c, i) => {
      const value = cIsZero(c.B) ? cOf(Rat.fromInt(0), Rat.fromInt(0)) : cMul(c.A, cInv(c.B));
      const errSq = cNormSq(cSub(k.centre, value));
      return {
        k: i, term: e.terms[i], A: c.A, B: c.B, value,
        valueStr: cStr(value, 12),
        errSq, errStr: sci(ratSqrtLower(errSq, 30), 4),
      };
    });
    return { rows, stopReason: e.stopReason };
  };
```

Extend the IIFE's `return {...}` with:

```js
           COMPLEX_CONSTANTS, complexConstant, hurwitzTerms, hurwitzConvergents, hurwitzRows,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 106 tests passed`

If `convergent error strictly decreases` fails on its **first** row for some constant,
check whether that row's error is zero — a terminating expansion reaches the value exactly
and a zero error cannot decrease further. In that case stop the loop at the first zero
rather than loosening the comparison.

If `(1+i)/sqrt2 is periodic` disagrees, print the terms and verify by hand from
`(1+i)/√2 ≈ 0.7071+0.7071i`: nearest Gaussian integer is `1+1i`, remainder
`−0.2929−0.2929i`, and `1/(−0.2929−0.2929i) ≈ −1.7071+1.7071i`, whose nearest Gaussian
integer is `−2+2i`. Correct the expected string only if the hand computation disagrees
with it.

- [ ] **Step 6: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: Hurwitz expansion with a disk-shaped enclosure

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The Complex tab

**Files:**
- Modify: `continued-fractions/index.html` (tab bar, panel markup, page script)

**Interfaces:**
- Consumes: `CF.COMPLEX_CONSTANTS`, `CF.complexConstant`, `CF.hurwitzRows`, `CF.cStr`,
  `CF.Rat`, plus the existing `el(id)`, `state`, `fitCanvas`.
- Produces: DOM ids `#cx-chips`, `#cx-terms`, `#cx-status`, `#cx-table`, `#cx-canvas`, `#cx-caption`.

- [ ] **Step 1: Add the tab button and panel**

Add a sixth button after the Unit fractions button:

```html
    <button class="tab" data-panel="complex">Complex</button>
```

Add the panel after the Unit fractions panel's closing `</div>`:

```html
  <div class="panel" id="panel-complex">
    <div class="chips" id="cx-chips"></div>
    <div class="terms" id="cx-terms"></div>
    <p class="status" id="cx-status"></p>
    <div class="twocol">
      <div class="tablewrap"><table id="cx-table"></table></div>
      <canvas id="cx-canvas" width="420" height="420"></canvas>
    </div>
    <p class="status" id="cx-caption"></p>
  </div>
```

- [ ] **Step 2: Render the terms and table**

Add to the page script, before the `document.querySelectorAll('.tab')` wiring:

```js
  // ---------- Complex tab ----------
  state.complex = { key: 'pi_e_i' };
  const CX_MAX_TERMS = 10;

  function renderComplex() {
    const s = state.complex;
    el('cx-chips').innerHTML = CF.COMPLEX_CONSTANTS
      .map(c => `<button class="chip ${c.key === s.key ? 'active' : ''}" data-key="${c.key}">${c.label}</button>`)
      .join('');
    el('cx-chips').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      s.key = b.dataset.key; renderComplex();
    }));

    const k = CF.complexConstant(s.key);
    const { rows, stopReason } = CF.hurwitzRows(s.key, CX_MAX_TERMS);
    const continues = stopReason !== 'exact';

    el('cx-terms').textContent =
      `⟨${rows.map(r => CF.cStr(r.term, 0)).join('; ')}${continues ? '; …' : ''}⟩`;

    el('cx-table').innerHTML =
      '<tr><th>k</th><th>term</th><th>Aₖ / Bₖ</th><th>value</th><th>|z − Aₖ/Bₖ|</th></tr>' +
      rows.map(r => `<tr><td>${r.k}</td><td class="mono">${CF.cStr(r.term, 0)}</td>` +
        `<td class="mono">${CF.cStr(r.A, 0)} / ${CF.cStr(r.B, 0)}</td>` +
        `<td class="mono">${r.valueStr}</td><td class="mono">${r.errStr}</td></tr>`).join('');

    el('cx-status').textContent = `${rows.length} terms — ` +
      (stopReason === 'exact'
        ? 'a Gaussian rational, so the expansion terminates exactly.'
        : stopReason === 'precision-exhausted'
        ? 'everything the stored disk determines. The enclosing disk grows at every ' +
          'inversion, so the expansion stops where the nearest Gaussian integer stops being certain.'
        : `stopped at the display limit of ${CX_MAX_TERMS}.`);

    drawComplex(k, rows);
  }
```

- [ ] **Step 3: Draw the complex plane**

```js
  function drawComplex(k, rows) {
    const W = 420, H = 420, pad = 30;
    const ctx = fitCanvas(el('cx-canvas'), W, H);
    ctx.clearRect(0, 0, W, H);
    if (!rows.length) { el('cx-caption').textContent = ''; return; }

    const num = (r) => CF.Rat.toNumber(r);
    const tx = num(k.centre.re), ty = num(k.centre.im);
    const pts = rows.map(r => ({ x: num(r.value.re), y: num(r.value.im) }));
    const xs = pts.map(p => p.x).concat(tx), ys = pts.map(p => p.y).concat(ty);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1e-9), spanY = Math.max(maxY - minY, 1e-9);
    const span = Math.max(spanX, spanY) * 1.2;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const X = (x) => pad + ((x - cx) / span + 0.5) * (W - 2 * pad);
    const Y = (y) => H - pad - ((y - cy) / span + 0.5) * (H - 2 * pad);

    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, Y(cy)); ctx.lineTo(W - pad, Y(cy));
    ctx.moveTo(X(cx), pad); ctx.lineTo(X(cx), H - pad); ctx.stroke();

    ctx.strokeStyle = '#1a5fb4'; ctx.lineWidth = 1.2; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.stroke();
    ctx.fillStyle = '#1a5fb4';
    pts.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), i === pts.length - 1 ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
    });

    ctx.strokeStyle = '#c64600'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(tx) - 7, Y(ty)); ctx.lineTo(X(tx) + 7, Y(ty));
    ctx.moveTo(X(tx), Y(ty) - 7); ctx.lineTo(X(tx), Y(ty) + 7);
    ctx.stroke();

    ctx.fillStyle = '#666'; ctx.font = '11px sans-serif';
    ctx.fillText('Re', W - pad + 2, Y(cy) + 4);
    ctx.fillText('Im', X(cx) + 4, pad - 6);

    el('cx-caption').textContent =
      `Convergents in the complex plane, joined in order; the cross marks ${k.label}. ` +
      'There is no above or below in ℂ, so nothing alternates the way a real ' +
      'continued fraction does — the convergents spiral onto the target instead.';
  }

  renderComplex();
```

- [ ] **Step 4: Run the tests and smoke-test**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 106 tests passed`

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --enable-logging=stderr \
  "file://$PWD/continued-fractions/index.html" 2>&1 | grep -ci "uncaught"
```

Expected: 0.

- [ ] **Step 5: Look at the tab**

```bash
cd /Users/neoneye/git/vibe-coding-lab && SC="${TMPDIR:-/tmp}/cf_cx.html" && \
  sed 's|  document.querySelectorAll(.\.tab.).forEach(t => t.addEventListener|  setTimeout(()=>document.querySelector(".tab[data-panel=complex]").click(),0);\n  document.querySelectorAll(".tab").forEach(t => t.addEventListener|' \
  continued-fractions/index.html > "$SC" && \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --virtual-time-budget=5000 --window-size=1000,900 --screenshot="${TMPDIR:-/tmp}/cf_cx.png" \
  "file://$SC" 2>/dev/null && echo "${TMPDIR:-/tmp}/cf_cx.png"
```

Read the PNG and confirm: the term list reads `⟨3+3i; 1+3i; 2+1i; 1+5i; …⟩`, the table's
error column falls, and the canvas shows points converging on the orange cross. Then click
the `(1+i)/√2` chip in a second capture and confirm its terms repeat `−2+2i; 2+2i`.

- [ ] **Step 6: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: complex tab with Hurwitz expansions in the plane

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Refresh the screenshot

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

Expected: a JPEG under 300 KB. Read it and confirm six tabs are visible.

- [ ] **Step 2: Confirm the gallery needs no rebuild**

```bash
cd /Users/neoneye/git/vibe-coding-lab && python3 build_gallery.py >/dev/null && git diff --stat index.html
```

Expected: no change to `index.html`.

- [ ] **Step 3: Final test run**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 106 tests passed`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add continued-fractions/screenshot1.jpg
git commit -m "continued-fractions: refresh screenshot for the complex tab

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
