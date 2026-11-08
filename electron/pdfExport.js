const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const PAPER_POINTS = {
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
  '5寸': [252, 360],
  '6寸': [288, 432],
  '7寸': [360, 504],
  '8寸': [432, 576],
};

function decodeDataUrl(dataUrl) {
  const text = String(dataUrl || '');
  const comma = text.indexOf(',');
  if (comma < 0) throw new Error('页面图像格式无效');
  const meta = text.slice(0, comma);
  const bytes = Buffer.from(text.slice(comma + 1), 'base64');
  return { bytes, mime: /jpe?g/i.test(meta) ? 'image/jpeg' : 'image/png' };
}

async function exportImagesPdf(job, filePath) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('墨印 PDF 检查');
  pdf.setProducer('墨印 MoPrint');
  pdf.setCreator('墨印 MoPrint');

  const images = Array.isArray(job.images) ? job.images : [];
  if (!images.length) throw new Error('没有可导出的页面。');

  const paper = String(job.pageSize || job.item?.paper || 'A4').toUpperCase();
  const base = PAPER_POINTS[paper] || PAPER_POINTS.A4;
  const copies = Math.max(1, Math.min(99, Number(job.copies) || 1));
  const orientations = Array.isArray(job.orientations) ? job.orientations : [];

  let pageCount = 0;
  for (let copy = 0; copy < copies; copy += 1) {
    for (let i = 0; i < images.length; i += 1) {
      const { bytes, mime } = decodeDataUrl(images[i]);
      const image = mime === 'image/jpeg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      const landscape = orientations.length ? !!orientations[i] : !!job.landscape;
      const width = landscape ? base[1] : base[0];
      const height = landscape ? base[0] : base[1];
      const page = pdf.addPage([width, height]);
      const fit = image.scaleToFit(width, height);
      page.drawImage(image, {
        x: (width - fit.width) / 2,
        y: (height - fit.height) / 2,
        width: fit.width,
        height: fit.height,
      });
      pageCount += 1;
    }
  }

  const out = await pdf.save();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(out));
  return { ok: true, virtual: true, printer: '墨印 PDF 检查机', pdfPath: filePath, pages: pageCount };
}

module.exports = { exportImagesPdf };
