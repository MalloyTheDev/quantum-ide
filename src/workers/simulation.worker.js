import * as Comlink from 'comlink';
import { runSimulationJob } from '../services/simulationRunner.js';

Comlink.expose({
  run: runSimulationJob,
});
