# Acorn ARM1

A standalone HTML page that emulates the ARM1 — Acorn's 1985 32-bit processor,
about 25,000 transistors, designed by Sophie Wilson and Steve Furber. Write ARM
assembly, step it one instruction at a time, and watch the registers, memory and
framebuffer change. No dependencies, no network, no Acorn ROMs.

Open `index.html` in a browser. That is the whole thing.

The point of the page is what is missing. A 32-bit processor with no multiplier,
no coprocessor interface, no MMU and no microcode, in a quarter of the
transistors a 68000 needed.

## What is emulated

- ARMv1 exactly, which is what the 1985 silicon ran: the sixteen
  data-processing operations, `B` and `BL`, `LDR` and `STR`, `LDM` and `STM`,
  and `SWI`. That is the entire instruction set. No `MUL` — multiply arrived
  with ARM2 — no `SWP`, no coprocessor instructions, no `MRS`/`MSR`, no MMU.
- A 4-bit condition on every instruction, all sixteen codes including `NV`.
- The barrel shifter on operand 2, including the `LSR #0`, `ASR #0` and `RRX`
  forms, shift amounts given in a register, and the shifter's carry-out.
- R15 as program counter and status register in one word: flags in bits 31-28,
  the interrupt disables in 27-26, a 24-bit word address in 25-2, and the mode
  in 1-0. Reading it gives the instruction's address plus 8, or plus 12 for the
  shifted register when a register supplies the shift amount; storing it gives
  plus 12.
- Banked registers for all four modes, exceptions with the documented return
  addresses, and a real address exception past 26 bits — genuine ARM1 behaviour
  that disappeared after ARM2.

## The invented parts

The ARM1 had no display hardware. It was a prototype on a board that plugged
into a BBC Micro, and it was ARM2 that reached the Archimedes. So the
framebuffer at `&100000` — 320 by 200, one byte per pixel as 3-3-2 RGB, no
palette and no interleaving — and the timer at `&200000` are this page's own
inventions, and the page says so wherever they appear.

## Assembler

ARM syntax with Acorn conventions. `&8000` hex, `%1010` binary, decimal, `'A'`;
`.` is the current address. Condition and `S` suffixes on every mnemonic,
register lists like `{R0-R3, PC}`, and `LDR R0, =value` with a literal pool.
That last one earns its place: an ARM immediate is an 8-bit value rotated right
by an even amount, so when a constant cannot be encoded the assembler says
exactly that and points at `LDR =`.

Directives: `ORG`, `EQU`, `DCB`, `DCW`, `DCD`, `FILL`, `ALIGN`, `POOL`.

## Tests

```bash
node test.mjs
```

The emulator, assembler and disassembler live in the `<script id="shared-code">`
block of `index.html`; `test.mjs` pulls that block out and runs the suite under
Node. It covers the barrel shifter in every form, immediate encoding both ways,
all sixteen condition codes, each data-processing operation and its flags, R15's
pipeline offsets, branches, every transfer and block-transfer addressing mode,
mode banking, each exception, the timer, the assembler and its literal pool,
undo, and an end-to-end run of each of the nine demo programs.
