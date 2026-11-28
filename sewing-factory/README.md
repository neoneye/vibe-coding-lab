# Sewing Factory

How flat pieces of cloth become a garment, and what each industrial sewing
machine on the line actually does with its threads. Open `index.html` in a
browser (three.js is loaded from a CDN).

## Five stages

1. **Model.** A mannequin with sliders for height, chest, waist, hip,
   shoulder width, inside leg and arm length. The torso sections are solved so
   the tape girths equal the slider values. A Legs card sets the buttocks,
   the gap between the thighs (as a share of the hip width) and the thigh, knee,
   calf and ankle girths. Seven more sliders shape the bust
   (projection, spacing, height, width, fullness above and below, and the rib cage
   under the bust as a share of the bust girth). The feet are posed for the heel of whichever shoe is worn, and stand flat when barefoot. The chosen garment is shown on the figure. Two modes: a full figure with head,
   arms and legs, or a tailor's dress form on a stand (it hangs from a rail for
   trousers and swimwear, which need the crotch free).
2. **Pose.** Moves the arms, elbows, feet and head. The cut pieces never
   change with the pose.
3. **Shoes.** Pick what the figure wears on its feet. Shoes are only worn,
   not cut or sewn, and stay on while the clothes are tried.
4. **Cloth.** Two subtabs. **Type** picks the garment to make; it is drafted
   for the figure and shown on it. **Customize** is the cutting table: the pattern pieces of the chosen garment lie on a cutting table as a
   marker: grain arrows, cutting line, stitch line. Click a piece to give it its
   own cloth, print or colour.
5. **Finished.** The garment on the mannequin, with a clean PNG export. A
   **Sew** subtab on this page holds the sewing line: the operation list in factory order. Each operation goes to the
   machine a factory would use, and a close-up shows that machine forming its
   stitch, thread by thread. The pieces join on the form so you can see where
   each seam ends up.

The Finished page has an **Export** subtab: a document with the instructions
for making the chosen garment, written to be more detailed than a typical
pattern's. It can be printed, saved as a stand-alone HTML file, saved as
Markdown, or saved as JSON for another program to read. It holds:

- an overview: level, number of pieces, steps and machines, cloth to buy,
  total length of stitching, thread, and estimated cutting and sewing time;
- a self-audit that everything else in the document follows from. One
  validation engine (`SF.audit`, in the shared code) checks every pair of
  edges that is sewn together, every collar and hood against its neckline,
  and every zip against the stitching that holds it. Each check gets one of
  five verdicts: pass, ease, warning (a stretch cloth sewn to one that does
  not stretch), unverified (the model has nothing to compare, which is never
  counted as a pass) or fault. The document opens with the result: ready to
  cut, review first, or hold. A step with a fault is marked blocked and says
  what to correct before its instructions apply. How much a seam may ease
  follows the cloth: 2.5 % where nothing stretches, 8 % round a sleeve head,
  and up to 10 % in stretch cloth;
- edge coverage (`SF.coverage`): passing seams are not enough, so every edge
  of every piece must also have something done to it: sewn to another edge,
  hemmed, elasticated, closed, stitched down, caught in a seam, the fold or
  the ends of a doubled band, a pocket mouth, or declared free (metal mesh).
  An edge with none of these is "not assigned" and keeps the garment from
  being ready. The report writes what becomes of each edge beside it. A
  waistband, collar, cuff or welt is stitched on by one edge; the edge it is
  sewn to is worked out (`SF.bandJoins`) and checked like any other seam, and
  the step says how the band is closed, folded and attached;
- corrections the generator makes itself, each listed in the audit as
  "Corrected". Seams are trued (`SF.trueSeams`): two edges that are sewn
  together are one line on the body, but each is unrolled flat with its own
  piece, and where they came out more than 2.5 % and 1 cm apart both are
  brought to their mean length. Where a sleeve head is more than 6 % longer
  than its armhole, the armhole is re-cut to leave 3 % of ease. A collar or
  hood is redrafted to the length of the neckline it is sewn to. Only the
  flat pieces change; the picture shows the garment as first drawn;
- an audit sweep (`SF.auditSweep`, run by the tests): every garment on the
  four standard figures, 488 builds. None is held and no edge is left
  unassigned (before truing, 30 were held; when coverage was first run, 611
  edges on 102 garments had no construction). About a quarter are "review",
  mostly for a zip whose opening the model does not draft. A second test
  breaks garments on purpose (a seam 10 % too long, a collar 30 % too long,
  the hem step removed, the waistband step removed) and checks each is caught;
