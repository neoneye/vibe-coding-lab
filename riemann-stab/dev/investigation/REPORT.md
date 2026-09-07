# Investigation report — 2026-09-07 (second pass, after `CLAUDE_FOLLOWUP_PLAN.md`)

Executed against `CLAUDE_INVESTIGATION_PLAN.md` and then `CLAUDE_FOLLOWUP_PLAN.md`, each claim verified before being acted on. Companion files: `CLAIM_LEDGER.md`, `ASSEMBLY_AUDIT.md`, `LAB_F_AUDIT.md`, `lean/README.md`, and the scripts `labf_oracle.py`, `endpoint_oscillation.py`, `projection.py`, `signed_endpoint_model.py`, `followup_checks.py` (the reviewer's).

## 1. Reproduced, corrected, refuted, newly established

**Reproduced.** Every Arb transcript re-runs and agrees under python-flint 0.9.0. The zeta-lab bridge builds on this machine (8905 jobs) with standard axioms for all seven advertised declarations. The page's projection formula equals the Lean `Phi_n` term for term and reproduces every headline number at 40 digits. The reviewer's exact-fraction endpoint oscillations reproduce to the last digit.

**Corrected (first pass).** `‖f_z‖² = K(0) = 1` → `K(z − z̄)`. The note's Arb sample counts 64/59 → 39/67 (the transcript's). `pl_range` float interpolation → ball arithmetic (counts unchanged). "Not checkable" → the assembly is Lean.

**Corrected (second pass, all three reviewer findings confirmed).** (A) The endpoint loss of a telescoping certificate is the oscillation `B` of its state potential, `2·osc(a) + 2·osc(a+b)` for the additive family, not the tail amplitude: `sharp` 0.00170904 (not 0.00128178), pinned pair 0.00814654 by an exact dynamic programme over the union knot grid (not the guessed 0.00528). The state potentials were verified by expansion against the shipped corrections. (B) The rigorous `sharp 0.003956` row is **absent** from `tiling_interval.results.json` (the rigorous rows stop at `compact 0.0038`); a re-run was started and is recorded below. (C) The Arb tape sample (39/220, 67/220) belongs to the committed cube-1.6 pair tape only; `REPORT.md` and `ASSEMBLY_AUDIT.md` had attached it to the 75M-box exterior sweep and to the additive floor, both wrong, both fixed. (D) The reviewer's 20-digit `K(0.4i)` was for the exact decimal input and is correct; my oracle had evaluated the binary64 nearest 0.4 and mis-called it. The oracle now checks both, converts coordinates to high precision before subtracting, and recomputes constants inside the active precision context. Ledger wording "Arb-grade"/"enclosure-grade" for the oracle → "high-precision numerical comparison, no proved enclosure".

**Refuted.** Nothing on the page; my own first-pass endpoint bound and my first-pass reading of the reviewer's decimal.

**Newly established.** The signed-endpoint extension is a theorem (`n_point_bound_signed`, see `lean/README.md`), so `sharp`'s conditional projection is 0.6731094 with no endpoint penalty. The window-sum variant of the assembly is a theorem: `n_point_bound_of_windowSum` and the adapter `windowSum_of_telescoping` compile in a branch of zeta-lab with standard axioms, the upstream theorem is re-derived from them as a regression, and the instance `sharp_chain_bound_of_windowSum` states the conditional bound at `c = 394924/10⁸`, `m = 259` (`lean/README.md`). The finite bookkeeping of the signed-endpoint route checks exactly: the total endpoint term over all consecutive full blocks telescopes to at most `W·B`, and the S13 clipping survives under `c·W + B ≤ 1`, which `sharp` meets at `W = 252`.

## 2. Strongest auxiliary-chain statement and its coverage

Unchanged from the first pass in content, corrected in attribution: `R(g) ≥ E_alt − 2.2e−15` for every six-gap block (pinned pair certificate), tubes in Arb, exterior by exhaustive subdivision on the page's own arithmetic with **no** independent arithmetic check of the exterior; the Arb tape sample covers the small cube-1.6 configuration only. For `sharp`: `R ≥ 0.003956` on `[0,16]⁶` is a historical rigorous report without a committed transcript.

