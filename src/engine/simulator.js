/**
 * Quantum Simulator Engine
 * 
 * From-scratch state vector simulator. No third-party quantum libraries.
 * 
 * State representation:
 *   Array of 2^n complex amplitudes, where n = number of qubits.
 *   Each amplitude is a [real, imag] tuple.
 *   Uses little-endian qubit ordering: qubit 0 = least significant bit.
 * 
 * Gate application:
 *   Instead of constructing full 2^n × 2^n unitary matrices via tensor
 *   products, we directly iterate over amplitude pairs that differ only
 *   in the target qubit's bit position. This is O(2^n) per gate instead
 *   of O(2^(2n)) for full matrix multiplication.
 * 
 * Measurement:
 *   Born rule — probability of outcome is sum of |amplitude|² for all
 *   basis states consistent with that outcome. State collapses and
 *   renormalizes after measurement.
 */

import { cadd, cmul, cabs2, cscale } from './complex.js';
import { FIXED_GATES, ROTATION_GATES } from './gates.js';
import {
  createDensityMatrix,
  applyGateDM,
  applyCNOT_DM,
  applySWAP_DM,
  applyControlledGate_DM,
  applyToffoli_DM,
  applyCSWAP_DM,
  applyKraus,
  depolarizingChannel,
  amplitudeDampingChannel,
  phaseFlipChannel,
  measureDM,
  getBlochVectorDM,
  getDiagonalDM,
} from './densityMatrix.js';

// State Initialization

/**
 * Create an n-qubit state initialized to |0...0⟩
 */
export function createState(nQubits) {
  const size = 1 << nQubits;
  const state = Array.from({ length: size }, () => [0, 0]);
  state[0] = [1, 0]; // |0...0⟩
  return state;
}

/**
 * Deep-clone a state vector
 */
export function cloneState(state) {
  return state.map(a => [...a]);
}

// Single-Qubit Gate Application

/**
 * Apply a 2x2 unitary gate to a single qubit in the state vector.
 * 
 * For each pair of amplitudes (|...0_q...⟩, |...1_q...⟩) that differ
 * only in bit position q, we apply:
 * 
 *   |new_0⟩ = gate[0][0] * |old_0⟩ + gate[0][1] * |old_1⟩
 *   |new_1⟩ = gate[1][0] * |old_0⟩ + gate[1][1] * |old_1⟩
 * 
 * @param {Array} state - State vector (array of [re, im] tuples)
 * @param {Array} gate  - 2x2 gate matrix
 * @param {number} qubit - Target qubit index
 * @param {number} nQubits - Total number of qubits
 * @returns {Array} New state vector
 */
export function applySingleQubitGate(state, gate, qubit, nQubits) {
  const newState = cloneState(state);
  const size = 1 << nQubits;

  for (let j = 0; j < size; j++) {
    // Only process when the target qubit bit is 0 (avoid double-processing)
    if ((j >> qubit) & 1) continue;

    const j0 = j;                  // index where qubit bit = 0
    const j1 = j | (1 << qubit);   // index where qubit bit = 1

    const amp0 = state[j0];
    const amp1 = state[j1];

    newState[j0] = cadd(cmul(gate[0][0], amp0), cmul(gate[0][1], amp1));
    newState[j1] = cadd(cmul(gate[1][0], amp0), cmul(gate[1][1], amp1));
  }

  return newState;
}

// Two-Qubit Gate Application

/**
 * Apply CNOT (Controlled-X) gate.
 * 
 * If control qubit is |1⟩, flip target qubit.
 * Implementation: for each basis state where control=1 and target=0,
 * swap its amplitude with the state where target=1.
 */
export function applyCNOT(state, control, target, nQubits) {
  const newState = cloneState(state);
  const size = 1 << nQubits;

  for (let j = 0; j < size; j++) {
    // Only process states where control=1 and target=0
    if (((j >> control) & 1) && !((j >> target) & 1)) {
      const j1 = j | (1 << target);
      newState[j] = [...state[j1]];
      newState[j1] = [...state[j]];
    }
  }

  return newState;
}

/**
 * Apply SWAP gate using three CNOT decomposition.
 * SWAP = CNOT(a,b) · CNOT(b,a) · CNOT(a,b)
 */
