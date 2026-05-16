import { cabs2, cadd, cconj, cmul } from './complex.js';

const EPS = 1e-12;

function zeroMatrix(dim) {
  return Array.from({ length: dim }, () => Array.from({ length: dim }, () => [0, 0]));
}

function cleanNumber(value, epsilon = 1e-10) {
  if (!Number.isFinite(value)) return null;
  return Math.abs(value) < epsilon ? 0 : value;
}

function clamp01(value) {
  if (value < 0 && value > -1e-9) return 0;
  if (value > 1 && value < 1 + 1e-9) return 1;
  return value;
}

function compactIndex(index, qubits) {
  let compact = 0;
  for (let i = 0; i < qubits.length; i++) {
    compact |= ((index >> qubits[i]) & 1) << i;
  }
  return compact;
}

function sameTracedBits(a, b, keepSet, nQubits) {
  for (let q = 0; q < nQubits; q++) {
    if (keepSet.has(q)) continue;
    if (((a >> q) & 1) !== ((b >> q) & 1)) return false;
  }
  return true;
}

function traceProductReal(a, b) {
  const dim = a.length;
  let total = [0, 0];
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      total = cadd(total, cmul(a[i][j], b[j][i]));
    }
  }
  return cleanNumber(total[0]);
}

function realSymmetricEigenvalues(matrix) {
  const n = matrix.length;
  const a = matrix.map((row) => row.slice());
  const maxIterations = Math.max(32, n * n * 32);

  for (let iter = 0; iter < maxIterations; iter++) {
    let p = 0;
    let q = 1;
    let max = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const value = Math.abs(a[i][j]);
        if (value > max) {
          max = value;
          p = i;
          q = j;
        }
      }
    }

    if (max < 1e-12) break;

    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    const theta = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    for (let k = 0; k < n; k++) {
      if (k === p || k === q) continue;
      const akp = a[k][p];
      const akq = a[k][q];
      a[k][p] = c * akp - s * akq;
      a[p][k] = a[k][p];
      a[k][q] = s * akp + c * akq;
      a[q][k] = a[k][q];
    }

    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = 0;
    a[q][p] = 0;
  }

  return a.map((row, i) => row[i]).sort((x, y) => y - x);
}

function hermitianToRealSymmetric(rho) {
  const dim = rho.length;
  const real = Array.from({ length: dim * 2 }, () => Array.from({ length: dim * 2 }, () => 0));

  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      const [re, im] = rho[i][j];
      real[i][j] = re;
      real[i][j + dim] = -im;
      real[i + dim][j] = im;
      real[i + dim][j + dim] = re;
    }
  }

  return real;
}

function parsePauliTerm(term) {
  const normalized = String(term)
    .replace(/[<>\s]/g, '')
    .toUpperCase();
  const matches = [...normalized.matchAll(/([XYZ])(\d+)/g)];
  if (!matches.length || matches.map((m) => m[0]).join('') !== normalized) return null;
  return matches.map((match) => ({ pauli: match[1], qubit: Number(match[2]) }));
}

function applyPauliToBasis(index, ops) {
  let target = index;
  let phase = [1, 0];

  for (const { pauli, qubit } of ops) {
    const bit = (target >> qubit) & 1;
    if (pauli === 'X') {
      target ^= 1 << qubit;
    } else if (pauli === 'Y') {
      phase = cmul(phase, bit ? [0, -1] : [0, 1]);
      target ^= 1 << qubit;
    } else if (pauli === 'Z' && bit) {
      phase = cmul(phase, [-1, 0]);
    }
  }

  return { target, phase };
}

export function stateNorm(state) {
  return state.reduce((sum, amp) => sum + cabs2(amp), 0);
}

export function stateVectorToDensityMatrix(state) {
  const dim = state.length;
  const rho = zeroMatrix(dim);

  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      rho[i][j] = cmul(state[i], cconj(state[j]));
    }
  }

  return rho;
}

export function densityTrace(rho) {
  return cleanNumber(rho.reduce((sum, row, i) => sum + row[i][0], 0));
}

