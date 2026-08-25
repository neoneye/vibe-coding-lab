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

rep(u"""      <div class="chip">RH status: <b>OPEN</b></div>
      <div class="chip">zeros on line, unconditionally: <b>&ge; 2/3</b> <span class="dim">(0.6725 w/ Montgomery\u2013Taylor window)</span></div>
      <div class="chip">distinct zeros: <b>&ge; 5/6</b> <span class="dim">(0.83625)</span></div>
      <div class="chip">network calls: <b>0</b> \u2014 no libraries, double precision only</div>""",
u"""      <div class="chip">RH status: <b>OPEN</b></div>
      <div class="chip">simple &amp; on line, unconditionally: <b>&ge; 2/3</b> <span class="dim">(\u2265 0.67250 w/ Montgomery\u2013Taylor window)</span></div>
      <div class="chip">distinct: <b>&ge; 5/6</b> <span class="dim">(\u2265 0.83625 w/ MT window)</span></div>
      <div class="chip">source: <b>preprint</b> arXiv:2608.13637 v2 \u00b7 Lean-checked \u00b7 review ongoing</div>
      <div class="chip">network calls: <b>0</b> \u2014 no libraries, double precision only</div>""","hero chips")

rep(u"""the first unconditional improvement of the constant in thirty-six years.""",
u"""lifting a record (5/12) set in 2020 on a ladder that runs back through Conrey, Levinson and Selberg.""","hero sub")

rep(u"""<div class="panel"><b>The Riemann Hypothesis.</b> Every nontrivial zero satisfies Re s = \u00bd. Equivalently, every zero of \u03be is real:
the points \u03b3<sub>\u03c1</sub> := (\u03c1 \u2212 \u00bd)/i are real numbers.</div>""",
u"""<div class="panel"><b>The Riemann Hypothesis.</b> Every nontrivial zero satisfies Re s = \u00bd. Equivalently, writing
\u03b3<sub>\u03c1</sub> := (\u03c1 \u2212 \u00bd)/i, RH says every \u03b3<sub>\u03c1</sub> is real \u2014 i.e. \u039e(t) := \u03be(\u00bd+it), whose zeros sit at t = \u03b3<sub>\u03c1</sub>, has only real zeros.
(The zeros of \u03be itself would stay on a vertical line; it is \u039e that becomes a real-point spectrum.)</div>""","\u00a71 equivalence")

rep(u"""at any point of the plane, with adaptive step doubling""",
u"""anywhere away from its pole s = 1, with adaptive step doubling""","\u00a72 pole")

rep(u"""function \u03be \u2014 then compare counts. Equality means every zero in the box lies on the line (to numerical resolution).</p>
<p>The audit below integrates \u0394 arg \u03be around the rectangle [\u22121, 2] \u00d7 [1, T] from live samples, unwrapping the phase continuously. It is the same logic
that certifies zeros in serious computations (which push it past height 10<sup>13</sup>); done here honestly at heights where a browser can go.</p>""",
u"""function \u03be \u2014 then compare counts. Equality means every zero in the box lies on the line (to numerical resolution).</p>
<p>The audit below integrates \u0394 arg \u03be around the rectangle [\u22121, 2] \u00d7 [1, T] from live samples, unwrapping the phase continuously, then repeats the whole
count at half the mesh and demands the same integer twice \u2014 sampling adequacy is tested, not assumed. It is the same logic that certifies zeros in serious
computations (rigorously past height 3\u2009\u00d7\u200910<sup>12</sup>; Platt\u2013Trudgian 2020); done here honestly at heights where a browser can go.</p>""","\u00a74 height+crosscheck")

rep(u"""Caveats, stated plainly: this is numerical evidence, not proof \u2014 sampling could in principle miss a tangency (Z touching zero without
  crossing), and double precision bounds the resolution. Rigorous versions control both errors explicitly; ours controls them empirically (integrality of the
  winding number is itself a sharp test: a missed or spurious zero shows up as a non-integer count).</div>""",
u"""Caveats, stated plainly: this is numerical evidence, not proof. A wrapped phase sum around a closed sampled loop is always an integer multiple of 2\u03c0 \u2014
  integrality by itself certifies nothing about sampling adequacy \u2014 hence the halved-mesh cross-check and the monitored minimum of |\u03be| along the contour.
  Tangencies (even-multiplicity zeros) would evade sign changes entirely. Rigorous versions bound all these errors explicitly; ours probes them empirically.</div>""","\u00a74 caveat")

io.open(p,'w',encoding='utf-8').write(t)
print('done, misses:',misses)