- the figure it is drafted for (measurements and heights from the floor) and
  every option with its value, default and range;
- a gallery of the garment in six poses;
- what to buy: each different cloth in the garment with its own cutting plan,
  length to buy and weight (leather by area of skin, a piece the size of a
  hand as a remnant); thread, zips, buttons, elastic, interfacing; the
  tools, and what to do before cutting, chosen for every cloth used: needles,
  pins or clips, washing, and matching stripes;
- a cutting plan for each cloth, a cutting table, and every piece to one
  scale with cutting line, stitching line and grain line, and the length of
  each of its edges;
- each factory machine with what does the same job at home;
- every sewing step: a drawing of the pieces with the edges to sew drawn
  heavy, which edge joins which with both lengths (and how much to ease when
  they differ), where to stitch and how far from the edge, how much stitching,
  thread and time it takes, how to do it, and what to check before going on.
  The how-to is written from the step's own numbers and for its machine: an
  overlocked seam is not backtacked or pressed open, a hem names its depth,
  elastic is given cut lengths;
- finishing and fitting, care, and a glossary.

The times and thread amounts are estimates from the length of stitching; the
total sewing time is the sum of the times given at the steps. The document says of itself that it comes from a simplified model
that nobody has sewn.

An **X-ray** switch on the Finished page makes the body see-through and shows either a skeleton or
a robot mannequin inside it. The robot is an articulated shop mannequin: matt
black shells for chest, pelvis and each limb segment, with a ball at every
joint and a steel pin through hips, elbows, knees and ankles (`&xray=robot`).
The skeleton is the default (spine, rib cage, pelvis, limbs, hands, feet,
skull). Both are built from the same measurements and pose, with the clothing
still on.

Garments: jeans, shorts, jean shorts, hot shorts, silver shorts, gold shorts,
rainbow shorts, faux-leather shorts, bike shorts, leggings, scrunch leggings, mesh leggings, shiny leggings, zebra leggings,
flared pants, leather jacket, snake-skin jacket, puffer jacket, puffer coat, chainmail dress, cut-out swimsuit, red catsuit, beige catsuit, gold-shoulder suit, hazmat suit, blue dress, gold dress, long dress, racer-back swimsuit, halter bodysuit, tailored jumpsuit, sequin jumpsuit, holographic leggings, zip bodysuit, side-strap dress, glossy midi dress, gold slip dress, iridescent pink dress, harlequin mesh dress, six skirts (gold mesh, pleated leather, iridescent flared, tiered polka-dot, silver flared, tennis), four tops (zip tube top, leather zip vest, red snap shirt, glossy crop top), striped bikini, glossy blue shorts, white halter dress, pearl racer swimsuit, ruched blue bikini, white bikini bottom, iridescent high-neck swimsuit, white chain monokini, red keyhole monokini, pink vinyl dress, The Dress, fishnet tights, lace stockings, one-sleeve snake swimsuit, laser-cut swimsuit, two-cats swimsuit, gold lace-up monokini, olive ring monokini, black two-keyhole monokini, black and leopard monokini, three-colour one-shoulder swimsuit, black one-shoulder swimsuit, cross-halter three-colour swimsuit, colour-band swimsuit, hourglass-stripe swimsuit, sequin swimsuit with chains, plaid boy-leg swimsuit, holographic swimsuit with neon straps, cherry swimsuit, two-tone ring monokini, dark snake keyhole monokini, blue cross-wrap swimsuit, white mesh-strip halter top, brown gathered halter top, black bodysuit with a sheer V, black cross-halter dress, pink glossy racer swimsuit, bronze shimmer long-sleeve bodysuit, floral sequin romper, red vinyl unitard, navy and yellow swim unitard, gold ring keyhole monokini, black zip sports romper, waistcoat swimsuit, green exposed-seam crop tee, teal mesh top with bandeau, long black vinyl coat, long black buttoned coat, flared vinyl zip coat, double-breasted vinyl coat, clear raincoat, orange prison coverall, black-and-white striped jacket and trousers, blue ticking-stripe jacket and trousers, striped prison dress, navy crew suit, grey crew jacket and trousers, white belted uniform dress, white officer coat dress, balloon cargo trousers, grey wide-leg sweatpants, brown plunge halter dress, black sequin bell-sleeve dress, black zip keyhole bodysuit, sequin bustier bodysuit, red foil and mesh bodysuit, heart-lace halter teddy, pink net romper, long-sleeve swimsuit,
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

