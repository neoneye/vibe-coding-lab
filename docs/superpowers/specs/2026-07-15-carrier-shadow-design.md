# Carrier Shadow — design

Date: 2026-07-15
Project directory: `game-carrier-shadow/`
Status: approved by owner (scope, layers, all four design sections) during brainstorming session.

## Elevator pitch

Minesweeper on and under the sea, Battleship with moving vessels, and an air-war
layer where one wrong radar echo can start a regional war. A single tense
15–30 minute scenario set in the Strait of Hormuz.

## Scope decisions (settled)

- **One scenario:** the spec's *Carrier Shadow* mission. No campaign, no mission
  selection. Full-spec systems not needed by this scenario are out of scope.
- **Language:** English UI and text.
- **Session:** turn-based, ~25–40 turns, 15–30 minutes. Losing is common;
  randomized (seeded) enemy setup makes it replayable.
- **Convoy:** player steers each civilian ship every turn.
- **Presentation:** one map with toggleable SEA/AIR intel overlays (not two
  boards, not one merged view).
- **Repo conventions:** self-contained `index.html`, engine in a
  `<script type="text/shared-code">` block, `test.mjs` extracts and tests it,
  seeded RNG for determinism.

## Mission frame

### Map

- 20×12 cell grid of the Strait of Hormuz.
- Iranian coast along the top edge: land cells, impassable to ships; may hide
  the mobile SAM and radar sites. Flying over them is a territorial airspace
  violation.
- Omani/Musandam coast in the bottom-left: land cells, impassable, neutral.
- East edge opens into the Gulf of Oman. West edge has a marked **exit zone**
  (into the Persian Gulf).
- The player's carrier sits in a small **off-map strip** on the east edge —
  a base, not a maneuverable piece (per spec: partly outside the normal field).

### Player forces

| Unit | Count | Move | Notes |
|---|---:|---|---|
| Tanker (civilian) | 4 | 1 cell/turn | Must reach exit zone; defenseless |
| Frigate | 2 | 1–2 cells/turn | Radar sweep action; anti-air bubble radius 2 |
| Minesweeper | 1 | 1 cell/turn | Sonar range 3; can clear adjacent mines |
| Carrier | 1 | fixed | Hosts the resource pool |

Carrier resource pool (gone when spent):

```text
Fighter sorties:       6
Surveillance flights:  2
Aerial refuel:         1
Rescue helicopter:     1
```

### Hidden opposition (seeded placement each game)

- 4 mines (static, single cell, water only)
- 2 missile boats (mobile, single cell)
- 1 mobile SAM system (Iranian coast cells, relocates ~every 6 turns)
- 3 drones (air layer, orbiting)
- 4 false radar echoes (air layer, permanent)
- 2 enemy fighter patrols (air layer, racetrack routes)
- Civilian airliners crossing on airway corridors on a timetable (air layer;
  must never be attacked)

### Turn loop

1. **Orders phase (player):** move each ship or hold; each frigate/minesweeper
   may use its one sensor action (sonar ping or radar sweep); launch or direct
   air missions; place marks; End Turn.
2. **Resolution phase (engine):** aircraft fly one leg; enemy units move/act;
   mines and SAM trigger; intel results and radar warnings append to the event
   log; escalation updates (including quiet-turn decay).

### Win / lose / grade

- **Win:** ≥3 of 4 tankers reach the exit zone.
- **Lose:** 2+ tankers destroyed, **or** escalation reaches 100, **or** a
  civilian airliner is shot down (instant defeat).
- End screen grades: tankers through, escalation peak, resources unspent,
  turns taken.

## Sea layer (SEA view)

- **Sonar ping** — frigate or minesweeper action, target any cell within range
  (frigate 2, minesweeper 3). Reveals that cell's content with certainty and
  stamps a Minesweeper number = count of hidden sea threats (mines + enemy
  vessels) in the 8 neighbors.
- **Number staleness** — each number records the turn it was measured. Numbers
  are bright when fresh; when any mobile enemy moves within the number's
  neighborhood, it dims to gray ("stale"). Static mines never invalidate a
  number; movers do.
