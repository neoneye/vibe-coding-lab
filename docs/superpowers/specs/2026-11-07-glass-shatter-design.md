# Glass Shattering — design (as built)

**Date:** 2026-11-07
**Page:** `glass-shatter/index.html`. One self-contained page: three.js 0.170 and Rapier 0.20 from jsdelivr, everything else inline.

## Intent

The owner had just dropped a glass that shattered into tiny pieces. They remembered that sometimes a glass breaks into lots of big pieces, sometimes a mix of small and big, and sometimes lots of tiny ones. Reference photos are in `~/Desktop/glass/`: two clean halves, a tumbler with long shards, a blue glass, and a shatter on black.

They asked for a standalone page that simulates glass shattering. Mid-build they added: *"the interesting part is slowmotion.. how it splitters/shatters"*.

The owner was not asked further questions. The scope and the choices below are mine.

## As built

### The picture

A 3D glass falls onto a floor, seen through a "high-speed camera".

**The timeline:**
- Slow motion follows the action:
  - the playback slows toward the impact;
  - the crack phase is held at about 6 s;
  - after that it speeds up about one decade every 2 s, until real time.
- Fixed camera speeds: 1 000 000, 100 000, 10 000, 1 000 and 240 frames/s, or real time.
- The scrubber runs on that story time.
- The HUD shows *t* in µs, ms or s, and the camera speed it is equal to.
- Phase chips: Falling, Impact, Cracks run, Pieces separate, Pieces fly, At rest.

**During the crack phase** (0 to about 0.1 ms) the glass is held still. It moves less than half a millimetre in that time, and the page says so. What you see:
- a light ring for the stress wave, travelling at the plate wave speed (about 5.5 km/s);
- bright crack lines that grow with their time stamps;
- glowing crack tips.

**Afterwards:**
- Pieces larger than 4 cells, up to the 260 largest, become Rapier rigid bodies.
- Each piece's collider is a set of convex hulls, one per 8 mm patch. Each hull is built from shrunken cell points, so neighbouring pieces start with a gap.
- Smaller pieces fly on analytic paths.
- Glass powder is drawn as points.

**The view:**
- Backdrops: dark studio (softbox environment), light studio, or kitchen (RoomEnvironment).
- Floors: tile, stone, concrete, wood, vinyl, carpet, each with a procedural texture.

### Below the picture

- A verdict sentence and readouts:
  - mass, fall time, impact speed, energy;
  - peak stress against strength;
  - Gc, wave and crack speeds;
  - crack phase duration;
  - forks, stops and meetings;
  - fracture mirror radius;
  - pieces and their sizes;
  - furthest piece.
- **Crack map:** the glass unrolled as an azimuthal map, with the base inside the dashed circle and the rim at the edge. Cracks grow in time; the pieces are coloured once the cracks stop.
- **Piece-size histogram:** count, and share of the glass by weight.
- **"Same drop, twenty different glasses":** runs the core with seeds 1 to 20 and buckets the outcomes.

### Fracture model (GlassCore, shared-code block)

- **The glass** is a body of revolution:
  - outer and inner profile curves with matched stations: base, heel arc, wall function;
  - six shapes: tumbler, tall glass, whisky with a heavy base, stemless wine, jam jar, bowl;
  - the surface is gridded in (φ, v), with cells of about 0.75 mm.
- **The impact:**
  - the glass falls tilted by *tilt*, without turning;
  - the contact is the cells within tolerance of the lowest point;
  - KE = m g h; U_g = floor share × KE;
  - V_eff = (A_contact + π reach²) · t;
  - σ_peak = √(2 E U_g / V_eff).
- **Strength:**
  - σ_f = K_Ic / (1.12 √(π a)) × Weibull (m = 7) scatter per seed, plus 2·CT of skin compression for tempered glass;
  - U_crit = σ_f² V_eff / 2E; U_ex = U_g − U_crit.
- **Energy per area of shell:**
  - (1 − ring) U_ex e^(−d/reach)/Σ, where d is the geodesic distance from the contact (Dijkstra on the grid);
  - plus ring · U_g / area;
  - plus, for tempered glass, the residual 0.8 (1 − ν) CT²/E · t.
