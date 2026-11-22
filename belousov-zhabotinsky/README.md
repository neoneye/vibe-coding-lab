# Belousov–Zhabotinsky reaction

A standalone page that simulates the Belousov–Zhabotinsky reaction in a thin,
unstirred layer: travelling waves, target patterns and spirals. Open
`index.html` in a browser; nothing is loaded from the network. It needs WebGL2
with float render targets.

## The model

The two-variable Oregonator in Tyson–Fife scaling, with the light term of Krug,
Pohlmann and Kuhnert:

```
ε ∂u/∂t = u − u² − (f·v + φ)(u − q)/(u + q) + ε·Du ∇²u
  ∂v/∂t = u − v + Dv ∇²v
```

`u` is HBrO₂, `v` the oxidised catalyst (what the eye sees). One step is
explicit diffusion on a 9-point stencil, then the stiff `u` reaction by
implicit Euler (six Newton iterations), then `v` implicitly. The fragment
shader is a copy of `stepCPU` in the `shared-code` block; `__bz.selftest()` in
the browser console compares the two on a 64² grid.

With "ε and q follow the recipe" on, ε, q, the time unit and the length unit
come from the bromate, malonic acid and acid concentrations and the
Field–Försterling rate constants, so the page can show seconds and millimetres.

## Controls

| Group | What |
|---|---|
| Recipe | bromate, malonic acid, acidity, diffusion coefficient, link to ε and q |
| Kinetics | ε, q, f |
| Diffusion and the medium | D_u, D_v, gradient of f, patchiness and patch count, noise, electric field and direction |
| Light | room light φ, projected φ, pattern (half, stripes, checkerboard, disc, ring, ramp, your image), pattern count |
| Pacemakers | f inside a pacemaker |
| Grid and time step | 256²–1024², dish width, time step, steps per frame, edge (round dish, square tray, wrap) |
| Display | catalyst (ferroin, Ru(bpy)₃, cerium), view, layer depth, colour level, lamp, relief, tip trace, scale bar |

Pointer tools: silver wire (start a wave), wipe (break one), wall, light,
pacemaker and their erasers, and a probe that feeds the time trace and the
phase plane. Also: nine presets, eight initial states, Stir, a seed, PNG export
and a link that reopens the page with the same settings.

Review parameters: `?bare` shows only the dish, `?pump=N` runs N frames before
the first paint, `?still` starts paused. `window.__bz` has `frames(n)`,
`preset(id)`, `set(key, value)` and `selftest()`.

## What is the page's own

The rate constants, dates and citations were written from memory and not
checked against the papers. The colours are Beer–Lambert transmission with
absorbances picked by eye. The electric field is a drift term on `u`, light
acts on any catalyst, and the patchiness, gradient, noise and presets are this
page's choices. The page's own panel lists these next to what comes from the
literature.

## Tests

```
node test.mjs
```

About 15 seconds. They check the recipe arithmetic, the steady state and its
stability, the implicit reaction step against RK4, the stirred oscillation and
the excitation threshold, plane-wave speed and its convergence in time step and
cell size, that walls and strong light stop a wave, that a broken wave gives
two spiral tips, that a pacemaker fires, the maze, and every preset.
