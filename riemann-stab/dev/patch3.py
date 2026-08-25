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

# ---------- \u00a77 Beam 3 + Beam 4 + chain, rewritten with P1 / Q\u2032 ----------
old = u"""<h3>Beam 3 \u2014 the block structure (zero side)</h3>
<div class="panel"><span class="badge b-thm">THEOREM</span>G\u0303 \u2248 P + Q where:
<ul style="margin:.4em 0 .2em">
<li>each simple on-line zero contributes a rank-one <i>positive</i> piece to P;</li>
<li>each off-line pair {ρ, 1−ρ̄} contributes a block of signature (1,1) to Q \u2014 writing v = a+ib, the pair adds 2(aaᵀ − bbᵀ), indefinite;</li>
<li>so tr P ≤ N₀ and, crucially, <b>n₊(Q) ≤ #off-line pairs</b>.</li>
</ul></div>
<h3>Beam 4 \u2014 the rank–trace inequality (pure linear algebra)</h3>
<div class="panel"><span class="badge b-thm">LEMMA</span>If P ⪰ 0 and Q′ has n₊(Q′) ≤ b, then
<div class="formula" style="margin-bottom:0">rank P ≥ 2 tr P + 4 tr Q′ − 4b − ‖P+Q′‖²<sub>HS</sub></div></div>
<p>It is the matrix form of m² ≥ 2m−1. Combine: rank of the positive part ≥ 4 tr G̃ − 2N − ‖G̃‖²<sub>HS</sub> = (2 − R(ψ))·N, and rank bounds the number of
simple on-line zeros from above… giving, at ψ = indicator:</p>
<div class="panel" style="text-align:center;font-family:var(--mono)">
N₀ˢ/N ≥ 2 − R(ψ₀) = 2 − 4/3 = <b style="color:var(--green)">2/3</b>
</div>
<p>Sylvester&rsquo;s law of inertia is the quiet hero: inertia is invariant under change of basis, so the signature count survives the compression.
Off-line zeros do not break the argument — they merely donate one negative direction each, and negative directions get <i>counted</i>, not feared.
That is Bombieri&rsquo;s device doing real work, and it is why the result extends even to L-functions (Davenport–Heilbronn) for which RH is false.</p>"""

new = u"""<h3>Beam 3 — the block structure (zero side)</h3>
<div class="panel"><span class="badge b-thm">THEOREM</span>G̃ ≈ P + Q, normalized so an isolated simple on-line zero contributes 1 to tr G̃:
<ul style="margin:.4em 0 .2em">
<li>each on-line zero contributes a rank-one positive piece to P: trace 1 if simple; a zero of multiplicity m still has rank 1 but trace m;</li>
<li>each off-line pair {ρ, 1−ρ̄} contributes to Q a block 2(aaᵀ − bbᵀ) of signature (1,1) — writing v = a+ib;</li>
<li>so tr P ≤ N₀, n₊(Q) ≤ #off-line pairs, N ≥ s₁ + 2s₂ + 2p, and tr G̃ = (1+o(1))·N,
where s₁ = simple on-line, s₂ = multiple on-line points, p = off-line pairs.</li>
</ul></div>
<h3>Beam 4 — the multiplicity-aware split and the rank–trace inequality</h3>
<p>The headline theorem counts <i>simple</i> on-line zeros, so multiples must be pushed out of the rank side. Let P₁ ⊆ P carry only the s₁ simple on-line
zeros, and put Q′ := G̃ − P₁ — Q′ now contains the off-line pairs <i>and</i> the multiple on-line zeros.</p>
<div class="panel"><span class="badge b-thm">LEMMA</span>If P₁ ⪰ 0 and Q′ is Hermitian with n₊(Q′) ≤ b, then
<div class="formula" style="margin-bottom:0">rank P₁ ≥ 2 tr P₁ + 4 tr Q′ − 4b − ‖P₁+Q′‖²<sub>HS</sub></div>
<span class="small dim">the matrix form of m² ≥ 2m−1; combined with the block bookkeeping — simple zeros on the rank side, multiple ones charged a flat 4 — it yields m² ≥ 3m−2.</span></div>
<p>Feed in (Z): tr P₁ + 2n₊(Q′) ≤ s₁ + 2(s₂+p) ≤ N. The whole theorem is then the single chain</p>
<div class="formula">N₀ˢ + o(N) ≥ rank P₁ ≥ 4 tr G̃ − 2N − ‖G̃‖²<sub>HS</sub> = (2 − R(ψ) − o(1))·N</div>
<p>where the last equality is Beam 2, Montgomery&rsquo;s unconditional prime-side second moment. At ψ = indicator:</p>
<div class="panel" style="text-align:center;font-family:var(--mono)">
N₀ˢ/N ≥ 2 − R(ψ₀) = 2 − 4/3 = <b style="color:var(--green)">2/3</b>
</div>
<p>Sylvester&rsquo;s law of inertia is the quiet hero: inertia is invariant under change of basis, so signature counts survive every compression.
Off-line zeros do not break the argument — they donate one positive direction each into Q′, get counted through b, and move on; multiple on-line zeros are
handled by the flat charge 4 rather than being allowed to inflate rank. That is Bombieri&rsquo;s device doing real work, and it is why the argument extends
even to L-functions (Davenport–Heilbronn) for which the analogue of RH is false.</p>"""
rep(old,new,"§7 beams")

