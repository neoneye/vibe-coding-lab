# Knitting robot — design notes

Date: 2026-11-04. Directory: `knitting-robot/` (single `index.html` + `test.mjs` + `screenshot1.jpg`).

## What the owner asked for

A knit simulator "similar to the jacquard-loom", where **metal humanoid hands do the knitting**. From
three mockups they picked **B, the chain**: chart → hands close-up → fabric, left to right, as on the
loom. Then: "make some good decisions. Go ahead and impl". References in `~/Desktop/knit/`: lace
swatches (eyelets, leaning decreases, leaf and diamond lace), cables over seed stitch, half brioche,
stranded heart pot holders, an eyelet-and-chevron fabric.

Everything below except the chain layout and the metal hands is my call.

## Decisions

- **Flat hand knitting, English style** (the right index finger throws the yarn). Row 1 is a right-side
  row worked right to left; wrong-side rows are worked left to right, and their stitches are worked as
  the opposite (a chart knit on a WS row is purled), as knitters read charts.
- **Chart symbols** follow common chart conventions: knit (blank), purl (dot), yarn over (circle),
  k2tog (/), ssk (\), centred double decrease (Λ), 2/2 cables crossing right and left, "no stitch"
  (grey). Colour is a second layer: yarn A or B per cell, for stranded colourwork.
- **The fabric is a stitch graph.** Every new loop records which loop(s) it was pulled through. A yarn
  over has none, so a hole opens; a decrease has two or three, so it pulls them together and leans;
  a cable's loops come from parents two columns away and cross. Loop positions are relaxed with
  springs (row neighbours and parent links), the live row pinned on the needle. The picture is drawn
  from that graph: knit stitches as V's of plied yarn, purls as bumps, so leans, holes and cable
  narrowing come out of the knitting rather than being painted on.
- **Front and back.** The fabric can be turned over: the back shows purl bumps for knits and the
  colourwork floats.
- **Hands** are procedural metal robot hands in Three.js, each stitch keyframed in four phases
  (insert, wrap, pull through, slip off), with variants for purl, yarn over, decreases and cables
  (a cable needle holds stitches in front or behind). Loops sit on the needles as rings; the yarn runs
  from the ball over the right index finger.
- **Speed** from one slow stitch to a fast blur; step stitch, step row, knit to the end, and "rip it
  out" (frog).
- **Scenes** from the references: stockinette, garter and ribbing, diamond lace, leaf lace, cables
  over seed stitch, a heart pot holder in two colours.
- **Faithful, not a game.**

## Left out

- Brioche and double knitting (their stitch structure needs a different graph).
- Real yarn mechanics and tension; the spring relaxation is a stand-in.
- Knitting in the round and shaping beyond decreases paired with yarn overs.
