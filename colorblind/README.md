# Colorblind

Point your camera at the world and see it the way a colorblind person does.

- **Five vision types**, the same list as the app: Normal Vision, Deuteranopia, Protanopia, Tritanopia and
  Achromatopsia, with the app's own descriptions and corrected statistics (see [Statistics](#statistics)).
- **Live camera** through WebGL. The rear camera is used on phones. "Flip" appears when there is more than
  one camera. User-facing cameras are mirrored, like the app's front camera.

Keys: `←`/`→` change type, `1`–`5` pick one, `C` compare, `F` freeze, `S` snap, `Esc` back. URL
parameters: `?src=test`, `?compare=split` or `?compare=grid`. On a phone, swipe left or right on the
picture to change type.

The camera only works on `https://` pages or on `localhost`. Opened from a `file://` URL, some browsers
refuse it. The page then offers the test card or a photo instead. The video never leaves the browser.

## How it works

**Deuteranopia, protanopia and tritanopia:** Brettel, Viénot & Mollon (1997), on linear sRGB. Each
color is turned into the responses of the three cone types (L, M and S). The missing cone's response is
replaced by a mix of the other two, so that the color lands on one of two half-planes. Those are the
colors a dichromat sees the same way as a normal viewer. Each half-plane runs through the neutral axis and
one anchor wavelength.

- cones: Smith & Pokorny (1975) fundamentals, the ones Brettel used, from Judd-Vos-corrected XYZ
- neutral axis: sRGB white, as Vischeck and most implementations do
- anchors: 475/575 nm for protan and deutan, 485/660 nm for tritan
- the exact sRGB curve in both directions

Each half-plane collapses into one 3×3 matrix on linear RGB. A separating-plane normal picks which one
to use for each pixel. That is one decode, one dot product, one matrix multiply and one encode per pixel.

**Achromatopsia** is shown as rod monochromacy, which is what complete achromatopsia is. It uses the CIE
1951 scotopic (night-vision) sensitivity curve V′(λ) in linear light. The least-squares fit
V′ ≈ −0.705 X + 1.042 Y + 0.434 Z matches the linear scotopic formula used in tone mapping. On linear
sRGB that gives the weights (−0.072, 0.645, 0.427): rods are blind to deep red and most sensitive to
blue-green. This is an approximation. Rod sensitivity isn't a mix of the CIE curves (the fit's RMS
residual is 0.19 of peak), and the camera has already reduced each spectrum to three numbers.

`tools/cie-derive.mjs` derives every constant from the CVRL tables (CIE 1931, Judd-Vos, CIE 1951
scotopic) and writes them into `index.html`. It works out which side of the separating plane each
anchor's half-plane belongs to by itself. It also cross-checks against
[libDaltonLens](https://github.com/DaltonLens/libDaltonLens) (public domain, by Nicolas Burrus), which
implements the same model. All six matrices agree to within 1.6·10⁻⁵ (DaltonLens rounds to 5 decimals),
and the separating planes point the same way. The GLSL shader is generated from the same constants as the
JS reference.

What is still a model, not a measurement: dichromats differ from each other, Brettel's anchors are
averages, and a phone camera plus a display is not a calibrated sRGB pipeline. The page shows the
complete forms (-opia). The milder forms (-omaly) are more common, especially deuteranomaly.

## Tests

```
node test.mjs
```

This runs the JS reference in `<script id="shared-code">`. It checks that:

- the statistics match the sources
- normal vision is the identity; black, white and grays are unchanged
- dichromacy stays within 1 level of an independent re-implementation of libDaltonLens, on 4,913
  colors per type
- light saturated blues are not clipped
- achromatopsia follows rod sensitivity
- the test-card dot plate loses contrast for red-green types
- characterization pins (9 colors × 4 types)

The GLSL is checked against the same JS reference on the GPU. In the browser console, run
`__cbv.gpuCheck()`. It renders 256 colors through every vision type and reads them back. On a Mac
(Apple M1 Max, Chrome), all five matched the reference with 0 levels of difference.
