import { analyzeCanvas, loadImage, toLocalUrl } from './pdf.js';

const PAPER = {
  A4: [210, 297],
  A3: [297, 420],
  A5: [148, 210],
  Letter: [215.9, 279.4],
};

const DPI = 150;
const MM = (mm) => Math.round((Number(mm) / 25.4) * DPI);

export function paperPx(paper = 'A4', landscape = false) {
  const [w, h] = PAPER[paper] || PAPER.A4;
  const size = landscape ? [h, w] : [w, h];
  return { width: MM(size[0]), height: MM(size[1]) };
}

function drawFit(ctx, img, x, y, w, h) {
  const ratio = Math.min(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function makePage(paper, landscape) {
  const size = paperPx(paper, landscape);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx, ...size };
}

function finishSheet(page) {
  const analysis = analyzeCanvas(page.canvas);
  return {
    dataUrl: page.canvas.toDataURL('image/png'),
    width: page.width,
    height: page.height,
    coverage: analysis.coverage,
    blank: analysis.blank,
  };
}

export async function splitLongImage(file, options = {}) {
  const img = await loadImage(toLocalUrl(file.path));
  const paper = options.paper || 'A4';
  const landscape = !!options.landscape;
  const overlapMm = Math.max(0, Number(options.overlapMm) || 0);
  const page = makePage(paper, landscape);
  const margin = MM(6);
  const contentW = page.width - margin * 2;
  const contentH = page.height - margin * 2;
  const scale = contentW / img.width;
  const drawW = contentW;
  const drawH = img.height * scale;
  const step = Math.max(100, contentH - MM(overlapMm));
  const count = Math.max(1, Math.ceil((drawH - MM(2)) / step));
  const sheets = [];
  for (let i = 0; i < count; i += 1) {
    const p = makePage(paper, landscape);
    const start = i * step;
    p.ctx.save();
    p.ctx.beginPath();
    p.ctx.rect(margin, margin, contentW, contentH);
    p.ctx.clip();
    p.ctx.drawImage(img, margin, margin - start, drawW, drawH);
    p.ctx.restore();
    sheets.push(finishSheet(p));
  }
  return sheets;
}

export async function composePages(pages, mode, options = {}) {
  const paper = options.paper || 'A4';
  const landscape = !!options.landscape;
  const sheet = paperPx(paper, landscape);
  const margin = MM(4);
  const gap = MM(3);
  const src = pages.map((p) => p.dataUrl);

  if (mode === 'a3' || mode === 'a4-to-a3') {
    const sheets = [];
    for (let i = 0; i < src.length; i += 2) {
      // Two A4 pages per A3 sheet. Portrait sources sit side by side on an
      // A3 landscape sheet; landscape sources stack top/bottom on A3 portrait.
      const pageW = pages[i]?.width || 0;
      const pageH = pages[i]?.height || 0;
      const srcLandscape = pageW > pageH * 1.12;
      const p = makePage('A3', !srcLandscape);
      const cellW = srcLandscape
        ? p.width - margin * 2
        : (p.width - margin * 2 - gap) / 2;
      const cellH = srcLandscape
        ? (p.height - margin * 2 - gap) / 2
        : p.height - margin * 2;
      for (let j = 0; j < 2; j += 1) {
        const data = src[i + j];
        if (!data) continue;
        const img = await loadImage(data);
        if (srcLandscape) drawFit(p.ctx, img, margin, margin + j * (cellH + gap), cellW, cellH);
        else drawFit(p.ctx, img, margin + j * (cellW + gap), margin, cellW, cellH);
      }
      sheets.push(finishSheet(p));
    }
    return sheets;
  }

  if (mode === 'booklet') {
    const total = Math.max(4, Math.ceil(src.length / 4) * 4);
    const ordered = [];
    for (let i = 0; i < total / 4; i += 1) {
      ordered.push(total - i * 2, i * 2 + 1, i * 2 + 2, total - i * 2 - 1);
    }
    const sheets = [];
    for (let i = 0; i < ordered.length; i += 2) {
      const p = makePage('A4', true);
      const cellW = (p.width - margin * 2 - gap) / 2;
      const cellH = p.height - margin * 2;
      for (let j = 0; j < 2; j += 1) {
        const n = ordered[i + j];
        const data = src[n - 1];
        if (!data) continue;
        const img = await loadImage(data);
        drawFit(p.ctx, img, margin + j * (cellW + gap), margin, cellW, cellH);
      }
      sheets.push(finishSheet(p));
    }
    return sheets;
  }

  if (mode === 'repeat') {
    const rows = Math.max(1, Math.min(8, Number(options.rows) || 2));
    const cols = Math.max(1, Math.min(8, Number(options.cols) || 2));
    const data = src[Math.max(0, Number(options.sourceIndex) || 0)] || src[0];
    if (!data) return [];
    const img = await loadImage(data);
    const p = makePage(paper, landscape);
    const cellW = (sheet.width - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = (sheet.height - margin * 2 - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        drawFit(p.ctx, img, margin + c * (cellW + gap), margin + r * (cellH + gap), cellW, cellH);
      }
    }
    return [finishSheet(p)];
  }

  // n-up: 2 / 4 / 6 / 9. The grid follows the sheet orientation so a
  // portrait 2-up stacks pages top/bottom while a landscape 2-up places
  // them side by side.
  const n = [2, 4, 6, 9].includes(Number(options.nup)) ? Number(options.nup) : 4;
  let cols;
  let rows;
  if (n === 2) { cols = landscape ? 2 : 1; rows = landscape ? 1 : 2; }
  else if (n === 6) { cols = landscape ? 3 : 2; rows = landscape ? 2 : 3; }
  else if (n === 9) { cols = 3; rows = 3; }
  else { cols = 2; rows = 2; }
  const sheets = [];
  for (let i = 0; i < src.length; i += n) {
    const p = makePage(paper, landscape);
    const cellW = (sheet.width - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = (sheet.height - margin * 2 - gap * (rows - 1)) / rows;
    for (let j = 0; j < n; j += 1) {
      const data = src[i + j];
      if (!data) continue;
      const img = await loadImage(data);
      const c = j % cols;
      const r = Math.floor(j / cols);
      drawFit(p.ctx, img, margin + c * (cellW + gap), margin + r * (cellH + gap), cellW, cellH);
    }
    sheets.push(finishSheet(p));
  }
  return sheets;

}

export function coverageOf(sheets) {
  if (!sheets?.length) return 0;
  let weighted = 0;
  let area = 0;
  for (const s of sheets) {
    const a = (s.width || 1) * (s.height || 1);
    weighted += (s.coverage || 0) * a;
    area += a;
  }
  return area ? weighted / area : 0;
}