## Five pages

The page has five steps: **1 Model**, **2 Pose**, **3 Shoes**, **4 Cloth** and
**5 Finished**. The header holds only the step buttons. Two pages have subtabs
at the top of their panel:

- **Cloth**: **Type**, the garment picker (all the garments, as one list of
  buttons), and **Customize**, the cutting table with the garment's fit sliders
  and its fabric.
- **Finished**: **Finished**, the garment on the figure, and **Sew**, the
  sewing line with its machine close-ups.

Type has a **Randomize** button that picks another garment, and a
**Temperature** slider that sets how far the pick strays from the usual. At 0
it is the garment as designed. At 1 every fit slider lands anywhere in its
range and every piece gets its own random fabric. In between, each slider moves
that share of the way to a random value, options, cloth, print and thread are
re-drawn with that probability, and the colour is mixed that far towards a
random one. The temperature is remembered. On Type the
left and right arrow keys step to the previous and the next garment in the
list, wrapping round at the ends. Customize's fit
card has **Randomize** and **Reset** for the garment's fit sliders and options
(zip position and the like). Its fabric card has two more:
**Randomize** picks one cloth, print and colour for the whole garment, and
**Randomize each piece** picks a different one for every piece (about half the time the print is plain, so the cloth itself shows; a
print that has its own ground colour, such as zebra, keeps it).

**F** fills the screen with the 3D view alone, without the header and the
panel; **Esc** (or F again) brings them back.

Switching tabs keeps the camera. The tabs that show the figure (Model, Pose,
Shoes, Type, Finished) share one view, so an orbit or zoom set on one carries
over to the others. The cutting table (Customize) has its own view and comes
back to where it was left, unless the garment changed. The sewing line (Sew)
turns to face each seam as before.

Poses are symmetric by default. **Left and right separately**, on the Pose
page, gives each side its own sliders: left and right arm out, arm forwards,
elbow bend and foot out. Left and right are the figure's own. With the legs
swung out by different amounts the figure stands on the lower foot and the
other is lifted. Randomize then draws each side on its own; Reset and the pose
presets set both sides alike. Turning it off makes the right side mirror the
left again. In a link the right side's values are the same keys with an R
(`&armOutR=`, `&armFwdR=`, `&elbowR=`, `&stanceR=`).

Pose has the pose buttons, the arm, elbow, stance and head sliders and their
Randomize and Reset. An **Animated** toggle beside them makes Randomize, Reset
and the pose presets move the figure to the new pose over about 1.3 seconds
instead of jumping to it. The figure and the garment are rebuilt for every
in-between pose (about 30 to 40 ms a step for most garments, about 130 ms for
the swimwear), so the transition is timed by the clock and shows fewer steps on
a slow machine. Touching a pose slider stops it. Shoes has the shoe picker. On Pose, Shoes and Type the
chosen garment is shown on the figure.

## The garment on the Model page

The Model page shows the chosen garment on the figure, not a bare mannequin.
Moving any slider there (a measurement, the pose, the bust or leg shape)
redrafts the garment for the new body and redraws it at once, so the effect of
a measurement on the cut can be seen without leaving the page. A checkbox,
"Show the chosen garment on the figure", takes it off again to see the body
and the measuring tapes alone (`&dress=0` in a link).

## Randomize, Reset and saved settings

Each section of the Model page (the mannequin's measurements with the
head size, hips and legs, bust) has a **Randomize** and a **Reset** button. The
mannequin's Randomize changes the measurements and leaves the choices above
them (Woman/Man, Medium/Large) alone. Body
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
| Mesh leggings | swim tricot, grey | an open-mesh strip coverstitched down the outside of each leg, from the waistband to the ankle |
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
to hem and is bridged by four short straps, the first right at its top under the arm.

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
black-diamond print, crossed chain straps and a hem cut
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

**The Dress** is the dress from the 2015 photo that people saw either as blue
and black or as white and gold. As made it is royal blue with black lace: a
tight sheath with lace bands stitched round it (at the top edge, under the
bust, a wide one at the waist, then evenly down to the hem) and lace straps.
Its default cloth, *jersey, as the 2015 photo showed it*, is a demonstration
and not a real fibre: the side the lamp falls on takes the colours the
overexposed photo gave (blue-white and golden brown), the shaded side keeps
the true ones, so turning the figure shows both readings at once. Pick cotton
jersey on Customize to see the dress as it was made. The real colour shift
came from the camera and from how the eye discounts the light, not from the
cloth. Simplified: the narrow overlapping tiers between the bands are a print
on plain panels, and the sheer yoke over the shoulders is left out.

