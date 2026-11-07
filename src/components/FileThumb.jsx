import { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, FileWarning } from 'lucide-react';
import { renderPdfThumb, isImage, toLocalUrl } from '../lib/pdf.js';
import { fileExtLabel } from '../lib/format.js';

export function FileThumb({ file, width = 320, className = '', fit = 'contain' }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  const ext = String(file?.ext || '').toLowerCase();

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSrc('');
    if (!file?.path) return undefined;
    if (isImage(file)) {
      setSrc(toLocalUrl(file.path));
      return undefined;
    }
    if (ext === 'pdf') {
      renderPdfThumb(file.path, width)
        .then((url) => { if (!cancelled) setSrc(url); })
        .catch(() => { if (!cancelled) setFailed(true); });
      return () => { cancelled = true; };
    }
    return undefined;
  }, [file?.path, ext, width]);

  if (src && !failed) {
    return (
      <div className={`file-thumb ${className}`}>
        <img
          src={src}
          alt={file?.name || ''}
          style={{ objectFit: fit }}
          onError={() => setFailed(true)}
          draggable={false}
        />
      </div>
    );
  }

  const Icon = failed ? FileWarning : ext === 'pdf' ? FileText : isImage(file) ? ImageIcon : FileText;
  return (
    <div className={`file-thumb file-thumb-placeholder ${className}`}>
      <Icon size={34} strokeWidth={1.4} />
      <span>{fileExtLabel(file)}</span>
    </div>
  );
}
