# IPIP-NEO Openness to Experience — design

Date: 2026-08-27
Project: `dmidi-survey/index.html`

## Why not the NEO-PI-R

The request was for "NEO-PI for measuring openness to experience". The NEO-PI-R is a
commercial instrument owned by PAR Inc.; its 240 items are licensed, not published.
Reproducing the 48 Openness items in a public web page would be a copyright violation,
which is also why the DMIDI catalogue links the NEO rather than reprinting it.

The substitute is the **IPIP-NEO** (Goldberg's International Personality Item Pool):
explicitly public domain, written to correlate with the NEO-PI-R facets, and using the
same six Openness facet names. Item text and keying were taken verbatim from the
authoritative source, `ipip.ori.org`.

## The three benchmarks

| # | Instrument | Items | Structure | Reported alpha |
|---|-----------|-------|-----------|----------------|
| 1 | IPIP-NEO-300 Openness (Goldberg, 1999) | 60 | 6 facets x 10 | .77–.86 by facet |
| 2 | IPIP-NEO-120 Openness (Johnson, 2014) | 24 | 6 facets x 4 | .63–.74 by facet |
| 3 | IPIP Big-Five Factor Markers, Intellect/Imagination (Goldberg, 1992) | 10 | single score | .84 |

Facets in 1 and 2: Imagination, Artistic Interests, Emotionality, Adventurousness,
Intellect, Liberalism.

## Key decision: one pooled item set, three scoring keys

The three instruments overlap heavily:

- All 24 IPIP-NEO-120 Openness items are a **subset** of the 300's 60 items.
- The 10-item marker shares 6 items with the 300 pool. Only 4 are new:
  "Have excellent ideas", "Am quick to understand things", "Use difficult words",
  "Am full of ideas".

Administering the three as separate surveys means 94 questions of which 30 are literal
duplicates. Beyond the tedium, a respondent who answers "Have a vivid imagination"
differently on its second and third appearance injects noise into precisely the
comparison the three benchmarks exist to support.

So: **administer the union once — 64 items — and score it three times.** Same responses,
three keys. This is how one would compare instruments on a single respondent.

Trade-off accepted: a single nav entry and anchor (`#ipipo`) rather than three
separately linkable surveys.

## Item pool

64 items, grouped in source by facet for auditability against `ipip.ori.org`:

- `oi1`–`oi10` Imagination (`oi7`–`oi10` reverse-keyed)
- `oa1`–`oa10` Artistic Interests (`oa6`–`oa10` reverse)
- `oe1`–`oe10` Emotionality (`oe6`–`oe10` reverse)
- `ov1`–`ov10` Adventurousness (`ov5`–`ov10` reverse)
- `ot1`–`ot10` Intellect (`ot6`–`ot10` reverse)
- `ol1`–`ol10` Liberalism (`ol4`–`ol10` reverse)
- `om1`–`om4` marker-only items (all positive, `scored:false`)

32 of the 60 NEO-300 items are reverse-keyed. The `reverse` array on the survey is the
single source of truth for keying; items do not repeat it.

**Presentation order is interleaved, not grouped.** Source order is by facet so it can be
checked against IPIP; a deterministic round-robin over the seven groups builds the
administration order at load time, so ten consecutive imagination items never appear
together. Deterministic, so item order is stable across sessions and answers stay bound
to their items.

**Response scale:** the standard IPIP 5-point accuracy anchors, *Very inaccurate* (1) to
*Very accurate* (5), with the standard stem.

## Scoring

`scored:false` on the four marker-only items keeps them out of the survey total, so the
generic likert path yields the NEO-300 score directly:

- **Total** = IPIP-NEO-300 Openness, 60 items, range 60–300
- **Subscales** = the six NEO-300 facets, 10 items each, range 10–50

A custom block adds the other two keys and the comparison:

- IPIP-NEO-120 Openness: 24-item subset, range 24–120; six facets of 4, range 4–20
- Intellect/Imagination marker: 10 items, range 10–50
- All three rescaled to a common 0–100 position-within-range metric, plus a facet-level
  300-vs-120 comparison on that metric

The existing `unscored` chip says "included to obscure scale purpose", which is true of
Rotter's filler items but false here — the marker items are scored, just on a different
key. The chip label and tooltip become per-survey so this one can read "marker only".

## Caveats to state in the page, not smooth over

- **The Liberalism facet is US-politics-specific**: "Tend to vote for liberal political
  candidates", "Believe that we should be tough on crime", "Like to stand during the
  national anthem". Reproduced verbatim because it is part of the published instrument,
  but it travels badly outside the US and the scoring note says so.
- **This is not a DMIDI scale.** The About page describes the battery as measures of
  judgment and decision making; Openness is a personality domain, included for
  correlation against the decision scales. About copy updated to place it accordingly.
- The two IPIP pages differ trivially on one item: "no absolute right or wrong" (300)
  vs "right and wrong" (120). The 300 wording is used, since the 300 pool is what is
  administered.

## Out of scope

The other four Five Factor domains. The request was Openness; adding Conscientiousness,
Extraversion, Agreeableness and Neuroticism would quadruple the battery for a question
nobody asked.
