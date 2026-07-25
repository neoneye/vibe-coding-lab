# MOAT — design

**Date:** 2026-07-25
**Project directory:** `game-moat/`
**Format:** single-file `index.html`, vanilla JS, no build step, no network calls
**Genre:** tycoon / systems management, comic register
**Session length:** 10–20 minutes per contract
**Tagline:** *A fence merely delays an intruder. A moat makes a statement. A statement requires paperwork.*

---

## 1. Pitch

The player is the facility manager for a firm that installs and operates live-crocodile security moats for clients with more money than judgement. They did not design the product. They did not sell it. They are the person standing beside it at 6 a.m. with a clipboard, counting.

Three obligations actively fight each other:

1. **Keep the crocodiles alive and well.** They are the asset, and there is an inspector.
2. **Keep everyone else out — and in.** The moat has to actually work.
3. **Prevent the accident.** Every accident is somebody doing something reasonable at the wrong moment.

The game is won by boredom: a contract where nothing happened is a perfect score. The game is *played* by fighting the systems that make nothing-happening impossible.

---

## 2. Core mechanic: the Torpor Dial

The spine of the game. Everything else is an input to it.

Crocodiles are ectotherms. Activity is a single derived value (0–100), computed each tick:

```
activity = f(waterTemp, baskingAccess, hunger, timeOfDay, season, health)
```

Activity has opposite effects on the two win conditions:

| Activity | Deterrence | Staff safety | Welfare |
|---|---|---|---|
| **Torpid** (0–25) | None. The moat is a decorative ditch. Anyone can wade it. | Total. Handlers work in the water. | Poor if sustained — crocs stop eating, immune function drops |
| **Low** (25–45) | Weak. Deters the timid, not the determined. | Good | Acceptable |
| **Optimal** (45–70) | Strong | Manageable with protocol | Best |
| **Aggressive** (70–90) | Maximum | Poor. Handler incidents spike. | Good, but stress accumulates |
| **Frenzied** (90–100) | Maximum, and indiscriminate | Catastrophic | Stress injuries, croc-on-croc attacks |

The player never sets activity directly. They set **heaters, shade, water depth, feed schedule, and feed volume** — activity falls out of it. The intruder AI and the accident engine both read `activity` when they resolve.

**Design intent:** the player spends the whole game tuning one dial they cannot win on. Pushing it up secures the perimeter and endangers staff. Pushing it down protects staff and opens the perimeter. There is no setting safe in both directions, only a setting correct *for what is about to happen* — and the player does not always know what is about to happen.

---

## 3. Second pillar: the Morning Census

Every in-game day begins with a headcount. **The count is a fallible observation, not a state read.**

The player commits handler-hours:

- **Cursory (0.25 hr):** "11–13 animals observed." Useless.
- **Standard (1 hr):** "12 of 12 confirmed" *or* "11 of 12 — one unaccounted."
- **Thorough (3 hr, requires clear water):** exact count, plus per-animal health flags.

Crocodiles hide — under overhangs, submerged for up to two hours, wedged into culverts, basking behind planting. Murky water, which is *better for croc welfare and better for deterrence*, makes counting harder. Clear water costs filtration budget and makes the moat visibly less menacing, which the client will complain about.

When the census comes back short, the player decides with incomplete information:

| Action | Cost |
|---|---|
| Assume miscount, proceed | Free. If wrong, the animal surfaces somewhere terrible in 2–5 days. |
| Re-count thoroughly | 3 handler-hours, delays everything else that day |
| Drain and search | Full day, big welfare hit, client sees the moat empty, satisfaction drops |
| Report to client immediately | Satisfaction hit now, but halves the penalty if it turns out to be real |

A genuinely missing crocodile is the worst event in the game and it always starts as an ambiguous number on a clipboard.

---

## 4. Day structure

Continuous hourly simulation with a daily morning briefing.

At 06:00 the sim pauses on a briefing panel where the player spends that day's **handler-hours** — a single pool drawn against by census depth, structure inspections, grate maintenance, vet call-outs, and airspace watch. Time then runs at 1×/4×/16× and the player reacts to incidents as they fire. Facility settings (heaters, shade, depth, filtration, feed schedule, feed volume) are adjustable at any time.

