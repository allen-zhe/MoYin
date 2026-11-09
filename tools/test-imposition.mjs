// Focused verification for imposition layout logic (a4-to-a3 and n-up).
// Bundles src/lib/imposition.js with a stub for the browser-only pdf.js module
// and runs it against mocked canvas/Image globals to assert sheet orientation,
// sheet count, and cell placement.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// ---- browser-ish globals -------------------------------------------------
const createdCanvases = [];
function makeMockCtx() {
  const calls = [];
  return {
    calls,
    fillStyle: '#fff',
    imageSmoothingQuality: 'low',
    fillRect() {},
    drawImage(_img, x, y, w, h) { calls.push({ x, y, w, h }); },
    save() {}, restore() {},
    beginPath() {}, rect() {}, clip() {},
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
  };
}
function makeMockCanvas() {
  const ctx = makeMockCtx();
  const canvas = {
    width: 0,
    height: 0,
    ctx,
    getContext() { return ctx; },
    toDataURL() { return 'data:image/png;base64,AA=='; },
  };
  createdCanvases.push(canvas);
  return canvas;
}

globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') return makeMockCanvas();
    throw new Error('unexpected createElement: ' + tag);
  },
};
globalThis.Image = class {
  set src(_v) { /* noop */ }
};

// ---- bundle imposition.js with a stubbed pdf.js --------------------------
const pdfStub = `
export function analyzeCanvas() { return { blank: false, coverage: 0.5 }; }
export async function loadImage(src) { return { width: 100, height: 100, src }; }
export function toLocalUrl(p) { return p; }
`;

const result = await build({
  stdin: {
    contents: `import { composePages, paperPx } from './src/lib/imposition.js'; export { composePages, paperPx };`,
    resolveDir: root,
    sourcefile: 'imposition-test-entry.js',
    loader: 'js',
  },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  plugins: [{
    name: 'stub-pdf',
    setup(build) {
      build.onResolve({ filter: /pdf\.js$/ }, () => ({ path: 'pdf-stub', namespace: 'stub' }));
      build.onLoad({ filter: /^pdf-stub$/, namespace: 'stub' }, () => ({ contents: pdfStub, loader: 'js' }));
    },
  }],
});
if (!result.outputFiles?.length) throw new Error('bundle failed');

const tmp = path.join(os.tmpdir(), `moprint-imposition-test-${Date.now()}.cjs`);
fs.writeFileSync(tmp, result.outputFiles[0].text, 'utf8');
const require = createRequire(import.meta.url);
const { composePages } = require(tmp);

// ---- helpers -------------------------------------------------------------
const P = (w, h) => ({ dataUrl: `data:image/png;base64,${w}x${h}`, width: w, height: h });
const callsFor = (sheetIndex) => createdCanvases[sheetIndex]?.ctx.calls || [];

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg); }
  else { failures += 1; console.error('  ✗', msg); }
}

(async () => {
  console.log('— a4-to-a3, 2 portrait A4 pages —');
  createdCanvases.length = 0;
  let sheets = await composePages([P(595, 842), P(595, 842)], 'a3', {});
  assert(sheets.length === 1, `1 sheet (got ${sheets.length})`);
  assert(sheets[0] && sheets[0].width > sheets[0].height, `A3 landscape sheet (${sheets[0]?.width}x${sheets[0]?.height})`);
  assert(callsFor(0).length === 2, 'two pages drawn');

  console.log('— a4-to-a3, 2 landscape A4 pages —');
  createdCanvases.length = 0;
  sheets = await composePages([P(842, 595), P(842, 595)], 'a3', {});
  assert(sheets.length === 1, `1 sheet (got ${sheets.length})`);
  assert(sheets[0] && sheets[0].width < sheets[0].height, `A3 portrait sheet (${sheets[0]?.width}x${sheets[0]?.height})`);
  const lc = callsFor(0);
  assert(lc.length === 2, 'two pages drawn');
  assert(lc[0] && lc[1] && lc[0].y < lc[1].y, `landscape stacked top/bottom (y ${lc[0]?.y} vs ${lc[1]?.y})`);

  console.log('— a4-to-a3, 4 portrait A4 pages —');
  createdCanvases.length = 0;
  sheets = await composePages([P(595, 842), P(595, 842), P(595, 842), P(595, 842)], 'a3', {});
  assert(sheets.length === 2, `2 sheets, not 4-on-1 (got ${sheets.length})`);

  console.log('— n-up 2, portrait (top/bottom) —');
  createdCanvases.length = 0;
  sheets = await composePages([P(595, 842), P(595, 842)], 'nup', { paper: 'A4', landscape: false, nup: 2 });
  let nc = callsFor(0);
  assert(nc.length === 2, 'two pages drawn');
  assert(nc[0] && nc[1] && nc[0].y < nc[1].y, `portrait 2-up stacks top/bottom (y ${nc[0]?.y} vs ${nc[1]?.y})`);
  assert(nc[0] && nc[1] && Math.abs(nc[0].x - nc[1].x) < 5, `same column (x ${nc[0]?.x} vs ${nc[1]?.x})`);

  console.log('— n-up 2, landscape (left/right) —');
  createdCanvases.length = 0;
  sheets = await composePages([P(595, 842), P(595, 842)], 'nup', { paper: 'A4', landscape: true, nup: 2 });
  nc = callsFor(0);
  assert(nc.length === 2, 'two pages drawn');
  assert(nc[0] && nc[1] && nc[0].x < nc[1].x, `landscape 2-up side by side (x ${nc[0]?.x} vs ${nc[1]?.x})`);
  assert(nc[0] && nc[1] && Math.abs(nc[0].y - nc[1].y) < 5, `same row (y ${nc[0]?.y} vs ${nc[1]?.y})`);

  console.log('— n-up 6, landscape (3x2) vs portrait (2x3) —');
  const six = [P(595, 842), P(595, 842), P(595, 842), P(595, 842), P(595, 842), P(595, 842)];
  createdCanvases.length = 0;
  await composePages(six, 'nup', { paper: 'A4', landscape: true, nup: 6 });
  nc = callsFor(0);
  const xs = [...new Set(nc.map((c) => Math.round(c.x)))];
  assert(xs.length === 3, `landscape 6-up = 3 columns (got ${xs.length})`);

  createdCanvases.length = 0;
  await composePages(six, 'nup', { paper: 'A4', landscape: false, nup: 6 });
  nc = callsFor(0);
  const ys = [...new Set(nc.map((c) => Math.round(c.y)))];
  assert(ys.length === 3, `portrait 6-up = 3 rows (got ${ys.length})`);

  try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  if (failures) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log('\nAll imposition layout checks passed.');
})();
