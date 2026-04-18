/**
 * Density Matrix Engine
 *
 * Represents a mixed quantum state as a 2^n × 2^n complex matrix ρ.
 * Each element is a [re, im] tuple, matching the complex.js convention.
 *
 * Used for noisy simulation via Kraus operator formalism:
 *   ρ → Σ_k K_k ρ K_k†
 *
 * Qubit ordering matches simulator.js: little-endian (qubit 0 = LSB).
 */

import { cadd, cmul, cscale } from './complex.js';

// Initialization

/**
 * Create ρ = |0⟩⟨0| for an n-qubit system.
 * Returns a 2^n × 2^n matrix, each entry a [re, im] tuple.
 */
export function createDensityMatrix(nQubits) {
  const dim = 1 << nQubits;
  const rho = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: dim }, (_, j) => (i === 0 && j === 0 ? [1, 0] : [0, 0]))
  );
  return rho;
}

// Gate Application

/**
 * Apply a single-qubit unitary U to qubit `qubit`: ρ → UρU†
 *
 * @param {Array}  rho       - Density matrix
 * @param {Array}  gate      - 2×2 complex gate matrix [[row0], [row1]]
 * @param {number} qubit     - Target qubit index (or use targetQubits[0])
 * @param {number} nQubits   - Total qubits
 */
export function applyGateDM(rho, gate, qubit, nQubits) {
  const dim = 1 << nQubits;
  const q = Array.isArray(qubit) ? qubit[0] : qubit;

  // Precompute conjugates for the right-multiply step
  const g00 = gate[0][0], g01 = gate[0][1];
  const g10 = gate[1][0], g11 = gate[1][1];
  const g00c = [g00[0], -g00[1]];
  const g01c = [g01[0], -g01[1]];
  const g10c = [g10[0], -g10[1]];
  const g11c = [g11[0], -g11[1]];

  // Step 1 — left multiply: temp = U · rho
  const temp = rho.map(row => row.map(c => [c[0], c[1]]));
  for (let i = 0; i < dim; i++) {
    if ((i >> q) & 1) continue;          // process each pair once (i0 = i)
    const i1 = i | (1 << q);
    for (let j = 0; j < dim; j++) {
      const a = rho[i][j], b = rho[i1][j];
      temp[i][j]  = cadd(cmul(g00, a), cmul(g01, b));
      temp[i1][j] = cadd(cmul(g10, a), cmul(g11, b));
    }
  }

  // Step 2 — right multiply: result = temp · U†
  // (U†)[k][j] = conj(U[j][k])
  // result[i][j0] = temp[i][j0]·conj(g00) + temp[i][j1]·conj(g01)
  // result[i][j1] = temp[i][j0]·conj(g10) + temp[i][j1]·conj(g11)
  const result = temp.map(row => row.map(c => [c[0], c[1]]));
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      if ((j >> q) & 1) continue;
      const j1 = j | (1 << q);
      const a = temp[i][j], b = temp[i][j1];
      result[i][j]  = cadd(cmul(g00c, a), cmul(g01c, b));
      result[i][j1] = cadd(cmul(g10c, a), cmul(g11c, b));
    }
  }

  return result;
}

/**
 * Apply a CNOT gate to the density matrix: ρ → CNOT ρ CNOT
 * CNOT is Hermitian, so U† = U.
 */
export function applyCNOT_DM(rho, control, target, nQubits) {
  return _applyPermDM(rho, nQubits, i =>
    ((i >> control) & 1) ? i ^ (1 << target) : i
  );
}

/**
 * Apply a SWAP gate via three-CNOT decomposition.
 */
export function applySWAP_DM(rho, q1, q2, nQubits) {
  let r = applyCNOT_DM(rho, q1, q2, nQubits);
  r = applyCNOT_DM(r, q2, q1, nQubits);
  return applyCNOT_DM(r, q1, q2, nQubits);
}

/**
 * Apply a controlled single-qubit gate: gate applied to target when control = |1⟩.
 * Used for CZ, CS, CT.
 */
