# Continuous Track

How a tracked vehicle works: drive one over a proving ground and change almost
everything about it. Open `index.html` in a browser. It loads three.js from a
CDN, so it needs a network connection.

## What to try

- **Watch the orange link.** It is laid down at the front, lies still on the
  ground while the road wheels roll over it, and is picked up at the back.
- **Turn on the spot** on the open pad with "Arrows: traction and scrub" on. The
  front of each track is dragged sideways one way and the rear the other.
- **Change the steering gear.** Clutch-and-brake cannot turn on the spot, a
  controlled differential has one fixed turning radius, a double differential
  hands the inner track's power to the outer one.
- **Drive the six lanes**: slope, step, trench, bumps, side slope, soft ground.
  Raise the step or widen the trench until the vehicle fails.
- **Soft ground.** Put the tank and then the snow groomer on snow and compare
  the sinkage. The "Tracks or tyres?" table shows the same weight on tyres.
- **See-through hull** and the side view show the suspension working; try
  independent springs, bogie pairs on a rocker, and a rigid frame on the bumps.
- **Colour links by tension** and swap the sprocket between front and rear: with
  a front sprocket the whole top run is under drive tension.

Presets: tank, bulldozer, snow groomer, WWI rhomboid, tracked carrier, Christie
fast tank. 67 parameters.

## Controls

Two sticky levers on screen, one per track. Keys: `W S A D` or arrows, `Q Z`
left track, `E C` right track, `Space` brakes, `R` reset upright, `P` pause.

## The model

- The hull is one rigid body. Each road wheel has a spring and damper;
  sprocket, idler and the sloping front and rear runs of track are stiff
  contacts against a height-field ground.
- Each belt has its own speed. Thrust under each wheel station follows a
  shear-displacement law limited by c·A + N·tan φ; sideways scrub in a turn
  comes from the same law.
- Sinkage follows Bekker's pressure-sinkage law per wheel station, with
  compaction resistance.
- The engine is a power limit with an ideal transmission and a governor.

The page's "What is simplified" card lists what is left out: links are not
separate bodies, tension is estimated, soil numbers are textbook values typed
from memory, and step climbing is optimistic.

## Review hooks

URL parameters: any parameter name (`?stepH=1.2`), `preset=dozer`,
`goto=step`, `cmd=0.3`, `levers=0.5,-0.5`, `t=5` (seconds simulated before the
first frame), `cam=side`, `pause=1`. `__ct.step(seconds)` advances the
simulation from the console.

## Tests

`node test.mjs` runs the physics checks in the page's shared-code block.
