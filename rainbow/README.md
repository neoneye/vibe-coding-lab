# How rainbows work

A standalone explainer with three places to experiment. Open `index.html` in a
browser. It is one file and loads nothing from the network.

## The three labs

1. **One raindrop.** Parallel sun rays traced through a drop by Snell's law,
   with zero to five reflections inside. Shows why the rays bunch up at one
   angle (42° after one reflection, 51° after two), why each colour has its own
   angle, and why the second bow has its colours reversed. A plot gives the
   outgoing direction against where the ray entered, for red, green and violet.
   Options for white light split into colours, ultraviolet and infrared rays,
   the light that leaks out at each bounce, and Fresnel brightness.
2. **The sky.** The view with the sun behind you: primary and secondary bows,
   Alexander's dark band, and optionally the third to sixth bows. Light as rays
   (Descartes, Newton) or as waves (Airy), drop radius from fog to heavy rain,
   a mix of drop sizes, sun height, width and temperature, reddening by the
   air, drops in front of the ground (a full circle), a polarising filter, and
   a sensor that reaches into the ultraviolet and infrared. Eleven presets,
   among them a sunset bow, supernumerary fringes, a fogbow and the bows round
   the sun. A side view shows the cone of directions. "Save image" writes the
   sky alone as a 2400 × 1500 PNG.
3. **Beyond the colours.** The electromagnetic spectrum from gamma rays to
   radio on a log scale: frequency, photon energy, what is as big as the wave,
   what the air lets through, the glow of a body at any temperature, what
   animals see, who found each part, and whether rain would make a bow at that
   wavelength.

54 parameters in all.

## How it works

- Refractive index of water: the IAPWS 1997 formulation, relative to air.
- Rays: Snell, reflection and Fresnel's equations for both polarisations. The
  bow angles are computed from these.
- Sky brightness against angle from the point opposite the sun is built on the
  CPU for about 70 wavelengths. In ray mode it is a histogram of rays over the
  drop's cross-section. In wave mode each bow is Airy's Ai² profile, scaled to
  agree with the ray result once the fringes are averaged; a spread of drop
  sizes damps the fringes analytically. The profile is turned into colour with
  the CIE 1931 observer, blurred by the sun's width, and uploaded as a float
  texture; a WebGL2 shader draws the sky from it.
- Sunlight is a black body reddened by Rayleigh scattering and haze along its
  path through the air.

The last panel of the page lists what is taken from the real thing and what was
chosen: spherical drops, Airy instead of Mie theory, a simple background sky,
false colours for the invisible bands.

URL parameters for screenshots: `?preset=Fogbow`, `?s_<key>=value` for any sky
parameter, `?w_<key>=`, `?d_<key>=`, `?q_<key>=` for water, drop and spectrum
parameters, `?quick=2` (the n-th "Show" button of the drop lab), and
`?only=sky|drop|spec|cone` to show one picture alone.

## Tests

    node test.mjs

The optics and the parameter tables are in the `shared-code` script block. The
tests cover the Airy function, the index of water against handbook values, the
bow angles, energy conservation over all orders, polarisation, the ray tracer
against the deviation formula, the ray and wave profiles against each other,
colour, the sky table (dark band, colour order, fogbow, infrared bow) and the
spectrum relations.
