# How electric motors work — short design

**Intent.** A standalone page, `electric-motors/index.html`, that demonstrates how electric
motors work, with many interactive elements and many parameters (the owner's request).

**Approaches considered.**
1. *DC motors in depth.* Wire, loop, brushed and brushless only, with armature reaction,
   thermal rise and braking. Rejected by the owner in favour of breadth.
2. *AC motors in depth.* Rotating field, induction, synchronous, with phasor diagrams.
   Rejected for the same reason.
3. *Full tour, six benches on one page (chosen by the owner).* Loop of wire, brushed DC,
   brushless DC, induction, synchronous, stepper.

View: 2D cross-sections looking along the shaft (chosen by the owner over an added 3D view).

**Design.** Each bench is one generic lab built from a definition object: parameter groups,
presets, a `step` function from the shared physics block, a cross-section draw function, scope
lanes, a torque plot with the working point, and a readout. Common behaviour: drag the rotor
to turn, hold or flick it; animation speed "Auto" slows the display to about half a turn per
second while the physics runs at its own time step; scope time axis follows the animation.

**Physics (my calls).** Lumped circuit models stepped at 10 to 100 µs with an exponential
integrator for the R-L circuits; the induction motor's torque from the steady-state equivalent
circuit; the synchronous motor from the load-angle formula with a damper term. The page's
"What is real here" panel lists the simplifications. No game mechanics.

**Left to later.** 3D view, sound, thermal model, a real field solver for the drawings,
current-regulating field-oriented control, single-phase capacitor-start induction motor.
