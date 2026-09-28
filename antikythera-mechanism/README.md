# The Antikythera Mechanism

A standalone page for turning the Antikythera Mechanism. Drag the crank or
pick a date, and watch it work:

- **The front Cosmos:** zodiac, Egyptian calendar, and rings for the Sun, the
  Moon and the five planets.
- **The back calendar and eclipse dials:** the Metonic and Saros spirals, with
  the Games, Callippic and Exeligmos dials.
- **The gearing in 3D:** 67 gears at their CT-measured sizes. Click any gear
  to follow its train from the crank to its dial.

A table compares every pointer with the real sky for the same date. It shows
how well the Greek model worked, and how it drifts once it has been set.

Open `index.html` in a browser. Three.js loads from jsDelivr; the rest of the
page is self-contained.

## Where the numbers come from

- **Surviving gearing:** Freeth et al., Nature 2006 and 2008, as compiled by
  S. Shambaugh. This covers the crank, the Main Drive Wheel b1 (223), the
  Moon train with its pin-and-slot lunar anomaly (axes 1.1 mm apart, pin
  9.6 mm out, ±6.5°), and the Metonic, Games, Callippic, Saros and Exeligmos
  trains. Pitch radii are the CT measurements in Table S8 of Freeth et al.
  2021.
- **Front Cosmos:** Freeth et al., *A Model of the Cosmos in the ancient Greek
  Antikythera Mechanism*, Scientific Reports 2021. This gives the period
  relations (Venus 289/462 and Saturn 427/442 from the inscriptions), the
  gear trains of Fig. 3, the pin geometry of Table S9, the ring display, and
  the Dragon Hand for the nodes, which the authors call hypothetical.
- **The sky:** JPL / Standish approximate elements (3000 BC–AD 3000),
  Meeus's lunar theory, and ΔT from Espenak & Meeus.

## What is this page's own

These choices are the page's, and each is labelled on the page:

- the year of 365.25 days per turn of b1;
- the arbor positions in 3D, placed by meshing distance;
- the true Sun's eccentricity, taken from Hipparchus;
- the Moon phase, computed directly instead of through its two unmodelled
  gears;
- where the intercalary months fall on the Metonic spiral;
- the Saros eclipse glyphs, marked by a simple node-distance rule.

## Tests

```bash
node test.mjs
```

The engine lives in the `<script id="shared-code">` block of `index.html`, and
`test.mjs` runs its 24 tests under Node. They check that:

- every tooth count reproduces its published cycle: the sidereal month, the
  Metonic, Games and Callippic cycles, the Saros and Exeligmos, the apsides
  and the nodes;
- every planetary train reproduces its period relation;
- the lunar anomaly reaches ±6.5°;
- Venus and Mercury reach their maximum elongations;
- Mars goes retrograde;
- the calendar conversions are right;
- the ephemeris agrees with J2000 positions;
- the mechanism matches the sky exactly at calibration, and stays within the
  expected error for a century on either side of it.
