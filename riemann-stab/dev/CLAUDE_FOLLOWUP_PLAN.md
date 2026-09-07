# Claude follow-up: connect the certificate without losing the boundary bookkeeping

Prepared against `8af0507`, after reading the audit reports, certificate data, oracle, and the local zeta-lab source at `47d02411673f2a3f4bc07dde31c0b323459646ae`.

Proceed with the lemma work. Keep the completed upstream build and use incremental builds. The next work is the finite boundary calculation and its connection to S11–S16, followed by certification of the selected input. Do not ask the user to choose among the four original research stages again. Report a concrete obstruction if one appears; otherwise continue through the steps below.

The boundary-paid number `0.6731062` in the latest report is not a valid target yet. The boundary estimate used to derive it is too small. There is also a more promising alternative to paying that loss separately on every block: retain its sign through the existing offset average. Investigate that alternative explicitly.

## 1. Reproduce and correct these findings first

Run the read-only evidence script:

```sh
python3 riemann-stab/dev/investigation/followup_checks.py
```

It uses exact rational arithmetic for the parsed binary64 certificate data. Its mpmath output is numerical, not interval-certified.

**A. The tail amplitude does not bound the endpoint loss.** Put `h=a+b`. For the additive correction implemented in `tiling_additive.js`, a state potential on five gaps is

```text
Phi(s0,s1,s2,s3,s4) = -a(s0) - h(s1) + h(s3) + a(s4).
```

Verify by expansion that `Phi(g1,…,g5)-Phi(g0,…,g4)` is exactly the shipped six-gap correction. With independent nonnegative state coordinates and the shipped constant extensions,

```text
B = sup Phi - inf Phi = 2*osc(a) + 2*osc(a+b).
```

This is different from the bound on a *single edge correction* used in the tail lemma:

```text
A_tail = 2*(max|a| + max|b| + max|a+b|).
```

| Certificate | A_tail | B, endpoint oscillation |
|---|---:|---:|
| sharp | 0.001281781253285520 | 0.001709041671047360 |
| compact | 0.001106844030984264 | 0.001311408860773000 |
| record | 0.005196785536571252 | 0.008083405028386097 |

The script supplies strictly positive initial and final gap states whose endpoint difference exceeds `A_tail`, verified with exact fractions. At the large window counts under consideration, both states can be endpoints of the same positive-gap chain. Thus strict monotonicity does not rescue the claimed uniform endpoint bound. This corrects an assumption repeated in the earlier research notes and first handoff too.

For the pair certificate, reconstruct the state potential from the cumulative adjacent-pair corrections before bounding it. The claimed `+4*cap` endpoint allowance needs a derivation; a cap on edge features is not automatically a cap on the accumulated state potential.

**B. The rigorous sharp run is absent from the committed results table.** `tiling_interval.results.json` has a **fast** sharp row at `0.003956`. Its four `rigorousRuns` rows all use **compact**, up to `0.0038`. The sharp rigorous run is a historical report, not merely a present row with a stale hash. Find its actual artifact or recreate it. Do not manufacture a transcript by updating hashes on a historical number.

**C. The Arb tape sample does not cover the full pair sweep or the additive sharp sweep.** The 39/220 and 67/220 results refer to the committed **cube-1.6 pair tape**. `REPORT.md` currently associates that sample with the 75-million-box exterior sweep, and `ASSEMBLY_AUDIT.md` associates it with the additive floor. Correct both. Keep certificate, domain, tape hash, arithmetic and sample selection attached to every count.

**D. The decimal example was not refuted.** At exact decimal input `0.4i`, direct integration gives `1.264178765133698120669902188429…`. At the exact binary64 value of Python's `0.4`, it gives `1.264178765133698152235184212739…`. The original example used an exact decimal. Update the oracle and report to distinguish the two inputs.

For binary64-input comparisons, convert each coordinate to high precision **before subtracting coordinates**. The current oracle subtracts Python floats first. Recompute precision-dependent constants inside the requested precision context; increasing `mp.dps` does not recreate `S2` and `NRM`, which were calculated earlier. Replace “Arb-grade oracle” and “enclosure-grade numerics” in the ledger with their actual status: high-precision numerical comparisons without proved error enclosures.

**Completion:** correct the reports and preserve reproducible witnesses. These fixes do not require another upstream build or a long sweep.

## 2. Prove the straightforward window-sum theorem as a control

