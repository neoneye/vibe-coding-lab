# Zilog Z80A

A standalone HTML page that emulates the Z80A as the Amstrad CPC used it. Write
Z80 assembly, step it one instruction at a time, and watch the registers,
memory and bitmap screen change. No dependencies, no network, no Amstrad ROMs.

Open `index.html` in a browser. That is the whole thing.

## What is emulated

- All five opcode tables — unprefixed, `CB`, `ED`, `DD`/`FD` and
  `DDCB`/`FDCB` — plus the undocumented-but-deterministic parts a real NMOS
  Z80A has anyway: the `IXH IXL IYH IYL` half-registers, `SLL`, the `ED`
  duplicates, the `DDCB` forms that also copy into a register, and bits 3 and
  5 of F, including the internal WZ register that `BIT n,(HL)` takes them from.
- Correct T-states with branch, call and block-repeat extras, then rounded up
  to a whole microsecond the way the gate array does it.
- Gate Array: three screen modes, the 27-colour hardware palette across 32
  slots, 16 pens and a border, mode and ROM configuration, and the 300 Hz
  interrupt. The palette, border and mode are latched per scanline, so a
  mid-frame change draws a real split.
- CRTC 6845 registers R1, R6, R12 and R13 — enough for the screen base and
  hardware scrolling — and the CPC's interleaved screen layout.
- Interrupts: `IM 0/1/2`, `EI`'s one-instruction delay, `HALT` and its wake,
  `IFF1`/`IFF2`, `RETI`/`RETN`.

Not emulated: the AY-3-8912, the PPI and keyboard, disc and tape, the 6128's
RAM banking, and per-machine-cycle bus timing — the gate array really stretches
each machine cycle rather than the whole instruction, so a handful of
instructions run one microsecond fast here. There is no Amstrad or Locomotive
ROM, so nothing to `CALL &BB5A` into, and the 8×8 font is original artwork
loaded into RAM at `&B800`.

## Assembler

Zilog mnemonics with Amstrad conventions. `&C000` hex (also `#C000`, `0xC000`,
`2AH`), `%10110000` binary, decimal, `'A'`; `$` alone is the current address.
Operators `+`, `-` and `*`, plus `HI(x)` and `LO(x)`. Labels with or without a
colon; `NAME EQU expr`; `ORG`, `DEFB`/`DB`, `DEFW`/`DW`, `DEFS`/`DS`,
`DEFM`/`DM`.

## Tests

```bash
node test.mjs
```

The emulator, assembler and disassembler live in the `<script id="shared-code">`
block of `index.html`; `test.mjs` pulls that block out and runs the suite under
Node. It covers ALU flags including the undocumented bits, `DAA` against a
known-answer table, the index registers and their displacement rules, block
instructions, interrupts and the `EI` delay, instruction timing, the gate
array and CRTC, pixel decoding in all three modes, the assembler, undo, and an
end-to-end run of each of the nine demo programs.
