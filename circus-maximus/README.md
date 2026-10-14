# Circus Maximus — Known Issues

`index.html` is a 3D rebuild of the Circus Maximus about AD 103. This file
lists what is still open after the first build (2026-10-14): things to judge
by eye or ear, known minor bugs, and simplifications that were decided on
purpose. Design and plan: `docs/superpowers/specs/2026-10-14-circus-maximus-design.md`
and `docs/superpowers/plans/2026-10-14-circus-maximus.md`.

## To judge by eye or ear

- **Near crowd hides the near track.** The rows in front of your seat stand
  up as the leaders pass, which is realistic but covers part of the
  Aventine-side straight. They could be kept seated within about 8 m of the
  camera.
- **Raised arms read like poles.** The crowd figures' arms are thin straight
  strokes.
- **The 1998 Palatine ruins look like toy blocks up close.** They are boxes
  with a brick-arch texture on every face.
- **Sound has not been listened to.** It has only been checked with a level
  meter. The crowd, hooves, trumpets and 1998 traffic may need tuning by ear.
- **The crowd is smaller than the real one.** It has about 86,000 figures,
  not the 150,000 the circus held (the "About" panel says so).

## Known bugs (minor)

- **Status line after the cutoff.** The finish status ("X won; N wrecks") is
  written once, 25 s after the winner. Wrecks after that point, including
  your own, don't update it. Only the button changes to "Race again".
- **A stopped player keeps the race open.** If you rein in to a standstill
  without crashing, the race never ends on its own. Stop and Start still
  work.
- **Ride along shows the red speed warning for the AI driver.** You can't act
  on it in that role.
- **Touch: a finger held across "Next race" stops steering** until it is
  lifted and pressed again. Two fingers on the same button: lifting one
  releases it. Keyboard and touch share the same key state.
- **Simultaneous finishers** are ranked by internal order, not by who crossed
  further.
- **Follow the leader** leaves the zoom narrow if a day ends while it is
  ticked.

## Look and rendering

- At deep zoom the panorama goes soft. The cube faces are 1280 px and not
  antialiased.
- There is a faint fog crease along the cube-face seams, visible in the
  bottom corners at some sizes.
- The arcade texture on the outer façade is stretched.
- In the 1998 view the hollow's edge is a little stepped (10 m ground grid),
  the road height is fixed rather than following the ground, and the passing
  cars on each side share one lane.
- The crowd figures have hard, unantialiased edges and can shimmer at a
  distance.
- The HUD's lap counter shows only eggs; the barrier shows both eggs and
  dolphins.

## Simplifications chosen on purpose

- One building for every race day: the Trajanic circus. Caesar's (46 BC) and
  Totila's (AD 549) games are shown in a circus they never saw; only the
  obelisks change.
- All four faction colours race on every day.
- Wrecks are dragged to the outer wall 1.5 s after a crash instead of staying
  in the lane. Without this, AI races averaged 12 crashes.
- The finish line is placed in front of the Aventine stands for the view.
  The early rule that drivers kept to their lanes is left out, and the angled
  starting gates are not modelled.
- The racing is a game, not a measured simulation, and the 1998 view is
  reconstructed from photographs, not surveyed (both stated in the "About"
  panel).

## Testing

```sh
node circus-maximus/test.mjs
```

Headless Chrome renders the WebGL canvas but leaves it out of
`--screenshot` here. Stills go through `window.__circus.shot()`, which lays a
`toDataURL` image over the canvas. Headless virtual time also freezes the
audio clock, so check sound in a real browser.
