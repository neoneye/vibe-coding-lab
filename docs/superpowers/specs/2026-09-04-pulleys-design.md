# 2D Pulleys — Design

**Date:** 2026-09-04
**Directory:** `2d-pulleys/`
**Deliverable:** A self-contained `index.html` that teaches how pulleys multiply lifting force, plus `test.mjs` for the pure model and a `screenshot1.jpg` for the gallery.

## Concept

The visitor builds a block-and-tackle by dragging pulleys onto a ceiling beam or onto the hook that carries the load. A stick figure with a fixed strength pulls the rope. The page shows, live, how many rope segments hold the load, how the load's weight is shared between them, and therefore how heavy a load the same person can lift. Dragging the rope end lifts the load and shows the distance trade-off: with N segments you pull N metres of rope to raise the load one metre.

Idealised: no friction, weightless rope and blocks, rope segments treated as vertical. One footer sentence says so.

## Rig model (`Pulley` in the shared-code block)

The rig is two numbers: `top` (sheaves in the fixed block hanging from the beam, 0–4) and `bottom` (sheaves in the moving block above the hook, 0–4).

`Pulley.route(top, bottom)` returns `{usedTop, usedBottom, anchor, ma, pullDir, idleTop, idleBottom}` under these rules:

- `usedBottom = min(bottom, top + 1)`, `usedTop = min(top, bottom + 1)`.
- `anchor = (usedTop > usedBottom || usedBottom === 0) ? "load" : "ceiling"`. The rope's fixed end is tied to the moving block (or bare hook) when the top block has one more working sheave than the bottom, or when there are no working bottom sheaves at all; otherwise to the beam.
- The rope alternates between the blocks from the anchor: from a ceiling anchor it goes down to bottom sheave 1, up over top sheave 1, down to bottom sheave 2, and so on; from a load anchor it goes up over top sheave 1 first.
- `ma = 2 * usedBottom + (anchor === "load" ? 1 : 0)`. This is the number of rope segments attached to the moving block. With no pulleys at all the anchor is the hook and `ma = 1`.
- `pullDir = usedTop >= usedBottom && usedTop > 0 ? "down" : "up"`. The free end leaves the last sheave used; leaving a top sheave means the person pulls downward, leaving a bottom sheave (or a bare hook) means they pull upward.
- Idle sheaves (`idleTop = top − usedTop`, `idleBottom = bottom − usedBottom`) are drawn grey; a caption says which block needs another pulley for them to do anything.

Expected table (top, bottom → ma, pullDir): (0,0→1,up) (1,0→1,down) (0,1→2,up) (1,1→2,down) (2,1→3,down) (1,2→4,up) (2,2→4,down) (3,2→5,down) (3,3→6,down) (4,3→7,down) (4,4→8,down) (2,0→1,down, idleTop 1) (0,2→2,up, idleBottom 1).

## Lift model

`Pulley.lift(route, loadKg, strengthKg, pulledM, travelM)` returns `{neededKg, lifts, heightM, pulledM, blocked}`:

- `neededKg = loadKg / ma`; `lifts = neededKg <= strengthKg`.
- If `lifts`: `heightM = min(pulledM / ma, travelM)`, `pulledM` is clamped to `heightM * ma`, and `blocked` is true when the moving block has reached the fixed block (two-blocked).
- If not: the geometry is still returned for the current `pulledM` (the load keeps its height) but `lifts` is false and `blocked` is never set. While a too-heavy load is off the floor the page lets the rope slip back through the hands at `slipSpeed = min(3, 0.5 + 0.5·(needed/strength − 1))` m/s of load descent, the figure strains, and the status says it is slipping. (Changed 2026-09-04: previously a too-heavy load snapped to the floor.)
- `Pulley.segmentsNeeded(loadKg, strengthKg) = ceil(loadKg / strengthKg)` feeds the hint "you need N rope segments".

