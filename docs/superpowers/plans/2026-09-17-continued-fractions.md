# Continued Fractions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `continued-fractions/index.html`, a self-contained page with three tabs — simple continued fractions of famous constants, a generalized continued-fraction builder, and the square-dissection geometry — backed by exact BigInt arithmetic and a Node test suite.

**Architecture:** All mathematics lives in a single `<script id="shared-code">` block exposing a `CF` namespace and an `XTests` runner; `test.mjs` extracts that block with a regex and runs it in Node, so the maths is testable with no build step. The UI is plain DOM plus two canvases, reading from `CF` and never doing arithmetic of its own beyond drawing coordinates.

**Tech Stack:** Vanilla HTML/CSS/JS, `BigInt`, `<canvas>`, Node ≥ 18 for tests. No dependencies, no network access at runtime.

## Global Constraints

- One self-contained `continued-fractions/index.html`; must work opened from `file://` with no network.
- All displayed terms, convergents and error bounds computed in exact `BigInt` rational arithmetic. Doubles are permitted **only** for drawing coordinates and the pre-scan in Task 5.
- Never display a continued-fraction term that the stored precision does not determine. Every expansion carries a `stopReason` and the UI shows it.
- Constants are stored as decimal enclosures of at least 60 significant digits; interval width `10^-60`.
- Style follows `packing/index.html`: `--fg:#111; --muted:#666; --border:#ccc; --bg:#fff`, 14px system font, max-width container, thin-bordered tabs.
- Canvases are sized in device pixels using `devicePixelRatio`; never CSS-stretch a logical-size buffer.
- Tests run with `node continued-fractions/test.mjs` and must exit 0.
- Commit directly to `main`. Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Scaffold, test harness, and exact rationals

**Files:**
- Create: `continued-fractions/index.html`
- Create: `continued-fractions/test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `CF.Rat` with `{n: BigInt, d: BigInt}` values, `d > 0`, always reduced.
  - `Rat.make(n: BigInt, d: BigInt) -> Rat`
  - `Rat.fromInt(v: number|BigInt) -> Rat`
  - `Rat.fromDecimalString(s: string) -> Rat`
  - `Rat.add/sub/mul/div(a: Rat, b: Rat) -> Rat`, `Rat.neg(a) -> Rat`
  - `Rat.cmp(a: Rat, b: Rat) -> -1|0|1`, `Rat.isZero(a) -> boolean`
  - `Rat.floor(a: Rat) -> BigInt` (floor, not truncation)
  - `Rat.toDecimalString(a: Rat, digits: number) -> string` (truncated toward zero)
  - `Rat.toNumber(a: Rat) -> number`
  - `CF.bgcd(a: BigInt, b: BigInt) -> BigInt`, `CF.isqrt(n: BigInt) -> BigInt`
  - `XTests.test(name, fn)`, `XTests.eq(actual, expected, msg)`, `XTests.ok(cond, msg)`, `XTests.run() -> number`

- [ ] **Step 1: Create the HTML skeleton with an empty shared-code block**

Create `continued-fractions/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Continued Fractions</title>
<style>
  :root { --fg:#111; --muted:#666; --border:#ccc; --bg:#fff; --accent:#1a5fb4; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:var(--bg); color:var(--fg);
    font:14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .app { max-width: 960px; margin: 0 auto; padding: 20px; }
  h1 { font-size:18px; font-weight:600; margin:0 0 4px 0; }
  .sub { color:var(--muted); margin:0 0 16px 0; }
  .tabs { display:flex; border-bottom:1px solid var(--border); margin-bottom:16px; }
  .tab { padding:8px 16px; background:none; border:1px solid transparent; border-bottom:none;
    cursor:pointer; font:inherit; color:var(--muted); }
  .tab.active { color:var(--fg); border-color:var(--border); background:var(--bg);
    position:relative; top:1px; }
  .panel { display:none; } .panel.active { display:block; }
</style>
</head>
<body>
<div class="app">
  <h1>Continued Fractions</h1>
  <p class="sub">Exact expansions of famous constants, generalized fractions you build yourself, and the picture behind both.</p>
  <div class="tabs">
    <button class="tab active" data-panel="simple">Simple</button>
    <button class="tab" data-panel="general">Generalized</button>
    <button class="tab" data-panel="geometry">Geometry</button>
  </div>
  <div class="panel active" id="panel-simple"></div>
  <div class="panel" id="panel-general"></div>
  <div class="panel" id="panel-geometry"></div>
</div>

<script id="shared-code">
const XTests = (() => {
  const cases = [];
  const test = (name, fn) => cases.push([name, fn]);
  const eq = (a, b, msg) => {
    if (String(a) !== String(b)) throw new Error(`${msg || 'eq'}: expected ${b}, got ${a}`);
  };
  const ok = (c, msg) => { if (!c) throw new Error(msg || 'assertion failed'); };
  const run = () => {
    for (const [name, fn] of cases) {
      try { fn(); } catch (e) { throw new Error(`${name}: ${e.message}`); }
    }
    return cases.length;
  };
  return { test, eq, ok, run };
})();

const CF = (() => {
  return {};
})();
</script>

<script>
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('panel-' + t.dataset.panel).classList.add('active');
  }));
</script>
</body>
</html>
```

- [ ] **Step 2: Create the Node test runner**

Create `continued-fractions/test.mjs`:

```js
// Extracts the <script id="shared-code"> block from index.html and runs XTests in Node.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'index.html'), 'utf8');
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) { console.error('shared-code block not found'); process.exit(1); }
const fn = new Function(m[1] + '\nreturn XTests.run();');
try {
  const n = fn();
  console.log(`continued-fractions: ${n} tests passed`);
} catch (e) {
  console.error('continued-fractions: FAIL', e.message);
  process.exit(1);
}
```

- [ ] **Step 3: Write the failing Rat tests**

Append inside the `shared-code` block, after the `CF` definition:

```js
XTests.test('Rat reduces and normalizes sign', () => {
  const r = CF.Rat.make(6n, -4n);
  XTests.eq(r.n, -3n); XTests.eq(r.d, 2n);
  XTests.eq(CF.Rat.make(0n, 5n).d, 1n);
});

XTests.test('Rat arithmetic', () => {
  const { Rat } = CF;
  const a = Rat.make(1n, 3n), b = Rat.make(1n, 6n);
  XTests.eq(Rat.toDecimalString(Rat.add(a, b), 4), '0.5000');
  XTests.eq(Rat.toDecimalString(Rat.sub(a, b), 4), '0.1666');
  XTests.eq(Rat.toDecimalString(Rat.mul(a, b), 6), '0.055555');
  XTests.eq(Rat.toDecimalString(Rat.div(a, b), 4), '2.0000');
  XTests.eq(Rat.cmp(a, b), 1); XTests.eq(Rat.cmp(b, a), -1); XTests.eq(Rat.cmp(a, a), 0);
});

XTests.test('Rat.floor floors, does not truncate', () => {
  XTests.eq(CF.Rat.floor(CF.Rat.make(7n, 2n)), 3n);
  XTests.eq(CF.Rat.floor(CF.Rat.make(-7n, 2n)), -4n);
  XTests.eq(CF.Rat.floor(CF.Rat.make(-4n, 2n)), -2n);
});

XTests.test('Rat decimal round trip', () => {
  const r = CF.Rat.fromDecimalString('3.14159265358979');
  XTests.eq(CF.Rat.toDecimalString(r, 14), '3.14159265358979');
  XTests.eq(CF.Rat.toDecimalString(CF.Rat.neg(r), 5), '-3.14159');
  XTests.eq(CF.Rat.toDecimalString(CF.Rat.fromDecimalString('-0.25'), 3), '-0.250');
});

