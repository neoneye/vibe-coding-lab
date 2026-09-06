# Assembly audit: from a block floor to a proportion of zeros

Stage 2 of `CLAUDE_INVESTIGATION_PLAN.md`. Written 2026-09-07 at commit `107fbd9` plus the working tree of that day.

## What was found

The "external shifted-block assembly nobody here can check" of `TILING_DUAL_RESEARCH.md` is a Lean 4 theorem. It lives in `teal-sea/zeta-lab` (cloned at `47d0241`, 2026-09-06), file `lean/bridge/V2Challenge.lean` (statement surface, deliberate `sorry`s) with the proofs in `lean/bridge/Zeta23Ext/Bridge/` (`Main.lean`, `S6`–`S16`), built on `anthropics/zeta-23-lean` at `3635e74` (the Lean arm of arXiv:2608.13637). It was registered at the Palomar Registry as `PALOMAR-2026-08-25-000005`; the repository's `lean/bridge/AXIOM-AUDIT.md` pins the `#print axioms` log of the frozen tree (`propext, Classical.choice, Quot.sound`, no `sorryAx`). No person has reviewed it, by the repository's own statement.

An independent `lake build V2Challenge V2Solution` of that tree was started here on 2026-09-07 (log: scratchpad `lean_bridge_build.log`); its outcome is recorded in `REPORT.md` when known. Until then, "kernel-checked" rests on the registry's replay and the pinned log, not on a build in this repository.

## The theorem, verbatim in substance

```
def Phi_n (n : ℕ) (c : ℝ) (m p : ℕ) : ℝ :=
  (H - ((n : ℝ) - 1) * ((m : ℝ) - 1) / ((p : ℝ) * m)) / (1 - c * ((m : ℝ) - ((n : ℝ) - 1)) / m)

theorem n_point_bound (n : ℕ) (c : ℝ) (m p : ℕ) (hn : 2 ≤ n) (hm : n ≤ m) (hp : 0 < p) (hc : 0 < c)
    (hCert : ∀ g : Fin (n - 1) → ℝ, (∀ i, 0 ≤ g i) → c ≤ F n p g)
    (hA0 : c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ 1) :
    ∀ ε > 0, ∃ T₀ : ℝ, ∀ T ≥ T₀, (Phi_n n c m p - ε) * (Ncount T (2 * T) : ℝ) ≤ N0simple T (2 * T)
```

with `H = 3/2 − (1/√2)cot(1/√2)`, `F n p g = (1/p)Σgᵢ + Σ_{i<j} (2/(n−(j−i))) w(yⱼ−yᵢ)`, `w = (K/K(0))²`, `K(x) = ∫_{−1/2}^{1/2} cos(√2 t)cos(2πxt)dt`. `Ncount`/`N0simple` count zeros of Mathlib's `riemannZeta` in `(T, 2T]` with multiplicity / simple on the line.

## Term-for-term match with the page

`tiling_research.js:projectedSimpleZeroBound(floor, n, p, base)`:

| page | Lean | match |
|---|---|---|
| `windowsPerBlock = floor((1−1e−12)/floor)` | cap `hA0: c(m−(n−1)) ≤ 1`, i.e. `W ≤ 1/c`, so `W = ⌊1/c⌋` | equal unless `1/c` is an exact integer, where the page takes `W−1` (conservative, still admissible) |
| `blockSize = W + n − 1` | `m` | equal |
| `defectCoefficient = floor·W/m` | `c(m−(n−1))/m` | equal |
| `spanCoefficient = ((n−1)/p)((m−1)/m)` | `(n−1)(m−1)/(pm)` | equal |
| `bound = (base − span)/(1 − defect)` | `Phi_n` | equal, with `base = H` |

