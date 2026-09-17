# MOS 6510

A standalone HTML page that emulates the CPU inside the Commodore 64. Write
6502/6510 assembly, step it one instruction at a time, and watch the registers,
memory and screen change. No dependencies, no network, no Commodore ROMs.

Open `index.html` in a browser. That is the whole thing.

## What is emulated

- All 151 documented opcodes plus the stable undocumented ones (`SLO RLA SRE
  RRA SAX LAX DCP ISC ANC ALR ARR SBX LAS`, the undocumented `NOP`s and
  `SBC $EB`). `JAM` halts, as it should.
- Cycle counts including page-cross and branch penalties, the `JMP ($xxFF)`
  page-wrap bug, zero-page index wrap, and decimal-mode `ADC`/`SBC`.
- The 6510's own I/O port at `$00`/`$01`, including the banking rules: write
  `$30` there and the VIC registers really do disappear behind RAM.
- A VIC-II subset: screen RAM, colour RAM, `$D011`/`$D012` raster on PAL
  timing, `$D018` screen base, and `$D020`/`$D021` latched per raster line so
  mid-frame colour writes draw real bars.

Not emulated: SID, the CIAs, interrupts, sprites, bitmap modes, and the
unstable undocumented opcodes, which decode and then stop the machine rather
than invent a value. There is no KERNAL, BASIC, or character ROM — the 8x8
font is original artwork, and there is nothing to `JSR $FFD2` into.

## Assembler

Standard 6502 syntax. `$hex`, `%binary`, decimal, `'c'`; labels ending in `:`;
`NAME = expr` constants; `*=` / `.org`; `.byte`, `.word`, `.fill`, `.text`
(raw ASCII) and `.screen` (converted to screen codes); `<`/`>` for the low and
high byte of an address. Forward references assemble as absolute.

## Tests

```bash
node test.mjs
```

The emulator, assembler and disassembler live in the `<script id="shared-code">`
block of `index.html`; `test.mjs` pulls that block out and runs the suite under
Node. The tests cover flag behaviour, decimal mode, every addressing mode,
cycle penalties, the stable undocumented opcodes, the bus and banking rules,
undo, the assembler, and an end-to-end run of each of the eight demo programs.
