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

# 1. patch scar (Beam 4 tail)
rep(u"""handled by the flat charge 4 rather than being allowed to inflate rank. That is Bombieri&rsquo;s device doing real work, and it is why the argument extends
accommodate control objects such as the Davenport\u2013Heilbronn zeta function, for which the analogue of RH fails \u2014 compatibility of ingredients,
not an extension of the theorem, which is scoped to \u03b6 and primitive Dirichlet L-functions.</p>""",
u"""handled by the flat charge 4 rather than being allowed to inflate rank. That is Bombieri&rsquo;s device doing real work. The same insensitivity is also why
these analytic inputs remain valid for control objects such as the Davenport\u2013Heilbronn zeta function, whose analogue of RH fails: compatibility of
ingredients \u2014 not an extension of the theorem, which is scoped to \u03b6 and primitive Dirichlet L-functions.</p>""","Beam-4 scar")

# 2. hierarchy table attribution
rep(u"""<tr><td>bandwidth-one ceiling [CCLM17]</td><td>any support-\u22641 certificate</td><td>unconstrained optimum</td><td>\u22480.682</td></tr>""",
u"""<tr><td>bandwidth-one obstruction [Easley\u2013McAleer]</td><td>any support-\u22641 certificate (256-periodic programs)</td><td>numerically enclosed optimization</td><td>\u22480.68183</td></tr>""","table row")

# 3. Prop A panel -> honest retraction + live mixture experiment pointer
old_pa = u"""<div class="panel"><span class="badge b-thm">PROPOSITION A (combination barrier).</span> If A, B are positive semidefinite, then
<div class="formula" style="margin-bottom:0">\u2016A+B\u2016\u00b2<sub>HS</sub> \u2265 \u2016A\u2016\u00b2<sub>HS</sub> + \u2016B\u2016\u00b2<sub>HS</sub>,&emsp;since the difference is 2 tr(AB) = 2 tr(A<sup>1/2</sup>BA<sup>1/2</sup>) \u2265 0.</div>
<p style="margin-bottom:0">Consequence: merging window data additively \u2014 stacking several support-\u22641 windows on a common zero grid \u2014 can only
<i>inflate</i> the second moment that the chain subtracts. No additive combination of windows beats the best single window, so the route from 0.67250 toward
0.682 cannot be walked by combination; it demands a different extraction lemma or genuinely beyond-support inputs. (Model-level caveat: assumes the merged
certificate corresponds to matrix addition on a shared grid. Spot-checked numerically over 300 random PSD pairs: min tr(AB) &gt; 0.)</p></div>"""
new_pa = u"""<div class="panel"><span class="badge b-num">RETRACTED BARRIER, WORKING EXPERIMENT.</span> An earlier draft claimed a &ldquo;combination barrier&rdquo;:
for PSD matrices, \u2016A+B\u2016\u00b2<sub>HS</sub> \u2265 \u2016A\u2016\u00b2<sub>HS</sub>+ \u2016B\u2016\u00b2<sub>HS</sub> (true), whence additive combinations cannot help. The inference was invalid:
certificates normalize by trace, and trace-normalized mixtures evade the inequality entirely \u2014 take A = diag(1,0), B = diag(0,1): each has trace 1 and
\u2016\u00b7\u2016\u00b2<sub>HS</sub> = 1, while C = \u00bd(A+B) has trace 1 and \u2016C\u2016\u00b2<sub>HS</sub> = \u00bd. What actually governs mixtures is the mixed moment:
<div class="formula" style="margin-bottom:0">\u2016wG\u2081+(1\u2212w)G\u2082\u2016\u00b2<sub>HS</sub> /N = w\u00b2X + (1\u2212w)\u00b2Y + 2w(1\u2212w)M\u2081\u2082,&emsp;
M\u2081\u2082 := tr(G\u2081G\u2082)/N,</div>
and the certified constant improves below both parents precisely when M\u2081\u2082 &lt; \u221a(XY). For two windows built on the same zeros this mixed moment
involves only joint frequency support \u22641 \u2014 i.e. potentially Montgomery\u2013Vaughan-accessible, hence a <i>legitimate unconditional experiment</i>, not a dead end.
Lab E\u00b7iii below runs it on live zeros.</p></div>

<div class="panel"><span class="badge b-num">E\u00b7iii \u2014 LIVE</span><b>Mixture experiment:</b> indicator window vs Montgomery\u2013Taylor window on the same grid and zeros.
<div class="controls">
  <button id="mixRun" class="primary">compute mixed certificates</button>
  <span class="mono dim" id="mixStatus"></span>
</div>
<div class="progressbar" id="mixBar"><div></div></div>
<canvas id="mixCanvas" height="240"></canvas>
<div class="statgrid" id="mixStats"></div>
<div id="mixVerdict"></div>
<div class="note small">Toy scale, honest scope: both parents land near \u22651.25 here against asymptotic predictions 1.3333/1.32750, and the dip is real but small.
Reaching the 0.68183 obstruction from an explicit extraction lemma would additionally need the singular-series-weighted version of M\u2081\u2082 and the exact
certificate normalization of the Easley\u2013McAleer programs \u2014 neither is reproduced by this toy.</div></div>"""
rep(old_pa,new_pa,"Prop A -> mixture experiment")

