// Smoke test of the embedded wasm engine (the Rust tests cover the logic).
// Usage: node test.mjs   (run ./build.sh first after changing the Rust code)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const ctx = {};
vm.runInNewContext(readFileSync(join(here, "swarm_wasm.js"), "utf8"), { globalThis: ctx });
const bytes = Buffer.from(ctx.SWARM_WASM_BASE64, "base64");
const { instance } = await WebAssembly.instantiate(bytes, {});
const e = instance.exports;

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}
const readOut = (len) => new TextDecoder().decode(new Uint8Array(e.memory.buffer, e.out_ptr(), len));
function writeIn(text) {
  const b = new TextEncoder().encode(text);
  const p = e.buf_alloc(b.length);
  new Uint8Array(e.memory.buffer, p, b.length).set(b);
  return b.length;
}

check(e.course_count() >= 7, `course_count ${e.course_count()}`);
const info = readOut(e.course_info(0)).split("\n");
check(info[0] === "Open field" && Number(info[2]) > 0, `course_info(0) ${JSON.stringify(info)}`);
check(readOut(e.function_info()).split("\n").length >= 12, "function_info lists the registry");

e.ga_new(0, 7);
e.ga_steps(400);
check(e.ga_generation() >= 1, `ga_generation ${e.ga_generation()}`);
check(Number.isFinite(e.ga_best_fitness()), `ga_best_fitness ${e.ga_best_fitness()}`);
check(readOut(e.ga_best_text()).length > 0, "ga_best_text");
check(e.ga_history_len() === e.ga_generation(), "history has one entry per generation");

check(e.replay_new(0, 1, 0) === 0, "replay_new with the evolver's best");
const w = e.replay_w(), h = e.replay_h();
check(new Uint8Array(e.memory.buffer, e.replay_cells_ptr(), w * h).length === w * h, `cells ${w}x${h}`);
let calls = 0;
while (!e.replay_step() && calls < 200) calls++;
check(calls <= 101, `replay finishes within the tick limit (${calls} steps)`);
check(e.replay_creature_count() === 12, "12 creatures");
const rec = new Int32Array(e.memory.buffer, e.replay_creatures_ptr(), 8 * e.replay_creature_count());
check(rec[0] === 1, "first creature has id 1");

const ref = readOut(e.reference_text(3));
check(e.replay_new(3, 5, writeIn(ref)) === 0, "replay a pasted program");
while (!e.replay_step());
check(e.replay_arrived() === 12, `reference solves the gate (${e.replay_arrived()} out)`);
check(e.replay_station_count() === 1, "one station");

const badLine = e.library_load(writeIn("; course 0 Open field\nmov $1,\nfoo"));
check(badLine === 2, `library_load reports the bad line (${badLine})`);
check(readOut(e.out_len()).includes("line 2"), "error text names the line");
check(e.replay_new(0, 1, writeIn("lpb 3")) > 0, "replay_new rejects a bad program");

const lib = `; course 0 Open field\n; fitness 1 generation 0\n${readOut(e.reference_text(0))}\n; course 1 Wall\n; fitness 1 generation 0\nmov $1,1\n`;
check(e.library_load(writeIn(lib)) === 0, "library_load ok");
const kept = readOut(e.out_len());
check(kept.includes("kept 1") && kept.includes("rejected 1"), `unverified programs are rejected on load (${kept})`);
check(readOut(e.library_text()).includes("; course 0 Open field"), "library_text");

process.exit(failures ? 1 : 0);
