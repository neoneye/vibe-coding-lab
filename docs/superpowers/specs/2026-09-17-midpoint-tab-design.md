# Continued Fractions — Midpoint tab

Renamed later the same day: the **Bounds** tab is now **Balanced pair** (modes
*parity split* and *balanced*), and the **Midpoint** tab is now **Consecutive
pair**. The text below keeps the original names.

Date: 2026-09-17
Directory: `continued-fractions/`

A ninth tab, **Midpoint**, answering one question: with f(x, n) the regular
expansion cut at n nested fractions (the convergent p_n/q_n), how accurate is
M(n) = (f(n) + f(n+1)) / 2, and is it more accurate than the Bounds tab?

## Engine

`CF.midpointRows(key, maxLevels)` in the shared-code block. For n = 0, 1, …
it pairs consecutive floor-mode convergents f(n), f(n+1) and returns, all
exact rationals: both convergents, their absolute errors, the ratio
|e_n| / |e_n+1| (null when f(n+1) hits the value exactly), the midpoint and
its error, `beatsNext`, and the Bounds tab's *balanced* pair chosen under the
same denominator budget q_n+1 with its error and `balBeatsMid`. Rows stop at
the last resolved convergent (past the reference's precision) and after an
exact hit.

## Facts the tab states, each pinned by a test

- **|M − x| = (|e_n| − |e_n+1|) / 2.** Consecutive convergents straddle x and
  the later one is closer.
- **M(n) beats f(n+1) iff the ratio is under 3.** The ratio is roughly
  q_n+2/q_n, so this happens only where the neighbouring partial quotients
  are all 1. φ wins at every n ≥ 2 (ratio → φ² ≈ 2.618; n = 1 is 3.23),
  √5 never (ratio ≈ 18), π only at n = 4 and 5.
- **At even n, M(n) is exactly the Bounds tab's independent C_k, k = n/2.**
  The Midpoint tab is the Bounds tab plus the odd pairs it skips.
- **The balanced Bounds pair under the same budget is never worse than M(n).**
  (f(n), f(n+1)) is itself in the semiconvergent pool the balanced search
  chooses from. Strict wins happen; ties are common.

So the answer to "is it more accurate than the Bounds tab" is no: it equals
the independent mode at even levels and never beats the balanced mode.

## UI

Constant chips as on Bounds. Intro paragraph with the identity and the
ratio-under-3 rule. Table: n, f(n), |err f(n)|, |err f(n+1)|, ratio, M(n),
|err M|, M beats f(n+1), the balanced pair and its error, and the best of
{f(n+1), M, balanced}. Even rows are tinted, since those are the Bounds rows.

Plot: log10 error against n for f(n), M(n), and the balanced C (dashed), from
exact-rational logs. The Bounds tab's independent C_k is drawn as a hollow
square at n = 2k so the coincidence with M(n) is visible rather than asserted.
A verdict line counts M's wins over f(n+1) and the balanced pair's wins over M,
with the largest factor.

## Where the optimum sits (added later the same day)

The midpoint is t = ½ on the segment V(t) = f(n) + t·(f(n+1) − f(n)). The
question was whether the optimum is elsewhere. It always is.

- **t* = |e_n| / (|e_n| + |e_n+1|) = ξ·q_n+1 / (ξ·q_n+1 + q_n)**, ξ the
  complete quotient x_n+2. Since ξ·q_n+1 > q_n, t* > ½ at every level: the
  optimum leans toward f(n+1). V(t*) is x itself, so knowing t* is knowing x.
- **The next term brackets it.** ξ ∈ [a_n+2, a_n+2+1) puts t* between the
  position of f(n+2) and of the semiconvergent after it; V(tLo) is exactly
  f(n+2). A weight built from the next term is one more term of the expansion.
- **Periodic expansions have a limit weight.** For the quadratic irrationals
  t* settles (√2 at 0.8536, φ at 0.7236, √5 at 0.9472). Holding t at the
  deepest level's t* beats even the balanced Bounds pair at every earlier
  level, φ included, since a weighted combination is not confined to the
  semiconvergent pool. The deepest level itself is circular and excluded.
- **Non-periodic expansions have none.** For π, e, ln 2, γ, ∛2 the value of
  t* jumps with the partial quotients. The minimax fixed weight, the t whose
  worst level relative to f(n+1) is least bad, is found exactly at a kink of
  the max of V-shaped functions; for π it is 0.9957 and barely beats f(n+1).

Engine: `weightedAt(row, t)`, `worstRatio(rows, t)`, `bestFixedWeight(rows)`,
and `tStar`, `tLo`, `tHi` on each midpoint row. UI: a weight slider with
"midpoint ½", "minimax fixed weight" and "deepest t*" chips, a V(t) series on
the error plot, a t* column, and a second plot of t* per level with the
next-term bracket, the midpoint, the slider and the minimax weight as lines.

## Non-goals

No weighted or Richardson-style combinations; the question was the plain
midpoint. No mode picker: only the regular (floor) expansion alternates sides,
which the error identity needs.
