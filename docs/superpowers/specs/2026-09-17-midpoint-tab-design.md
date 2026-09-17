# Continued Fractions — Midpoint tab

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

## Non-goals

No weighted or Richardson-style combinations; the question was the plain
midpoint. No mode picker: only the regular (floor) expansion alternates sides,
which the error identity needs.