Constants: strength 50 kgf, `travelM = 2.0` (1.2 for the no-pulley hand lift, so the figure's reach stays plausible), g shown as 9.81 for the Newton readout.

Loads (kg): bucket 10, crate 40, gold bars 100 (a 4 kg pallet with eight 12 kg bars), barrel 150, aquarium 300, cow 400, car 1000. With 50 kgf that ladder needs 1, 1, 2, 3, 6, 8 segments; the car needs 20 and is intentionally beyond the 8× maximum so the "add more" hint has a case that cannot be satisfied.

## Scene and interaction

Single canvas, logical 1000 × 640 px at 120 px/m, HiDPI backing store via `fitCanvasMetrics` (same helper as boulder-dash), letterboxed to the window. Pointer events for mouse and touch.

Layout, left to right: the rig (beam across the top, fixed block under it, moving block with hook and load below, floor at the bottom) and the puller. A pulley tray sits along the bottom edge of the canvas. The load shelf and the readouts live in an HTML panel beside the canvas (below it on narrow screens), not drawn on it. In down-pull rigs the figure stands directly under the rope's free end; in up-pull rigs the rig shifts so the last working bottom sheave sits just left of the balcony, keeping every rope segment close to vertical. With no pulleys the figure stands on the floor beside the hook and lifts it by hand.

- **Pulley tray.** An endless supply of pulley icons. Pointer-down starts a drag with a ghost. Drop zones (the beam area and the moving-block area) highlight when hovered; a full block (4) shows "full" and refuses. Dropping anywhere else cancels.
- **Installed pulleys.** Pointer-down on one lifts it out of its block; drop on the other block to move it, drop elsewhere to remove it. Removing while a load is raised lowers the load to the floor (state resets `pulledM = 0`).
- **Rope drawing.** Anchor point, alternating vertical segments, arcs around sheaves, then the free end to the puller's hands. Supporting segments are numbered 1…N and labelled with their tension `W/N` kg. Sheaves rotate by the rope movement. Idle sheaves are grey with no rope.
- **Puller.** A stick figure. For `pullDir = "down"` they stand on the floor to the right of the rig with the rope coming down from the last top sheave into their hands. For `pullDir = "up"` they stand on a balcony at the right edge near beam height, hands above their head, rope rising from the last bottom sheave (or the hook) to their hands. Dragging the hands along the pull direction increases `pulledM`; dragging the other way lowers. Arrow keys ↑/↓ and a hold-to-pull button also work. When the load is too heavy the figure leans and strains, the rope does not move, and the panel goes red. A "Lower" button pays the rope out at 0.8 m of load descent per second until the load is down; any pull input cancels the descent.
- **Ready-made rigs.** Four panel buttons install a preset (best first): Optimal 4 + 4 (8×), 2nd best 4 + 3 (7×), Double tackle 2 + 2 (4×), Movable pulley 0 + 1 (2×). They call the same `setRig` as drag-and-drop, so the visitor can keep editing the rig afterwards; the button whose rig matches the current one is highlighted. The page opens with the Optimal rig installed, the barrel on the hook and a 29 m/s storm (URL parameters `top`/`bottom`/`load`/`wind` override this; a stored wind setting overrides the default too). Added 2026-09-04 after the first release.
- **Swinging load and wind.** (Added 2026-09-04.) The load hangs from the hook tip on its sling and behaves as a damped pendulum of length 0.2 m + half its height, damping 0.4 /s, nudged with 1.2 rad/s when hung. A wind slider (0–30 m/s; the wind gusts: a wobbling lull of 50–90 % of the set speed plus, once per 7 s window at a varying moment, a gust rising in 0.35 s to 125–165 %, holding 0.6–2.2 s and fading over 1.4 s, all deterministic in time; the panel shows the speed right now, and the streaks speed up with the gusts) applies dynamic pressure ½·1.2·v² times the load's face area (w·h) horizontally, so light, bulky loads swing far while the car barely moves. Past 0.9 rad (≈52°) the sling slips off: the load leaves with the pendulum's tangential velocity, falls under gravity and wind, lands on the floor and settles upright or on its side. While it is on the floor the hook is empty (load 0), the tension badges read 0, the status explains what happened, and clicking any load hangs one again. Wind streaks drift across the scene. URL parameters `wind` and `swing` (initial angle) exist for screenshots.
- **Wind persistence.** The wind slider value is stored in `localStorage` (key `pulleys.wind`) and restored on the next load; a `wind` URL parameter overrides it.
- **Sludge droplets.** (Added 2026-09-04.) While the barrel is the load, its leaks shed about 5 tiny glowing droplets per second from the drip points, following the swing or the fall. Each droplet falls at up to 3.5 m/s and is blown sideways toward the gusting wind speed with a 0.25 s relaxation, so a breeze carries drops onto the puller. A droplet within 8 cm of his limbs or 19 cm of his head sticks to him as a splat (in his frame, up to 80, fading over 40 s) and triggers a 1.2 s "eww!"; droplets reaching the floor leave a puddle that fades over 12 s.
- **Cutting the rope and knocking the load off.** (Added 2026-09-04.) Clicking within 8 cm of the rope cuts it at that point: tension is gone, so the moving block and whatever hangs from it free-fall to the lowered position with one small bounce, the two cut ends droop and sway, the tension badges disappear, pulling does nothing, and a "New rope" button appears (any rig change also fits a new rope). Clicking the hanging load knocks it off the hook with a shove, using the same fall as a wind slip; the status says it was knocked off. Both reset the safety board.
- **Gold bars.** (Replaced the anvil, 2026-09-04.) Eight 12 kg bars stacked 4-3-1 on a 4 kg pallet. Bars are dense, so the wind does not blow them off directly; whenever the swing (or the tilt of a fallen pallet) exceeds the friction angle, tan = 0.3 (about 17°), one bar slides off the downhill edge every 0.25 s, top row first, and lands on the floor. Each lost bar lightens the hook: the mass, tension badges, force needed, status and sentence all follow the bars left, the swing uses the lighter mass, and the panel shows "n of 8 bars left". A stripped 4 kg pallet is blown about easily and usually slips off the hook. Hanging the gold again restores all eight bars and clears the floor.
- **TNT crate.** (Added 2026-09-04.) The crate carries a navy stencil panel reading "SAFE" in small letters over a hand-drawn stencil "TNT" (no fuse). When it lands after falling off the hook, or when a cut rope drops it from a height, it explodes: a white flash, a fireball fading over 0.6 s, "BOOM!", 26 splinters and 30 sparks under gravity, 18 smoke puffs drifting with the wind, a screen shake, and a scorch mark that stays until another load is hung. The crate is gone (load reads "none — it exploded"). If the puller is within 2.6 m he is blackened for 4 s with frazzled hair and says "ouch!". The board resets.
- **Aquarium.** (Replaced the piano, 2026-09-05.) A 1.3 × 1.0 m glass tank with gravel, waving plants, rising bubbles and a giant red crab snapping its claws. The water surface stays level in the world, so it tilts within the swinging tank with a small ripple. When the tank lands after falling off, or a cut rope drops it, it shatters: 34 glass shards and 24 water drops fly, a puddle spreads to 2.2 m, the screen shakes, and the crab is loose. After 0.8 s it scuttles along the floor at 0.9 m/s toward the puller, clamps onto his leg and stays there; he says "OW! my leg!" and wobbles for 3 s. Load reads "none — it shattered". Hanging a new load clears the puddle and the crab.
- **Safety board.** (Added 2026-09-04.) A green wall sign at the top right reads "DAYS SINCE LAST ACCIDENT" and opens at 5. Board time runs at one simulated hour per real second. When a load slips off the hook the counter resets and reads "HOURS SINCE LAST ACCIDENT" counting up; from 48 simulated hours on it shows whole days again.
- **Hoist jolts.** (Added 2026-09-05.) A sudden change in hoist speed jolts the hanging load: pressing and releasing Hold to pull (±1.2 m/s of rope ÷ advantage), starting a lower and the load reaching the bottom (∓0.8 m/s). `Pulley.jerk` applies the physical part, `omega −= dv/Lp·sin θ` (the pivot's acceleration adds to gravity for an instant, amplifying any existing swing), plus a 0.8 rad/s kick along the load's current swing direction so even a still load starts swinging. No jolt when the rope is cut, the load is off the hook, or it is too heavy to move.
- **Load shelf.** Click a load in the panel to hang it; the current one is highlighted. Swapping keeps the rig at its current height: a lighter load just hangs there, a load too heavy to hold slips down through the hands.
- **Panel readouts.** Mechanical advantage `N×`; load kg (and N); needed force kg vs strength 50 kg with a bar; state text: "Lifts!" / "Too heavy — needs N rope segments, add pulleys" / "Two-blocked: no more travel"; rope pulled m vs height gained m; and a rig sentence chosen from the route, e.g. "A single fixed pulley only changes the direction of your pull; the load still hangs from one rope." / "The load hangs from N ropes, so each carries W/N, so you pull with W/N, but you must pull N m of rope for every metre lifted."

## Testing

`test.mjs` (copy of the pythagorean-cup runner) extracts the `shared-code` block and runs `PulleyTests.run()`: the routing table above, idle counts, `lift` for lifting, too heavy and two-blocked cases, `segmentsNeeded`, and `fitCanvasMetrics` at 1× and 2×. Visual checks via headless Chrome screenshots at 1× and a check in the app's Browser pane for drag and drop.

## Out of scope

Friction and sheave efficiency, rope weight, angled-rope trigonometry, differential and compound (tackle-on-tackle) rigs, sound.
