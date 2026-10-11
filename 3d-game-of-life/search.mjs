// Random-searches S/B/C rules for one lattice/neighbourhood using the shared-code engine.
// Prints candidates that pass GOL.evaluate (N=32, 300 gens), best activity first.
// Usage: node search.mjs <cube|tetra> <1|2> [tries=300] [seed=1]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const GOL = new Function(`${html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1]}; return GOL;`)();

const [lattice = "tetra", rArg = "1", triesArg = "300", seedArg = "1"] = process.argv.slice(2);
const r = +rArg, maxC = GOL.maxCount(lattice, r), rng = GOL.mulberry32(+seedArg);
const uni = (lo, hi) => lo + rng() * (hi - lo);
const pickOf = arr => arr[Math.floor(rng() * arr.length)];

// Scale a 26-neighbour rule's counts to this neighbourhood by density fraction.
function scaleRule(rule, from, to) {
  const [S, B, C] = rule.split("/");
  const sc = part => part === "" ? "" : part.split(",").map(tok => {
    const [a, b = a] = tok.split("-").map(Number);
    const lo = Math.round((a / from) * to), hi = Math.max(lo, Math.round((b / from) * to));
    return lo === hi ? `${lo}` : `${lo}-${hi}`;
  }).join(",");
  return `${sc(S)}/${sc(B)}/${C}`;
}
function band(fLo, fHi) {
  const lo = Math.max(1, Math.round(fLo * maxC)), hi = Math.min(maxC, Math.max(lo, Math.round(fHi * maxC)));
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
}

const candidates = [];
for (const p of GOL.presetsFor("cube", 1))
  candidates.push({ name: `${p.name} (scaled)`, lattice, r, rule: scaleRule(p.rule, 26, maxC), density: p.density, fill: p.fill });
for (let i = 0; i < +triesArg; i++) {
  const s0 = uni(0.03, 0.5), b0 = uni(0.03, 0.4);
  const S = band(s0, s0 + uni(0, 0.3)), B = band(b0, b0 + uni(0, 0.12));
  candidates.push({ name: `rand${i}`, lattice, r, rule: `${S}/${B}/${pickOf([2, 3, 4, 5, 6, 8, 10])}`,
                    density: pickOf([0.2, 0.3, 0.4, 0.5]), fill: pickOf([0.3, 0.5, 0.7, 1.0]) });
}

const passed = [];
for (const c of candidates) {
  const quick = GOL.evaluate(c, { N: 24, gens: 150 });       // cheap filter
  if (!quick.ok) continue;
  const e = GOL.evaluate(c);                                 // the real acceptance test
  if (e.ok) passed.push({ ...c, frac: +e.frac.toFixed(3), activity: +e.activity.toFixed(4) });
}
passed.sort((a, b) => b.activity - a.activity);
console.log(`${lattice} r=${r} maxCount=${maxC}: ${passed.length}/${candidates.length} passed`);
for (const p of passed.slice(0, 20)) console.log(JSON.stringify(p));
