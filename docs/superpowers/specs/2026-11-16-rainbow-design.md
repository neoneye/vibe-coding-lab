# How rainbows work — short design

**Intent.** A standalone page, `rainbow/index.html`, that explains how rainbows work. The owner
asked for: why there are double rainbows, the visible spectrum with UV and IR, what lies beyond
on the spectrum, and lots of parameters.

**Approaches considered.**
1. *One rendered sky with sliders.* Shows the result but not the cause; the reason for 42° is
   inside a single drop. Rejected as the whole page, kept as one lab.
2. *Three labs on one explainer page (chosen).* A raindrop with traced rays; the sky built from
   that drop's angular profile; the electromagnetic spectrum as a chart. Text cards between them
   and an honesty panel at the end. Same shape as the magnetism page.
3. *Full Mie scattering for the sky.* Exact, including the glory and ripple, but slow and far
   more code than the question needs. Rejected; Airy's theory gives the supernumeraries and the
   fogbow, and the page says it is an approximation.

**Design.**
- Drop lab: 2D ray trace, 0 to 5 internal reflections, one colour or white split into colours
  (optionally 300 to 1100 nm), leaks, Fresnel brightness, the Descartes ray and its angle, and a
  plot of exit direction against impact parameter.
- Sky lab: brightness against angle from the antisolar point, per wavelength, by ray histogram
  or Airy profile; CIE colour; sun-disc blur; float texture; WebGL2 shader with fisheye or
  rectilinear lens, polariser, ground, cloud. Presets, labels, PNG export without labels.
  Infrared and ultraviolet shown in false colour with an extended sensor.
- Spectrum lab: log-wavelength chart with bands, sizes, atmosphere, black-body curve, animal
  vision, discoveries, and a cursor readout that also says whether rain would make a bow there.
- Water index from IAPWS 1997. Optics and parameter tables in a `shared-code` block tested by
  `test.mjs`.

**Left to the builder.** Default values, presets and wording.
