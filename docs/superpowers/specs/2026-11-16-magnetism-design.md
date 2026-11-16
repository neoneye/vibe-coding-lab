# How magnetism works — short design

**Intent.** A standalone page, `magnetism/index.html`, that explains magnetism. The owner asked
for: placing magnets of different types, a temperature control that shows its effect on the
magnets, ferrofluids, and lots of parameters.

**Approaches considered.**
1. *One sandbox for everything.* A single table with magnets, heat and ferrofluid together.
   Rejected: the three subjects live at different scales (centimetres, atoms, a free surface)
   and one view cannot show all of them honestly.
2. *Three labs on one explainer page (chosen).* A field table for placing magnets and heating
   them; an Ising lattice for what heat does inside the metal; a 3D ferrofluid dish. Text cards
   between them and an honesty panel at the end.
3. *Full ferrohydrodynamics for the fluid.* Rejected as far too heavy for a page; instead the
   instability threshold, spacing and where the fluid gathers are computed from the physics and
   a Swift–Hohenberg pattern equation grows the spikes.

**Design.**
- Field lab: pole-face (Gilbert) model in a flat slice; bar, horseshoe, electromagnet, wire,
  soft metal, compass; four hard and three soft materials with Curie points; reversible
  weakening, permanent loss past the working limit, re-magnetise button; field lines, filings,
  needles, strength map, forces. Magnets are not moved by the forces.
- Domain lab: Metropolis Ising model with ferro/antiferro/para coupling, field sweep, dilution,
  plots against Onsager's curve and of hysteresis.
- Ferrofluid lab: Langevin law, Cowley–Rosensweig threshold, hydrostatic gathering, spectral
  Swift–Hohenberg, three.js surface; magnet or uniform coil field; temperature.
- Physics and parameter tables in a `shared-code` block tested by `test.mjs`.

**Left to the builder.** Default values, scenes and wording.
