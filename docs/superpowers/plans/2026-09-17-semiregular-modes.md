# Semiregular Continued Fraction Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Simple tab's regular/minus toggle with a four-way rounding-rule choice — `⌊x⌋ always`, `nearest`, `⌊x⌋ ⌈x⌉ alternating`, `⌈x⌉ always` — collapsing the two existing parallel implementations into one sign-carrying expansion and one sign-carrying recurrence.

**Architecture:** A single `semiregularTerms` replaces `termsFromInterval` + `minusTermsFromInterval`, and a single `semiregularConvergents` replaces `convergents` + `minusConvergents`, both carrying `ε ∈ {+1, −1}` explicitly. The existing regular and minus behaviour becomes the all-`+1` and all-`−1` cases, so those code paths are deleted rather than extended. The cascade then decides bracket-vs-one-sided per row instead of per mode.

**Tech Stack:** Vanilla HTML/CSS/JS, `BigInt`, `<canvas>`, Node ≥ 18 for tests. No dependencies.

## Global Constraints

- Everything goes in the existing `continued-fractions/index.html`; still one self-contained file working from `file://`.
- All displayed terms, signs, convergents and bracket widths computed in exact `BigInt` rational arithmetic. Doubles only for drawing coordinates.
- Mode keys are `'floor'`, `'nearest'`, `'alt'`, `'ceil'`. The old `'plus'` and `'minus'` keys are gone; every call site must be updated.
- A term is emitted only when **both** the chosen integer and the resulting sign agree across the whole enclosure.
- `'floor'` mode keeps using `CF.quadraticTerms` for √2, √3, √5 and φ, so it does not lose its unlimited term count. The other three modes use the interval path.
- `'alt'` is a construction, not a classical object, and the page labels it as one.
- `CF.MAX_RACE_Q = 200000` and its refusal message apply unchanged in all modes.
- Canvases sized in device pixels via the existing `fitCanvas(canvas, cssW, cssH)`.
- Tests run with `node continued-fractions/test.mjs` and must exit 0. The suite currently has 78 tests.
- Commit directly to `main`. Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: The unified expansion and recurrence

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.ratCeil`, `CF.constant`, `CF.quadraticTerms`.
- Produces:
  - `CF.SEMI_MODES` — array of `{key, label, note}` in display order:
    `floor` / `'⌊x⌋ always'`, `nearest` / `'nearest'`,
    `alt` / `'⌊x⌋ ⌈x⌉ alternating'`, `ceil` / `'⌈x⌉ always'`.
    `note` is `null` except for `alt`, whose note is
    `'a construction, not a classical expansion'`.
  - `CF.ratRound(a: Rat) -> BigInt` — nearest integer, halves rounding up.
  - `CF.pickInteger(x: Rat, mode: string, level: number) -> BigInt` — the rounding rule.
  - `CF.semiregularTerms(lo: Rat, hi: Rat, mode: string, maxTerms: number) -> {terms: BigInt[], signs: number[], stopReason: 'exact'|'precision-exhausted'|'max-terms'}`
    `signs[i]` is the `ε` attached to level `i+1`, so `signs.length === terms.length - 1`
    for a non-terminating expansion.
  - `CF.semiregularConvergents(terms: BigInt[], signs: number[]) -> {p: BigInt, q: BigInt}[]`

**The recurrence, with the convention that matters:**

```
Aₖ = aₖ·Aₖ₋₁ + εₖ·Aₖ₋₂        A₋₂ = 0, A₋₁ = 1
Bₖ = aₖ·Bₖ₋₁ + εₖ·Bₖ₋₂        B₋₂ = 1, B₋₁ = 0
```

with `ε₀ = +1`. There is no numerator before the first term; `ε₀` only multiplies the
seed, and that convention is what makes `B₀ = 1` in every mode. Verified during design:
this reproduces π's regular convergents `3/1 22/7 333/106 355/113 103993/33102` and its
minus convergents `4/1 7/2 10/3 13/4 16/5 19/6 22/7 355/113 104348/33215`, denominators
positive throughout.

- [ ] **Step 1: Write the failing tests**

Append inside the `shared-code` block, after the last existing `XTests.test(...)` call:

```js
XTests.test('ratRound rounds to nearest, halves up', () => {
  XTests.eq(CF.ratRound(CF.Rat.make(7n, 2n)), 4n);       // 3.5 -> 4
  XTests.eq(CF.ratRound(CF.Rat.make(5n, 2n)), 3n);       // 2.5 -> 3
  XTests.eq(CF.ratRound(CF.Rat.make(7n, 3n)), 2n);       // 2.33 -> 2
  XTests.eq(CF.ratRound(CF.Rat.make(-7n, 2n)), -3n);     // -3.5 -> -3
});

