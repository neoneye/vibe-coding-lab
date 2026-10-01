// Precision cascade for Y = f(A·B·C + beta): decide saturated outputs cheaply, refine the rest.
//
// Cost model: multiplying a p-bit by a q-bit number costs p·q bit-operations (array multiplier).
// Inputs are 16-bit fixed point in [-1, 1). The exact chain costs 3·N³·16² (AB at 16×16, then ·C at 32×16).
//
// Level b: round A, B, C to b bits. For every still-undecided entry compute the coarse value D̃ and a
// RIGOROUS bound |D − D̃| ≤ E from the exact expansion of (A−ΔA)(B−ΔB)(C−ΔC) (seven terms, |ΔX| ≤ δX).
// If the activation is flat (within ε) on [D̃+β−E, D̃+β+E], the output is decided. Entries are evaluated
// through a row of ÃB̃ or a column of B̃C̃; the fewest lines covering the undecided set is a minimum
// vertex cover of a bipartite graph (König's theorem via maximum matching).
// mode "predict" shrinks E by a factor gamma (no guarantee; SeerNet-style) and reports wrong decisions.

export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const FULL = 16;
export function fixed(x, b) { const step = 2 ** (1 - b); return Math.max(-1, Math.min(1 - step, Math.round(x / step) * step)); }
export function gen(N, seed) {
  const r = rng(seed), M = () => Array.from({ length: N }, () => Array.from({ length: N }, () => fixed(r() * 2 - 1, FULL)));
  return { A: M(), B: M(), C: M() };
}
const mm = (X, Y) => X.map(row => Y[0].map((_, j) => row.reduce((s, v, k) => s + v * Y[k][j], 0)));
const q = (M, b) => M.map(r => r.map(x => fixed(x, b)));
const maxDiff = (X, Y) => Math.max(...X.flatMap((r, i) => r.map((v, j) => Math.abs(v - Y[i][j]))));

export const ACT = {
  relu: x => Math.max(0, x),
  sign: x => (x > 0 ? 1 : x < 0 ? -1 : 0),
  hardtanh: x => Math.max(-1, Math.min(1, x)),
  sigmoid: x => 1 / (1 + Math.exp(-x)),
};

// minimum vertex cover of bipartite edges (i,l): Kuhn matching + König construction
export function cover(N, edges) {
  const adj = Array.from({ length: N }, () => []);
  for (const [i, l] of edges) adj[i].push(l);
  const matchC = new Array(N).fill(-1), matchR = new Array(N).fill(-1);
  const tryK = (i, seen) => { for (const l of adj[i]) { if (seen[l]) continue; seen[l] = true;
    if (matchC[l] < 0 || tryK(matchC[l], seen)) { matchC[l] = i; matchR[i] = l; return true; } } return false; };
  for (let i = 0; i < N; i++) if (adj[i].length) tryK(i, new Array(N).fill(false));
  const visR = new Array(N).fill(false), visC = new Array(N).fill(false), stack = [];
  for (let i = 0; i < N; i++) if (adj[i].length && matchR[i] < 0) { visR[i] = true; stack.push(i); }
  while (stack.length) { const i = stack.pop();
    for (const l of adj[i]) if (!visC[l]) { visC[l] = true; const i2 = matchC[l]; if (i2 >= 0 && !visR[i2]) { visR[i2] = true; stack.push(i2); } } }
  const rows = [], cols = [];
  for (let i = 0; i < N; i++) if (adj[i].length && !visR[i]) rows.push(i);
  for (let l = 0; l < N; l++) if (visC[l]) cols.push(l);
  return { rows, cols };
}

