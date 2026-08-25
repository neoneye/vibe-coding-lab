'use strict';

// Numerical research probe for the n-point stability functional.
//
// This file proves no zeta theorem.  It tests a concrete structural question:
// can a gap vector which minimizes one isolated n-point block be repeated
// consistently when every shifted block of a long gap chain is charged?

const SQRT2 = Math.SQRT2;

function sinOverX(x) {
  if (Math.abs(x) < 1e-7) {
    const x2 = x * x;
    return 1 - x2 / 6 + x2 * x2 / 120;
  }
  return Math.sin(x) / x;
}

// K(x) = integral_{-1/2}^{1/2} cos(sqrt(2)t) cos(2 pi x t) dt.
function mtKernel(x) {
  const b = 2 * Math.PI * x;
  return 0.5 * sinOverX((SQRT2 - b) / 2)
       + 0.5 * sinOverX((SQRT2 + b) / 2);
}

const MT_KERNEL_ZERO = mtKernel(0);

function overlapWeight(x) {
  const k = mtKernel(x) / MT_KERNEL_ZERO;
  return k * k;
}

function pointsFromGaps(gaps) {
  const pts = [0];
  for (const g of gaps) pts.push(pts[pts.length - 1] + g);
  return pts;
}

// The local F_n functional used by the stability-defect candidate family.
function blockFunctional(gaps, p = 3000) {
  const n = gaps.length + 1;
  const pts = pointsFromGaps(gaps);
  let out = gaps.reduce((a, b) => a + b, 0) / p;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      out += (2 / (n - (j - i))) * overlapWeight(pts[j] - pts[i]);
    }
  }
  return out;
}

function cyclicWindow(gaps, start, width) {
  const out = [];
  for (let j = 0; j < width; j++) out.push(gaps[(start + j) % gaps.length]);
  return out;
}

// Definition by averaging every shifted local block.
function periodicBlockAverage(gaps, n = 7, p = 3000) {
  let out = 0;
  for (let i = 0; i < gaps.length; i++) {
    out += blockFunctional(cyclicWindow(gaps, i, n - 1), p);
  }
  return out / gaps.length;
}

// Exact reindexing of periodicBlockAverage.  A pair at lag s occurs in n-s
// shifted blocks, cancelling the local coefficient denominator n-s.
function periodicChainEnergy(gaps, n = 7, p = 3000) {
  const period = gaps.length;
  const meanGap = gaps.reduce((a, b) => a + b, 0) / period;
  let out = ((n - 1) / p) * meanGap;
  for (let s = 1; s < n; s++) {
    let lagMean = 0;
    for (let i = 0; i < period; i++) {
      let distance = 0;
      for (let j = 0; j < s; j++) distance += gaps[(i + j) % period];
      lagMean += overlapWeight(distance);
    }
    out += 2 * lagMean / period;
  }
  return out;
}

// Conditional projection through the published shifted-block assembly.
// This is meaningful only if `floor` has first been proved as a uniform
// long-chain lower bound with boundary error o(number of gaps).
function projectedSimpleZeroBound(floor, n = 7, p = 3000,
    base = 0.6725007036794116457) {
  const windowsPerBlock = Math.floor((1 - 1e-12) / floor);
  const blockSize = windowsPerBlock + n - 1;
  const defectCoefficient = floor * windowsPerBlock / blockSize;
  const spanCoefficient = ((n - 1) / p) * ((blockSize - 1) / blockSize);
  return {
    windowsPerBlock,
    blockSize,
    defectCoefficient,
    spanCoefficient,
    bound: (base - spanCoefficient) / (1 - defectCoefficient)
  };
}

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// Deterministic coordinate/pair pattern search.  It is deliberately modest:
// results are numerical upper bounds on minima, never proof certificates.
function patternMinimize(fn, start, options = {}) {
  const maxGap = options.maxGap || 14;
  const tolerance = options.tolerance || 2e-6;
  let step = options.step || 1;
  let x = start.map(v => Math.max(0, Math.min(maxGap, v)));
  let value = fn(x);
  let evaluations = 1;

  while (step >= tolerance) {
    let improved = false;
    for (let i = 0; i < x.length; i++) {
      for (const sign of [-1, 1]) {
        const y = x.slice();
        y[i] = Math.max(0, Math.min(maxGap, y[i] + sign * step));
        const candidate = fn(y);
        evaluations++;
        if (candidate + 1e-15 < value) {
          x = y;
          value = candidate;
          improved = true;
        }
      }
    }
    // Coupled moves help escape coordinate-wise stalls in oscillatory lobes.
    for (let i = 0; i < x.length; i++) {
      const j = (i + 1) % x.length;
      for (const signs of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const y = x.slice();
        y[i] = Math.max(0, Math.min(maxGap, y[i] + signs[0] * step));
        y[j] = Math.max(0, Math.min(maxGap, y[j] + signs[1] * step));
        const candidate = fn(y);
        evaluations++;
        if (candidate + 1e-15 < value) {
          x = y;
          value = candidate;
          improved = true;
        }
      }
    }
    if (!improved) step *= 0.5;
  }
  return {x, value, evaluations};
}

