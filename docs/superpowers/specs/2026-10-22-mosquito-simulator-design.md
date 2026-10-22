# Mosquito simulator — design

## Intent

The owner woke several times in the night to a mosquito around their nose, and was not bitten there. They
were bitten on the right arm, put anti-itch cream on, and hours later were bitten on the left arm. Sixteen
hours later both bites are itchy and swollen. This came after two months with no bites. They usually get
bitten a lot and wonder whether that comes from their blood type or their CO₂.

The page is a light-hearted edutainment simulator. Its core question is **which signals ("KPIs") a female
mosquito checks before she bites, and which weak signal makes her abandon a spot**. It also explains what
happens during a bite, why it itches and swells afterwards, what to do and not do about it, and why some
people get bitten more than others.

## Owner decisions

- A standalone HTML page in its own directory, three.js allowed, with a side panel of parameters like the
  other projects in the repo.
- Two modes:
  - **Auto:** watch how it plays out, mosquito vs human.
  - **Interactive:** the visitor is the mosquito.
- **This is not a game.** No collecting blood, no score, no maximising anything. The focus is the female's
  decision process and the KPIs that make her abandon a location.
- The mosquito may judge a landing spot as poor and leave for a better one. This must be visible.
- **No "play as male" mode.** Instead there is a **female vs male comparison** of their capabilities.
- Content requested by the owner:
  - What happens during a bite.
  - The itch and swelling afterwards.
  - Do's and don'ts: scratching, and creams that reduce itch and swelling.
  - "Why me?": blood type vs CO₂ and other factors.

## The decision model (core of the page)

The female passes a chain of gates. Each gate is a KPI shown as a live bar with a threshold line. Below the
threshold the gate turns red and she falls back to an earlier stage or leaves. Numbers are approximate
literature values and the page says so.

| Stage | KPI | Failure → behaviour |
|---|---|---|
| Activation | CO₂ above background (≈400 ppm room). A rise of tens of ppm activates her, and pulsed breath beats a steady level. | Resting / random flight |
| Plume tracking | Plume contact rate while surging upwind | Lost → cross-wind casting; casting timeout → gives up and rests |
| Visual | Dark-object contrast. This only counts once CO₂ has activated her. | Keeps searching |
| Odour | Skin blend: lactic acid, carboxylic acids, ammonia. Airborne repellent subtracts. | Veers away and re-targets another body part |
| Thermal / humidity | Skin minus air temperature, plus moisture, within about 1 m | Won't land on cool or covered areas |
| Landing (contact) | Leg-taste (repellent on skin), surface (hair, cloth thickness vs ~2 mm proboscis) | Takes off and picks another spot |
| Safety | Host movement, breath gusts on the face, twitches | Flees. Each spot keeps an "avoid" memory that decays. |
| Probing | Time to find a vessel, blood cues at the tip (ATP, salts) | Withdraws and reprobes. After N failed probes she moves to a new spot. |
| Feeding | Interruptions | Interrupted → partial meal → she comes back later. Full → leaves to rest for days. |

The owner's night must emerge naturally under the default parameters. The face gets many approaches,
because breath is the CO₂ source, but it fails the safety gate (breath gusts, twitches, half-waking). Arms
that lie still outside the blanket pass every gate. A disturbed partial meal leads to a second bite hours
later on another limb. The page offers "same mosquito, interrupted" as one plausible explanation of the
two bites, with "two mosquitoes" as an equally possible one.

## Scene and modes

- **3D bedroom at night (three.js):** a bed, a sleeping human in a stylised low-poly style, a blanket
  covering the body with the arms outside, a window, and an optional fan. The female mosquito is a
  stylised model with a proboscis and a wing-blur. The camera follows the mosquito with orbit controls,
  plus preset views.
- **Visualised fields** (toggleable):
  - CO₂ puffs from the nose and mouth on each breath, drifting with room air and diffusing (particles).
  - The skin odour cloud.
  - A heat halo.
  The mosquito's KPIs are sampled from these same fields.
- **The human:**
  - Breathing cycle, occasional twitches and turning over.
  - A face that is more sensitive than the arms.
  - An arousal level: twitch, then half-wake and swat, then fully awake.
  - The bites show as growing bumps.
- **Auto mode:** the mosquito AI runs the gate model, at a selectable time speed.
  - Mosquito thoughts appear as short captions, and the human mutters.
  - An event log lists landings, rejections and the reason for each, probes, bites and swats.
- **Scenario "Your night":** a preset that replays the owner's night, with a night clock running from
  23:00 to 07:00. It plays out from the model, not as a canned animation.
- **Interactive mode:** the visitor flies her with keyboard and mouse, using one key to land and one to
  probe. The same gate panel shows what she would be "thinking". Landing on a spot that fails a gate is
  allowed, and the panel shows why she'd reject it. There is no score.

## Side panel (parameters)