- **Crack tips** walk the outer surface in 3D, re-projected onto the lathe, at v = 0.47 c_R. At each step a tip:
  - harvests the remaining energy in a disc of radius clamp(d_nat/2, 0.75 h, feed), where d_nat = 2 Gc t/(η e);
  - pays Gc · t · ds;
  - has its harvested budget capped at Gc · t · coast; only origin cracks get an extra reserve, (first %) · U_crit;
  - forks when its smoothed feed G exceeds branchG · Gc, at least 2 · d_nat after the last fork; the fork opens to ±45° in tempered glass;
  - steers by wander, by the pull away from the impact (weighted by the impact share of the energy), and toward the energy-weighted centroid of the fresh glass it harvests;
  - stops at the rim, when it runs out of energy, or by running into another crack (it snaps onto that crack's point), unless fresh energy-rich glass lies just beyond, in which case it crosses.
- **Other cracks:**
  - Origins: 2 to 12 tips, depending on U_ex/U_crit.
  - Flaw sites start bidirectional hoop cracks after the stress wave arrives, wherever d_nat from the impact energy is under *nucleate*.
- **Cutting the pieces:**
  - A crack cuts the dual links it crosses, storing the crossing points.
  - Pieces are flood-filled across uncut links.
  - Mesh vertices on piece boundaries are snapped to the average of the incident crossing points, so neighbouring pieces fit exactly.
  - Meshes are closed: outer, inner, fracture faces and rim.
  - Each piece's launch speed is √(2 κ ē/(ρ t)), directed away from the impact (outward for tempered glass), with spin.

### Tests

`node glass-shatter/test.mjs` runs 180 checks:
- material constants;
- parameter ranges and hash round trips;
- profile sanity for all shapes, and tumbler mass and area;
- projection inverse;
- breaks or survives, by floor, height, landing and scratch;
- energy normalisation;
- crack phase duration in µs;
- conservation: mass, and every cell in one piece;
- determinism;
- every piece boundary lies on a cut;
- more energy gives more pieces;
- toughened glass gives far more pieces;
- "two halves" gives a few pieces;
- meshes are closed and finite, with in-range indices;
- every piece has collision patches.

## Tuning notes

- **Forking:**
  - A harvest disc sized only by d_nat feeds every tip 2/η ≈ 13 × Gc, so tips forked everywhere.
  - The feed cap (12 mm) and a fork gap of 2·d_nat fixed that.
  - Ring energy above about 3% still makes cracks fork across the whole glass.
- **Budget:** a tip that kept its savings coasted 20 cm on them. Capping the harvested budget (coast 8 mm) gave the mixed regime its big pieces: a kitchen drop is now about 50 to 190 pieces, the biggest holding about 45 to 55%.
- **Toughened glass:**
  - It left the base unbroken until tips steered toward fresh energy.
  - Narrow forks made needles; ±45° forks give the honeycomb dice of real tempered glass.
- **Rendering:**
  - The glass rendered black because `pow()` of a negative base in GLSL is NaN.
  - A backlight made a white streak in glossy floors, so it was removed; the softbox environment carries the look.
- **Physics:**
  - Box colliders around staircase patches overlapped neighbouring pieces, at about 150 ms per step.
  - Thinned, shrunken hulls bring it to about 10 ms early and 2 to 5 ms later.
  - With the 260-body cap, the physics keeps ahead of slow motion.

## Verified

- **Chrome (Browser pane and headless):**
  - every scenario builds and plays with no errors;
  - the frame loop was driven through all phases to "At rest";
  - the twenty-drops chart works;
  - phone width (375 px): no horizontal scroll, and the phase caption moves below the picture.
- **Firefox headless:** layout.
- **Not checked:** Safari; how it feels on a real phone.

## Scope deltas (left for the owner)

- No sound.
- Pieces do not break again when they land.
- No water in the glass.
- No delayed self-shattering of tempered glass (nickel sulphide).
- No stemmed wine glass: the stem does not fit the single-shell model.
