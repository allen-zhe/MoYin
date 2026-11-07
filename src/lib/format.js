export function uid(prefix = '') {
  if (globalThis.crypto?.randomUUID) return `${prefix}${crypto.randomUUID()}`;
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function money(value) {
  return `¥${(Number(value) || 0).toFixed(2)}`;
}

export function shortId(id) {
  return String(id || '').replace(/^s_/, '').slice(0, 8).toUpperCase();
}

export function formatDate(ts, withTime = true) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

export function formatShortDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayStart(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.getTime();
}

export function fileExtLabel(file) {
  const ext = String(file.ext || '').toUpperCase();
  if (ext === 'JPEG') return 'JPG';
  return ext || 'FILE';
}

export function filePages(file) {
  return Math.max(1, Number(file.pages) || 1);
}

export function stackPages(stack) {
  return (stack.files || []).reduce((sum, f) => sum + filePages(f), 0);
}

export function stackSize(stack) {
  return (stack.files || []).reduce((sum, f) => sum + (Number(f.size) || 0), 0);
}

export function isPrinted(file) {
  return Number(file.printed) > 0;
}

export function stackPrintState(stack) {
  const files = stack.files || [];
  if (!files.length) return 'empty';
  const printed = files.filter(isPrinted).length;
  if (printed === 0) return 'unprinted';
  if (printed >= files.length) return 'printed';
  return 'partial';
}

export function stackPayState(stack) {
  if (stack.payment === 'paid' || stack.payment === 'collected') return 'paid';
  if (stackPrintState(stack) === 'unprinted') return 'none';
  return 'unpaid';
}

export function sheetsFor(pages, duplex) {
  const n = Math.max(0, Number(pages) || 0);
  return duplex && duplex !== 'simplex' ? Math.ceil(n / 2) : n;
}

export function amountForPages(pages, item) {
  const sheets = sheetsFor(pages, item?.duplex);
  return Math.round(sheets * (Number(item?.price) || 0) * 100) / 100;
}

export function stackAmount(stack, item) {
  if (typeof stack.frozenAmount === 'number') return stack.frozenAmount;
  return amountForPages(stackPages(stack), item);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function matchesSearch(stack, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (String(stack.title || '').toLowerCase().includes(q)) return true;
  if (String(stack.customer || '').toLowerCase().includes(q)) return true;
  return (stack.files || []).some((f) => String(f.name || '').toLowerCase().includes(q));
}

export function statusLabel(value) {
  return {
    unprinted: '未打印',
    printed: '已打印',
    partial: '部分打印',
    unpaid: '待收款',
    paid: '已收款',
    empty: '空堆叠',
  }[value] || '未打印';
}

export function parsePageRange(range, total) {
  if (!range || !String(range).trim()) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set();
  for (const part of String(range).split(',')) {
    const token = part.trim();
    const m = token.match(/^(\d+)\s*[-~]\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, Number(m[1]));
      const b = Math.min(total, Number(m[2]));
      for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) pages.add(i);
    } else if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n >= 1 && n <= total) pages.add(n);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export function playTone(kind = 'ok') {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = kind === 'error' ? 220 : 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.start(); osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch { /* ignore */ }
}
