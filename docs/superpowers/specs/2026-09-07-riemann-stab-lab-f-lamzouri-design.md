# riemann-stab — Lab F: Lamzouri's inequality, live — Design

**Date:** 2026-09-07
**Directory:** `riemann-stab/` (built from `riemann-stab/dev/` by `node dev/build.js`)
**Deliverable:** A new section of the page, "9 · Lab F — The same theorem without matrices", plus core functions with tests, the section-2 self-test extended by two rows, the certificate ladder and the ledger in the closing section updated, and the hero chips updated.

## Why

On 2026-09-07 the vibemathed.com frontier "Proportion of zeta zeros on the critical line" still records 67.25% (Claude, 2026-08-10) as the last move. The one recent result that bears on this page is Lamzouri, *A new proof that more than 2/3 of the zeros of the Riemann zeta function are simple and on the critical line*, arXiv:2609.02882 (2 Sept 2026). It reproves the 67.25% / 83.62% constants of arXiv:2608.13637 with the finite-dimensional matrix framework (compression, rank–trace, Sylvester inertia — the page's section 7 and Lab E) replaced by a single Hilbert-space inequality. AxiomProver produced Lean certificates (github.com/AxiomMath/ZetaZeros) for the finite proposition and for the theorem under the two analytic inputs.

The finite proposition is elementary and checkable in a browser, which is this page's whole method. It also makes the method's ceiling transparent in one line: for zeros that are all simple and on the line, the slack in the inequality is exactly the off-diagonal Gram mass, which is the pair-correlation input itself. That is worth showing live next to the page's own Euler–Lagrange derivation of why the constant is the constant.

The other entries that moved on vibemathed in September 2026 — bounded prime gaps 212 (AxiomProver), long prime gaps (GPT-6 Astra), the Radchenko–Viazovska Fourier-interpolation question (Bondarenko–Seip, arXiv:2608.13468) — are sieve or interpolation results with no proportion content for zeta zeros. They are recorded in the ledger as looked at and not applicable.

## The mathematics being displayed

**Proposition 2.1 (Lamzouri).** Let η ∈ L²(ℝ) be real, even, supported in (−λ, λ), with \widehat{η²}(0) = 1, and put K := \widehat{η²} (an entire function). For any non-empty finite multiset 𝒵 ⊂ ℂ invariant under complex conjugation, with m_z the multiplicity of z,

    #{ z ∈ 𝒵 ∩ ℝ : m_z = 1 }  ≥  2 Σ_{z∈𝒵} 1  −  Σ_{z,s∈𝒵} K(z − s)²          (2.4)
    #{ distinct elements of 𝒵 } ≥ (3/2) Σ_{z∈𝒵} 1 − (1/2) Σ_{z,s∈𝒵} K(z − s)²   (2.5)

where sums over 𝒵 count multiplicity. The proof: f_z(u) = η(u)e^{−2πizu} has ⟨f_z, f_s⟩ = K(z − s̄) and ‖f_z‖² = K(0) = 1; F = Σ_z f_z ⊗ f_z has ‖F‖² = Σ_{z,s} K(z−s)²; Bessel against the diagonal products ψ_j ⊗ ψ_j of a Gram–Schmidt basis gives ‖F‖² ≥ Σ_j α_j², and the scalar inequalities a² + 1 ≥ 2a, a² + 4 ≥ 4a, and α_j ≤ 0 on the last range turn Σ α_j² into 2 Σ α_j − #simple with Σ α_j = Σ_z 1.

**The kernel used on this page.** η² = f₀ with f₀(u) = cos(√2 u) / (√2 sin(1/√2)) on [−½, ½], zero outside. Then ∫f₀ = 1 and

    K(z) = f̂₀(z) = [ sinc((√2 − 2πz)/2) + sinc((√2 + 2πz)/2) ] / (2√2 sin(1/√2)),   sinc(w) = sin(w)/w,

valid for complex z (complex sine). K(0) = 1, K is even, K(z̄) = conj K(z), and K(iy) = ∫f₀(u) cosh(2πyu) du ≥ 1. For real x, K(x)² is exactly the tiling weight `overlapWeight(x)` of `dev/tiling_research.js` — the seven-point kernel of Lab E·iv is this kernel squared. Proposition 2.1 needs only η ∈ L², so this limit kernel (Lamzouri's f₀, before his smoothing ψ_δ) is an admissible instance; the smoothing is needed only for the pair-correlation lemma, not for the finite proposition.

**Applied to zeros.** 𝒵_T = { i(ρ − ½) L/2π : 0 < γ ≤ T }, L = log T, is conjugation-invariant; an element is real iff β = ½, and it is simple iff the zero is. On the line the elements are the real numbers γL/2π. Writing S(T) = Σ_{γ,γ'≤T} K((γ−γ′)L/2π)² and N = N(T):

    N₀ˢ(T) ≥ 2N − S(T),      N_d(T) ≥ (3/2)N − S(T)/2.

Lemma 3.2 gives S(T) = (C_η + O(1/√log T))·N with C_η arbitrarily close to C_MT = ½ + cot(1/√2)/√2 = 1.32749929…, hence the constants 2 − C_MT = 0.67250… and (3 − C_MT)/2 = 0.83625…. The page already holds C_MT as R(ψ_MT), the second-moment functional at its Euler–Lagrange critical point; Lamzouri writes it as Q₀(0) + 2∫₀¹ αQ₀(α)dα with Q₀ = f₀ ∗ f₀, and the two are the same integrals. Remark 3.4 of the paper: C_MT is optimal for the method (Carneiro–Chandee–Littmann–Milinovich, Cor. 14); the page's Euler–Lagrange derivation is the elementary reason.

**The weight-removal step (3.3).** The unconditional pair-correlation lemma carries the weight w(ρ−ρ′) = 4/(4 − (ρ−ρ′)²) = 4/(4 + (γ−γ′)²) on the line. With Q̂ = K² and Q̂″(x) = −4π²x²K(x)², the per-pair identity

    K(x)² = Q̂(x)·w − Q̂″(x)·w / (4L²),    x = (γ−γ′)L/2π,

is exact, and it is how the weight is removed without a T-dependent test function. The lab shows the two pieces' sizes on live data.

**Where the slack goes.** For 𝒵 all real and simple, N₀ˢ = N and the slack of (2.4) is exactly Σ_{z≠s} K(z−s)² — the off-diagonal sum, which is the pair-correlation input. An off-line conjugate pair {x+iy, x−iy}, each simple, contributes 2 − 2K(2iy)² − (cross terms) ≤ 0 to the right-hand side: the bound does not exclude off-line zeros, it charges them, and the charge grows like cosh(2π·2y).

## Components

### `dev/core.js` — pure, exported, tested

- `lamzouriKernel(x)` — real argument, closed form above; real path for speed.
- `lamzouriKernelC(z)` — complex argument `{re, im}`, returns `{re, im}`; complex sinc with a series branch for |w| < 1e−4. Real inputs must agree with the real path to 1e−14.
- `lamzouriMultiset(points)` — `points` is an array of `{re, im, m}` with distinct `(re, im)` and integer `m ≥ 1`. Returns `{N, S, Sim, simpleReal, distinct, simpleBound, distinctBound, symmetric}` where `N = Σm`, `S = Re Σ_{z,s} m_z m_s K(z−s)²`, `Sim` is `|Im Σ …|` (must be ~0 when symmetric), `simpleBound = 2N − S`, `distinctBound = 1.5N − S/2`, `symmetric` is whether every non-real point has its conjugate with the same multiplicity. O(n²).
- `lamzouriZeroBound(gammas, T)` — real-path specialisation for ordinates 0 < γ ≤ T: `L = log T`, `x_k = γ_k L/2π`, `S = Σ_{j,k} K(x_j − x_k)²`; returns `{N, L, S, offDiag, simpleBound, distinctBound, ratioS, ratioSimple, ratioDistinct, weightedPiece, correctionPiece}` where `weightedPiece = Σ K² w` and `correctionPiece = Σ π²x²K²w/L²` over all ordered pairs, so `weightedPiece + correctionPiece = S` to rounding.
- `montgomeryTaylorViaQ(n)` — `Q₀(α) = ∫ f₀(u) f₀(α−u) du` by Simpson with `n` panels (default 400), returns `Q₀(0) + 2∫₀¹ αQ₀(α)dα`. Must agree with `½ + cot(1/√2)/√2` to 1e−8 and with `winFunctionalR('mt')` to 1e−5.
- `randomLamzouriMultiset(seed, opts)` — deterministic (mulberry32): `n1` simple reals in `[0, W]`, `n2` reals with `m ∈ {2,3}`, `n3` conjugate pairs with `im ∈ (0, 0.6]` and `m ∈ {1,2}`; ranges drawn from the seed. Used by the tests and by F·i.

### `dev/test.js` — additions

- Kernel: `K(0) = 1`; `K(x)² = overlapWeight(x)` (from `tiling_research.js`) to 1e−13 on a grid; real vs complex path; `K(z̄) = conj K(z)`; `K(iy) ≥ 1` for `y ∈ [0, 2]`; evenness.
- Proposition 2.1 on 300 seeded random multisets: both inequalities hold; also the tight cases — one simple real point gives `simpleBound = 1` exactly; a lone conjugate pair gives `simpleBound = 2 − 2K(2iy)² ≤ 0`; a non-symmetric input is flagged.
- `montgomeryTaylorViaQ` three-way agreement.
- Weight identity per term to 1e−13 on random `(γ−γ′, L)`.
- `lamzouriZeroBound` on the 30 reference zeros: `S/N > 1`, `simpleBound < N`, and `S` equals `lamzouriMultiset` on the same points as a multiset to 1e−9.

### `dev/template.html`

- Hero chip: `source: preprint arXiv:2608.13637 v2 · Lean-checked · review ongoing` becomes two chips: the existing one, and `second proof: arXiv:2609.02882 (Lamzouri, 2 Sep 2026) · matrix-free · Lean-certified by AxiomProver`.
- Nav: insert `9 · Lab F — The same theorem without matrices`; "My stab" becomes item 10 with `id="s10"`.
- New section `<h2 id="s9">` with:
  - Prose: what the September paper does, in the page's voice; the four-line mechanism (f_z, Gram identity, ‖F‖² = ΣK², Bessel + a²+1 ≥ 2a), with a `formula` block for (2.4)/(2.5).
  - **F·i — Proposition 2.1, adversarially.** Badges `THEOREM (Lean-certified externally)` and `NUMERICAL`. Button `lfAdvRun` "throw 200 random multisets at it". Stat grid `lfAdvStats`: multisets tried, violations (must be 0), smallest slack of (2.4), smallest slack of (2.5), largest off-line charge seen. Table `lfAdvTable` of the five tightest cases (N, simple real, bound, slack, composition). Verdict `lfAdvVerdict`. A sentence saying a violation here would mean a bug in this page's kernel, not in the theorem.
  - **F·ii — the bound on the zeros this page computed.** Badge `LIVE`. Button `lfLiveRun` "run on all zeros up to t = 600" with progress bar `lfBar` (reuses `getZeros600`). Canvas `lfPlot`: the ratio (2N − S)/N against T for T = 100, 150, …, 600, with the asymptote 2 − C_MT drawn, and the distinct-count ratio with its asymptote (3 − C_MT)/2. Stat grid `lfLiveStats`: N(600), L, S/N, bound ratio, distinct ratio, weighted piece / N, correction piece / N, off-diagonal / N (= the slack). Note: at T = 600 the error term's natural scale 1/√log T is about 0.4, so the reader is looking at finite-height truth, not the asymptote.
  - **What-if sliders** inside F·ii: `lfPairs` (0–8) "replace p on-line zeros by off-line pairs" and `lfBeta` (0.51–0.90) "at β". Output `lfWhatIf`: the new N, the true simple-real count N − p, the bound, and the per-pair charge 2K(2iy)² − 2 with y = (β−½)L/2π. The inequality is re-checked on every move and the panel says so. The p zeros replaced are the p highest below T.
  - **F·iii — one number, three computations.** Box `lfConst`: C_MT from the closed form, from R(ψ_MT) (Lab E's functional), and from Q₀(0) + 2∫αQ₀ (Lamzouri's form), with their differences. Then a paragraph: Remark 3.4 and the Euler–Lagrange reason; and the slack identity in the all-simple case, stated as the one-line explanation of the ceiling.
- Section 7, constants panel: one sentence pointing to Lab F.
- Section 10 (old 9): ladder gains a row `Lamzouri, Sept 2026 | same support-≤1 inputs (BGSTB) | one Hilbert-space inequality: Bessel + a²+1 ≥ 2a | 2/3, 0.67250 (reproof, Lean-certified)`. The approaches table gains `Hilbert-space route as a base for a stability-defect term | open — untried | in the all-simple case the slack is the off-diagonal Gram mass; a defect term would have to price it`. A new short panel `Survey of the record (vibemathed.com, accessed 2026-09-07)` lists: frontier unchanged since 2026-08-10; Lamzouri = reproof, no new constant; prime-gap entries and the Fourier-interpolation entry looked at and not applicable, one line each. The candidate-ecosystem paragraph gets a dated sentence: re-checked 2026-09-07, no named-author posting, frontier unchanged.

### `dev/ui.js`

- Section-2 self-test: two new rows — `K = f̂₀ normalised: |K(0) − 1|` and `C_MT three ways: max pairwise difference` — both must be < 1e−8 (the self-test pass threshold in the existing code is `val < 1e−8`).
- New IIFE for Lab F: F·i handler, F·ii handler using `getZeros600` and `runChunks` (the O(n²) sums are chunked by T-ladder step), plot on `lfPlot` via `setupCanvas`, what-if sliders, F·iii constants box filled at init.

### `dev/ui_dom_smoke.js`

- `DEFAULT_VALUE` gains `lfPairs:'0', lfBeta:'72'`.
- Drive `lfAdvRun`, `lfLiveRun` clicks and `lfPairs`, `lfBeta` inputs.
- Expected self-test rows: 10.
- Assertions: `lfAdvStats` has children and `lfAdvVerdict` contains `no violation`; after the zeros are ready, `lfLiveStats` has ≥ 6 children and `lfWhatIf` contains `inequality holds`.

### Root `README.md`

The riemann-stab highlight gains one clause naming the September reproof.

## Non-goals

- No attempt to raise the unconditional constant. The page states the reason: with support-≤1 pair-correlation inputs the method is sharp at 2 − C_MT (Remark 3.4), and the broader bandwidth-one obstruction is ≈0.68183.
- No change to the E·iv tiling program or its transcripts; `core.js` is not a provenance input of any sweep transcript (verified before editing).
- No new Lean; the finite proposition is already certified upstream and is linked.

## Testing

- `node dev/test.js` — all existing tests plus the additions above.
- `node dev/build.js && node dev/ui_dom_smoke.js` — the shipped UI runs headlessly, handlers fire, assertions above hold.
- `node dev/labs_shipcheck.js` unchanged and green.
- The full `sh dev/run_suite.sh` is not required for this change (Lean and Arb parts are untouched); the fast subset is run and its output recorded in the commit message.
- Visual check of the new section in the Browser pane.