XTests.test('isqrt floors integer square roots', () => {
  XTests.eq(CF.isqrt(0n), 0n);
  XTests.eq(CF.isqrt(15n), 3n);
  XTests.eq(CF.isqrt(16n), 4n);
  XTests.eq(CF.isqrt(10n ** 40n), 10n ** 20n);
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL with a message containing `Cannot read properties of undefined` (CF.Rat is not defined yet).

- [ ] **Step 5: Implement Rat, bgcd and isqrt**

Replace the `const CF = (() => { return {}; })();` body with:

```js
const CF = (() => {
  const bgcd = (a, b) => {
    a = a < 0n ? -a : a; b = b < 0n ? -b : b;
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  };

  const isqrt = (n) => {
    if (n < 0n) throw new Error('isqrt of negative');
    if (n < 2n) return n;
    let x = n, y = (x + 1n) / 2n;
    while (y < x) { x = y; y = (x + n / x) / 2n; }
    return x;
  };

  const Rat = {
    make(n, d) {
      if (d === 0n) throw new Error('zero denominator');
      if (d < 0n) { n = -n; d = -d; }
      const g = bgcd(n, d) || 1n;
      return { n: n / g, d: d / g };
    },
    fromInt(v) { return { n: BigInt(v), d: 1n }; },
    fromDecimalString(s) {
      const t = String(s).trim();
      const neg = t.startsWith('-');
      const body = neg ? t.slice(1) : t;
      const [ip, fp = ''] = body.split('.');
      const n = BigInt((ip || '0') + fp);
      return Rat.make(neg ? -n : n, 10n ** BigInt(fp.length));
    },
    add(a, b) { return Rat.make(a.n * b.d + b.n * a.d, a.d * b.d); },
    sub(a, b) { return Rat.make(a.n * b.d - b.n * a.d, a.d * b.d); },
    mul(a, b) { return Rat.make(a.n * b.n, a.d * b.d); },
    div(a, b) { if (b.n === 0n) throw new Error('division by zero'); return Rat.make(a.n * b.d, a.d * b.n); },
    neg(a) { return { n: -a.n, d: a.d }; },
    isZero(a) { return a.n === 0n; },
    cmp(a, b) { const l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0; },
    floor(a) {
      let q = a.n / a.d;
      if (a.n % a.d !== 0n && a.n < 0n) q -= 1n;
      return q;
    },
    toDecimalString(a, digits) {
      const neg = a.n < 0n;
      let n = neg ? -a.n : a.n;
      const ip = n / a.d;
      let rem = n % a.d;
      let out = (neg ? '-' : '') + ip.toString();
      if (digits > 0) {
        let frac = '';
        for (let i = 0; i < digits; i++) {
          rem *= 10n;
          frac += (rem / a.d).toString();
          rem %= a.d;
        }
        out += '.' + frac;
      }
      return out;
    },
    toNumber(a) { return Number(Rat.toDecimalString(a, 20)); },
  };

  return { bgcd, isqrt, Rat };
})();
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 5 tests passed`

- [ ] **Step 7: Commit**

```bash
git add continued-fractions/index.html continued-fractions/test.mjs
git commit -m "continued-fractions: scaffold, Node test harness, exact BigInt rationals

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Constant enclosures, pinned against independent computation

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.isqrt` from Task 1.
- Produces:
  - `CF.CONSTANTS`: array of `{key, label, digits, exact?}` where `digits` is a ≥60-significant-digit decimal string and `exact` is a `Rat` when the value is rational (355/113 only). Keys in order: `pi, e, sqrt2, sqrt3, sqrt5, phi, ln2, gamma, cbrt2, r355_113`.
  - `CF.constant(key) -> {key, label, lo: Rat, hi: Rat, exact: Rat|null, quad: {P,Q,D}|null}` — `lo` is the stored decimal, `hi = lo + 10^-60`, `quad` set for `sqrt2/sqrt3/sqrt5/phi` as the parameters of `(P + √D)/Q`.
  - `CF.ratSqrt(n: BigInt, digits: number) -> Rat` — Newton iteration in exact rationals, result within `10^-digits`.
  - `CF.ratCbrt(n: BigInt, digits: number) -> Rat`
  - `CF.ratExp1(digits) -> Rat`, `CF.ratLn2(digits) -> Rat`, `CF.ratPiMachin(digits) -> Rat` — series to the stated accuracy.

- [ ] **Step 1: Write the failing pinning tests**

Append to the `shared-code` block:

```js
XTests.test('every constant carries at least 60 significant digits', () => {
  for (const c of CF.CONSTANTS) {
    const sig = c.digits.replace('-', '').replace('.', '').replace(/^0+/, '');
    XTests.ok(sig.length >= 60, `${c.key} has only ${sig.length} significant digits`);
  }
});

XTests.test('enclosure brackets the value', () => {
  for (const c of CF.CONSTANTS) {
    const k = CF.constant(c.key);
    XTests.eq(CF.Rat.cmp(k.lo, k.hi), -1, `${c.key} lo<hi`);
  }
});

XTests.test('sqrt digits agree with Newton iteration', () => {
  for (const [key, n] of [['sqrt2', 2n], ['sqrt3', 3n], ['sqrt5', 5n]]) {
    const ref = CF.ratSqrt(n, 70);
    XTests.eq(CF.Rat.toDecimalString(ref, 55), CF.Rat.toDecimalString(CF.constant(key).lo, 55), key);
  }
});

XTests.test('phi digits agree with (1+sqrt5)/2', () => {
  const ref = CF.Rat.div(CF.Rat.add(CF.Rat.fromInt(1), CF.ratSqrt(5n, 70)), CF.Rat.fromInt(2));
  XTests.eq(CF.Rat.toDecimalString(ref, 55), CF.Rat.toDecimalString(CF.constant('phi').lo, 55));
});

XTests.test('cbrt2 digits agree with Newton iteration', () => {
  XTests.eq(CF.Rat.toDecimalString(CF.ratCbrt(2n, 70), 55),
            CF.Rat.toDecimalString(CF.constant('cbrt2').lo, 55));
});

XTests.test('e digits agree with the series', () => {
  XTests.eq(CF.Rat.toDecimalString(CF.ratExp1(70), 55),
            CF.Rat.toDecimalString(CF.constant('e').lo, 55));
});

XTests.test('ln2 digits agree with the atanh series', () => {
  XTests.eq(CF.Rat.toDecimalString(CF.ratLn2(70), 55),
            CF.Rat.toDecimalString(CF.constant('ln2').lo, 55));
});

XTests.test('pi digits agree with Machin', () => {
  XTests.eq(CF.Rat.toDecimalString(CF.ratPiMachin(70), 55),
            CF.Rat.toDecimalString(CF.constant('pi').lo, 55));
});

XTests.test('355/113 is stored exactly', () => {
  const k = CF.constant('r355_113');
  XTests.ok(k.exact !== null, 'exact rational present');
  XTests.eq(k.exact.n, 355n); XTests.eq(k.exact.d, 113n);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL — `CF.CONSTANTS is not iterable` or similar.

- [ ] **Step 3: Implement the series helpers**

Add inside the `CF` IIFE, before the `return`:

```js
  // Newton: x <- (x + n/x)/2, truncated to `digits` decimals each round to keep terms small.
  const trunc = (r, digits) => {
    const s = 10n ** BigInt(digits);
    return Rat.make((r.n * s) / r.d, s);
  };

  const ratSqrt = (n, digits) => {
    let x = Rat.fromInt(isqrt(n * 10n ** 40n) / 10n ** 20n + 1n);
    const N = Rat.fromInt(n), two = Rat.fromInt(2);
    for (let i = 0; i < 200; i++) {
      const next = trunc(Rat.div(Rat.add(x, Rat.div(N, x)), two), digits + 10);
      if (Rat.cmp(next, x) === 0) break;
      x = next;
    }
    return trunc(x, digits);
  };

  const ratCbrt = (n, digits) => {
    let x = Rat.fromInt(2);
    const N = Rat.fromInt(n), two = Rat.fromInt(2), three = Rat.fromInt(3);
    for (let i = 0; i < 400; i++) {
      // x <- (2x + n/x^2)/3
      const next = trunc(Rat.div(Rat.add(Rat.mul(two, x), Rat.div(N, Rat.mul(x, x))), three), digits + 10);
      if (Rat.cmp(next, x) === 0) break;
      x = next;
    }
    return trunc(x, digits);
  };

  const ratExp1 = (digits) => {
    let sum = Rat.fromInt(0), term = Rat.fromInt(1);
    for (let k = 1; k <= 200; k++) {
      sum = Rat.add(sum, term);
      term = Rat.div(term, Rat.fromInt(k));
      if (Rat.cmp(term, Rat.make(1n, 10n ** BigInt(digits + 10))) < 0) { sum = Rat.add(sum, term); break; }
    }
    return trunc(sum, digits);
  };

  // ln 2 = 2 * atanh(1/3) = 2 * sum_{k>=0} (1/3)^(2k+1)/(2k+1)
  const ratLn2 = (digits) => {
    let sum = Rat.fromInt(0), pow = Rat.make(1n, 3n);
    const ninth = Rat.make(1n, 9n);
    for (let k = 0; k < 400; k++) {
      sum = Rat.add(sum, Rat.div(pow, Rat.fromInt(2 * k + 1)));
      pow = trunc(Rat.mul(pow, ninth), digits + 20);
      if (Rat.isZero(pow)) break;
    }
    return trunc(Rat.mul(Rat.fromInt(2), sum), digits);
  };

  // arctan(1/m) = sum_{k>=0} (-1)^k / ((2k+1) m^(2k+1))
  const ratArctanInv = (m, digits) => {
    let sum = Rat.fromInt(0), pow = Rat.make(1n, BigInt(m));
    const sq = Rat.make(1n, BigInt(m) * BigInt(m));
    for (let k = 0; k < 1000; k++) {
      const t = Rat.div(pow, Rat.fromInt(2 * k + 1));
      sum = k % 2 === 0 ? Rat.add(sum, t) : Rat.sub(sum, t);
      pow = trunc(Rat.mul(pow, sq), digits + 20);
      if (Rat.isZero(pow)) break;
    }
    return sum;
  };

  // pi = 16 arctan(1/5) - 4 arctan(1/239)
  const ratPiMachin = (digits) => trunc(Rat.sub(
    Rat.mul(Rat.fromInt(16), ratArctanInv(5, digits + 10)),
    Rat.mul(Rat.fromInt(4), ratArctanInv(239, digits + 10))), digits);
```

- [ ] **Step 4: Add the constant table**

Add inside the `CF` IIFE (digit strings below are 60+ significant digits; verify them by running the tests, which compare against the series above — if a digit is wrong the test fails and the correct value is printed in the error message):

```js
  const CONSTANTS = [
    { key: 'pi',       label: 'π',       digits: '3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798' },
    { key: 'e',        label: 'e',       digits: '2.71828182845904523536028747135266249775724709369995957496696762772407663035354759457138217852516642742' },
    { key: 'sqrt2',    label: '√2',      digits: '1.41421356237309504880168872420969807856967187537694806841250'  , quad: { P: 0n, Q: 1n, D: 2n } },
    { key: 'sqrt3',    label: '√3',      digits: '1.73205080756887729352744634150587236694280525381038062805580'  , quad: { P: 0n, Q: 1n, D: 3n } },
    { key: 'sqrt5',    label: '√5',      digits: '2.23606797749978969640917366873127623544061835961152572427089'  , quad: { P: 0n, Q: 1n, D: 5n } },
    { key: 'phi',      label: 'φ',       digits: '1.61803398874989484820458683436563811772030917980576286213544'  , quad: { P: 1n, Q: 2n, D: 5n } },
    { key: 'ln2',      label: 'ln 2',    digits: '0.693147180559945309417232121458176568075500134360255254120680' },
    { key: 'gamma',    label: 'γ',       digits: '0.577215664901532860606512090082402431042159335939923598805767' },
    { key: 'cbrt2',    label: '∛2',      digits: '1.25992104989487316476721060727822835057025146470150798008197'  },
    { key: 'r355_113', label: '355/113', digits: '3.14159292035398230088495575221238938053097345132743362831858', exactNum: 355n, exactDen: 113n },
  ];

  const EPS = Rat.make(1n, 10n ** 60n);

  const constant = (key) => {
    const c = CONSTANTS.find(x => x.key === key);
    if (!c) throw new Error('unknown constant ' + key);
    const lo = Rat.fromDecimalString(c.digits);
    const exact = c.exactNum !== undefined ? Rat.make(c.exactNum, c.exactDen) : null;
    return { key: c.key, label: c.label, lo, hi: Rat.add(lo, EPS), exact, quad: c.quad || null };
  };
```

Export `CONSTANTS, constant, ratSqrt, ratCbrt, ratExp1, ratLn2, ratArctanInv, ratPiMachin, trunc` from the IIFE alongside the Task 1 exports.

Note on the `√2/√3/√5/φ/∛2/ln2/γ` strings: they carry exactly 60 significant digits; π, e and 355/113 carry more, which is harmless. `EPS` is `10^-60`, which is a valid enclosure width for all of them because each string is truncated (never rounded up) — when transcribing, **truncate** rather than round the last digit, and the `enclosure brackets the value` plus the agreement tests will catch a mistake.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 14 tests passed`. If a digit-agreement test fails, the error message shows the reference value — copy the correct digits into the table and re-run.

- [ ] **Step 6: Add the γ cross-check test**

γ has no cheap series here, so it is pinned against an independently published source: its simple continued fraction, OEIS A002852, whose first terms are `0, 1, 1, 2, 1, 2, 1, 4, 3, 13, 5, 1, 1, 8, 1, 2, 4, 1, 1, 40`. That test is written in Task 3 once term extraction exists; add a placeholder comment here:

```js
// gamma's digits are cross-checked against OEIS A002852 in the term-extraction tests (Task 3).
```

- [ ] **Step 7: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: constant enclosures pinned against series computation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Term extraction with an honest cutoff

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.constant`, `CF.isqrt`.
- Produces:
  - `CF.termsExact(r: Rat, maxTerms: number) -> {terms: BigInt[], stopReason: 'exact'|'max-terms'}`
  - `CF.termsFromInterval(lo: Rat, hi: Rat, maxTerms) -> {terms: BigInt[], stopReason: 'precision-exhausted'|'max-terms'|'exact'}`
  - `CF.quadraticTerms(P: BigInt, Q: BigInt, D: BigInt, maxTerms) -> {terms: BigInt[], stopReason: 'periodic'|'max-terms', periodStart: number, periodLength: number|null}`
  - `CF.expand(key: string, maxTerms: number) -> {terms, stopReason, source: 'exact'|'interval'|'quadratic'}` — picks the best method for a constant: `exact` for rationals, `quadratic` when `quad` is present, `interval` otherwise.

- [ ] **Step 1: Write the failing term tests**

```js
XTests.test('rational expansion terminates', () => {
  const r = CF.expand('r355_113', 40);
  XTests.eq(r.terms.join(','), '3,7,16');
  XTests.eq(r.stopReason, 'exact');
});

XTests.test('quadratic irrationals are periodic', () => {
  XTests.eq(CF.expand('sqrt2', 8).terms.join(','), '1,2,2,2,2,2,2,2');
  XTests.eq(CF.expand('sqrt3', 8).terms.join(','), '1,1,2,1,2,1,2,1');
  XTests.eq(CF.expand('sqrt5', 5).terms.join(','), '2,4,4,4,4');
  XTests.eq(CF.expand('phi', 8).terms.join(','), '1,1,1,1,1,1,1,1');
  XTests.eq(CF.expand('sqrt2', 200).terms.length, 200, 'periodic generator runs past the enclosure');
});

XTests.test('pi terms match the known list', () => {
  const known = '3,7,15,1,292,1,1,1,2,1,3,1,14,2,1,1,2,2,2,2';
  XTests.eq(CF.expand('pi', 20).terms.join(','), known);
});

XTests.test('e terms follow the 2,4,6 pattern', () => {
  XTests.eq(CF.expand('e', 12).terms.join(','), '2,1,2,1,1,4,1,1,6,1,1,8');
});

XTests.test('gamma digits agree with OEIS A002852', () => {
  XTests.eq(CF.expand('gamma', 20).terms.join(','),
            '0,1,1,2,1,2,1,4,3,13,5,1,1,8,1,2,4,1,1,40');
});

XTests.test('cbrt2 and ln2 expand without error', () => {
  XTests.eq(CF.expand('cbrt2', 10).terms.join(','), '1,3,1,5,1,1,4,1,1,8');
  XTests.ok(CF.expand('ln2', 10).terms.length === 10);
});

XTests.test('a low-precision enclosure stops honestly', () => {
  const lo = CF.Rat.fromDecimalString('3.14159');
  const hi = CF.Rat.add(lo, CF.Rat.make(1n, 100000n));
  const r = CF.termsFromInterval(lo, hi, 50);
  XTests.eq(r.stopReason, 'precision-exhausted');
  XTests.ok(r.terms.length < 10, `expected a short expansion, got ${r.terms.length}`);
  XTests.eq(r.terms.slice(0, 4).join(','), '3,7,15,1');
});

XTests.test('interval expansion of pi agrees with the periodic-free path for many terms', () => {
  const k = CF.constant('pi');
  const r = CF.termsFromInterval(k.lo, k.hi, 200);
  XTests.eq(r.stopReason, 'precision-exhausted');
  XTests.ok(r.terms.length >= 30, `expected 30+ certain terms, got ${r.terms.length}`);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL — `CF.expand is not a function`.

- [ ] **Step 3: Implement the three extractors**

Add inside the `CF` IIFE:

```js
  const termsExact = (r, maxTerms) => {
    const terms = [];
    let x = r;
    for (let i = 0; i < maxTerms; i++) {
      const a = Rat.floor(x);
      terms.push(a);
      const frac = Rat.sub(x, Rat.fromInt(a));
      if (Rat.isZero(frac)) return { terms, stopReason: 'exact' };
      x = Rat.div(Rat.fromInt(1), frac);
    }
    return { terms, stopReason: 'max-terms' };
  };

  const termsFromInterval = (lo, hi, maxTerms) => {
    const terms = [];
    let a = lo, b = hi;
    for (let i = 0; i < maxTerms; i++) {
      const fa = Rat.floor(a), fb = Rat.floor(b);
      if (fa !== fb) return { terms, stopReason: 'precision-exhausted' };
      terms.push(fa);
      const ra = Rat.sub(a, Rat.fromInt(fa)), rb = Rat.sub(b, Rat.fromInt(fb));
      if (Rat.isZero(ra) || Rat.isZero(rb)) return { terms, stopReason: 'exact' };
      // x -> 1/(x - a) is decreasing, so the endpoints swap.
      a = Rat.div(Rat.fromInt(1), rb);
      b = Rat.div(Rat.fromInt(1), ra);
    }
    return { terms, stopReason: 'max-terms' };
  };

  // Terms of (P + sqrt(D)) / Q, D not a perfect square, Q | (D - P^2).
  const quadraticTerms = (P, Q, D, maxTerms) => {
    const s = isqrt(D);
    if (s * s === D) throw new Error('D must not be a perfect square');
    if ((D - P * P) % Q !== 0n) { P *= Q; D *= Q * Q; Q *= Q; }
    const terms = [];
    const seen = new Map();
    let p = P, q = Q, periodStart = null, periodLength = null;
    const sq = isqrt(D);
    for (let i = 0; i < maxTerms; i++) {
      const key = `${p}/${q}`;
      if (periodStart === null && seen.has(key)) {
        periodStart = seen.get(key);
        periodLength = i - periodStart;
      }
      if (!seen.has(key)) seen.set(key, i);
      const a = (p + sq) / q;   // p + sq and q stay positive for every constant shipped here
      terms.push(a);
      p = a * q - p;
      q = (D - p * p) / q;
    }
    return { terms, stopReason: periodLength ? 'periodic' : 'max-terms', periodStart, periodLength };
  };

  const expand = (key, maxTerms) => {
    const k = constant(key);
    if (k.exact) return { ...termsExact(k.exact, maxTerms), source: 'exact' };
    if (k.quad) {
      const r = quadraticTerms(k.quad.P, k.quad.Q, k.quad.D, maxTerms);
      return { terms: r.terms, stopReason: r.stopReason === 'periodic' ? 'periodic' : 'max-terms',
               source: 'quadratic', periodStart: r.periodStart, periodLength: r.periodLength };
    }
    return { ...termsFromInterval(k.lo, k.hi, maxTerms), source: 'interval' };
  };
```

Export `termsExact, termsFromInterval, quadraticTerms, expand`.

Note: `stopReason` for the quadratic path is `'periodic'`, which the UI renders as "periodic — terms repeat forever". Update the type comment in the Interfaces block accordingly.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 22 tests passed`

If `cbrt2`, `ln2` or `gamma` disagree, the stored digits are wrong — fix the digit string, not the test; the known term lists are the independent source.

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: term extraction with interval, exact and periodic paths

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Convergents and error metrics

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.expand`, `CF.constant`.
- Produces:
  - `CF.convergents(terms: BigInt[]) -> {p: BigInt, q: BigInt}[]`
  - `CF.convergentRows(key: string, maxTerms: number) -> {rows, stopReason, source}` where each row is
    `{n, a: BigInt, p: BigInt, q: BigInt, decimal: string, error: Rat, errorStr: string, errQ2: string}`.
    `error = x − p/q` using the enclosure `lo` as `x`; `errorStr` is scientific notation to 4 significant
    digits; `errQ2` is `|error|·q²` to 6 decimals.
  - `CF.sci(r: Rat, sig: number) -> string` — scientific notation of a rational, e.g. `-2.6676e-7`.

- [ ] **Step 1: Write the failing tests**

```js
XTests.test('convergents of pi include 22/7 and 355/113', () => {
  const c = CF.convergents(CF.expand('pi', 4).terms);
  XTests.eq(c.map(x => `${x.p}/${x.q}`).join(' '), '3/1 22/7 333/106 355/113');
});

XTests.test('convergents of phi are Fibonacci ratios', () => {
  const c = CF.convergents(CF.expand('phi', 7).terms);
  XTests.eq(c.map(x => `${x.p}/${x.q}`).join(' '), '1/1 2/1 3/2 5/3 8/5 13/8 21/13');
});

XTests.test('every convergent satisfies |x - p/q| q^2 < 1', () => {
  for (const key of ['pi', 'e', 'sqrt2', 'sqrt3', 'phi', 'ln2', 'gamma', 'cbrt2']) {
    const { rows } = CF.convergentRows(key, 20);
    for (const row of rows) {
      const abs = row.error.n < 0n ? CF.Rat.neg(row.error) : row.error;
      const v = CF.Rat.mul(abs, CF.Rat.fromInt(row.q * row.q));   // |x - p/q| * q^2
      XTests.ok(CF.Rat.cmp(v, CF.Rat.fromInt(1)) < 0, `${key} n=${row.n} errQ2=${row.errQ2}`);
    }
  }
});

XTests.test('errors alternate in sign', () => {
  const { rows } = CF.convergentRows('pi', 10);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].error.n, b = rows[i].error.n;
    XTests.ok((a > 0n) !== (b > 0n), `signs did not alternate at n=${i}`);
  }
});

XTests.test('355/113 error matches the known value', () => {
  const { rows } = CF.convergentRows('pi', 4);
  XTests.eq(rows[3].errorStr.slice(0, 7), '-2.6676');
});

XTests.test('sci formats rationals', () => {
  XTests.eq(CF.sci(CF.Rat.fromDecimalString('0.000123456'), 4), '1.234e-4');
  XTests.eq(CF.sci(CF.Rat.fromDecimalString('-12.5'), 3), '-1.25e+1');
  XTests.eq(CF.sci(CF.Rat.fromInt(0), 3), '0');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL — `CF.convergents is not a function`.

- [ ] **Step 3: Implement**

```js
  const convergents = (terms) => {
    let pm1 = 1n, pm2 = 0n, qm1 = 0n, qm2 = 1n;
    const out = [];
    for (const a of terms) {
      const p = a * pm1 + pm2, q = a * qm1 + qm2;
      out.push({ p, q });
      pm2 = pm1; pm1 = p; qm2 = qm1; qm1 = q;
    }
    return out;
  };

  const sci = (r, sig) => {
    if (Rat.isZero(r)) return '0';
    const neg = r.n < 0n;
    let a = neg ? Rat.neg(r) : r;
    let exp = 0;
    const ten = Rat.fromInt(10), one = Rat.fromInt(1);
    while (Rat.cmp(a, ten) >= 0) { a = Rat.div(a, ten); exp++; }
    while (Rat.cmp(a, one) < 0) { a = Rat.mul(a, ten); exp--; }
    const mant = Rat.toDecimalString(a, sig - 1);
    return `${neg ? '-' : ''}${mant}e${exp < 0 ? '-' : '+'}${Math.abs(exp)}`;
  };

  const convergentRows = (key, maxTerms) => {
    const k = constant(key);
    const x = k.exact || k.lo;
    const e = expand(key, maxTerms);
    const cs = convergents(e.terms);
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
```

Export `convergents, convergentRows, sci`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 28 tests passed`

Note: for `r355_113` the error at the last convergent is exactly 0, so the "errors alternate" test deliberately uses `pi` only. If the `|x−p/q|q² < 1` test trips for a constant whose expansion has run past its precision, reduce `maxTerms` in that test to the certain-term count rather than loosening the bound.

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: exact convergents with signed error and the 1/q^2 bound

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Best-approximation search

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.constant`, `CF.convergentRows`.
- Produces:
  - `CF.MAX_RACE_Q = 200000`
  - `CF.bestApproximations(key: string, Q: number, count: number) -> {p: BigInt, q: BigInt, errorStr: string, error: Rat}[]`
    — the `count` fractions with `q ≤ Q` closest to the constant, nearest first.
    Throws if `Q > CF.MAX_RACE_Q`.

- [ ] **Step 1: Write the failing tests**

```js
XTests.test('best approximations of pi with q<=113 are led by 355/113', () => {
  const best = CF.bestApproximations('pi', 113, 3);
  XTests.eq(`${best[0].p}/${best[0].q}`, '355/113');
  XTests.eq(`${best[1].p}/${best[1].q}`, '333/106');
});

XTests.test('every convergent of pi wins its own denominator race', () => {
  const { rows } = CF.convergentRows('pi', 12);
  for (const row of rows) {
    if (row.q > BigInt(CF.MAX_RACE_Q) || row.q < 2n) continue;
    const best = CF.bestApproximations('pi', Number(row.q), 1)[0];
    XTests.eq(`${best.p}/${best.q}`, `${row.p}/${row.q}`, `n=${row.n}`);
  }
});

XTests.test('the race refuses denominators it cannot search', () => {
  let threw = false;
  try { CF.bestApproximations('pi', CF.MAX_RACE_Q + 1, 1); } catch (e) { threw = true; }
  XTests.ok(threw, 'expected a throw for an oversized Q');
});

XTests.test('best approximations of phi are Fibonacci ratios', () => {
  const best = CF.bestApproximations('phi', 89, 2);
  XTests.eq(`${best[0].p}/${best[0].q}`, '144/89');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL — `CF.bestApproximations is not a function`.

- [ ] **Step 3: Implement the two-stage search**

```js
  const MAX_RACE_Q = 200000;

  const bestApproximations = (key, Q, count) => {
    if (Q > MAX_RACE_Q) throw new Error(`denominator ${Q} exceeds the searchable limit ${MAX_RACE_Q}`);
    const k = constant(key);
    const x = k.exact || k.lo;
    const xd = Rat.toNumber(x);
    // Stage 1: scan in doubles. The errors compared are of order 1/q^2 >= 2.5e-11 at Q = 2e5,
    // five orders of magnitude above double rounding noise, so the shortlist is safe.
    const shortlist = [];
    let worst = Infinity;
    for (let q = 1; q <= Q; q++) {
      const p = Math.round(xd * q);
      const err = Math.abs(xd - p / q);
      if (shortlist.length < 50 || err < worst) {
        shortlist.push({ p: BigInt(p), q: BigInt(q), err });
        shortlist.sort((a, b) => a.err - b.err);
        if (shortlist.length > 50) shortlist.pop();
        worst = shortlist[shortlist.length - 1].err;
      }
    }
    // Stage 2: re-rank the shortlist exactly.
    const exactRanked = shortlist.map(c => {
      const error = Rat.sub(x, Rat.make(c.p, c.q));
      const abs = error.n < 0n ? Rat.neg(error) : error;
      return { p: c.p, q: c.q, error, abs, errorStr: sci(error, 5) };
    }).sort((a, b) => Rat.cmp(a.abs, b.abs));
    return exactRanked.slice(0, count);
  };
```

Export `MAX_RACE_Q, bestApproximations`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 32 tests passed`. The `every convergent wins` test scans up to 200000 denominators a few times; it should finish in under 5 seconds.

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: best rational approximation race with exact re-ranking

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Generalized continued fractions

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.constant`, `CF.sci`.
- Produces:
  - `CF.primes(count: number) -> BigInt[]` — sieve.
  - `CF.SEQUENCES`: array of `{key, label, irrational: boolean, at(n: number) -> Rat}` with keys in this order:
    `one` (`1`), `n` (`n`), `n1` (`n+1`), `odd` (`2n−1`), `oddp` (`2n+1`), `n2` (`n²`),
    `odd2` (`(2n−1)²`), `prime` (`nth prime`), `prime2` (`(nth prime)²`),
    `pi` (`π`), `e` (`e`), `sqrt2` (`√2`), `k` (`k`, a user constant).
  - `CF.seq(key: string, k?: Rat) -> {key, label, irrational, at(n)}` — `k` supplies the constant for the `k` sequence.
  - `CF.MAX_GEN_TERMS_INT = 150`, `CF.MAX_GEN_TERMS_IRRATIONAL = 60`
  - `CF.genConvergents(opts) -> {values: Rat[], cap: number}` where
    `opts = {b0: Rat, aSeq, bSeq, negateA: boolean, terms: number}` and `values[i]` is the
    convergent after `i+1` levels. The term count is clamped to the cap implied by whether
    either sequence is irrational.
  - `CF.GEN_PRESETS`: array of `{key, label, b0, aKey, bKey, negateA, expect: string|null}` —
    `expect` is the key of the constant it converges to, or `null`.
  - `CF.GEN_SEQ_DIGITS = 30` — decimals kept for the π/e/√2 sequence entries.
  - `CF.identify(r: Rat, digits = 12) -> {label: string, matched: boolean}` — matches against
    `CF.NAMED_VALUES`, an array of `{label, value: Rat}` built from the enclosures
    (π, e, √2, √3, √5, φ, ln 2, γ, ∛2, π/2, π/4, 4/π, 2/π, π², π²/6, e−1, 1/e, e², ln 10,
    Catalan, ζ(3), 1+√2). Returns `{label: 'no match in the table', matched: false}` when nothing agrees.

- [ ] **Step 1: Write the failing tests**

```js
XTests.test('sieve produces primes', () => {
  XTests.eq(CF.primes(10).join(','), '2,3,5,7,11,13,17,19,23,29');
});

XTests.test('generalized recurrence reproduces a simple continued fraction', () => {
  // pi = 3 + 1/(7 + 1/(15 + 1/(1 + ...))) with all numerators 1
  const terms = CF.expand('pi', 4).terms;
  const aSeq = { at: () => CF.Rat.fromInt(1), irrational: false };
  const bSeq = { at: (n) => CF.Rat.fromInt(terms[n]), irrational: false };
  const { values } = CF.genConvergents({ b0: CF.Rat.fromInt(terms[0]), aSeq, bSeq, negateA: false, terms: 3 });
  XTests.eq(`${values[2].n}/${values[2].d}`, '355/113');
});

XTests.test('Brouncker converges to 4/pi', () => {
  const p = CF.GEN_PRESETS.find(x => x.key === 'brouncker');
  const { values } = CF.genConvergents({
    b0: p.b0, aSeq: CF.seq(p.aKey, p.kValue), bSeq: CF.seq(p.bKey, p.kValue),
    negateA: p.negateA, terms: 120 });
  const last = values[values.length - 1];
  const target = CF.Rat.div(CF.Rat.fromInt(4), CF.constant('pi').lo);
  const diff = CF.Rat.sub(last, target);
  const abs = diff.n < 0n ? CF.Rat.neg(diff) : diff;
  XTests.ok(CF.Rat.cmp(abs, CF.Rat.fromDecimalString('0.01')) < 0, `off by ${CF.sci(abs, 4)}`);
});

XTests.test('every preset converges to the constant it claims', () => {
  for (const p of CF.GEN_PRESETS) {
    if (!p.expect) continue;
    const { values } = CF.genConvergents({
      b0: p.b0, aSeq: CF.seq(p.aKey, p.kValue), bSeq: CF.seq(p.bKey, p.kValue),
      negateA: p.negateA, terms: 120 });
    const last = values[values.length - 1];
    // 5 digits, not more: the pi = 3 + 1^2/(6 + ...) form is only good to ~3e-7 after 120 levels.
    const id = CF.identify(last, 5);
    XTests.eq(id.label, CF.constant(p.expect).label, `preset ${p.key} identified as ${id.label}`);
  }
});

XTests.test('the e preset matches e to 8 digits', () => {
  const p = CF.GEN_PRESETS.find(x => x.key === 'e-ladder');
  const { values } = CF.genConvergents({
    b0: p.b0, aSeq: CF.seq(p.aKey, p.kValue), bSeq: CF.seq(p.bKey, p.kValue),
    negateA: false, terms: 25 });
  const last = values[values.length - 1];
  XTests.eq(CF.Rat.toDecimalString(last, 8), CF.Rat.toDecimalString(CF.constant('e').lo, 8));
});

XTests.test('irrational sequences are capped harder than integer ones', () => {
  const r1 = CF.genConvergents({ b0: CF.Rat.fromInt(1), aSeq: CF.seq('pi'), bSeq: CF.seq('n'),
    negateA: false, terms: 500 });
  XTests.eq(r1.cap, CF.MAX_GEN_TERMS_IRRATIONAL);
  XTests.eq(r1.values.length, CF.MAX_GEN_TERMS_IRRATIONAL);
  const r2 = CF.genConvergents({ b0: CF.Rat.fromInt(1), aSeq: CF.seq('prime'), bSeq: CF.seq('oddp'),
    negateA: false, terms: 500 });
  XTests.eq(r2.cap, CF.MAX_GEN_TERMS_INT);
});

XTests.test('identify matches known values and admits when it cannot', () => {
  XTests.eq(CF.identify(CF.constant('pi').lo).label, 'π');
  XTests.eq(CF.identify(CF.Rat.div(CF.Rat.fromInt(4), CF.constant('pi').lo)).label, '4/π');
  XTests.eq(CF.identify(CF.Rat.fromDecimalString('1.56639929860261')).matched, false);
});

XTests.test('the owner ideas produce finite values', () => {
  for (const [aKey, bKey] of [['prime', 'oddp'], ['pi', 'n'], ['e', 'n']]) {
    const { values } = CF.genConvergents({ b0: CF.Rat.fromInt(1), aSeq: CF.seq(aKey),
      bSeq: CF.seq(bKey), negateA: false, terms: 30 });
    const last = values[values.length - 1];
    XTests.ok(last.d !== 0n && Number.isFinite(CF.Rat.toNumber(last)), `${aKey}/${bKey} diverged`);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL — `CF.primes is not a function`.

- [ ] **Step 3: Implement sequences and the recurrence**

```js
  const primes = (count) => {
    const out = [];
    const limit = Math.max(20, Math.ceil(count * (Math.log(count + 2) + Math.log(Math.log(count + 2)) + 1)));
    const sieve = new Uint8Array(limit + 1);
    for (let i = 2; i <= limit && out.length < count; i++) {
      if (sieve[i]) continue;
      out.push(BigInt(i));
      for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
    }
    return out;
  };

  let PRIME_CACHE = primes(200);
  const primeAt = (n) => {
    if (n > PRIME_CACHE.length) PRIME_CACHE = primes(n * 2);
    return PRIME_CACHE[n - 1];
  };

  // Sequence values for the irrational entries are truncated to 30 decimals. The full 60-digit
  // enclosure would make the exact recurrence carry ~6000-digit numbers by level 60, which is slow
  // enough to stutter on a slider drag; 30 decimals is far beyond what the panel displays.
  const GEN_SEQ_DIGITS = 30;
  const constRat = (key) => trunc(constant(key).lo, GEN_SEQ_DIGITS);

  const SEQUENCES = [
    { key: 'one',    label: '1',            irrational: false, at: () => Rat.fromInt(1) },
    { key: 'n',      label: 'n',            irrational: false, at: (n) => Rat.fromInt(n) },
    { key: 'n1',     label: 'n + 1',        irrational: false, at: (n) => Rat.fromInt(n + 1) },
    { key: 'odd',    label: '2n − 1',       irrational: false, at: (n) => Rat.fromInt(2 * n - 1) },
    { key: 'oddp',   label: '2n + 1',       irrational: false, at: (n) => Rat.fromInt(2 * n + 1) },
    { key: 'n2',     label: 'n²',           irrational: false, at: (n) => Rat.fromInt(n * n) },
    { key: 'odd2',   label: '(2n − 1)²',    irrational: false, at: (n) => Rat.fromInt((2 * n - 1) ** 2) },
    { key: 'prime',  label: 'nth prime',    irrational: false, at: (n) => ({ n: primeAt(n), d: 1n }) },
    { key: 'prime2', label: '(nth prime)²', irrational: false, at: (n) => { const p = primeAt(n); return { n: p * p, d: 1n }; } },
    { key: 'pi',     label: 'π',            irrational: true,  at: () => constRat('pi') },
    { key: 'e',      label: 'e',            irrational: true,  at: () => constRat('e') },
    { key: 'sqrt2',  label: '√2',           irrational: true,  at: () => constRat('sqrt2') },
    { key: 'k',      label: 'k',            irrational: true,  at: () => Rat.fromInt(1) },
  ];

  const seq = (key, k) => {
    const s = SEQUENCES.find(x => x.key === key);
    if (!s) throw new Error('unknown sequence ' + key);
    if (key === 'k') {
      // An integer k keeps the higher term cap; only a fractional one is treated as irrational.
      const v = k || Rat.fromInt(1);
      return { key, label: 'k', irrational: v.d !== 1n, at: () => v };
    }
    return s;
  };

  const MAX_GEN_TERMS_INT = 150;
  const MAX_GEN_TERMS_IRRATIONAL = 60;

  const genConvergents = ({ b0, aSeq, bSeq, negateA, terms }) => {
    const cap = (aSeq.irrational || bSeq.irrational) ? MAX_GEN_TERMS_IRRATIONAL : MAX_GEN_TERMS_INT;
    const N = Math.min(terms, cap);
    let Am1 = Rat.fromInt(1), A0 = b0, Bm1 = Rat.fromInt(0), B0 = Rat.fromInt(1);
    const values = [];
    for (let n = 1; n <= N; n++) {
      let a = aSeq.at(n);
      if (negateA) a = Rat.neg(a);
      const b = bSeq.at(n);
      const A = Rat.add(Rat.mul(b, A0), Rat.mul(a, Am1));
      const B = Rat.add(Rat.mul(b, B0), Rat.mul(a, Bm1));
      Am1 = A0; A0 = A; Bm1 = B0; B0 = B;
      values.push(Rat.isZero(B0) ? Rat.fromInt(0) : Rat.div(A0, B0));
    }
    return { values, cap };
  };

  // Constant denominators (2 and 6) ride on the `k` sequence rather than getting
  // single-purpose menu entries; the UI sets the k input when a preset is loaded.
  const GEN_PRESETS = [
    { key: 'brouncker', label: 'Brouncker: 4/π = 1 + 1²/(2 + 3²/(2 + 5²/(2 + …)))',
      b0: Rat.fromInt(1), aKey: 'odd2', bKey: 'k', kValue: Rat.fromInt(2), negateA: false, expect: null },
    { key: 'pi-6', label: 'π = 3 + 1²/(6 + 3²/(6 + 5²/(6 + …)))',
      b0: Rat.fromInt(3), aKey: 'odd2', bKey: 'k', kValue: Rat.fromInt(6), negateA: false, expect: 'pi' },
    { key: 'e-ladder', label: 'e = 2 + 2/(2 + 3/(3 + 4/(4 + …)))',
      b0: Rat.fromInt(2), aKey: 'n1', bKey: 'n1', kValue: null, negateA: false, expect: 'e' },
    { key: 'sqrt2', label: '√2 = 1 + 1/(2 + 1/(2 + …))',
      b0: Rat.fromInt(1), aKey: 'one', bKey: 'k', kValue: Rat.fromInt(2), negateA: false, expect: 'sqrt2' },
  ];
```

Build sequences from a preset with `CF.seq(p.aKey, p.kValue)` / `CF.seq(p.bKey, p.kValue)`, as the tests
above do. Brouncker's `expect` is `null` because it converges to `4/π`, not to a shipped constant; the
`every preset converges` test skips it and the dedicated Brouncker test covers it.

- [ ] **Step 4: Implement identification**

```js
  const NAMED_VALUES = () => {
    const c = (k) => constant(k).lo;
    const R = Rat, i = Rat.fromInt;
    return [
      { label: 'π', value: c('pi') },
      { label: 'e', value: c('e') },
      { label: '√2', value: c('sqrt2') },
      { label: '√3', value: c('sqrt3') },
      { label: '√5', value: c('sqrt5') },
      { label: 'φ', value: c('phi') },
      { label: 'ln 2', value: c('ln2') },
      { label: 'γ', value: c('gamma') },
      { label: '∛2', value: c('cbrt2') },
      { label: 'π/2', value: R.div(c('pi'), i(2)) },
      { label: 'π/4', value: R.div(c('pi'), i(4)) },
      { label: '4/π', value: R.div(i(4), c('pi')) },
      { label: '2/π', value: R.div(i(2), c('pi')) },
      { label: 'π²', value: R.mul(c('pi'), c('pi')) },
      { label: 'π²/6', value: R.div(R.mul(c('pi'), c('pi')), i(6)) },
      { label: 'e − 1', value: R.sub(c('e'), i(1)) },
      { label: '1/e', value: R.div(i(1), c('e')) },
      { label: 'e²', value: R.mul(c('e'), c('e')) },
      { label: 'ln 10', value: Rat.fromDecimalString('2.302585092994045684017991454684364207601101488628772976033') },
      { label: "Catalan G", value: Rat.fromDecimalString('0.915965594177219015054603514932384110774149374281672134266') },
      { label: 'ζ(3)', value: Rat.fromDecimalString('1.202056903159594285399738161511449990764986292340498881792') },
      { label: '1 + √2', value: R.add(i(1), c('sqrt2')) },
    ];
  };

  let NAMED = null;
  // Compare with a tolerance, not by comparing truncated decimal strings: two values differing by
  // far less than 10^-digits still print differently when they straddle a digit boundary.
  const identify = (r, digits = 12) => {
    if (!NAMED) NAMED = NAMED_VALUES();
    const tol = Rat.make(1n, 10n ** BigInt(digits));
    for (const nv of NAMED) {
      const d = Rat.sub(r, nv.value);
      const abs = d.n < 0n ? Rat.neg(d) : d;
      if (Rat.cmp(abs, tol) < 0) return { label: nv.label, matched: true };
    }
    return { label: 'no match in the table', matched: false };
  };
```

Export `primes, SEQUENCES, seq, GEN_SEQ_DIGITS, MAX_GEN_TERMS_INT, MAX_GEN_TERMS_IRRATIONAL, genConvergents, GEN_PRESETS, identify`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 40 tests passed`

- [ ] **Step 6: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: generalized CF engine, sequence menu, presets, identification

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Square-dissection geometry

**Files:**
- Modify: `continued-fractions/index.html` (shared-code block)

**Interfaces:**
- Consumes: `CF.Rat`, `CF.expand`.
- Produces:
  - `CF.dissect(terms: BigInt[], maxSquares: number) -> {generations, truncated: boolean}` where each
    generation is `{index: number, count: number, side: Rat, squares: {x: Rat, y: Rat, side: Rat}[], rect: {x, y, w, h}}`.
    The starting rectangle is `w = x`, `h = 1`, origin at `(0,0)`, and each generation carves `count`
    squares of side `side` off the long edge of the remaining rectangle, alternating horizontal and
    vertical. `truncated` is true when `maxSquares` cut the drawing short.

- [ ] **Step 1: Write the failing tests**

```js
XTests.test('dissection square counts equal the continued fraction terms', () => {
  const terms = CF.expand('pi', 4).terms;         // 3, 7, 15, 1
  const d = CF.dissect(terms, 1000);
  XTests.eq(d.generations.map(g => g.count).join(','), '3,7,15,1');
});

XTests.test('dissection of a rational terminates on an exact square', () => {
  const terms = CF.expand('r355_113', 10).terms;  // 3, 7, 16
  const d = CF.dissect(terms, 1000);
  const last = d.generations[d.generations.length - 1];
  XTests.eq(CF.Rat.toDecimalString(CF.Rat.sub(last.rect.w, last.rect.h), 12), '0.000000000000');
});

XTests.test('the remainder after each generation is the reciprocal complete quotient', () => {
  const terms = CF.expand('sqrt2', 5).terms;
  const d = CF.dissect(terms, 1000);
  // After generation 0 the remaining rectangle has ratio 1/(x - a0) = 1 + sqrt2 for sqrt2.
  const g = d.generations[1];
  const ratio = CF.Rat.div(g.rect.w, g.rect.h);
  const flipped = CF.Rat.cmp(ratio, CF.Rat.fromInt(1)) < 0 ? CF.Rat.div(CF.Rat.fromInt(1), ratio) : ratio;
  XTests.eq(CF.Rat.toDecimalString(flipped, 6), '2.414213');
});

XTests.test('dissection respects the square budget', () => {
  const terms = CF.expand('phi', 40).terms;       // forty 1s
  const d = CF.dissect(terms, 10);
  XTests.ok(d.truncated, 'expected truncation');
  XTests.eq(d.generations.reduce((s, g) => s + g.count, 0), 10);
});

XTests.test('every square lies inside the starting rectangle', () => {
  const terms = CF.expand('pi', 6).terms;
  const d = CF.dissect(terms, 200);
  const x = CF.Rat.div(CF.Rat.fromInt(355), CF.Rat.fromInt(113));
  for (const g of d.generations) for (const s of g.squares) {
    XTests.ok(CF.Rat.cmp(CF.Rat.add(s.x, s.side), CF.Rat.add(x, CF.Rat.make(1n, 1000n))) <= 0, 'square escaped in x');
    XTests.ok(CF.Rat.cmp(CF.Rat.add(s.y, s.side), CF.Rat.fromDecimalString('1.001')) <= 0, 'square escaped in y');
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node continued-fractions/test.mjs`
Expected: FAIL — `CF.dissect is not a function`.

- [ ] **Step 3: Implement**

The rectangle starts `w/h = x` with `h = 1`. Generation 0 cuts `a₀` squares of side `h` off the left,
leaving a rectangle of width `w − a₀h` and height `h`, which is *taller* than wide; generation 1 then
cuts `a₁` squares of side `w − a₀h` off the bottom, and so on, alternating.

Reconstruct `x` from the terms rather than taking it as an argument, so the picture and the terms can
never disagree: evaluate the finite continued fraction `[a₀; a₁, …]` exactly with `CF.convergents`.

```js
  const dissect = (terms, maxSquares) => {
    const cs = convergents(terms);
    const last = cs[cs.length - 1];
    const x = Rat.make(last.p, last.q);
    let rect = { x: Rat.fromInt(0), y: Rat.fromInt(0), w: x, h: Rat.fromInt(1) };
    const generations = [];
    let budget = maxSquares, truncated = false;
    for (let i = 0; i < terms.length; i++) {
      const horizontal = Rat.cmp(rect.w, rect.h) >= 0;
      const side = horizontal ? rect.h : rect.w;
      if (Rat.isZero(side)) break;
      let count = Number(terms[i]);
      if (count > budget) { count = budget; truncated = true; }
      const squares = [];
      for (let j = 0; j < count; j++) {
        const off = Rat.mul(Rat.fromInt(j), side);
        squares.push(horizontal
          ? { x: Rat.add(rect.x, off), y: rect.y, side }
          : { x: rect.x, y: Rat.add(rect.y, off), side });
      }
      const consumed = Rat.mul(Rat.fromInt(count), side);
      const next = horizontal
        ? { x: Rat.add(rect.x, consumed), y: rect.y, w: Rat.sub(rect.w, consumed), h: rect.h }
        : { x: rect.x, y: Rat.add(rect.y, consumed), w: rect.w, h: Rat.sub(rect.h, consumed) };
      generations.push({ index: i, count, side, squares, rect });
      budget -= count;
      rect = next;
      if (budget <= 0) { truncated = truncated || i < terms.length - 1; break; }
      if (Rat.isZero(rect.w) || Rat.isZero(rect.h)) break;
    }
    return { generations, truncated };
  };
```

Export `dissect`.

Note on the third test: `generations[1].rect` is the rectangle *before* generation 1 cuts it, i.e. the
remainder after generation 0 — that is what the test asserts. If the implementation stores the post-cut
rectangle instead, the test will fail; keep `rect` as the pre-cut rectangle.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 45 tests passed`

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: square dissection derived from the terms themselves

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Simple tab UI

**Files:**
- Modify: `continued-fractions/index.html` (markup, styles, and the second `<script>` block)

**Interfaces:**
- Consumes: `CF.CONSTANTS`, `CF.constant`, `CF.expand`, `CF.convergentRows`, `CF.bestApproximations`, `CF.MAX_RACE_Q`.
- Produces: no new `CF` exports. DOM ids used later: `#simple-chips`, `#simple-depth`, `#simple-tower`, `#simple-terms`, `#simple-status`, `#simple-table`, `#simple-race`.

- [ ] **Step 1: Add the markup and styles**

Replace `<div class="panel active" id="panel-simple"></div>` with:

```html
  <div class="panel active" id="panel-simple">
    <div class="chips" id="simple-chips"></div>
    <div class="controls">
      <label>Depth <input type="range" id="simple-depth" min="1" max="30" value="6"></label>
      <span id="simple-depth-label" class="muted"></span>
    </div>
    <div class="tower" id="simple-tower"></div>
    <div class="terms" id="simple-terms"></div>
    <p class="status" id="simple-status"></p>
    <div class="tablewrap"><table id="simple-table"></table></div>
    <div id="simple-race"></div>
  </div>
```

Add to the stylesheet:

```css
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
  .chip { padding:5px 12px; border:1px solid var(--border); background:var(--bg); cursor:pointer;
    font:inherit; border-radius:3px; }
  .chip.active { border-color:var(--accent); color:var(--accent); font-weight:600; }
  .controls { display:flex; flex-wrap:wrap; gap:12px 20px; align-items:center; padding:8px 0; }
  .muted { color:var(--muted); }
  .status { color:var(--muted); margin:8px 0 12px 0; }
  .terms { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; margin:12px 0;
    word-break:break-word; }
  .tower { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; margin:12px 0 4px 0; }
  .frac { display:inline-flex; align-items:center; gap:6px; vertical-align:middle; }
  .frac .stack { display:inline-flex; flex-direction:column; align-items:center; }
  .frac .num { padding:0 6px; }
  .frac .den { padding:0 6px; border-top:1px solid var(--fg); }
  .tablewrap { overflow-x:auto; }
  table { border-collapse:collapse; font-size:13px; width:100%; }
  th, td { border-bottom:1px solid var(--border); padding:5px 10px; text-align:right;
    white-space:nowrap; font-variant-numeric:tabular-nums; }
  th { text-align:right; color:var(--muted); font-weight:600; }
  tr.clickable { cursor:pointer; }
  tr.clickable:hover td { background:#f4f7fb; }
  tr.selected td { background:#eaf1fb; }
  .mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }
```

- [ ] **Step 2: Render the chips, tower, terms and status**

In the page script (the non-shared `<script>`), add:

```js
  const state = { simple: { key: 'pi', depth: 6, selected: null } };
  const el = (id) => document.getElementById(id);

  function elide(s, max = 18) {
    return s.length <= max ? s : s.slice(0, 8) + '…' + s.slice(-8);
  }

  // Nested fraction tower: a0 + 1/(a1 + 1/(a2 + ...))
  function towerHTML(terms, depth, numerators) {
    const build = (i) => {
      if (i >= Math.min(depth, terms.length)) return '<span class="muted">…</span>';
      const a = String(terms[i]);
      if (i === Math.min(depth, terms.length) - 1) return a;
      const num = numerators ? String(numerators[i + 1]) : '1';
      return `${a} + <span class="frac"><span class="stack">` +
             `<span class="num">${num}</span><span class="den">${build(i + 1)}</span>` +
             `</span></span>`;
    };
    return build(0);
  }

  function renderSimple() {
    const s = state.simple;
    const k = CF.constant(s.key);
    const maxTerms = 40;
    const { rows, stopReason, source } = CF.convergentRows(s.key, maxTerms);
    const terms = rows.map(r => r.a);

    el('simple-chips').innerHTML = CF.CONSTANTS
      .map(c => `<button class="chip ${c.key === s.key ? 'active' : ''}" data-key="${c.key}">${c.label}</button>`)
      .join('');
    el('simple-chips').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      s.key = b.dataset.key; s.selected = null; renderSimple();
    }));

    const depth = Math.min(s.depth, terms.length);
    el('simple-depth').max = String(Math.min(30, terms.length));
    el('simple-depth-label').textContent = `${depth} of ${terms.length} terms`;
    el('simple-tower').innerHTML = `${k.label} = ` + towerHTML(terms, depth, null);
    el('simple-terms').textContent =
      `[${terms[0]}; ${terms.slice(1, depth).join(', ')}${depth < terms.length ? ', …' : ''}]`;

    const reason = {
      exact: 'the value is rational, so the expansion terminates — these are all the terms there are',
      periodic: 'a quadratic irrational: the terms repeat forever, so any number of them is exact',
      'precision-exhausted': `${terms.length} terms is everything the stored 60 digits determine; the next term is genuinely unknown to this page`,
      'max-terms': `stopped at the display limit of ${maxTerms} terms`,
    }[stopReason];
    el('simple-status').textContent = `${terms.length} terms — ${reason}.`;
    renderSimpleTable(rows);
    renderRace();
  }
```

- [ ] **Step 3: Render the convergent table**

```js
  function renderSimpleTable(rows) {
    const head = `<tr><th>n</th><th>aₙ</th><th>pₙ / qₙ</th><th>decimal</th>` +
                 `<th>x − pₙ/qₙ</th><th>|error| · qₙ²</th></tr>`;
    const body = rows.map(r => {
      const frac = `<span title="${r.p}/${r.q}">${elide(String(r.p))}/${elide(String(r.q))}</span>`;
      const sel = state.simple.selected === r.n ? ' selected' : '';
      return `<tr class="clickable${sel}" data-n="${r.n}"><td>${r.n}</td><td>${r.a}</td>` +
             `<td class="mono">${frac}</td><td class="mono">${r.decimal.slice(0, 16)}</td>` +
             `<td class="mono">${r.errorStr}</td><td class="mono">${r.errQ2}</td></tr>`;
    }).join('');
    el('simple-table').innerHTML = head + body;
    el('simple-table').querySelectorAll('tr.clickable').forEach(tr =>
      tr.addEventListener('click', () => { state.simple.selected = Number(tr.dataset.n); renderSimple(); }));
  }
```

- [ ] **Step 4: Render the best-approximation race**

```js
  function renderRace() {
    const s = state.simple;
    const box = el('simple-race');
    if (s.selected === null) {
      box.innerHTML = `<p class="status">Click a row to race its convergent against every fraction with a denominator that small.</p>`;
      return;
    }
    const { rows } = CF.convergentRows(s.key, 40);
    const row = rows[s.selected];
    const Q = row.q;
    if (Q > BigInt(CF.MAX_RACE_Q)) {
      box.innerHTML = `<p class="status">q = ${row.q} is too large to search exhaustively ` +
        `(the limit is ${CF.MAX_RACE_Q.toLocaleString()}). This page will not claim a search it did not run.</p>`;
      return;
    }
    const best = CF.bestApproximations(s.key, Number(Q), 5);
    const winner = `${best[0].p}/${best[0].q}` === `${row.p}/${row.q}`;
    const list = best.map((b, i) => {
      const isRow = `${b.p}/${b.q}` === `${row.p}/${row.q}`;
      return `<tr class="${isRow ? 'selected' : ''}"><td>${i + 1}</td>` +
             `<td class="mono">${b.p}/${b.q}</td><td class="mono">${b.errorStr}</td></tr>`;
    }).join('');
    box.innerHTML =
      `<p class="status">Every fraction with q ≤ ${Q} checked. ` +
      (winner
        ? `The convergent ${row.p}/${row.q} is the closest of them all.`
        : `The convergent ${row.p}/${row.q} did <strong>not</strong> win — worth investigating.`) +
      `</p><div class="tablewrap"><table><tr><th>rank</th><th>p/q</th><th>x − p/q</th></tr>${list}</table></div>`;
  }
```

- [ ] **Step 5: Wire the depth slider and initial render**

```js
  el('simple-depth').addEventListener('input', (e) => {
    state.simple.depth = Number(e.target.value);
    renderSimple();
  });
  renderSimple();
```

- [ ] **Step 6: Smoke-test in headless Chrome**

Run:

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=4000 --dump-dom \
  "file://$PWD/continued-fractions/index.html" 2>/dev/null | grep -c "355/113"
```

Expected: a count of at least 1 — the π page renders 355/113 in the table.

Then check for console errors:

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=4000 --enable-logging=stderr \
  "file://$PWD/continued-fractions/index.html" 2>&1 | grep -i "error\|uncaught" | head
```

Expected: no `Uncaught` lines.

- [ ] **Step 7: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: simple tab with fraction tower, convergents and the approximation race

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Generalized tab UI

**Files:**
- Modify: `continued-fractions/index.html`

**Interfaces:**
- Consumes: `CF.SEQUENCES`, `CF.seq`, `CF.genConvergents`, `CF.GEN_PRESETS`, `CF.identify`, `CF.Rat`, `CF.sci`.
- Produces: DOM ids `#gen-presets`, `#gen-b0`, `#gen-a`, `#gen-b`, `#gen-k`, `#gen-negate`, `#gen-terms`, `#gen-tower`, `#gen-status`, `#gen-table`, `#gen-plot`, `#gen-identify`.

- [ ] **Step 1: Add the markup**

```html
  <div class="panel" id="panel-general">
    <div class="chips" id="gen-presets"></div>
    <div class="controls">
      <label>b₀ <input type="number" id="gen-b0" value="1" step="1" style="width:70px"></label>
      <label>aₙ = <select id="gen-a"></select></label>
      <label>bₙ = <select id="gen-b"></select></label>
      <label>k = <input type="number" id="gen-k" value="2" step="1" style="width:70px"></label>
      <label><input type="checkbox" id="gen-negate"> negate aₙ</label>
      <label>terms <input type="range" id="gen-terms" min="2" max="60" value="12"></label>
      <span class="muted" id="gen-terms-label"></span>
    </div>
    <div class="tower" id="gen-tower"></div>
    <p class="status" id="gen-status"></p>
    <p id="gen-identify"></p>
    <div class="twocol">
      <div class="tablewrap"><table id="gen-table"></table></div>
      <canvas id="gen-plot" width="420" height="260"></canvas>
    </div>
  </div>
```

Add to the stylesheet:

```css
  .twocol { display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start; }
  .twocol > * { flex:1 1 320px; min-width:0; }
  canvas { border:1px solid var(--border); max-width:100%; }
  .verdict { padding:8px 12px; border-left:3px solid var(--accent); background:#f4f7fb; }
```

- [ ] **Step 2: Render the builder and the tower**

```js
  state.general = { b0: 1, aKey: 'odd2', bKey: 'k', k: 2, negate: false, terms: 12 };

  function genSeqs() {
    const g = state.general;
    const kRat = CF.Rat.fromDecimalString(String(g.k || 1));
    return { a: CF.seq(g.aKey, kRat), b: CF.seq(g.bKey, kRat) };
  }

  // Level n of the tower is aₙ over (bₙ + level n+1); b₀ sits outside the whole stack.
  function genTowerHTML(g, seqs, depth) {
    const fmt = (r, irr) => CF.Rat.toDecimalString(r, irr ? 4 : 0);
    const level = (n) => {
      if (n > depth) return '<span class="muted">…</span>';
      const num = (g.negate ? '−' : '') + fmt(seqs.a.at(n), seqs.a.irrational);
      const den = `${fmt(seqs.b.at(n), seqs.b.irrational)} + ${level(n + 1)}`;
      return `<span class="frac"><span class="stack"><span class="num">${num}</span>` +
             `<span class="den">${den}</span></span></span>`;
    };
    // At the deepest level the trailing "+ …" is dropped by level()'s guard.
    return `${g.b0} + ${level(1)}`;
  }
```

- [ ] **Step 3: Render the table, identification and status**

```js
  function renderGeneral() {
    const g = state.general;
    const seqs = genSeqs();

    el('gen-a').innerHTML = CF.SEQUENCES.map(s =>
      `<option value="${s.key}" ${s.key === g.aKey ? 'selected' : ''}>${s.label}</option>`).join('');
    el('gen-b').innerHTML = CF.SEQUENCES.map(s =>
      `<option value="${s.key}" ${s.key === g.bKey ? 'selected' : ''}>${s.label}</option>`).join('');
    el('gen-presets').innerHTML = CF.GEN_PRESETS.map(p =>
      `<button class="chip" data-key="${p.key}">${p.label}</button>`).join('');
    el('gen-presets').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      const p = CF.GEN_PRESETS.find(x => x.key === b.dataset.key);
      g.b0 = Number(CF.Rat.toDecimalString(p.b0, 0));
      g.aKey = p.aKey; g.bKey = p.bKey; g.negate = p.negateA;
      if (p.kValue) g.k = Number(CF.Rat.toDecimalString(p.kValue, 0));
      el('gen-b0').value = g.b0; el('gen-k').value = g.k; el('gen-negate').checked = g.negate;
      renderGeneral();
    }));

    const { values, cap } = CF.genConvergents({
      b0: CF.Rat.fromDecimalString(String(g.b0)), aSeq: seqs.a, bSeq: seqs.b,
      negateA: g.negate, terms: g.terms });

    el('gen-terms').max = String(cap);
    el('gen-terms-label').textContent = `${values.length} levels (cap ${cap}` +
      `${cap === CF.MAX_GEN_TERMS_IRRATIONAL ? ', lowered because a sequence is irrational' : ''})`;
    el('gen-tower').innerHTML = genTowerHTML(g, seqs, Math.min(4, values.length));

    const rows = values.map((v, i) => {
      const prev = i > 0 ? values[i - 1] : null;
      const d = prev ? CF.Rat.sub(v, prev) : null;
      const abs = d && (d.n < 0n ? CF.Rat.neg(d) : d);
      return { n: i + 1, decimal: CF.Rat.toDecimalString(v, 14),
               step: abs ? CF.sci(abs, 4) : '—', absRat: abs };
    });
    el('gen-table').innerHTML =
      `<tr><th>level</th><th>value</th><th>|xₙ − xₙ₋₁|</th></tr>` +
      rows.map(r => `<tr><td>${r.n}</td><td class="mono">${r.decimal}</td>` +
                    `<td class="mono">${r.step}</td></tr>`).join('');

    const last = values[values.length - 1];
    const id = CF.identify(last, 10);
    const note = (seqs.a.irrational || seqs.b.irrational)
      ? ` Computed from the irrational sequence value to ${CF.GEN_SEQ_DIGITS} decimals — exact for that approximation, not for the constant itself.`
      : ' Computed in exact integer arithmetic.';
    el('gen-identify').innerHTML =
      `<span class="verdict">Value after ${values.length} levels: ` +
      `<strong class="mono">${CF.Rat.toDecimalString(last, 14)}</strong> — ` +
      (id.matched ? `matches <strong>${id.label}</strong> to 10 digits.` : `${id.label}.`) +
      note + `</span>`;

    drawGenPlot(rows);
  }
```

- [ ] **Step 4: Draw the convergence plot**

```js
  function fitCanvas(canvas, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function drawGenPlot(rows) {
    const W = 420, H = 260, pad = 36;
    const ctx = fitCanvas(el('gen-plot'), W, H);
    ctx.clearRect(0, 0, W, H);
    const pts = rows.filter(r => r.absRat && !CF.Rat.isZero(r.absRat))
      .map(r => ({ n: r.n, y: Math.log10(CF.Rat.toNumber(r.absRat)) }));
    ctx.strokeStyle = '#ccc'; ctx.strokeRect(pad, 10, W - pad - 10, H - pad - 10);
    ctx.fillStyle = '#666'; ctx.font = '11px sans-serif';
    ctx.fillText('log₁₀ |xₙ − xₙ₋₁|', pad + 4, 22);
    if (!pts.length) { ctx.fillText('nothing to plot', pad + 4, H / 2); return; }
    const yMin = Math.min(...pts.map(p => p.y)), yMax = Math.max(...pts.map(p => p.y));
    const span = Math.max(1e-9, yMax - yMin);
    const X = (n) => pad + (n - 1) / Math.max(1, pts.length - 1) * (W - pad - 10 - 4);
    const Y = (y) => (H - pad) - (y - yMin) / span * (H - pad - 20);
    ctx.fillText(yMax.toFixed(1), 4, Y(yMax) + 4);
    ctx.fillText(yMin.toFixed(1), 4, Y(yMin) + 4);
    ctx.fillText('level', W / 2 - 14, H - 8);
    ctx.strokeStyle = '#1a5fb4'; ctx.lineWidth = 1.5; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(p.n), Y(p.y)) : ctx.moveTo(X(p.n), Y(p.y))));
    ctx.stroke();
    ctx.fillStyle = '#1a5fb4';
    pts.forEach(p => ctx.fillRect(X(p.n) - 1.5, Y(p.y) - 1.5, 3, 3));
  }
```

- [ ] **Step 5: Wire the controls**

```js
  el('gen-b0').addEventListener('input', e => { state.general.b0 = Number(e.target.value); renderGeneral(); });
  el('gen-k').addEventListener('input', e => { state.general.k = Number(e.target.value); renderGeneral(); });
  el('gen-a').addEventListener('change', e => { state.general.aKey = e.target.value; renderGeneral(); });
  el('gen-b').addEventListener('change', e => { state.general.bKey = e.target.value; renderGeneral(); });
  el('gen-negate').addEventListener('change', e => { state.general.negate = e.target.checked; renderGeneral(); });
  el('gen-terms').addEventListener('input', e => { state.general.terms = Number(e.target.value); renderGeneral(); });
  renderGeneral();
```

- [ ] **Step 6: Smoke-test in headless Chrome**

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=4000 --dump-dom \
  "file://$PWD/continued-fractions/index.html" 2>/dev/null | grep -c "nth prime"
```

Expected: at least 2 (the aₙ and bₙ menus both list it).

- [ ] **Step 7: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: generalized tab with sequence menus, presets and convergence plot

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Geometry tab UI

**Files:**
- Modify: `continued-fractions/index.html`

**Interfaces:**
- Consumes: `CF.CONSTANTS`, `CF.expand`, `CF.dissect`, `CF.Rat`, and `fitCanvas` from Task 9.
- Produces: DOM ids `#geo-chips`, `#geo-depth`, `#geo-zoom`, `#geo-canvas`, `#geo-status`.

- [ ] **Step 1: Add the markup**

```html
  <div class="panel" id="panel-geometry">
    <div class="chips" id="geo-chips"></div>
    <div class="controls">
      <label>generations <input type="range" id="geo-depth" min="1" max="12" value="4"></label>
      <label>zoom to generation <input type="range" id="geo-zoom" min="0" max="8" value="0"></label>
      <span class="muted" id="geo-labels"></span>
    </div>
    <canvas id="geo-canvas" width="900" height="420"></canvas>
    <p class="status" id="geo-status"></p>
  </div>
```

- [ ] **Step 2: Draw the dissection**

```js
  state.geometry = { key: 'pi', depth: 4, zoom: 0 };

  const GEN_COLORS = ['#1a5fb4', '#c64600', '#2d7d46', '#7a4fbf', '#b5830c',
                      '#0b6e7a', '#a0355f', '#4a5568', '#8b5a2b', '#3b7d3b',
                      '#6d28d9', '#166534'];

  function renderGeometry() {
    const g = state.geometry;
    el('geo-chips').innerHTML = CF.CONSTANTS
      .map(c => `<button class="chip ${c.key === g.key ? 'active' : ''}" data-key="${c.key}">${c.label}</button>`)
      .join('');
    el('geo-chips').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      g.key = b.dataset.key; g.zoom = 0; el('geo-zoom').value = '0'; renderGeometry();
    }));

    const e = CF.expand(g.key, 20);
    const d = CF.dissect(e.terms.slice(0, g.depth), 400);
    const zoom = Math.min(g.zoom, Math.max(0, d.generations.length - 1));
    el('geo-zoom').max = String(Math.max(0, d.generations.length - 1));

    const W = 900, H = 420, pad = 20;
    const ctx = fitCanvas(el('geo-canvas'), W, H);
    ctx.clearRect(0, 0, W, H);

    // The view is the pre-cut rectangle of the zoom generation, in continued-fraction coordinates.
    const view = d.generations[zoom].rect;
    const vx = CF.Rat.toNumber(view.x), vy = CF.Rat.toNumber(view.y);
    const vw = CF.Rat.toNumber(view.w), vh = CF.Rat.toNumber(view.h);
    const scale = Math.min((W - 2 * pad) / vw, (H - 2 * pad) / vh);
    const ox = pad + ((W - 2 * pad) - vw * scale) / 2;
    const oy = pad + ((H - 2 * pad) - vh * scale) / 2;
    const PX = (x) => ox + (x - vx) * scale;
    const PY = (y) => oy + (y - vy) * scale;

    for (const gen of d.generations) {
      const color = GEN_COLORS[gen.index % GEN_COLORS.length];
      ctx.strokeStyle = color;
      ctx.fillStyle = color + '22';
      ctx.lineWidth = 1;
      for (const s of gen.squares) {
        const x = PX(CF.Rat.toNumber(s.x)), y = PY(CF.Rat.toNumber(s.y));
        const side = CF.Rat.toNumber(s.side) * scale;
        if (side < 0.4) continue;                   // below a pixel: nothing honest to draw
        ctx.fillRect(x, y, side, side);
        ctx.strokeRect(x, y, side, side);
      }
      const first = gen.squares[0];
      if (first) {
        const side = CF.Rat.toNumber(first.side) * scale;
        if (side > 22) {
          ctx.fillStyle = color;
          ctx.font = '12px sans-serif';
          ctx.fillText(`a${gen.index} = ${gen.count}`,
            PX(CF.Rat.toNumber(first.x)) + 5, PY(CF.Rat.toNumber(first.y)) + 16);
        }
      }
    }

    const labels = d.generations.map(x => `a${x.index}=${x.count}`).join('  ');
    el('geo-labels').textContent = labels;
    const terminates = e.stopReason === 'exact';
    el('geo-status').textContent =
      `Rectangle of ratio ${CF.constant(g.key).label} : 1. Each generation fills the remaining rectangle ` +
      `with the largest square that fits — the counts are exactly the continued-fraction terms. ` +
      (terminates
        ? 'This ratio is rational, so the process ends on an exact square and the picture is finite.'
        : 'This ratio is irrational, so a remainder is always left over — drag "zoom to generation" to fall into it.') +
      (d.truncated ? ' (Square budget reached; later generations are clipped.)' : '');
  }

  el('geo-depth').addEventListener('input', e => { state.geometry.depth = Number(e.target.value); renderGeometry(); });
  el('geo-zoom').addEventListener('input', e => { state.geometry.zoom = Number(e.target.value); renderGeometry(); });
  renderGeometry();
```

- [ ] **Step 3: Verify the canvas actually renders**

Take a screenshot with the Geometry tab forced open by appending `#geometry` handling — simplest is a
temporary scratch copy that activates the panel on load. Create it in the scratchpad, not the project:

```bash
cd /Users/neoneye/git/vibe-coding-lab && SCRATCH="${TMPDIR:-/tmp}/cf_shot.html" && \
  sed 's|renderGeometry();|renderGeometry();document.querySelector(".tab[data-panel=geometry]").click();|' \
  continued-fractions/index.html > "$SCRATCH" && \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --virtual-time-budget=4000 --window-size=1000,900 --screenshot="${TMPDIR:-/tmp}/cf_geo.png" \
  "file://$SCRATCH" 2>/dev/null && echo ok
```

Then read `${TMPDIR:-/tmp}/cf_geo.png` with the Read tool and confirm: a wide rectangle for π filled with
3 large squares, then 7 smaller ones in the strip, then 15 smaller still, each in its own colour, labelled.
If the squares are missing or escape the rectangle, fix the drawing before continuing.

- [ ] **Step 4: Run the test suite once more**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 45 tests passed`

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/index.html
git commit -m "continued-fractions: geometry tab drawing the square dissection with zoom

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Screenshot and gallery entry

**Files:**
- Create: `continued-fractions/screenshot1.jpg`
- Modify: `gallery.yaml`
- Modify: `index.html` (repo root, via `build_gallery.py`)

**Interfaces:**
- Consumes: the finished page.
- Produces: a gallery card titled "Continued Fractions".

- [ ] **Step 1: Capture the screenshot**

```bash
cd /Users/neoneye/git/vibe-coding-lab && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --virtual-time-budget=5000 --window-size=1100,900 \
  --screenshot="${TMPDIR:-/tmp}/cf_shot.png" "file://$PWD/continued-fractions/index.html" 2>/dev/null && \
  sips -s format jpeg -s formatOptions 82 "${TMPDIR:-/tmp}/cf_shot.png" \
  --out continued-fractions/screenshot1.jpg >/dev/null && ls -la continued-fractions/screenshot1.jpg
```

Expected: a JPEG under 300 KB. Read it with the Read tool and confirm it shows the Simple tab with π's
terms and the convergent table — not a blank page.

- [ ] **Step 2: Check whether a title override is needed**

`build_gallery.py` derives titles from directory names, so `continued-fractions` becomes
"Continued Fractions" already. Only add a `gallery.yaml` line if the generated title is wrong.

Run: `cd /Users/neoneye/git/vibe-coding-lab && python3 build_gallery.py && git diff --stat index.html`
Expected: `index.html` gains a card for `continued-fractions`.

- [ ] **Step 3: Verify the generated card**

Run: `grep -n "continued-fractions" /Users/neoneye/git/vibe-coding-lab/index.html`
Expected: a link to `continued-fractions/index.html` with the title "Continued Fractions" and the screenshot.

- [ ] **Step 4: Run the full test suite one last time**

Run: `node continued-fractions/test.mjs`
Expected: `continued-fractions: 45 tests passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add continued-fractions/screenshot1.jpg index.html gallery.yaml
git commit -m "continued-fractions: screenshot and gallery entry

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
