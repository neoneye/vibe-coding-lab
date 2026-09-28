# Inmos T414 transputer — standalone network emulator page

Date: 2026-09-28
Directory: `inmos-t414/`
Series: Silicon Observatory No. 007, after `intel-4004/`, `mos-6510/`,
`zilog-z80a/`, `acorn-arm1/`, `mit-scheme-79/` and `berkeley-risc1/`.

## Primary sources

- Inmos, *Transputer Instruction Set: A Compiler Writer's Guide*
  (Prentice Hall, 1988). Scanned at
  `transputer.net/iset/pdf/tis-acwg.pdf`. Referred to below as **CWG**.
- Inmos, *Transputer Databook*, first edition. Chapter 5 of it, "IMS T414
  engineering data", is scanned at
  `transputer.net/ibooks/72-trn-203-00/tdata1st.pdf`. Referred to below as
  **T414**.
- Guy Harriman, *Transputer Instruction Set Appendix* (1988). It defines the
  `start` instruction and the boot-from-link protocol.

## Goal

A dependency-free `index.html` that shows the idea the transputer was built
around: a processor with a hardware scheduler, and four serial links that wire
it to other processors.

The page simulates a network of one to five T414s at instruction level, with
the T414's own cycle counts. Programs are written in a small occam, or in
assembly. You watch:

- processes queue up and deschedule;
- channel words fill with process descriptors;
- ALTs enable and disable their guards;
- bytes cross the links bit by bit, as 11-bit data packets and 2-bit acks.

Unlike Nos. 001–006, the design is fully documented. Nearly everything on the
page is the chip's; the page's own parts are few and labelled.

## The chip, as documented

**Word and memory.** A 32-bit word. The on-chip RAM is 2 KB, from
`#80000000` to `#800007FF`. MemStart is `#80000048`, below which sit the
special locations:

- link channel words: outputs `#80000000–0C`, inputs `#80000010–1C`;
- the Event channel at `#80000020`;
- `TPtrLoc0` and `TPtrLoc1`;
- the save area for an interrupted low-priority process (Wdesc, Iptr, A, B, C,
  STATUS, E) at `#8000002C–44`.

External memory continues from `#80000800` (T414 §6).

**Registers.** Areg, Breg, Creg, Oreg, Iptr and Wptr (Wdesc = Wptr plus the
priority bit). Also the ErrorFlag, HaltOnErrorFlag, the front and back
pointers for both queues, the two clock registers and the two timer-list
heads.

**Encoding.** A byte is a 4-bit function and a 4-bit data field. `pfix` and
`nfix` build longer operands in Oreg, and `opr` selects an operation (CWG §4).
The assembler generates prefix sequences with CWG §4.4's algorithm and
iterates label sizes until they are stable.

**Instructions.** Every T414 instruction is in, with T414 Tables 4.7–4.18
cycle counts: the direct functions, arithmetic, long arithmetic, indexing,
`move`, the timers, input/output, ALT, control, scheduling, error handling,
queue initialisation, and `fmul`, `unpacksn`, `ldinf` and `cflerr`.

Three instructions are the exception:

- `roundsn` and `postnormsn` stop the page with a message, because the CWG
  specification is informal about their operand scaling.
- `testhardchan` and the register-test instructions are not implemented.

**Scheduler (CWG §6.3, §10.1).**
- Two priority levels.
- Each has a ready queue linked through `Wptr−2`, with Iptr saved at
  `Wptr−1`.
- A high-priority process that becomes ready interrupts a running
  low-priority one at the next instruction boundary. The interrupted
  registers go to the save area, and are restored when no high-priority
  process remains.
- Low-priority processes are timesliced. A period ends every 1024 ticks of
  the high-priority clock (5120 cycles of the 5 MHz input clock). After two
  period ends, the process is descheduled at its next `j` or `lend`.

**Timers (CWG §6.9, §10.1.2).**
- The high-priority clock ticks every 1 µs and the low-priority one every
  64 µs. Both start at `sttimer`.
- `tin` waits until the clock is AFTER the time.
- Timer lists are linked through `Wptr−4`, with the wake time at `Wptr−5`,
  sorted by time.

**Channels (CWG §10.4).** An internal channel is a word, initially
NotProcess.p (MostNeg).
- The first process to arrive stores its Wdesc there and its pointer at
  `Wptr−3`, and deschedules.
- The second copies the message, resets the word and reschedules the first.
- Output to a channel an ALT has enabled follows §10.5.4.

**ALT (CWG §6.10, §10.5, F).**
- The ALT states Enabling.p, Waiting.p and Ready.p (MostNeg+1..3) are held in
  `Wptr−3`.
- TimeSet.p and TimeNotSet.p are held in `Wptr−4`, and the earliest guard
  time in `Wptr−5`.
- NoneSelected.o (−1) is held in `Wptr+0`.
- The instructions follow the F-section predicates: `alt altwt altend talt
  taltwt enbs enbc enbt diss disc dist`.

**Links (T414 §9).** Each byte is transmitted as:
- a start bit, a 1, eight data bits (LSB first) and a stop bit;
- the receiver acknowledges with a start bit and a 0;
- the sender waits for the ack before the next byte;
- the process is rescheduled after the final byte's ack.

The T414, unlike the T800 and T425, does not send the ack early. Link speed
is 10 Mbit/s, so a bit is 2 cycles at 20 MHz. Data and acks share each wire.

The datasheet quotes 400 KB/s one-way and 800 KB/s both ways (Table 9.1). The
page reproduces that with a fixed internal turnaround delay on each side, and
that delay is the page's own.