Recomputed in `mpmath` at 40 digits directly from `Phi_n` (script in this file's history; see `REPORT.md` for the command):

| instance | `n` | `c` | `p` | `m` | `Phi_n` | page / source |
|---|---|---|---|---|---|---|
| Ainta, per-block certificate | 7 | 19/5000 | 3000 | 269 | 0.67300852792777976 | page `0.6730085279277798` ✓ |
| zeta-lab three-point, **unconditional** | 3 | 1345/10⁶ | 3000 | 745 | 0.67273733450380945 | their README ✓ |
| zeta-lab four-point, **unconditional** | 4 | 2310/10⁶ | 2500 | 435 | 0.67284701976668883 | their README ✓ |
| zeta-lab eight-point, conditional on an Arb run | 8 | 41763/10⁷ | 3200 | 246 | 0.67305298298962889 | their README ✓ |
| page `sharp` chain floor, **naively** | 7 | 0.003956 | 3000 | 258 | 0.67310935014636168 | page ✓ |
| page alternating-chain energy, **naively** | 7 | 0.003957393309 | 3000 | 258 | 0.67311026973978851 | page ✓ |

So the page's projection is the Lean theorem's formula. The strictness offset `1e−12` is a benign convention: the Lean cap is non-strict, so at an exact reciprocal the page under-counts one window, which only lowers its number.

## Is `n` free? Is `p` free?

Both are parameters of `n_point_bound`, with side conditions `2 ≤ n ≤ m`, `0 < p`, `0 < c`, `c(m−(n−1)) ≤ 1`, and the certificate at the same `(n, p)`. This answers the two questions the research note put to "whoever has the manuscript": the `1/3000` is a choice, not a derivation, and general `n` is allowed. The block-size scan and the pressure optimisation of the note are therefore mathematics about a well-posed parameter of the theorem — still subject to the missing lemma below, since they were run on chain floors.

## The hypothesis is per-block, and the page's floors are not

`hCert` demands `c ≤ F n p g` for **every** nonnegative gap vector: a floor on the isolated block. The isolated seven-point block minimum is `0.003826231211` (note, "The isolated-block search"). Every chain floor on the page (`0.003956` swept with proved enclosures; `0.003957393309` via the pinned pair certificate) exceeds it, so none of them satisfies `hCert`. They are floors on `F(g) + Φ(σg) − Φ(g)` — telescoping certificates whose sum over the windows of a chain is a floor on the chain energy up to a boundary term.

## The exact missing lemma

`hCert` is consumed in exactly one place: `Zeta23Ext/Bridge/S11.lean`, theorem `block_energy`, lines 240–252:

```
have hwin : ∀ i ∈ range (m - (n - 1)), c ≤ F n p (windowGaps n Y i) := by ... apply hCert ...
have hsum : c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ ∑ i ∈ range (m - (n - 1)), F n p (windowGaps n Y i) := ...
```

and everything after `hsum` — the telescoping of the pressure terms, the fibre-wise regrouping of pair terms, `S13.block_bound`, `Main.block_bound_eventually`, `pre_solve`, the final elimination — uses only `hsum`. (`grep -rn hCert Zeta23Ext` shows the other occurrences merely pass the hypothesis down to `block_energy`.)

Therefore the statement that would accept the page's chain floors is

```
theorem n_point_bound_sum (n : ℕ) (c : ℝ) (m p : ℕ) (hn : 2 ≤ n) (hm : n ≤ m) (hp : 0 < p) (hc : 0 < c)
    (hSum : ∀ Y : Fin m → ℝ, StrictMono Y →
              c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ ∑ i ∈ range (m - (n - 1)), F n p (windowGaps n Y i))
    (hA0 : c * ((m : ℝ) - ((n : ℝ) - 1)) ≤ 1) : ... same conclusion ...
```

obtained by cutting `block_energy` at `hsum`. The hypothesis is needed only at the theorem's own `m`. **This lemma is identified, not proved.** It looks like a routine refactor of S11; it has not been attempted here because the Mathlib build was still running when this was written.

## What a telescoping certificate supplies, and what it costs

If `R(g) = F(g) + Φ(σg) − Φ(g) ≥ c` for every window `g` (the page's certificates, with `Φ` the state potential on five consecutive gaps), then summing over the `W = m−(n−1)` windows of a sorted `m`-block gives `Σ F ≥ cW − (Φ(last) − Φ(first)) ≥ cW − 2 sup|Φ|`. So `hSum` holds at `c′ = c − 2 sup|Φ|/W`. The page records `amplitude ≥ 2 max|Φ|` for each additive certificate (the same quantity that bounds its tail cube), and the pair certificate adds at most `4 × cap = 8e−5` to that of its `record` base. Solving `W = ⌊1/c′⌋` self-consistently:

| certificate | chain floor `c` | amplitude | `W`, `m` | `c′` | `Phi_n(c′)` | naive `Phi_n(c)` |
|---|---|---|---|---|---|---|
| `sharp` additive (rigorous sweep complete) | 0.003956 | 1.2818e−3 | 253, 259 | 0.0039509336 | **0.6731062160** | 0.6731093501 |
| `record` additive | 0.003957227285 | 5.1968e−3 | 254, 260 | 0.0039367674 | 0.6730970728 | 0.6731101602 |
| pinned pair (on `record`) | 0.003957393309 | 5.1968e−3 + 8e−5 | 254, 260 | 0.0039366185 | 0.6730969745 | 0.6731102697 |

Two consequences the note did not have. Paying the boundary term reverses the order: the amplitude-minimised `sharp` certificate is worth more than the pair certificate that "reaches the ceiling", because the pair certificate inherited the record base's amplitude. And `0.6731062` still exceeds both the eight-point conditional figure `0.6730530` and the seven-point per-block family ceiling `0.673029553` measured in zeta-lab (`lean/bridge/README.md`), which is what a coboundary certificate buys over a per-block one — conditional on `n_point_bound_sum`.

## Dependency table

| ingredient | status | where |
|---|---|---|
| kernel `K`, `w = (K/K0)²`, Fourier convention | proved (Lean def, matches page to 1e−13; see `LAB_F_AUDIT.md`) | `V2Challenge.lean` 128–135; `tiling_research.js` |
| base constant `H` | Lean theorem (`zeta-23-lean` Theorem D), Lamzouri reproof | arXiv:2608.13637, 2609.02882 |
| unconditional analytic input (pair correlation, BGSTB) | Lean, as `PaperInputs` of the upstream | `Main.lean` |
| finite inequality, per block, at `(7, 19/5000, 3000)` | Arb program accepts; **not** Lean | Ainta; page's `bare` control sweep reproduces `F6 ≥ 19/5000` |
| finite inequality, per block, at `n = 3, 4` | **Lean** (interval cell lemmas) | `ThreePoint.lean`, `FourPoint.lean` |
| block/chain counting, multiplicities, off-line pairs, elimination | Lean (`S6`–`S16`) | `Zeta23Ext/Bridge/` |
| window-sum variant of the hypothesis | **missing**; identified above | — |
| telescoping lemma (coboundary → chain floor + O(1)) | Lean, page's own `coboundary_floor_telescopes`, `chain_inequality` | `dev/lean/ZetaClaims.lean` |
| chain floor `0.003956` on `[0,16]⁶` + tail lemma | exhaustive subdivision with proved enclosures, **modulo the page's own arithmetic**; Arb sample-checked only (39/220, 67/220 confirmed, 0 refuted) | `tiling_interval.results.json`, `sweep_proof_arb.results.json` |
| boundary term ≤ amplitude | derived above from the certificate's definition; not in Lean | — |

## Decision

The bridge exists and is readable. Continue the auxiliary-chain work only as conditional on `n_point_bound_sum`, and state every projection with the boundary term paid. The single highest-value next step in this direction is to prove `n_point_bound_sum` in a fork of `zeta-lab` (a cut at `hsum` in S11), which would make the page's `sharp` sweep the binding item.

The defensible **unconditional** record, for anyone who accepts a registry-replayed Lean build with standard axioms and no human review, is zeta-lab's four-point `0.6728470198`; for anyone who insists on human review it remains `0.6725007037`. The page now says both.
