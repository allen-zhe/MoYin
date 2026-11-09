import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Settings as SettingsIcon, MessageSquare, Info, SearchX, Layers, ArrowUpFromLine,
  Undo2, Redo2, Printer, WalletCards, Smartphone, X,
} from 'lucide-react';
import { TitleBar, Header, Toolbar } from './components/Chrome.jsx';
import { StackCard, StackContextMenu } from './components/StackCard.jsx';
import { QuickPanel } from './components/QuickPanel.jsx';
import { StackDetail } from './components/StackDetail.jsx';
import { PrintSettings } from './components/PrintSettings.jsx';
import { LabelSettings } from './components/LabelSettings.jsx';
import { AppSettings } from './components/AppSettings.jsx';
import { AmountStats } from './components/AmountStats.jsx';
import { NewStackDialog } from './components/NewStackDialog.jsx';
import { ReceiveDialog } from './components/ReceiveDialog.jsx';
import { PrintQueue } from './components/PrintQueue.jsx';
import { PaymentDialog } from './components/PaymentDialog.jsx';
import { AboutDialog } from './components/AboutDialog.jsx';
import { ImpositionDialog } from './components/ImpositionDialog.jsx';
import { Modal, Button, ToastStack, EmptyState, Spinner, Toggle } from './components/ui.jsx';
import { Logo } from './components/Logo.jsx';
import {
  uid, money, stackPages, stackSize, stackPrintState, stackPayState, amountForPages,
  matchesSearch, formatDate, formatBytes, playTone, stackAmount,
} from './lib/format.js';
import { preparePrint, executePrint, sheetsToHtml } from './lib/print.js';
import { getPdfPageCount } from './lib/pdf.js';
import { labelDataForStack, labelPageHtml, makeQr } from './lib/label.js';
import { createErpAdapter } from './lib/erp.js';
import { validateItem, validateLabelPaper, assignPrintersToItems, choosePrinter } from './lib/printerCaps.js';
import { VIRTUAL_PDF_NAME, withVirtualPrinter } from './lib/virtualPrinter.js';
import { GITHUB_ISSUES_URL } from './lib/constants.js';

const RANGE_MS = { '10m': 10 * 60 * 1000, '30m': 30 * 60 * 1000, '1h': 60 * 60 * 1000 };

function dirname(p) {
  return String(p || '').replace(/[\\/][^\\/]+$/, '') || '';
}