# ---------- §8 rewrite ----------
old8 = u"""<p>Beam 3 is the soul of the proof, and it is pure linear algebra — so let&rsquo;s run it. The page takes real zeros your browser computed inside a window near
t = 400, builds their frame vectors v<sub>ρ</sub> = (ϕ̂(γ<sub>ρ</sub> − α<sub>k</sub>))<sub>k</sub> against a Montgomery–Taylor-flavored window ϕ sampled at the
α<sub>k</sub> grid, and assembles <b>Q</b> — the off-line part of the compression G̃ = P + Q — from hypothetical off-line pairs {ρ, 1−ρ̄}, each pair contributing
2(aaᵀ − bbᵀ), v = a + ib. Commit crimes against RH with the sliders and watch Sylvester&rsquo;s counter.</p>
<span class="badge b-ill">ILLUSTRATION</span><span class="small dim">of Proposition 4.1&rsquo;s mechanism at toy scale — not evidence about the actual zeta zeros</span>
<div class="panel">
  <div class="controls">
    <label>off-line pairs <input type="range" id="gPairs" min="0" max="8" step="1" value="0"></label>
    <span class="mono" id="gPairsLabel">p = 0</span>
    <label>their new β <input type="range" id="gBeta" min="51" max="90" step="1" value="72"></label>
    <span class="mono" id="gBetaLabel">β = 0.72</span>
  </div>
  <canvas id="gSpec" height="280"></canvas>
  <div class="statgrid" id="gStats"></div>
  <div id="gVerdict"></div>
  <div class="note small">Why some pairs may fail to flip a direction here: inertia of a sum is not the sum of inertias — positive background absorbs weak negative
  directions. The theorem never needs more: its chain only consumes the <i>bound</i> n₊(Q) ≤ #pairs together with tr P ≤ N₀. That bound is what you see
  respected above.</div>
</div>"""
new8 = u"""<p>The soul of the proof is pure linear algebra, so the page runs it twice — once exactly, once against real zeros.</p>
<h3>E·i — the chain of eq. (1.2), exact arithmetic</h3>
<p>An idealized frame: d orthonormal directions, one per basis slot. A simple on-line zero occupies one slot (trace 1, rank 1); a double zero occupies its slot
twice (trace 2, rank 1 — this is why multiples are the enemy of simplicity); an off-line pair occupies two slots as v = a+ib with ‖a‖²−‖b‖² = 1, contributing
vvᵀ + v̄v̄ᵀ = 2(aaᵀ − bbᵀ): trace 2, inertia (1,1). Every number below is then computed from the actual matrices, not asserted.</p>
<span class="badge b-ill">ILLUSTRATION</span><span class="small dim">idealized frame — the paper&rsquo;s inequalities, made tangible</span>
<div class="panel">
  <div class="controls">
    <label>doubled zeros s₂ <input type="range" id="cS2" min="0" max="6" step="1" value="0"></label>
    <span class="mono" id="cS2Label">s₂ = 0</span>
    <label>off-line pairs p <input type="range" id="cPairs" min="0" max="6" step="1" value="0"></label>
    <span class="mono" id="cPairsLabel">p = 0</span>
    <label>pair offset s <input type="range" id="cOff" min="25" max="200" step="5" value="100"></label>
    <span class="mono dim" id="cOffLabel">s = 1.00</span>
  </div>
  <div class="statgrid" id="cStats"></div>
  <div id="cVerdict"></div>
</div>
<h3>E·ii — Q from real zeros, near t = 400</h3>
<p>The same object against data your browser computed: frame vectors v<sub>ρ</sub> = (ϕ̂(γ<sub>ρ</sub> − α<sub>k</sub>))<sub>k</sub> of a
Montgomery–Taylor-flavored window on the α<sub>k</sub>-grid, Q assembled from hypothetical off-line pairs {ρ, 1−ρ̄}.</p>
<div class="panel">
  <div class="controls">
    <label>off-line pairs <input type="range" id="gPairs" min="0" max="8" step="1" value="0"></label>
    <span class="mono" id="gPairsLabel">p = 0</span>
    <label>their new β <input type="range" id="gBeta" min="51" max="90" step="1" value="72"></label>
    <span class="mono" id="gBetaLabel">β = 0.72</span>
  </div>
  <canvas id="gSpec" height="260"></canvas>
  <div class="statgrid" id="gStats"></div>
  <div id="gVerdict"></div>
  <div class="note small">Why some pairs may fail to flip a direction here: inertia of a sum is not the sum of inertias — weak negative directions can be absorbed.
  The theorem never needs more: its chain only consumes the <i>bound</i> n₊(Q′) ≤ s₂ + p together with tr P₁ ≤ N₀. Those bounds are what E·i shows respected.</div>
</div>"""
rep(old8,new8,"§8 lab E")

open(p,'w',encoding='utf-8').write(t)
print('done, misses:',misses)
