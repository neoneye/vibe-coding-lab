# 2D Floor Plan Generator

Date: 2026-09-18
Directory: `2d-floor-plan-generator/`

A standalone page that draws architectural floor plans of absurd buildings:
evil villain mansions, supermax prisons, datacenters, power plants, malls,
bunkers, police stations, the White House, fire stations, motels, robot
factories, office buildings, cartel compounds, launch control centers, R&D
facilities, hospitals, clothing factories, royal palaces, junior cadet
training bases, casinos, schools, zoos, fertility clinics, escape room
centers, night clubs, museums, chemical plants, recording studios, farms,
e-waste plants, spas, sports centers, bicycle repair shops, abattoirs,
anatomy institutes, parliaments, sushi restaurants, airport baggage halls,
cryosleep labs, nuclear waste repositories, call centers, courthouses and
dental clinics. Nothing is drawn or dragged by hand. Every plan is a pure function of
a seed and a large panel of parameters, so the same inputs always produce the
same drawing. The running joke is the restroom: every plan has toilets with far
too many pissoirs, and a slider can turn that into whole pissoir halls.

Look: white background, black ink, straight lines only, the drafting style of
the reference images (thick poché walls, door swings as quarter arcs, windows as
double lines in the wall, room name over "W × D" dimension text, dimension
strings with tick marks outside the shell, a title block).

## Non-goals

No drawing tools, no drag-and-drop, no 3D, no colour beyond a single grey for
hatching and dimension lines, no server, no external libraries.

## Architecture

One `index.html`, no dependencies. Three layers, in the order they run:

1. **Engine** (`<script id="shared-code">`): PRNG, footprint builder, corridor
   and room subdivision, room-type assignment, furniture placement, door and
   window placement, label generation. Produces a plain-object *plan model*.
   No DOM access, so `test.mjs` can run it in Node.
2. **Renderer** (also in `shared-code`): plan model → SVG markup string.
   Pure string building, so tests can check the output.
3. **UI** (page script): builds the control panel from a declarative
   parameter table, keeps the parameters in the URL hash (and best-effort
   localStorage), regenerates on every input, offers Download SVG / PNG.

### Plan model

```
{
  units: "m", width, depth,          // footprint bounding box in metres
  cell,                              // grid cell in metres
  footprint: [poly],                 // outer polygon, axis-aligned
  holes: [poly],                     // courtyards
  rooms: [{ id, x, y, w, h, kind, label, sublabel, number, furniture: [...] }],
  corridors: [{ x, y, w, h, deadEnd }],
  walls: [{ x1,y1,x2,y2, thickness, exterior }],
  doors: [{ x, y, w, wallDir, swing, kind }],    // kind: single|double|sliding|blast|secret|cell
  windows: [{ x, y, w, wallDir }],
  furniture: [{ kind, x, y, w, h, rot, n }],    // n = repeat count (pissoirs, racks, cells)
  annotations: { title, subtitle, north, scaleBar, dims: [...] , notes: [...] }
}
```

Coordinates are metres with origin at the shell's top-left. The renderer
multiplies by the scale parameter.

### Generation pipeline

1. **Seed** → sfc32 PRNG. Every random decision draws from it in a fixed
   order, so seed + params is reproducible.
2. **Footprint**: rectangle, L, U, T or courtyard, sized by width/depth, cut on
   the grid. Shell wall polygon.
3. **Corridors**: a spine along the long axis, optionally a loop or a
   cross-grid, width from a slider. Dead-end stubs are added with probability
   from the backrooms sliders.
4. **Room subdivision**: the leftover area is split into wings (rectangles
   touching a corridor). Each wing is recursively split perpendicular to its
   long side until it fits between min and max room area, with an aspect
   tolerance parameter. A "split bias" slider skews toward many small rooms or
   a few large halls.
5. **Room-type assignment**: each building type has a palette of room kinds
   with weights, size preferences (hall / medium / closet) and a mandatory
   list (a datacenter always has a server hall, a prison always has cells).
   Mandatory kinds are assigned to the best-fitting rooms first, the rest by
   weighted draw. Restroom frequency is a slider.
6. **Doors**: every room gets at least one door onto a corridor or a
   neighbouring room, chosen so the door graph is connected (BFS check;
   extra doors from a density slider). Backrooms "doorless" slider removes
   doors afterwards, deliberately breaking connectivity.
7. **Windows**: along exterior walls at a spacing slider, skipped for room
   kinds that should not have them (server hall, vault, cell block). Bunkers
   and datacenters default to few windows.
