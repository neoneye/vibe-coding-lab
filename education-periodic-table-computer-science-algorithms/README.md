# Atlas of Computational Building Blocks

A single-page reference atlas of 263 computational ideas across algorithms, data structures, systems, cryptography, ML, optimization, robotics, databases, geometry, compression, and related fields.

The current dataset is content-complete for v1:

- 263 live entries
- 263 source-checked entries
- 0 basic-checked entries
- 0 unchecked entries
- Public UI copy reflects the all-source-checked state

The v1 direction is to freeze new entries and focus on quality hardening.

## Files

- `index.html` - the atlas UI and embedded dataset.
- `test.mjs` - schema, link, and consistency checks.
- `audit.mjs` - internal editorial audit for source tiers, Wikipedia-only entries, priority weak sources, symbol links, and top-50 polish candidates.

## Verification

Run the core validation:

```sh
node test.mjs
```

Run the editorial audit:

```sh
node audit.mjs
```

Before tagging a release, also run:

```sh
git diff --check
```

## Future Work

Do not add more algorithms before v1 is tagged. The next work should improve credibility, polish, and navigability.

### 1. Link Integrity

Keep `related`, `prerequisites`, and `unlocks` symbol links clean. Broken symbolic links make the atlas feel careless even when the prose is good.

Current audit target:

- `Symbol link problems: 0`

### 2. Source Quality

All cards are source-checked, but source quality is uneven. The next credibility layer is reducing Wikipedia-only cards and increasing primary or semi-primary support.

Useful source tiers:

- Primary: original paper, RFC, standard, official implementation documentation.
- Secondary-strong: textbook, official documentation, high-quality survey.
- Secondary-basic: Wikipedia or encyclopedia-style summary.

Track:

- total entries
- primary/semi-primary count
- Wikipedia-only count
- modern/frontier/crypto/systems/ML cards without primary sources

### 3. Top-50 Editorial Polish

Polish the most central cards first: all landmarks plus high-traffic concepts such as SAT, FFT, Transformer, Dijkstra, B-tree, Paxos, Raft, pBFT, Bloom filter, hash table, binary search, and dynamic programming.

For each card, check:

- Is the core idea obvious within 10 seconds?
- Is the caveat real rather than decorative?
- Is `whyItMatters` specific and memorable?
- Are prerequisites useful?
- Are related links genuinely helpful?

### 4. Hype-Language Audit

Keep ML and frontier cards clinical. Avoid terms such as "understands", "reasons", "aligns", "intelligent", "human-like", and "state-of-the-art" unless precisely qualified.

Good cards should state:

- the actual objective or mechanism
- the signal being learned or optimized
- the assumption that makes it work
- what the result does not guarantee
- the failure or scaling risk

### 5. Routes After Audit

After source and top-50 polish, consider adding small curated routes rather than more entries:

- Foundations
- Systems
- Databases and search
- Machine learning
- Graphics and geometry
- Distributed systems

These should be preset paths through the existing atlas, not a new taxonomy.

### 6. Release Freeze

Tag v1 only after the audit is clean enough to defend publicly:

```text
Atlas of Computational Building Blocks v1 - 263 source-checked entries
```

Future entries should go through the same pipeline before they become live cards.
