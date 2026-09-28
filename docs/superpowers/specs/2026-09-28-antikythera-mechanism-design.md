# Antikythera Mechanism — dials and 3D gearing

Date: 2026-09-28
Directory: `antikythera-mechanism/`

## Goal

A page that lets you turn the Antikythera Mechanism with its crank, or set a
date, and watch it compute. It has two parts:

- **The dials,** drawn in 2D: the front Cosmos display and the back calendar
  and eclipse dials.
- **The gearing,** drawn in 3D: all 69 gears at their measured sizes, with an
  exploded view, and each train traceable from the crank to its dial.

The page also compares the mechanism's output with the real sky for the same
date, which shows how good the Greek model was, and how it drifts away from
the epoch it was set to.

## Sources

- **Freeth et al. 2021,** *A Model of the Cosmos in the ancient Greek
  Antikythera Mechanism*, Scientific Reports 11:5821, open access, and its
  Supplementary Information. The page takes these from it:
  - the front Cosmos trains and period relations (Fig. 3e–f);
  - the pin geometry (Table S9);
  - the measured gear radii and modules (Table S8);
  - the kinematic proofs (S4);
  - the ring display in customary cosmological order, and the Dragon Hand for
    the nodes. The paper calls the Dragon Hand hypothetical, and so will the
    page.
- **The surviving back gearing,** as established by Freeth et al. 2006 and
  2008 and compiled by S. Shambaugh (Wikimedia, CC BY-SA). This covers the
  a1 crank, b1–b3, the Moon train c–d–e–k, the Metonic train l–m–n, the Games
  gear o1, the Callippic train p–q, and the Saros and Exeligmos train
  e3–e4–f–g–h–i.
- **The lunar pin-and-slot:** k axes offset about 1.1 mm, the pin about
  9.6 mm from its axis, which gives ±6.5° (Freeth et al. 2006).

## The model

### Driving

Time drives b1: one turn is one year, and the page takes a year as 365.25
days, the Callippic year. The crank a1 (48 teeth) turns b1 (223 teeth), so a
full turn of b1 takes 223/48 turns of the crank.

### Gear graph

Every gear sits on an arbor, and every arbor is mounted on a *table*: the
frame, b1, the Circular Plate (which turns with b1), or e3. The page's solver
applies the Supplementary S4 laws:

- meshing gears turn as (b|T) = −(ta/tb)·(a|T), where T is the table that
  carries the epicyclic axis;
- gears on the same arbor turn together;
- (g) = (g|T) + (T).

It propagates rates outward from b1 and gets the mean rate of every gear.

### Variable outputs

The pin-and-slot devices give the variable outputs by geometry:

- **Moon:** the k1→k2 pin and slot on e3.
- **True Sun:** the pin on its gear-56 epicycle.
- **Mercury and Venus:** pin-and-slotted followers, using d and i from Table
  S9.
- **Mars, Jupiter and Saturn:** the indirect pin-and-slot devices, using d
  and o from Table S9, reduced to the proven vector form in S4.

### Front dials

- A zodiac, divided into twelve signs of 30°.
- An Egyptian calendar of 365 days: twelve months of 30 days and five extra
  days. It can be rotated, as the real ring could.
- The Cosmos rings: the Moon with its phase ball, the nodes (Dragon Hand),
  Mercury, Venus, the Sun (golden sphere and ray), Mars, Jupiter, Saturn, and
  the date pointer.

### Back dials

- **Metonic spiral:** 5 turns and 235 cells. The pointer follows the spiral
  groove.
- **Games dial:** 4 years, with the games named on it.
- **Callippic dial:** 4 × 19 years.
- **Saros spiral:** 4 turns and 223 cells.
- **Exeligmos dial:** thirds of a day, marked 0, 8 and 16 hours.

### Calibration

At the page's epoch, 23 December 178 BC, the page sets every output to the
real sky. That is the calibration date Voulgaris et al. (2022) proposed;
others have argued for dates near 205 BC.

### The real sky

- **Sun and planets:** JPL/Standish approximate Keplerian elements (valid
  3000 BC–AD 3000).
- **Moon:** mean elements plus the main periodic terms.
- **Lunar node:** the mean node.
- **ΔT:** the Espenak–Meeus polynomial.

The page shows each body's error: the mechanism minus the sky.

## The page's own parts, labelled

- **3D arbor positions.** The page places each gear by its meshing distance,
  which comes from the pitch radii. The CT gives real positions, but the page
  does not reproduce them.
- **Metonic month names.** The 12 Corinthian month names cycle in order. The
  cells of the 7 intercalary months are the page's own even spacing.
- **Saros eclipse glyphs.** The page computes these from its own rule: a
  syzygy within 12° of a node is marked Σ for a lunar eclipse or Η for a
  solar one. The real dial has 51 glyphs, from a Babylonian-style scheme.
- **Colours and materials.**
- **The year length.** The page takes a year as 365.25 days.

## Architecture

The page is a single `index.html`:

- **Engine:** in `<script id="shared-code">`, pure JS and tested by
  `test.mjs`. It holds the gear data, the solver, the pin-slot geometry, the
  dial readings, the Julian calendar and the ephemeris.
- **UI:** in a `<script type="module">`. It imports Three.js 0.170 from
  jsDelivr through an import map, as the repo's other 3D projects do.

## Tests

- Every tooth count reproduces its published period: the sidereal month
  254/19 per year, the Metonic 6939.5 d, the Games dial 4 years, the
  Callippic 27758 d, the Saros 1646.3 d per turn, the Exeligmos 19756 d, and
  the apsidal line 8.8826 years.
- The planetary gear trains reproduce their period relations: Venus 289/462,
  Mercury 1513/480, Saturn 427/442, Jupiter 315/344, Mars 133/284, and the
  nodes −5/93.
- The mean rate of each pin-and-slot output equals its input rate, and the
  lunar anomaly amplitude is 6.5°.
- The inferior planets' maximum elongation matches asin(p): about 46° for
  Venus and 23° for Mercury.
- Julian day conversions round-trip, and the ephemeris is sane at J2000.
- At the epoch, the mechanism and the sky agree.
- The Metonic and Saros cell indices advance once per lunation.