export function applyControlledGate_DM(rho, gate, control, target, nQubits) {
  const dim = 1 << nQubits;
  const g00 = gate[0][0], g01 = gate[0][1];
  const g10 = gate[1][0], g11 = gate[1][1];
  const g00c = [g00[0], -g00[1]];
  const g01c = [g01[0], -g01[1]];
  const g10c = [g10[0], -g10[1]];
  const g11c = [g11[0], -g11[1]];

  // Left multiply — only act when control bit = 1
  const temp = rho.map(row => row.map(c => [c[0], c[1]]));
  for (let i = 0; i < dim; i++) {
    if (!((i >> control) & 1)) continue;  // skip control=0 rows
    if ((i >> target) & 1) continue;      // process each pair once
    const i1 = i | (1 << target);
    for (let j = 0; j < dim; j++) {
      const a = rho[i][j], b = rho[i1][j];
      temp[i][j]  = cadd(cmul(g00, a), cmul(g01, b));
      temp[i1][j] = cadd(cmul(g10, a), cmul(g11, b));
    }
  }

  // Right multiply — only act when control bit = 1
  const result = temp.map(row => row.map(c => [c[0], c[1]]));
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      if (!((j >> control) & 1)) continue;
      if ((j >> target) & 1) continue;
      const j1 = j | (1 << target);
      const a = temp[i][j], b = temp[i][j1];
      result[i][j]  = cadd(cmul(g00c, a), cmul(g01c, b));
      result[i][j1] = cadd(cmul(g10c, a), cmul(g11c, b));
    }
  }

  return result;
}

/**
 * Apply Toffoli (CCX) gate: flip target when c1 and c2 are both |1⟩.
 */
export function applyToffoli_DM(rho, c1, c2, target, nQubits) {
  return _applyPermDM(rho, nQubits, i =>
    (((i >> c1) & 1) && ((i >> c2) & 1)) ? i ^ (1 << target) : i
  );
}

/**
 * Apply CSWAP (Fredkin) gate: swap t1 and t2 when control = |1⟩.
 */
export function applyCSWAP_DM(rho, control, t1, t2, nQubits) {
  return _applyPermDM(rho, nQubits, i => {
    if (!((i >> control) & 1)) return i;
    const b1 = (i >> t1) & 1, b2 = (i >> t2) & 1;
    if (b1 === b2) return i;
    return i ^ (1 << t1) ^ (1 << t2);
  });
}

/** Helper: apply a permutation P to a density matrix as ρ → P ρ P† = P ρ P^T */
function _applyPermDM(rho, nQubits, permFn) {
  const dim = 1 << nQubits;
  const result = Array.from({ length: dim }, () =>
    Array.from({ length: dim }, () => [0, 0])
  );
  for (let i = 0; i < dim; i++) {
    const pi = permFn(i);
    for (let j = 0; j < dim; j++) {
      result[pi][permFn(j)] = [rho[i][j][0], rho[i][j][1]];
    }
  }
  return result;
}

// Kraus / Noise Channels

/**
 * Apply a noise channel via Kraus operators to qubit `targetQubit`.
 *   ρ → Σ_k K_k ρ K_k†
 *
 * @param {Array}  rho        - Current density matrix
 * @param {Array}  krausOps   - Array of 2×2 complex Kraus matrices
 * @param {number} targetQubit
 * @param {number} nQubits
 */
export function applyKraus(rho, krausOps, targetQubit, nQubits) {
  const dim = 1 << nQubits;
  const result = Array.from({ length: dim }, () =>
    Array.from({ length: dim }, () => [0, 0])
  );
  for (const K of krausOps) {
    const contrib = applyGateDM(rho, K, targetQubit, nQubits);
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        result[i][j] = cadd(result[i][j], contrib[i][j]);
      }
    }
  }
  return result;
}

/**
 * Depolarizing channel — equal probability of X, Y, Z errors.
 *   K0 = √(1-p)·I,  K1 = √(p/3)·X,  K2 = √(p/3)·Y,  K3 = √(p/3)·Z
 */
export function depolarizingChannel(p) {
  const s0 = Math.sqrt(1 - p);
  const s1 = Math.sqrt(p / 3);
  return [
    [[[s0, 0], [0, 0]], [[0, 0], [s0, 0]]],          // √(1-p)·I
    [[[0, 0], [s1, 0]], [[s1, 0], [0, 0]]],           // √(p/3)·X
    [[[0, 0], [0, -s1]], [[0, s1], [0, 0]]],          // √(p/3)·Y
    [[[s1, 0], [0, 0]], [[0, 0], [-s1, 0]]],          // √(p/3)·Z
  ];
}

