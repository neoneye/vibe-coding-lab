# Euler Product Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth "Euler product" tab to `continued-fractions/index.html` showing the Dirichlet series over every integer racing the Euler product over primes alone, for s = 2, 3, 4, 6.

**Architecture:** Four new pure functions in the existing `<script id="shared-code">` block's `CF` namespace, all on the existing exact `BigInt` `Rat` type, tested by the existing `XTests` runner. Then one new panel in the page script reusing the existing `fitCanvas`, chip and table patterns.

**Tech Stack:** Vanilla HTML/CSS/JS, `BigInt`, `<canvas>`, Node ≥ 18 for tests. No dependencies.

## Global Constraints

- Everything goes in the existing `continued-fractions/index.html`; still one self-contained file working from `file://`.
- All displayed values computed in exact `BigInt` rational arithmetic via the existing `CF.Rat`. Doubles only for drawing coordinates.
- Only `s ∈ {2, 3, 4, 6}`. `s = 5` is excluded: no closed form and no series cheap enough to verify here.
- `N` capped at 200 in the UI.
- Style follows the existing page: `--fg:#111; --muted:#666; --border:#ccc; --bg:#fff; --accent:#1a5fb4`, chips, `.tablewrap`, `.status`, `.verdict`.
- Canvases sized in device pixels via the existing `fitCanvas(canvas, cssW, cssH)`.
- Tests run with `node continued-fractions/test.mjs` and must exit 0. The suite currently has 45 tests.
- Commit directly to `main`. Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Partial sums, partial products, and smooth numbers

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat` (`make/fromInt/add/mul/div/sub/cmp/isZero/toDecimalString`), `CF.primes(count)`.
- Produces:
  - `CF.ZETA_S = [2, 3, 4, 6]`
  - `CF.MAX_ZETA_N = 200`
  - `CF.zetaPartialSum(s: number, N: number) -> Rat` — `Σ_{n=1}^{N} 1/n^s`
  - `CF.eulerPartialProduct(s: number, N: number) -> Rat` — `∏_{p ≤ N} p^s/(p^s − 1)`
  - `CF.primesUpTo(N: number) -> BigInt[]`
  - `CF.smoothNumbers(N: number, limit: number) -> number[]` — every integer `1 ≤ m ≤ limit`
    whose prime factors are all `≤ N`, ascending. `1` is included (it has no prime factors).
  - `CF.primeFactorRows(s: number, N: number) -> {p: BigInt, factor: Rat, excess: Rat}[]` —
    one row per prime `p ≤ N`, where `factor = p^s/(p^s − 1)` is what that prime multiplies
    into the product and `excess = factor − 1`. Keeps the formula in the tested engine rather
    than duplicating it in the drawing code.

- [ ] **Step 1: Write the failing tests**

Append inside the `shared-code` block, after the last existing `XTests.test(...)` call:

```js
XTests.test('primesUpTo lists the primes below a bound', () => {
  XTests.eq(CF.primesUpTo(1).join(','), '');
  XTests.eq(CF.primesUpTo(2).join(','), '2');
  XTests.eq(CF.primesUpTo(20).join(','), '2,3,5,7,11,13,17,19');
});

XTests.test('zetaPartialSum is exact', () => {
  // 1 + 1/4 + 1/9 = 49/36
  const r = CF.zetaPartialSum(2, 3);
  XTests.eq(`${r.n}/${r.d}`, '49/36');
  XTests.eq(`${CF.zetaPartialSum(3, 2).n}/${CF.zetaPartialSum(3, 2).d}`, '9/8');   // 1 + 1/8
  XTests.eq(`${CF.zetaPartialSum(2, 1).n}/${CF.zetaPartialSum(2, 1).d}`, '1/1');
});

XTests.test('eulerPartialProduct is exact', () => {
  // (1 - 1/4)^-1 * (1 - 1/9)^-1 = 4/3 * 9/8 = 3/2
  const r = CF.eulerPartialProduct(2, 3);
  XTests.eq(`${r.n}/${r.d}`, '3/2');
  // s=3, primes 2 only: (1 - 1/8)^-1 = 8/7
  const r2 = CF.eulerPartialProduct(3, 2);
  XTests.eq(`${r2.n}/${r2.d}`, '8/7');
  // empty product
  XTests.eq(`${CF.eulerPartialProduct(2, 1).n}/${CF.eulerPartialProduct(2, 1).d}`, '1/1');
});