The shared pool is load-bearing: a thorough census is three hours not spent inspecting culvert 4. Without competition for the same pool, the census choice in §3 is free and the tension collapses.

Pool size derives from handler headcount and fatigue. Hiring more handlers buys hours; tired handlers supply fewer and cause incidents.

---

## 5. Systems

### 5.1 Thermal

- Water heaters (running cost), basking platforms (capacity-limited — crocs compete for spots), shade structures.
- Ambient temperature follows season + daily curve + weather events.
- Below ~20 °C crocs stop feeding entirely. Sustained cold = welfare decline **and** a moat that stops working. Cold snaps are the best intrusion window.
- Above ~35 °C without shade = heat stress.
- Client-dependent difficulty: a Swiss chalet is a permanent thermal emergency; a Gulf palace is the opposite problem.

### 5.2 Feeding

- Schedule (days between feeds) and volume.
- Crocodiles eat infrequently. A croc refusing food for three weeks is *normal*, but looks alarming and triggers a vet-call decision.
- Well-fed → placid → poor deterrence. Hungry → alert → good deterrence, rising welfare penalty, rising handler risk.
- **Feeding creates a scheduled vulnerability window.** Animals cluster at the feed point; the rest of the perimeter is effectively unguarded for ~40 minutes. Intruders learn the schedule if it stays regular. Irregular feeding is a welfare penalty.

### 5.3 Water

- **Depth:** deep = good welfare, but a competent swimmer passes beneath a basking animal. Shallow = crocs contact the bottom, better interception, worse welfare.
- **Quality:** ammonia accumulates from waste. Filtration is a running cost. Poor quality → skin lesions, eye infection, an inspector's favourite finding.
- **Turbidity:** murky = better concealment (deterrence up, croc comfort up) but census confidence down and health problems spotted late.

### 5.4 Containment engineering

The perimeter is not the moat; it is everything the moat touches. Each element has a hidden `integrity` value that decays. Inspection reveals it, and the player can only inspect so much per day.

- **Overflow and storm drains** — the classic failure. Heavy rain raises the water line; a crocodile does not need to climb if the water brings it to the top of the wall.
- **Culverts and grates** — a juvenile fits through a gap an adult cannot. Recurring maintenance nobody wants to spend hours on.
- **The service bridge** — has to exist, is the obvious weak point, the client insists it be decorative.
- **Fence line and bank angle** — degrades over time; silt builds a ramp.

### 5.5 Staff

Four roles, each a hireable slot with fatigue and skill:

- **Handlers** — census, feeding, in-water work. Fatigue directly drives incident probability.
- **Veterinarian** — health checks, treats injuries. Expensive, often part-time.
- **Guards** — perimeter watch, intrusion response. Do not understand crocodiles and will do something stupid if unsupervised.
- **PR officer** — mitigates press events, manages the client. Feels like wasted salary until the day it isn't.

**Fatigue is the accident engine.** Most incidents resolve as `handlerSkill - fatigue vs. activity`. A tired handler at high croc activity is how people get hurt, and the player caused both numbers.

---

## 6. Incident engine

Incidents fire from a weighted table conditioned on current state. **No incident is random noise — every one is legible as a consequence.** Roughly 24 implemented at launch, covering all four categories below, with every marquee event present. Client-specific variants attach to the relevant contract.

**Environmental** — cold snap (activity crashes to torpid for 3 days, intrusion probability triples); power cut (heaters and pumps offline; temperature drops *and* water quality degrades); heavy rain / flood (water rises toward the coping stone, escape risk scaling with freeboard); algae bloom / filter clog (quality collapse over 4 days if unaddressed); sandstorm, leaf fall, ice as client variants.

**Animal** — territorial fight (two males, insufficient basking capacity); hunger strike (probably fine, probably); nesting (a clutch puts the player over licensed headcount, and the permit is annual); The Learner (one animal works out the feeding schedule and waits at the gate daily — cute, then not); escape via drain, flood or bank erosion, with escalating discovery states (unaccounted → sighting reported → found).

