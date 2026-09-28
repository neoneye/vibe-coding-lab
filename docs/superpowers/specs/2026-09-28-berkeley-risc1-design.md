# Berkeley RISC I — standalone emulator page

Date: 2026-09-28
Directory: `berkeley-risc1/`
Series: Silicon Observatory No. 006, after `intel-4004/`, `mos-6510/`,
`zilog-z80a/`, `acorn-arm1/` and `mit-scheme-79/`.

Primary sources:

- Séquin & Patterson, *Design and Implementation of RISC I*, UCB/CSD 82/106
  (1982). Page numbers below refer to this report.
- Patterson & Séquin, *A VLSI RISC*, UCB/ERL M82/10 (1982).
- Patterson & Séquin, *RISC I: A Reduced Instruction Set VLSI Computer*,
  ISCA 1981.

## Goal

A dependency-free `index.html` about the processor that named RISC. The
centrepiece is overlapped register windows: a big physical register file, a
32-register view that slides on every CALL and RET, and parameters that pass
from caller to callee without moving. The page also shows delayed jumps and
r0 hard-wired to zero. Write RISC I assembly, step it, and watch the window
slide.

It has the same furniture as the series: toolbar, program library, block
diagram, registers, memory, trace, disassembly with breakpoints, assembly
workbench, and the "Model & limitations" panel.

## The two register files

The architecture specifies 138 registers: 10 globals, plus 8 windows of 22
registers that overlap by 6 (HIGH r26–31, LOCAL r16–25, LOW r10–15; Figures
1–2, p.3–4). The Gold chip that Berkeley actually fabricated had 78 registers:
6 windows of 14 overlapping by 4, plus 18 globals (p.13). The full design did
not fit the 10 mm package cavity.

The page defaults to **Gold, as built**, and a switch selects **the
architecture as specified**. Gold's window split is HIGH r28–31, LOCAL r22–27,
LOW r18–21. The report gives the sizes; this split follows from them.

Assembler aliases make programs portable between the two:

- `in0…` (HIGH), `loc0…` (LOCAL) and `out0…` (LOW), with 4, 6 and 4 of each
  on Gold, and 6, 10 and 6 on the architecture;
- `ra` = r31, the return address.

Using an alias that the current file lacks is an assembly error that says so.

The mapping is a ring of windows. Window *w* owns LOW(*w*) and LOCAL(*w*), and
HIGH(*w*) is LOW(*w*+1). CALL decrements CWP (Table 2), so a callee's HIGH is
its caller's LOW, and it sits at lower physical numbers, as in Figure 2.

## What the sources fix

- The 31 instructions of Table 2 and their operand forms:
  - ALU: `ADD ADDC SUB SUBC SUBR SUBCR AND OR XOR SLL SRL SRA`
  - Loads and stores: `LDL LDSU LDSS LDBU LDBS STL STS STB`
  - Control: `JMP JMPR CALL CALLR RET RETINT CALLINT`
  - Other: `LDHI GTLPC GETPSW PUTPSW`
- The formats (Table 3): a 7-bit opcode, SCC, a 5-bit DEST, a 5-bit SOURCE1,
  IMM and a 13-bit SOURCE2 (sign-extended immediate, or a register in its low
  5 bits), or a 19-bit PC-relative offset.
- r0 always reads zero. Absolute and register-indirect addressing come from r0
  and a zero offset (Table 5).
- Delayed jumps: the instruction after a jump always executes (p.8).
- ALU instructions take one cycle; loads and stores take two (p.6–7).
- The condition codes are the PDP-11 set (p.7).
- The register file is not mapped into memory on the Gold chip (p.6).
- The chip's one design error: setting condition codes on loads and shifts.
  Berkeley worked around it in the assembler (p.16).
