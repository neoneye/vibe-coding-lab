// Prints how both worlds fare over several seeds. A report, not a test.
// Usage: node experiment.mjs [ticks] [seeds]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const TP = new Function(`${html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1]}; return TP;`)();
const ticks = +(process.argv[2] || 6000), seeds = +(process.argv[3] || 5);
const pct = (x) => (100 * x).toFixed(0).padStart(3) + "%";
console.log(`ticks ${ticks}`);
console.log("seed mode     pop  births failed viable adults better garden0 gardenN medLen cap  extinct");
for (let seed = 1; seed <= seeds; seed++) {
  const e = TP.experiment(seed, ticks);
  for (const mode of ["naive", "aligned"]) {
    const s = e[mode];
    console.log(`${String(seed).padStart(4)} ${mode.padEnd(8)} ${String(s.pop).padStart(4)} ${String(s.births).padStart(7)} ${String(s.failed).padStart(6)} ${pct(s.viableShare)}  ${pct(s.adultsShare)}  ${pct(s.betterShare)}  ${s.gardenStart.toFixed(0).padStart(6)}  ${s.gardenEnd.toFixed(0).padStart(6)} ${String(s.medianLength).padStart(6)} ${pct(s.capShare)} ${s.extinctAt ?? "-"}`);
  }
}
