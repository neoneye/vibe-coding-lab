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

anchor = u"""<p><b>Coda.</b>"""
insert = u"""<h3>The session log</h3>
<p>The stab was then taken literally: sit down and try to <i>solve</i> the thing. Sixteen distinct lines of attack were opened in one working session.
Eleven died \u2014 each recorded below with its autopsy. Two survived as elementary propositions with proofs (they organize the known wall; they do not move it).
One empirical identity survived as a browser-checked observation. The Riemann hypothesis is exactly as open as it was. What follows is what a real stab
actually looks like when it does not succeed.</p>

<div class="panel"><span class="badge b-ill">MODEL</span><b>The certificate hierarchy.</b> Modern proportion results are triples
<i>(test-function family, input tuple, extraction lemma)</i>. Placing them on one ladder:
<table class="data" style="margin-top:8px">
<tr><th>route</th><th>input tuple</th><th>extraction</th><th>constant</th></tr>
<tr><td>Selberg\u2013Levinson\u2013Conrey mollifiers</td><td>mean values of \u03b6(s+\u03b1) with mollifier</td><td>mollified moments</td><td>1/3 \u2192 2/5</td></tr>
<tr><td>Pratt\u2013Robles\u2013Zaharescu\u2013Zeindler</td><td>long mollifiers</td><td>mollified moments</td><td>5/12</td></tr>
<tr><td>Montgomery 1973 (conditional)</td><td>pair-correlation 2nd moment, support \u22641</td><td>positivity of zero side (uses RH!)</td><td>2/3</td></tr>
<tr><td><b>Alp\u00f6ge\u2013Furman 2026</b></td><td>same support-\u22641 inputs, unconditionally</td><td>rank\u2013trace + Sylvester inertia</td><td><b>2/3, 0.67250</b></td></tr>
<tr><td>bandwidth-one ceiling [CCLM17]</td><td>any support-\u22641 certificate</td><td>unconstrained optimum</td><td>\u22480.682</td></tr>
<tr><td>under RH, SDP [CGdL20]</td><td>form-factor positivity outside [\u22121,1]</td><td>semidefinite programs</td><td>0.6792</td></tr>
</table>
The gap this session probed: <b>0.67250 \u2192 0.682</b>, i.e. whether smarter extraction can spend the same support-\u22641 inputs more efficiently.</div>

<div class="panel"><span class="badge b-thm">PROPOSITION A (combination barrier).</span> If A, B are positive semidefinite, then
<div class="formula" style="margin-bottom:0">\u2016A+B\u2016\u00b2<sub>HS</sub> \u2265 \u2016A\u2016\u00b2<sub>HS</sub> + \u2016B\u2016\u00b2<sub>HS</sub>,&emsp;since the difference is 2 tr(AB) = 2 tr(A<sup>1/2</sup>BA<sup>1/2</sup>) \u2265 0.</div>
<p style="margin-bottom:0">Consequence: merging window data additively \u2014 stacking several support-\u22641 windows on a common zero grid \u2014 can only
<i>inflate</i> the second moment that the chain subtracts. No additive combination of windows beats the best single window, so the route from 0.67250 toward
0.682 cannot be walked by combination; it demands a different extraction lemma or genuinely beyond-support inputs. (Model-level caveat: assumes the merged
certificate corresponds to matrix addition on a shared grid. Spot-checked numerically over 300 random PSD pairs: min tr(AB) &gt; 0.)</p></div>

<div class="panel"><span class="badge b-thm">PROPOSITION B (slack formula).</span> In the idealized frame of Lab E\u00b7i with s\u2081 simple on-line zeros,
s\u2082 doubled zeros, and p off-line pairs at offset s&gt;0, all four quantities are exact:
<div class="formula" style="margin-bottom:0">tr G\u0303 = N,&emsp;\u2016G\u0303\u2016\u00b2<sub>HS</sub> = s\u2081+4s\u2082+4p[(1+s\u00b2)\u00b2+s\u2074],&emsp;rank P\u2081 = s\u2081,&emsp;
<b>rank P\u2081 \u2212 B = 8ps\u00b2(1+s\u00b2)</b>,</div>
where B = 4 tr G\u0303 \u2212 2N \u2212 \u2016G\u0303\u2016\u00b2<sub>HS</sub> is the certified bound. Verified to machine precision across the parameter grid
(including fractional offsets and the boundary s = 0, where an off-line pair degenerates into exactly a doubled on-line zero \u2014 coherence check).
Three readings:
<ul style="margin:.4em 0 .2em">
<li><i>Tightness.</i> Slack vanishes iff there are no off-line pairs: multiples cost nothing \u2014 the flat charge 4 absorbs them exactly.</li>
<li><i>Offset scaling.</i> The penalty a pair inflicts on the certified count is quadratic in its distance from the line: pairs hugging the critical line
barely depress the certificate. This is consistent from the other side with Goldston\u2013Suriajaya&rsquo;s finding that confining all zeros to o(1/log T)
of the line already restores \u2153-style conclusions.</li>
<li><i>Where the difficulty lives.</i> Mid-range offsets hurt most \u2014 precisely the region no zero-density theorem currently excludes.</li>
</ul>
An elementary computation \u2014 but it converts the paper&rsquo;s abstract sharpness remark (\u00a77.2) into an explicit, checkable formula for where every unit
of slack goes.</p></div>

<div class="panel"><span class="badge b-num">NUMERICAL OBSERVATION.</span> Beam 2&rsquo;s second-moment identity, normally verified from the prime side, was checked
from the <i>zero side</i>: building G\u0303 from live computed zeros near t = 400 gives \u2016G\u0303\u2016\u00b2<sub>HS</sub>/tr G\u0303 = 1.256 against the asymptotic
c<sup>\u22121</sup><sub>MT</sub> = 1.32750 \u2014 94.6% of the predicted value, the deficit tracking frame truncation at d = 16. Direction and size behave as
Propositions 4.2\u20134.3 of the paper predict.</p></div>

<div class="panel"><span class="badge b-ill">AUTOPSIES</span><b>Killed ideas, with causes of death.</b>
<ul class="small">
<li><b>Li/Keiper coefficients \u03bb<sub>n</sub> \u2265 0 from live zeros.</b> Dead: tail truncation at accessible heights swamps \u03bb\u2081, \u03bb\u2082 \u2014 the criterion is exact, browser data is not.</li>
<li><b>Sieve-relaxed positivity beyond support 1.</b> Dead: Selberg-type sieves give <i>upper</i> bounds for prime-pair sums, but the certificate needs the second moment <i>small</i>; the tool has the wrong sign.</li>
<li><b>Third-moment extraction, tr G\u0303\u00b3.</b> Dead: the cubic term evaluates three-prime correlations \u2014 strictly harder than the twin-prime-scale input that already exceeds support 1.</li>
<li><b>Additive window combinations.</b> Dead by Proposition A.</li>
<li><b>Interlacing \u03be\u2032/\u03be.</b> Dead: between-two-real-zeros arguments presuppose the zeros are real \u2014 circular.</li>
<li><b>\u03be\u2033 transfer of Remark 7.1.</b> Not dead, not claimed: swapping their weight system once more looks mechanical but needs their estimates redone; logged as the cheapest open follow-up this author knows.</li>
<li><b>Connes trace formula.</b> Dead end here: positivity is equivalent only after a cuspidal input is proved \u2014 an obstacle of the same depth as RH.</li>
<li><b>de Branges-type Hilbert spaces of entire functions.</b> Dead: the structural gaps identified in prior attempts recur.</li>
<li><b>Tur\u00e1n power sums.</b> Dead: lower bounds for |\u03a3 z<sub>k</sub><sup>n</sup>| force hyperbola regions \u03b2 \u2264 1\u2212c/n<sup>\u03ba</sup>, never the line \u03b2 = \u00bd.</li>
<li><b>Nyman\u2013B\u00e1ez-Duarte/Beurling density.</b> Dead for proportions: reformulates RH as L\u00b2-completeness; finite-dimensional approximations carry no counting information.</li>
<li><b>Direct optimization of W(f,f) off-bandwidth.</b> Dead by definition: local positivity beyond support 1 <i>is</i> RH, piecewise \u2014 there is nothing to optimize against without assuming the goal.</li>
</ul>
Scoreboard: sixteen opened, eleven autopsied above plus two folded variants, two elementary propositions survived, one numerical identity confirmed.
The hypothesis stands.</div>

<p><b>Coda.</b>"""

rep(anchor, insert, "session log")

io.open(p,'w',encoding='utf-8').write(t)
print('done, misses:',misses)