- **Mine clearing** — the minesweeper spends its whole turn to clear a mine in
  an adjacent cell (the cell need not be flagged, but clearing an empty cell
  wastes the turn). It must survive sitting next to the mine.
- **Damage** — a ship entering a mined cell: tanker destroyed, warship
  crippled (movement 0–1, no sensor action, second hit sinks). Missile boats
  attack adjacent convoy ships during resolution once posture allows.
- **Sea marks** (bookkeeping only, no rule effect): `⚑ mine?`, `▣ ship?`,
  `✓ clear`.

## Air layer (AIR view)

- Parallel hidden grid of **air signals**: enemy fighters, drones, civilian
  airliners, the SAM's radar while emitting, and the 4 false echoes.
- **Radar sweep** — frigate action (footprint 3×3 centered in range 3), or
  automatic 5×5 footprint under a surveillance flight each turn. Stamps radar
  numbers = count of air signals in the 8 neighbors. Sweeps count signals;
  they never classify them.
- **Deliberate ambiguity** — false echoes count as signals until identified;
  drones and airliners are indistinguishable by number. Classification
  requires putting an aircraft near the contact (recon or intercept).
- **Air marks** (per spec): `▲` hostile fighter, `△` civilian, `◇` drone,
  `⚡` active radar, `✕` false echo.