8. **Furniture**: per room kind, a placement routine draws symbols from a
   small primitive vocabulary (rect, double rect, circle, arc, line array):
   beds, desks, racks in rows, turbines, cell rows, tables with chairs,
   shark tank, escalators. Restrooms get a pissoir wall: N urinals along the
   longest free wall at a spacing slider, stalls on the opposite wall, sinks
   in the remainder. Pissoir mania scales N and converts a share of ordinary
   rooms into "PISSOIR HALL" rooms lined on every wall.
9. **Labels**: room name (uppercase), "W × D" line, optional area and room
   number. A humour slider mixes in sublabels such as "(THE REAL MASTER
   BEDROOM)". Backrooms "label glitch" replaces some labels with "HALLWAY",
   repeated numbers, or nothing.
10. **Annotations**: overall dimension strings on top and right, a north
    arrow, scale bar, title block with sheet name, building type, seed,
    gross area and a "FOR ___ ONLY" subtitle.

### Building extras (added 2026-09-19)

- **One-way mirrors**: rooms of kind interrogation or lineup turn a small
  neighbour into an observation room and get a mirror opening in the shared
  wall, drawn as an interior window with glass ticks on the observation side
  and a tiny "ONE-WAY MIRROR" label. Count capped by the mirrors slider.
- **Vehicle bay doors**: garages, patrol garages, apparatus bays, loading
  docks and shipping rooms get 4 m sectional doors on their exterior walls,
  drawn as a heavy dashed line with dashed tracks into the room.
- Motel guest rooms are numbered from the storey (ROOM 101, 102, …). The
  Oval Office draws an elliptical inner wall inside its rectangle.

### Service passages and ventilation shafts (added 2026-09-19)

Narrow walkways for engineers, carved on the grid before the rooms are
subdivided and kept as their own region type:

- **Service passages** select: none / perimeter (a strip inside the back and
  side exterior walls, leaving the front face open for the entry and windows)
  / full ring / interstitial (two strips running parallel to the spine behind
  the room rows) / ring + interstitial. Width from a slider (0.5–2 m).
- Each connected passage is a node in the door graph, so the connectivity
  pass gives it at least one 0.8 m access hatch. An "extra access hatches"
  slider adds more hatches into the rooms and corridors it runs behind.
  Hatches swing out of the passage.
- **Piping and wires**: parallel runs along each passage rectangle, solid
  heavy lines for pipes with valve circles every 4 m, dashed thin lines for
  cable trays; count from a slider. A small "SERVICE PASSAGE" label sits in
  passages long enough to hold it.
- **Ventilation shafts**: square voids (1–3 m) butted against a corridor or
  passage, drawn as a crossed square labelled "V.S.". Shafts get walls but
  never doors, and are excluded from the connectivity check.
- Free slivers thinner than 2 m left over after carving join an adjacent
  passage, or become corridor.

### Elevators, hidden rooms, sliding doors, vending machines (added 2026-09-19)

- **Elevator shafts**: count and size sliders in the Services group. Carved
  as voids against a corridor with the same routine as the vent shafts, drawn
  as a crossed square with a car outline and "LIFT", and given a centre-opening
  sliding door onto the corridor. Never part of the connectivity check.
- **Hidden rooms**: a slider in the Rooms group, plus a per-building bonus
  (mansion 1, cartel 2). Small non-mandatory rooms lose every ordinary door and
  keep one secret passage to a non-hidden neighbour. A hidden room can not be
  the anchor of another hidden room. Drawn with a dashed inner outline and a
  sublabel such as "(NOT ON THE OFFICIAL DRAWINGS)". The connectivity repair
  runs again afterwards with hidden rooms excluded as targets, so neighbours
  that were only reachable through a hidden room get a door elsewhere.
- **Sliding doors**: a share slider in the Openings group converts ordinary
  room doors to pocket doors, drawn as a leaf half across the opening and half
  in the pocket with a small arrow.
- **Vending machines**: a count slider in the Furniture group places machines
  along corridor walls away from doors. Break rooms, kitchenettes and the
  motel vending closet also get them.
- Office building: the first open office is labelled "OPEN OFFICE HELLSCAPE"
  and filled with back-to-back desk pairs; meeting rooms are named after
  corporate phrases. Cartel compound and launch control center palettes as in
  the code.

### R&D facility (added 2026-09-19)

