/**
 * Noisy simulation tests - trace preservation, positivity, and density
 * matrix equivalence against reference circuits.
 *
 * A valid density matrix must satisfy:
 *   1. Tr(rho) = 1  (trace preservation)
 *   2. rho[i][i] >= 0 for all i  (positivity of diagonal)
 *   3. rho is Hermitian: rho[i][j] = conj(rho[j][i])
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeNoisyProgram } from '../src/engine/simulator.js';
import { parse } from '../src/engine/parser.js';
import { createDensityMatrix } from '../src/engine/densityMatrix.js';

const EPS = 1e-9;

function near(a, b) {
  return Math.abs(a - b) < EPS;
}

function trace(rho) {
  return rho.reduce((s, row, i) => s + row[i][0], 0);
}

function runNoisy(code, model = 'depolarizing', strength = 0.05) {
  const { instructions, nQubits, customGates } = parse(code);
  return executeNoisyProgram(instructions, nQubits, { model, strength }, customGates);
}

// ── Trace preservation ────────────────────────────────────────────────────────

describe('Trace preservation', () => {
  it('initial density matrix has trace 1', () => {
    const rho = createDensityMatrix(2);
    assert.ok(near(trace(rho), 1));
  });

  it('single H gate preserves trace (depolarizing)', () => {
    const { densityMatrix } = runNoisy('h 0', 'depolarizing', 0.1);
    assert.ok(near(trace(densityMatrix), 1), `Tr(rho) = ${trace(densityMatrix)}`);
  });

  it('CNOT gate preserves trace', () => {
    const { densityMatrix } = runNoisy('h 0\ncx 0 1', 'depolarizing', 0.05);
    assert.ok(near(trace(densityMatrix), 1));
  });

  it('amplitude damping preserves trace', () => {
    const { densityMatrix } = runNoisy('h 0\nh 1', 'amplitude_damping', 0.1);
    assert.ok(near(trace(densityMatrix), 1));
  });

  it('phase flip preserves trace', () => {
    const { densityMatrix } = runNoisy('x 0\ny 1', 'phase_flip', 0.2);
    assert.ok(near(trace(densityMatrix), 1));
  });

  it('deep circuit preserves trace', () => {
    const code = 'h 0\ncx 0 1\nz 0\ns 1\ncx 1 0\nh 1';
    const { densityMatrix } = runNoisy(code, 'depolarizing', 0.03);
    assert.ok(near(trace(densityMatrix), 1), `Tr(rho) = ${trace(densityMatrix)}`);
  });
});

// ── Positivity of diagonal ────────────────────────────────────────────────────

describe('Diagonal positivity', () => {
  it('all diagonal entries are non-negative after H (depolarizing)', () => {
    const { densityMatrix: rho } = runNoisy('h 0', 'depolarizing', 0.1);
    for (let i = 0; i < rho.length; i++) {
      assert.ok(rho[i][i][0] >= -EPS, `rho[${i}][${i}] = ${rho[i][i][0]} is negative`);
    }
  });

  it('all diagonal entries are non-negative (amplitude damping)', () => {
    const { densityMatrix: rho } = runNoisy('h 0\ncx 0 1', 'amplitude_damping', 0.2);
    for (let i = 0; i < rho.length; i++) {
      assert.ok(rho[i][i][0] >= -EPS, `rho[${i}][${i}] = ${rho[i][i][0]} is negative`);
    }
  });
});

// ── Hermiticity ───────────────────────────────────────────────────────────────

describe('Hermiticity', () => {
  it('density matrix is Hermitian: rho[i][j] = conj(rho[j][i])', () => {
    const { densityMatrix: rho } = runNoisy('h 0\ncx 0 1\ns 0', 'depolarizing', 0.05);
    for (let i = 0; i < rho.length; i++) {
      for (let j = 0; j < rho.length; j++) {
        const re_ij = rho[i][j][0];
        const im_ij = rho[i][j][1];
        const re_ji = rho[j][i][0];
        const im_ji = rho[j][i][1];
        assert.ok(near(re_ij, re_ji), `Re[${i}][${j}]=${re_ij} != Re[${j}][${i}]=${re_ji}`);
        assert.ok(near(im_ij, -im_ji), `Im[${i}][${j}]=${im_ij} != -Im[${j}][${i}]=${im_ji}`);
      }
    }
  });
});

// ── Zero noise equivalence ────────────────────────────────────────────────────

describe('Zero noise = pure state', () => {
  it('zero-strength noise yields a pure state (Tr(rho^2) = 1)', () => {
    const { densityMatrix: rho } = runNoisy('h 0', 'depolarizing', 0);
    const dim = rho.length;
    // Tr(rho^2) = sum_{i,j} |rho[i][j]|^2
    let purity = 0;
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        purity += rho[i][j][0] ** 2 + rho[i][j][1] ** 2;
      }
    }
    assert.ok(near(purity, 1), `Purity = ${purity}, expected 1 for zero noise`);
  });
});

// ── CS/CT in noisy mode ───────────────────────────────────────────────────────

describe('CS and CT gates in noisy mode', () => {
  it('CS gate preserves trace', () => {
    const { densityMatrix } = runNoisy('h 0\nx 1\ncs 0 1', 'depolarizing', 0.05);
    assert.ok(near(trace(densityMatrix), 1));
  });

  it('CT gate preserves trace', () => {
    const { densityMatrix } = runNoisy('h 0\nx 1\nct 0 1', 'depolarizing', 0.05);
    assert.ok(near(trace(densityMatrix), 1));
  });
});

// ── Custom gate in noisy mode ─────────────────────────────────────────────────

describe('Custom gate in noisy mode', () => {
  it('custom gate does not reset state', () => {
    // Apply X then a custom gate that does nothing (identity) - state should remain |1>
    const code = ['gate ident(q0):', '  x q0', '  x q0', 'end', 'x 0', 'ident 0'].join('\n');
    const { densityMatrix } = runNoisy(code, 'depolarizing', 0);
    // Zero noise: should be close to pure |1> state, so rho[1][1] ~ 1
    assert.ok(densityMatrix[1][1][0] > 0.9, `Expected rho[1][1]~1, got ${densityMatrix[1][1][0]}`);
  });

  it('custom gate trace is preserved', () => {
    const code = ['gate bell(a, b):', '  h a', '  cx a b', 'end', 'qubits 2', 'bell 0 1'].join('\n');
    const { densityMatrix } = runNoisy(code, 'depolarizing', 0.05);
    assert.ok(near(trace(densityMatrix), 1));
  });
});
