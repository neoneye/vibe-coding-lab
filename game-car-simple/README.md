# Lithium

A desktop revival of *Lithium*, an unfinished iOS car prototype from 2016 (SpriteKit). Tune the car with
sliders, press Start, and watch it drive itself. Reach 10 to clear the track. The idea comes from the
2016 concept deck: *it's addictive to tweak sliders over and over and see how the new vehicle behaves
and if it passes the track.*

- **Garage:** 11 sliders. Wheel sizes front and rear, wheel type, motor speed and torque, leg length,
  chassis width and height, suspension, cargo, booster fuel.
- **Run:** Enter or click Start/Stop. Hold Space for the booster and use ← → to tilt.
  M mutes (the help line shows "sound on" or "muted"), R restarts a run (also during the brief game-over
  pause), 1–5 picks an unlocked level. Stop and R keep the best score reached so far. Sound is suspended
  while the tab is hidden. The win flash is fast, like the 2016 prototype's; with the system setting
  "reduce motion" it is three slow flashes (200 ms each) instead.
- **Levels:** Bumps, Steep places, Pitfalls, Rope bridge, Friction varies. Every level can be cleared
  with sliders alone; `test.mjs` checks one solution per level headless.

Built with three.js (flat orthographic rendering) and planck.js (Box2D port: wheel joints with a
suspension spring and a motor).

## Tests

    node test.mjs                                  # pure logic
    PLANCK_PATH=/path/to/planck.mjs node test.mjs  # plus headless physics (planck 1.5.1 dist/planck.mjs)

## Screenshot

    index.html?shot=1&level=1&t=8   # starts a run on level 2 and advances 8 s synchronously

## Known issues

- Booster fuel has no cost, so the maximum (5 s) is always best. The booster is strong: with good timing
  2 s of fuel carries even the default car across Pitfalls.
- Tilt (← →) turns the car about a quarter turn per second in the air, but on the ground it only shifts
  weight a little; it cannot pull a wheelie.
- A car that drops into a pit usually wedges against the far rim and ends as "stuck", not "fell".
- Cargo can fall off the bed; nothing counts it.
- The help line and the stats box overlap in windows narrower than about 800 px.
- Booster sparks still in flight survive a restart or slider change.
- No render interpolation between the 60 Hz physics steps, so motion is slightly uneven on 120 Hz displays.
- The motor hum and booster hiss keep running (silently) while muted; Safari may need a second key press
  before sound starts.
- A `?shot=1` run that ends writes its level and slider values to the saved progress.