export function cascade({ A, B, C }, { act = "sign", beta = 0, gain = 1, eps = 0, levels = [8], mode = "rigorous", gamma = 1 } = {}) {
  const N = A.length, f = x => ACT[act](gain * (x + beta));
  const D = mm(mm(A, B), C);                         // reference (not counted)
  const abs = M => M.map(r => r.map(Math.abs));
  // bound vectors, once, at full precision: a_i = Σ|A_i·|, c_l = Σ|C_·l|, r_l = (1ᵀ|B||C|)_l, s_i = (|A||B|1)_i, nB = Σ|B|
  const aA = abs(A).map(r => r.reduce((s, v) => s + v, 0));
  const cC = abs(C)[0].map((_, l) => abs(C).reduce((s, r) => s + r[l], 0));
  const colB = abs(B)[0].map((_, k) => abs(B).reduce((s, r) => s + r[k], 0));        // 1ᵀ|B|
  const rowB = abs(B).map(r => r.reduce((s, v) => s + v, 0));                       // |B|1
  const rr = cC.map((_, l) => colB.reduce((s, v, k) => s + v * Math.abs(C[k][l]), 0));
  const ss = aA.map((_, i) => rowB.reduce((s, v, j) => s + Math.abs(A[i][j]) * v, 0));
  const nB = rowB.reduce((s, v) => s + v, 0);
  let cost = 2 * N * N * FULL * FULL;                 // rr and ss
  let U = []; for (let i = 0; i < N; i++) for (let l = 0; l < N; l++) U.push([i, l]);
  const Y = Array.from({ length: N }, () => new Array(N).fill(null));
  const perLevel = [];
  let wrong = 0, maxErr = 0;
  for (const b of levels) {
    if (!U.length) break;
    const Aq = q(A, b), Bq = q(B, b), Cq = q(C, b);
    const dA = maxDiff(A, Aq), dB = maxDiff(B, Bq), dC = maxDiff(C, Cq);
    const { rows, cols } = cover(N, U);
    cost += (rows.length + cols.length) * N * N * b * b + U.length * 2 * N * b * b + U.length * 12 * FULL * FULL;
    const ABr = {}, BCc = {};
    for (const i of rows) ABr[i] = Bq[0].map((_, k) => Aq[i].reduce((s, v, j) => s + v * Bq[j][k], 0));
    for (const l of cols) BCc[l] = Bq.map(r => r.reduce((s, v, k) => s + v * Cq[k][l], 0));
    const keep = [];
    for (const [i, l] of U) {
      const Dq = ABr[i] ? ABr[i].reduce((s, v, k) => s + v * Cq[k][l], 0) : Aq[i].reduce((s, v, j) => s + v * BCc[l][j], 0);
      let E = dA * rr[l] + dB * aA[i] * cC[l] + dC * ss[i]
            + dA * dB * N * cC[l] + dA * dC * nB + dB * dC * N * aA[i] + dA * dB * dC * N * N;
      E = E * (1 + 1e-9) + 1e-12;
      if (mode === "predict") E *= gamma;
      const lo = f(Dq - E), hi = f(Dq + E);
      if (Math.abs(hi - lo) <= 2 * eps) {
        Y[i][l] = (lo + hi) / 2;
        const err = Math.abs(Y[i][l] - f(D[i][l]));
        maxErr = Math.max(maxErr, err); if (err > eps + 1e-12) wrong++;
      } else keep.push([i, l]);
    }
    perLevel.push({ b, decided: U.length - keep.length, lines: rows.length + cols.length });
    U = keep;
  }
  if (U.length) {                                      // exact for the rest
    const { rows, cols } = cover(N, U);
    cost += (rows.length + cols.length) * N * N * FULL * FULL + U.length * 2 * N * FULL * FULL;
    for (const [i, l] of U) Y[i][l] = f(D[i][l]);
    perLevel.push({ b: FULL, decided: U.length, lines: rows.length + cols.length });
  }
  const chain = 3 * N ** 3 * FULL * FULL;
  return { cost, chain, ratio: cost / chain, perLevel, wrong, maxErr, Y, D };
}


// Hybrid: P = B·C exactly (N³·16²), then cascade only on A·P, where refining an entry is one dot product.
// P is quantized relative to its own range: P̃ = s·fixed(P/s, b), s = max|P|. Rigorous bound for D = A·P:
// |A·P − Ã·P̃| ≤ δA·Σ_j|P_jl| + δP·Σ_j|A_ij| + δA·δP·N. Second-stage multiply in the exact chain costs 32×16 bits;
// at level b it costs b×b.
export function hybrid({ A, B, C }, { act = "sign", beta = 0, gain = 1, eps = 0, levels = [8], mode = "rigorous", gamma = 1 } = {}) {
  const N = A.length, f = x => ACT[act](gain * (x + beta));
  const P = mm(B, C), D = mm(A, P);
  let cost = N ** 3 * FULL * FULL;                          // exact B·C
  const sP = Math.max(...P.flat().map(Math.abs)) || 1;
  const colP = P[0].map((_, l) => P.reduce((s, r) => s + Math.abs(r[l]), 0));
  const rowA = A.map(r => r.reduce((s, v) => s + Math.abs(v), 0));
  let U = []; for (let i = 0; i < N; i++) for (let l = 0; l < N; l++) U.push([i, l]);
  const perLevel = []; let wrong = 0, maxErr = 0;
  for (const b of levels) {
    if (!U.length) break;
    const Aq = q(A, b), Pq = P.map(r => r.map(x => sP * fixed(x / sP, b)));
    const dA = maxDiff(A, Aq), dP = maxDiff(P, Pq);
    cost += U.length * N * b * b + U.length * 4 * FULL * FULL;
    const keep = [];
    for (const [i, l] of U) {
      const Dq = Aq[i].reduce((s, v, j) => s + v * Pq[j][l], 0);
      let E = (dA * colP[l] + dP * rowA[i] + dA * dP * N) * (1 + 1e-9) + 1e-12;
      if (mode === "predict") E *= gamma;
      const lo = f(Dq - E), hi = f(Dq + E);
      if (Math.abs(hi - lo) <= 2 * eps) { const y = (lo + hi) / 2, err = Math.abs(y - f(D[i][l])); maxErr = Math.max(maxErr, err); if (err > eps + 1e-12) wrong++; }
      else keep.push([i, l]);
    }
    perLevel.push({ b, decided: U.length - keep.length }); U = keep;
  }
  if (U.length) { cost += U.length * N * 2 * FULL * FULL; perLevel.push({ b: FULL, decided: U.length }); }
  const chain = 3 * N ** 3 * FULL * FULL;
  return { cost, chain, ratio: cost / chain, perLevel, wrong, maxErr };
}

