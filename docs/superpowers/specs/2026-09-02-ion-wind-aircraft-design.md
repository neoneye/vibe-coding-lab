# Ion-Wind Aircraft — Design

**Date:** 2026-09-02
**Directory:** `2d-ion-wind-aircraft/`
**Deliverable:** One self-contained `index.html` (no dependencies, works from `file://`), a `test.mjs` that runs the shared-code tests in Node, a `screenshot1.jpg`, and a `gallery.yaml` title override.

## Purpose

Explain how an aircraft with no propeller, no fan, no turbine and no moving parts pushes air. The page covers the two machines the owner has seen:

1. **The fixed-wing plane** — MIT's electroaerodynamic aircraft (Xu et al., *Nature*, Nov 2018): 5 m wingspan, about 2.5 kg, ±20 kV electrodes (40 kV across the gap) fed from 54 lithium-polymer cells, about 4.8 m/s, flights of up to 60 m across the duPont gym, ten-plus flights. Thrust was a few newtons for roughly half a kilowatt.
2. **The drone** — Undefined Technologies' "Silent Ventus" (Florida, 2021–2022): a flat frame whose whole body is two stacked electrode grids blowing ionic wind straight down. Flight times went 25 s → 2.5 min → 4.5 min; noise 90 → 85 → 75 dB (not silent yet).

Both use the same mechanism, **electroaerodynamic (EAD) propulsion**, also called **ionic wind**. The page teaches the mechanism once, then shows the two ways of pointing it.

## The mechanism (what the page must get across)

