// Loads ncm.wasm and runs its self-test and a short smoke run.
// Usage: node test.mjs   (after sh build.sh)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { instance } = await WebAssembly.instantiate(readFileSync(join(here, "ncm.wasm")), {});
const x = instance.exports;
let failed = 0;
function check(name, ok) {
  console.log((ok ? "ok   " : "FAIL ") + name);
  if (!ok) failed++;
}

check("selftest", x.ncm_selftest() === 0);

process.exit(failed ? 1 : 0);