XTests.test('smoothNumbers lists N-smooth integers', () => {
  XTests.eq(CF.smoothNumbers(5, 40).join(','),
            '1,2,3,4,5,6,8,9,10,12,15,16,18,20,24,25,27,30,32,36,40');
  XTests.eq(CF.smoothNumbers(2, 40).join(','), '1,2,4,8,16,32');
  XTests.eq(CF.smoothNumbers(40, 10).join(','), '1,2,3,4,5,6,7,8,9,10');
});

XTests.test('primeFactorRows gives each prime its factor', () => {
  const rows = CF.primeFactorRows(2, 10);
  XTests.eq(rows.map(r => String(r.p)).join(','), '2,3,5,7');
  XTests.eq(CF.Rat.toDecimalString(rows[0].factor, 6), '1.333333');   // 4/3
  XTests.eq(CF.Rat.toDecimalString(rows[1].factor, 6), '1.125000');   // 9/8
  XTests.eq(CF.Rat.toDecimalString(rows[2].factor, 6), '1.041666');   // 25/24
  XTests.eq(CF.Rat.toDecimalString(rows[0].excess, 6), '0.333333');
  // The product of every factor is exactly the Euler product.
  let acc = CF.Rat.fromInt(1);
  for (const r of rows) acc = CF.Rat.mul(acc, r.factor);
  XTests.eq(CF.Rat.cmp(acc, CF.eulerPartialProduct(2, 10)), 0);
});

