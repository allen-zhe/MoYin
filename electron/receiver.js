'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const Busboy = require('busboy');

const ALLOWED_EXT = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tif', '.tiff', '.txt',
]);

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
<title>墨印 · 手机传输</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#f6f2ed;color:#25221f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;overflow-x:hidden}
  body{min-height:100vh;background:
    radial-gradient(900px 500px at 8% -8%,#dcefdc 0,transparent 55%),
    radial-gradient(700px 420px at 105% 10%,#f1e5d5 0,transparent 60%),#f6f2ed}
  .wrap{width:100%;max-width:560px;margin:0 auto;padding:24px 18px 44px}
  .brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}
  .logo{width:44px;height:44px;border-radius:13px;background:linear-gradient(145deg,#43a85c,#1e6b37);display:grid;place-items:center;box-shadow:0 10px 24px rgba(34,110,56,.24)}
  .logo svg{width:26px;height:26px}
  .brand h1{font-size:20px;line-height:1.15;margin:0 0 3px;letter-spacing:.2px}
  .brand p{margin:0;color:#7b746c;font-size:12px}
  .card{width:100%;max-width:100%;background:rgba(255,255,255,.9);border:1px solid rgba(255,255,255,.9);box-shadow:0 18px 50px rgba(52,43,33,.1);border-radius:24px;padding:18px}
  .drop{position:relative;border:1.5px dashed #b9c9b9;background:linear-gradient(180deg,#fbfdf9,#f3f8f1);border-radius:20px;padding:30px 16px;text-align:center;transition:.18s}
  .drop.over{border-color:#2d8047;background:#eef7ec;transform:scale(.995)}
  .drop .ico{width:64px;height:64px;margin:0 auto 14px;border-radius:20px;background:#e8f4e6;color:#2d7a43;display:grid;place-items:center}
  .drop .ico svg{width:32px;height:32px}
  .drop h2{font-size:18px;margin:0 0 8px}
  .drop p{font-size:13px;color:#7b746c;line-height:1.65;margin:0 0 16px}
  .btn{border:0;border-radius:14px;background:linear-gradient(180deg,#3d9556,#23723e);color:#fff;font-weight:700;font-size:15px;padding:13px 24px;box-shadow:0 10px 22px rgba(37,112,62,.24);cursor:pointer}
  .btn.ghost{background:#fff;color:#315a3c;border:1px solid #dfe7dc;box-shadow:none}
  .btn:active{transform:translateY(1px)}
  .actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
  .hint{margin-top:14px;font-size:12px;color:#8b847b;display:flex;gap:6px;align-items:center;justify-content:center}
  .files{margin-top:16px;display:none;gap:9px;flex-direction:column}
  .files.show{display:flex}
  .file{display:flex;align-items:center;gap:10px;background:#fbfaf8;border:1px solid #eee7df;border-radius:13px;padding:10px 12px}
  .file .ext{width:38px;height:38px;border-radius:10px;background:#eef3ea;color:#2e6a3f;display:grid;place-items:center;font-size:10px;font-weight:800}
  .file .meta{flex:1;min-width:0}
  .file .name{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .file .sub{font-size:11px;color:#8a837b;margin-top:2px}
  .bar{height:5px;border-radius:99px;background:#ece7e0;overflow:hidden;margin-top:6px}
  .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3c9a58,#1d6a38);transition:width .2s}
  .status{margin-top:14px;text-align:center;font-size:13px;color:#4b5e4e;min-height:20px}
  .status.err{color:#b4412f}
  .footer{text-align:center;font-size:11px;color:#9a9289;margin-top:20px;line-height:1.7}
  .token{text-align:center;font-size:10px;color:#b0a89f;letter-spacing:1px;margin-top:8px}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">
    <div class="logo"><svg viewBox="0 0 32 32" fill="none"><path d="M8 5.5h11.2L25 11.3V26a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" fill="#fff" opacity=".96"/><path d="M19 5.5v6h6" fill="#c8e6c9"/><path d="M11 16h10M11 20h7" stroke="#2c7944" stroke-width="1.7" stroke-linecap="round"/></svg></div>
    <div><h1>墨印</h1><p>手机文件，直达电脑打印队列</p></div>
  </div>
  <div class="card">
    <div class="drop" id="drop">
      <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></div>
      <h2>把文件传到电脑</h2>
      <p>支持 PDF、JPG、PNG、WEBP<br>单个文件最大 200 MB</p>
      <div class="actions">
        <button class="btn" id="pick">选择文件</button>
        <button class="btn ghost" id="camera">拍照扫描</button>
      </div>
      <div class="hint">也可以把文件拖到这里</div>
      <input type="file" id="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tif,.tiff,.txt">
      <input type="file" id="photo" accept="image/*" capture="environment" hidden>
    </div>
    <div class="files" id="list"></div>
    <div class="status" id="status"></div>
  </div>
  <div class="footer">文件仅在本机局域网传输，不会上传到互联网。<br>电脑端保持「墨印」运行即可接收。</div>
  <div class="token">连接码 ${token.slice(0, 6).toUpperCase()}</div>
</div>
<script>
const token = ${JSON.stringify(token)};
const drop = document.getElementById('drop');
const fileInput = document.getElementById('file');
const photoInput = document.getElementById('photo');
const list = document.getElementById('list');
const statusEl = document.getElementById('status');
let queue = [];
let sending = false;
document.getElementById('pick').onclick = () => fileInput.click();
document.getElementById('camera').onclick = () => photoInput.click();
fileInput.onchange = () => addFiles(fileInput.files);
photoInput.onchange = () => addFiles(photoInput.files);
['dragenter','dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
function fmt(n){ if(n>1048576) return (n/1048576).toFixed(2)+' MB'; return Math.max(1,Math.round(n/1024))+' KB'; }
function extOf(name){ const i=name.lastIndexOf('.'); return i>=0?name.slice(i+1).toUpperCase():'FILE'; }
function addFiles(files){
  if(!files || !files.length) return;
  for(const f of files) queue.push(f);
  render(); sendNext();
}
function render(){
  list.classList.toggle('show', queue.length>0);
  list.innerHTML = queue.map((f,i)=>{
    const state = f._state || '等待传输';
    const pct = f._pct || 0;
    return '<div class="file"><div class="ext">'+extOf(f.name)+'</div><div class="meta"><div class="name">'+escapeHtml(f.name)+'</div><div class="sub">'+fmt(f.size)+' · '+state+'</div>'+(pct>0&&pct<100?'<div class="bar"><i style="width:'+pct+'%"></i></div>':'')+'</div></div>';
  }).join('');
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
async function sendNext(){
  if(sending) return;
  const f = queue.find(x => !x._done && !x._error);
  if(!f) return;
  sending = true;
  f._state='传输中'; f._pct=1; render();
  const fd = new FormData(); fd.append('file', f, f.name);
  const xhr = new XMLHttpRequest();
  xhr.open('POST','/api/upload?token='+encodeURIComponent(token));
  xhr.upload.onprogress = e => { if(e.lengthComputable){ f._pct = Math.max(1,Math.round(e.loaded/e.total*100)); f._state='已传输 '+f._pct+'%'; render(); } };
  xhr.onload = () => {
    try { const r = JSON.parse(xhr.responseText || '{}'); if(xhr.status===200 && r.ok){ f._done=true; f._pct=100; f._state='已到达电脑'; statusEl.className='status'; statusEl.textContent='已发送 '+r.files.length+' 个文件，正在电脑端排队。'; } else { throw new Error(r.error || '传输失败'); } }
    catch(err){ f._error=true; f._state='失败'; statusEl.className='status err'; statusEl.textContent=err.message; }
    sending=false; render(); setTimeout(sendNext, 120);
  };
  xhr.onerror = () => { f._error=true; f._state='失败'; statusEl.className='status err'; statusEl.textContent='网络连接中断，请确认手机和电脑在同一 Wi-Fi。'; sending=false; render(); };
  xhr.send(fd);
}
</script>
</body>
</html>`;
}

class ReceiveServer {
  constructor({ onFiles, onLog } = {}) {
    this.onFiles = onFiles || (() => {});
    this.onLog = onLog || (() => {});
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
    let rejected = '';
    let pending = 0;
    let parseDone = false;
    let responded = false;
    const dir = path.join(require('electron').app.getPath('userData'), 'received', new Date().toISOString().slice(0, 10));
    fs.mkdirSync(dir, { recursive: true });

    const respond = async () => {
      if (!parseDone || pending > 0 || responded) return;
      responded = true;
      if (rejected) {
        return send(400, JSON.stringify({ ok: false, error: rejected }), 'application/json; charset=utf-8');
      }
      if (!incoming.length) {
        return send(400, JSON.stringify({ ok: false, error: '没有收到文件。' }), 'application/json; charset=utf-8');
      }
      try {
        await this.onFiles(incoming);
      } catch (err) {
        console.error('[receive] notify failed', err);
      }
      send(200, JSON.stringify({ ok: true, files: incoming }), 'application/json; charset=utf-8');
    };

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
