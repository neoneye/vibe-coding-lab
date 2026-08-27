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

## Key decision: three standalone tests

The three instruments overlap heavily:

- All 24 IPIP-NEO-120 Openness items are a **subset** of the 300's 60 items.
- The 10-item marker shares 6 items with the 300 pool. Only 4 are new:
  "Have excellent ideas", "Am quick to understand things", "Use difficult words",
  "Am full of ideas".

The first build exploited that: one pooled set of 64 items, scored three times. The owner
rejected it. Three benchmarks means three tests — each its own published instrument, its
own entry in the battery, its own anchor to send someone.

So each ships standalone and complete, with its own item ids, its own scoring, and its own
results card. 94 items across the three, 30 of them repeated between tests. That
repetition is the accepted cost of three separately administrable instruments; a
respondent taking all three answers the shared items once per test.

A consequence worth having: each test now uses **its own source's wording**. The 300 key
and Johnson's 120 key differ on one item — "no absolute right or wrong" vs "right and
wrong" — and each test quotes the page it came from rather than being normalised to one.

## Item pools

Items are grouped in source by facet for auditability against `ipip.ori.org`.

**IPIP-NEO-300 Openness** (`ipip300`, 60 items, total 60–300):
`oi1`–`oi10` Imagination, `oa1`–`oa10` Artistic Interests, `oe1`–`oe10` Emotionality,
`ov1`–`ov10` Adventurousness, `ot1`–`ot10` Intellect, `ol1`–`ol10` Liberalism.
32 reverse-keyed. Six facet subscales of 10 (range 10–50).

**IPIP-NEO-120 Openness** (`ipip120`, 24 items, total 24–120):
`si`/`sa`/`se`/`sv`/`st`/`sl` 1–4 in the same facet order. 12 reverse-keyed.
Six facet subscales of 4 (range 4–20).

**Intellect/Imagination marker** (`ipipmarker`, 10 items, total 10–50):
`m1`–`m10` in published order, 3 reverse-keyed, no subscales — a single broad factor by
design.

The `reverse` array on each survey is the single source of truth for keying; items do not
repeat it.

**Presentation order is interleaved for the two NEO forms.** Source order is by facet so it
can be checked against IPIP; a deterministic round-robin over the facet groups builds the
administration order at load time, so ten (or four) consecutive imagination items never
appear together. Deterministic, so item order is stable across sessions and answers stay
bound to their items. The marker is a single scale and keeps its published order.

**Response scale:** the standard IPIP 5-point accuracy anchors, *Very inaccurate* (1) to
*Very accurate* (5), with the standard stem, on all three.

## Scoring

Each test uses the app's existing generic likert path: total from all items, subscales
where declared. No custom scoring code, no cross-test comparison block — comparing the
three totals as a percentage of each scale's own range is left to the reader, and the
About page says so.

## Caveats to state in the page, not smooth over

- **The Liberalism facet is US-politics-specific**: "Tend to vote for liberal political
  candidates", "Believe that we should be tough on crime", "Like to stand during the
  national anthem". Reproduced verbatim because it is part of the published instrument,
  but it travels badly outside the US and the scoring note says so.
- **This is not a DMIDI scale.** The About page describes the battery as measures of
  judgment and decision making; Openness is a personality domain, included for
  correlation against the decision scales. About copy updated to place it accordingly.
- The two IPIP pages differ on one item: "no absolute right or wrong" (300) vs "right and
  wrong" (120). Each test quotes its own source rather than being normalised to one.

## Out of scope

The other four Five Factor domains. The request was Openness; adding Conscientiousness,
Extraversion, Agreeableness and Neuroticism would quadruple the battery for a question
nobody asked.
