# MIT SCHEME-79 — standalone chip simulator page

Date: 2026-09-28
Directory: `mit-scheme-79/`
Series: Silicon Observatory No. 005, after `intel-4004/`, `mos-6510/`,
`zilog-z80a/` and `acorn-arm1/`.

Primary source: Holloway, Steele, Sussman, Bell, *The SCHEME-79 Chip*, MIT AI
Memo 559, January 1980 (46 scanned pages; mirror at
`http://bitsavers.org/pdf/mit/ai/aim/AIM-559.pdf`). Page numbers below are the
memo's own.

## Goal

A dependency-free `index.html` that simulates the SCHEME-79 chip — a single
NMOS chip from 1979 that interprets Lisp directly, with no instruction set in
the usual sense and a garbage collector in its microcode. Write Scheme, watch
the host turn it into S-code in the heap, then step the chip one clock cycle at
a time and see the single 32-bit bus, the ten registers, the MICRO and NANO
sequencers and the memory pads do the work.

Unlike Nos. 001–004 this is not an instruction-level emulator. The chip has no
instructions; the "program" is a typed list structure, and every S-code
operation is a microcode routine. So the simulation runs at the level of clock
cycles, and the microcode it runs is the memo's own.

## What the memo fixes

- **Word:** 32 bits = 1 mark bit, 7-bit type, 24-bit data (p.2, Fig. 1). A list
  node is two words, CAR and CDR. The CAR word's mark bit is *in-use*; the CDR
  word's is *car-being-traced*.
- **Types** (octal, p.29–30): type bit `100` set means non-pointer. Pointer
  types `0`–`26` (self-evaluating-pointer, symbol, global, set-global,
  conditional, procedure, first-argument, next-argument, last-argument,
  apply-no-args, apply-1-arg, primitive-apply-1, primitive-apply-2, sequence,
  spread-argument, closure, get-control-point, control-point, interrupt-point,
  self-evaluating-pointer-1..4). Non-pointer types `100`–`131`
  (self-evaluating-immediate, local, tail-local, set-local, set-tail-local,
  set-only-tail-local, primitive car cdr cons rplaca rplacd eq type? type!,
  gc-special-type, self-evaluating-immediate-1..4, mark, done, add1, sub1,
  zerop, displacement-add1, not-atom). Micro-addresses `776` boot-load (forced
  by RESET) and `777` process-interrupt (forced by an interrupt request).
- **Registers** (p.30–31, Fig. 3): ten physical registers on one bus, each with
  its own capabilities:

  | Register | Loads | Drives bus | Senses |
  |---|---|---|---|
  | EXP | type, displacement, frame | value, value − 1 | bus frame = 0, bus displacement = 0 |
  | NEWCELL | type, address | value, value + 1 | own address = bus address |
  | VAL | type, address | value | type = bus type, address = bus address |
  | RETPC-COUNT-MARK | type, address | value | — |
  | STACK | type, address | value | — |
  | MEMTOP, ARGS, DISPLAY, INTERMEDIATE-ARGUMENT | whole word | value | — |
  | NIL | — | always zero | — |

  The bus itself senses mark bit, type-not-pointer, frame = 0,
  displacement = 0, address = 0. The garbage collector renames registers
  (`*scan-up*` = NEWCELL, `*scan-down*` = EXP, `*stack-top*` / `*rel-tem-2*` =
  VAL, `*leader*` / `*rel-tem-1*` = ARGS, `*node-pointer*` = DISPLAY).
- **Registers are single-rank** (p.24): a register cannot be read and written in
  the same cycle, so an increment takes two cycles and parks the intermediate
  in RETPC-COUNT-MARK's address field — which is why that register has its name.
- **Control** (p.8–15, Figs. 4–6): a MICRO state machine emits vertical
  microcode (FROM, TO, nano-op, next state or branch); a NANO state machine
  expands the nano-op into one or more horizontal cycles of register and pad
  controls, freezing MICRO while it runs. A conditional branch merges the
  condition into the low bit of the next state, so both targets must sit at an
  even/odd pair, and the memo copies micro-words to satisfy that (p.15).
- **Pads** (p.18–19, Figs. 7–9): 32-bit bidirectional bus; inputs `ph1 ph2
  freeze read-state load-state interrupt-request`; outputs `ale read write cdr
  read-interrupt gc-needed`. A memory reference is an ALE cycle followed by a
  READ or WRITE cycle, with CDR selecting the half. `freeze` stretches a cycle
  for slow memory.
