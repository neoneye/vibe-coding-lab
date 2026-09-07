"""Read-only numerical/mutation probes for COMMIT_REVIEW_69d3f99.md.

Run with a Python containing python-flint. All forged tape files and outputs
are made in a temporary directory; committed artifacts are never overwritten.
This reports observed defects rather than modifying the implementation.
"""
import contextlib
import hashlib
import io
import json
from fractions import Fraction
from pathlib import Path
import sys
import tempfile

from flint import arb, acb, ctx

DEV = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEV))
import sweep_proof_arb as checker
import kernel_pieces_arb as kernel

ctx.prec = 256
cert = next(c for c in json.loads((DEV / "tiling_additive.certificate.json").read_text())
            ["certificates"] if c["name"] == "sharp")


def as_ball(q):
    return arb(q.numerator) / arb(q.denominator)


# Exact represented data, with rational interpolation as an independent oracle.
x = 1.85
i = 18
q = Fraction
t = (q(x) - q(cert["knots"][i])) / (q(cert["knots"][i+1]) - q(cert["knots"][i]))
exact = q(cert["a"][i]) * (1-t) + q(cert["a"][i+1]) * t
got = checker.pl_range(cert["knots"], cert["a"], x, x)
print("pl_range point enclosure misses exact value:", not got.overlaps(as_ball(exact)))
print("pl_range error:", got-as_ball(exact))

slope = (q(cert["a"][1])-q(cert["a"][0])) / (q(cert["knots"][1])-q(cert["knots"][0]))
got_slope = checker.pl_slope_range(cert["knots"], cert["a"], 0.05, 0.05)
print("slope enclosure misses exact slope:", not got_slope.overlaps(as_ball(slope)))

pieces = kernel.Pieces(30)
got_w = pieces.w_range(0.5, 0.5)
true_w = kernel.weight(arb(0.5))
print("kernel point enclosure misses direct Arb value:", not got_w.overlaps(true_w))
print("kernel point error:", got_w-true_w)

target = 0.003956
below = arb(target) - arb(1)/arb(2)**70
print("value is strictly below target:", below < arb(target))
print("float lower-bound comparison nevertheless accepts:", float(below.lower()) >= target)

# The candidate has no tube. This false proof asks for R >= 1000 on a cube
# containing the origin, where the actual reduced functional is exactly 12.
scratch = Path(tempfile.mkdtemp(prefix="riemann-69d3f99-review-"))
tape = bytes([checker.LEAF_TUBE])
(scratch / "forged.bin").write_bytes(tape)
meta = dict(cube=0.5, tubeRadius=0, target=1000, roots=1, nodes=1,
            leaves=1, splits=0, collapses=0, unresolved=0,
            tape=str(scratch / "forged.bin"),
            tape_sha256=hashlib.sha256(tape).hexdigest(),
            candidate="tiling_sharp.candidate.json")
(scratch / "forged.json").write_text(json.dumps(meta, indent=2))
saved_argv = sys.argv
sys.argv = ["sweep_proof_arb.py", "--all", "--meta="+str(scratch / "forged.json"),
            "--out="+str(scratch / "result.json")]
checker.CHECKS.clear()
checker.CONFLICTS.clear()
log = io.StringIO()
try:
    with contextlib.redirect_stdout(log):
        rc = checker.main()
finally:
    sys.argv = saved_argv
(scratch / "checker.log").write_text(log.getvalue())
print("forged no-tube proof exit code:", rc)
print("forged proof evidence:", scratch)

# A complete-check invocation with one unresolved arithmetic obligation also
# exits successfully. Keep this distinct from the invalid tube-label bypass.
tape = bytes([checker.LEAF_BOUND])
(scratch / "unresolved.bin").write_bytes(tape)
meta.update(target=6, tape=str(scratch / "unresolved.bin"),
            tape_sha256=hashlib.sha256(tape).hexdigest())
(scratch / "unresolved.json").write_text(json.dumps(meta, indent=2))
sys.argv = ["sweep_proof_arb.py", "--all", "--meta="+str(scratch / "unresolved.json"),
            "--out="+str(scratch / "unresolved_result.json")]
checker.CHECKS.clear()
checker.CONFLICTS.clear()
log = io.StringIO()
try:
    with contextlib.redirect_stdout(log):
        rc = checker.main()
finally:
    sys.argv = saved_argv
(scratch / "unresolved_checker.log").write_text(log.getvalue())
result = json.loads((scratch / "unresolved_result.json").read_text())
print("all-mode exit with unresolved leaf:", rc, result["leaf_sample"])

# Independent complex ball evaluation, with exact rational inputs, for D1.
ctx.prec = 256
r = arb(2).sqrt()
pi = arb.pi()


def K(z):
    a, b = (r-2*pi*z)/2, (r+2*pi*z)/2
    return (a.sin()/a+b.sin()/b)/(2*r*(1/r).sin())


xs = [acb(arb(106)/100 + arb(j)/10000) for j in range(10)]
points = xs + [acb(0, arb(1)/20), acb(0, -arb(1)/20)]
S = sum((K(z-s)**2 for z in points for s in points), acb(0))
delta = S.real - 14  # ten simple real points, twelve points in total
D1 = sum((K(xs[j]-xs[k])**2 for j in range(10) for k in range(10) if j != k), acb(0))
print("Lamzouri candidate Delta-D1:", delta-D1.real)
print("strict negative sign certified:", delta-D1.real < 0)