1. A very thin wire (the **emitter**) sits at a large positive voltage; a rounded, airfoil-shaped **collector** sits a few centimetres downstream at a large negative voltage.
2. The field is strongest at the wire's surface because the wire is thin. Above the **corona onset** voltage it rips electrons off nearby nitrogen and oxygen molecules, leaving **positive ions** (a corona discharge, the faint purple glow).
3. The field pushes the ions toward the collector. They do not fly freely: the mean free path in air is tens of nanometres, so each ion bumps into neutral molecules millions of times on the way and hands them its momentum. That is the **ionic wind**. Ions drift at ~100–200 m/s; the air as a whole moves at only a few m/s, because each ion shares its push with ~10¹⁰ neutrals.
4. At the collector the ions pick up an electron and become ordinary air again. The electrodes are pushed the other way (Newton's third law). No part moves; the only sound is the corona's faint hiss.

Numbers the page derives live (a deliberately simplified one-dimensional model, labelled as such):

- Corona onset `V0(d) = 2 kV/cm · d` (Peek-style: onset grows with gap; wire radius fixed).
- Current per metre of emitter (Townsend relation) `I' = C(d) · V · (V − V0)`, `C(d) = C5 · (5 cm / d)²`, `C5` chosen so that 40 kV across a 5 cm gap gives 0.64 mA per metre.
- Thrust per metre `T' = I' · d / μ`, ion mobility `μ = 2·10⁻⁴ m²/(V·s)`.
- Power per metre `P' = I' · V`, so **thrust-per-power `T/P = d / (μ V)`**: wider gaps and lower voltages are more efficient, but make less thrust per metre.
- Ion drift speed `v_ion = μ V / d`; bulk wind speed `v_air = √(T' / (ρ d))`, ρ = 1.2 kg/m³.
- Calibration check: 20 m of emitter at 40 kV / 5 cm gives ≈ 3.2 N and ≈ 512 W — the MIT plane's published figures (3.2 N, 6.25 N/kW).

## Page structure (single scrolling page, dark theme like `2d-tesla-valve`)

**Header.** Title, one paragraph: "no fan, no propeller — the air is pushed by electricity". Small legend of the two machines.

**1. One thruster stage** (canvas + controls + readouts).
Cross-section: emitter wire on the left (small bright dot with a purple corona halo), airfoil collector on the right, faint field lines between them. A particle simulation: grey neutral molecules drift slowly; near the emitter, when `V > V0`, ions are born (blue), race along the field to the collector, and each ion nudges the neutrals it passes (they gain a rightward drift and slowly relax). At the collector ions vanish with a small flash. A thrust arrow on the electrode pair points left (reaction). Sliders: **voltage** 0–40 kV (default 40) and **gap** 2–10 cm (default 5). Readouts per metre of emitter: onset voltage, current, thrust, power, thrust-per-power, ion drift speed, wind speed. Below onset the readouts show zero and the caption says "no corona — no ions — no wind".

**2. The airplane** (canvas).
Side view of an MIT-style glider: long thin wing, tail, four rows of emitter wires with airfoil collectors hung under the wing. Streamlines flow through the stages and leave rearward; the plane sits in a gym with a distance scale (0–60 m) and creeps forward at 4.8 m/s in a loop (wraps). Caption: thrust needed is only weight / (lift-to-drag), about a tenth of the weight, because the wing does the lifting. The reaction arrow and the wind arrow are labelled.

**3. The drone** (canvas).
Top-down-ish oblique view simplified to a side view: a flat square frame of two stacked grids, ionic wind arrows pointing down out of the whole body, craft hovers with a gentle bob; a 4.5-minute timer text and a noise badge. Caption: thrust must exceed the *whole* weight, roughly ten times what the plane needs, which is why it only hovers for minutes and needs the whole airframe to be thruster.

**4. How much wire would it take?** (calculator, uses the section-1 model).
Inputs: aircraft mass (0.5–5 kg, default 2.5), voltage and gap (shared with section 1), lift-to-drag for the plane (fixed 10). Outputs: metres of emitter needed for a plane and for a drone at that mass, plus the electrical power each would draw. Point made: the drone needs L/D times more wire.

**5. Notes.** Short bullets: why it is called solid-state propulsion, that it is nearly silent but not quite (corona hiss, ozone smell), the efficiency ceiling (thrust per power falls as voltage rises), and the sources.

## Code layout

- `<script id="shared-code">` — pure JS, no DOM: `IonModel` with `MU`, `RHO`, `onsetV(d)`, `current(V,d)`, `thrust(V,d)`, `power(V,d)`, `thrustPerPower(V,d)`, `ionSpeed(V,d)`, `windSpeed(V,d)`, `wireNeeded(massKg, mode, V, d)` (`mode` = `"plane"` uses L/D = 10, `"drone"` uses T = W). Plus `IonTests.run()` returning true/false.
- `test.mjs` — extracts the block with a regex and runs `IonTests.run()` (same as `pythagorean-cup/test.mjs`).
- Page script — three canvases sized in device pixels (retina), one rAF loop, particle sim for section 1, streamline animations for sections 2 and 3, calculator wiring. Sliders persist nothing (no localStorage needed).

## Tests (in `IonTests`)

1. Below onset: current, thrust, power are 0.
2. At onset: current is 0 (continuity).
3. Above onset: current and thrust increase monotonically with V.
4. `thrustPerPower(V,d) · μ · V ≈ d` for several (V,d).
5. MIT calibration: 20 m at 40 kV / 5 cm → thrust within 5 % of 3.2 N and power within 5 % of 512 W.
6. `wireNeeded` drone / plane ratio ≈ 10 (the L/D).
7. Wider gap at fixed V: less thrust per metre, better thrust per power.
8. `windSpeed` is a few m/s at the MIT point (between 1 and 5 m/s).

## Out of scope

Real 2-D electrostatics, ozone chemistry, battery modelling, control surfaces, a 3-D view.

## Addendum (same day): section 5, the high-voltage supply

Owner asked how such voltages are produced and whether the battery or a solar panel can be on board. Added between the wire calculator and the notes (notes become section 6):

- **Canvas:** the three-stage chain MIT flew: battery pack (54 cells, 200 V DC) → series–parallel resonant inverter (fast AC) → small step-up transformer (1 : 10, ±2 kV peak) → five-rung Cockcroft–Walton multiplier (+4 kV per rung → +20 kV) → emitter wires. Animated charge dots: DC flow, AC slosh, packets climbing the ladder one rung per half-cycle. Note that a mirrored ladder makes the −20 kV side.
- **Text:** why not one big transformer (ratio and insulation weight), high frequency shrinks the transformer, the ladder is diodes and capacitors, ~13 mA total so wires are thin but insulation (≈3 kV/mm in air) drives the layout, converter ≈ 0.5 kg for 600 W.
- **Battery card:** slider for pack mass (default 0.27 kg), `batteryEnergyWh = mass · 130 Wh/kg`, endurance at full thrust for the plane and drone from the section-4 power numbers.
- **Solar card:** sliders for panel area (default 2 m², the wing's upper surface) and sunlight (default 1000 W/m²), `solarPower = area · irradiance · 0.22`, shown as watts and as a percentage of what the plane and drone need, plus panel mass at 0.5 kg/m². Verdict on the card: plane marginal (noon, clear sky, panel weight, launch battery), drone no.
- Five new tests cover the three functions and the MIT pack calibration.

## Addendum (same day): section 6, more than 40 kV

Owner asked what happens above 40 kV. Changes:

- **Model:** `sparkV(d) = 1.2 kV/mm · d` (rough sparkover of a corona-stabilised gap in dry air) and `regime(V, d)` → `off` / `corona` / `arc`. `current` (and so thrust, power, wind) is zero outside the corona window. Six new tests (28 total).
- **Sliders:** voltage 0–100 kV, gap 2–15 cm. Section 1 draws a flickering bolt and a red sparkover caption when arcing; sections 2–5 say the gap is arcing instead of "below onset".
- **Section 6 "More than 40 kV?":** two small-multiple charts sharing the voltage axis, one series each (no dual axis): thrust per metre (rises ~V²) and thrust per watt (falls as 1/V), with the no-corona and arc regions shaded, an MIT 40 kV tick, a marker at the slider voltage, hover crosshair + tooltip, and a collapsible table at 10 kV steps. Text: what goes up, what goes down, the sparkover wall, the wider-gap way out (design by field, ≈ 0.8 kV/mm on the MIT plane), and why the ladder is not the limit but clearance, potting and stray corona are. Notes become section 7.
