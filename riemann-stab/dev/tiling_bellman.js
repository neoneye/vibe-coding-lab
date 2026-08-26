'use strict';

// Finite-state Bellman dual for the overlapping seven-point functional.
// A state stores five consecutive gaps.  Appending a sixth gap incurs F6 and
// shifts the state.  For any potential Phi on states,
//
//   F6(edge) + Phi(next) - Phi(state) >= c
//
// telescopes to a lower bound c on every periodic chain in the finite alphabet.
// The graph enumeration is exhaustive, but its kernel costs are floating-point
// evaluations: this remains a numerical finite-alphabet result, not a rigorous
// interval certificate and not a statement about the continuous problem.

const T = require('./tiling_research');

function decodeState(index, base, width = 5) {
  const digits = new Array(width);
  for (let i = width - 1; i >= 0; i--) {
    digits[i] = index % base;
    index = Math.floor(index / base);
  }
  return digits;
}

function buildGraph(alphabet) {
  const base = alphabet.length;
  const stateCount = Math.pow(base, 5);
  const suffixModulus = Math.pow(base, 4);
  const costs = new Float64Array(stateCount * base);
  const next = new Uint32Array(stateCount * base);
  for (let state = 0; state < stateCount; state++) {
    const digits = decodeState(state, base);
    for (let appended = 0; appended < base; appended++) {
      const edge = state * base + appended;
      const gaps = digits.concat(appended).map(i => alphabet[i]);
      costs[edge] = T.blockFunctional(gaps, 3000);
      next[edge] = (state % suffixModulus) * base + appended;
    }
  }
  return {alphabet, base, stateCount, costs, next};
}

function bellmanResidual(graph, potential) {
  let lower = Infinity;
  let upper = -Infinity;
  const minimizingEdge = new Uint32Array(graph.stateCount);
  for (let state = 0; state < graph.stateCount; state++) {
    let stateMin = Infinity;
    let bestEdge = state * graph.base;
    for (let appended = 0; appended < graph.base; appended++) {
      const edge = state * graph.base + appended;
      const reduced = graph.costs[edge] + potential[graph.next[edge]] - potential[state];
      if (reduced < lower) lower = reduced;
      if (reduced < stateMin) { stateMin = reduced; bestEdge = edge; }
    }
    if (stateMin > upper) upper = stateMin;
    minimizingEdge[state] = bestEdge;
  }
  return {lower, upper, minimizingEdge};
}

function solveBellman(alphabet, options = {}) {
  const graph = buildGraph(alphabet);
  let potential = new Float64Array(graph.stateCount);
  const iterations = options.iterations || 2000;
  let span = Infinity;
  let iteration = 0;
  for (; iteration < iterations; iteration++) {
    const nextPotential = new Float64Array(graph.stateCount);
    for (let state = 0; state < graph.stateCount; state++) {
      let best = Infinity;
      for (let appended = 0; appended < graph.base; appended++) {
        const edge = state * graph.base + appended;
        const value = graph.costs[edge] + potential[graph.next[edge]];
        if (value < best) best = value;
      }
      nextPotential[state] = best;
    }
    const shift = nextPotential[0];
    let minDelta = Infinity;
    let maxDelta = -Infinity;
    for (let state = 0; state < graph.stateCount; state++) {
      nextPotential[state] -= shift;
      const delta = nextPotential[state] - potential[state];
      if (delta < minDelta) minDelta = delta;
      if (delta > maxDelta) maxDelta = delta;
    }
    span = maxDelta - minDelta;
    potential = nextPotential;
    if (span < (options.tolerance || 2e-14)) break;
  }
  const residual = bellmanResidual(graph, potential);
  return {graph, potential, iteration: iteration + 1, span, ...residual};
}

function greedyCycle(solution, start = 0) {
  const seen = new Map();
  const states = [];
  let state = start;
  while (!seen.has(state)) {
    seen.set(state, states.length);
    states.push(state);
    state = solution.graph.next[solution.minimizingEdge[state]];
  }
  const begin = seen.get(state);
  const cycleStates = states.slice(begin);
  const appended = cycleStates.map(s => solution.minimizingEdge[s] % solution.graph.base);
  return {states: cycleStates, symbols: appended, gaps: appended.map(i => solution.graph.alphabet[i])};
}

