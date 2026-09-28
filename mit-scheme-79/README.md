# MIT SCHEME-79

A standalone HTML page that simulates the SCHEME-79 chip, the single-chip Lisp
processor that Jack Holloway, Guy Steele, Gerald Sussman and Alan Bell designed
at MIT in 1979. Write Scheme, watch it become typed list structure in memory,
then step the chip one clock cycle at a time: the single 32-bit bus, the ten
registers, the MICRO and NANO sequencers, the memory pads and the garbage
collector. No dependencies and no network.

Open `index.html` in a browser. That is the whole thing.

Silicon Observatory No. 005, after `intel-4004/`, `mos-6510/`, `zilog-z80a/`
and `acorn-arm1/`.

## What is the memo's

Everything the chip does comes from *The SCHEME-79 Chip*, MIT AI Memo 559
(January 1980):

- the 32-bit word (1 mark bit, 7 type bits, 24 data bits) and the octal type codes;
- the ten registers and what each one can do (to-type, to-address, the EXP
  decrementer, the NEWCELL incrementer, the sense lines);
- the pads and their read and write cycles, including FREEZE for slow memory;
- the complete microcode from the appendix, transcribed as printed. That
  covers the evaluator, the storage allocator, the Deutsch–Schorr–Waite
  marker, the two-finger compacting sweep and the broken-heart relocation.

## What is this page's

- **The compilation.** The memo describes how its micro-LISP became vertical
  MICRO words and horizontal NANO words and prints a few of them, but not the
  PLA contents. This page compiles the listing the same way: 343 micro-words in
  the chip's 9-bit state space, with even/odd branch pairs and copied
  micro-words. Cycle counts are close to the real chip's, not equal to them.
- **The FRAME/DISPLACEMENT split** of a lexical address (12 + 12 bits).
- **The host** that loads memory, supplies interrupt vectors and turns
  GC-NEEDED into an interrupt. The real chip had an MIT Lisp Machine and
  Howard Cannon's interface board for this.
- **The Scheme-to-S-code translator.** The memo does not publish one.
- **The console**: two I/O nodes at the top of node space.

## How close it gets

The memo timed `(fib 20)` with Peano addition, 32K cells and a 1595 ns clock:
6765 in about a minute. This page takes 28.7 million cycles, which is 46
seconds of chip time, and garbage-collects 38 times.

## Tests

```bash
node test.mjs
```

The engine lives in the `<script id="shared-code">` block of `index.html`, and
`test.mjs` runs its suite under Node. The central test runs a second machine
that interprets the micro-LISP listing directly, statement by statement, and
requires the compiled chip to match it at every dispatch: the same registers,
and the same memory writes in the same order. The suite also covers:

- the compiler's state assignment;
- the pad sequences;
- every S-code form;
- lexical addressing;
- the collector's invariants: compaction, marks cleared, no broken hearts
  left reachable, symbols that never move;
- MEMTOP interrupts and user interrupts;
- the translator's output against the memo's Figure 2;
- undo;
- an end-to-end run of each demo, checking what its note claims.