/**
 * Amplitude damping channel — models energy relaxation (T1 decay).
 *   K0 = [[1,0],[0,√(1-γ)]],  K1 = [[0,√γ],[0,0]]
 */
export function amplitudeDampingChannel(gamma) {
  const s = Math.sqrt(gamma);
  const t = Math.sqrt(1 - gamma);
  return [
    [[[1, 0], [0, 0]], [[0, 0], [t, 0]]],            // K0
    [[[0, 0], [s, 0]], [[0, 0], [0, 0]]],             // K1
  ];
}

/**
 * Phase flip channel — models dephasing (T2 decay).
 *   K0 = √(1-p)·I,  K1 = √p·Z
 */
export function phaseFlipChannel(p) {
  const s0 = Math.sqrt(1 - p);
  const s1 = Math.sqrt(p);
  return [
    [[[s0, 0], [0, 0]], [[0, 0], [s0, 0]]],          // √(1-p)·I
    [[[s1, 0], [0, 0]], [[0, 0], [-s1, 0]]],          // √p·Z
  ];
}

// Measurement

/**
 * Measure a single qubit on the density matrix.
 *
 * Returns both post-measurement density matrices without randomly collapsing,
 * so the caller can sample an outcome and pick the collapsed state.
 *
 * @returns {{ prob0, prob1, collapsed0, collapsed1 }}
 */
export function measureDM(rho, qubitIndex, nQubits) {
  const dim = 1 << nQubits;

  // prob0 = Tr(P0 ρ) — sum diagonal where target bit = 0
  let prob0 = 0;
  for (let i = 0; i < dim; i++) {
    if (!((i >> qubitIndex) & 1)) prob0 += rho[i][i][0];
  }
  const prob1 = Math.max(0, 1 - prob0);

  // Post-measurement states (unnormalized then divided)
  // collapsed0: keep rows/cols where bit = 0, zero the rest
  // collapsed1: keep rows/cols where bit = 1, zero the rest
  const collapsed0 = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: dim }, (_, j) => {
      if (((i >> qubitIndex) & 1) || ((j >> qubitIndex) & 1)) return [0, 0];
      return prob0 > 1e-15 ? cscale(1 / prob0, rho[i][j]) : [0, 0];
    })
  );

  const collapsed1 = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: dim }, (_, j) => {
      if (!((i >> qubitIndex) & 1) || !((j >> qubitIndex) & 1)) return [0, 0];
      return prob1 > 1e-15 ? cscale(1 / prob1, rho[i][j]) : [0, 0];
    })
  );

  return { prob0, prob1, collapsed0, collapsed1 };
}

// State Analysis

/**
 * Compute the Bloch vector for qubit `qubitIndex` via partial trace.
 *
 * The reduced density matrix ρ_k is 2x2. Bloch components:
 *   x = 2*Re(ρ_k[0][1]),  y = 2*Im(ρ_k[0][1]),  z = ρ_k[0][0] - ρ_k[1][1]
 *
 * Uses the upper off-diagonal ρ[0][1] to match the statevector path convention.
 */
export function getBlochVectorDM(rho, qubitIndex, nQubits) {
  const halfDim = 1 << (nQubits - 1);
  let rho00 = 0, rho11 = 0, re01 = 0, im01 = 0;

  for (let m = 0; m < halfDim; m++) {
    const m0 = _insertBit(m, qubitIndex, 0);
    const m1 = _insertBit(m, qubitIndex, 1);
    rho00 += rho[m0][m0][0];
    rho11 += rho[m1][m1][0];
    re01  += rho[m0][m1][0];
    im01  += rho[m0][m1][1];
  }

  const x = 2 * re01;
  const y = 2 * im01;
  const z = rho00 - rho11;
  const theta = Math.acos(Math.max(-1, Math.min(1, z)));
  const phi   = Math.atan2(y, x);
  return { x, y, z, theta, phi };
}

/**
 * Return the diagonal of ρ as an array of real probabilities.
 * Equivalent to the Born-rule probability distribution over computational basis states.
 */
export function getDiagonalDM(rho) {
  return rho.map((row, i) => row[i][0]);
}

// Internal helpers

/**
 * Insert bit `bit` at position `pos` in the integer `m`.
 * Bits at positions >= pos in m shift up by one.
 */
function _insertBit(m, pos, bit) {
  const lower = m & ((1 << pos) - 1);
  const upper = (m >> pos) << (pos + 1);
  return lower | upper | (bit << pos);
}
