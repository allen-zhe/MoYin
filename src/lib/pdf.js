import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const docCache = new Map();
const thumbCache = new Map();

async function readBytes(path) {
  const res = await window.cloudPrint.readFile(path);
  if (!res || !res.ok) throw new Error(res?.error || '文件读取失败');
  const bytes = res.data instanceof Uint8Array ? res.data : new Uint8Array(res.data);
  return new Uint8Array(bytes);
}

async function loadDoc(path) {
  if (docCache.has(path)) return docCache.get(path);
  const data = await readBytes(path);
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false, useSystemFonts: true });
  const promise = task.promise;
  docCache.set(path, promise);
  try {
    const doc = await promise;
    if (docCache.size > 10) {
      const first = docCache.keys().next().value;
      if (first !== path) docCache.delete(first);
    }
    return doc;
  } catch (err) {
    docCache.delete(path);
    throw err;
  }
}

export async function getPdfPageCount(path) {
  const doc = await loadDoc(path);
  return doc.numPages;
}

export async function renderPdfThumb(path, width = 300) {
  const key = `${path}:${width}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const task = (async () => {
    const doc = await loadDoc(path);
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = width / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
    return canvas.toDataURL('image/jpeg', 0.86);
  })();
  thumbCache.set(key, task);
  try {
    return await task;
  } catch (err) {
    thumbCache.delete(key);
    throw err;
  }
}

function parsePageRange(range, total, fallbackAll = true) {
  if (!range || !String(range).trim()) return fallbackAll ? Array.from({ length: total }, (_, i) => i + 1) : [];
  const pages = new Set();
  for (const part of String(range).split(',')) {
    const token = part.trim();
    if (!token) continue;
    const m = token.match(/^(\d+)\s*[-~]\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, Number(m[1]));
      const b = Math.min(total, Number(m[2]));
      for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) pages.add(i);
    } else if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n >= 1 && n <= total) pages.add(n);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export async function renderPdfPages(path, { dpi = 300, range = '', onPage } = {}) {
  const doc = await loadDoc(path);
  const pages = parsePageRange(range, doc.numPages);
  const out = [];
  for (let i = 0; i < pages.length; i += 1) {
    const pageNo = pages[i];
    const page = await doc.getPage(pageNo);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(8.34, Math.max(1, dpi / 72));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
    const analysis = analyzeCanvas(canvas);
    const dataUrl = canvas.toDataURL('image/png');
    out.push({ page: pageNo, dataUrl, width: base.width, height: base.height, blank: analysis.blank, coverage: analysis.coverage });
    if (onPage) onPage(i + 1, pages.length);
  }
  return out;
}

export function analyzeCanvas(canvas) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const step = Math.max(2, Math.floor((canvas.width * canvas.height) / 150000));
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonWhite = 0;
    let samples = 0;
    for (let i = 0; i < data.length; i += 4 * step) {
      samples += 1;
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
      if (r < 245 || g < 245 || b < 245) nonWhite += 1;
    }
    const coverage = samples > 0 ? nonWhite / samples : 0;
    return { blank: samples > 0 && coverage < 0.001, coverage };
  } catch {
    return { blank: false, coverage: 0 };
  }
}

export async function renderImagePage(path, dpi = 300) {
  const url = toLocalUrl(path);
  const img = await loadImage(url);
  const maxWidth = Math.round((dpi / 25.4) * 297);
  const scale = Math.min(4.6, maxWidth / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const analysis = analyzeCanvas(canvas);
  return { dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight, blank: analysis.blank, coverage: analysis.coverage };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

export function toLocalUrl(filePath) {
  if (!filePath) return '';
  const normalized = String(filePath).replace(/\\/g, '/');
  const encoded = normalized
    .split('/')
    .map((part, index) => (index === 0 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part)))
    .join('/');
  return `file:///${encoded}`;
}

export function isImage(file) {
  return ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff'].includes(String(file.ext || '').toLowerCase());
}

export function isPdf(file) {
  return String(file.ext || '').toLowerCase() === 'pdf';
}

export function clearCaches() {
  docCache.clear();
  thumbCache.clear();
}

