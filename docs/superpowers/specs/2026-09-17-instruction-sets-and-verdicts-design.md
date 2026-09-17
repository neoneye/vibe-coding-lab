# Instruction sets, advances and mistakes

Date: 2026-09-17
Touches: `intel-4004/`, `mos-6510/`, `zilog-z80a/`, `acorn-arm1/`

## Goal

The four Silicon Observatory pages show *how* each processor works. None of
them says what its instruction set actually contains, what it did better than
whatever came before it, or where it was badly designed. This adds all three to
every page.

## Placement

Two new full-width sections per page, after the three-column layout grid and
before the footer, so they span the whole width rather than being squeezed into
a 360-pixel column. Numbered to follow each page's existing panels: `07` and
`08` on `mos-6510`, `zilog-z80a` and `acorn-arm1`; `06` and `07` on
`intel-4004`, which numbers its panels differently.

## Section one: the instruction set

Every mnemonic the emulator implements, grouped by family, each with a line on
what it does and a note wherever the flags or the timing surprise you. Rendered
as a `<dl>` per family in an auto-filling grid, so seventy Z80 mnemonics stay
compact and the twenty-three of the ARM1 do not look lost.

Families differ per chip, but the shape is the same: data movement, arithmetic,
logic and shifts, control flow, stack, I/O, and whatever that chip adds.
Undocumented instructions get their own group rather than being mixed in with
the official ones, and on the 6510 the unstable ones get a group of their own
again, because the distinction matters.

## Section two: what it got right, what it got wrong

Two columns, five to seven items each, every item a short title and two or
three sentences.

The comparison is against something different for each chip, and the text says
which:

- **4004** — there was no predecessor, so the comparison is against the
  alternative: a board of TTL designed afresh for every product.
- **6510** — against the 8080 and the 6800, on price and on work per clock.
- **Z80A** — against the 8080 it is binary compatible with, on what it adds and
  on what it removes from the board around it.
- **ARM1** — against the 68000 and the 80286, on what 32 bits cost in
  transistors.

The second column is the honest half and is not softened: the 4004's four-deep
hardware call stack and page-bound branches, the 6510's single accumulator and
256-byte stack fixed at page one, the Z80's prefix scheme costing four T-states
on every index access, the ARM1 putting the program counter and the status
register in one register and capping itself at 64 MB.

## Keeping it honest

The set of documented mnemonics must equal the set the engine actually
implements. Rather than trusting that, each page's test suite gains a check
that compares the two sets in both directions:

- `mos-6510` — from `OPCODE_TABLE`.
- `zilog-z80a` — by decoding the whole opcode space: the 256 unprefixed
  opcodes, then `CB`, `ED`, `DD` and `DDCB`.
- `intel-4004` — by decoding all 256 opcodes, excluding the `.BYTE` placeholder
  the disassembler emits for an undefined one.
- `acorn-arm1` — from `MNEMONIC_BASES`, the list the assembler accepts, since a
  32-bit opcode space cannot be enumerated.

A mnemonic documented but not implemented fails the test, and so does one
implemented but not documented. The prose can then be edited without the
reference quietly going stale.

## Data

Three new constants in each page's shared-code block, so the test can reach
them:

```js
const INSTRUCTION_GROUPS = [{ name, entries: [[mnemonic, description], ...] }];
const ADVANCES = [{ title, text }];
const MISTAKES = [{ title, text }];
```

The UI script renders them. No emulation changes.

## Non-goals

Not a full opcode reference: no bit patterns, byte counts or cycle tables. The
Z80 alone has over a thousand opcodes once the prefixes are counted, and the
disassembler already shows the encoding of whatever is in memory. This is the
mnemonic-level reference that someone with the workbench open actually wants.
