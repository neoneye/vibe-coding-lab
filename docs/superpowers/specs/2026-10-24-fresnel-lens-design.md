# 2D Fresnel Lens: design

Date: 2026-10-24. Directory: `2d-fresnel-lens/`.

## Intent

A single self-contained page that explains how a Fresnel lens works. It lets you build lenses out of flat plates and watch the light. The owner's ideas:

- A Fresnel lens can be a **composite of two materials**, so the plate has the same thickness everywhere. The sawtooth sits *inside* the plate, as the boundary between material A and material B.
- **Several same-thickness plates can be stacked**.
- **Lots of parameters** for the groove texture and the material properties.
- What they want to play with: *"adjust the difference between the plates… do the light rays run parallel, where is the focal point."*

After one playback the owner said "go ahead". Everything else below is *(my call)*.

## Goals

- Exact 2D ray tracing in the meridional plane, using vector Snell's law at every boundary. That covers the flat outer faces, the curved or flat facets, and the risers (draft walls). It includes total internal reflection and unpolarised Fresnel reflection losses. Ghost reflections are optional.
- Each plate is a slab of thickness T. Inside it, material A (on the incoming side) meets material B along a folded profile. Bending happens only where the two indices differ. With equal indices the plate is invisible, and swapping the materials turns a converging plate into a diverging one.
- Stacks of 1–6 plates, each with its own settings. The gap between plates can be zero (touching) or any distance.
- Readouts that answer the owner's two questions directly:
  - **Parallel / converging / diverging**, based on the spread of the output ray angles.
  - **Where the focal point is**: the traced best focus (least-squares waist), compared with the paraxial prediction from an ABCD matrix of the stack.
  - Also: spot size, transmission, rays lost to total internal reflection or edges, and colour focus shift.
- Dispersion: each material has n_d and Abbe V, turned into a Cauchy fit. Light can be one wavelength, F/d/C, or a 7-colour spectrum, so colour fringing and achromatic stacks are visible.

## Non-goals

- No diffraction. Geometric optics only, and the honesty panel says so. That's valid while the groove pitch is much larger than the wavelength.
- No full 3D skew-ray tracing. Radial symmetry makes meridional tracing exact for on-axis viewing.
- No libraries. Works from `file://`.

## Plate model

- **Profile** (the lens surface before it is folded):
  - *conic*: signed curvature c (shown as Rc) and conic constant k
  - *ideal*: facet slopes solved numerically so the plate alone focuses collimated light at distance F, for its own materials at the d line
- **Folding**:
  - *equal pitch*: N zones of equal width
  - *equal depth*: a new zone every h of sag
  - The folded profile lives in a band inside the plate, between front + wall and back − wall. Grooves too deep for the band are truncated, and the page warns about it.
- **Facets**: curved (the exact folded profile) or flat (the chord).
- **Draft angle**: signed. Positive tilts the risers to lean with converging light. *Auto* makes each riser parallel to the refracted light. Finding while building: a ray bent by a facet drifts by depth·tan θ and hits the next riser inward, where it is totally reflected. Draft can't remove this dead zone, only move it to the incoming side. The loss is constant for draft between 0 and auto, and grows outside that range. The tests pin this, and the explainer says so.
- **Focus analysis**: rays that hit a riser or were totally reflected count as *stray*. They are left out of the best focus and the spot size, and reported separately.
- **Facet angle error**: a random per-zone slope error, seeded.
- **Surface roughness**: a random normal tilt per hit.
- **Groove layout**: radial (concentric rings) or linear (straight grooves, a cylindrical lens). This only affects the texture view and the view-through image.
- **Buttons**: *Swap materials* (opposite power), *Flip plate* (turns it around: swaps the order and negates the profile, same power), duplicate, remove, move.

## Page

- **Main cross-section canvas** (wide):
  - plates filled by material colour; rays coloured by wavelength, with alpha from their weight
  - optical axis, best-focus and paraxial-focus markers, and a draggable screen plane
  - a draggable point source
  - wheel zoom, drag to pan, double-click to fit
  - a magnifier inset that shows the grooves up close; drag its box
  - optional "flowing light" dash animation
- **Readout strip**: status chip and the numbers above.
- **Plots**:
  - *axis crossing vs input height*: each ray's crossing point. This shows spherical aberration and which zones focus where.
  - *light on the screen*: a histogram.
- **Texture view**: the selected plate seen face-on, with relief shading of the groove pattern.
- **View through**: a background pattern seen through the whole stack from an eye on the axis, at an eye and background distance you choose. It is backward-traced at R, G and B, so colour fringes show up.
- **Collapsible parameter groups**: Presets, Light source, Plates (one card per plate), Physics, View, View through.
- **Presets**:
  - classic acrylic-in-air Fresnel
  - composite flat plate
  - index-matched (invisible)
  - swapped materials (diverging)
  - two plates stacked
  - plus and minus cancel
  - Galilean beam compressor (parallel out)
  - lighthouse collimator (point at focus → parallel)
  - imaging at 2f
  - achromatic stack
  - fast lens with total internal reflection at the rim
  - draft-angle losses
  - flat vs curved facets
  - off-axis coma
- **Explainer** and **honesty panel**.

## Testing

`FresnelTests` in `<script id="shared-code">`, run by `test.mjs`. It checks:

- Snell and total internal reflection, Fresnel R at normal incidence, Brewster's angle, and R + T = 1
- the Cauchy fit against n_d and V
- the shift through a flat slab
- that equal indices are invisible
- traced paraxial focus vs ABCD
- that the ideal profile focuses sharply
- the power of flipped vs swapped plates
- that a two-plate stack halves f
- that the Galilean preset is parallel and gives the right beam ratio
- that the lighthouse preset is parallel
- that the achromat preset beats a single plate on colour focus shift
- energy bookkeeping in the ray tree
- fold geometry stays inside the band, with equal pitch or equal depth
- reversibility of a traced ray
- the least-squares focus on synthetic rays
- that every preset traces without NaN and its headline claim holds