export function partialTrace(rho, nQubits, keepQubits) {
  const keep = [...keepQubits].sort((a, b) => a - b);
  const keepSet = new Set(keep);
  const dim = 1 << nQubits;
  const reducedDim = 1 << keep.length;
  const reduced = zeroMatrix(reducedDim);

  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      if (!sameTracedBits(i, j, keepSet, nQubits)) continue;
      const ri = compactIndex(i, keep);
      const rj = compactIndex(j, keep);
      reduced[ri][rj] = cadd(reduced[ri][rj], rho[i][j]);
    }
  }

  return reduced;
}

export function densityMatrixPurity(rho) {
  return clamp01(cleanNumber(traceProductReal(rho, rho)));
}

export function linearEntropy(rho) {
  return cleanNumber(1 - densityMatrixPurity(rho));
}

export function hermitianEigenvalues(rho) {
  const doubled = realSymmetricEigenvalues(hermitianToRealSymmetric(rho));
  const values = [];

  for (let i = 0; i < rho.length; i++) {
    const paired = (doubled[i * 2] + doubled[i * 2 + 1]) / 2;
    values.push(clamp01(cleanNumber(paired)));
  }

  return values.sort((a, b) => b - a);
}

export function vonNeumannEntropy(rho) {
  return cleanNumber(
    hermitianEigenvalues(rho).reduce((entropy, lambda) => {
      if (lambda <= EPS) return entropy;
      return entropy - lambda * Math.log2(lambda);
    }, 0)
  );
}

export function blochVectorFromDensity(rho) {
  if (rho.length !== 2) return null;
  const x = cleanNumber(2 * rho[1][0][0]);
  const y = cleanNumber(2 * rho[1][0][1]);
  const z = cleanNumber(rho[0][0][0] - rho[1][1][0]);
  return {
    x,
    y,
    z,
    theta: Math.acos(Math.max(-1, Math.min(1, z))),
    phi: Math.atan2(y, x),
  };
}

export function pauliExpectation(stateOrRho, nQubits, term) {
  const ops = parsePauliTerm(term);
  if (!ops || ops.some(({ qubit }) => qubit < 0 || qubit >= nQubits)) return null;

  const dim = 1 << nQubits;
  const isDensity = Array.isArray(stateOrRho?.[0]?.[0]);
  let total = [0, 0];

  for (let i = 0; i < dim; i++) {
    const { target, phase } = applyPauliToBasis(i, ops);
    const contribution = isDensity
      ? cmul(stateOrRho[i][target], phase)
      : cmul(cconj(stateOrRho[target]), cmul(phase, stateOrRho[i]));
    total = cadd(total, contribution);
  }

  return cleanNumber(total[0]);
}

export function defaultExpectationTerms(nQubits) {
  const terms = [];
  for (let q = 0; q < nQubits; q++) {
    terms.push(`X${q}`, `Y${q}`, `Z${q}`);
  }
  for (let q = 0; q < nQubits - 1; q++) {
    terms.push(`Z${q}Z${q + 1}`);
  }
  return terms;
}

export function createBasisState(nQubits, index = 0) {
  const dim = 1 << nQubits;
  return Array.from({ length: dim }, (_, i) => (i === index ? [1, 0] : [0, 0]));
}

export function createBellState() {
  const s = 1 / Math.sqrt(2);
  return [
    [s, 0],
    [0, 0],
    [0, 0],
    [s, 0],
  ];
}

export function createGhzState(nQubits) {
  const dim = 1 << nQubits;
  const s = 1 / Math.sqrt(2);
  return Array.from({ length: dim }, (_, i) => (i === 0 || i === dim - 1 ? [s, 0] : [0, 0]));
}

export function getAvailableReferenceStates(nQubits) {
  return [
    { key: 'auto', label: 'Auto reference' },
    { key: 'zero', label: '|0...0>' },
    ...(nQubits === 2 ? [{ key: 'bell', label: 'Bell |Phi+>' }] : []),
    ...(nQubits >= 3 ? [{ key: 'ghz', label: 'GHZ' }] : []),
  ];
}

