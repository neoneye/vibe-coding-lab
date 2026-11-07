# How Cooling Works — design (as built)

**Date:** 2026-11-07
**Page:** `cooling/index.html` (one self-contained 2D-canvas page, no dependencies)

## Intent

The owner asked for a standalone simulator that teaches how cooling works: what makes a fridge cool food down, and how to make a fridge in hot places without electricity (for example in Africa). They asked for lots of parameters.

The owner was not asked further questions. The scope and the choices below are mine.

## As built

### Tabs

1. **Fridge.** A vapour-compression fridge drawn in cross-section: cabinet, insulation, evaporator, capillary, condenser on the back, compressor, kitchen wall.
   - Refrigerant particles move around the loop. Their colour shows temperature; filled dots are liquid and rings are vapour, with the vapour quality worked out per section.
   - Power can be:
     - the mains;
     - solar with a battery;
     - solar direct drive with an ice bank (the WHO vaccine-fridge design).
2. **Zeer pot.** Pot-in-pot cross-section with wet sand, sweating clay, a lid (wet cloth, clay, straw or open), a shade roof, sun and wind, and vapour wisps.
3. **Kerosene fridge.** A diffusion-absorption (Platen–Munters) unit: boiler with flame, bubble pump, separator, condenser fins, evaporator, absorber, reservoir.
   - Separate particle flows for ammonia vapour, ammonia liquid, water and hydrogen.
   - Heat source: kerosene, LPG, a solar collector or an electric element.
4. **Night-sky ice.** A shallow pond with a straw bed, a shelter wall and a yakhchāl dome, under a sky that changes through the day.
   - Ice is harvested at 07:00 and the pond refilled at 17:00.
5. **Compare.** Runs the fridge, kerosene fridge and zeer pot for 72 h with each tab's own settings, against food left in the shade. It reports:
   - mean, minimum and maximum food temperature, and time in the ideal range;
   - shelf life;
   - what each one uses (kWh, L of kerosene, kg of gas, L of water);
   - ice per night for the pond.

**Shared across all tabs:**
- The **Climate** group: seven presets (rounded typical values, labelled as such) or your own numbers.
- The **Food** group: six foods, each with an ideal range, Q10 and shelf life.
- The **Temperature ladder**: markers plus arrows showing heat flowing down and being lifted.
- The readouts, and a 6 to 72 h chart with night shading and the food's ideal band.
- 13 situations (scenarios). Settings are kept in the URL hash.

### Physics (CoolCore, in the shared-code block)

- **Psychrometrics:**
  - Buck saturation pressure, over water and over ice.
  - Wet-bulb temperature by bisection on the ASHRAE psychrometric equation.
  - Sky emissivity from Berdahl–Martin, using the dew point, with a cloud term.
- **Climate:** cosine day curve with the minimum at 06:00 and the maximum at 15:00. The dew point is constant. Sun and wind follow the hour.
- **Cabinets:** a box 1.6 times as tall as it is wide; UA from k·A_mean/L plus a seal leak. Door openings at fixed times each day exchange a fraction of the air, carrying both sensible and latent heat.
- **Food and ice bank:** enthalpy with a freezing plateau, so the bank holds at 0 °C and food can freeze.
- **Compressor cycle:**
  - Q_e = η · W · T_e / (T_c − T_e). T_e is solved by bisection against the evaporator UA.
  - The condenser is a thermal-mass node, so T_c ramps up over a few minutes. Above 75 °C an overload cut-out stops the compressor for 20 minutes.
  - Refrigerant pressures come from a two-point Clausius–Clapeyron fit (normal boiling point and 40 °C).
  - PV power is derated by cell temperature. Direct drive needs 35% of rated power to start.
- **Absorption:**
  - The boiler warms up first and then holds at its set temperature.
  - COP = η · (1 − T_a/T_g) · T_e/(T_a − T_e), where T_a is the air temperature plus the fin temperature rise.
  - The thermostat turns the flame down to 25%.
  - Kerosene at 34.6 MJ/L with a 50% burner; LPG at 46 MJ/kg.
- **Zeer:** a sand node and an inner node.
  - Evaporation by the Lewis analogy, E = h_c/c_p · A_wet · (ω_s − ω_a).
  - Convection plus linearised radiation to the air, sun on the pot, and ground contact.
  - Sand conductivity rises with wetness. The lid changes how heat reaches the inside.
  - Watering refills the sand to saturation.
- **Sky pond:**
  - Radiation εσ(T_w⁴ − (F·ε_sky + 1 − F)·T_a⁴), where the wall removes 8% of the sky view.
  - Convection and evaporation (or sublimation), reduced by the wall.
  - Bed conduction to the ground at the mean temperature + 2 K.
  - Sun by day, cut by the shade mat.

### Tests

`node cooling/test.mjs` runs 435 checks:
- psychrometric values;
- the climate curve;
- refrigerant pressures within about 10% of table values;
- enthalpy round trips;
- parameter ranges, scenarios, and hash round trip;
- cycle energy balance and the Carnot bound;
- behaviour:
  - the kitchen fridge holds 4 °C at 0.15 to 1.2 kWh per day;
  - thicker insulation saves energy;
  - direct drive keeps vaccines in range, and fails without its ice bank;
  - the kerosene fridge uses 0.2 to 2 L per day;
  - the zeer cools in dry air, stays above the wet bulb, and does little on the humid coast;
  - a dry, sunny or glazed zeer is warmer;
  - the clear-night pond makes ice while the air stays above 0 °C, and less when cloudy, warm or on bare earth.

## Tuning notes

- The condenser needed thermal mass. With an instantaneous T_c, a dusty fridge tripped on every start and never cooled.
- At 25% flame, an absorption unit's evaporator sits near the box temperature, which gives a high COP. A default efficiency of 0.12 of ideal gives COP 0.2 to 0.4 at full flame, in line with real units.
- The ice pond's shelter wall first removed 30% of the sky and cost ice. Low sky is nearly as warm as the air anyway, so it is now 8%.
  - In very dry air, wind speeds up evaporation, so the wall can still cost a little ice. The page says so.
- The Kerman preset has a night low of +1 °C, so the page shows ice forming while the air never freezes.

## Verified

- **Chrome (Browser pane):** every tab, all scenarios, randomize, and the Save PNG blob.
- **Chrome headless:** 1600×1000 shots of each tab.
- **Firefox headless:** the zeer tab.
- **Phone width (375 px):** no horizontal scroll.
- **Not checked:** Safari.
