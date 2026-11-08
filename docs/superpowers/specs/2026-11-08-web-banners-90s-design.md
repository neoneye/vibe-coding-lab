# 90s Web Banners — design (as built)

**Date:** 2026-11-08 (second batch the same day: see the end)
**Page:** `web-banners-90s/index.html`. One self-contained page with no libraries; nothing is loaded from the network.

## Intent

The owner wants a customizable late-1990s banner generator:
- a huge catalog of banner types;
- the user's own text;
- 256 colours, compression artifacts, GIF-like animation and hand-drawn pixel art.

The owner's references are in `~/Desktop/banner/`:
- 90s banner and 88×31 button collections, and a 1996 GeoCities page;
- `banner1.mov` / `banner1.jpg`: a wall of 33 banners whose old ads were replaced with AI insider jokes. The owner loves it.

**Purpose:** retro UI parts for a future music video about AI. The owner has made three AI videos already.
**Content:** October 2026 news, "Black October".

The owner was not asked further questions. The choices below are mine.

## As built

### Two views

**Banner wall**
- Shows all 72 Black October banners, the classic catalog (one of each type), or both.
- Settings: size, zoom, look and backdrop.
- Exports: save the wall as a PNG, or record the part on screen as 10 s of WebM.
- Click a banner to edit it.

**Make a banner (editor)**
- Start from a banner or a type.
- Size: any IAB size, or custom.
- Text fields and colour slots, with labels per type.
- Pixel art, font, text edges, and the look.
- Saves:
  - an animated GIF, with its size checked against the 12 KB cap of 1998 ad networks;
  - a PNG frame or a sprite sheet, at an integer scale;
  - WebM video of 1 to 4 loops.
- Share links (`#edit=id`, or `#b=` base64 of the changes).
- Each banner shows a "Behind the joke" note and its sources.

**How 90s banners worked:** sizes, 256 colours, dithering, GIF animation and size caps, JPEG, text, and the Black October sources.

### Pipeline (per frame)

1. The template draws the frame with Canvas 2D at the native size. Text goes through masks with outline, shadow, extrude and glow; text edges are smoothed (Photoshop) or crisp (MS Paint).
2. The frame is reduced to a palette with a 15-bit LUT using redmean distance. Palettes:
   - web-safe 216 plus the Windows system colours (228);
   - the Mac OS system palette (256);
   - adaptive median cut over 8 sampled frames, with at most 255 colours so GIF transparency has a slot;
   - Windows VGA 16;
   - greyscale 16.
3. Dither: Floyd–Steinberg (serpentine, with a strength setting), Bayer 8×8 (spread about one palette step), or none.
4. Optional JPEG round trip, N times. Each pass shifts the block grid like a re-cropped screenshot. Each pass does:
   - YCbCr, then 4:2:0 subsampling;
   - 8×8 DCT with the standard tables scaled by the IJG quality formula;
   - triangle upsampling back.
5. Display:
   - integer-scaled at device pixels (nearest neighbour);
   - on a phone, scaled down smoothly when 1× is too wide.

**Animation**
- Templates are pure functions of the frame number, so every loop is exact.
- Delays are in centiseconds, per frame, with holds.

**GIF encoder**
- GIF89a with a NETSCAPE2.0 loop block and LZW with code-table resets.
- Frame differencing: each frame stores only the changed rectangle, with unchanged pixels transparent. This cut a 4-frame flasher from 46 KB to 10 KB.

### Catalog

**49 types in 7 groups:**
- *Classic ads:* flasher, rotator, starburst, "as low as" price, winner, pager pill, corporate wipe.
- *Fake UI:* Windows error dialog with a cascade, search box, dropdown form, instant messenger, "You've got mail", download progress, terminal, webring.
- *Gadgets & counters:* LED countdown, hit counter, stock ticker, LED sign, pager LCD, poll, stock chart, radar, dial-up modem.
- *Text effects:* WordArt, chrome, fire, plasma, starfield, digital rain, neon, earthquake, bouncing logo.
- *Homepage furniture:* under construction, tiled wallpaper, 88×31 button, spinning globe, Halloween.
- *Print & paper:* strike-through correction, sticky notes, certificate, wanted poster, breaking-news crawl.
- *Games & gimmicks:* punch the bug, slot machine, scratch card, trading cards, video game, TV static.

**Pixel art and fonts:**
- 50 hand-drawn sprites, many with animation frames. The globe and the coin are drawn live.
- Hand-drawn fonts: 5×7 (all of ASCII plus ▲▼♥€✓ and more) and a 3×5 proportional one.
- The other fonts are the web-safe system ones.

**Layout:**
- Text fitting wraps a line over up to 3 lines when that makes it larger.
- Templates have wide, boxy and (where it matters) tall layouts.

### Black October content

There are 72 presets, including 6 micro buttons and a 234, a 125², a 300×100, a 728×90 and a 160×600. Each preset carries a `note` (the news item) and `src` keys.