Twenty lab kinds, each with its own oversized equipment symbol: wet lab
(benches, fume hoods), chemistry lab (fume hoods on two walls, glovebox),
laser lab (optical tables with a dashed beam path and mirrors), cryogenics
(cryostat with legs, dewars along a wall), BSL-3 (biosafety cabinets,
incubators, autoclave, centrifuge), electron microscope (column on a base),
NMR (magnet with rings and a dashed exclusion circle), wind tunnel (duct with
contraction, test section, flow arrows and fan), test accelerator (ring with
sixteen magnets and a tangent beamline), anechoic chamber (wedge zigzag on
every wall, pedestal), high-bay test hall (crane rails, crossed test rigs),
materials lab (presses), robotics lab (arms), gas cylinder store (cylinder
racks), sample archive (freezers), vibration lab (shaker table with arrows),
dark room, coffee lab, chemical store, patent office. A "big equipment scale"
slider in the Furniture group multiplies the large machines, clamped to the
room, so the accelerator ring, wind tunnel and magnets can be pushed to absurd
sizes.

### Restroom island walls

Restrooms can hold free-standing partition walls with fixtures on both
sides, filling the room depth. Three selects in the Pissoirs group:

- **Perimeter walls**: pissoirs / pissoir-toilet alternating / toilet stalls.
- **Island walls**: auto (pissoir halls and high mania only) / off / on.
- **Island fixtures**: pissoirs / toilet stalls / alternating.

An island is a 0.12 m partition running the room length minus 1.2 m at each
end, with a fixture run on each face. Islands repeat across the depth at a
pitch of two fixture depths plus the wall plus a 1.0 m aisle, leaving room for
the perimeter fixtures and an aisle at both outer walls. Labels of rooms with
islands report pissoir and stall counts.

### Backrooms sliders

- **Liminality** (0–100): master slider that raises every effect below when
  the individual sliders are at their defaults.
- **Dead ends**: number of corridor stubs that terminate in nothing.
- **Room nesting**: probability a room contains a smaller room with its own
  door, up to three deep.
- **Doorless rooms**: share of rooms whose doors are removed.
- **Repetition**: splits rooms into runs of identical cells with identical
  labels ("HALLWAY 4", "HALLWAY 4", …).
- **Label glitch**: share of labels that become wrong, missing or repeated.
- **Window blackout**: removes windows.

### Parameter panel

Grouped fieldsets. Every control is declared once in a table
`{ id, group, label, type, min, max, step, default, options }` and both the
DOM and the URL-hash serialiser are built from it.

Building: type, footprint shape, width, depth, grid cell, exterior wall,
interior wall, storey label.
Corridors: width, layout (spine / loop / cross / none), branch count.
Rooms: min area, max area, split bias, aspect tolerance, restroom share, big
hall share.
Openings: door width, door density, swings on/off, window spacing, window
width, secret passages (villain mansion).
Furniture: density, symbol detail.
Pissoirs: per restroom, spacing, mania, stalls, sinks.
Backrooms: the seven sliders above.
Annotation: labels, dimensions, room numbers, areas, title block, north
arrow, scale bar, font size, humour, sheet title text.
Style: scale (px/m), line weight, wall fill (solid / hatch / hollow),
dimension line grey, paper margin.
Seed: numeric input, Random, ◀ ▶ step buttons.

Every parameter change regenerates immediately. A "Reset group" link per
fieldset and a "Reset all" button.

### Output

Inline SVG scaled to fit the viewport. Buttons: Download SVG, Download PNG
(rasterised at 2× through a canvas), Copy link (URL with hash), Reset.

### Hospital, clothing factory, royal palace, cadet base (added 2026-09-19)

- **Hospital**: emergency with curtain bays, operating theatre with lights,
  lettered wards of beds with IV stands, ICU with monitors, radiology with a
  ring scanner, pharmacy, nurse station, waiting room, morgue drawers,
  maternity, consultation and isolation rooms, a helipad.
- **Clothing factory**: sewing floor of tightly pitched machines, cutting room
  with fabric rolls, fabric store, pressing with ironing boards, showroom and
  design studio with mannequins, dye room tanks, pattern and QC rooms.
- **Royal palace**: throne room, ballroom with chandeliers and columns, royal
  bedchamber with a four-poster, banquet hall, audience chamber, royal
  kitchens, treasury, corgi quarters, portrait gallery, music room with a
  piano, courtiers, ladies-in-waiting, stables and the Royal Water Closet.
  Gets one hidden room bonus.
- **Junior cadet training base**: drill hall with floor lines and a flagpole,
  lettered barracks of bunks, mess, classrooms, paintball armory, obstacle
  course, quartermaster, sick bay, latrines, guard house, motor pool, parade
  ground.

