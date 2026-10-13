# Colossus codebreaking simulator — design

Date: 2026-10-14. Directory: `colossus/` (single self-contained `index.html` + `test.mjs` + `screenshot1.jpg`).

## Intent

A simulation of Colossus, the 1943–44 Bletchley Park machine that helped break the Lorenz SZ40/42
("Tunny") teleprinter cipher, presented as both a **guided break** (the visitor carries out the chi-wheel
setting runs and gets German plaintext at the end) and a **machine to watch** (tape loop racing round the
bedstead, valves glowing, counters running, the typewriter typing scores). Owner choices: both modes;
the visitor operates the Colossus stages and the Testery's hand work is narrated; 2D illustrated look in
the spirit of the epson-mx80 project.

## Historical facts the design rests on

Sources: Wikipedia "Lorenz cipher", "Colossus computer", "Cryptanalysis of the Lorenz cipher";
codesandciphers.org.uk (Tony Sale) Colossus pages.

- Lorenz SZ42: 12 wheels. ψ 43, 47, 51, 53, 59; μ37 and μ61 (motor); χ 41, 31, 29, 26, 23. χ wheels step
  every character; μ61 steps every character and controls μ37, whose cams control whether the ψ wheels
  step. Ciphertext Z = P ⊕ χ ⊕ ψ′ (ψ′ = "extended psi", the ψ stream including repeats when they stall).
- Characters: 5-bit ITA2, written at Bletchley as • (dot, 0) and x (cross, 1). Operators' habits: 9 for
  space, doubled shift characters such as 55M88 — these biases make the statistics work.
- Δ (delta): XOR of each character with the next.
- 1+2 break-in (Tutte's double delta): for each of the 41 × 31 = 1271 starting pairs of χ1, χ2, count
  the dots of ΔZ1 ⊕ ΔZ2 ⊕ Δχ1 ⊕ Δχ2 (a putative ΔD1 ⊕ ΔD2). Wrong settings give ≈ 50 % dots, the right one
  ≈ 54–55 %. Starting points scoring below the "set total" (2.5 σ above random) are not printed.
  The run took about eight minutes on a Mk 1; then short runs (~2 minutes) set χ3, χ4, χ5. The de-chi'd
  text went to the Testery, where ψ and motor settings were found by hand.
- Colossus: Mk 1 delivered January 1944 (1,600 valves, first message 5 Feb 1944); Mk 2 from 1 June 1944
  (2,400 valves, five tests in parallel = effective 25,000 char/s). Paper-tape loop read photoelectrically
  at 5,000 characters per second (~40 ft/s), clock from the sprocket holes; "bedstead" tape transport
  holding two tapes; thyratron rings generate the wheel patterns; five counters; set-total switches;
  span counter; results typed on an electric typewriter (count held on relays and printed during the
  next pass). Designed by Tommy Flowers' team at Dollis Hill for Max Newman's section (the Newmanry).

## Architecture

```
puzzle (seeded): wheel patterns + start positions + invented German message (with translation)
   └─> Lorenz SZ42 encipher → ciphertext Z (≈ 4,000 characters)
         └─> Colossus runs (pure): for each candidate setting → count; set total; typed lines
               ├─> machine view (canvas/SVG): tape loop speed & position, counters, valves, lamps
               ├─> typewriter (DOM/canvas): typed result lines on a paper roll
               └─> sound (Web Audio): tape, motor, valve room, relays, typewriter
```

### Shared code (`<script id="shared-code">`, pure, Node-tested via `test.mjs`)

- **ITA2 / teleprinter**: 32-symbol table in Bletchley's shiftless notation (letters, 9 = space,
  3 = CR, 4 = LF, + / 5 = figure shift, - / 8 = letter shift, / = null); conversion between operator
  text and 5-bit values; dot/cross rendering; Δ of a stream.
- **Lorenz SZ42**: wheels with given sizes and pin patterns; stepping rules (χ always; μ61 always; μ37
  when μ61 is a cross; ψ when μ37 is a cross; no "limitations"); encipher/decipher; key stream export
  (χ stream, ψ′ stream). Patterns generated with roughly balanced crosses and dots and the χ/ψ rules
  of thumb (no long runs).
- **Message generator**: invented German military-style templates (unit names, places, times,
  supplies — no real persons or real orders), filled from a seeded RNG, written in teleprinter style
  (9 for space, doubled shifts, CR/LF habits), each with an English translation; padded to ≈ 4,000
  characters with further sentences.
