# Sewing Factory

How flat pieces of cloth become a garment, and what each industrial sewing
machine on the line actually does with its threads. Open `index.html` in a
browser (three.js is loaded from a CDN).

## Six stages

1. **Model.** A mannequin with sliders for height, chest, waist, hip,
   shoulder width, inside leg and arm length. The torso sections are solved so
   the tape girths equal the slider values. A Hips and legs card sets the buttocks,
   the gap between the thighs (as a share of the hip width) and the thigh, knee,
   calf and ankle girths. Seven more sliders shape the bust
   (projection, spacing, height, width, fullness above and below, and the rib cage
   under the bust as a share of the bust girth), a heel-lift slider poses the feet for heeled shoes. The chosen garment is shown on the figure. Two modes: a full figure with head,
   arms and legs, or a tailor's dress form on a stand (it hangs from a rail for
   trousers and swimwear, which need the crotch free).
2. **Pose.** Moves the arms, elbows, feet and head. The cut pieces never
   change with the pose.
3. **Shoes.** Pick what the figure wears on its feet. Shoes are only worn,
   not cut or sewn, and stay on while the clothes are tried.
4. **Cloth.** Pick the garment to make. It is drafted for the figure and
   shown on it.
5. **Cut.** The pattern pieces of the chosen garment lie on a cutting table as a
   marker: grain arrows, cutting line, stitch line. Click a piece to give it its
   own cloth, print or colour.
6. **Finished.** The garment on the mannequin, with a clean PNG export. A
   **Sew** subtab on this page holds the sewing line: the operation list in factory order. Each operation goes to the
   machine a factory would use, and a close-up shows that machine forming its
   stitch, thread by thread. The pieces join on the form so you can see where
   each seam ends up.

An **X-ray** switch makes the body see-through and shows either a skeleton or
a robot mannequin inside it. The robot is an articulated shop mannequin: matt
black shells for chest, pelvis and each limb segment, with a ball at every
joint and a steel pin through hips, elbows, knees and ankles (`&xray=robot`).
The skeleton is the default (spine, rib cage, pelvis, limbs, hands, feet,
skull). Both are built from the same measurements and pose, with the clothing
still on.

Garments: jeans, shorts, jean shorts, hot shorts, silver shorts, gold shorts,
rainbow shorts, faux-leather shorts, bike shorts, leggings, scrunch leggings, mesh leggings, shiny leggings, zebra leggings,
flared pants, leather jacket, snake-skin jacket, puffer jacket, puffer coat, chainmail dress, cut-out swimsuit, red catsuit, beige catsuit, gold-shoulder suit, hazmat suit, blue dress, gold dress, long dress, racer-back swimsuit, halter bodysuit, tailored jumpsuit, sequin jumpsuit, holographic leggings, zip bodysuit, side-strap dress, glossy midi dress, gold slip dress, iridescent pink dress, harlequin mesh dress, six skirts (gold mesh, pleated leather, iridescent flared, tiered polka-dot, silver flared, tennis), four tops (zip tube top, leather zip vest, red snap shirt, glossy crop top), striped bikini, glossy blue shorts, white halter dress, pearl racer swimsuit, ruched blue bikini, white bikini bottom, iridescent high-neck swimsuit, white chain monokini, red keyhole monokini, pink vinyl dress, long-sleeve swimsuit,
shirt, dress, swimsuit, bikini. Cloths: denim, stretch denim, chino twill,
poplin, oxford, linen, flannel, satin, viscose crepe, cotton jersey, foil-coated
stretch, leather, scale-embossed leather, quilted nylon, faux leather, metal mesh, wet-look vinyl, coated barrier cloth, glossy tricot, swim tricot. Prints: solid, zebra, leopard, pink leopard, rainbow tie-dye, grey zebra, paisley stripes, red dragon brocade, mélange, open mesh,
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

## Six pages

The page has six steps: **1 Model**, **2 Pose**, **3 Shoes**, **4 Cloth**,
**5 Cut** and **6 Finished**. The header holds only the step buttons. Pose has
the pose buttons, the arm, elbow, stance and head sliders and their Randomize
and Reset. Shoes has the shoe picker. Cloth has the garment picker (all the
garments, as one list of buttons). On those three the chosen garment is shown
on the figure. Finished has two subtabs: **Finished**, the garment on the
figure, and **Sew**, the sewing line with its machine close-ups.