- **Microcode** (appendix, p.29–43): the complete interpreter, storage
  allocator, Deutsch–Schorr–Waite marker, two-finger compacting sweep and
  broken-heart relocation, in micro-LISP.
- **Boot** (p.20–21, p.32): memory cell 0 is NIL with the obarray in its CDR;
  cell 1's CAR holds the initial MEMTOP. Boot loads MEMTOP, reads an interrupt
  vector, garbage-collects, then evaluates the vector symbol's value.
- **Performance** (p.23, p.25): about 1 MHz. `(fib 20) = 6765`, Peano
  arithmetic, 1595 ns clock, 32K cells, nearly empty memory: about 1 minute.
- **Physical:** 5926 × 7548 µm, 44.73 mm², 5 µm NMOS (λ = 2.5 µm), MPC79
  multiproject run, fabricated by HP, four chips received 9 January 1980, the
  third one worked. The memo gives **no transistor count**.

## Scope

**In:**

- The memo's micro-LISP listing, transcribed verbatim into the page as data.
  Every `deftype`, `defreturn`, `defpc` and `defmicromacro` in the appendix,
  including the debug routine and the `get-memtop`/`set-memtop` routines that
  nothing in the listing reaches.
- A micro-LISP compiler that does what the memo's compiler did (p.12–15):
  linearise nesting through INTERMEDIATE-ARGUMENT, turn each primitive into a
  micro-word with FROM, TO and a nano-op, assign MICRO state numbers (type
  routines at their type code, return tags at pointer-type codes, boot at
  `776`, interrupt at `777`), satisfy the even/odd branch-pair rule by copying
  micro-words, and build the NANO table. The test suite asserts the result fits
  the chip's 9-bit MICRO state.
- The chip, cycle by cycle: bus source and destinations, field-selective loads,
  incrementer and decrementer, sense lines, both sequencers, pads with ALE /
  READ / WRITE / CDR / mark merging, the GC-needed flip-flop set when a CONS
  makes NEWCELL equal MEMTOP, `interrupt-request` and `read-interrupt`, and an
  optional one-cycle `freeze` on every memory access to show Figure 8 and 9.
- A **reference interpreter** that runs the same micro-LISP listing directly on
  the same registers and memory, the way the memo's authors simulated the
  machine in Lisp (p.12). It is the test oracle: the compiled chip must reach
  the same registers and memory at every S-code dispatch.
- The host, labelled as the page's own (next section).

**Out:** electrical behaviour, the two-phase clock as separate phases, the
debug `read-state`/`load-state` pins (the page reads state directly), the
concurrent or real-time collectors the memo mentions only as future work, and
the two silicon bugs the memo reports (a GC microcode bug it does not describe,
and a pad race on GC-needed).

## Reconstructions, and why they are labelled

The memo publishes the micro-LISP source and a handful of compiled micro-words
and nano-words (p.13–15). It does not publish the full PLA contents. So:

- **The microcode is the memo's; the compilation is the page's.** State
  numbers, the nano-op set and the split into cycles follow the memo's worked
  examples (`do-car`, `do-cdr`, `do-restore`, the `mark-node` sequences), but
  they are a reconstruction. Cycle counts are therefore close, not exact, and
  the page says so next to every cycle counter.
- **The FRAME/DISPLACEMENT split** of the 24-bit data field is not given. The
  page uses displacement = high 12 bits and frame = low 12 bits; the
  `displacement-add1` routine's borrow trick (p.41) requires displacement to be
  the high field.
