import { useEffect, useMemo, useRef, useState } from 'react';
import { Layers3, BookOpen, Grid2X2, Repeat2, Scissors, Printer, RefreshCw, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal, Button, Select, Spinner, Segmented } from './ui.jsx';
import { renderFilePages } from '../lib/print.js';
import { isImage } from '../lib/pdf.js';
import { splitLongImage, composePages, coverageOf } from '../lib/imposition.js';

const MODES = [
  { id: 'long', name: '长图分割', desc: '把一张超长图片切成多页', icon: Scissors },
  { id: 'a3', name: 'A4 拼到 A3', desc: '两页 A4 合成一张 A3，自动识别横竖', icon: Layers3 },
  { id: 'booklet', name: '小册子', desc: '骑马钉顺序，双面折页', icon: BookOpen },
  { id: 'nup', name: '多页合一', desc: '2 / 4 / 6 / 9 页合到一张', icon: Grid2X2 },
  { id: 'repeat', name: '重复拼版', desc: '同一页按行列复制满版', icon: Repeat2 },
];

export function ImpositionDialog({ open, files, item, initialMode, dpi = 300, onClose, onPrint, notify }) {
  const [mode, setMode] = useState(initialMode || 'a3');
  const [paper, setPaper] = useState('A4');
  const [landscape, setLandscape] = useState(false);
  const [overlap, setOverlap] = useState(0);
  const [nup, setNup] = useState(4);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [sheets, setSheets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sourcePages, setSourcePages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const runRef = useRef(0);

  const images = useMemo(() => (files || []).filter((f) => isImage(f)), [files]);
  const output = useMemo(() => {
    if (mode === 'a3') return { paper: 'A3', landscape: true };
    if (mode === 'booklet') return { paper: 'A4', landscape: true };
    return { paper, landscape };
  }, [mode, paper, landscape]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode || 'a3');
    // Only reset the template when the dialog opens or the caller asks for
    // a different entry point; switching templates inside the dialog must win.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    setSheets([]);
    setError('');
    setSourcePages([]);
    setPageIndex(0);
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, paper, landscape, overlap, nup, rows, cols, sourceIndex]);

  async function generate() {
    if (!open) return;
    const run = ++runRef.current;
    setBusy(true);
    setError('');
    try {
      if (mode === 'long') {
        if (!images.length) throw new Error('长图分割只支持 JPG / PNG / WEBP 等图片，请先在堆叠中选中一张长图。');
        const all = [];
        for (const file of images) {
          const part = await splitLongImage(file, { paper, landscape, overlapMm: overlap });
          all.push(...part);
          if (run !== runRef.current) return;
        }
        setSheets(all);
        setSourcePages([]);
      } else {
        const pages = [];
        for (const file of files || []) {
          const rendered = await renderFilePages(file, item, { dpi });
          pages.push(...rendered.map((p) => ({ ...p, width: p.width, height: p.height })));
          if (run !== runRef.current) return;
        }
        if (!pages.length) throw new Error('没有可拼版的页面。');
        setSourcePages(pages);
        const out = await composePages(pages, mode, {
          paper: output.paper, landscape: output.landscape, nup, rows, cols, sourceIndex,
        });
        if (run !== runRef.current) return;
        setSheets(out);
      }
    } catch (err) {
      if (run === runRef.current) setError(err.message || String(err));
    } finally {
      if (run === runRef.current) setBusy(false);
    }
  }

  function print() {
    if (!sheets.length) return;
    const sheetLandscape = sheets[0].width > sheets[0].height;
    onPrint?.({ sheets, paper: output.paper, landscape: sheetLandscape, coverage: coverageOf(sheets), mode });
  }

  const modeInfo = MODES.find((m) => m.id === mode);
  const coverage = coverageOf(sheets);
  const idx = Math.max(0, Math.min(pageIndex, sheets.length - 1));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="长图分割与文件拼版"
      subtitle="选择模板，生成新的页面后再送给当前打印档位。"
      size="lg"
      className="imposition-modal"
      footer={(
        <>
          <span className="imposition-foot-note">
            {sheets.length ? `${sheets.length} 张成品页 · 预计覆盖率 ${(coverage * 100).toFixed(1)}%` : '等待生成预览'}
          </span>
          <div className="imposition-foot-actions">
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={generate} disabled={busy}>重新生成</Button>
            <Button variant="primary" size="sm" icon={Printer} onClick={print} disabled={busy || !sheets.length}>打印这些页</Button>
          </div>
        </>
      )}
    >
      <div className="imposition-layout">
        <div className="imposition-side">
          <div className="imposition-modes">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.id} type="button" className={`imposition-mode ${mode === m.id ? 'active' : ''}`} onClick={() => setMode(m.id)}>
                  <span className="imposition-mode-icon"><Icon size={17} /></span>
                  <span><b>{m.name}</b><small>{m.desc}</small></span>
                </button>
              );
            })}
          </div>

          <div className="imposition-options">
            {mode === 'long' ? (
              <>
                <label className="field">
                  <span className="field-label">成品纸张</span>
                  <Select value={paper} onChange={(e) => setPaper(e.target.value)}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                    <option value="A5">A5</option>
                  </Select>
                </label>
                <label className="field">
                  <span className="field-label">方向</span>
                  <Select value={landscape ? 'landscape' : 'portrait'} onChange={(e) => setLandscape(e.target.value === 'landscape')}>
                    <option value="portrait">纵向</option>
                    <option value="landscape">横向</option>
                  </Select>
                </label>
                <label className="field">
                  <span className="field-label">页间重叠（mm）</span>
                  <input className="control input" type="number" min="0" max="30" value={overlap} onChange={(e) => setOverlap(Math.max(0, Number(e.target.value) || 0))} />
                  <span className="field-hint">长图切成多页时，相邻页保留一点重叠，方便拼接。</span>
                </label>
                <div className="imposition-file-note">
                  <span>参与分割</span>
                  <b>{images.length ? images.map((f) => f.name).join('、') : '没有选中图片'}</b>
                </div>
              </>
            ) : null}

            {mode === 'nup' ? (
              <>
                <label className="field">
                  <span className="field-label">每张合几页</span>
                  <Segmented value={nup} onChange={setNup} options={[2, 4, 6, 9].map((n) => ({ value: n, label: `${n} 页` }))} />
                </label>
                <label className="field">
                  <span className="field-label">成品纸张</span>
                  <Select value={paper} onChange={(e) => setPaper(e.target.value)}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                  </Select>
                </label>
                <label className="field">
                  <span className="field-label">方向</span>
                  <Select value={landscape ? 'landscape' : 'portrait'} onChange={(e) => setLandscape(e.target.value === 'landscape')}>
                    <option value="portrait">纵向</option>
                    <option value="landscape">横向</option>
                  </Select>
                </label>
              </>
            ) : null}

            {mode === 'repeat' ? (
              <>
                <div className="imposition-two">
                  <label className="field"><span className="field-label">行</span><input className="control input" type="number" min="1" max="8" value={rows} onChange={(e) => setRows(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} /></label>
                  <label className="field"><span className="field-label">列</span><input className="control input" type="number" min="1" max="8" value={cols} onChange={(e) => setCols(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} /></label>
                </div>
                <label className="field">
                  <span className="field-label">重复哪一页</span>
                  <Select value={sourceIndex} onChange={(e) => setSourceIndex(Number(e.target.value))}>
                    {sourcePages.length ? sourcePages.map((p, i) => <option key={i} value={i}>第 {i + 1} 页</option>) : <option value={0}>第 1 页</option>}
                  </Select>
                </label>
                <label className="field">
                  <span className="field-label">成品纸张</span>
                  <Select value={paper} onChange={(e) => setPaper(e.target.value)}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                  </Select>
                </label>
                <label className="field">
                  <span className="field-label">方向</span>
                  <Select value={landscape ? 'landscape' : 'portrait'} onChange={(e) => setLandscape(e.target.value === 'landscape')}>
                    <option value="portrait">纵向</option>
                    <option value="landscape">横向</option>
                  </Select>
                </label>
              </>
            ) : null}

            {mode === 'a3' || mode === 'booklet' ? (
              <div className="imposition-auto-note">
                <CheckCircle2 size={16} />
                <span>{mode === 'a3' ? '自动识别源页方向：竖版两页并排到 A3 横向，横版两页上下叠放到 A3 纵向。' : '自动使用 A4 横向，按骑马钉顺序排版，建议双面长边翻转。'}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="imposition-preview">
          <div className="imposition-preview-head">
            <div><h4>{modeInfo?.name}</h4><p>{modeInfo?.desc}</p></div>
            {busy ? <span className="preview-busy"><Spinner size={14} /> 生成中</span> : null}
          </div>
          <div className="imposition-page-stage">
            {busy ? <div className="imposition-empty"><Spinner size={24} /><span>正在渲染页面…</span></div> : null}
            {!busy && error ? <div className="imposition-empty error"><AlertTriangle size={26} /><b>无法生成</b><span>{error}</span></div> : null}
            {!busy && !error && sheets[idx] ? <img key={idx} src={sheets[idx].dataUrl} alt={`拼版预览 第 ${idx + 1} 张`} /> : null}
            {!busy && !error && !sheets[0] ? <div className="imposition-empty"><Layers3 size={30} /><span>选择模板后生成预览</span></div> : null}
          </div>
          <div className="imposition-preview-foot">
            <div className="imposition-pager">
              <button type="button" className="pager-btn" disabled={idx <= 0} onClick={() => setPageIndex((i) => Math.max(0, i - 1))} aria-label="上一页"><ChevronLeft size={15} /></button>
              <span>{sheets.length ? `第 ${idx + 1} / ${sheets.length} 张` : '—'}</span>
              <button type="button" className="pager-btn" disabled={idx >= sheets.length - 1} onClick={() => setPageIndex((i) => Math.min(sheets.length - 1, i + 1))} aria-label="下一页"><ChevronRight size={15} /></button>
            </div>
            <span>{files?.length || 0} 个源文件 · {sourcePages.length || sheets.length} 页</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
