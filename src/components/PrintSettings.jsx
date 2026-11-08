import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Copy, GripVertical, ShieldCheck } from 'lucide-react';
import { Modal, Button, Input, Select } from './ui.jsx';
import { money } from '../lib/format.js';
import { printerFor, capabilitySummary, supportsPaper } from '../lib/printerCaps.js';

const COLOR_OPTIONS = [{ value: 'mono', label: '黑白' }, { value: 'color', label: '彩色' }];
const PAPER_OPTIONS = [
  { value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }, { value: 'A5', label: 'A5' },
  { value: 'Letter', label: 'Letter' }, { value: '5寸', label: '5寸 (3.5×5)' },
  { value: '6寸', label: '6寸 (4×6)' }, { value: '7寸', label: '7寸 (5×7)' },
  { value: '8寸', label: '8寸 (6×8)' },
];
const DUPLEX_OPTIONS = [
  { value: 'simplex', label: '单面' },
  { value: 'shortEdge', label: '双面短边翻页' },
  { value: 'longEdge', label: '双面长边翻页' },
];
const ORIENT_OPTIONS = [{ value: 'auto', label: '自动' }, { value: 'portrait', label: '纵向' }, { value: 'landscape', label: '横向' }];
const SCALE_OPTIONS = [
  { value: 'fit', label: '适合可打印区域' },
  { value: 'actual', label: '实际大小' },
  { value: 'fill', label: '铺满纸张' },
];

const COLUMNS = [
  { key: 'check', label: '', className: 'col-check', width: 36 },
  { key: 'grip', label: '', className: 'col-grip', width: 24 },
  { key: 'index', label: '序号', className: 'col-index', width: 44 },
  { key: 'name', label: '项目名称', className: 'col-name', width: 260 },
  { key: 'price', label: '单价', className: 'col-price', width: 80 },
  { key: 'unit', label: '计价方式', className: 'col-unit', width: 86 },
  { key: 'color', label: '打印颜色', className: 'col-color', width: 90 },
  { key: 'paper', label: '纸张', className: 'col-paper', width: 70 },
  { key: 'duplex', label: '翻转方式', className: 'col-duplex', width: 120 },
  { key: 'orient', label: '打印方向', className: 'col-orient', width: 82 },
  { key: 'scale', label: '页面缩放', className: 'col-scale', width: 140 },
  { key: 'printer', label: '输出目标 / 分配', className: 'col-printer', width: 250 },
  { key: 'ops', label: '操作', className: 'col-ops', width: 160 },
];
const DEFAULT_WIDTHS = COLUMNS.map((c) => c.width);

