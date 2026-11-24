// Runs the SATests embedded in index.html's shared-code script block,
// then checks that every voxel PNG sheet on disk has the size the rig table expects.
// Usage: node test.mjs
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) {
  console.error("shared-code block not found");
  process.exit(1);
}
const { SA, ok: testsOk } = new Function(`${m[1]}; return { SA, ok: SATests.run() };`)();
let ok = testsOk;

// PNG header check: width and height live in the IHDR chunk at bytes 16..23.
function pngSize(path) {
  const b = readFileSync(path);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((v, i) => b[i] === v)) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function checkFile(label, path, verdict) {
  const full = join(here, path);
  if (!existsSync(full)) { ok = false; console.log(`FAIL ${label}  [missing ${path}]`); return; }
  const s = pngSize(full);
  if (!s) { ok = false; console.log(`FAIL ${label}  [${path} is not a PNG]`); return; }
  const msg = verdict(s);
  if (msg) { ok = false; console.log(`FAIL ${label}  [${msg}]`); } else console.log(`ok   ${label}`);
}
if (typeof SA.sheetPaths === "function") {
  for (const e of SA.sheetPaths()) checkFile(`sheet ${e.path}`, e.path, s => SA.checkSheet(e, s.w, s.h));
  checkFile("backdrop.png is 640x200", "backdrop.png", s => (s.w === 640 && s.h === 200 ? null : `backdrop.png is ${s.w}x${s.h}, expected 640x200`));
}
process.exit(ok ? 0 : 1);
