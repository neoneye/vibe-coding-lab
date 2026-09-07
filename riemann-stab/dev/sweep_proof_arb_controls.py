"""Controls for the tape checker: forged and mutated proof objects it MUST refuse,
and enclosure properties its primitives MUST have.

A checker is only evidence if it can say no.  A review (COMMIT_REVIEW_69d3f99)
built a one-byte tape -- a single "tube" leaf on the no-tube sharp candidate,
target 1000 -- and the checker of that day answered "8 checks, 0 failed" having
evaluated nothing; it also exited 0 with an obligation left unresolved, and its
range primitives returned intervals that missed the exact value by an ulp.  Each
of those is a control here, with the mutations the review asked for: a forged
tube leaf, an altered coefficient, a deleted subtree, a wrong collapse direction.
Everything is written to a temporary directory; no committed artefact is touched.

Run:  python3 dev/sweep_proof_arb_controls.py     (needs python-flint; about a minute)
"""
import contextlib
import hashlib
import io
import json
import os
import random
import sys
import tempfile
from fractions import Fraction

from flint import arb, ctx

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import sweep_proof_arb as checker        # noqa: E402
import kernel_pieces_arb as kernel       # noqa: E402

CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok)))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def run_checker(meta_path, out_path, extra=()):
    """Run the checker in-process on a metadata file; return (exit code, results, log)."""
    saved = sys.argv
    sys.argv = ["sweep_proof_arb.py", "--meta=" + meta_path, "--out=" + out_path] + list(extra)
    checker.CHECKS.clear()
    checker.CONFLICTS.clear()
    log = io.StringIO()
    try:
        with contextlib.redirect_stdout(log):
            rc = checker.main()
    except Exception as e:                       # a crash is a refusal too, but a bad one
        rc = "crash: %r" % (e,)
    finally:
        sys.argv = saved
    res = json.load(open(out_path)) if os.path.exists(out_path) else None
    return rc, res, log.getvalue()


def failed_names(res):
    return [c["name"] for c in (res or {}).get("checks", []) if not c["ok"]]


def as_ball(q):
    return arb(q.numerator) / arb(q.denominator)


