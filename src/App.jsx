import { useIdeController } from './hooks/useIdeController.js';
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
import CommandPalette from './components/CommandPalette.jsx';

function HeaderButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: T.font.size.xs,
        padding: '2px 7px',
        borderRadius: T.radius.lg,
        border: `1px solid ${active ? T.accent.secondary : T.border.muted}`,
        background: active ? T.bg.panel : 'transparent',
        color: active ? T.accent.light : T.text.muted,
        cursor: 'pointer',
        fontFamily: 'inherit',
        lineHeight: '16px',
      }}
    >
      {children}
    </button>
  );
}

export default function App() {
  const ide = useIdeController();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: T.bg.app,
        color: T.text.primary,
        fontFamily: T.font.mono,
        overflow: 'hidden',
      }}
    >
      <Toolbar
        onNew={ide.handleNew}
        onRun={ide.handleRun}
        onCancelRun={ide.handleCancelRun}
        isRunning={ide.isRunning}
        runProgress={ide.runProgress}
        onStep={ide.handleStep}
        onReset={ide.handleReset}
        onUndo={ide.handleUndo}
        onRedo={ide.handleRedo}
        canUndo={ide.canUndo}
        canRedo={ide.canRedo}
        onLoadExample={ide.handleLoadExample}
        onOpen={ide.handleOpen}
        onSave={ide.handleSave}
        onSaveAs={ide.handleSaveAs}
        onExportQASM={ide.handleExportQASM}
        onImportQASM={ide.handleImportQASM}
        currentFilePath={ide.currentFilePath}
        isDirty={ide.isDirty}
        shots={ide.shots}
        onShotsChange={ide.setShots}
        showPalette={ide.showPalette}
        onTogglePalette={ide.togglePalette}
      />

      <NoiseControls noiseConfig={ide.noiseConfig} onChange={ide.setNoiseConfig} shots={ide.shots} />

      <CommandPalette
        open={ide.showCommandPalette}
        onOpenChange={ide.setShowCommandPalette}
        actions={{
          new: ide.handleNew,
          open: ide.handleOpen,
          save: ide.handleSave,
          'save-as': ide.handleSaveAs,
          run: ide.handleRun,
          step: ide.handleStep,
          reset: ide.handleReset,
          'import-qasm': ide.handleImportQASM,
          'export-qasm': ide.handleExportQASM,
        }}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {ide.showPalette && <GatePalette />}

        <div
          style={{
            width: '42%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${T.border.subtle}`,
            minWidth: 0,
          }}
        >
          <PanelHeader label="EDITOR - Quantum Assembly" />
          <CodeEditor
            code={ide.code}
            onChange={ide.handleCodeChange}
            activeLine={ide.activeLine}
            errorLines={ide.errorLines}
            errors={ide.errors}
          />
          <LogPanel errors={ide.errors} log={ide.log} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div
            style={{
              borderBottom: `1px solid ${T.border.subtle}`,
              overflow: 'auto',
              minHeight: 80,
              maxHeight: '40%',
            }}
          >
            <PanelHeader label="CIRCUIT DIAGRAM" />
            <div style={{ padding: `${T.space[4]}px ${T.space[1]}px`, overflow: 'auto' }}>
              <CircuitDiagram
                instructions={ide.gateInstructions}
                nQubits={ide.nQubits}
                currentStep={ide.stepIndex}
                onGateDrop={ide.showPalette ? ide.handleGateDrop : undefined}
                onGateDropAngle={ide.showPalette ? ide.handleGateDropAngle : undefined}
              />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {ide.histogramData ? (
              <Histogram data={ide.histogramData} shots={ide.shots} nQubits={ide.nQubits} />
            ) : ide.showBloch && ide.shots === 1 ? (
              <BlochSphere
                state={ide.state}
                nQubits={ide.nQubits}
                vectors={ide.blochVectorsDM ?? undefined}
                actions={
                  <HeaderButton active onClick={() => ide.setShowBloch(false)}>
                    Bloch
                  </HeaderButton>
                }
              />
            ) : ide.showRhoMatrix && ide.shots === 1 ? (
              <DensityMatrixView
                densityMatrix={ide.densityMatrix}
                nQubits={ide.nQubits}
                actions={
                  <HeaderButton active onClick={() => ide.setShowRhoMatrix(false)}>
                    rho Matrix
                  </HeaderButton>
                }
              />
            ) : (
              <>
                <PanelHeader
                  label="STATE INSPECTOR"
                  actions={
                    ide.shots === 1 ? (
                      <div style={{ display: 'flex', gap: T.space[2] }}>
                        <HeaderButton
                          active={false}
                          onClick={() => {
                            ide.setShowBloch(true);
                            ide.setShowRhoMatrix(false);
                          }}
                        >
                          Bloch
                        </HeaderButton>
                        <HeaderButton
                          active={false}
                          onClick={() => {
                            ide.setShowRhoMatrix(true);
                            ide.setShowBloch(false);
                          }}
                        >
                          rho Matrix
                        </HeaderButton>
                      </div>
                    ) : null
                  }
                />
                <StateInspector
                  state={ide.state}
                  nQubits={ide.nQubits}
                  measurements={ide.measurements}
                  probabilities={ide.densityMatrix ? ide.densityMatrix.map((row, i) => row[i][0]) : null}
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
