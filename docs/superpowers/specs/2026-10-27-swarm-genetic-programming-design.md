# Swarm genetic programming: design

Date: 2026-10-27. Directory: `swarm-genetic-programming/` (name is my call).

## Intent

The owner is the author of LODA (assembly-like programs mined against OEIS sequences). They want a genetic algorithm in the same spirit, but for a swarm of creatures on a 2D grid, inspired by the Black Mirror episode "Plaything" (season 7): one creature isn't smart, the swarm together can take on problems.

LODA had OEIS to tell whether a program works. Here the equivalent is **obstacle courses**: the swarm has to navigate around obstacles and solve tasks on the way (math tasks such as evaluating a polynomial whose parameters are given, accepted within an error threshold). A program that clears a course is verified, and programs accumulate in a library for the ecosystem, like LODA's mined programs.

The rule engine is Rust compiled to WebAssembly (for performance), so most testing happens in `cargo test`. The page is "somewhat standalone": an HTML page plus the wasm.

## Owner's decisions

- A creature occupies exactly one cell; at most one creature per cell.
- Finite grid, 16-bit x and 16-bit y.
- Assembly-like DSL, one instruction per line: `instruction target, source ; comment`.
- Functions from a registry are called with `f<inputs><outputs>`. `f13 $0,$10` calls the function whose id is in `$10` and writes its outputs to `$0,$1,$2`. **Inputs first**: in LODA `f21` means 2 inputs, 1 output (`f21 $8,1010` is "product of 2 values"). So the owner's "move 1 unit towards location", with 2 inputs and 1 output, is an `f21`, not `f12` as first written. LODA is the precedent for the digit order only. The operand layout below is new.
- Movement is 1 unit per move. Direction is an integer 0..15, 22.5° per step (0 = 0°, 4 = 90°).
- Registry function "move 1 unit towards (x,y)": finds the optimal path, steps 1 unit along it, goes around cells occupied by creatures; its output says whether the destination is reached or the path is blocked.
- Other navigation functions the owner listed: walk towards the nearest creature, walk away from the nearest creature, walk towards a particular id (goal post / exit / food / unsolved problem / solved problem / creature with id), exchange things between creatures.
- **Exactly one loop instruction, structured, not a goto.** LODA's many loop variants are a regret.
- Programs accumulate in a library, like LODA.
- Lives in vibe-coding-lab (not loda-rust).
- Start with a minimal set of mechanisms, then do **a few iterations** adding mechanisms for exchanging knowledge / food / assets between creatures.

## Goals

1. A Rust crate (no external crates, so `cargo test` works offline) containing: grid world, creatures, DSL parser + interpreter, function registry, courses, fitness, genetic algorithm, library.
2. Most tests in Rust.
3. A page that runs the GA in the browser via wasm, animates the swarm running the best program on a course, and shows the library as readable program text.
4. v1 with a minimal mechanism set, then three exchange iterations (below), each one adding a course where the new mechanism pays off.

## Non-goals

