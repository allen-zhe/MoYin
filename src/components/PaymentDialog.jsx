import { useEffect, useState } from 'react';
import { Modal, Button, Field, Select, Input } from './ui.jsx';
import { money } from '../lib/format.js';

export function PaymentDialog({ open, stacks, initial, onClose, onSave }) {
  const [type, setType] = useState(initial?.type || 'charge');
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '');
  const [stackId, setStackId] = useState(initial?.stackId || '');
  const [note, setNote] = useState(initial?.note || '');

  useEffect(() => {
    if (!open) return;
    setType(initial?.type || 'charge');
    setAmount(initial?.amount ? String(initial.amount) : '');
    setStackId(initial?.stackId || '');
    setNote(initial?.note || '');
  }, [open, initial]);

  const submit = () => {
    const value = Math.max(0, Number(amount) || 0);
    if (!value) return;
    onSave?.({ type, amount: value, stackId, note: note.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="收款 / 退款登记"
      subtitle="人工确认的金额会进入收款记录，不影响已冻结的打印单价。"
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={!amount || Number(amount) <= 0}>确认登记</Button>
        </>
      )}
    >
      <div className="payment-form">
        <Field label="类型">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="payment">收款</option>
            <option value="charge">补收</option>
            <option value="refund">退款</option>
          </Select>
        </Field>
        <Field label="金额（元）">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus />
        </Field>
        <Field label="关联堆叠">
          <Select value={stackId} onChange={(e) => setStackId(e.target.value)}>
            <option value="">不关联</option>
            {stacks.map((s) => <option key={s.id} value={s.id}>{s.title} · {money(s.frozenAmount || 0)}</option>)}
          </Select>
        </Field>
        <Field label="备注">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：现金、微信、补印差价" maxLength={80} />
        </Field>
      </div>
    </Modal>
  );
}
