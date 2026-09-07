"""Read-only checks behind CLAUDE_FOLLOWUP_PLAN.md.

Run from any directory with Python 3. mpmath is optional and used only for
non-certified decimal diagnostics. Certificate calculations use exact fractions
of the binary64 values obtained by parsing the shipped JSON.
"""
import json
from fractions import Fraction as Q
from pathlib import Path

DEV = Path(__file__).resolve().parents[1]


def osc(values):
    return max(values) - min(values)


def interpolate(knots, values, x):
    if x <= knots[0]:
        return values[0]
    if x >= knots[-1]:
        return values[-1]
    for i in range(len(knots) - 1):
        if knots[i] <= x <= knots[i + 1]:
            t = (x - knots[i]) / (knots[i + 1] - knots[i])
            return values[i] * (1 - t) + values[i + 1] * t
    raise AssertionError("uncovered interpolation input")


def potential(knots, a, ab, state):
    return (-interpolate(knots, a, state[0])
            - interpolate(knots, ab, state[1])
            + interpolate(knots, ab, state[3])
            + interpolate(knots, a, state[4]))


data = json.loads((DEV / "tiling_additive.certificate.json").read_text())
records = []
sharp_boundary = None
for c in data["certificates"]:
    knots = list(map(Q, c["knots"]))
    a, b = list(map(Q, c["a"])), list(map(Q, c["b"]))
    ab = [x + y for x, y in zip(a, b)]
    tail = 2 * (max(map(abs, a)) + max(map(abs, b)) + max(map(abs, ab)))
    boundary = 2 * (osc(a) + osc(ab))
    argmin = lambda v: min(range(len(v)), key=v.__getitem__)
    argmax = lambda v: max(range(len(v)), key=v.__getitem__)
    eps = Q(1, 10**6)
    hi = [knots[argmin(a)], knots[argmin(ab)], eps,
          knots[argmax(ab)], knots[argmax(a)]]
    lo = [knots[argmax(a)], knots[argmax(ab)], eps,
          knots[argmin(ab)], knots[argmin(a)]]
    # Strictly positive gaps can be used in a strictly increasing point list.
    hi, lo = [[max(eps, x) for x in s] for s in [hi, lo]]
    witness_loss = potential(knots, a, ab, hi) - potential(knots, a, ab, lo)
    assert witness_loss > tail, c["name"]
    records.append({
        "certificate": c["name"],
        "tail_bound_approx": float(tail),
        "endpoint_oscillation_approx": float(boundary),
        "endpoint_oscillation_exact": str(boundary),
        "positive_initial_state": [str(x) for x in lo],
        "positive_final_state": [str(x) for x in hi],
        "witness_endpoint_loss_approx": float(witness_loss),
        "witness_exceeds_tail_bound_exactly": witness_loss > tail,
    })
    if c["name"] == "sharp":
        sharp_boundary = boundary

runs = json.loads((DEV / "tiling_interval.results.json").read_text())
print(json.dumps({
    "arithmetic": "exact fractions of parsed binary64 certificate data",
    "endpoint_checks": records,
    "rigorous_additive_rows": [
        {k: r.get(k) for k in ["certificate", "target", "box", "boxes", "checksum"]}
        for r in runs["rigorousRuns"]
    ],
    "rigorous_sharp_003956_row_present": any(
        r.get("certificate") == "sharp" and r.get("target") == 0.003956
        for r in runs["rigorousRuns"]),
}, indent=2))

c = Q("0.003956")
W = (1 + sharp_boundary) // c
print("\nConditional arithmetic with hypothetical global floor c = 0.003956:")
print("Boundary-paid largest W before clipping:", W)
print("Signed-boundary cap at W=252:", str(c * 252 + sharp_boundary))
assert c * 252 + sharp_boundary < 1

try:
    from mpmath import mp
except ImportError:
    print("mpmath unavailable: skipping high-precision numerical diagnostics")
else:
    mp.dps = 80
    real = lambda x: mp.mpf(x.numerator) / x.denominator
    r = mp.sqrt(2)
    H = mp.mpf(3) / 2 - mp.cot(1 / r) / r
    for w in [W - 1, W, W + 1]:
        total = min(c * w - sharp_boundary, Q(1))
        m = w + 6
        value = (H - mp.mpf(6) * (m - 1) / (3000 * m)) / (1 - real(total) / m)
        print("W", w, "c_eff", mp.nstr(real(total / w), 26),
              "conditional projection", mp.nstr(value, 26))
    print("\nDifferent inputs, not conflicting evaluations:")
    for y in [mp.mpf("0.4"), mp.mpf(0.4)]:
        f = lambda u: mp.cos(r * u) / (r * mp.sin(1 / r)) * mp.exp(2 * mp.pi * y * u)
        value = mp.quad(f, [-mp.mpf("0.5"), mp.mpf("0.5")])
        print("imaginary input", mp.nstr(y, 60), "K", mp.nstr(value, 60))
