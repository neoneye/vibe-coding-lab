# Mosquito Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A self-contained three.js page in which a female mosquito hunts a sleeping person through a
chain of KPI gates, in Auto and Interactive modes, with explainers on bites, aftermath, female vs male, and
"why me?".

**Architecture:** One `3d-mosquito-simulator/index.html`.
- **Pure simulation core:** sits in `<script id="shared-code">`. It has no DOM and no three.js, and is
  exposed as the global `MosquitoSim`. It covers the puff/field model, the gates, the mosquito and human
  state machines, and the bump curve.
- **Tests:** `test.mjs` runs `MosquitoSim.Tests.run()` in Node.
- **Rendering:** a module script that only reads the world state and draws it, plus the side panel, the
  KPI overlay and the explainer.

**Tech Stack:** three.js 0.170.0 via an importmap on jsdelivr, plain JS, and Node for the tests.

**Spec:** `docs/superpowers/specs/2026-10-22-mosquito-simulator-design.md`

## Global Constraints

- One self-contained `index.html`. The only external resource is three.js 0.170.0 from jsdelivr, and the
  page shows an error card if it fails to load.
- **Not a game:** no score, no lives, no win screen, and no blood-collection goal.
- No play-as-male mode.
- The blood-type effect is off by default. The switch is labelled "weak evidence" and cites Shirai et al.
  2004.
- The cream has no effect on the gates.
- All numbers on the page are labelled approximate or illustrative where the spec says so. The page
  includes a "not medical advice" line.
- The visual style follows the dark card side panel of `3d-animal-haircut/index.html` (`#panel`, `.card`,
  collapsible `h2`). The canvas uses a HiDPI backing store.
- Commit to `main`. The commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Extreme slider combinations**, such as blanket 100%, DEET on, fan at max, or 3 mosquitoes. The sim
   must never produce NaN positions, and she must never stay stuck forever. With every spot covered she
   rests after giving up, and the log says why. Test: `extremes stay finite`.
2. **Large `dt` from a backgrounded tab or a high speed setting.** The fixed-step accumulator caps the
   number of substeps per frame, so a frame never runs more than 2000 steps. Test: `skipQuiet + long run
   finite`.
3. **Reset or parameter change mid-feed.** The world is rebuilt from the params and nothing goes stale.
   The UI rebuilds via `createWorld` and keeps no references to old mosquito objects.
4. **Mosquito leaving the room bounds.** Positions are clamped to the room box. Test: `stays in room`.
5. **Interactive mode with the mosquito selector set to a mosquito that no longer exists** after the count
   is lowered. The selection index is clamped on rebuild.

---

### Task 1: Simulation core + tests

**Files:**
- Create: `3d-mosquito-simulator/index.html`. In this task it holds only the HTML skeleton plus the
  shared-code block.
- Create: `3d-mosquito-simulator/test.mjs`, a copy of `3d-animal-haircut/test.mjs` with `MosquitoSim.Tests`.

**Interfaces (produces):**

**Constants and parameters**
- `MosquitoSim.ROOM = {min:[-2.5,0,-2], max:[2.5,2.6,2]}`, in metres. The bed is centred near the origin,
  the head at +x and the window at -x.
- `MosquitoSim.defaultParams()` returns:
  - `person:{breathRate:14, bodySize:1, skinTemp:34, sweat:0.2, skinAcids:0.6, beer:false, pregnant:false,
    bloodType:'A', bloodTypeEffect:false, repellent:'none'|'deet'|'picaridin', blanket:0.6, restless:0.5}`
  - `room:{fan:0, window:true, airTemp:22, humidity:0.5, mosquitoes:1}`
  - `mosq:{co2Activate:8, plumeTimeout:20, visualMin:0.1, odourMin:0.25, heatMin:0.5, disturbMax:0.5,
    maxProbes:5}`
  The CO₂ threshold is an excess in ppm and the heat threshold is in °C.

**The world**
- `MosquitoSim.createWorld(params, seed)` returns a world: `{t, params, rng, human, mosquitoes:[...],
  puffs:[...], events:[...], bites:[...]}`.
- `t` is sim seconds since 23:00. `MosquitoSim.clockString(t)` returns `"HH:MM"`.
- `human = {spots:[{id, label, limb, pos:[x,y,z], exposed, sensitivity, odour, vascular}], arousal:0..1,
  state:'asleep'|'stirring'|'halfAwake'|'awake', breathPhase, moveTimer}`. The spot ids are `nose`,
  `forehead`, `neck`, `rForearm`, `rHand`, `lForearm`, `lHand`, `feet`.
  - The blanket covers `feet` always, `neck` when `blanket > 0.8`, and the forearms when
    `blanket > 0.95`.
