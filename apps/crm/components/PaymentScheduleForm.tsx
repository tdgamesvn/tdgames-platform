// apps/crm/components/PaymentScheduleForm.tsx
import React, { useState } from 'react';
import type { CrmPaymentSchedule } from '@/types';

interface Props {
  projectId: string;
  projectCurrency: string;
  schedule?: CrmPaymentSchedule | null;
  onSave: (data: Omit<CrmPaymentSchedule, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onClose: () => void;
}

const PaymentScheduleForm: React.FC<Props> = ({
  projectId, projectCurrency, schedule, onSave, onClose,
}) => {
  const [form, setForm] = useState({
    name:     schedule?.name     ?? '',
    amount:   schedule?.amount   ?? 0,
    currency: schedule?.currency ?? projectCurrency ?? 'VND',
    due_date: schedule?.due_date ?? '',
    notes:    schedule?.notes    ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.due_date) return;
    setSaving(true);
    try {
      await onSave({
        project_id:  projectId,
        name:        form.name.trim(),
        amount:      Number(form.amount),
        currency:    form.currency,
        due_date:    form.due_date,
        status:      schedule?.status      ?? 'pending',
        invoiced_at: schedule?.invoiced_at ?? null,
        paid_at:     schedule?.paid_at     ?? null,
        notes:       form.notes.trim() || null,
      });
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', background: '#1a1a1a', border: '1px solid #333',
    borderRadius: '8px', color: '#F5F5F5', padding: '8px 12px',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: '10px', fontWeight: 700, color: '#666', textTransform: 'uppercase',
    letterSpacing: '0.08em', display: 'block', marginBottom: '4px',
  };

  return (
    <div style={{
      marginTop: '12px', background: '#141414', border: '1px solid #333',
      borderRadius: '10px', padding: '16px',
    }}>
      <h5 style={{
        fontSize: '11px', fontWeight: 800, color: '#FF9500',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px',
      }}>
        {schedule ? '✏️ Sửa đợt thanh toán' : '+ Thêm đợt thanh toán'}
      </h5>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={lbl}>Tên đợt *</label>
          <input
            style={inp}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="VD: Đặt cọc 30%, Nghiệm thu..."
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
          <div>
            <label style={lbl}>Số tiền *</label>
            <input
              style={inp}
              type="number"
              min="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label style={lbl}>Tiền tệ</label>
            <select
              style={inp}
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div>
          <label style={lbl}>Ngày đến hạn *</label>
          <input
            style={inp}
            type="date"
            value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            required
          />
        </div>

        <div>
          <label style={lbl}>Ghi chú</label>
          <input
            style={inp}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Tuỳ chọn..."
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 transition-all"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50 transition-all"
            style={{ background: '#FF9500' }}
          >
            {saving ? 'Đang lưu...' : schedule ? 'Lưu thay đổi' : 'Thêm đợt'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentScheduleForm;