export function MainApp() {
  const [state, setState] = useState(null);
  const [boot, setBoot] = useState({ loading: true, error: '', version: '0.9.7', simulate: false });
  const [printers, setPrinters] = useState([]);
  const [receive, setReceive] = useState({ running: false, url: '', port: 18666, token: '' });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('time');
  const [range, setRange] = useState('all');
  const [scope, setScope] = useState('active');
  const [quickOpen, setQuickOpen] = useState(true);
  const [quickDetached, setQuickDetached] = useState(false);
  const [selectedStackId, setSelectedStackId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [printing, setPrinting] = useState(null);
  const [paymentInitial, setPaymentInitial] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [defaultLocation, setDefaultLocation] = useState('');
  const [customerPrompt, setCustomerPrompt] = useState(null);
  const [imposition, setImposition] = useState(null);

  const stateRef = useRef(null);
  const bootedRef = useRef(false);
  const historyRef = useRef({ undo: [], redo: [] });
  const pageCacheRef = useRef(new Map());
  const quickAutoHiddenRef = useRef(false);
  const toastTimers = useRef(new Map());

  useEffect(() => { stateRef.current = state; }, [state]);

  const notify = useCallback((message, type = 'info') => {
    const id = uid('toast_');
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimers.current.delete(id);
    }, type === 'error' ? 5200 : 3200);
    toastTimers.current.set(id, timer);
  }, []);

  useEffect(() => () => {
    for (const t of toastTimers.current.values()) clearTimeout(t);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await window.cloudPrint.init();
        if (!alive) return;
        setState(data.state);
        setBoot({ loading: false, error: '', version: data.version, simulate: !!data.simulate, paths: data.paths });
        setPrinters(withVirtualPrinter(data.printers || []));
        setReceive(data.receive || { running: false });
        bootedRef.current = true;
        const first = data.state.stacks?.find((s) => !s.archived) || data.state.stacks?.[0];
        if (first) setSelectedStackId(first.id);
        if (data.pendingReceived?.length) {
          setTimeout(() => ingestExternal(data.pendingReceived, 'receive'), 50);
        }
        if (data.state.settings.watchDir) {
          setTimeout(async () => {
            const watched = await window.cloudPrint.scanWatch();
            if (watched?.length) ingestExternal(watched, 'watch');
          }, 260);
        }
        loadPrinters();
      } catch (err) {
        if (alive) setBoot((b) => ({ ...b, loading: false, error: err.message || String(err) }));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPrinters = useCallback(async () => {
    try {
      const list = await window.cloudPrint.listPrinters();
      setPrinters(withVirtualPrinter(Array.isArray(list) ? list : []));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!state || !printers.some((p) => !p.virtual)) return;
    if ((state.settings.printerAssignVersion || 0) >= 1) return;
    setState((prev) => {
      if (!prev || (prev.settings.printerAssignVersion || 0) >= 1) return prev;
      let changed = false;
      const schemes = prev.schemes.map((scheme) => {
        const result = assignPrintersToItems(scheme.items, printers);
        if (result.changed) changed = true;
        return { ...scheme, items: result.items };
      });
      return {
        ...prev,
        schemes,
        settings: { ...prev.settings, printerAssignVersion: 1 },
      };
    });
  }, [state?.settings.printerAssignVersion, printers]);

  useEffect(() => {
    if (!state) return undefined;
    const id = setInterval(loadPrinters, 45000);
    return () => clearInterval(id);
  }, [!!state, loadPrinters]);

  useEffect(() => {
    if (!state || !bootedRef.current) return undefined;
    const timer = setTimeout(() => {
      window.cloudPrint.saveState(state).catch((err) => console.error('[save]', err));
    }, 320);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const pending = [];
    for (const stack of state.stacks || []) {
      for (const file of stack.files || []) {
        if (String(file.ext).toLowerCase() === 'pdf' && file.pages == null) pending.push(file);
      }
    }
    if (pending.length) hydratePages(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    const offs = [];
    offs.push(window.cloudPrint.onReceiveFiles((files) => ingestExternal(files, 'receive')));
    offs.push(window.cloudPrint.onReceiveInfo((info) => setReceive(info || { running: false })));
    offs.push(window.cloudPrint.onWatcherFiles((files) => ingestExternal(files, 'watch')));
    offs.push(window.cloudPrint.onQuickPrinted((payload) => {
      setState((prev) => prev ? ({
        ...prev,
        quick: {
          ...prev.quick,
          amount: Math.round(((prev.quick.amount || 0) + (payload.amount || 0)) * 100) / 100,
          count: (prev.quick.count || 0) + (payload.count || 0),
          printedAt: Date.now(),
          items: [...(prev.quick.items || []), ...(payload.items || [])],
        },
      }) : prev);
      notify('独立窗口已完成快捷打印');
    }));
    offs.push(window.cloudPrint.onPrintProgress((p) => {
      setPrinting((prev) => prev ? { ...prev, ...p, percent: p.percent ?? prev.percent } : prev);
    }));
    offs.push(window.cloudPrint.onQuickWindow?.((payload) => {
      if (payload?.open) {
        setQuickDetached(true);
        setQuickOpen((prev) => { if (prev) { quickAutoHiddenRef.current = true; return false; } return prev; });
      } else {
        setQuickDetached(false);
        quickAutoHiddenRef.current = false;
        setQuickOpen(true);
      }
    }));
    offs.push(window.cloudPrint.onQuickCleared?.(() => {
      setState((prev) => prev ? ({ ...prev, quick: { ...prev.quick, amount: 0, count: 0, items: [] } }) : prev);
    }));
    offs.push(window.cloudPrint.onOpenReceive?.(() => setDialog('receive')));
    return () => offs.forEach((off) => { try { off(); } catch { /* ignore */ } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || e.target?.isContentEditable) return;
      if (e.key === 'Escape') {
        if (ctx) setCtx(null);
        else if (detailId) setDetailId(null);
        else if (dialog) setDialog(null);
        return;
      }
      if (!state.settings.shortcuts) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
      } else if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        printSelectedStack();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        closeSelected(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        closeSelected(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, detailId, dialog, ctx, selectedStackId]);

  useEffect(() => {
    const close = () => setCtx(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const activeScheme = useMemo(() => {
    if (!state) return null;
    return state.schemes.find((s) => s.id === state.activeSchemeId) || state.schemes[0];
  }, [state?.schemes, state?.activeSchemeId]);

  const items = useMemo(() => activeScheme?.items || [], [activeScheme]);
  const quickItems = useMemo(() => {
    if (!state) return [];
    const ordered = (state.slots || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
    const rest = items.filter((i) => !ordered.some((o) => o.id === i.id));
    return [...ordered, ...rest].slice(0, 12);
  }, [state?.slots, items]);

  const duplicateKeys = useMemo(() => {
    const counts = new Map();
    for (const stack of state?.stacks || []) {
      for (const file of stack.files || []) {
        for (const key of [`p:${file.path}`, `n:${String(file.name).toLowerCase()}`]) {
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }
    const set = new Set();
    for (const [key, count] of counts) if (count > 1) set.add(key);
    return set;
  }, [state?.stacks]);

  const selectedStack = useMemo(() => state?.stacks?.find((s) => s.id === selectedStackId) || null, [state?.stacks, selectedStackId]);
  const detailStack = useMemo(() => state?.stacks?.find((s) => s.id === detailId) || null, [state?.stacks, detailId]);
  const defaultPrinter = printers.find((p) => p.isDefault) || printers[0];

  const openPrinterPreferences = useCallback(async (name) => {
    if (name === VIRTUAL_PDF_NAME) return notify('PDF 检查机是应用内虚拟输出，不需要驱动首选项。', 'info');
    const res = await window.cloudPrint.openPrinterPreferences?.(name || '');
    if (!res?.ok) notify(res?.error || '无法打开打印机首选项，请确认已安装打印机驱动。', 'error');
  }, [notify]);

  const refreshReceive = useCallback(async (port) => {
    const info = await window.cloudPrint.startReceive(port || stateRef.current?.settings?.receivePort || 18666);
    setReceive(info);
    return info;
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.settings.receiveEnabled) {
      window.cloudPrint.receiveInfo().then((info) => {
        setReceive(info || { running: false });
        if (!info?.running) refreshReceive(state.settings.receivePort).catch(() => {});
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.settings.receiveEnabled]);

  function pushHistory() {
    if (!stateRef.current) return;
    const snap = {
      stacks: stateRef.current.stacks,
      payments: stateRef.current.payments,
      counters: stateRef.current.counters,
    };
    const list = historyRef.current.undo;
    list.push(JSON.stringify(snap));
    if (list.length > 40) list.shift();
    historyRef.current.redo = [];
  }

  function applyHistory(snapshot) {
    try {
      const data = JSON.parse(snapshot);
      setState((prev) => prev ? ({ ...prev, ...data }) : prev);
    } catch { /* ignore */ }
  }

  function undo() {
    const h = historyRef.current;
    const snap = h.undo.pop();
    if (!snap) return notify('没有可撤销的操作');
    if (stateRef.current) h.redo.push(JSON.stringify({ stacks: stateRef.current.stacks, payments: stateRef.current.payments, counters: stateRef.current.counters }));
    applyHistory(snap);
    notify('已撤销');
  }

  function redo() {
    const h = historyRef.current;
    const snap = h.redo.pop();
    if (!snap) return notify('没有可重做的操作');
    if (stateRef.current) h.undo.push(JSON.stringify({ stacks: stateRef.current.stacks, payments: stateRef.current.payments, counters: stateRef.current.counters }));
    applyHistory(snap);
    notify('已重做');
  }

  function hydratePages(files) {
    if (!Array.isArray(files)) return;
    for (const file of files) {
      if (!file?.path) continue;
      if (String(file.ext).toLowerCase() === 'pdf') {
        let promise = pageCacheRef.current.get(file.path);
        if (!promise) {
          promise = getPdfPageCount(file.path);
          pageCacheRef.current.set(file.path, promise);
        }
        promise.then((pages) => {
          setState((prev) => {
            if (!prev) return prev;
            let changed = false;
            const stacks = prev.stacks.map((s) => {
              const idx = (s.files || []).findIndex((f) => f.path === file.path && (f.pages == null || f.pages !== pages));
              if (idx < 0) return s;
              changed = true;
              const nextFiles = s.files.slice();
              nextFiles[idx] = { ...nextFiles[idx], pages, pageError: '' };
              return { ...s, files: nextFiles };
            });
            return changed ? { ...prev, stacks } : prev;
          });
        }).catch((err) => {
          pageCacheRef.current.delete(file.path);
          setState((prev) => {
            if (!prev) return prev;
            let changed = false;
            const stacks = prev.stacks.map((s) => {
              const idx = (s.files || []).findIndex((f) => f.path === file.path);
              if (idx < 0) return s;
              changed = true;
              const nextFiles = s.files.slice();
              nextFiles[idx] = { ...nextFiles[idx], pages: 1, pageError: err.message || '页数读取失败' };
              return { ...s, files: nextFiles };
            });
            return changed ? { ...prev, stacks } : prev;
          });
        });
      }
    }
  }

  function appendFiles(prev, stackId, infos, { source } = {}) {
    const now = Date.now();
    let skipped = 0;
    let added = [];
    const allPaths = new Set();
    for (const stack of prev.stacks) for (const file of stack.files || []) allPaths.add(file.path);
    const stacks = prev.stacks.map((s) => {
      if (s.id !== stackId) return s;
      const fresh = infos.filter((f) => {
        if (allPaths.has(f.path)) { skipped += 1; return false; }
        allPaths.add(f.path);
        return true;
      });
      added = fresh;
      if (!fresh.length) return s;
      return {
        ...s,
        folder: s.folder || dirname(fresh[0].path),
        files: [...(s.files || []), ...fresh],
        archived: false,
        updatedAt: now,
      };
    });
    return { next: { ...prev, stacks }, added, skipped };
  }

  async function addPaths(paths, stackId = null, source = 'manual') {
    if (!paths?.length) return;
    const infos = await window.cloudPrint.statFiles(paths);
    if (!infos?.length) {
      notify('没有找到可打印的 PDF、图片或文本文件', 'error');
      return;
    }
    if (stackId) {
      const prev = stateRef.current;
      if (!prev) return;
      const res = appendFiles(prev, stackId, infos, { source });
      if (res.added.length) {
        setState(res.next);
        hydratePages(res.added);
        notify(`已添加 ${res.added.length} 个文件`);
      } else {
        notify(res.skipped ? '这些文件已经在堆叠中了' : '没有可添加的文件', 'warn');
      }
    } else {
      createStackWithFiles(infos, source);
    }
  }

  function createStackWithFiles(infos, source = 'manual') {
    const id = uid('s_');
    const now = Date.now();
    setState((prev) => {
      if (!prev) return prev;
      const seq = prev.counters.stackSeq || 1;
      const title = source === 'receive' ? '手机传输' : source === 'watch' ? `自动整理 ${seq}` : `堆叠${seq}`;
      const stack = {
        id,
        title,
        customer: '散客',
        folder: dirname(infos[0]?.path),
        files: infos,
        source,
        manual: source === 'manual',
        createdAt: now,
        updatedAt: now,
        archived: false,
        payment: 'none',
        itemId: items[0]?.id || '',
      };
      return {
        ...prev,
        stacks: [stack, ...prev.stacks],
        counters: { ...prev.counters, stackSeq: seq + 1 },
      };
    });
    setSelectedStackId(id);
    setDetailId(id);
    hydratePages(infos);
    playTone('ok');
  }

  function ingestExternal(files, source) {
    if (!files?.length) return;
    const now = Date.now();
    const WINDOW = 10 * 60 * 1000;
    let addedAll = [];
    let targetStackId = null;
    setState((prev) => {
      if (!prev) return prev;
      const recent = prev.stacks
        .filter((s) => !s.archived && s.source === source && now - (s.updatedAt || 0) < WINDOW)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      if (recent) {
        const res = appendFiles(prev, recent.id, files, { source });
        addedAll = res.added;
        targetStackId = recent.id;
        return res.next;
      }
      const allPaths = new Set();
      for (const stack of prev.stacks) for (const file of stack.files || []) allPaths.add(file.path);
      const fresh = files.filter((f) => !allPaths.has(f.path));
      if (!fresh.length) return prev;
      const seq = prev.counters.stackSeq || 1;
      const id = uid('s_');
      targetStackId = id;
      const title = source === 'receive' ? '手机传输' : `自动整理 ${seq}`;
      const stack = {
        id,
        title,
        customer: '散客',
        folder: dirname(fresh[0]?.path),
        files: fresh,
        source,
        manual: false,
        createdAt: now,
        updatedAt: now,
        archived: false,
        payment: 'none',
        itemId: items[0]?.id || '',
      };
      addedAll = fresh;
      return { ...prev, stacks: [stack, ...prev.stacks], counters: { ...prev.counters, stackSeq: seq + 1 } };
    });
    if (addedAll.length) {
      hydratePages(addedAll);
      notify(source === 'receive' ? `收到 ${addedAll.length} 个手机文件` : `文件目录新增 ${addedAll.length} 个文件`);
      playTone('ok');
      if (!selectedStackId && targetStackId) setSelectedStackId(targetStackId);
    }
  }

  async function createFolderStack({ name, location }) {
    const res = await window.cloudPrint.createStackFolder({ parent: location || undefined, name });
    if (!res?.path) throw new Error('创建文件夹失败');
    const id = uid('s_');
    const now = Date.now();
    setState((prev) => {
      if (!prev) return prev;
      const seq = prev.counters.stackSeq || 1;
      const stack = {
        id, title: name, customer: '散客', folder: res.path, files: [],
        source: 'manual', manual: true, createdAt: now, updatedAt: now,
        archived: false, payment: 'none', itemId: items[0]?.id || '',
      };
      return { ...prev, stacks: [stack, ...prev.stacks], counters: { ...prev.counters, stackSeq: seq + 1 } };
    });
    setSelectedStackId(id);
    setDetailId(null);
    setDialog(null);
    notify('堆叠已创建，可以把文件拖到卡片上');
  }

  function updateSettings(patch) {
    const prevSettings = stateRef.current?.settings || state.settings;
    const next = { ...prevSettings, ...patch };
    setState((prev) => prev ? ({ ...prev, settings: next }) : prev);
    if (patch.autoStart !== undefined && !!patch.autoStart !== !!prevSettings.autoStart) {
      window.cloudPrint.setAutoStart(!!patch.autoStart);
    }
    if (patch.watchDir !== undefined && patch.watchDir !== prevSettings.watchDir) {
      if (patch.watchDir) {
        window.cloudPrint.startWatch(patch.watchDir).then(async () => {
          const files = await window.cloudPrint.scanWatch();
          if (files?.length) ingestExternal(files, 'watch');
        }).catch((err) => notify(err.message || '目录监听启动失败', 'error'));
      } else {
        window.cloudPrint.stopWatch();
      }
    }
    if (patch.receiveEnabled !== undefined && !!patch.receiveEnabled !== !!prevSettings.receiveEnabled) {
      if (patch.receiveEnabled) refreshReceive(patch.receivePort || prevSettings.receivePort).catch((err) => notify(err.message, 'error'));
      else window.cloudPrint.stopReceive().then(setReceive);
    }
    if (patch.alwaysOnTop !== undefined && !!patch.alwaysOnTop !== !!prevSettings.alwaysOnTop) {
      window.cloudPrint.window.setAlwaysOnTop(!!patch.alwaysOnTop);
    }
  }

  async function pickDirectory() {
    const dir = await window.cloudPrint.pickFolder({ defaultPath: state.settings.watchDir || boot.paths?.documents });
    if (dir) {
      updateSettings({ watchDir: dir });
      notify('文件目录已更新');
    }
  }

  function patchStack(id, patch) {
    setState((prev) => prev ? ({
      ...prev,
      stacks: prev.stacks.map((s) => s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s),
    }) : prev);
  }

  function patchFile(stackId, fileId, patch) {
    setState((prev) => prev ? ({
      ...prev,
      stacks: prev.stacks.map((s) => s.id === stackId ? ({
        ...s,
        files: (s.files || []).map((f) => f.id === fileId ? { ...f, ...patch } : f),
        updatedAt: Date.now(),
      }) : s),
    }) : prev);
  }

  function removeFile(stackId, fileId) {
    pushHistory();
    setState((prev) => prev ? ({
      ...prev,
      stacks: prev.stacks.map((s) => s.id === stackId ? ({ ...s, files: (s.files || []).filter((f) => f.id !== fileId), updatedAt: Date.now() }) : s),
    }) : prev);
    notify('文件已从堆叠移除（未删除原文件）');
  }

  function patchSchemeItem(itemId, patch) {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        schemes: prev.schemes.map((s) => s.id === prev.activeSchemeId ? ({
          ...s,
          items: s.items.map((i) => i.id === itemId ? { ...i, ...patch } : i),
        }) : s),
      };
    });
  }

  function addSchemeItem() {
    setState((prev) => {
      if (!prev) return prev;
      const scheme = prev.schemes.find((s) => s.id === prev.activeSchemeId);
      const last = scheme?.items?.[scheme.items.length - 1];
      const item = {
        id: uid('p_'), name: '新打印项目', price: last?.price || 1, unit: '面',
        color: last?.color || 'mono', paper: last?.paper || 'A4', duplex: 'simplex',
        orientation: 'auto', scale: 'fit', printer: last?.printer || choosePrinter({ color: last?.color || 'mono', paper: last?.paper || 'A4', duplex: 'simplex' }, printers) || '',
      };
      return {
        ...prev,
        schemes: prev.schemes.map((s) => s.id === prev.activeSchemeId ? ({ ...s, items: [...s.items, item] }) : s),
        slots: prev.slots.includes(item.id) ? prev.slots : [...prev.slots, item.id].slice(0, 12),
      };
    });
  }

  function reorderSchemeItems(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setState((prev) => {
      if (!prev) return prev;
      const scheme = prev.schemes.find((x) => x.id === prev.activeSchemeId);
      if (!scheme) return prev;
      const from = scheme.items.findIndex((i) => i.id === fromId);
      const to = scheme.items.findIndex((i) => i.id === toId);
      if (from < 0 || to < 0) return prev;
      const items = scheme.items.slice();
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return {
        ...prev,
        schemes: prev.schemes.map((x) => x.id === scheme.id ? ({ ...x, items }) : x),
        slots: items.slice(0, 12).map((i) => i.id),
      };
    });
  }

  function duplicateSchemeItem(itemId) {
    setState((prev) => {
      if (!prev) return prev;
      const scheme = prev.schemes.find((s) => s.id === prev.activeSchemeId);
      const idx = scheme?.items?.findIndex((i) => i.id === itemId) ?? -1;
      if (idx < 0) return prev;
      const item = { ...scheme.items[idx], id: uid('p_'), name: `${scheme.items[idx].name} 副本` };
      const itemsNext = scheme.items.slice();
      itemsNext.splice(idx + 1, 0, item);
      return {
        ...prev,
        schemes: prev.schemes.map((s) => s.id === prev.activeSchemeId ? ({ ...s, items: itemsNext }) : s),
      };
    });
  }

  function deleteSchemeItem(itemId) {
    setState((prev) => {
      if (!prev) return prev;
      const scheme = prev.schemes.find((s) => s.id === prev.activeSchemeId);
      if (!scheme || scheme.items.length <= 1) return prev;
      return {
        ...prev,
        schemes: prev.schemes.map((s) => s.id === prev.activeSchemeId ? ({ ...s, items: s.items.filter((i) => i.id !== itemId) }) : s),
        slots: prev.slots.filter((id) => id !== itemId),
      };
    });
  }

  function renameScheme(name) {
    if (!name) return;
    setState((prev) => prev ? ({ ...prev, schemes: prev.schemes.map((s) => s.id === prev.activeSchemeId ? { ...s, name } : s) }) : prev);
  }

  function newScheme() {
    setState((prev) => {
      if (!prev) return prev;
      const current = prev.schemes.find((s) => s.id === prev.activeSchemeId);
      const scheme = { id: uid('sc_'), name: `${current?.name || '默认'} ${prev.schemes.length + 1}`, items: (current?.items || []).map((i) => ({ ...i, id: uid('p_') })) };
      return { ...prev, schemes: [...prev.schemes, scheme], activeSchemeId: scheme.id, slots: scheme.items.slice(0, 12).map((i) => i.id) };
    });
    notify('已新建价格方案');
  }

  function deleteScheme() {
    setState((prev) => {
      if (!prev || prev.schemes.length <= 1) return prev;
      const rest = prev.schemes.filter((s) => s.id !== prev.activeSchemeId);
      return { ...prev, schemes: rest, activeSchemeId: rest[0].id, slots: rest[0].items.slice(0, 12).map((i) => i.id) };
    });
  }

  function switchScheme(id) {
    setState((prev) => {
      if (!prev) return prev;
      const scheme = prev.schemes.find((s) => s.id === id);
      if (!scheme) return prev;
      return { ...prev, activeSchemeId: id, slots: scheme.items.slice(0, 12).map((i) => i.id) };
    });
  }

  function importConfig(data) {
    const schemes = Array.isArray(data.schemes) && data.schemes.length ? data.schemes : data.scheme ? [data.scheme] : null;
    if (!schemes) throw new Error('配置中没有价格方案');
    const active = schemes[0];
    setState((prev) => prev ? ({ ...prev, schemes, activeSchemeId: active.id, slots: (data.slots || active.items.slice(0, 12).map((i) => i.id)).slice(0, 12) }) : prev);
    notify('打印配置已导入');
  }

  async function printFiles(files, item, opts = {}, targetStack = null) {
    if (!files?.length) return notify('请先选择文件', 'warn');
    if (!item) return notify('没有可用的打印配置', 'error');
    const check = validateItem(item, printers);
    if (!check.ok) return notify(check.error, 'error');
    if (check.unknown) notify('未能读取打印机驱动能力，将按当前配置发送；如打印异常请检查驱动。', 'warn');
    if (printing) return;
    const copies = Math.max(1, Math.min(99, Number(opts.copies) || 1));
    const jobId = uid('t_');
    pushHistory();
    const task = {
      id: jobId, kind: 'print', stackId: targetStack?.id || '', title: targetStack?.title || '快捷打印',
      customer: targetStack?.customer || state.quick.customer || '散客',
      files: files.map((f) => f.name), state: 'rendering', createdAt: Date.now(),
      pages: files.reduce((s, f) => s + (f.pages || 1), 0), amount: 0, printer: item.printer || defaultPrinter?.displayName || '系统默认',
      itemName: item.name,
    };
    setState((prev) => prev ? ({ ...prev, tasks: [task, ...prev.tasks].slice(0, 120) }) : prev);
    setPrinting({ stage: 'render', percent: 2, title: '正在准备打印', detail: `${files.length} 个文件 · ${copies} 份`, jobId });
    try {
      const prepared = await preparePrint(files, item, {
        copies, pageRange: opts.pageRange || '', skipBlank: !!opts.skipBlank, dpi: state.settings.pdfDpi || 300,
        onProgress: (p) => setPrinting((prev) => prev ? ({
          ...prev, ...p, title: '正在准备打印',
          detail: p.name ? `${p.name} · ${p.page || 0}/${p.pageTotal || 0} 页` : prev.detail,
        }) : prev),
      });
      const amount = Math.round(amountForPages(prepared.pages, item) * copies * 100) / 100;
      const coverage = prepared.coverage || 0;
      setPrinting((prev) => prev ? ({ ...prev, stage: 'spooling', percent: 80, title: '正在发送到打印机', detail: `${task.printer} · 覆盖率 ${(coverage * 100).toFixed(1)}%` }) : prev);
      const result = await executePrint({
        html: prepared.html, images: prepared.images, orientations: prepared.orientations, item, copies, paper: prepared.paper, landscape: prepared.landscape,
        simulate: state.settings.simulatePrint || boot.simulate, jobId,
        onProgress: (p) => setPrinting((prev) => prev ? ({ ...prev, ...p }) : prev),
      });
      if (result?.canceled) { setPrinting(null); return; }
      if (!result?.ok) throw new Error(result?.error || '打印失败');
      const now = Date.now();
      setState((prev) => {
        if (!prev) return prev;
        let quick = prev.quick;
        const stacks = prev.stacks.map((s) => {
          if (!targetStack || s.id !== targetStack.id) return s;
          const ids = new Set(files.map((f) => f.id));
          const nextFiles = (s.files || []).map((f) => ids.has(f.id) ? ({
            ...f, printed: (Number(f.printed) || 0) + copies, lastItemId: item.id,
            lastItemName: item.name, lastPrintedAt: now,
          }) : f);
          return {
            ...s, files: nextFiles, frozenAmount: Math.round(((Number(s.frozenAmount) || 0) + amount) * 100) / 100,
            itemId: item.id, printedAt: now, updatedAt: now,
            archived: (state.settings.removeAfterPrint || state.settings.autoArchive) ? true : s.archived,
            coverage,
            payment: state.settings.autoPayment ? 'paid' : (s.payment === 'paid' ? 'paid' : 'unpaid'),
            printedPrinter: result.printer || item.printer || '',
          };
        });
        if (!targetStack) {
          quick = {
            ...prev.quick,
            amount: Math.round(((prev.quick.amount || 0) + amount) * 100) / 100,
            count: (prev.quick.count || 0) + files.length,
            printedAt: now,
            items: [...(prev.quick.items || []), ...files.map((f) => ({ name: f.name, pages: f.pages || 1 }))].slice(-30),
          };
        }
        let payments = prev.payments;
        if (targetStack && state.settings.autoPayment) {
          payments = [{ id: uid('pay_'), type: 'payment', amount, stackId: targetStack.id, stackTitle: targetStack.title, note: '会员自动收款', time: now }, ...payments];
        }
        const tasks = prev.tasks.map((t) => t.id === jobId ? ({
          ...t, state: 'done', completedAt: now, amount, pages: prepared.pages, coverage,
          printer: result.printer || t.printer, simulated: !!result.simulated,
        }) : t);
        return { ...prev, stacks, tasks, quick, payments };
      });
      playTone('ok');
      if (targetStack) syncErpOrder({ ...targetStack, printedAt: now, frozenAmount: (Number(targetStack.frozenAmount) || 0) + amount, payment: state.settings.autoPayment ? 'paid' : (targetStack.payment === 'paid' ? 'paid' : 'unpaid') }, item, amount);
      if (result.virtual) notify(`检查 PDF 已保存：${result.pdfPath}`, 'success');
      else notify(`已发送 ${prepared.pages} 页 · 覆盖率 ${(coverage * 100).toFixed(1)}%`, 'success');
      setPrinting((prev) => prev ? ({ ...prev, stage: 'done', percent: 100, title: '打印任务已提交', detail: result.simulated ? '模拟打印完成' : '系统打印队列已接收' }) : prev);
      setTimeout(() => setPrinting(null), 900);
      if (targetStack && state.settings.splitReminder) {
        const hours = Math.max(1, Number(state.settings.splitHours) || 12);
        const similar = state.stacks.filter((st) => st.id !== targetStack.id && st.customer && st.customer === targetStack.customer && now - (st.printedAt || st.updatedAt || 0) < hours * 3600 * 1000);
        if (similar.length) notify(`客户「${targetStack.customer}」在 ${hours} 小时内还有 ${similar.length} 个已打印堆叠，可考虑合并收款。`, 'warn');
      }
      if (targetStack && state.settings.autoLabel) {
        setTimeout(() => printLabel({ ...targetStack, frozenAmount: (Number(targetStack.frozenAmount) || 0) + amount, printedAt: now }, { silent: true }), 700);
      }
      if (targetStack && state.settings.deleteAfterScan && targetStack.source === 'receive') {
        const ids = new Set(files.map((f) => f.id));
        setTimeout(async () => {
          for (const file of files) { try { await window.cloudPrint.trashFile(file.path); } catch { /* ignore */ } }
          setState((prev) => prev ? ({
            ...prev,
            stacks: prev.stacks.map((s) => s.id === targetStack.id ? ({ ...s, files: (s.files || []).filter((f) => !ids.has(f.id)) }) : s),
          }) : prev);
          notify('接收件已移入回收站');
        }, 500);
      }
    } catch (err) {
      setState((prev) => prev ? ({
        ...prev,
        tasks: prev.tasks.map((t) => t.id === jobId ? { ...t, state: 'failed', error: err.message || String(err), completedAt: Date.now() } : t),
      }) : prev);
      playTone('error');
      notify(err.message || String(err), 'error');
      setPrinting(null);
    }
  }

  async function printSheets(payload) {
    if (!imposition || !payload?.sheets?.length) return;
    const target = state.stacks.find((s) => s.id === imposition.stackId);
    const item = items.find((i) => i.id === (target?.itemId || imposition.itemId)) || items[0];
    if (!item) return notify('没有可用的打印配置', 'error');
    const check = validateItem(item, printers);
    if (!check.ok) return notify(check.error, 'error');
    const jobId = uid('t_');
    const amount = Math.round(payload.sheets.length * (Number(item.price) || 0) * 100) / 100;
    const task = {
      id: jobId, kind: 'impose', stackId: target?.id || '', title: target?.title || '拼版打印',
      customer: target?.customer || '散客', files: (imposition.files || []).map((f) => f.name),
      state: 'rendering', createdAt: Date.now(), pages: payload.sheets.length, amount,
      printer: item.printer || defaultPrinter?.displayName || '系统默认', itemName: item.name,
      coverage: payload.coverage || 0,
    };
    pushHistory();
    setState((prev) => prev ? ({ ...prev, tasks: [task, ...prev.tasks].slice(0, 120) }) : prev);
    setPrinting({
      stage: 'render', percent: 60, title: '正在准备拼版打印',
      detail: `${payload.sheets.length} 张成品页 · 覆盖率 ${((payload.coverage || 0) * 100).toFixed(1)}%`,
      jobId,
    });
    try {
      const printItem = { ...item, duplex: payload.mode === 'booklet' ? 'longEdge' : 'simplex' };
      const html = sheetsToHtml(payload.sheets, payload.paper, payload.landscape);
      const result = await executePrint({
        html, images: payload.sheets.map((s) => s.dataUrl), orientations: payload.sheets.map((s) => (s.width || 0) > (s.height || 0)), item: printItem, copies: 1, paper: payload.paper, landscape: payload.landscape,
        simulate: state.settings.simulatePrint || boot.simulate, jobId,
      });
      if (result?.canceled) { setPrinting(null); return; }
      if (!result?.ok) throw new Error(result?.error || '打印失败');
      const now = Date.now();
      setState((prev) => {
        if (!prev) return prev;
        const ids = new Set((imposition.files || []).map((f) => f.id));
        const stacks = prev.stacks.map((st) => {
          if (!target || st.id !== target.id) return st;
          return {
            ...st,
            files: (st.files || []).map((f) => ids.has(f.id) ? ({ ...f, printed: (Number(f.printed) || 0) + 1, lastItemId: item.id, lastItemName: item.name, lastPrintedAt: now }) : f),
            frozenAmount: Math.round(((Number(st.frozenAmount) || 0) + amount) * 100) / 100,
            printedAt: now, updatedAt: now, itemId: item.id,
            payment: state.settings.autoPayment ? 'paid' : (st.payment === 'paid' ? 'paid' : 'unpaid'),
          };
        });
        return {
          ...prev, stacks,
          tasks: prev.tasks.map((t) => t.id === jobId ? ({ ...t, state: 'done', completedAt: now, amount, printer: result.printer || t.printer, simulated: !!result.simulated }) : t),
        };
      });
      setImposition(null);
      if (result.virtual) notify(`检查 PDF 已保存：${result.pdfPath}`, 'success');
      notify(`拼版打印已发送 ${payload.sheets.length} 页 · 覆盖率 ${((payload.coverage || 0) * 100).toFixed(1)}%`, 'success');
      setPrinting((prev) => prev ? ({ ...prev, stage: 'done', percent: 100, title: '拼版打印已提交' }) : prev);
      setTimeout(() => setPrinting(null), 900);
    } catch (err) {
      setState((prev) => prev ? ({ ...prev, tasks: prev.tasks.map((t) => t.id === jobId ? { ...t, state: 'failed', error: err.message } : t) }) : prev);
      notify(err.message || '拼版打印失败', 'error');
      setPrinting(null);
    }
  }

  async function printLabel(target, { silent = false, test = false } = {}) {
    let stack = target;
    if (test || !stack) {
      if (test) {
        stack = {
          id: 'test_label', title: '标签测试', customer: '示例客户', files: [{ id: 'x', name: '示例文件.pdf', pages: 1, size: 0 }],
          frozenAmount: 2, payment: 'unpaid', printedAt: Date.now(),
        };
      } else if (state?.quick) {
        const q = state.quick;
        if (!q.amount) return notify('当前没有可打印的快捷订单', 'warn');
        stack = {
          id: uid('quick_'), title: '快捷打印', customer: q.customer || '散客',
          files: (q.items || []).map((x, i) => ({ id: `q_${i}`, name: x.name, pages: x.pages || 1, size: 0 })),
          frozenAmount: q.amount, payment: 'unpaid', printedAt: Date.now(),
        };
        if (!stack.files.length) stack.files = [{ id: 'q', name: '快捷打印文件', pages: 1, size: 0 }];
      } else return;
    }
    const labelCheck = validateLabelPaper(printers, state.settings.labelPrinter, state.settings.labelPaper, state.settings.labelWidth, state.settings.labelHeight);
    if (!labelCheck.ok) return notify(labelCheck.error, 'error');
    const item = items.find((i) => i.id === stack.itemId) || items[0];
    const data = labelDataForStack(stack, item, state.settings);
    const qr = await makeQr(data, 320);
    const settings = state.settings;
    const paper = settings.labelPaper === 'auto' ? 'A4' : settings.labelPaper;
    const pageSize = paper === 'custom' ? { width: settings.labelWidth, height: settings.labelHeight } : paper;
    const html = labelPageHtml(data, qr, { ...settings, labelPaper: paper }, settings.labelPosition);
    const jobId = uid('t_');
    const task = {
      id: jobId, kind: 'label', title: stack.title, customer: stack.customer, files: ['取件标签'],
      state: 'printing', createdAt: Date.now(), pages: 0, amount: 0,
      printer: settings.labelPrinter || defaultPrinter?.displayName || '系统默认',
    };
    setState((prev) => prev ? ({ ...prev, tasks: [task, ...prev.tasks].slice(0, 120) }) : prev);
    const result = await window.cloudPrint.printHtml({
      html, jobId, deviceName: settings.labelPrinter || '', color: false, copies: 1,
      item: { paper, duplex: 'simplex', printer: settings.labelPrinter || '' },
      pageSize, landscape: settings.labelOrientation === 'landscape',
      simulate: settings.simulatePrint || boot.simulate,
    });
    setState((prev) => prev ? ({
      ...prev,
      tasks: prev.tasks.map((t) => t.id === jobId ? ({ ...t, state: result.ok ? 'done' : 'failed', completedAt: Date.now(), error: result.error }) : t),
      quick: (!test && stack.id.startsWith('quick_')) ? { ...prev.quick, amount: 0, count: 0, items: [] } : prev.quick,
    }) : prev);
    if (result.ok) {
      if (!silent) notify('取件标签已发送到打印机', 'success');
    } else {
      notify(result.error || '标签打印失败', 'error');
    }
  }

  function syncErpOrder(stack, item, amount, payment) {
    if (!state.settings.erpEnabled || !state.settings.erpEndpoint) return;
    const erp = createErpAdapter(state.settings);
    erp.pushOrder({
      id: stack.id, title: stack.title, customer: stack.customer || '散客',
      pages: stackPages(stack), amount, payment: payment || stack.payment,
      printedAt: stack.printedAt || Date.now(), item: item?.name || '',
      files: (stack.files || []).map((f) => ({ name: f.name, pages: f.pages || 1, copies: f.printed || 0 })),
    }).then((res) => { if (!res.ok && !res.skipped) notify(`ERP 同步失败：${res.error || res.status || '接口错误'}`, 'warn'); });
  }

  function syncErpPayment(payment) {
    if (!state.settings.erpEnabled || !state.settings.erpEndpoint || !state.settings.erpAutoSync) return;
    createErpAdapter(state.settings).pushPayment(payment).then((res) => { if (!res.ok && !res.skipped) notify(`ERP 流水同步失败：${res.error || res.status || '接口错误'}`, 'warn'); });
  }

  function markPaid(stack) {
    if (!stack) return;
    if (stack.payment === 'paid') return notify('该订单已付款', 'warn');
    const amount = Number(stack.frozenAmount) || 0;
    pushHistory();
    const now = Date.now();
    setState((prev) => prev ? ({
      ...prev,
      stacks: prev.stacks.map((s) => s.id === stack.id ? { ...s, payment: 'paid', paidAt: now, updatedAt: now } : s),
      payments: [{ id: uid('pay_'), type: 'payment', amount, stackId: stack.id, stackTitle: stack.title, note: '订单收款', time: now }, ...prev.payments],
      quick: prev.quick,
    }) : prev);
    syncErpPayment({ id: 'payment', type: 'payment', amount, stackId: stack.id, stackTitle: stack.title, note: '订单收款', time: now });
    notify(`已收款 ${money(amount)}`, 'success');
  }

  function savePayment({ type, amount, stackId, note }) {
    pushHistory();
    const now = Date.now();
    const stack = state.stacks.find((s) => s.id === stackId);
    setState((prev) => prev ? ({
      ...prev,
      payments: [{ id: uid('pay_'), type, amount, stackId, stackTitle: stack?.title || '', note, time: now }, ...prev.payments],
      stacks: stackId ? prev.stacks.map((s) => {
        if (s.id !== stackId) return s;
        if (type === 'payment') return { ...s, payment: 'paid', paidAt: now, updatedAt: now };
        if (type === 'refund') return { ...s, payment: 'unpaid', paidAt: 0, updatedAt: now };
        return s;
      }) : prev.stacks,
    }) : prev);
    syncErpPayment({ id: 'payment', type, amount, stackId, note, time: now });
    setDialog(null);
    setPaymentInitial(null);
    notify('收款记录已登记', 'success');
  }

  function archiveStack(id, withLabel = false) {
    const stack = state.stacks.find((s) => s.id === id);
    if (!stack) return;
    pushHistory();
    const cleanup = !!stack.cleanupPrinted;
    const nextFiles = cleanup ? (stack.files || []).filter((f) => !Number(f.printed)) : stack.files;
    setState((prev) => prev ? ({
      ...prev,
      stacks: prev.stacks.map((s) => s.id === id ? ({ ...s, archived: true, files: nextFiles, updatedAt: Date.now() }) : s),
    }) : prev);
    setDetailId(null);
    notify(cleanup ? '堆叠已归档，已清理打印完成的文件记录' : (withLabel ? '堆叠已关闭，正在打印标签…' : '堆叠已归档'));
    if (withLabel) printLabel(stack);
  }

  function closeSelected(withLabel) {
    if (!selectedStack) return;
    archiveStack(selectedStack.id, withLabel);
  }

  function requestDelete(stack) {
    setConfirmState({
      title: '删除堆叠？',
      message: `将从列表移除「${stack.title}」及其 ${stack.files?.length || 0} 个文件记录。原文件不会被删除，可 Ctrl+Z 撤销。`,
      danger: true,
      confirmText: '删除堆叠',
      onConfirm: () => {
        pushHistory();
        setState((prev) => prev ? ({ ...prev, stacks: prev.stacks.filter((s) => s.id !== stack.id) }) : prev);
        if (selectedStackId === stack.id) setSelectedStackId(null);
        if (detailId === stack.id) setDetailId(null);
        notify('堆叠已删除，原文件仍保留');
      },
    });
  }

  function printSelectedStack() {
    if (!selectedStack) return notify('请先选择一个堆叠', 'warn');
    if (!selectedStack.files?.length) return notify('这个堆叠还没有文件', 'warn');
    const item = items.find((i) => i.id === selectedStack.itemId) || items[0];
    printFiles(selectedStack.files, item, { copies: 1, skipBlank: selectedStack.skipBlank }, selectedStack);
  }

  function onContextMenu(e, id) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedStackId(id);
    const w = 210;
    const h = 292;
    setCtx({ x: Math.min(e.clientX, window.innerWidth - w - 8), y: Math.min(e.clientY, window.innerHeight - h - 8), stackId: id });
  }

  function contextAction(action, stack) {
    if (action === 'member') {
      setCustomerPrompt({ stackId: stack.id, value: stack.customer === '散客' ? '' : stack.customer });
    } else if (action === 'orders') {
      setDialog('stats');
    } else if (action === 'label') {
      printLabel(stack);
    } else if (action === 'print') {
      const item = items.find((i) => i.id === stack.itemId) || items[0];
      printFiles(stack.files, item, { copies: 1, skipBlank: stack.skipBlank }, stack);
    } else if (action === 'paid') {
      markPaid(stack);
    } else if (action === 'archive') {
      if (stack.archived) patchStack(stack.id, { archived: false });
      else archiveStack(stack.id, false);
    } else if (action === 'delete') {
      requestDelete(stack);
    }
  }

  async function handleQuickDrop(fileList, item) {
    const paths = Array.from(fileList || []).map((f) => window.cloudPrint.getPathForFile(f)).filter(Boolean);
    if (!paths.length) return;
    const infos = await window.cloudPrint.statFiles(paths);
    if (!infos.length) return notify('不支持的文件格式', 'error');
    hydratePages(infos);
    printFiles(infos, item, { copies: state.quick.copies || 1, skipBlank: false }, null);
  }

  function updateQuick(patch) {
    setState((prev) => prev ? ({ ...prev, quick: { ...prev.quick, ...patch } }) : prev);
  }

  function openRecover() {
    setPaymentInitial({ type: 'charge', amount: '', stackId: '', note: '' });
    setDialog('payment');
  }

  const countByStatus = useMemo(() => {
    const active = (state?.stacks || []).filter((s) => !s.archived);
    return {
      unprinted: active.filter((s) => stackPrintState(s) === 'unprinted').length,
      printed: active.filter((s) => ['printed', 'partial'].includes(stackPrintState(s))).length,
      unpaid: active.filter((s) => stackPayState(s) === 'unpaid').length,
      paid: active.filter((s) => stackPayState(s) === 'paid').length,
    };
  }, [state?.stacks]);

  const visibleStacks = useMemo(() => {
    if (!state) return [];
    const now = Date.now();
    let list = state.stacks.filter((s) => {
      if (scope === 'active' && s.archived) return false;
      if (scope === 'archived' && !s.archived) return false;
      if (RANGE_MS[range] && now - (s.updatedAt || s.createdAt) > RANGE_MS[range]) return false;
      if (range === 'today') {
        const d = new Date(s.updatedAt || s.createdAt); d.setHours(0, 0, 0, 0);
        if (d.getTime() !== new Date().setHours(0, 0, 0, 0)) return false;
      }
      if (!matchesSearch(s, search)) return false;
      if (filter === 'unprinted' && stackPrintState(s) !== 'unprinted') return false;
      if (filter === 'printed' && !['printed', 'partial'].includes(stackPrintState(s))) return false;
      if (filter === 'unpaid' && stackPayState(s) !== 'unpaid') return false;
      if (filter === 'paid' && stackPayState(s) !== 'paid') return false;
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sort === 'size') return stackSize(b) - stackSize(a);
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
    return list;
  }, [state?.stacks, scope, range, search, filter, sort]);

  if (boot.loading) {
    return (
      <div className="app-boot">
        <Logo size={76} />
        <h1>墨印</h1>
        <p>正在准备打印工作台…</p>
        <Spinner size={20} />
      </div>
    );
  }
  if (boot.error || !state) {
    return (
      <div className="app-boot error">
        <h1>启动失败</h1>
        <p>{boot.error || '无法读取本机配置'}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>重试</button>
      </div>
    );
  }

  const quick = state.quick;
  const itemForCard = (stack) => items.find((i) => i.id === stack.itemId) || items[0];

  return (
    <div className="app-shell">
      <TitleBar version={boot.version} />
      <Header
        search={search} setSearch={setSearch} watchDir={state.settings.watchDir} onPickDirectory={pickDirectory}
        onOpenPrintSettings={() => setDialog('print')} onOpenLabelSettings={() => setDialog('label')}
        alwaysOnTop={state.settings.alwaysOnTop} onToggleAlwaysOnTop={(v) => updateSettings({ alwaysOnTop: v })}
        onOpenReceive={() => setDialog('receive')} receiveRunning={receive.running || state.settings.receiveEnabled}
        version={boot.version}
      />

      <main className="main-content">
        <Toolbar
          filter={filter} setFilter={setFilter} countByStatus={countByStatus} sort={sort} setSort={setSort}
          range={range} setRange={setRange} scope={scope} setScope={setScope}
          onNewStack={() => setDialog('newStack')} onOpenStats={() => setDialog('stats')}
          onOpenQueue={() => setQueueOpen(true)} onOpenRecover={openRecover}
          quickOpen={quickOpen} setQuickOpen={setQuickOpen} quickDetached={quickDetached}
          onToggleQuick={() => {
            if (quickDetached) window.cloudPrint.closeQuickWindow();
            else setQuickOpen((v) => !v);
          }}
          onPrintSelected={printSelectedStack}
        />

        <div className="workspace">
          <section
            className="stacks-area"
            aria-label="文件堆叠列表"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={async (e) => {
              e.preventDefault();
              const fileList = e.dataTransfer.files;
              if (!fileList?.length) return;
              const paths = Array.from(fileList).map((f) => window.cloudPrint.getPathForFile(f)).filter(Boolean);
              if (!paths.length) return;
              await addPaths(paths, selectedStackId || null);
            }}
          >
            <div className="stacks-status">
              <span>
                {state.settings.watchDir
                  ? <>文件目录：<b>{state.settings.watchDir}</b> · 新文件自动整理</>
                  : '数据自动保存在本机，拖入文件即可开始。'}
              </span>
              <span className="stacks-status-right">{visibleStacks.length} 个堆叠 · v{boot.version}</span>
            </div>

            {visibleStacks.length ? (
              <div className="stack-grid">
                {visibleStacks.map((stack) => (
                  <StackCard
                    key={stack.id}
                    stack={stack}
                    active={stack.id === selectedStackId}
                    item={itemForCard(stack)}
                    onSelect={setSelectedStackId}
                    onOpen={setDetailId}
                    duplicate={!!state.settings.duplicateHighlight && !!stack.files?.[0] && (duplicateKeys.has(`p:${stack.files[0].path}`) || duplicateKeys.has(`n:${String(stack.files[0].name).toLowerCase()}`))}
                    onContextMenu={onContextMenu}
                    onDropFiles={(files, id) => {
                      const paths = Array.from(files).map((f) => window.cloudPrint.getPathForFile(f)).filter(Boolean);
                      addPaths(paths, id);
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={search ? SearchX : Layers}
                title={search ? '没有匹配的堆叠' : '还没有文件堆叠'}
                description={search ? '换个关键词，或清空搜索条件。' : '点击「新建堆叠」，或直接把 PDF、图片拖进窗口。'}
                action={!search ? <Button variant="primary" size="sm" icon={ArrowUpFromLine} onClick={() => setDialog('newStack')}>新建堆叠</Button> : null}
              />
            )}

            {quickOpen ? null : (
              <button type="button" className="quick-reopen" onClick={() => setQuickOpen(true)}>
                <Printer size={16} /> 打开快捷打印面板
              </button>
            )}
          </section>

          {quickOpen ? (
            <QuickPanel
              slots={state.slots} items={quickItems} activeScheme={activeScheme} quick={quick}
              printers={printers} onDropFiles={handleQuickDrop}
              onDropStack={(stackId, item) => {
                const stack = state.stacks.find((x) => x.id === stackId);
                if (!stack?.files?.length) return notify('这个堆叠还没有文件', 'warn');
                printFiles(stack.files, item, { copies: state.quick.copies || 1, skipBlank: !!stack.skipBlank }, stack);
              }}
              onPrintLabel={() => printLabel(null)}
              onOpenWindow={() => { window.cloudPrint.openQuickWindow(); setQuickOpen(false); }}
              onClear={() => updateQuick({ amount: 0, count: 0, items: [] })}
              onCopies={(n) => updateQuick({ copies: n })}
              onOpenSettings={() => setDialog('print')}
              onReorder={(from, to) => setState((prev) => {
                if (!prev) return prev;
                const slots = (prev.slots || []).slice();
                if (from < 0 || to < 0 || from >= slots.length || to >= slots.length) return prev;
                const [id] = slots.splice(from, 1);
                slots.splice(to, 0, id);
                return { ...prev, slots };
              })}
            />
          ) : null}
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-left">
          <span className="app-ver">v{boot.version}</span>
          <button type="button" className="footer-link" onClick={() => setDialog('about')}>关于</button>
          <button type="button" className="footer-link" onClick={() => window.cloudPrint.openExternal(GITHUB_ISSUES_URL)}>反馈</button>
        </div>
        <div className="footer-shortcuts">
          <span><kbd>Ctrl + Q</kbd> 打开最近窗口</span>
          <span><kbd>P</kbd> 打印所选</span>
          <span><kbd>Ctrl + W</kbd> 关闭并打标签</span>
          <span><kbd>Ctrl + E</kbd> 关闭且不打标签</span>
          <span><kbd>Ctrl + Z</kbd> 撤销</span>
          <span>双击堆叠查看文件</span>
          <span>右键堆叠显示更多操作</span>
          <span>拖入右侧档位即可打印</span>
        </div>
        <div className="footer-right">
          <button type="button" className="settings-gear" aria-label="设置" title="设置" onClick={() => setDialog('settings')}><SettingsIcon size={19} /></button>
        </div>
      </footer>

      {detailStack ? (
        <StackDetail
          key={detailStack.id}
          stack={detailStack} items={items} printers={printers} settings={state.settings}
          onClose={() => setDetailId(null)}
          onPrint={(files, item, opts) => printFiles(files, item, opts, detailStack)}
          onPrintLabel={(s) => printLabel(s)}
          onUpdateStack={patchStack}
          onUpdateItem={patchSchemeItem}
          onReveal={(p) => p && window.cloudPrint.revealFile(p)}
          onRemoveFile={removeFile}
          onAddFiles={async (id) => {
            const paths = await window.cloudPrint.pickFiles();
            if (paths?.length) addPaths(paths, id);
          }}
          onArchive={archiveStack}
          onOpenQueue={() => setQueueOpen(true)}
          onOpenPreferences={openPrinterPreferences}
          onDropPaths={(paths, id) => addPaths(paths, id)}
          onReorderItems={reorderSchemeItems}
          onMarkPaid={markPaid}
          onOpenImposition={(selectedFiles, mode) => setImposition({
            files: selectedFiles || detailStack.files || [],
            mode,
            stackId: detailStack.id,
            itemId: detailStack.itemId || items[0]?.id,
          })}
          notify={notify}
        />
      ) : null}

      {imposition ? (
        <ImpositionDialog
          open
          files={imposition.files}
          item={items.find((i) => i.id === (imposition.itemId || items[0]?.id)) || items[0]}
          dpi={state.settings.pdfDpi || 300}
          initialMode={imposition.mode}
          onClose={() => setImposition(null)}
          onPrint={printSheets}
          notify={notify}
        />
      ) : null}

      <PrintSettings
        open={dialog === 'print'} state={state} items={items} printers={printers}
        onClose={() => setDialog(null)}
        onUpdateItem={patchSchemeItem} onAddItem={addSchemeItem} onDeleteItem={deleteSchemeItem}
        onDuplicateItem={duplicateSchemeItem} onRenameScheme={renameScheme}
        onNewScheme={newScheme} onDeleteScheme={deleteScheme} onSwitchScheme={switchScheme}
        onImport={importConfig} onOpenPreferences={openPrinterPreferences} onUpdateSettings={updateSettings} notify={notify}
      />

      <LabelSettings
        open={dialog === 'label'} settings={state.settings} printers={printers}
        onClose={() => setDialog(null)} onChange={updateSettings}
        onPrintTest={() => printLabel(null, { test: true })} onOpenPreferences={openPrinterPreferences}
      />

      <AppSettings
        open={dialog === 'settings'} settings={state.settings} receive={receive}
        onClose={() => setDialog(null)} onChange={updateSettings}
        onPickDir={async () => {
          const dir = await window.cloudPrint.pickFolder({ defaultPath: state.settings.watchDir || boot.paths?.documents });
          if (dir) updateSettings({ watchDir: dir });
        }}
        onOpenReceive={() => setDialog('receive')} onOpenLabel={() => setDialog('label')}
        notify={notify}
      />

      <AmountStats
        open={dialog === 'stats'} state={state} items={items}
        onClose={() => setDialog(null)} onMarkPaid={markPaid}
        onAddPayment={() => { setDialog('payment'); setPaymentInitial({ type: 'charge', amount: '', stackId: '', note: '' }); }}
      />

      <NewStackDialog
        open={dialog === 'newStack'} defaultName={`堆叠${state.counters.stackSeq || 1}`}
        defaultLocation={defaultLocation || ''}
        onClose={() => setDialog(null)} onCreate={createFolderStack}
        onPickLocation={async () => {
          const dir = await window.cloudPrint.pickFolder({ defaultPath: boot.paths?.documents });
          if (dir) setDefaultLocation(dir);
          return dir;
        }}
      />

      <ReceiveDialog
        open={dialog === 'receive'} receive={receive} settings={state.settings}
        onClose={() => setDialog(null)} onRefresh={() => refreshReceive(state.settings.receivePort)}
        onToggle={(v) => updateSettings({ receiveEnabled: v })} onOpenSettings={() => setDialog('settings')}
        notify={notify}
      />

      <PaymentDialog
        open={dialog === 'payment'} stacks={state.stacks.filter((s) => !s.archived)}
        initial={paymentInitial || {}} onClose={() => { setDialog(null); setPaymentInitial(null); }}
        onSave={savePayment}
      />

      <AboutDialog open={dialog === 'about'} onClose={() => setDialog(null)} version={boot.version} />

      {customerPrompt ? (
        <Modal
          open
          onClose={() => setCustomerPrompt(null)}
          title="关联客户"
          subtitle="客户名称会显示在标签与金额统计中。"
          size="sm"
          footer={(
            <>
              <Button variant="ghost" onClick={() => setCustomerPrompt(null)}>取消</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const name = customerPrompt.value.trim();
                  if (!name) return;
                  patchStack(customerPrompt.stackId, { customer: name });
                  setCustomerPrompt(null);
                  notify('客户已关联', 'success');
                }}
              >
                保存
              </Button>
            </>
          )}
        >
          <input
            className="control input"
            autoFocus
            value={customerPrompt.value}
            onChange={(e) => setCustomerPrompt({ ...customerPrompt, value: e.target.value })}
            placeholder="输入客户名称或会员昵称"
            maxLength={40}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customerPrompt.value.trim()) {
                patchStack(customerPrompt.stackId, { customer: customerPrompt.value.trim() });
                setCustomerPrompt(null);
                notify('客户已关联', 'success');
              }
            }}
          />
        </Modal>
      ) : null}

      {queueOpen ? <div className="queue-backdrop" onClick={() => setQueueOpen(false)} /> : null}
      <PrintQueue open={queueOpen} tasks={state.tasks || []} onClose={() => setQueueOpen(false)} onRefresh={loadPrinters} />

      {ctx ? (
        <StackContextMenu
          x={ctx.x} y={ctx.y} stack={state.stacks.find((s) => s.id === ctx.stackId)}
          onClose={() => setCtx(null)} onAction={contextAction}
        />
      ) : null}

      {confirmState ? (
        <Modal open onClose={() => setConfirmState(null)} title={confirmState.title} size="sm"
          footer={(
            <>
              <Button variant="ghost" onClick={() => setConfirmState(null)}>取消</Button>
              <Button variant={confirmState.danger ? 'danger' : 'primary'} onClick={() => { confirmState.onConfirm?.(); setConfirmState(null); }}>{confirmState.confirmText || '确认'}</Button>
            </>
          )}
        >
          <p className="confirm-message">{confirmState.message}</p>
        </Modal>
      ) : null}

      {printing ? (
        <div className="print-overlay">
          <div className="print-progress-card">
            <div className="print-progress-head">
              <span className={`print-spinner ${printing.stage === 'done' ? 'done' : ''}`}>{printing.stage === 'done' ? '✓' : <Spinner size={22} />}</span>
              <div>
                <h3>{printing.title || '正在打印'}</h3>
                <p>{printing.detail || printing.name || '请稍候…'}</p>
              </div>
              {printing.stage !== 'done' ? <span className="print-percent">{Math.round(printing.percent || 0)}%</span> : null}
            </div>
            <div className="print-progress-bar"><i style={{ width: `${Math.max(3, printing.percent || 0)}%` }} /></div>
            <div className="print-progress-foot">
              <span>{printing.printer ? `打印机：${printing.printer}` : '正在读取打印机…'}</span>
              <span>{printing.stage === 'render' ? '渲染页面' : printing.stage === 'spooling' ? '提交系统队列' : printing.stage === 'done' ? '完成' : '准备中'}</span>
            </div>
          </div>
        </div>
      ) : null}

      <ToastStack toasts={toasts} onDismiss={(id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const t = toastTimers.current.get(id);
        if (t) clearTimeout(t);
      }} />
    </div>
  );
}
