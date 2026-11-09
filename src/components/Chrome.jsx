import {
  Minus, Square, Copy, X, Search, Printer, Tags, Pin, Smartphone,
  Plus, Layers, CircleDollarSign, Settings2, SlidersHorizontal,
  Clock3, Rows3, ArrowUpDown, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from './Logo.jsx';

export function TitleBar({ version }) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    window.cloudPrint.window.isMaximized?.().then(setMaximized);
    return window.cloudPrint.onWindowState((s) => setMaximized(!!s.maximized));
  }, []);

  return (
    <div className="titlebar" onDoubleClick={() => window.cloudPrint.window.maximize()}>
      <div className="titlebar-brand">
        <Logo size={19} />
        <span>墨印</span>
        <span className="titlebar-ver">V{version || '1.0.0'}</span>
      </div>
      <div className="titlebar-actions" onDoubleClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="最小化" title="最小化" onClick={() => window.cloudPrint.window.minimize()}>
          <Minus size={15} strokeWidth={1.7} />
        </button>
        <button type="button" aria-label="最大化或还原" title="最大化或还原" onClick={() => window.cloudPrint.window.maximize()}>
          {maximized ? <Copy size={13} strokeWidth={1.7} /> : <Square size={13} strokeWidth={1.7} />}
        </button>
        <button type="button" className="close" aria-label="关闭窗口" title="关闭窗口" onClick={() => window.cloudPrint.window.close()}>
          <X size={16} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
}

export function Header({
  search, setSearch, watchDir, onPickDirectory, onOpenPrintSettings, onOpenLabelSettings,
  alwaysOnTop, onToggleAlwaysOnTop, onOpenReceive, receiveRunning, version,
}) {
  return (
    <header className="main-header">
      <button type="button" className="brand-block" onClick={onPickDirectory} title="选择自动读取的文件目录">
        <Logo size={58} />
        <span className="brand-copy">
          <span className="brand-name">墨印</span>
          <span className="brand-sub">
            {watchDir ? watchDir : '请选择文件目录'}
          </span>
        </span>
      </button>

      <div className="header-search">
        <Search size={18} strokeWidth={1.8} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索昵称、对象、文件名、拼音或首字母..."
          aria-label="搜索"
        />
        {search ? <button type="button" className="search-clear" onClick={() => setSearch('')}>×</button> : null}
      </div>

      <div className="header-actions">
        <button type="button" className="soft-btn" onClick={onOpenPrintSettings} title="管理打印设置、价格方案与打印机">
          <Printer size={17} strokeWidth={1.8} />
          打印设置
        </button>
        <button type="button" className="soft-btn" onClick={onOpenLabelSettings} title="管理标签打印机、纸张与位置">
          <Tags size={17} strokeWidth={1.8} />
          标签设置
        </button>
        <button type="button" className={`soft-btn ${receiveRunning ? 'receive-on' : ''}`} onClick={onOpenReceive} title="手机局域网传文件">
          <Smartphone size={17} strokeWidth={1.8} />
          手机传输
          <i className={`status-dot ${receiveRunning ? 'on' : ''}`} />
        </button>
        <div className="pin-switch" title="窗口置顶">
          <Pin size={15} strokeWidth={1.8} />
          <span>置顶</span>
          <button
            type="button"
            role="switch"
            aria-checked={alwaysOnTop}
            className={`mini-toggle ${alwaysOnTop ? 'on' : ''}`}
            onClick={() => onToggleAlwaysOnTop(!alwaysOnTop)}
            aria-label="窗口置顶"
          >
            <i />
          </button>
        </div>
      </div>
      <span className="sr-version">v{version}</span>
    </header>
  );
}

export function PillSelect({ value, onChange, options, label, className = '', icon: Icon }) {
  return (
    <label className={`pill-select ${className}`} title={label}>
      {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
      <span className="pill-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const text = typeof o === 'string' ? o : o.label;
          return <option key={val} value={val}>{text}</option>;
        })}
      </select>
      <SlidersHorizontal size={12} className="pill-chevron" style={{ display: 'none' }} />
    </label>
  );
}

const STATUS_TABS = [
  { value: 'all', label: '全部' },
  { value: 'unprinted', label: '未打印' },
  { value: 'printed', label: '已打印' },
  { value: 'unpaid', label: '待收款' },
  { value: 'paid', label: '已收款' },
];

export function Toolbar({
  filter, setFilter, countByStatus, sort, setSort, range, setRange,
  scope, setScope, onNewStack, onOpenStats, onOpenQueue, onOpenRecover,
  quickOpen, setQuickOpen, quickDetached, onToggleQuick, onPrintSelected, canPrint,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button type="button" className="new-stack-btn" onClick={onNewStack}>
          <Plus size={18} strokeWidth={2} />
          新建堆叠
        </button>
        <div className="mode-tab">
          <Layers size={15} strokeWidth={1.8} />
          文件堆叠
        </div>
        <div className="status-tabs" role="tablist" aria-label="文件打印状态筛选">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={filter === tab.value}
              className={filter === tab.value ? 'active' : ''}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
              {tab.value !== 'all' && countByStatus?.[tab.value] ? <em>{countByStatus[tab.value]}</em> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-right">
        <div className="recover-group">
          <button type="button" className="tiny-text-btn" onClick={onOpenRecover} title="补收、退款或手工登记">补收</button>
          <button type="button" className="tiny-icon-btn" onClick={onOpenRecover} title="补收设置" aria-label="补收设置">
            <Settings2 size={14} strokeWidth={1.8} />
          </button>
        </div>
        <PillSelect
          label=""
          value={range}
          onChange={setRange}
          options={[
            { value: '10m', label: '10分钟内堆叠' },
            { value: '30m', label: '30分钟内堆叠' },
            { value: '1h', label: '1小时内堆叠' },
            { value: 'today', label: '今天' },
            { value: 'all', label: '全部时间' },
          ]}
          icon={Clock3}
        />
        <PillSelect
          label=""
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: '全部' },
            { value: 'active', label: '堆叠中' },
            { value: 'archived', label: '已归档' },
          ]}
        />
        <div className="sort-tabs">
          <button type="button" className={sort === 'time' ? 'active' : ''} onClick={() => setSort('time')}>
            <ArrowUpDown size={13} /> 按时间
          </button>
          <button type="button" className={sort === 'size' ? 'active' : ''} onClick={() => setSort('size')}>
            <Rows3 size={13} /> 按大小
          </button>
        </div>
        <button type="button" className="soft-btn" onClick={onOpenStats}>
          <CircleDollarSign size={17} strokeWidth={1.8} />
          金额统计
        </button>
        <button type="button" className="soft-btn" onClick={onOpenQueue}>
          <Printer size={17} strokeWidth={1.8} />
          本机打印
        </button>
        <button type="button" className={`soft-btn quick-toggle ${(quickOpen || quickDetached) ? 'active' : ''}`} onClick={onToggleQuick || (() => setQuickOpen(!quickOpen))}>
          {quickOpen || quickDetached ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          {quickDetached ? '收回快捷打印' : '快捷打印'}
        </button>
      </div>
    </div>
  );
}
