'use strict';

const {
  app, BrowserWindow, ipcMain, dialog, shell, protocol, net, screen, globalShortcut, Tray, Menu, nativeImage,
} = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { read: readState, save: saveState, flush: flushStore, dataDir } = require('./store');
const { printHtml, printImages, imagesToHtml, listPrinters, listStatus } = require('./printer');
const { ReceiveServer } = require('./receiver');
const chokidar = require('chokidar');

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const ROOT = path.join(__dirname, '..');
let mainWindow = null;
let quickWindow = null;
let tray = null;
let watcher = null;
let receiveServer = null;
let lastWatcherFiles = [];
let quitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'appfile',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true },
  },
]);

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
  '.pdf': 'application/pdf', '.svg': 'image/svg+xml',
};

const SUPPORTED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.txt']);

function makeId(prefix = '') {
  return `${prefix}${crypto.randomUUID()}`;
}

function iconPath() {
  const png = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(ROOT, 'build', 'icon.png');
  return fs.existsSync(png) ? png : undefined;
}

function prefsHelperPath() {
  const file = app.isPackaged
    ? path.join(process.resourcesPath, 'print-prefs.exe')
    : path.join(ROOT, 'build', 'MoPrint.PrintPrefs.exe');
  return fs.existsSync(file) ? file : null;
}

function launchPath() {
  // Portable builds run from a temporary extraction directory; register the
  // outer portable exe so autostart still works after a reboot.
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  const icon = iconPath();
  if (!icon) return;
  const image = nativeImage.createFromPath(icon).resize({ width: 20, height: 20 });
  tray = new Tray(image);
  tray.setToolTip('墨印');
  const rebuild = () => {
    const menu = Menu.buildFromTemplate([
      { label: '打开墨印', click: showMainWindow },
      { label: '快捷打印窗口', click: () => createQuickWindow() },
      { type: 'separator' },
      { label: '手机传输二维码', click: () => { showMainWindow(); mainWindow?.webContents.send('open:receive'); } },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(menu);
  };
  rebuild();
  tray.on('double-click', showMainWindow);
  tray.on('click', showMainWindow);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 900,
    minWidth: 1120,
    minHeight: 700,
    frame: false,
    show: false,
    backgroundColor: '#f7f3ee',
    title: '墨印',
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      devTools: isDev || process.env.CLOUD_PRINT_DEVTOOLS === '1',
    },
  });

  const url = isDev
    ? `${process.env.VITE_DEV_SERVER_URL}`
    : pathToFileURL(path.join(ROOT, 'dist', 'index.html')).toString();
  mainWindow.loadURL(url);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const state = readState();
    if (state.settings.alwaysOnTop) mainWindow.setAlwaysOnTop(true);
    if (state.settings.watchDir) startWatcher(state.settings.watchDir);
    if (state.settings.receiveEnabled) startReceive(state.settings.receivePort).catch((err) => console.error('[receive]', err));
    if (state.settings.autoStart) app.setLoginItemSettings({ openAtLogin: true, path: launchPath() });
    createTray();
  });
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:state', { maximized: true }));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state', { maximized: false }));
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && (isDev || process.env.CLOUD_PRINT_DEVTOOLS === '1')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function createQuickWindow() {
  if (quickWindow && !quickWindow.isDestroyed()) {
    quickWindow.show();
    quickWindow.focus();
    return { created: false };
  }
  quickWindow = new BrowserWindow({
    width: 520,
    height: 860,
    minWidth: 420,
    minHeight: 640,
    frame: false,
    show: false,
    backgroundColor: '#f7f3ee',
    title: '快捷打印',
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });
  const base = isDev
    ? process.env.VITE_DEV_SERVER_URL
    : pathToFileURL(path.join(ROOT, 'dist', 'index.html')).toString();
  quickWindow.loadURL(`${base}${base.includes('#') ? '' : '#quick'}`);
  quickWindow.once('ready-to-show', () => {
    quickWindow.show();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('quick:window', { open: true });
  });
  quickWindow.on('closed', () => {
    quickWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('quick:window', { open: false });
  });
  return { created: true };
}

async function startReceive(port) {
  if (receiveServer && receiveServer.info().running) {
    const current = receiveServer.info();
    if (!port || Number(port) === current.port) return current;
    await receiveServer.stop();
  }
  if (!receiveServer) {
    receiveServer = new ReceiveServer({
      onFiles: async (files) => {
        try {
          const pendingPath = path.join(dataDir(), 'received-files.json');
          fs.writeFileSync(pendingPath, JSON.stringify(files, null, 2), 'utf8');
        } catch (err) { console.error('[receive] pending write', err); }
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.webContents.send('receive:files', files);
        }
      },
      onLog: (msg) => console.log('[receive]', msg),
    });
  }
  const info = await receiveServer.start(port || 18666);
  if (mainWindow) mainWindow.webContents.send('receive:info', info);
  return info;
}

async function stopReceive() {
  if (!receiveServer) return { running: false };
  const info = await receiveServer.stop();
  if (mainWindow) mainWindow.webContents.send('receive:info', info);
  return info;
}