### Three more swimsuits

- **One-sleeve snake swimsuit**: the long-sleeve swimsuit with only the right
  sleeve. On the sleeve side the neck hole ends half way out along the
  shoulder, so the top of the shoulder beside the neck is bare; on the bare
  side there is no shoulder at all: the top edge slants from the neckline down
  to the underarm, front and back, and a thin strap runs over the shoulder.
  Its print, *snake skin*, is a lattice of small scales, each one flat colour,
  carrying a large dark pattern of saddles and blotches that is the same on
  both sides of a centre line; the pattern's edges are stepped along the scales.
- **Laser-cut swimsuit**: the strap swimsuit in black, with a front panel in a
  *laser-cut leaves* print: pairs of leaf-shaped holes along the lines of a
  diamond lattice, drawn in the mannequin's colour. Simplified: the holes are a
  regular lattice rather than the original's vines, and the notch at the centre
  of the neckline is left out.
- **Two-cats swimsuit**: a sleeveless scoop-neck swimsuit whose front carries a
  *placement print*: one picture across the whole piece, built like a yin-yang.
  The left half is dark and the right half white, and each swells into a round
  cat's head on the other's side. Turn the picture half round and it is the
  same picture with the two colours exchanged. The back carries a second
  picture with the same property: two cats curled head to tail in a disc, dark
  below and white above inside it, and the other way up outside it. A placement print is
  the only print here that is not designed to repeat; chosen for any other piece
  on Customize it is tiled like the rest, and the picture is cut at the tile edges.

### Seven cut-away swimsuits

Four are the monokini (two front halves, a bottom back, no side seams) with new
options:

- **Gold lace-up monokini**: gold foil, the neckline open right down to the
  waist and laced across with a cream cord tied in a bow; cream neck ties and
  hip ties. The cream binding round every edge of the original is only the
  colour of the stitching here.
- **Olive ring monokini**: a narrow strip from under the bust down to the
  bottom, triangle cups on halter ties, a thin tie round the back, and a metal
  ring at each hip that the hip ties run from. The back is a full bottom, not
  the original's string.
- **Black two-keyhole monokini**: two openings one above the other down the
  centre front, a clasp at each join, hip ties and a band across the back.
- **Black and leopard monokini**: one opening under a ring; each front half is
  one fabric above the ring and the other below it, turn about. The lower parts
  are drawn as a second layer over a full-length half, not as separately cut
  pieces with a seam.

Three are not the same on both sides, and are built from flat panels and bands
laid on the body over an ordinary bikini bottom (`panelsuit`):

- **Three-colour one-shoulder swimsuit**: a blue one-shoulder top, a yellow
  panel slanting from the same shoulder over the other breast, a yellow band
  round the waist on a slant, and a pink bottom with a side tie. The slit the
  original leaves open between the two panels is not cut.
- **Black one-shoulder swimsuit**: a bandeau in crinkle cloth, a panel draped
  from one shoulder, and one slanting strap from an ornament at the centre down
  to a second ornament at the opposite hip.
- **Cross-halter three-colour swimsuit**: a red and a purple panel that cross
  over the chest and tie behind the neck, on a wide pink band with a clasp at
  the back, and two pink sashes from the band to a loop at the top of a
  high-waisted red bottom. The underwires and the small opening in the bottom
  are left out.

For these three the joins are shown as stitching and bartacks only; their seam
lengths are not checked against each other the way the other garments' are.

### Nine more swimsuits

Six are existing shapes with a new print or trim:

- **Colour-band swimsuit**: the sleeveless scoop-neck suit with a placement
  print of pink, green and black bands, two of them on a slant, front and back.
  On the original these are separately cut panels seamed together; here they
  are one printed piece.
- **Hourglass-stripe swimsuit**: a placement print of black stripes drawn in at
  the waist and fanning out above and below.
- **Sequin swimsuit with chains**: sequin mesh, with three lengths of gold
  chain hung in swags across one side of the front. The original's two-tone
  front is one colour here.
- **Plaid boy-leg swimsuit**: the strap swimsuit with a low back in a *window
  plaid* of thin and thick bars. The leg is cut low but has no short legs.
