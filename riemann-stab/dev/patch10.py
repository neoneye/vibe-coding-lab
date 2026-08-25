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

# ---- consolidate the two contradictory notes into one ----
note_old_1 = (u'<div class="note small"><b>Asymptotic signal (inferred, not established).</b> The functional above is inferred from the preprint&rsquo;s Lemma 2.1\n'
              u'(Poisson\u2013Gabor identity) and Lemma 5.6/Theorem 5.7 normalization; it is validated here against two independent anchors \u2014 R(\u03c8\u2080)=4/3 exactly and\n'
              u'R(\u03c8_MT)=c<sup>\u22121</sup><sub>MT</sub> from its closed trigonometric form \u2014 but the cross-window extension itself is <i>not a theorem established by this page</i>.\n'
              u'If it is correct: M &lt; min(R(\u03c8\u2080),R(\u03c8_MT)), an optimal indicator weight w* \u2248 0.094 exists, and the trace-normalized certificate would nominally reach\n'
              u'2\u2212R \u2248 0.67256 \u2014 a gain of only +0.00006 over the Montgomery\u2013Taylor route. The catch: the matrix mixture charges each simple zero a rank-two block,\n'
              u'and a generic rank-two penalty would erase a gain this small. Any real advance needs an angle-aware extraction lemma that prices the second singular direction\n'
              u'by how non-collinear the two window vectors actually are \u2014 i.e. optimize prime-side moment gain minus secondary-rank/angle cost. That optimization is open,\n'
              u'and nothing on this page claims it.</div></div>')
rep(note_old_1, u'', 'remove old asymptotic note')

note_old_2 = (u'<div class="note small">Live values are shown above; this note only frames them. The two curves answer different questions: the mixed-Gram statistic asks whether\n'
              u'spectral diversification buys a lower second moment (it does not, at this scale, with admissible windows), while the rank-structure-preserving curve stays inside\n'
              u'the window family whose asymptotic optimum is already known. What would move either: a proved polarized prime-side functional R(\u03c8\u2081,\u03c8\u2082) \u2014 if it\n'
              u'satisfies R(\u03c8\u2081,\u03c8\u2082) \u2265 min(R(\u03c8\u2081),R(\u03c8\u2082)) across a meaningful family, mixtures die rigorously; if some pair violates it, a\n'
              u'configuration-wise rank-two extraction lemma must first pay for its own rank and index costs. Neither statement is derived on this page.')
# the ecosystem sentence continues after this block; keep it attached to the merged note
anchor_tail = u'\n<span class="red">Candidate ecosystem'

new_note = (u'<div class="note small"><b>Status of the three claims on display.</b>\n'
            u'<ul class="small">\n'
            u'<li><b>Cross-window functional (conjectured).</b> The single-window functional R(\u03c8) is validated against two anchors (R(\u03c8\u2080)=4/3 exactly;\n'
            u'R(\u03c8_MT)=c<sup>\u22121</sup><sub>MT</sub> from its closed trigonometric form). The <i>cross</i>-window formula R\u2081\u2082 is an inference from Lemma 2.1 +\n'
            u'Lemma 5.6 normalization \u2014 conjectured here, with no prime-side derivation or independent theorem.</li>\n'
            u'<li><b>Numerical inequality (observed at reference resolution).</b> Quadrature gives R\u2081\u2082 \u2248 1.32682 &lt; min(R(\u03c8\u2080),R(\u03c8_MT)): an interior\n'
            u'mixture optimum w* \u2248 0.094 would nominally lower the second moment below both parents. Whether that survives at full admissible regularity is untested here.</li>\n'
            u'<li><b>Extraction (absent).</b> Even granting the inequality: the matrix mixture charges each simple zero a rank-two contribution, so no zero bound follows\n'
            u'from f(w)/N\u0304 alone \u2014 it is a second-moment proxy. A valid route needs an angle-aware extraction lemma pricing the second singular direction by how\n'
            u'non-collinear the two window vectors actually are; optimizing moment gain minus secondary-rank/angle cost is the sharp form of the problem. Neither statement\n'
            u'is derived on this page.</li>\n'
            u'</ul>')
rep(note_old_2 + u'\n', new_note + u'\n', 'consolidate notes')
io.open(p,'w',encoding='utf-8').write(t)
print('done, misses:',misses)
