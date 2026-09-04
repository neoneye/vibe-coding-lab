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
- If not: `heightM = 0`, `pulledM = 0`.
- `Pulley.segmentsNeeded(loadKg, strengthKg) = ceil(loadKg / strengthKg)` feeds the hint "you need N rope segments".

Constants: strength 50 kgf, `travelM = 2.0` (1.2 for the no-pulley hand lift, so the figure's reach stays plausible), g shown as 9.81 for the Newton readout.

Loads (kg): bucket 10, crate 40, anvil 100, barrel 150, piano 300, cow 400, car 1000. With 50 kgf that ladder needs 1, 1, 2, 3, 6, 8 segments; the car needs 20 and is intentionally beyond the 8× maximum so the "add more" hint has a case that cannot be satisfied.

## Scene and interaction

Single canvas, logical 1000 × 640 px at 120 px/m, HiDPI backing store via `fitCanvasMetrics` (same helper as boulder-dash), letterboxed to the window. Pointer events for mouse and touch.

Layout, left to right: the rig (beam across the top, fixed block under it, moving block with hook and load below, floor at the bottom) and the puller. A pulley tray sits along the bottom edge of the canvas. The load shelf and the readouts live in an HTML panel beside the canvas (below it on narrow screens), not drawn on it. In down-pull rigs the figure stands directly under the rope's free end; in up-pull rigs the rig shifts so the last working bottom sheave sits just left of the balcony, keeping every rope segment close to vertical. With no pulleys the figure stands on the floor beside the hook and lifts it by hand.

- **Pulley tray.** An endless supply of pulley icons. Pointer-down starts a drag with a ghost. Drop zones (the beam area and the moving-block area) highlight when hovered; a full block (4) shows "full" and refuses. Dropping anywhere else cancels.
- **Installed pulleys.** Pointer-down on one lifts it out of its block; drop on the other block to move it, drop elsewhere to remove it. Removing while a load is raised lowers the load to the floor (state resets `pulledM = 0`).
- **Rope drawing.** Anchor point, alternating vertical segments, arcs around sheaves, then the free end to the puller's hands. Supporting segments are numbered 1…N and labelled with their tension `W/N` kg. Sheaves rotate by the rope movement. Idle sheaves are grey with no rope.
- **Puller.** A stick figure. For `pullDir = "down"` they stand on the floor to the right of the rig with the rope coming down from the last top sheave into their hands. For `pullDir = "up"` they stand on a balcony at the right edge near beam height, hands above their head, rope rising from the last bottom sheave (or the hook) to their hands. Dragging the hands along the pull direction increases `pulledM`; dragging the other way lowers. Arrow keys ↑/↓ and a hold-to-pull button also work. When the load is too heavy the figure leans and strains, the rope does not move, and the panel goes red. A "Lower" button pays the rope out at 0.8 m of load descent per second until the load is down; any pull input cancels the descent.
- **Ready-made rigs.** Four panel buttons install a preset (best first): Optimal 4 + 4 (8×), 2nd best 4 + 3 (7×), Double tackle 2 + 2 (4×), Movable pulley 0 + 1 (2×). They call the same `setRig` as drag-and-drop, so the visitor can keep editing the rig afterwards; the button whose rig matches the current one is highlighted. The page opens with the Optimal rig installed (URL parameters `top`/`bottom` override this). Added 2026-09-04 after the first release.
- **Load shelf.** Click a load in the panel to hang it; the current one is highlighted. Swapping lowers the load first.
- **Panel readouts.** Mechanical advantage `N×`; load kg (and N); needed force kg vs strength 50 kg with a bar; state text: "Lifts!" / "Too heavy — needs N rope segments, add pulleys" / "Two-blocked: no more travel"; rope pulled m vs height gained m; and a rig sentence chosen from the route, e.g. "A single fixed pulley only changes the direction of your pull; the load still hangs from one rope." / "The load hangs from N ropes, so each carries W/N, so you pull with W/N, but you must pull N m of rope for every metre lifted."

## Testing

`test.mjs` (copy of the pythagorean-cup runner) extracts the `shared-code` block and runs `PulleyTests.run()`: the routing table above, idle counts, `lift` for lifting, too heavy and two-blocked cases, `segmentsNeeded`, and `fitCanvasMetrics` at 1× and 2×. Visual checks via headless Chrome screenshots at 1× and a check in the app's Browser pane for drag and drop.

## Out of scope

Friction and sheave efficiency, rope weight, angled-rope trigonometry, differential and compound (tackle-on-tackle) rigs, sound.
