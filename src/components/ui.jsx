import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Button({ children, variant = 'ghost', size = 'md', icon: Icon, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    >
      {Icon ? <Icon size={size === 'sm' ? 15 : 17} strokeWidth={1.8} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className = '', ...props }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...props}>
      <Icon size={18} strokeWidth={1.8} />
    </button>
  );
}

export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${checked ? 'is-on' : ''}`}
      onClick={() => onChange?.(!checked)}
    >
      <span className="toggle-track">
        <span className="toggle-label off">关</span>
        <span className="toggle-label on">开</span>
        <span className="toggle-knob" />
      </span>
    </button>
  );
}

export function Modal({ open, title, subtitle, onClose, children, footer, size = 'md', className = '', closeLabel = '关闭' }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} className={`modal modal-${size} ${className}`}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="modal-close" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
            <X size={19} strokeWidth={1.7} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label ? <span className="field-label">{label}</span> : null}
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Select({ children, className = '', ...props }) {
  return <select className={`control select ${className}`} {...props}>{children}</select>;
}

export function Input({ className = '', ...props }) {
  return <input className={`control input ${className}`} {...props} />;
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`segmented ${className}`} role="tablist">
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        return (
          <button
            key={val}
            type="button"
            role="tab"
            aria-selected={value === val}
            className={value === val ? 'active' : ''}
            onClick={() => onChange?.(val)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon ? <div className="empty-icon"><Icon size={30} strokeWidth={1.5} /></div> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

export function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type || 'info'}`}>
          <span className="toast-dot" />
          <span className="toast-text">{t.message}</span>
          <button type="button" aria-label="关闭提示" onClick={() => onDismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}
