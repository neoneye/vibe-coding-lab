// Checks the instruction reference on the page against what the disassembler
// actually decodes. The engine lives in the shared-code script block.
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
const { INSTRUCTION_GROUPS, engineMnemonics } =
  new Function(`${m[1]}; return { INSTRUCTION_GROUPS, engineMnemonics };`)();

const documented = new Set(INSTRUCTION_GROUPS.flatMap(group => group.entries.map(entry => entry[0])));
const implemented = engineMnemonics();
const failures = [];
for (const name of implemented) if (!documented.has(name)) failures.push(`${name} is implemented but not documented`);
for (const name of documented) if (!implemented.has(name)) failures.push(`${name} is documented but the emulator has no such instruction`);

for (const message of failures) console.error("FAIL  " + message);
console.log(failures.length
  ? `${failures.length} failures`
  : `${documented.size} instructions documented, and the decoder names exactly those`);
process.exit(failures.length ? 1 : 0);