function multiStart(fn, dimension, options = {}) {
  const starts = options.starts || 48;
  const maxGap = options.maxGap || 14;
  const random = lcg(options.seed || 0x5eed1234);
  const initial = [];
  for (const a of [0.4, 0.7, 1, 1.3, 1.7, 2.2, 3]) initial.push(new Array(dimension).fill(a));
  for (const motif of [[1.05, 2.05], [1.05, 2.05, 2.05], [1.05, 2.05, 1.05, 2.05, 2.05]]) {
    initial.push(Array.from({length: dimension}, (_, i) => motif[i % motif.length]));
  }
  while (initial.length < starts) {
    // Bias towards the normalized-spacing range while retaining long-gap starts.
    initial.push(Array.from({length: dimension}, () => maxGap * Math.pow(random(), 2)));
  }
  let best = null;
  for (const start of initial) {
    const result = patternMinimize(fn, start, options);
    if (!best || result.value < best.value) best = result;
  }
  return best;
}

// Differential evolution is used before the local pattern search because the
// overlap kernel has separated oscillatory wells.  Coordinate descent alone
// reliably finds the equal-spacing well but can miss mixed-well configurations.
function differentialEvolution(fn, dimension, options = {}) {
  const maxGap = options.maxGap || 11.4;
  const populationSize = options.populationSize || Math.max(48, 14 * dimension);
  const generations = options.generations || 900;
  const differentialWeight = options.differentialWeight || 0.78;
  const crossover = options.crossover || 0.88;
  const random = lcg(options.seed || 0xd1ff3007);
  const population = [];
  const values = [];
  const gapBands = [[0.95225, 1.1945], [1.80525, 2.34075], [2.643, maxGap]];

  for (let i = 0; i < populationSize; i++) {
    const x = [];
    for (let j = 0; j < dimension; j++) {
      if (i < populationSize * 0.75) {
        const band = gapBands[Math.floor(random() * gapBands.length)];
        x.push(band[0] + random() * (band[1] - band[0]));
      } else {
        x.push(maxGap * random());
      }
    }
    population.push(x);
    values.push(fn(x));
  }

  for (let generation = 0; generation < generations; generation++) {
    for (let i = 0; i < populationSize; i++) {
      let a, b, c;
      do { a = Math.floor(random() * populationSize); } while (a === i);
      do { b = Math.floor(random() * populationSize); } while (b === i || b === a);
      do { c = Math.floor(random() * populationSize); } while (c === i || c === a || c === b);
      const forced = Math.floor(random() * dimension);
      const trial = population[i].slice();
      for (let j = 0; j < dimension; j++) {
        if (j === forced || random() < crossover) {
          const raw = population[a][j] + differentialWeight * (population[b][j] - population[c][j]);
          // Reflection retains diversity at the nonnegative boundary.
          let v = raw;
          while (v < 0 || v > maxGap) {
            if (v < 0) v = -v;
            if (v > maxGap) v = 2 * maxGap - v;
          }
          trial[j] = v;
        }
      }
      const value = fn(trial);
      if (value < values[i]) {
        population[i] = trial;
        values[i] = value;
      }
    }
  }
  let bestIndex = 0;
  for (let i = 1; i < populationSize; i++) if (values[i] < values[bestIndex]) bestIndex = i;
  return patternMinimize(fn, population[bestIndex], {
    maxGap,
    step: 0.05,
    tolerance: options.tolerance || 2e-7
  });
}

function canonicalCyclicWord(word) {
  const variants = [];
  for (const base of [word, word.slice().reverse()]) {
    for (let shift = 0; shift < word.length; shift++) {
      variants.push(base.slice(shift).concat(base.slice(0, shift)).join(''));
    }
  }
  variants.sort();
  return variants[0];
}