- `mosquito = {id, pos, vel, state, stage, targetSpot, avoid:{spotId:number}, probes, fill:0..1,
  restUntil, kpis, thought}`.
  - `state` is one of `'resting'|'activated'|'tracking'|'casting'|'approach'|'landed'|'probing'|'feeding'
    |'fleeing'|'digesting'`.

**Stepping and sensing**
- `MosquitoSim.step(world, dt=0.05)` advances everything and pushes events
  `{t, mosquitoId, type, spotId, reason}`.
  - The event types are `activate`, `lostPlume`, `giveUp`, `land`, `reject`, `probe`, `bite`,
    `interrupted`, `full`, `swat`, `wake`, `cream`.
- `MosquitoSim.skipQuiet(world)` jumps `t` to the earliest `restUntil` when every mosquito is
  resting/digesting and the human is asleep. It clears the puffs and re-seeds 30 s of breath. It returns
  the number of seconds skipped.
- `MosquitoSim.sense(world, pos)` returns `{co2:excessPpm, odour, heat:°C above air, humidity, visual,
  wind:[x,y,z]}`.
- `MosquitoSim.gates(world, mosquito)` returns
  `[{id:'activation'|'plume'|'visual'|'odour'|'heat'|'contact'|'safety'|'probing', label, value,
  threshold, pass, active}]`. The `active` field marks the gate for the mosquito's current stage.

**Aftermath model**
- `MosquitoSim.bumpCurve(hours, {scratch, cold, hydrocortisone, antihistamine, longBreak})` returns
  `{wheal, delayed, size, itch}`. All values are 0..1 and illustrative. The immediate wheal peaks at about
  0.3 h, and the delayed reaction peaks at about 24–36 h.

**Interactive control**
- `MosquitoSim.setControl(mosquito, {thrust:[x,y,z]|null, land:boolean, probe:boolean})`. A non-null
  control replaces the AI for that mosquito, and the gates still evaluate.

**Model decisions** (from the spec, which the implementer cannot infer)

- **Breath puffs.**
  - A puff is emitted at the nose on each exhale, with `Q = 20 ppm·m³ × bodySize × (pregnant?1.2:1) ×
    (beer?1.1:1) × (1+sweat×0.5) × 14/breathRate`.
  - The puff is a Gaussian: `excess = Q/((2π)^1.5 σ³)` with `σ = 0.04 + 0.06·age^0.6`. Puffs are dropped
    after 90 s.
  - Puffs advect with the wind: a room drift of 0.06 m/s from the head toward the window (−x), the fan
    adding up to 0.3 m/s along −x, and a buoyant rise of 0.02 m/s.
- **Odour.** `Σ exposed spot.odour × skinAcids × (0.5+sweat) × (beer?1.15:1) × bloodMult /
  (1+(d/0.6)²)`.
  - `bloodMult` is 1.0, or 1.25 for type O when `bloodTypeEffect` is on.
  - A repellent subtracts 0.6 × `1/(1+(d/0.25)²)` near the treated spots. The treated spots are all the
    exposed ones.
- **Heat.** `(skinTemp−airTemp)·exp(−d/0.15)` for the nearest exposed spot.
- **Plume behaviour.**
  - A "hit" is `co2 > co2Activate`. On a hit she surges upwind (−wind) at 0.6 m/s with jitter.
  - With no hit for 1 s she casts crosswind with a widening zig-zag.
  - After `plumeTimeout` seconds of casting she `giveUp`s and rests for 5–20 min.
- **Approach.** Within 2 m she switches to `approach` if `visual ≥ visualMin`. She picks the spot that
  maximises `odour×heat×(1 − 0.25·avoid[spot])`.
  - The nose and forehead score highest by default (CO₂ and heat).
  - Odour failure → re-target.
  - When she reaches 3 cm she evaluates the contact and safety gates.
- **Contact gate.** It fails if the spot is covered (cloth 5 mm > proboscis 2 mm) or a repellent is on the
  skin.
- **Safety gate.** The disturbance value combines several sources:
  - the breath gust (nose/forehead during exhale ≈ 0.6)
  - the human's limb movement (`moveTimer` active on that limb = 1)
  - the arousal × 0.5
  If it is above `disturbMax` she flees, `avoid[spot] += 1`, and the avoid value decays with a 10 min
  half-life.
- **Human arousal.**
  - A landing on the face adds `0.25×sensitivity`.
  - The whine within 0.3 m of the head adds 0.02/s.
  - Arousal decays 0.01/s.
  - Arousal above 0.3 → stirring (head turn), above 0.6 → halfAwake (swat near the face, mosquito hit
    with p 0.5 within 0.25 m), above 0.85 → awake.
  - Random turning over happens at the rate `restless × 1/20 min`. It moves arms and interrupts feeding.