## The garment on the Model page

The Model page shows the chosen garment on the figure, not a bare mannequin.
Moving any slider there (a measurement, the pose, the bust or leg shape)
redrafts the garment for the new body and redraws it at once, so the effect of
a measurement on the cut can be seen without leaving the page. A checkbox,
"Show the chosen garment on the figure", takes it off again to see the body
and the measuring tapes alone (`&dress=0` in a link).

## Randomize, Reset and saved settings

Each section of the Model page (the mannequin's measurements, pose, hips
legs and head, bust) has a **Randomize** and a **Reset** button. The
mannequin's Randomize starts at Heel lift and leaves the choices above it
(full figure or dress form, x-ray, Woman/Man, Medium/Large) alone. Body
measurements are drawn within about a fifth of each slider's range of the
chosen figure, so the result is still a plausible body; pose and shape sliders
are drawn from their whole range. Reset returns a section to the chosen figure's
values.

The Model and Pose sliders, the figure choice, the shoes and the garment are
saved in the browser's local storage and restored on the next visit. A link that names a figure,
shoe or garment (`&form=`, `&shoe=`, `&g=`) uses that for that item, and a
review still (`?still`) ignores storage. The garment's fit sliders and fabric
are not saved.

## Figure presets

Two choices pick the starting figure: Woman or Man, and Medium or Large
(Large is the 3XL row of the size table).
The bust/chest, waist and hip girths are rows of the EN 13402-3 body-dimension
tables as printed on Wikipedia (women: bust 92 / waist 76 / hip 100 and
140 / 124 / 142; men: chest 100 / waist 88 and 138 / 126), the heights are
EN 13402 design heights, and the men's arm length is its height association. The
men's table has no hip column, so the men's hips, like every shoulder width,
inside leg and shape slider, are this page's own proportions. The ASTM tables
(D5585, D6240, D6960) are paywalled and were not used. Other figures are reached with the sliders.

### Leggings and flared pants

Full-length, skin-tight knits on the same block as the hot shorts (overlock
seams, elastic waistband, coverstitched hems).

| Leggings | Cloth | What makes it different |
|---|---|---|
| Leggings | cotton jersey, blue mélange | waistband dipping to a V at the centre front |
| Scrunch leggings | cotton jersey, olive | the V waistband, and elastic zigzagged along the back seam to gather it |
| Mesh leggings | swim tricot, grey | an open-mesh strip coverstitched down the outside of each thigh |
| Shiny leggings | glossy tricot, coral | the V waistband, seams in a pale contrast thread |
| Zebra leggings | swim tricot, grey zebra | plain waistband |

**Flared pants** are the same knit block worn lower on the hips: tight to the
knee, then flaring to the hem (a Flare slider), in a paisley-stripe jersey with
a plain white elastic waistband and a drawstring.

The **long-sleeve swimsuit** is the swimsuit's lower half with a high neck,
shoulder seams and set-in sleeves cut from a second colour. Its sleeve stays a
tube round the arm until just before the armhole seam, because a skin-tight
sleeve pulled in earlier sinks into the shoulder.

Both swimsuits have a **Zip** option: none, centre front or centre back. The
panel is slashed from the neckline and the zip set into the slash on the
lockstitch machine, as its own operation (`&zip=0|1|2`).

### Two jackets

A short zip-front jacket on the shirt's block (two fronts, back, yoke, set-in
sleeves, cuffs, collar), with an open-ended front zip, a slanted zip pocket on
each front and cuff snaps in place of buttons. The leather jacket is plain
black leather with a pebbled grain; the snake-skin jacket is glossy leather
embossed with scales (how most "exotic" jackets are made). Both are sewn on
the lockstitch machine only, and the operation notes say what leather changes:
wedge-point needle, roller foot, long stitches, tape instead of pins, seams
glued and hammered open, no overlock. Grain and scales are relief on the
surface, built from the same pattern as the colour.

### Two quilted winter jackets

