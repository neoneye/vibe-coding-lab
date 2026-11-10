// Loads ncm.wasm and runs its self-test and a short smoke run.
// Usage: node test.mjs   (after sh build.sh)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { instance } = await WebAssembly.instantiate(readFileSync(join(here, "ncm.wasm")), {});
const x = instance.exports;
let failed = 0;
function check(name, ok, detail = "") {
  console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : " " + detail));
  if (!ok) failed++;
}
// Copies bytes into wasm memory, calls fn(ptr, len), frees.
function withBytes(bytes, fn) {
  const ptr = x.ncm_alloc(bytes.length);
  new Uint8Array(x.memory.buffer, ptr, bytes.length).set(bytes);
  const r = fn(ptr, bytes.length);
  x.ncm_free(ptr, bytes.length);
  return r;
}
const out = () => new Uint8Array(x.memory.buffer, x.ncm_out_ptr(), x.ncm_out_len()).slice();
const outF32 = () => new Float32Array(out().buffer);
const outU32 = () => new Uint32Array(out().buffer);
const u32Bytes = (a) => new Uint8Array(new Uint32Array(a).buffer);
const f32Bytes = (a) => new Uint8Array(new Float32Array(a).buffer);

check("selftest", x.ncm_selftest() === 0);

const text = readFileSync(join(here, "corpus/shakespeare.txt"), "utf8").slice(0, 200000);
const charset = [...new Set(text)].sort().join("");
const levels = [1, 4, 8, 16, 32, 64];
const cfg = [1, 32, 64, 1, 4, 2, 64, 4, levels.length, ...levels];
check("set charset", withBytes(new TextEncoder().encode(charset), (p, n) => x.ncm_set_charset(p, n)) === 0);
check("init", withBytes(u32Bytes(cfg), (p, n) => x.ncm_init(p, n / 4)) === 0);
check("init rejects a bad shape", withBytes(u32Bytes([1, 7, 64, 1, 4, 2, 64, 4, 2, 1, 64]), (p, n) => x.ncm_init(p, n / 4)) === 1);
check("generator needs tokenizer", x.ncm_train(1, 1) === 3 || x.ncm_train(1, 1) === 1);
check("short corpus refused", withBytes(new TextEncoder().encode("too short"), (p, n) => x.ncm_set_corpus(p, n)) === 1);
check("set corpus", withBytes(new TextEncoder().encode(text), (p, n) => x.ncm_set_corpus(p, n)) === 0);
check("generator refused before tokenizer", x.ncm_train(1, 1) === 1);
check("generate refused before tokenizer", x.ncm_generate(1, 1.0, 0, 1) === 1);
check("set hparams", withBytes(f32Bytes([2e-3, 1e-3, 8, 0.5, 0, 0.5, 0.3, 5, 1000]), (p, n) => x.ncm_set_hparams(p, n / 4)) === 0);

check("tokenizer step", x.ncm_train(0, 1) === 0);
const first = outF32()[4];
check("tokenizer steps", x.ncm_train(0, 30) === 0);
const later = outF32()[4];
check("tokenizer loss finite and falling", Number.isFinite(later) && later < first, `${first} -> ${later}`);
check("tokenizer eval", x.ncm_eval(0, 1) === 0 && outF32().length === 2 * levels.length && outF32().every(Number.isFinite));

check("generator steps", x.ncm_train(1, 10) === 0);
const g = outF32();
check("generator loss finite", Number.isFinite(g[8]) && g[2] === 10, `${g[8]}`);
check("generator eval", x.ncm_eval(1, 1) === 0 && outF32().length === 1 + 3 * (levels.length - 1));

const total = levels.reduce((a, b) => a + b, 0);
const per = total + levels.length * 64;
check("generate", x.ncm_generate(5, 1.0, 0, 3) === 0 && outU32().length === 3 * per);
const a = out();
x.ncm_generate(5, 1.0, 0, 3);
const b = out();
check("generation is deterministic per seed", a.length === b.length && a.every((v, i) => v === b[i]));
x.ncm_generate(6, 1.0, 0, 3);
check("another seed differs", out().some((v, i) => v !== a[i]));
check("top-k above the codebook and temperature 0 work", x.ncm_generate(5, 0, 100000, 1) === 0);

check("encode", withBytes(new TextEncoder().encode("To be, or not to be"), (p, n) => x.ncm_encode(p, n)) === 0 && outU32().length === total + (levels.length + 1) * 64);
const enc = outU32();
const input = String.fromCodePoint(...enc.slice(total + levels.length * 64));
check("encode echoes the padded input", input.startsWith("To be, or not to be ") && input.length === 64, JSON.stringify(input));
check("unknown characters fall back", withBytes(new TextEncoder().encode("café \u{1F600}"), (p, n) => x.ncm_encode(p, n)) === 0 && String.fromCodePoint(...outU32().slice(total + levels.length * 64)).startsWith("caf? ? "));
check("usage histogram", x.ncm_usage(64) === 0 && outU32().length === levels.length * 64);
check("held-out window", x.ncm_heldout(3) === 0 && outU32().length === 64);

check("export", x.ncm_export() === 0 && out().length > 1000);
const ckpt = out();
check("import of junk is refused", withBytes(new Uint8Array(10), (p, n) => x.ncm_import(p, n)) === 1);
check("import of a cut file is refused", withBytes(ckpt.slice(0, ckpt.length >> 1), (p, n) => x.ncm_import(p, n)) === 3);
x.ncm_generate(5, 1.0, 0, 3);
check("failed import leaves the model alone", out().every((v, i) => v === a[i]));
check("import", withBytes(ckpt, (p, n) => x.ncm_import(p, n)) === 0);
const info = outU32();
check("import reports config and steps", info[1] === 32 && info[9 + levels.length] === 31 && info[10 + levels.length] === 10, [...info].join(","));
x.ncm_generate(5, 1.0, 0, 3);
check("generation identical after import", out().every((v, i) => v === a[i]));
check("training continues after import", x.ncm_train(1, 1) === 0);

// A tokenizer step after generator training throws the generator away.
check("tokenizer step resets generator", x.ncm_train(0, 1) === 0 && outF32()[3] === 1 && outF32()[2] === 0);

// An absurd learning rate is reported as divergence and rolled back.
withBytes(f32Bytes([1e6, 1e-3, 8, 0.5, 0, 0.5, 0.3, 0, 1000]), (p, n) => x.ncm_set_hparams(p, n / 4));
let code = 0;
for (let i = 0; i < 20 && code === 0; i++) code = x.ncm_train(0, 2);
check("divergence reported", code === 2, `code ${code}`);
check("model still usable after divergence", x.ncm_eval(0, 1) === 0 && outF32().every(Number.isFinite));

process.exit(failed ? 1 : 0);