// ---- self-test + experiments ----
if (import.meta.url === `file://${process.argv[1]}`) {
  let ok = true; const check = (name, c) => { if (!c) { ok = false; console.log("FAIL", name); } };
  // cover is a valid vertex cover and matches the matching size
  const r = rng(3);
  for (let t = 0; t < 50; t++) { const N = 8, E = []; for (let i = 0; i < N; i++) for (let l = 0; l < N; l++) if (r() < 0.2) E.push([i, l]);
    const { rows, cols } = cover(N, E), R = new Set(rows), Cs = new Set(cols);
    check("cover valid", E.every(([i, l]) => R.has(i) || Cs.has(l)));
    // brute force minimum for small N
    let best = 99; for (let m = 0; m < 1 << (2 * N); m++) { const pc = m.toString(2).split("1").length - 1; if (pc >= best) continue;
      if (E.every(([i, l]) => (m >> i & 1) || (m >> (N + l) & 1))) best = pc; }
    check("cover minimum", rows.length + cols.length === best);
  }
  // rigorous mode never decides wrongly
  for (const act of ["sign", "relu", "hardtanh"]) for (const beta of [-3, 0, 2]) {
    const res = cascade(gen(16, 7), { act, beta, gain: 1, levels: [4, 8, 12] });
    check(`rigorous ${act} beta=${beta}`, res.wrong === 0 && res.maxErr === 0);
  }
  const sres = cascade(gen(16, 7), { act: "sigmoid", eps: 1e-3, levels: [8] });
  check("sigmoid within eps", sres.maxErr <= 1e-3 + 1e-12);
  for (const act of ["sign", "relu", "hardtanh"]) for (const beta of [-3, 0, 2]) {
    const res = hybrid(gen(16, 7), { act, beta, levels: [4, 8] });
    check(`hybrid rigorous ${act} beta=${beta}`, res.wrong === 0 && res.maxErr === 0);
  }
  console.log(ok ? "cascade self-tests passed" : "cascade self-tests FAILED");
  if (!ok) process.exit(1);

  const N = 32, inst = gen(N, 11), Dstd = Math.sqrt(cascade(inst, { levels: [] }).D.flat().reduce((s, v) => s + v * v, 0) / N / N);
  console.log(`\nN=${N}, pre-activation std ≈ ${Dstd.toFixed(2)}; cost relative to exact chain (3N³·16²):`);
  const fmt = res => `${(100 * res.ratio).toFixed(0).padStart(3)}%  levels ${res.perLevel.map(p => `${p.b}b:${p.decided}`).join(" ")}  wrong=${res.wrong}`;
  for (const levels of [[8], [6, 10], [4, 8, 12]]) {
    console.log(`\nlevels ${JSON.stringify(levels)}`);
    for (const [act, beta, gain, eps] of [["sign", 0, 1, 0], ["relu", 0, 1, 0], ["relu", -4, 1, 0], ["hardtanh", 0, 1, 0], ["hardtanh", 0, 0.5, 0], ["sigmoid", 0, 1, 0.01], ["sigmoid", 0, 4, 0.01]])
      console.log(`  ${act.padEnd(8)} β=${String(beta).padStart(2)} gain=${gain} ε=${eps}: ${fmt(cascade(inst, { act, beta, gain, eps, levels }))}`);
  }
  console.log(`\nHYBRID (exact B·C, cascade on A·(BC)), rigorous:`);
  for (const levels of [[4], [6], [8], [4, 8]]) {
    console.log(`levels ${JSON.stringify(levels)}`);
    for (const [act, beta, gain, eps] of [["sign", 0, 1, 0], ["relu", 0, 1, 0], ["relu", -4, 1, 0], ["hardtanh", 0, 1, 0], ["hardtanh", 0, 0.5, 0], ["sigmoid", 0, 1, 0.01], ["sigmoid", 0, 4, 0.01]])
      console.log(`  ${act.padEnd(8)} β=${String(beta).padStart(2)} gain=${gain} ε=${eps}: ${fmt(hybrid(inst, { act, beta, gain, eps, levels }))}`);
  }
  console.log(`\nfloor: exact B·C alone = 33%`);
  console.log(`\npredictive (bound × γ), levels [6], sign:`);
  for (const gamma of [1, 0.3, 0.1, 0.03]) console.log(`  γ=${gamma}: ${fmt(cascade(inst, { act: "sign", levels: [6], mode: "predict", gamma }))}`);
}
