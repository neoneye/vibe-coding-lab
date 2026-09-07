# Claude investigation plan for riemann-stab

Prepared 2026-09-07 from repository commit `107fbd97ea3e6c4d9db3eae880e789a33414f3a9`.

Follow-up after the audit commits: read `dev/CLAUDE_FOLLOWUP_PLAN.md` next. It corrects the endpoint-amplitude assumption, distinguishes the proof-tape domains, and specifies a signed-boundary extension through the existing offset average. Use that follow-up for the next execution order.

Your task is to investigate the mathematics, conduct reproducible experiments, and establish what each result actually supports. Prioritize a sound connection between the auxiliary chain and the simple-zero bound, independent verification of existing certificates, and a potentially stronger finite inequality. Finish each numbered stage with its stated deliverable and decision before moving on. A refutation or a precisely identified missing lemma is a useful result. Do not turn unsuccessful searches into claims of impossibility.

This is a research execution plan, not a request to build another visual lab first. Update the website after the underlying conclusions are settled.

## Findings that determine the order of work

- The current chain-to-zero projection is explicitly conditional on an external shifted-block assembly. Improving its numerical output does not resolve that dependency.
- The large pair sweeps have current input hashes. That establishes freshness of the recorded runs, not independent reproduction. The committed proof tape covers `[0,1.6]^6`; the advertised global certificate needs the cube `[0,28]^6`, two local tubes, and the tail argument.
- The committed Arb tape transcript records **39/220** discharged leaves and **67/220** collapses confirmed, with the remaining sampled cases unresolved and none refuted. Its successful checks do not mean all sampled arithmetic was verified. Numbers elsewhere in the research narrative concern other configurations and must not be interchanged.
- Lab F contains a concrete mathematical exposition error: it states `||f_z||² = K(0) = 1` for complex `z`. The correct identity is `||f_z||² = K(z-conj(z))`; the value is 1 for real `z`. Direct 50-digit quadrature with this project's kernel gives approximately **1.26417876513369812067** at `z = 0.2i`. This contradicts the explanation, not Lamzouri's proposition.
- The original eight-point additive search already failed through inadequate convergence and uncontrolled amplitude. A repeat with more sweep time would miss the cause.
- The live external zeta-lab ledger now advertises formal results beyond the baseline and links source and registry entries. That is a lead to investigate, not a result this review has authenticated. The page's older account must be checked against pinned artifacts.

Checks performed for this handoff: `test.js` (93 passed), `labs_shipcheck.js`, `check_pair_sweep.js`, `sweep_proof_test.js`, and `ui_dom_smoke.js` all passed. The large sweeps, Lean development, and Arb programs were not rerun. The default Python has mpmath but lacks python-flint, numpy, and scipy. No mathematical implementation was changed for this handoff.

## 1. Establish a reproducible baseline and claim ledger

Read these files first, in this order:

1. `dev/TILING_DUAL_RESEARCH.md`, especially “Evidentiary status,” “Where this stands, now,” “A proof-carrying sweep,” and the final “What this leaves open.” Treat earlier sections as potentially superseded.
2. `dev/lean/rejected/README.md` and the statements in `dev/lean/ZetaClaims.lean`.
3. `dev/tiling_research.js`, including `blockFunctional`, the periodic energy, and `projectedSimpleZeroBound`.
4. `dev/run_suite.sh`, `dev/check_arb.js`, `dev/check_pair_sweep.js`, and the provenance modules.
5. The Lab F functions in `dev/core.js` and their explanation in `dev/template.html`.

Record the current revision, existing changes, toolchain versions, and dependencies. Use a scratch copy or explicit output paths for scripts that regenerate certificates or result files; preserve the committed evidence. Read each command's actual interface before launching it. Run the full suite when its dependencies are available, with its log saved. From the repository root its path is:

```sh
sh riemann-stab/dev/run_suite.sh
```

For individual commands below, work from the `riemann-stab/` directory. Configure `ARB_PYTHON` to the interpreter containing python-flint. A suite that falls back to checking transcript hashes has not rerun Arb; report this explicitly.

Create `dev/investigation/CLAIM_LEDGER.md`. For each important assertion record: exact statement, parameters, domain, source/artifact, dependencies, reproduction command, verification performed, and outstanding obligation. Distinguish numerical searches, double-precision subdivision, rigorous enclosure results, independently checked arithmetic, formal implications with hypotheses, and conclusions about zeta zeros. A search minimum is an upper bound on an infimum; a global certificate supplies a lower bound.

