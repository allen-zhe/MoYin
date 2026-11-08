import { useMemo, useState } from 'react';
import {
  X, Printer, FolderOpen, Tags, Tag, ChevronDown, FileText, Check, Scissors, LayoutGrid, GripVertical,
  Trash2, Plus, Minus, Layers3, ListOrdered, SlidersHorizontal, Info,
} from 'lucide-react';
import { FileThumb } from './FileThumb.jsx';
import { Toggle, Select, Button } from './ui.jsx';
import { formatBytes, formatDate, money, stackAmount, stackPages, stackPrintState, amountForPages } from '../lib/format.js';
import { printerFor, capabilitySummary } from '../lib/printerCaps.js';

export function StackDetail({
  stack, items, printers, settings, onClose, onPrint, onPrintLabel, onUpdateStack,
  onUpdateItem, onReveal, onRemoveFile, onAddFiles, onArchive, onOpenQueue, onOpenPreferences, onOpenImposition, onDropPaths, onReorderItems, onMarkPaid, notify,
}) {
  const [selected, setSelected] = useState(() => new Set((stack.files || []).map((f) => f.id)));
  const [itemId, setItemId] = useState(stack.itemId || items[0]?.id || '');
  const [copies, setCopies] = useState(1);
  const [pageRange, setPageRange] = useState('');
  const [zoom, setZoom] = useState(1);
  const [fileCtx, setFileCtx] = useState(null);
  const item = items.find((i) => i.id === itemId) || items[0];
  const selectedFiles = (stack.files || []).filter((f) => selected.has(f.id));
  const totalPages = selectedFiles.reduce((sum, f) => sum + Math.max(1, Number(f.pages) || 1), 0);
  const estimate = amountForPages(totalPages, item) * Math.max(1, copies);
  const printState = stackPrintState(stack);
  const allSelected = selectedFiles.length === (stack.files || []).length && stack.files?.length > 0;

  const toggleFile = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(allSelected ? new Set() : new Set((stack.files || []).map((f) => f.id)));

  const handlePrint = () => {
    if (!selectedFiles.length) return notify?.('请先选择要打印的文件', 'warn');
    onPrint?.(selectedFiles, item, { copies, pageRange, skipBlank: !!stack.skipBlank });
  };

  return (
    <div className="detail-overlay">
      <div className="detail-modal" role="dialog" aria-modal="true" aria-label={`${stack.title} 文件详情`}>
        <header className="detail-head">
          <div className="detail-title-wrap">
            <div>
              <h2>{stack.title}</h2>
              <p>
                {stack.files?.length || 0} 个文件 · {formatBytes((stack.files || []).reduce((s, f) => s + (f.size || 0), 0))}
                <span className="dot-sep">·</span>
                最近更新 {formatDate(stack.updatedAt || stack.createdAt)}
                {stack.payment === 'paid' ? <span className="detail-paid">已收款</span> : null}
              </p>
            </div>
          </div>
          <div className="detail-head-tools">
            <button type="button" className="soft-btn" onClick={() => onOpenQueue?.()}>
              <Printer size={16} /> 本机打印
            </button>
            <button type="button" className="soft-btn" onClick={() => onOpenPreferences?.(item?.printer || '')}>
              首选项
            </button>
            <label className="scheme-inline">
              <span>价格方案</span>
              <Select value={itemId} onChange={(e) => setItemId(e.target.value)} aria-label="价格方案">
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </label>
            <div className="mini-switch-row" title="跳过 PDF 中的空白页">
              <span>跳过空白页</span>
              <Toggle checked={!!stack.skipBlank} onChange={(v) => onUpdateStack?.(stack.id, { skipBlank: v })} label="跳过空白页" />
            </div>
            <div className="mini-switch-row" title="关闭窗口后清理已打印的文件记录">
              <span>关闭时清理已打印</span>
              <Toggle checked={!!stack.cleanupPrinted} onChange={(v) => onUpdateStack?.(stack.id, { cleanupPrinted: v })} label="关闭时清理已打印" />
            </div>
            <div className="zoom-control">
              <span>小</span>
              <input type="range" min="0.8" max="1.5" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="缩略图大小" />
              <span>大</span>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="关闭堆叠详情"><X size={19} /></button>
          </div>
        </header>

        <div className="detail-items">
          {items.map((cfg, idx) => (
            <div
              key={cfg.id}
              className={`detail-item ${cfg.id === item?.id ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => setItemId(cfg.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setItemId(cfg.id); } }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                e.preventDefault();
                const from = e.dataTransfer.getData('application/x-moprint-config');
                if (from) onReorderItems?.(from, cfg.id);
              }}
            >
              <span className="detail-item-no">{idx + 1}</span>
              <span className="detail-item-name">{cfg.name}</span>
              <button
                type="button"
                className="detail-item-grip"
                draggable
                title="拖动调整顺序"
                aria-label="拖动调整打印选项顺序"
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e) => { e.dataTransfer.setData('application/x-moprint-config', cfg.id); e.dataTransfer.effectAllowed = 'move'; }}
              >
                <GripVertical size={13} />
              </button>
              <span className="detail-item-printer">
                <Printer size={11} />
                <select
                  className="detail-printer-select"
                  value={cfg.printer || ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); onUpdateItem?.(cfg.id, { printer: e.target.value }); }}
                  title={capabilitySummary(printerFor(printers, cfg.printer))}
                >
                  <option value="">系统默认</option>
                  {printers.map((p) => <option key={p.name} value={p.name}>{p.displayName}</option>)}
                </select>
              </span>
              <span className="detail-item-cap">{capabilitySummary(printerFor(printers, cfg.printer))}</span>
              <span className="detail-item-meta">
                <span>{cfg.paper} · {cfg.duplex === 'simplex' ? '单面' : cfg.duplex === 'shortEdge' ? '双面短边翻转' : '双面长边翻转'}</span>
                <b>{money(cfg.price)}<em>/面</em></b>
              </span>
            </div>
          ))}
        </div>

        <div className="detail-files-head">
          <label className="check-all">
            <input type="checkbox" checked={allSelected} onChange={selectAll} />
            <span>全选</span>
          </label>
          <span>拖动文件可复制到外部，多选可一起拖出；拖动 ⠿ 调整顺序</span>
          <span className="detail-file-count">已选 {selectedFiles.length} / {stack.files?.length || 0}</span>
        </div>

        <div
          className="detail-files-wrap"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={(e) => {
            e.preventDefault();
            const paths = Array.from(e.dataTransfer.files || []).map((f) => window.cloudPrint.getPathForFile(f)).filter(Boolean);
            if (paths.length) onDropPaths?.(paths, stack.id);
          }}
        >
          {stack.files?.length ? (
            <div className="detail-file-grid" style={{ '--thumb-scale': zoom }}>
              {stack.files.map((file) => (
                <div
                  key={file.id}
                  className={`detail-file ${selected.has(file.id) ? 'selected' : ''}`}
                  onClick={() => toggleFile(file.id)}
                  onContextMenu={(e) => {
                    if (Number(file.printed) <= 0 || stack.payment === 'paid') return;
                    e.preventDefault();
                    e.stopPropagation();
                    setFileCtx({ x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 80), file });
                  }}
                  onDoubleClick={(e) => { e.stopPropagation(); window.cloudPrint.openFile(file.path).catch(() => {}); }}
                  role="checkbox"
                  aria-checked={selected.has(file.id)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleFile(file.id); } }}
                >
                  <div className="detail-file-top">
                    <span className={`check-dot ${selected.has(file.id) ? 'on' : ''}`}>{selected.has(file.id) ? <Check size={12} /> : null}</span>
                    <span className={`ext-badge ext-${String(file.ext).toLowerCase()}`}>{String(file.ext).toUpperCase()}</span>
                    <span className="detail-file-name" title={file.name}>{file.name}</span>
                    <button type="button" className="detail-file-remove" title="从堆叠中移除" onClick={(e) => { e.stopPropagation(); onRemoveFile?.(stack.id, file.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="detail-thumb-wrap">
                    <FileThumb file={file} width={440} />
                    {Number(file.printed) > 0 ? <span className="file-print-stamp">已打印 {file.printed} 份</span> : null}
                  </div>
                  <div className="detail-file-meta">
                    <span>{formatBytes(file.size)}</span>
                    <span>{(file.pages || 1)} 页</span>
                    <span>{formatDate(file.addedAt || stack.createdAt, false)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="detail-empty">
              <FileText size={34} strokeWidth={1.3} />
              <h3>这个堆叠还没有文件</h3>
              <p>把文件拖到窗口，或点击下方按钮添加。</p>
              <Button variant="primary" icon={Plus} onClick={() => onAddFiles?.(stack.id)}>添加文件</Button>
            </div>
          )}
        </div>

        <footer className="detail-foot">
          <div className="detail-foot-top">
            <div className="detail-summary">
              <b>{stack.title}</b>
              <span>· 已选 {selectedFiles.length} 个文件 · {copies} 份 · 共 {totalPages} 页</span>
              <span className="summary-amount">已选中金额 {money(estimate)} <em>（当前方案价）</em></span>
              {item ? <span className="summary-config">· {item.name} · {printers.find((p) => p.name === item.printer)?.displayName || item.printer || printers.find((p) => p.isDefault)?.displayName || '系统默认打印机'}</span> : null}
              {stack.coverage ? <span className="summary-config">· 覆盖率 {(stack.coverage * 100).toFixed(1)}%</span> : null}
            </div>
            <div className="detail-print-controls">
              <label className="inline-field">
                <span>页码</span>
                <input value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="—" aria-label="页码范围" />
              </label>
              <label className="inline-field copies-field">
                <span>打印份数</span>
                <div className="quick-copy-chips">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button key={n} type="button" className={copies === n ? 'active' : ''} onClick={() => setCopies(n)}>{n}</button>
                  ))}
                </div>
                <div className="stepper small">
                  <button type="button" onClick={() => setCopies(Math.max(1, copies - 1))} aria-label="减少份数"><Minus size={12} /></button>
                  <input value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(99, Number(e.target.value.replace(/\D/g, '')) || 1)))} aria-label="份数" />
                  <button type="button" onClick={() => setCopies(copies + 1)} aria-label="增加份数"><Plus size={12} /></button>
                </div>
              </label>
              <button type="button" className="primary-print-btn" onClick={handlePrint} disabled={!selectedFiles.length}>
                <Printer size={17} />
                打印所选 {selectedFiles.length || ''} 个
              </button>
            </div>
          </div>
          <div className="detail-action-row">
            <button type="button" className="tool-chip" onClick={() => onReveal?.(stack.files?.[0]?.path || stack.folder)}><FolderOpen size={14} /> 打开文件夹</button>
            <button type="button" className="tool-chip" onClick={() => onPrintLabel?.(stack)}><Tags size={14} /> 打印标签 <b>{money(stackAmount(stack, item))}</b></button>
            <button type="button" className="tool-chip" onClick={() => { onArchive?.(stack.id, false); onClose?.(); }}><Tag size={14} /> 不打标签</button>
            <button type="button" className="tool-chip" onClick={() => onAddFiles?.(stack.id)}><Plus size={14} /> 添加文件</button>
            <button type="button" className="tool-chip" onClick={() => onOpenImposition?.(selectedFiles, 'long')}><Scissors size={14} /> 长图分割</button>
            <button type="button" className="tool-chip" onClick={() => onOpenImposition?.(selectedFiles, 'a3')}><LayoutGrid size={14} /> 文件拼版</button>
            <span className="detail-foot-note"><Info size={13} /> 双击文件可打开；拖动文件可加入其他堆叠</span>
          </div>
        </footer>
        {fileCtx ? (
          <div className="context-menu file-context" style={{ left: fileCtx.x, top: fileCtx.y }} onMouseLeave={() => setFileCtx(null)}>
            <button type="button" onClick={() => { onMarkPaid?.(stack); setFileCtx(null); }}>标记已付款</button>
            <button type="button" onClick={() => setFileCtx(null)}>取消</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
