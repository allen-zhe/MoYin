'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { BrowserWindow, app } = require('electron');
const { execFile } = require('child_process');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listPrinters(win) {
  try {
    const wc = (win && win.webContents) || BrowserWindow.getAllWindows()[0]?.webContents;
    if (!wc) return [];
    const printers = await wc.getPrintersAsync();
    return printers
      .map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || '',
        status: p.status,
        isDefault: !!p.isDefault,
      }))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
  } catch (err) {
    console.error('[printer] list failed', err);
    return [];
  }
}

function normalizePageSize(size) {
  if (!size) return 'A4';
  if (typeof size === 'string') return size;
  return {
    width: Math.round(Number(size.width) * 1000),
    height: Math.round(Number(size.height) * 1000),
  };
}

function buildOptions(job, printers) {
  const item = job.item || {};
  const deviceName = job.deviceName || item.printer || '';
  const found = deviceName
    ? printers.find((p) => p.name === deviceName || p.displayName === deviceName)
    : printers.find((p) => p.isDefault) || printers[0];
  const options = {
    silent: true,
    printBackground: true,
    color: job.color !== undefined ? !!job.color : item.color !== 'mono',
    copies: Math.max(1, Math.min(99, Number(job.copies) || 1)),
    margins: { marginType: 'none' },
    pageSize: normalizePageSize(job.pageSize || item.paper || 'A4'),
    duplexMode: job.duplex || item.duplex || 'simplex',
    landscape: job.landscape !== undefined ? !!job.landscape : false,
  };
  if (found) options.deviceName = found.name;
  return { options, printer: found || null };
}

function printJobHelper() {
  const file = app.isPackaged
    ? path.join(process.resourcesPath, 'print-job.exe')
    : path.join(__dirname, '..', 'build', 'MoPrint.PrintJob.exe');
  return fs.existsSync(file) ? file : null;
}

