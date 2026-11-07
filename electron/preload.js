'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const listeners = new Map();

function on(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('cloudPrint', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  init: () => ipcRenderer.invoke('app:init'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  openPrinterPreferences: (name) => ipcRenderer.invoke('printer:preferences', name),
  pickFolder: (opts) => ipcRenderer.invoke('dialog:folder', opts || {}),
  pickFiles: (opts) => ipcRenderer.invoke('dialog:files', opts || {}),
  statFiles: (paths) => ipcRenderer.invoke('files:stat', paths),
  readFile: (path) => ipcRenderer.invoke('files:read', path),
  fileExists: (path) => ipcRenderer.invoke('files:exists', path),
  createStackFolder: (opts) => ipcRenderer.invoke('files:create-stack-folder', opts),
  revealFile: (path) => ipcRenderer.invoke('files:reveal', path),
  openFile: (path) => ipcRenderer.invoke('files:open', path),
  trashFile: (path) => ipcRenderer.invoke('files:trash', path),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  erpRequest: (payload) => ipcRenderer.invoke('erp:request', payload),
  printHtml: (job) => ipcRenderer.invoke('print:html', job),
  printImages: (job) => ipcRenderer.invoke('print:images', job),
  receiveInfo: () => ipcRenderer.invoke('receive:info'),
  startReceive: (port) => ipcRenderer.invoke('receive:start', port),
  stopReceive: () => ipcRenderer.invoke('receive:stop'),
  startWatch: (dir) => ipcRenderer.invoke('watch:start', dir),
  stopWatch: () => ipcRenderer.invoke('watch:stop'),
  scanWatch: () => ipcRenderer.invoke('watch:scan'),
  openQuickWindow: () => ipcRenderer.invoke('quick:open'),
  closeQuickWindow: () => ipcRenderer.invoke('quick:window-close'),
  minimizeQuickWindow: () => ipcRenderer.invoke('quick:window-minimize'),
  notifyQuickPrinted: (payload) => ipcRenderer.invoke('app:notify-quick', payload),
  notifyQuickCleared: () => ipcRenderer.invoke('app:notify-quick-cleared'),
  setAutoStart: (enabled) => ipcRenderer.invoke('app:set-auto-start', enabled),
  appVersion: () => ipcRenderer.invoke('app:version'),
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return file?.path || ''; }
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    hide: () => ipcRenderer.invoke('window:hide'),
    setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-always-on-top', value),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },
  onWindowState: (cb) => on('window:state', cb),
  onReceiveFiles: (cb) => on('receive:files', cb),
  onReceiveInfo: (cb) => on('receive:info', cb),
  onPrintProgress: (cb) => on('print:progress', cb),
  onWatcherFiles: (cb) => on('watcher:files', cb),
  onQuickPrinted: (cb) => on('quick:printed', cb),
  onQuickCleared: (cb) => on('quick:cleared', cb),
  onQuickWindow: (cb) => on('quick:window', cb),
  onOpenReceive: (cb) => on('open:receive', cb),
});
