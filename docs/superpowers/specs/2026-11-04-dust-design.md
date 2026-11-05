# Dust — design notes

Date: 2026-11-04. Directory: `dust/` (single `index.html` + `test.mjs` + `screenshot1.jpg`).

## What the owner asked for

A dust simulator "similar to saharan dust settling on windows, or abandoned places", where the user
can draw. References in `~/Desktop/dust/`: Saharan dust that came down with rain and dried into spots
and rings, a London skylight with drip runs and an orange sand bank at the bottom edge, finger
writing ("DUST", "Please wash me", a heart, a portrait by a retired teacher on a van window),
scrawled-on windows of abandoned buildings, a ghost-town window in Kolmanskop with old writing half
re-dusted.

The owner's words:
- "the initial canvas the user sees is a dusty window showing a hearth. When the user interacts with
  the canvas they draw in the dust."
- "Have a palette of drawing tools."
- "Have lots of parameters for what kind of dust, is the dust impacted by rain or gravity."
- "the dust may be sticky or leave a smudge."
- "The user can upload an image behind the glass. When the user haven't provided an image, some text
  is shown behind the glass with quotes from roman times."

## Intent

A window pane covered in dust that you draw in with your finger, the way people write on a dirty car
window. The fun is that it behaves like the real thing: a finger stroke is clean glass with dust
heaped along its edges and a smudge where the finger, now dusty, lifts off; sticky dust leaves a
film; rain gathers the dust into rings and runs; on a tilted pane dry dust slides and banks against
the frame. It is a faithful simulation with a drawing palette, not a game (no score).

## The picture

- **Opening state.** A dusty pane with a heart already drawn in it by finger (owner confirmed:
  "hearth" meant a heart in the dust). Behind the glass, out of focus a little, a wall with Roman
  quotes written on it, so the strokes reveal lines of text.
- **Behind the glass.** Default: Latin quotes with English below, set on a lit plaster or stone wall.
  My picks, all Roman and all public domain, translations my own:
  - Horace, *Odes* 4.7: "pulvis et umbra sumus" — we are dust and shadow.
  - Horace, *Odes* 1.11: "carpe diem, quam minimum credula postero".
  - Virgil, *Georgics* 3.284: "sed fugit interea, fugit inreparabile tempus".
  - Lucretius, *De rerum natura* 2.114–124: the motes of dust in a sunbeam (fitting: it is the
    first description of what we now call Brownian motion). A short Latin line plus a paraphrase.
  - Seneca, *Epistulae* 1.3: "omnia, Lucili, aliena sunt, tempus tantum nostrum est".
  - Ovid, *Metamorphoses* 15.234: "tempus edax rerum".
  Each reload or "new pane" picks one or two; the layout keeps them large enough to read through a
  stroke.
- **Upload.** The user can load an image (file picker and drag-and-drop) that replaces the wall; it
  is scaled to cover the pane. Image stays local; nothing is uploaded anywhere.
- **Light.** Front-lit (the sun on the outside of the pane: dust scatters and looks pale and
  bright, as on the Kolmanskop panes) versus back-lit (light coming through the glass: dust looks
  dark and the scene glows through the strokes). A slider between the two, plus sun direction for
  the soft highlight across the glass.

## The model (simplified, in realistic ranges)

