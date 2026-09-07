# Review of Claude's commits through 69d3f99

Scope: changes after `f5c1d0f`, the saved Lean development, and the current proof-tape checker and shard artifacts. This is a review, not an implementation change. Existing sweeps were not stopped or overwritten.

**Assessment:** the signed-endpoint formalization is substantial progress, but the current independent checker cannot yet certify the numerical premise. Reaching zero unresolved leaves with this implementation would not close the proof. There are reproducible enclosure and verifier defects, and the proposed Lamzouri correction `D1` has a certified counterexample.

## What I independently checked

- The incremental build of `Zeta23Ext.Bridge.Signed` and `Zeta23Ext.Bridge.SharpPotential` completed successfully in the existing pinned clone (8856 jobs, including replayed dependencies). The emitted axiom lists for the new declarations contain only `propext`, `Classical.choice`, and `Quot.sound`.
- Both saved Lean modules match the files in the built clone byte for byte. All 51 knot values, all 51 `a` values, and all 51 exact `a+b` values in `SharpPotential.lean` agree with the binary64 certificate data as exact rationals, with denominator `2^68`.
- The final concrete theorem retains `hcob` as an explicit hypothesis. The state-potential bounds and signed-endpoint implication are proved; this is not yet a closed Lean proof of the numerical coboundary inequality.
- I ran small independent exact-rational and Arb probes, a forged-tape control, an unresolved-result control, and an independent complex-ball calculation for the Lamzouri candidate. The reproducible script is `review_probes_69d3f99.py` in this directory.
- I did not replay either full sweep or rerun the entire suite. I inspected the actual shard result/checkpoint files without modifying them.

## 1. [P1] Some returned intervals still exclude the exact value

Locations: `sweep_proof_arb.py:181–192,250,270–274,482–483`; `kernel_pieces_arb.py:270–275`.

The recent outward-rounding repair is incomplete. `pl_range` computes in Arb but converts both extrema to ordinary floats before building its hull. `pl_slope_range` computes slopes entirely in floats. The new bilinear range and slope helpers also convert extrema to floats without outward rounding. The shared kernel `_hull` has the same problem.

Width-relative padding does not cover an error in the location of a degenerate interval. Examples on the shipped data, independently checked at 256 bits:

- `pl_range(sharp.knots, sharp.a, 1.85, 1.85)` does not overlap the exact rational interpolant. Its error is about `-6.768312154159209e-21`.
- The sharp slope at `0.05` does not overlap the exact rational slope of that cell.
- `Pieces(30).w_range(0.5,0.5)` does not overlap direct Arb evaluation of the defining weight. The reported point is about `1.929741004194955e-17` **above** the true value.
- Even with a sound ball, `float(val.lower()) >= target` can accept a value strictly below the target. With `target=0.003956` and `val=arb(target)-2^-70`, the mathematical comparison is strictly below, but the checker's float comparison accepts it.

The kernel hull issue predates these commits; it is still in the trusted path of the new full-domain checker. Two mutually overlapping enclosures do not establish correctness if their shared helper is unsound. The reproduced errors do not show that the claimed global floor is false; they do show that the current confirmations lack the claimed enclosure guarantee.

**Required correction:** keep extrema, slopes, and acceptance comparisons in ball/exact arithmetic, or prove and apply outward rounding at every conversion. Audit candidate coefficient accumulation too. Add exact singleton and narrow-box tests using an independently computed value, not only natural-versus-centered agreement. Existing runs need a fresh sound verification or a proved error-and-margin argument covering every affected decision.

The breakpoint machinery also still replaces certified root balls by float midpoints and discovers derivative breakpoints with a finite sign scan. Establish completeness and range coverage, or provide safe fallback enclosures, before describing the table lookup as a proved exact range.

## 2. [P1] An arbitrary leaf can masquerade as a certified tube

Location: `sweep_proof_arb.py:591–595`.

`LEAF_TUBE` is accepted without checking whether the box lies in a tube, whether the radius is positive, or whether the candidate has an independently certified tube theorem.

The probe constructs a one-byte tape containing `LEAF_TUBE`, with matching metadata and hash, on `[0,0.5]^6`, using the sharp candidate, **tube radius zero**, and target **1000**. The checker reports eight successful checks and exits **0**, evaluating zero arithmetic obligations. At the origin the actual reduced functional is **12**, so this is a false proof, not merely an incomplete check.

This is a mutation test of the verifier, not evidence that a shipped tape actually contains a forged node. It demonstrates that the stated structural verification is insufficient to establish coverage.

**Required correction:** reject tube opcodes for the no-tube sharp candidate; for other candidates, verify exact inclusion and bind the excluded region to its separate certified theorem and target. Validate the opcode set and dimensions explicitly. Retain this negative control.

## 3. [P1] Shard provenance records files at completion, not the code executed

Location: `sweep_proof_arb.py:667`, with `arb_provenance.hash_inputs`.

The process imports its Python modules at startup, but hashes their on-disk files only when writing the final result. Editing the checker during a long run gives old executed code the hash of the new code.

