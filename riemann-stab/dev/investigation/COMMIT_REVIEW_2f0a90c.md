# Review through 2f0a90c

Scope: the seven commits after `69d3f99`, especially the new Rust checker and its full-tape records. This review adds only this document and a reproducible probe; no production checker, Lean module, or proof transcript was changed.

**Assessment:** the earlier signed-endpoint theorem is a substantive local mathematical advance. These latest commits mainly repair and accelerate its numerical verification. The sharp tape now has a completed transcript, but a newly reproduced table-conversion defect means the claim that the only remaining gap is importing the verdict into Lean is premature. No counterexample to the sharp floor was found.

## 1. [P1] The compiled root tables do not enclose all the certified roots

Locations: `kernel_pieces_arb.py:637–641`; `tapecheck/src/main.rs:299–321`.

The Arb exporter converts each high-precision midpoint to binary64 but retains the original tiny radius. Midpoint rounding is about 1e-16 to 1e-14 here, while the exported radii are about 1e-66 to 1e-64. That serialized midpoint/radius pair therefore does not preserve the certified enclosure. Rust's outward interval addition often widens it enough to rescue containment, but its default JSON numeric parsing introduces further rounding differences. Actual containment must be checked; it cannot be inferred from the original Arb certificate.

I compiled an isolated copy of the production source, invoked its actual `Tables::load`, extracted its interval endpoints as exact binary64 bit patterns, regenerated `Pieces(170)` in Arb, and compared the roots against those endpoints:

- **21 of 338** nonzero breakpoints for the range of `w` lie strictly outside their Rust intervals.
- **26 of 341** breakpoints for the range of `w'` lie strictly outside their Rust intervals.
- **Seven misses are below distance 96**, so this affects the sharp tape's permitted distance range as well as the pair tape's.

Examples:

```text
certified zero of w':
92.00066544325061903113798899915556313629750626382234...
Rust interval (shortest decimal representations of its binary64 endpoints):
[92.00066544325063, 92.00066544325065]

certified zero of w'':
13.24710513567832631231442264700810730946686830966390...
Rust interval:
[13.247105135678327, 13.24710513567833]
```

**The production loader accepts all of these.** Its condition `kern.wd(ball).contains(0.0)` (or `wdd`) is a necessary condition for a root, not an existence proof. An overestimated derivative interval can contain zero even when the function has no zero in that interval. Consequently the Arb completeness proof does not transfer to the intervals used by `Tables::ranges`.

This establishes a gap in the range argument, not a demonstrated false final inequality: the errors are tiny and other padding may cover particular evaluations. To retain the old verdict one would need a proved error-and-margin argument covering every affected decision. Merely observing that the two checkers agree on counts, or that fast and slow trigonometric intervals overlap, does not supply that argument.

**Repair:** export outward-rounded lower and upper endpoints with exact bit encodings, reconstruct them without decimal conversion, and verify that each exported interval contains its original certified Arb ball. Add this control for every table entry. Preserve completeness and source provenance across export/import. Re-run the complete sharp check after this control passes, or supply a rigorous global margin argument.

## 2. [P2] The pair correction is not exactly a coboundary after coefficient summation

Locations: `tapecheck/src/main.rs:1057–1059`; shared older behavior in `sweep_proof_arb.py:323–325` and `tiling_pair.js`.

The dependent fifth grid is formed by summing the four input grids in ordinary floating-point arithmetic. The resulting five grids do not sum to zero as real functions. On the shipped pair candidate, **9 of 576** grid entries have a nonzero exact residual.

At the diagonal knot `(1, 1)`, the four free values are `[0, -2e-5, -2e-5, -2e-5]`. The sum of their exact binary64 values and the stored rounded negative sum is

```text
1 / 295147905179352825856 = 2^-68 = 3.3881317890172014e-21.
```

For six equal gaps of 1, all five pairs evaluate at that knot. Any true state-potential difference is zero because the entering and leaving states are identical, but this computed pair correction is positive. Thus a lower bound on the rounded functional is not, without a correction, a lower bound on the exact telescoping functional. Repeating the state accumulates the residual instead of telescoping it away.

This is tiny and does **not** affect sharp, whose pair grids are zero. It nevertheless matters for a rigorous pair certificate. Construct the dependent grid in exact/interval arithmetic, or explicitly bound and subtract the residual. For these shipped grid values its maximum is exactly `2^-68`; bilinear convex interpolation and clamping extend that grid bound to the domain. Keep the tube and exterior proofs tied to the same chosen functional.

