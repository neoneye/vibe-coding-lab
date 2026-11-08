# Retro GUIs: Project ORCHID — design (as built)

**Date:** 2026-11-08
**Page:** `retro-guis/index.html`. One self-contained page with no libraries; nothing is loaded from the network.

## Intent

The owner asked for a standalone page that simulates retro GUIs: BeOS, OS/2, Workbench 3.1 ("3.11"), MUI on the Amiga, Windows 95 and X11. They liked how the film *The Net* (1995) showed cryptic classified content on early-90s web and hardware, and asked whether something similar could cross over with the retro GUIs.

The owner was not asked further questions. The choices below are mine. The story borrows the genre and nothing from the film: no names, props or plot.

## As built

### Six machines, one network

Everything is set in October 1996, so all six systems can exist at once. Each desktop is a separate machine with its own file system:

| Desktop | Host | Place |
|---|---|---|
| Windows 95 | DESK-114 | Your contractor desk at Halyard Systems |
| OS/2 Warp 4 | TERM-07 | Northline Air gate terminal |
| X11 + twm | orion | A university SPARCstation |
| BeOS | bebox-3 | A media-lab BeBox |
| Workbench 3.1 | KESTREL | A BBS sysop's A1200 |
| Workbench + MUI | HERON | A demo coder's A4000 |

You can switch machine from the page bar, from Network Neighborhood / Connections / Network, or with `telnet <host>` in any shell.

### What each desktop has

**Windows 95**
- Window chrome with the 2-pixel bevels, navy active title and the _ □ × glyphs.
- A taskbar with task buttons and a clock.
- A Start menu with its vertical stripe.
- Desktop icons, and a logon dialog that asks for your name.
- "It's now safe to turn off your computer."

**OS/2 Warp 4**
- Thick sizing frames, a centred title, a system menu, and hide/max/close buttons.
- WarpCenter with a CPU meter and a window list.
- The Shredder.
- The shutdown dialog.

**X11 + twm**
- The root weave (the 4×4 X bitmap).
- twm title bars with iconify and resize buttons and the focus hilite.
- Iconified windows become icons on the root.
- A twm root menu when you click the background.
- xterm, xclock, xeyes (they follow the pointer), xload, xbiff (the flag goes up when mail arrives) and Mosaic.
- An xdm login on boot.

**BeOS**
- Yellow tabs with close and zoom boxes.
- A Deskbar with a menu, tray and running apps.
- Pulse with two CPU bars (BeBox-style).
- A boot screen whose icons light up.

**Workbench 3.1**
- The 4-colour palette.
- A screen title bar with memory counts.
- Menus that appear in the title bar while the right mouse button is held, and are picked on release (clicking the title bar also opens them).
- Close, zoom, depth and size gadgets.
- Disk icons along the right.

**MUI**
- MagicWB colours and a patterned backdrop.
- MUI's extra iconify and prefs title gadgets.
- Patterned window backgrounds.
- Double-bevel buttons and titled group frames.
- Cycle gadgets, sliders, a checkmark and a gauge.
- A MUI Preferences window.

**Shared parts:**
- A window manager: drag, resize, focus, z-order, minimise, maximise/zoom, depth, close.
- Menus and dialogs.
- A 16×16 pixel icon set, recoloured to each system's palette: Workbench 4 colours, MagicWB 8, X11 1-bit, Windows VGA 16.

**Fonts.** The Amiga's Topaz-like font and X11's `fixed` are drawn as bitmaps. The page compiles them into real TrueType files at load: glyf/loca/cmap 4/hmtx/name/OS/2/post, with checksums. It registers them with `FontFace`, and Chrome and Firefox accept them. The other systems use similar system fonts with font smoothing off.

**Display:**
- An integer zoom (auto 1× or 2×).
- An optional CRT overlay with scanlines and a vignette.
- Boot screens, which can be switched off.
- `?bare` hides the page bar, for video capture.