The puffer jacket (grey, hip length) and the puffer coat (red, flaring to an
A-line above the knee, with zip pockets) are the jacket block in a quilted
nylon cloth whose channels are relief on the surface. A hood replaces the
collar; it is shown worn down, hanging behind the shoulders. The line starts
with a quilting operation, and the notes describe sewing through wadding
(walking foot, wadding trimmed out of the seam allowances, bound edges).

### Chainmail dress, faux-leather shorts, cut-out swimsuit

The **chainmail dress** is the dress block cut short and straight with thin
straps, in a metal mesh of small plates that glint separately. Real metal mesh
is joined by opening rings with pliers, not sewn; the cloth's note says so.
The **faux-leather shorts** are the knit shorts in a polyurethane-coated
stretch cloth. The **cut-out swimsuit** has a high neck and a front made of two
halves that meet only at two rings, leaving three teardrop openings down the
centre (a slider sets their size); below the lowest opening the halves are
seamed together.

### Catsuits

The red and the beige catsuit are one construction: the leggings and a
long-sleeved, high-necked bodice joined by a waist seam, with a stand collar,
in a mirror-smooth wet-look vinyl. The Zip option (none, front, back) starts
at the back on the red one and at the front on the beige one. It is a through
zip: from the collar down the centre, through the crotch and up the other side
to the waist, so the whole suit opens.

The **gold-shoulder suit** is the catsuit in black with pieces of gold foil
cloth stitched on top (bust panels, an under-bust band, a belt, cuffs) and a
giant ribbed gold shell bartacked over each shoulder.

The **blue dress** is the dress block cut close in wet-look vinyl, with thin
red straps, a red panel on the outer half of each cup and a red binding round
the hem. The **gold dress** is a qipao: one front and one back from hem to
neck, short set-in sleeves, a mandarin collar with a knot button, and a side
zip, in gold satin with a red brocade print.

The **long dress** is a close sleeveless sheath from neck to calf in four
lengthwise panels: beige centre front and centre back, a black panel down each
side, and a black band at the neck. The centre panels narrow in a curve from
the underarm to the neck, and a black band along that edge carries on over the
shoulder as the strap, so each armhole is a rounded opening. Each side panel has
a tall narrow slit up from the hem (a slider sets its height; 0 closes it). The **racer-back
swimsuit** has a high-necked black front, a short silver back panel with a
tongue rising up the spine, and two blue straps from the shoulders to the top
of the tongue; between them the back is open.

### Three more one-piece suits

The **halter bodysuit** (black wet-look vinyl) is a high-cut brief joined by a
waist seam to two bodice halves. The halves meet at a point on the centre front,
plunge open above it, and each ends in a long tie; the ties knot in a bow at the
nape. The back is bare above a low back panel.

The **tailored jumpsuit** (camel chino twill) is a fitted long-sleeved bodice
with a pointed collar and wide straight legs, joined at the waist under a belt,
with a zip from the neckline to the hip. Its legs reuse the simple two-panel
trouser block, so it has no pockets, darts or pressed creases.

The **sequin jumpsuit** (green) has flared legs to a high waist, a midriff band,
and two bust pieces that cross to the opposite side of the neck, leaving a
keyhole between them; a neck band closes at the nape and the back is bare. It
comes with a new cloth, **sequin mesh**: discs in offset rows, each tilted its
own way so they glint separately.

### Slip dresses, a glossy sheath and two iridescent cloths

The **slip dress** block is two pieces, front and back, on thin rouleau straps,
with a low straight back. The **gold slip dress** (foil) and the **iridescent
pink dress** cross their straps over the back. The **side-strap dress**
(burgundy jersey) is seamed on one side only: the other stays open from underarm
to hem and is bridged by three short straps.

The **glossy midi dress** is the qipao block as a plain black vinyl sheath: a V
neck, long close sleeves, no collar, a side zip. The **zip bodysuit** is the
long-sleeved swimsuit in red vinyl with a stand collar and a front zip. The
**holographic leggings** are the high-waisted leggings in holographic vinyl.

Two cloths are new. **Holographic vinyl** and **iridescent foil** carry a thin
clear film, and light reflected from its top and bottom interferes, so the
highlights take on colours that shift with the viewing angle (three.js
thin-film iridescence; on the vinyl the film thickness varies gently across the
cloth so one highlight splits into several colours).

### Skirts

