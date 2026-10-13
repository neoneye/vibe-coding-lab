# Epson MX-80 dot matrix printer simulator — design

Date: 2026-10-13. Directory: `epson-mx80/` (single self-contained `index.html` + `test.mjs` + `screenshot1.jpg`).

## Intent

A nostalgic, faithful-feeling simulation of the Epson MX-80 (Oct 1980, US$650, 9-pin head, 80 cps,
bidirectional, tractor feed). The owner's priorities, in order: **the look of the printed output**
(imperfect aged paper, imperfect worn-ribbon ink — see the reference photos: the "Greetings from the
versatile MX-80" test page, the "Delivery" close-up where every pin strike is a ragged blot, the
Schmelyun Tribune newspaper on continuous paper, green-bar paper), **the sound**, and **the yellowed
beige plastic** of the machine.

Visitors can (1) type and watch it print live, (2) print ready-made documents, (3) feed raw ESC/P.

## Architecture (approach A)

One engine emits a stream of timed events; three listeners consume it, so look and sound stay in sync.

```
input (typed text | gallery doc | ESC/P box)
   └─> ESC/P interpreter ──> line jobs (per-column 9-bit pin masks, mode flags)
          └─> head scheduler ──> events: fire(col, pins, t), move(x0→x1, t0→t1), turn, feed(n/216"), formfeed, bell
                 ├─> paper renderer (canvas)   — stamps ink dots
                 ├─> printer view (SVG)        — carriage x, paper scroll, LEDs
                 └─> sound engine (Web Audio)  — pin clicks, motor, thunk, ratchet
```

### Shared code (`<script id="shared-code">`, pure, Node-tested via `test.mjs`)

