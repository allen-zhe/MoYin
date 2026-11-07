import { useEffect, useMemo, useState } from 'react';
import { Printer, History, X, Search, RefreshCw, ListChecks, CircleAlert, CheckCircle2, Clock3 } from 'lucide-react';
import { formatDate, money } from '../lib/format.js';

export function PrintQueue({ open, tasks, onClose, onRefresh }) {
  const [tab, setTab] = useState('queue');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (tab === 'queue' && !['printing', 'queued', 'rendering'].includes(t.state)) return false;
      if (tab === 'history' && ['printing', 'queued', 'rendering'].includes(t.state)) return false;
      if (status === 'done' && t.state !== 'done') return false;
      if (status === 'failed' && t.state !== 'failed') return false;
      if (q && !`${t.customer} ${(t.files || []).join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, tab, status, query]);

  return (
    <div className={`queue-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="queue-tabs">
        <button type="button" className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}><ListChecks size={14} /> 打印队列</button>
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History size={14} /> 打印记录</button>
        <button type="button" className="queue-close" aria-label="关闭打印队列" onClick={onClose}><X size={17} /></button>
      </div>
      <div className="queue-body">
        <div className="queue-title-row">
          <div><span>本助手任务管理</span><h3>{tab === 'queue' ? '打印队列' : '打印记录'}</h3></div>
          <div className="queue-title-actions">
            <button type="button" className="icon-btn" title="刷新" onClick={onRefresh}><RefreshCw size={15} /></button>
            <button type="button" className="queue-close-text" onClick={onClose}><X size={14} /> 关闭</button>
          </div>
        </div>
        <div className="queue-filter-tabs">
          <button type="button" className="active">本助手 ({tasks.filter((t) => ['printing', 'queued', 'rendering'].includes(t.state)).length})</button>
          <button type="button">其他任务 · 只读</button>
        </div>
        <p className="queue-note">关闭此面板可继续处理文件。取消后立即结束本助手的任务，系统取消在后台处理。</p>
        <div className="queue-selects">
          <select className="control select" value="all" onChange={() => {}}><option value="all">全部打印机</option></select>
          <select className="control select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部状态</option>
            <option value="done">已完成</option>
            <option value="failed">失败</option>
          </select>
        </div>
        <div className="queue-search">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="客户 / 文件名" />
        </div>
        <div className="queue-count-row"><span>{filtered.length} 个批次</span><button type="button" className="link-btn" onClick={onClose}>关闭打印面板</button></div>
        {filtered.length ? (
          <div className="queue-list">
            {filtered.map((t) => (
              <div key={t.id} className={`queue-item state-${t.state}`}>
                <div className="queue-item-top">
                  <span className="queue-item-icon">
                    {t.state === 'done' ? <CheckCircle2 size={15} /> : t.state === 'failed' ? <CircleAlert size={15} /> : <Clock3 size={15} />}
                  </span>
                  <b>{t.customer || '散客'}</b>
                  <span className="queue-item-time">{formatDate(t.createdAt)}</span>
                </div>
                <div className="queue-item-name">{(t.files || []).join('、') || t.title || '标签'}</div>
                <div className="queue-item-meta">
                  <span>{t.pages || 0} 页 · {money(t.amount || 0)}{t.coverage ? ` · 覆盖 ${(t.coverage * 100).toFixed(1)}%` : ''}</span>
                  <span>{t.state === 'done' ? '已完成' : t.state === 'failed' ? '失败' : '处理中'}</span>
                </div>
                {t.error ? <div className="queue-item-error">{t.error}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="queue-empty">
            <ListChecks size={28} strokeWidth={1.4} />
            <b>暂无符合条件的任务</b>
            <span>堆叠打印接收后会显示在这里。</span>
          </div>
        )}
      </div>
    </div>
  );
}
