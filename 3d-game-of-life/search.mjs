// Random-searches S/B/C rules for one lattice/neighbourhood using the shared-code engine.
// Keeps candidates that pass GOL.evaluate (N=32, 300 gens) with flicker <= GOL.FLICKER_CAP (calm,
// structured rules rather than TV static) and are not frozen, ranked by activity, best first.
// Stage 1 samples random windows, stage 2 refines the calmest, stage 3 applies the full test.
// Usage: node search.mjs <cube|tetra> <1|2> [tries=300] [seed=1]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const GOL = new Function(`${html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1]}; return GOL;`)();

const [lattice = "tetra", rArg = "1", triesArg = "300", seedArg = "1"] = process.argv.slice(2);
const r = +rArg, maxC = GOL.maxCount(lattice, r), rng = GOL.mulberry32(+seedArg);
const MIN_ACTIVITY = 0.01;                                  // below this the pattern is effectively frozen
const uni = (lo, hi) => lo + rng() * (hi - lo);
const pickOf = arr => arr[Math.floor(rng() * arr.length)];

// Neighbour-count band from fractions of the neighbourhood size.
function band(fLo, fHi) {
  const lo = Math.max(1, Math.round(fLo * maxC)), hi = Math.min(maxC, Math.max(lo, Math.round(fHi * maxC)));
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
}

// A candidate keeps its numeric bands so the refinement stage can mutate them.
const toRule = c => `${c.sLo === c.sHi ? c.sLo : `${c.sLo}-${c.sHi}`}/${c.bLo === c.bHi ? c.bLo : `${c.bLo}-${c.bHi}`}/${c.C}`;
function make(name, sLo, sHi, bLo, bHi, C, density, fill) {
  sLo = Math.max(1, Math.min(maxC, sLo)); sHi = Math.max(sLo, Math.min(maxC, sHi));
  bLo = Math.max(1, Math.min(maxC, bLo)); bHi = Math.max(bLo, Math.min(maxC, bHi));
  const c = { name, lattice, r, sLo, sHi, bLo, bHi, C, density, fill };
  c.rule = toRule(c);
  return c;
}
const frac = f => Math.round(f * maxC);

// Stage 1: random candidates.
const candidates = [];
for (let i = 0; i < +triesArg; i++) {
  let sLo, sHi, bLo, bHi;
  if (i % 2 === 0) {
    // Larger-than-Life style: survival window at 20-45% of the neighbourhood, birth window
    // narrower than survival and inside it.
    const a = uni(0.2, 0.45), b = a + uni(0.04, 0.25), c = uni(a, b), d = c + uni(0, 0.5 * (b - c));
    [sLo, sHi, bLo, bHi] = [a, b, c, d].map(frac);
  } else {
    // Unconstrained: survival and birth windows anywhere.
    const s0 = uni(0.03, 0.5), b0 = uni(0.03, 0.4);
    [sLo, sHi, bLo, bHi] = [s0, s0 + uni(0, 0.3), b0, b0 + uni(0, 0.12)].map(frac);
  }
  candidates.push(make(`rand${i}`, sLo, sHi, bLo, bHi, pickOf([2, 2, 3, 4, 5, 6, 8, 10]),
                       pickOf([0.1, 0.2, 0.3, 0.4, 0.5]), pickOf([0.3, 0.5, 0.7, 1.0])));
}

// Stage 2: calm rules are narrow islands in rule space, so mutate the calmest viable candidates (3 rounds,
// 12 parents x 20 children) by shifting the window edges, C, density and fill a little.
const quickOf = new Map();
const quickEval = c => { const q = GOL.evaluate(c, { N: 24, gens: 150 }); quickOf.set(c, q); return q; };
for (const c of candidates) quickEval(c);
const jitter = () => Math.round(uni(-0.06, 0.06) * maxC);
let next = 0;
for (let round = 0; round < 3; round++) {
  const parents = [...quickOf].filter(([, q]) => q.ok && q.flicker <= 1.5 && q.activity >= 0.005)
    .sort((a, b) => a[1].flicker - b[1].flicker).slice(0, 12).map(([c]) => c);
  for (const p of parents) for (let k = 0; k < 20; k++) {
    const m = () => (rng() < 0.5 ? jitter() : 0);
    const child = make(`mut${next++}`, p.sLo + m(), p.sHi + m(), p.bLo + m(), p.bHi + m(),
                       rng() < 0.2 ? pickOf([2, 3, 4, 5, 6, 8, 10]) : p.C,
                       rng() < 0.2 ? pickOf([0.1, 0.2, 0.3, 0.4, 0.5]) : p.density,
                       rng() < 0.2 ? pickOf([0.3, 0.5, 0.7, 1.0]) : p.fill);
    if (![...quickOf.keys()].some(o => o.rule === child.rule && o.density === child.density && o.fill === child.fill)) {
      candidates.push(child); quickEval(child);
    }
  }
}

// Stage 3: the real acceptance test plus the flicker cap.
const passed = [];
for (const c of candidates) {
  const quick = quickOf.get(c);
  if (!quick.ok || quick.flicker > 1) continue;              // cheap filter
  const e = GOL.evaluate(c);
  if (e.ok && e.flicker <= GOL.FLICKER_CAP && e.activity >= MIN_ACTIVITY)
    passed.push({ name: c.name, lattice, r, rule: c.rule, density: c.density, fill: c.fill,
                  frac: +e.frac.toFixed(3), activity: +e.activity.toFixed(4), flicker: +e.flicker.toFixed(3) });
}
passed.sort((a, b) => b.activity - a.activity);
console.log(`${lattice} r=${r} maxCount=${maxC}: ${passed.length}/${candidates.length} passed (flicker <= ${GOL.FLICKER_CAP})`);
for (const p of passed.slice(0, 30)) console.log(JSON.stringify(p));