XTests.test('the four modes give the known expansions of pi', () => {
  const k = CF.constant('pi');
  const t = (mode, n) => CF.semiregularTerms(k.lo, k.hi, mode, n);
  XTests.eq(t('floor', 8).terms.join(','), '3,7,15,1,292,1,1,1');
  XTests.eq(t('ceil', 9).terms.join(','), '4,2,2,2,2,2,2,17,294');
  const near = t('nearest', 7);
  XTests.eq(near.terms.join(','), '3,7,16,294,3,4,5');
  XTests.eq(near.signs.slice(0, 6).join(','), '1,1,-1,-1,-1,-1');
  const alt = t('alt', 8);
  XTests.eq(alt.terms.join(','), '3,8,1,15,293,2,2,3');
  XTests.eq(alt.signs.slice(0, 7).join(','), '1,-1,1,-1,1,-1,1');
});

XTests.test('signs are constant in the floor and ceil modes', () => {
  const k = CF.constant('e');
  XTests.eq(new Set(CF.semiregularTerms(k.lo, k.hi, 'floor', 10).signs).size, 1);
  XTests.eq(CF.semiregularTerms(k.lo, k.hi, 'floor', 10).signs[0], 1);
  XTests.eq(CF.semiregularTerms(k.lo, k.hi, 'ceil', 10).signs[0], -1);
});

XTests.test('the recurrence reproduces both existing convergent sets', () => {
  const plus = CF.semiregularConvergents([3n, 7n, 15n, 1n, 292n], [1, 1, 1, 1]);
  XTests.eq(plus.map(c => `${c.p}/${c.q}`).join(' '),
            '3/1 22/7 333/106 355/113 103993/33102');
  const minus = CF.semiregularConvergents(
    [4n, 2n, 2n, 2n, 2n, 2n, 2n, 17n, 294n], [-1, -1, -1, -1, -1, -1, -1, -1]);
  XTests.eq(minus.map(c => `${c.p}/${c.q}`).join(' '),
            '4/1 7/2 10/3 13/4 16/5 19/6 22/7 355/113 104348/33215');
  for (const c of minus) XTests.ok(c.q > 0n, `denominator ${c.q} was not positive`);
});

XTests.test('sqrt2 in nearest mode is its regular expansion, all signs plus', () => {
  const k = CF.constant('sqrt2');
  const r = CF.semiregularTerms(k.lo, k.hi, 'nearest', 8);
  XTests.eq(r.terms.join(','), '1,2,2,2,2,2,2,2');
  XTests.eq(new Set(r.signs).size, 1);
  XTests.eq(r.signs[0], 1);
});

XTests.test('phi in nearest mode is a minus expansion, all signs minus', () => {
  const k = CF.constant('phi');
  const r = CF.semiregularTerms(k.lo, k.hi, 'nearest', 8);
  XTests.eq(r.terms.join(','), '2,3,3,3,3,3,3,3');
  XTests.eq(new Set(r.signs).size, 1);
  XTests.eq(r.signs[0], -1);
  const x = k.lo;
  for (const c of CF.semiregularConvergents(r.terms, r.signs)) {
    XTests.ok(CF.Rat.cmp(CF.Rat.make(c.p, c.q), x) > 0, `${c.p}/${c.q} was not above phi`);
  }
});

XTests.test('every mode converges to the constant it expands', () => {
  for (const key of ['pi', 'e', 'sqrt2', 'sqrt3', 'phi', 'ln2', 'gamma', 'cbrt2']) {
    const k = CF.constant(key);
    for (const m of CF.SEMI_MODES) {
      const r = CF.semiregularTerms(k.lo, k.hi, m.key, 12);
      const cs = CF.semiregularConvergents(r.terms, r.signs);
      const last = cs[cs.length - 1];
      const d = CF.Rat.sub(k.lo, CF.Rat.make(last.p, last.q));
      const abs = d.n < 0n ? CF.Rat.neg(d) : d;
      XTests.ok(CF.Rat.cmp(abs, CF.Rat.fromDecimalString('0.0001')) < 0,
                `${key}/${m.key} last convergent off by ${CF.sci(abs, 4)}`);
    }
  }
});