## 3. Strongest supported zero-count conclusion, with dependencies

- Unconditional, human-reviewed: 0.6725007037.
- Unconditional for Mathlib's `riemannZeta`, kernel-checked, rebuilt here, unreviewed: 0.6728470198 (zeta-lab four-point).
- Conditional, conservative: **0.6731051** (`sharp`), requiring (a) `sharp_chain_bound_of_windowSum` — **proved**; (b) the coboundary inequality `R ≥ 0.003956` on every window — exhaustive subdivision on the page's arithmetic, **rigorous transcript absent, re-run in progress**; (c) the endpoint bound `B` — exact rationals, the piecewise-linear-extrema step not formalised; (d) the tail lemma at `sharp`'s amplitude.
- Conditional, signed-cap: **0.6731094** (`sharp` at `W = 252`), through `sharp_chain_bound_signed_concrete` — **proved**, with the shipped state potential defined in Lean and its bounds theorems (`SharpPotential.lean`); the only remaining premise is the sweep's coboundary inequality `hcob` (premises (b) and (d) above; (c) is now discharged).

For comparison: zeta-lab's conditional eight-point 0.6730530; its measured seven-point per-block family ceiling 0.6730296. The `p : ℕ` in the theorem means the pressure optimum 3370.45 of the note needs integer neighbours.

## 4. Decisions and status of the plan's stages

- Follow-up step 1 (corrections): done, witnesses preserved (`followup_checks.py`, `endpoint_oscillation.py`, oracle).
- Step 2 (conservative window-sum theorem): **done**; the piecewise-linear bounds of the shipped `sharp` potential are also formalised (`SharpPotential.lean`).
- Step 3 (signed endpoint through S15): **done in Lean** (`Signed.lean`: `offset_average_indexed`, the signed S11/S13/S9 chain, `pre_solve_signed`, `n_point_bound_signed`, `sharp_chain_bound_signed`; standard axioms, 2026-09-08). The finite model was the exact-rational rehearsal of the same bookkeeping.
- Step 4 (certificate selection): `sharp` wins on both scores among the shipped certificates once endpoints are paid; the pair certificate's larger oscillation makes it worse conservatively and only marginally better under the signed cap.
- Step 5 (certification of the selected input): the rigorous `sharp` sweep is being restored; independent arithmetic verification of that additive sweep does not yet exist and its cost has not been benchmarked.
- Original stage 5 (Lamzouri stability slack): **deferred**, not conducted.
- Suite: the legacy transcript failure stays a failure; the Lean/axiom checks were run directly.

## 5. One prioritised next step

The rigorous `sharp 0.003956` transcript (re-run in progress) and then an independent arithmetic check of that additive sweep — the certificate's numerical premise `hcob` is now the *only* thing between `sharp_chain_bound_signed_concrete` and a theorem about ζ at 0.6731094; the piecewise-linear bounds are formalised.


## Independent verification of the `sharp` sweep: proof tapes (2026-09-08)

The proof-tape machinery (`sweep_proof.js` / `sweep_proof_arb.py`) was parametrised so it can be pointed at the `sharp` certificate alone (`tiling_sharp.candidate.json`: the `sharp` base with every pair correction zero; no tube; target 0.003956), and the checker gained an all-nodes mode with checkpoints and a verified-subdivision mode (`--refine=D`: an unresolved box is bisected up to depth `D`; any refuted sub-box refutes, confirmation needs every sub-box).

Small domain first (cube 1.6, 64 roots, 8662 nodes, 3869 discharged leaves, 988 collapses): structure checked for every node, and **every** arithmetic obligation evaluated in Arb:

