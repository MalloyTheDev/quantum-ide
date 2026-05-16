import { useCallback, useEffect, useMemo, useRef } from 'react';
import { parse, getGateInstructions, formatInstruction } from '../engine/parser.js';
import { exportToQASM, importFromQASMWithDiagnostics } from '../engine/qasm.js';
import { createState, executeInstruction } from '../engine/simulator.js';
import EXAMPLES from '../data/examples.js';
import { loadSession, saveSession } from '../services/persistence.js';
import { cancelSimulationWorker, runSimulationInWorker } from '../services/simulationWorkerClient.js';
import { INITIAL_CODE, NEW_PROGRAM, useWorkspaceStore } from '../stores/workspaceStore.js';
import { DEFAULT_NOISE_CONFIG, useSimulationStore } from '../stores/simulationStore.js';
import { usePreferencesStore } from '../stores/preferencesStore.js';

function basename(filePath) {
  return filePath ? filePath.split(/[\\/]/).pop() : 'untitled.qs';
}

function formatProgress(progress) {
  if (!progress) return null;
  if (progress.phase === 'shots' && progress.total > 1) {
    return `Running shots ${progress.completed.toLocaleString()}/${progress.total.toLocaleString()}...`;
  }
  if (progress.phase === 'parse') return 'Parsing program...';
  if (progress.phase === 'noisy') return 'Running noisy simulation...';
  return 'Running program...';
}

function runCompletePatch(result) {
  const successLog = result.log.map((entry, index) => (index === 0 ? `✓ ${entry}` : `  ${entry}`));

  if (result.mode === 'histogram') {
    return {
      nQubits: result.nQubits,
      gateInstructions: result.gateInstructions,
      histogramData: result.histogramData,
      state: null,
      measurements: [],
      densityMatrix: null,
      blochVectorsDM: null,
      stepIndex: null,
      errors: [],
      log: successLog,
    };
  }

  if (result.mode === 'noisy') {
    return {
      nQubits: result.nQubits,
      gateInstructions: result.gateInstructions,
      histogramData: null,
      state: null,
      densityMatrix: result.densityMatrix,
      blochVectorsDM: result.blochVectorsDM,
      measurements: result.measurements,
      stepIndex: null,
      errors: [],
      log: successLog,
    };
  }

  return {
    nQubits: result.nQubits,
    gateInstructions: result.gateInstructions,
    histogramData: null,
    state: result.state,
    densityMatrix: null,
    blochVectorsDM: null,
    measurements: result.measurements,
    stepIndex: null,
    errors: [],
    log: successLog,
  };
}