### Casino, school, zoo and the entrance lobby (added 2026-09-19)

- **Casino**: gaming floor of slot machines with a band of blackjack and
  roulette tables along the long axis, poker room, the cage with a glass
  counter, vault, sportsbook, buffet, high-limit room, "Eye in the Sky"
  surveillance, bars with stools. No windows, one bonus hidden room.
- **School**: numbered classrooms with a board, teacher desk and rows of
  small desks facing it, gymnasium with court lines, cafeteria, library,
  principal, staff room, science lab, art room, nurse, detention, computer
  lab, auditorium, playground, locker halls.
- **Zoo**: enclosures with fence, moat, rocks, trees and animals, penguin and
  otter pools, reptile house, aquarium and insectarium with terrariums,
  aviary, monkey, elephant and giraffe houses, petting zoo, café, vet clinic,
  gift shop, ticket booth.

**Entrance group.** The lobby zone is measured by marching over the cells of
the region just inside the entry door: depth along the inward direction up
to the lobby-depth slider, width across to the nearest side walls. The entry
room's own furniture is clipped to the part beyond the lobby. Styles:

- plain: nothing but the bollards outside;
- reception: a desk facing the door, plants, unarmed guards, a few cameras;
- matrix: two rows of marble columns, metal detectors, turnstiles, a guard
  desk and armed guards (rifle drawn in 2D, carried in 3D), cameras at both
  ends;
- cyberdyne: a glass guard booth to one side, badge gates across, metal
  detectors, armed guards, cameras everywhere and a lit sign.

Sliders: guards, metal detectors, turnstiles, cameras, bollards, lobby depth.
Rooms hosting a matrix or cyberdyne lobby get a sublabel.

### Fertility clinic, escape rooms, night club, museum (added 2026-09-20)

- **Fertility clinic**: reception, waiting room, consultations, IVF and
  andrology labs with benches, incubators and microscopes, cryo storage full
  of dewars, the collection room (sofa, screen, magazine rack, sink),
  ultrasound bay, procedure room, counselling, recovery.
- **Escape room center**: lobby, briefing, escape rooms named after themes
  ("THE PHARAOH'S TOMB", "BANK HEIST", …) with a puzzle table, shelves,
  padlocked chests, a countdown display and a camera, game master control
  room, debrief lounge, victory photo wall, prop storage and workshop. Two
  bonus hidden rooms.
- **Night club**: dance floor of lit tiles with a disco ball, stage,
  speakers and dance poles ringed by dashed tip zones, pole stage with
  stools and sofas, DJ booth, bars, VIP lounge behind a velvet rope,
  cloakroom, smoking terrace with ashtrays, green room, booze store. No
  windows.
- **Museum**: grand gallery of vitrines and paintings, dinosaur hall with a
  skeleton behind a rope, Egyptian gallery with a sarcophagus and plinths,
  modern art (a chair on a plinth), planetarium dome with ring seating,
  antiquities, sculpture hall, café, conservation lab, archive, ticketing,
  coatroom, gift shop.

### Chemical plant, recording studio, farm, e-waste plant (added 2026-09-20)

- **Chemical plant**: reactor hall with legged reaction vessels and spill
  puddles, tank farm, mixing room, packaging line with drums and pallets, QC
  lab, control room, drum and solvent stores, a vacant safety office and an
  out-of-order safety shower. Subtitle "(OSHA HAS NOT BEEN INFORMED)".
- **Recording studio**: jam and live rooms with drum kit, amps, mic stands,
  acoustic panels and a piano, mix rooms and mastering suite with a mixing
  desk, monitors, sofa and racks, vocal and isolation booths, reverb chamber,
  amp store, tape library, machine room, artist lounge. The one-way mirror
  mechanism is generalised per building: `mirrorKinds`, `mirrorAccept`,
  `mirrorPartner`, `mirrorLabel`, `mirrorClear`. Studios use it as clear
  "STUDIO GLASS" between mix rooms and jam, live or booth rooms.
- **Farm**: machine shed with tractors, trailers and a combine, cow barn with
  stalls and hay bales, hay store, grain silo, milking parlour, feed store of
  sacks, chicken coop with nest boxes, pig pen, tool shed with wheelbarrows,
  farmhouse kitchen and the indoor outhouse.
- **E-waste plant**: receiving hall of pallets and heaps, sorting line with
  bins, shredder with hopper, dismantling benches, battery quarantine, CRT
  graveyard of stacked monitors, data destruction, precious metals, cable
  mountain, weighbridge.