| refine depth | leaves confirmed / unresolved / refuted | collapses confirmed / unresolved / refuted | Arb sub-boxes |
|---|---|---|---|
| 0 | 344 / 3525 / 0 | 281 / 707 / 0 | 4 857 |
| 2 | 1100 / 2769 / 0 | 290 / 698 / 0 | 28 271 |
| 4 | 2013 / 1856 / 0 | 299 / 689 / 0 | 88 693 |
| 6 | 2452 / 1417 / 0 | 312 / 676 / 0 | 230 909 |

Nothing refuted at any depth. The discharged-leaf claims resolve with subdivision (63% at depth 6 and still rising); the collapse claims — a derivative keeping its sign across a box — barely do, because the checker's gradient enclosure is a natural extension with no centred form, and that is where a better checker would spend its effort. Cost: about 2.3 ms per plain node, so the full cube-16 tape (of order 5·10⁷ nodes) cannot be arithmetically checked in full overnight; its structural check and a refined arithmetic sample are reported below when the emission finishes.

## Rigorous `sharp` sweep, restored

`node dev/sweep.js rigorous sharp 0.003956` completed on 2026-09-07: `complete: true`, 67 608 431 boxes (the historical report's count exactly), 26 117 375 collapses, no counterexample, checksum `37308f214a50bb25:67608431`, 4764.8 s, with current input hashes and its replay command; the row is now in `tiling_interval.results.json` under `rigorousRuns`, the pinned transcripted rigorous floor was consciously raised from 0.0038 to 0.003956, and the tripwire in `tiling_interval_test.js` that asserted "does not yet exceed 19/5000" was updated together with the note's and the page's ladders. The suite's remaining two failures are the 14 legacy rows without provenance hashes; their regeneration (about 25 minutes of sweeps in total) was launched.

**Full-cube tape.** The `sharp` tape on `[0,16]⁶` (double precision, table kernel, target 0.003956): 729 roots, 74 694 256 nodes, 26 688 759 discharged leaves, 21 317 467 collapses, 0 unresolved, emitted in 515 s (75 MB, regenerated on demand, sha256 in `sweep_proof_sharp_full.json`). The checker replays its structure in full with no fault; on a 5000+5000 refined sample (depth 4) it confirmed 4657 leaves and 4798 collapses outright, 0 refuted (a rerun with the repaired checker below is recorded in `sweep_proof_sharp_full.sample5000.results.json`).

**A soundness fault in the checker, found by a negative control.** The 5000-sample run reported 1407 cases where the natural and centred enclosures of one quantity were *disjoint* — impossible if both are enclosures. All were point boxes, the two balls differing by ~1e−20 with radii ~1e−60. Cause: the natural path converted pair-distance balls to Python floats (`float(d.lower())`) before the exact kernel-range lookups, and `span` dropped the midpoint's own radius when its inputs were balls, and the centred value form evaluated the piecewise-linear parts at a rounded centre. Every such conversion is now outward (`math.nextafter`), `span` carries the midpoint radius, and centre evaluations are padded; disjoint pairs are now a failed check that dumps the boxes. After the repair: 0 conflicts on the pair tape, on the small `sharp` domain (every obligation, depth 4: 2013/3869 leaves, 382/988 collapses confirmed, 0 refuted) and on the full-tape sample. The centred form for the gradient (mean-value theorem with `weight_dd`, falling back to the natural range at the kernel's removable singularity) raised collapse confirmations at depth 4 from 299 to 382 of 988.


## Commands

```
node dev/test.js && node dev/labs_shipcheck.js && node dev/tiling_pressure_test.js && node dev/build.js && node dev/ui_dom_smoke.js
ARB_PYTHON=<venv with python-flint> node dev/check_arb.js
node dev/investigation/labf_dump.js && <venv python> dev/investigation/labf_oracle.py
python3 dev/investigation/endpoint_oscillation.py; python3 dev/investigation/projection.py; python3 dev/investigation/signed_endpoint_model.py
python3 dev/investigation/followup_checks.py
node dev/sweep.js rigorous sharp 0.003956
# Lean: see dev/investigation/lean/README.md
```
