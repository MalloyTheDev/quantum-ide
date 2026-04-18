import { useState, useCallback, useRef, useEffect } from 'react';
import { parse, getGateInstructions, formatInstruction } from './engine/parser.js';
import { exportToQASM, importFromQASM } from './engine/qasm.js';
import { createState, executeInstruction, executeProgram, runMultiShot, executeNoisyProgram } from './engine/simulator.js';
import EXAMPLES from './data/examples.js';
import { T } from './styles/tokens.js';

import Toolbar from './components/Toolbar.jsx';
import CodeEditor from './components/CodeEditor.jsx';
import CircuitDiagram from './components/CircuitDiagram.jsx';
import StateInspector from './components/StateInspector.jsx';
import Histogram from './components/Histogram.jsx';
import BlochSphere from './components/BlochSphere.jsx';
import LogPanel from './components/LogPanel.jsx';
import DSLReference from './components/DSLReference.jsx';
import PanelHeader from './components/PanelHeader.jsx';
import GatePalette from './components/GatePalette.jsx';
import NoiseControls from './components/NoiseControls.jsx';
import DensityMatrixView from './components/DensityMatrixView.jsx';

const INITIAL_CODE = EXAMPLES["Bell State"].code;

export default function App() {
  // ── Editor state ──
  const [code, setCode] = useState(INITIAL_CODE);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ── File state ──
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  // ── Simulator state ──
  const [state, setState] = useState(null);
  const [nQubits, setNQubits] = useState(0);
  const [measurements, setMeasurements] = useState([]);
  const [gateInstructions, setGateInstructions] = useState([]);

  // ── Multi-shot state ──
  const [shots, setShots] = useState(1);
  const [histogramData, setHistogramData] = useState(null);

  // ── Debugger state ──
  const [stepIndex, setStepIndex] = useState(null);
  const stateRef = useRef(null);
  const measRef = useRef([]);

  // ── History refs (undo/redo) ──
  const historyRef = useRef([INITIAL_CODE]);
  const historyIdxRef = useRef(0);
  const debounceTimerRef = useRef(null);

  // ── UI state ──
  const [errors, setErrors] = useState([]);
  const [log, setLog] = useState([]);
  const [showBloch, setShowBloch] = useState(false);
  const [showPalette, setShowPalette] = useState(true);

  // ── Noise / density matrix state ──
  const [noiseConfig, setNoiseConfig] = useState({ enabled: false, model: 'depolarizing', strength: 0.01 });
  const [densityMatrix, setDensityMatrix] = useState(null);
  const [blochVectorsDM, setBlochVectorsDM] = useState(null);
  const [showRhoMatrix, setShowRhoMatrix] = useState(false);

  // ── Derived: active line for editor highlighting ──
  const activeLine = stepIndex !== null && gateInstructions[stepIndex]
    ? gateInstructions[stepIndex].line
    : null;
  const errorLines = errors.map(e => e.line);

  // ── History management ──

  const pushHistory = useCallback((newCode) => {
    const history = historyRef.current;
    const idx = historyIdxRef.current;
    if (history[idx] === newCode) return;
    const newHistory = history.slice(0, idx + 1);
    newHistory.push(newCode);
    if (newHistory.length > 100) newHistory.shift();
    historyRef.current = newHistory;
    historyIdxRef.current = newHistory.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    historyIdxRef.current = newIdx;
    setCode(historyRef.current[newIdx]);
    setIsDirty(true);
    setCanUndo(newIdx > 0);
    setCanRedo(true);
  }, []);

  const handleRedo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const idx = historyIdxRef.current;
    const history = historyRef.current;
    if (idx >= history.length - 1) return;
    const newIdx = idx + 1;
    historyIdxRef.current = newIdx;
    setCode(history[newIdx]);
    setIsDirty(true);
    setCanUndo(true);
    setCanRedo(newIdx < history.length - 1);
  }, []);

  // ── Code change (marks file dirty, debounces history push) ──
  const handleCodeChange = useCallback((newCode) => {
    setCode(newCode);
    setIsDirty(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      pushHistory(newCode);
    }, 500);
  }, [pushHistory]);

  // ── Window title sync ──
  useEffect(() => {
    if (!window.electronAPI) return;
    const name = currentFilePath
      ? currentFilePath.split(/[\\/]/).pop()
      : 'untitled.qs';
    window.electronAPI.setTitle(`${isDirty ? '● ' : ''}${name} - Quantum IDE`);
  }, [currentFilePath, isDirty]);

  // ── Unsaved-changes guard on window/app close ──
  useEffect(() => {
    window.onbeforeunload = isDirty
      ? () => 'You have unsaved changes. Quit anyway?'
      : null;
    return () => { window.onbeforeunload = null; };
  }, [isDirty]);

  const confirmDiscard = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm('Discard unsaved changes?');
  }, [isDirty]);

  // ── Simulator actions ──

  const handleRun = useCallback(() => {
    // Flush pending debounce and snapshot current code before running
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pushHistory(code);

    const { instructions, nQubits: nQ, errors: parseErrors, customGates } = parse(code);

    if (parseErrors.length > 0) {
      setErrors(parseErrors);
      return;
    }

    setErrors([]);
    setStepIndex(null);

    const gates = getGateInstructions(instructions);
    setGateInstructions(gates);
    setNQubits(nQ);

    if (shots > 1) {
      // ── Multi-shot path ──
      setLog([`▶ Running program ${shots.toLocaleString()} times...`]);
      const data = runMultiShot(instructions, nQ, shots, customGates);
      const distinct = Object.keys(data).length;

      setHistogramData(data);
      setState(null);
      setMeasurements([]);
      setDensityMatrix(null);
      setBlochVectorsDM(null);
      stateRef.current = null;
      measRef.current = [];

      setLog(prev => [
        ...prev,
        `✓ Complete. ${shots.toLocaleString()} shots, ${distinct} distinct outcome${distinct !== 1 ? 's' : ''}.`,
      ]);
    } else if (noiseConfig.enabled) {
      // ── Noisy single-shot path (density matrix) ──
      setHistogramData(null);
      setLog([`▶ Running noisy program (${noiseConfig.model}, ${(noiseConfig.strength * 100).toFixed(1)}%)...`]);

      const result = executeNoisyProgram(instructions, nQ, noiseConfig, customGates);

      setState(null);
      setDensityMatrix(result.densityMatrix);
      setBlochVectorsDM(result.blochVectors);
      setMeasurements(result.measurements);
      stateRef.current = null;
      measRef.current = result.measurements;

      const gateCount = instructions.filter(i => i.type !== 'qubits').length;
      const msgs = [`✓ Complete (noisy). ${gateCount} instruction${gateCount !== 1 ? 's' : ''} applied.`];
      if (result.measurements.length > 0) {
        const bits = result.measurements.map(m => `q${m.qubit}=${m.outcome}`).join(', ');
        msgs.push(`  Measured: ${bits}`);
      }
      setLog(prev => [...prev, ...msgs]);
    } else {
      // ── Single-shot path (state vector) ──
      setHistogramData(null);
      setDensityMatrix(null);
      setBlochVectorsDM(null);
      setLog(["▶ Running program..."]);

      const result = executeProgram(instructions, nQ, customGates);

      setState(result.state);
      setMeasurements(result.measurements);
      stateRef.current = result.state;
      measRef.current = result.measurements;

      const msgs = [`✓ Complete. ${result.gateCount} gate${result.gateCount !== 1 ? "s" : ""} applied.`];
      if (result.measurements.length > 0) {
        const bits = result.measurements.map(m => `q${m.qubit}=${m.outcome}`).join(", ");
        msgs.push(`  Measured: ${bits}`);
      }
      setLog(prev => [...prev, ...msgs]);
    }
  }, [code, shots, noiseConfig, pushHistory]);

  const handleStep = useCallback(() => {
    const { instructions, nQubits: nQ, errors: parseErrors, customGates } = parse(code);

    if (parseErrors.length > 0) {
      setErrors(parseErrors);
      return;
    }

    setErrors([]);
    setHistogramData(null);
    setDensityMatrix(null);
    setBlochVectorsDM(null);
    const gates = getGateInstructions(instructions);
    setGateInstructions(gates);

    const nextIdx = stepIndex === null ? 0 : stepIndex + 1;

    if (nextIdx >= gates.length) {
      setLog(p => [...p, "✓ End of program reached."]);
      return;
    }

    let s, m;
    if (nextIdx === 0) {
      s = createState(nQ);
      m = [];
      setNQubits(nQ);
      setLog(["⏩ Stepping through program..."]);
    } else {
      s = stateRef.current;
      m = measRef.current;
    }

    const inst = gates[nextIdx];
    const result = executeInstruction(inst, s, nQ, m, customGates);

    setState(result.state);
    setMeasurements(result.measurements);
    stateRef.current = result.state;
    measRef.current = result.measurements;

    const desc = formatInstruction(inst);
    setLog(p => [...p, `Step ${nextIdx + 1}/${gates.length}: ${desc}`]);

    setStepIndex(() => nextIdx);
  }, [code, stepIndex]);

  const handleReset = useCallback(() => {
    setState(null);
    setNQubits(0);
    setMeasurements([]);
    setGateInstructions([]);
    setStepIndex(null);
    setErrors([]);
    setLog([]);
    setHistogramData(null);
    setDensityMatrix(null);
    setBlochVectorsDM(null);
    stateRef.current = null;
    measRef.current = [];
  }, []);

  const handleLoadExample = useCallback((name) => {
    if (EXAMPLES[name]) {
      if (!confirmDiscard()) return;
      const newCode = EXAMPLES[name].code;
      setCode(newCode);
      setCurrentFilePath(null);
      setIsDirty(false);
      historyRef.current = [newCode];
      historyIdxRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      handleReset();
    }
  }, [handleReset, confirmDiscard]);

  // ── File I/O actions ──

  const handleOpen = useCallback(async () => {
    if (!window.electronAPI) return;
    if (!confirmDiscard()) return;
    const result = await window.electronAPI.openFile();
    if (!result || result.error) return;
    setCode(result.content);
    setCurrentFilePath(result.filePath);
    setIsDirty(false);
    historyRef.current = [result.content];
    historyIdxRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
    handleReset();
    setLog([`📂 Opened: ${result.filePath.split(/[\\/]/).pop()}`]);
  }, [handleReset, confirmDiscard]);

  const handleSave = useCallback(async () => {
    if (!window.electronAPI) return;
    if (currentFilePath) {
      const result = await window.electronAPI.saveFile(code, currentFilePath);
      if (result?.success) {
        setIsDirty(false);
        setLog(prev => [...prev, `💾 Saved: ${currentFilePath.split(/[\\/]/).pop()}`]);
      }
    } else {
      const result = await window.electronAPI.saveFileAs(code);
      if (result?.success) {
        setCurrentFilePath(result.filePath);
        setIsDirty(false);
        setLog(prev => [...prev, `💾 Saved: ${result.filePath.split(/[\\/]/).pop()}`]);
      }
    }
  }, [code, currentFilePath]);

  const handleSaveAs = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.saveFileAs(code);
    if (result?.success) {
      setCurrentFilePath(result.filePath);
      setIsDirty(false);
      setLog(prev => [...prev, `💾 Saved as: ${result.filePath.split(/[\\/]/).pop()}`]);
    }
  }, [code]);

  // ── QASM Import / Export ──

  const handleExportQASM = useCallback(() => {
    const { instructions, nQubits: nQ, errors: parseErrors, customGates } = parse(code);
    if (parseErrors.length > 0) {
      setErrors(parseErrors);
      setLog(prev => [...prev, '✗ Fix parse errors before exporting QASM.']);
      return;
    }
    const qasmStr = exportToQASM(instructions, nQ, customGates);

    if (window.electronAPI?.saveFileDialog) {
      window.electronAPI.saveFileDialog(qasmStr, 'circuit.qasm').then(result => {
        if (result?.success) {
          setLog(prev => [...prev, `↑ Exported QASM: ${result.filePath.split(/[\\/]/).pop()}`]);
        }
      });
    } else {
      // Web fallback: Blob download
      const blob = new Blob([qasmStr], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'circuit.qasm';
      a.click();
      URL.revokeObjectURL(url);
      setLog(prev => [...prev, '↑ Exported QASM (downloaded).']);
    }
  }, [code]);

  const handleImportQASM = useCallback(() => {
    if (!confirmDiscard()) return;
    const doImport = (content) => {
      const dslCode = importFromQASM(content);
      setCode(dslCode);
      setCurrentFilePath(null);
      setIsDirty(true);
      historyRef.current = [dslCode];
      historyIdxRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      handleReset();
      setLog([`↓ Imported QASM.`]);
    };

    if (window.electronAPI?.openFileDialog) {
      window.electronAPI.openFileDialog([
        { name: 'OpenQASM', extensions: ['qasm'] },
        { name: 'All Files', extensions: ['*'] },
      ]).then(content => {
        if (content) doImport(content);
      });
    } else {
      // Web fallback: hidden file input
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
    }
  }, [handleReset, confirmDiscard]);

  // ── Drag-and-drop gate insertion ──

  const handleGateDrop = useCallback((gateName, qubitIndex, colIndex) => {
    const g = gateName.toUpperCase();
    let dslLine;

    switch (g) {
      case 'H': case 'X': case 'Y': case 'Z':
      case 'S': case 'T': case 'SDG': case 'TDG':
        dslLine = `${g} ${qubitIndex}`;
        break;
      case 'CNOT':
        dslLine = `CNOT ${qubitIndex} ${qubitIndex + 1}`;
        break;
      case 'CZ':
        dslLine = `CZ ${qubitIndex} ${qubitIndex + 1}`;
        break;
      case 'CS':
        dslLine = `CS ${qubitIndex} ${qubitIndex + 1}`;
        break;
      case 'CT':
        dslLine = `CT ${qubitIndex} ${qubitIndex + 1}`;
        break;
      case 'SWAP':
        dslLine = `SWAP ${qubitIndex} ${qubitIndex + 1}`;
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

    const lines = code.split('\n');
    const insertAfterLine = colIndex < gateInstructions.length
      ? gateInstructions[colIndex].line
      : lines.length - 1;

    const newLines = [
      ...lines.slice(0, insertAfterLine + 1),
      dslLine,
      ...lines.slice(insertAfterLine + 1),
    ];
    const newCode = newLines.join('\n');
    setCode(newCode);
    setIsDirty(true);
    pushHistory(newCode);
  }, [code, gateInstructions, pushHistory]);

  const handleGateDropAngle = useCallback((gateName, qubitIndex, angle, colIndex) => {
    const dslLine = `${gateName.toUpperCase()} ${angle} ${qubitIndex}`;
    const lines = code.split('\n');
    const insertAfterLine = colIndex !== undefined && colIndex >= 0 && colIndex < gateInstructions.length
      ? gateInstructions[colIndex].line
      : lines.length - 1;
    const newLines = [
      ...lines.slice(0, insertAfterLine + 1),
      dslLine,
      ...lines.slice(insertAfterLine + 1),
    ];
    const newCode = newLines.join('\n');
    setCode(newCode);
    setIsDirty(true);
    pushHistory(newCode);
  }, [code, gateInstructions, pushHistory]);

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const handler = (e) => {
      if      (e.ctrlKey && !e.shiftKey && e.key === 'Enter') { e.preventDefault(); handleRun(); }
      else if (e.ctrlKey &&  e.shiftKey && e.key === 'Enter') { e.preventDefault(); handleStep(); }
      else if (e.ctrlKey && !e.shiftKey && e.key === 'r')     { e.preventDefault(); handleReset(); }
      else if (e.key === 'F10')                                { e.preventDefault(); handleStep(); }
      else if (e.ctrlKey && !e.shiftKey && e.key === 'z')     { e.preventDefault(); handleUndo(); }
      else if (e.ctrlKey &&  e.shiftKey && e.key === 'Z')     { e.preventDefault(); handleRedo(); }
      else if (e.ctrlKey && !e.shiftKey && e.key === 'y')     { e.preventDefault(); handleRedo(); }
      else if (e.ctrlKey && !e.shiftKey && e.key === 's')     { e.preventDefault(); handleSave(); }
      else if (e.ctrlKey &&  e.shiftKey && e.key === 'S')     { e.preventDefault(); handleSaveAs(); }
      else if (e.ctrlKey && e.key === 'o')                    { e.preventDefault(); handleOpen(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRun, handleStep, handleReset, handleUndo, handleRedo, handleSave, handleSaveAs, handleOpen]);

  // ── Render ──

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100vw",
      background: T.bg.app,
      color: T.text.primary,
      fontFamily: T.font.mono,
      overflow: "hidden",
    }}>
      <Toolbar
        onRun={handleRun}
        onStep={handleStep}
        onReset={handleReset}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onLoadExample={handleLoadExample}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportQASM={handleExportQASM}
        onImportQASM={handleImportQASM}
        currentFilePath={currentFilePath}
        isDirty={isDirty}
        shots={shots}
        onShotsChange={setShots}
        showPalette={showPalette}
        onTogglePalette={() => setShowPalette(p => !p)}
      />

      <NoiseControls
        noiseConfig={noiseConfig}
        onChange={setNoiseConfig}
        shots={shots}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {showPalette && <GatePalette />}
        {/* Left: Editor + Log */}
        <div style={{
          width: "42%",
          display: "flex",
          flexDirection: "column",
          borderRight: `1px solid ${T.border.subtle}`,
          minWidth: 0,
        }}>
          <PanelHeader label="EDITOR - Quantum Assembly" />
          <CodeEditor
            code={code}
            onChange={handleCodeChange}
            activeLine={activeLine}
            errorLines={errorLines}
          />
          <LogPanel errors={errors} log={log} />
        </div>

        {/* Right: Circuit + State */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{
            borderBottom: `1px solid ${T.border.subtle}`,
            overflow: "auto",
            minHeight: 80,
            maxHeight: "40%",
          }}>
            <PanelHeader label="CIRCUIT DIAGRAM" />
            <div style={{ padding: `${T.space[4]}px ${T.space[1]}px`, overflow: "auto" }}>
              <CircuitDiagram
                instructions={gateInstructions}
                nQubits={nQubits}
                currentStep={stepIndex}
                onGateDrop={showPalette ? handleGateDrop : undefined}
                onGateDropAngle={showPalette ? handleGateDropAngle : undefined}
              />
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {histogramData ? (
              <Histogram data={histogramData} shots={shots} nQubits={nQubits} />
            ) : (showBloch && shots === 1) ? (
              <BlochSphere
                state={state}
                nQubits={nQubits}
                vectors={blochVectorsDM ?? undefined}
                actions={
                  <button
                    onClick={() => setShowBloch(false)}
                    style={{
                      fontSize: T.font.size.xs,
                      padding: '2px 7px',
                      borderRadius: T.radius.lg,
                      border: `1px solid ${T.accent.secondary}`,
                      background: T.bg.panel,
                      color: T.accent.light,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      lineHeight: '16px',
                    }}
                  >
                    ⊙ Bloch
                  </button>
                }
              />
            ) : (showRhoMatrix && shots === 1) ? (
              <DensityMatrixView
                densityMatrix={densityMatrix}
                nQubits={nQubits}
                actions={
                  <button
                    onClick={() => setShowRhoMatrix(false)}
                    style={{
                      fontSize: T.font.size.xs,
                      padding: '2px 7px',
                      borderRadius: T.radius.lg,
                      border: `1px solid ${T.accent.secondary}`,
                      background: T.bg.panel,
                      color: T.accent.light,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      lineHeight: '16px',
                    }}
                  >
                    ρ Matrix
                  </button>
                }
              />
            ) : (
              <>
                <PanelHeader
                  label="STATE INSPECTOR"
                  actions={shots === 1 ? (
                    <div style={{ display: 'flex', gap: T.space[2] }}>
                      <button
                        onClick={() => { setShowBloch(true); setShowRhoMatrix(false); }}
                        style={{
                          fontSize: T.font.size.xs,
                          padding: '2px 7px',
                          borderRadius: T.radius.lg,
                          border: `1px solid ${T.border.muted}`,
                          background: 'transparent',
                          color: T.text.muted,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          lineHeight: '16px',
                        }}
                      >
                        ⊙ Bloch
                      </button>
                      <button
                        onClick={() => { setShowRhoMatrix(true); setShowBloch(false); }}
                        style={{
                          fontSize: T.font.size.xs,
                          padding: '2px 7px',
                          borderRadius: T.radius.lg,
                          border: `1px solid ${T.border.muted}`,
                          background: 'transparent',
                          color: T.text.muted,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          lineHeight: '16px',
                        }}
                      >
                        ρ Matrix
                      </button>
                    </div>
                  ) : null}
                />
                <StateInspector
                  state={state}
                  nQubits={nQubits}
                  measurements={measurements}
                  probabilities={densityMatrix ? densityMatrix.map((row, i) => row[i][0]) : null}
                />
              </>
            )}
          </div>

          <DSLReference />
        </div>
      </div>
    </div>
  );
}
