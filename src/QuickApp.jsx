import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, X, Printer, Smartphone } from 'lucide-react';
import { QuickPanel } from './components/QuickPanel.jsx';
import { Logo } from './components/Logo.jsx';
import { ToastStack, Spinner } from './components/ui.jsx';
import { preparePrint, executePrint } from './lib/print.js';
import { amountForPages, money, uid } from './lib/format.js';
import { labelDataForStack, labelPageHtml, makeQr } from './lib/label.js';

export function QuickApp() {
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [quick, setQuick] = useState({ customer: '散客', amount: 0, copies: 1, count: 0, items: [] });
  const [printing, setPrinting] = useState(null);
  const [toasts, setToasts] = useState([]);
  const stateRef = useRef(null);

  const notify = useCallback((message, type = 'info') => {
    const id = uid('t_');
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const boot = await window.cloudPrint.init();
        setData(boot);
        stateRef.current = boot.state;
        setQuick(boot.state.quick || quick);
        const scheme = boot.state.schemes.find((s) => s.id === boot.state.activeSchemeId) || boot.state.schemes[0];
        setItems(scheme.items.slice(0, 12));
        setPrinters(withVirtualPrinter(await window.cloudPrint.listPrinters()));
      } catch (err) {
        notify(err.message || '启动失败', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function drop(files, item) {
    const paths = Array.from(files || []).map((f) => window.cloudPrint.getPathForFile(f)).filter(Boolean);
    if (!paths.length) return;
    const infos = await window.cloudPrint.statFiles(paths);
    if (!infos.length) return notify('不支持的文件格式', 'error');
    await print(infos, item);
  }

  async function print(files, item) {
    if (printing) return;
    const copies = Math.max(1, Number(quick.copies) || 1);
    setPrinting({ percent: 2, stage: 'render', title: '正在准备打印', detail: `${files.length} 个文件 · ${copies} 份` });
    try {
      const prepared = await preparePrint(files, item, {
        copies, dpi: stateRef.current.settings.pdfDpi || 300, onProgress: (p) => setPrinting((prev) => ({ ...prev, ...p })),
      });
      const amount = Math.round(amountForPages(prepared.pages, item) * copies * 100) / 100;
      setPrinting((prev) => ({ ...prev, percent: 82, stage: 'spooling', title: '正在发送到打印机' }));
      const result = await executePrint({
        html: prepared.html, images: prepared.images, orientations: prepared.orientations, item, copies, paper: prepared.paper, landscape: prepared.landscape,
        simulate: stateRef.current.settings.simulatePrint, jobId: uid('t_'),
        onProgress: (p) => setPrinting((prev) => ({ ...prev, ...p })),
      });
      if (!result.ok) throw new Error(result.error || '打印失败');
      const next = {
        ...quick,
        amount: Math.round((quick.amount + amount) * 100) / 100,
        count: quick.count + files.length,
        items: [...(quick.items || []), ...files.map((f) => ({ name: f.name, pages: f.pages || 1 }))],
      };
      setQuick(next);
      await window.cloudPrint.notifyQuickPrinted({ amount, count: files.length, items: files.map((f) => ({ name: f.name, pages: f.pages || 1 })) });
      notify(`已打印 ${prepared.pages} 页 · ${money(amount)}`, 'success');
      setPrinting({ percent: 100, stage: 'done', title: '打印任务已提交', detail: '可在主窗口继续收款或打印标签' });
      setTimeout(() => setPrinting(null), 900);
    } catch (err) {
      notify(err.message || '打印失败', 'error');
      setPrinting(null);
    }
  }

  async function printLabel() {
    if (!quick.amount) return notify('当前没有可打印的快捷订单', 'warn');
    const item = items[0];
    const stack = {
      id: uid('quick_'), title: '快捷打印', customer: quick.customer,
      files: (quick.items || []).map((x, i) => ({ id: `q_${i}`, name: x.name, pages: x.pages || 1, size: 0 })),
      frozenAmount: quick.amount, payment: 'unpaid', printedAt: Date.now(),
    };
    const settings = stateRef.current.settings;
    const labelData = labelDataForStack(stack, item, settings);
    const qr = await makeQr(labelData, 300);
    const paper = settings.labelPaper === 'auto' ? 'A4' : settings.labelPaper;
    const pageSize = paper === 'custom' ? { width: settings.labelWidth, height: settings.labelHeight } : paper;
    const html = labelPageHtml(labelData, qr, { ...settings, labelPaper: paper }, settings.labelPosition);
    const result = await window.cloudPrint.printHtml({
      html, jobId: uid('t_'), deviceName: settings.labelPrinter || '', color: false, copies: 1,
      item: { paper, duplex: 'simplex' }, pageSize, landscape: settings.labelOrientation === 'landscape',
      simulate: settings.simulatePrint,
    });
    if (result.ok) {
      setQuick((prev) => ({ ...prev, amount: 0, count: 0, items: [] }));
      await window.cloudPrint.notifyQuickCleared?.();
      notify('取件标签已打印');
    } else notify(result.error || '标签打印失败', 'error');
  }

  if (!data) {
    return <div className="app-boot"><Logo size={64} /><h1>快捷打印</h1><Spinner /></div>;
  }

  return (
    <div className="quick-window">
      <div className="titlebar quick-titlebar" onDoubleClick={() => {}}>
        <div className="titlebar-brand"><Logo size={18} /><span>快捷打印</span><span className="titlebar-ver">独立窗口</span></div>
        <div className="titlebar-actions">
          <button type="button" aria-label="最小化" onClick={() => window.cloudPrint.minimizeQuickWindow()}><Minus size={15} /></button>
          <button type="button" className="close" aria-label="关闭" onClick={() => window.cloudPrint.closeQuickWindow()}><X size={16} /></button>
        </div>
      </div>
      <div className="quick-window-head">
        <div><h2>快捷打印</h2><p>拖入文件到档位，立即按配置打印</p></div>
        <div className="quick-window-status"><Smartphone size={14} /> 与主窗口同步累计金额</div>
      </div>
      <QuickPanel
        slots={items.map((i) => i.id)} items={items} compact quick={quick} printers={printers}
        onDropFiles={drop}
        onPrintLabel={printLabel}
        onOpenWindow={() => {}}
        onClear={() => setQuick((prev) => ({ ...prev, amount: 0, count: 0, items: [] }))}
        onCopies={(n) => setQuick((prev) => ({ ...prev, copies: n }))}
        onOpenSettings={() => notify('请在主窗口修改打印配置', 'info')}
        onReorder={(from, to) => setItems((prev) => {
          if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
          const next = prev.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return next;
        })}
      />
      {printing ? (
        <div className="print-overlay">
          <div className="print-progress-card">
            <div className="print-progress-head">
              <span className={`print-spinner ${printing.stage === 'done' ? 'done' : ''}`}>{printing.stage === 'done' ? '✓' : <Spinner size={22} />}</span>
              <div><h3>{printing.title}</h3><p>{printing.detail || '请稍候…'}</p></div>
              <span className="print-percent">{Math.round(printing.percent || 0)}%</span>
            </div>
            <div className="print-progress-bar"><i style={{ width: `${Math.max(3, printing.percent || 0)}%` }} /></div>
          </div>
        </div>
      ) : null}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