export function applySWAP(state, qubit1, qubit2, nQubits) {
  let s = applyCNOT(state, qubit1, qubit2, nQubits);
  s = applyCNOT(s, qubit2, qubit1, nQubits);
  s = applyCNOT(s, qubit1, qubit2, nQubits);
  return s;
}

/**
 * Apply a single-qubit gate to target only when control qubit is |1⟩.
 * Used to implement CZ, CS, CT as controlled versions of Z, S, T.
 */
export function applyControlledGate(state, gate, control, target, nQubits) {
  const newState = cloneState(state);
  const size = 1 << nQubits;

  for (let j = 0; j < size; j++) {
    // Only process pairs where control=1 and target=0 (avoids double-processing)
    if (((j >> control) & 1) && !((j >> target) & 1)) {
      const j0 = j;
      const j1 = j | (1 << target);

      const amp0 = state[j0];
      const amp1 = state[j1];

      newState[j0] = cadd(cmul(gate[0][0], amp0), cmul(gate[0][1], amp1));
      newState[j1] = cadd(cmul(gate[1][0], amp0), cmul(gate[1][1], amp1));
    }
  }

  return newState;
}

/**
 * Apply Toffoli (CCX) gate: flip target when both c1 and c2 are |1⟩.
 */
export function applyToffoli(state, c1, c2, target, nQubits) {
  const newState = cloneState(state);
  const size = 1 << nQubits;

  for (let j = 0; j < size; j++) {
    if (((j >> c1) & 1) && ((j >> c2) & 1) && !((j >> target) & 1)) {
      const j1 = j | (1 << target);
      newState[j] = [...state[j1]];
      newState[j1] = [...state[j]];
    }
  }

  return newState;
}

/**
 * Apply CSWAP (Fredkin) gate: swap t1 and t2 when control is |1⟩.
 */
export function applyCSWAP(state, control, t1, t2, nQubits) {
  const newState = cloneState(state);
  const size = 1 << nQubits;

  for (let j = 0; j < size; j++) {
    // Only process states where control=1, t1=1, t2=0
    if (((j >> control) & 1) && ((j >> t1) & 1) && !((j >> t2) & 1)) {
      const jSwapped = (j ^ (1 << t1)) | (1 << t2);
      newState[j] = [...state[jSwapped]];
      newState[jSwapped] = [...state[j]];
    }
  }

  return newState;
}

// Measurement

/**
 * Measure a single qubit. Collapses the state according to Born rule.
 * 
 * 1. Compute probability of measuring |0⟩: sum |α_j|² for all j where bit q = 0
 * 2. Sample outcome from Bernoulli(p0)
 * 3. Zero out amplitudes inconsistent with outcome
 * 4. Renormalize remaining amplitudes
 * 
 * @returns {{ state: Array, outcome: number }}
 */
export function measureQubit(state, qubit, nQubits) {
  const size = 1 << nQubits;

  // Compute P(outcome = 0)
  let prob0 = 0;
  for (let j = 0; j < size; j++) {
    if (!((j >> qubit) & 1)) {
      prob0 += cabs2(state[j]);
    }
  }

  // Sample outcome
  const outcome = Math.random() < prob0 ? 0 : 1;
  const normFactor = Math.sqrt(outcome === 0 ? prob0 : 1 - prob0);

  // Collapse and renormalize
  const newState = state.map((amp, j) => {
    const bit = (j >> qubit) & 1;
    if (bit !== outcome) return [0, 0];
    return normFactor > 1e-15 ? cscale(1 / normFactor, amp) : [0, 0];
  });

  return { state: newState, outcome };
}

/**
 * Measure all qubits. Returns array of outcomes.
 */
export function measureAll(state, nQubits) {
  let s = cloneState(state);
  const outcomes = [];

  for (let q = 0; q < nQubits; q++) {
    const result = measureQubit(s, q, nQubits);
    s = result.state;
    outcomes.push({ qubit: q, outcome: result.outcome });
  }

  return { state: s, outcomes };
}

// Instruction Execution

