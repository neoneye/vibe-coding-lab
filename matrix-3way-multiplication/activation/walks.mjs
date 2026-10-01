// Cohen–Lewis-style random walks through A → B → C for NONNEGATIVE matrices.
// From row i step to j with prob ∝ A_ij, to k ∝ B_jk, to l ∝ C_kl (each normalised by its row sum, with the
// walk re-weighted so that) the endpoint l is hit with probability exactly p_il = D_il / m_i, m_i = Σ_l D_il.
// To make the endpoint distribution exact we sample j ∝ A_ij·w_j with w = B·(C·1) (rest-of-chain mass),
// then k ∝ B_jk·v_k with v = C·1, then l ∝ C_kl. Precomputing v, w, m costs 3N² multiplications;
// the walks themselves only draw random numbers. Counts give a Hoeffding bound for p_il:
// |p̂ − p| ≤ sqrt(ln(2/δ)/(2s)), so threshold decisions are correct with probability ≥ 1 − δ each.
// Undecided outputs are computed exactly through a minimum row/column cover (cost N² per line + N per output).
import { rng, cover } from "./cascade.mjs";
import { data } from "./sampling.mjs";

const mm = (X, Y) => X.map(row => Y[0].map((_, j) => row.reduce((s, v, k) => s + v * Y[k][j], 0)));
const mv = (X, x) => X.map(r => r.reduce((s, v, k) => s + v * x[k], 0));
function cdf(w) { const c = []; let s = 0; for (const x of w) { s += x; c.push(s); } return c; }
function draw(c, r) { const u = r() * c[c.length - 1]; let lo = 0, hi = c.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < u) lo = m + 1; else hi = m; } return lo; }

export function walks({ A, B, C }, { quantile = 0.99, delta = 1e-6, perRow = 4096, seed = 1 } = {}) {
  const N = A.length, r = rng(seed), D = mm(mm(A, B), C);
  const sorted = D.flat().sort((a, b) => a - b), thr = sorted[Math.floor(quantile * (sorted.length - 1))];
  const ones = new Array(N).fill(1), v = mv(C, ones), w = mv(B, v), m = mv(A, w);
  let mults = 3 * N * N, draws = 0, wrong = 0;
  const cA = A.map((row, i) => cdf(row.map((x, j) => x * w[j]))), cB = B.map(row => cdf(row.map((x, k) => x * v[k]))), cC = C.map(row => cdf(row));
  mults += 2 * N * N;                                         // the weighted CDFs A_ij·w_j and B_jk·v_k
  const undecided = [];
  const half = Math.sqrt(Math.log(2 / delta) / (2 * perRow));
  for (let i = 0; i < N; i++) {
    const cnt = new Array(N).fill(0);
    if (m[i] > 0) for (let s = 0; s < perRow; s++) { const j = draw(cA[i], r), k = draw(cB[j], r), l = draw(cC[k], r); cnt[l]++; draws += 3; }
    for (let l = 0; l < N; l++) {
      const p = cnt[l] / perRow, lo = m[i] * (p - half), hi = m[i] * (p + half);
      const truth = D[i][l] > thr;
      if (m[i] === 0) { if (truth) wrong++; continue; }
      if (lo > thr) { if (!truth) wrong++; } else if (hi <= thr) { if (truth) wrong++; } else undecided.push([i, l]);
    }
  }
  if (undecided.length) { const { rows, cols } = cover(N, undecided); mults += (rows.length + cols.length) * N * N + undecided.length * N; }
  return { ratio: mults / (2 * N ** 3), undecided: undecided.length, wrong, draws };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const N of [32, 64]) for (const kind of ["nonneg", "sparse"]) {
    const inst = data(N, kind, 21);
    for (const q of [0.5, 0.9, 0.99]) {
      const cells = [256, 4096, 65536].map(s => { const res = walks(inst, { quantile: q, perRow: s });
        return `s=${String(s).padEnd(5)} ${String(Math.round(100 * res.ratio)).padStart(3)}% mults, undecided ${String(res.undecided).padStart(4)}${res.wrong ? `, ${res.wrong} WRONG` : ""}`; });
      console.log(`N=${N} ${kind.padEnd(6)} threshold ${q * 100}th pct: ${cells.join(" | ")}`);
    }
  }
}