Make an isolated local development based on the existing clone and retain its pinned dependencies. Preserve upstream statements and instances. Save the patch and build/axiom logs in this repository so the result does not live only in a scratch directory.

Introduce a window-sum hypothesis at the theorem's fixed `m`. Use the actual `sortedExt`/`windowGaps` types: the pseudocode in `ASSEMBLY_AUDIT.md` passes a `Fin m → R` directly where the implementation uses a sequence extended to natural indices.

Factor S11 after `hsum`, then thread the weaker hypothesis through S13 and `Main.block_bound_eventually`, `pre_solve`, and the final statement. Prove that the old per-window certificate implies the new hypothesis. Recover the original theorem and the three-/four-point instances as regressions.

Separately prove the adapter from

```text
F(window_i) + Phi(state_(i+1)) - Phi(state_i) >= c
```

to the window-sum estimate `sum F >= c*W - B`, where `W=m-(n-1)` and `B` bounds the oscillation of `Phi`. Instantiate the explicit five-gap additive potential; do not leave the connection to the numerical certificate implicit. Formalize the piecewise-linear endpoint bound with the chosen exact coefficient semantics.

For a conservative arithmetic control set

```text
L = min(c*W - B, 1),  c_eff = L/W,
```

requiring `W>0` and `L>0`. Recompute admissible integer block sizes from these conditions. A self-consistent floor formula is not itself an optimality proof; compare the integers around the cap, including the option to lower the supplied bound to satisfy the cap.

With the hypothetical sharp global floor `c=0.003956`, the corrected endpoint bound gives, numerically:

- `W=253`, `m=259`, `c_eff≈0.00394924489458084047`;
- boundary-paid conditional projection approximately **0.6731051013315054**.

This is a check of the proposed formula, not a proved zero bound. It still requires the theorem adapter and the global sharp certificate.

**Completion:** the general theorem and adapter compile; the old theorem follows as a corollary; printed axioms contain no `sorryAx` or custom proof assumptions masquerading as axioms. List all remaining explicit hypotheses. A compiled implication is not a proof that its numerical premise holds.

## 3. Main new experiment: keep the signed endpoint term through S15

The local source of `S15.offset_average` already sums over **every consecutive full m-point block** and groups starts by residue modulo `m` for pinching. This is the structure needed to test cancellation. The per-block boundary-paid estimate above may be unnecessarily lossy.

Let the complete ordered retained configuration have `M` points. For each full block starting at `s`, set

```text
W = m-(n-1)
Delta_s = Phi(state_(s+W)) - Phi(state_s).
```

The proposed proof route is:

1. S11 with a coboundary certificate gives `c*W - Delta_s <= E_s + q*span_s`, with `q=(n-1)/p`.
2. Retain `Delta_s` while passing through S13. Its clipping step needs attention: `blockDefect >= min(1, offDiagonalMass)` is nonlinear, so cancellation cannot simply be asserted after clipping.
3. A sufficient candidate side condition is **`c*W+B <= 1`**, since `|Delta_s|<=B` then gives `c*W-Delta_s<=1` for every block. Prove that the S13 estimate, including its approximation error, still holds. Rework the large-span branch of `block_bound_eventually` with this signed right-hand side as well.
4. Sum over all starts in S15 *before* replacing endpoint terms by bounds. The finite identity to prove is

```text
sum_(s=0)^(M-m) [Phi(state_(s+W)) - Phi(state_s)]
  = sum of the final W potential values - sum of the initial W values,
```

with precise index ranges and separate handling when the configuration is short. For sufficiently long configurations its absolute value is at most **`W*B`**, independent of `M`, rather than `(M-m+1)*B`.

5. Carry this fixed error through the existing pinching and span estimates and the final asymptotic elimination. Keep `m`, `W`, and the certificate fixed before taking `T→∞`; prove that the remaining error divided by the zero count vanishes. Do not discard fixed errors without this step.

**Experiment before formalization.** Build a small finite model of the signed S13 inequality and offset sum. Test increasing point lists of lengths near `m`, `m+W`, and several multiples of `m`; include both signs of endpoint loss and saturated/unsaturated clipping. Verify the telescope exactly for rational piecewise-linear data. Include counterexamples showing why clipping requires a side condition. This model checks the new finite manipulation; it does not replace the analytic proof.

**Why this route matters.** For sharp, `c=0.003956`, `W=252`, the corrected bound gives

```text
c*W+B ≈ 0.99862104167104736 < 1.
```

