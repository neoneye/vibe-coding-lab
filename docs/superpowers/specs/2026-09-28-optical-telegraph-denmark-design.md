# The Danish optical telegraph — relay simulator

Date: 2026-09-28
Directory: `optical-telegraph-denmark/`

## Goal

A 3D map of Denmark between 1801 and 1862 with the optical telegraph
stations standing on it. The visitor picks a year, a start station and a
destination, composes a message from a codebook, and watches it relay from
mast to mast. Clicking any station flies the camera into a cut-away of the
watch-house, to show the work inside: the watcher at the telescope, the
clerk with the codebook and the log, and the rope-men setting the flaps.

Panels explain:

- the data that is sent;
- that there was no light: the system ran on daylight alone;
- how often the system was used;
- which parts are documented and which are the page's own reconstruction.

## Sources

- **G. J. Holzmann, *The Use of Optical Telegraphs in England and
  Elsewhere*** (spinroot.com, §10.5–10.6):
  - Fisker's 1799 design: 18 rotating flaps, each about 2 × 0.75 m, turned
    from vertical to horizontal by strings, and always fully exposed;
  - 2¹⁸ = 262,144 combinations, of which the inventor claimed 42,221;
  - at least 22 s to set and read one sign;
  - 1801: a line of 24 stations along the east coast of Zealand;
  - 1808: a line of 26 stations from Helsingør across Funen to Kiel;
  - 1811: Schumacher's design, with five flaps in five columns, each in one
    of ten positions, giving a five-digit decimal number;
  - Norway: Ole Olsen's six-flap device, 1810–14.
- **S. E. Jørgensen's review** (Historie/Jyske Samlinger 2000, pp. 410–411)
  of S. C. Pedersen, *Ord i sigte. Optisk telegrafi i Danmark 1794–1862*,
  Post & Tele Museum 2000:
  - the 1797 signal commission's handbook of 1,299 signals;
  - 1801: the Engineer Corps lines from Spodsbjerg over Kronborg, Copenhagen
    and Fakse to Sneglehøj near Møns Klint, and from Copenhagen over Zealand,
    the Great Belt and Funen to Als, Schleswig and Gottorp (23 stations);
  - 1810: Skagen, Djursland, Helgenæs, Samsø, Røsnæs, Kalundborg;
  - 1814: everything dismantled except Korsør–Sprogø–Nyborg;
  - 1848: Nyborg–Bøjden–Fynshav (Als)–Sønderborg;
  - 1862: the end;
  - the uses: military, internal postal, and few private messages. The
    Belt telegraph mostly gave advance notice of the mail crossing.
- **Skalk, *Mastetelegrafen*:**
  - five yards and 18 flaps, "as tall as the Round Tower";
  - the code number is the sum of the numbers on the upright flaps;
  - about 10 km between stations;
  - "over 40,000 combinations";
  - codes 4509 ("Fjenden flygter"), 4513 and 4514.
- **Enigma (the Post & Tele Museum):**
  - 23 stations;
  - under 30 minutes for a short message in clear weather, but up to 3 days
    for 10 words over the Great Belt in poor sight;
  - the Belt line 1801–1862, with Schumacher's frame telegraph from 1811;
  - "Der kommer rejsende";
  - telegraphists converted each word to a number with a codebook.
- **Store norske leksikon:** the Norwegian line worked from half an hour
  before sunrise to half an hour after sunset. There is no source for night
  signalling in Denmark, and the page says so.
- **Wikipedia (1800 in Denmark; Nakkehoved Lighthouse):**
  - the Copenhagen–Schleswig line of 23 stations;
  - the warning of 26 March 1801 sent via Kronborg.

## Networks by year

A slider snaps to five periods.

| Period | Lines | Apparatus |
|---|---|---|
| 1801 | Coast line, 24 stations: Spodsbjerg, Nakkehoved, Kronborg, Høje Sandbjerg, Copenhagen, Fakse, Sneglehøj. Land line, 23 stations: Copenhagen, Korsør, Sprogø, Nyborg, Funen, Bøjden, Fynshav, Sønderborg, Gottorp. The two lines share Copenhagen. | Fisker |
| 1808–1810 | Helsingør to Kiel, 26 stations, via the land-line anchors. From 1810 also Skagen to Kalundborg over Djursland, Helgenæs, Samsø and Røsnæs. | Fisker |
| 1811–1814 | The same network. | Schumacher |
| 1815–1847, 1851–1862 | Korsør, Sprogø, Nyborg. | Schumacher |
| 1848–1850 | The Belt line plus Nyborg, Bøjden, Fynshav, Sønderborg. | Schumacher |

- **Real places.** Named stations sit at their real coordinates.
- **The page's own stations.** The page places the intermediate stations at
  equal spacing along hand-drawn waypoint paths on land, so that each line
  has its documented station count. It labels them "placed by this page",
  with the nearest town.
- **Undocumented joins.**
  - Kalundborg: where the 1810 line joined the main line is not stated. The
    page joins it along the west coast of Zealand to Korsør, and marks the
    join as its own.
  - Kiel: the route from Als to Kiel is the page's own.

## The two machines

### Fisker's mast

The documented part:

