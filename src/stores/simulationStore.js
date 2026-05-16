import { create } from 'zustand';

export const DEFAULT_NOISE_CONFIG = {
  enabled: false,
  model: 'depolarizing',
  strength: 0.01,
};

const initialSimulationState = {
  state: null,
  nQubits: 0,
  measurements: [],
  gateInstructions: [],
  shots: 1,
  histogramData: null,
  stepIndex: null,
  errors: [],
  log: [],
  noiseConfig: DEFAULT_NOISE_CONFIG,
  densityMatrix: null,
  blochVectorsDM: null,
  isRunning: false,
  runProgress: null,
};

export const useSimulationStore = create((set, get) => ({
  ...initialSimulationState,

  setShots: (shots) => set({ shots }),
  setNoiseConfig: (noiseConfig) => set({ noiseConfig }),
  setErrors: (errors) => set({ errors }),
  setLog: (log) => set({ log }),
  appendLog: (entries) => set({ log: [...get().log, ...entries] }),
  setStepIndex: (stepIndex) => set({ stepIndex }),

  startRun: (message) =>
    set({
      isRunning: true,
      runProgress: null,
      errors: [],
      log: message ? [message] : [],
      stepIndex: null,
    }),

  setRunProgress: (runProgress) => set({ runProgress }),

  finishRun: (patch) =>
    set({
      ...patch,
      isRunning: false,
      runProgress: null,
    }),

  failRun: (errors, log = []) =>
    set({
      errors,
      log,
      isRunning: false,
      runProgress: null,
    }),

  resetSimulation: () =>
    set({
      state: null,
      nQubits: 0,
      measurements: [],
      gateInstructions: [],
      histogramData: null,
      stepIndex: null,
      errors: [],
      log: [],
      densityMatrix: null,
      blochVectorsDM: null,
      isRunning: false,
      runProgress: null,
    }),
}));