**Completion:** every headline number has an identifiable supporting artifact and scope. Resolve inconsistent theorem counts and obsolete “running next” statements by inspecting the source and logs. Do not edit golden values merely to make a failing check pass.

## 2. Audit the mathematical bridge before optimizing it

Trace the actual route from a block floor to a zero-count proportion. Read the primary papers and retrieve any candidate manuscript and formal source linked by the project. Pin versions and commits. In particular, inspect the current external n-point development and its three- and four-point instances as possible small controls for understanding the assembly.

Build a dependency table covering: kernel normalization; Fourier convention and support; the unconditional analytic input; finite stability inequality; block/chain counting; multiplicities and off-line pairs; boundary losses; smoothing and order of limits; and the final algebraic elimination. Mark which statements are proved, assumed, computationally supplied, or missing. Check formal theorem hypotheses, not just axiom counts or a successful build.

**Experiment A — reconstruct the projection independently.** Implement a small exact-rational or high-precision calculation directly from the retrieved inequalities, without importing `projectedSimpleZeroBound`. Reproduce the baseline near `0.672500703679`, the local floor `19/5000` projection near `0.6730085279`, and the conditional alternating-chain projection near `0.6731102697`. Explain every normalization factor. The withdrawn derivation mixed window inputs; keep all moment and defect terms on the same window and scale.

Test the integer choice `windowsPerBlock` just below, at, and just above reciprocal thresholds. Derive the strictness convention instead of copying the current `1e-12` offset. Determine whether `n` and `p` really may vary in the analytic assembly. Check denominators and the direction of every implication.

**Completion:** write `ASSEMBLY_AUDIT.md` with either a complete, source-linked derivation or the exact missing/mismatched lemma, including its needed hypotheses. If the bridge is unavailable, continue the auxiliary-chain and finite-inequality investigations, but keep every zero-proportion improvement conditional. Do not spend additional time searching for a better projected constant before the permissible parameter ranges are known.

## 3. Correct and independently validate Lab F's finite mathematics

Use Lamzouri's Proposition 2.1 and its proof as the reference. Correct the complex norm statement in the source template and design document. Check the sign convention for `i(rho-1/2) log(T)/(2pi)`; a global reflection is harmless here, but explain it consistently. Distinguish the transform of `Q''` from differentiating the transform of `Q`. The unsmoothed kernel is admissible for the finite proposition; that alone does not license substituting it into the asymptotic lemma.

**Experiment B — independent kernel and multiset oracle.** Use high-precision direct integration of the defining Fourier integral, independently of the JavaScript closed form. Start at 80 digits and repeat difficult cases at 160 digits. Compare values and complete pair sums on:

- `z=0`, real points, `z=0.2i`, conjugate points, and the removable sinc singularities near real `z=±1/(sqrt(2)pi)`;
- one simple real point, one double real point, an isolated conjugate pair, and two distant real points;
- close clusters, unequal real multiplicities, repeated conjugate pairs, imaginary parts approaching zero, and large imaginary parts that stress cancellation;
- at least 1,000 reproducible random multisets over several sizes and geometric scales.

Compare `K(z-s)^2`, not `|K(z-s)|^2`. Check both counting inequalities, conjugation symmetry, and the imaginary residual of the total sum. Add translation, reflection, and permutation controls. Specify treatment of duplicate point records, invalid multiplicities, empty inputs, and nonsymmetric inputs; do not silently present those as theorem-valid inputs.

Use error scaled to the sum of absolute term magnitudes as well as absolute error. Preserve every anomalous multiset. An apparent violation must survive independent precision refinement before it is interpreted mathematically.

**Completion:** `LAB_F_AUDIT.md`, an independent oracle, and targeted regressions for confirmed defects. Qualify the current claim that local-density rescaling explains the finite-height discrepancy: one diagnostic does not establish an exclusive cause. Keep local rescaling distinct from the paper's normalization.

## 4. Close the independent certificate-verification gap

Read `sweep_proof.js`, `sweep_proof_arb.py`, `kernel_pieces_arb.py`, `tube_arb.py`, and the pair interval modules before modifying the checker.

**Experiment C — make the small proof object fully checkable.** Reproduce the committed cube-1.6 tape in scratch storage. Audit each operation type: root coverage, split coverage, permitted collapse direction, discharged lower bound, tube inclusion, complete tape consumption, and rejection of unknown opcodes. Recompute geometry from authenticated parameters. Make coverage comparisons exact or outward-safe; tolerance must not silently exclude a sliver of the domain.