- **Probing.** Each probe finds a vessel with probability `vascular×0.25` per second, and gives up after
  10 s. After `maxProbes` probes she rejects the spot (`avoid += 2`).
- **Feeding.**
  - It takes 120 s to reach `fill=1`.
  - An interruption below 0.9 gives `interrupted`: she flees and rests 30–150 min, then hunts again.
  - At `fill ≥ 0.9` she is `full`, goes `digesting` for 48 h, and is effectively out of the night.
- **Bites and cream.** Each bite pushes `{spotId, t}`. 10–25 min after a bite the itch adds
  `0.5 + 0.3×sensitivity` to arousal. If the human goes `awake`, they `cream` the newest bite, then sleep
  again after 3 min.

**Steps**

- [ ] **Step 1: Write the tests in `MosquitoSim.Tests.run()`.** The run returns a boolean and logs each
  result.
  - `params default`: `defaultParams().person.bloodTypeEffect === false`.
  - `co2 decays with distance`: one puff at the origin gives `sense` co2 at 0.2 m > at 1 m > at 3 m, and
    all are ≥ 0.
  - `contact gate fails on covered spot`: `feet` contact `pass === false`.
  - `contact gate fails with DEET`: `rForearm` contact fails when `repellent='deet'`.
  - `safety fails at nose on exhale`: nose disturbance > `disturbMax` during the exhale phase.
  - `blood type no effect by default`: the odour is identical for type O and A when the effect is off, and
    higher for O when it is on.
  - `bumpCurve shape`: the wheal peaks before 1 h, the delayed reaction peaks between 18–48 h, `scratch`
    gives a larger size at 24 h, `hydrocortisone` gives a smaller delayed value at 24 h, and all values
    are in [0,1].
  - `cream does not change gates`: the gate values are equal before and after a `cream` event on the same
    world state.
  - `stays in room` and `extremes stay finite`:
    - 2 h of sim with blanket 1, DEET, fan 1 and 3 mosquitoes.
    - Every position stays finite and inside `ROOM`.
  - `skipQuiet + long run finite`: an 8 h run using `skipQuiet` finishes in under 15 s of wall time.
  - `your night shape`: seeds 1..10 with default params, run 23:00→07:00. At least 8 seeds must satisfy
    all of the following:
    - ≥2 `reject` events at `nose`/`forehead`, with reason `safety`
    - ≥1 human `stirring` or `halfAwake` before the first bite
    - the first bite is on a forearm or hand
    - ≥2 bites on different limbs
- [ ] **Step 2: Run `node 3d-mosquito-simulator/test.mjs`.** Expected: FAIL (MosquitoSim not defined).
- [ ] **Step 3: Implement `MosquitoSim`** to the interfaces and model above.
- [ ] **Step 4: Tune and re-run.**
  - Tune constants only within the model decisions until all the tests pass.
  - Note the final tuned values in a comment block at the top of the core.
- [ ] **Step 5: Commit** with the message `mosquito-simulator: simulation core with KPI gates and tests`.

### Task 2: 3D scene, side panel, KPI overlay, Auto mode

**Files:** Modify `3d-mosquito-simulator/index.html`.

**Interfaces:** Consumes everything in Task 1. Produces `window.__mq = {world, stepN(n), setMode(m),
render()}` for the headless screenshots.

- **Scene:**
  - A bedroom box with a moonlit window at −x, a bed and pillow, and an optional fan that spins with
    `room.fan`.
  - A stylised sleeper built from capsules and spheres: head on the pillow, blanket box, forearms and
    hands lying on the blanket. The arms hide under the blanket when `blanket > 0.95`.
  - Breathing scales the chest. Turning over rotates the head and moves an arm.
  - Bite bumps are red discs that grow with `bumpCurve`.
- **Mosquito mesh:**
  - Body, proboscis, six legs, flapping wings and thin antennae.
  - Drawn ×10 scale, with a "not to scale" note and a faint glow sprite so it can be seen.
  - The same builder takes `{male:true}`, which gives feathery antennae, long palps and no piercing
    proboscis. Task 4 uses this.
- **Fields:**
  - CO₂ puffs as blue additive points, sampled per puff within σ, with alpha scaled by the excess.
  - Odour as faint green points near the exposed spots.
  - A heat halo as orange sprites.
  - Each field has its own toggle.
- **Camera:** OrbitControls, with presets for Room, Follow mosquito and Face close-up.
- **Panel cards:**
  - Intro, plus the mode toggle (Auto / Fly).
  - Scenario: "Your night", Reset, the speed slider (1×–120×), "skip quiet stretches" and the night clock.
  - Person, Room, Mosquito thresholds (collapsed), Display.
  - Sliders rebuild the world with the same seed.
