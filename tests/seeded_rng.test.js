import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import seedrandom from 'seedrandom';
import { parse } from '../src/engine/parser.js';
import { executeProgram, runMultiShot } from '../src/engine/simulator.js';
import { runSimulationJob } from '../src/services/simulationRunner.js';

function total(counts) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

describe('Seeded measurement sampling', () => {
  it('produces identical histograms for the same worker seed', async () => {
    const args = {
      code: 'qubits 1\nh 0\nmeasure 0',
      shots: 100,
      seed: 'math-lab',
      noiseConfig: { enabled: false, model: 'depolarizing', strength: 0.01 },
    };

    const a = await runSimulationJob(args);
    const b = await runSimulationJob(args);

    assert.deepEqual(a.histogramData, b.histogramData);
    assert.equal(total(a.histogramData), 100);
  });

  it('uses the seeded RNG in direct multi-shot execution', () => {
    const { instructions, nQubits, customGates } = parse('qubits 2\nh 0\ncx 0 1\nmeasure all');
    const a = runMultiShot(instructions, nQubits, 64, customGates, { rng: seedrandom('same') });
    const b = runMultiShot(instructions, nQubits, 64, customGates, { rng: seedrandom('same') });
    const c = runMultiShot(instructions, nQubits, 64, customGates, { rng: seedrandom('different') });

    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
  });

  it('keeps unseeded execution valid', () => {
    const { instructions, nQubits, customGates } = parse('qubits 1\nh 0\nmeasure 0');
    const result = executeProgram(instructions, nQubits, customGates);

    assert.equal(result.measurements.length, 1);
    assert.ok(result.measurements[0].outcome === 0 || result.measurements[0].outcome === 1);
  });
});