Audit the numerical path itself: coefficient ingestion, interpolation, derivative accumulation, ball-to-float conversions, breakpoint completeness, and all fallback formulas. In particular, `pl_range` currently interpolates using ordinary Python floats before forming a ball. Establish whether those balls enclose the exact represented certificate, rather than assuming that importing Arb makes the calculation rigorous. Check derivatives against differentiation of the defining kernel, including helpers that may no longer be used.

Certifying one root in each discovered bracket does not establish that the scan found every extremum. Prove completeness of the monotone-piece partition or use a safe enclosing fallback for every unclassified interval and out-of-range distance.

For unresolved leaves, distinguish finite precision from interval overestimation. Increase precision for the former; use tighter centered/Taylor forms or verified subdivision for the latter. For a collapse whose sign cannot be established, independently verify the discarded region or regenerate that node as a split. Never accept an unresolved collapse.

Require **all** arithmetic claims on the small tape to pass. Then repeat on larger domains, reaching the actual tail-lemma cube. The historical 53-million-node cube-3 example is still not the cube-28 proof. Benchmark throughput and estimate runtime/storage before expanding; partition work reproducibly if necessary.

Include negative controls: altered coefficient, understated root cube, deleted subtree, wrong collapse direction, forged tube label, and an artificially raised target. The checker must reject invalid evidence or report unresolved status.

Finally recompute the tube and tail bounds independently using the same certificate and target. Verify that their domains meet the exterior certificate without gaps.

**Completion:** `CERTIFICATION_REPORT.md` must enumerate total, confirmed, unresolved, and refuted arithmetic obligations and distinguish structural coverage from arithmetic coverage. Call the global result independently verified only when every obligation over the required domain is discharged. If runtime prevents completion, report the measured coverage and remaining cost; a sample is still a sample.

## 5. Investigate a stability improvement through Lamzouri's proof

This is the main new finite-mathematics experiment. Reconstruct the nested spaces `U ⊆ V ⊆ W` and retain the remainders discarded in Bessel's inequality, the scalar inequalities, and the dimension estimates. Derive the slack decomposition on paper before numerically optimizing it.

**Experiment D — locate usable slack.** Implement the decomposition independently using the kernel Gram data or converged quadrature with stable orthogonalization. Check the full identity against

```text
Delta(Z) = number_of_simple_real_points - (2*N - S).
```

Use the exact controls and adversarial multisets from Experiment B. Repeat near-dependent cases with higher precision and varied numerical rank thresholds. Record the Bessel remainder, scalar remainders, dimension losses, and total slack. On all-real simple data the total must equal the off-diagonal pair sum.

Propose a concrete, geometrically computable quantity `D(Z)` and investigate `Delta(Z) >= c*D(Z)`. State the domain, invariances, and every extra hypothesis. `D` must not use the unknown simple-real count or be defined as the slack itself. A uniform positive correction proportional to `N` cannot hold for arbitrary multisets: the singleton double point already has zero slack. Use this as a mandatory negative control.

For each candidate, minimize `Delta/D` where `D>0`, with multiple seeds, cluster collisions, wide separations, multiplicities, and off-line pairs. Preserve counterexamples. Investigate whether the remainder corresponds to the existing matrix stability defect or genuinely uses additional information.

**Decision:** continue only if there is a precise finite inequality worth proving and a plausible independent way to obtain a useful asymptotic lower bound for its correction on zeta zeros. A positive measured remainder alone is insufficient. Lamzouri's optimized unchanged second-moment method already has its stated ceiling; identify exactly what additional information a proposed improvement uses.

**Completion:** `LAMBZOURI_STABILITY.md` with the decomposition, reproducible data, and either a conjecture plus proof obligations, a proved restricted result, or explicit counterexamples to the tested candidates. Formalize a precise surviving lemma only after its mathematical statement is sound.

## 6. Revisit eight-point blocks with the missing amplitude control

Proceed after the audit stages. Its interpretation as a better zero bound additionally requires Step 2 to validate general `n`.

**Experiment E — controlled seven-gap certificate search.** Generalize the additive amplitude-minimizing refinement to `tiling_blocks_search.py`. First recover the six-gap behavior with the same settings. Then compare seven-gap searches at knot spacings `0.10` and `0.05`, with checkpoints at 30, 90, and 180 cut-generation rounds, at least three deterministic seeds, and both alternating orientations.

For each checkpoint record: LP relaxation bound, worst independently found reduced cost, amplitude, implied tail cube, active cuts, and elapsed time. Gauge-center the potential and refine amplitude at several targets that retain useful margin. Derive the seven-gap tail bound from the actual signs and coefficients.