- **SAM envelope** — invisible until it acts. Any player aircraft inside it
  receives a fuzzy log warning ("Radar warning: weak — estimated threat 1–2
  cells away, identification unknown"). Warning strength scales with depth
  into the envelope. The SAM firing reveals its position for 2 turns.
- **Airliners** — follow fixed airway corridors on a timetable; produce
  genuine radar numbers.
- **Layer interplay rule:** aircraft can confirm a cell holds no *ships* but
  say nothing about mines; sonar says nothing about air signals.

## Air missions

Launching consumes a resource and places a visible (to the player) aircraft
token on the air layer. Lifecycle: launch → transit → 2–3 turns on station →
return. The single refuel extends one active mission's on-station time by 2
turns.

- **Surveillance flight (2):** slow; sweeps a 5×5 footprint each turn along a
  player-chosen path; also refreshes/ages sea-number staleness under it.
  Defenseless: an enemy fighter reaching it forces an abort, or a loss if no
  CAP is within its cell's radius 2.
- **Fighter sortie (6),** tasked at launch:
  - **CAP:** orbit a chosen radius-3 area; automatically engages drones and
    enemy fighters entering it (each engagement raises the intercept prompt).
  - **Recon:** fly a chosen straight line; identifies every air contact passed
    (fighter/drone/civilian/false echo) and classifies sea contacts under the
    route (civilian vs. warship) — never mines.
  - **Intercept:** vector onto one unknown air contact; on arrival the player
    chooses one rung per turn: *observe → hail → radar lock → warning shot →
    attack*. Each rung gives more certainty and more escalation. The player
    may start at any rung.
  - **Strike:** attack one sea/land target (missile boat, SAM, minelayer).
    Striking an **identified** target is safe diplomacy-wise (military-vessel
    escalation only); striking an unidentified contact is legal but the player
    carries the consequences of a wrong hit.
- **Shootdown & rescue:** aircraft in SAM coverage or engaged by enemy
  fighters can be shot down (probability per turn of exposure). A downed
  manned aircraft opens a 3-turn rescue window: spend the helicopter to
  recover the pilot, otherwise a permanent +1 escalation bleed per turn for
  the rest of the mission.

## Escalation (0–100)

Spec table, applied to player actions:

| Action | Escalation |
|---|---:|
| Recon/surveillance flight launched | +1 |
| Radar lock on unknown aircraft | +3 |
| Territorial airspace violation (per turn over Iranian coast) | +5 |
| Warning shot | +6 |
| Drone shootdown | +8 |
| Attack on military vessel | +12 |
| Manned aircraft shootdown | +20 |
| Civilian airliner shot down | instant defeat |

Quiet turns (no aggressive act that turn) decay the meter by 1.

Posture tiers change enemy behavior:

- **0–29 Shadowing:** enemy observes; missile boats hold near coast.
- **30–59 Harassment:** drones shadow the convoy; missile boats feint; SAM
  emits more often.
- **60–99 Open conflict:** missile boats attack tankers on contact; enemy
  fighters hunt player aircraft; SAM fires without warning.
- **100 — war:** mission failed.

## Enemy behavior

Deterministic given the seed. No adaptive AI.

- Mines: static.
- Missile boats: patrol waypoints; at Harassment+ stalk the nearest *detected*
  tanker; at Open conflict attack on contact.
- Drones: orbit; a drone adjacent to a player ship "spots" it — spotted ships
  are attacked with higher accuracy.
- Enemy fighter patrols: fly racetracks; react to player aircraft entering
  their sector; can force surveillance aborts and engage fighters.
- SAM: relocates every ~6 turns among coast cells; fires per posture rules;
  firing reveals its position for 2 turns.

## UI

- **Top bar:** turn counter, escalation meter colored by posture tier,
  resource counters.
- **Map canvas:** 20×12 grid, dark naval-chart aesthetic. SEA/AIR toggle via
  buttons and Tab. Own units always visible in both views. Off-map carrier
  strip on the east edge. Click cell/unit → action panel with legal actions;
  right-click cycles marks for the active layer.
- **Side panel:** event log (warnings, intel, escalation, enemy actions) and
  the intercept decision dialog when pending.
- **End Turn** button + Space. End screen with grade breakdown. First-load
  "How to play" overlay.

## Architecture

- `game-carrier-shadow/index.html`, fully self-contained.
- Engine in `<script type="text/shared-code">`: pure functions, no DOM, no
  `Math.random()`. Seeded mulberry32 RNG stored in state.
  - `createGame(seed)` → state
  - `legalActions(state)` → action list
  - `applyAction(state, action)` → `{state, events}`
  - `endTurn(state)` → `{state, events}` (full resolution phase)
- UI script renders state and event log; all input handling outside the
  engine.

## Testing

`test.mjs` (Node, zero dependencies) extracts the shared-code block and
asserts:

- Seeded setup places exactly the specced opposition in legal cells;
  same seed → identical game.
- Sonar and radar numbers count neighbors correctly, including false echoes;
  staleness flips when a mobile enemy moves in a number's neighborhood.
- Mission lifecycle: resource decrement, transit/on-station/return legs,
  refuel extension, expiry.
- Escalation: table values, quiet-turn decay, posture thresholds, defeat
  at 100, airliner shootdown = instant defeat.
- Win/loss triggers and grading.
- A scripted full playthrough reaching a win (regression test).

Visual verification: headless-Chrome screenshot driving the engine
synchronously in a temporary `_shot.html` (rAF loops don't advance under
`--virtual-time-budget`).

## Scope deltas (recorded 2026-07-16, post-implementation review)

Implemented and shipped as designed, except these spec items were narrowed
during planning and are open owner decisions for a future iteration:

- **Frigate anti-air bubble (radius 2)** — not implemented; frigates
  currently contribute sensors only, no air interception.
- **Boats stalk the nearest tanker, not the nearest *detected* tanker** —
  harassment-tier missile boats are omniscient about tanker positions;
  drone spotting affects hit odds only.
- **Enemy fighters do not hunt player aircraft** at open conflict; their
  only attack is the deterministic kill/abort of unescorted surveillance
  aircraft at Chebyshev 1.
- **Surveillance flights fly to a fixed station** (no player-drawn patrol
  path, no sea-staleness refresh); CAP engages at radius 2 rather than the
  spec's radius-3 orbit; SAM warning strength scales with posture rather
  than depth-in-envelope.
- **Recon vs. sonar number provenance** — recon-stamped numbers count boats
  only (mines invisible from the air, per the interplay rule); a recon leg
  can overwrite a fresher mine-inclusive sonar number with a boats-only
  value. Acceptable fog for now; a source tag would disambiguate.
