import React from 'react';
import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Toolbar from '../../src/components/Toolbar.jsx';
import AnalysisPanel from '../../src/components/AnalysisPanel.jsx';
import { buildAnalysisSummary } from '../../src/engine/analysis.js';
import { NEW_PROGRAM, useWorkspaceStore } from '../../src/stores/workspaceStore.js';
import { usePreferencesStore } from '../../src/stores/preferencesStore.js';
import { useSimulationStore } from '../../src/stores/simulationStore.js';

function renderToolbar(overrides = {}) {
  const props = {
    onNew: vi.fn(),
    onRun: vi.fn(),
    onCancelRun: vi.fn(),
    isRunning: false,
    runProgress: null,
    onStep: vi.fn(),
    onReset: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onExportQASM: vi.fn(),
    onImportQASM: vi.fn(),
    onLoadExample: vi.fn(),
    currentFilePath: null,
    isDirty: false,
    shots: 1,
    seed: '',
    onShotsChange: vi.fn(),
    onSeedChange: vi.fn(),
    showPalette: true,
    onTogglePalette: vi.fn(),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe('Toolbar', () => {
  it('fires run and shots controls', () => {
    const props = renderToolbar();
    fireEvent.change(screen.getByLabelText('Number of shots'), { target: { value: '64' } });
    fireEvent.click(screen.getByRole('button', { name: /run program/i }));

    assert.equal(props.onShotsChange.mock.calls[0][0], 64);
    assert.equal(props.onRun.mock.calls.length, 1);
  });

  it('updates the seed control', () => {
    const props = renderToolbar();
    fireEvent.change(screen.getByLabelText('Random seed'), { target: { value: 'bell-42' } });

    assert.equal(props.onSeedChange.mock.calls[0][0], 'bell-42');
  });

  it('switches the run button to cancel while running', () => {
    const props = renderToolbar({
      isRunning: true,
      runProgress: { phase: 'shots', completed: 10, total: 100 },
    });
    fireEvent.click(screen.getByRole('button', { name: /cancel run/i }));

    assert.equal(props.onCancelRun.mock.calls.length, 1);
    assert.ok(screen.getByText('10/100'));
  });
});

describe('Workspace store', () => {
  it('tracks document replacement and undo history', () => {
    useWorkspaceStore.getState().replaceDocument(NEW_PROGRAM, { dirty: false });
    useWorkspaceStore.getState().setCode(`${NEW_PROGRAM}\nx 0`, { dirty: true });
    useWorkspaceStore.getState().pushHistory();
    useWorkspaceStore.getState().undo();

    assert.equal(useWorkspaceStore.getState().code, NEW_PROGRAM);
    assert.equal(useWorkspaceStore.getState().canRedo, true);
  });
});

describe('Simulation preferences', () => {
  it('tracks seed and persisted analysis preferences', () => {
    useSimulationStore.getState().setSeed('demo-seed');
    usePreferencesStore.getState().hydratePreferences({
      showAnalysis: true,
      analysisReference: 'bell',
    });

    assert.equal(useSimulationStore.getState().seed, 'demo-seed');
    assert.equal(usePreferencesStore.getState().showAnalysis, true);
    assert.equal(usePreferencesStore.getState().analysisReference, 'bell');
  });
});

describe('AnalysisPanel', () => {
  it('renders reduced-state metrics and reference fidelity', () => {
    const s = 1 / Math.sqrt(2);
    const summary = buildAnalysisSummary({
      state: [
        [s, 0],
        [0, 0],
        [0, 0],
        [s, 0],
      ],
      nQubits: 2,
      reference: 'bell',
    });

    render(
      <AnalysisPanel
        summary={summary}
        reference="bell"
        onReferenceChange={vi.fn()}
        actions={<button>Analysis</button>}
      />
    );

    assert.ok(screen.getByText('ANALYSIS LAB'));
    assert.ok(screen.getByText('REDUCED SINGLE-QUBIT STATES'));
    assert.ok(screen.getByText(/Fidelity bell/i));
    assert.ok(screen.getByText(/<Z0Z1>/));
  });
});
