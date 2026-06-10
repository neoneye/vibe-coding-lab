# Periodic Table of Computer Science Algorithms — Design

**Date:** 2026-06-10
**Project:** `education-periodic-table-computer-science-algorithms/`
**Inspiration:** https://zperiod.app/ (interactive chemistry periodic table: color-coded category tiles, click for detail card with properties)

## Goal

A single self-contained `index.html` presenting ~100 building blocks of computer
science as a periodic-table-styled reference: color-coded element tiles grouped
into labeled category regions, with a detail card per element.

## Content

Roughly 100 elements across 12 categories. Each element has a chemical-style
1–2 letter symbol, an "atomic number" (sequential index), a name, and its
category's color.

Categories and representative members:

| Category | Members (representative) |
|---|---|
| Sorting | bubble, insertion, selection, merge, quick, heap, counting, radix, bucket, Timsort |
| Searching | linear, binary, ternary, interpolation, jump |
| Graphs | BFS, DFS, Dijkstra, Bellman-Ford, Floyd-Warshall, A*, Prim, Kruskal, topological sort, Tarjan SCC, union-find |
| Strings | KMP, Rabin-Karp, Boyer-Moore, Z-algorithm, suffix array, edit distance |
| Dynamic programming | memoization/Fibonacci, knapsack, LCS, LIS, matrix chain |
| Data structures | array, linked list, stack, queue, hash table, BST, AVL, red-black, heap, trie, segment tree, Fenwick, bloom filter, skip list |
| Paradigms | divide & conquer, greedy, backtracking, branch & bound, randomized, two pointers, sliding window |
| Math / numeric | Euclid GCD, sieve of Eratosthenes, fast exponentiation, FFT, Karatsuba, Newton's method |
| Compression / encoding | Huffman, LZ77, RLE, arithmetic coding |
| Cryptography / hashing | RSA, Diffie-Hellman, SHA, Miller-Rabin |
| ML / optimization | gradient descent, k-means, k-NN, simulated annealing |
| Concurrency / systems | mutex/locks, MapReduce, Paxos/Raft, LRU cache |

Per-element data fields:

- `symbol` (1–2 letters, unique), `name`, `category` (key into CATEGORIES)
- `year`, `inventor` (strings; "ancient"/"folklore" allowed)
- `time` (best/average/worst), `space` — complexity strings like `O(n log n)`
- `complexityClass` — one normalized average-time class used by the legend
  filter: `O(1)`, `O(log n)`, `O(n)`, `O(n log n)`, `O(n²)`, `O(2ⁿ)`, `varies`
- `description` — one paragraph
- `uses` — short list of typical applications
- `related` — list of other element symbols (clickable chips)
- `pseudocode` — short snippet; omitted where it does not apply (paradigms,
  some data structures); the card hides the section when absent

## Layout

Category-grouped grid (not the literal periodic-table silhouette): a responsive
CSS grid of labeled colored regions, each region containing its element tiles
ordered easy → advanced. Tiles look like periodic-table cells: atomic number
top-left, big symbol, small name beneath, average complexity at the bottom.

Dark theme, consistent with the repo's other projects; one accent hue per
category used for tile background/border and region label.

## Interactions

- **Hover:** tile lifts slightly; tooltip with name + average complexity.
- **Click:** modal detail card with all properties, pseudocode in a `<pre>`
  block, and clickable related-element chips that navigate card-to-card.
  Esc/backdrop click closes; prev/next arrows flip through elements in atomic-
  number order.
- **Search box:** live-dims non-matching tiles; matches name, symbol, category
  name, and complexity text.
- **Complexity legend:** a row of complexity-class chips (`O(1)` … `O(2ⁿ)`).
  Clicking a chip highlights all elements with that `complexityClass`; clicking
  again clears. Doubles as a visual legend.
- **Category legend:** category chips with their colors; clicking filters to
  that category. Search, complexity filter, and category filter compose (AND).

## Architecture

Everything inline in `index.html`, no dependencies, no build step:

- `CATEGORIES` — map of category key → { name, color, blurb }
- `ELEMENTS` — array of plain element objects (the dataset)
- Vanilla JS renders the region grid, tooltip, modal, and filters

Per repo convention, the dataset (`CATEGORIES` + `ELEMENTS`) lives in a
`shared-code` script block so `test.mjs` can extract and test it without a
browser.

## Testing

`test.mjs` (run with `node test.mjs`) validates dataset integrity:

- symbols are unique and 1–2 characters
- every `category` is a key in `CATEGORIES`
- every `related` symbol refers to an existing element
- required fields present and non-empty on every element
- `complexityClass` is one of the allowed legend values

Visual verification via headless Chrome screenshot (also used for the gallery).

## Out of scope

- Per-element animated visualizations (possible later addition)
- Literal periodic-table silhouette layout (considered, rejected in favor of
  honest category grid — easier to scan and extend)
- Mobile-first design; desktop-first like zperiod, but the grid should reflow
  acceptably on narrow screens