export function resolveReferenceKey(reference, nQubits) {
  if (reference && reference !== 'auto') return reference;
  if (nQubits === 2) return 'bell';
  if (nQubits >= 3) return 'ghz';
  return 'zero';
}

export function referenceStateForKey(reference, nQubits) {
  const key = resolveReferenceKey(reference, nQubits);
  if (key === 'zero') return createBasisState(nQubits, 0);
  if (key === 'bell' && nQubits === 2) return createBellState();
  if (key === 'ghz' && nQubits >= 3) return createGhzState(nQubits);
  return null;
}

export function stateVectorFidelity(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let overlap = [0, 0];
  for (let i = 0; i < a.length; i++) {
    overlap = cadd(overlap, cmul(cconj(a[i]), b[i]));
  }
  return clamp01(cleanNumber(cabs2(overlap)));
}

export function fidelityToPureState(stateOrRho, referenceState) {
  if (!stateOrRho || !referenceState) return null;
  const isDensity = Array.isArray(stateOrRho?.[0]?.[0]);
  if (!isDensity) return stateVectorFidelity(stateOrRho, referenceState);

  let total = [0, 0];
  for (let i = 0; i < referenceState.length; i++) {
    for (let j = 0; j < referenceState.length; j++) {
      total = cadd(total, cmul(cconj(referenceState[i]), cmul(stateOrRho[i][j], referenceState[j])));
    }
  }
  return clamp01(cleanNumber(total[0]));
}

export function densityMatrixFidelity(rho, sigma) {
  if (!rho || !sigma || rho.length !== sigma.length) return null;
  if (rho.length === 2) {
    const overlap = traceProductReal(rho, sigma);
    const detRho = rho[0][0][0] * rho[1][1][0] - cabs2(rho[0][1]);
    const detSigma = sigma[0][0][0] * sigma[1][1][0] - cabs2(sigma[0][1]);
    return clamp01(cleanNumber(overlap + 2 * Math.sqrt(Math.max(0, detRho * detSigma))));
  }
  return null;
}

export function buildAnalysisSummary({
  state = null,
  densityMatrix = null,
  nQubits,
  expectations = null,
  reducedQubits = null,
  reference = 'auto',
} = {}) {
  if (!nQubits || (!state && !densityMatrix)) return null;

  const rho = densityMatrix ?? stateVectorToDensityMatrix(state);
  const selectedQubits = reducedQubits ?? Array.from({ length: nQubits }, (_, q) => q);
  const referenceState = referenceStateForKey(reference, nQubits);
  const selectedReference = resolveReferenceKey(reference, nQubits);
  const dim = 1 << nQubits;

  const reducedStates = selectedQubits.map((qubit) => {
    const reduced = partialTrace(rho, nQubits, [qubit]);
    return {
      qubit,
      qubits: [qubit],
      densityMatrix: reduced,
      probabilities: [cleanNumber(reduced[0][0][0]), cleanNumber(reduced[1][1][0])],
      bloch: blochVectorFromDensity(reduced),
      purity: densityMatrixPurity(reduced),
      linearEntropy: linearEntropy(reduced),
      entropy: vonNeumannEntropy(reduced),
    };
  });

  const terms = expectations ?? defaultExpectationTerms(nQubits);
  const expectationValues = terms.map((term) => ({
    term,
    label: `<${term}>`,
    value: pauliExpectation(densityMatrix ?? state, nQubits, term),
  }));

  return {
    nQubits,
    dim,
    norm: state ? cleanNumber(stateNorm(state)) : densityTrace(rho),
    purity: densityMatrixPurity(rho),
    linearEntropy: linearEntropy(rho),
    entropy: state ? 0 : dim <= 4 ? vonNeumannEntropy(rho) : null,
    entropyNote: !state && dim > 4 ? 'Global entropy is shown for 1-2 qubit density matrices.' : null,
    reducedStates,
    expectations: expectationValues,
    referenceOptions: getAvailableReferenceStates(nQubits),
    fidelity: referenceState
      ? {
          reference: selectedReference,
          value: fidelityToPureState(densityMatrix ?? state, referenceState),
        }
      : null,
  };
}