State on a grid over the pane (GPU textures, roughly 2–3 mm cells for a pane about 1 m wide, so
about 1024 × 680; the exact size is the builder's call):

- **dust**: areal mass (optical depth) of loose dust per cell.
- **caked**: dust bound into a dried crust (from rain spots and sticky film); a finger does not wipe it
  as easily.
- **water**: liquid on the glass (drops, breath fog, wet streaks), which evaporates.
- A per-cell grain noise fixed at creation, so the coat is granular, not a smooth gradient.

Optics: transmittance `exp(-k · dust)` per colour channel with the dust's colour; scattered light
adds the dust colour in proportion to front lighting and `1 − transmittance`; caked dust scatters a
bit more and is grainier. Drawing is visible because the strokes change the dust, never by painting
colour.

Processes:
- **Settling.** Dust falls from the air at a rate set by "air dustiness"; a time control (clock with a
  speed, from minutes to years) lets old drawings fill in and fade, as on the abandoned windows.
- **Rain.** Drops land at random sizes; each picks up loose dust around it, carries it to its rim
  and leaves a ring or spot when it dries (coffee-ring effect). Drops above a size that depends on
  the tilt run downhill, merging, washing a cleaner channel and dropping dust where they stop. Rain
  can also bring dust down with it ("blood rain"/Saharan rain), which is what the reference spots are.
- **Gravity and tilt.** Pane tilt from horizontal (skylight, car rear window) to vertical (house
  window). On a steep pane, dry, non-sticky dust creeps downhill when it is thicker than it can hold
  (angle-of-repose style threshold) and banks against the bottom frame; sticky dust stays put. Runs
  follow gravity.
- **Stickiness.** Set by the dust kind and by humidity. Sticky dust smears instead of lifting clean:
  a finger leaves a thin film behind and carries more along the stroke.
- **Smudge.** A finger or palm carries a load of dust that it picked up; the load is redeposited
  along the stroke and dropped at the lift-off point. Dust picked up is pushed sideways into ridges
  along the stroke edges.

## Dust kinds (presets for the parameters)

Each sets colour, grain size, stickiness, how easily it slides, and how much it cakes when wet:
- Saharan dust (fine, ochre to orange, cakes into rings with rain) — the default.
- Household dust (grey, fluffy, with fibres, a little sticky).
- Desert sand (coarse, tan, slides easily, does not smudge much).
- Soot / city grime (black, very fine, greasy and sticky, smears).
- Pollen (yellow-green, fine, sticky).
- Volcanic ash (grey, gritty).

## Tools (palette)

- **Fingertip** — clean line, dust heaped along the edges, smudge at the end.
- **Fingernail** — thin scratch line.
- **Palm / side of hand** — broad smear that leaves a film.
- **Cloth wipe** — cleans a wide band, with swirl marks and some residue.
- **Soft brush** — thins dust gently without clean edges.
- **Breath** — fogs a patch of water that dries; sticky dust then clumps.
- **Blow** — pushes loose dust away from a point (not sticky dust).
- **Water drop / spray** — places drops that behave like rain.
- **Sprinkle** — adds dust of the current kind.
- Brush size and pressure sliders. Pointer pressure (pen) is used where available.

## Controls (parameters)

Dust kind; coat thickness; humidity / stickiness; air dustiness and the clock speed; rain on/off,
intensity, drop size, dusty rain; tilt; light (front ↔ back) and sun direction; background
(Roman quotes, next quote, upload image, focus/blur); actions: new pane (re-dust), wash (clean
pane), undo, save image.

## Builder's calls (mine, settled after review)

- **Engine on the CPU, picture on the GPU.** `DustCore` holds the grid in typed arrays and runs every
  process (strokes, settling, drops, creep, drying); the page uploads it to WebGL2 textures for
  lighting and the background. So `test.mjs` tests the real engine, not a copy. Full-grid
  processes run at a reduced rate if needed; strokes touch only their footprint.
- **Kinds mix.** Each cell keeps the mass-weighted mix of its dust's properties (colour,
  stickiness, slide, caking), so sprinkling soot on Saharan dust gives a darker, stickier patch and
  switching kind never repaints the pane. "New pane" lays a fresh coat of the current kind.
- **Undo restores the pane** to before the last stroke (a capped stack of full snapshots), losing
  any rain or settling since then.
- **Defaults at load:** the clock runs slowly (settling takes many minutes of real time to fill a
  stroke), rain is off, so the opening drawing is safe until the user turns things on. The "Watch"
  buttons run a Saharan rain shower and "abandoned for years".

## Repo conventions

Self-contained `index.html`, engine in `<script id="shared-code">` with `DustCore` tests run by
`test.mjs`; selftest in Chrome, Firefox, Safari; `screenshot1.jpg` at 1600×1000; gallery and README
entry; exported image renders the pane only, centred, without UI.

## Left out

- Real aerosol physics (particle size distributions, electrostatics); real fluid simulation of
  drops (drops are particles with simple rules); 3D view of the window frame.

## As built (2026-11-05)

- **Behind the glass**: a dim Pompeian red wall with cream painted capitals (interpuncts, V for U)
  and an English line under each quote; pale plaster gave too little contrast with pale dust, so
  strokes did not read. Two quotes per wall, "Next Roman quote" cycles the pairs.
- **Default pane**: car rear window, 55° tilt, rear-window heater lines, black rubber frame; house
  window (upright, painted wood) and skylight (15°, aluminium) are the other panes.
- **Opening**: 6 g/m² of dry Saharan dust with the spots of an earlier dusty shower, and a heart
  drawn with the real fingertip tool along a heart curve.
- **Two clocks**: settling and drying of drops and wet trails run on the clock (real time up to one
  month per second); drops running, dust sliding and breath fog drying run at their real pace.
- **Drops**: V ≈ 0.7 r³; they start to run above r = 1.8 mm / √sin(tilt), slow down as they shed
  volume (0.03 r mm³ per mm), meander, are drawn to wet tracks ahead, swallow drops they meet, and
  drain at the frame leaving a mud line. Drying leaves 45–85% of the load in the rim (finer dust
  rings more).
- **Watch**: "A Saharan rain shower" (dusty rain, then clean rain, then drying) and "Left alone for
  a year" (settling at one month per second with two short showers).

## Change (2026-11-05): slogans instead of Roman quotes

The owner asked to replace the Roman quotes with the Party slogans from George Orwell's *1984*
("WAR IS PEACE", "FREEDOM IS SLAVERY", "IGNORANCE IS STRENGTH", "BIG BROTHER IS WATCHING YOU") and
the hidden messages from the film *They Live* (OBEY, CONSUME, STAY ASLEEP, NO THOUGHT, MARRY AND
REPRODUCE, WATCH TV, CONFORM, SUBMIT, WORK 8 HOURS, SLEEP 8 HOURS, PLAY 8 HOURS). My calls: two walls,
"Other slogans" switches between them. 1984: a dim concrete wall, the three slogans in tall
condensed capitals, Big Brother in red beneath a rule. They Live: a dim grey wall, one stark white
bold word per panel, all at one size. Both walls stay dark so the strokes read against pale dust;
the dark skirting band along the bottom is kept. The Roman quotes above are superseded.