/**
 * Execute a single parsed instruction against the current state.
 *
 * @param {Object} instruction - Parsed instruction object
 * @param {Array} state - Current state vector
 * @param {number} nQubits - Number of qubits
 * @param {Array} measurements - Current measurement log
 * @param {Object} customGates - Custom gate definitions from parser
 * @returns {{ state: Array, measurements: Array }}
 */
export function executeInstruction(instruction, state, nQubits, measurements, customGates = {}) {
  let s = state;
  let m = [...measurements];

  switch (instruction.type) {
    case 'gate': {
      const gate = FIXED_GATES[instruction.gate];
      if (gate) {
        s = applySingleQubitGate(s, gate, instruction.qubits[0], nQubits);
      }
      break;
    }

    case 'rotation': {
      const factory = ROTATION_GATES[instruction.gate];
      if (factory) {
        const gate = factory(instruction.angle);
        s = applySingleQubitGate(s, gate, instruction.qubits[0], nQubits);
      }
      break;
    }

    case 'cx': {
      s = applyCNOT(s, instruction.qubits[0], instruction.qubits[1], nQubits);
      break;
    }

    case 'cz': {
      s = applyControlledGate(s, FIXED_GATES.z, instruction.qubits[0], instruction.qubits[1], nQubits);
      break;
    }

    case 'cs': {
      s = applyControlledGate(s, FIXED_GATES.s, instruction.qubits[0], instruction.qubits[1], nQubits);
      break;
    }

    case 'ct': {
      s = applyControlledGate(s, FIXED_GATES.t, instruction.qubits[0], instruction.qubits[1], nQubits);
      break;
    }

    case 'swap': {
      s = applySWAP(s, instruction.qubits[0], instruction.qubits[1], nQubits);
      break;
    }

    case 'ccx': {
      s = applyToffoli(s, instruction.qubits[0], instruction.qubits[1], instruction.qubits[2], nQubits);
      break;
    }

    case 'cswap': {
      s = applyCSWAP(s, instruction.qubits[0], instruction.qubits[1], instruction.qubits[2], nQubits);
      break;
    }

    case 'custom_gate': {
      const def = customGates[instruction.name];
      if (def) {
        // Expand body instructions with call-site qubit mapping
        for (const bodyInst of def.body) {
          const remapped = {
            ...bodyInst,
            qubits: bodyInst.qubits?.map(localIdx => instruction.qubits[localIdx]),
          };
          const r = executeInstruction(remapped, s, nQubits, m, customGates);
          s = r.state;
          m = r.measurements;
        }
      }
      break;
    }

    case 'measure': {
      const result = measureQubit(s, instruction.qubits[0], nQubits);
      s = result.state;
      m.push({ qubit: instruction.qubits[0], outcome: result.outcome });
      break;
    }

    case 'measure_all': {
      const result = measureAll(s, nQubits);
      s = result.state;
      m.push(...result.outcomes);
      break;
    }

    case 'barrier':
      // No-op: barriers are visual only
      break;

    default:
      break;
  }

  return { state: s, measurements: m };
}

/**
 * Execute an entire program (array of instructions).
 */
export function executeProgram(instructions, nQubits, customGates = {}) {
  let state = createState(nQubits);
  let measurements = [];

  const gates = instructions.filter(i => i.type !== 'qubits');

  for (const inst of gates) {
    const result = executeInstruction(inst, state, nQubits, measurements, customGates);
    state = result.state;
    measurements = result.measurements;
  }

  return { state, measurements, gateCount: gates.length };
}

// Multi-Shot Execution

/**
 * Run a circuit `shots` times from |0⟩ and collect measurement outcome frequencies.
 *
 * Each run is fully independent (fresh state vector). If the circuit contains
 * explicit `measure` or `measure all` instructions the outcomes of those
 * measurements are used to build the bitstring; otherwise the final state
 * is sampled with a full computational-basis measurement.
 *
 * @param {Array}  instructions - Parsed instruction list (from parser.js)
 * @param {number} nQubits      - Number of qubits
 * @param {number} shots        - Number of independent runs
 * @param {Object} customGates  - Custom gate definitions from parser
 * @returns {Object} Frequency map: { "00": 512, "11": 488, ... }
 */