- **Font** — original 9-pin glyph set "in the MX-80 style" for ASCII 32–126 (not Epson's character ROM).
  Each glyph is 6 cells wide × 9 pins on a half-dot horizontal grid (12 half-columns). Rule enforced by
  tests: a pin never fires in two adjacent half-columns (real heads cannot re-fire that fast).
  Descenders use the lower pins; underline uses pin 9.
- **ESC/P interpreter** — bytes → line jobs. Supported (MX-80 + Graftrax 80 era):
  `CR LF FF BEL BS HT`, `SO`/`DC4` (one-line double width), `ESC W n` (double width),
  `SI`/`DC2` (condensed, 132 col), `ESC E`/`ESC F` (emphasized: each dot re-struck a half-dot right),
  `ESC G`/`ESC H` (double-strike: second pass 1/216" lower), `ESC 4`/`ESC 5` (italic, slanted glyphs),
  `ESC - n` (underline), `ESC 0`/`ESC 1`/`ESC 2`/`ESC A n`/`ESC 3 n` (line spacing 1/8", 7/72", 1/6",
  n/72", n/216"), `ESC K n1 n2` (480-dot single-density graphics), `ESC L n1 n2` (960-dot double
  density), `ESC @` (reset). Anything else → a visible marked "?" glyph plus a warning in the ESC/P log;
  never guessed.
- **Head scheduler** — line job → timed events at ≈80 cps in normal pitch (≈1 s for 80 characters),
  bidirectional (alternate passes reverse), with accel/decel ramps at turnarounds, a turnaround pause,
  and double passes for double-strike. Speeds: real, 2×, 8×, instant.
- **`MX80Tests.run()`** — glyph rule, interpreter output, scheduler timing, gallery documents parse.

### Page (not unit-tested; verified in browser/headless)

- **Paper renderer** — tall canvas at device-pixel backing (HiDPI pattern), drawn incrementally per
  event, auto-follows the newest line, scrollable back through everything printed.
- **Printer view** — SVG front/top view.
- **Sound engine** — Web Audio, synthesized.
- **UI** — side panel with three tabs and settings.

## Look

**Paper:** continuous tractor-feed with sprocket holes on both edges, perforation line and tear line
every 11". Types: green-bar, blue-bar, plain white, recycled grey. **Aging** slider 0–1: yellow-beige
shift, low-frequency blotchy discoloration (value noise), a few foxing spots, darker yellowed edges,
faint fibre grain. Paper texture is pre-rendered per page sheet and re-tinted when settings change.

**Ink:** every pin strike is one stamp — soft ragged disc (per-dot jittered edge), tiny position and
size jitter, darkness from a ribbon model: overall wear (fresh black → pale grey), slow across-page
ribbon banding (uneven inking), occasional weak pins, multiply-style compositing so overlaps
(emphasized/double-strike) darken. Sliders: ribbon wear.

**Printer (SVG):** boxy MX-80 silhouette, front/top three-quarter view. Beige plastic with a
**plastic yellowing** slider. Dark smoked cover, "EPSON" and "MX-80" labels, POWER/READY indicators,
three working front buttons with LEDs: ON LINE, FORM FEED, LINE FEED. Head + ribbon cartridge ride the
rail at the scheduler's carriage x; paper rises from behind the platen and scrolls up on feeds.

## Sound (Web Audio, all synthesized, driven by the same events)

- **Pin strikes:** a few-ms bright resonant noise click per fired column, louder with more pins;
  at ~80 cps these fuse into the classic rasping screech; bold/double-strike sound denser,
  graphics harsher.
- **Carriage motor:** low rough hum while moving, pitch following head speed (ramps at ends).
- **Turnaround thunk** at each reversal.
- **Line feed:** ratcheting "tk-tk" per platen step; form feed = a long whirring run.
- **Idle hum** while powered; **BEL** beep.
- Sound **off by default** (owner preference from stair-dismount); Print/typing turns it on.
  Volume slider. At 2×/8× events speed up; "instant" prints silently except one closing feed.

## Content and interaction

1. **Type** — textarea wired to the printer; prints a line on Enter or after a short typing pause.
2. **Gallery** — ESC/P documents, trivial → showy, each with a one-line "what to watch" note:
   character-set self-test (sliding alphabet rows); "Greetings from the versatile MX-80" test page;
   font sampler (normal, emphasized, double-strike, double-width, condensed, italic, underline);
   BASIC listing; invoice/spreadsheet table; daily newspaper sheet ("Schmelyun Tribune" style, with
   original placeholder content — no real news); ASCII art; sideways banner via bit-image graphics.
3. **ESC/P** — editable raw byte stream with escape notation (`\e`, `\x0e`, `\n`), a collapsible
   command reference, and a log of unsupported codes.

Controls: Print / Pause / Cancel, ON LINE · FORM FEED · LINE FEED, speed, paper type, paper aging,
ribbon wear, plastic yellowing, sound + volume, Clear (tear off), Save PNG of the printout.

**Honesty panel** ("About this simulation"): font is original MX-80-style, not Epson's ROM; supported
command list; timings approximate (~80 cps); sounds synthesized, not recorded.

## Testing

`node epson-mx80/test.mjs` runs `MX80Tests.run()`:
- no glyph fires a pin in adjacent half-columns; all 95 printable ASCII glyphs exist;
- text → expected pin masks for a known glyph; double width doubles column count; condensed fits
  132 characters in the 8" line; emphasized adds half-dot re-strikes; underline sets pin 9;
- `ESC K` graphics bytes map MSB → top pin; `ESC L` doubles horizontal density;
- line-spacing commands produce the right feed in 1/216" units;
- scheduler: 80 characters of normal text take ≈1.0 s (±15%); passes alternate direction;
  double-strike makes two passes;
- every gallery document parses with zero unsupported codes.

Visual and audio checks in the Browser pane / headless Chrome (audio via AnalyserNode RMS).
Finish with `screenshot1.jpg` (1600×1000) and a gallery entry.

## Out of scope

Real Epson character ROM, DIP-switch international sets, TRS-80 block graphics, Graftrax Plus
features (superscript/subscript), friction-feed single sheets, a 3D model.
