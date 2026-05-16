import { parse, getGateInstructions } from '../engine/parser.js';
import { executeProgram, executeNoisyProgram, measureAll, measureQubit } from '../engine/simulator.js';
import { buildAnalysisSummary } from '../engine/analysis.js';
import seedrandom from 'seedrandom';

function createRunRng(seed) {
  return seed ? seedrandom(seed) : Math.random;
}

export async function runMultiShotWithProgress(
  instructions,
  nQubits,
  shots,
  customGates,
  onProgress,
  rng = Math.random
) {
  const counts = {};
  const reportEvery = Math.max(1, Math.floor(shots / 20));

  for (let i = 0; i < shots; i++) {
    const result = executeProgram(instructions, nQubits, customGates, { rng });

    let bitstring;
    if (result.measurements.length === 0) {
      const { outcomes } = measureAll(result.state, nQubits, rng);
      bitstring = outcomes.map((m) => m.outcome).join('');
    } else {
      const lastMeasured = {};
      for (const measurement of result.measurements) {
        lastMeasured[measurement.qubit] = measurement.outcome;
      }

      let finalState = result.state;
      for (let q = 0; q < nQubits; q++) {
        if (lastMeasured[q] === undefined) {
          const sampled = measureQubit(finalState, q, nQubits, rng);
          lastMeasured[q] = sampled.outcome;
          finalState = sampled.state;
        }
      }
      bitstring = Array.from({ length: nQubits }, (_, q) => lastMeasured[q]).join('');
    }

    counts[bitstring] = (counts[bitstring] || 0) + 1;

    if (onProgress && ((i + 1) % reportEvery === 0 || i === shots - 1)) {
      await onProgress({
        phase: 'shots',
        completed: i + 1,
        total: shots,
      });
    }
  }

  return counts;
}

export async function runSimulationJob({ code, shots, noiseConfig, seed = '', analysis = {} }, onProgress) {
  await onProgress?.({ phase: 'parse', completed: 0, total: 1 });
  const { instructions, nQubits, errors, customGates } = parse(code);

  if (errors.length > 0) {
    return { ok: false, errors, log: ['Fix parse errors before running.'] };
  }

  const gateInstructions = getGateInstructions(instructions);
  const rng = createRunRng(seed);
  const analysisOptions = {
    expectations: analysis.expectations,
    reducedQubits: analysis.reducedQubits,
    reference: analysis.reference,
  };

  if (shots > 1) {
    await onProgress?.({ phase: 'shots', completed: 0, total: shots });
    const histogramData = await runMultiShotWithProgress(instructions, nQubits, shots, customGates, onProgress, rng);
    const distinct = Object.keys(histogramData).length;
    return {
      ok: true,
      mode: 'histogram',
      nQubits,
      gateInstructions,
      histogramData,
      seed,
      analysisSummary: null,
      log: [`Complete. ${shots.toLocaleString()} shots, ${distinct} distinct outcome${distinct !== 1 ? 's' : ''}.`],
    };
  }

  if (noiseConfig.enabled) {
    await onProgress?.({ phase: 'noisy', completed: 0, total: 1 });
    const result = executeNoisyProgram(instructions, nQubits, noiseConfig, customGates, { rng });
    const gateCount = instructions.filter((inst) => inst.type !== 'qubits').length;
    const log = [`Complete (noisy). ${gateCount} instruction${gateCount !== 1 ? 's' : ''} applied.`];
    if (result.measurements.length > 0) {
      log.push(`Measured: ${result.measurements.map((m) => `q${m.qubit}=${m.outcome}`).join(', ')}`);
    }

    return {
      ok: true,
      mode: 'noisy',
      nQubits,
      gateInstructions,
      densityMatrix: result.densityMatrix,
      blochVectorsDM: result.blochVectors,
      measurements: result.measurements,
      seed,
      analysisSummary: buildAnalysisSummary({
        densityMatrix: result.densityMatrix,
        nQubits,
        ...analysisOptions,
      }),
      log,
    };
  }

  await onProgress?.({ phase: 'statevector', completed: 0, total: 1 });
  const result = executeProgram(instructions, nQubits, customGates, { rng });
  const log = [`Complete. ${result.gateCount} gate${result.gateCount !== 1 ? 's' : ''} applied.`];
  if (result.measurements.length > 0) {
    log.push(`Measured: ${result.measurements.map((m) => `q${m.qubit}=${m.outcome}`).join(', ')}`);
  }

  return {
    ok: true,
    mode: 'statevector',
    nQubits,
    gateInstructions,
    state: result.state,
    measurements: result.measurements,
    seed,
    analysisSummary: buildAnalysisSummary({
      state: result.state,
      nQubits,
      ...analysisOptions,
    }),
    log,
  };
}
