# How continuous tracks work — short design

**Intent.** A standalone page, `continuous-track/index.html`, that demonstrates how continuous
track (caterpillar) vehicles work. Interactive, many parameters, three.js (the owner's request).

**Approaches considered.**
1. *Drive it on a proving ground (chosen by the owner).* One tracked vehicle driven with two
   track levers over slope, step, trench, bumps, side slope and soft ground.
2. *Mechanism on a test stand.* Anatomy of the running gear on a rolling road. Rejected: shows
   the parts but not why tracks are used.
3. *Chaptered tour.* Several small scenes. Rejected: each scene would be shallow.

**Design.** A shared-code physics block (tested in Node) and a three.js view.

- Hull: one rigid body in 3D. Each road wheel has its own spring and damper (independent, bogie
  pairs on a rocker, or rigid). Sprocket, idler and the sloping front and rear track spans are
  stiff contacts, so the approach span is what climbs a step.
- Track: each belt has its own speed. Thrust comes from soil shear under each wheel station
  (a brush model that reduces to Wong's shear-displacement curve), limited by c·A + N·tan φ.
  Sideways scrub in a turn comes from the same model.
- Soil: Bekker pressure-sinkage per wheel station, with compaction resistance.
- Steering: independent drives, clutch-and-brake, controlled differential, double differential.
- View: every link travels round the real path (sprocket, idler, road wheels, return rollers,
  sag), one link is highlighted, arrows show ground load and traction, links can be coloured by
  tension, the hull can be made see-through. Charts: load per wheel, belt speeds, thrust-slip.
  A table compares the same weight on tyres.
- Presets: main battle tank, bulldozer, snow groomer, WWI rhomboid, tracked carrier, Christie
  fast tank.

**My calls.** Custom physics instead of a link-by-link rigid-body chain (stable, fast, and the
quantities of interest are explicit). The belt path is kinematic; tension is estimated from the
sprocket force. No game mechanics. The page lists its simplifications.

**Left to later.** Link-by-link chain dynamics and thrown tracks, elevated-sprocket layouts,
interleaved road wheels, bulldozing resistance, sound.
