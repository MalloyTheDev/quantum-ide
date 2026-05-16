import { create } from 'zustand';

export const usePreferencesStore = create((set, get) => ({
  showBloch: false,
  showAnalysis: false,
  showPalette: true,
  showRhoMatrix: false,
  showCommandPalette: false,
  analysisReference: 'auto',
  recentFiles: [],
  hasHydrated: false,

  setShowBloch: (showBloch) => set({ showBloch }),
  setShowAnalysis: (showAnalysis) => set({ showAnalysis }),
  setShowPalette: (showPalette) => set({ showPalette }),
  setShowRhoMatrix: (showRhoMatrix) => set({ showRhoMatrix }),
  setShowCommandPalette: (showCommandPalette) => set({ showCommandPalette }),
  setAnalysisReference: (analysisReference) => set({ analysisReference }),
  markHydrated: () => set({ hasHydrated: true }),

  addRecentFile: (filePath) => {
    if (!filePath) return;
    const recentFiles = [filePath, ...get().recentFiles.filter((path) => path !== filePath)].slice(0, 8);
    set({ recentFiles });
  },

  hydratePreferences: ({ showPalette, recentFiles, showAnalysis, analysisReference } = {}) => {
    set({
      showPalette: typeof showPalette === 'boolean' ? showPalette : get().showPalette,
      showAnalysis: typeof showAnalysis === 'boolean' ? showAnalysis : get().showAnalysis,
      analysisReference: typeof analysisReference === 'string' ? analysisReference : get().analysisReference,
      recentFiles: Array.isArray(recentFiles) ? recentFiles.slice(0, 8) : get().recentFiles,
      hasHydrated: true,
    });
  },
}));
