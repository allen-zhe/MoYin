import { useEffect, useMemo, useState } from 'react';
import { Printer, Tags, Grid3X3, Info, X, ChevronDown } from 'lucide-react';
import { Modal, Button, Select, Toggle } from './ui.jsx';
import { labelInnerHtml, makeQr, labelCss } from '../lib/label.js';
import { formatDate, money } from '../lib/format.js';
import { printerFor, capabilitySummary } from '../lib/printerCaps.js';

const POSITIONS = [
  ['top-left', '左上'], ['top-center', '上中'], ['top-right', '右上'],
  ['center-left', '左中'], ['center', '居中'], ['center-right', '右中'],
  ['bottom-left', '左下'], ['bottom-center', '下中'], ['bottom-right', '右下'],
];

export function LabelSettings({ open, settings, printers, onClose, onChange, onPrintTest, onOpenPreferences }) {
  const [qr, setQr] = useState('');
  const nativePrinters = (printers || []).filter((p) => !p.virtual);
  const [busy, setBusy] = useState(false);
  const sample = useMemo(() => ({
    short: 'A1B2C3D4',
    customer: '散客',
    pages: 1,
    files: ['示例文件 · 巴山城口行.pdf'],
    fileCount: 1,
    amount: 2,
    paid: false,
    printedAt: Date.now(),
    shop: settings.labelShopName || '墨印',
    footer: settings.labelFooter || '扫码查看订单 · 凭单取件',
    title: '堆叠1',
    printerIndex: settings.printerIndexes?.[settings.labelPrinter] || '',
  }), [settings.labelShopName, settings.labelFooter, settings.printerIndexes, settings.labelPrinter]);

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    makeQr(sample, 220).then(setQr).finally(() => setBusy(false));
  }, [open, sample]);

  const update = (patch) => onChange?.({ ...settings, ...patch });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="标签设置"
      subtitle="修改后自动保存。"
      size="lg"
      className="label-settings-modal"
    >
      <div className="label-settings-grid">
        <div className="label-settings-form">
          <section className="label-section">
            <h4>打印机</h4>
            <div className="label-printer-row">
              <Select value={settings.labelPrinter || ''} onChange={(e) => update({ labelPrinter: e.target.value })} title={capabilitySummary(printerFor(nativePrinters, settings.labelPrinter))}>
                <option value="">系统默认打印机</option>
                {nativePrinters.map((p) => <option key={p.name} value={p.name}>{p.displayName}</option>)}
              </Select>
              <Button variant="ghost" size="sm" onClick={() => onOpenPreferences?.(settings.labelPrinter || '')}>首选项</Button>
            </div>
            <span className="label-cap">{capabilitySummary(printerFor(nativePrinters, settings.labelPrinter))}</span>
            <div className="label-index-card">
              <div>
                <b>文档打印机序号</b>
                <span>每台打印机设置一个编号，显示在计费金额左侧</span>
              </div>
              <input
                className="control input printer-index-input"
                type="number"
                min="1"
                max="99"
                placeholder="序号"
                value={settings.printerIndexes?.[settings.labelPrinter || ''] || ''}
                onChange={(e) => update({ printerIndexes: { ...(settings.printerIndexes || {}), [settings.labelPrinter || '']: Math.max(1, Math.min(99, Number(e.target.value) || 0)) || '' } })}
                title="显示在标签金额旁的打印机编号"
              />
            </div>
          </section>

          <section className="label-section">
            <div className="label-two-col">
              <label className="field">
                <span className="field-label">纸张尺寸</span>
                <Select value={settings.labelPaper} onChange={(e) => update({ labelPaper: e.target.value })}>
                  <option value="auto">自动读取打印机当前表单</option>
                  <option value="A5">A5（148 × 210 mm）</option>
                  <option value="A4">A4（210 × 297 mm）</option>
                  <option value="A3">A3（297 × 420 mm）</option>
                  <option value="custom">自定义尺寸</option>
                </Select>
              </label>
              <label className="field">
                <span className="field-label">方向</span>
                <Select value={settings.labelOrientation} onChange={(e) => update({ labelOrientation: e.target.value })}>
                  <option value="portrait">自动（默认）</option>
                  <option value="portrait">竖向</option>
                  <option value="landscape">横向</option>
                </Select>
              </label>
            </div>
            <div className="label-two-col">
              <label className="field">
                <span className="field-label">纸张宽度（mm）</span>
                <input className="control input" type="number" min="40" value={settings.labelWidth} onChange={(e) => update({ labelWidth: Number(e.target.value) || 210 })} />
              </label>
              <label className="field">
                <span className="field-label">纸张高度（mm）</span>
                <input className="control input" type="number" min="40" value={settings.labelHeight} onChange={(e) => update({ labelHeight: Number(e.target.value) || 297 })} />
              </label>
            </div>
            <p className="label-note"><Info size={13} /> 自动值来自打印机驱动当前表单；需要标准纸张请选择 A5、A4 或 A3。</p>
          </section>
        </div>

        <div className="label-preview-column">
          <h4>标签内容预览</h4>
          <div className="label-preview-box">
            <div className="label-preview-paper">
              {busy || !qr ? <span className="preview-loading">生成预览中…</span> : (
                <div className="label-preview-scale" dangerouslySetInnerHTML={{ __html: `<style>${labelCss()}</style>${labelInnerHtml(sample, qr)}` }} />
              )}
            </div>
          </div>
          <div className="label-preview-meta">
            {settings.labelPaper === 'auto' ? '210.06 × 296.93' : `${settings.labelWidth} × ${settings.labelHeight}`} mm · 点击放大
            <br /><span>示例内容 · 按纸张比例显示</span>
          </div>

          <h4>标签整体比例</h4>
          <Select value={settings.labelScale} onChange={(e) => update({ labelScale: Number(e.target.value) })}>
            <option value="0.25">0.25 倍</option>
            <option value="0.5">0.5 倍</option>
            <option value="0.75">0.75 倍</option>
            <option value="1">1 倍（默认）</option>
            <option value="1.5">1.5 倍</option>
            <option value="2">2 倍</option>
            <option value="3">3 倍</option>
            <option value="4">4 倍</option>
          </Select>

          <h4>打印位置</h4>
          <div className="position-grid">
            {POSITIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={settings.labelPosition === value ? 'active' : ''}
                onClick={() => update({ labelPosition: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="label-note">九宫格表示标签在纸张上的位置。</p>
        </div>
      </div>
      <div className="label-settings-foot">
        <span>标签打印机：{settings.labelPrinter || '系统默认'} · 预览二维码可直接扫码核对</span>
        <Button variant="primary" size="sm" icon={Printer} onClick={() => onPrintTest?.()}>打印测试标签</Button>
      </div>
    </Modal>
  );
}
