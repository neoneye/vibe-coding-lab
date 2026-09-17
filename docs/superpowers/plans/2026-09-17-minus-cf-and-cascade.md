# Minus Continued Fractions and Bracket Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a regular/minus mode toggle to the Simple tab of `continued-fractions/index.html`, plus a telescoping cascade canvas showing convergents closing in on the target — alternating sides in regular mode, one-sided in minus mode.

**Architecture:** Four new pure function groups in the existing `<script id="shared-code">` block's `CF` namespace (minus expansion, minus convergents, a from-above approximation race, cascade geometry), all on the existing exact `BigInt` `Rat` type and tested by the existing `XTests` runner. Then the Simple tab's render path takes a `mode` parameter and gains one canvas.

**Tech Stack:** Vanilla HTML/CSS/JS, `BigInt`, `<canvas>`, Node ≥ 18 for tests. No dependencies.

## Global Constraints

- Everything goes in the existing `continued-fractions/index.html`; still one self-contained file working from `file://`.
- All displayed terms, convergents and bracket widths computed in exact `BigInt` rational arithmetic. Doubles only for drawing coordinates, and only after converting a **relative** position already confined to `[0, 1]`.
- Never display a term the stored precision does not determine; every expansion carries a `stopReason` shown in the UI.
- Minus mode uses the interval path for every irrational, including √2 and φ. No periodic generator for minus expansions.
- `CF.MAX_RACE_Q = 200000` and its refusal message apply unchanged in both modes.
- Style follows the existing page: `--fg:#111; --muted:#666; --border:#ccc; --bg:#fff; --accent:#1a5fb4`; existing `.chip`, `.controls`, `.tablewrap`, `.status` classes.
- Canvases sized in device pixels via the existing `fitCanvas(canvas, cssW, cssH)`.
- Tests run with `node continued-fractions/test.mjs` and must exit 0. The suite currently has 60 tests.
- Commit directly to `main`. Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Minus continued fraction expansion and convergents

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat` (`make/fromInt/add/sub/div/cmp/isZero/floor`), `CF.constant(key)`.
- Produces:
  - `CF.ratCeil(a: Rat) -> BigInt` — ceiling, the counterpart of the existing `Rat.floor`.
  - `CF.minusTermsExact(r: Rat, maxTerms) -> {terms: BigInt[], stopReason: 'exact'|'max-terms'}`
  - `CF.minusTermsFromInterval(lo: Rat, hi: Rat, maxTerms) -> {terms, stopReason: 'precision-exhausted'|'max-terms'|'exact'}`
  - `CF.minusConvergents(terms: BigInt[]) -> {p: BigInt, q: BigInt}[]`
  - `CF.minusExpand(key: string, maxTerms) -> {terms, stopReason, source: 'exact'|'interval'}`

**Two traps this task exists to avoid.** First, `x ↦ 1/(b − x)` is **increasing**, unlike the regular Gauss map `x ↦ 1/(x − a)` which is decreasing — so the interval endpoints do **not** swap. Second, the convergent recurrence `pₙ = bₙpₙ₋₁ − pₙ₋₂` needs the seed `q₋₂ = −1` (the regular case uses `+1`); the regular seed produces negative denominators throughout.

- [ ] **Step 1: Write the failing tests**

Append inside the `shared-code` block, after the last existing `XTests.test(...)` call:

```js
XTests.test('ratCeil is the counterpart of floor', () => {
  XTests.eq(CF.ratCeil(CF.Rat.make(7n, 2n)), 4n);
  XTests.eq(CF.ratCeil(CF.Rat.make(-7n, 2n)), -3n);
  XTests.eq(CF.ratCeil(CF.Rat.make(4n, 2n)), 2n);     // exact integers are their own ceiling
  XTests.eq(CF.ratCeil(CF.Rat.fromInt(0)), 0n);
});

XTests.test('minus expansion of pi matches the known terms', () => {
  const r = CF.minusExpand('pi', 10);
  XTests.eq(r.terms.slice(0, 10).join(','), '4,2,2,2,2,2,2,17,294,3');
});

XTests.test('minus convergents of pi need the q seed of -1', () => {
  const r = CF.minusExpand('pi', 9);
  const c = CF.minusConvergents(r.terms);
  XTests.eq(c.map(x => `${x.p}/${x.q}`).join(' '),
            '4/1 7/2 10/3 13/4 16/5 19/6 22/7 355/113 104348/33215');
  for (const x of c) XTests.ok(x.q > 0n, `denominator ${x.q} was not positive`);
});