One block makes six skirts: a fitted yoke band from the waist, and below it a
skirt that flares away from the body. The flare is extra cloth, which cannot
hang flat, so each skirt deals with it differently:

- **Iridescent flared skirt** and **silver flared skirt**: the hem falls into
  soft waves. Both yokes dip to a V at the centre front.
- **Pleated leather skirt** and **tennis skirt**: the skirt is pressed into knife
  pleats that open towards the hem (30 wide pleats in faux leather, 56 narrow
  ones in white tricot).
- **Tiered polka-dot skirt**: two gathered ruffles, the upper overlapping the
  lower, under a shirred waistband.
- **Gold mesh skirt**: no yoke. A straight panel of metal mesh hangs low from a
  chain that rests on the hips. The chain's ends link to the two top corners of
  the front, and a short chain drops from its middle to the centre of the back.
  The top edge is highest at those three points and sags between them, deepest
  over each hip.

The pleats and gathers are drawn as folds in the surface. The flat pattern is
unrolled from that surface, so it shows roughly how much wider the skirt piece
is than the yoke, but not the true depth of a pressed pleat (a real knife-pleated
strip is about three times the finished width).

The **harlequin mesh dress** is the slip dress in gold metal mesh with a new
black-diamond print, crossed chain straps, a ring at the neckline and a hem cut
in points. The fringe that hangs below the points on the real dress is not
modelled.

### Tops

Three tops open down the centre front and share one block of two fronts and a
back:

- **Zip tube top** (black vinyl): a strapless band with an exposed zip and a
  hem that dips to a point. Elastic in both edges holds it up.
- **Leather zip vest** (faux leather): sleeveless, with shoulder seams, a stand
  collar and a zip.
- **Red snap shirt** (vinyl): the same body cut to the hip, with a fold-over
  collar and six snap fasteners. The line has no snap press, so the snaps are
  shown at the button station.

The **glossy crop top** is separate: a scoop-necked front, a racer back that
narrows to a tongue between the shoulder blades, wide straps over the
shoulders to the top of the tongue, and an elastic band round the hem.

The **striped bikini** is the bikini in a new pastel rainbow stripe print with
string-thin sides, and the **glossy blue shorts** are the knit hot shorts in
glossy tricot.

### White halter dress and pearl racer swimsuit

The **white halter dress** (linen) has a square bib front that narrows from the
waist to the chest. A band of eyelet trim runs up each slanting edge of the bib
and on round the neck, and that band is what holds the bodice up; the back is
bare to the waist and edged with the same trim. Below is a long A-line skirt
with two bands of eyelet. A new **eyelet** print draws the punched holes; the
skirt bands are laid on top, not let in, so they are not see-through.

The **pearl racer swimsuit** is the racer-back swimsuit with a pearl-finish
front (a new iridescent cloth), zebra-print straps and back, a gold yoke where
the straps meet, and two gold appliqués on the chest. The appliqués are plain
curved leaves, not the embroidered scrollwork of the real suit.

### More swimwear

The **ruched blue bikini** has underwired half cups on thin shoulder straps
(not triangles on neck ties), a loop of cloth pinching the join between the
cups, and a small bottom with string-thin sides. The cups are gathered into
folds across, and the bottom front into folds lengthwise; both are drawn as
ripples in the surface.

The **white bikini bottom** is a high-cut bottom on its own, with a gusset
lining, in a new **crinkle swim cloth** (a knit that puckers like seersucker).

The **iridescent high-neck swimsuit** is the long-sleeved swimsuit without its
sleeves: a stand collar, a back zip, high-cut legs. Its cloth, **holographic
lycra**, is metallic and iridescent but lies smooth, so the colours run in
broad bands instead of the crumpled glints of the foil cloths.

### Monokinis

A monokini is a one-piece cut away at the sides. The front is two halves: each
is a cup that narrows to a strip at the waist and widens again into the bottom
front, and the halves are seamed together below the bust. The back is only a
bottom back. Front and back are sewn to each other at the crotch and nowhere
else; a short chain over each hip joins them, and thin straps run from the
cups over the shoulders and straight down to the top of the back.

