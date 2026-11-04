// Random-searches S/B/C rules for one lattice/neighbourhood using the shared-code engine.
// Keeps candidates that pass GOL.evaluate (N=32, 300 gens: alive, sparse — non-dead <= GOL.MAX_FRAC and
// alive <= GOL.MAX_ALIVE_FRAC — still changing, and for C=2 rules flicker <= GOL.FLICKER_CAP) and are not frozen.
// Results are ranked sparse-first (non-dead <= SPARSE_FRAC), then by activity. These are candidates only:
// the presets in index.html are picked by eye in the browser.
// Stage 0 seeds known 26-neighbour classics (counts scaled to this neighbourhood), stage 1 samples random
// windows, stage 2 refines the best viable candidates, stage 3 applies the full test.
// Usage: node search.mjs <cube|tetra|crystal> <1|2> [tries=300] [seed=1]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const GOL = new Function(`${html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1]}; return GOL;`)();

const [lattice = "tetra", rArg = "1", triesArg = "300", seedArg = "1"] = process.argv.slice(2);
const r = +rArg, maxC = GOL.maxCount(lattice, r), rng = GOL.mulberry32(+seedArg);
const MIN_ACTIVITY = 0.01;                                  // below this the pattern is effectively frozen
const SPARSE_FRAC = 0.2;                                    // ranked first: open enough to see structures inside
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

// Stage 0: known 26-neighbour box rules (survival band, birth band, C), counts scaled by maxCount/26.
const candidates = [];
const CLASSICS = [[2, 9, 4, 9, 10], [4, 7, 6, 8, 10], [4, 4, 4, 4, 5], [5, 8, 6, 9, 4], [5, 7, 4, 6, 10], [4, 6, 4, 5, 10],
                  [3, 5, 4, 4, 6], [5, 10, 1, 3, 8], [6, 10, 5, 6, 2], [13, 26, 10, 26, 3]];
for (const [sLo, sHi, bLo, bHi, C] of CLASSICS) for (const density of [0.2, 0.35]) for (const fill of [0.3, 0.5]) {
  const k = maxC / 26;
  candidates.push(make(`classic${candidates.length}`, Math.round(sLo * k), Math.round(sHi * k),
                       Math.round(bLo * k), Math.round(bHi * k), C, density, fill));
}

// Stage 1: random candidates.
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

// Stage 2: good rules are narrow islands in rule space, so mutate the best viable candidates (3 rounds,
// 12 parents x 20 children: the 6 calmest and the 6 most active sparse ones) by shifting the window edges,
// C, density and fill a little.
const quickOf = new Map();
const quickEval = c => { const q = GOL.evaluate(c, { N: 24, gens: 150 }); quickOf.set(c, q); return q; };
for (const c of candidates) quickEval(c);
const jitter = () => Math.round(uni(-0.06, 0.06) * maxC);
let next = 0;
for (let round = 0; round < 3; round++) {
  const viable = [...quickOf].filter(([, q]) => q.ok && q.activity >= 0.005);
  const calm = viable.slice().sort((a, b) => a[1].flicker - b[1].flicker).slice(0, 6);
  const lively = viable.filter(v => v[1].frac <= SPARSE_FRAC && !calm.includes(v))
    .sort((a, b) => b[1].activity - a[1].activity).slice(0, 6);
  const parents = [...calm, ...lively].map(([c]) => c);
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

// Stage 3: the real acceptance test (includes the C=2 flicker cap).
const passed = [];
for (const c of candidates) {
  if (!quickOf.get(c).ok) continue;                          // cheap filter
  const e = GOL.evaluate(c);
  if (e.ok && e.activity >= MIN_ACTIVITY)
    passed.push({ name: c.name, lattice, r, rule: c.rule, density: c.density, fill: c.fill,
                  frac: +e.frac.toFixed(3), aliveFrac: +e.aliveFrac.toFixed(3),
                  activity: +e.activity.toFixed(4), flicker: +e.flicker.toFixed(3) });
}
const sparse = p => (p.frac <= SPARSE_FRAC ? 0 : 1);
passed.sort((a, b) => sparse(a) - sparse(b) || b.activity - a.activity);
console.log(`${lattice} r=${r} maxCount=${maxC}: ${passed.length}/${candidates.length} passed`);
for (const p of passed.slice(0, 30)) console.log(JSON.stringify(p));