- **Right overlay:**
  - The gate stack: a bar per gate, a threshold tick, green/red colouring, and the active gate
    highlighted.
  - The followed mosquito's state and a selector when there are several mosquitoes.
  - The event log with the newest event first, reasons in plain words and clock times.
  - The sleeper's state.
- **Thought captions:** one deadpan line per state change, chosen from a list per event type. For example,
  on reject at the nose for safety: "Hurricane-force exhale. Abort." The sleeper mutters on stirring.
- **Loop:** a fixed-step accumulator with `dt = 0.05` and at most 2000 steps per frame, and `skipQuiet`
  when it's enabled.

- [ ] **Step 1: Build the scene and panel.** Run `node test.mjs`; it is expected to still pass.
- [ ] **Step 2: Headless check.**
  - Open with `?shot=1`, which pauses rAF, calls `__mq.stepN(...)` to 00:40 with seed 3, then renders.
  - Take a headless Chrome screenshot (plain `--headless=new`, absolute `--user-data-dir` in the
    scratchpad).
  - Inspect it visually: the sleeper, puffs and mosquito are visible, and the gate bars are filled.
- [ ] **Step 3: Commit** with the message `mosquito-simulator: 3D bedroom, KPI gate overlay, auto mode`.

### Task 3: Interactive (fly) mode

- **Keys:** WASD moves her relative to the camera heading, Space/Shift goes up and down, L lands on the
  nearest spot within 0.15 m, P probes, and Esc returns to Auto.
- **Camera:** follow cam behind her.
- **Gates:** the gate stack shows her live gates, with a hint line: "She would reject this spot: covered
  by blanket".
- **Swat:** a connecting swat shows a toast ("Swatted. She'd have learned to avoid this spot.") and
  respawns her at the window sill.
- **Full meal:** after a full meal she flies off with the "Resting for ~2 days" toast and a Reset button.

- [ ] **Step 1: Implement it, using `MosquitoSim.setControl` for the selected mosquito.** The other
  mosquitoes stay on AI.
- [ ] **Step 2: Check it in the Browser pane** via the gitignored `.claude/launch.json` "static" server on
  8765:
  - fly to the nose and see the safety gate go red
  - land on the forearm and probe
- [ ] **Step 3: Commit** with the message `mosquito-simulator: fly-the-mosquito interactive mode`.

### Task 4: Explainer sections

The explainer sits below the app, and a toggle-able "Learn" drawer scrolls to it. It has the six sections
from spec §"Explainer content", in that order.

- **Female vs male:**
  - A small second three.js canvas with both models slowly rotating side by side.
  - A comparison table covering mouthparts, antennae, diet, wingbeat, lifespan and "built for".
- **During a bite:** an inline SVG cross-section of skin showing the labium folding back, the six stylets,
  a vessel, and saliva dots. The text follows the spec.
- **Afterwards:**
  - A 2D canvas chart of `bumpCurve` from 0–72 h, with the immediate and delayed curves shown separately.
  - A skin close-up canvas whose welt radius and redness follow the hour slider.
  - Toggles for scratch, cold pack, hydrocortisone, antihistamine and "two-month break".
  - An "illustrative, not measured" note.
- **Do's and don'ts:** the spec list, plus the doctor criteria and "not medical advice".
- **Why me?** The factors ranked by evidence strength, with blood type last and labelled weak.
  - It has buttons that set the sliders, such as "Mosquito magnet skin" and "After a run + beer".
  - A link explains the owner's own night: the face approaches, the arm bites, and "one interrupted
    mosquito or two".

- [ ] **Step 1: Implement it.** Run `node test.mjs`; it is expected to pass.
- [ ] **Step 2: Screenshot the explainer region headlessly** and check the layout at 1400 px and at 390 px
  width.
- [ ] **Step 3: Commit** with the message `mosquito-simulator: explainer (bite, aftermath, female vs male,
  why me)`.

### Task 5: Gallery, README, screenshot

- [ ] **Step 1: Capture `screenshot1.jpg`** at 1600×1000, JPEG, from the `?shot=1` state.
- [ ] **Step 2: Update the gallery.**
  - Add the README "All experiments" entry in alphabetical order:
    `- [3d-mosquito-simulator](3d-mosquito-simulator/) -- ...`.
  - Run `python3 build_gallery.py` and confirm that `index.html` gains the card.
- [ ] **Step 3: Run `node 3d-mosquito-simulator/test.mjs`.** Expected: all pass.
- [ ] **Step 4: Commit** with the message `mosquito-simulator: gallery entry and screenshot`.