export function PrintSettings({ open, state, items, printers, onClose, onUpdateItem, onAddItem, onDeleteItem, onDuplicateItem, onRenameScheme, onNewScheme, onDeleteScheme, onSwitchScheme, onImport, onOpenPreferences, onUpdateSettings, notify }) {
  const [selected, setSelected] = useState(new Set());
  const [colWidths, setColWidths] = useState(() => Array.isArray(state.settings.printColumnWidths) && state.settings.printColumnWidths.length === COLUMNS.length ? state.settings.printColumnWidths : DEFAULT_WIDTHS);
  const resizeRef = useRef(null);
  const fileRef = useRef(null);
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!open) return;
    setColWidths(Array.isArray(state.settings.printColumnWidths) && state.settings.printColumnWidths.length === COLUMNS.length ? state.settings.printColumnWidths : DEFAULT_WIDTHS);
  }, [open, state.settings.printColumnWidths]);

  useEffect(() => {
    if (!open) return undefined;
    const onMove = (e) => {
      if (!resizeRef.current) return;
      const { index, startX, startWidth } = resizeRef.current;
      const next = Math.max(40, Math.min(520, startWidth + (e.clientX - startX)));
      setColWidths((prev) => {
        const out = prev.slice();
        out[index] = next;
        resizeRef.current.widths = out;
        return out;
      });
    };
    const onUp = () => {
      if (resizeRef.current) {
        const widths = resizeRef.current.widths;
        resizeRef.current = null;
        if (widths) onUpdateSettings?.({ printColumnWidths: widths });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [open, onUpdateSettings]);
  const scheme = state.schemes.find((s) => s.id === state.activeSchemeId) || state.schemes[0];

  const capabilityBad = (item) => {
    const p = printerFor(printers, item.printer);
    const caps = p?.capabilities;
    if (!caps) return false;
    return (item.color === 'color' && !caps.supportsColor) || !supportsPaper(p, item.paper);
  };

  const startColumnResize = (index, event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { index, startX: event.clientX, startWidth: colWidths[index], widths: colWidths };
  };

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyBulk = (patch) => {
    for (const id of selected) onUpdateItem?.(id, patch);
    notify?.(`已更新 ${selected.size} 个项目`);
  };

  const exportConfig = () => {
    const data = {
      format: 'cloud-print-settings',
      version: 1,
      exportedAt: new Date().toISOString(),
      scheme,
      schemes: state.schemes,
      slots: state.slots,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `墨印打印设置-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notify?.('配置已导出');
  };

  const importConfig = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || data.format !== 'cloud-print-settings') throw new Error('不是有效的墨印打印设置文件');
      onImport?.(data);
    } catch (err) {
      notify?.(err.message || '导入失败', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="打印设置"
      size="xl"
      className="print-settings-modal"
      footer={(
        <>
          <span className="settings-foot-hint">勾选多行后使用上方批量设置；拖动表格右侧把手可调整表格宽度</span>
          <div className="settings-foot-actions">
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => onAddItem?.()}>新建打印项目</Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => onNewScheme?.()}>新建打印池</Button>
          </div>
        </>
      )}
    >
      <div className="print-settings-top">
        <div className="settings-title-actions">
          <button type="button" className="top-action active" onClick={() => fileRef.current?.click()}>导入配置</button>
          <button type="button" className="top-action" onClick={exportConfig}>导出配置</button>
          <button type="button" className="top-action" onClick={exportConfig}>备份</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { importConfig(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      <div className="scheme-row">
        <span className="scheme-label">价格方案</span>
        <Select value={scheme?.id || ''} onChange={(e) => onSwitchScheme?.(e.target.value)} className="scheme-select">
          {state.schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Input
          key={scheme?.id}
          defaultValue={scheme?.name || ''}
          className="scheme-name"
          placeholder="当前价格方案名称，可编辑重命名"
          onBlur={(e) => { if (e.target.value.trim() && e.target.value !== scheme?.name) onRenameScheme?.(e.target.value.trim()); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
        <Button variant="ghost" size="sm" onClick={() => onRenameScheme?.(document.querySelector('.scheme-name')?.value?.trim() || scheme?.name)}>重命名</Button>
        <Button variant="ghost" size="sm" icon={Plus} onClick={() => onNewScheme?.()}>新建</Button>
        <Button variant="ghost" size="sm" icon={Trash2} className="danger-text" disabled={state.schemes.length <= 1} onClick={() => onDeleteScheme?.()}>删除</Button>
      </div>

          <div className="table-width-hint">拖动每列表头的右边界调整列宽（像 Excel 一样，双击边框恢复默认）</div>
      {selected.size ? (
        <div className="settings-bulk-bar">
          <b>已选 {selected.size} 项</b>
          <span>批量设置</span>
          <select className="control select bulk-select" value="" onChange={(e) => { if (e.target.value) applyBulk({ color: e.target.value }); e.target.value = ''; }}>
            <option value="">颜色</option><option value="mono">黑白</option><option value="color">彩色</option>
          </select>
          <select className="control select bulk-select" value="" onChange={(e) => { if (e.target.value) applyBulk({ paper: e.target.value }); e.target.value = ''; }}>
            <option value="">纸张</option><option value="A4">A4</option><option value="A3">A3</option><option value="A5">A5</option>
          </select>
          <select className="control select bulk-select" value="" onChange={(e) => { if (e.target.value) applyBulk({ duplex: e.target.value }); e.target.value = ''; }}>
            <option value="">翻转</option><option value="simplex">单面</option><option value="shortEdge">双面短翻</option><option value="longEdge">双面长翻</option>
          </select>
          <button type="button" className="link-btn" onClick={() => setSelected(new Set())}>取消选择</button>
        </div>
      ) : null}

      <div className="settings-table-wrap">
        <table className="settings-table" style={{ width: totalWidth, minWidth: totalWidth }}>
          <colgroup>
            {colWidths.map((width, index) => <col key={COLUMNS[index].key} style={{ width }} />)}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((column, index) => (
                <th key={column.key} className={column.className}>
                  {column.label}
                  <span
                    className="col-resizer"
                    title="拖动调整列宽，双击恢复默认"
                    onPointerDown={(e) => startColumnResize(index, e)}
                    onDoubleClick={() => {
                      setColWidths((prev) => {
                        const next = prev.slice();
                        next[index] = DEFAULT_WIDTHS[index];
                        onUpdateSettings?.({ printColumnWidths: next });
                        return next;
                      });
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className={selected.has(item.id) ? 'selected' : ''}>
                <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={`选择 ${item.name}`} /></td>
                <td className="grip-cell"><GripVertical size={14} /></td>
                <td className="muted-cell">{i + 1}</td>
                <td>
                  <input className="cell-input name-cell" value={item.name} onChange={(e) => onUpdateItem?.(item.id, { name: e.target.value })} />
                </td>
                <td>
                  <input
                    className="cell-input price-cell"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => onUpdateItem?.(item.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </td>
                <td>
                  <select className="cell-select" value={item.unit || '面'} onChange={(e) => onUpdateItem?.(item.id, { unit: e.target.value })}>
                    <option value="面">面</option>
                    <option value="张">张</option>
                    <option value="份">份</option>
                  </select>
                </td>
                <td>
                  <select className="cell-select" value={item.color} onChange={(e) => onUpdateItem?.(item.id, { color: e.target.value })}>
                    {COLOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td>
                  <select className="cell-select" value={item.paper} onChange={(e) => onUpdateItem?.(item.id, { paper: e.target.value })}>
                    {PAPER_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </td>
                <td>
                  <select className="cell-select" value={item.duplex} onChange={(e) => onUpdateItem?.(item.id, { duplex: e.target.value })}>
                    {DUPLEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td>
                  <select className="cell-select" value={item.orientation || 'auto'} onChange={(e) => onUpdateItem?.(item.id, { orientation: e.target.value })}>
                    {ORIENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td>
                  <select className="cell-select" value={item.scale || 'fit'} onChange={(e) => onUpdateItem?.(item.id, { scale: e.target.value })}>
                    {SCALE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td>
                  <select className="cell-select printer-cell" value={item.printer || ''} onChange={(e) => onUpdateItem?.(item.id, { printer: e.target.value })} title={capabilitySummary(printerFor(printers, item.printer))}>
                    <option value="">系统默认打印机</option>
                    {printers.map((p) => <option key={p.name} value={p.name}>{p.displayName}</option>)}
                  </select>
                  <span className={`printer-cap ${capabilityBad(item) ? 'bad' : ''}`}>
                    {capabilitySummary(printerFor(printers, item.printer))}
                  </span>
                </td>
                <td className="ops-cell">
                  <button type="button" className="row-op row-op-text" title="打印机首选项" onClick={() => onOpenPreferences?.(item.printer || '')}>首选项</button>
                  <button type="button" className="row-op" title="复制项目" onClick={() => onDuplicateItem?.(item.id)}><Copy size={13} /></button>
                  <button type="button" className="row-op danger" title="删除项目" onClick={() => onDeleteItem?.(item.id)}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="settings-table-foot">
        <span>单价单位：{money(0)} 起 · 当前方案 {items.length} 项 · 修改后自动保存</span>
        <span className="secure-note"><ShieldCheck size={13} /> 配置保存在本机</span>
      </div>
    </Modal>
  );
}