- **White chain monokini**: white tricot. Its front is a V: a narrow strip
  rises from the crotch to a point, splits into two bands that run up and out
  to the sides of the bust with the belly bare between, and each band becomes
  a cup whose lower edge climbs back to a ring in the middle. Strings from the
  cups tie in a bow behind the neck. One gold chain, fixed only to the two top
  corners of the back, passes round the front over the point of the V.
- **Red keyhole monokini**: red foil, an oval opening below the bust, a small
  bow over the join, and chain for the shoulder straps as well.

The **pink vinyl dress** is the tight mini dress in pink wet-look vinyl with
wide straps and a scoop neck.

### Hazmat suit

A loose one-piece coverall in yellow coated cloth: bodice and legs joined at an
elasticated waist, a front zip, and a hood worn up that is open only round the
face. A ready-made respirator (face piece, visor, two filters) is worn with it;
like the shoes, it is not cut or sewn. The notes explain that the stitched
seams of a real suit are then sealed with welded tape.

## Shoes

A Shoes row in the header puts ready-made shoes on the full figure: flip-flops,
platform heels, knee boots, leopard over-the-knee boots, green hazmat boots
or chunky platform boots (or barefoot). They are not
part of the factory line: nothing is cut or sewn, and they stay on at every
stage, so garments can be tried with them. Each shoe sets the heel height the
foot is posed at and the thickness under it, and the figure stands that much
taller. The dress form has no feet and wears none. `&shoe=flipflops|heels|boots|otk|hazmat|chunky`.

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
gets a note.

More that is simplified or left out (this list used to be a panel on the
Finished page):

- Machine timing is schematic and slowed down; real machines make 4,000–8,000 stitches a minute. Thread is drawn much thicker than life.
- There is no cloth physics. Garments are smooth surfaces fitted round the form, so there are no folds or drape.
- Pattern pieces are unrolled from the form, not graded industry blocks. There are no darts, facings, linings or interfacing, and the sleeve head has more ease than a real pattern.
- Left out: pocket bags, fly facings, rivets, labels, pressing and inspection. Buttons and zips are sewn but simplified.
- Assembly is shown on the form. In a factory each operation is done flat at its machine and bundles move between operators.
- Fabric changes the look only. The construction is fixed per garment, so an unsuitable cloth gets a note, not a different set of machines.
- The weave of each cloth is drawn enlarged. Zebra and leopard prints come from the zebra-pattern and leopard-pattern pages of this lab.
- A real marker nests many garments and sizes to reach 80–90 % cloth use; this one lays out a single garment.

## Tests and review hooks

`node test.mjs` runs the checks embedded in the page: tape girths against the
sliders, every garment at default and extreme sizes, the seam walk (joined edges
must match in flat length), the marker, stitch thread paths and tile wrap.

URL parameters for screenshots: `?still` renders one settled frame, `&bare`
hides the panel, `&stage=1..6` (1 Model, 2 Pose, 3 Shoes, 4 Cloth, 5 Cut, 6 Finished; add `&tab=sew` to page 6 for its Sew subtab), `&g=jeans|shorts|jeanshorts|hotshorts|metalshorts|goldshorts|rainbowshorts|bikeshorts|leggings|scrunchleggings|meshleggings|shinyleggings|zebraleggings|flarepants|leatherjacket|snakejacket|pufferjacket|puffercoat|chaindress|leathershorts|rashsuit|cutoutsuit|catsuitred|catsuitbeige|goldsuit|hazmat|bluedress|golddress|longdress|racersuit|halterbody|tailoredsuit|sequinsuit|hololeggings|zipbody|sidedress|glossdress|goldslip|pinkslip|harlequindress|chainskirt|leatherskirt|pinkskirt|dotskirt|silverskirt|tennisskirt|tubetop|vesttop|snapshirt|croptop|stripebikini|blueshorts|halterdress|metalsuit|bluebikini|whitebottom|holosuit|chainsuit|redmonokini|pinkvinyl|shirt|dress|swimsuit|bikini`,
`&form=w|m|wl|ml`, `&xray`, `&mode=stand`, `&op=N&t=0..1` (operation and progress), `&cyc=6.55` (machine
cycle), `&az=&el=&zoom=&ty=` (camera), `&cloth=&print=&colour=RRGGBB`, `&sel=`
(selected piece). `window.__sf` exposes the state and a `tick/render` pair.