function imagesToHtml(job) {
  const paper = job.pageSize || job.item?.paper || 'A4';
  const size = paper === 'A3' ? '297mm 420mm' : paper === 'A5' ? '148mm 210mm' : '210mm 297mm';
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${size};margin:0}html,body{margin:0;padding:0}.sheet{width:100%;height:100vh;page-break-after:always;display:flex;align-items:center;justify-content:center}.sheet img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>${(job.images || []).map((src) => `<div class="sheet"><img src="${src}"></div>`).join('')}</body></html>`;
}

async function printImages(job, context = {}) {
  if (job.simulate || process.env.CLOUD_PRINT_SIMULATE === '1') {
    await sleep(900);
    if (context.onProgress) context.onProgress({ stage: 'done', percent: 100 });
    return { ok: true, simulated: true, pages: (job.images || []).length, printer: job.deviceName || job.item?.printer || '' };
  }
  const helper = printJobHelper();
  if (!helper) return { fallback: true };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moprint-job-'));
  try {
    const imagePaths = [];
    for (let i = 0; i < (job.images || []).length; i += 1) {
      const src = job.images[i];
      const comma = String(src).indexOf(',');
      const meta = comma >= 0 ? String(src).slice(0, comma) : '';
      const b64 = comma >= 0 ? String(src).slice(comma + 1) : '';
      const ext = /png/i.test(meta) ? 'png' : 'jpg';
      const file = path.join(dir, `page-${String(i + 1).padStart(4, '0')}.${ext}`);
      fs.writeFileSync(file, Buffer.from(b64, 'base64'));
      imagePaths.push(file);
    }
    let printerName = job.deviceName || job.item?.printer || '';
    if (!printerName) {
      const listed = await listPrinters(context.window);
      printerName = (listed.find((p) => p.isDefault) || listed[0])?.name || '';
    }
    const config = {
      printer: printerName,
      paper: job.pageSize || job.item?.paper || 'A4',
      landscape: !!job.landscape,
      orientations: Array.isArray(job.orientations) ? job.orientations : [],
      color: job.color !== undefined ? !!job.color : job.item?.color !== 'mono',
      duplex: job.duplex || job.item?.duplex || 'simplex',
      copies: Math.max(1, Math.min(99, Number(job.copies) || 1)),
      images: imagePaths,
    };
    if (job.outputFile) config.outputFile = job.outputFile;
    const configFile = path.join(dir, 'job.json');
    fs.writeFileSync(configFile, JSON.stringify(config), 'utf8');
    if (context.onProgress) context.onProgress({ stage: 'spooling', percent: 35, printer: config.printer });
    const result = await new Promise((resolve) => {
      execFile(helper, [configFile], { windowsHide: true, timeout: 180000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) resolve({ ok: false, error: (stderr || err.message || '打印失败').trim() });
        else resolve({ ok: true, printer: config.printer, pages: imagePaths.length });
      });
    });
    if (context.onProgress) context.onProgress({ stage: result.ok ? 'done' : 'failed', percent: 100, ...result });
    return result;
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

async function printHtml(job, context = {}) {
  const simulate = !!job.simulate || process.env.CLOUD_PRINT_SIMULATE === '1';
  const printers = await listPrinters(context.window);
  const { options, printer } = buildOptions(job, printers);

  if (!printer && !simulate) {
    return { ok: false, error: '没有可用的打印机，请先在系统中安装打印机。' };
  }
  if (!options.deviceName && !simulate) {
    return { ok: false, error: '未找到指定的打印机，请重新选择。' };
  }

  if (context.onProgress) {
    context.onProgress({ stage: 'preparing', printer: printer ? printer.displayName : '模拟打印机' });
  }

  if (simulate) {
    await sleep(900);
    if (context.onProgress) context.onProgress({ stage: 'spooling', percent: 65 });
    await sleep(700);
    if (context.onProgress) context.onProgress({ stage: 'done', percent: 100 });
    return { ok: true, simulated: true, printer: printer ? printer.name : 'simulate', pages: job.pages || 1 };
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moprint-'));
  const file = path.join(dir, 'print.html');
  fs.writeFileSync(file, job.html, 'utf8');

  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      images: true,
    },
  });

  try {
    await win.loadFile(file);
    await sleep(500);
    if (context.onProgress) context.onProgress({ stage: 'spooling', percent: 35 });
    const result = await new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, error: '打印超时，系统未返回结果。' });
      }, 120000);
      try {
        win.webContents.print(options, (success, failureReason) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (success) resolve({ ok: true, printer: printer.name, pages: job.pages || 1 });
          else resolve({ ok: false, error: failureReason || '系统打印失败。' });
        });
      } catch (err) {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve({ ok: false, error: err.message || String(err) });
        }
      }
    });
    if (context.onProgress) context.onProgress({ stage: result.ok ? 'done' : 'failed', percent: 100, ...result });
    return result;
  } catch (err) {
    if (context.onProgress) context.onProgress({ stage: 'failed', error: err.message });
    return { ok: false, error: err.message || String(err) };
  } finally {
    try { win.destroy(); } catch { /* ignore */ }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

async function readCapabilities() {
  const helper = app.isPackaged
    ? path.join(process.resourcesPath, 'print-caps.exe')
    : path.join(__dirname, '..', 'build', 'MoPrint.PrintCaps.exe');
  if (!fs.existsSync(helper)) return {};
  return new Promise((resolve) => {
    execFile(helper, [], { windowsHide: true, timeout: 8000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        console.error('[printer] caps failed', err.message);
        resolve({});
        return;
      }
      try {
        const data = JSON.parse(String(stdout).replace(/^\uFEFF/, ''));
        const map = {};
        for (const item of data.printers || []) map[item.name] = item;
        resolve(map);
      } catch (parseError) {
        console.error('[printer] caps json', parseError.message);
        resolve({});
      }
    });
  });
}

async function listStatus(win) {
  const printers = await listPrinters(win);
  const caps = await readCapabilities();
  return printers.map((p) => ({
    ...p,
    available: p.status === 0 || p.status === undefined,
    capabilities: caps[p.name] || null,
  }));
}

module.exports = { printHtml, printImages, imagesToHtml, listPrinters, listStatus };