XTests.test('a term is withheld when the sign is undetermined', () => {
  // An enclosure straddling a half-integer: the nearest integer may be certain while
  // the side - and therefore the sign - is not.
  const lo = CF.Rat.fromDecimalString('2.4999');
  const hi = CF.Rat.fromDecimalString('2.5001');
  const r = CF.semiregularTerms(lo, hi, 'nearest', 10);
  XTests.eq(r.stopReason, 'precision-exhausted');
  XTests.ok(r.terms.length <= 1, `expected to stop immediately, got ${r.terms.length} terms`);
});

XTests.test('a rational terminates in every mode', () => {
  const k = CF.constant('r355_113');
  for (const m of CF.SEMI_MODES) {
    const r = CF.semiregularTerms(k.exact, k.exact, m.key, 40);
    XTests.eq(r.stopReason, 'exact', `${m.key} did not terminate`);
    const cs = CF.semiregularConvergents(r.terms, r.signs);
    const last = cs[cs.length - 1];
    XTests.eq(CF.Rat.cmp(CF.Rat.make(last.p, last.q), k.exact), 0, `${m.key} missed the value`);
  }
});

XTests.test('alt is labelled as a construction', () => {
  const alt = CF.SEMI_MODES.find(m => m.key === 'alt');
  XTests.ok(alt.note && alt.note.length > 0, 'alt must carry a note');
  for (const m of CF.SEMI_MODES) {
    if (m.key !== 'alt') XTests.ok(m.note === null, `${m.key} should have no note`);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.ratRound is not a function`.

- [ ] **Step 3: Implement**

Add inside the `CF` IIFE, before the final `return {...}`:

```js
  // ---- semiregular continued fractions: x = a + eps/x', eps in {+1, -1} ----
  //
  // The rounding rule IS the knob. a = floor(x) puts the remainder in (0,1), forcing
  // eps = +1; a = ceil(x) puts it in (-1,0), forcing eps = -1. So "always floor" is the
  // regular expansion and "always ceiling" is the minus one; they are not separate
  // algorithms. In every mode the next value is x' = 1/|x - a|.

  const SEMI_MODES = [
    { key: 'floor',   label: '⌊x⌋ always',                      note: null },
    { key: 'nearest', label: 'nearest',                                   note: null },
    { key: 'alt',     label: '⌊x⌋ ⌈x⌉ alternating',
      note: 'a construction, not a classical expansion' },
    { key: 'ceil',    label: '⌈x⌉ always',                      note: null },
  ];

  const ratRound = (a) => {
    const f = Rat.floor(a);
    const frac = Rat.sub(a, Rat.fromInt(f));
    return Rat.cmp(frac, Rat.make(1n, 2n)) >= 0 ? f + 1n : f;   // halves round up
  };

  // level is 0-based; alt starts with floor so its first sign is +1.
  const pickInteger = (x, mode, level) => {
    if (mode === 'floor') return Rat.floor(x);
    if (mode === 'ceil') return ratCeil(x);
    if (mode === 'nearest') return ratRound(x);
    if (mode === 'alt') return level % 2 === 0 ? Rat.floor(x) : ratCeil(x);
    throw new Error('unknown mode ' + mode);
  };

  const semiregularTerms = (lo, hi, mode, maxTerms) => {
    const terms = [], signs = [];
    let a = lo, b = hi;
    for (let i = 0; i < maxTerms; i++) {
      const ia = pickInteger(a, mode, i), ib = pickInteger(b, mode, i);
      if (ia !== ib) return { terms, signs, stopReason: 'precision-exhausted' };
      const ra = Rat.sub(a, Rat.fromInt(ia)), rb = Rat.sub(b, Rat.fromInt(ib));
      if (Rat.isZero(ra) && Rat.isZero(rb)) { terms.push(ia); return { terms, signs, stopReason: 'exact' }; }
      // The SIGN must be certain too, not just the integer: an enclosure straddling ia
      // determines the term while leaving the side of it unknown.
      const sa = Rat.cmp(ra, Rat.fromInt(0)), sb = Rat.cmp(rb, Rat.fromInt(0));
      if (sa === 0 || sb === 0 || sa !== sb) return { terms, signs, stopReason: 'precision-exhausted' };
      terms.push(ia);
      signs.push(sa > 0 ? 1 : -1);
      // x -> 1/|x - a|. With |.| applied, the map is decreasing when the remainder is
      // positive (endpoints swap) and increasing when it is negative (they do not).
      const abs = (r) => (r.n < 0n ? Rat.neg(r) : r);
      const na = Rat.div(Rat.fromInt(1), abs(ra)), nb = Rat.div(Rat.fromInt(1), abs(rb));
      if (Rat.cmp(na, nb) <= 0) { a = na; b = nb; } else { a = nb; b = na; }
    }
    return { terms, signs, stopReason: 'max-terms' };
  };

  // A_k = a_k A_{k-1} + eps_k A_{k-2}, with eps_0 = +1: there is no numerator before the
  // first term, and eps_0 only multiplies the seed. That is what makes B_0 = 1 in every mode.
  const semiregularConvergents = (terms, signs) => {
    let Am2 = 0n, Am1 = 1n, Bm2 = 1n, Bm1 = 0n;
    const out = [];
    for (let k = 0; k < terms.length; k++) {
      const e = BigInt(k === 0 ? 1 : signs[k - 1]);
      const A = terms[k] * Am1 + e * Am2, B = terms[k] * Bm1 + e * Bm2;
      out.push({ p: A, q: B });
      Am2 = Am1; Am1 = A; Bm2 = Bm1; Bm1 = B;
    }
    return out;
  };
```

Extend the IIFE's `return {...}` with:

```js
           SEMI_MODES, ratRound, pickInteger, semiregularTerms, semiregularConvergents,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 88 tests passed`

If `the four modes give the known expansions of pi` fails on the `alt` row, check the
starting parity first: `alt` level 0 must use `floor`, giving first sign `+1`. If it fails
on `nearest`, check that `ratRound` rounds halves **up** — a halves-to-even rule changes
terms for values sitting exactly on a half.

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: one semiregular expansion and recurrence for all four rounding rules

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Retire the parallel implementations

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: Task 1's `semiregularTerms`, `semiregularConvergents`, `SEMI_MODES`.
- Produces:
  - `CF.expandMode(key: string, mode: string, maxTerms: number) -> {terms, signs, stopReason, source: 'exact'|'interval'|'quadratic'}`
    — dispatches: exact rationals to the exact path, `'floor'` mode on a constant with a
    `quad` field to `quadraticTerms` (all signs `+1`), everything else to the interval path.
  - `CF.convergentRowsFor(key, maxTerms, mode)` — unchanged signature, now accepting the
    four new mode keys; rows gain a `sign` field (the `ε` on that level, `1` for level 0).
  - `CF.convergentRows(key, maxTerms)` still delegates with `'floor'`.
- Removed: `CF.termsFromInterval`, `CF.minusTermsFromInterval`, `CF.minusTermsExact`,
  `CF.minusConvergents`, `CF.minusExpand`, `CF.termsExact`, `CF.expand`. Their tests are
  rewritten against the replacements in this task's Step 1.

- [ ] **Step 1: Rewrite the tests that name the removed functions**

Three existing tests call the old API. Replace each in place.

Replace the body of `'rational expansion terminates'` with:

```js
  const r = CF.expandMode('r355_113', 'floor', 40);
  XTests.eq(r.terms.join(','), '3,7,16');
  XTests.eq(r.stopReason, 'exact');
```

Replace `'quadratic irrationals are periodic'` body's `CF.expand(` calls with
`CF.expandMode(` plus a `'floor'` argument, e.g.:

```js
  XTests.eq(CF.expandMode('sqrt2', 'floor', 8).terms.join(','), '1,2,2,2,2,2,2,2');
  XTests.eq(CF.expandMode('sqrt3', 'floor', 8).terms.join(','), '1,1,2,1,2,1,2,1');
  XTests.eq(CF.expandMode('sqrt5', 'floor', 5).terms.join(','), '2,4,4,4,4');
  XTests.eq(CF.expandMode('phi', 'floor', 8).terms.join(','), '1,1,1,1,1,1,1,1');
  XTests.eq(CF.expandMode('sqrt2', 'floor', 200).terms.length, 200);
```

Every remaining `CF.expand(` call — in the pi/e/gamma/cbrt2 term tests and in all five
geometry tests, which call it to obtain terms — takes the same mechanical substitution
`CF.expand(k, n)` → `CF.expandMode(k, 'floor', n)`. Apply it in one pass:

```bash
cd /Users/neoneye/git/vibe-coding-lab && \
  perl -pi -e "s/CF\.expand\('([a-z0-9_]+)', /CF.expandMode('\$1', 'floor', /g" \
  continued-fractions/index.html && \
  grep -c "CF.expandMode(" continued-fractions/index.html
```

Expected: a count of 9 or more, and `grep -n "CF\.expand(" continued-fractions/index.html`
returning nothing.

Replace `'a low-precision enclosure stops honestly'` body with:

```js
  const lo = CF.Rat.fromDecimalString('3.14159');
  const hi = CF.Rat.add(lo, CF.Rat.make(1n, 100000n));
  const r = CF.semiregularTerms(lo, hi, 'floor', 50);
  XTests.eq(r.stopReason, 'precision-exhausted');
  XTests.eq(r.terms.join(','), '3,7');
```

Replace `'interval expansion of pi runs deep then stops honestly'` body with:

```js
  const k = CF.constant('pi');
  const r = CF.semiregularTerms(k.lo, k.hi, 'floor', 200);
  XTests.eq(r.stopReason, 'precision-exhausted');
  XTests.ok(r.terms.length >= 30, `expected 30+ certain terms, got ${r.terms.length}`);
```

Delete these five now-redundant tests outright — Task 1 covers what they asserted:
`'minus expansion of pi matches the known terms'`,
`'minus convergents of pi need the q seed of -1'`,
`'minus expansion of a rational terminates on it'`,
`'minus expansion stops honestly when precision runs out'`,
`'quadratic irrationals get minus terms from the interval path'`.

Keep `'minus convergents never fall below the target'` but rewrite its body to the new API:

```js
  for (const key of ['pi', 'e', 'sqrt2', 'sqrt3', 'phi', 'ln2', 'gamma', 'cbrt2']) {
    const k = CF.constant(key);
    const x = k.exact || k.lo;
    const r = CF.expandMode(key, 'ceil', 14);
    for (const c of CF.semiregularConvergents(r.terms, r.signs)) {
      XTests.ok(CF.Rat.cmp(CF.Rat.make(c.p, c.q), x) >= 0,
                `${key}: convergent ${c.p}/${c.q} fell below the target`);
    }
  }
```

And rewrite `'convergentRowsFor minus rows carry one-sided errors'` to use `'ceil'`:

```js
  const { rows } = CF.convergentRowsFor('pi', 8, 'ceil');
  XTests.eq(rows.map(r => `${r.p}/${r.q}`).join(' '),
            '4/1 7/2 10/3 13/4 16/5 19/6 22/7 355/113');
  for (const r of rows) XTests.ok(r.error.n <= 0n, `row ${r.n} had a positive error`);
```

and `'convergentRowsFor reproduces the regular rows'` to use `'floor'`:

```js
  const a = CF.convergentRows('pi', 6).rows.map(r => `${r.p}/${r.q}`).join(' ');
  const b = CF.convergentRowsFor('pi', 6, 'floor').rows.map(r => `${r.p}/${r.q}`).join(' ');
  XTests.eq(a, b);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.expandMode is not a function`.

- [ ] **Step 3: Implement expandMode and delete the old functions**

Add inside the `CF` IIFE:

```js
  const expandMode = (key, mode, maxTerms) => {
    const k = constant(key);
    if (k.exact) {
      const r = semiregularTerms(k.exact, k.exact, mode, maxTerms);
      return { ...r, source: 'exact' };
    }
    // Only the floor mode has an exact periodic generator, so only it can run past the
    // enclosure's precision. The other three report what 60 digits determine.
    if (mode === 'floor' && k.quad) {
      const r = quadraticTerms(k.quad.P, k.quad.Q, k.quad.D, maxTerms);
      return { terms: r.terms, signs: r.terms.slice(1).map(() => 1),
               stopReason: r.stopReason === 'periodic' ? 'periodic' : 'max-terms',
               source: 'quadratic' };
    }
    const r = semiregularTerms(k.lo, k.hi, mode, maxTerms);
    return { ...r, source: 'interval' };
  };
```

Replace the body of `convergentRowsFor` with:

```js
  const convergentRowsFor = (key, maxTerms, mode) => {
    const k = constant(key);
    const x = k.exact || k.lo;
    const e = expandMode(key, mode, maxTerms);
    const cs = semiregularConvergents(e.terms, e.signs);
    const rows = cs.map((c, i) => {
      const val = Rat.make(c.p, c.q);
      const error = Rat.sub(x, val);
      const abs = error.n < 0n ? Rat.neg(error) : error;
      return {
        n: i, a: e.terms[i], sign: i === 0 ? 1 : e.signs[i - 1],
        p: c.p, q: c.q,
        decimal: Rat.toDecimalString(val, 20),
        error, errorStr: sci(error, 5),
        errQ2: Rat.toDecimalString(Rat.mul(abs, Rat.fromInt(c.q * c.q)), 6),
      };
    });
    return { rows, stopReason: e.stopReason, source: e.source };
  };

  const convergentRows = (key, maxTerms) => convergentRowsFor(key, maxTerms, 'floor');
```

Delete the definitions of `termsExact`, `termsFromInterval`, `expand`, `minusTermsExact`,
`minusTermsFromInterval`, `minusConvergents` and `minusExpand`, and remove all seven names
from the IIFE's `return {...}`. Add `expandMode` in their place. Keep `convergents` — the
generalized tab's tests use it — and keep `quadraticTerms`.

Update the two remaining internal callers: `dissect` calls `convergents(terms)`, which
still exists and is correct for the all-`+1` case the geometry tab uses; `cascadeRows`
calls `convergentRowsFor`, unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 83 tests passed` (88 from Task 1, minus the five deleted).

If a test fails with `CF.expand is not a function`, a call site was missed — grep for it:

```bash
grep -n "CF\.expand(\|CF\.minus" /Users/neoneye/git/vibe-coding-lab/continued-fractions/index.html
```

Expected after the change: only `CF.expandMode(` matches.

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: retire the parallel regular and minus implementations

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Per-row cascade and the race across four modes

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: Task 2's `convergentRowsFor`, plus `CF.bestApproximations`,
  `CF.bestApproximationsAbove`, `CF.MAX_RACE_Q`.
- Produces:
  - `CF.cascadeRows(key, mode, maxRows)` — unchanged signature and row shape, but the
    bracket-vs-one-sided decision is made **per row** rather than from the mode.
  - `CF.raceKind(mode: string) -> 'above'|'any'` — `'above'` for `'ceil'`, `'any'` otherwise.

- [ ] **Step 1: Write the failing tests**

```js
XTests.test('raceKind restricts only the ceiling mode', () => {
  XTests.eq(CF.raceKind('ceil'), 'above');
  for (const m of ['floor', 'nearest', 'alt']) XTests.eq(CF.raceKind(m), 'any');
});

XTests.test('cascade rows in a mixed mode switch shape partway down', () => {
  // e in nearest mode has convergents above, above, below, below, above, above, below.
  const rows = CF.cascadeRows('e', 'nearest', 10);
  const kinds = new Set(rows.map(r => r.brackets));
  XTests.ok(kinds.has(true) && kinds.has(false),
            `expected both bracketing and one-sided rows, got ${[...kinds].join(',')}`);
});

XTests.test('cascade still brackets throughout in floor mode and never in ceil mode', () => {
  for (const r of CF.cascadeRows('pi', 'floor', 8)) XTests.ok(r.brackets, `floor row ${r.n}`);
  for (const r of CF.cascadeRows('pi', 'ceil', 8)) XTests.ok(!r.brackets, `ceil row ${r.n}`);
});

XTests.test('cascade rows stay nested and drawable in all four modes', () => {
  for (const m of CF.SEMI_MODES) {
    for (const key of ['pi', 'e', 'phi']) {
      const rows = CF.cascadeRows(key, m.key, 10);
      XTests.ok(rows.length > 0, `${key}/${m.key} produced no rows`);
      for (let i = 1; i < rows.length; i++) {
        XTests.ok(CF.Rat.cmp(rows[i].width, rows[i - 1].width) < 0,
                  `${key}/${m.key} row ${rows[i].n} was not narrower`);
      }
      for (const r of rows) {
        for (const pos of [r.loPos, r.hiPos, r.targetPos]) {
          XTests.ok(pos >= 0 && pos <= 1 && Number.isFinite(pos),
                    `${key}/${m.key} row ${r.n}: position ${pos} out of range`);
        }
      }
    }
  }
});

XTests.test('nearest convergents win their races, alternating ones need not', () => {
  // Nearest-integer convergents are a subset of the regular convergents, so they win.
  for (const row of CF.convergentRowsFor('pi', 8, 'nearest').rows) {
    if (row.q > BigInt(CF.MAX_RACE_Q) || row.q < 2n) continue;
    const best = CF.bestApproximations('pi', Number(row.q), 1)[0];
    XTests.eq(`${best.p}/${best.q}`, `${row.p}/${row.q}`, `nearest row n=${row.n}`);
  }
  // The alternating expansion yields 25/8, which 22/7 beats with a smaller denominator.
  const alt = CF.convergentRowsFor('pi', 4, 'alt').rows;
  XTests.eq(`${alt[1].p}/${alt[1].q}`, '25/8');
  const winner = CF.bestApproximations('pi', 8, 1)[0];
  XTests.eq(`${winner.p}/${winner.q}`, '22/7');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with `CF.raceKind is not a function`.

- [ ] **Step 3: Implement**

Add inside the `CF` IIFE:

```js
  const raceKind = (mode) => (mode === 'ceil' ? 'above' : 'any');
```

Replace the interval-choosing block inside `cascadeRows` — the `if (mode === 'minus') { … }
else { … }` — with a per-row decision:

```js
      // Decide per row, not per mode: if consecutive convergents straddle the target the
      // bracket between them is the informative interval; otherwise the interval from the
      // target to the newer convergent is. Mixed modes need both, sometimes in one cascade.
      let lo, hi, loLabel, hiLabel;
      const a = vals[n - 1], b = vals[n];
      const aAbove = Rat.cmp(a, x) > 0, bAbove = Rat.cmp(b, x) > 0;
      if (aAbove !== bAbove) {
        if (Rat.cmp(a, b) < 0) { lo = a; hi = b; loLabel = labels[n - 1]; hiLabel = labels[n]; }
        else { lo = b; hi = a; loLabel = labels[n]; hiLabel = labels[n - 1]; }
      } else if (bAbove) {
        lo = x; hi = b; loLabel = 'x'; hiLabel = labels[n];
      } else {
        lo = b; hi = x; loLabel = labels[n]; hiLabel = 'x';
      }
      if (Rat.cmp(hi, lo) <= 0) break;            // an exact hit: nothing left to draw
```

Extend the IIFE's `return {...}` with:

```js
           raceKind,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 88 tests passed`

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: per-row cascade shape and race selection by mode

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The four-way toggle in the UI

**Files:**
- Modify: `continued-fractions/index.html` (page script)

**Interfaces:**
- Consumes: `CF.SEMI_MODES`, `CF.raceKind`, `CF.convergentRowsFor`, `CF.cascadeRows`,
  `CF.bestApproximations`, `CF.bestApproximationsAbove`, plus the existing `el`,
  `fitCanvas`, `towerHTML`, `renderCascade`, `renderRace`.
- Produces: no new DOM ids; `#simple-mode` now renders four chips.

- [ ] **Step 1: Switch the state and the toggle to the four modes**

In the page script, change the `state.simple` initialiser:

```js
    simple: { key: 'pi', depth: 6, selected: null, mode: 'floor' },
```

Replace the `SIMPLE_MODES` constant with a use of the shared table, and render a note when
the selected mode carries one. Replace the block that builds `#simple-mode` inside
`renderSimple()` with:

```js
    el('simple-mode').innerHTML = CF.SEMI_MODES
      .map(m => `<button class="chip ${m.key === s.mode ? 'active' : ''}" data-mode="${m.key}"` +
                `${m.note ? ` title="${m.note}"` : ''}>${m.label}</button>`)
      .join('');
    el('simple-mode').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      s.mode = b.dataset.mode; s.selected = null; renderSimple();
    }));
```

and delete the now-unused `SIMPLE_MODES` definition.

- [ ] **Step 2: Make the tower, term list and status mode-aware for four modes**

Replace the `const minus = s.mode === 'minus';` line with:

```js
    const mode = CF.SEMI_MODES.find(m => m.key === s.mode);
    const signs = rows.map(r => r.sign);
```

Replace the tower and term-list block with:

```js
    el('simple-tower').innerHTML = `${k.label} = ` + towerHTML(terms, depth, signs);
    const allPlus = signs.slice(1, depth).every(v => v > 0);
    const open = allPlus ? '[' : '⟦', close = allPlus ? ']' : '⟧';
    el('simple-terms').textContent =
      `${open}${terms[0]}; ${terms.slice(1, depth).map((t, i) => (signs[i + 1] < 0 ? '−' : '') + t).join(', ')}` +
      `${depth < terms.length ? ', …' : ''}${close}`;
    el('simple-status').innerHTML = `${terms.length} terms — ${STOP_REASON[stopReason]}.` +
      (mode.note ? ` <em>${mode.label} is ${mode.note}.</em>` : '');
```

A leading `−` on a term marks the level whose numerator is `−1`, so the term list stays
readable in the mixed modes where a bracket convention alone cannot say which is which.

- [ ] **Step 3: Make the tower draw per-level signs**

Replace `towerHTML` with a version taking the sign array rather than a boolean:

```js
  // a0 + 1/(a1 + 1/(a2 + ...)), with each level's operator taken from that level's sign.
  function towerHTML(terms, depth, signs) {
    const opAt = (i) => (signs[i] < 0 ? ' − ' : ' + ');
    const build = (i) => {
      const a = String(terms[i]);
      if (i >= depth - 1) {
        return i + 1 < terms.length ? `${a}${opAt(i + 1)}<span class="muted">…</span>` : a;
      }
      return `${a}${opAt(i + 1)}<span class="frac"><span class="stack">` +
             `<span class="num">1</span><span class="den">${build(i + 1)}</span>` +
             `</span></span>`;
    };
    return build(0);
  }
```

- [ ] **Step 4: Point the race at the right search**

In `renderRace(rows)`, replace `const minus = s.mode === 'minus';` with:

```js
    const above = CF.raceKind(s.mode) === 'above';
```

and replace every remaining `minus` in that function with `above`. The one-sidedness
sentence stays attached to `above`, since it is a fact about ceiling-mode convergents.

- [ ] **Step 5: Let the cascade caption follow the rows**

In `renderCascade()`, replace the `const minus = s.mode === 'minus';` line and the caption
assignment with:

```js
    const bracketing = rows.filter(r => r.brackets).length;
    const target = CF.constant(s.key).label;
    el('simple-cascade-caption').textContent =
      'Each row zooms in further than the last. ' +
      (bracketing === rows.length
        ? `The two convergents land on opposite sides of ${target} and trap it between them, ` +
          'and every level tightens the trap inside the previous one.'
        : bracketing === 0
        ? `Every convergent sits on the same side of ${target} and marches onto it without ` +
          'ever crossing. Each bar runs from the target to the newest convergent.'
        : `${bracketing} of these ${rows.length} rows trap ${target} between two convergents; ` +
          'in the rest both convergents land on the same side, and the bar runs from the ' +
          'target to the newest one.') +
      ' Blue is below the target, orange above; the number on the left is the interval width.';
```

- [ ] **Step 6: Run the tests and smoke-test**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 88 tests passed`

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --enable-logging=stderr \
  "file://$PWD/continued-fractions/index.html" 2>&1 | grep -ci "uncaught"
```

Expected: 0.

- [ ] **Step 7: Look at all four modes**

```bash
cd /Users/neoneye/git/vibe-coding-lab && for MODE in floor nearest alt ceil; do
  SC="${TMPDIR:-/tmp}/cf_$MODE.html"
  sed "s|  document.querySelectorAll(.\.tab.).forEach(t => t.addEventListener|  setTimeout(()=>document.querySelector('#simple-mode .chip[data-mode=$MODE]').click(),0);\n  document.querySelectorAll('.tab').forEach(t => t.addEventListener|" \
    continued-fractions/index.html > "$SC"
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
    --virtual-time-budget=5000 --window-size=1000,1000 \
    --screenshot="${TMPDIR:-/tmp}/cf_$MODE.png" "file://$SC" 2>/dev/null
  echo "${TMPDIR:-/tmp}/cf_$MODE.png"
done
```

Read all four PNGs and confirm:
- **floor**: `[3; 7, 15, 1, 292, …]`, tower all `+`, cascade ticks alternating sides.
- **nearest**: `⟦3; 7, −16, −294, …⟧`, tower mixing `+` and `−`, fewer levels to reach 355/113.
- **alt**: `⟦3; −8, 1, −15, 293, …⟧`, tower strictly alternating `+ − + −`.
- **ceil**: `⟦4; −2, −2, −2, …⟧`, tower all `−`, cascade one-sided.

Also switch to `e` in nearest mode and confirm the cascade caption reports a mixed count
("N of these M rows trap e…") rather than claiming all or none.

Fix anything that does not match before committing.

- [ ] **Step 8: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: four-way rounding-rule toggle on the Simple tab

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Refresh the screenshot

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

Expected: a JPEG under 300 KB. Read it and confirm four mode chips are visible.

- [ ] **Step 2: Confirm the gallery needs no rebuild**

```bash
cd /Users/neoneye/git/vibe-coding-lab && python3 build_gallery.py >/dev/null && git diff --stat index.html
```

Expected: no change to `index.html`.

- [ ] **Step 3: Final test run**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 88 tests passed`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add continued-fractions/screenshot1.jpg
git commit -m "continued-fractions: refresh screenshot for the four-way mode toggle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