Audit the entire tail cube, its faces and knots, and structured basin words. The old small search cube concealed a failure on the much larger required domain. Recompute the break-even floor against the best currently defensible seven-point result; the old prose compares against different historical rungs.

**Decision:** launch a costly rigorous sweep only after a candidate clears break-even with numerical margin throughout its required cube. If the LP/search gap stalls, report it as a search outcome. Prove any asserted family ceiling with a verified dual witness, not a floating-point optimizer status.

**Completion:** `BLOCK_SIZE_EXPERIMENT.md` with matched-budget comparisons and either a sweep-ready candidate or an evidence-based reason to deprioritize this route.

## 7. Test pressure optimization against competing phases

Do this after Step 6's decision, and only interpret it arithmetically if Step 2 establishes that `p` is free.

**Experiment F — challenge the proposed optimum near p=3370.45.** Reproduce the two- and three-period crossing. Continue both branches through a coarse pressure scan from 3000 to 3500, then refine around the crossing and any changes in the winning candidate. Search all periods 1–16 plus stress periods 24, 32, and 64 with both phases, mixed two/three-block words, random starts, and long-wave perturbations.

Track the lowest energy found at each pressure and compare projections on both sides of each relevant integer transition in `windowsPerBlock`. Fixed smooth-branch interpolation can miss those transitions. A lower periodic competitor refutes the proposed calibration; failure to find one does not prove global minimality.

At a promising crossing, a certificate must handle all competing equality configurations and their translates. A tube around only the alternating phase cannot certify a second phase that also attains the floor. Price short mixed configurations directly: isolated wall tensions do not determine tightly packed wall interactions.

**Completion:** `PRESSURE_EXPERIMENT.md`, reproducible branch data, high-precision checks of close comparisons, and a decision whether the roughly `4.75e-6` historical projected gain justifies another global certificate.

If the assembly remains unavailable and the desired continuation is specifically auxiliary-chain research, the next bounded follow-up is to certify roots for the period-five branch crossings using `rotation_scan.py` and `staircase_arb.py`. Such roots compare specified branches; they are not global phase boundaries without exclusion of other configurations. Do not expand into an unrestricted phase-diagram survey by default.

## 8. Publish a reconciled research result and handoff

Keep new experiment artifacts under `dev/investigation/`. Every run must record its exact command, revision and source/data hashes, parameters, seed, arithmetic precision, runtime, stopping condition, and status. Checkpoint long runs. Store new candidates separately; invalidate affected transcripts when a trusted input changes.

Finish with `dev/investigation/REPORT.md` containing:

1. What was reproduced, corrected, refuted, or newly established.
2. The strongest auxiliary-chain statement and its actual verification coverage.
3. The strongest supported zero-count conclusion, with every analytic and computational dependency explicit.
4. All experiment decisions, including unsuccessful candidates and preserved counterexamples.
5. One prioritized next step with the exact remaining proof obligation or computation.

Reconcile `TILING_DUAL_RESEARCH.md` and `template.html` with this report. Build through `node dev/build.js`; do not hand-edit the generated `index.html`. Run the affected numerical checks, the appropriate full verification suite, and UI smoke checks. Do not describe freshness checks, sampled verification, or theorem hypotheses as a complete proof.

The investigation is successfully reported when each pursued route ends in a reproducible result and an honest decision. It need not produce an improved constant to be useful, and it must not claim to resolve RH.

## Primary sources to inspect and pin

- [Alpöge–Furman, arXiv:2608.13637](https://arxiv.org/abs/2608.13637): baseline matrix proof; inspect the version and formal dependencies actually used.
- [Lamzouri, arXiv:2609.02882v1](https://arxiv.org/html/2609.02882v1): Proposition 2.1, equations (2.7)–(2.9), the smoothing/weight-removal argument, and Remark 3.4. The norm correction above follows directly from (2.7); (2.8) restricts unit norm to real points.
- [AxiomMath/ZetaZeros](https://github.com/AxiomMath/ZetaZeros): finite proposition and formal theorem conditional on the stated analytic inputs; inspect the challenge, solution, and comparator configuration.
- [teal-sea/zeta-lab](https://github.com/teal-sea/zeta-lab) and its [current ledger](https://zeta.teal-sea.com/): leads for the external n-point assembly and small formal instances. The ledger's claims are not independently endorsed by this handoff.
- [Linked n-point registry entry](https://palomar-registry.org/entry?id=PALOMAR-2026-08-25-000005&version=1): retrieve the actual statement, pinned commit, assumptions, and verification log before treating the registration as evidence.

These sources were consulted on 2026-09-07. Recheck their versions when executing the plan.
