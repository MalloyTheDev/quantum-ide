import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/engine/parser.js';
import { executeProgram } from '../src/engine/simulator.js';
import { runSimulationJob } from '../src/services/simulationRunner.js';

const EPS = 1e-10;

function near(a, b) {
  return Math.abs(a - b) < EPS;
}

describe('Simulation runner', () => {
  it('matches direct state-vector execution', async () => {
    const code = 'qubits 2\nh 0\ncx 0 1';
    const { instructions, nQubits, customGates } = parse(code);
    const direct = executeProgram(instructions, nQubits, customGates);
    const workerPath = await runSimulationJob({
      code,
      shots: 1,
      noiseConfig: { enabled: false, model: 'depolarizing', strength: 0.01 },
    });

    assert.equal(workerPath.ok, true);
    assert.equal(workerPath.mode, 'statevector');
    assert.ok(workerPath.analysisSummary);
    assert.ok(near(workerPath.analysisSummary.fidelity.value, 1));
    for (let i = 0; i < direct.state.length; i++) {
      assert.ok(near(workerPath.state[i][0], direct.state[i][0]));
      assert.ok(near(workerPath.state[i][1], direct.state[i][1]));
    }
  });

  it('reports multi-shot progress and totals', async () => {
    const progress = [];
    const result = await runSimulationJob(
      {
        code: 'qubits 1\nh 0',
        shots: 50,
        noiseConfig: { enabled: false, model: 'depolarizing', strength: 0.01 },
      },
      (update) => progress.push(update)
    );

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'histogram');
    assert.equal(
      Object.values(result.histogramData).reduce((sum, count) => sum + count, 0),
      50
    );
    assert.ok(progress.some((update) => update.phase === 'shots' && update.completed === 50));
  });

  it('runs noisy simulations through the shared runner', async () => {
    const result = await runSimulationJob({
      code: 'qubits 1\nh 0',
      shots: 1,
      noiseConfig: { enabled: true, model: 'depolarizing', strength: 0 },
    });

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'noisy');
    assert.equal(result.densityMatrix.length, 2);
    assert.ok(result.analysisSummary);
  });
});
