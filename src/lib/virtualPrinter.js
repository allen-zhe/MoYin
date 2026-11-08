export const VIRTUAL_PDF_NAME = '__moprint_pdf__';

const paper = (name, width, height) => ({ name, width, height, kind: 0 });

export const VIRTUAL_PDF_PRINTER = {
  name: VIRTUAL_PDF_NAME,
  displayName: '墨印 PDF 检查机',
  virtual: true,
  isDefault: false,
  available: true,
  status: 0,
  capabilities: {
    supportsColor: true,
    canDuplex: true,
    papers: [
      paper('A3', 1169, 1654),
      paper('A4', 827, 1169),
      paper('A5', 583, 827),
    ],
    maxWidth: 1169,
    maxHeight: 1654,
  },
};

export function withVirtualPrinter(printers) {
  const list = Array.isArray(printers) ? printers : [];
  return list.some((p) => p.name === VIRTUAL_PDF_NAME) ? list : [...list, VIRTUAL_PDF_PRINTER];
}
