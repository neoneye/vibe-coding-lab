# Continued Fractions — Bracket tab

Date: 2026-09-18
Directory: `continued-fractions/`

A tab about continued fractions as continued fractions: two of them that
bracket a constant, and the continued fraction of their midpoint. The earlier
"Balanced pair" and "Consecutive pair" tabs answered a different question,
about single fractions p/q; this one prints the terms.

## Construction

Cut the regular expansion after a_n: x = [a0; a1, …, a_n, t] with tail t > 1.
The value is monotone in t, so x lies strictly between

- [a0; …, a_n]      (t = ∞, the convergent p_n/q_n), and
- [a0; …, a_n + 1]  (t = 1, the semiconvergent (p_n + p_n−1)/(q_n + q_n−1)).

Which one is above alternates with n: at even n the cut-off expansion is
below. **A** is whichever is above, **B** whichever is below. They share every
term but the last, which differ by exactly one. Every real whose expansion
starts a0…a_n lies between them, so they are the closest continued fractions
of that length on either side.

**C = (A + B) / 2** is rational and strictly inside the bracket, so its own
expansion starts with the same n+1 terms and then continues. |C − x| is
exactly half the difference of A's and B's errors.

## Engine

`CF.bracketRows(key, maxDepth)`: for n = 0, 1, … returns termsA, termsB,
termsC (BigInt arrays), the three values, the three absolute errors, and
`midBeatsBoth`. Rows stop before any error falls to the reference's
precision, and before a bound would land on the value itself (355/113 has
two depths).

## UI

Constant chips, a depth slider, and the terms table for that depth: A's
integers on the top row, C's in the middle, B's on the bottom, one column per
term, the differing last term in bold, then p/q, decimal value and error. Below
it, a table over every depth with A and B written as [a0; a1, …], their
errors, C and its error, the terms C continues with, and the best of the
three. A log-error plot per depth and a one-line verdict.

## Weight

As on the Consecutive-pair tab: V(t) = B + t·(A − B), so t = 0 is B, ½ is C,
1 is A. Each depth's optimal weight t* = |err B| / (|err A| + |err B|) is
where x sits inside the bracket; it can be on either side of ½. The terms
table gets a fourth row with V(t)'s own expansion. A slider and the chips
"midpoint ½", "minimax fixed weight" (least-bad depth relative to the better
of A and B) and "deepest t*"; V(t) on the error plot; a plot of t* per depth.
For √2 t* settles at ½, so C itself is nearly optimal.

## Tests

Shared prefix and last terms differing by one with the parity rule; A above
the whole enclosure and B below it; C = (A+B)/2 with the half-difference
error identity; C's expansion starting with the shared terms and rebuilding
C; π at depth 1 giving 22/7, 25/8 and 351/112 = [3; 7, 2, 7]; rows stopping
at the reference precision.
