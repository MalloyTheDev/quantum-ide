import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parse } from '../src/engine/parser.js';
import { executeProgram } from '../src/engine/simulator.js';
import {
  buildAnalysisSummary,
  createBasisState,
  densityMatrixPurity,
  pauliExpectation,
  stateVectorFidelity,
  stateVectorToDensityMatrix,
  vonNeumannEntropy,
} from '../src/engine/analysis.js';

const EPS = 1e-9;

function near(a, b, eps = EPS) {
  return Math.abs(a - b) < eps;
}

function run(code) {
  const { instructions, nQubits, customGates, errors } = parse(code);
  assert.deepEqual(errors, []);
  return { ...executeProgram(instructions, nQubits, customGates), nQubits };
}

describe('Quantum analysis', () => {
  it('finds Bell single-qubit reductions are maximally mixed', () => {
    const result = run('qubits 2\nh 0\ncx 0 1');
    const summary = buildAnalysisSummary({ state: result.state, nQubits: result.nQubits, reference: 'bell' });
    const q0 = summary.reducedStates[0];

    assert.ok(near(summary.purity, 1));
    assert.ok(near(summary.entropy, 0));
    assert.ok(near(q0.purity, 0.5));
    assert.ok(near(q0.entropy, 1));
    assert.ok(near(summary.fidelity.value, 1));
  });

  it('keeps product-state reductions pure', () => {
    const result = run('qubits 2\nh 0');
    const summary = buildAnalysisSummary({ state: result.state, nQubits: result.nQubits, reference: 'zero' });

    assert.ok(summary.reducedStates.every((state) => near(state.purity, 1)));
    assert.ok(summary.reducedStates.every((state) => near(state.entropy, 0)));
  });

  it('finds GHZ single-qubit reductions are mixed', () => {
    const result = run('qubits 3\nh 0\ncx 0 1\ncx 0 2');
    const summary = buildAnalysisSummary({ state: result.state, nQubits: result.nQubits, reference: 'ghz' });

    assert.ok(summary.reducedStates.every((state) => near(state.purity, 0.5)));
    assert.ok(summary.reducedStates.every((state) => near(state.entropy, 1)));
    assert.ok(near(summary.fidelity.value, 1));
  });

  it('computes state-vector fidelity for identical and orthogonal states', () => {
    const zero = createBasisState(1, 0);
    const one = createBasisState(1, 1);

    assert.ok(near(stateVectorFidelity(zero, zero), 1));
    assert.ok(near(stateVectorFidelity(zero, one), 0));
  });

  it('matches Pauli expectations for known states', () => {
    const zero = createBasisState(1, 0);
    const one = createBasisState(1, 1);
    const plus = run('qubits 1\nh 0').state;
    const bell = run('qubits 2\nh 0\ncx 0 1').state;

    assert.ok(near(pauliExpectation(zero, 1, 'Z0'), 1));
    assert.ok(near(pauliExpectation(one, 1, 'Z0'), -1));
    assert.ok(near(pauliExpectation(plus, 1, 'X0'), 1));
    assert.ok(near(pauliExpectation(bell, 2, 'Z0Z1'), 1));
  });

  it('preserves pure-state density invariants for random normalized single-qubit states', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: -1, max: 1, noNaN: true }),
          fc.double({ min: -1, max: 1, noNaN: true }),
          fc.double({ min: -1, max: 1, noNaN: true }),
          fc.double({ min: -1, max: 1, noNaN: true })
        ),
        ([ar, ai, br, bi]) => {
          const norm = Math.sqrt(ar * ar + ai * ai + br * br + bi * bi);
          if (norm < 1e-9) return true;
          const state = [
            [ar / norm, ai / norm],
            [br / norm, bi / norm],
          ];
          const rho = stateVectorToDensityMatrix(state);
          return near(densityMatrixPurity(rho), 1, 1e-8) && near(vonNeumannEntropy(rho), 0, 1e-8);
        }
      ),
      { numRuns: 50 }
    );
  });
});
