"""Read-only mathematical probes for the compiled checker at 2f0a90c.

Run with Python containing python-flint and with Cargo on PATH. Builds a copy
of the checker in a temporary directory; does not alter production sources or
overwrite a proof transcript. Cargo dependencies must already be cached.
"""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from fractions import Fraction as Q

DEV = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEV))
import kernel_pieces_arb as kp
from flint import arb

scratch = Path(tempfile.mkdtemp(prefix="riemann-review-2f0a90c-"))
(scratch / "src").mkdir()
for name in ("Cargo.toml", "Cargo.lock"):
    shutil.copy(DEV / "tapecheck" / name, scratch / name)
source = (DEV / "tapecheck/src/main.rs").read_text()
source = source.replace("fn main() {", "fn original_main() {", 1)
source += r'''
fn main() {
    let dev = PathBuf::from(std::env::args().nth(1).unwrap());
    let v: Value = serde_json::from_slice(
        &fs::read(dev.join("kernel_pieces_arb.results.json")).unwrap()).unwrap();
    let k = Kernel::new();
    // This runs the production loader, including its root "re-checks".
    let t = Tables::load(&k, &v).unwrap();
    // Hex bit strings avoid another decimal-JSON rounding step in the probe.
    let bits = |v: &Vec<f64>| v.iter()
        .map(|x| format!("{:016x}", x.to_bits())).collect::<Vec<_>>();
    println!("{}", json!({"w_los": bits(&t.w_los), "w_his": bits(&t.w_his),
                         "d_los": bits(&t.d_los), "d_his": bits(&t.d_his)}));
}
'''
(scratch / "src/main.rs").write_text(source)
with (scratch / "build.log").open("w") as log:
    run = subprocess.run(
        ["cargo", "run", "--release", "--offline", "--quiet", "--", str(DEV)],
        cwd=scratch, stdout=subprocess.PIPE, stderr=log, text=True, check=True)

import struct
r = {k: [struct.unpack(">d", bytes.fromhex(x))[0] for x in v]
     for k, v in json.loads(run.stdout).items()}
p = kp.Pieces(170)
out = {"scratch": str(scratch), "root_tables": {}}
cases = [
    ("w", sorted([t for t in p.zs + p.ms if float(t.mid()) <= 170],
                 key=lambda t: float(t.mid())), r["w_los"][1:], r["w_his"][1:]),
    ("wd", p.dbreaks_arb, r["d_los"], r["d_his"]),
]
for name, roots, los, his in cases:
    assert len(roots) == len(los) == len(his)
    misses = []
    for i, (root, lo, hi) in enumerate(zip(roots, los, his)):
        if root.upper() < arb(lo) or root.lower() > arb(hi):
            misses.append({"index": i, "certified_root": str(root),
                           "rust_lo": lo, "rust_hi": hi,
                           "within_sharp_distance_96": root.upper() < arb(96)})
    out["root_tables"][name] = {"count": len(roots), "misses": misses}

c = json.loads((DEV / "tiling_pair.stationary.json").read_text())
j = len(c["knots"])
errors = []
for i in range(j * j):
    vals = [c["coefficients"][k * j * j + i] for k in range(c["free"])]
    error = sum(map(Q, vals)) + Q(-sum(vals))
    if error:
        errors.append({"cell": list(divmod(i, j)), "residual": str(error)})
out["pair_nonzero_coboundary_residuals"] = errors

sharp = next(c for c in json.loads((DEV / "tiling_additive.certificate.json").read_text())
             ["certificates"] if c["name"] == "sharp")
a, b = list(map(Q, sharp["a"])), list(map(Q, sharp["b"]))
amplitude = 2 * (max(map(abs, a)) + max(map(abs, b))
                 + max(abs(x + y) for x, y in zip(a, b)))
out["sharp_tail_margin_at_16_exact"] = str(Q(16, 3000) - amplitude - Q(3956, 1000000))
assert Q(16, 3000) - amplitude > Q(3956, 1000000)
print(json.dumps(out, indent=2))
