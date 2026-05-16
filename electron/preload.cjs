'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose a safe, limited API to the renderer process via contextBridge.
 * The renderer cannot access Node/Electron APIs directly (contextIsolation: true),
 * so all file I/O must go through these IPC bridges.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** Open a native file dialog and return { filePath, content } or null if cancelled */
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  /** Open a known path, used for native recent-file menu commands */
  openPath: (filePath) => ipcRenderer.invoke('dialog:openPath', filePath),

  /** Write content to an already-known file path. Returns { success, filePath } */
  saveFile: (content, filePath) => ipcRenderer.invoke('dialog:saveFile', content, filePath),

  /** Open a Save As dialog, write content, return { success, filePath } or null if cancelled */
  saveFileAs: (content) => ipcRenderer.invoke('dialog:saveFileAs', content),

  /** Update the native window title */
  setTitle: (title) => ipcRenderer.send('set-title', title),

  /** Show a save dialog and write content. Returns { success, filePath } or null if cancelled */
  saveFileDialog: (content, defaultName) => ipcRenderer.invoke('save-file', content, defaultName),

  /** Show an open dialog and return the file content string, or null if cancelled */
  openFileDialog: (filters) => ipcRenderer.invoke('open-file', filters),

  /** Send the main process the renderer's persisted recent-file list */
  setRecentFiles: (files) => ipcRenderer.send('recent-files:update', files),

  /** Subscribe to native menu commands. Returns an unsubscribe function. */
  onMenuCommand: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('menu:command', listener);
    return () => ipcRenderer.removeListener('menu:command', listener);
  },
});