// Exhaust the three gap basins retained by the original seven-point verifier.
// For periodic chains, rotation and reflection give the same energy, so only
// one representative of each bracelet is searched.
function bandBasinSearch(fn, dimension, options = {}) {
  const values = options.bandSeeds || [1.05, 2.05, 3.2];
  const periodic = !!options.periodic;
  const count = Math.pow(values.length, dimension);
  let best = null;
  let basins = 0;
  for (let code = 0; code < count; code++) {
    let rest = code;
    const digits = [];
    const start = [];
    for (let i = 0; i < dimension; i++) {
      const digit = rest % values.length;
      rest = Math.floor(rest / values.length);
      digits.push(digit);
      start.push(values[digit]);
    }
    const word = digits.join('');
    if (periodic) {
      if (word !== canonicalCyclicWord(digits)) continue;
    } else {
      const reverse = digits.slice().reverse().join('');
      if (word > reverse) continue;
    }
    basins++;
    const candidate = patternMinimize(fn, start, {
      maxGap: options.maxGap || 11.4,
      step: options.coarseStep || 0.2,
      tolerance: options.coarseTolerance || 2e-4
    });
    if (!best || candidate.value < best.value) best = candidate;
  }
  const refined = patternMinimize(fn, best.x, {
    maxGap: options.maxGap || 11.4,
    step: 0.03,
    tolerance: options.tolerance || 2e-8
  });
  return {...refined, basins};
}

function runStudy(options = {}) {
  const n = options.n || 7;
  const p = options.p || 3000;
  const localFn = g => blockFunctional(g, p);
  const localPattern = multiStart(localFn, n - 1, {
    starts: options.localStarts || 72, seed: 0x71f70001,
    step: 1, tolerance: options.tolerance || 2e-6
  });
  const localDE = differentialEvolution(localFn, n - 1, {
    seed: 0xf7000007,
    generations: options.localGenerations || 1100,
    tolerance: options.tolerance || 2e-7
  });
  const localBands = bandBasinSearch(localFn, n - 1, {
    periodic: false,
    tolerance: options.tolerance || 2e-8
  });
  const local = [localPattern, localDE, localBands].reduce((a, b) => a.value <= b.value ? a : b);
  const periods = [];
  for (let period = 1; period <= (options.maxPeriod || 8); period++) {
    const chainFn = g => periodicChainEnergy(g, n, p);
    const pattern = multiStart(chainFn, period, {
      starts: options.chainStarts || 48,
      seed: 0x71000000 + period,
      step: 1,
      tolerance: options.tolerance || 2e-6
    });
    const de = differentialEvolution(chainFn, period, {
      seed: 0xc1000000 + period,
      generations: options.chainGenerations || 650,
      populationSize: Math.max(42, 10 * period),
      tolerance: options.tolerance || 2e-7
    });
    const bands = period <= 8 ? bandBasinSearch(chainFn, period, {
      periodic: true,
      tolerance: options.tolerance || 2e-8
    }) : null;
    const best = [pattern, de, bands].filter(Boolean).reduce((a, b) => a.value <= b.value ? a : b);
    periods.push({period, ...best});
  }
  const bestPeriodic = periods.reduce((a, b) => a.value <= b.value ? a : b);
  return {
    n,
    p,
    local,
    periods,
    bestPeriodic,
    observedNonTilingGap: bestPeriodic.value - local.value
  };
}

if (require.main === module) {
  const study = runStudy();
  console.log(`isolated F${study.n}: ${study.local.value.toFixed(12)}  gaps=${study.local.x.map(x => x.toFixed(6)).join(',')}`);
  for (const row of study.periods) {
    console.log(`period ${String(row.period).padStart(2)}: ${row.value.toFixed(12)}  gaps=${row.x.map(x => x.toFixed(6)).join(',')}`);
  }
  console.log(`best periodic: ${study.bestPeriodic.value.toFixed(12)} (period ${study.bestPeriodic.period})`);
  console.log(`observed non-tiling gap: ${study.observedNonTilingGap.toExponential(6)}`);
  console.log('NUMERICAL UPPER BOUNDS ONLY — no global-optimality or zeta theorem claim');
}

module.exports = {
  mtKernel,
  overlapWeight,
  blockFunctional,
  periodicBlockAverage,
  periodicChainEnergy,
  projectedSimpleZeroBound,
  patternMinimize,
  multiStart,
  differentialEvolution,
  bandBasinSearch,
  runStudy
};
