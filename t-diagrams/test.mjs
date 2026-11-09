// Runs the TDTests embedded in index.html's shared-code script block, with the page's own Wee and
// Brainfuck sources (the <script type="text/plain" data-file="..."> blocks).
// Usage: node test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) {
  console.error("shared-code block not found");
  process.exit(1);
}
const SRC = {};
for (const s of html.matchAll(/<script type="text\/plain" data-file="([^"]+)">\n([\s\S]*?)<\/script>/g)) SRC[s[1]] = s[2];
const ok = await new Function(`${m[1]}; return TDTests.run.bind(TDTests);`)()(SRC);
process.exit(ok ? 0 : 1);
