import { useEffect, useState } from 'react';
import { FolderOpen, Layers } from 'lucide-react';
import { Modal, Button, Field } from './ui.jsx';

export function NewStackDialog({ open, defaultName, defaultLocation, paths, onClose, onCreate, onPickLocation }) {
  const [name, setName] = useState(defaultName || '堆叠1');
  const [location, setLocation] = useState(defaultLocation || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(defaultName || '堆叠1');
    setLocation(defaultLocation || '');
    setError('');
    setBusy(false);
  }, [open, defaultName, defaultLocation]);

  const pick = async () => {
    const dir = await onPickLocation?.();
    if (dir) setLocation(dir);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onCreate?.({ name: name.trim(), location: location || '' });
    } catch (err) {
      setError(err.message || '创建失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建堆叠"
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={busy || !name.trim()}>{busy ? '创建中…' : '创建'}</Button>
        </>
      )}
    >
      <form className="new-stack-form" onSubmit={submit}>
        <Field label="保存位置" hint="创建一个文件夹，放入文件后会自动读取。空文件夹也会保留。">
          <div className="path-picker">
            <input className="control input" value={location} placeholder="选择一个文件夹，如桌面" onChange={(e) => setLocation(e.target.value)} />
            <Button variant="ghost" size="sm" icon={FolderOpen} type="button" onClick={pick}>选择位置</Button>
          </div>
        </Field>
        <Field label="堆叠名称">
          <input className="control input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        </Field>
        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </Modal>
  );
}