// Walsh coefficients expose whether the binary-grid potential is mostly low order.
function walshCoefficients(potential) {
  if (potential.length !== 32) throw new Error('Walsh transform requires a binary five-gap state');
  const coefficients = new Float64Array(32);
  for (let mask = 0; mask < 32; mask++) {
    let sum = 0;
    for (let state = 0; state < 32; state++) {
      let parity = 0;
      for (let bit = 0; bit < 5; bit++) if ((mask >> bit) & 1) parity ^= (state >> bit) & 1;
      sum += (parity ? -1 : 1) * potential[state];
    }
    coefficients[mask] = sum / 32;
  }
  return coefficients;
}

function binaryMultilinearPotential(solution) {
  if (solution.graph.base !== 2) throw new Error('binary potential requires two gap values');
  const low = solution.graph.alphabet[0];
  const high = solution.graph.alphabet[1];
  const scale = high - low;
  return stateGaps => {
    if (stateGaps.length !== 5) throw new Error('potential state must contain five gaps');
    const u = stateGaps.map(g => Math.max(0, Math.min(1, (g - low) / scale)));
    let value = 0;
    for (let state = 0; state < 32; state++) {
      let weight = 1;
      for (let coordinate = 0; coordinate < 5; coordinate++) {
        const bit = (state >> (4 - coordinate)) & 1;
        weight *= bit ? u[coordinate] : (1 - u[coordinate]);
      }
      value += weight * solution.potential[state];
    }
    return value;
  };
}

function encodeState(digits, base) {
  let state = 0;
  for (const digit of digits) state = state * base + digit;
  return state;
}

function gridMultilinearPotential(solution) {
  const knots = solution.graph.alphabet;
  const base = knots.length;
  return stateGaps => {
    if (stateGaps.length !== 5) throw new Error('potential state must contain five gaps');
    const lower = [];
    const upper = [];
    const fraction = [];
    for (const gap of stateGaps) {
      if (gap <= knots[0]) {
        lower.push(0); upper.push(0); fraction.push(0);
      } else if (gap >= knots[base - 1]) {
        lower.push(base - 1); upper.push(base - 1); fraction.push(0);
      } else {
        let hi = 1;
        while (knots[hi] < gap) hi++;
        const lo = hi - 1;
        lower.push(lo); upper.push(hi);
        fraction.push((gap - knots[lo]) / (knots[hi] - knots[lo]));
      }
    }
    let value = 0;
    for (let corner = 0; corner < 32; corner++) {
      const digits = [];
      let weight = 1;
      for (let coordinate = 0; coordinate < 5; coordinate++) {
        if ((corner >> coordinate) & 1) {
          digits.push(upper[coordinate]);
          weight *= fraction[coordinate];
        } else {
          digits.push(lower[coordinate]);
          weight *= 1 - fraction[coordinate];
        }
      }
      if (weight) value += weight * solution.potential[encodeState(digits, base)];
    }
    return value;
  };
}

function truncatedWalshPotential(solution, maxDegree = 2, scale = 1) {
  if (solution.graph.base !== 2) throw new Error('Walsh potential requires two gap values');
  const coefficients = walshCoefficients(solution.potential);
  const low = solution.graph.alphabet[0];
  const high = solution.graph.alphabet[1];
  const midpoint = (low + high) / 2;
  const halfWidth = (high - low) / 2;
  const terms = [];
  for (let mask = 1; mask < 32; mask++) {
    let degree = 0;
    for (let bit = 0; bit < 5; bit++) degree += (mask >> bit) & 1;
    if (degree <= maxDegree) terms.push({mask, coefficient: scale * coefficients[mask]});
  }
  return stateGaps => {
    const z = stateGaps.map(g => Math.max(-1, Math.min(1, (midpoint - g) / halfWidth)));
    let value = 0;
    for (const term of terms) {
      let product = 1;
      for (let bit = 0; bit < 5; bit++) {
        if ((term.mask >> bit) & 1) product *= z[4 - bit];
      }
      value += term.coefficient * product;
    }
    return value;
  };
}

function binaryCoordinate(gap, low = 1.041680, high = 1.979467) {
  return Math.max(-1, Math.min(1, ((low + high) / 2 - gap) / ((high - low) / 2)));
}

function degreeOneEdgeCoefficients(solution, scale = 1) {
  const coefficients = walshCoefficients(solution.potential);
  const stateWeights = new Array(5);
  for (let coordinate = 0; coordinate < 5; coordinate++) {
    const mask = 1 << (4 - coordinate);
    stateWeights[coordinate] = scale * coefficients[mask];
  }
  return [
    -stateWeights[0],
    stateWeights[0] - stateWeights[1],
    stateWeights[1] - stateWeights[2],
    stateWeights[2] - stateWeights[3],
    stateWeights[3] - stateWeights[4],
    stateWeights[4]
  ];
}

