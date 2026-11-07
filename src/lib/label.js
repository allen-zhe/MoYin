import QRCode from 'qrcode';
import { formatDate, money, shortId, stackPages, stackAmount } from './format.js';

export function labelDataForStack(stack, item, settings) {
  const pages = stackPages(stack);
  const amount = stackAmount(stack, item);
  return {
    id: stack.id,
    short: shortId(stack.id),
    title: stack.title || '未命名堆叠',
    customer: stack.customer || '散客',
    pages,
    files: (stack.files || []).slice(0, 4).map((f) => f.name),
    fileCount: (stack.files || []).length,
    amount,
    paid: stack.payment === 'paid' || stack.payment === 'collected',
    createdAt: stack.createdAt || Date.now(),
    printedAt: stack.printedAt || Date.now(),
    shop: settings?.labelShopName || '墨印',
    printerIndex: settings?.printerIndexes?.[settings?.labelPrinter || ''] || '',
    footer: settings?.labelFooter || '扫码查看订单 · 凭单取件',
  };
}

export async function makeQr(data, size = 240) {
  const text = [
    '墨印',
    `订单:${data.short}`,
    `客户:${data.customer}`,
    `页数:${data.pages}`,
    `金额:${money(data.amount)}`,
    `时间:${formatDate(data.printedAt)}`,
  ].join('\n');
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#173d26', light: '#ffffff' },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function labelInnerHtml(data, qr) {
  const files = data.files.map((f) => `<div class="lf">${escapeHtml(f)}</div>`).join('');
  return `<div class="label-card">
  <div class="lhead">
    <div class="llogo">墨</div>
    <div class="lshop"><b>${escapeHtml(data.shop)}</b><span>取件标签 · ORDER</span></div>
    <div class="lpaid ${data.paid ? 'ok' : ''}">${data.paid ? '已收款' : '待收款'}</div>
  </div>
  <div class="lbody">
    <div class="lleft">
      <div class="lno">${data.short}</div>
      <div class="lmeta"><span>客户</span><b>${escapeHtml(data.customer)}</b></div>
      <div class="lmeta"><span>页数</span><b>${data.pages} 页</b></div>
      <div class="lmeta"><span>时间</span><b>${formatDate(data.printedAt)}</b></div>
      <div class="lfiles">${files}${data.fileCount > 4 ? `<div class="lf more">等 ${data.fileCount} 个文件</div>` : ''}</div>
    </div>
    <div class="lright">
      <img class="lqr" src="${qr}" alt="二维码">
      ${data.printerIndex ? `<div class="lprinter">#${data.printerIndex}</div>` : ''}
      <div class="lamount">${money(data.amount)}</div>
    </div>
  </div>
  <div class="lfoot"><span>${escapeHtml(data.footer)}</span><span>${escapeHtml(data.title)}</span></div>
</div>`;
}

export function labelPageHtml(data, qr, settings, position) {
  const paper = String(settings.labelPaper || 'A4').toUpperCase();
  const dims = paper === 'A3' ? [297, 420] : paper === 'A5' ? [148, 210] : [Number(settings.labelWidth) || 210, Number(settings.labelHeight) || 297];
  const landscape = settings.labelOrientation === 'landscape';
  const size = landscape ? [dims[1], dims[0]] : dims;
  const scale = Number(settings.labelScale) || 1;
  const pos = position || settings.labelPosition || 'center';
  const [v, h] = pos.includes('-') ? pos.split('-') : pos === 'center' ? ['center', 'center'] : [pos, 'center'];
  const vMap = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
  const hMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:${size[0]}mm ${size[1]}mm;margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;width:${size[0]}mm;height:${size[1]}mm}
  .sheet{width:${size[0]}mm;height:${size[1]}mm;display:flex;align-items:${vMap[v] || 'center'};justify-content:${hMap[h] || 'center'};padding:6mm;overflow:hidden}
  .wrap{transform:scale(${scale});transform-origin:${h === 'left' ? 'left' : h === 'right' ? 'right' : 'center'} ${v === 'top' ? 'top' : v === 'bottom' ? 'bottom' : 'center'}}
  ${labelCss()}
  </style></head><body><div class="sheet"><div class="wrap">${labelInnerHtml(data, qr)}</div></div></body></html>`;
}

export function labelCss() {
  return `
  .label-card{width:92mm;height:58mm;background:#fff;border:0.35mm solid #1f5a35;border-radius:2.6mm;padding:3.2mm 3.6mm 2.4mm;font-family:"Microsoft YaHei",sans-serif;color:#1c241e;display:flex;flex-direction:column;position:relative;overflow:hidden}
  .label-card:before{content:"";position:absolute;right:-12mm;top:-16mm;width:34mm;height:34mm;border-radius:50%;background:#eef7ea}
  .lhead{display:flex;align-items:center;gap:2.2mm;position:relative;z-index:1}
  .llogo{width:8.2mm;height:8.2mm;border-radius:2.2mm;background:linear-gradient(145deg,#ffb24f,#c85a14);color:#fff;display:flex;align-items:center;justify-content:center;font-size:4.4mm;font-weight:800}
  .lshop{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.1}
  .lshop b{font-size:3.3mm;letter-spacing:.2mm}
  .lshop span{font-size:1.8mm;color:#7b8b7d;letter-spacing:.7mm;margin-top:.8mm}
  .lpaid{font-size:2.2mm;color:#a15a13;background:#fff4e6;border:0.2mm solid #f0d2ab;border-radius:9mm;padding:1mm 2.2mm;font-weight:700}
  .lpaid.ok{color:#22633a;background:#eaf5e8;border-color:#bcdcbc}
  .lbody{display:flex;gap:3mm;margin-top:2.4mm;flex:1;min-height:0;position:relative;z-index:1}
  .lleft{flex:1;min-width:0;display:flex;flex-direction:column;gap:1.1mm}
  .lno{font-size:5.2mm;font-weight:800;letter-spacing:.8mm;line-height:1}
  .lmeta{display:flex;gap:2mm;font-size:2.2mm;color:#4b5a4e;line-height:1.25}
  .lmeta span{color:#8a968c;width:6mm;flex:none}
  .lmeta b{font-weight:600;color:#24342a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lfiles{margin-top:.6mm;border-top:0.25mm dashed #ccd9cc;padding-top:1.2mm;display:flex;flex-direction:column;gap:.55mm}
  .lf{font-size:1.9mm;color:#5d6d60;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
  .lf.more{color:#8b998d}
  .lright{width:28mm;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
  .lqr{width:23mm;height:23mm;display:block}
  .lprinter{font-size:2mm;color:#8b988d;margin-bottom:.6mm}
  .lamount{font-size:5.4mm;font-weight:800;color:#1b5b32;line-height:1}
  .lfoot{display:flex;justify-content:space-between;gap:2mm;border-top:0.25mm solid #e3ece2;padding-top:1.2mm;margin-top:1.4mm;font-size:1.7mm;color:#8b988d;white-space:nowrap;overflow:hidden}
  .lfoot span:last-child{overflow:hidden;text-overflow:ellipsis;max-width:40mm}
  `;
}
