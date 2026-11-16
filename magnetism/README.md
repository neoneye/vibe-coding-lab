# How magnetism works

A standalone explainer with three places to experiment. Open `index.html` in a
browser. The first two labs need nothing from the network; the ferrofluid view
loads three.js from cdn.jsdelivr.net.

## The three labs

1. **Fields and poles.** Place bar and horseshoe magnets (neodymium,
   samarium-cobalt, alnico, ferrite), electromagnets with or without an iron
   core, straight wires, soft iron, nickel or gadolinium, and compasses. Drag to
   move, drag the handle (or wheel, or R) to turn, Delete to remove. Field
   lines, iron filings, a needle grid, a strength map and the force on each
   magnet can be shown. A temperature slider from -200 to 900 °C weakens every
   material along its own curve, removes strength for good past its working
   limit, and switches it off at its Curie point.
2. **Inside the metal.** A two-dimensional Ising lattice: ferromagnet,
   antiferromagnet or paramagnet, with temperature, coupling, applied field,
   field sweep (hysteresis loops) and non-magnetic dilution. The order is
   plotted against Onsager's exact curve.
3. **Ferrofluid.** A dish of ferrofluid over a cylinder magnet, or between
   coils giving an even field. Magnet, fluid, dish, gravity and temperature are
   adjustable; the readout gives the field, the fluid's magnetisation, the
   magnetisation needed for spikes and their spacing.

70 parameters in all, counting those of each kind of object.

## How it works

- Magnets are modelled by the magnetic charge on their pole faces (4 x 4 point
  poles per face); wires by the field of a long straight current. Soft pieces
  are magnetised along their length by the field of everything else, up to
  saturation.
- Strength against temperature follows Kuz'min's empirical form with one shape
  parameter per material, chosen to match the quoted loss per degree.
- The lattice is updated by the Metropolis rule.
- Ferrofluid: Langevin magnetisation; the Cowley-Rosensweig threshold and
  critical wavelength; a hydrostatic balance (magnetic pressure against weight,
  volume conserved) for where the fluid gathers; and a Swift-Hohenberg equation
  with a quadratic term, solved spectrally, for the spike pattern. The spikes
  are a pattern model driven by the computed instability, not a solution of the
  free-surface equations. The page says so in its last panel.

URL parameters for screenshots: `?scene=Four%20materials`, `?temp=330`,
`?showFilings`, `?showNeedles`, `?showHeat`, `?kind=antiferro`, `?itemp=1`,
`?isweeps=300`, `?pre=600` (run the ferrofluid that many steps before the first
frame), `?fl_<key>=value` for any ferrofluid parameter, `?still` (show the first
3D frame as an image).

## Tests

    node test.mjs

The physics and the parameter tables are in the `shared-code` script block. The
tests cover the material curves, the dipole far field, wire field, forces,
induced magnetisation, the Ising model against known results, the Langevin law,
the ferrofluid threshold and volume balance, the FFT and the pattern equation.
