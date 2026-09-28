# Inmos T414

A standalone HTML page that emulates a network of Inmos IMS T414 transputers
at instruction level. You write occam or assembly and wire up to five chips
together. Then you can watch:

- the hardware scheduler queue and deschedule processes;
- channel words fill with process descriptors;
- ALTs enable and disable their guards;
- bytes cross the serial links bit by bit.

It has no dependencies and needs no network. Open `index.html` in a browser.
That is the whole thing.

Silicon Observatory No. 007, after `intel-4004/`, `mos-6510/`, `zilog-z80a/`,
`acorn-arm1/`, `mit-scheme-79/` and `berkeley-risc1/`.

## What is the chip's

Inmos documented the transputer down to a register predicate for every
instruction. These parts of the page therefore follow the documentation
rather than a reconstruction:

- **Instructions.** Every T414 instruction the page runs follows the
  *Compiler Writer's Guide*, appendix F, with the cycle counts of the T414's
  own engineering data.
- **Scheduler.** Two priority queues, linked through (Wptr−2). A timeslice
  every 1024 µs. High priority interrupts low through the save area at
  #8000002C.
- **Timers.** A 1 µs clock and a 64 µs clock, each with a sorted timer list.
- **Channels and ALT.** Channel words, and the ALT states kept in (Wptr−3) to
  (Wptr−5).
- **Memory map.** 2 KB on chip, with MemStart at #80000048.
- **Links.** 11-bit data packets and 2-bit acks. The page reproduces the
  databook's 400 KB/s one way and 800 KB/s both ways.
- **Booting.** The boot-from-link protocol, including poke and peek.

## What is this page's

- **The occam compiler.** A subset of occam, compiled with the Guide's own
  translations. It departs in two places: every PAR branch gets its own
  workspace, and procedures get a static link.
- **The startup code.** It empties the queues and starts the clocks; on a real
  system that is the boot program's job.
- **The network syntax:** the `CONNECT` and `PROCESSOR` sections.
- **The host terminal.**
- **The memory size:** 64 KB per chip, all of it at on-chip speed.
- **The link turnaround delay**, chosen to hit the databook's throughput.

Two instructions, `roundsn` and `postnormsn`, are not modelled, because their
specification is too informal to reproduce. Running either one stops the page
with a message.

## Tests

```bash
node test.mjs
```

The engine lives in the `<script id="shared-code">` block of `index.html`, and
`test.mjs` runs its 47-test suite under Node. The suite covers:

- prefix encoding, including the Guide's own examples;
- instruction semantics and cycle counts;
- queues, timeslicing, interrupts and timers;
- channels, and ALT over internal and link channels;
- link packet shape and throughput;
- booting, poke and peek;
- every occam construct and its compile errors;
- network undo;
- each of the nine demos end to end, checking what its note claims.