XTests.test('minus convergents never fall below the target', () => {
  for (const key of ['pi', 'e', 'sqrt2', 'sqrt3', 'phi', 'ln2', 'gamma', 'cbrt2']) {
    const k = CF.constant(key);
    const x = k.exact || k.lo;
    const r = CF.minusExpand(key, 14);
    for (const c of CF.minusConvergents(r.terms)) {
      XTests.ok(CF.Rat.cmp(CF.Rat.make(c.p, c.q), x) >= 0,
                `${key}: convergent ${c.p}/${c.q} fell below the target`);
    }
  }
});

XTests.test('minus expansion of a rational terminates on it', () => {
  const r = CF.minusExpand('r355_113', 40);
  XTests.eq(r.stopReason, 'exact');
  const c = CF.minusConvergents(r.terms);
  const last = c[c.length - 1];
  XTests.eq(`${last.p}/${last.q}`, '355/113');
});

XTests.test('minus expansion stops honestly when precision runs out', () => {
  const lo = CF.Rat.fromDecimalString('3.14159');
  const hi = CF.Rat.add(lo, CF.Rat.make(1n, 100000n));
  const r = CF.minusTermsFromInterval(lo, hi, 50);
  XTests.eq(r.stopReason, 'precision-exhausted');
  XTests.eq(r.terms.slice(0, 3).join(','), '4,2,2');
});

