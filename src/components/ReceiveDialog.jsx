import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, RefreshCw, Smartphone, Wifi, Power, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { Modal, Button, Toggle } from './ui.jsx';

export function ReceiveDialog({ open, receive, settings, onClose, onRefresh, onToggle, onOpenSettings, notify }) {
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!receive?.url) { setQr(''); return; }
    QRCode.toDataURL(receive.url, {
      width: 420, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#153f26', light: '#ffffff' },
    }).then(setQr).catch(() => setQr(''));
  }, [open, receive?.url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receive?.url || '');
      notify?.('连接地址已复制');
    } catch { notify?.('复制失败，请手动选择地址', 'error'); }
  };

  const refresh = async () => {
    setBusy(true);
    try { await onRefresh?.(); } catch (err) { notify?.(err.message || '启动失败', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="手机传输"
      subtitle="同一 Wi-Fi 下扫码即可把文件传到本机，文件不经过互联网。"
      size="md"
      className="receive-modal"
    >
      <div className="receive-layout">
        <div className="receive-qr-card">
          <div className={`receive-status ${receive?.running ? 'on' : ''}`}>
            <span className="pulse-dot" />
            {receive?.running ? '接收服务运行中' : '接收服务未启动'}
          </div>
          <div className="receive-qr">
            {qr ? <img src={qr} alt="手机传输二维码" /> : <div className="qr-placeholder"><Smartphone size={36} /><span>启动服务后生成二维码</span></div>}
          </div>
          <div className="receive-url" title={receive?.url || ''}>{receive?.url || '尚未启动'}</div>
          <div className="receive-qr-actions">
            <Button variant="primary" size="sm" icon={Copy} onClick={copy} disabled={!receive?.url}>复制地址</Button>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={refresh} disabled={busy}>{busy ? '刷新中…' : '刷新地址'}</Button>
          </div>
        </div>
        <div className="receive-info">
          <h4><Wifi size={16} /> 使用步骤</h4>
          <ol className="receive-steps">
            <li><b>1</b><span>手机连接与电脑相同的 Wi-Fi。</span></li>
            <li><b>2</b><span>用相机或微信扫左侧二维码。</span></li>
            <li><b>3</b><span>选择 PDF / JPG / PNG，文件自动出现在堆叠中。</span></li>
          </ol>
          <div className="receive-note"><ShieldCheck size={14} /> 仅局域网可访问；关闭本窗口不会中断接收。</div>
          <div className="receive-switch-row">
            <span>保持接收服务</span>
            <Toggle checked={!!settings.receiveEnabled} onChange={(v) => onToggle?.(v)} label="保持接收服务" />
          </div>
          <div className="receive-meta">
            <span>端口</span><b>{receive?.port || settings.receivePort || '—'}</b>
            <span>连接码</span><b>{(receive?.token || '').slice(0, 6).toUpperCase() || '—'}</b>
          </div>
          <button type="button" className="link-btn" onClick={onOpenSettings}>打开传输设置 →</button>
        </div>
      </div>
      <div className="receive-foot">
        <span>提示：电脑休眠或退出应用后需重新启动接收服务。</span>
        <span className="receive-version">局域网直连 · 无云端中转</span>
      </div>
    </Modal>
  );
}