export function useIdeController() {
  const workspace = useWorkspaceStore();
  const simulation = useSimulationStore();
  const preferences = usePreferencesStore();

  const stateRef = useRef(null);
  const measRef = useRef([]);
  const debounceTimerRef = useRef(null);
  const runTokenRef = useRef(0);

  const flushHistory = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    useWorkspaceStore.getState().pushHistory();
  }, []);

  const resetSimulationRefs = useCallback(() => {
    stateRef.current = null;
    measRef.current = [];
  }, []);

  useEffect(() => {
    const { instructions, nQubits, errors } = parse(workspace.code);
    const gates = errors.length > 0 ? [] : getGateInstructions(instructions);

    resetSimulationRefs();
    useSimulationStore.setState({
      errors,
      gateInstructions: gates,
      nQubits: errors.length > 0 ? 0 : nQubits,
      histogramData: null,
      state: null,
      measurements: [],
      densityMatrix: null,
      blochVectorsDM: null,
      stepIndex: null,
    });
  }, [resetSimulationRefs, workspace.code]);

  const handleReset = useCallback(() => {
    runTokenRef.current += 1;
    cancelSimulationWorker();
    useSimulationStore.getState().resetSimulation();
    resetSimulationRefs();
  }, [resetSimulationRefs]);

  const confirmDiscard = useCallback(() => {
    if (!useWorkspaceStore.getState().isDirty) return true;
    return window.confirm('Discard unsaved changes?');
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSession().then((session) => {
      if (cancelled) return;
      if (session?.code) {
        useWorkspaceStore.getState().replaceDocument(session.code, {
          filePath: session.currentFilePath ?? null,
          dirty: session.isDirty ?? false,
        });
      }
      if (Number.isFinite(session?.shots)) {
        useSimulationStore.getState().setShots(Math.max(1, Math.min(10000, session.shots)));
      }
      if (session?.noiseConfig) {
        useSimulationStore.getState().setNoiseConfig({
          ...DEFAULT_NOISE_CONFIG,
          ...session.noiseConfig,
        });
      }
      usePreferencesStore.getState().hydratePreferences({
        showPalette: session?.showPalette,
        recentFiles: session?.recentFiles,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!preferences.hasHydrated) return;
    const timer = setTimeout(() => {
      saveSession({
        code: workspace.code,
        currentFilePath: workspace.currentFilePath,
        isDirty: workspace.isDirty,
        shots: simulation.shots,
        noiseConfig: simulation.noiseConfig,
        showPalette: preferences.showPalette,
        recentFiles: preferences.recentFiles,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [
    preferences.hasHydrated,
    preferences.recentFiles,
    preferences.showPalette,
    simulation.noiseConfig,
    simulation.shots,
    workspace.code,
    workspace.currentFilePath,
    workspace.isDirty,
  ]);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.setTitle(`${workspace.isDirty ? '● ' : ''}${basename(workspace.currentFilePath)} - Quantum IDE`);
  }, [workspace.currentFilePath, workspace.isDirty]);

  useEffect(() => {
    if (!window.electronAPI?.setRecentFiles) return;
    window.electronAPI.setRecentFiles(preferences.recentFiles);
  }, [preferences.recentFiles]);

  useEffect(() => {
    window.onbeforeunload = workspace.isDirty ? () => 'You have unsaved changes. Quit anyway?' : null;
    return () => {
      window.onbeforeunload = null;
    };
  }, [workspace.isDirty]);

  const handleCodeChange = useCallback((code) => {
    useWorkspaceStore.getState().setCode(code, { dirty: true });
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      useWorkspaceStore.getState().pushHistory(code);
    }, 500);
  }, []);

  const handleUndo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    useWorkspaceStore.getState().undo();
  }, []);

  const handleRedo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    useWorkspaceStore.getState().redo();
  }, []);

  const handleRun = useCallback(async () => {
    flushHistory();
    const { code } = useWorkspaceStore.getState();
    const { shots, noiseConfig } = useSimulationStore.getState();
    const token = runTokenRef.current + 1;
    runTokenRef.current = token;
    cancelSimulationWorker();

    useSimulationStore
      .getState()
      .startRun(
        shots > 1
          ? `▶ Running program ${shots.toLocaleString()} times...`
          : noiseConfig.enabled
            ? `▶ Running noisy program (${noiseConfig.model}, ${(noiseConfig.strength * 100).toFixed(1)}%)...`
            : '▶ Running program...'
      );

    try {
      const result = await runSimulationInWorker({ code, shots, noiseConfig }, (progress) => {
        if (runTokenRef.current !== token) return;
        useSimulationStore.getState().setRunProgress(progress);
        const message = formatProgress(progress);
        if (message) {
          useSimulationStore.setState({ log: [message] });
        }
      });

      if (runTokenRef.current !== token) return;

      if (!result.ok) {
        useSimulationStore.getState().failRun(result.errors, result.log ?? []);
        return;
      }

      const patch = runCompletePatch(result);
      useSimulationStore.getState().finishRun(patch);
      stateRef.current = result.mode === 'statevector' ? result.state : null;
      measRef.current = result.measurements ?? [];
    } catch (err) {
      if (runTokenRef.current !== token) return;
      useSimulationStore.getState().failRun([], [`Run failed: ${err.message}`]);
    }
  }, [flushHistory]);

  const handleCancelRun = useCallback(() => {
    runTokenRef.current += 1;
    cancelSimulationWorker();
    useSimulationStore.setState({
      isRunning: false,
      runProgress: null,
      log: [...useSimulationStore.getState().log, 'Run cancelled.'],
    });
  }, []);

  const handleStep = useCallback(() => {
    const { code } = useWorkspaceStore.getState();
    const { instructions, nQubits, errors, customGates } = parse(code);

    if (errors.length > 0) {
      useSimulationStore.setState({ errors });
      return;
    }

    const gates = getGateInstructions(instructions);
    const currentStep = useSimulationStore.getState().stepIndex;
    const nextIdx = currentStep === null ? 0 : currentStep + 1;

    if (nextIdx >= gates.length) {
      useSimulationStore.getState().appendLog(['✓ End of program reached.']);
      return;
    }

    let state;
    let measurements;
    if (nextIdx === 0) {
      state = createState(nQubits);
      measurements = [];
      useSimulationStore.setState({
        nQubits,
        log: ['⏩ Stepping through program...'],
      });
    } else {
      state = stateRef.current;
      measurements = measRef.current;
    }

    const inst = gates[nextIdx];
    const result = executeInstruction(inst, state, nQubits, measurements, customGates);
    stateRef.current = result.state;
    measRef.current = result.measurements;

    useSimulationStore.setState({
      errors: [],
      histogramData: null,
      densityMatrix: null,
      blochVectorsDM: null,
      gateInstructions: gates,
      state: result.state,
      measurements: result.measurements,
      stepIndex: nextIdx,
      nQubits,
      log: [...useSimulationStore.getState().log, `Step ${nextIdx + 1}/${gates.length}: ${formatInstruction(inst)}`],
    });
  }, []);

  const handleNew = useCallback(() => {
    if (!confirmDiscard()) return;
    useWorkspaceStore.getState().replaceDocument(NEW_PROGRAM, { dirty: false });
    handleReset();
  }, [confirmDiscard, handleReset]);

  const handleLoadExample = useCallback(
    (name) => {
      if (!EXAMPLES[name]) return;
      if (!confirmDiscard()) return;
      useWorkspaceStore.getState().replaceDocument(EXAMPLES[name].code, { dirty: false });
      handleReset();
    },
    [confirmDiscard, handleReset]
  );

  const loadDocument = useCallback(
    (content, filePath, dirty = false) => {
      useWorkspaceStore.getState().replaceDocument(content, { filePath, dirty });
      if (filePath) usePreferencesStore.getState().addRecentFile(filePath);
      handleReset();
    },
    [handleReset]
  );

  const handleOpen = useCallback(async () => {
    if (!window.electronAPI) return;
    if (!confirmDiscard()) return;
    const result = await window.electronAPI.openFile();
    if (!result || result.error) return;
    loadDocument(result.content, result.filePath, false);
    useSimulationStore.setState({ log: [`Opened: ${basename(result.filePath)}`] });
  }, [confirmDiscard, loadDocument]);

  const handleOpenPath = useCallback(
    async (filePath) => {
      if (!window.electronAPI?.openPath) return;
      if (!confirmDiscard()) return;
      const result = await window.electronAPI.openPath(filePath);
      if (!result || result.error) return;
      loadDocument(result.content, result.filePath, false);
      useSimulationStore.setState({ log: [`Opened: ${basename(result.filePath)}`] });
    },
    [confirmDiscard, loadDocument]
  );

  const handleSave = useCallback(async () => {
    if (!window.electronAPI) return;
    const { code, currentFilePath } = useWorkspaceStore.getState();
    const result = currentFilePath
      ? await window.electronAPI.saveFile(code, currentFilePath)
      : await window.electronAPI.saveFileAs(code);
    if (result?.success) {
      useWorkspaceStore.getState().markSaved(result.filePath);
      usePreferencesStore.getState().addRecentFile(result.filePath);
      useSimulationStore.getState().appendLog([`Saved: ${basename(result.filePath)}`]);
    }
  }, []);

  const handleSaveAs = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.saveFileAs(useWorkspaceStore.getState().code);
    if (result?.success) {
      useWorkspaceStore.getState().markSaved(result.filePath);
      usePreferencesStore.getState().addRecentFile(result.filePath);
      useSimulationStore.getState().appendLog([`Saved as: ${basename(result.filePath)}`]);
    }
  }, []);

  const handleExportQASM = useCallback(() => {
    const { code } = useWorkspaceStore.getState();
    const { instructions, nQubits, errors, customGates } = parse(code);
    if (errors.length > 0) {
      useSimulationStore.setState({ errors });
      useSimulationStore.getState().appendLog(['Fix parse errors before exporting QASM.']);
      return;
    }

    const qasmStr = exportToQASM(instructions, nQubits, customGates);
    if (window.electronAPI?.saveFileDialog) {
      window.electronAPI.saveFileDialog(qasmStr, 'circuit.qasm').then((result) => {
        if (result?.success) {
          useSimulationStore.getState().appendLog([`Exported QASM: ${basename(result.filePath)}`]);
        }
      });
      return;
    }

    const blob = new Blob([qasmStr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circuit.qasm';
    a.click();
    URL.revokeObjectURL(url);
    useSimulationStore.getState().appendLog(['Exported QASM (downloaded).']);
  }, []);

  const handleImportQASM = useCallback(() => {
    if (!confirmDiscard()) return;
    const doImport = (content) => {
      const { code, diagnostics } = importFromQASMWithDiagnostics(content);
      useWorkspaceStore.getState().replaceDocument(code || INITIAL_CODE, { dirty: true });
      handleReset();
      useSimulationStore.setState({
        log: ['Imported QASM.', ...diagnostics.map((d) => `Import note: ${d.msg}`)],
      });
    };

    if (window.electronAPI?.openFileDialog) {
      window.electronAPI
        .openFileDialog([
          { name: 'OpenQASM', extensions: ['qasm'] },
          { name: 'All Files', extensions: ['*'] },
        ])
        .then((content) => {
          if (content) doImport(content);
        });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.qasm,.qs,.txt';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => doImport(e.target.result);
      reader.readAsText(file);
    };
    input.click();
  }, [confirmDiscard, handleReset]);

  const handleGateDrop = useCallback((gateName, qubitIndex, colIndex) => {
    const g = gateName.toUpperCase();
    let dslLine;

    switch (g) {
      case 'H':
      case 'X':
      case 'Y':
      case 'Z':
      case 'S':
      case 'T':
      case 'SDG':
      case 'TDG':
        dslLine = `${g} ${qubitIndex}`;
        break;
      case 'CNOT':
        dslLine = `CNOT ${qubitIndex} ${qubitIndex + 1}`;
        break;
      case 'CZ':
      case 'CS':
      case 'CT':
      case 'SWAP':
        dslLine = `${g} ${qubitIndex} ${qubitIndex + 1}`;
        break;
      case 'CCX':
        dslLine = `CCX ${qubitIndex} ${qubitIndex + 1} ${qubitIndex + 2}`;
        break;
      case 'CSWAP':
        dslLine = `CSWAP ${qubitIndex} ${qubitIndex + 1} ${qubitIndex + 2}`;
        break;
      case 'MEASURE':
        dslLine = `MEASURE ${qubitIndex}`;
        break;
      default:
        return;
    }

    const { code } = useWorkspaceStore.getState();
    const { gateInstructions } = useSimulationStore.getState();
    const lines = code.split('\n');
    const insertAfterLine = colIndex < gateInstructions.length ? gateInstructions[colIndex].line : lines.length - 1;
    const nextCode = [...lines.slice(0, insertAfterLine + 1), dslLine, ...lines.slice(insertAfterLine + 1)].join('\n');

    useWorkspaceStore.getState().setCode(nextCode, { dirty: true });
    useWorkspaceStore.getState().pushHistory(nextCode);
  }, []);

  const handleGateDropAngle = useCallback((gateName, qubitIndex, angle, colIndex) => {
    const { code } = useWorkspaceStore.getState();
    const { gateInstructions } = useSimulationStore.getState();
    const lines = code.split('\n');
    const insertAfterLine =
      colIndex !== undefined && colIndex >= 0 && colIndex < gateInstructions.length
        ? gateInstructions[colIndex].line
        : lines.length - 1;
    const nextCode = [
      ...lines.slice(0, insertAfterLine + 1),
      `${gateName.toUpperCase()} ${angle} ${qubitIndex}`,
      ...lines.slice(insertAfterLine + 1),
    ].join('\n');

    useWorkspaceStore.getState().setCode(nextCode, { dirty: true });
    useWorkspaceStore.getState().pushHistory(nextCode);
  }, []);

  const setShots = useCallback((value) => {
    const shots = Number.isFinite(value) ? Math.max(1, Math.min(10000, value)) : 1;
    useSimulationStore.getState().setShots(shots);
  }, []);

  const setNoiseConfig = useCallback((noiseConfig) => {
    useSimulationStore.getState().setNoiseConfig(noiseConfig);
  }, []);

  const setShowBloch = useCallback((showBloch) => {
    usePreferencesStore.getState().setShowBloch(showBloch);
  }, []);

  const setShowRhoMatrix = useCallback((showRhoMatrix) => {
    usePreferencesStore.getState().setShowRhoMatrix(showRhoMatrix);
  }, []);

  const setShowCommandPalette = useCallback((showCommandPalette) => {
    usePreferencesStore.getState().setShowCommandPalette(showCommandPalette);
  }, []);

  const togglePalette = useCallback(() => {
    usePreferencesStore.getState().setShowPalette(!usePreferencesStore.getState().showPalette);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && !e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      } else if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handleStep();
      } else if (e.ctrlKey && !e.shiftKey && e.key === 'r') {
        e.preventDefault();
        handleReset();
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleStep();
      } else if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        handleRedo();
      } else if (e.ctrlKey && !e.shiftKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleSaveAs();
      } else if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        handleOpen();
      } else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNew();
      } else if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      } else if (e.key === 'Escape' && usePreferencesStore.getState().showCommandPalette) {
        e.preventDefault();
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    handleNew,
    handleOpen,
    handleRedo,
    handleReset,
    handleRun,
    handleSave,
    handleSaveAs,
    handleStep,
    handleUndo,
    setShowCommandPalette,
  ]);

  useEffect(() => {
    if (!window.electronAPI?.onMenuCommand) return;
    return window.electronAPI.onMenuCommand(({ command, filePath } = {}) => {
      if (command === 'new') handleNew();
      else if (command === 'open') handleOpen();
      else if (command === 'open-recent') handleOpenPath(filePath);
      else if (command === 'save') handleSave();
      else if (command === 'save-as') handleSaveAs();
      else if (command === 'export-qasm') handleExportQASM();
      else if (command === 'import-qasm') handleImportQASM();
      else if (command === 'run') handleRun();
      else if (command === 'step') handleStep();
      else if (command === 'reset') handleReset();
    });
  }, [
    handleExportQASM,
    handleImportQASM,
    handleNew,
    handleOpen,
    handleOpenPath,
    handleReset,
    handleRun,
    handleSave,
    handleSaveAs,
    handleStep,
  ]);

  const activeLine =
    simulation.stepIndex !== null && simulation.gateInstructions[simulation.stepIndex]
      ? simulation.gateInstructions[simulation.stepIndex].line
      : null;

  return useMemo(
    () => ({
      ...workspace,
      ...simulation,
      ...preferences,
      activeLine,
      errorLines: simulation.errors.map((e) => e.line),
      handleCancelRun,
      handleCodeChange,
      handleExportQASM,
      handleGateDrop,
      handleGateDropAngle,
      handleImportQASM,
      handleLoadExample,
      handleNew,
      handleOpen,
      handleRedo,
      handleReset,
      handleRun,
      handleSave,
      handleSaveAs,
      handleStep,
      handleUndo,
      setNoiseConfig,
      setShots,
      setShowBloch,
      setShowCommandPalette,
      setShowRhoMatrix,
      togglePalette,
    }),
    [
      activeLine,
      handleCancelRun,
      handleCodeChange,
      handleExportQASM,
      handleGateDrop,
      handleGateDropAngle,
      handleImportQASM,
      handleLoadExample,
      handleNew,
      handleOpen,
      handleRedo,
      handleReset,
      handleRun,
      handleSave,
      handleSaveAs,
      handleStep,
      handleUndo,
      preferences,
      setNoiseConfig,
      setShots,
      setShowBloch,
      setShowCommandPalette,
      setShowRhoMatrix,
      simulation,
      togglePalette,
      workspace,
    ]
  );
}
