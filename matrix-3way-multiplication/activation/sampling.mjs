// Random sampling instead of low precision: estimate each output of f(A·B·C + beta) from a random
// subset of its terms; decide where f is flat over the confidence interval, otherwise refine exactly.
//
// Cost = scalar multiplications (exact chain = 2N³).
//  hybrid : exact P = B·C (N³), then per output sample j without replacement, term A_ij·P_jl (1 mult).
//           Sampling all N terms IS the exact value, so the worst case equals the exact chain.
//  triple : no intermediate; per output sample (j,k) without replacement, term A_ij·B_jk·C_kl (2 mults),
//           budget N samples; undecided outputs are refined exactly through a minimum row/column cover.
// Bounds (population M, n drawn, terms in [-R, R]):
//  strict    : Hoeffding–Serfling  |mean−μ| ≤ 2R·sqrt(ρ·ln(2/δ)/(2n)), ρ = 1 − (n−1)/M   (guaranteed w.p. 1−δ)
//  empirical : z·s·sqrt((1 − n/M)/n) with the sample std s (normal approximation, no guarantee)
import { rng, cover, ACT } from "./cascade.mjs";

export function data(N, kind, seed) {
  const r = rng(seed);
  const entry = () => kind === "signed" ? r() * 2 - 1 : kind === "nonneg" ? r() : (r() < 0.2 ? Math.exp(1.5 * (r() + r() + r() - 1.5)) : 0);
  const M = () => Array.from({ length: N }, () => Array.from({ length: N }, entry));
  return { A: M(), B: M(), C: M() };
}
const mm = (X, Y) => X.map(row => Y[0].map((_, j) => row.reduce((s, v, k) => s + v * Y[k][j], 0)));
function shuffle(n, r) { const p = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p; }

export function run({ A, B, C }, { act = "sign", quantile = 0.5, strategy = "hybrid", bound = "strict", delta = 1e-6, batch = 4, seed = 1 } = {}) {
  const N = A.length, r = rng(seed), P = mm(B, C), D = mm(A, P);
  const sorted = D.flat().sort((a, b) => a - b), beta = -sorted[Math.floor(quantile * (sorted.length - 1))];
  const f = x => ACT[act](x + beta);
  const z = Math.sqrt(2) * erfinvApprox(1 - delta);
  let cost = strategy === "hybrid" ? N ** 3 : 0, wrong = 0, decided = 0;
  const maxA = A.map(r => Math.max(...r.map(Math.abs))), maxB = Math.max(...B.flat().map(Math.abs));
  const maxC = C[0].map((_, l) => Math.max(...C.map(r => Math.abs(r[l])))), maxP = P[0].map((_, l) => Math.max(...P.map(r => Math.abs(r[l]))));
  const undecided = [];
  for (let i = 0; i < N; i++) for (let l = 0; l < N; l++) {
    const M = strategy === "hybrid" ? N : N * N, budget = strategy === "hybrid" ? N : N;
    const R = strategy === "hybrid" ? maxA[i] * maxP[l] : maxA[i] * maxB * maxC[l];
    const order = shuffle(M, r), looks = Math.ceil(budget / batch), dl = delta / looks;
    let n = 0, sum = 0, sq = 0, done = false;
    while (n < budget && !done) {
      for (let b = 0; b < batch && n < budget; b++, n++) {
        const t = order[n];
        const term = strategy === "hybrid" ? A[i][t] * P[t][l] : A[i][Math.floor(t / N)] * B[Math.floor(t / N)][t % N] * C[t % N][l];
        cost += strategy === "hybrid" ? 1 : 2; sum += term; sq += term * term;
      }
      const mean = sum / n;
      if (n === M) { done = true; if (f(mean * M) !== f(D[i][l]) && Math.abs(mean * M - D[i][l]) > 1e-9) wrong++; break; }   // exhausted: exact
      let hw;
      if (bound === "strict") hw = 2 * R * Math.sqrt((1 - (n - 1) / M) * Math.log(2 / dl) / (2 * n));
      else { const v = Math.max(0, sq / n - mean * mean) * n / Math.max(1, n - 1); hw = z * Math.sqrt(v * (1 - n / M) / n); }
      const lo = f(M * (mean - hw)), hi = f(M * (mean + hw));
      if (lo === hi) { done = true; decided++; if (lo !== f(D[i][l])) wrong++; }
    }
    if (!done) undecided.push([i, l]);
  }
  if (undecided.length) { const { rows, cols } = cover(N, undecided); cost += (rows.length + cols.length) * N * N + undecided.length * N; }
  return { ratio: cost / (2 * N ** 3), decided, undecided: undecided.length, wrong, beta };
}
// inverse error function (Giles' approximation), enough for z-scores
function erfinvApprox(x) { const w = -Math.log((1 - x) * (1 + x)); let p;
  if (w < 5) { const t = w - 2.5; p = 2.81022636e-08; for (const c of [3.43273939e-07, -3.5233877e-06, -4.39150654e-06, 0.00021858087, -0.00125372503, -0.00417768164, 0.246640727, 1.50140941]) p = c + p * t; }
  else { const t = Math.sqrt(w) - 3; p = -0.000200214257; for (const c of [0.000100950558, 0.00134934322, -0.00367342844, 0.00573950773, -0.0076224613, 0.00943887047, 1.00167406, 2.83297682]) p = c + p * t; }
  return p * x; }

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const N of [32, 64]) for (const kind of ["signed", "nonneg", "sparse"]) {
    const inst = data(N, kind, 21);
    console.log(`\nN=${N}  ${kind}`);
    for (const [act, q] of [["sign", 0.5], ["sign", 0.9], ["relu", 0.5], ["relu", 0.9]]) {
      const cells = [];
      for (const strategy of ["hybrid", "triple"]) for (const bound of ["strict", "empirical"]) {
        const res = run(inst, { act, quantile: q, strategy, bound });
        cells.push(`${strategy[0]}/${bound.slice(0, 3)} ${String(Math.round(100 * res.ratio)).padStart(4)}%${res.wrong ? ` (${res.wrong} wrong)` : ""}`);
      }
      console.log(`  ${act.padEnd(4)} threshold at ${q * 100}th pct: ${cells.join("  ")}`);
    }
  }
}
