import * as Comlink from 'comlink';

let worker = null;
let api = null;

function ensureWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/simulation.worker.js', import.meta.url), {
      type: 'module',
    });
    api = Comlink.wrap(worker);
  }
  return api;
}

export function runSimulationInWorker(args, onProgress) {
  return ensureWorker().run(args, Comlink.proxy(onProgress));
}

export function cancelSimulationWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    api = null;
  }
}