function startWatcher(dir) {
  stopWatcher();
  if (!dir) return;
  try {
    watcher = chokidar.watch(dir, {
      ignoreInitial: true,
      depth: 2,
      awaitWriteFinish: { stabilityThreshold: 1200, pollInterval: 250 },
      ignored: (p) => /(^|[\/\\])(\.|~\$|Thumbs\.db)/.test(p),
    });
    const onFile = async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!SUPPORTED_EXT.has(ext)) return;
      try {
        const info = await statFile(filePath);
        lastWatcherFiles.push(info);
        if (lastWatcherFiles.length > 80) lastWatcherFiles = lastWatcherFiles.slice(-80);
        if (mainWindow) mainWindow.webContents.send('watcher:files', [info]);
      } catch (err) { console.error('[watch]', err); }
    };
    watcher.on('add', onFile);
    watcher.on('error', (err) => console.error('[watch]', err));
    console.log('[watch] watching', dir);
  } catch (err) {
    console.error('[watch] start failed', err);
  }
}

function stopWatcher() {
  if (watcher) {
    watcher.close().catch(() => {});
    watcher = null;
  }
}

async function statFile(filePath) {
  const stat = await fs.promises.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return {
    id: makeId('f_'),
    name: path.basename(filePath),
    path: filePath,
    ext: ext.replace('.', ''),
    size: stat.size,
    mtime: stat.mtimeMs,
    exists: true,
    pages: ext === '.pdf' ? null : 1,
    addedAt: Date.now(),
  };
}

function normalizeError(err) {
  return err && err.message ? err.message : String(err);
}