XTests.test('quadratic irrationals get minus terms from the interval path', () => {
  const r = CF.minusExpand('sqrt2', 8);
  XTests.eq(r.source, 'interval');
  XTests.eq(r.terms.join(','), '2,2,4,2,4,2,4,2');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.ratCeil is not a function`.

- [ ] **Step 3: Implement**

Add inside the `CF` IIFE, immediately before the final `return {...}` statement:

```js
  // ---- minus ("Hirzebruch-Jung") continued fractions: b0 - 1/(b1 - 1/(b2 - ...)) ----

  const ratCeil = (a) => {
    const f = Rat.floor(a);
    return Rat.cmp(Rat.fromInt(f), a) === 0 ? f : f + 1n;
  };

  const minusTermsExact = (r, maxTerms) => {
    const terms = [];
    let x = r;
    for (let i = 0; i < maxTerms; i++) {
      const b = ratCeil(x);
      terms.push(b);
      const d = Rat.sub(Rat.fromInt(b), x);
      if (Rat.isZero(d)) return { terms, stopReason: 'exact' };
      x = Rat.div(Rat.fromInt(1), d);
    }
    return { terms, stopReason: 'max-terms' };
  };

  const minusTermsFromInterval = (lo, hi, maxTerms) => {
    const terms = [];
    let a = lo, b = hi;
    for (let i = 0; i < maxTerms; i++) {
      const ca = ratCeil(a), cb = ratCeil(b);
      if (ca !== cb) return { terms, stopReason: 'precision-exhausted' };
      terms.push(ca);
      const da = Rat.sub(Rat.fromInt(ca), a), db = Rat.sub(Rat.fromInt(cb), b);
      if (Rat.isZero(da) || Rat.isZero(db)) return { terms, stopReason: 'exact' };
      // x -> 1/(b - x) is INCREASING, so the endpoints keep their order (no swap).
      a = Rat.div(Rat.fromInt(1), da);
      b = Rat.div(Rat.fromInt(1), db);
    }
    return { terms, stopReason: 'max-terms' };
  };

  // p_n = b_n p_{n-1} - p_{n-2}. The q seed is -1, not +1: the regular seed
  // makes every denominator negative.
  const minusConvergents = (terms) => {
    let pm1 = 1n, pm2 = 0n, qm1 = 0n, qm2 = -1n;
    const out = [];
    for (const b of terms) {
      const p = b * pm1 - pm2, q = b * qm1 - qm2;
      out.push({ p, q });
      pm2 = pm1; pm1 = p; qm2 = qm1; qm1 = q;
    }
    return out;
  };

  // Minus mode uses the interval path for every irrational, quadratic ones included:
  // their minus expansions are eventually periodic too, but a second periodic
  // generator earns little, so they simply report what the enclosure determines.
  const minusExpand = (key, maxTerms) => {
    const k = constant(key);
    if (k.exact) return { ...minusTermsExact(k.exact, maxTerms), source: 'exact' };
    return { ...minusTermsFromInterval(k.lo, k.hi, maxTerms), source: 'interval' };
  };
```

Extend the IIFE's `return {...}` with:

```js
           ratCeil, minusTermsExact, minusTermsFromInterval, minusConvergents, minusExpand,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 67 tests passed`

If `quadratic irrationals get minus terms from the interval path` fails, the expected
term string is the thing to check first — compute the true minus expansion of √2 by hand
for three terms (`⌈1.41421⌉ = 2`; `1/(2 − 1.41421) = 1.70711`, `⌈⌉ = 2`;
`1/(2 − 1.70711) = 3.41421`, `⌈⌉ = 4`) and correct the test if the plan's string is
wrong. Do not change the implementation to match a string you have not verified.

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: minus continued fraction expansion and convergents

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Mode-aware convergent rows and the from-above race

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: Task 1's functions, plus the existing `CF.convergents`, `CF.expand`, `CF.sci`,
  `CF.constant`, `CF.MAX_RACE_Q`, `CF.bestApproximations`.
- Produces:
  - `CF.convergentRowsFor(key, maxTerms, mode: 'plus'|'minus') -> {rows, stopReason, source}` —
    rows have the same shape as the existing `convergentRows` output:
    `{n, a, p, q, decimal, error, errorStr, errQ2}`.
  - `CF.convergentRows(key, maxTerms)` keeps its existing signature and delegates with `'plus'`.
  - `CF.bestApproximationsAbove(key, Q, count) -> {p, q, error, abs, errorStr}[]` — the closest
    fractions **greater than** the target with denominator `≤ Q`, nearest first. Throws when
    `Q > CF.MAX_RACE_Q`, matching `bestApproximations`.

- [ ] **Step 1: Write the failing tests**

```js
XTests.test('convergentRowsFor reproduces the regular rows', () => {
  const a = CF.convergentRows('pi', 6).rows.map(r => `${r.p}/${r.q}`).join(' ');
  const b = CF.convergentRowsFor('pi', 6, 'plus').rows.map(r => `${r.p}/${r.q}`).join(' ');
  XTests.eq(a, b);
});

XTests.test('convergentRowsFor minus rows carry one-sided errors', () => {
  const { rows } = CF.convergentRowsFor('pi', 8, 'minus');
  XTests.eq(rows.map(r => `${r.p}/${r.q}`).join(' '),
            '4/1 7/2 10/3 13/4 16/5 19/6 22/7 355/113');
  // error = x - p/q, so every minus row has a negative (or zero) error.
  for (const r of rows) XTests.ok(r.error.n <= 0n, `row ${r.n} had a positive error`);
});

XTests.test('bestApproximationsAbove only returns fractions above the target', () => {
  const k = CF.constant('pi');
  const best = CF.bestApproximationsAbove('pi', 113, 5);
  for (const b of best) {
    XTests.ok(CF.Rat.cmp(CF.Rat.make(b.p, b.q), k.lo) > 0, `${b.p}/${b.q} was not above pi`);
  }
  XTests.eq(`${best[0].p}/${best[0].q}`, '355/113');
});

XTests.test('every minus convergent of pi wins its own from-above race', () => {
  const { rows } = CF.convergentRowsFor('pi', 10, 'minus');
  for (const row of rows) {
    if (row.q > BigInt(CF.MAX_RACE_Q) || row.q < 1n) continue;
    const best = CF.bestApproximationsAbove('pi', Number(row.q), 1)[0];
    XTests.eq(`${best.p}/${best.q}`, `${row.p}/${row.q}`, `minus row n=${row.n}`);
  }
});

XTests.test('a minus convergent can lose an unrestricted race', () => {
  // 4/1 is the closest fraction above pi with q = 1, but 3/1 is closer outright.
  const outright = CF.bestApproximations('pi', 1, 1)[0];
  XTests.eq(`${outright.p}/${outright.q}`, '3/1');
  const above = CF.bestApproximationsAbove('pi', 1, 1)[0];
  XTests.eq(`${above.p}/${above.q}`, '4/1');
});

XTests.test('the from-above race refuses denominators it cannot search', () => {
  let threw = false;
  try { CF.bestApproximationsAbove('pi', CF.MAX_RACE_Q + 1, 1); } catch (e) { threw = true; }
  XTests.ok(threw, 'expected a throw for an oversized Q');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.convergentRowsFor is not a function`.

- [ ] **Step 3: Generalise convergentRows**

Replace the existing `convergentRows` definition inside the `CF` IIFE with:

```js
  const convergentRowsFor = (key, maxTerms, mode) => {
    const k = constant(key);
    const x = k.exact || k.lo;
    const e = mode === 'minus' ? minusExpand(key, maxTerms) : expand(key, maxTerms);
    const cs = mode === 'minus' ? minusConvergents(e.terms) : convergents(e.terms);
    const rows = cs.map((c, i) => {
      const val = Rat.make(c.p, c.q);
      const error = Rat.sub(x, val);
      const abs = error.n < 0n ? Rat.neg(error) : error;
      return {
        n: i, a: e.terms[i], p: c.p, q: c.q,
        decimal: Rat.toDecimalString(val, 20),
        error, errorStr: sci(error, 5),
        errQ2: Rat.toDecimalString(Rat.mul(abs, Rat.fromInt(c.q * c.q)), 6),
      };
    });
    return { rows, stopReason: e.stopReason, source: e.source };
  };

  const convergentRows = (key, maxTerms) => convergentRowsFor(key, maxTerms, 'plus');
```

- [ ] **Step 4: Implement the from-above race**

Add after the existing `bestApproximations`:

```js
  // The closest fractions strictly ABOVE the target. Minus convergents are one-sided
  // best approximations, so this is the race they are actually the answer to.
  const bestApproximationsAbove = (key, Q, count) => {
    if (Q > MAX_RACE_Q) throw new Error(`denominator ${Q} exceeds the searchable limit ${MAX_RACE_Q}`);
    const k = constant(key);
    const x = k.exact || k.lo;
    const xd = Rat.toNumber(x);
    const shortlist = [];
    let worst = Infinity;
    for (let q = 1; q <= Q; q++) {
      const p = Math.ceil(xd * q);
      const err = p / q - xd;
      if (err < 0) continue;                       // double noise near an exact hit
      if (shortlist.length < 50 || err < worst) {
        shortlist.push({ p: BigInt(p), q: BigInt(q), err });
        shortlist.sort((a, b) => a.err - b.err);
        if (shortlist.length > 50) shortlist.pop();
        worst = shortlist[shortlist.length - 1].err;
      }
    }
    return shortlist.map(c => {
      const error = Rat.sub(x, Rat.make(c.p, c.q));
      const abs = error.n < 0n ? Rat.neg(error) : error;
      return { p: c.p, q: c.q, error, abs, errorStr: sci(error, 5) };
    })
      .filter(c => Rat.cmp(Rat.make(c.p, c.q), x) > 0)   // exact filter, not the double one
      .sort((a, b) => Rat.cmp(a.abs, b.abs))
      .slice(0, count);
  };
```

Extend the IIFE's `return {...}` so it exports `convergentRowsFor` and
`bestApproximationsAbove` alongside the existing `convergentRows`:

```js
           convergents, sci, convergentRows, convergentRowsFor,
           MAX_RACE_Q, bestApproximations, bestApproximationsAbove,
```

(the existing line already lists `convergents, sci, convergentRows` and
`MAX_RACE_Q, bestApproximations` — extend those, do not duplicate them.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 73 tests passed`

- [ ] **Step 6: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: mode-aware convergent rows and a from-above race

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Cascade geometry

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.constant`, `CF.convergentRowsFor`.
- Produces:
  - `CF.cascadeRows(key, mode: 'plus'|'minus', maxRows: number) -> Row[]` where

```
Row = {
  n: number,                        // level this row is about
  lo: Rat, hi: Rat,                 // the interval this row draws, lo < hi
  width: Rat,                       // hi - lo
  brackets: boolean,                // true when the target lies strictly inside (lo, hi)
  loPos: number, hiPos: number, targetPos: number,   // positions in [0, 1] in the zoomed view
  loLabel: string, hiLabel: string, // "p/q", or "x" for a target endpoint
  loAbove: boolean, hiAbove: boolean // which side of the target each endpoint sits on
}
```

  In regular mode row `n` spans convergents `n−1` and `n`, which straddle the target, so
  `brackets` is true. In minus mode both convergents sit above the target, so the row spans
  convergent `n` down to the target itself and `brackets` is false.

  The **view** for row `n` is row `n−1`'s interval padded by 15% on each side; row 0's view is
  its own interval padded the same way. Positions are `(v − viewLo)/(viewHi − viewLo)` computed
  in exact rationals and converted to `Number` only at the end, so brackets narrower than
  `10⁻³⁰` still place correctly where a float subtraction would underflow to zero.

- [ ] **Step 1: Write the failing tests**

```js
XTests.test('cascade rows bracket the target in regular mode', () => {
  const rows = CF.cascadeRows('pi', 'plus', 8);
  const x = CF.constant('pi').lo;
  XTests.ok(rows.length >= 6, `expected several rows, got ${rows.length}`);
  for (const r of rows) {
    XTests.ok(r.brackets, `row ${r.n} did not bracket the target`);
    XTests.ok(CF.Rat.cmp(r.lo, x) < 0 && CF.Rat.cmp(x, r.hi) < 0, `target outside row ${r.n}`);
    XTests.ok(r.loAbove === false && r.hiAbove === true, `row ${r.n} endpoints on wrong sides`);
  }
});

XTests.test('cascade rows are strictly nested', () => {
  for (const mode of ['plus', 'minus']) {
    const rows = CF.cascadeRows('pi', mode, 8);
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1], cur = rows[i];
      XTests.ok(CF.Rat.cmp(cur.width, prev.width) < 0,
                `${mode} row ${cur.n} was not narrower than row ${prev.n}`);
      XTests.ok(CF.Rat.cmp(prev.lo, cur.lo) <= 0 && CF.Rat.cmp(cur.hi, prev.hi) <= 0,
                `${mode} row ${cur.n} escaped row ${prev.n}`);
    }
  }
});

XTests.test('cascade rows in minus mode sit entirely above the target', () => {
  const rows = CF.cascadeRows('pi', 'minus', 8);
  const x = CF.constant('pi').lo;
  for (const r of rows) {
    XTests.ok(!r.brackets, `minus row ${r.n} claimed to bracket the target`);
    XTests.ok(CF.Rat.cmp(r.lo, x) >= 0, `minus row ${r.n} extended below the target`);
    XTests.eq(r.loLabel, 'x', `minus row ${r.n} should start at the target`);
  }
});

XTests.test('cascade positions stay inside the drawable range', () => {
  for (const mode of ['plus', 'minus']) {
    for (const key of ['pi', 'e', 'sqrt2', 'phi']) {
      for (const r of CF.cascadeRows(key, mode, 10)) {
        for (const pos of [r.loPos, r.hiPos, r.targetPos]) {
          XTests.ok(pos >= 0 && pos <= 1 && Number.isFinite(pos),
                    `${key}/${mode} row ${r.n}: position ${pos} out of range`);
        }
      }
    }
  }
});

XTests.test('cascade survives brackets narrower than a double can subtract', () => {
  const rows = CF.cascadeRows('phi', 'plus', 14);     // phi converges slowly but steadily
  const last = rows[rows.length - 1];
  XTests.ok(CF.Rat.cmp(last.width, CF.Rat.make(1n, 10n ** 5n)) < 0, 'expected a narrow last row');
  XTests.ok(Number.isFinite(last.targetPos) && last.targetPos > 0 && last.targetPos < 1,
            `target position collapsed to ${last.targetPos}`);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.cascadeRows is not a function`.

- [ ] **Step 3: Implement**

Add inside the `CF` IIFE, before the final `return {...}`:

```js
  // ---- telescoping bracket cascade ----

  const cascadeRows = (key, mode, maxRows) => {
    const k = constant(key);
    const x = k.exact || k.lo;
    const { rows: cr } = convergentRowsFor(key, maxRows + 2, mode);
    const vals = cr.map(r => Rat.make(r.p, r.q));
    const labels = cr.map(r => `${r.p}/${r.q}`);
    const out = [];

    for (let n = 1; n < vals.length && out.length < maxRows; n++) {
      let lo, hi, loLabel, hiLabel;
      if (mode === 'minus') {
        // Both convergents sit above the target, so the informative interval runs
        // from the target up to the newest convergent.
        lo = x; hi = vals[n]; loLabel = 'x'; hiLabel = labels[n];
        if (Rat.cmp(hi, lo) <= 0) break;            // an exact hit: nothing left to draw
      } else {
        const a = vals[n - 1], b = vals[n];
        if (Rat.cmp(a, b) < 0) { lo = a; hi = b; loLabel = labels[n - 1]; hiLabel = labels[n]; }
        else { lo = b; hi = a; loLabel = labels[n]; hiLabel = labels[n - 1]; }
        if (Rat.cmp(lo, x) >= 0 || Rat.cmp(x, hi) >= 0) break;   // target no longer inside
      }
      const width = Rat.sub(hi, lo);
      if (Rat.isZero(width)) break;

      // The view is the PREVIOUS row's interval, padded 15% each side; row 0 uses its own.
      const base = out.length ? out[out.length - 1] : { lo, hi, width };
      const pad = Rat.mul(base.width, Rat.make(15n, 100n));   // 15% of the base width
      const viewLo = Rat.sub(base.lo, pad), viewHi = Rat.add(base.hi, pad);
      const span = Rat.sub(viewHi, viewLo);
      const pos = (v) => {
        const t = Rat.toNumber(Rat.div(Rat.sub(v, viewLo), span));
        return t < 0 ? 0 : t > 1 ? 1 : t;
      };

      out.push({
        n, lo, hi, width,
        brackets: Rat.cmp(lo, x) < 0 && Rat.cmp(x, hi) < 0,
        loPos: pos(lo), hiPos: pos(hi), targetPos: pos(x),
        loLabel, hiLabel,
        loAbove: Rat.cmp(lo, x) > 0, hiAbove: Rat.cmp(hi, x) > 0,
      });
    }
    return out;
  };
```

Extend the IIFE's `return {...}` with:

```js
           cascadeRows,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 78 tests passed`

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: telescoping cascade geometry in exact rationals

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Simple tab mode toggle and cascade canvas

**Files:**
- Modify: `continued-fractions/index.html` (Simple panel markup, styles, page script)

**Interfaces:**
- Consumes: all of Tasks 1–3, plus the existing `fitCanvas(canvas, cssW, cssH)`, `el(id)`,
  `state.simple`, `towerHTML(terms, depth)`, `elide(s, max)`, `STOP_REASON`.
- Produces: DOM ids `#simple-mode`, `#simple-cascade`, `#simple-cascade-caption`.

- [ ] **Step 1: Add the markup**

Inside `<div class="panel active" id="panel-simple">`, add a mode row immediately before
the existing `<div class="chips" id="simple-chips"></div>`:

```html
    <div class="chips" id="simple-mode"></div>
```

And insert the cascade between the existing `<p class="status" id="simple-status"></p>` and
the existing `<div class="tablewrap"><table id="simple-table"></table></div>`:

```html
    <canvas id="simple-cascade" width="900" height="380"></canvas>
    <p class="status" id="simple-cascade-caption"></p>
```

- [ ] **Step 2: Add the styles**

Append to the stylesheet:

```css
  #simple-mode .chip { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
  #simple-cascade { display:block; margin:10px 0 4px 0; }
```

- [ ] **Step 3: Render the mode toggle and thread the mode through**

In the page script, change the `state.simple` initialiser to carry a mode:

```js
    simple: { key: 'pi', depth: 6, selected: null, mode: 'plus' },
```

Then inside `renderSimple()`, replace the line

```js
    const { rows, stopReason } = CF.convergentRows(s.key, MAX_SIMPLE_TERMS);
```

with

```js
    const { rows, stopReason } = CF.convergentRowsFor(s.key, MAX_SIMPLE_TERMS, s.mode);
```

and add this block at the top of `renderSimple()`, before the chip rendering:

```js
    const MODES = [
      { key: 'plus',  label: 'regular a₀ + 1/(a₁ + …)' },
      { key: 'minus', label: 'minus b₀ − 1/(b₁ − …)' },
    ];
    el('simple-mode').innerHTML = MODES
      .map(m => `<button class="chip ${m.key === s.mode ? 'active' : ''}" data-mode="${m.key}">${m.label}</button>`)
      .join('');
    el('simple-mode').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      s.mode = b.dataset.mode; s.selected = null; renderSimple();
    }));
```

- [ ] **Step 4: Make the tower and term list mode-aware**

Inside `renderSimple()`, replace the two lines that build the tower and term list:

```js
    el('simple-tower').innerHTML = `${k.label} = ` + towerHTML(terms, depth);
    el('simple-terms').textContent =
      `[${terms[0]}; ${terms.slice(1, depth).join(', ')}${depth < terms.length ? ', …' : ''}]`;
```

with:

```js
    const minus = s.mode === 'minus';
    el('simple-tower').innerHTML = `${k.label} = ` + towerHTML(terms, depth, minus);
    const open = minus ? '⟦' : '[', close = minus ? '⟧' : ']';
    el('simple-terms').textContent =
      `${open}${terms[0]}; ${terms.slice(1, depth).join(', ')}${depth < terms.length ? ', …' : ''}${close}` +
      (minus ? '   (double brackets mark a minus expansion)' : '');
```

and give `towerHTML` the extra parameter — replace its definition with:

```js
  // a0 + 1/(a1 + 1/(a2 + ...)), or with minus signs for a minus expansion.
  function towerHTML(terms, depth, minus) {
    const op = minus ? ' − ' : ' + ';
    const build = (i) => {
      const a = String(terms[i]);
      if (i >= depth - 1) {
        return i + 1 < terms.length ? `${a}${op}<span class="muted">…</span>` : a;
      }
      return `${a}${op}<span class="frac"><span class="stack">` +
             `<span class="num">1</span><span class="den">${build(i + 1)}</span>` +
             `</span></span>`;
    };
    return build(0);
  }
```

- [ ] **Step 5: Make the race mode-aware**

Replace the body of `renderRace(rows)` between the `MAX_RACE_Q` guard and the end with a
mode-aware version. The full replacement function:

```js
  function renderRace(rows) {
    const s = state.simple;
    const box = el('simple-race');
    const minus = s.mode === 'minus';
    if (s.selected === null) {
      box.innerHTML = '<p class="status">Click a row to race its convergent against every ' +
        (minus ? 'fraction above the target ' : 'fraction ') +
        'with a denominator that small.</p>';
      return;
    }
    const row = rows[s.selected];
    if (row.q > BigInt(CF.MAX_RACE_Q)) {
      box.innerHTML = `<p class="status">q = ${row.q} is too large to search exhaustively ` +
        `(the limit is ${CF.MAX_RACE_Q.toLocaleString()}). This page will not claim a search it did not run.</p>`;
      return;
    }
    const best = minus
      ? CF.bestApproximationsAbove(s.key, Number(row.q), 5)
      : CF.bestApproximations(s.key, Number(row.q), 5);
    const winner = best.length && `${best[0].p}/${best[0].q}` === `${row.p}/${row.q}`;
    const list = best.map((b, i) => {
      const isRow = `${b.p}/${b.q}` === `${row.p}/${row.q}`;
      return `<tr class="${isRow ? 'selected' : ''}"><td>${i + 1}</td>` +
             `<td class="mono">${b.p}/${b.q}</td><td class="mono">${b.errorStr}</td></tr>`;
    }).join('');
    box.innerHTML =
      `<p class="status">Every fraction ${minus ? 'above ' + CF.constant(s.key).label + ' ' : ''}` +
      `with q ≤ ${row.q} checked. ` +
      (winner
        ? `The convergent <strong>${row.p}/${row.q}</strong> is the closest` +
          (minus ? ' of those.' : ' of them all.')
        : `The convergent ${row.p}/${row.q} did <strong>not</strong> win — worth investigating.`) +
      (minus
        ? ' Minus convergents are <em>one-sided</em> best approximations: they only ever approach ' +
          'from above, so an unrestricted race can be won by a closer fraction below — 4/1 ' +
          'loses outright to 3/1, for instance.'
        : '') +
      `</p><div class="tablewrap"><table><tr><th>rank</th><th>p/q</th><th>x − p/q</th></tr>${list}</table></div>`;
  }
```

- [ ] **Step 6: Draw the cascade**

Add this function to the page script and call `renderCascade()` from the end of
`renderSimple()`, right after `renderSimpleTable(rows)`:

```js
  const CASCADE_ROWS = 12;

  function renderCascade() {
    const s = state.simple;
    const rows = CF.cascadeRows(s.key, s.mode, CASCADE_ROWS);
    const rowH = 28, padL = 54, padR = 16, padT = 14;
    const W = 900, H = padT + Math.max(1, rows.length) * rowH + 10;
    const ctx = fitCanvas(el('simple-cascade'), W, H);
    ctx.clearRect(0, 0, W, H);
    const BELOW = '#1a5fb4', ABOVE = '#c64600';
    const inner = W - padL - padR;
    const X = (t) => padL + t * inner;

    if (!rows.length) {
      ctx.fillStyle = '#666'; ctx.font = '12px sans-serif';
      ctx.fillText('nothing left to bracket — the expansion is exact', padL, padT + 16);
      el('simple-cascade-caption').textContent = '';
      return;
    }

    rows.forEach((r, i) => {
      const y = padT + i * rowH + rowH / 2;
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();

      // the interval this row covers
      ctx.strokeStyle = '#999'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X(r.loPos), y); ctx.lineTo(X(r.hiPos), y); ctx.stroke();

      // Endpoint ticks, coloured by side. An endpoint labelled "x" IS the target, already
      // drawn as the black line below, so it gets no tick of its own.
      [[r.loPos, r.loLabel, r.loAbove], [r.hiPos, r.hiLabel, r.hiAbove]].forEach(([t, label, above]) => {
        if (label === 'x') return;
        ctx.strokeStyle = above ? ABOVE : BELOW; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X(t), y - 8); ctx.lineTo(X(t), y + 8); ctx.stroke();
        ctx.fillStyle = above ? ABOVE : BELOW; ctx.font = '10px ui-monospace, Menlo, monospace';
        const w = ctx.measureText(label).width;
        const lx = Math.min(Math.max(X(t) - w / 2, padL), W - padR - w);
        ctx.fillText(label, lx, y - 11);
      });

      // the target
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(r.targetPos), y - 12); ctx.lineTo(X(r.targetPos), y + 12); ctx.stroke();

      ctx.fillStyle = '#666'; ctx.font = '10px sans-serif';
      ctx.fillText(`n=${r.n}`, 4, y + 3);
      ctx.fillText(CF.sci(r.width, 3), 24, y + 3);
    });

    const minus = s.mode === 'minus';
    el('simple-cascade-caption').textContent = minus
      ? `Each row zooms into the row above. Every convergent sits on the same side — above ` +
        `${CF.constant(s.key).label} — and marches down onto it without ever crossing. ` +
        `The bar runs from the target to the newest convergent; the number on the left is its width.`
      : `Each row zooms into the row above. The two convergents land on opposite sides of ` +
        `${CF.constant(s.key).label} and trap it between them, and every level tightens the trap ` +
        `inside the previous one. Blue is below the target, orange above; the number on the left ` +
        `is the bracket width.`;
  }
```

- [ ] **Step 7: Run the tests and smoke-test the page**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 78 tests passed`

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --enable-logging=stderr \
  "file://$PWD/continued-fractions/index.html" 2>&1 | grep -ci "uncaught"
```

Expected: 0.

- [ ] **Step 8: Look at both modes**

```bash
cd /Users/neoneye/git/vibe-coding-lab && for MODE in plus minus; do
  SC="${TMPDIR:-/tmp}/cf_$MODE.html"
  sed "s|  document.querySelectorAll(.\.tab.).forEach(t => t.addEventListener|  setTimeout(()=>document.querySelector('#simple-mode .chip[data-mode=$MODE]').click(),0);\n  document.querySelectorAll('.tab').forEach(t => t.addEventListener|" \
    continued-fractions/index.html > "$SC"
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
    --virtual-time-budget=5000 --window-size=1000,1000 \
    --screenshot="${TMPDIR:-/tmp}/cf_$MODE.png" "file://$SC" 2>/dev/null
  echo "${TMPDIR:-/tmp}/cf_$MODE.png"
done
```

Read both PNGs with the Read tool and confirm:
- **plus**: ticks alternate left/right down the cascade, each row's black target line falls
  between the two coloured ticks, and the rows visibly telescope.
- **minus**: every coloured tick is orange and on the same side, the target line sits at the
  far end of each bar, and the term list reads `⟦4; 2, 2, 2, …⟧`.

Fix anything that does not match before committing.

- [ ] **Step 9: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: regular/minus mode toggle and the bracket cascade

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Refresh the screenshot

**Files:**
- Modify: `continued-fractions/screenshot1.jpg`

**Interfaces:**
- Consumes: the finished page.
- Produces: an updated gallery thumbnail showing the mode toggle and cascade.

- [ ] **Step 1: Recapture**

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --window-size=1100,900 \
  --screenshot="${TMPDIR:-/tmp}/cf_shot.png" "file://$PWD/continued-fractions/index.html" 2>/dev/null && \
  sips -s format jpeg -s formatOptions 82 "${TMPDIR:-/tmp}/cf_shot.png" \
  --out continued-fractions/screenshot1.jpg >/dev/null && ls -la continued-fractions/screenshot1.jpg
```

Expected: a JPEG under 300 KB. Read it and confirm the mode toggle and cascade are visible.

- [ ] **Step 2: Confirm the gallery needs no rebuild**

```bash
cd /Users/neoneye/git/vibe-coding-lab && python3 build_gallery.py >/dev/null && git diff --stat index.html
```

Expected: no change to `index.html` (same title, same screenshot path).

- [ ] **Step 3: Final test run**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 78 tests passed`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add continued-fractions/screenshot1.jpg
git commit -m "continued-fractions: refresh screenshot for the mode toggle and cascade

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
