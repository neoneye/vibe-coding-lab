// Runs LithiumTests embedded in index.html's shared-code script block.
// Usage: node test.mjs
// Physics tests also run when PLANCK_PATH points at a local planck.mjs (planck 1.5.1 dist/planck.mjs).
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) {
  console.error("shared-code block not found");
  process.exit(1);
}
const planck = process.env.PLANCK_PATH ? await import(pathToFileURL(resolve(process.env.PLANCK_PATH)).href) : null;
if (!planck) console.log("(PLANCK_PATH not set: skipping physics tests)");
const ok = new Function(`${m[1]}; return LithiumTests.run;`)()(planck);
process.exit(ok ? 0 : 1);