- 44,500 transistors, a 2 µm λ NMOS process, 10.2 × 7.75 mm (p.12, p.16).
- The fastest chips ran at 1.5 MHz, 2 µs per instruction, against a 400 ns
  target (p.16–17). The first program ran on 11 June 1982: it read characters
  from a terminal, changed them by a simple key and wrote them back (p.16).

## Reconstructions, labelled on the page

The papers do not give these, so the page chooses them and says so.

- **Opcode numbers.**
  - ALU: `01`–`0C`
  - Loads: `10`–`14`
  - Stores: `18`–`1A`
  - Control: `JMP 20, JMPR 21, CALL 22, CALLR 23, RET 24, RETINT 25, CALLINT 26`
  - Other: `LDHI 28, GTLPC 29, GETPSW 2A, PUTPSW 2B`
  - Any other opcode stops the page with a message.
- **Condition encoding.** In the DEST field:

  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | nev | gt | le | ge | lt | hi | los | lo | his | pl | mi | ne | eq | nv | v | alw |

  C is the PDP-11 borrow on subtraction.
- **PSW layout.** Bits 3–0 are N Z V C, bits 6–4 are SWP, bits 9–7 are CWP,
  bit 10 is I (interrupt enable) and bit 11 is PI (I before the last trap).
- **When the window changes.** CALL and CALLR decrement CWP at once and write
  the address of the CALL into Rd of the new window, so the delay slot runs in
  the callee's window. RET and RETINT read their target and then increment CWP
  at once, so the delay slot runs in the caller's window. Table 2's "next" is
  ambiguous, and this reading is the one that makes a trap return work.
- **Traps.** A CALL that would make CWP−1 = SWP takes the overflow trap
  instead. A RET that would make CWP+1 = SWP takes the underflow trap. On a
  trap or interrupt the hardware does the following:
  1. CWP−1, unchecked;
  2. loc0 ← PC of the instruction not executed, loc1 ← next PC;
  3. PI ← I, I ← 0;
  4. jump to the vector: overflow `&10`, underflow `&18`, interrupt `&20`.

  The handler returns with `jmp alw,(loc0)0` followed by `ret (loc1)0`, or by
  `retint` if PI was set. That re-runs the instruction that trapped.
  CALLINT (CWP−1, Rd ← last PC, I ← 0) and GTLPC (Rd ← last PC, the address of
  the previous instruction) are implemented as specified, but the page's own
  handlers do not need them.