function linearReducedCost(gaps, edgeCoefficients) {
  let value = T.blockFunctional(gaps, 3000);
  for (let i = 0; i < 6; i++) value += edgeCoefficients[i] * binaryCoordinate(gaps[i]);
  return value;
}

function walshMasks(maxDegree) {
  const masks = [];
  for (let mask = 1; mask < 32; mask++) {
    let degree = 0;
    for (let bit = 0; bit < 5; bit++) degree += (mask >> bit) & 1;
    if (degree <= maxDegree) masks.push(mask);
  }
  return masks;
}

function walshStateFeatures(stateGaps, masks) {
  const z = stateGaps.map(x => binaryCoordinate(x));
  return masks.map(mask => {
    let product = 1;
    for (let bit = 0; bit < 5; bit++) {
      if ((mask >> bit) & 1) product *= z[4 - bit];
    }
    return product;
  });
}

function walshEdgeFeatures(gaps, masks) {
  const before = walshStateFeatures(gaps.slice(0, 5), masks);
  const after = walshStateFeatures(gaps.slice(1), masks);
  return after.map((value, i) => value - before[i]);
}

function walshReducedCost(gaps, coefficients, masks) {
  const features = walshEdgeFeatures(gaps, masks);
  let value = T.blockFunctional(gaps, 3000);
  for (let i = 0; i < masks.length; i++) value += coefficients[i] * features[i];
  return value;
}

function adversarialWalshBlock(coefficients, masks, options = {}) {
  const objective = gaps => walshReducedCost(gaps, coefficients, masks);
  const bands = T.bandBasinSearch(objective, 6, {
    periodic: false,
    reflectionSymmetry: false,
    coarseTolerance: options.coarseTolerance || 5e-4,
    tolerance: options.tolerance || 5e-7
  });
  if (options.skipDE) return bands;
  const de = T.differentialEvolution(objective, 6, {
    seed: options.seed || 0xd2000001,
    generations: options.generations || 600,
    populationSize: options.populationSize || 100,
    tolerance: options.tolerance || 5e-7
  });
  return bands.value <= de.value ? bands : de;
}

// Concave max-min search over clipped Walsh state potentials.  This is a
// discovery procedure: only a subsequent global interval audit could turn a
// returned coefficient vector into a continuous coboundary certificate.
function optimizeWalshCoboundary(options = {}) {
  const maxDegree = options.maxDegree || 2;
  const masks = walshMasks(maxDegree);
  const solution = solveBellman([1.041680, 1.979467]);
  const discreteWalsh = walshCoefficients(solution.potential);
  let coefficients = masks.map(mask => (options.initialScale || 0.2) * discreteWalsh[mask]);
  let best = null;
  const history = [];
  const cycleUpperBound = 0.003957393309;
  for (let iteration = 0; iteration < (options.iterations || 160); iteration++) {
    const adversary = adversarialWalshBlock(coefficients, masks, {
      seed: 0xd2000000 + iteration,
      generations: options.generations || 500,
      skipDE: iteration > 3
    });
    if (!best || adversary.value > best.value) {
      best = {value: adversary.value, coefficients: coefficients.slice(), gaps: adversary.x.slice()};
    }
    history.push({iteration, value: adversary.value});
    const features = walshEdgeFeatures(adversary.x, masks);
    const squaredNorm = features.reduce((sum, x) => sum + x * x, 0);
    // Polyak's step uses the known period-two energy as an upper bound on the
    // best possible coboundary floor.  This is much less oscillatory than a
    // fixed learning rate near the nonsmooth max-min optimum.
    const rate = squaredNorm > 1e-16
      ? (options.polyakFactor || 0.55) * Math.max(0, cycleUpperBound - adversary.value) / squaredNorm
      : 0;
    for (let i = 0; i < coefficients.length; i++) coefficients[i] += rate * features[i];
  }
  const audit = adversarialWalshBlock(best.coefficients, masks, {
    seed: 0xd2ffffff,
    generations: 2400,
    populationSize: 220,
    tolerance: 2e-8,
    coarseTolerance: 1e-4
  });
  return {masks, best: {...best, auditValue: audit.value, auditGaps: audit.x}, history};
}

