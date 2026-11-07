import { useState } from 'react';
import { FolderOpen, Keyboard, Monitor, Smartphone, Info, ExternalLink, Github, PlugZap } from 'lucide-react';
import { Modal, Toggle, Button, Select } from './ui.jsx';
import { APP_NAME, APP_NAME_EN, APP_VERSION, GITHUB_ISSUES_URL, GITHUB_URL, LICENSE_NAME, UPSTREAM_NOTE } from '../lib/constants.js';

function Row({ label, hint, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

export function AppSettings({ open, settings, receive, onClose, onChange, onPickDir, onOpenReceive, onOpenLabel, notify }) {
  const [anchor, setAnchor] = useState('print');
  const update = (patch) => onChange?.({ ...settings, ...patch });
  const sections = [
    { id: 'print', label: '打印与归档' },
    { id: 'shortcut', label: '快捷键与启动' },
    { id: 'receive', label: '手机传输' },
    { id: 'erp', label: 'ERP 接口（预留）' },
    { id: 'about', label: '开源与关于' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="设置" size="md" className="app-settings-modal">
      <div className="settings-layout">
        <nav className="settings-nav">
          {sections.map((s) => (
            <button key={s.id} type="button" className={anchor === s.id ? 'active' : ''} onClick={() => setAnchor(s.id)}>{s.label}</button>
          ))}
        </nav>
        <div className="settings-content">
          {anchor === 'print' ? (
            <>
              <h4>打印后处理</h4>
              <Row label="打印后自动归档" hint="打印完成后立即把堆叠移入“已归档”，避免列表越积越多"><Toggle checked={settings.autoArchive} onChange={(v) => update({ autoArchive: v })} label="打印后自动归档" /></Row>
              <Row label="自动打标签" hint="打印完成后自动生成并打印取件标签"><Toggle checked={settings.autoLabel} onChange={(v) => update({ autoLabel: v })} label="自动打标签" /></Row>
              <Row label="会员自动收款" hint="已关联会员的订单打印后自动记为已收款"><Toggle checked={settings.autoPayment} onChange={(v) => update({ autoPayment: v })} label="会员自动收款" /></Row>
              <Row label="入队后退出堆叠" hint="提交打印后立即归档当前堆叠，不再追加文件"><Toggle checked={settings.removeAfterPrint} onChange={(v) => update({ removeAfterPrint: v })} label="入队后退出堆叠" /></Row>
              <Row label="打印后删除接收件" hint="仅对“手机传输”来源的文件生效，打印成功后移入回收站"><Toggle checked={settings.deleteAfterScan} onChange={(v) => update({ deleteAfterScan: v })} label="打印后删除接收件" /></Row>
              <Row label="分次打印提醒" hint="同一客户在设定时间内再次打印时给出合并提醒">
                <div className="split-row">
                  <span>时间</span>
                  <input className="control input hours-input" type="number" min="1" max="72" value={settings.splitHours} onChange={(e) => update({ splitHours: Math.max(1, Number(e.target.value) || 12) })} />
                  <span>小时</span>
                  <Toggle checked={settings.splitReminder} onChange={(v) => update({ splitReminder: v })} label="分次打印提醒" />
                </div>
              </Row>
              <h4>堆叠显示</h4>
              <Row label="重复文件标红" hint="同一文件路径或同名文件在其他堆叠中出现时标红"><Toggle checked={settings.duplicateHighlight} onChange={(v) => update({ duplicateHighlight: v })} label="重复文件标红" /></Row>
              <h4>输出质量</h4>
              <Row label="PDF / 图片渲染分辨率" hint="300 DPI 为默认高清；600 DPI 更清晰但渲染更慢、占用更多内存">
                <Select value={String(settings.pdfDpi || 300)} onChange={(e) => update({ pdfDpi: Number(e.target.value) })} className="quality-select">
                  <option value="150">150 DPI（标准）</option>
                  <option value="300">300 DPI（高清，推荐）</option>
                  <option value="600">600 DPI（超高清，较慢）</option>
                </Select>
              </Row>
            </>
          ) : null}

          {anchor === 'shortcut' ? (
            <>
              <h4><Keyboard size={15} /> 快捷键</h4>
              <Row label="启用快捷键"><Toggle checked={settings.shortcuts} onChange={(v) => update({ shortcuts: v })} label="启用快捷键" /></Row>
              <Row label="显示主窗口"><kbd>Ctrl + Q</kbd></Row>
              <Row label="打印当前堆叠"><kbd>P</kbd></Row>
              <Row label="关闭并打标签"><kbd>Ctrl + W</kbd></Row>
              <Row label="关闭且不打标签"><kbd>Ctrl + E</kbd></Row>
              <h4><Monitor size={15} /> 启动设置</h4>
              <Row label="开机自启" hint="登录 Windows 后在后台启动接收服务"><Toggle checked={settings.autoStart} onChange={(v) => update({ autoStart: v })} label="开机自启" /></Row>
              <Row label="文件目录" hint={settings.watchDir || '未选择，接收和手动导入仍然可用'}>
                <Button variant="ghost" size="sm" icon={FolderOpen} onClick={onPickDir}>选择文件夹</Button>
              </Row>
            </>
          ) : null}

          {anchor === 'receive' ? (
            <>
              <h4><Smartphone size={15} /> 手机传输</h4>
              <Row label="启用手机传输" hint="在同一 Wi-Fi 下用手机扫码传文件">
                <Toggle checked={settings.receiveEnabled} onChange={(v) => update({ receiveEnabled: v })} label="启用手机传输" />
              </Row>
              <Row label="服务端口" hint="如果端口被占用会自动顺延；修改后到二维码页点“刷新地址”">
                <input className="control input small-input" type="number" min="1024" max="65535" value={settings.receivePort} onChange={(e) => update({ receivePort: Math.max(1024, Math.min(65535, Number(e.target.value) || 18666)) })} />
              </Row>
              <div className={`receive-mini ${receive?.running ? 'on' : ''}`}>
                <div>
                  <b>{receive?.running ? '传输服务运行中' : '传输服务未启动'}</b>
                  <span>{receive?.url || '打开二维码页后自动启动'}</span>
                </div>
                <Button variant="primary" size="sm" onClick={onOpenReceive}>打开二维码</Button>
              </div>
              <Row label="模拟打印" hint="没有打印机时也能走完订单、标签与收款流程">
                <Toggle checked={settings.simulatePrint} onChange={(v) => update({ simulatePrint: v })} label="模拟打印" />
              </Row>
            </>
          ) : null}

          {anchor === 'erp' ? (
            <>
              <h4><PlugZap size={15} /> ERP 接入（预留）</h4>
              <p className="settings-callout">这里保留标准的 ERP 适配层：订单、客户、收款、退款都通过统一接口发送。当前版本不连接任何第三方云端，未配置时不会联网。</p>
              <Row label="启用 ERP 同步" hint="启用后，打印完成与收款会尝试推送到下方接口"><Toggle checked={!!settings.erpEnabled} onChange={(v) => update({ erpEnabled: v })} label="启用 ERP 同步" /></Row>
              <Row label="接口地址" hint="例如 https://erp.example.com/api/moprint">
                <input className="control input erp-url-input" value={settings.erpEndpoint || ''} onChange={(e) => update({ erpEndpoint: e.target.value })} placeholder="https://" />
              </Row>
              <Row label="访问令牌" hint="通过 Authorization: Bearer 发送">
                <input className="control input erp-token-input" type="password" value={settings.erpToken || ''} onChange={(e) => update({ erpToken: e.target.value })} placeholder="可选" />
              </Row>
              <Row label="自动同步收款" hint="收款、退款时同时推送流水"><Toggle checked={!!settings.erpAutoSync} onChange={(v) => update({ erpAutoSync: v })} label="自动同步收款" /></Row>
              <div className="settings-callout">
                适配器位置：<code>src/lib/erp.js</code>。后续接入 ERP 时只需实现 <code>pushOrder / pushPayment / fetchCustomer</code> 三个方法，不需要改打印主流程。
              </div>
            </>
          ) : null}

          {anchor === 'about' ? (
            <div className="settings-about">
              <h4><Info size={15} /> 开源与关于</h4>
              <div className="opensource-card">
                <div className="opensource-badge">AGPLv3</div>
                <div>
                  <b>{APP_NAME} {APP_NAME_EN}</b>
                  <span>完全免费的开源项目，遵循 {LICENSE_NAME}，是 {UPSTREAM_NOTE}。</span>
                </div>
              </div>
              <Row label="应用版本"><b>{APP_NAME} v{APP_VERSION}</b></Row>
              <Row label="运行平台"><b>Windows · Electron</b></Row>
              <Row label="项目主页"><button type="button" className="link-inline" onClick={() => window.cloudPrint.openExternal(GITHUB_URL)}>{GITHUB_URL.replace('https://', '')} <ExternalLink size={12} /></button></Row>
              <Row label="问题反馈"><button type="button" className="link-inline" onClick={() => window.cloudPrint.openExternal(GITHUB_ISSUES_URL)}><Github size={13} /> 打开 GitHub Issue</button></Row>
              <Row label="标签设置"><Button variant="ghost" size="sm" onClick={onOpenLabel}>打开标签设置</Button></Row>
              <Row label="数据目录"><code>%APPDATA%\moprint</code></Row>
              <p className="about-note">本项目完全免费，不包含广告、会员付费或远程账号绑定。打印机能力由 Windows 系统打印驱动提供；安装版会检查打印后台服务并创建用户数据目录。</p>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
