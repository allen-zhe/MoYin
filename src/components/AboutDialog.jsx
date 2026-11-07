import { Modal, Button } from './ui.jsx';
import { Logo } from './Logo.jsx';
import { APP_NAME, APP_NAME_EN, APP_TAGLINE, APP_VERSION, GITHUB_ISSUES_URL, GITHUB_URL, LICENSE_NAME, UPSTREAM_NOTE } from '../lib/constants.js';

export function AboutDialog({ open, onClose, version }) {
  return (
    <Modal open={open} onClose={onClose} title="关于" size="sm" className="about-modal">
      <div className="about-hero">
        <Logo size={72} />
        <h2>{APP_NAME} <span className="about-en">{APP_NAME_EN}</span></h2>
        <p>{APP_TAGLINE}</p>
        <span className="version-pill">Version {version || APP_VERSION}</span>
      </div>
      <div className="about-body">
        <p>{APP_NAME} 是完全免费的开源软件，遵循 <b>{LICENSE_NAME}</b> 协议发布，是 {UPSTREAM_NOTE}。</p>
        <p>本地文件打印、快捷档位、长图分割、拼版、取件标签、局域网手机传输与收款统计。文件与订单数据只保存在本机。</p>
        <div className="about-meta">
          <span>项目主页</span><b>{GITHUB_URL.replace('https://', '')}</b>
          <span>许可证</span><b>{LICENSE_NAME}</b>
          <span>技术栈</span><b>Electron · React · PDF.js</b>
          <span>数据目录</span><b>%APPDATA%\moprint</b>
        </div>
      </div>
      <div className="about-foot">
        <span>自由使用 · 自由修改 · 自由分发</span>
        <div className="about-foot-actions">
          <Button variant="ghost" size="sm" onClick={() => window.cloudPrint.openExternal(GITHUB_ISSUES_URL)}>反馈 Issue</Button>
          <Button variant="primary" size="sm" onClick={() => window.cloudPrint.openExternal(GITHUB_URL)}>项目主页</Button>
        </div>
      </div>
    </Modal>
  );
}