**Boot from link (Appendix §2).** With BootFromRom low, the first byte on any
link selects the action:
- a count greater than 1 loads that many bytes to MemStart and runs them;
- 0 is a poke;
- 1 is a peek.

Demo 2 boots this way, over the simulated link, byte by byte.

## The page's own parts, labelled

- **The occam compiler.** A subset of occam 2 compiled with CWG's own
  translations: PAR (§6.5), PRI PAR (§6.7), ALT (§6.10), replicated SEQ with
  `lend` (§5.9), procedures with `call` (§5.10), expressions on the
  three-register stack (§5.3), channels (§6.8) and timers (§6.9).
  - It departs from CWG in two places. Every PAR branch gets its own
    workspace, where CWG runs the last branch in the parent's. And procedures
    get a static link, so they can see free variables.
  - It has no FUNCTIONs and no REALs, and the only protocols are simple INT
    and BYTE ones.
- **The startup code.** It initialises the queues and timer lists, starts the
  clocks and sets HaltOnError. It is emitted as visible assembly before each
  program; the T414 leaves this job to the boot program.
- **Loading.** Direct loading of compiled programs into memory. Only demo 2
  uses the real boot protocol, because a boot packet holds at most 255 bytes.
- **Network syntax.** Each `PROCESSOR n` section holds one transputer's
  program, and `CONNECT a:l TO b:m` wires link l of processor a to link m of
  processor b. The host always sits on processor 0's link 0.
- **Channel naming.** `PLACE c AT link1.out:` names a link channel. Real occam
  used numeric PLACE addresses, and those are accepted too.
- **String output.** `c ! "text"` on a `CHAN OF BYTE` is shorthand for one
  output per character.
- **The host.** It prints bytes arriving on its link, and sends typed keys
  back.
- **Memory.** Each transputer has 64 KB: the 2 KB on-chip RAM plus 62 KB of
  external RAM. External memory runs at on-chip speed; the extra EMI cycles
  are not modelled.
- **The link turnaround delay** described above.

## Architecture

One `index.html`. The engine is in `<script id="shared-code">`, and
`test.mjs` runs `T414Tests.run()`.

1. **`Transputer`.** Holds the registers, memory and error flags. Its methods:
   - `step()` executes one instruction, prefixes included, and adds that
     instruction's cycles to its local time;
   - scheduling: queue operations, `deschedule`, `schedule`, interrupt and
     restore;
   - timers: timer-list insertion, and computing the next wake time;
   - channel and ALT operations, which call into `Link` for link addresses.
2. **`Link`.** One per link direction pair. It holds a transmitter per wire
   (data and ack packets) and the receiver state: a one-byte buffer, the
   waiting process, and any ALT registration. Transfers are event-driven, with
   absolute cycle timestamps, and every bit transition is recorded for the
   analyser.
3. **`Network`.** Holds the transputers, the wiring and the host. `run(until)`
   is a discrete-event loop: it always advances whichever of the running
   transputers and the link and timer events has the earliest time. The
   network is idle or deadlocked when nothing can advance.
4. **The assembler and disassembler.** Labels, prefix relaxation, and data
   directives. The disassembler shows `pfix` and `nfix` expansions.
5. **The occam compiler.** Lexer (with offside indentation), parser, workspace
   allocator and code generator. Its output carries a source map from occam
   line to bytes.
6. **`T414Tests`.**

## Page layout

- **Header:** Introduced 1985 (September) · 32 bit · 20 MHz (50 ns cycle) ·
  Transistors "not in the datasheet" (the tooltip says why).
- **Left column:** program library, host terminal, and the network drawing:
  transputers as chips with four links, packets animating along the wires.
  Clicking a chip selects it.
- **Centre column:** the selected transputer's register stack, Oreg, Iptr,
  Wdesc and flags. Its clocks. Its two ready queues and two timer lists, drawn
  as linked lists from memory. Its current process and the special workspace
  slots below Wptr, labelled. Channel words and who waits on them. A
  link-analyser strip with bit-level waveforms.
- **Right column:** the trace, memory, and each transputer's cycle count and
  time.
- **Below:** the occam editor, the compiled listing (occam line, bytes,
  disassembly), the instruction-set panel, "Model & limitations", and "what it
  got right / wrong".

## Demos (8)

1. **Hello, host.** One transputer sends a greeting down link 0. Watch the
   11-bit data packets and 2-bit acks.
2. **Booted over a link** (assembly). The host sends a boot packet; the chip
   loads it at MemStart and runs it. It shows pfix/nfix operand building.
3. **PAR and the scheduler.** Three processes, one queue, `startp` and `endp`.
4. **Channels and ALT.** Two producers merged by an ALT. Watch the channel
   words and `Wptr−3` states.
5. **Priority and time.** PRI PAR: a high-priority ticker interrupts a
   low-priority busy loop. The save area fills, and the timer queue orders
   wakeups.
6. **A pipeline across four chips.** A prime sieve, with one filter stage per
   transputer.
7. **A processor farm.** Mandelbrot in fixed point over one master and three
   workers. Compare its time with a single chip.
8. **Deadlock.** Two processes each wait to output to the other. The network
   stops, and the page shows who waits on which channel.

## Testing

- Instruction semantics against the CWG F-section predicates, for every
  implemented instruction.
- Prefix encodings, including CWG's own examples.
- Scheduler invariants: queue linkage, the timeslice, and the
  interrupt-and-restore save area.
- Internal and link channels of 1, 4 and odd byte lengths.
- ALT: priority order, the timer guard, the SKIP guard, and output to an
  alting process.
- Link timing: 400 KB/s one-way and 800 KB/s both ways.
- Boot from link.
- Every occam construct.
- Error halt.
- Undo.
- Each demo end to end, checking what its note claims.