XTests.test('s values and the N cap are declared', () => {
  XTests.eq(CF.ZETA_S.join(','), '2,3,4,6');
  XTests.eq(CF.MAX_ZETA_N, 200);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.primesUpTo is not a function`.

- [ ] **Step 3: Implement**

Add inside the `CF` IIFE, immediately before the final `return {...}` statement:

```js
  // ---- Dirichlet series and Euler products ----

  const ZETA_S = [2, 3, 4, 6];
  const MAX_ZETA_N = 200;

  const primesUpTo = (N) => {
    if (N < 2) return [];
    const sieve = new Uint8Array(N + 1);
    const out = [];
    for (let i = 2; i <= N; i++) {
      if (sieve[i]) continue;
      out.push(BigInt(i));
      for (let j = i * i; j <= N; j += i) sieve[j] = 1;
    }
    return out;
  };

  // Sum over EVERY integer up to N.
  const zetaPartialSum = (s, N) => {
    let acc = Rat.fromInt(0);
    for (let n = 1; n <= N; n++) acc = Rat.add(acc, Rat.make(1n, BigInt(n) ** BigInt(s)));
    return acc;
  };

  // Product over the PRIMES up to N: prod (1 - p^-s)^-1 = prod p^s/(p^s - 1).
  const eulerPartialProduct = (s, N) => {
    let acc = Rat.fromInt(1);
    for (const p of primesUpTo(N)) {
      const ps = p ** BigInt(s);
      acc = Rat.mul(acc, Rat.make(ps, ps - 1n));
    }
    return acc;
  };

  // One row per prime: the factor it contributes, and that factor minus 1 (the bar height).
  const primeFactorRows = (s, N) => primesUpTo(N).map(p => {
    const ps = p ** BigInt(s);
    const factor = Rat.make(ps, ps - 1n);
    return { p, factor, excess: Rat.sub(factor, Rat.fromInt(1)) };
  });

  // Integers whose prime factors are all <= N. 1 qualifies: it has no prime factors.
  const smoothNumbers = (N, limit) => {
    const ps = primesUpTo(Math.min(N, limit)).map(Number);
    const out = [];
    for (let m = 1; m <= limit; m++) {
      let r = m;
      for (const p of ps) while (r % p === 0) r /= p;
      if (r === 1) out.push(m);
    }
    return out;
  };
```

Then extend the IIFE's `return {...}` with:

```js
           ZETA_S, MAX_ZETA_N, primesUpTo, zetaPartialSum, eulerPartialProduct, smoothNumbers,
           primeFactorRows,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 51 tests passed`

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: exact partial zeta sums, Euler products and smooth numbers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Target values, including Apéry's constant

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.constant('pi')`, `CF.trunc(r, digits)`, and Task 1's functions.
- Produces:
  - `CF.apery(terms: number) -> Rat` — `(5/2) · Σ_{n=1}^{terms} (−1)^(n−1) / (n³ · C(2n,n))`
  - `CF.binomial(n: BigInt, k: BigInt) -> BigInt`
  - `CF.zetaValue(s: number) -> {rat: Rat, label: string, closedForm: string|null}`
    where `closedForm` is `'π²/6'`, `'π⁴/90'`, `'π⁶/945'` for `s = 2, 4, 6` and `null` for `s = 3`,
    and `label` is `'ζ(2)'` … `'ζ(6)'`.

- [ ] **Step 1: Write the failing tests**

```js
XTests.test('binomial coefficients', () => {
  XTests.eq(CF.binomial(4n, 2n), 6n);
  XTests.eq(CF.binomial(10n, 5n), 252n);
  XTests.eq(CF.binomial(5n, 0n), 1n);
});

XTests.test("Apery's series reproduces zeta(3)", () => {
  // The published value already lives in the identification table.
  const known = CF.Rat.fromDecimalString('1.202056903159594285399738161511449990764986292340498881792');
  XTests.eq(CF.Rat.toDecimalString(CF.apery(120), 40), CF.Rat.toDecimalString(known, 40));
});

XTests.test('zeta closed forms match powers of pi', () => {
  const pi = CF.constant('pi').lo;
  const pow = (r, k) => { let a = CF.Rat.fromInt(1); for (let i = 0; i < k; i++) a = CF.Rat.mul(a, r); return a; };
  const cases = [[2, 2, 6], [4, 4, 90], [6, 6, 945]];
  for (const [s, k, den] of cases) {
    const want = CF.Rat.div(pow(pi, k), CF.Rat.fromInt(den));
    XTests.eq(CF.Rat.toDecimalString(CF.zetaValue(s).rat, 30),
              CF.Rat.toDecimalString(want, 30), `zeta(${s})`);
  }
});

XTests.test('zeta values are labelled honestly', () => {
  XTests.eq(CF.zetaValue(2).closedForm, '\u03c0\u00b2/6');
  XTests.eq(CF.zetaValue(4).closedForm, '\u03c0\u2074/90');
  XTests.eq(CF.zetaValue(6).closedForm, '\u03c0\u2076/945');
  // XTests.eq stringifies both sides, so null and the string "null" would both pass. Use ok().
  XTests.ok(CF.zetaValue(3).closedForm === null, 'zeta(3) must claim no closed form');
  XTests.eq(CF.zetaValue(3).label, '\u03b6(3)');
});

XTests.test('zeta(3) agrees with a brute-force partial sum to the precision that sum supports', () => {
  // Sum to N=2000 plus the integral tail bound 1/(2N^2) brackets zeta(3).
  const lo = CF.zetaPartialSum(3, 2000);
  const hi = CF.Rat.add(lo, CF.Rat.make(1n, 2n * 2000n * 2000n));
  const z = CF.zetaValue(3).rat;
  XTests.ok(CF.Rat.cmp(lo, z) < 0 && CF.Rat.cmp(z, hi) < 0, 'zeta(3) outside its own enclosure');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.binomial is not a function`.

- [ ] **Step 3: Implement**

Add inside the `CF` IIFE, after Task 1's block:

```js
  const binomial = (n, k) => {
    let r = 1n;
    for (let i = 0n; i < k; i++) r = r * (n - i) / (i + 1n);
    return r;
  };

  // Apery's series: zeta(3) = (5/2) * sum_{n>=1} (-1)^(n-1) / (n^3 * C(2n,n)).
  // Gains roughly 0.6 decimal digits per term, and is exact in rationals.
  const apery = (terms) => {
    let sum = Rat.fromInt(0);
    for (let n = 1; n <= terms; n++) {
      const bn = BigInt(n);
      const t = Rat.make(1n, bn ** 3n * binomial(2n * bn, bn));
      sum = (n % 2 === 1) ? Rat.add(sum, t) : Rat.sub(sum, t);
    }
    return Rat.mul(Rat.make(5n, 2n), sum);
  };

  let APERY_CACHE = null;

  const zetaValue = (s) => {
    const pi = constant('pi').lo;
    const powPi = (k) => { let a = Rat.fromInt(1); for (let i = 0; i < k; i++) a = Rat.mul(a, pi); return a; };
    if (s === 2) return { rat: Rat.div(powPi(2), Rat.fromInt(6)),   label: 'ζ(2)', closedForm: 'π²/6' };
    if (s === 4) return { rat: Rat.div(powPi(4), Rat.fromInt(90)),  label: 'ζ(4)', closedForm: 'π⁴/90' };
    if (s === 6) return { rat: Rat.div(powPi(6), Rat.fromInt(945)), label: 'ζ(6)', closedForm: 'π⁶/945' };
    if (s === 3) {
      if (!APERY_CACHE) APERY_CACHE = trunc(apery(120), 50);
      return { rat: APERY_CACHE, label: 'ζ(3)', closedForm: null };
    }
    throw new Error(`zeta(${s}) is not shipped: only s = 2, 3, 4, 6 can be verified by this page`);
  };
```

Extend the IIFE's `return {...}` with:

```js
           binomial, apery, zetaValue,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 56 tests passed`

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: zeta targets from pi powers and Apery's series

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The convergence facts the tab asserts

This task adds no new code — it adds the tests that pin the claims the UI will make,
so the UI cannot state something the maths does not support.

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block, tests only)

**Interfaces:**
- Consumes: everything from Tasks 1 and 2.
- Produces: no new exports.

- [ ] **Step 1: Write the tests**

```js
XTests.test('the Euler product equals the sum over smooth numbers', () => {
  // prod_{p<=N} (1-p^-s)^-1 = sum over N-smooth integers of 1/n^s.
  // Compare to 12 digits, with the smooth sum taken far enough that its tail is negligible.
  for (const [s, N, limit] of [[2, 5, 20000], [2, 11, 20000], [3, 7, 4000], [4, 13, 2000]]) {
    const prod = CF.eulerPartialProduct(s, N);
    let smooth = CF.Rat.fromInt(0);
    for (const m of CF.smoothNumbers(N, limit)) {
      smooth = CF.Rat.add(smooth, CF.Rat.make(1n, BigInt(m) ** BigInt(s)));
    }
    XTests.eq(CF.Rat.toDecimalString(smooth, 12), CF.Rat.toDecimalString(prod, 12),
              `s=${s} N=${N}`);
  }
});

XTests.test('both sides climb toward zeta(s) and never overshoot', () => {
  for (const s of CF.ZETA_S) {
    const z = CF.zetaValue(s).rat;
    let prevSum = null, prevProd = null;
    for (let N = 2; N <= 60; N++) {
      const sum = CF.zetaPartialSum(s, N);
      const prod = CF.eulerPartialProduct(s, N);
      XTests.ok(CF.Rat.cmp(sum, z) < 0, `sum overshot zeta(${s}) at N=${N}`);
      XTests.ok(CF.Rat.cmp(prod, z) < 0, `product overshot zeta(${s}) at N=${N}`);
      if (prevSum) XTests.ok(CF.Rat.cmp(sum, prevSum) > 0, `sum not increasing at N=${N}`);
      if (prevProd) XTests.ok(CF.Rat.cmp(prod, prevProd) >= 0, `product decreased at N=${N}`);
      prevSum = sum; prevProd = prod;
    }
  }
});

XTests.test('the product is closer than the sum for every N >= 4', () => {
  for (const s of CF.ZETA_S) {
    const z = CF.zetaValue(s).rat;
    for (let N = 4; N <= 60; N++) {
      const errSum = CF.Rat.sub(z, CF.zetaPartialSum(s, N));
      const errProd = CF.Rat.sub(z, CF.eulerPartialProduct(s, N));
      XTests.ok(CF.Rat.cmp(errProd, errSum) < 0,
                `s=${s} N=${N}: product error was not smaller`);
    }
  }
});

XTests.test('the product uses far fewer factors than the sum uses terms', () => {
  XTests.eq(CF.primesUpTo(100).length, 25);
  XTests.eq(CF.primesUpTo(200).length, 46);
});
```

- [ ] **Step 2: Run the tests**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 60 tests passed`.

If "the product is closer than the sum" fails at a small `N`, do **not** loosen the test —
raise the `N >= 4` threshold to the smallest value that actually holds for all four `s`, and
change the UI caption in Task 4 to match the threshold the test proves. The page must not
claim a bound the tests do not establish.

- [ ] **Step 3: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: pin the Euler identity and the convergence claims

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The Euler product tab UI

**Files:**
- Modify: `continued-fractions/index.html` (tab bar, panel markup, styles, page script)

**Interfaces:**
- Consumes: all of Tasks 1–3, plus the existing `fitCanvas(canvas, cssW, cssH)`, `el(id)`,
  `state` object, `CF.sci(r, sig)`, and the existing `.chip`, `.controls`, `.tablewrap`,
  `.status`, `.verdict`, `.twocol` CSS classes.
- Produces: DOM ids `#euler-s`, `#euler-n`, `#euler-n-label`, `#euler-target`, `#euler-race`,
  `#euler-grid`, `#euler-grid-caption`, `#euler-bars`, `#euler-bars-caption`.

- [ ] **Step 1: Add the tab button and the panel markup**

Add a fourth button to the tab bar, after the Geometry button:

```html
    <button class="tab" data-panel="euler">Euler product</button>
```

Add the panel after `<div class="panel" id="panel-geometry"> … </div>`:

```html
  <div class="panel" id="panel-euler">
    <div class="chips" id="euler-s"></div>
    <div class="controls">
      <label>cutoff N <input type="range" id="euler-n" min="2" max="200" value="30"></label>
      <span class="muted" id="euler-n-label"></span>
    </div>
    <p id="euler-target"></p>
    <div class="tablewrap"><table id="euler-race"></table></div>
    <h2 class="sectionhead">Why the product is ahead</h2>
    <div id="euler-grid"></div>
    <p class="status" id="euler-grid-caption"></p>
    <h2 class="sectionhead">What each prime contributes</h2>
    <canvas id="euler-bars" width="900" height="220"></canvas>
    <p class="status" id="euler-bars-caption"></p>
  </div>
```

Also widen the page subtitle — replace the existing `<p class="sub">…</p>` line with:

```html
  <p class="sub">Ways a constant gets built out of the integers: continued fractions, and a product over the primes alone.</p>
```

- [ ] **Step 2: Add the styles**

Append to the stylesheet:

```css
  .sectionhead { font-size:14px; font-weight:600; margin:22px 0 8px 0; }
  .numgrid { display:grid; grid-template-columns:repeat(24, 1fr); gap:2px; max-width:720px; }
  .numgrid div { font-size:9px; text-align:center; padding:2px 0; border-radius:2px;
    background:#f2f2f2; color:#bbb; font-variant-numeric:tabular-nums; }
  .numgrid div.both { background:#1a5fb4; color:#fff; }
  .numgrid div.prod { background:#c8dcf5; color:#1a5fb4; }
  .legend { display:flex; gap:16px; flex-wrap:wrap; margin:8px 0; font-size:12px; color:var(--muted); }
  .legend span::before { content:''; display:inline-block; width:10px; height:10px; margin-right:5px;
    vertical-align:-1px; border-radius:2px; }
  .legend .k-both::before { background:#1a5fb4; }
  .legend .k-prod::before { background:#c8dcf5; }
  .legend .k-none::before { background:#f2f2f2; }
```

- [ ] **Step 3: Render the race**

Add to the page script, before the `document.querySelectorAll('.tab')` wiring:

```js
  // ---------- Euler product tab ----------
  state.euler = { s: 2, N: 30 };
  const EULER_GRID_LIMIT = 240;

  function renderEuler() {
    const e = state.euler;
    el('euler-s').innerHTML = CF.ZETA_S
      .map(s => `<button class="chip ${s === e.s ? 'active' : ''}" data-s="${s}">s = ${s}</button>`)
      .join('');
    el('euler-s').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      e.s = Number(b.dataset.s); renderEuler();
    }));

    const z = CF.zetaValue(e.s);
    const sum = CF.zetaPartialSum(e.s, e.N);
    const prod = CF.eulerPartialProduct(e.s, e.N);
    const nPrimes = CF.primesUpTo(e.N).length;
    const errSum = CF.Rat.sub(z.rat, sum);
    const errProd = CF.Rat.sub(z.rat, prod);

    el('euler-n-label').textContent =
      `${e.N} integers in the sum, ${nPrimes} primes in the product`;

    el('euler-target').innerHTML = '<span class="verdict">' +
      `<strong>${z.label}</strong> = ` +
      (z.closedForm
        ? `<strong>${z.closedForm}</strong> = `
        : '') +
      `<span class="mono">${CF.Rat.toDecimalString(z.rat, 16)}…</span>` +
      (z.closedForm
        ? ''
        : ' — Apéry’s constant. No closed form is known; Apéry proved in 1978 that it is irrational.') +
      '</span>';

    el('euler-race').innerHTML =
      '<tr><th></th><th>over every integer</th><th>over the primes only</th></tr>' +
      `<tr><td>expression</td><td class="mono">Σ<sub>n≤${e.N}</sub> 1/n<sup>${e.s}</sup></td>` +
      `<td class="mono">∏<sub>p≤${e.N}</sub> (1 − p<sup>−${e.s}</sup>)<sup>−1</sup></td></tr>` +
      `<tr><td>value</td><td class="mono">${CF.Rat.toDecimalString(sum, 16)}</td>` +
      `<td class="mono">${CF.Rat.toDecimalString(prod, 16)}</td></tr>` +
      `<tr><td>still short by</td><td class="mono">${CF.sci(errSum, 5)}</td>` +
      `<td class="mono">${CF.sci(errProd, 5)}</td></tr>` +
      `<tr><td>work done</td><td>${e.N} terms</td><td>${nPrimes} factors</td></tr>`;

    renderEulerGrid();
    renderEulerBars();
  }
```

- [ ] **Step 4: Render the integer grid**

```js
  function renderEulerGrid() {
    const e = state.euler;
    const smooth = new Set(CF.smoothNumbers(e.N, EULER_GRID_LIMIT));
    let html = '<div class="numgrid">';
    for (let m = 1; m <= EULER_GRID_LIMIT; m++) {
      const cls = m <= e.N ? 'both' : (smooth.has(m) ? 'prod' : '');
      html += `<div class="${cls}" title="${m}">${m}</div>`;
    }
    html += '</div>';
    html += '<div class="legend">' +
      `<span class="k-both">reached by both (n ≤ ${e.N})</span>` +
      '<span class="k-prod">reached by the product alone</span>' +
      '<span class="k-none">reached by neither</span></div>';
    el('euler-grid').innerHTML = html;

    const extra = [...smooth].filter(m => m > e.N);
    const preview = extra.slice(0, 12).join(', ');
    el('euler-grid-caption').textContent =
      `The sum has reached ${e.N} integers. The product over ${CF.primesUpTo(e.N).length} primes ` +
      `already accounts for ${extra.length} more below ${EULER_GRID_LIMIT}` +
      (preview ? ` — ${preview}${extra.length > 12 ? ', …' : ''}` : '') +
      '. That is unique factorisation: the product over primes p ≤ N is exactly the sum over ' +
      'integers whose prime factors are all ≤ N.';
  }
```

- [ ] **Step 5: Render the per-prime bars**

```js
  function renderEulerBars() {
    const e = state.euler;
    const W = 900, H = 220, padL = 40, padB = 28, padT = 14;
    const ctx = fitCanvas(el('euler-bars'), W, H);
    ctx.clearRect(0, 0, W, H);
    const ps = CF.primesUpTo(e.N);
    if (!ps.length) { ctx.fillStyle = '#666'; ctx.font = '12px sans-serif';
      ctx.fillText('no primes below N yet', padL, H / 2); return; }
    const rows = CF.primeFactorRows(e.s, e.N)
      .map(r => ({ p: r.p, f: r.factor, excess: CF.Rat.toNumber(r.excess) }));
    const maxEx = rows[0].excess;
    const bw = (W - padL - 12) / rows.length;
    ctx.fillStyle = '#1a5fb4';
    rows.forEach((r, i) => {
      const h = (r.excess / maxEx) * (H - padB - padT);
      ctx.fillRect(padL + i * bw + 1, H - padB - h, Math.max(1, bw - 2), h);
    });
    ctx.fillStyle = '#666'; ctx.font = '10px sans-serif';
    rows.forEach((r, i) => {
      if (bw < 16 && i % Math.ceil(16 / bw) !== 0) return;
      ctx.fillText(String(r.p), padL + i * bw + 1, H - padB + 12);
    });
    ctx.font = '11px sans-serif';
    ctx.fillText('factor − 1', 4, padT + 4);
    ctx.fillText('prime', W / 2 - 14, H - 6);

    const first = rows.slice(0, 4)
      .map(r => `${r.p} → ${CF.Rat.toDecimalString(r.f, 6)}`).join(', ');
    const lastRow = rows[rows.length - 1];
    el('euler-bars-caption').textContent =
      `Each prime multiplies in (1 − p⁻ˢ)⁻¹: ${first}` +
      `, and by ${lastRow.p} only ${CF.Rat.toDecimalString(lastRow.f, 6)}. ` +
      'The small primes do nearly all the work, and raising s makes the decay steeper.';
  }

  el('euler-n').addEventListener('input', ev => { state.euler.N = Number(ev.target.value); renderEuler(); });
  renderEuler();
```

- [ ] **Step 6: Verify the tests still pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 60 tests passed`

- [ ] **Step 7: Smoke-test the tab in headless Chrome**

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --dump-dom \
  "file://$PWD/continued-fractions/index.html" 2>/dev/null | grep -c "unique factorisation"
```

Expected: 1.

Check for console errors:

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --enable-logging=stderr \
  "file://$PWD/continued-fractions/index.html" 2>&1 | grep -ci "uncaught"
```

Expected: 0.

- [ ] **Step 8: Look at the tab**

```bash
cd /Users/neoneye/git/vibe-coding-lab && SC="${TMPDIR:-/tmp}/cf_euler.html" && \
  sed 's|  document.querySelectorAll(.\.tab.).forEach(t => t.addEventListener|  setTimeout(()=>document.querySelector(".tab[data-panel=euler]").click(),0);\n  document.querySelectorAll(".tab").forEach(t => t.addEventListener|' \
  continued-fractions/index.html > "$SC" && \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --virtual-time-budget=5000 --window-size=1000,1200 --screenshot="${TMPDIR:-/tmp}/cf_euler.png" \
  "file://$SC" 2>/dev/null && echo "${TMPDIR:-/tmp}/cf_euler.png"
```

Read the PNG with the Read tool and confirm: the race table shows the product closer than the
sum, the integer grid shows dark cells for 1…30 and scattered light cells beyond, and the bar
chart decays from left to right. Fix anything that does not match before committing.

- [ ] **Step 9: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: Euler product tab racing the series against the primes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Refresh the screenshot

**Files:**
- Modify: `continued-fractions/screenshot1.jpg`

**Interfaces:**
- Consumes: the finished page.
- Produces: an updated gallery thumbnail showing four tabs.

- [ ] **Step 1: Recapture**

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --window-size=1100,860 \
  --screenshot="${TMPDIR:-/tmp}/cf_shot.png" "file://$PWD/continued-fractions/index.html" 2>/dev/null && \
  sips -s format jpeg -s formatOptions 82 "${TMPDIR:-/tmp}/cf_shot.png" \
  --out continued-fractions/screenshot1.jpg >/dev/null && ls -la continued-fractions/screenshot1.jpg
```

Expected: a JPEG under 300 KB. Read it and confirm the tab bar now shows four tabs.

- [ ] **Step 2: Confirm the gallery needs no rebuild**

The gallery card points at `continued-fractions/screenshot1.jpg` and the title is unchanged, so
`build_gallery.py` output does not change. Verify:

```bash
cd /Users/neoneye/git/vibe-coding-lab && python3 build_gallery.py >/dev/null && git diff --stat index.html
```

Expected: no change to `index.html`.

- [ ] **Step 3: Run the full suite one last time**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 60 tests passed`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add continued-fractions/screenshot1.jpg
git commit -m "continued-fractions: refresh screenshot for the fourth tab

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
