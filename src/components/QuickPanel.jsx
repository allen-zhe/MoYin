import { useState } from 'react';
import { ExternalLink, Tags, Trash2, PackagePlus, Minus, Plus, GripVertical, Printer } from 'lucide-react';
import { money } from '../lib/format.js';

function slotTone(item) {
  const color = item?.color === 'color' ? 'color' : 'mono';
  const paper = String(item?.paper || 'A4').toLowerCase();
  return `${color} ${paper}`;
}

export function QuickPanel({
  slots, items, activeScheme, quick, printers, onDropFiles, onPrintLabel,
  onOpenWindow, onClear, onCopies, onOpenSettings, onReorder, onDropStack, compact = false,
}) {
  const [dragSlot, setDragSlot] = useState(-1);
  const displayPrinter = (item) => item?.printer || printers.find((p) => p.isDefault)?.displayName || printers[0]?.displayName || '系统默认打印机';

  return (
    <aside className={`quick-panel ${compact ? 'compact' : ''}`}>
      <div className="quick-head">
        <div className="quick-customer">
          <span>客户</span>
          <b>{quick.customer || '散客'}</b>
        </div>
        {!compact ? (
          <button type="button" className="quick-window-btn" onClick={onOpenWindow}>
            独立窗口 <ExternalLink size={13} />
          </button>
        ) : null}
      </div>

      <div className="quick-amount">
        <div className="quick-amount-head">
          <span>累计金额</span>
          <button type="button" className="quick-clear" onClick={onClear} disabled={!quick.amount}>
            <Trash2 size={12} /> 清除
          </button>
        </div>
        <div className="amount-line">
          <span className="currency">¥</span>
          <strong>{(Number(quick.amount) || 0).toFixed(2)}</strong>
        </div>
      </div>

      <button type="button" className="quick-label-btn" onClick={onPrintLabel}>
        <Tags size={18} strokeWidth={1.8} />
        打印标签
        {quick.count ? <span className="quick-label-count">{quick.count}</span> : null}
      </button>

      <div className="quick-copies">
        <span>打印份数</span>
        <div className="stepper">
          <button type="button" onClick={() => onCopies(Math.max(1, quick.copies - 1))} aria-label="减少份数"><Minus size={13} /></button>
          <input
            value={quick.copies}
            inputMode="numeric"
            aria-label="打印份数"
            onChange={(e) => onCopies(Math.max(1, Math.min(99, Number(e.target.value.replace(/\D/g, '')) || 1)))}
          />
          <button type="button" onClick={() => onCopies(Math.min(99, quick.copies + 1))} aria-label="增加份数"><Plus size={13} /></button>
          <span>份</span>
        </div>
      </div>

      <div className="quick-slots">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`quick-slot tone-${slotTone(item)} ${dragSlot === index ? 'drag-over' : ''}`}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData('application/x-moprint-slot', String(index)); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/x-moprint-stack') ? 'copy' : 'move'; setDragSlot(index); }}
            onDragLeave={() => setDragSlot(-1)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragSlot(-1);
              if (e.dataTransfer.types.includes('application/x-moprint-stack')) {
                const stackId = e.dataTransfer.getData('application/x-moprint-stack');
                if (stackId) onDropStack?.(stackId, item, index);
                return;
              }
              if (e.dataTransfer.files?.length) { onDropFiles(e.dataTransfer.files, item, index); return; }
              const from = Number(e.dataTransfer.getData('application/x-moprint-slot'));
              if (Number.isInteger(from) && from !== index) onReorder?.(from, index);
            }}
            onContextMenu={(e) => { e.preventDefault(); onOpenSettings?.(item, index); }}
            title={`${item.name}，拖入文件立即打印；右键修改配置`}
          >
            <div className="quick-slot-top">
              <span className="quick-slot-index">{index + 1}</span>
              <strong>{item.name}</strong>
              <button type="button" className="slot-grip" aria-label="拖动排序" title="拖动排序">
                <GripVertical size={14} />
              </button>
            </div>
            <div className="quick-slot-printer">
              <Printer size={12} />
              <span title={displayPrinter(item)}>{displayPrinter(item)}</span>
            </div>
            <div className="quick-slot-bottom">
              <span className="slot-spec">{item.paper} · {item.duplex === 'simplex' ? '单面' : item.duplex === 'shortEdge' ? '双面短边翻' : '双面长边翻'}</span>
              <span className="slot-price">{money(item.price)}<em>/面</em></span>
            </div>
            <div className="quick-slot-drop">
              <PackagePlus size={15} />
              <span>拖入文件即可打印</span>
            </div>
          </div>
        ))}
      </div>

      <p className="quick-hint">拖入文件到对应档位，按上方份数打印；右键修改配置。</p>
    </aside>
  );
}
