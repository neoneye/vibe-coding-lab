# Acorn ARM1 — standalone emulator page

Date: 2026-09-17
Directory: `acorn-arm1/`
Series: Silicon Observatory No. 004, after `intel-4004/`, `mos-6510/` and
`zilog-z80a/`.

## Goal

A dependency-free `index.html` that teaches the ARM1 — Acorn's 1985 32-bit
processor, about 25,000 transistors, designed by Sophie Wilson and Steve
Furber. Write ARM assembly, step it one instruction at a time, and watch the
registers, memory and framebuffer change. Same furniture as the first three:
program library, live block diagram, register file, memory view, disassembly
with breakpoints, execution trace, assembly workbench, limitations panel.

The point of the page is what is *not* there. A 32-bit processor with no
multiplier, no coprocessor interface, no MMU and no microcode, in a quarter of
the transistors a 68000 needed.

## Scope

**In:**

- ARMv1 exactly, which is what the 1985 silicon ran:
  - Sixteen data-processing operations: `AND EOR SUB RSB ADD ADC SBC RSC
    TST TEQ CMP CMN ORR MOV BIC MVN`.
  - `B`, `BL`.
  - `LDR`, `STR`, byte and word, pre- and post-indexed, with writeback.
  - `LDM`, `STM` in all four orderings, with the stack aliases.
  - `SWI`.
- A 4-bit condition field on every instruction, all sixteen codes including
  `NV`, which never executes.
- The barrel shifter on operand 2: `LSL LSR ASR ROR`, by immediate or by
  register, including the `LSR #0`, `ASR #0` and `RRX` special cases and the
  shifter's carry-out feeding C.
- R15 as program counter and status register together: N Z C V in bits 31-28,
  I and F in 27-26, a 24-bit word PC in 25-2, and the mode in 1-0.
- The three-stage pipeline as it is visible to software: R15 reads as the
  instruction's address plus 8, or plus 12 for Rm when the shift amount comes
  from a register.
- Banked registers for the four modes: USR, FIQ (R8-R14 banked), IRQ and SVC
  (R13-R14 banked).
- Exceptions: reset, undefined instruction, SWI, address exception, IRQ, FIQ.
- 1 MB of RAM from address zero, and a genuine address exception beyond 26
  bits, which is real ARM1 behaviour that disappeared after ARM2.

**Out:** `MUL` and `MLA` (ARM2), `SWP` (ARM2a), the coprocessor interface
(ARM2), `MRS`/`MSR` and 32-bit addressing (ARM6), the MEMC memory controller,
and per-cycle bus timing.

## The invented parts, and why they are labelled

The ARM1 had no display hardware. It was a prototype on an evaluation board
that plugged into a BBC Micro; it was ARM2 that reached the Archimedes. So
there is no CPC-style gate array to model here, and inventing a plausible one
would be exactly the confident-sounding fiction the other three pages avoid.

Instead this page gives the processor the simplest possible peripherals and
says, in the limitations panel and in the demo notes, that they are the page's
own invention:

- A flat framebuffer at `&100000`: 320 by 200, one byte per pixel, colour
  packed as 3 bits red, 3 green, 2 blue. No interleaving, no banking, no
  palette — the exact opposite of the C64 and CPC screens, which is a teaching
  point in itself.
- A timer at `&200000`: `LOAD` at +0, `CONTROL` at +4 (bit 0 runs it, bit 1
  routes it to FIQ instead of IRQ), `ACK` at +8.

Nothing else answers. Reads from unmapped addresses return zero.

## Architecture

One `index.html`. The engine lives in `<script id="shared-code">` so
`test.mjs` can load and run it under Node.

1. `disassemble(read, address)` — pure; drives the listing, the trace and the
   block diagram.
2. `shifter(type, value, amount, carryIn, byRegister)` — pure, returns the
   shifted value and the carry out. Tested on its own because the `#0` cases
   are where every ARM emulator goes wrong.
3. `Bus` — RAM, framebuffer and timer, journalling every write so undo does
   not need a megabyte of snapshots.
4. `ARM1` — the register banks, the packed R15, `step()`, and exception entry.
5. `assemble(source)` — two passes plus a literal pool.
6. `ARM1Tests` — the suite.

UI code sits in a second, untested `<script>`.

## Exception model

On entry the banked R14 takes the return address with the current PSR packed
into its top bits, the mode changes, and I is set (I and F for FIQ and reset).

