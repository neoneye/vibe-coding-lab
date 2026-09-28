# Berkeley RISC I

A standalone HTML page that emulates RISC I, the 1981 Berkeley chip that named
RISC. You write RISC I assembly and step it one instruction at a time. The
centrepiece is the overlapped register windows: a large physical register file
drawn as a ring, a 32-register view that turns on every CALL and RET, and
arguments that pass from caller to callee without being copied. It has no
dependencies and needs no network.

Open `index.html` in a browser. That is the whole thing.

Silicon Observatory No. 006, after `intel-4004/`, `mos-6510/`, `zilog-z80a/`,
`acorn-arm1/` and `mit-scheme-79/`.

## Two register files

The architecture specifies 138 registers: 10 globals plus 8 windows of 22
registers that overlap by 6. The Gold chip Berkeley actually fabricated had
only 78: 18 globals plus 6 windows of 14 registers that overlap by 4, because
the full register file did not fit the package. The page defaults to the chip
as built, and a switch selects the design as specified.

The assembler aliases `in0…`, `loc0…`, `out0…` and `ra` follow the selected
register file, so every demo runs on both. The Ackermann demo shows why the
numbers matter: 1,088 overflow traps on Gold against 992 on the full design,
yet the design spills more words in total, because each of its frames is 16
registers, not 10.

## What is from the papers, and what is this page's

**From the papers** (Séquin & Patterson, UCB/CSD 82/106; Patterson & Séquin,
UCB/ERL M82/10 and ISCA 1981):

- the 31 instructions and their operand forms;
- the instruction formats;
- r0 hard-wired to zero;
- the delayed jump;
- one cycle per instruction, and two for loads and stores;
- the PDP-11 condition set;
- both register files;
- the chip's one design error (setting condition codes on loads and shifts),
  worked around here the way Berkeley did, in the assembler.

**This page's own**, because the papers never give them, all labelled on the
page:

- the opcode numbers;
- the condition encoding;
- the PSW layout;
- the trap mechanism and its vectors;
- the window-spill handlers, written in RISC I assembly and visible in the
  listing;
- the byte order;
- the memory map;
- exactly when CALL and RET change the window;
- the terminal.

## Tests

```bash
node test.mjs
```

The engine lives in the `<script id="shared-code">` block of `index.html`, and
`test.mjs` runs its 45-test suite under Node. The suite covers:

- the window map and overlap for both register files;
- ALU results and flags, and all sixteen conditions;
- loads and stores;
- delay slots, and which window each one runs in;
- overflow and underflow round trips at every depth;
- a terminal interrupt;
- the assembler and disassembler;
- undo;
- every demo on both register files, checking what its note claims.
