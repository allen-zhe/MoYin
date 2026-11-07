import { renderPdfPages, renderImagePage, isPdf, isImage, toLocalUrl } from './pdf.js';
import { filePages } from './format.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PAPER_MM = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A5: { w: 148, h: 210 },
  Letter: { w: 215.9, h: 279.4 },
};

export function paperSize(item, landscape) {
  const paper = PAPER_MM[item?.paper] || PAPER_MM.A4;
  return landscape ? { w: paper.h, h: paper.w } : { ...paper };
}

async function renderTextPages(file, item, dpi = 300) {
  const res = await window.cloudPrint.readFile(file.path);
  if (!res?.ok) throw new Error('文本读取失败');
  const text = new TextDecoder('utf-8').decode(res.data);
  const factor = Math.max(1, Number(dpi) / 150);
  const width = Math.round(1240 * factor);
  const height = Math.round(1754 * factor);
  const margin = Math.round(100 * factor);
  const fontSize = Math.round(28 * factor);
  const lineHeight = Math.round(44 * factor);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  const pages = [];
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#1d1d1f';
  ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
  let y = margin + fontSize;
  for (const raw of text.split(/\r?\n/)) {
    const chars = [...raw];
    let line = '';
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > width - margin * 2) {
        ctx.fillText(line, margin, y);
        y += lineHeight;
        line = ch;
        if (y > height - margin) {
          pages.push({ dataUrl: canvas.toDataURL('image/png'), width, height, blank: false, coverage: 0.06 });
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = '#1d1d1f'; ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
          y = margin + fontSize;
        }
      } else line = test;
    }
    ctx.fillText(line, margin, y);
    y += lineHeight;
    if (y > height - margin) {
      pages.push({ dataUrl: canvas.toDataURL('image/png'), width, height, blank: false });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#1d1d1f'; ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
      y = margin + fontSize;
    }
  }
  pages.push({ dataUrl: canvas.toDataURL('image/png'), width, height, blank: false });
  return pages;
}

export async function renderFilePages(file, item, { dpi = 300, range = '', onProgress } = {}) {
  const ext = String(file.ext || '').toLowerCase();
  if (ext === 'pdf') {
    return renderPdfPages(file.path, { dpi, range, onPage: (n, total) => onProgress?.(n, total) });
  }
  if (ext === 'txt') {
    return renderTextPages(file, item, dpi);
  }
  if (isImage(file)) {
    return [await renderImagePage(file.path, dpi)];
  }
  throw new Error(`暂不支持 ${ext.toUpperCase()} 格式，请先转为 PDF 或图片。`);
}