- **Holographic swimsuit with neon straps**: iridescent foil, a deep neckline,
  neon straps, and a wide neon binding round the neck, armholes and leg
  openings. The binding is drawn as separate strips lying on the suit along
  each edge, not as a strip folded over the edge.
- **Cherry swimsuit**: a *cherries* print on pale blue, wide straps and a red
  drawstring bow at the neckline. A ruffle runs round each leg opening: a
  strip of the suit cloth cut 1.8 times as long as the edge, roll-hemmed and
  gathered on, drawn standing off the suit in small waves. The gathered bust
  is left out.

Three are cut-away shapes:
- **Two-tone ring monokini**: a cream halter top, open to the waist, meeting a
  brown bottom at a ring; a band ties across the back. The lower fronts are a
  second layer in the other colour, as on the black and leopard one.
- **Dark snake keyhole monokini**: a new cloth, *iridescent snake-embossed
  lycra* (dark, with scales that flash blue and violet), one opening under the
  bust, hip ties and a band across the back. The ruffles on the straps and
  under the bust are left out.
- **Blue cross-wrap swimsuit** (its own builder, rebuilt from the references):
  two wide halves that start at the sides of the bust, cross over the upper
  chest and narrow into straps. Each strap goes over the far shoulder and
  straight back across the bare back to its own half's outer corner, so the
  straps cross on the back as well. The bottom is cut high, and its sides
  rise in two narrow points that join the top's outer corners, with no strap
  between them, so the belly and the small of the back are bare. The
  reference's metal clasp and the cut-out under it are left out.

### Twelve more, mostly variations

Two use a new **halter top** builder (a front narrowing from the side seams up
to the base of the neck, a band or tie round the back, ties knotted at the
nape):

- **White mesh-strip halter top**: white, with one strip of open mesh down
  the centre front; a slider sets the strip's width. The original's straps run
  to a racer back; here they tie at the nape. (The *ladder* print of lines of
  small slots that it first used is still in the print list.)
- **Brown gathered halter top**: gathered into the neck, with only a thin tie
  round the back.

The rest are options on existing builders:

- **Black bodysuit with a sheer V** (long-sleeve swimsuit, sleeves cut short):
  the sheer panel is a placement print, not real see-through mesh.
- **Black cross-halter dress** (plunge halter dress): each bodice half crosses
  over the chest to the other side of the neck, leaving an opening below the
  crossing.
- **Pink glossy racer swimsuit** (sleeveless high-neck swimsuit with a back
  zip, in pink glossy tricot).
- **Bronze shimmer long-sleeve bodysuit** (long-sleeve swimsuit with a deep
  scoop, in holographic lycra with a new print, *Shimmer dots, snake*: tiny
  foil dots in gold, cream, brown and red whose mix follows a large, soft
  snake marking).
- **Floral sequin romper** (catsuit with short legs, no collar and a deep
  neck): the choker and the belt are left out.
- **Red vinyl unitard** and **navy and yellow swim unitard** (catsuit without
  sleeves or collar, legs to mid-thigh): the second has a yellow yoke as a
  placement print; its white side stripes barely show.
- **Gold ring keyhole monokini** (monokini whose tall cups stay apart: their inner edges run side by side down into the opening, an open metal ring sits in the gap, and a lace knotted to each side of it runs round the body to a bow at the back; each front half is cut in two at the ring, so the two cups and the two lower fronts can each take their own fabric; front and back narrow to the hip and meet there in a side seam a couple of centimetres long).
- **Black zip sports romper** (catsuit with short legs and short sleeves, a
  front zip from the collar to the waist seam, and a stand collar): each front leg
  is cut as a centre panel and an outer panel along one bowed curve from the
  side seam, a hand's width under the waist, in and down to the crotch, so the four panels can each take their own fabric.
- **Waistcoat swimsuit** (sleeveless high-neck swimsuit): the waistcoat, shirt
  front, tie and buttons are one placement print on the front, under a white
  stand collar.


### A sheer mesh top

From the `shirt/green` reference: the **Teal mesh top with bandeau**, a
long-sleeved, hip-length top with a mock neck and cuffs that flare a little,
in a new cloth, *Stretch mesh (sheer)*. It is the first cloth drawn half
see-through, so the figure and the opaque bandeau worn under the top show
through it. The bandeau is a separate tube, not sewn to the top. Not made:
the rippled lettuce edge at hem and cuffs (drawn plain), and the neck chain.
Where the sleeve heads overlap the body of the top, the double layer of
sheer cloth shows as a darker patch at each shoulder.

