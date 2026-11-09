# Two-Parent Programs: design

Date: 2026-11-09, updated 2026-11-10. Status: complete draft, waiting for the owner's approval.

## Intent

A standalone page in `vibe-coding-lab/two-parent-programs/` that simulates evolution by **sexual reproduction**: two parents' genomes are combined into one child's genome, `mix(A, B) -> C`, the way a living thing gets its genome from two parents. Most naive combinations give a broken child, so few children survive. The page shows why that happens and how life gets around it: aligned genomes, rules for mixing that are themselves inherited, and early checks that stop pieces that do not fit.

The owner's question behind it: has two-parent recombination of programs ever worked? The page answers that with a working simulation and with the history (see "Prior art").

## Goals

- Creatures reproduce **only** with two parents. There is no single-parent copy-and-mutate path.
- Two breeding schemes run **side by side** on the same founders, so the difference is visible:
  - **Naive splicing:** cut each parent's genome at a random byte and glue the two halves. Like crossing two species. Expect most children to be defunct.
  - **Life's way:** genes are found by their markers and lined up by type (homology). The child takes each gene from one parent or the other. The parents' own mix genes decide how, and a lock-and-key check rejects children whose pieces do not fit, before they are born.
- Mutation is rare and gentle. It is not the engine of the simulation, recombination is.
- A faithful, educational simulation. No score, no game mechanics, no play-as mode. If a result differs from what we expect, the page reports what actually happens.

## Non-goals