export async function preparePrint(files, item, options = {}) {
  const { copies = 1, pageRange = '', skipBlank = false, onProgress, dpi = 300 } = options;
  const pages = [];
  const fileSummaries = [];
  let coverageWeight = 0;
  let coverageArea = 0;
  let firstRatio = 0;

  for (let fi = 0; fi < files.length; fi += 1) {
    const file = files[fi];
    onProgress?.({ stage: 'render', fileIndex: fi, fileCount: files.length, name: file.name, percent: Math.round((fi / files.length) * 70) });
    let rendered = [];
    try {
      rendered = await renderFilePages(file, item, {
        dpi,
        range: pageRange,
        onProgress: (n, total) => onProgress?.({
          stage: 'render', fileIndex: fi, fileCount: files.length, name: file.name,
          page: n, pageTotal: total, percent: Math.round(((fi + n / Math.max(1, total)) / files.length) * 70),
        }),
      });
    } catch (err) {
      throw new Error(`${file.name}：${err.message}`);
    }
    const filtered = skipBlank ? rendered.filter((p) => !p.blank) : rendered;
    if (!filtered.length) continue;
    if (!firstRatio && filtered[0].width && filtered[0].height) firstRatio = filtered[0].width / filtered[0].height;
    fileSummaries.push({ ...file, printedPages: filtered.length });
    for (const p of filtered) {
      pages.push({ ...p, fileId: file.id, fileName: file.name });
      const area = (p.width || 1) * (p.height || 1);
      coverageWeight += (p.coverage || 0) * area;
      coverageArea += area;
    }
  }

  if (!pages.length) throw new Error('没有可打印的页面。');
  const landscape = item.orientation === 'landscape' || (item.orientation !== 'portrait' && firstRatio > 1.12);
  const size = paperSize(item, landscape);
  const pageCss = `${size.w}mm ${size.h}mm`;
  const objectFit = item.scale === 'fill' ? 'cover' : item.scale === 'actual' ? 'none' : 'contain';
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>打印</title>
<style>
  @page { size: ${pageCss}; margin: 0; }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  .sheet{width:${size.w}mm;height:${size.h}mm;page-break-after:always;break-after:page;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;position:relative}
  .sheet:last-child{page-break-after:auto;break-after:auto}
  .sheet img{width:100%;height:100%;object-fit:contain;display:block}
  .sheet .num{position:absolute;right:4mm;bottom:2.5mm;font:9pt "Microsoft YaHei",sans-serif;color:#8a8a8a}
  @media print{.sheet{page-break-inside:avoid}}
</style></head><body>
${pages.map((p, i) => `<div class="sheet"><img src="${p.dataUrl}" alt="" style="object-fit:${objectFit};${item.scale === 'actual' ? 'width:auto;height:auto;max-width:100%;max-height:100%' : ''}"><span class="num">${i + 1}</span></div>`).join('')}
</body></html>`;

  if (item.duplex && item.duplex !== 'simplex' && pages.length % 2 === 1) {
    // The printer handles duplex; a trailing blank sheet keeps the next job from
    // starting on the back of the last page in some drivers.
  }

  return {
    html,
    pages: pages.length,
    files: fileSummaries,
    paper: item.paper || 'A4',
    landscape,
    pageCss,
    copies: Math.max(1, Number(copies) || 1),
    coverage: coverageArea ? coverageWeight / coverageArea : 0,
    images: pages.map((p) => p.dataUrl),
  };
}

export function sheetsToHtml(sheets, paper, landscape) {
  const size = paperSize({ paper }, landscape);
  const pageCss = `${size.w}mm ${size.h}mm`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:${pageCss};margin:0}
  *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}
  .sheet{width:${size.w}mm;height:${size.h}mm;page-break-after:always;break-after:page;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff}
  .sheet:last-child{page-break-after:auto;break-after:auto}.sheet img{width:100%;height:100%;object-fit:contain;display:block}
  </style></head><body>${sheets.map((s) => `<div class="sheet"><img src="${s.dataUrl}" alt=""></div>`).join('')}</body></html>`;
}

export async function executePrint({ html, images, item, copies, paper, landscape, simulate, jobId }) {
  if (images?.length && window.cloudPrint.printImages) {
    const result = await window.cloudPrint.printImages({
      images,
      jobId,
      deviceName: item.printer || '',
      item,
      copies,
      pageSize: paper || item.paper || 'A4',
      duplex: item.duplex || 'simplex',
      color: item.color !== 'mono',
      landscape: !!landscape,
      simulate: !!simulate,
    });
    if (result && result.ok) return result;
    if (result && result.fallback) {
      // C# helper unavailable: fall through to Chromium printing.
    } else if (result && !result.ok) {
      return result;
    }
  }
  return window.cloudPrint.printHtml({
    html,
    jobId,
    deviceName: item.printer || '',
    item,
    copies,
    pageSize: paper || item.paper || 'A4',
    duplex: item.duplex || 'simplex',
    landscape: !!landscape,
    simulate: !!simulate,
  });
}

export function previewUrl(file) {
  if (!file) return '';
  if (isImage(file)) return toLocalUrl(file.path);
  return '';
}

export function filePageLabel(file) {
  if (String(file.ext).toLowerCase() === 'pdf') return `${filePages(file)} 页`;
  return '1 页';
}
