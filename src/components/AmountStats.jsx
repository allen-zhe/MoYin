import { useMemo, useState } from 'react';
import { CircleDollarSign, RefreshCw, Search, X, Plus, CheckCircle2 } from 'lucide-react';
import { Modal, Button, Segmented } from './ui.jsx';
import { dayStart, formatDate, money, stackPages, stackPrintState } from '../lib/format.js';

function ymd(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function downloadCsv(rows, name) {
  const header = ['订单号', '客户', '页数', '金额', '收款状态'];
  const body = rows.map((r) => [r.id, r.customer, r.pages, r.amount, r.status].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([`\ufeff${header.join(',')}\n${body.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 800);
}

export function AmountStats({ open, state, items, onClose, onMarkPaid, onAddPayment }) {
  const [tab, setTab] = useState('print');
  const [range, setRange] = useState('today');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [from, setFrom] = useState(() => ymd(dayStart()));
  const [to, setTo] = useState(() => ymd(Date.now()));

  const bounds = useMemo(() => {
    if (range === 'today') return [dayStart(), Date.now()];
    if (range === 'yesterday') return [dayStart(-1), dayStart()];
    if (range === '7d') return [dayStart(-6), Date.now()];
    if (range === 'month') { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return [d.getTime(), Date.now()]; }
    const a = new Date(`${from}T00:00:00`).getTime();
    const b = new Date(`${to}T23:59:59`).getTime();
    return [Number.isFinite(a) ? a : dayStart(), Number.isFinite(b) ? b : Date.now()];
  }, [range, from, to, open, refreshKey]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const printed = state.stacks.filter((s) => stackPrintState(s) === 'printed' || stackPrintState(s) === 'partial');
    return printed
      .filter((s) => {
        const t = s.printedAt || s.updatedAt || s.createdAt;
        if (t < bounds[0] || t > bounds[1]) return false;
        if (!q) return true;
        return `${s.title} ${s.customer} ${(s.files || []).map((f) => f.name).join(' ')}`.toLowerCase().includes(q);
      })
      .map((s) => ({
        id: s.id,
        short: String(s.id).slice(0, 13),
        customer: s.customer || s.title || '散客',
        title: s.title,
        pages: stackPages(s),
        amount: s.frozenAmount ?? 0,
        status: s.payment === 'paid' || s.payment === 'collected' ? '已收款' : '待收款',
        paid: s.payment === 'paid' || s.payment === 'collected',
        time: s.printedAt || s.updatedAt,
        stack: s,
      }))
      .sort((a, b) => b.time - a.time);
  }, [state.stacks, bounds, search]);

  const payments = useMemo(() => state.payments.filter((p) => p.time >= bounds[0] && p.time <= bounds[1]).sort((a, b) => b.time - a.time), [state.payments, bounds]);

  const confirmed = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const pending = rows.filter((r) => !r.paid).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const paid = rows.filter((r) => r.paid).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const pages = rows.reduce((sum, r) => sum + r.pages, 0);

  return (
    <Modal open={open} onClose={onClose} title="金额统计" size="xl" className="stats-modal" subtitle="打印费用与人工收款、退款、欠款分开记录。其他软件打印、标签及手动标记不增加打印金额。">
      <div className="stats-shared-note">ERP 接入为预留功能；当前版本只统计本机订单，未配置时不联网。</div>
      <div className="stats-tabs-row">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'print', label: '打印明细' }, { value: 'payment', label: '收款 / 退款 / 欠款' }]} />
        <div className="stats-filters">
          {['today', 'yesterday', '7d', 'month'].map((r) => (
            <button key={r} type="button" className={`date-chip ${range === r ? 'active' : ''}`} onClick={() => { setRange(r); if (r !== 'custom') { /* keep dates */ } }}>
              {{ today: '今天', yesterday: '昨天', '7d': '近7天', month: '本月' }[r]}
            </button>
          ))}
          <div className="date-range">
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setRange('custom'); }} />
            <span>至</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setRange('custom'); }} />
          </div>
        </div>
        <div className="stats-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索客户、文件" />
        </div>
        <button type="button" className="soft-btn stats-refresh" onClick={() => { setSearch(''); setRefreshKey((k) => k + 1); }}><RefreshCw size={14} /> 刷新</button>
      </div>
      <div className="stats-period">{formatDate(bounds[0], false)} 至 {formatDate(bounds[1], false)} · {rows.length} 条回执</div>

      <div className="stats-cards">
        <div className="stat-card primary">
          <span>确认金额</span>
          <b>{money(confirmed)}</b>
          <small>按提交回执与冻结单价累计</small>
        </div>
        <div className="stat-card"><span>订单数量</span><b>{rows.length}<em>个</em></b><small>已打印与部分打印</small></div>
        <div className="stat-card"><span>已确认面数</span><b>{pages}<em>面</em></b><small>含双面打印</small></div>
        <div className="stat-card"><span>已确认张数</span><b>{Math.ceil(pages / 2)}<em>张</em></b><small>按双面折算</small></div>
        <div className="stat-card warn"><span>待核对记录</span><b>{rows.filter((r) => !r.paid).length}<em>条</em></b><small>待收款 {money(pending)}</small></div>
      </div>

      {tab === 'print' ? (
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead><tr><th>订单号</th><th>客户</th><th>页数</th><th>金额</th><th>收款状态</th><th /></tr></thead>
            <tbody>
              {rows.length ? rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono-cell">{r.id}</td>
                  <td>{r.customer}</td>
                  <td>{r.pages}</td>
                  <td className="amount-cell">{money(r.amount)}</td>
                  <td><span className={`pay-pill ${r.paid ? 'paid' : ''}`}>{r.status}</span></td>
                  <td className="stats-row-action">
                    {!r.paid ? <button type="button" onClick={() => onMarkPaid?.(r.stack)}>确认收款</button> : <span className="paid-check"><CheckCircle2 size={14} /> 已入账</span>}
                  </td>
                </tr>
              )) : <tr><td colSpan="6"><div className="stats-empty">这个时间段还没有打印记录</div></td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stats-table-wrap">
          <div className="payment-summary-row">
            <span>已收款 <b>{money(paid)}</b></span>
            <span>待收款 <b>{money(pending)}</b></span>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => onAddPayment?.()}>手工登记</Button>
          </div>
          <table className="stats-table">
            <thead><tr><th>时间</th><th>类型</th><th>订单 / 备注</th><th>金额</th></tr></thead>
            <tbody>
              {payments.length ? payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.time)}</td>
                  <td>{p.type === 'refund' ? '退款' : p.type === 'charge' ? '补收' : '收款'}</td>
                  <td>{p.note || p.stackTitle || '—'}</td>
                  <td className={p.type === 'refund' ? 'refund-cell' : 'amount-cell'}>{p.type === 'refund' ? '-' : ''}{money(p.amount)}</td>
                </tr>
              )) : <tr><td colSpan="4"><div className="stats-empty">还没有收款或退款记录</div></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="stats-foot">
        <span>收款与退款均由人工确认；启用 ERP 后可同步流水，本机历史始终保留。</span>
        <div>
          <Button variant="ghost" size="sm" onClick={() => downloadCsv(rows, '墨印金额统计')}>导出明细</Button>
        </div>
      </div>
    </Modal>
  );
}
