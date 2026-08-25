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

old = (u'<div class="note small">Toy scale, honest scope: parents land near 1.26\u20131.44 here against asymptotic predictions 1.3333/1.32750, fluctuating with the grid.\n'
       u'Reading the two curves: the matrix-mixture dip is a real spectral-diversification effect but feeds no theorem until someone supplies an extraction lemma that pays\n'
       u'for rank up to two per simple zero and the enlarged off-line index; the certificate-valid window mixture staying above its MT parent is a toy-scale echo of the\n'
       u'[CCLM17] optimality claim. Reaching 0.68183 from either would additionally require a proved prime-side mixed-moment asymptotic and a\n'
       u'configuration-wise valid extraction lemma \u2014 neither exists today, and neither is reproduced by this toy.</div></div>')

new = (u'<div class="note small">Live values are shown above; this note only frames them. The two curves answer different questions: the mixed-Gram statistic asks whether\n'
       u'spectral diversification buys a lower second moment (it does not, at this scale, with admissible windows), while the rank-structure-preserving curve stays inside\n'
       u'the window family whose asymptotic optimum is already known. What would move either: a proved polarized prime-side functional R(\u03c8\u2081,\u03c8\u2082) \u2014 if it\n'
       u'satisfies R(\u03c8\u2081,\u03c8\u2082) \u2265 min(R(\u03c8\u2081),R(\u03c8\u2082)) across a meaningful family, mixtures die rigorously; if some pair violates it, a\n'
       u'configuration-wise rank-two extraction lemma must first pay for its own rank and index costs. Neither statement is derived on this page.</div></div>')

rep(old,new,'E-iii note rewrite')
io.open(p,'w',encoding='utf-8').write(t)
print('done, misses:',misses)
