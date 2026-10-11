# Linn Rekursiv — standalone simulator page

Date: 2026-10-11
Directory: `linn-rekursiv/`
Series: Silicon Observatory No. 008, after `inmos-t414/`.

## Sources

- **Primary.** Dick Pountain, "Rekursiv: an object-oriented CPU", *BYTE*,
  November 1988, pp. 341–349 (archive.org `eu_BYTE-1988-11_OCR`, PDF pages
  410–418). Figure 1 is the block diagram. Listing 2 is a real microcode
  routine, `MICRO$COPYTREE`.
- **Not reachable.** Harland & Beloff, "Microcoding an object-oriented
  instruction set" (SIGARCH CAN 14:5, 1986), and "OBJEKT: a persistent object
  store with an integrated garbage collector" (SIGPLAN Notices 22:4, 1987),
  are behind Cloudflare. Harland's book *Rekursiv: Object-Oriented Computer
  Architecture* (Ellis Horwood, 1988) is not online.
- **Secondary.** Wikipedia and CPU Shack repeat BYTE. Grokipedia was the
  user's link; it is AI-written and contradicts itself (it says three chips
  and then lists four; it gives the control store as both 256 KB and 64K), so
  nothing on the page relies on it alone.

## What BYTE fixes (the page follows it)

- Three 1.5 µm CMOS gate arrays from LSI Logic, in 299-pin ceramic PGAs:
  **Numerik** (a 32-bit ALU compatible with the Am29203, with a 32×32→64
  multiply and a 32-bit barrel shifter), **Logik** (sequencer and stacks), and
  **Objekt** (object memory manager). **Klok** is a programmable timer.
  10 MHz.
- Seven memories: the control store (16,384 × 128-bit words, on its own
  bus), the control store map (2048 entries; it maps 10-bit opcodes to
  microcode start addresses), the control stack, the evaluation stack, the
  pager tables, NAM & NAMARG (524,288 words, each a 10-bit opcode and a
  30-bit argument), and the DRAM object store (24-bit address bus). Most
  internal paths are 40 bits wide.
- **Object numbers** are 40 bits and are allocated in sequence by a counter.
  The top bit separates an object number from raw binary. The next bit marks
  a **compact**, which holds a 5-bit type and 32 bits of data inside the
  number itself. That leaves 2^38 real object numbers.
- **The pager table** has 64K slots, hashed on the object number. A slot holds
  the header (number, size and type, where the type is itself an object
  number) and the DRAM address. Every access checks the type and the range.
  On a collision the old object is squeezed out to disk.
- **A page fault** stops the machine dead while the disk processor fetches
  the object. The machine then resumes with no instruction restart. That is
  why microcode can be recursive.
- **GC.** DRAM is split into two halves, and EndMem is checked by
  `grabspace`. GC traces from the stacks and the registers with disk fetches
  disabled. It tags the objects that are new or modified, copies only those
  to the other half, updates the pager and resumes. Its second level squeezes
  objects to disk. As a last resort a huge object takes the spare half.
- The machine ships empty. An instruction set is microcode written into the
  control store through HADES. The host has four 32-bit registers, two for
  reading and two for writing.
- HADES had 2 MB of 45 ns SRAM and 5 MB of 100 ns DRAM, and was a VME board
  for a Sun-3/4. BYTE's estimate for it is a CONS every 2 µs at 10 MHz.

## Scope

Two tiers, as on the real machine:

1. **Microcode.** It is the page's own and is labelled as such. Each
   microword is one line of fields (ALU / OBJ / STK / SEQ / IO, at most one
   of each) in the style of the BYTE listing: `push`, `get`, `js`, `rtf`,
   `next`. The fields execute in the order they are written, which is a
   simplification of the real parallel phases. It costs one cycle per word,
   plus Objekt stalls.
