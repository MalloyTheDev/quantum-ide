'use strict';

const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

const isDev = process.argv.includes('--dev');
const DEV_SERVER_URL = 'http://localhost:3000';

// Tracks file paths per window that the main process has returned from native dialogs.
// dialog:saveFile may only write to paths in the sender window's set, preventing a
// compromised renderer from writing to arbitrary locations.
// Scoped per WebContents id so paths from one window cannot bleed into another,
// and cleaned up when the window closes to avoid unbounded growth.
const trustedFilePathsByWindow = new Map();
let recentFiles = [];

function getTrustedPaths(webContentsId) {
  if (!trustedFilePathsByWindow.has(webContentsId)) {
    trustedFilePathsByWindow.set(webContentsId, new Set());
  }
  return trustedFilePathsByWindow.get(webContentsId);
}

function sendMenuCommand(command, extra = {}) {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!win) return;
  win.webContents.send('menu:command', { command, ...extra });
}

function recordRecentFile(filePath) {
  if (!filePath) return;
  recentFiles = [filePath, ...recentFiles.filter((p) => p !== filePath)].slice(0, 8);
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.addRecentDocument(filePath);
  }
  Menu.setApplicationMenu(createApplicationMenu());
}

function createApplicationMenu() {
  const recentSubmenu =
    recentFiles.length > 0
      ? recentFiles.map((filePath) => ({
          label: path.basename(filePath),
          sublabel: filePath,
          click: () => sendMenuCommand('open-recent', { filePath }),
        }))
      : [{ label: 'No Recent Files', enabled: false }];

  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenuCommand('new') },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => sendMenuCommand('open') },
        { label: 'Open Recent', submenu: recentSubmenu },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuCommand('save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuCommand('save-as') },
        { type: 'separator' },
        { label: 'Import OpenQASM...', click: () => sendMenuCommand('import-qasm') },
        { label: 'Export OpenQASM...', click: () => sendMenuCommand('export-qasm') },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit' },
      ],
    },
    {
      label: 'Run',
      submenu: [
        { label: 'Run Program', accelerator: 'CmdOrCtrl+Enter', click: () => sendMenuCommand('run') },
        { label: 'Step One Gate', accelerator: 'F10', click: () => sendMenuCommand('step') },
        { label: 'Reset Simulation', accelerator: 'CmdOrCtrl+R', click: () => sendMenuCommand('reset') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]);
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'Quantum IDE',
    backgroundColor: '#0f0d1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // sandbox: true is safe here because preload.cjs only calls require('electron'),
      // which Electron exposes as a sandboxed polyfill. No Node.js built-in modules
      // (fs, path, etc.) are used in the preload - all file I/O goes through IPC to main.
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  });

  const wcId = win.webContents.id;
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => trustedFilePathsByWindow.delete(wcId));

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(createApplicationMenu());
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Window title ─────────────────────────────────────────────────────────

ipcMain.on('set-title', (event, title) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setTitle(title);
});

// ── IPC: File open ────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Quantum Program',
    filters: [
      { name: 'Quantum Assembly', extensions: ['qs', 'qasm', 'txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  getTrustedPaths(event.sender.id).add(filePath);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    recordRecentFile(filePath);
    return { filePath, content };
  } catch (err) {
    log.error('Failed to open file', err);
    return { error: err.message };
  }
});

ipcMain.handle('dialog:openPath', async (event, filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    return { error: 'Invalid file path.' };
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    getTrustedPaths(event.sender.id).add(filePath);
    recordRecentFile(filePath);
    return { filePath, content };
  } catch (err) {
    log.error('Failed to open recent file', err);
    return { error: err.message };
  }
});

// ── IPC: File save (to known path) ────────────────────────────────────────────

ipcMain.handle('dialog:saveFile', async (event, content, filePath) => {
  if (!getTrustedPaths(event.sender.id).has(filePath)) {
    return { success: false, error: 'Path not authorized for writing.' };
  }
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    recordRecentFile(filePath);
    return { success: true, filePath };
  } catch (err) {
    log.error('Failed to save file', err);
    return { success: false, error: err.message };
  }
});

// ── IPC: File save-as (pick path via dialog) ──────────────────────────────────

ipcMain.handle('dialog:saveFileAs', async (event, content) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    title: 'Save Quantum Program',
    defaultPath: 'circuit.qs',
    filters: [
      { name: 'Quantum Assembly', extensions: ['qs'] },
      { name: 'Plain Text', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) return null;

  getTrustedPaths(event.sender.id).add(result.filePath);
  try {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    recordRecentFile(result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    log.error('Failed to save file as', err);
    return { success: false, error: err.message };
  }
});

// ── IPC: Save file via dialog (generic, accepts defaultName) ──────────────────

ipcMain.handle('save-file', async (event, content, defaultName) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    title: 'Save File',
    defaultPath: defaultName || 'circuit.qasm',
    filters: [
      { name: 'OpenQASM', extensions: ['qasm'] },
      { name: 'Quantum Assembly', extensions: ['qs'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) return null;

  getTrustedPaths(event.sender.id).add(result.filePath);
  try {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    recordRecentFile(result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    log.error('Failed to save generic file', err);
    return { success: false, error: err.message };
  }
});

// ── IPC: Open file via dialog (accepts custom filters) ────────────────────────

ipcMain.handle('open-file', async (event, filters) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const defaultFilters = filters || [
    { name: 'OpenQASM', extensions: ['qasm'] },
    { name: 'Quantum Assembly', extensions: ['qs', 'txt'] },
    { name: 'All Files', extensions: ['*'] },
  ];
  const result = await dialog.showOpenDialog(win, {
    title: 'Open File',
    filters: defaultFilters,
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) return null;

  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    recordRecentFile(result.filePaths[0]);
    return content;
  } catch (err) {
    log.error('Failed to open generic file', err);
    return null;
  }
});

ipcMain.on('recent-files:update', (_event, files) => {
  if (!Array.isArray(files)) return;
  recentFiles = files.filter((filePath) => typeof filePath === 'string').slice(0, 8);
  Menu.setApplicationMenu(createApplicationMenu());
});
