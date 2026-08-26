'use strict';

// The pressure parameter, and what the ground state does as it moves.
//
// Everything else in this directory studies the chain energy at one value of
// the pressure parameter, p = 3000, inherited from the manuscript.  The energy
// is a one-dimensional particle system -- a pressure term (sum g)/p plus a pair
// interaction w summed over lags 1..6 -- and for a CONVEX decaying interaction
// the ground state of such a system is equally spaced.  w is not convex: it is
// (K/K0)^2, which oscillates as it decays, vanishing at the zeros of K.  At
// p = 3000 the ground state is period two.  The question nobody here had asked
// is what it does as p moves, and the answer turns out to explain several
// numbers this directory has been carrying without an account of them.
//
// Two findings, both reproducible from this file.
//
// 1.  THE GROUND STATE IS MODE-LOCKED, AND THE LOCK IS TO A ZERO OF THE KERNEL.
//     The zeros of K sit at z_1 = 1.0573, z_2 = 2.0301, z_3 = 3.0202, ...,
//     approaching integer spacing from below.  As p rises the mean gap climbs in
//     plateaus, and the plateau values are the HALVED ZEROS:
//
//        k   period   mean gap     z_k/2       mean - z_k/2   mean - k/2
//        2      1     1.016274173  1.015033765   1.24e-3       1.63e-2
//        3      2     1.510502760  1.510121496   3.81e-4       1.05e-2
//        4      1     2.007689206  2.007617804   7.14e-5       7.69e-3
//        5      2     2.506168559  2.506104224   6.43e-5       6.17e-3
//        6      1     3.005088255  3.005091395  -3.14e-6       5.09e-3
//        7      2     3.504376231  3.504366406   9.83e-6       4.38e-3
//
//     The lock is to z_k/2 and not merely to the half-integer k/2: the last two
//     columns differ by two orders of magnitude at every k, and the z_k/2 error
//     shrinks with k while the k/2 error does not.  What is being locked is the
//     lag-TWO distance, 2 * mean, onto a zero of K, where w vanishes and the
//     pair costs nothing.
//
//     Which zero it is decides the period, and the rule is parity.  For even k
//     the state is period one, every gap z_k/2.  For odd k it is period two,
//     because a single gap of z_k/2 would then put the lag-ONE distance near a
//     maximum of w; splitting into a short and a long gap keeps the lag-two
//     distance on the zero and moves both lag-one distances towards the
//     neighbouring zeros.  Checked for k = 2 through 7.  Between the locked
//     plateaus sit others at periods three and four, with the short-to-long
//     ratio running through small rationals -- 3:1, 2:1, 1:1, 1:2 -- which is
//     the shape of a devil's staircase.
//
// 2.  THE WALL TENSIONS ARE THE ORDER PARAMETERS OF THE PLATEAU.
//     A low-low adjacency is a nucleus of the phase that wins below the plateau
//     and a high-high adjacency a nucleus of the one that wins above it, so each
//     tension should fall to zero at its own end.  It does:
//
//       tau_LL = 0 at p = 1425.709927,   tau_HH = 0 at p = 3521.815455.
//
//     p = 3000 sits 75.1% of the way across.  That single fact accounts for
//     tau_LL / tau_HH = 7.43 at p = 3000, for the high-high defect being the
//     near-free basin that blocks the certificate program, and for the whole
//     1.66e-7 shortfall of the additive family: the difficulty of proving
//     crystallization at p = 3000 is a measure of how close p = 3000 is to a
//     phase boundary.
//
//     A periodic ARRAY of walls wins earlier than a single wall costs nothing --
//     the period-three state takes over near p = 3350 while tau_HH stays
//     positive to 3521.8 -- so walls attract, which is worth knowing and is not
//     something the single-wall calculation could see.

const T = require('./tiling_research');

const SQRT2 = Math.SQRT2;

function sinc(x) {
  return Math.abs(x) < 1e-9 ? 1 - x * x / 6 : Math.sin(x) / x;
}

// K(x) = [sinc((sqrt2 - 2 pi x)/2) + sinc((sqrt2 + 2 pi x)/2)] / 2
function kernel(x) {
  const b = 2 * Math.PI * x;
  return 0.5 * sinc((SQRT2 - b) / 2) + 0.5 * sinc((SQRT2 + b) / 2);
}

// The zeros of K are the free distances: w = (K/K0)^2 vanishes there, so a pair
// sitting on one costs nothing at all.
function kernelZeros(limit, step = 1e-5) {
  const out = [];
  let prev = kernel(step);
  for (let x = step; x < limit; x += step) {
    const next = kernel(x + step);
    if (prev * next < 0) {
      let a = x, b = x + step;
      for (let i = 0; i < 80; i++) {
        const m = (a + b) / 2;
        if (kernel(a) * kernel(m) <= 0) b = m; else a = m;
      }
      out.push((a + b) / 2);
    }
    prev = next;
  }
  return out;
}

function energyAndGradient(gaps, p) {
  return T.periodicChainEnergyAndGradient(gaps, 7, p);
}