### Foreign rooms (added 2026-09-20)

A "Rooms from other building types" slider in the Rooms group. Mandatory
rooms always belong to the selected building. An exact count of the other
rooms, slider ÷ 200 of them rounded and at least one whenever the slider is
above zero, draws its kind from another building type: 0% keeps the plan
pure, 50% makes a quarter of the non-mandatory rooms foreign, 100% half.
A "Source building type" select picks the source: any other type (uniform
per room) or one specific type, so a zoo can be seeded with police rooms.
Within the source, kinds found in four or more building types (admin,
storage, kitchen, lockers, security, …) are skipped because they would look
native, kinds the home building already has are skipped too, and the source's
mandatory (signature) kinds get a heavy bonus, weighted by size affinity as
usual. A foreign room keeps its own furniture, uses the source's label
overrides and humour lines, and always carries a tag line
"« FROM THE <SOURCE TITLE> »" in 2D and the same text in its 3D label.

### Spa, sports center, bicycle repair shop, abattoir (added 2026-09-20)

- **Spa & wellness**: reception, saunas with tiered benches and a stove,
  steam room, plunge pool (drawn cold), relaxation lounge of loungers and
  plants, treatment rooms with massage tables, hot tub, thermal pool with
  loungers and a footbath, ice room, changing rooms, yoga and meditation with
  mats, juice bar, salt cave.
- **Sports center**: climbing hall with hold-studded walls and crash mats,
  boulder cave, badminton hall with courts and nets, cricket nets with lanes,
  pitch strips and stumps, physio, changing, showers, equipment store, shop,
  umpires' room, spectator stand of bleachers, café.
- **Bicycle repair shop**: workshop with bike stands, benches, tool wall and
  tyres, sales floor of display bikes, wheel-truing room, parts store of
  bins and shelves, tyre store, bike-fit room, wash bay, customer bike racks,
  counter.
- **Abattoir**: lairage pens with animals, stunning bay, processing hall
  with an overhead rail, hooks, drains, steel benches and band saws, chill
  room of hook rails, cutting room, cold store, offal room, hide store,
  rendering tanks, packing line, vet inspector, wash-down, hygiene lock.

### Anatomy institute, parliament, sushi restaurant, baggage handling (added 2026-09-20)

- **Anatomy institute**: dissection hall of steel tables with sinks, a
  screen and a teaching skeleton, body store drawers, surgical skills lab of
  operating tables, embalming room, specimen museum of jar shelves and
  vitrines, lecture theatre, osteology, scrub room, body donation office,
  histology, simulation suite, student lounge. Dissection and skills labs get
  clear "VIEWING GLASS" into a viewing gallery via the mirror mechanism.
- **Parliament**: the chamber with semicircular tiered seating, a speaker's
  chair, dispatch boxes and a voting board; numbered committee rooms, press
  briefing room, division lobby with teller desks, members' lobby, speaker's
  and ministers' offices, whips, Hansard, translation booths, tea room,
  Strangers' Bar, public gallery, archives, mail room. One bonus hidden room.
- **Sushi restaurant**: a main kitchen larger than the dining room, with rows
  of counters, rice cookers, fridges and sinks; sushi bar with an endless
  conveyor belt ringed by stools; dining room; tatami rooms with low tables
  and mats; fish cold store with ice tables; rice room; knife room; sake
  cellar; dish pit; fish prep; host stand; tea corner.
- **Baggage handling**: sort hall with conveyor rows, alternating chutes and
  carts; X-ray and CT screening tunnels with operator consoles; make-up area
  of ULD containers; odd-size, lost and found (suitcases everywhere), early
  bag store, reclaim carousel, customs benches with a scanner and bollards,
  tug parking, dispatch, and a suspect bag room with a blast bin.

### Cryosleep lab, nuclear waste repository, call center, courthouse, dental clinic (added 2026-09-20)

- **Cryosleep R&D facility**: a cryosleep bay of glass-capsule pods (a face
  visible in each, a green status light that is always green), long-term pod
  storage stacked two high, dewar hall, revival suite of monitored beds,
  perfusion room, LN2 plant, vitrification lab, animal trials, pod
  monitoring, backup generator, member lounge, contract signing, wake-up
  room, future orientation. The bays get clear "VIEWING GLASS" into a viewing
  gallery.
