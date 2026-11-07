'use strict';

const DEFAULT_SCHEME_ITEMS = [
  { id: 'p01', name: 'A4黑白单面', price: 1, unit: '面', color: 'mono', paper: 'A4', duplex: 'simplex', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p02', name: 'A4彩色单面', price: 2, unit: '面', color: 'color', paper: 'A4', duplex: 'simplex', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p03', name: 'A4黑白双面短翻', price: 2, unit: '面', color: 'mono', paper: 'A4', duplex: 'shortEdge', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p04', name: 'A4黑白双面长翻', price: 2, unit: '面', color: 'mono', paper: 'A4', duplex: 'longEdge', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p05', name: 'A4彩色双面短翻', price: 4, unit: '面', color: 'color', paper: 'A4', duplex: 'shortEdge', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p06', name: 'A4彩色双面长翻', price: 4, unit: '面', color: 'color', paper: 'A4', duplex: 'longEdge', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p07', name: 'A3黑白单面', price: 2, unit: '面', color: 'mono', paper: 'A3', duplex: 'simplex', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p08', name: 'A3彩色单面', price: 4, unit: '面', color: 'color', paper: 'A3', duplex: 'simplex', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p09', name: 'A3黑白双面短翻', price: 4, unit: '面', color: 'mono', paper: 'A3', duplex: 'shortEdge', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p10', name: 'A3黑白双面长翻', price: 4, unit: '面', color: 'mono', paper: 'A3', duplex: 'longEdge', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p11', name: 'A3彩色双面短翻', price: 8, unit: '面', color: 'color', paper: 'A3', duplex: 'shortEdge', orientation: 'auto', scale: 'fit', printer: '' },
  { id: 'p12', name: 'A3彩色双面长翻', price: 8, unit: '面', color: 'color', paper: 'A3', duplex: 'longEdge', orientation: 'auto', scale: 'fit', printer: '' },
];

function createDefaultState() {
  return {
    version: 2,
    settings: {
      autoArchive: false,
      autoLabel: false,
      autoPayment: false,
      removeAfterPrint: false,
      deleteAfterScan: false,
      splitReminder: true,
      splitHours: 12,
      duplicateHighlight: true,
      shortcuts: true,
      autoStart: false,
      watchDir: '',
      erpEnabled: false,
      erpEndpoint: '',
      erpToken: '',
      erpAutoSync: false,
      printerIndexes: {},
      printColumnWidths: null,
      pdfDpi: 300,
      printerAssignVersion: 0,
      printTableWidth: 1860,
      receiveEnabled: true,
      receivePort: 18666,
      alwaysOnTop: false,
      simulatePrint: false,
      labelPrinter: '',
      labelPaper: 'A4',
      labelOrientation: 'portrait',
      labelWidth: 210,
      labelHeight: 297,
      labelScale: 1,
      labelPosition: 'center',
      labelShopName: '墨印',
      labelFooter: '扫码查看订单 · 凭单取件',
    },
    schemes: [
      {
        id: 'default',
        name: '默认打印价格',
        items: DEFAULT_SCHEME_ITEMS.map((item) => ({ ...item })),
      },
    ],
    activeSchemeId: 'default',
    slots: DEFAULT_SCHEME_ITEMS.map((item) => item.id),
    stacks: [],
    payments: [],
    tasks: [],
    counters: { serial: 1, stackSeq: 1, totalRevenue: 0 },
    quick: {
      customer: '散客',
      amount: 0,
      copies: 1,
      count: 0,
      printedAt: 0,
    },
    recentStackIds: [],
    selectedStackId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function normalizeState(input) {
  const base = createDefaultState();
  if (!input || typeof input !== 'object') return base;
  const state = {
    ...base,
    ...input,
    settings: { ...base.settings, ...(input.settings || {}) },
    counters: { ...base.counters, ...(input.counters || {}) },
    quick: { ...base.quick, ...(input.quick || {}) },
  };
  state.schemes = Array.isArray(input.schemes) && input.schemes.length ? input.schemes : base.schemes;
  state.stacks = Array.isArray(input.stacks) ? input.stacks : [];
  state.payments = Array.isArray(input.payments) ? input.payments : [];
  state.tasks = Array.isArray(input.tasks) ? input.tasks.slice(0, 120) : [];
  state.slots = Array.isArray(input.slots) && input.slots.length === 12 ? input.slots : base.slots;
  state.recentStackIds = Array.isArray(input.recentStackIds) ? input.recentStackIds.slice(0, 12) : [];
  return state;
}

module.exports = { createDefaultState, normalizeState, DEFAULT_SCHEME_ITEMS };