### A lamé shirt, a mesh T-shirt, harem trousers and denim micro shorts

Four garments from the `shirt/goldleopard`, `shirt/meshtshirt`,
`pants/haremblackshiny` and `shorts/jeanshortsspandex` references, each on a
builder the page already had:

- the **Gold leopard satin shirt** is the shirt in a new cloth, metallic satin
  (lamé), with the leopard print on a gold ground;
- the **Iridescent mesh T-shirt with bandeau** is a loose, hip-length tee in a
  new sheer cloth whose colour slides from violet to blue, with elbow-length
  sleeves and a flat black rib round the neck. A black bandeau is worn under
  it (the photo shows a triangle top; the page has no triangle top that goes
  under another garment);
- the **Black wet-look harem trousers** are the balloon trousers without their
  pockets and drawstring, in black vinyl, with an elastic waistband on the
  natural waist and the legs drawn in at the ankle;
- the **Blue stretch-denim micro shorts with a heart** are low-rise jean
  shorts with two tack buttons, leg hems bound in light blue rib, and an
  iron-on rhinestone heart on the right back pocket. The brand lettering and
  the silver tab on the photo's waistband are left out.

### A holographic skirt, top and shorts

From the `skirt/holographic`, `top/metallic` and `shorts/metallic`
references:

- the **Clear holographic circle skirt** is the flared skirt on a narrow
  waistband, in a new cloth: a see-through film with a holographic sheen;
- the **Holographic mock-neck crop top** is the sleeveless vest made to pull
  on: a one-piece front, a closed mock neck and no zip, sewn on the overlock
  and coverstitch, in silver holographic lycra;
- the **Holographic drawstring shorts** are loose shorts in the same lycra,
  with an elastic waistband, a drawstring and a hem that rises at the side.
  The notch in the photo's side hem is not cut.

### An exposed-seam crop tee

From the `top/green` reference: the **Green exposed-seam crop tee**, a short
cap-sleeved top in sage rib jersey whose front hem dips to a point. Its panel
seams are sewn wrong sides together, so the overlocked edges show on the
outside in a tan contrast thread: one down the centre and one curving from
each shoulder to the hem, front and back. Front and back are each cut as four
panels along those seams, so all eight can take their own cloth. The rippled
lettuce edges are drawn plain. The cloth is plain jersey; the rib
texture is not drawn.

### Five coats

From the `coat` reference folders, all on the uniform form of the sheath
builder, which gained a zip that can stop part-way, one or two columns of any
number of buttons, a collar that closes, and a hood worn up.

- **Long black vinyl coat**: ankle length and flared, a stand collar, a zip
  from the neck to the hip.
- **Long black buttoned coat**: matte, nearly floor length, a closed stand
  collar and thirteen small buttons from the neck to the hip.
- **Flared vinyl zip coat**: the fullest skirt, a shorter zip and two stitched
  chest panels.
- **Double-breasted vinyl coat**: mid-thigh, two columns of four metal buttons.
- **Clear raincoat**: knee length in a new see-through cloth, *Clear PVC
  film*, with a hood worn up, two columns of dark buttons and a dark belt.

Not made: lapels and fold-down collars (every coat has the stand collar or the
hood), the front opening below the zip or the buttons (the front is one
piece), princess seams, pocket flaps, cuffs straps, the dark piping along the
raincoat's edges, and gloves. The long coats flare less than the references:
each front and back is one piece, and a fuller one would not fit the 150 cm
cloth on the largest figure.

### Four prison uniforms

From the `uniform/prisoner1` to `prisoner4` reference folders, with two new
prints: *Broad bands, across* and *Ticking stripes, lengthwise*.

- **Orange prison coverall**: the tailored jumpsuit without its belt, cut
  loose, with a collar and a front zip. The references close with buttons or
  snaps and some have short sleeves.
- **Black-and-white striped jacket and trousers**: a loose buttoned jacket
  over loose pull-on trousers, both in broad bands across.
- **Blue ticking-stripe jacket and trousers**: the same two pieces in blue and
  white stripes running lengthwise. The reference is a museum piece with a
  number patch on the chest; the patch is not made.
- **Striped prison dress**: calf length with long sleeves and nine buttons
  down the front, in broad bands, after a 1920s photograph.

The jackets and the dress have the stand collar, not the fold-down collars of
the references, and no pockets.

### Four uniforms

