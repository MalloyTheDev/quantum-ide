import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/engine/parser.js';
import { executeNoisyProgram, executeProgram, getProbabilities } from '../src/engine/simulator.js';

function run(code) {
  const { instructions, nQubits, errors, customGates } = parse(code);
  assert.deepEqual(errors, []);
  return executeProgram(instructions, nQubits, customGates);
}

describe('Classical conditionals', () => {
  it('parses measurement-memory conditionals', () => {
    const result = parse('qubits 3\nmeasure 0\nif m[0] == 1: x 2');
    assert.deepEqual(result.errors, []);
    const conditional = result.instructions.find((inst) => inst.type === 'conditional');
    assert.equal(conditional.condition.qubit, 0);
    assert.equal(conditional.condition.value, 1);
    assert.equal(conditional.instruction.type, 'gate');
    assert.equal(conditional.instruction.gate, 'x');
    assert.deepEqual(conditional.instruction.qubits, [2]);
  });

  it('executes the wrapped gate when the last measurement matches', () => {
    const result = run('qubits 2\nx 0\nmeasure 0\nif m[0] == 1: x 1');
    const probs = getProbabilities(result.state);
    assert.equal(result.measurements[0].outcome, 1);
    assert.ok(probs[3] > 0.999, `Expected |11>, got P(|11>)=${probs[3]}`);
  });

  it('skips the wrapped gate when the measurement does not match', () => {
    const result = run('qubits 2\nmeasure 0\nif m[0] == 1: x 1');
    const probs = getProbabilities(result.state);
    assert.equal(result.measurements[0].outcome, 0);
    assert.ok(probs[0] > 0.999, `Expected |00>, got P(|00>)=${probs[0]}`);
  });

  it('supports conditionals in noisy mode', () => {
    const { instructions, nQubits, errors, customGates } = parse('qubits 2\nx 0\nmeasure 0\nif m[0] == 1: x 1');
    assert.deepEqual(errors, []);
    const { densityMatrix, measurements } = executeNoisyProgram(
      instructions,
      nQubits,
      { model: 'depolarizing', strength: 0 },
      customGates
    );
    assert.equal(measurements[0].outcome, 1);
    assert.ok(densityMatrix[3][3][0] > 0.999, `Expected rho[3][3]~1, got ${densityMatrix[3][3][0]}`);
  });
});