export function runMultiShot(instructions, nQubits, shots, customGates = {}) {
  const counts = {};

  for (let i = 0; i < shots; i++) {
    const result = executeProgram(instructions, nQubits, customGates);

    let bitstring;
    if (result.measurements.length === 0) {
      // No explicit measurements — sample from the final state vector
      const { outcomes } = measureAll(result.state, nQubits);
      bitstring = outcomes.map(m => m.outcome).join('');
    } else {
      // Use explicit measurement outcomes: one entry per qubit (last wins if re-measured)
      const lastMeasured = {};
      for (const m of result.measurements) {
        lastMeasured[m.qubit] = m.outcome;
      }
      const qubits = Object.keys(lastMeasured).map(Number).sort((a, b) => a - b);
      bitstring = qubits.map(q => lastMeasured[q]).join('');
    }

    counts[bitstring] = (counts[bitstring] || 0) + 1;
  }

  return counts;
}

// State Analysis Utilities

/**
 * Get probability distribution from state vector
 */
export function getProbabilities(state) {
  return state.map(cabs2);
}

/**
 * Get non-zero basis states (for sparse display)
 */
export function getNonZeroStates(state, threshold = 1e-10) {
  return state
    .map((amp, index) => ({ index, amplitude: amp, probability: cabs2(amp) }))
    .filter(entry => entry.probability > threshold);
}

/**
 * Compute von Neumann entropy of the state
 * (only meaningful for mixed states, but useful for partial trace)
 */
