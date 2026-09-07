# Investigation report

One authoritative status table, then a dated log. Everything below was executed against `CLAUDE_INVESTIGATION_PLAN.md`, `CLAUDE_FOLLOWUP_PLAN.md` and `COMMIT_REVIEW_69d3f99.md`, each claim verified before being acted on. Companion files: `CLAIM_LEDGER.md`, `ASSEMBLY_AUDIT.md`, `LAB_F_AUDIT.md`, `LAMZOURI_STABILITY.md`, `REVIEW_RESPONSE_69d3f99.md`, `lean/README.md`, and the scripts in this directory.

## Status (authoritative; last updated 2026-09-07, after the review of 69d3f99)

| item | status | evidence | what is *not* established |
|---|---|---|---|
| Unconditional record, human-reviewed | **0.6725007037** | arXiv:2608.13637, reproof 2609.02882 (Lean) | — |
| Unconditional for Mathlib's `riemannZeta`, kernel-checked, unreviewed | **0.6728470198** | zeta-lab four-point bridge, rebuilt here (8905 jobs, standard axioms) | statement faithfulness not human-reviewed |
| Assembly: conservative window-sum theorem | **proved** (`n_point_bound_of_windowSum`, standard axioms) | `lean/window-sum.patch`, `lean/build-axioms.log` | — |
| Assembly: signed-endpoint theorem | **proved** (`n_point_bound_signed`, `sharp_chain_bound_signed_concrete`; standard axioms) | `lean/Signed.lean`, `lean/SharpPotential.lean` | the only hypothesis left is `hcob`, the sweep's coboundary inequality; no mechanism imports a checker verdict into Lean |
| Conditional projection, `sharp`, signed cap (`W = 252`) | **0.6731094**, conditional on `hcob` | `projection.py`; Lean instance above | `hcob` |
| Conditional projection, `sharp`, conservative | **0.6731051**, conditional on `hcob` and the tail lemma | `projection.py` | same |
| `hcob` for `sharp`: rigorous sweep on the page's arithmetic | **transcripted**: 67 608 431 boxes, checksum `37308f214a50bb25`, current input hashes, 4764.8 s | `tiling_interval.results.json` (`rigorousRuns`), pinned floor 0.003956 | not replayed by the suite (79 min); the page's own arithmetic |
| `hcob` for `sharp`: independent Arb check of the double-precision proof tape (74 694 256 nodes) | **structure verified for every node; arithmetic on a 5000+5000 sample: 5000/5000 leaves, 5000/5000 collapses confirmed, 0 refuted, 0 unresolved** under the checker frozen on 2026-09-07 | `sweep_proof_sharp_full.sample5000.results.json` | **complete arithmetic verification: running** under the frozen checker (eight root-range shards, `sweep_proof_aggregate.py` will combine them; expected ~8 h wall). The eight shards that ran overnight on 2026-09-06/07 executed unfrozen, since-repaired code and are **diagnostics only** (0 refuted, 13 unresolved of 48M) |
| `hcob` for `sharp`, small domain (cube 1.6, 8662 nodes) | **complete**: 3869/3869 leaves, 988/988 collapses, status `complete` | `sweep_proof_sharp_small.results.json` | — |
| Tape checker soundness | **repaired and controlled**: 19 negative/positive controls in the suite; ranges built from exact ball endpoints; breakpoint tables proved complete; tables sized to the tape; tube exclusion bound to its theorem; provenance at start; no exit 0 with anything unresolved | `sweep_proof_arb_controls.py` (`check_arb.js`), `REVIEW_RESPONSE_69d3f99.md` | it checks a double-precision sweep's claims in Arb; it is not Lean |
| Pair certificate, floor `E_alt − 2.19e−15` | exterior sweep on the page's arithmetic (75M boxes); **tubes in Arb for both phases** (2026-09-07: phase 1 had no certificate before); small tape 220/220 + 220/220 in Arb; cube-28 tape (66 096 127 nodes) structurally verified, 5000+5000 sample at refine 2: 4998 leaves and 4983 collapses confirmed, 0 refuted, 2 + 17 unresolved; the two excluded root pieces lie exactly inside the certified tubes of their phases | `tube_arb.results.json`, `sweep_proof_arb.results.json`, `sweep_proof_pair_full.results.json` | no complete independent arithmetic check; inside the tubes the floor is `E_alt − 2.19e−15`, not the tape's target |
| Lamzouri slack decomposition (stage 5) | **numerical experiment, closed**: six discarded pieces reproduce the slack to 1e−13; both candidate corrections **refuted** (`D1` by the review's certified cluster counterexample, `Dall` by off-line pairs) | `LAMZOURI_STABILITY.md`, `lamzouri_slack.counterexamples.json` | no universal correction term found |
| Suite | green end to end with `ARB_PYTHON` set (last full run 2026-09-08; fast subset and `check_arb.js` re-run after the review repairs) | `sh dev/run_suite.sh` | the 79-min rigorous sweep is not part of it |

**One prioritised next step.** Let the complete `sharp` verification finish under the frozen checker and aggregate it; if it reads `complete`, the coboundary premise `hcob` is supported by an independent Arb check of every obligation of the double-precision tape (still not by Lean). Then the pair tape the same way.

## Log

### 2026-09-07 — first pass (`CLAUDE_INVESTIGATION_PLAN.md`)

Reproduced: every Arb transcript re-runs and agrees under python-flint 0.9.0; the zeta-lab bridge builds here with standard axioms for all seven advertised declarations; the page's projection formula equals the Lean `Phi_n` term for term and reproduces every headline number at 40 digits. Corrected: `‖f_z‖² = K(0) = 1` → `K(z − z̄)`; the note's Arb sample counts 64/59 → 39/67 (the transcript's); `pl_range` float interpolation → ball arithmetic; "not checkable" → the assembly is Lean. Identified the missing lemma and formalised the window-sum variant (`n_point_bound_of_windowSum`, `windowSum_of_telescoping`, `sharp_chain_bound_of_windowSum`).

### 2026-09-07 — second pass (`CLAUDE_FOLLOWUP_PLAN.md`)

All three reviewer findings confirmed. (A) The endpoint loss of a telescoping certificate is the oscillation `B` of its state potential, `2·osc(a) + 2·osc(a+b)` for the additive family, not the tail amplitude: `sharp` 0.00170904 (not 0.00128178), pinned pair 0.00814654 by an exact DP over the union knot grid. (B) The rigorous `sharp 0.003956` row was absent from `tiling_interval.results.json`; it was re-run (79 min, 67 608 431 boxes — the historical count exactly — checksum `37308f214a50bb25`) and committed, the pinned transcripted floor raised from 0.0038 to 0.003956, the tripwire updated, and the 14 legacy rows without provenance hashes regenerated identically. (C) The Arb tape sample belonged to the cube-1.6 pair tape only; attributions fixed. (D) The reviewer's 20-digit `K(0.4i)` was for the exact-decimal input and correct; the oracle now checks both inputs. Newly established: the signed-endpoint extension is a theorem (`Signed.lean`: `offset_average_indexed`, the signed S11/S13/S9 chain, `pre_solve_signed`, `n_point_bound_signed`); the shipped `sharp` potential and its bounds are formalised (`SharpPotential.lean`, integers over 2^68); `sharp_chain_bound_signed_concrete` has `hcob` as its only hypothesis. Certificate selection: `sharp` wins both scores once endpoints are paid. Stage 5 (Lamzouri slack) conducted.

### 2026-09-07 — proof tapes for `sharp`, overnight

The tape machinery was parametrised for the `sharp` certificate alone (`tiling_sharp.candidate.json`), the checker gained an all-nodes mode with checkpoints and verified subdivision (`--refine`). Small domain (8662 nodes): at depth 0 the checker first confirmed 344/3869 leaves and 281/988 collapses; a disjoint-enclosure control then found two faults — ball-to-float conversions rounding to nearest (1407 conflicts at point boxes) and pair-distance intervals straddling zero against positive-only breakpoint tables (20 conflicts on wide origin-face boxes, natural enclosures wrong by 10×) — and with the pair distance enclosed exactly as the sum of gap intervals everything resolved: 3869/3869 and 988/988 at depth 0, pair tape 220/220. The full cube-16 tape (74 694 256 nodes, 26 688 759 leaves, 21 317 467 collapses) was structurally verified and a complete arithmetic verification launched in eight shards. **Those shards are diagnostics only**: they started before edits to the checker landed and hashed the sources at completion (review issue 3), and the checker they ran is now known to have had further faults (below).

### 2026-09-07 — `COMMIT_REVIEW_69d3f99.md` (external), all six findings confirmed and repaired

See `REVIEW_RESPONSE_69d3f99.md` for the table. In brief: (1) hulls were taken through nearest-rounded floats and the acceptance comparison was in floats — every hull is now from exact ball endpoints, comparisons between exact balls, and breakpoint completeness is *proved* by interval bisection between certified roots; while repairing this, (1c) the kernel tables were found to stop at distance 30 whatever the tape (a "range" beyond 30 was the hull of two endpoint values; `w`'s maxima near 96 are `7.6e−6`) — the limit now follows the cube. (2) A forged tube leaf passed — tube leaves are refused, and the tube *exclusion* is bound to `tube_arb.py`'s theorem by hash and exact geometry; while binding it, (2b) the theorem was found to cover phase 0 only while the sweep excludes both phases and the pair candidate is not reversal-symmetric, and the sweep's float box sticks `6.9e−18` out of the exact tube — `tube_arb.py` now certifies both phases at radius 0.00800000000000001. (3) Provenance is hashed at start, carried in checkpoints, re-hashed at the end. (4) No sampling in all-nodes mode; obligations identified by root and offset; a strict aggregator. (5) Unresolved obligations fail a full check; a `status` field. (6) `D1` refuted; counterexamples with coordinates preserved. Nineteen controls (`sweep_proof_arb_controls.py`) run in `check_arb.js`; every transcript the checker writes was regenerated under the repaired checker: pair small 220/220 + 220/220; sharp small complete; sharp full 5000/5000 + 5000/5000 sample, 0 refuted, 0 unresolved. The complete `sharp` verification was relaunched under the frozen checker.

## Deliverables, against the follow-up plan's list

1. **Corrected oracle and claim ledger** — `labf_oracle.py`, `CLAIM_LEDGER.md`.
2. **Pinned upstream, patch, build commands, statements, axiom logs** — `lean/README.md`, `lean/window-sum.patch` (applies cleanly to a fresh clone at `47d0241`), `lean/Signed.lean`, `lean/SharpPotential.lean`, `lean/build-axioms.log`.
3. **Runnable projection calculation** — `projection.py`, `endpoint_oscillation.py`, `signed_endpoint_model.py`.
4. **The selected certificate and its verification coverage** — the status table above; the checker and its controls; `sweep_proof_aggregate.py` for the sharded complete check.
5. **Which statement is proved and which hypotheses remain** — proved: everything from the certificate to the proportion of zeros, for Mathlib's `riemannZeta`, with the shipped `sharp` potential and its bounds inside Lean. Remaining: `hcob`, the coboundary inequality on every window of every sorted 258-point list (the sweep's claim, on this page's arithmetic; Arb-checked on samples; complete check running).

Not done: the eight-point route with amplitude control (payoff `+2·10⁻⁵`, needs a certificate that does not exist and a seven-dimensional sweep); the pressure re-optimisation at integer `p` (ceilings move by `3·10⁻⁸`).

## Commands

```
node dev/test.js && node dev/labs_shipcheck.js && node dev/tiling_pressure_test.js && node dev/build.js && node dev/ui_dom_smoke.js
ARB_PYTHON=<venv with python-flint> node dev/check_arb.js          # every Arb unit, controls included
<venv python> dev/sweep_proof_arb.py --all --meta=sweep_proof_sharp_small.json --out=sweep_proof_sharp_small.results.json
<venv python> dev/sweep_proof_arb.py --all --meta=sweep_proof_sharp_full.json --roots=a:b --out=<shard.json>   # x8, then
<venv python> dev/sweep_proof_aggregate.py sweep_proof_sharp_full.json <out.json> <shard.json>...
<venv python> dev/investigation/review_probes_69d3f99.py            # the reviewer's probes, against the repaired code
python3 dev/investigation/lamzouri_slack.py
node dev/sweep.js rigorous sharp 0.003956                           # 79 min
# Lean: see dev/investigation/lean/README.md
```
