// Runs the FaradayTests embedded in index.html's shared-code script block.
// Usage: node test.mjs          (a few seconds)
//        node test.mjs --slow   (adds the travelling-wave and ratchet checks, a few minutes)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) {
  console.error("shared-code block not found");
  process.exit(1);
}
const slow = process.argv.includes("--slow");
const ok = new Function(`${m[1]}; return FaradayTests.run({ slow: ${slow} });`)();
process.exit(ok ? 0 : 1);