function adversarialLinearBlock(edgeCoefficients, options = {}) {
  const objective = gaps => linearReducedCost(gaps, edgeCoefficients);
  const bands = T.bandBasinSearch(objective, 6, {
    periodic: false,
    // The edge coefficients are oriented, so reversing a gap word is not a
    // symmetry of the reduced cost even though it is a symmetry of F6.
    reflectionSymmetry: false,
    coarseTolerance: options.coarseTolerance || 4e-4,
    tolerance: options.tolerance || 4e-7
  });
  const de = T.differentialEvolution(objective, 6, {
    seed: options.seed || 0xad000001,
    generations: options.generations || 500,
    populationSize: options.populationSize || 90,
    tolerance: options.tolerance || 4e-7
  });
  return bands.value <= de.value ? bands : de;
}

function optimizeLinearCoboundary(options = {}) {
  const solution = solveBellman([1.041680, 1.979467]);
  let coefficients = degreeOneEdgeCoefficients(solution, options.initialScale || 0.2);
  let best = null;
  const history = [];
  for (let iteration = 0; iteration < (options.iterations || 36); iteration++) {
    const adversary = adversarialLinearBlock(coefficients, {
      seed: 0xad000000 + iteration,
      generations: options.generations || 420
    });
    if (!best || adversary.value > best.value) best = {value: adversary.value, coefficients: coefficients.slice(), gaps: adversary.x};
    history.push({iteration, value: adversary.value, coefficients: coefficients.slice(), gaps: adversary.x});
    const z = adversary.x.map(x => binaryCoordinate(x));
    const mean = z.reduce((a, b) => a + b, 0) / z.length;
    const rate = (options.learningRate || 0.000055) / Math.sqrt(1 + iteration / 4);
    for (let i = 0; i < 6; i++) coefficients[i] += rate * (z[i] - mean);
    // Numerical projection to the telescoping subspace sum b_i = 0.
    const drift = coefficients.reduce((a, b) => a + b, 0) / 6;
    for (let i = 0; i < 6; i++) coefficients[i] -= drift;
  }
  // Re-audit the best coefficients with a stronger oracle.
  const audit = adversarialLinearBlock(best.coefficients, {
    seed: 0xadffffff,
    generations: 1800,
    populationSize: 180,
    tolerance: 2e-8,
    coarseTolerance: 2e-4
  });
  return {best: {...best, auditValue: audit.value, auditGaps: audit.x}, history};
}

function searchWalshFamily(options = {}) {
  const solution = solveBellman([1.041680, 1.979467]);
  const rows = [];
  for (const degree of (options.degrees || [1, 2, 3, 4, 5])) {
    for (const scale of (options.scales || [0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 1])) {
      const potential = truncatedWalshPotential(solution, degree, scale);
      const objective = gaps => reducedBlockCost(gaps, potential);
      const bands = T.bandBasinSearch(objective, 6, {
        periodic: false, reflectionSymmetry: false, tolerance: 2e-7
      });
      const de = T.differentialEvolution(objective, 6, {
        seed: 0xface0000 + degree * 101 + Math.round(scale * 100),
        generations: options.generations || 700,
        populationSize: 100,
        tolerance: 2e-7
      });
      const best = bands.value <= de.value ? bands : de;
      rows.push({degree, scale, value: best.value, gaps: best.x});
    }
  }
  rows.sort((a, b) => b.value - a.value);
  return rows;
}

function reducedBlockCost(gaps, potential) {
  if (gaps.length !== 6) throw new Error('reduced seven-point block requires six gaps');
  return T.blockFunctional(gaps, 3000)
    + potential(gaps.slice(1)) - potential(gaps.slice(0, 5));
}

function searchContinuousReducedCost(options = {}) {
  const alphabet = options.alphabet || [1.041680, 1.979467];
  const solution = solveBellman(alphabet, {iterations: options.bellmanIterations || 3000});
  const potential = alphabet.length === 2
    ? binaryMultilinearPotential(solution) : gridMultilinearPotential(solution);
  const objective = gaps => reducedBlockCost(gaps, potential);
  const bands = T.bandBasinSearch(objective, 6, {
    periodic: false,
    reflectionSymmetry: false,
    tolerance: 2e-8
  });
  const de = T.differentialEvolution(objective, 6, {
    seed: 0xc0b0da7a,
    generations: options.generations || 1800,
    populationSize: options.populationSize || 160,
    tolerance: 2e-8
  });
  return {solution, potential, best: bands.value <= de.value ? bands : de};
}