From four reference folders of uniforms. The sheath builder (the qipao) got
a uniform form: long sleeves, a closure down the centre front (a zip, a
hidden placket or a buttoned placket) and trims.

- **Navy crew suit**: the catsuit in matte navy jersey with a stand collar.
  Its zip is on the back only, from the collar to a hand's width below the
  waist, and the crotch is closed with a small diamond gusset. The reference's
  chest wing and sleeve badge are left out.
- **Grey crew jacket and trousers**: the first two-piece outfit. A
  hip-length jacket with a stand collar, a dark collar lining that shows as a
  rim, a hidden placket, two stitched chest panels and shoulder pads (a slider sets
  their thickness), over slim pull-on
  trousers (the leggings pattern with more ease, not tailored trousers).
- **White belted uniform dress**: a short sheath with a front zip, wide dark
  shoulder straps, two name tapes and a separate belt with a buckle.
- **White officer coat dress**: a flared skirt (a slider sets the flare), a
  buttoned placket with four dark buttons, epaulettes, one name tape and a
  red sleeve badge.

Not made: boots, gloves, holsters and the knee guards (shoes and props are
not garments here), raglan seams on the navy suit, and the lettering on tapes and badges.

### Two wide trousers

Both sit low on the hips under an elastic waistband, and both have a *Leg
width* slider (the measure round one leg).

- **Balloon cargo trousers**: olive poplin, very wide from the crotch down and
  drawn in again at the hem, with a drawstring and a big patch pocket on the
  outside of each thigh. Simplified: the back pocket and the fly are left out,
  and the hem's elastic is not a separate piece.
- **Grey wide-leg sweatpants**: grey mélange jersey, opening out from the
  crotch to a wide straight leg that reaches the floor.

### Two more dresses

- **Brown plunge halter dress**: a close mini skirt up to a seam under the
  bust, and above it two gathered bodice halves that meet only at that seam,
  part into a deep V and narrow into ties knotted in a bow behind the neck,
  with the ends hanging down the bare back. The gathers are drawn as fine folds
  fanning up from the seam. Simplified: the back zip is laid on a one-piece
  skirt back.
- **Black sequin bell-sleeve dress**: the long-sleeved sheath in black sequin
  mesh, with a wide shallow neck, a back scooped out almost to the waist, and
  sleeves that flare from the elbow to the wrist.

### Bodysuits

- **Black zip keyhole bodysuit**: black vinyl, high neck, no sleeves. It is the
  cut-out swimsuit with one oval opening over the belly instead of three, and a
  zip from the neck down to the top of the opening.
- **Sequin bustier bodysuit**: the monokini in sequin mesh with black trim:
  black straps, hip ties, a tie across the back, a narrow black belt right
  round the waist, and a sheer black net back. The cups' black binding and
  boning lines are not drawn.
- **Red foil and mesh bodysuit**: red foil with a red binding round every edge
  and a sheer red net back. The front's sheer insets are a placement print
  (*mesh insets*) on the foil, so they are not really see-through, and the
  strap harness over the bust is left out.
- **Heart-lace halter teddy**: black net with embroidered red hearts (a new
  *heart lace* print), open to the waist, on red halter ties, with red hip ties
  and a red back. The scalloped lace edge and the small diamond opening below
  the waist are left out.
- **Pink net romper**: the catsuit cut short in the leg, in hosiery net with a
  new *diamond net* print. It has the catsuit's high neck, not the original's
  scoop, and one net all over, where the original has rows of round holes
  across the chest.

### Hosiery

**Fishnet tights** and **lace stockings** are one tube of **hosiery net** per
leg, worn skin-tight. The net is mostly holes, so the cloth is drawn as dark
strands on the mannequin's own colour. The tights go up to a narrow waist
elastic and come in four mesh sizes (a *Mesh size* choice: large, medium,
small, micro); the two legs are joined front and back through the crotch. The
stockings are hold-ups in a floral lace net, ending on the thigh under a wide
band of lace (sliders for where the top sits and how wide the band is).
Simplified: the foot of the stocking is not a pattern piece. Each leg piece
ends at the ankle and the figure's foot is shown in the same cloth, so shoes go
on over it. Real sheer tights are knitted as seamless tubes; net and lace are
made flat and seamed, which is what the operations show, with the seam down
the inside of the leg (often it is at the back). The lace top's scalloped edge
and its silicone grip are only described in the step's note.

### Hazmat suit

