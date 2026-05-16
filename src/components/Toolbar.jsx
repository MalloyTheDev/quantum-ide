import { memo } from 'react';
import {
  Download,
  FilePlus,
  FolderOpen,
  Palette,
  Play,
  Redo2,
  RotateCcw,
  Save,
  SaveAll,
  Square,
  StepForward,
  Undo2,
  Upload,
} from 'lucide-react';
import { T } from '../styles/tokens.js';
import EXAMPLES from '../data/examples.js';

const btnBase = {
  padding: '5px 13px',
  borderRadius: T.radius.lg,
  cursor: 'pointer',
  fontSize: T.font.size.md,
  fontWeight: 600,
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const btnPrimary = {
  ...btnBase,
  border: 'none',
  background: T.accent.primary,
  color: T.text.inverse,
};

const btnGhost = {
  ...btnBase,
  border: `1px solid ${T.border.muted}`,
  background: 'transparent',
  color: T.text.muted,
};

function Sep() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 1,
        height: 20,
        background: T.border.subtle,
        marginLeft: T.space[1],
        marginRight: T.space[1],
        flexShrink: 0,
      }}
    />
  );
}

function BtnLabel({ icon: Icon, children }) {
  return (
    <>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </>
  );
}

function Toolbar({
  onNew,
  onRun,
  onCancelRun,
  isRunning,
  runProgress,
  onStep,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpen,
  onSave,
  onSaveAs,
  onExportQASM,
  onImportQASM,
  onLoadExample,
  currentFilePath,
  isDirty,
  shots,
  seed,
  onShotsChange,
  onSeedChange,
  showPalette,
  onTogglePalette,
}) {
  const fileName = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'untitled.qs';

  return (
    <div
      role="toolbar"
      aria-label="IDE controls"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: T.space[3],
        padding: `${T.space[3]}px ${T.space[5]}px`,
        background: T.bg.toolbar,
        borderBottom: `1px solid ${T.border.subtle}`,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      <div
        aria-hidden="true"
        style={{ display: 'flex', alignItems: 'center', gap: T.space[3], marginRight: T.space[4] }}
      >
        <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill={T.accent.primary} />
          <circle cx="16" cy="16" r="6" fill="none" stroke="white" strokeWidth="2" />
          <circle cx="16" cy="10" r="2" fill="white" />
        </svg>
        <span style={{ fontSize: T.font.size.lg, fontWeight: 700, color: T.accent.light, letterSpacing: 1.5 }}>
          QUANTUM IDE
        </span>
        <span style={{ fontSize: T.font.size.xs, color: T.text.dim, marginLeft: T.space[1] }}>v1.0</span>
      </div>

      <Sep />

      <button onClick={onNew} aria-label="New file (Ctrl+N)" title="New file  (Ctrl+N)" style={btnGhost}>
        <BtnLabel icon={FilePlus}>New</BtnLabel>
      </button>

      <button onClick={onOpen} aria-label="Open file (Ctrl+O)" title="Open file  (Ctrl+O)" style={btnGhost}>
        <BtnLabel icon={FolderOpen}>Open</BtnLabel>
      </button>

      <button
        onClick={onSave}
        aria-label={isDirty ? 'Save file - unsaved changes (Ctrl+S)' : 'Save file (Ctrl+S)'}
        title={currentFilePath ? 'Save  (Ctrl+S)' : 'Save As  (Ctrl+S)'}
        style={{
          ...btnGhost,
          color: isDirty ? T.accent.light : T.text.muted,
          borderColor: isDirty ? T.accent.secondary : T.border.muted,
        }}
      >
        <BtnLabel icon={Save}>Save</BtnLabel>
      </button>

      <button
        onClick={onSaveAs}
        aria-label="Save as new file (Ctrl+Shift+S)"
        title="Save As  (Ctrl+Shift+S)"
        style={btnGhost}
      >
        <BtnLabel icon={SaveAll}>Save As</BtnLabel>
      </button>

      <Sep />

      <button onClick={onExportQASM} aria-label="Export as OpenQASM 2.0" title="Export OpenQASM 2.0" style={btnGhost}>
        <BtnLabel icon={Upload}>QASM</BtnLabel>
      </button>

      <button onClick={onImportQASM} aria-label="Import OpenQASM 2.0 file" title="Import OpenQASM 2.0" style={btnGhost}>
        <BtnLabel icon={Download}>QASM</BtnLabel>
      </button>

      <div
        aria-label={`Current file: ${fileName}${isDirty ? ', unsaved changes' : ''}`}
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: T.space[2],
          padding: `2px ${T.space[4]}px`,
          borderRadius: T.radius.pill,
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          maxWidth: 200,
          overflow: 'hidden',
        }}
      >
        {isDirty && (
          <span aria-hidden="true" style={{ color: T.accent.primary, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
            ●
          </span>
        )}
        <span
          style={{
            fontSize: T.font.size.sm,
            color: isDirty ? T.accent.light : T.text.dim,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {fileName}
        </span>
      </div>

      <Sep />

      <label htmlFor="shots-input" style={{ fontSize: T.font.size.sm, color: T.text.dim, flexShrink: 0 }}>
        Shots:
      </label>
      <input
        id="shots-input"
        type="number"
        min={1}
        max={10000}
        value={shots}
        onChange={(e) => {
          const value = parseInt(e.target.value, 10);
          onShotsChange(Number.isFinite(value) ? value : 1);
        }}
        aria-label="Number of shots"
        title="Number of times to run the circuit (1-10000)"
        disabled={isRunning}
        style={{
          width: 62,
          padding: '4px 6px',
          borderRadius: T.radius.lg,
          border: `1px solid ${shots > 1 ? T.accent.secondary : T.border.muted}`,
          background: T.bg.panel,
          color: shots > 1 ? T.accent.light : T.text.primary,
          fontSize: T.font.size.sm,
          fontFamily: 'inherit',
          textAlign: 'center',
          flexShrink: 0,
          outline: 'none',
          opacity: isRunning ? 0.65 : 1,
        }}
      />

      <label htmlFor="seed-input" style={{ fontSize: T.font.size.sm, color: T.text.dim, flexShrink: 0 }}>
        Seed:
      </label>
      <input
        id="seed-input"
        type="text"
        value={seed}
        onChange={(e) => onSeedChange(e.target.value)}
        aria-label="Random seed"
        title="Optional seed for reproducible measurements and histograms"
        placeholder="random"
        disabled={isRunning}
        style={{
          width: 92,
          padding: '4px 6px',
          borderRadius: T.radius.lg,
          border: `1px solid ${seed ? T.accent.secondary : T.border.muted}`,
          background: T.bg.panel,
          color: seed ? T.accent.light : T.text.primary,
          fontSize: T.font.size.sm,
          fontFamily: 'inherit',
          flexShrink: 0,
          outline: 'none',
          opacity: isRunning ? 0.65 : 1,
        }}
      />

      <button
        onClick={isRunning ? onCancelRun : onRun}
        aria-label={
          isRunning ? 'Cancel run' : shots > 1 ? `Run program ${shots} times (Ctrl+Enter)` : 'Run program (Ctrl+Enter)'
        }
        title={isRunning ? 'Cancel run' : 'Run program  (Ctrl+Enter)'}
        style={isRunning ? { ...btnGhost, borderColor: T.semantic.error, color: T.semantic.error } : btnPrimary}
      >
        <BtnLabel icon={isRunning ? Square : Play}>
          {isRunning ? 'Cancel' : `Run${shots > 1 ? ` (${shots.toLocaleString()}x)` : ''}`}
        </BtnLabel>
      </button>

      {isRunning && runProgress && (
        <span style={{ fontSize: T.font.size.xs, color: T.text.dim, flexShrink: 0 }}>
          {runProgress.phase === 'shots'
            ? `${runProgress.completed.toLocaleString()}/${runProgress.total.toLocaleString()}`
            : runProgress.phase}
        </span>
      )}

      <button
        onClick={onStep}
        aria-label="Step one gate (Ctrl+Shift+Enter)"
        title="Step  (Ctrl+Shift+Enter)"
        disabled={isRunning}
        style={{
          ...btnGhost,
          color: T.accent.soft,
          borderColor: T.accent.secondary,
          opacity: isRunning ? 0.45 : 1,
          cursor: isRunning ? 'default' : 'pointer',
        }}
      >
        <BtnLabel icon={StepForward}>Step</BtnLabel>
      </button>

      <button onClick={onReset} aria-label="Reset simulation (Ctrl+R)" title="Reset  (Ctrl+R)" style={btnGhost}>
        <BtnLabel icon={RotateCcw}>Reset</BtnLabel>
      </button>

      <Sep />

      <button
        onClick={onUndo}
        disabled={!canUndo || isRunning}
        aria-label="Undo (Ctrl+Z)"
        title="Undo  (Ctrl+Z)"
        style={{
          ...btnGhost,
          opacity: canUndo && !isRunning ? 1 : 0.35,
          cursor: canUndo && !isRunning ? 'pointer' : 'default',
        }}
      >
        <BtnLabel icon={Undo2}>Undo</BtnLabel>
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo || isRunning}
        aria-label="Redo (Ctrl+Shift+Z)"
        title="Redo  (Ctrl+Shift+Z / Ctrl+Y)"
        style={{
          ...btnGhost,
          opacity: canRedo && !isRunning ? 1 : 0.35,
          cursor: canRedo && !isRunning ? 'pointer' : 'default',
        }}
      >
        <BtnLabel icon={Redo2}>Redo</BtnLabel>
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: T.space[3] }}>
        <button
          onClick={onTogglePalette}
          aria-label={showPalette ? 'Hide gate palette' : 'Show gate palette'}
          title="Toggle gate palette"
          style={{
            ...btnGhost,
            borderColor: showPalette ? T.accent.secondary : T.border.muted,
            color: showPalette ? T.accent.soft : T.text.muted,
          }}
        >
          <BtnLabel icon={Palette}>Palette</BtnLabel>
        </button>
        <Sep />
        <label htmlFor="examples-select" style={{ fontSize: T.font.size.sm, color: T.text.dim }}>
          Examples:
        </label>
        <select
          id="examples-select"
          aria-label="Load an example quantum program"
          disabled={isRunning}
          onChange={(e) => {
            if (e.target.value) {
              onLoadExample(e.target.value);
              e.target.value = '';
            }
          }}
          style={{
            padding: `${T.space[2]}px ${T.space[4]}px`,
            borderRadius: T.radius.lg,
            border: `1px solid ${T.border.muted}`,
            fontSize: T.font.size.sm,
            fontFamily: 'inherit',
            background: T.bg.panel,
            color: T.accent.soft,
            cursor: isRunning ? 'default' : 'pointer',
            opacity: isRunning ? 0.6 : 1,
          }}
        >
          <option value="">Load program...</option>
          {Object.entries(EXAMPLES).map(([name, { description }]) => (
            <option key={name} value={name} title={description}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default memo(Toolbar);