function relax(start, p, iterations = 5000) {
  let g = start.slice();
  let value = energyAndGradient(g, p).energy;
  let step = 0.02;
  for (let it = 0; it < iterations; it++) {
    const {gradient} = energyAndGradient(g, p);
    const trial = g.map((x, i) => Math.max(0.02, x - step * gradient[i]));
    const v = energyAndGradient(trial, p).energy;
    if (v < value) { g = trial; value = v; step *= 1.05; } else step *= 0.6;
    if (step < 1e-16) break;
  }
  return {gaps: g, value};
}

// Newton on the two-variable system for the period-two state.  Much sharper
// than relaxation, and the plateau edges need the sharpness.
function twoCycle(p, seed = [1.0416801034484870, 1.9794672314032244], steps = 200) {
  let [L, H] = seed;
  const w = T.overlapWeight, wd = T.overlapWeightDerivative;
  const alpha = 6 / p;
  const lag = (s, parity) => (s % 2 === 0)
    ? (s / 2) * (L + H)
    : ((s - 1) / 2) * (L + H) + (parity === 0 ? L : H);
  for (let it = 0; it < steps; it++) {
    let dL = alpha / 2, dH = alpha / 2;
    let LL = 0, LH = 0, HH = 0;
    const h = 1e-6;
    for (let s = 1; s <= 6; s++) {
      for (const parity of [0, 1]) {
        const d = lag(s, parity);
        const cL = (s % 2 === 0) ? s / 2 : (s - 1) / 2 + (parity === 0 ? 1 : 0);
        const cH = (s % 2 === 0) ? s / 2 : (s - 1) / 2 + (parity === 0 ? 0 : 1);
        dL += wd(d) * cL;
        dH += wd(d) * cH;
        const second = (wd(d + h) - wd(d - h)) / (2 * h);
        LL += second * cL * cL;
        HH += second * cH * cH;
        LH += second * cL * cH;
      }
    }
    const det = LL * HH - LH * LH;
    if (!isFinite(det) || Math.abs(det) < 1e-14) break;
    const nL = L - (HH * dL - LH * dH) / det;
    const nH = H - (-LH * dL + LL * dH) / det;
    if (Math.abs(nL - L) < 1e-15 && Math.abs(nH - H) < 1e-15) { L = nL; H = nH; break; }
    L = nL; H = nH;
  }
  return {L, H, mean: (L + H) / 2, lagTwo: L + H};
}

// Excess energy of one wall on an odd ring: positive means the alternating state
// is stable against that adjacency, and the zero crossings are the plateau ends.
function wallTension(p, phase, period = 63) {
  const {L, H} = twoCycle(p);
  const ground = T.periodicChainEnergy([L, H], 7, p);
  const start = Array.from({length: period}, (_, i) =>
    ((i + phase) % 2 === 0) ? L : H);
  const relaxed = relax(start, p, 30000);
  return {tension: period * (relaxed.value - ground), L, H, gaps: relaxed.gaps};
}

function plateauEdge(phase, lo, hi, iterations = 50) {
  let flo = wallTension(lo, phase).tension;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const fm = wallTension(mid, phase).tension;
    if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
    if (hi - lo < 1e-7) break;
  }
  return (lo + hi) / 2;
}

// The best pressure for the projection, which is not the one this directory
// inherited.  The conditional projection has two competing p-dependences: the
// span penalty (n-1)/p falls as p rises, and the ground-state energy falls too.
// Nobody had evaluated the trade-off, because nobody had E_alt(p).
function groundEnergy(p) {
  const two = twoCycle(p);
  let best = T.periodicChainEnergy([two.L, two.H], 7, p);
  let period = 2;
  for (const seed of [[1.0436, 1.9923, 1.9923], [1.0323, 1.9712, 1.0323]]) {
    const r = relax(seed, p, 20000);
    if (r.value < best) { best = r.value; period = 3; }
  }
  for (const z of kernelZeros(8)) {
    const r = relax([z / 2], p, 20000);
    if (r.value < best) { best = r.value; period = 1; }
  }
  return {energy: best, period};
}

function projectionAt(p) {
  const g = groundEnergy(p);
  const r = T.projectedSimpleZeroBound(g.energy, 7, p);
  return {bound: r.bound, floor: g.energy, period: g.period,
    windowsPerBlock: r.windowsPerBlock};
}

// Where the period-two state loses to period three.
function periodCrossover(lo = 3360, hi = 3390, iterations = 50) {
  const two = p => { const t = twoCycle(p); return T.periodicChainEnergy([t.L, t.H], 7, p); };
  const three = p => relax([1.0436, 1.9923, 1.9923], p, 40000).value;
  for (let i = 0; i < iterations; i++) {
    const m = (lo + hi) / 2;
    if (two(m) < three(m)) lo = m; else hi = m;
    if (hi - lo < 1e-8) break;
  }
  return (lo + hi) / 2;
}

module.exports = {kernel, kernelZeros, relax, twoCycle, wallTension, plateauEdge,
  energyAndGradient, groundEnergy, projectionAt, periodCrossover};