- **Nuclear waste repository**: cask hall of trefoil-marked casks under a
  crane rail, overpack room, hot cell with manipulator arms behind clear
  "LEAD GLASS" into an operator gallery, decontamination showers, drum
  store, radiation monitoring, dosimetry with portal monitors and lockers,
  shaft head, tunnel portal with trucks, waste assay lab, warning marker
  studio ("THIS IS NOT A PLACE OF HONOR"), HEPA filter bank, Geiger store,
  regulator's office.
- **Call center**: call floor and night-shift floor of back-to-back cubicle
  rows (partitions, desk, monitor, chair) under a KPI screen and a team-lead
  desk; quality monitoring behind a one-way mirror onto the floor; crying
  room, headset store, script room, training room, team lead pods, wall of
  KPIs, HR, motivation room, escalations, phone booths.
- **Courthouse**: numbered courtrooms with a raised judge's bench and chair,
  witness and clerk boxes, a two-row jury box, counsel tables, flagpoles and
  rows of public benches; jury rooms, judge's chambers, holding cells,
  attorney interview rooms, clerk of court, law library, bail bonds, public
  waiting, court reporter, probation, mediation, jury assembly, evidence,
  records, sally port, press room.
- **Dental clinic** (excessive surgery): an extraction hall of dental chairs
  (reclined chair, lamp arm, spit bowl, instrument tray) taking the largest
  room; oral surgery suites and implant theatres with operating tables; root
  canal, hygiene and orthodontics rooms with single chairs; panoramic X-ray;
  treatment plan consult; sedation room; recovery lounge of loungers;
  sterilization with autoclaves; crown and bridge lab; extracted teeth
  archive of jars; financing desk; nitrous oxide store; waiting room.
- **Rotated grid fills fixed**: `gridFillRot` places a `w × d` footprint
  grid with each item rotated 90° and its local dims swapped, so trucks,
  turbines, racks, bowling lanes and kitchen counters keep their natural
  orientation in tall rooms (the old code passed swapped dims, which the 3D
  truck exposed as negative box sizes). The robustness test now builds the
  3D model for every building and checks every primitive.

### 3D views (added 2026-09-19)

Two extra views beside the 2D drawing, switched from the toolbar or with keys
1/2/3, remembered in the URL hash as `view=iso|walk`:

- **build3D** (in `shared-code`, pure, tested in Node) turns the plan model
  into plain geometry: wall pieces split around door, window and mirror
  openings (with sills and lintels), dark wall caps, floor slabs coloured by
  region, glass panes, door leaves (swing doors 70° open, pocket doors half
  open, centre-opening lift doors, cell bars, thick blast leaves), pipes in the
  service passages, furniture as boxes, cylinders, spheres, tori, wire boxes
  and an extruded ellipse for the Oval Office, floating labels, little people
  and a start pose just inside the entry.
- **Three.js module** (r170 from jsdelivr via an import map, so the 3D views
  need network while the 2D plan works offline) merges the geometry per
  material, lights it with a hemisphere light and a shadow-casting sun, and
  renders with two cameras: an overhead perspective (or orthographic) camera
  with OrbitControls preset to the reference's oblique angle, and a
  first-person camera with pointer lock, WASD/arrows, Shift to run, and
  circle-versus-wall collision that slides along walls and passes through
  doorways. Roofs are off in both views; a "3D view" parameter group holds
  wall height, floating labels, shadows, an optional ceiling for walk mode,
  the orthographic toggle and the number of people.

## Tests

`FloorPlanTests.run()` in `shared-code`, run by `test.mjs` in Node:

- PRNG: fixed seed gives a known first five values; different seeds differ.
- Determinism: two generations with identical inputs serialise identically.
- Geometry: every room lies inside the footprint and outside holes; no two
  rooms overlap; every room touches a corridor or another room.
- Connectivity: with doorless = 0 the door graph reaches every room from the
  entry.
- Pissoirs: a plan with restroom share 1 has at least one restroom and its
  urinal count matches the slider; mania 1 yields at least one pissoir hall.
- Backrooms: dead-end slider N produces N dead-end corridors when there is
  room; doorless 1 leaves at least one room without doors.
- Renderer: output starts with `<svg`, has balanced `<g>` tags, contains
  every room label, contains no `NaN`.
- Every building type generates without throwing for seeds 1–50 at default
  parameters.

## Files

- `2d-floor-plan-generator/index.html`
- `2d-floor-plan-generator/test.mjs`
- `2d-floor-plan-generator/screenshot1.png`
- `gallery.yaml`: title override "2D Floor Plan Generator".