## What the mathematical progress actually is

- No Lean module changed in these seven commits. The important earlier result is `n_point_bound_signed`: carry endpoint terms with their signs through the block average, telescope the total loss to a fixed `W B`, and absorb it asymptotically under `c W + B <= 1`. That is a useful extension of the assembly theorem.
- `sharp_chain_bound_signed_concrete` still has the explicit universal `hcob` hypothesis. Its potential and oscillation bounds are formalized; its numerical floor is not discharged in Lean.
- Re-running `projection.py` gives the sharp signed projection **0.673109350146**, compared with its conservative **0.673105101332**. This is a small but meaningful refinement in the method. It concerns an asymptotic proportion of zeros simple and on the critical line; it does not prove the Riemann hypothesis.
- The published starting point is approximately **67.25%**, in [Alpöge–Furman](https://arxiv.org/abs/2608.13637), with a separate proof by [Lamzouri](https://arxiv.org/abs/2609.02882). The directory's sharp target is approximately **67.310935%**, about **0.0609 percentage points** higher. This review has not established global novelty or a new accepted record.
- Both proposed Lamzouri slack corrections are now correctly marked refuted. Their counterexamples are useful negative results, not new lower bounds.
- The pair transcript is correctly marked incomplete: 36 unresolved leaves, plus its separately documented failing alternating-centre check. `projection.py` places the pair signed projection slightly above sharp (`0.673109844691` versus `0.673109350146`), so the report's historical sentence that sharp “wins both scores” should be corrected. Sharp remains the more mature verification target.

A sound external interval proof can establish a mathematical inequality without importing it into Lean. A fully kernel-checked proof requires the extra formalization. These are different completion criteria. The current numerical soundness issue must be resolved for either route.

## Checks performed

- `node dev/tapecheck_test.js`: passed; rebuilt the checker, confirmed all 4,857 small-tape obligations, verified the committed full sharp record's declared input hashes, and rejected the forged tube leaf.
- `sweep_proof_arb_controls.py`: all 19 controls passed; its committed result remained unchanged.
- New isolated Rust/Arb root-transfer probe: reproduced the 47 missed roots above, including seven within the sharp distance range.
- Exact-rational pair-cancellation probe: reproduced the nine nonzero residuals.
- Exact-rational tail check: `16/3000 - amplitude - 3956/1000000` is positive, approximately `9.555208004781337e-5`. The cube-to-global tail reduction for the shipped sharp certificate has comfortable slack; it is not the obstruction found here.
- Conditional projections recalculated. The Lean sources are unchanged from the prior review, where their build and axioms were checked; that build was not repeated here.
- Neither full 40-minute tape check nor the entire application suite was rerun.

Reproduce the new probes with a Python containing python-flint and Cargo dependencies already cached:

```sh
python riemann-stab/dev/investigation/review_probes_2f0a90c.py
```

## Ordered next steps for Claude

1. Reproduce the root misses before editing. Keep the current completed transcript as historical evidence, qualify its soundness status, and remove “only import remains” wording.
2. Repair the table interchange with exact endpoint encodings. Add full-table containment tests, including the two explicit witnesses above, and ensure the generated data's coverage proof and provenance apply to what Rust actually consumes.
3. Run the existing 19 controls, the new transfer controls, and the complete small sharp tape. Audit trigonometric rounding bounds separately from empirical overlap tests.
4. Bind provenance to the executable actually built: record `Cargo.lock`, compiler/target, executable hash, and a build-time source fingerprint. Runtime hashes of editable `.rs` files alone do not identify a compiled program.
5. Freeze that build and rerun the full sharp tape. Require exact obligation coverage and zero unresolved/refuted/conflicting results. Retain the exact tail argument and confirm the checked functional matches the Lean `hcob` statement.
6. Write a short mathematical proof connecting the global certificate, the signed-endpoint theorem, and the advertised proportion. Then choose whether full Lean verification is required as an additional deliverable. Do not describe absence of a Lean import as the sole criterion for absence of a mathematical proof.
7. For the pair route, repair exact cancellation first, align both tube phases and the exterior with that same functional/floor, fix the known centre-test expectation, and resolve the 36 remaining boxes. Update both projection rankings from the actual script output.