- five yards and 18 flaps;
- each flap turns between vertical (face-on, it counts) and horizontal
  (edge-on, it doesn't count);
- the value of a sign is the sum of the vertical flaps.

The page's reconstruction:

- The top yard has two flaps, worth 10,000 and 20,000.
- Each of the four yards below has four flaps, worth 1, 2, 4 and 8 times
  10ᵏ, reading downwards from the thousands to the units.
- So every number from 0 to 39,999 has exactly one pattern, and 4509 reads
  directly as 4-5-0-9.
- This matches "over 40,000". The page shows both the 262,144 and the
  42,221 figures.

### Schumacher's frame

- Five columns, each with a board that can be set to one of ten heights.
- This gives the numbers 00000 to 99999, as documented.

## The codebook

The page ships its own codebook, with Danish phrases and English glosses:

- **Service signals:** attention, end, repeat, understood, fog, stop until
  morning.
- **Station addresses.**
- **Post and travel:** including "Der kommer rejsende" and ice in the Belt.
- **Navy, army and the enemy:** the 45xx block, including the documented
  4509, 4513 and 4514.
- **Numbers and times.**
- **Spelling:** the letters A–Å as 9001–9029.

Each entry is marked either documented, with its source, or the page's own.

A message is sent as:

1. attention;
2. the destination's address;
3. the message codes;
4. end.

## The relay

The route is a breadth-first shortest path through the network graph. Each
sign moves as follows:

1. Station i shows sign k.
2. The watcher at station i+1 needs `t_read` of clear sight to read it and
   call it out, and the clerk logs it.
3. Station i+1 then spends `t_set` setting it on its own mast.
4. Station i may start sign k+1 only once it has seen station i+1 show sign
   k. The repeat is the acknowledgement: the convention of Chappe and
   Edelcrantz, adopted here.

Timings, which are the page's own choice:

- Fisker: `t_read` 15 s and `t_set` 20 s, above Holzmann's 22 s minimum.
- Schumacher: `t_read` 10 s and `t_set` 12 s.

In steady flow a sign therefore takes 2(`t_read` + `t_set`) per hop. The
destination repeats each sign too, so that the last hop is acknowledged.

Conditions that stop a hop:

- **Visibility.** A hop needs visibility of at least its length.
  - Weather: clear 40 km, haze 12 km, fog 2 km.
  - "Fog on the Belt" applies fog to the Korsør–Sprogø and Sprogø–Nyborg
    hops only.
  - A read that loses sight part-way starts again.
- **Working hours.** Stations work from 30 minutes before sunrise to 30
  minutes after sunset in local mean time. The sunrise uses the solar
  declination with −0.833° refraction and ignores the equation of time. At
  night the simulation jumps to the next morning.

The clock starts on a chosen date and time and runs at a selectable speed.

## The 3D world

- **The map:**
  - 1 unit = 1 km, equirectangular projection around 55.5° N;
  - Natural Earth 10 m land, clipped to Denmark, southern Sweden and
    Holstein, and embedded in the page as delta-encoded rings;
  - Sprogø added by hand if Natural Earth lacks it.
- **All stations** are drawn with instanced meshes: house, mast, yards,
  flaps or frame boards. They are exaggerated about 60× so they read from
  the map view.
- **Following the message.** Active sight lines glow, and the camera follows
  the current hop.
- **The focused station** swaps in a detailed model. Its interior:
  - the up-line and down-line telescopes at the windows;
  - the watcher;
  - the clerk's desk with the codebook and the log;
  - the rope rack, whose ropes run up through the roof to the flaps;
  - animated figures.
- **The cut-away.** Walls facing the camera hide automatically.
- **Captions.** A caption tells what each person is doing, for example
  *Watcher: "four — five — nought — nine"*.
- **Daylight.** Sun and sky follow the simulated clock. The night is dark,
  and the masts stand idle.

## Panels

- **Toolbar:** year, from and to (menus, or a click on a station), the
  message composer, weather, date and time, speed, and send.
- **Relay strip:** one dot per station on the route, coloured by state.
- **The data:**
  - each sign's code, meaning, digits and flap pattern, drawn as a small SVG;
  - its bits: log₂ 40,000 ≈ 15.3 for Fisker, log₂ 100,000 ≈ 16.6 for
    Schumacher;
  - the effective speed in signs and bits per minute;
  - a comparison with the 1854 electric telegraph.
- **The station log:** the focused station's time-stamped entries.
- **Written panels:**
  - how it worked;
  - what light;
  - how often it was used;
  - the people and the cost;
  - Norway;
  - documented and reconstructed, as the honesty panel;
  - sources.

## Tests (`test.mjs`)

- Fisker's encoding: every number from 0 to 39,999 round-trips, and 4509
  gives digits 4, 5, 0, 9.
- Schumacher's encoding: every number from 0 to 99,999 round-trips.
- The station counts per period: 24 and 23 in 1801, with 46 unique stations;
  26 plus the northern line in 1810; 3 on the Belt; and the 1848 line.
- Every station is on land, including Sprogø. Every hop is shorter than the
  horizon distance between two 30 m masts, and shorter than 25 km.
- The network is connected, and a route exists between every pair of
  stations.
- Relay timing in clear weather matches the formula.
- Fog on the Belt stalls the relay, and it resumes once the fog clears.
- A message that reaches sunset waits for the next morning.
- Sunrise and sunset on the solstices at 55.7° N are within 10 minutes of
  published values.
- Codebook codes are unique, and a message round-trips through encode and
  decode.