- **Colossus core**:
  - `run12(Z, patterns)` → counts for all 1271 (χ1, χ2) starting pairs.
  - `shortRun(Z, patterns, known, wheel)` → counts for the 29/26/23 positions of χ3/χ4/χ5, using dots of
    ΔZi ⊕ ΔZk ⊕ Δχi ⊕ Δχk summed over i ∈ {1, 2} with χ1, χ2 at their found settings.
  - `setTotal(n, sigmas = 2.5)` and σ for a count over n characters; `typedLine(setting, count)`
    (e.g. `36 21 4927`).
  - `dechi(Z, patterns, settings)` → D; `testery(D, psi/motor patterns and settings)` → plaintext.
- **`ColossusTests.run()`**.

### Page

Machine view, typewriter, guided step panel, controls, sound engine, honesty panel. Debug handle
`window.__colossus` for tests and screenshots (instant runs, state, sound level).

## Look

A 2D front view of a Colossus bay, a readable composite in the style of the wartime photographs and
the TNMOC rebuild; muted 1940s palette (grey-green enamel racks, cream tape, warm orange filaments).

- **Bedstead** (left): tall pulley frame with the tape loop; at speed the tape blurs into streaks (holes
  and sprocket track smeared); at slow speed holes, start/stop marks and the reader lamp are visible.
  Second tape position idle.
- **Valve racks**: rows of glowing valves, brighter while counting, a few dimmer than their neighbours.
- **Panels**: χ pattern switches, K2 program jack-panel (plugged for the current run), set-total decade
  switches, five lamp-lit decade counters that run up during each pass, start/stop/span lamps.
- **Typewriter** (right): types each printed result line on a paper roll (aged paper look as in
  epson-mx80).
- **Close-up toggle**: magnified tape and photocell reader with the sprocket clock.
- Counter lamp displays and exact panel layout are illustrative (stated in the honesty panel).

## Sound (Web Audio, synthesized; off until the first Run; volume slider)

Tape hiss/whir with sprocket flutter and a splice tick each lap, spinning up and down with the motor;
motor hum and pulley rattle; valve-room mains hum, fans and a faint buzz that rises while counting;
relay clatter as counts latch at each pass; electric typewriter keys, carriage return and bell; motor
coast-down at the end of a run. Accelerated speeds make passes come faster, the tape itself keeps its
real-speed sound.

## Guided workflow

1. **Intercept**: generate a puzzle; show the intercepted ciphertext; "punch" it to tape and thread it
   on the bedstead.
2. **1+2 break-in**: patterns preset on the switches; K2 plugged for the double-delta test; set total
   suggested at 2.5 σ (editable); Start. Each pass tests one setting pair (Mk 1) or five (Mk 2 toggle);
   the typewriter types each line above the set total.
3. **Read the printout**: the visitor picks a typed line; its σ is shown.
4. **Short runs** for χ3, χ4, χ5 with χ1, χ2 held at the chosen setting.
5. **De-chi**: subtract the χ stream; show D.
6. **Testery (narrated)**: explain how ψ and motor settings were found by hand; apply them; show the
   German plaintext and its English translation.
7. A wrong pick yields garbage plaintext and the visitor can go back and choose another line.

**Demo mode** runs the whole break automatically. **Speeds**: real (1+2 run takes minutes for a
4,000-character tape, as historically), 10×, 100×, instant.

## Honesty panel

Wheel pin patterns are assumed known (historically found by separate monthly "wheel breaking"); the
Testery's hand methods are narrated, not simulated — the page applies the true ψ and motor settings;
no SZ42 "limitations"; the machine's appearance is an illustrative composite, not a measured drawing;
the short-run statistic is a simplified choice from the runs the Newmanry used; German messages are
invented; sounds are synthesized.

## Testing (`node colossus/test.mjs`)

- ITA2 round trip; Δ properties (ΔΔ relations, Δ of XOR = XOR of Δ).
- Lorenz: wheel sizes; χ step every character; ψ move only when μ37 is a cross; encipher ∘ decipher =
  identity; same settings reproduce the same key stream.
- Statistics: over generated messages the ΔD1 ⊕ ΔD2 dot rate is 0.53–0.57.
- Colossus: across 20 seeded puzzles the true (χ1, χ2) is the top 1+2 count in ≥ 19; short runs recover
  χ3, χ4, χ5 in ≥ 19 of 20; set total and σ formula; typed line format.
- End to end: de-chi + Testery with the found settings returns the original plaintext.

Visual/audio checks in the Browser pane / headless Chrome; `screenshot1.jpg` (1600×1000) and a gallery
entry at the end.

## Out of scope

Wheel breaking (finding pin patterns), the Testery's hand methods as an interactive puzzle, SZ42
limitations, Robinson machines, rectangling, a 3D model.