# 4. Prop B readings fix
rep(u"""<li><i>Tightness.</i> Slack vanishes iff there are no off-line pairs: multiples cost nothing \u2014 the flat charge 4 absorbs them exactly.</li>
<li><i>Offset scaling.</i> The penalty a pair inflicts on the certified count is quadratic in its distance from the line: pairs hugging the critical line
barely depress the certificate. This is consistent from the other side with Goldston\u2013Suriajaya&rsquo;s finding that confining all zeros to o(1/log T)
of the line already restores \u2153-style conclusions.</li>
<li><i>Where the difficulty lives.</i> Mid-range offsets hurt most \u2014 precisely the region no zero-density theorem currently excludes.</li>
</ul>
An elementary computation \u2014 but it converts the paper&rsquo;s abstract sharpness remark (\u00a77.2) into an explicit, checkable formula for where every unit
of slack goes.</p></div>""",
u"""<li><i>Tightness.</i> Slack vanishes iff there are no off-line pairs: multiples cost nothing \u2014 the flat charge 4 absorbs them exactly.</li>
<li><i>Monotone offset penalty.</i> 8ps\u00b2(1+s\u00b2) increases in s&gt;0: larger offsets depress the certified bound more; s\u21920 recovers the doubled
on-line zero exactly.</li>
<li><i>Hypothesis, not consequence.</i> s is an artificial orthonormal parameter with no proven bridge to |\u03b2\u2212\u00bd| in the real Gabor frame. If an
offset-sensitive inequality were proved for the real frame, partitioning zeros by scaled distance |\u03b2\u2212\u00bd|log T and combining with zero-density
estimates would inject information beyond the first-two-moment ceiling \u2014 flagged as an open experiment.</li>
</ul>
An elementary computation \u2014 useful as a conjecture generator and as an explicit accounting of where every unit of slack goes in the model.</p></div>""","Prop B readings")

# 5. numerical observation panel -> point at live table, soften causality
rep(u"""<div class="panel"><span class="badge b-num">NUMERICAL OBSERVATION.</span> Beam 2&rsquo;s second-moment identity, normally verified from the prime side, was checked
from the <i>zero side</i>: building G\u0303 from live computed zeros near t = 400 gives \u2016G\u0303\u2016\u00b2<sub>HS</sub>/tr G\u0303 = 1.256 against the asymptotic
c<sup>\u22121</sup><sub>MT</sub> = 1.32750 \u2014 94.6% of the predicted value, the deficit tracking frame truncation at d = 16. Direction and size behave as
Propositions 4.2\u20134.3 of the paper predict.</p></div>""",
u"""<div class="panel"><span class="badge b-num">NUMERICAL OBSERVATION (exploratory).</span> Beam 2&rsquo;s second-moment identity, normally verified from the prime side,
can be probed from the <i>zero side</i>: build G\u0303 from live computed zeros near t = 400 and measure \u2016G\u0303\u2016\u00b2<sub>HS</sub>/tr G\u0303. At d = 16 this
page measures 1.256 against asymptotic c<sup>\u22121</sup><sub>MT</sub> = 1.32750; across d = 8\u202624 the ratio fluctuates in 1.15\u20131.28 without clean convergence \u2014
expected at heights where N(T,2T) \u2248 20 carries O(\u221aT log T)-scale errors that are only asymptotically negligible. No convergence claim is made at this scale;
the live table is in Lab E\u00b7ii.</p></div>""","observation softened")

# 6. ledger fixes
rep(u"""<li><b>Third-moment extraction, tr G\u0303\u00b3.</b> Dead: the cubic term evaluates three-prime correlations \u2014 strictly harder than the twin-prime-scale input that already exceeds support 1.</li>""",
u"""<li><b>Third-moment extraction, tr G\u0303\u00b3.</b> Blocked, not dead: at full bandwidth X\u2248T it needs three-prime correlations, but shorter-bandwidth/higher-moment tradeoffs (k\u03bb \u2264 2\u2212\u03b5 Christoffel bounds, preprint \u00a77.2) remain open probes.</li>""","ledger 3rd moment")
rep(u"""<li><b>Additive window combinations.</b> Dead by Proposition A.</li>""",
u"""<li><b>Raw-addition combinations.</b> Superseded: raw addition inflates HS\u00b2, but trace-normalized mixtures evade that argument \u2014 see the live experiment E\u00b7iii; whether mixtures reach the 0.68183 obstruction is open.</li>""","ledger additive")
rep(u"""<li><b>Direct optimization of W(f,f) off-bandwidth.</b> Dead by definition: local positivity beyond support 1 <i>is</i> RH, piecewise \u2014 there is nothing to optimize against without assuming the goal.</li>""",
u"""<li><b>Direct optimization of W(f,f) beyond support 1.</b> Reopened as a probe: positivity over the <i>full</i> test-function class is equivalent to RH, but restricted parametrized families extending past bandwidth one can be searched numerically without circularity (cf. the Weil-criterion discussion, arXiv:1910.14368).</li>""","ledger off-bandwidth")
rep(u"""Scoreboard: sixteen opened, eleven autopsied above plus two folded variants, two elementary propositions survived, one numerical identity confirmed.
The hypothesis stands.""",
u"""Scoreboard: sixteen opened, eight autopsies stand, two entries moved to open probes, one retracted into a working experiment, two elementary propositions
survived (one demoted to hypothesis-generator), one exploratory identity confirmed. The hypothesis stands.""","scoreboard")

io.open(p,'w',encoding='utf-8').write(t)
print('done, misses:',misses)
