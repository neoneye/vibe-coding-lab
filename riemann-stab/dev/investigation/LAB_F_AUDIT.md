# Lab F audit

Stage 3 of `CLAUDE_INVESTIGATION_PLAN.md`, 2026-09-07.

## Corrections made to the exposition

1. **Complex norm.** The page said `‖f_z‖² = K(0) = 1` for every `z`. From (2.7), `⟨f_z, f_s⟩ = K(z − s̄)`, so `‖f_z‖² = K(z − z̄) = K(2i·Im z)`, which is 1 exactly for real `z` and larger otherwise; the proof uses the unit norm only for the real points, eq. (2.8). Fixed in `template.html` and in the design spec. At `z = 0.2i`, `K(0.4i) = 1.264178765133698152…` (80-digit quadrature and closed form agree to 1e−80). The reviewer's quoted `1.26417876513369812067` is correct to 16 digits; its digits beyond that do not hold.
2. **Sign convention.** On the line `i(ρ − ½)·log T/2π = −γ·log T/2π`; the page now says so and notes the reflection is global and harmless.
3. **Transform of `Q″`.** The spec now says the transform of `Q″` is `(2πix)² Q̂(x) = −4π²x²K(x)²`, the transform of the derivative and not the derivative of the transform.
4. **Unsmoothed kernel.** The page now says the limit kernel `f₀` is admissible for the finite proposition but not for Lemma 3.2 (`Q₀″` has point masses at `0, ±1`), so the asymptote drawn in F·ii is the `ε → 0` limit of the smoothed constants.
5. **Local-density rescaling** is presented as the effect the page can measure and as accounting for most of the shortfall, no longer as the exclusive cause.

## Experiment B — independent oracle

`investigation/labf_dump.js` dumps the page's kernel values and Proposition 2.1 sums; `investigation/labf_oracle.py` (mpmath, 80 digits; 160 at the removable sinc singularities `x = ±1/(√2π)`) recomputes them two ways — direct quadrature of the defining Fourier integral on the fixed battery, and an independent closed-form implementation for every pair sum — and reports absolute error and error scaled by the sum of absolute term magnitudes.

Run: `node dev/investigation/labf_dump.js && <python with mpmath> dev/investigation/labf_oracle.py` (13 s).

Battery: `z = 0`, real points, `±1/(√2π)` and `+1e−9` beside it, `0.2i`, `0.4i`, a conjugate pair, `2.5`, `12.25`, `1.5i`, `3+2i`, `1e−7`, `1e−7 i`. Multisets: one simple real; one double real; one triple; an isolated conjugate pair; a pair of multiplicity two; two distant reals; a close cluster at spacing 1e−3; unequal real multiplicities; repeated pairs with `y = 1e−4`; imaginary parts 1.5 (K ≈ 20, stresses cancellation); a mixed set; 1000 seeded random multisets (`randomLamzouriMultiset(seed)`, seeds 1–1000, 10 129 points in all); translation, reflection and permutation controls.

Result (all OK):

- quadrature and closed form agree to 3.4e−80 on the battery;
- `core.js` kernel agrees with the oracle to 1.4e−14 absolute, 1.4e−15 relative (double precision; the absolute figure is at `K ≈ 20`);
- `K(0) = 1` to 1e−70;
- the pair sum is real on every multiset (`|Im| < 5e−80`);
- inequalities (2.4) and (2.5) hold on all 1015 multisets at 80 digits, no violation;
- `core.js` pair sums agree with the oracle to 1.4e−15 relative to the sum of absolute terms (8e−10 absolute at the largest sums);
- translation, reflection and permutation leave `S` unchanged;
- the tightest slack is exactly 0 (to 4e−81) at a lone simple real point, as the proposition predicts.

Input handling, stated: `lamzouriMultiset` requires distinct `(re, im)` records with integer `m ≥ 1`; it does not merge duplicate records (a duplicate would be double-counted and is the caller's error); it returns `symmetric: false` for a non-conjugation-invariant input rather than refusing, and every caller on the page checks that flag before calling the result a theorem instance. Empty input returns `N = 0` and bounds 0. Both counting inequalities are compared with `K(z−s)²`, never `|K(z−s)|²`.

## Not claimed

The oracle checks the page's implementation of a Lean-certified finite statement; it is not a proof of anything new. The live comparison in F·ii is against the `ε → 0` limit of Lemma 3.2's constants, and the finite-height gap is explained only as far as one measured diagnostic explains it.
