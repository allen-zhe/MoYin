'use strict';

// Office 文档转换：Word / Excel / PowerPoint → PDF，再交给现有 PDF 渲染管线。
// 优先调用本机 Microsoft Office（COM，保真度最高），失败或未安装时回退 LibreOffice。

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { app } = require('electron');

const OFFICE_EXT = new Set(['.doc', '.docx', '.rtf', '.xls', '.xlsx', '.xlsm', '.csv', '.ppt', '.pptx', '.pptm']);
const CONVERT_TIMEOUT = 180000;

function isOfficePath(file) {
  return OFFICE_EXT.has(path.extname(String(file || '')).toLowerCase());
}

function helperPath() {
  const file = app.isPackaged
    ? path.join(process.resourcesPath, 'office-conv.exe')
    : path.join(__dirname, '..', 'build', 'MoPrint.OfficeConv.exe');
  return fs.existsSync(file) ? file : null;
}

function cacheDir() {
  const dir = path.join(app.getPath('userData'), 'office-cache');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cachePathFor(file) {
  const stat = fs.statSync(file);
  const key = crypto.createHash('sha1')
    .update(`${file.toLowerCase()}|${stat.size}|${Math.round(stat.mtimeMs)}`)
    .digest('hex');
  return path.join(cacheDir(), `${key}.pdf`);
}

function runCom(helper, input, output) {
  return new Promise((resolve, reject) => {
    execFile(helper, [input, output], { windowsHide: true, timeout: CONVERT_TIMEOUT, maxBuffer: 2 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) {
        const msg = String(stderr || err.message || '').trim().split(/\r?\n/).filter(Boolean).slice(-2).join(' ');
        reject(new Error(msg || 'Office 转换失败'));
        return;
      }
      resolve();
    });
  });
}

const SOFFICE_CANDIDATES = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
];

function findSoffice() {
  if (process.env.MOPRINT_SOFFICE && fs.existsSync(process.env.MOPRINT_SOFFICE)) return process.env.MOPRINT_SOFFICE;
  return SOFFICE_CANDIDATES.find((p) => fs.existsSync(p)) || null;
}

function runLibreOffice(soffice, input, output) {
  return new Promise((resolve, reject) => {
    const outDir = path.dirname(output);
    const base = path.basename(input, path.extname(input));
    const produced = path.join(outDir, `${base}.pdf`);
    try { if (fs.existsSync(produced)) fs.unlinkSync(produced); } catch { /* ignore */ }
    execFile(
      soffice,
      ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', outDir, input],
      { windowsHide: true, timeout: CONVERT_TIMEOUT, maxBuffer: 4 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) { reject(new Error(String(stderr || err.message || 'LibreOffice 转换失败').trim())); return; }
        try {
          if (!fs.existsSync(produced)) { reject(new Error('LibreOffice 未生成 PDF')); return; }
          if (path.resolve(produced) !== path.resolve(output)) fs.renameSync(produced, output);
          resolve();
        } catch (moveErr) { reject(moveErr); }
      },
    );
  });
}

async function convertOffice(file) {
  if (!isOfficePath(file)) throw new Error('不是可转换的 Office 文件');
  if (!fs.existsSync(file)) throw new Error('文件不存在');
  const output = cachePathFor(file);
  if (fs.existsSync(output) && fs.statSync(output).size > 0) return output;

  const partial = `${output}.tmp.pdf`;
  try { if (fs.existsSync(partial)) fs.unlinkSync(partial); } catch { /* ignore */ }

  const errors = [];
  const helper = helperPath();
  if (helper) {
    try {
      await runCom(helper, file, partial);
      if (fs.existsSync(partial) && fs.statSync(partial).size > 0) {
        fs.renameSync(partial, output);
        return output;
      }
      errors.push('Office 转换未生成文件');
    } catch (err) {
      errors.push(`Microsoft Office：${err.message}`);
    }
  } else {
    errors.push('未找到内置 Office 转换组件');
  }

  const soffice = findSoffice();
  if (soffice) {
    try {
      await runLibreOffice(soffice, file, partial);
      if (fs.existsSync(partial) && fs.statSync(partial).size > 0) {
        fs.renameSync(partial, output);
        return output;
      }
      errors.push('LibreOffice 转换未生成文件');
    } catch (err) {
      errors.push(`LibreOffice：${err.message}`);
    }
  } else {
    errors.push('未安装 LibreOffice');
  }

  try { if (fs.existsSync(partial)) fs.unlinkSync(partial); } catch { /* ignore */ }
  throw new Error(`无法转换 ${path.basename(file)}。${errors.join('；')}。请安装 Microsoft Office 或 LibreOffice。`);
}

async function countPdfPages(pdfPath) {
  try {
    const { PDFDocument } = require('pdf-lib');
    const bytes = await fs.promises.readFile(pdfPath);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    return null;
  }
}

async function prepareOfficeFile(filePath) {
  const pdfPath = await convertOffice(filePath);
  const pages = await countPdfPages(pdfPath);
  return { pdfPath, pages };
}

module.exports = { OFFICE_EXT, isOfficePath, convertOffice, prepareOfficeFile, findSoffice };
