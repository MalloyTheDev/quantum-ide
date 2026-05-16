import { create } from 'zustand';
import EXAMPLES from '../data/examples.js';

export const INITIAL_CODE = EXAMPLES['Bell State'].code;
export const NEW_PROGRAM = `# New Quantum Program
qubits 2
h 0
cx 0 1
measure all`;

function stateFromCode(code, overrides = {}) {
  return {
    code,
    currentFilePath: overrides.currentFilePath ?? null,
    isDirty: overrides.isDirty ?? false,
    history: [code],
    historyIndex: 0,
    canUndo: false,
    canRedo: false,
  };
}

export const useWorkspaceStore = create((set, get) => ({
  ...stateFromCode(INITIAL_CODE),

  setCode: (code, { dirty = true } = {}) => {
    set({ code, isDirty: dirty });
  },

  replaceDocument: (code, { filePath = null, dirty = false } = {}) => {
    set(stateFromCode(code, { currentFilePath: filePath, isDirty: dirty }));
  },

  markSaved: (filePath) => {
    set({
      currentFilePath: filePath ?? get().currentFilePath,
      isDirty: false,
    });
  },

  pushHistory: (code = get().code) => {
    const { history, historyIndex } = get();
    if (history[historyIndex] === code) return;
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(code);
    if (nextHistory.length > 100) nextHistory.shift();
    set({
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
      canUndo: nextHistory.length > 1,
      canRedo: false,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    set({
      code: history[nextIndex],
      historyIndex: nextIndex,
      isDirty: true,
      canUndo: nextIndex > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    set({
      code: history[nextIndex],
      historyIndex: nextIndex,
      isDirty: true,
      canUndo: true,
      canRedo: nextIndex < history.length - 1,
    });
  },
}));
