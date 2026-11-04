// Sweeps pump force and relaxation time; prints emergent diodicity.
// Usage: node tune.mjs            (takes a few minutes)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const src = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1];
const lib = new Function(`${src}; return { buildValveMask, LBM, PROBE_X };`)();

// Steady-state window (matches the test protocol; earlier windows catch a
// transient that overstates diodicity).
const DEV = 8000, MEASURE = 4000;

function measure(force, tau, dir) {
  const sim = new lib.LBM({ geo: lib.buildValveMask(), tau, forceX: dir * force });
  for (let i = 0; i < DEV; i++) sim.step();
  let q = 0;
  for (let i = 0; i < MEASURE; i++) { sim.step(); q += sim.flowRate(lib.PROBE_X); }
  return { q: q / MEASURE, maxU: sim.maxSpeed(), finite: sim.allFinite() };
}

console.log("force    tau   Qfwd      Qrev       Di    maxU   ok");
for (const tau of [0.51, 0.515]) {
  for (const force of [3e-5, 4e-5, 5e-5, 6e-5]) {
    const F = measure(force, tau, +1);
    const R = measure(force, tau, -1);
    const di = Math.abs(F.q) / Math.max(Math.abs(R.q), 1e-9);
    console.log(
      force.toExponential(1), tau.toFixed(2),
      F.q.toFixed(4).padStart(8), R.q.toFixed(4).padStart(9),
      di.toFixed(2).padStart(6), Math.max(F.maxU, R.maxU).toFixed(3).padStart(6),
      F.finite && R.finite
    );
  }
}
