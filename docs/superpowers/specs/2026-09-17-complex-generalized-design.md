# Complex terms in the Generalized tab — design

Date: 2026-09-17
Sub-project **B** of the complex work. Depends on the `CRat` type from sub-project A.

## The change

The Generalized tab's builder computes `b₀ + a₁/(b₁ + a₂/(b₂ + …))` over `Rat`.
Complex entries in the `aₙ`/`bₙ` menus require the same recurrence over `CRat`.

Rather than a second `genConvergentsComplex` beside the existing one — the kind of
duplication sub-project A's semiregular work went out of its way to delete — the
recurrence becomes polymorphic over an **arithmetic ops object**:

```
RAT_OPS  = { add, sub, mul, div, neg, isZero, zero, one, lift }
CRAT_OPS = { the same names over CRat }
```

`genConvergents` takes `ops` and is otherwise unchanged. The real path passes
`RAT_OPS` and behaves exactly as before, so no existing test changes; the complex
path passes `CRAT_OPS`. One recurrence, two instantiations.

## New sequence entries

Three additions to `CF.SEQUENCES`, each flagged `complex: true`:

| key | label | value |
|---|---|---|
| `i` | `i` | `0 + 1i` |
| `ni` | `n·i` | `0 + ni` |
| `onepi` | `1 + i` | `1 + 1i` |

A sequence is complex when it carries the flag; `CF.seq` keeps its signature. The
tab runs the complex recurrence when either chosen sequence is complex, and the
real one otherwise.

Term caps follow the existing rule: complex entries count as irrational for the
purposes of `MAX_GEN_TERMS_IRRATIONAL`, since `CRat` values grow the same way.

## What the panel shows when complex

- The tower renders each level's `aₙ` and `bₙ` via `cStr`, so `i` appears as `0+1i`.
- The value line shows `a+bi` to 14 places.
- **Identification is skipped**, and says so: the named-value table is real, and
  matching a complex value against it would be meaningless. The panel prints
  "no identification for complex values — the table of named constants is real".
- The convergence plot uses `|xₙ − xₙ₋₁|`, obtained as `ratSqrtLower(cNormSq(diff), 30)`,
  so the existing log plot works unchanged.

## Tests

- `RAT_OPS` and `CRAT_OPS` both satisfy their own ring laws on a sample: `a+0=a`,
  `a·1=a`, `a−a=0`.
- The real path is unchanged: `genConvergents` with `RAT_OPS` reproduces the existing
  Brouncker and `e`-ladder values exactly.
- `b₀=0, aₙ=i, bₙ=1` converges: successive differences shrink.
- `aₙ = i, bₙ = n` produces a value with a non-zero imaginary part, confirming the
  complex path is actually exercised rather than silently collapsing to the reals.
- A complex sequence forces the irrational term cap.

## Non-goals

- No complex identification table.
- No complex constants in the menus beyond the three above.