| Exception | Vector | Saved in | Return |
|---|---|---|---|
| Reset | `&00` | — | — |
| Undefined instruction | `&04` | R14_svc = A+4 | `MOVS PC,R14` |
| SWI | `&08` | R14_svc = A+4 | `MOVS PC,R14` |
| Address exception | `&14` | R14_svc = A+8 | `SUBS PC,R14,#8` |
| IRQ | `&18` | R14_irq = A+4 | `SUBS PC,R14,#4` |
| FIQ | `&1C` | R14_fiq = A+4 | `SUBS PC,R14,#4` |

A is the address of the instruction that caused the exception, or for IRQ and
FIQ the instruction that would have run next. Prefetch and data aborts are not
generated, because nothing in this machine can abort a transfer.

## Assembler

ARM syntax, Acorn conventions where they differ:

- `&8000` hex, `%1010` binary, decimal, `'A'`; `.` alone is the current
  address.
- Condition and `S` suffixes on every mnemonic: `ADDEQS`, `BLNE`, `LDMFD`.
- Register lists: `{R0-R3, R12, PC}`. `SP`, `LR` and `PC` alias R13, R14, R15.
- Addressing: `[R1]`, `[R1, #4]`, `[R1, #4]!`, `[R1], #4`, `[R1, R2, LSL #2]`.
- `LDR Rd, =expr` puts the value in a literal pool and loads it PC-relative.
  It earns its place: an ARM immediate is an 8-bit value rotated right by an
  even amount, so most 32-bit constants cannot be encoded inline. When one
  cannot, the assembler says exactly that and points at `LDR =`.
- Directives: `ORG`, `EQU`, `DCB`, `DCW`, `DCD`, `FILL`, `ALIGN`, `POOL`.

Forward references assemble as absolute; no ARM instruction changes size.

## Reset state

There is no firmware to set anything up, so the page does it and says so:
R13 starts at `&10000` in every bank, the mode is SVC, and I and F are set.
Execution starts at the first `ORG`, not at the reset vector, so a demo does
not have to write one.

## Testing

`test.mjs` extracts the shared-code block and runs `ARM1Tests.run()`.

- All sixteen condition codes against every flag combination that matters.
- Each data-processing opcode, its result and its flags, including which ones
  leave V alone and which ones take C from the shifter.
- Every shift: `LSL/LSR/ASR/ROR` by immediate and by register, the `#0` forms,
  `RRX`, shift amounts of 32 and more, and the carry out in each case.
- Immediate encoding both ways, and that an unencodable constant is an error
  naming `LDR =`.
- R15 reading as A+8, as A+12 for Rm under a register shift, and storing as
  A+12; writing R15 as a branch; `MOVS PC,R14` restoring the PSR.
- `B`/`BL` offsets and R14 carrying the PSR.
- `LDR`/`STR` pre- and post-indexed, writeback, byte and word, the rotate on
  an unaligned word load, and the forced alignment on a word store.
- `LDM`/`STM` in all four orderings, the eight stack aliases, writeback, the
  S bit, and R15 in the list.
- Mode banking: that FIQ sees its own R8-R14 and IRQ and SVC their own
  R13-R14.
- Each exception: vector, mode, saved R14 and the documented return.
- The timer raising IRQ and FIQ.
- The assembler, its literal pool and its error messages.
- Undo.
- An end-to-end run of each of the nine demos, asserting what its note claims.

## Demo library (9, ordered)

1. **First pixel** — one byte into the framebuffer, and what 3-3-2 means.
2. **Conditional GCD** — Euclid with no branches at all, because every
   instruction carries its own condition.
3. **The barrel shifter** — shifting inside operand 2 for free.
4. **Multiply without a multiplier** — shift and add, because ARM1 has no
   `MUL`.
5. **R15 is the program counter** — reading it, writing it, and the +8.
6. **LDM and STM** — eight registers in one instruction, filling the screen.
7. **Stack frames** — `STMFD`/`LDMFD` and returning straight into the PC.
8. **FIQ's own registers** — why FIQ banks R8 to R14 and what that buys.
9. **Timer interrupt** — an IRQ handler driving an animation.

## Non-goals

Not an Archimedes and not an ARM Evaluation System. It will not run RISC OS,
there is no BBC Micro attached, and the display and timer are this page's own
invention rather than Acorn hardware.