if (require.main === module) {
  if (process.argv.includes('--walsh-opt')) {
    const degreeArg = process.argv.find(x => x.startsWith('--degree='));
    const maxDegree = degreeArg ? Number(degreeArg.slice('--degree='.length)) : 2;
    const result = optimizeWalshCoboundary({maxDegree});
    for (const row of result.history) {
      console.log(`iter=${String(row.iteration).padStart(2)} adversary=${row.value.toFixed(12)}`);
    }
    console.log(`best training adversary: ${result.best.value.toFixed(12)}`);
    console.log(`strong audit adversary: ${result.best.auditValue.toFixed(12)}`);
    console.log(`audit gaps: ${result.best.auditGaps.map(x => x.toFixed(8)).join(',')}`);
    console.log(`masks: ${result.masks.join(',')}`);
    console.log(`coefficients: ${result.best.coefficients.map(x => x.toExponential(17)).join(',')}`);
    console.log('WALSH COBOUNDARY MAX-MIN — numerical oracle only');
    process.exit(0);
  }
  if (process.argv.includes('--linear-opt')) {
    const result = optimizeLinearCoboundary();
    for (const row of result.history) {
      console.log(`iter=${String(row.iteration).padStart(2)} adversary=${row.value.toFixed(12)} coeff=${row.coefficients.map(x => x.toExponential(3)).join(',')}`);
    }
    console.log(`best training adversary: ${result.best.value.toFixed(12)}`);
    console.log(`strong audit adversary: ${result.best.auditValue.toFixed(12)}`);
    console.log(`audit gaps: ${result.best.auditGaps.map(x => x.toFixed(8)).join(',')}`);
    console.log('LINEAR COBOUNDARY MAX-MIN — numerical oracle only');
    process.exit(0);
  }
  if (process.argv.includes('--fit')) {
    const rows = searchWalshFamily();
    for (const row of rows.slice(0, 12)) {
      console.log(`degree=${row.degree} scale=${row.scale.toFixed(2)} worst-candidate=${row.value.toFixed(12)} gaps=${row.gaps.map(x => x.toFixed(5)).join(',')}`);
    }
    console.log('WALSH FAMILY SEARCH — numerical minimization only');
    process.exit(0);
  }
  if (process.argv.includes('--continuous')) {
    const broad = process.argv.includes('--broad');
    const result = searchContinuousReducedCost({
      alphabet: broad ? [0, 0.6, 0.95, 1.04, 1.2, 1.8, 1.98, 2.35, 3.0, 5.0, 11.4] : undefined,
      bellmanIterations: broad ? 80 : 3000,
      generations: broad ? 2200 : 1800
    });
    console.log(`continuous reduced-cost candidate: ${result.best.value.toFixed(12)}`);
    console.log(`gaps: ${result.best.x.map(x => x.toFixed(9)).join(',')}`);
    console.log('CLIPPED MULTILINEAR COBOUNDARY — numerical search, not interval proof');
    process.exit(0);
  }
  const alphabet = process.argv.includes('--broad')
    ? [0.98, 1.04, 1.10, 1.88, 1.98, 2.08, 2.24, 3.0]
    : [1.041680, 1.979467];
  const solution = solveBellman(alphabet, {iterations: process.argv.includes('--broad') ? 500 : 3000});
  const cycle = greedyCycle(solution);
  console.log(`alphabet size: ${alphabet.length}; states: ${solution.graph.stateCount}`);
  console.log(`Bellman iterations: ${solution.iteration}; residual span: ${solution.span.toExponential(3)}`);
  console.log(`discrete coboundary lower bound: ${solution.lower.toFixed(12)}`);
  console.log(`statewise Bellman upper: ${solution.upper.toFixed(12)}`);
  console.log(`greedy cycle gaps: ${cycle.gaps.map(x => x.toFixed(6)).join(',')}`);
  if (alphabet.length === 2) {
    const walsh = Array.from(walshCoefficients(solution.potential))
      .map((value, mask) => ({mask, degree: mask.toString(2).split('1').length - 1, value}))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    console.log('largest Walsh terms:');
    for (const row of walsh.slice(0, 12)) {
      console.log(`  mask=${row.mask.toString(2).padStart(5, '0')} degree=${row.degree} coeff=${row.value.toExponential(6)}`);
    }
  }
  console.log('DISCRETE ALPHABET ONLY — not a continuous certificate');
}

module.exports = {
  decodeState, buildGraph, bellmanResidual, solveBellman, greedyCycle,
  walshCoefficients, binaryMultilinearPotential, reducedBlockCost,
  gridMultilinearPotential, truncatedWalshPotential, searchContinuousReducedCost,
  searchWalshFamily, binaryCoordinate, degreeOneEdgeCoefficients,
  linearReducedCost, adversarialLinearBlock, optimizeLinearCoboundary,
  walshMasks, walshStateFeatures, walshEdgeFeatures, walshReducedCost,
  adversarialWalshBlock, optimizeWalshCoboundary
};