Thus the sufficient cap appears compatible with the original `m=258`. If the signed argument survives all steps, it could recover the conditional projection near **0.673109350146**, without the per-block boundary penalty. This is a proposed extension, not an established result. If it fails, identify the exact failing inequality and retain Step 2's conservative theorem.

**Completion:** either a compiled signed-boundary extension with its finite and asymptotic errors explicit, or a concrete obstruction. Do not conclude that the boundary penalty is unavoidable merely because the existing theorem has no parameter for it.

## 4. Select the certificate using the theorem actually proved

Keep two separate scores: the conservative boundary-paid projection and, only if proved, the signed-boundary projection with its stricter cap. Compute tail and endpoint bounds independently. Compare sharp, record and pair using current artifacts; do not reuse rounded report amplitudes as rigorous inputs.

A useful cheap experiment for the pair certificate is an exact endpoint-oscillation calculation. Recover its four state edge functions as cumulative negatives of the five `psi_k` corrections. On the union of the additive and pair knot grids, the potential is affine in each coordinate within each cell. Establish that extrema occur at vertices, including the constant tails. Its unary and adjacent-pair structure then allows a finite dynamic program for min/max rather than enumeration of the whole five-dimensional grid. Prove the reduction and validate it against exhaustive enumeration on a tiny grid. This may be much cheaper than searching for a new certificate.

Choose a conservative rational target with useful verified margin. An exactly attained alternating minimum is not required to establish a useful zero-count improvement.

## 5. Certify that selected input, with measured costs

Do not equate this task with rebuilding all 75 million pair boxes in Arb. That is one possible route for one certificate. First benchmark the selected certificate and the independent checker on representative domains and failure modes.

If sharp wins, restore a current rigorous sharp transcript with the full tail cube and correct input hashes. Then provide independent verification appropriate to that additive certificate. The pair tape checker is not already such a verifier. Start with a fully verified small domain, including every arithmetic obligation, before extrapolating full-domain cost.

For an independent proof object or subdivision check, record confirmed, unresolved and refuted counts separately. “No refutations” cannot be a successful complete-verification condition. Increasing precision addresses rounding uncertainty; geometric subdivision or tighter forms address dependency overestimation. Preserve all undisposed regions.

Checkpoint longer runs with source/data hashes, exact parameters, domain coverage, elapsed time and observed throughput. Continue ordinary local work and incremental builds without another funding question. If a computation cannot be completed in the available environment, leave a reproducible checkpoint and measured remaining cost, and finish all independent finite-proof work that can proceed.

Also run the local Lean/axiom checks directly if the full suite exits earlier on legacy transcript failures. Preserve the suite failure as a failure; do not let it silently skip the formal gate.

## 6. Close with a durable proof package and accurate status

Deliver:

1. Corrected oracle and claim ledger, including the exact-decimal distinction and actual sample domains.
2. The pinned upstream revision, local patch/branch, build commands, final statements, and axiom logs for the conservative and signed variants.
3. A runnable projection calculation with exact coefficient interpretation, separate tail/endpoint bounds, integer cap checks, and a conservative numerical enclosure for any advertised constant.
4. The selected global certificate and its actual verification coverage, or the precise remaining obligation and checkpoint.
5. One updated report explaining which statement is proved and which hypotheses remain.

The upstream theorem currently takes **`p : Nat`**. It allows varying positive integer pressure denominators, not arbitrary real `p`. The numerical crossing near `3370.450721` therefore requires either integer neighbors or a proved extension to positive real pressure. Do not describe the continuous optimum as already covered by the compiled theorem.

Stage 5 of the original plan was **not conducted** merely because reading did not identify a candidate. Record it as deferred. The signed-boundary proof above is the next focused experiment; larger block searches and a new phase survey remain secondary.

Do not replace the current working mathematical implementation simply to match this guidance. Verify each calculation, retain counterexamples, and correct this follow-up if the source gives contrary evidence.

## Source locations inspected for this follow-up

Local zeta-lab clone at preparation time:

```text
/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/947b1540-afae-4afd-9778-4fc980202e89/scratchpad/zeta-lab
```

Relevant files beneath `lean/bridge/`: `Zeta23Ext/Bridge/S11.lean` (`block_energy`), `S13.lean` (`block_bound`), `S15.lean` (`offset_average`), `Main.lean` (`block_bound_eventually`, `pre_solve`, `n_point_bound`), and `V2Challenge.lean` (statement types). These sources were read in this review; their build was not rerun here. The earlier successful build is reported by Claude's audit.
