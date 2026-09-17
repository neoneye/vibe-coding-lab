# Zilog Z80A — standalone emulator page

Date: 2026-09-17
Directory: `zilog-z80a/`
Series: Silicon Observatory No. 003, after `intel-4004/` and `mos-6510/`.

## Goal

A dependency-free `index.html` that teaches the Z80A as the Amstrad CPC used
it. Write Z80 assembly, step it one instruction at a time, and watch the
registers, memory and bitmap screen change. Same genre and furniture as the
first two: program library, live block diagram, register file, memory view,
disassembly with breakpoints, execution trace, assembly workbench, and a
limitations panel that says plainly what is not modelled.

## Scope

**In:**

- Full Z80 across all five opcode tables: unprefixed, `CB`, `ED`, `DD`/`FD`
  (IX/IY) and `DDCB`/`FDCB`.
- The undocumented-but-deterministic parts a real NMOS Z80A has anyway: the
  `IXH/IXL/IYH/IYL` half-registers, `SLL`, the `ED` duplicates, the `DDCB`
  forms that also copy their result into a register, and the XF/YF flag bits
  (F bits 3 and 5), including the WZ/MEMPTR behaviour that makes
  `BIT n,(HL)` take them from an internal register.
- 64 KB RAM. No Amstrad or Locomotive ROM — those are copyright.
- Gate Array: three screen modes, the 27-colour hardware palette addressed
  through 32 slots, 16 pens plus a border, mode and ROM configuration, and
  the 300 Hz interrupt.
- CRTC 6845 registers R1, R6, R12 and R13 — enough for the screen base and
  the display offset, so hardware scrolling works.
- The interleaved screen layout.
- Interrupts: `IM 0/1/2`, `EI`'s one-instruction delay, `DI`, `HALT` and its
  wake, `IFF1`/`IFF2`, `RETI`/`RETN`.
- Assembler, nine demo programs, undo, breakpoints, execution trace.

**Out:** AY-3-8912 sound, the PPI and keyboard matrix, disc and tape, RAM
banking beyond the 464's 64 KB, and per-machine-cycle bus timing.

## Architecture

One `index.html`. The engine lives in `<script id="shared-code">` so
`test.mjs` can load and run it under Node, as in `game-snake/` and
`mos-6510/`.

Units inside the shared block, each independently testable:

1. `decode(read, pc)` — walks the prefix chain and returns
   `{ bytes, size, text, op, prefix, tStates }`. Pure. Drives the listing,
   the trace and the block diagram.
2. `Z80` — registers, flags, `step()`. Dispatch follows the chip's own
   `x/y/z/p/q` bit split of the opcode rather than a thousand hand-written
   table entries: less code, and less to get wrong.
3. `Bus` — 64 KB RAM plus `in`/`out`, journalling every write so undo does
   not need 64 KB snapshots.
4. `GateArray` — pen and colour latches, mode, ROM configuration, the
   interrupt counter, and the per-scanline palette and mode record.
5. `CRTC` — the handful of registers that decide where the screen lives.
6. `screenAddress(y, xByte)` and `decodePixels(byte, mode)` — pure, tested
   directly.
7. `assemble(source)` — two-pass assembler.
8. `Z80Tests` — the suite, run from `test.mjs`.

UI code sits in a second, untested `<script>`: DOM wiring, the render loop,
the canvas blit and keyboard shortcuts.

## Timing

Base T-states come from a 256-entry table for the unprefixed opcodes, with
rules for the prefixes: `CB` is 8, or 12/15 for the `(HL)` forms; `DD`/`FD`
is the unprefixed timing plus 4, except the `(IX+d)` operand forms which are
19, or 23 for `INC`/`DEC`; `DDCB` is 20 for `BIT` and 23 otherwise; `ED` has
its own table. Conditional extras are added when a branch is taken, a call
is taken, or a block instruction repeats.

The Gate Array then rounds the total up to a multiple of 4 T-states, which is
why Amstrad published its timings in whole microseconds.

**Known approximation:** the real Gate Array stretches each *machine cycle*
to a 4 T-state slot, not the instruction as a whole. Instructions containing
a machine cycle longer than four T-states — `RST`, `PUSH`, `RET cc`, `DJNZ`,
`INC`/`DEC rr`, `EX (SP),HL`, the block moves — therefore take one more
microsecond on hardware than this rounding produces. Machine cycles are not
modelled individually, and the limitations panel says so rather than the page
pretending otherwise.

## Screen

```
address = base + (y & 7) * 0x800
              + ((offset * 2 + (y >> 3) * 80 + xByte) & 0x7FF)
base   = (R12 & 0x30) << 10          -> 0x0000 / 0x4000 / 0x8000 / 0xC000
offset = ((R12 & 0x03) << 8) | R13
```

Default `R12 = 0x30`, `R13 = 0` puts the screen at `&C000`. Raising `R13`
scrolls by byte pairs, which is the CPC's hardware scroll.