- **The S-code translator** is not published ("a user of the SCHEME-79 chip
  should never see the S-code", p.3). The page's translator is derived from what
  the microcode does with each type, and reproduces Figure 2 for `append`.

Transcribed as printed, with a note rather than a fix: `primitive-displacement-
add1` saves NEWCELL into ARGS and never restores it. The translator never emits
that primitive.

## The host (the page's own interface board)

On the real chip Howard Cannon's board let an MIT Lisp Machine load memory,
single-step the chip and field its interrupts (p.22). The page plays that part
and labels it as the page's own:

- **Loader.** Reads Scheme, translates it to S-code and deposits the image:
  cell 0 = NIL with the obarray as its CDR; cell 1's CAR = MEMTOP; then the
  vector symbols `*boot*`, `*gc-handler*` and `*interrupt-handler*`, then every
  other symbol, then code and constants. The vector symbols sit first and are
  always live, so compaction never moves them and the interrupt vector (the
  address of a symbol, p.8) stays valid.
- **Interrupts.** `GC-needed` rising turns into `interrupt-request` with the
  vector `*gc-handler*`, whose value is `(lambda k (gc) (k))` — invoke the
  collector, then resume the interrupted process through its interrupt point.
  An **Interrupt** button raises a one-shot request with the vector
  `*interrupt-handler*`.
- **Console**, invented and labelled: two I/O node addresses at the top of the
  24-bit space. RPLACA of a number onto `io-char` prints a character, onto
  `io-number` prints it in decimal. This follows the memo's own scheme of I/O
  devices mapped into the high node space (p.20).
- **Result printer.** When the chip reaches the `done` state the host decodes
  VAL as an S-expression.
- **Memory size** 1K, 4K, 16K or 32K nodes, and MEMTOP, the soft limit that
  triggers GC, set per demo. Allocating past the physical top halts the page
  with "out of memory", since there is no memory there to answer.

## S-code, as the microcode defines it

| Source | S-code |
|---|---|
| number, `#\c` | self-evaluating-immediate |
| `'sym`, `'(…)` | symbol pointer / self-evaluating-pointer |
| local variable | LOCAL(displacement, frame); a rest variable is TAIL-LOCAL |
| global variable | GLOBAL → the symbol cell, whose CAR is the value |
| `(if p c a)` | SEQUENCE(p . CONDITIONAL(c . a)) |
| `(begin a b …)` | SEQUENCE(a . SEQUENCE(b . …)) |
| `(lambda …)` | PROCEDURE(body . documentation) → CLOSURE(procedure . display) |
| `(f)` | APPLY-NO-ARGS(f . nil) |
| `(f a)` | APPLY-1-ARG(a . f) |
| `(f a b … z)` | FIRST-ARGUMENT(a . NEXT-ARGUMENT(b . … LAST-ARGUMENT(z . f))) |
| `(car x)` etc. | PRIMITIVE-APPLY-1(x . primitive-car) |
| `(cons a b)` etc. | FIRST-ARGUMENT(a . PRIMITIVE-APPLY-2(b . primitive-cons)) |
| `(set! x v)` | SEQUENCE(v . SET-LOCAL / SET-TAIL-LOCAL / SET-ONLY-TAIL-LOCAL / SET-GLOBAL) |
| `(define …)` at top level | SEQUENCE(value . SET-GLOBAL(sym)) |
| `(apply f l)` | SPREAD-ARGUMENT(l . f) |
| `(catch k body…)` | GET-CONTROL-POINT(set-k . body) |
| `(gc)` | the non-pointer type MARK |

Also `cond`, `let` (as a lambda application), `and`, `not`, `null?`, `pointer?`
(primitive-not-atom — true of symbols too, since a symbol is a pointer to its
value cell), `zerop`, `1+`, `-1+`, `eq?`, `type?`, `type!`,
`rplaca`, `rplacd`, `write-char`, `print-number`, and quoted data.

Consequences of the hardware that the page shows rather than hides: NIL is the
all-zero word, and T is NIL retyped as an immediate — the same word as the
number 0. `(zerop nil)` is true, because `zerop` tests the address field. The
only arithmetic is add-one and subtract-one, done by borrowing NEWCELL's
incrementer and EXP's decrementer.

## Architecture

One `index.html`. The engine is in `<script id="shared-code">`, run under Node
by `test.mjs`; the UI is a second, untested `<script>`.

1. `MICROCODE_SOURCE` — the memo's listing as text, and `readSexp`.
2. `compileMicrocode(source)` → `{ micro, nano, labels, sourceMap }`. Pure.
3. `Chip` — register file, bus, sequencers, pads. `cycle()` advances one clock;
   `microStep()`, `scodeStep()` and `run(budget)` are built on it.
4. `ReferenceMachine` — runs the listing directly; used only by tests.
5. `Memory` — the node store plus I/O decode, journalling writes for undo.
6. `Host` — reader, translator, loader, interrupt logic, console, printer.
7. `Scheme79Tests` — the suite.

`cycle()` must be cheap: `(fib 20)` is tens of millions of cycles. Nano-words
compile to small integer records, the register file is a typed array, and the
per-cycle trace is a fixed ring buffer written with a literal, not a loop over
property names (see the note on the Z80 page).

## Page layout

Same furniture as the series: a toolbar (Run, Step, Back, Reset, speed, step
granularity: cycle / micro-word / S-code op), a header with the four facts,
then three columns:

- **Left:** demo library with "what to watch" notes; the Scheme workbench;
  memory size and MEMTOP; wait-state toggle; the Interrupt button.
- **Centre:** a live block diagram based on the memo's register array (Fig. 3)
  and control (Fig. 6), with the bus value, the driving register and the
  loading register lit each cycle; MICRO and NANO state in octal; a
  logic-analyser strip of ALE, READ, WRITE, CDR, FREEZE, INT-REQ, READ-INT and
  GC-NEEDED over the last 48 cycles; the console.
- **Right:** the register file, as mark, type name and data with frame and
  displacement split where it matters; a heap map with one square per node,
  coloured by CAR type, showing mark bits, NEWCELL, MEMTOP and during GC the
  two fingers; an S-code view of the node EXP points at; the trace.

Below: the micro-LISP listing with the line behind the current micro-word
highlighted and breakpoints on routine labels; then `<details>` panels for an
S-code quick reference and "Model & limitations".

Header facts: **Introduced** 1979 (tooltip: designed June–July 1979, MPC79
run December 1979, first chips 9 January 1980). **Data width** 32-bit word
(24 + 7 + 1). **Clock** ≈ 1 MHz (tooltip: the memo's estimate; its benchmark ran
at a 1595 ns period). **Transistors** "not published" (tooltip: AIM-559 gives
the die size and process but no count).

Speed: "as measured" (1595 ns per cycle, so a clock-accurate run of the
benchmark takes about as long as the memo's), ×10, ×100, and max. Chip time is
shown as cycles × 1595 ns.

## Demo library (8, ordered)

1. **A constant** — `42`. Boot loads MEMTOP, reads the vector, and runs a full
   garbage collection before evaluating anything.
2. **Peano arithmetic** — the memo's `+` from p.25. `1+` borrows NEWCELL's
   incrementer; watch it park and restore the free pointer.
3. **Append** — the memo's Figure 2 program, with the S-code view laid out like
   the figure.
4. **Tail calls** — a countdown loop in constant stack under a small MEMTOP.
   The heap fills with argument lists and frames, GC-needed fires, and the heap
   map shows the sawtooth.
5. **The collector up close** — build a list, drop half, call `(gc)`. Watch
   Deutsch–Schorr–Waite reverse pointers through `*stack-top*`, then the two
   fingers compact and leave broken hearts for relocation.
6. **Control points** — `catch` to leave a list search early.
7. **Interrupts** — a loop prints dots; pressing Interrupt runs a Scheme
   handler that prints a mark and resumes through its interrupt point.
8. **Fib 20** — the memo's benchmark, 6765, with the page's cycle count and
   chip time next to the memo's "about 1 minute".

## Testing

`test.mjs` extracts the shared-code block and runs `Scheme79Tests.run()`.

- **Reader and compiler:** the listing parses; every label resolves; branch
  pairs are even/odd; type routines sit at their type code; boot is at `776`
  and interrupt at `777`; total MICRO states ≤ 512.
- **Lockstep:** for every demo and unit program, the compiled chip and the
  reference machine agree on all registers and memory at every S-code dispatch.
- **Datapath:** field loads (to-type, to-address, to-displacement, to-frame),
  EXP's decrement and NEWCELL's increment through RETPC-COUNT-MARK, the sense
  lines, NIL reading zero.
- **Pads:** a CAR read is ALE then READ; a CDR read asserts CDR; `rplaca-and-
  mark!` is ALE then WRITE with the mark merged; with wait states on, each
  access gains a FREEZE cycle and results do not change.
- **Every S-code type and primitive**, each with a small program.
- **Lexical addressing:** frame and displacement lookups, rest variables, and
  each `set!` form.
- **Collector:** after GC every node reachable from the stack and obarray is
  still reachable with the same printed structure, live nodes are contiguous
  from the bottom, NEWCELL points at the last live node, every mark bit is
  clear, and no broken heart remains reachable.
- **Allocator:** GC-needed sets exactly when NEWCELL reaches MEMTOP, the host
  turns it into an interrupt, and allocating past physical memory halts.
- **Interrupts:** process-interrupt saves ARGS, EXP, DISPLAY and VAL; calling
  the interrupt point restores them; the interrupted program's result is
  unchanged.
- **Translator:** `append` produces Figure 2's shape; each form in the S-code
  table.
- **Undo:** stepping forward then back restores registers and memory exactly.
- **End to end:** each of the eight demos, asserting what its note claims,
  including 6765 for `(fib 20)`.

## Non-goals

Not a Lisp Machine, not MIT Scheme, and not a gate-level or electrical model.
No reader, printer or REPL runs on the chip — those were the host's job then
and are the page's job here, and the page labels them as its own.
