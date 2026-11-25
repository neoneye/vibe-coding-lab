# Sewing Factory

How flat pieces of cloth become a garment, and what each industrial sewing
machine on the line actually does with its threads. Open `index.html` in a
browser (three.js is loaded from a CDN).

## Four stages

1. **Measure.** A mannequin with sliders for height, chest, waist, hip,
   shoulder width, inside leg and arm length. The torso sections are solved so
   the tape girths equal the slider values. A Hips and legs card sets the buttocks,
   the gap between the thighs (as a share of the hip width) and the thigh, knee,
   calf and ankle girths. Seven more sliders shape the bust
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

An **X-ray** switch makes the body see-through and shows a skeleton inside it
(spine, rib cage, pelvis, limbs, hands, feet, skull), built from the same
measurements and pose, with the clothing still on.

Garments: jeans, shorts, jean shorts, hot shorts, silver shorts, gold shorts,
rainbow shorts, bike shorts,
shirt, dress, swimsuit, bikini. Cloths: denim, stretch denim, chino twill,
poplin, oxford, linen, flannel, satin, viscose crepe, cotton jersey, foil-coated
stretch, swim tricot. Prints: solid, zebra, leopard, pink leopard, rainbow tie-dye,
polka dots,
stripes, gingham, floral, camouflage.

### Six women's shorts

All six sit on the natural waist, are cut close to the body, and share the
trouser block (two fronts, two backs, a waistband).

| Shorts | Cloth | What makes it different on the line |
|---|---|---|
| Jean shorts | pale stretch denim | yokes, patch pockets, belt loops, fly zip, tack button, lap-felled seams, a turn-up cuff |
| Hot shorts | cotton jersey | no fly: four-thread overlock seams, an elastic waistband, coverstitched hems (5 operations) |
| Silver shorts, gold shorts | foil-coated stretch | fly zip and a large sewn button, plain waistband, no pockets |
| Rainbow shorts | swim tricot, rainbow tie-dye | as the hot shorts |
| Bike shorts | swim tricot, pink leopard | as the hot shorts, with a leg to mid-thigh |

The hem of the short ones can be cut higher at the side of the thigh than at
the inside leg. Worn, these six lie skin-tight: the body's own surface pushed
out by the ease, so the cloth goes into the cleft and tucks under each buttock.
The looser jeans and chino shorts span across instead.

## Figure presets

Six starting figures: Women M, Men M, Women 3XL, Men 3XL, Anime girl, Anime boy.
The bust/chest, waist and hip girths of the first four are rows of the EN 13402-3
body-dimension tables as printed on Wikipedia (women: bust 92 / waist 76 / hip 100
and 140 / 124 / 142; men: chest 100 / waist 88 and 138 / 126), the heights are
EN 13402 design heights, and the men's arm length is its height association. The
men's table has no hip column, so the men's hips, like every shoulder width,
inside leg and shape slider, are this page's own proportions. The ASTM tables
(D5585, D6240, D6960) are paywalled and were not used. The anime figures are
stylised (long legs, narrow waist, larger head) and follow no standard.

## The shoulders

From the shoulder tip the body's width runs in a straight slope up to the neck,
which rises steeply out of it, and the section there is an ellipse instead of
the torso's boxy one, so the top of the torso is a dome: round from the side
as well as from the front. The corner
at the shoulder point is rounded with a soft minimum. Sleeveless garments
(dress, swimsuit, bikini) are fitted to that shape. The dress and the swimsuit
end in a corner on the upper chest and on the shoulder blade, and a separate
strap, bartacked at each end, runs flat over the shoulder between them;
the shirt keeps a fuller envelope so its sleeve head clears the top of the arm.

## The lower body

Each side of the lower body is one surface: the thigh, whose ring opens out
into half of the hip section over the 6 cm above the crotch line. The inside of
each thigh swells in to the centre line just below the crotch, so the gap
between the legs ends in an arch and the crotch has length from front to back.
Legs swing out from the hip as rigid limbs for the stance; the swing fades out
over a few centimetres round the crotch, and the lift of the outer thigh is
spread down the leg so the hip does not fold into a ledge. Trousers and shorts
are drafted on the same construction with ease, and swimwear carries on under
the body: 10 cm of cloth from the front and from the back, down to where the
thighs part and then under, meet in the crotch seam. Above the crotch line the
strip where the two sides lie together starts from the front and back ends of
the crotch, so the lower belly and the cleft stay smooth, as on a shop mannequin.

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
real pattern. On very short, close-cut legs the back inside-leg edge is up to
2 cm longer than the front one and is eased on to it. The turn-up cuff of the
jean shorts is a separate band (on real cut-offs it is the leg rolled up). Near
the crotch the worn cloth lies closer to the body than the drafted pattern
allows for. Fabric changes the look, not the construction: an unsuitable cloth
gets a note. The page lists the rest under "What is simplified".

## Tests and review hooks

`node test.mjs` runs the checks embedded in the page: tape girths against the
sliders, every garment at default and extreme sizes, the seam walk (joined edges
must match in flat length), the marker, stitch thread paths and tile wrap.

URL parameters for screenshots: `?still` renders one settled frame, `&bare`
hides the panel, `&stage=1..4`, `&g=jeans|shorts|jeanshorts|hotshorts|metalshorts|goldshorts|rainbowshorts|bikeshorts|shirt|dress|swimsuit|bikini`,
`&form=w|m|w3|m3|ag|ab`, `&xray`, `&mode=stand`, `&op=N&t=0..1` (operation and progress), `&cyc=6.55` (machine
cycle), `&az=&el=&zoom=&ty=` (camera), `&cloth=&print=&colour=RRGGBB`, `&sel=`
(selected piece). `window.__sf` exposes the state and a `tick/render` pair.
