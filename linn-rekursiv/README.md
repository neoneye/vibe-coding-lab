# Linn Rekursiv

A standalone HTML page that simulates the Linn Rekursiv, the object-oriented
processor Linn built in Glasgow in the 1980s. The machine came with no
instruction set: you wrote one in microcode. It had no addresses, only
object numbers. Its memory outlived the power switch.

You write a small Smalltalk-like program. The page compiles it to an
instruction set that is itself written in the page's microcode, and runs
both tiers one microword at a time. Along the way you can watch:

- the pager table hash each object number into a slot;
- collisions squeeze objects out to disk;
- page faults stop the machine dead and resume the same microword;
- the collector copy only new or modified objects to the other half of DRAM;
- `COPYTREE` recurse through the control stack inside a single instruction.

It has no dependencies and needs no network. Open `index.html` in a browser.

Silicon Observatory No. 008, after `intel-4004/`, `mos-6510/`, `zilog-z80a/`,
`acorn-arm1/`, `mit-scheme-79/`, `berkeley-risc1/` and `inmos-t414/`.

## Sources

The page follows Dick Pountain, "Rekursiv: an object-oriented CPU",
*BYTE*, November 1988, pp. 341–349, on
[archive.org](https://archive.org/details/eu_BYTE-1988-11_OCR). Its block
diagram is Figure 1, and its microcode listing, `MICRO$COPYTREE`, is
Listing 2.

The page could not reach three sources:

- Harland & Beloff's two ACM papers (SIGARCH CAN 14:5, 1986; SIGPLAN
  Notices 22:4, 1987);
- Harland's book *Rekursiv: Object-Oriented Computer Architecture*
  (Ellis Horwood, 1988).

## What is BYTE's

- **The units and memories.** Numerik, Logik and Objekt, the
  16,384 × 128-bit control store, the control store map, the two stacks, NAM
  & NAMARG (524,288 words of 10-bit opcode and 30-bit argument), the pager
  tables, and the DRAM object store. 10 MHz.
- **The 40-bit object number.** An object/raw bit, a compact bit, and a
  compact's 5-bit type and 32-bit data. A sequential allocator issues 38-bit
  numbers.
- **The pager table.** It is hashed on the object number and holds the size,
  the type (itself an object number) and the DRAM address. Every access is
  type- and range-checked. A collision squeezes the old object out to disk.
- **Page faults** stall below the instruction level and need no restart.
- **The collector.** Two DRAM halves and grabspace's EndMem test. GC traces
  with disk fetches off and copies only new or modified objects. Its second
  level squeezes objects out to disk.
- **Startup.** The machine is empty until the host writes the control store
  over VME.

## What is this page's

- **The instruction set.** LINGO-8 and its microcode, in a field syntax
  modelled on Listing 2. The fields of a word run in order, not in
  parallel.
- **The language.** A Lingo-like language and its compiler, with blocks
  inlined and no closures.
- **Data layouts.** The compact type codes; symbols as compacts; the class,
  method and root object layouts.
- **Objekt details.** The hash (number mod slots) and the VR status bits.
  Spilling an object also spills the new objects it refers to. GC keeps
  modified disk objects live.
- **Costs.** 15 ms per disk transfer, and the cost of a GC.
- **The host.** The HADES output protocol, the host's printer, and the warm
  start that preloads the image. A power cycle starts cold.

These are not modelled: Klok, the real microword bits, the spare-half last
resort for a huge object, and offline renumbering of object numbers. The
"Model & limitations" panel on the page says why.

## Tests

```bash
node test.mjs
```

The engine lives in the `<script id="shared-code">` block of `index.html`,
and `test.mjs` runs its 26-test suite under Node. The suite covers:

- the word tags;
- microassembler errors;
- Objekt: range and type traps, collisions and faults, spill closure, and
  both GC levels;
- compiler errors and inlined control structures;
- Back;
- each of the nine demos end to end, checking what its "what to watch" note
  claims.
