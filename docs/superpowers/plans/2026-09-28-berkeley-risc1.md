# Berkeley RISC I Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `berkeley-risc1/index.html`, an instruction-level RISC I
emulator centred on overlapped register windows, as Silicon Observatory No. 006.

**Architecture:** One self-contained HTML page. The engine lives in
`<script id="shared-code">`: configs, window map, memory and devices, CPU,
system handler source, assembler, disassembler and tests. The UI is a second
script. `test.mjs` runs `RISC1Tests.run()`. During development the parts are
built from scratch files and concatenated into `index.html`, as for
`mit-scheme-79`.

**Tech Stack:** Vanilla JS, inline SVG and canvas. Node for tests.

## Global Constraints

- Every reconstruction listed in the spec is labelled on the page.
- The default register file is Gold, with the architecture switchable.
- Programs use the `inN`/`locN`/`outN`/`ra` aliases so they run on both register files.

### Task 1: Window map and CPU core
- [ ] Write `CONFIGS` and `mapRegister`. Test the overlap, the globals and the coverage for both register files.
- [ ] Write `Memory` and the devices; `RISC1.step` for ALU, loads and stores, jumps with PC/NPC delay slots, CALL/RET window changes, traps and counters.
- [ ] Tests: flags, all 16 conditions, loads and stores, delay slots, PSW. Commit.

### Task 2: Assembler, disassembler, system handlers
- [ ] Write the assembler with aliases, `{c}` rules, directives, expressions and pseudo-instructions.
- [ ] Write the disassembler, with a round-trip test.
- [ ] Write `systemSource(config)`: reset, vectors, and the overflow, underflow and default interrupt handlers.
- [ ] Tests: deep recursion on both register files, stack drain, outermost return halts, terminal interrupt. Commit.

### Task 3: Demos and end-to-end tests
- [ ] Write the 8 demos, each with a test asserting its note. Commit.

### Task 4: UI
- [ ] Pipeline strip, data path, register ring, readouts, registers, PSW, window traffic, memory, trace, listing, workbench, terminal, register-file switch, ISA and verdict panels.
- [ ] Verify in the Browser pane: no console errors, every demo runs, and phone width has no horizontal scroll. Commit.

### Task 5: README, screenshot, gallery
- [ ] Take a 1600×1000 `screenshot1.jpg`, run `gallery.yaml` and `build_gallery.py`, update memory. Commit.
