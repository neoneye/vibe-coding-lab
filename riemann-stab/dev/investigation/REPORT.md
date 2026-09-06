# Investigation report — 2026-09-07 (interim)

Executed against `CLAUDE_INVESTIGATION_PLAN.md`. Stages 1–3 are done to the plan's completion criteria; stage 4 is started (one soundness repair, transcript re-run, all Arb programs re-run); stages 5–7 are not started, and the reasons are in "Decisions". Everything expensive that was not run is named as not run.

## 1. Reproduced, corrected, refuted, newly established

**Reproduced.** Every Arb transcript in `dev/` re-runs and agrees with its committed result under python-flint 0.9.0 (`check_arb.js` with `ARB_PYTHON`). The sweep proof tape re-checks at 39/220 discharged leaves and 67/220 collapses confirmed, 0 refuted, structure checked on all 27 940 nodes — unchanged after the `pl_range` repair below. The page's projection formula reproduces, in 40-digit `mpmath` from the Lean definition of `Phi_n`, every headline number on the page and every constant in zeta-lab's README.

**Corrected.** (i) `‖f_z‖² = K(0) = 1` on the page and in the spec → `K(z − z̄)`, 1 only for real `z`. (ii) The note's "Arb confirms 64 … 59" → 39 / 67, the transcript's numbers. (iii) `sweep_proof_arb.py:pl_range` now interpolates in ball arithmetic; the previous float interpolation was padded relative to interval width, not magnitude, so its rounding was uncovered by construction even though it never bound numerically. (iv) The note's "not checkable here at all" for the assembly → it is Lean, and the exact missing lemma is stated. (v) "0.6731102697 is the whole of the available improvement" → with the telescoping boundary term paid, 0.6730970 (pair certificate) and 0.6731062 (`sharp`).

**Refuted.** The reviewer's 20-digit value `1.26417876513369812067` for `K(0.4i)` holds to 16 digits only; 80-digit quadrature and closed form agree on `1.264178765133698152…`. Nothing on the page was refuted.

**Newly established (by reading, not by proof).** The n-point assembly's proof consumes its per-block certificate hypothesis only through the window-sum `hsum` in `S11.block_energy`; hence the variant `n_point_bound_sum` stated in `ASSEMBLY_AUDIT.md` is the exact obligation separating the page's chain floors from a theorem about ζ. Under it, the amplitude-minimised `sharp` certificate beats the pair certificate that reaches the ceiling, because chains have ends.

## 2. Strongest auxiliary-chain statement and its coverage

`R(g) ≥ E_alt − 2.186e−15` for every six-gap block, hence the alternating chain is the minimiser to within 1.2e−11 (note, "Where this stands, now"). Coverage: inside the two tubes, Arb (`tube_arb.py`, re-run today); outside, exhaustive subdivision with proved enclosures on this page's own hand-bounded arithmetic, 75 004 893 boxes, with an Arb audit of a 220+220 sample of the tightest nodes confirming 39+67 and refuting none. The full Arb rebuild of the sweep (stage 4's end state) is not done; its cost was estimated in the note at about ten hours per seventy-five million boxes.

## 3. Strongest supported zero-count conclusion, with dependencies

Unconditional, human-reviewed: 0.6725007037 (Alpöge–Furman; Lamzouri's reproof). Unconditional for Mathlib's `riemannZeta`, kernel-checked, registry-replayed, unreviewed by any person, **not yet rebuilt here** (Mathlib build in progress at the time of writing): 0.6728470198 (zeta-lab four-point). Conditional: 0.6731062 (this page's `sharp` chain floor) requires, in order, (a) `n_point_bound_sum` — a cut at `hsum` in S11, unproved; (b) the page's telescoping lemma (Lean) applied to the `sharp` certificate; (c) the `sharp` rigorous sweep (proved enclosures on this page's arithmetic; its transcript is stale in the suite); (d) the tail lemma at the `sharp` amplitude; (e) the boundary term ≤ amplitude, derived in `ASSEMBLY_AUDIT.md`, not in Lean.

## 4. Decisions

- **Stage 4 (independent certificate verification), continue partially.** The tape checker is repaired and re-run; the Arb sample is still a sample. The cube-28 rebuild is a ten-hour Arb job by the note's own measure and was not launched without the owner's say-so.
- **Stage 5 (Lamzouri stability slack), not started.** The plan's own decision rule requires a candidate `D(Z)` with a plausible asymptotic route; the all-simple slack is exactly the pair-correlation input, and zeta-lab's `hunts/family_wall` shows the pressure family saturates at 0.6751 against the 0.6818 configuration ceiling. No candidate that uses new information was identified by reading; this is recorded as an open experiment, not as impossible.
- **Stage 6 (eight-point with amplitude control), deferred behind the lemma.** Its payoff is conditional on `n_point_bound_sum`, and zeta-lab already carries an eight-point per-block certificate at 0.6730530.
- **Stage 7 (pressure), deferred** for the same reason; the parameter is confirmed free.
- **Documentation reconciled**: note, page, spec and ledger now agree on the sample counts, the norm identity, the assembly's status and the boundary term.

## 5. One prioritised next step

Prove `n_point_bound_sum` in a fork of `teal-sea/zeta-lab`: restate `block_energy` with `hsum` as the hypothesis (S11 lines 240–252 are the only lines that change), thread the new hypothesis through `S13.block_bound`, `Main.block_bound_eventually` and `pre_solve`, and build. If it compiles, the page's `sharp` sweep becomes the binding item and the honest conditional record is 0.6731062; the remaining obligations are (c)–(e) above. Prerequisite: this machine's Mathlib build, started 2026-09-07, must finish.

## Commands

```
node dev/test.js && node dev/labs_shipcheck.js && node dev/tiling_pressure_test.js && node dev/build.js && node dev/ui_dom_smoke.js
ARB_PYTHON=<venv with python-flint> node dev/check_arb.js
node dev/investigation/labf_dump.js && <venv python> dev/investigation/labf_oracle.py
python3 dev/sweep_proof_arb.py            # with python-flint importable
cd <zeta-lab clone>/lean/bridge && lake exe cache get && lake build V2Challenge V2Solution
```
