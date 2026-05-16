import { create } from 'zustand';

export const usePreferencesStore = create((set, get) => ({
  showBloch: false,
  showPalette: true,
  showRhoMatrix: false,
  showCommandPalette: false,
  recentFiles: [],
  hasHydrated: false,

  setShowBloch: (showBloch) => set({ showBloch }),
  setShowPalette: (showPalette) => set({ showPalette }),
  setShowRhoMatrix: (showRhoMatrix) => set({ showRhoMatrix }),
  setShowCommandPalette: (showCommandPalette) => set({ showCommandPalette }),
  markHydrated: () => set({ hasHydrated: true }),

  addRecentFile: (filePath) => {
    if (!filePath) return;
    const recentFiles = [filePath, ...get().recentFiles.filter((path) => path !== filePath)].slice(0, 8);
    set({ recentFiles });
  },

  hydratePreferences: ({ showPalette, recentFiles } = {}) => {
    set({
      showPalette: typeof showPalette === 'boolean' ? showPalette : get().showPalette,
      recentFiles: Array.isArray(recentFiles) ? recentFiles.slice(0, 8) : get().recentFiles,
      hasHydrated: true,
    });
  },
}));