Pixels are bit-interleaved within each byte:

- Mode 0, two pixels of 4 bits: `p0 = b7 b3 b5 b1`, `p1 = b6 b2 b4 b0`.
- Mode 1, four pixels of 2 bits: `p0 = b7 b3`, `p1 = b6 b2`, `p2 = b5 b1`,
  `p3 = b4 b0`.
- Mode 2, eight pixels of 1 bit, most significant first.

All three modes fill the same width, so the canvas is 640 wide and mode 0
pixels are drawn four canvas pixels across, mode 1 two, mode 2 one. Each CPC
scanline is drawn as two canvas rows so the picture is not squashed.

The 32 hardware colour slots map onto 27 distinct RGB values, each component
one of 0, 0x80 or 0xFF. The palette, the border and the mode are latched per
scanline as the clock advances, so a mid-frame change draws a real split.

## Interrupts

256 T-states per scanline, 312 scanlines per frame, a request every 52
scanlines: 300 Hz. On acceptance `IFF1` and `IFF2` clear, `HALT` is left, and
`IM 1` calls `&0038`. `IM 0` behaves as `RST &38`, which is what the CPC's
undriven bus produces.

**Stated assumption:** `IM 2` builds its vector from `I` and a data-bus byte.
What the Gate Array actually puts on the bus during interrupt acknowledge is
not something this page can claim with confidence, so it uses `&FF` and the
limitations panel says that it is an assumption, not a measurement.

## Assembler

Zilog mnemonics, Amstrad conventions where they differ:

- Hex `&C000`, also `#C000` and `0xC000`; binary `%10101010`; decimal;
  `'A'` for a character. `$` alone means the current address.
- Operators `+`, `-` and `*`, with `*` binding tighter. `HI(expr)` and
  `LO(expr)` split an address. Using functions rather than `<`/`>` avoids any
  clash with `&` as the hex prefix.
- Labels with or without a trailing colon; `NAME EQU expr`.
- `ORG`, `DEFB`/`DB`, `DEFW`/`DW`, `DEFS`/`DS`, `DEFM`/`DM`.
- Forward references assemble as absolute, as there is no short form to
  choose between on a Z80.

## Undo

A per-step journal of `{ address, previousValue }` writes plus a copy of the
register set, 512 steps deep.

## Error handling

- Assembler errors carry the line number, what was expected and what was
  found; out-of-range displacements and relative jumps are caught at
  assembly time.
- `HALT` with interrupts disabled is a genuine dead end on hardware and is
  reported as one rather than spinning.
- Every opcode decodes. A Z80 has no unstable-opcode class, so nothing needs
  to refuse to run.

## Demo library (9, ordered)

1. **First byte** — one byte into `&C000`, and the pixels it becomes.
2. **Pixel encoding** — the same byte in modes 0, 1 and 2.
3. **The interleave** — a vertical line, and the `&800` jump every 8 rows.
4. **LDIR** — clear the screen with the Z80's block move.
5. **Palette** — pens and border through `OUT (&7F),A`.
6. **Text** — an 8×8 routine using the original font that ships with the
   page, since there is no OS ROM to borrow one from.
7. **IX and tables** — indexed addressing walking a table of coordinates.
8. **Raster split** — the 300 Hz interrupt changing the palette mid-frame.
9. **Hardware scroll** — CRTC R12/R13 moving the whole display.

Each carries a title, tag, description and a "what to watch" note.

## Testing

`test.mjs` extracts the shared-code block and runs `Z80Tests.run()`.

- Flags for every ALU operation: S, Z, H, the overflow-versus-parity split,
  N, C, and the XF/YF bits.
- `DAA` against a known-answer table across N, H and C.
- `ADD HL,rr` versus `ADC`/`SBC HL,rr` — the first leaves S, Z and P/V alone.
- Rotates and shifts including `RLD`/`RRD` and the undocumented `SLL`.
- `BIT n,r` flags, and `BIT n,(HL)` taking XF/YF from WZ.
- Block instructions: `LDIR`, `CPIR` and their P/V and undocumented flags.
- Signed `(IX+d)` displacement, and the `DDCB` register-copy forms.
- The rule that `DD` does not substitute the other register in
  `LD r,(IX+d)`.
- `EI`'s one-instruction delay, interrupt acceptance, `HALT` wake,
  `IFF1`/`IFF2` and `RETN`.
- The CRTC address formula and pixel decoding in all three modes.
- That the hardware palette holds exactly 27 distinct colours.
- Gate Array port decoding: pen select, colour, mode.
- Assembler: each operand form, round-trip assemble to disassemble, relative
  jump range, and error messages naming the line.
- An end-to-end run of each of the nine demos, asserting what its "what to
  watch" note claims.

## Non-goals

Not a CPC emulator. It will not run a `.dsk` or a `.sna`, there is no
firmware to `CALL &BB5A` into, and the character set is original artwork
rather than the Amstrad character ROM.
