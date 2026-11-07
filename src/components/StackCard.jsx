import { FileText, Layers2, MoreHorizontal, AlertTriangle, CheckCircle2, Clock3, Wallet } from 'lucide-react';
import { FileThumb } from './FileThumb.jsx';
import { formatShortDate, money, stackPages, stackPrintState, stackPayState, stackSize, formatBytes, filePages } from '../lib/format.js';

export function StackCard({ stack, active, item, duplicate, onSelect, onOpen, onContextMenu, onDropFiles }) {
  const printState = stackPrintState(stack);
  const payState = stackPayState(stack);
  const first = stack.files?.[0];
  const pages = stackPages(stack);
  const amount = stack.frozenAmount ?? null;

  return (
    <article
      className={`stack-card ${active ? 'active' : ''} ${printState === 'printed' ? 'is-printed' : ''} ${stack.archived ? 'is-archived' : ''}`}
      tabIndex={0}
      role="button"
      data-stack-id={stack.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-moprint-stack', stack.id);
        e.dataTransfer.setData('text/plain', stack.title || '堆叠');
        e.dataTransfer.effectAllowed = 'copy';
      }}
      aria-label={`${stack.title}，${stack.files?.length || 0} 个文件`}
      onClick={() => onSelect?.(stack.id)}
      onDoubleClick={() => onOpen?.(stack.id)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, stack.id); }}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(stack.id); if (e.key === ' ') { e.preventDefault(); onSelect?.(stack.id); } }}
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drop-hover'); }}
      onDragLeave={(e) => e.currentTarget.classList.remove('drop-hover')}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drop-hover');
        if (e.dataTransfer.files?.length) onDropFiles?.(e.dataTransfer.files, stack.id);
      }}
    >
      <div className="stack-card-head">
        <span className="stack-index">{stack.manual ? <Layers2 size={13} /> : <Clock3 size={13} />}</span>
        <h3 title={stack.title}>{stack.title || '未命名堆叠'}</h3>
        <button
          type="button"
          className="stack-more"
          aria-label="更多操作"
          onClick={(e) => { e.stopPropagation(); onContextMenu?.(e, stack.id); }}
        >
          <MoreHorizontal size={17} />
        </button>
      </div>

      {stack.files?.length ? (
        <>
          <div className="stack-file-line">
            <span className={`ext-badge ext-${String(first.ext).toLowerCase()}`}>{String(first.ext || 'file').toUpperCase()}</span>
            <span className="stack-file-name" title={first.name}>{first.name}</span>
          </div>
          <div className="stack-preview">
            <FileThumb file={first} width={360} />
            {stack.files.length > 1 ? <span className="more-files">+{stack.files.length - 1}</span> : null}
            {printState === 'printed' ? <span className="printed-stamp"><CheckCircle2 size={13} /> 已打印</span> : null}
          </div>
          <div className="stack-card-foot">
            <span className="stack-time">{formatShortDate(stack.updatedAt || stack.createdAt)}</span>
            <span className="stack-count">{stack.files.length} 个 / {pages} 页{amount != null ? ` · ${money(amount)}` : ''}</span>
          </div>
          <div className="stack-badges">
            {printState === 'unprinted' ? <span className="chip chip-warn"><FileText size={11} /> 未打印</span> : null}
            {printState === 'partial' ? <span className="chip chip-warn">部分打印</span> : null}
            {payState === 'unpaid' ? <span className="chip chip-cash"><Wallet size={11} /> 待收款</span> : null}
            {payState === 'paid' ? <span className="chip chip-ok"><CheckCircle2 size={11} /> 已收款</span> : null}
            {duplicate ? <span className="chip chip-danger"><AlertTriangle size={11} /> 重复</span> : null}
            {stack.archived ? <span className="chip">已归档</span> : null}
          </div>
        </>
      ) : (
        <div className="stack-empty">
          <span className="empty-drop-icon">＋</span>
          <strong>空堆叠</strong>
          <span>拖入文件或点击打开</span>
        </div>
      )}
    </article>
  );
}

export function StackContextMenu({ x, y, stack, onClose, onAction }) {
  if (!stack) return null;
  const printedFiles = (stack.files || []).filter((f) => Number(f.printed) > 0).length;
  const canMarkPaid = printedFiles > 0 && stack.payment !== 'paid';
  const actions = [
    { id: 'member', label: '创建 / 关联会员' },
    { id: 'orders', label: '查看订单' },
    { id: 'label', label: '打标签' },
    { id: 'print', label: '打印所选' },
    canMarkPaid ? { id: 'paid', label: '标记已付款' } : null,
    { id: 'archive', label: stack.archived ? '恢复堆叠' : '归档堆叠' },
    { id: 'delete', label: '删除', danger: true },
  ].filter(Boolean);
  return (
    <div className="context-menu" style={{ left: x, top: y }} onMouseLeave={onClose}>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className={a.danger ? 'danger' : ''}
          disabled={!!a.disabled}
          onClick={() => { onAction(a.id, stack); onClose(); }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
