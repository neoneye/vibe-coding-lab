# Circus Maximus — design

Date: 2026-10-14. Directory: `circus-maximus/` (single self-contained `index.html` + `test.mjs` + `screenshot1.jpg`).

## Intent

A 3D rebuild of the Circus Maximus in Rome showing what a day at the races looked like, with its history
from the Regal era to the last races of 549. The owner visited the site in 1998 and found it surreal and
striking; the page should carry that feeling, and lets the visitor see the grass field they remember
turn back into the full circus.

Owner choices:
- One reconstruction at its peak: the Trajanic circus, about 103 AD. The only era-dependent change is the
  number of obelisks.
- Roles: spectator (a panorama), charioteer (drive), ride-along (tactics only), sponsor (the presider
  who pays for and opens the games).
- History: an era timeline plus historical race days that set the sponsor and the occasion.
- A "then and now" crossfade from the spectator spot.
- Approach A: three.js with hand-written arcade racing (no physics engine).

## Historical facts the design rests on

Source: Wikipedia "Circus Maximus" (and the works it cites: Humphrey, Livy, Pliny, Tacitus, Procopius).

- **Site and size:** valley between the Palatine (north-east side) and the Aventine (south-west side).
  About 621 m long and 118–150 m wide. The arena is about 550 m long and the central barrier about 340 m.
  About 150,000 seats (Pliny's 250,000 is unlikely). Trajan's work reportedly added 5,000 seats.
- **Layout:** starting gates (*carceres*) at the straight west end, twelve in the later arrangement and
  allotted by lottery. A semicircular east end, with the triple arch of Titus (81 AD).
- **The central barrier:** *euripus* in most Roman sources, *spina* in a late one. It carries:
  - three conical turning posts (*metae*) at each end;
  - lap counters: eggs (174 BC) and bronze dolphins (33 BC);
  - shrines (Murcia, Consus, Sol and Luna), statues and fountains;
  - Augustus's obelisk (10 BC, from Heliopolis, quarried under Seti I, today in Piazza del Popolo);
  - Constantius II's second obelisk from 357 AD (from Karnak, today at the Lateran).
- **The pulvinar:** the raised box of the gods and the emperor, on the Palatine side. It is linked to
  the palace on the hill (Domus Augustana).
- **Races:** seven laps, run counter-clockwise with the barrier on the drivers' left. Four-horse teams
  (*quadrigae*); the start is signalled by the presider dropping a white cloth (*mappa*). The factions
  were Reds and Whites (late Republic), then Blues and Greens dominant in the Imperial era. Each faction
  could enter several chariots, and team-mates blocked for each other. A crash was a *naufragium*
  ("shipwreck").
- **Who paid:** in the Republic the games were organized by aediles (later praetors) as magistrates. The
  sponsor-presider (*editor*) sat by the images of the gods. Caesar as aedile used lavish games to win
  support. Later, emperors. In the late Republic ludi were held on 57 days a year.
- **Timeline, Regal (tradition, not record):**
  - races in the valley from Rome's beginnings (the Consualia; the abduction of the Sabine women);
  - Tarquinius Priscus builds raised wooden seating for the elite;
  - Tarquinius Superbus builds the first seats for the plebs.
- **Timeline, Republic:**
  - 494 BC: Valerius Maximus is granted a curule chair at the south-east turn.
  - 366 BC: the earliest securely dated Ludi Romani.
  - 329 BC: wooden starting gates.
  - 190s BC: stone seats for senators.
  - 174 BC: egg lap counters.
  - 169 BC: a venatio with 63 leopards, 40 bears and elephants.
  - 55 BC: Pompey's elephant hunt.
  - About 50 BC: Caesar extends the seating almost all the way round and digs the protective water channel.
  - 46 BC: Caesar's triumphal games.
  - 33 BC: dolphin lap counters.
  - 31 BC: a fire.
- **Timeline, Imperial:**
  - 10 BC: Augustus's obelisk; Augustus also builds the pulvinar.
  - 36 AD: fire, compensated by Tiberius.
  - Claudius: marble starting gates and gilded turning posts.
  - 64 AD: the Great Fire under Nero starts in the shops at the Circus; rebuilt on the same footprint.
  - 81 AD: the arch of Titus.
  - About 103 AD: Trajan's stone rebuild and new pulvinar (a sestertius of 103).
  - Under Diocletian, a stand collapse kills about 13,000.
  - Late 3rd century: Probus stages a beast hunt in a planted "forest".
  - 357 AD: Constantius II's obelisk.
- **Timeline, late and after:**
  - 523: the last known beast hunt.
  - 549: the last known races, given by Totila (Procopius).
  - Then: burial and flooding; the track is now about 6 m below ground. Dwellings in the 11th century,
    drainage in the 12th, and the 12th-century Torre della Moletta at the curved end.
  - 16th century: market gardens and stone quarrying.
  - 1852–1910: a gasworks.
  - Excavations uncovered seating, the turn and the barrier.
  - Today: a public park (the 2006 World Cup celebration).

## Architecture

```
history data (timeline, race days) ──┐
race engine (pure, seeded) ──────────┼─> page controller (roles, race day, then/now, speed)
                                     │       ├─> 3D scene (three.js 0.170 via jsdelivr, like the repo's other 3D pages)
                                     │       │     ├─ ancient circus (Trajanic) + city backdrop + crowd (instanced)
                                     │       │     ├─ modern site (1998-style)
                                     │       │     └─ chariots/horses driven by race state
                                     │       ├─> cameras: spectator panorama (cube → cylindrical), chase, sponsor box
                                     │       └─> sound (Web Audio, synthesized)
```

### Shared code (`<script id="shared-code">`, pure, Node-tested via `test.mjs`)

- **Track geometry.** A course frame: distance `s` along the centre line (two straights joined by 180°
  turns around each set of turning posts) and lateral offset `d` outward from the barrier. Mapping
  `(s, d) → (x, z, heading)`. Lap length, turn radius, and the gate positions on a slight angle, which
  roughly equalized the distance to the first turn.
- **Race engine.** 12 chariots, 3 per faction. Gates by lottery from the seed.
  - **Per chariot:** state (`s`, `d`, speed, lap, stamina, alive/crashed) and team traits (top speed,
    acceleration, stamina).
  - **Controls:** steer, whip and rein.
  - **Turns:** a safe-speed curve that depends on `d` (a tighter line means a lower safe speed but
    less distance).
  - **Crash checks:**
    - over the safe speed by a margin, with probability by excess;
    - clipping a turning post (`d` below its minimum at a turn);
    - side contact with locked wheels.
  - **Wrecks** stay on the track as obstacles.
  - **AI drivers:** cautious, blocker or reckless, and team-mates block for their faction leader.
  - **Laps:** counting and finishing order. 7 laps.
  - **Determinism:** the same seed and inputs give the same race.
- **History data.** Timeline entries `{ era, year, text, detail }`, where a negative year is BC and
  Regal entries are flagged `tradition: true`. Race days `{ id, year, sponsor, title, occasion, obelisks,
  anachronism?, factions, narration[] }`.
- **`CircusTests.run()`**.

### Page

- **3D scene:** procedural geometry, no assets.
- **Cameras:** spectator panorama, chase, sponsor box.
- **Panel:** role, race day, timeline, then/now, speed, sound, honesty panel.
- **Sound engine.**
- **Debug handle:** `window.__circus` (state, step the race synchronously, set the camera, then/now,
  sound level) for tests and screenshots.

## Look

- **Building (Trajanic):**
  - three tiers of stone seating;
  - an arcaded outer façade with shops below;
  - the twelve starting gates with herms;
  - the curved end with the triple arch;
  - the barrier with gilded turning posts, eggs and dolphins, shrines, statues, the water channel, and
    one or two obelisks (by race day);
  - the pulvinar on the Palatine side, with the Domus Augustana palace on the hill behind it.
- **Surroundings:** Aventine temples and roofs, and the city fading into haze.
- **Light and surfaces:** warm late-afternoon sun, long shadows, dust haze over the sand. Travertine and
  marble are weathered and patchy, never clean. Painted details and faction colours.
- **Crowd:** about 150,000 instanced low-poly figures with varied colours (white togas and tunics,
  faction cloth), postures and small idle motion. They stand and roar at the start, crashes and the finish.
- **Chariots:** light two-wheeled cars with four horses abreast, drivers in faction colours. The horses
  gallop, kick up dust and leave tracks.
- **Modern site (1998-style):**
  - a sunken grass oval with a worn dirt path along the old track;
  - the excavated stone remains and the Torre della Moletta at the curved end;
  - the Palatine brick ruins above, and umbrella pines;
  - the modern road with occasional cars, under summer light.

## Cameras and views

- **Spectator panorama:**
  - **Spot:** the middle of the Aventine-side stands, about two-thirds up, looking across at the
    pulvinar and the Palatine.
  - **Rendering:** the scene renders to a cube map, then a full-screen shader reprojects it
    cylindrically. The horizontal field of view is about 150–160° by default, so the whole arena and both
    ends fit, with vertical lines kept straight.
  - **Controls:** drag to look around; the zoom narrows towards a normal perspective. An optional
    "follow the leader" pan.
- **Then and now:** the same spot. Both scenes render (as two cube maps), and the panorama shader mixes
  them by the slider value.
- **Chase camera:** behind and above the player's (or ride-along) chariot, with dust and slight shake.
- **Sponsor box:** the pulvinar view across to the Aventine (the same panorama technique, the other
  way round).

## Roles

1. **Spectator:** the panorama. The race runs with AI chariots, and crowd lines are shown (betting
   talk, faction chants, groans at crashes).
2. **Charioteer:**
   - pick a faction; the gate comes from the lottery;
   - controls: ←/→ steer, Space whips, ↓ reins in; touch buttons on phones;
   - an on-screen strip shows laps left (eggs and dolphins), stamina and position;
   - a win brings a palm branch and the crowd's roar.
3. **Ride-along:** the chase camera on a chosen chariot. The visitor sets tactics only: "save the team",
   "hold the inside", "go now".
4. **Sponsor:**
   - you are the race day's presider, and you choose the day's program (the opening procession, then
     1–3 races);
   - you drop the mappa to start each race;
   - a cost line acts as flavour text;
   - the view is from the pulvinar.

**Race days** (each sets the presider in the box, the occasion, the narration and the number of
obelisks):

| Year | Presider | Occasion | Notes |
|---|---|---|---|
| 46 BC | Julius Caesar | triumphal games | anachronistic building, noted |
| 10 BC | Augustus | obelisk dedicated | |
| 64 AD | Nero | games before the Great Fire | |
| about 103 AD | Trajan | the rebuilt circus reopens | matches the model best (default) |
| 357 AD | Constantius II | second obelisk raised | two obelisks |
| 549 AD | Totila | last recorded races | anachronistic building, noted |

**Speeds:** real and 2×.

## Sound (Web Audio, synthesized; off until the first race; volume slider)

- crowd bed and roar swells (start, crashes, finish, lap counters);
- hoofbeats per team, with a gallop rhythm that follows speed;
- wheel rumble and the whip crack;
- trumpets for the procession, and the clatter of the starting gates;
- crash crunch;
- the then/now slider crossfades the crowd to modern traffic and birds.

## Honesty panel ("About this simulation")

- The building is an illustrative reconstruction of about 103 AD from published plans; the details are
  not a measured survey.
- The 46 BC and 549 AD race days use the 103 AD building (an anachronism).
- The crowd is stylized; the racing model is a game, not a measured simulation.
- The 1998 view is reconstructed from photographs and general knowledge, not a survey.
- Regal-era entries are tradition, not record.
- Sounds are synthesized.

## Testing (`node circus-maximus/test.mjs`)

- **Track:** the straights and turns join with continuous position and heading; the lap length matches
  the geometry; `(s, d)` round-trips.
- **Race:**
  - the same seed and inputs give the same finishing order;
  - laps stop at 7 and the finishing order is complete;
  - an AI-only race finishes with every non-crashed chariot completing 7 laps;
  - a scripted too-fast, too-tight turn crashes;
  - a cautious line through a turn does not;
  - a wreck blocks its lane;
  - the whip drains stamina.
- **History:** timeline entries are sorted by year within each era, Regal entries are flagged as
  tradition, every race day has a presider, occasion and obelisk count, and the obelisk count is 2 only
  from 357.

Visual and audio checks in the Browser pane / headless Chrome (drive `__circus` synchronously; rAF does
not advance headless). Finish with `screenshot1.jpg` (1600×1000) and a gallery entry.

## Out of scope

- Other circus events: beast hunts, processions beyond a short opening, foot races.
- An interior walk-through of the arcades.
- Era-by-era rebuilding of the building.
- Multiplayer.
- Real physics wrecks.
- Betting mechanics beyond flavour text.
