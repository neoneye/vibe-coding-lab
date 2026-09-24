# 3d-shoggoth: parameterized morphology + novelty Random

## Goal

Replace the single-blob shoggoth with a genome-driven creature whose body plan,
heads, eyes, mouths and arms are all parameterized, plus a **Random** button that
can be pressed 200 times in a row without producing a near-duplicate.

## Genome

A genome is a plain object with discrete genes (categorical) and continuous genes
(normalized 0..1 internally, mapped to ranges on use).

| Group   | Discrete genes | Continuous / count genes |
|---------|----------------|--------------------------|
| Body    | `plan` ∈ blob, heap, column, worm, ring, crawler, cluster, tree; `pattern` ∈ none, spots, stripes, mottle, veins; `dermal` ∈ smooth, warts, spines, frills | `segments` 1–9, `size`, `taper`, `lump`, `asym`, `squash` |
| Heads   | `headShape` ∈ orb, long, cone, disc, lumpy; `headMount` ∈ stalk, fused, sprout | `heads` 0–9, `neck` length, `headSize` |
| Eyes    | `eyeStyle` ∈ round, slit, compound, orb, cyclops; `eyeLayout` ∈ face, scatter, rows, rings, stalks | `eyes` 0–60, `eyeSize`, `eyeVar`, `eyeOnHeads` share |
| Mouths  | `mouthStyle` ∈ lamprey, lips, beak, vertical, grin, sphincter; `mouthPlace` ∈ heads, body, belly, arms | `mouths` 0–12, `mouthSize` |
| Arms    | `armType` ∈ tentacle, limb, feeler, tendrils, hands; `armTip` ∈ none, claw, mouth, eye, bulb | `arms` 0–24, `armLen`, `armThick`, `suckers` 0–12 |
| Surface | — | `hue`, `sat`, `accentShift`, existing sliders: hyperrealism, cartoonish, slime, cuteness, ugliness, glow |

Constraints keep creatures coherent: `crawler` has ≥4 arms (its legs), `tree`
has ≥2 heads, `mouthPlace=arms` requires arms > 0 (else falls back to body),
`headMount=stalk` is forced for `tree`.

## Novelty Random

- `genomeDistance(a, b)`: weighted sum; each differing discrete gene adds its
  weight (plan 3, styles/types ~1–1.5), counts compare on a log-ish scale, other
  continuous genes contribute small weighted |Δ|. Hue compares circularly.
- `pickNovel(history, rng)`: sample 64 candidates, return the one maximizing the
  minimum distance to the history (farthest-point sampling).
- History = last 500 genomes, persisted in `localStorage` (try/catch; works
  without it), also includes the current creature.
- Acceptance: in a run of 200 consecutive Randoms from empty history, every pair
  differs in ≥3 discrete genes or has distance ≥ a fixed threshold.

## Layout (pure, testable)

`buildLayout(genome)` → abstract description, no Three.js: body lobes
(centre, radii), head list (anchor, neck curve control points, radius, shape),
eye list (host, position, normal, size), mouth list, arm list (root, direction,
length, radius, tip). Part counts equal the genome's counts after constraints.

## Rendering

- Shared geometries/materials per build (no per-eye sphere allocation).
- Arms and necks are custom tube BufferGeometries re-bent every frame
  (parallel-transport frames), so tentacles curl; heads, suckers, tips follow.
- Existing lighting, stage, camera orbit, capture, wireframe, shadows kept.

## UI

Anatomy card → sections Body / Heads / Eyes / Mouths / Arms, each with count,
style select and size controls. Buttons: **Random** (R), **Mutate** (M, small
nudge), **Back** (B, previous creature), Reset, Capture PNG. URL hash encodes the
genome for sharing; loading a hash restores it. Specimen card shows a generated
Latin binomial and Random counter.

## Testing

`3d-shoggoth/test.mjs` runs `ShoggothTests.run()` from the shared-code block:
determinism, hash round-trip, layout counts vs genome, constraint handling,
200-Random novelty acceptance. Visual check: headless contact sheet of ~12
consecutive Randoms.