Sources, gathered by web search on 2026-11-08:
- CNBC (Oct 23) and Axios (Oct 28);
- the Wiz-based list of nine platforms;
- the Peterson Technology Partners October roundup;
- Google's October post;
- Tech Startups (Oct 5–9) and explainx (Oct 31);
- the LiteLLM 1.107.0 report (single source, and the note says so);
- Fortune on the S-1;
- exchange4media.

Breach victims are given by date, not by name. The banners use no real logos, and the jokes are my own: none of the 33 banners in `banner1.mov` is copied.

### Tests

- `node web-banners-90s/test.mjs` runs 998 checks:
  - palettes (counts, no duplicates), the LUT, median cut;
  - each dither keeps pure colours pure, and diffusion preserves a mean grey;
  - JPEG: q100 is near lossless, q10 rings at edges, flat areas stay flat, odd sizes and offsets work;
  - GIF: round trips through an in-file decoder, including LZW resets, differenced frames with and without a free palette slot, and single frames;
  - every glyph of both fonts;
  - every sprite: rectangular, known colours, equal frames;
  - every preset: template, size, colours, sprite, note and sources.
- `?selftest` renders frames 0, mid and last of every preset and every type, the types also at 88×31, 125×125, 160×600 and 728×90. That is 317 renders. It checks for exceptions and blank frames, plus a GIF export round trip and two looks.
- `?sheet=october|classic|all&f=&fs=&zoom=&only=&range=&look=&cap=0` is a static contact sheet for headless screenshots. `__banner.{step, seek, pause, openEditor, selftest}` is the debug handle.

## Verified

- **Chrome (Browser pane):**
  - the self-test passes, with no console errors;
  - wall and editor, editing, type switching, custom size, share-link round trip;
  - GIF, PNG, sprite sheet, WebM, wall PNG and wall WebM downloads;
  - phone width (375 px): no horizontal scroll.
- **Headless Chrome:** contact sheets of all banners, frame strips, and the looks (JPEG re-post, deep fried, dial-up, VGA).
- **Headless Firefox:** the wall renders the same.
- **Not checked:** Safari, and the Firefox self-test, since the headless screenshot fires before the test finishes.

## Second batch (same day)

The owner asked for:
- more Black October banners: "hot fridges, where the temperature have been turned up";
- AI banners that are not about Black October:
  - dating a companion AI instead of a human;
  - RSI;
  - getting paid to share your screen for AI training;
  - AI bots that share your private life, and so your friends' lives, with big companies;
  - vulnerability checks everywhere as the new virus cleaning.

**What was added:**
- **Fridges:** six Black October banners.
  - The news: mid-October attacks on the smart temperature controllers of a French supermarket chain, then a second European wave on November 2 that set fridges and freezers to 50 °C.
  - Sources: Schneier and Dexerto.
- **AI life:** a new `group: 'ai'` with 22 banners.
  - They carry a note but need no news source.
  - The wall has an "AI life banners" view, and the editor's banner list has an "AI life" group.
  - I read RSI as recursive self-improvement.
- **New banner types:**
  - `dating`: a profile card with hearts. The cursor clicks ♥, then "It's a match".
  - `permissions`: a dialog that ticks every box itself, scrolls, and clicks "Allow all".
  - `scanner`: a 1998 antivirus scan with a path ticker, a progress bar, a findings counter that grows, and a flashing fix button.
- **New sprites:** fridge, thermometer, webcam and AI companion.
- **Totals:** 52 types and 100 presets. There are 1331 Node checks, and `?selftest` renders 360 combinations.

## Third batch (same day)

The owner asked for:
- two more Black October banners:
  - smart TVs that spy on their users and send screenshots home;
  - a Broadcom flaw that can be bypassed without any password;
- AI-life banners about mathematicians replaced by AI.

**What was added:**
- **Smart TVs:** five banners about automatic content recognition (ACR).
  - The news: an October 6 class action, and an October 22 study in which a Samsung TV kept sending viewing data after tracking was switched off.
  - The "screenshots" framing is popular but disputed (ACR sends fingerprints), so the notes say fingerprints or snapshots, and the counter's number is labelled illustrative.
  - New `tv` sprite.
- **WPSplinter:** five banners.
  - The news: disclosed on October 16 at Hexacon. A WPS memory bug in Broadcom's Wi-Fi SDK, shipped since 2010, gives root over the air before any password is checked. Broadcom calls the code obsolete and assigned no CVE.
- **Mathematicians:** six AI-life banners.
- **New banner type:** a `chalkboard` that writes itself in grainy chalk, wrapping on the whole sentence so the size never jumps, then adds a signature, with a tray for small print.
- **Totals:** 53 types and 116 banners (88 Black October, 28 AI life).

## Scope deltas (left for the owner)

- No sound (a modem screech would be easy).
- No local colour tables per frame.
- Banners scroll horizontally only (no vertical tickers).
- No drag-and-drop of the owner's own pixel art or images into a banner.
- No zip of all GIFs.
- The 12 KB figure is a typical 1998 ad-network cap, not one network's rule.