### Programs

- **Folders:** icon views of each machine's file system.
- **Text viewer:** Notepad, System Editor, xmore, StyledEdit or MultiView, depending on the machine.
- **Shells:** DOS, OS/2 CMD, csh, bash and AmigaDOS, each with its own prompt and error messages. Commands include `dir`, `type`, `cd`, `ver`, `ls -a`, `cat`, `finger`, `who`, `last`, `ps`, `DIR`, `LIST`, `TYPE`, `INFO`, `AVAIL`, `VERSION`, and `telnet` on all of them.
- **Mail:** Windows 95 only.
- **Browser:** WebScout, Web Explorer, Mosaic, NetSurfer or AWeb chrome around one set of HTML-2.0 pages, with under-construction signs, hit counters and a LANTERN login.
- **Satellite photo:** procedural; dithered to 1 bit on X11.
- **Number station:** 7.890 MHz. WebAudio morse plus noise, and a scrolling spectrogram with a word painted into its high band.
- **Northline PNR viewer:** a green screen.
- **Personnel records** database.
- **ORCHID Decoder:** a MUI app.
- **Dossier**, typed out.
- **WARDEN trace:** a world map with hops and a countdown.
- **Clocks** and **About** dialogs.

### The story

October 1996. Your colleague M. found ORCHID: a policy inside Halyard's WARDEN security product that lets the LANTERN desk rewrite people across banks, airlines and registries. She mailed you an Amiga disk and vanished. The disk holds `dossier.enc` and a decoder that needs MUI.

The passphrase is split across three machines:
- `nightjar`: in mrook's `.plan` on orion, via `finger mrook`.
- `tidewater`: in a seat remark on the Northline manifest, where seat 17A is booked in *your* name.
- `osprey`: in the number station's morse, and written into its spectrogram.

The BBS message on KESTREL gives the order. The Win95 inbox and recycle bin start the trail.

Decoding on HERON opens the dossier and the personnel database (your record goes to PENDING), then starts a 45-second trace. You can pull the plug (NO CARRIER, then a Guru Meditation on the Amiga) or send the dossier to the press. Either way your record ends REASSIGNED and the Win95 inbox gets a bounce.

Your name is used throughout: manifest, logs, staff page, dossier. It is stored only in the browser, as are your name and story stage.

### Tests

`node retro-guis/test.mjs` runs 90 checks:
- font cells;
- TTF: table directory sorted and aligned, whole-file checksum magic, glyph count, unitsPerEm, contours;
- icons and their palette mappings;
- every host has a file system;
- each shell flavour: paths, errors, hidden files, volumes, `telnet`, the decoder refusing to run without MUI;
- the story: each word findable, the key case- and space-insensitive but order-sensitive, a wrong key giving same-shape garbage, stage 3 reassigning the player, the bounce mail, the web pages.

`?selftest` checks that the fonts load, then for every machine:
- boots it and opens 16 programs, checking each is laid out and on screen;
- runs a shell command;
- checks the desktop icons and title bars.

Then it decodes on HERON and checks that the dossier and the trace appear.

`?open=app,app` opens programs at start-up, for screenshots.

## Verified

- **Chrome (Browser pane and headless):**
  - the self-test passes, with no console errors;
  - all six desktops, with programs open;
  - Amiga right-mouse menus;
  - the ending through to the Guru Meditation;
  - boot screens for X11 and BeOS.
- **Headless Firefox:** the generated TrueType fonts load and render the same as in Chrome.
- **Not checked:** Safari; touch devices; the WebAudio tone was not listened to.

## Scope deltas (left for the owner)

- No real fonts, artwork or logos of the original systems; each look is redrawn from memory.
- No window snapping, keyboard navigation of menus, or drag and drop between folders.
- No sound effects beyond the number station: no startup chimes or disk clicks.
- The story has two endings and no save slots.