This is observable in the overnight artifacts. Shard 0's log was created at **05:36:33 +02:00** and its result at **06:06:22**. The bilinear rewrite was committed at **05:57:08**. The shard result advertises checker hash `f927c21e3d402ee9…`, belonging to that later rewrite. The earlier exact-distance checker has hash `1542b3bc7e60deda…`. The timestamp evidence and end-of-run hashing mean matching final hashes do not establish that shards executed identical code.

**Required correction:** run each shard from an immutable source/data snapshot. Record its hashes before work, include them in every checkpoint, and reject a changed snapshot. Save the exact command, roots, limit, precision and refinement settings. Current `replay` strings omit these options and replay the default small configuration instead. Preserve the old runs as diagnostics until their actual executed version is established; do not label them a replay of the latest checker just because its hash matches at completion.

## 4. [P2] Shard result counts include out-of-shard samples

Locations: `sweep_proof_arb.py:584–589,610–614,631–645,689–692`; scratch `aggregate_shards.py`.

When `--all --roots=a:b` skips arithmetic outside the selected roots, the `elif` branches still collect samples from those outside roots. Final `confirmed/unresolved/refuted` counts add those samples to the in-shard counts, but the reported `size` counts only in-shard obligations. The aggregator then sums the inflated verdict totals across shards.

For shard 0, the leaf result says `size=480023` but `confirmed=480238`, `unresolved=2`: **217 extra leaves**. The collapse result has **219 extras**. Other completed shards have the same discrepancy. The current aggregator's equality checks should flag overcounting rather than falsely certify it, but its totals do not measure unique coverage and cannot identify which unresolved obligations belong to the shard.

**Required correction:** disable auxiliary sampling outside the shard in full mode, or report it separately. Identify obligations by tape offset and root index. Aggregate only disjoint, authenticated obligation sets; require exact root coverage, matching tape/parameters, and `confirmed+unresolved+refuted == unique obligations`. Preserve unresolved identities so successful retries replace earlier verdicts instead of being added again.

## 5. [P2] Full verification still exits successfully with unresolved arithmetic

Locations: `sweep_proof_arb.py:637–648,656–698`.

The full-check path retains the sample-mode success criterion: no refutations and no conflicts. Unresolved obligations do not fail the run. The probe uses a single discharged root box on `[0,0.5]^6` with target 6. `--all` reports **0 confirmed, 1 unresolved, 0 refuted**, eight successful checks, and exit **0**.

The reports currently acknowledge remaining leaves, so this is not an accusation that Claude concealed them. It is an unsafe completion signal for the newly automated full-verification pipeline.

**Required correction:** distinguish diagnostic completion, incomplete verification, and fully verified status. Full verification succeeds only with complete unique coverage, no unresolved/refuted/conflicting obligations, and verified exclusions. Partial shards and limit-capped runs should explicitly identify themselves as partial. A green wrapper must not turn those states into a complete proof.

## 6. [P2] The supposedly valid Lamzouri correction D1 is false

Locations: `investigation/LAMZOURI_STABILITY.md:27–36`, `investigation/REPORT.md:37`; implementation `lamzouri_slack.py:121–124`.

Take twelve distinct points, all multiplicity one:

```text
ten real points: x_j = 106/100 + j/10000, j=0,…,9
one conjugate pair: +i/20, -i/20
```

Using the project's normalized kernel, an independent 256-bit complex-ball calculation gives

```text
Delta = 89.98688917536094373120456815607…
D1    = 89.99994951745657671523098488352…
Delta - D1 = -0.01306034209563298402641672744943…
```

The ball radius for the difference is below `6e-73`; its sign is certified negative. This refutes `Delta >= D1`. It does not refute Lamzouri's original inequality: `Delta` is still positive. Passing 30 randomly generated multisets was insufficient to label this correction valid.

**Required correction:** retain the exact counterexample and change the status of D1 to refuted. Add structured adversarial clusters near zeros of the kernel with nearby off-line pairs. The current script prints ratios and family labels, not complete counterexample coordinates; preserve actual point lists and replay commands. Describe the decomposition as a numerical experiment, and keep any proposed universal correction hypothetical until proved.

## Documentation that also needs reconciliation

`REPORT.md` still says the rigorous sharp transcript is absent in its main status sections, although a later section correctly records it restored. Its deliverables section still uses superseded sample counts and resolution estimates. These contradictions make the current status difficult to read. Replace the accumulated present-tense history with one authoritative status table and move historical stages to a dated log.

The reported `0.6731094` remains the conditional signed projection. A complete and sound external certificate would support the mathematical premise; a fully kernel-checked result would additionally require a formal proof/import mechanism for that premise. The current Lean theorem does not ingest the Python transcript.

## Recommended next action

Keep the signed Lean development. Correct the verifier primitives, exclusions, provenance and aggregation, and run the small adversarial controls **before starting a complete pair-tape run**. Freeze that corrected checker, then verify the selected sharp certificate completely, retaining the full-domain tail argument. Meanwhile correct the D1 conclusion and current-status documentation.

For the numerical probes, use any Python containing python-flint:

```sh
python riemann-stab/dev/investigation/review_probes_69d3f99.py
```

No production mathematical code or existing proof artifact was changed by this review.