def main():
    ctx.prec = 200
    scratch = tempfile.mkdtemp(prefix="sweep-proof-controls-")
    base_meta = json.load(open(os.path.join(here, "sweep_proof_sharp_small.json")))
    base_tape = open(os.path.join(here, base_meta["tape"]), "rb").read()
    cand_name = base_meta["candidate"]
    bundle = json.load(open(os.path.join(here, "tiling_additive.certificate.json")))
    sharp = next(c for c in bundle["certificates"] if c["name"] == "sharp")

    def write_case(name, tape, **over):
        meta = dict(base_meta)
        meta.update(over)
        tpath = os.path.join(scratch, name + ".bin")
        open(tpath, "wb").write(tape)
        meta["tape"] = tpath
        meta["tape_sha256"] = hashlib.sha256(tape).hexdigest()
        meta.update({k: v for k, v in over.items() if k == "tape_sha256"})
        mpath = os.path.join(scratch, name + ".json")
        json.dump(meta, open(mpath, "w"), indent=1)
        return mpath, os.path.join(scratch, name + ".results.json")

    print("Controls for dev/sweep_proof_arb.py, in %s\n" % scratch)

    # ---- primitives: enclosures contain independently computed exact values
    q = Fraction
    knots, a, b = sharp["knots"], sharp["a"], sharp["b"]
    bad = 0
    rnd = random.Random(69)
    for _ in range(300):
        x = rnd.uniform(knots[0], knots[-1])
        i = checker.cell(knots, x)
        t = (q(x) - q(knots[i])) / (q(knots[i + 1]) - q(knots[i]))
        exact = q(a[i]) * (1 - t) + q(a[i + 1]) * t
        if as_ball(exact) not in checker.pl_range(knots, a, x, x):
            bad += 1
        slope = (q(a[i + 1]) - q(a[i])) / (q(knots[i + 1]) - q(knots[i]))
        if knots[i] < x < knots[i + 1] and as_ball(slope) not in checker.pl_slope_range(knots, a, x, x):
            bad += 1
    x = 1.85
    i = checker.cell(knots, x)
    t = (q(x) - q(knots[i])) / (q(knots[i + 1]) - q(knots[i]))
    exact = q(a[i]) * (1 - t) + q(a[i + 1]) * t
    check("pl_range at a point contains the exact rational interpolant (the review's 1.85 and 300 random points)",
          bad == 0 and as_ball(exact) in checker.pl_range(knots, a, x, x))
    slope0 = (q(a[1]) - q(a[0])) / (q(knots[1]) - q(knots[0]))
    check("pl_slope_range at 0.05 contains the exact rational slope of that cell",
          as_ball(slope0) in checker.pl_slope_range(knots, a, 0.05, 0.05))
    P = kernel.pieces(30.0)
    check("the kernel point range at 0.5 contains the direct Arb evaluation, as a ball",
          kernel.weight(arb(0.5)) in P.w_range(0.5, 0.5)
          and kernel.weight_d(arb(0.5)) in P.wd_range(0.5, 0.5))
    # a bilinear cell: exact rational bilinear value inside grid_range at a point
    cand = json.load(open(os.path.join(here, "tiling_pair.stationary.json")))
    J = len(cand["knots"])
    grid = cand["coefficients"][:J * J]
    bad = 0
    for _ in range(200):
        x = rnd.uniform(cand["knots"][0], cand["knots"][-1])
        y = rnd.uniform(cand["knots"][0], cand["knots"][-1])
        i, j = checker.cell(cand["knots"], x), checker.cell(cand["knots"], y)
        kx0, kx1 = q(cand["knots"][i]), q(cand["knots"][i + 1])
        ky0, ky1 = q(cand["knots"][j]), q(cand["knots"][j + 1])
        fx, fy = (q(x) - kx0) / (kx1 - kx0), (q(y) - ky0) / (ky1 - ky0)
        v = ((1 - fx) * ((1 - fy) * q(grid[i * J + j]) + fy * q(grid[i * J + j + 1]))
             + fx * ((1 - fy) * q(grid[(i + 1) * J + j]) + fy * q(grid[(i + 1) * J + j + 1])))
        if as_ball(v) not in checker.grid_range(grid, J, cand["knots"], x, x, y, y):
            bad += 1
    check("grid_range at a point contains the exact rational bilinear value (200 random points)", bad == 0)
    T = arb(0.003956)
    below = T - arb(1) / arb(2) ** 70
    check("a value 2^-70 below the target is not accepted by the ball comparison the verdicts use",
          not (below.lower() >= T) and float(below.lower()) >= 0.003956,
          "the float comparison would have accepted it")

    # ---- positive control: the committed small sharp tape passes, in sample mode
    m, o = write_case("intact", base_tape)
    rc, res, _ = run_checker(m, o)
    check("the intact small sharp tape passes in sample mode", rc == 0 and res["status"] == "sample",
          "exit %s" % rc)

    # ---- the review's forged tube leaf: one byte, no tube theorem, target 1000
    m, o = write_case("forged_tube", bytes([checker.LEAF_TUBE]), cube=0.5, tubeRadius=0, target=1000,
                      roots=1, nodes=1, leaves=1, splits=0, collapses=0, unresolved=0)
    rc, res, _ = run_checker(m, o, ["--all"])
    check("a forged one-byte tube-leaf tape on the no-tube candidate is refused",
          rc == 1 and any("tube leaf" in n for n in failed_names(res)), "exit %s" % rc)

    # ---- the same forgery claiming a tube radius: the theorem is not about this candidate
    m, o = write_case("forged_tube_radius", bytes([checker.LEAF_TUBE]), cube=0.5, tubeRadius=0.008, target=1000,
                      roots=1, nodes=1, leaves=1, splits=0, collapses=0, unresolved=0)
    rc, res, _ = run_checker(m, o, ["--all"])
    check("claiming a tube radius for the sharp candidate is refused: no tube theorem is about it",
          rc == 1 and any("tube theorem" in n for n in failed_names(res)), "exit %s" % rc)

    # ---- one unresolved obligation in full mode is a failure, not a pass
    m, o = write_case("unresolved", bytes([checker.LEAF_BOUND]), cube=0.5, tubeRadius=0, target=6,
                      roots=1, nodes=1, leaves=1, splits=0, collapses=0, unresolved=0)
    rc, res, _ = run_checker(m, o, ["--all"])
    check("a full check with one unresolved obligation exits 1 with status incomplete",
          rc == 1 and res["status"] == "incomplete" and res["leaf_sample"]["beyond_resolution"] == 1,
          "exit %s, status %s" % (rc, res and res["status"]))

    # ---- a --limit run is partial and says so
    m, o = write_case("limited", base_tape)
    rc, res, _ = run_checker(m, o, ["--all", "--limit=50"])
    check("a --limit run is refused as incomplete (obligations skipped)",
          rc == 1 and res["status"] == "incomplete" and res["shard_obligations"]["skipped_leaves"] > 0)

    # ---- deleted subtree: the tape ends early / a leaf is missing in the middle
    m, o = write_case("truncated", base_tape[:-1])
    rc, res, _ = run_checker(m, o)
    check("a tape with its last byte deleted is refused", rc == 1)
    leaf_positions = [i for i, op in enumerate(base_tape) if op == checker.LEAF_BOUND]
    cut = leaf_positions[len(leaf_positions) // 2]
    m, o = write_case("leaf_deleted", base_tape[:cut] + base_tape[cut + 1:])
    rc, res, _ = run_checker(m, o)
    check("a tape with one leaf deleted from the middle is refused", rc == 1, "exit %s" % rc)
    # replace a split by a discharged leaf: the subtree under it vanishes
    split_positions = [i for i, op in enumerate(base_tape) if op < checker.OP_LO]
    sp = split_positions[len(split_positions) // 3]
    depth = 0
    end = sp
    # find the extent of the subtree rooted at sp (preorder, one byte per node)
    while True:
        op = base_tape[end]
        end += 1
        if op < checker.OP_LO:
            depth += 1
        elif op >= checker.LEAF_BOUND:
            depth -= 1
        if depth == 0:
            break
    mutated = base_tape[:sp] + bytes([checker.LEAF_BOUND]) + base_tape[end:]
    m, o = write_case("subtree_deleted", mutated)
    rc, res, _ = run_checker(m, o, ["--all"])
    check("a tape with a whole subtree replaced by one discharged leaf is refused "
          "(the node counts disagree, or the box does not clear the target)", rc == 1,
          "exit %s" % rc)

    # ---- wrong collapse direction: every collapse flipped
    flipped = bytes((op + 8 if checker.OP_LO <= op < checker.OP_HI
                     else op - 8 if checker.OP_HI <= op < checker.LEAF_BOUND else op)
                    for op in base_tape)
    m, o = write_case("collapses_flipped", flipped)
    rc, res, _ = run_checker(m, o)
    check("flipping every collapse direction is refused, with refutations",
          rc == 1 and res["collapse_sample"]["refuted"] > 0,
          "%s collapses refuted" % (res and res["collapse_sample"]["refuted"]))

    # ---- altered coefficient: a bilinear correction that depends on g_0 only
    alt = json.load(open(os.path.join(here, cand_name)))
    J = len(alt["knots"])
    coef = list(alt["coefficients"])
    for i in range(J):
        for j in range(J):
            coef[i * J + j] = -1.0 * i / J
    alt["coefficients"] = coef
    alt_path = os.path.join(scratch, "altered_candidate.json")
    json.dump(alt, open(alt_path, "w"))
    m, o = write_case("altered_coefficient", base_tape, candidate=alt_path)
    rc, res, _ = run_checker(m, o)
    check("an altered pair coefficient is refused, with refuted leaves",
          rc == 1 and res["leaf_sample"]["refuted"] > 0,
          "%s leaves refuted" % (res and res["leaf_sample"]["refuted"]))

    # ---- a raised target
    m, o = write_case("raised_target", base_tape, target=0.01)
    rc, res, _ = run_checker(m, o)
    check("a raised target is refused, with refuted leaves",
          rc == 1 and res["leaf_sample"]["refuted"] > 0)

    # ---- a wrong tape digest
    m, o = write_case("wrong_digest", base_tape, tape_sha256="0" * 64)
    rc, res, _ = run_checker(m, o)
    check("metadata whose digest does not match the tape is refused", rc == 1)

    # ---- an unknown opcode / a coordinate out of range
    m, o = write_case("bad_opcode", bytes([0x06]) + base_tape[1:])
    rc, res, _ = run_checker(m, o)
    check("an opcode with a coordinate out of range is refused", rc == 1, "exit %s" % rc)

    # ---- provenance is taken at the start and recorded
    m, o = write_case("provenance", base_tape)
    before = checker.arb_provenance.hash_inputs(["sweep_proof_arb.py", "kernel_pieces_arb.py"])
    rc, res, _ = run_checker(m, o)
    check("the results carry the source hashes taken at the start, and the replay command with its options",
          rc == 0 and all(res["inputs"][k] == v for k, v in before.items())
          and res["inputs_hashed"].startswith("at start") and res["replay"].startswith("python3 dev/sweep_proof_arb.py --meta="))

    failed = [x for x in CHECKS if not x[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(failed)))
    if not failed:
        json.dump({
            "what": "controls for the tape checker: forged and mutated proof objects refused, "
                    "enclosure primitives contain independently computed exact values",
            "engine": "python-flint / Arb, %d bits" % ctx.prec,
            "inputs": checker.arb_provenance.hash_inputs(
                ["arb_provenance.py", "sweep_proof_arb_controls.py", "sweep_proof_arb.py",
                 "kernel_pieces_arb.py", "coercivity_arb.py", "sweep_proof_sharp_small.json",
                 "tiling_sharp.candidate.json", "tiling_pair.stationary.json",
                 "tiling_additive.certificate.json"]),
            "replay": "python3 dev/sweep_proof_arb_controls.py",
            "checks": [{"name": n, "ok": ok} for n, ok in CHECKS],
        }, open(os.path.join(here, "sweep_proof_arb_controls.results.json"), "w"), indent=2, sort_keys=True)
        print("wrote dev/sweep_proof_arb_controls.results.json")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