function registerIpc() {
  ipcMain.handle('app:init', () => {
    const state = readState();
    let pendingReceived = [];
    try {
      const p = path.join(dataDir(), 'received-files.json');
      if (fs.existsSync(p)) {
        pendingReceived = JSON.parse(fs.readFileSync(p, 'utf8'));
        fs.unlinkSync(p);
      }
    } catch { /* ignore */ }
    return {
      state,
      version: app.getVersion(),
      platform: process.platform,
      paths: { userData: app.getPath('userData'), documents: app.getPath('documents'), downloads: app.getPath('downloads') },
      printers: [],
      receive: receiveServer ? receiveServer.info() : { running: false, port: 0, url: '' },
      pendingReceived,
      simulate: process.env.CLOUD_PRINT_SIMULATE === '1',
    };
  });

  ipcMain.handle('state:save', (_e, state) => {
    const saved = saveState(state);
    return { ok: true, updatedAt: saved.updatedAt };
  });

  ipcMain.handle('printers:list', () => listStatus(mainWindow));

  ipcMain.handle('printer:preferences', async (_e, printerName) => {
    try {
      const printers = await listPrinters(mainWindow);
      const target = printerName
        ? printers.find((p) => p.name === printerName || p.displayName === printerName)
        : printers.find((p) => p.isDefault) || printers[0];
      if (!target) return { ok: false, error: '没有找到可用的打印机。' };
      const helper = prefsHelperPath();
      const child = helper
        ? spawn(helper, [target.name], { detached: true, stdio: 'ignore', windowsHide: false })
        : spawn('rundll32.exe', ['printui.dll,PrintUIEntry', '/e', '/n', target.name], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
        });
      child.unref();
      return { ok: true, printer: target.name };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('dialog:folder', async (_e, opts = {}) => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: opts.title || '选择文件夹',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: opts.defaultPath || undefined,
    });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('dialog:files', async (_e, opts = {}) => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: opts.title || '选择要打印的文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '可打印文件', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff', 'txt'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('files:stat', async (_e, paths) => {
    const out = [];
    for (const p of Array.isArray(paths) ? paths : []) {
      try {
        const stat = await fs.promises.stat(p);
        if (stat.isDirectory()) {
          const entries = await fs.promises.readdir(p, { withFileTypes: true });
          for (const ent of entries) {
            if (!ent.isFile()) continue;
            const ext = path.extname(ent.name).toLowerCase();
            if (!SUPPORTED_EXT.has(ext)) continue;
            out.push(await statFile(path.join(p, ent.name)));
            if (out.length >= 300) break;
          }
        } else if (stat.isFile()) {
          const ext = path.extname(p).toLowerCase();
          if (SUPPORTED_EXT.has(ext)) out.push(await statFile(p));
        }
      } catch (err) {
        console.error('[files:stat]', p, err.message);
      }
    }
    return out;
  });

  ipcMain.handle('files:read', async (_e, filePath) => {
    try {
      const data = await fs.promises.readFile(filePath);
      return { ok: true, data, size: data.length };
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  });

  ipcMain.handle('files:exists', async (_e, filePath) => {
    try { return (await fs.promises.stat(filePath)).isFile(); } catch { return false; }
  });

  ipcMain.handle('files:create-stack-folder', async (_e, { parent, name }) => {
    const safe = String(name || '堆叠').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || '堆叠';
    const base = parent || path.join(app.getPath('documents'), '墨印堆叠');
    const target = path.join(base, safe);
    await fs.promises.mkdir(target, { recursive: true });
    return { path: target, name: safe };
  });

  ipcMain.handle('files:reveal', async (_e, p) => {
    if (!p) return false;
    shell.showItemInFolder(p);
    return true;
  });

  ipcMain.handle('files:open', async (_e, p) => {
    if (!p) return false;
    const err = await shell.openPath(p);
    return !err;
  });

  ipcMain.handle('files:trash', async (_e, p) => {
    try {
      await shell.trashItem(p);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  });

  ipcMain.handle('erp:request', async (_e, payload = {}) => {
    try {
      const target = String(payload.url || '');
      if (!/^https?:\/\//i.test(target)) return { ok: false, error: 'ERP 接口地址必须是 http(s)。' };
      const res = await net.fetch(target, {
        method: payload.method || 'POST',
        headers: {
          'content-type': 'application/json',
          ...(payload.token ? { authorization: `Bearer ${payload.token}` } : {}),
        },
        body: payload.body === undefined ? undefined : JSON.stringify(payload.body),
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('shell:open-external', async (_e, url) => {
    if (!/^https?:\/\//i.test(String(url))) return false;
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('print:html', async (e, job) => {
    const result = await printHtml(job, {
      window: mainWindow,
      onProgress: (p) => {
        if (!e.sender.isDestroyed()) e.sender.send('print:progress', { jobId: job.jobId, ...p });
      },
    });
    return result;
  });

  ipcMain.handle('print:images', async (e, job) => {
    const context = {
      window: mainWindow,
      onProgress: (p) => { if (!e.sender.isDestroyed()) e.sender.send('print:progress', { jobId: job.jobId, ...p }); },
    };
    const result = await printImages(job, context);
    if (result.fallback) {
      return printHtml({ ...job, html: imagesToHtml(job), pageSize: job.pageSize || 'A4' }, context);
    }
    return result;
  });

  ipcMain.handle('receive:info', () => (receiveServer ? receiveServer.info() : { running: false, port: 0, url: '' }));
  ipcMain.handle('receive:start', async (_e, port) => startReceive(port));
  ipcMain.handle('receive:stop', () => stopReceive());

  ipcMain.handle('watch:start', (_e, dir) => { startWatcher(dir); return { ok: true, dir }; });
  ipcMain.handle('watch:stop', () => { stopWatcher(); return { ok: true }; });
  ipcMain.handle('watch:scan', async () => {
    const state = readState();
    if (!state.settings.watchDir) return [];
    try {
      const entries = await fs.promises.readdir(state.settings.watchDir, { withFileTypes: true });
      const out = [];
      for (const ent of entries) {
        if (!ent.isFile() || ent.name.startsWith('.')) continue;
        const ext = path.extname(ent.name).toLowerCase();
        if (!SUPPORTED_EXT.has(ext)) continue;
        out.push(await statFile(path.join(state.settings.watchDir, ent.name)));
        if (out.length >= 200) break;
      }
      return out;
    } catch (err) { return []; }
  });

  ipcMain.handle('quick:open', () => createQuickWindow());

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:hide', () => mainWindow?.hide());
  ipcMain.handle('window:set-always-on-top', (_e, value) => {
    mainWindow?.setAlwaysOnTop(!!value);
    return !!value;
  });
  ipcMain.handle('window:is-maximized', () => !!mainWindow?.isMaximized());
  ipcMain.handle('quick:window-close', () => quickWindow?.close());
  ipcMain.handle('quick:window-minimize', () => quickWindow?.minimize());

  ipcMain.handle('app:set-auto-start', (_e, enabled) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled, path: launchPath() });
    return !!enabled;
  });

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:notify-quick', (_e, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('quick:printed', payload);
  });
  ipcMain.handle('app:notify-quick-cleared', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('quick:cleared');
  });
}

app.whenReady().then(async () => {
  protocol.handle('appfile', async (request) => {
    try {
      const u = new URL(request.url);
      let p = decodeURIComponent(u.pathname);
      if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
      const stat = await fs.promises.stat(p);
      if (!stat.isFile()) return new Response('Not found', { status: 404 });
      const data = await fs.promises.readFile(p);
      const ext = path.extname(p).toLowerCase();
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'content-type': MIME[ext] || 'application/octet-stream',
          'content-length': String(data.length),
          'cache-control': 'no-cache',
          'access-control-allow-origin': '*',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  registerIpc();
  createWindow();

  try {
    globalShortcut.register('CommandOrControl+Q', () => showMainWindow());
  } catch { /* ignore */ }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

app.on('window-all-closed', () => {
  stopWatcher();
  if (receiveServer) receiveServer.stop().catch(() => {});
  if (process.platform !== 'darwin' && quitting) app.quit();
});

app.on('before-quit', () => {
  quitting = true;
  flushStore();
  stopWatcher();
  if (receiveServer) receiveServer.stop().catch(() => {});
  globalShortcut.unregisterAll();
});

app.on('will-quit', () => globalShortcut.unregisterAll());

process.on('uncaughtException', (err) => console.error('[main] uncaught', err));
process.on('unhandledRejection', (err) => console.error('[main] rejection', err));

