# -*- coding: utf-8 -*-
import io
p='template.html'
t=io.open(p,encoding='utf-8').read()
misses=[]
def rep(old,new,tag):
    global t
    if old in t:
        t=t.replace(old,new); print('OK  ',tag)
    else:
        misses.append(tag); print('MISS',tag)

# ---------- §5 rewrite: centered windows ----------
rep(u"""<p>Deep inside every modern attack on RH is one identity: <b>the Fourier transform of the zeros is the prime numbers</b>. In the normalization of the 2026 paper,
for an even test function F with F\u0302(\u03be) = \u222b F(u)e<sup>\u2212iu\u03be</sup>du:</p>""",
u"""<p>Deep inside every modern attack on RH is one identity: <b>the Fourier transform of the zeros is the prime numbers</b>. In the normalization of the 2026 paper,
for an even Schwartz test function F with F\u0302(\u03be) = \u222b F(u)e<sup>\u2212iu\u03be</sup>du:</p>""","\u00a75 intro")

old_ctl = u"""<p>Left side: zeros. Right side: von Mangoldt&rsquo;s \u039b(n) \u2014 a weighted prime-power census \u2014 plus elementary archimedean terms.
Weil (1952) showed the associated Hermitian form is positive semidefinite <i>for all test functions if and only if RH holds</i>; Bombieri (2000) read the
negative index of truncations as a count of off-line pairs. Both ideas detonate in \u00a77. First, watch the identity work: choose a Gaussian
F<sub>\u03b1</sub>(u) = e<sup>\u2212\u03b1u\u00b2</sup>. The zero side sums over zeros computed live in Lab B&rsquo;s engine; the prime side sieves \u039b(n) up to 12,000;
nothing is precomputed.</p>
<span class="badge b-num">NUMERICAL</span>
<div class="panel">
  <div class="controls">
    <label>width \u03b1 <input type="range" id="efAlpha" min="18" max="60" step="1" value="30"></label>
    <span class="mono dim" id="efAlphaLabel">\u03b1 = 0.30</span>
    <button id="efRun" class="primary">evaluate both sides</button>
  </div>
  <div class="statgrid" id="efStats"></div>
  <div id="efVerdict"></div>
  <div class="note small">Both sides are small differences of larger pieces (cancellation!), so the agreement digits are the honest ones. Change \u03b1 and watch the two sides
  track each other \u2014 they must, because they are the same number reached from opposite directions: one through the zeros your machine just found,
  one through the primes.</div>
</div>"""
new_ctl = u"""<p>Left side: zeros. Right side: von Mangoldt&rsquo;s \u039b(n) \u2014 a weighted prime-power census \u2014 plus elementary archimedean terms.
Weil (1952) showed the associated Hermitian form is positive semidefinite <i>for all test functions if and only if RH holds</i>; Bombieri (2000) read the
negative index of truncations as a count of off-line pairs. Both ideas detonate in \u00a77.</p>
<p>Watch the identity work below. The page uses a window centered at height \u03c4\u2080 with frequency width w:</p>
<div class="formula small">F\u0302(\u03c4) = e<sup>\u2212(\u03c4\u2212\u03c4\u2080)\u00b2/w\u00b2</sup> + e<sup>\u2212(\u03c4+\u03c4\u2080)\u00b2/w\u00b2</sup>&emsp;\u27f9&emsp;F(u) = (w/\u221a\u03c0)&thinsp;e<sup>\u2212w\u00b2u\u00b2/4</sup>&thinsp;cos(\u03c4\u2080 u)</div>
<p>Narrow w keeps F broad enough that real primes survive on the right-hand side, while F\u0302 stays localized so only zeros near \u03c4\u2080 sing \u2014 the same
localization philosophy as the paper&rsquo;s Gabor-frame construction at height T. The zero side sums over zeros computed live by this page&rsquo;s engine;
the prime side sieves \u039b(n) up to 12,000; nothing is precomputed.</p>
<span class="badge b-num">NUMERICAL</span>
<div class="panel">
  <div class="controls">
    <label>center \u03c4\u2080 <input type="range" id="efTau" min="60" max="480" step="10" value="300"></label>
    <span class="mono dim" id="efTauLabel">\u03c4\u2080 = 300</span>
    <label>width w <input type="range" id="efW" min="10" max="40" step="1" value="20"></label>
    <span class="mono dim" id="efWLabel">w = 2.0</span>
    <button id="efRun" class="primary">evaluate both sides</button>
  </div>
  <div class="statgrid" id="efStats"></div>
  <div id="efVerdict"></div>
  <div class="note small">All four displayed pieces are genuinely populated: zeros near \u03c4\u2080, the gamma background, and a handful of small primes carrying an
  oscillating Dirichlet polynomial. Move \u03c4\u2080 across a zero and watch its weight slide in or out of the left side while the prime side rearranges to
  compensate \u2014 the same number, reached from opposite directions.</div>
</div>"""
rep(old_ctl,new_ctl,"\u00a75 panel")

