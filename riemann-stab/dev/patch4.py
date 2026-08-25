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

rep(u"""The plot computes Z(t) live; the finder refines each sign change to ~10<sup>\u221212</sup> and checks simplicity via Z\u2032.</p>""",
u"""The plot computes Z(t) live; the finder refines each sign change to ~10<sup>\u221212</sup> and records a finite-difference estimate of Z\u2032 at each zero \u2014 a large derivative is <i>evidence consistent with</i> simplicity, not a certificate.</p>""","\u00a73 Z\u2032 softening")

rep(u"""<p>Finding 293 sign changes up to height T proves little by itself:""",
u"""<p>Finding every sign change of Z(t) in some interval proves little by itself:""","\u00a74 stale 293")

rep(u"""(rigorously it requires more, cf. Rudnick\u2013Sari\u011f)""",
u"""(rigorously it requires more; cf. Rudnick\u2013Sarnak)""","\u00a76 citation")

rep(u"""even to L-functions (Davenport\u2013Heilbronn) for which the analogue of RH is false.</p>""",
u"""accommodate control objects such as the Davenport\u2013Heilbronn zeta function, for which the analogue of RH fails \u2014 compatibility of ingredients,
not an extension of the theorem, which is scoped to \u03b6 and primitive Dirichlet L-functions.</p>""","\u00a77 Davenport\u2013Heilbronn scope")

rep(u"""<p class="note small" style="margin-bottom:0">Sharpness: within bandwidth-one certificates this route is optimal \u2014 beating \u2153 needs pair-correlation information beyond Fourier support 1
(a regime where, under RH, semidefinite programming reaches 0.6792). Also from the paper: \u226585.8% of zeros of \u03be\u2032 are simple and on the line; averaged over
primitive Dirichlet characters, 81.1% / 90.5%.</p>""",
u"""<p class="note small" style="margin-bottom:0">Sharpness: given only tr G\u0303, \u2016G\u0303\u2016\u00b2<sub>HS</sub> and the block structure, inequality (1.1) is sharp \u2014 improving on \u2153
<i>by this rank\u2013trace route</i> would require pair-correlation information beyond Fourier support 1. Broader bandwidth-one certificates reach \u22480.682, and under RH
semidefinite programming using form-factor positivity outside [\u22121,1] reaches 0.6792. Also from the paper: \u226585.8% of zeros of \u03be\u2032 are simple and on the line;
averaged over primitive Dirichlet characters, 81.1% / 90.5%.</p>""","\u00a77 sharpness scoped")

rep(u"""<p><b>What would move the needle.</b> The 2026 paper states its own ceiling: within bandwidth-one certificates the method is sharp at \u2153, and pushing further requires
pair-correlation information beyond Fourier support 1 \u2014 i.e., taming the form factor outside [\u22121,1] unconditionally, where currently only RH lets us look.""",
u"""<p><b>What would move the needle.</b> The 2026 paper scopes its own ceiling: for this rank\u2013trace route the certificate is sharp at \u2153, while broader
bandwidth-one certificates top out near 0.682 \u2014 so the next leap likely requires taming the pair-correlation form factor outside Fourier support 1
unconditionally, where currently only RH lets us look.""","\u00a79 needle scoped")

io.open(p,'w',encoding='utf-8').write(t)
print('done, misses:',misses)