A loose one-piece coverall in yellow coated cloth: bodice and legs joined at an
elasticated waist, a front zip, and a hood worn up that is open only round the
face. A ready-made respirator (face piece, visor, two filters) is worn with it;
like the shoes, it is not cut or sewn. The notes explain that the stitched
seams of a real suit are then sealed with welded tape.

## Shoes

A Shoes row in the header puts ready-made shoes on the full figure: flip-flops,
platform heels, knee boots, leopard over-the-knee boots, green hazmat boots,
yellow platform knee boots (block heel, square toe, a white zip up the inside
of the leg), black Chelsea rain boots (ankle height, elastic gores at both
sides, a pull tab at the back), white split-toe ankle boots (a round heel and
a notched toe with a groove between the big toe and the rest) or chunky
platform boots (or barefoot). They are not
part of the factory line: nothing is cut or sewn, and they stay on at every
stage, so garments can be tried with them. Each shoe sets the heel height the
foot is posed at and the thickness under it, and the figure stands that much
taller. The dress form has no feet and wears none. `&shoe=flipflops|heels|boots|otk|hazmat|yellowboots|rainboots|tabi|chunky`.

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

Skirts, dresses and coats hang from the torso and know nothing about the
stance, so with the feet apart they are pushed out, level by level, to a band
stretched round both posed legs: over the thighs and straight across between
them. This is a geometric stand-in for cloth being pulled taut, not a cloth
simulation: a narrow skirt simply widens (in life it would stop the stride),
the flat pattern is unchanged, and feet can show under a floor-length hem.

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

A set-in sleeve's pattern piece ends at the armhole seam. At rest that seam lies
round the root of the arm, and the arm above it is buried in the shoulder. When
the arm swings forward or up, that buried part comes out ahead of the seam; a
real sleeve head and the stretched bodice cover it. Here a close layer of the
sleeve's cloth is kept over the shoulder and the top of the arm, following the
skin's own shape there (the figure's shoulder swells past the arm's plain
radius over the deltoid), and a patch of the same cloth closes the armhole
under the bodice. So no skin shows there. None of this is a pattern piece or
appears on the cutting table.

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
hides the panel, `&stage=1..5` (1 Model, 2 Pose, 3 Shoes, 4 Cloth, 5 Finished; `&tab=customize` opens Cloth's Customize subtab and `&tab=sew` Finished's Sew subtab, `&tab=export` its Export subtab), `&g=jeans|shorts|jeanshorts|hotshorts|metalshorts|goldshorts|rainbowshorts|bikeshorts|leggings|scrunchleggings|meshleggings|shinyleggings|zebraleggings|flarepants|leatherjacket|snakejacket|pufferjacket|puffercoat|chaindress|leathershorts|rashsuit|cutoutsuit|catsuitred|catsuitbeige|goldsuit|hazmat|bluedress|golddress|longdress|racersuit|halterbody|tailoredsuit|sequinsuit|hololeggings|zipbody|sidedress|glossdress|goldslip|pinkslip|harlequindress|chainskirt|leatherskirt|pinkskirt|dotskirt|silverskirt|tennisskirt|tubetop|vesttop|snapshirt|croptop|stripebikini|blueshorts|halterdress|metalsuit|bluebikini|whitebottom|holosuit|chainsuit|redmonokini|pinkvinyl|thedress|fishnets|lacestockings|snakesuit|lasersuit|catswim|goldlace|olivering|blackcutouts|leopardblock|tricolor|blackshoulder|crosshalter|ladderhalter|brownhalter|sheervbody|crossdress|pinkgloss|bronzebody|flowerromper|redunitard|yokeunitard|goldkeyhole|sportromper|vestswim|seamtee|meshtop|coatvinyl|coatbutton|coatgoth|coatdouble|raincoat|prisonorange|convictstripe|tickstripesuit|stripedress|crewnavy|crewgrey|uniformbelt|uniformcoat|cargopants|widesweats|plungedress|sequindress|zipkeyhole|sequinbody|redfoilbody|lacehalter|pinkromper|colorbands|hourglass|sequinchains|plaidromper|neonholo|cherrysuit|ringduo|nightsnake|bluewrap|shirt|dress|swimsuit|bikini`,
`&form=w|m|wl|ml`, `&xray`, `&mode=stand`, `&op=N&t=0..1` (operation and progress), `&cyc=6.55` (machine
cycle), `&az=&el=&zoom=&ty=` (camera), `&cloth=&print=&colour=RRGGBB`, `&sel=`
(selected piece). `window.__sf` exposes the state and a `tick/render` pair.