2. **The instruction set** is the page's Lingo-like bytecode set, written
   entirely in that microcode. It covers pushes, stores, jumps, `SEND` (with
   method lookup in microcode, up the superclass chain), `RET`, arithmetic
   fast paths that fall back to a send, primitives, and Lisp's
   `CONS`/`CAR`/`CDR`/`COPYTREE`. `COPYTREE` is one recursive instruction.
3. **Lingo-ish language.** A small Smalltalk-style language with classes,
   fields, methods, keyword/binary/unary sends, cascades, and inlined
   `ifTrue:` / `whileTrue:` / `to:do:` / `timesRepeat:` / `and:` / `or:`.
   There are no real closures. Capitalised undeclared names are persistent
   globals.
4. **Two tiers of code.** Kernel methods are frozen into NAM. User methods
   live in method objects in the object store and are fetched through Objekt.
   A switch puts user methods in NAM instead.
5. **Objekt** is modelled exactly as BYTE describes it. On top of that, the
   page adds a few rules of its own, all labelled:
   - The hash is `number mod slots`.
   - VRB is shown as status bits (BYTE draws VRB but never explains it).
   - Spilling an object spills the new objects it references (spill
     closure).
   - A modified object that already exists on disk is always a GC root.
6. **Persistence.** The disk survives "Power cycle". The host checkpoints,
   clears all SRAM and DRAM, reloads the microcode and NAM, and reruns the
   program's top-level method from the root object.

Out of scope: Klok, the real 128-bit microword layout, cycle-exact timing,
object-number compaction (BYTE's offline renumbering), the last-resort
spare-half allocation (the page traps instead), C, Prolog, and networks.

## Labelled reconstructions

These are the page's own: the microword syntax and its op set; the opcode
numbers; the compact type codes (0 nil, 1 int, 2 char, 3 bool, 4 symbol);
symbols as compacts that index a symbol table kept in the machine; the
class, method and root object layouts; the host protocol over the HADES
registers; disk timing (15 ms a fault); GC cost; and Numerik registers
widened to 40 bits so that an object number fits.

BYTE contradicts itself on the control store map: it has 2048 entries but
opcodes are 10 bits. The page uses 1024 entries and says why. BYTE Listing 1
as printed conses the copied CDR into the CAR, which mirrors the tree. The
page copies faithfully and keeps the listing's CDR-first order.

## Page

The page follows the Silicon Observatory template:

- A header with four facts: 1988, 40 bit, 10 MHz, and "not published" for
  the transistor count.
- A toolbar with Run, Step (by microword or by instruction), Back, Reset and
  Power cycle, a speed control, and the pager-slot, DRAM-half and code-in
  selectors.
- **Left column:** the demo library and the HADES terminal.
- **Centre:** a block diagram after BYTE Figure 1, with live unit highlights
  and readouts (cycles, time, instructions, faults, GCs, allocator), then the
  registers and the two stacks.
- **Right column:** the pager table, the object store map (both halves), the
  disk and the trace.
- **Below:** the control store listing with breakpoints, the macro code, a
  workbench for Lingo and for microcode, a quick reference, model and
  limitations, the instruction set table, and the verdict.

## Demos

The demos are ordered from trivial to showy. Each has a "what to watch" note
and an end-to-end test of that claim:

1. Hello, object world: `3 + 4` with compacts and a fast path.
2. Objects have numbers, not addresses: Point.
3. Hardware type and range checks: an Objekt trap.
4. Compacts cost no object numbers: an allocator delta.
5. Message sending in microcode: `fib`, with NAM against the object store.
6. Recursive microcode: COPYTREE.
7. Pager collisions: squeeze and fault.
8. Brutal garbage collection: clean objects are evicted and faulted back.
9. Persistence: Linn's factory, across power cycles.

## Testing

`test.mjs` runs the shared-code block in Node. It covers:

- word tagging;
- the microassembler, including field conflicts;
- Objekt: create, get and put, range and type traps, collisions, faults,
  GC invariants and spill closure;
- compiler errors;
- every demo, end to end.