export function stateEntropy(state) {
  let entropy = 0;
  for (const amp of state) {
    const p = cabs2(amp);
    if (p > 1e-15) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

// Bloch Sphere

/**
 * Compute the Bloch vector for each qubit by partial trace.
 *
 * For qubit k, the reduced 2×2 density matrix is:
 *   ρ₀₀ = Σ_{i: bit_k=0} |α_i|²
 *   ρ₁₁ = Σ_{i: bit_k=1} |α_i|²
 *   ρ₀₁ = Σ_{i: bit_k=0} conj(α_i) · α_{i|(1<<k)}
 *
 * Bloch vector components:
 *   x = 2·Re(ρ₀₁),  y = 2·Im(ρ₀₁),  z = ρ₀₀ − ρ₁₁
 *
 * @param {Array}  stateVector - Array of [re, im] amplitudes (length 2^nQubits)
 * @param {number} nQubits     - Number of qubits
 * @returns {Array} Array of { x, y, z, theta, phi } objects, one per qubit
 */
export function getBlochVectors(stateVector, nQubits) {
  const size = 1 << nQubits;
  const vectors = [];

  for (let k = 0; k < nQubits; k++) {
    let rho00 = 0;
    let rho11 = 0;
    let re01  = 0;
    let im01  = 0;

    for (let i = 0; i < size; i++) {
      if ((i >> k) & 1) {
        // bit k = 1 → contributes to ρ₁₁
        const [ar, ai] = stateVector[i];
        rho11 += ar * ar + ai * ai;
      } else {
        // bit k = 0 → contributes to ρ₀₀ and ρ₀₁
        const j = i | (1 << k);
        const [ar, ai] = stateVector[i];
        const [br, bi] = stateVector[j];
        rho00 += ar * ar + ai * ai;
        // conj(α_i) · α_j = (ar − ai·i)(br + bi·i) = (ar·br + ai·bi) + i·(ar·bi − ai·br)
        re01 += ar * br + ai * bi;
        im01 += ar * bi - ai * br;
      }
    }

    const x     = 2 * re01;
    const y     = 2 * im01;
    const z     = rho00 - rho11;
    const theta = Math.acos(Math.max(-1, Math.min(1, z)));
    const phi   = Math.atan2(y, x);
    vectors.push({ x, y, z, theta, phi });
  }

  return vectors;
}

// Noisy Simulation (Density Matrix)

/**
 * Execute a program using density matrix formalism with a noise channel
 * applied after every gate instruction.
 *
 * @param {Array}  instructions - Parsed instruction list
 * @param {number} nQubits      - Number of qubits
 * @param {Object} noiseConfig  - { model: 'depolarizing'|'amplitude_damping'|'phase_flip', strength: number }
 * @param {Object} customGates  - Custom gate definitions from parser
 * @returns {{ densityMatrix, blochVectors, measurements }}
 */
export function executeNoisyProgram(instructions, nQubits, noiseConfig = {}, customGates = {}) {
  const { model = 'depolarizing', strength = 0.01 } = noiseConfig;
  const measurements = [];

  function getKraus() {
    switch (model) {
      case 'amplitude_damping': return amplitudeDampingChannel(strength);
      case 'phase_flip':        return phaseFlipChannel(strength);
      case 'depolarizing':
      default:                  return depolarizingChannel(strength);
    }
  }

  function applyNoise(rho) {
    const kraus = getKraus();
    let r = rho;
    for (let q = 0; q < nQubits; q++) {
      r = applyKraus(r, kraus, q, nQubits);
    }
    return r;
  }

  // Apply one instruction to rho in-place, returning the updated rho.
  // Custom gate bodies recurse here instead of re-entering executeNoisyProgram,
  // so they evolve the live state rather than starting from |0>.
  function applyInst(rho, inst) {
    switch (inst.type) {
      case 'qubits':
        break;

      case 'gate': {
        const gate = FIXED_GATES[inst.gate.toLowerCase()];
        if (gate) {
          rho = applyGateDM(rho, gate, inst.qubits[0], nQubits);
          rho = applyNoise(rho);
        }
        break;
      }

      case 'rotation': {
        const factory = ROTATION_GATES[inst.gate.toLowerCase()];
        if (factory) {
          const gate = factory(inst.angle);
          rho = applyGateDM(rho, gate, inst.qubits[0], nQubits);
          rho = applyNoise(rho);
        }
        break;
      }

      case 'cx':
        rho = applyCNOT_DM(rho, inst.qubits[0], inst.qubits[1], nQubits);
        rho = applyNoise(rho);
        break;

      case 'cz': {
        const Z = FIXED_GATES['z'];
        rho = applyControlledGate_DM(rho, Z, inst.qubits[0], inst.qubits[1], nQubits);
        rho = applyNoise(rho);
        break;
      }

      case 'swap':
        rho = applySWAP_DM(rho, inst.qubits[0], inst.qubits[1], nQubits);
        rho = applyNoise(rho);
        break;

      case 'ccx':
        rho = applyToffoli_DM(rho, inst.qubits[0], inst.qubits[1], inst.qubits[2], nQubits);
        rho = applyNoise(rho);
        break;

      case 'cswap':
        rho = applyCSWAP_DM(rho, inst.qubits[0], inst.qubits[1], inst.qubits[2], nQubits);
        rho = applyNoise(rho);
        break;

      case 'measure': {
        const q = inst.qubits[0];
        const { prob0, collapsed0, collapsed1 } = measureDM(rho, q, nQubits);
        const outcome = Math.random() < prob0 ? 0 : 1;
        rho = outcome === 0 ? collapsed0 : collapsed1;
        measurements.push({ qubit: q, outcome });
        break;
      }

      case 'measure_all':
        for (let q = 0; q < nQubits; q++) {
          const { prob0, collapsed0, collapsed1 } = measureDM(rho, q, nQubits);
          const outcome = Math.random() < prob0 ? 0 : 1;
          rho = outcome === 0 ? collapsed0 : collapsed1;
          measurements.push({ qubit: q, outcome });
        }
        break;

      case 'barrier':
        break;

      case 'custom_gate': {
        const def = customGates[inst.name];
        if (def) {
          for (const bodyInst of def.body) {
            const remapped = {
              ...bodyInst,
              qubits: bodyInst.qubits?.map(localIdx => inst.qubits[localIdx]),
            };
            rho = applyInst(rho, remapped);
          }
        }
        break;
      }

      default:
        break;
    }
    return rho;
  }

  let rho = createDensityMatrix(nQubits);
  for (const inst of instructions) {
    rho = applyInst(rho, inst);
  }

  const blochVectors = Array.from({ length: nQubits }, (_, k) =>
    getBlochVectorDM(rho, k, nQubits)
  );

  return { densityMatrix: rho, blochVectors, measurements };
}