# ---------- \u00a76 GUE corrections ----------
rep(u"""<p>Normalize consecutive spacings by the local mean: \u03b4<sub>n</sub> = (\u03b3<sub>n+1</sub> \u2212 \u03b3<sub>n</sub>)\u00b7(log \u03b3<sub>n</sub>/2\u03c0)/2\u03c0.
Montgomery&rsquo;s 1973 pair-correlation conjecture \u2014 born from a tea-time conversation with Dyson \u2014 says these fluctuations follow the
Gaussian Unitary Ensemble law from quantum mechanics. The histogram below uses zeros computed live in your browser; the curves are GUE and, for contrast,
uncorrelated Poisson.</p>""",
u"""<p>Montgomery&rsquo;s 1973 pair-correlation conjecture \u2014 born from a tea-time conversation with Dyson \u2014 concerns the <i>two-level density</i>: weighted sums
over pairs of zeros, \u03a3<sub>i\u2260j</sub> F(\u03b4(\u03b3<sub>i</sub>\u2212\u03b3<sub>j</sub>)), should follow the Gaussian Unitary Ensemble kernel from quantum mechanics.
The nearest-neighbor gap distribution plotted here is the related sibling prediction (rigorously it requires more, cf. Rudnick\u2013Sari\u011f); the histogram uses
zeros computed live in your browser, with the GUE Wigner surmise p(x) = 32x\u00b2/\u03c0\u00b2\u00b7e<sup>\u22124x\u00b2/\u03c0</sup> \u2014 the 2\u00d72 approximation to the exact
Fredholm\u2013Painlev\u00e9 law \u2014 and uncorrelated Poisson for contrast.</p>""","\u00a76 intro")

rep(u"""<div class="legend"><span class="lg-z">observed \u03b4</span><span class="lg-gue">GUE p(x)=32x\u00b2/\u03c0\u00b2\u00b7e<sup>\u22124x\u00b2/\u03c0</sup></span><span class="lg-poi">Poisson e<sup>\u2212x</sup></span></div>""",
u"""<div class="legend"><span class="lg-z">observed \u03b4</span><span class="lg-gue">GUE Wigner surmise (2\u00d72 approx.)</span><span class="lg-poi">Poisson e<sup>\u2212x</sup></span></div>""","\u00a76 legend")

rep(u"""<p class="note small" style="margin-bottom:0">Level repulsion (\u03b4 \u2192 0 suppressed) is numerical evidence for simplicity of low-lying zeros \u2014 the property Theorem A now proves in bulk.
  The smallest normalized gap found here is flagged as a mini Lehmer-phenomenon watch: near-ties of zeros, which make both simplicity and RH hard.</p>""",
u"""<p class="note small" style="margin-bottom:0">Level repulsion (\u03b4 \u2192 0 suppressed) is numerical evidence for simplicity of low-lying zeros \u2014 the property Theorem A now proves in bulk.
  The smallest normalized gap found here is flagged as a mini Lehmer-phenomenon watch: near-ties of zeros, which make both simplicity and RH hard.</p>""","\u00a76 note (unchanged)")

open(p,'w',encoding='utf-8').write(t)
print('done, misses:',misses)