- **Person:**
  - Breath rate and body size (together these set CO₂ output).
  - Skin temperature.
  - Sweat / exercise.
  - Skin-acid level ("mosquito-magnet" skin chemistry).
  - Beer.
  - Pregnancy.
  - Blood type. By default it has **no effect** (owner decision). A switch labelled "weak evidence" turns
    on the small type-O landing preference from the single study (Shirai et al. 2004, *Aedes albopictus*).
    It enters as a modest odour multiplier, the secretor route, and the label says how thin the evidence
    is.
  - Repellent on skin (none, DEET, picaridin).
  - Blanket coverage.
  - How restless the sleeper is.
- **Room:** fan / airflow, window, temperature, and humidity.
- **Mosquito:** sensitivity thresholds for each gate (advanced), and the probe-attempt limit.
- **Display:** toggles for the fields, time speed, and reset.

## Explainer content (below or beside the app)

1. **How she finds you:** the gate chain in plain language.
2. **Female vs male:** a side-by-side comparison card, illustrated with both 3D models. It covers:
   - mouthparts (piercing stylets vs blunt)
   - antennae (smell vs hearing: feathery male antennae)
   - diet (nectar for both, blood for egg protein in females)
   - wingbeat pitch (female ≈400–600 Hz, male higher)
   - lifespan (male ~1 week, female weeks with several egg cycles)
   - what each is "for"
3. **During a bite:**
   - The six stylets.
   - Saliva: anticoagulants, vasodilators and foreign proteins.
   - Searching for a vessel.
   - Blood sensing at the tip.
   - Up to ~2–3× her body weight in blood.
   - Stretch receptors that tell her she is full.
4. **Afterwards:** an interactive "hours after the bite" timeline (0–72 h) on a close-up of the skin.
   - The immediate antibody/histamine wheal within minutes.
   - The delayed immune-cell reaction peaking around 24–48 h.
   - Why a two-month break can make reactions stronger again (hedged).
   - Toggles for scratching, cold pack and hydrocortisone show their effect on the bump curve. The curve is
     illustrative, not measured.
5. **Do's and don'ts:**
   - Don't scratch.
   - Use a cold pack, hydrocortisone 1%, oral antihistamines (cetirizine/loratadine) for strong reactions,
     or a pharmacy anti-itch gel.
   - Heat pens have weak evidence. Home remedies such as toothpaste don't really work.
   - See a doctor for spreading redness, fever, pus, or swelling still growing after 2–3 days.
   - A "not medical advice" line.
6. **Why me?**
   - CO₂ output and body size.
   - Skin carboxylic acids and microbiome (the strongest "mosquito magnet" evidence).
   - Heat and sweat, beer, pregnancy.
   - Genetics.
   - Blood type: limited, mixed evidence, mostly from one small study suggesting type O.

## Builder calls (mine)

- **Directory and files:** `3d-mosquito-simulator/` with a single `index.html`, plus `test.mjs` and
  `screenshot1.jpg`.
- **three.js:** three.js 0.170.0 from jsdelivr via an importmap, matching the newer projects in the repo.
- **Tests:** the pure model goes in a `<script id="shared-code">` block, and `test.mjs` runs it in Node.
  The model covers the plume and field sampling, the gate evaluation, the mosquito decision state machine
  and the bump timeline. The tests include a regression showing that the default "Your night" seeds lead
  to face rejections and arm bites.
- **"Your night" fidelity:** the shape must emerge, not the exact script:
  - several face approaches that are rejected, at least one of which half-wakes the sleeper
  - then an arm bite
  - then a second bite on another limb, typically hours later
  Exact counts are not required. The preset is the default parameters with the night clock. The
  regression test runs 10 fixed seeds and requires the shape on at least 8 of them.
- **Number of mosquitoes:** a room slider for 1–3, default 1. Each mosquito has its own avoid memory, and
  the camera follows the selected one. "Same mosquito, interrupted" vs "two mosquitoes" is then something
  the visitor can try.
- **Cream in the scenario:** when the sleeper fully wakes after a bite, they apply cream to that spot,
  which shows on screen and starts the itch curve. The cream has **no** effect on the mosquito's gates
  (hydrocortisone isn't a repellent). Any switch to the other arm comes from the disturbance, the avoid
  memory and an interrupted partial meal.
- **Time:** a speed slider, plus "skip quiet stretches", which fast-forwards while the mosquito rests or
  digests and nothing is happening. The simulation runs on a fixed step, and the night clock maps sim
  seconds to minutes when time is compressed.
- **Interactive consequences:**
  - A swat that connects shows "Swatted. She'd have learned to avoid this spot." and respawns her on the
    window sill.
  - A full meal ends with her flying off to rest, and then a reset prompt.
  - No score, lives or win screen.
- **Humour:** light and secondary to the science. It comes from deadpan mosquito thought captions and
  sleepy human mutters, never a score or "targets".
- **Layout and style:** the same dark side-panel layout as the other projects, and a HiDPI canvas.

## Non-goals

- No scoring, blood meter as goal, or win state.
- No play-as-male mode.
- No disease transmission (malaria, dengue) beyond a one-line mention.
- No anatomically detailed human.
- No real medical diagnosis.

## Anti-goals

- A gamified "collect blood" experience.
- Presenting the blood-type claim as settled.
- A page where the owner's night does not emerge from the default model.
