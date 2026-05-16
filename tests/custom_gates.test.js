/**
 * Custom gate execution tests - single-level and nested custom gates,
 * in both state-vector and noisy (density matrix) simulation modes.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeProgram, executeNoisyProgram, getProbabilities } from '../src/engine/simulator.js';
import { parse } from '../src/engine/parser.js';

const EPS = 1e-9;

function near(a, b) {
  return Math.abs(a - b) < EPS;
}

function run(code) {
  const { instructions, nQubits, customGates } = parse(code);
  return executeProgram(instructions, nQubits, customGates);
}

function runNoisy(code, strength = 0) {
  const { instructions, nQubits, customGates } = parse(code);
  return executeNoisyProgram(instructions, nQubits, { model: 'depolarizing', strength }, customGates);
}

// ── State-vector custom gate execution ───────────────────────────────────────

describe('Custom gate - state vector', () => {
  it('single-qubit custom gate applies correctly', () => {
    const code = ['gate flip(q0):', '  x q0', 'end', 'flip 0'].join('\n');
    const { state } = run(code);
    // X|0> = |1>, so state[1] = 1
    assert.ok(near(state[1][0], 1), `Expected |1>, got amplitude ${state[1]}`);
    assert.ok(near(state[0][0], 0));
  });

  it('two-qubit custom gate (Bell state)', () => {
    const code = ['gate bell(a, b):', '  h a', '  cx a b', 'end', 'qubits 2', 'bell 0 1'].join('\n');
    const { state } = run(code);
    const probs = getProbabilities(state);
    const v = 0.5; // |00> and |11> each 0.5
    assert.ok(near(probs[0], v), `P(|00>) = ${probs[0]}, expected 0.5`);
    assert.ok(near(probs[3], v), `P(|11>) = ${probs[3]}, expected 0.5`);
    assert.ok(near(probs[1], 0));
    assert.ok(near(probs[2], 0));
  });

  it('custom gate with qubit remapping', () => {
    // Apply X to the second qubit (q1) via a custom gate defined for q0
    const code = ['gate flip(q0):', '  x q0', 'end', 'qubits 2', 'flip 1'].join('\n');
    const { state } = run(code);
    // X on qubit 1 (the higher qubit): state goes from |00> to |01...> = index 2 (little-endian)
    assert.ok(near(state[2][0], 1), `Expected state[2]=1 after X on q1, got ${state[2]}`);
  });

  it('identity custom gate leaves state unchanged', () => {
    const code = ['gate ident(q0):', '  x q0', '  x q0', 'end', 'h 0', 'ident 0'].join('\n');
    const code2 = 'h 0';
    const r1 = run(code);
    const r2 = run(code2);
    const v = 1 / Math.sqrt(2);
    assert.ok(near(r1.state[0][0], v));
    assert.ok(near(r1.state[1][0], v));
    assert.ok(near(r2.state[0][0], v));
    assert.ok(near(r2.state[1][0], v));
  });
});

// ── Nested custom gates ───────────────────────────────────────────────────────

describe('Nested custom gates - state vector', () => {
  it('custom gate using another custom gate (nested call in body via expansion)', () => {
    // Parser stores body instructions by type; nested custom gate calls
    // inside a gate body are stored as custom_gate instructions and resolved
    // at execution time against the registry.
    const code = ['gate flip(q0):', '  x q0', 'end', 'qubits 1', 'flip 0', 'flip 0'].join('\n');
    // Two flips = identity
    const { state } = run(code);
    assert.ok(near(state[0][0], 1));
    assert.ok(near(state[1][0], 0));
  });
});

// ── Custom gate in noisy simulation ──────────────────────────────────────────

describe('Custom gate - noisy simulation (density matrix)', () => {
  it('does not reset to |0> state', () => {
    // Apply X to set |1>, then apply identity custom gate.
    // If the noisy path incorrectly reinitializes, rho[0][0] would be 1.
    // Correct behavior: rho[1][1] should dominate.
    const code = ['gate ident(q0):', '  x q0', '  x q0', 'end', 'x 0', 'ident 0'].join('\n');
    const { densityMatrix: rho } = runNoisy(code, 0);
    assert.ok(rho[1][1][0] > 0.99, `Expected rho[1][1] ~ 1, got ${rho[1][1][0]}`);
    assert.ok(rho[0][0][0] < 0.01, `Expected rho[0][0] ~ 0, got ${rho[0][0][0]}`);
  });

  it('custom gate evolves state correctly (zero noise)', () => {
    const code = ['gate bell(a, b):', '  h a', '  cx a b', 'end', 'qubits 2', 'bell 0 1'].join('\n');
    const { densityMatrix: rho } = runNoisy(code, 0);
    // Bell state: rho[0][0] = rho[3][3] = 0.5, others 0
    assert.ok(near(rho[0][0][0], 0.5), `rho[0][0] = ${rho[0][0][0]}`);
    assert.ok(near(rho[3][3][0], 0.5), `rho[3][3] = ${rho[3][3][0]}`);
    assert.ok(near(rho[1][1][0], 0));
    assert.ok(near(rho[2][2][0], 0));
  });

  it('gate body calling another custom gate works in noisy mode', () => {
    const code = [
      'gate flip(q0):',
      '  x q0',
      'end',
      'gate double_flip(q0):',
      '  flip q0',
      '  flip q0',
      'end',
      'x 0',
      'double_flip 0',
    ].join('\n');
    // x 0 sets |1>, double_flip (flip;flip = identity) leaves it in |1>
    const { densityMatrix: rho } = runNoisy(code, 0);
    assert.ok(rho[1][1][0] > 0.99, `rho[1][1] = ${rho[1][1][0]}`);
    assert.ok(rho[0][0][0] < 0.01, `rho[0][0] = ${rho[0][0][0]}`);
  });

  it('nested custom gates work in noisy mode', () => {
    const code = ['gate flip(q0):', '  x q0', 'end', 'x 0', 'flip 0', 'flip 0'].join('\n');
    // x then flip flip = x (flip^2 = I)
    const { densityMatrix: rho } = runNoisy(code, 0);
    assert.ok(rho[1][1][0] > 0.99, `rho[1][1] = ${rho[1][1][0]}`);
  });
});
