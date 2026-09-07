# Status note — end of day, 2026-09-07

Written for whoever picks this up next (owner or model). The authoritative status table is in `REPORT.md`; this note says where things stand and what to do first.

## Where things stand

- **The constant.** Unconditional, human-reviewed: 0.6725007037. Unconditional for Mathlib's `riemannZeta`, kernel-checked but unreviewed: 0.6728470198 (zeta-lab four-point). Conditional on the `sharp` sweep's coboundary inequality `hcob`: **0.6731094** through `sharp_chain_bound_signed_concrete` (Lean, standard axioms, `lean/Signed.lean` + `lean/SharpPotential.lean`; `hcob` is its only hypothesis).
- **`hcob` for `sharp`.** The rigorous sweep on the page's own arithmetic is transcripted (67 608 431 boxes). Its double-precision proof tape (74 694 256 nodes, 48 006 226 arithmetic obligations) is now **completely verified by an independent compiled interval checker** (`dev/tapecheck`, Rust + `inari`): every leaf and every collapse confirmed at depth 0, nothing refuted, nothing unresolved, 41 minutes on eight threads — `tapecheck_sharp_full.results.json`. The Python/Arb checker (`sweep_proof_arb.py`) is the reference it is compared against; it agrees on the small domain in full and on a 5000+5000 sample of the full tape.
- **The pair certificate's tape** (66 096 127 nodes): checked the same way; 36 of 25 million leaves left unresolved at depth 6, nothing refuted — see the last section of this note.
- **The external review of 69d3f99** (`COMMIT_REVIEW_69d3f99.md`): all six findings confirmed and repaired, plus four more faults found during the repair (kernel tables stopping at distance 30; the tube theorem covering one alternating phase only; the float tube box sticking out of the exact tube; ball-times-itself straddling zero and making sinc-derivative quotients nan). Nineteen negative controls run in the suite. `REVIEW_RESPONSE_69d3f99.md` has the table.
- **Lamzouri stage 5.** Both candidate correction terms refuted (D1 by the review's certified cluster counterexample). Closed as a numerical experiment; counterexamples kept with coordinates.
- **Suite.** `check_arb.js` green with every transcript fresh; `tapecheck_test.js`, `test.js` and the DOM smoke test green on the idle machine at the end of the day (the smoke test times out while eight checker threads are running).

## What to do first, next day

1. **Rerun `node dev/ui_dom_smoke.js` and `sh dev/run_suite.sh` idle** (with `ARB_PYTHON` pointing at a python-flint interpreter — the scratch venv is gone with the session; `pip install python-flint` into a fresh venv takes a minute). Expect green.
2. **Resolve the pair tape's 36 leftover leaves** (last section) and record the pair status in `REPORT.md`'s table.
3. **The gap that matters now is the import into Lean.** `hcob` is supported by a complete independent check but is still a hypothesis of the theorem. Options, in order of value: a Lean-checkable certificate per obligation (the tape plus the checker's box verdicts, replayed by a verified checker), or a verified re-implementation of the checker's interval kernel. Neither is started.
4. Smaller items: `tapecheck` has two harmless compiler warnings (an unused `cos_i`, an unused binding) — fixing them changes the source hash, so regenerate `tapecheck_sharp_full.results.json` (41 min) if you touch it; `sweep_proof_aggregate.py` is only needed for the Python shard route, which is no longer the plan.

## Commands

```
cd riemann-stab/dev/tapecheck && cargo build --release && cd ..
tapecheck/target/release/tapecheck --meta=sweep_proof_sharp_full.json --threads=8 --out=tapecheck_sharp_full.results.json   # 41 min
tapecheck/target/release/tapecheck --meta=sweep_proof_pair_full.json  --threads=8 --out=tapecheck_pair_full.results.json    # ~40 min
node tapecheck_test.js
ARB_PYTHON=<venv python> node check_arb.js
node build.js && node ui_dom_smoke.js
```

## The pair tape's check, as the day ended

`tapecheck_pair_full.incomplete.results.json` (66 096 127 nodes, 41 011 669 obligations, 40 min): **all 15 911 588 collapses confirmed; 25 100 045 of 25 100 081 leaves confirmed; nothing refuted; 36 leaves beyond the compiled checker's depth-6 resolution.** Status `incomplete`, deliberately — the file is named so the suite does not treat it as a complete record. Two things to know before touching it:

- The 36 unresolved leaves are all huge far-corner boxes of the cube-28 domain (coordinates up to 28, widths 13–26, adjacent to the tube slabs; root index and tape offset are listed in the file). On such a box the piecewise-linear additive terms range over their whole oscillation, so the natural bound is loose and bisecting the widest coordinate (the 28-wide ones) does not tighten the terms that matter. The sweep discharged them with its own enclosure. A targeted re-examination should bisect the coordinates the additive terms depend on (those still inside the knot range), or use the Python/Arb checker with `--refine=10` on just those roots. They are 36 of 25 million; nothing suggests a refutation.
- The compiled checker's check "R at the alternating block encloses E_alt" failed, and that is a **wrong expectation in the check, not a fault in the arithmetic**: by `tube_arb.py` the certificate's value at the pinned centre is `E_alt − 2.19e−15`, so an interval of width 1e-14 around it need not reach `E_alt`. The check should compare against `E_alt − shortfall` (or just require |R − E_alt| < 1e-12). It was left as is because changing `tapecheck/src/main.rs` invalidates the hash the sharp record carries; fix it and regenerate both records together next time (about 80 minutes of compute).
