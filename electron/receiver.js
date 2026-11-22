'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const Busboy = require('busboy');

const ALLOWED_EXT = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tif', '.tiff', '.txt',
  '.doc', '.docx', '.rtf', '.xls', '.xlsx', '.xlsm', '.csv', '.ppt', '.pptx', '.pptm',
]);

const NICKS = ['小墨', '云朵', '青柠', '阿印', '小鹿', '木木', '星野', '橙子', '纸飞机', '小满'];

function makeToken() {
  return crypto.randomBytes(4).toString('hex');
}

function lanAddress() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (/^169\.254\./.test(net.address)) continue;
      const score = /^192\.168\./.test(net.address) ? 0 : /^10\./.test(net.address) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(net.address) ? 2 : 3;
      candidates.push({ address: net.address, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.address || '127.0.0.1';
}

function safeName(input) {
  const base = path.basename(String(input || 'file')).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return (base || 'file').slice(0, 120);
}

function uniquePath(dir, name) {
  let target = path.join(dir, name);
  if (!fs.existsSync(target)) return target;
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  for (let i = 2; i < 10000; i += 1) {
    target = path.join(dir, `${stem}-${i}${ext}`);
    if (!fs.existsSync(target)) return target;
  }
  return path.join(dir, `${stem}-${Date.now()}${ext}`);
}

function mobilePage(token) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f6f2ed">
<title>墨印 · 手机打印</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#f6f2ed;color:#25221f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;overflow-x:hidden}
  body{min-height:100vh;background:
    radial-gradient(900px 500px at 8% -8%,#dcefdc 0,transparent 55%),
    radial-gradient(700px 420px at 105% 10%,#f1e5d5 0,transparent 60%),#f6f2ed}
  .wrap{width:100%;max-width:560px;margin:0 auto;padding:22px 16px 40px}
  .brand{display:flex;align-items:center;gap:12px;margin-bottom:18px}
  .logo{width:44px;height:44px;border-radius:13px;background:linear-gradient(145deg,#43a85c,#1e6b37);display:grid;place-items:center;box-shadow:0 10px 24px rgba(34,110,56,.24)}
  .logo svg{width:26px;height:26px}
  .brand h1{font-size:20px;line-height:1.15;margin:0 0 3px;letter-spacing:.2px}
  .brand p{margin:0;color:#7b746c;font-size:12px}
  .card{width:100%;max-width:100%;background:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.9);box-shadow:0 18px 50px rgba(52,43,33,.1);border-radius:22px;padding:16px;margin-bottom:12px}
  .sec-title{font-size:12px;font-weight:700;color:#6d675f;margin:0 0 10px;letter-spacing:.3px}
  .field{margin-bottom:12px}
  .field label{display:block;font-size:12px;color:#7b746c;margin-bottom:6px}
  .field input{width:100%;height:44px;border:1px solid #e4ddd4;border-radius:12px;padding:0 12px;font-size:15px;color:#25221f;background:#fff;outline:0}
  .field input:focus{border-color:#bcd3b7;box-shadow:0 0 0 3px rgba(96,150,90,.12)}
  .with-btn{display:flex;gap:8px}
  .with-btn input{flex:1;min-width:0}
  .mini{border:1px solid #dfe7dc;background:#fff;color:#315a3c;border-radius:12px;padding:0 12px;font-size:13px;font-weight:600;white-space:nowrap}
  .seg{display:flex;gap:8px}
  .seg button{flex:1;height:42px;border:1px solid #e4ddd4;background:#fff;border-radius:12px;font-size:14px;color:#5f5a53;font-weight:600;cursor:pointer}
  .seg button.on{border-color:#8ec49a;background:#eef7ec;color:#23613a;box-shadow:0 0 0 2px rgba(96,150,90,.1)}
  .drop{position:relative;border:1.5px dashed #b9c9b9;background:linear-gradient(180deg,#fbfdf9,#f3f8f1);border-radius:18px;padding:22px 14px;text-align:center;transition:.18s}
  .drop.over{border-color:#2d8047;background:#eef7ec;transform:scale(.995)}
  .drop h2{font-size:15px;margin:0 0 6px}
  .drop p{font-size:12px;color:#7b746c;line-height:1.6;margin:0 0 12px}
  .btn{border:0;border-radius:13px;background:linear-gradient(180deg,#3d9556,#23723e);color:#fff;font-weight:700;font-size:15px;padding:12px 20px;box-shadow:0 10px 22px rgba(37,112,62,.24);cursor:pointer}
  .btn.ghost{background:#fff;color:#315a3c;border:1px solid #dfe7dc;box-shadow:none}
  .btn:active{transform:translateY(1px)}
  .actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
  .files{margin-top:14px;display:none;gap:9px;flex-direction:column}
  .files.show{display:flex}
  .file{display:flex;align-items:center;gap:10px;background:#fbfaf8;border:1px solid #eee7df;border-radius:13px;padding:10px 12px}
  .file .ext{width:38px;height:38px;border-radius:10px;background:#eef3ea;color:#2e6a3f;display:grid;place-items:center;font-size:10px;font-weight:800}
  .file .meta{flex:1;min-width:0}
  .file .name{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .file .sub{font-size:11px;color:#8a837b;margin-top:2px}
  .bar{height:5px;border-radius:99px;background:#ece7e0;overflow:hidden;margin-top:6px}
  .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3c9a58,#1d6a38);transition:width .2s}
  .status{margin-top:12px;text-align:center;font-size:13px;color:#4b5e4e;min-height:18px}
  .status.err{color:#b4412f}
  .result{display:none;margin-top:12px;border:1px solid #dcebd6;background:#f6fbf3;border-radius:16px;padding:14px}
  .result.show{display:block}
  .result .row{display:flex;justify-content:space-between;font-size:13px;color:#4a5b4c;padding:4px 0}
  .result .row b{color:#1f4d2e}
  .result .amount{font-size:26px;font-weight:800;color:#1e6b37;text-align:center;margin:8px 0 2px}
  .result .tip{font-size:11px;color:#7b8a7c;text-align:center;line-height:1.6}
  .footer{text-align:center;font-size:11px;color:#9a9289;margin-top:14px;line-height:1.7}
  .token{text-align:center;font-size:10px;color:#b0a89f;letter-spacing:1px;margin-top:6px}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">
    <div class="logo"><svg viewBox="0 0 32 32" fill="none"><path d="M8 5.5h11.2L25 11.3V26a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" fill="#fff" opacity=".96"/><path d="M19 5.5v6h6" fill="#c8e6c9"/><path d="M11 16h10M11 20h7" stroke="#2c7944" stroke-width="1.7" stroke-linecap="round"/></svg></div>
    <div><h1>墨印</h1><p>手机下单，电脑确认后打印</p></div>
  </div>

  <div class="card">
    <p class="sec-title">1. 填写取件信息</p>
    <div class="field">
      <label>昵称（必填）</label>
      <div class="with-btn">
        <input id="nickname" maxlength="20" placeholder="例如：小墨">
        <button class="mini" id="randNick" type="button">随机</button>
      </div>
    </div>
    <div class="field">
      <label>手机号（必填，11 位）</label>
      <input id="phone" inputmode="numeric" maxlength="11" placeholder="用于取件联系">
    </div>
  </div>

  <div class="card">
    <p class="sec-title">2. 选择打印规格</p>
    <div class="field">
      <label>纸张</label>
      <div class="seg" id="paperSeg">
        <button type="button" data-paper="A4" class="on">A4</button>
        <button type="button" data-paper="A3">A3</button>
      </div>
    </div>
    <div class="field" style="margin-bottom:0">
      <label>颜色</label>
      <div class="seg" id="colorSeg">
        <button type="button" data-color="mono" class="on">黑白</button>
        <button type="button" data-color="color">彩色</button>
      </div>
    </div>
  </div>

  <div class="card">
    <p class="sec-title">3. 上传文件</p>
    <div class="drop" id="drop">
      <h2>把文件传到电脑</h2>
      <p>支持 PDF、图片、Word / Excel / PPT<br>单个文件最大 200 MB</p>
      <div class="actions">
        <button class="btn" id="pick" type="button">选择文件</button>
        <button class="btn ghost" id="camera" type="button">拍照扫描</button>
      </div>
      <input type="file" id="file" multiple hidden accept=".pdf,.doc,.docx,.rtf,.xls,.xlsx,.xlsm,.csv,.ppt,.pptx,.pptm,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tif,.tiff,.txt">
      <input type="file" id="photo" accept="image/*" capture="environment" hidden>
    </div>
    <div class="files" id="list"></div>
    <div class="status" id="status"></div>
    <div class="result" id="result"></div>
  </div>

  <div class="footer">文件只在本机局域网传输，不会上传到互联网。<br>提交后需柜台确认并付款，随后开始打印。</div>
  <div class="token">连接码 ${token.slice(0, 6).toUpperCase()}</div>
</div>
<script>
const token = ${JSON.stringify(token)};
const nicks = ${JSON.stringify(NICKS)};
const drop = document.getElementById('drop');
const fileInput = document.getElementById('file');
const photoInput = document.getElementById('photo');
const list = document.getElementById('list');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const nickEl = document.getElementById('nickname');
const phoneEl = document.getElementById('phone');
let queue = [];
let sending = false;
let paper = 'A4';
let color = 'mono';
let submitted = false;

document.getElementById('pick').onclick = () => fileInput.click();
document.getElementById('camera').onclick = () => photoInput.click();
fileInput.onchange = () => addFiles(fileInput.files);
photoInput.onchange = () => addFiles(photoInput.files);
document.getElementById('randNick').onclick = () => {
  const n = nicks[Math.floor(Math.random() * nicks.length)] + Math.floor(10 + Math.random() * 90);
  nickEl.value = n;
};
document.querySelectorAll('#paperSeg button').forEach((b) => {
  b.onclick = () => { paper = b.dataset.paper; document.querySelectorAll('#paperSeg button').forEach((x) => x.classList.toggle('on', x === b)); };
});
document.querySelectorAll('#colorSeg button').forEach((b) => {
  b.onclick = () => { color = b.dataset.color; document.querySelectorAll('#colorSeg button').forEach((x) => x.classList.toggle('on', x === b)); };
});
['dragenter','dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));

function fmt(n){ if(n>1048576) return (n/1048576).toFixed(2)+' MB'; return Math.max(1,Math.round(n/1024))+' KB'; }
function extOf(name){ const i=name.lastIndexOf('.'); return i>=0?name.slice(i+1).toUpperCase():'FILE'; }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function checkContact(){
  const nickname = nickEl.value.trim();
  const phone = phoneEl.value.replace(/\\D/g, '');
  if (!nickname) { showError('请先填写昵称，或点「随机」生成一个。'); nickEl.focus(); return null; }
  if (!/^1\\d{10}$/.test(phone)) { showError('手机号需要是 11 位数字，例如 13800138000。'); phoneEl.focus(); return null; }
  return { nickname, phone, paper, color };
}

function addFiles(files){
  if(!files || !files.length) return;
  const contact = checkContact();
  if (!contact) return;
  if (submitted) { submitted = false; resultEl.classList.remove('show'); }
  for(const f of files) queue.push(f);
  render(); sendNext();
}

function render(){
  list.classList.toggle('show', queue.length>0);
  list.innerHTML = queue.map((f)=>{
    const state = f._state || '等待传输';
    const pct = f._pct || 0;
    return '<div class="file"><div class="ext">'+extOf(f.name)+'</div><div class="meta"><div class="name">'+escapeHtml(f.name)+'</div><div class="sub">'+fmt(f.size)+' · '+state+'</div>'+(pct>0&&pct<100?'<div class="bar"><i style="width:'+pct+'%"></i></div>':'')+'</div></div>';
  }).join('');
}

function showError(msg){ statusEl.className='status err'; statusEl.textContent=msg; }

async function sendNext(){
  if(sending) return;
  const f = queue.find(x => !x._done && !x._error);
  if(!f) return;
  const contact = checkContact();
  if(!contact) return;
  sending = true;
  f._state='传输中'; f._pct=1; render();
  const fd = new FormData();
  fd.append('nickname', contact.nickname);
  fd.append('phone', contact.phone);
  fd.append('paper', contact.paper);
  fd.append('color', contact.color);
  fd.append('file', f, f.name);
  const xhr = new XMLHttpRequest();
  xhr.open('POST','/api/upload?token='+encodeURIComponent(token));
  xhr.upload.onprogress = e => { if(e.lengthComputable){ f._pct = Math.max(1,Math.round(e.loaded/e.total*100)); f._state='已传输 '+f._pct+'%'; render(); } };
  xhr.onload = () => {
    try {
      const r = JSON.parse(xhr.responseText || '{}');
      if(xhr.status===200 && r.ok){
        f._done=true; f._pct=100; f._state='已到达电脑';
        statusEl.className='status'; statusEl.textContent='上传完成，等待柜台确认。';
        showOrder(r.order);
      } else { throw new Error(r.error || '传输失败'); }
    }
    catch(err){ f._error=true; f._state='失败'; showError(err.message); }
    sending=false; render(); setTimeout(sendNext, 120);
  };
  xhr.onerror = () => { f._error=true; f._state='失败'; showError('网络连接中断，请确认手机和电脑在同一 Wi-Fi。'); sending=false; render(); };
  xhr.send(fd);
}

function showOrder(order){
  if(!order) return;
  submitted = true;
  const pages = order.pages || 0;
  const amount = Number(order.amount || 0).toFixed(2);
  resultEl.innerHTML = '<div class="row"><span>单号</span><b>'+escapeHtml(order.no||'')+'</b></div>'
    + '<div class="row"><span>规格</span><b>'+escapeHtml(order.paper||paper)+' · '+(order.color==='color'?'彩色':'黑白')+'</b></div>'
    + '<div class="row"><span>页数</span><b>'+pages+' 页</b></div>'
    + '<div class="amount">¥'+amount+'</div>'
    + '<p class="tip">已发到电脑，等待柜台确认收款后开始打印。<br>请向店员出示单号。</p>';
  resultEl.classList.add('show');
}
</script>
</body>
</html>`;
}

class ReceiveServer {
  constructor({ onFiles, onLog, resolveDir, quote } = {}) {
    this.onFiles = onFiles || (() => {});
    this.onLog = onLog || (() => {});
    this.resolveDir = resolveDir || (() => '');
    this.quote = quote || (async () => null);
    this.server = null;
    this.port = 0;
    this.token = makeToken();
    this.url = '';
    this.startedAt = 0;
  }

  info() {
    return {
      running: !!this.server,
      port: this.port,
      token: this.token,
      url: this.url,
      address: lanAddress(),
      startedAt: this.startedAt,
    };
  }

  async start(preferredPort = 18666) {
    if (this.server) return this.info();
    this.token = makeToken();
    const tryPorts = [preferredPort, preferredPort + 1, preferredPort + 2, 18688, 18689, 0];
    let lastError = null;
    for (const p of tryPorts) {
      try {
        const server = http.createServer((req, res) => this.handle(req, res));
        server.keepAliveTimeout = 20000;
        await new Promise((resolve, reject) => {
          server.once('error', reject);
          server.listen(p, '0.0.0.0', () => {
            server.off('error', reject);
            resolve();
          });
        });
        this.server = server;
        this.port = server.address().port;
        this.startedAt = Date.now();
        this.url = `http://${lanAddress()}:${this.port}/r/${this.token}`;
        this.onLog(`手机传输已启动 ${this.url}`);
        return this.info();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('无法启动手机传输服务');
  }

  async stop() {
    if (!this.server) return this.info();
    const server = this.server;
    this.server = null;
    this.url = '';
    await new Promise((resolve) => server.close(() => resolve()));
    return this.info();
  }

  handle(req, res) {
    const host = req.headers.host || `127.0.0.1:${this.port}`;
    const url = new URL(req.url || '/', `http://${host}`);
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, {
        'content-type': type,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      });
      res.end(body);
    };

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/r' || url.pathname === `/r/${this.token}`)) {
      return send(200, mobilePage(this.token), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return send(200, JSON.stringify({ ok: true, running: true, time: Date.now() }), 'application/json; charset=utf-8');
    }
    if (req.method === 'POST' && url.pathname === '/api/upload') {
      if (url.searchParams.get('token') !== this.token) {
        return send(403, JSON.stringify({ ok: false, error: '连接码已失效，请重新扫码。' }), 'application/json; charset=utf-8');
      }
      return this.receive(req, res, send);
    }
    return send(404, 'Not found');
  }

  receive(req, res, send) {
    let busboy;
    try {
      busboy = Busboy({ headers: req.headers, defParamCharset: 'utf8', limits: { files: 12, fileSize: 200 * 1024 * 1024 } });
    } catch (err) {
      return send(400, JSON.stringify({ ok: false, error: '无效的上传请求。' }), 'application/json; charset=utf-8');
    }
    const incoming = [];
    const meta = { nickname: '', phone: '', paper: 'A4', color: 'mono' };
    let rejected = '';
    let pending = 0;
    let parseDone = false;
    let responded = false;

    const customDir = String(this.resolveDir() || '').trim();
    const dir = customDir || path.join(require('electron').app.getPath('userData'), 'received', new Date().toISOString().slice(0, 10));
    fs.mkdirSync(dir, { recursive: true });

    const respond = async () => {
      if (!parseDone || pending > 0 || responded) return;
      responded = true;

      const fail = (message) => {
        for (const file of incoming) {
          try { fs.unlinkSync(file.path); } catch { /* ignore */ }
        }
        return send(400, JSON.stringify({ ok: false, error: message }), 'application/json; charset=utf-8');
      };

      const nickname = String(meta.nickname || '').trim().slice(0, 20);
      const phone = String(meta.phone || '').replace(/\D/g, '');
      if (!nickname) return fail('请先填写昵称。');
      if (!/^1\d{10}$/.test(phone)) return fail('手机号需要是 11 位数字。');
      if (!['A4', 'A3'].includes(meta.paper)) meta.paper = 'A4';
      if (!['color', 'mono'].includes(meta.color)) meta.color = 'mono';

      if (rejected) return fail(rejected);
      if (!incoming.length) return fail('没有收到文件。');

      const contact = { nickname, phone, paper: meta.paper, color: meta.color };
      let order = null;
      try {
        order = await this.quote(incoming, contact);
      } catch (err) {
        console.error('[receive] quote failed', err);
      }
      try {
        await this.onFiles(incoming, contact, order);
      } catch (err) {
        console.error('[receive] notify failed', err);
      }
      send(200, JSON.stringify({ ok: true, files: incoming, order, contact }), 'application/json; charset=utf-8');
    };

    busboy.on('field', (name, value) => {
      if (Object.prototype.hasOwnProperty.call(meta, name)) meta[name] = String(value || '').slice(0, 40);
    });

    busboy.on('file', (field, stream, info) => {
      const original = safeName(info.filename || 'file');
      const ext = path.extname(original).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        rejected = `不支持的文件类型：${ext || '未知'}`;
        stream.resume();
        return;
      }
      pending += 1;
      const target = uniquePath(dir, original);
      const out = fs.createWriteStream(target);
      let size = 0;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        pending -= 1;
        respond();
      };
      stream.on('data', (chunk) => { size += chunk.length; });
      stream.on('limit', () => { rejected = '文件超过 200 MB 限制。'; });
      stream.pipe(out);
      out.on('finish', () => {
        if (rejected) {
          try { fs.unlinkSync(target); } catch { /* ignore */ }
          return done();
        }
        incoming.push({
          id: crypto.randomUUID(),
          name: original,
          path: target,
          size,
          ext: ext.replace('.', ''),
          receivedAt: Date.now(),
          source: 'receive',
        });
        done();
      });
      out.on('error', (err) => {
        rejected = err.message;
        done();
      });
    });

    busboy.on('finish', () => {
      parseDone = true;
      respond();
    });
    busboy.on('error', (err) => {
      rejected = err.message;
      parseDone = true;
      respond();
    });

    req.pipe(busboy);
  }
}

module.exports = { ReceiveServer, lanAddress };
