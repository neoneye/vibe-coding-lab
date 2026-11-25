# Sewing Factory

How flat pieces of cloth become a garment, and what each industrial sewing
machine on the line actually does with its threads. Open `index.html` in a
browser (three.js is loaded from a CDN).

## Four stages

1. **Measure.** A mannequin with sliders for height, chest, waist, hip,
   shoulder width, inside leg and arm length. The torso sections are solved so
   the tape girths equal the slider values. Seven more sliders shape the bust
   (projection, spacing, height, width, fullness above and below, and the rib cage
   under the bust as a share of the bust girth), a heel-lift slider poses the feet for heeled shoes, and a Pose card moves
   the arms, elbows, feet and head (the cut pieces never change with the pose). Two modes: a full figure with head,
   arms and legs, or a tailor's dress form on a stand (it hangs from a rail for
   trousers and swimwear, which need the crotch free).
2. **Cut.** The pattern pieces of the chosen garment lie on a cutting table as a
   marker: grain arrows, cutting line, stitch line. Click a piece to give it its
   own cloth, print or colour.
3. **Sew.** The operation list in factory order. Each operation goes to the
   machine a factory would use, and a close-up shows that machine forming its
   stitch, thread by thread. The pieces join on the form so you can see where
   each seam ends up.
4. **Finished.** The garment on the mannequin, with a clean PNG export.

Garments: jeans, shorts, shirt, dress, swimsuit, bikini. Cloths: denim, stretch
denim, chino twill, poplin, oxford, linen, flannel, satin, viscose crepe, cotton
jersey, swim tricot. Prints: solid, zebra, leopard, polka dots, stripes, gingham,
floral, camouflage.

## How the pieces are made

Nothing is drawn by hand. Each garment is a set of surfaces round the body (the
body plus ease, or a hanging or flared shell), and each pattern piece is a
four-sided region of one surface. The worn shape is that region in 3D; the flat
pattern is the same region unrolled: across, the arc length round the body from
the centre line; along, the height. Crotch curves, armholes and sleeve heads come
out of the measurements, and the texture is laid in flat coordinates so prints
follow the grain and mismatch at seams as real cloth does. Swimwear is cut 14 %
narrower than the body (negative ease).

## Machines

| Machine | Stitch (ISO 4915) | Used for |
|---|---|---|
| Single-needle lockstitch | 301 | topstitching, pockets, collars, zips, hems |
| Zigzag lockstitch | 304 | elastic on swimwear |
| Bartacker | 304 pattern | pocket corners, belt loops, ties |
| Buttonhole machine | 304 bead + knife | buttonholes |
| Button sewer | 101 | sewn buttons |
| Twin-needle feed-off-the-arm | 2 × 401 | lap-felled jeans seams |
| Overlock, 3- and 4-thread | 504, 514 | edge finishing, stretch seams |
| Safety stitch | 516 | side seams |
| Coverstitch | 406 | swimwear hems |

## What is simplified

Machine timing is schematic and slowed; thread is drawn thick. There is no cloth
physics, no darts, facings or linings, and the sleeve head has more ease than a
real pattern. Fabric changes the look, not the construction: an unsuitable cloth
gets a note. The page lists the rest under "What is simplified".

## Tests and review hooks

`node test.mjs` runs the checks embedded in the page: tape girths against the
sliders, every garment at default and extreme sizes, the seam walk (joined edges
must match in flat length), the marker, stitch thread paths and tile wrap.

URL parameters for screenshots: `?still` renders one settled frame, `&bare`
hides the panel, `&stage=1..4`, `&g=jeans|shorts|shirt|dress|swimsuit|bikini`,
`&form=w|m`, `&mode=stand`, `&op=N&t=0..1` (operation and progress), `&cyc=6.55` (machine
cycle), `&az=&el=&zoom=&ty=` (camera), `&cloth=&print=&colour=RRGGBB`, `&sel=`
(selected piece). `window.__sf` exposes the state and a `tick/render` pair.