- Programs calling other library programs (LODA's `seq`). A natural later step, not in this round.
- Floats in the DSL.
- Multiple swarms competing on one course (v1 swarms are homogeneous; iteration 3 changes this only as far as described).
- Persistence beyond the viewer's browser (no server).

## Anti-goals

- A second loop instruction, a `break`, a conditional jump, or any goto. If a program needs a condition, it gets it by arithmetic or by a loop count of 0 or 1.
- Copying the episode's game: no recreations of its creatures, look, names or UI. The episode is a mood reference; visuals are original.
- A page that needs a build step or network to open: the committed wasm must load from the committed files.

## World (my calls)

- Grid `width × height`, both `u16`, origin top-left, x right, y down. Starter courses are about 64 × 48.
- Each cell holds at most one of: empty, wall, creature, food, station, gate, exit.
- **Exit:** a creature that steps onto an exit cell is "out": it leaves the grid (frees the cell) and counts as arrived.
- **Station:** a problem. Unsolved stations hold a task. A creature standing orthogonally/diagonally adjacent to a station can read its task and submit an answer. When any creature submits an accepted answer, the station becomes *solved* and the gates linked to it open (gate cells become empty). One solver lets the whole swarm through: the first cooperation mechanism.
- **Food:** stepping onto food eats it (+energy). Each creature has energy; it spends 1 per tick; at 0 it is *exhausted*: it stays on its cell as an obstacle and stops running. Starter courses give enough energy that food only matters on the food course.
- Every creature and every non-empty thing has an id (u32). Things also have a *kind* number: 1 wall, 2 creature, 3 food, 4 unsolved station, 5 solved station, 6 gate, 7 exit.

## Ticks (my calls)

- One tick: creatures act in an order shuffled by the world's seeded RNG. Each creature runs its program from the top, with registers persisting between ticks.
- Per tick each creature has an instruction cap (200 executed instructions, loop iterations counted) and at most **one move**. A second move call in the same tick does nothing and returns the "already moved" status.
- If the program errors (division by zero, overflow), the creature's tick ends there; its registers keep what was written before the error.
- Everything is deterministic for a given seed.

## Creature (my calls)

- 16 registers `$0..$15`, `i64`. On spawn: all 0 except as listed in the registry (e.g. none preloaded; programs read their state through functions).
- Energy (starts at a per-course value), position, a sub-cell heading accumulator (see `step`), an id.

## DSL (my calls unless marked)

Syntax, one per line, `;` starts a comment, blank lines ignored:

```
mov $1,5        ; $1 = 5
add $1,$2       ; $1 += $2
mov $4,2        ; function id 2 = walk_to_xy
f21 $0,$4       ; id in $4, inputs $5,$6, output $0
lpb $3          ; loop body runs $3 times
  sub $1,1
lpe
```

- Operands: `$n` register or integer constant (source only).
- Arithmetic (LODA names): `mov add sub mul div mod min max`. `div`/`mod` by 0 is an error. Overflow is an error (checked arithmetic). `div` truncates.
- **Function call (owner's syntax):** `f<in><out> $target,$source`. The **source register holds the function id** (owner: in `f13 $0,$10`, `$10` contains the function id). The id is read at run time, so a program can compute which function it calls. The inputs are the `in` registers after the id, `$source+1 … $source+in`, and the outputs are written to `$target … $target+out-1`. That inputs follow the id is my reading of the owner's example. A register range past `$15` is a parse error. An unknown id, or an id whose registry signature doesn't match the in/out digits, is a run-time error that ends the creature's tick. The page's program view annotates each call with the function name when the preceding instructions make the id a known constant.
- **The one loop:** `lpb $c` … `lpe`. The source operand is read once when the loop starts, clamped to 0..=255, and the body runs exactly that many times. Changing `$c` inside the body has no effect on the count. Loops nest (max depth 4). The per-tick instruction cap still applies. No other control flow exists. (Owner: one structured loop, not goto. The fixed-count semantics are my call; they make every program terminate by construction and remove the "does this loop decrease?" class of bugs LODA had.)
- Parser and serializer round-trip: `serialize(parse(text)) == canonical text`.

## Function registry v1 (my calls; owner listed the navigation ideas)

Status codes for moves: `1` arrived / at target, `0` moved one step, `-1` blocked or no path, `-2` already moved this tick.

| id | sig | name | does |
|---|---|---|---|
| 0 | f02 | my_position | outputs x, y |
| 1 | f11 | step | input direction d (0..15, taken mod 16); moves 1 cell along heading d, output status |
| 2 | f21 | walk_to_xy | inputs x, y; shortest path around walls and creatures, 1 step, output status |
| 3 | f01 | walk_to_nearest_creature | output status (arrived = adjacent) |
| 4 | f01 | walk_from_nearest_creature | output status |
| 5 | f11 | walk_to_kind | input kind (3 food, 4 unsolved station, 5 solved station, 7 exit); walks to nearest such thing, output status (arrived = on it for food/exit, adjacent for stations) |
| 6 | f12 | sense_nearest | input kind; outputs id and distance (−1, −1 if none) |
| 7 | f11 | walk_to_id | input id; walks toward that creature or thing, output status |
| 8 | f05 | read_task | outputs x, a0, a1, a2, a3 of an adjacent unsolved station (all 0 and nothing else if none) |
| 9 | f11 | submit_answer | input answer; output 1 accepted, 0 wrong, −1 no adjacent unsolved station |
| 10 | f01 | my_energy | output energy |
| 11 | f11 | give_food | input amount; gives that much energy to the nearest adjacent creature (capped by own energy minus 1); output amount given |

- `step` and 16 directions on a square grid: 0 = +x (east), 4 = 90° = −y (up on screen), counter-clockwise. Each creature keeps a fixed-point sub-cell offset; a step adds the unit vector of d and moves to whichever of the 8 neighbours keeps the creature closest to its true track, so heading 1 averages 22.5° over several steps. Diagonal moves count as 1 unit (one cell).
- Pathfinding: A* (8-connected, no squeezing diagonally between two blocked orthogonal cells), walls and creatures block, the goal cell may be occupied (then "arrived" means adjacent). Node budget per call (4096); if exceeded, take a greedy step that reduces distance, or report blocked. Exhausted creatures are obstacles too.
- Registry functions are pure Rust, each with its own unit tests.

## Tasks (my calls; owner chose polynomials with an error threshold)

- A station's task: evaluate `a0 + a1·x + a2·x² + a3·x³` at integer x, with small integer coefficients. Each course sets the max degree, the coefficient range and the **tolerance** (accepted when `|answer − truth| ≤ tol`). The tolerance is the same in training and validation.
- **Parameters are fixed per station per world seed** (my call). Every creature that reads a station gets the same task, and any adjacent creature may submit, whether or not it read the task itself. That is what lets iteration 1's "tell" work. Answers can't be memorised, because the validation seeds are held out and draw different parameters.
- Fitness also rewards closeness on rejected answers, which gives the GA a gradient even at tolerance 0.

## Courses (my calls)

Courses are ASCII maps compiled into the crate (`#` wall, `S` spawn area, `E` exit, `F` food, `P` station, `G` gate linked to the nearest `P`), plus parameters (swarm size, energy, ticks, task degree, tolerance). A ladder for v1:

1. **Open field:** spawn → exit.
2. **Wall:** exit behind a wall with one opening.
3. **Corridor:** one-cell-wide corridor; the swarm must not deadlock.
4. **Gate, sum:** a gate blocks the exit; station task is `a0 + a1` (x = 1, degree 1).
5. **Gate, line:** degree 1 with real x.
6. **Gate, quadratic:** degree 2, tolerance 0, partial credit for closeness.
7. **Food:** low energy; food is on one side; creatures must eat (or be fed) to reach the exit.

**Verified (the OEIS analogue):** a program clears a course when at least 80% of the swarm reaches the exit within the tick limit on every one of 8 held-out validation seeds (different from the seeds used during evolution). On gated courses this implies the station was solved at the course's own tolerance.

**What evolution must reach (my call).** The GA, starting from an empty or library-seeded population, must clear courses 1–5 and 7 in the browser within minutes. Course 6 and the exchange courses each get a hand-written reference program, which proves the course is solvable and is the baseline for tests. Whether the GA reaches these is reported honestly on the page and in the hand-over, not faked by seeding the reference program into the GA. Courses 1–3 are deliberately easy warm-ups: `walk_to_kind 7` reaches the exit in one call. That follows from the owner's registry, and the difficulty sits in the tasks, the crowding and the energy.

## Fitness (my calls)

Per course, averaged over training seeds (e.g. 3): arrivals dominate (fraction of swarm out), then stations solved, then food eaten, then partial credit (how close remaining creatures got to the exit by path distance; how close the best wrong answer was), then a small penalty for program length and for ticks used. Exact weights live in one documented Rust function and are tuned by the builder.

## Genetic algorithm (my calls)

- Steady-state, population ~200, tournament selection.
- Mutations in the style of LODA's miner: change a constant, change a register, change an instruction kind, change the constant loaded into a function-id register (to an id with matching in/out), insert a random instruction, delete, swap two, wrap a range in `lpb/lpe`, unwrap a loop. Single-point crossover on instruction lists. Every mutant is valid by construction (tested).
- Seeded RNG (own small PRNG, e.g. xoshiro/PCG), so a run is reproducible.
- **Library:** per course, keep the top 5 verified programs (by fitness, then length). A newly verified program enters if it beats the worst or is shorter at equal fitness. When evolving a harder course, the population is seeded with library programs from easier courses. The library serialises to text (`; course 4, fitness …` header + program), so the owner can save/paste it.

## Exchange iterations (owner asked for a few; contents are my calls)

Each iteration adds registry functions, at least one course where the mechanism helps, and a test that a hand-written program using the mechanism beats the best program without it on that course.

1. **Tell a value (knowledge).** Each creature gets an inbox register (`$15` is overwritten by incoming messages). `tell` (f11): send a value to all creatures within radius 3. Course: the station sits behind a one-way pocket; the creature that reads the task can't reach the exit side, others can submit if told. (Builder may reshape the course; the point is that one creature's knowledge must reach another.)
2. **Marks on cells (shared memory).** `mark` (f11) writes a value into the creature's current cell; `read_mark` (f21) reads the mark at an offset. Course: a maze where marking dead ends pays off.
3. **Teach (programs as assets).** `teach` (f01) copies the teacher's program to an adjacent creature with lower energy than the teacher. It costs the teacher energy, and the taught creature keeps its registers. On the teach course, half the swarm runs the candidate program and half runs a fixed naive library program (one that wanders). Fitness is cooperative: arrivals of the whole swarm. So a candidate that teaches the wanderers scores higher. The GA evolves the candidate as usual; only the evaluation's starting mix changes (my call).

## Page (my calls)

- `index.html` with original visuals: course canvas (HiDPI backing store), creatures as coloured dots with ids, stations red (unsolved) / green (solved), gates, food, exit.
- Controls: course picker, run/pause evolution, speed, "replay best" (animates the current best program tick by tick, with a register view for a clicked creature), reset.
- Panels: generation, best fitness over time (small chart), the best program's text, the library (per course, verified programs, copy/paste/download as text, kept in localStorage with try/catch).
- The GA runs on the main thread in time slices (e.g. ~12 ms per frame), so it works from file://.
- Light and dark themes.

## Build and layout (my calls)

```
swarm-genetic-programming/
  index.html
  swarm_wasm.js        # generated: base64 of the wasm + tiny loader; committed
  screenshot1.jpg
  test.mjs             # Node smoke test: loads swarm_wasm.js, runs a few generations
  build.sh             # cargo build --release --target wasm32-unknown-unknown, then embeds the .wasm as base64 into swarm_wasm.js
  rust/
    Cargo.toml         # no dependencies; crate-type cdylib + rlib
    src/...
```

- No wasm-bindgen: plain `extern "C"` exports and a small hand-written JS loader, exchanging data through wasm memory (grid as a byte buffer, program text via alloc + length). This keeps the crate dependency-free and lets the page load the wasm from a `<script>` (base64), which works on file:// and GitHub Pages.
- `target/` is gitignored. Gallery entry via `build_gallery.py`; `gallery.yaml` override only if the auto title is wrong.

## Tests

Rust (`cargo test`): parser/serializer round-trip and errors; loop count captured at entry, clamped, nested, cap; arithmetic errors end the tick; every registry function; A* around a wall and around a creature; no two creatures ever share a cell (randomised runs); determinism for a seed; station tolerance and gate opening; every mutation yields a valid program; GA clears course 1 within a bounded number of generations for a fixed seed; library ordering; each exchange iteration's "mechanism beats no mechanism" test.

Node (`test.mjs`): the embedded wasm loads, a course is created, ticks run, the grid buffer has the expected size, a few generations run.

## Left to the builder

Fitness weights, exact course maps, population/tick/seed counts, colours and layout details, module structure inside the crate.