- **The window-spill handlers** are the page's own RISC I assembly, generated
  for the selected register file and shown in the listing:
  - They use the trap window's LOCAL registers, plus two reserved globals:
    `osp`, the register-overflow stack pointer, and `gpsw`. These are r8–r9 on
    the architecture and r16–r17 on Gold.
  - Overflow saves the oldest frame's LOCAL and HIGH registers and moves SWP
    back one window.
  - Underflow refills the frame and moves SWP forward. On an empty stack it
    halts: the outermost procedure has returned.
  - Both switch windows with PUTPSW, as the report describes ("a hardware trap
    will start an interrupt handler which moves a number of registers to/from
    main memory", p.5–6).
- **Byte order** is little-endian, like the VAX that hosted the tools. Word
  and halfword accesses must be aligned, or the page stops.
- **Memory map.** 64 KB of RAM. Reset code is at `&0`, the vectors at `&10`,
  `&18` and `&20`, the handlers from `&100`, the register-overflow stack from
  `&800` growing up, and user programs from `&4000`.
- **Devices, invented and labelled.** A terminal at the top of the address
  space, reachable through r0 plus a negative 13-bit offset:

  | Name | Address | Offset | Behaviour |
  |---|---|---|---|
  | `TERM_DATA` | `&FFFFFFF0` | −16 | read a key / write a character |
  | `TERM_STATUS` | | −12 | bit 0: a key is waiting |
  | `TERM_CONTROL` | | −8 | bit 0: interrupt on key |
  | `HALT` | | −4 | any store stops the machine |
  | `PRINT` | | −20 | prints a signed decimal |
  | `PRINT_HEX` | | −24 | prints hex |

## Architecture

One `index.html`. The engine is in `<script id="shared-code">`, and `test.mjs`
runs `RISC1Tests.run()`.

1. `CONFIGS`: `gold` and `design` (globals, windows, HIGH, LOCAL and LOW
   counts). `mapRegister(config, cwp, r)` gives the physical index.
2. `disassemble(word, address)`.
3. `Memory`: 64 KB, little-endian, plus the devices, with a write journal.
4. `RISC1`: the physical register file, PC and NPC, the PSW, `step()`, traps,
   and counters (instructions, cycles, loads, stores, calls, returns,
   overflows, underflows, words spilled and filled, NOP delay slots).
5. `systemSource(config)`: the page's reset, vector and handler code.
6. `assemble(source, config)`: two passes. It handles aliases, `{c}`,
   `.org .word .half .byte .space .align .ascii .asciz .equ`, labels, `.`,
   expressions, the `nop`, `mov` and `set` pseudo-instructions, and range
   errors that point at `ldhi`.
7. `RISC1Tests`.

## Page layout

- **Header:** 1981 · 32 bit · 1.5 MHz · 44,500 transistors, each with a
  tooltip.
- **Left column:** program library, terminal (output, plus an input box that
  queues keys), and the register-file switch.
- **Centre column:**
  - A pipeline strip: FETCH at NPC and EXECUTE at PC, with delay slots
    flagged.
  - The data path after Figure 4: register file, bus A/B/C, shifter, ALU,
    PCs, immediate, data in and out.
  - The register-window ring as a physical column: each window's LOW and
    LOCAL, the current window's HIGH/LOCAL/LOW bracketed, CWP and SWP marked,
    resident frames tinted, and the spilled depth counted.
  - A readout: instructions, cycles, chip time at 2 µs per cycle, and time at
    the 400 ns target.
- **Right column:** registers r0–r31 of the current window (alias and physical
  number), the PSW, window traffic in the style of Table 5, memory, and the
  trace.
- **Below:** disassembly with breakpoints (system code tagged), the workbench,
  the instruction-set panel, and "what it got right / wrong".

## Demo library (8)

1. **The first program**: poll the terminal, shift letters by a key, echo
   them (11 June 1982).
2. **r0 is zero**: move, clear, negate, compare-to-zero and absolute
   addressing, synthesised as in Tables 5–6.
3. **Delayed jumps**: the same loop with a NOP in the delay slot and with the
   slot filled (Table 7). Count the wasted cycles.
4. **Big constants**: LDHI and ADD, printing `&DEADBEEF`.
5. **Parameters in registers**: A calls B calls C, and all values travel
   through the overlap with no memory access (Figure 2).
6. **Multiply in software**: shift-and-add, and factorials up to 12.
7. **Ackermann**: acker from Table 4. Gold takes many more overflow traps than
   the architecture would.
8. **Quicksort**: recursive; spill traffic against calls, as in Table 5.

## Testing

- The window map for both register files: the overlap is exact, globals are
  shared, and every physical register is reached.
- ALU results and flags, including carry and borrow, SUBR and SUBCR, and all
  16 conditions.
- Loads with sign and zero extension, stores, alignment faults, and devices
  through r0.
- LDHI, GTLPC, GETPSW/PUTPSW, CALLINT and RETINT.
- Delay slots after JMP, JMPR, CALL and RET, and which window each slot runs
  in.
- Overflow and underflow: deep recursion returns correct results on both
  register files, the overflow stack drains to empty, the trap counts are
  right, and returning from the outermost frame halts.
- A terminal interrupt runs a user handler and resumes.
- The assembler: encodings round-trip through the disassembler, errors name
  lines, `{c}` on a load or shift is refused, and aliases outside the current
  file are refused.
- Undo.
- Each demo end to end, checking what its note claims.