**Human** — the client wants to swim in it, once, for the photograph, and he has been drinking; contractor drains the moat for scheduled repair without notifying anyone; handler slip on a wet walkway, severity scaling with activity; delivery driver takes the service bridge because the app told him to; the client's dog, or peacock, or a guest's small child at the gala — the event the game is really about, and the player should feel the near-miss; guard initiative, in which an unsupervised guard decides to "test" the moat.

**External** — welfare inspector, unannounced, auditing water quality, basking capacity, feeding records and veterinary log, where a failure is contract-ending; journalist drone overhead (PR officer or it's a headline); insurance auditor reviewing the incident log, where a clean log lowers premiums and a hidden incident that surfaces later voids cover entirely; activist protest at the gate, nonviolent, persistent, terrible for client satisfaction.

---

## 7. Intrusion & egress

Attempts are generated per contract and **exploit the state the player created for welfare reasons.** All eight methods read the same `activity` value the player is tuning.

| Method | Exploits |
|---|---|
| **Plank / ladder bridge** | Any activity level. Countered by bank design and watch coverage. |
| **Cold-morning crossing** | Torpid activity. The most common successful method. |
| **Feed-time timing** | Regular feeding schedule. Animals clustered at one point. |
| **Bait distraction** | Hungry animals. Thrown meat draws the moat to one side. |
| **Inflatable / swim-under** | Deep water, well-fed placid animals. |
| **Culvert / drain** | Neglected grate integrity. Works both directions — also how a croc leaves. |
| **Bribed handler** | Low staff morale. Reveals the schedule to the other side. |
| **Drone-assisted line** | Any state. Counter is airspace watch, which nobody budgets for. |

A player who keeps animals hungry and hot has a hard perimeter and an infirmary. A player who runs a comfortable, well-fed moat has happy crocodiles and security theatre.

---

## 8. Clients

Each client is a contract: a map, a modifier set, a win condition, and a personality that generates its own incidents. Deliberately, floridly fictional.

1. **Sir Aurelian Voss** — *"Voss Point," private island.* Crypto fortune, second act. Wants the moat visible from orbit and has told the press so. Insists on 40 animals in a moat rated for 24 — overcrowding drives fights and welfare failure. Pays extravagantly, generates a client-caused incident roughly weekly, and invites people to look at it. *Tutorial-plus: money is not the constraint, Voss is.*
2. **The Marchetti Group** — *data centre perimeter, industrial estate.* Corporate. Wants ROI metrics and quarterly reporting, and has already decided the budget is 30% too high. Will cut the filtration line first. Sends an efficiency consultant who recommends fewer handlers. *Medium: budget starvation — the systems are simple, the money is not there.*
3. **The Kingdom of Zanjabar** — *royal palace, ceremonial.* Handlers in ceremonial black, a public parade route past the moat, state visits. Animals must look magnificent on demand, meaning well-fed and basking — maximally placid — on exactly the days the perimeter matters most. *Medium-hard: scheduled visibility events force torpor at the worst moment.*
4. **Halcyon Deep** — *doomsday bunker community, high desert.* The moat must be self-sustaining off-grid: solar heating, no municipal water, no vet within 200 km. Residents are armed, opinionated, and will "help." Long resupply intervals mean every consumable decision compounds. *Hard: resource scarcity.*
5. **Baroness Ingrid Halloway** — *subterranean vault, Swiss alpine chalet.* Art collector. The moat is indoors, underground, at altitude, in winter. Heating costs dominate the budget and every power flicker is a crisis. Pays for absolute discretion — any press event is instant contract failure. *Hard: the power/thermal cascade.*
6. **The Aviary** — *private brig, undisclosed volcanic island.* A supervillain's holding facility for a rival organisation's captured henchmen. The inmates are competent, bored, professionally trained in escape, and unionised. The only contract where **egress matters more than ingress**, and the opposition actively probes the schedule rather than waiting for an opening. Henchmen are cartoonish by design — matching jumpsuits, numbered, complaining about the food. *Hardest, unlocked last.*

---

## 9. Structure & scoring

**Campaign:** six contracts, 30–60 in-game days each, each introducing one new system, in the order Voss (census + torpor) → Marchetti (budget scarcity) → Zanjabar (scheduled visibility) → Halcyon (off-grid resources) → Halloway (thermal cascade) → The Aviary (active opposition). Progress persists; the Aviary is gated until the preceding five are complete.

**Sandbox** unlocks after the campaign: pick client, tune modifiers, endless.

**End-of-contract report card**, styled as a corporate post-project audit, because that is the joke:

```
CONTRACT CLOSE-OUT: VOSS POINT
Days operated              47
Animal welfare grade       B     (2 findings, 0 critical)
Containment record         1 breach, 0 successful
Incidents                  9 minor, 1 serious, 0 fatal
Client satisfaction        71%
Final census               12 of 12  ✅
⚠️  Uncategorized red flags: 1
```

Grade is a weighted composite. **Welfare and containment are both hard-gated** — a fatality or a lost animal caps the grade regardless of everything else.

**Uncategorized red flags** are implemented literally: events that occurred and were never discovered by the player — the count that was wrong and stayed wrong, the displaced grate nobody inspected. They are revealed only at close-out. The perfect run is one where the log is empty and the client is faintly disappointed that nothing exciting happened.

---

## 10. Technical spec

Single `game-moat/index.html`. No dependencies, no build step, no network calls. Companion `test.mjs` and `README.md` per repo convention.

```
index.html
├── <style>                      CSS custom properties, grid layout, no framework
├── <canvas>                     moat view — top-down, ~800×500, 30fps
├── <script id="shared-code">    pure logic + XTests.run() runner
└── <script>                     game loop, DOM panels, canvas render
```

| Concern | Approach |
|---|---|
| State | One plain `gameState` object, never mutated outside reducers |
| Loop | `requestAnimationFrame` accumulator → fixed 1 Hz logic tick, decoupled from render |
| Time | 1 tick = 1 in-game hour. Speed 1×/4×/16× + pause |
| Rendering | Canvas for the moat (crocodile sprites, water, staff dots); DOM for all panels |
| Crocodiles | `{id, length, health, hunger, bodyTemp, stress, position, state}` where `state` ∈ basking / submerged / patrolling / feeding / hidden |
| Determinism | Seeded PRNG (mulberry32). Seed shown on the report card so runs are reproducible and shareable |
| Save | `localStorage` — campaign progress and in-progress contract. Runs as a local file, so storage is available |

**Canvas layer order:** water → submerged animals → banks/structures → surfaced animals → staff → UI overlays (census markers, integrity warnings).

**Performance:** trivial. 12–40 entities at 1 Hz logic; rendering is a few dozen sprites.

### 10.1 Testing

All pure logic lives in the `<script id="shared-code">` block, which `test.mjs` extracts by regex and runs in Node — the repo's established pattern, no build step. Under test:

- the torpor function, verified to produce the §2 activity bands across the input space
- census observation given turbidity, hiding animals and chosen depth — including that it can be wrong
- integrity decay and inspection reveal
- incident weighting (conditioned selection, not uniform noise)
- intrusion resolution against `activity`
- report-card grading, including the welfare and containment hard gates

### 10.2 Build order

1. Tick loop + `gameState` + speed control — no graphics
2. Crocodile entities + thermal model + feeding → verify the Torpor Dial produces a sensible activity curve in a text readout
3. Census with fallible observation
4. Canvas render
5. Incident engine
6. Intrusion AI
7. Client modifiers + campaign wrapper
8. Report card

Steps 1–3 are the actual game. If the Torpor Dial is not tense in a plain-text prototype, no amount of canvas work will save it — so the dial is validated by test before step 4 begins.

---

## 11. Tone

Deadpan procedural. The comedy is in the register clash — a genuinely competent facility manager applying genuine professional rigour to an idea that should never have left the whiteboard. Never wink at the camera. The funniest line in the game is a maintenance log entry.

> **06:14 — Morning census**
> Eleven animals confirmed. Handler Osei reports water clarity poor following yesterday's rain and requests a repeat count at 14:00.
>
> *Sir Aurelian has guests arriving at 11:00.*

> **MAINTENANCE LOG — 03/14**
> Replaced grate, culvert 4 (north). Previous grate found displaced, not damaged. No animals unaccounted for at time of inspection.
> Recommend reviewing what displaced it.

The client is never the hero. The crocodiles are never villains. The player is a professional in an impossible position, and the game's affection is entirely for them.
