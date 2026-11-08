const PAPER_MM = {
  A4: [210, 297],
  A3: [297, 420],
  A5: [148, 210],
  Letter: [215.9, 279.4],
};

const INCH = 100;

function paperMatches(cap, name) {
  const paper = String(name || '').toUpperCase();
  if (!cap) return false;
  const capName = String(cap.name || '').toUpperCase();
  if (capName.includes(paper)) return true;
  const mm = PAPER_MM[paper];
  if (!mm) return false;
  const w = Math.round((mm[0] / 25.4) * INCH);
  const h = Math.round((mm[1] / 25.4) * INCH);
  return (Math.abs(cap.width - w) <= 8 && Math.abs(cap.height - h) <= 8)
    || (Math.abs(cap.width - h) <= 8 && Math.abs(cap.height - w) <= 8);
}

export function isVirtualPrinter(printer) {
  if (printer?.virtual) return true;
  const name = String(printer?.name || printer?.displayName || '');
  return /microsoft\s+(print\s+to\s+pdf|xps)|onenote|send\s+to|fax|adobe\s+pdf|pdf24|cutepdf|dopdf|moprint/i.test(name);
}

export function choosePrinter(item, printers) {
  if (!printers?.length) return '';
  const physical = printers.filter((p) => p.capabilities && !isVirtualPrinter(p));
  const candidates = physical.length ? physical : printers.filter((p) => p.capabilities);
  if (!candidates.length) return (printers.find((p) => p.isDefault) || printers[0]).name;
  const paperOk = (p) => supportsPaper(p, item.paper);
  const colorOk = (p) => item.color === 'color'
    ? !!p.capabilities.supportsColor
    : !p.capabilities.supportsColor;
  const duplexOk = (p) => item.duplex === 'simplex' || !!p.capabilities.canDuplex;

  // Never choose a printer that cannot feed the requested paper if any
  // capable printer exists. This keeps A3 jobs off A4-only mono printers.
  const paperPool = candidates.filter(paperOk);
  const pool = paperPool.length ? paperPool : candidates;
  const exactColor = pool.filter(colorOk);
  const colorFallback = pool.filter((p) => !!p.capabilities.supportsColor);
  const source = exactColor.length ? exactColor : (colorFallback.length ? colorFallback : pool);
  const score = (p) => (colorOk(p) ? 100 : 0) + (paperOk(p) ? 50 : 0) + (duplexOk(p) ? 20 : 0) + (p.isDefault ? 5 : 0);
  return source.slice().sort((a, b) => score(b) - score(a))[0]?.name || '';
}

export function assignPrintersToItems(items, printers) {
  let changed = false;
  const next = (items || []).map((item) => {
    if (item.printer) return item;
    const printer = choosePrinter(item, printers);
    if (!printer) return item;
    changed = true;
    return { ...item, printer };
  });
  return { items: next, changed };
}

export function printerFor(printers, name) {
  if (!printers?.length) return null;
  if (name) {
    const found = printers.find((p) => p.name === name || p.displayName === name);
    if (found) return found;
  }
  return printers.find((p) => p.isDefault) || printers[0];
}

export function supportsPaper(printer, paper) {
  const caps = printer?.capabilities;
  if (!caps || !Array.isArray(caps.papers) || !caps.papers.length) return true;
  return caps.papers.some((p) => paperMatches(p, paper));
}

export function maxPaperName(printer) {
  const caps = printer?.capabilities;
  if (!caps?.papers?.length) return '';
  for (const label of ['A3', 'A4', 'A5']) {
    if (caps.papers.some((p) => paperMatches(p, label))) return label;
  }
  let best = caps.papers[0];
  for (const p of caps.papers) {
    if (p.width * p.height > best.width * best.height) best = p;
  }
  return `${Math.round(best.width / INCH * 25.4)}×${Math.round(best.height / INCH * 25.4)} mm`;
}

export function capabilitySummary(printer) {
  const caps = printer?.capabilities;
  if (!caps) return '驱动能力未知';
  const color = caps.supportsColor ? '彩色' : '黑白';
  const duplex = caps.canDuplex ? '支持双面' : '仅单面';
  const max = maxPaperName(printer);
  return `${color} · ${duplex}${max ? ` · 最大 ${max}` : ''}`;
}

export function validateItem(item, printers) {
  const explicit = item?.printer ? printers?.find((p) => p.name === item.printer) : null;
  if (item?.printer && !explicit) {
    return { ok: false, error: `打印项目指定的打印机「${item.printer}」已不存在，请在打印设置中重新选择。` };
  }
  const printer = explicit || printerFor(printers, item?.printer);
  const caps = printer?.capabilities;
  if (!printer) return { ok: false, error: '没有可用的打印机。' };
  if (!caps) return { ok: true, printer, unknown: true };

  if (item.color === 'color' && !caps.supportsColor) {
    return { ok: false, printer, error: `打印机「${printer.displayName}」不支持彩色打印。` };
  }
  if (item.duplex && item.duplex !== 'simplex' && !caps.canDuplex) {
    return { ok: false, printer, error: `打印机「${printer.displayName}」不支持自动双面。` };
  }
  if (!supportsPaper(printer, item.paper)) {
    const max = maxPaperName(printer);
    return {
      ok: false,
      printer,
      error: `打印机「${printer.displayName}」不支持 ${item.paper}${max ? `（${max}）` : ''}。请更换打印机或纸张。`,
    };
  }
  return { ok: true, printer };
}

export function validateLabelPaper(printers, printerName, paper, width, height) {
  const printer = printerFor(printers, printerName);
  const caps = printer?.capabilities;
  if (!printer) return { ok: false, error: '没有可用的标签打印机。' };
  if (!caps) return { ok: true, printer };
  if (paper && paper !== 'auto' && paper !== 'custom' && !supportsPaper(printer, paper)) {
    return { ok: false, printer, error: `标签打印机「${printer.displayName}」不支持 ${paper}。` };
  }
  if (paper === 'custom') {
    const mmW = Number(width) || 0;
    const mmH = Number(height) || 0;
    if (caps.maxWidth && caps.maxHeight) {
      const maxW = Math.round(caps.maxWidth / INCH * 25.4);
      const maxH = Math.round(caps.maxHeight / INCH * 25.4);
      if (mmW > maxW + 1 || mmH > maxH + 1) {
        return { ok: false, printer, error: `标签尺寸超过打印机最大纸张（${maxW}×${maxH} mm）。` };
      }
    }
  }
  return { ok: true, printer };
}