- Not like Picbreeder: no human choosing favourites. Selection is survival and reproduction in a world.
- Not a mutation-only genetic algorithm.
- **No assembly or instruction set** (owner's friend). The genome does not hold instructions to execute.
- Not RNA/DNA letters (owner). The genome is bytes.

## The genome: bytes (owner's decision)

A genome is a byte string of a few hundred bytes, **base 256**, so it can be saved as a `.bin` file and inspected in any hex editor. The page also shows it as a hex dump. Its structure follows real genomes:

- **Genes have markers, with junk between them.** Each gene starts with the bytes `47 45` (ASCII `GE`) and ends with `4E 44` (ASCII `ND`), so genes stand out in a hex editor's text column. *(My call: the marker bytes.)* Between genes are non-coding bytes, like stretches of real DNA that code for nothing. A mutation there changes nothing.
- **Each gene builds part of the creature.** After the start marker, the first byte gives the gene's type and the rest are its settings. A gene with the wrong number of settings, or a missing end marker, is broken and has no effect, like a protein that does not fold.
- **The code is redundant.** Only the top four bits of the type byte choose the type (16 types), so changes to the lower four bits are silent. Settings are plain numbers 0–255, so a mutation that nudges one by a little changes the creature by a little.
- **No instructions.** Genes describe the body and the behaviour as traits and rules, the way genes make proteins rather than code.

### Gene types (draft; the builder may adjust the exact list and settings)

| Type | Gene | Settings |
|---|---|---|
| 0 | **mix** | share from parent a (0–255 → 0–100 %), number of cuts, mutation rate |
| 1 | **body** | size, speed, metabolism (energy burnt per tick) |
| 2 | **eye** | range; emits a signal with a *key* byte (sees creatures) |
| 3 | **nose** | range; emits a signal with a *key* byte (smells food) |
| 4 | **forage** rule | energy threshold ("eat when below X"); *lock* byte |
| 5 | **mate** rule | energy threshold ("look for a mate when above Y"), choosiness; *lock* byte |
| 6 | **flee** rule | size difference that makes it flee; *lock* byte |
| other | unused | no effect (room for gene duplication to create new genes) |

Each tick, the creature's rule genes are checked in genome order. The first rule whose condition holds acts: walk towards food, towards a mate, or away from a bigger creature. Otherwise it wanders.

## The mix gene (owner's idea: the mix instructions live inside both parents)

- At reproduction a coin flip picks which parent's mix gene is used. Call that parent **a** and the other **b**.
- **Share:** each gene comes from parent a with the share's probability, otherwise from b. This is the `a60b40` of the earlier draft.
- **Cuts:** with 0 cuts each gene is decided independently. With k cuts the genes are decided in blocks, with k crossover points between genes, like crossing over on a chromosome.
- **Mutation rate** for this child.
- The child inherits the mix gene that was used (from a), slightly mutated. So mixing strategies are inherited and can evolve. A real example of a gene that controls recombination is *PRDM9* in mammals, which sets the crossover hotspots.

## The fit check: lock and key (owner's idea: a self-consistency check during reproduction)

- Genes that work together carry matching bytes, the way a receptor binds a signal. A sensor gene (eye, nose) emits a signal with a **key** byte. A rule gene that needs that sense carries a **lock** byte.
- A lock binds a key when the two bytes differ by at most a small tolerance (around 8). *(My call: the tolerance.)*
- During reproduction, every rule gene in the child must bind a sensor gene in the child. If one does not, the child is **not born**: a failed conception, like the checks in meiosis and early embryos. In biology this matches Dobzhansky–Muller incompatibilities, where genes that work in their own lineage fail together with genes from another.
- Example: the child gets its eye from parent A (key `0x3C`) and its flee rule from parent B (lock `0x90`). They do not bind, so the child is not born.
- Only the lock and key bytes have to agree. Thresholds like "eat when below 30" stay free to evolve. This settles the reviewer's worry that tests would freeze the values they check.

## Naive splicing

The genome is treated as a flat byte string: the first i bytes of A plus the bytes of B from j onwards, with i and j random. Cuts land anywhere, also inside genes, which can break a gene or merge two. The same gentle mutation is then applied, there is no fit check, and every child is born. The world decides.

## Mutation (owner: less destructive)

Rare and conservative, as in biology, where most mutations land in non-coding DNA, the genetic code is redundant, and changes tend to be conservative:

- Nudge a setting byte by ±1 to ±3.
- Change the low bits of a type byte (silent).
- Change junk bytes freely (no effect).
- Rarely, duplicate a whole gene (the copy can later drift into something new) or delete one.
- Rarely, damage a marker, which switches a gene off.

## The world

- A grid of **64 × 64** cells (owner's decision), with a few walls. Food appears at random free cells at a set rate.
- Each creature has a position, energy, an age and its genome. Its colour shows its lineage or its mix gene.
- Every tick costs energy according to its body (bigger and faster costs more). Stepping onto food gives energy. A creature dies when it starves or reaches its maximum age, so generations turn over. A defunct child is one that cannot find food or a mate, for example because a split cut it off from its senses.
- **Mating:** two creatures that are next to each other, both with their mate rule active and enough energy, and not mated recently, attempt reproduction. In life's way: coin flip for the mix gene, line up genes, build the child, mutate, then the lock-and-key check, then birth or failed conception. In naive mode: splice, mutate, birth. A born child appears in a free neighbouring cell with energy given by both parents. A failed conception still costs the parents a little energy. There is a population cap.
- **Founders:** a few lineages that share gene types but differ in settings and in their lock and key bytes. Within a lineage everything fits. Some pairs of lineages are designed to fit each other, so mixed lineages can arise and carry on; others do not. *(My call, from the reviewer's questions.)* The founders may be made longer and more different from each other, so the comparison between the two schemes is fair.

## Look and feel (owner's friend: the feel of Black Mirror's "Plaything")

- **The centre of attention is two parents giving one child** (owner's friend). Everything else supports that moment.
- **Original design, not a copy** *(my call)*: no Thronglets name, characters, art, sounds or music. Only the general feel: a retro 1990s computer screen with chunky pixel art and a crowd of small, endearing creatures.
- **Creatures** are our own round pixel sprites with big eyes. Colour shows lineage. Body genes show in the sprite: size makes a bigger creature, speed longer legs, a longer-range eye bigger eyes. So you can see the genome at work.
- **Every conception is visible in the world:** the two parents lean together, a line joins them, and then either an egg appears and hatches the child (its colour a blend of the parents') or a puff of smoke shows a failed conception. Starving creatures fade, old ones grey out.
- **The birth panel (the hero of the page):** the latest conception plays as `A + B → C`. The two parents' genomes are drawn as strips of coloured byte cells, gene by gene. The genes slide into the child's strip, coloured by the parent they came from. Each lock and key lights up ✓ or ✗, and the panel ends with the egg hatching or the puff. It can be paused, replayed, or pinned to a creature that is clicked in the world.
- **Family tree:** click a creature to see its pedigree. Every creature has exactly two parents and four grandparents, back to the founders, and its genome strip shows which ancestor each gene came from.
- Counters and charts sit beside the world, in the same retro style.

## What the page shows

- **Two worlds side by side** (naive splicing on one side, life's way on the other), with the same seed and founders. Controls: run/pause, speed, reset, seed. Toggles in life's way: fit check on/off and mix gene evolving on/off, so each mechanism can be switched off to see what it does.
- **Counters and charts per world:** population; conceptions, failed conceptions and births; deaths by cause; how many children survive to adulthood; foraging rate over time; children better than both parents; how the mix genes change over time.
- **Reproduction lab:** pick two creatures or founders and do `mix(A, B)` one step at a time: the coin flip, each gene coloured by parent, the mutations marked, each lock and key with ✓ or ✗, and the verdict. Then follow the child.
- **Inspector:** click a creature to see its genome as a hex dump coloured by gene and by which parent each part came from, what each gene does, and why it died. Its genome can be saved as a `.bin` file.
- **Prior art section** with honest references: genetic programming with subtree crossover (Koza 1992) and the "headless chicken" result (Angeline 1997), Avida with sexual reproduction (Misevic, Ofria & Lenski 2006), NEAT's aligned crossover (Stanley & Miikkulainen 2002), Holland's genetic algorithms, and model-based recombination (ELM 2022, FunSearch 2023).

## Improvement (owner: yes, show that two parents can give a better child)

Staying alive is not enough. The page must also show recombination making creatures better over time, and children that do better than both their parents.

- **A reason to keep improving.** Food grows in patches that drift around the grid with the seasons, and food gets scarcer as the population grows. Creatures that see or smell further, move efficiently, eat at the right moment and find mates do better, and there is always room to do better still. *(My call: the mechanism. The builder tunes the numbers.)*
- **Founders hold different strengths.** For example one lineage has a long-range nose but a wasteful body, another an efficient body but a weak nose, a third is fast. A child that combines the best genes of two lineages can beat both, but only when its locks and keys fit. *(My call: the founders are built so that some useful combinations exist and fit, and others do not.)*
- **Measuring "better".** Each creature's **foraging rate** is the food it eats per tick of its life. The page also counts the **children that outlive or out-eat both of their parents**. *(My call: these two measures.)*
- **Charts:** mean and best foraging rate over time in each world, the share of children better than both parents, and how the founder lineages mix (how much of the population carries genes from two or more founders).
- The page reports what actually happens. If naive splicing turns out to improve as well, it says so.

## Constraints

- A single self-contained `index.html` in the vibe-coding-lab style. It works from `file://` with no dependencies. Engine logic in a `shared-code` block, tested from `test.mjs` in Node.
- Deterministic with a seed, so a run can be reproduced.
- Added to the gallery and README. Checked in Chromium and Firefox. Any PNG export renders without UI offsets.

## Left to the builder

Exact numbers (food rate, energies, cooldowns, population cap, maximum age), colours and layout, the founders' exact genomes, the final list of gene types and their settings, chart style, and how many founder lineages there are. These should be tuned so both worlds keep running without dying out at once or exploding.
