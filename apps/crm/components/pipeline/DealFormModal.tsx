import React, { useState, useEffect } from 'react';
import type { AccountUser, CrmClient, CrmDeal, CrmDealStage } from '@/types';
import { STAGES, CURRENCIES } from './constants';

interface Props {
  clients: CrmClient[];
  currentUser: AccountUser;
  editDeal?: CrmDeal | null;
  onSave: (deal: any) => Promise<void>;
  onClose: () => void;
}

const DealFormModal: React.FC<Props> = ({ clients, currentUser, editDeal, onSave, onClose }) => {
  const [form, setForm] = useState({
    client_id: editDeal?.client_id || '',
    title: editDeal?.title || '',
    value: editDeal?.value?.toString() || '',
    currency: (editDeal?.currency || 'USD') as typeof CURRENCIES[number],
    stage: (editDeal?.stage || 'lead') as CrmDealStage,
    probability: editDeal?.probability?.toString() || '20',
    expected_close_date: editDeal?.expected_close_date || '',
    next_follow_up: editDeal?.next_follow_up || '',
    notes: editDeal?.notes || '',
    lost_reason: editDeal?.lost_reason || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setError('');
  };

  // Auto-set probability when stage changes
  useEffect(() => {
    const probMap: Partial<Record<CrmDealStage, string>> = {
      lead: '10', contacted: '20', negotiating: '40',
      proposal_sent: '60', contracting: '80', won: '100', lost: '0',
    };
    if (!editDeal) {
      const suggested = probMap[form.stage];
      if (suggested) set('probability', suggested);
    }
  }, [form.stage]);

  const handleSubmit = async () => {
    if (!form.client_id || !form.title) return;

    // Stage transition rules
    if (form.stage === 'lost' && !form.lost_reason.trim()) {
      setError('Vui lòng nhập lý do mất deal khi chọn stage "Lost"');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...form,
        value: parseFloat(form.value) || 0,
        probability: parseInt(form.probability) || 0,
        owner_id: editDeal?.owner_id || currentUser.id,
        owner_name: editDeal?.owner_name || currentUser.username,
      };

      // Won → auto set actual_close_date
      if (form.stage === 'won') {
        payload.actual_close_date = new Date().toISOString().split('T')[0];
      }
      // Lost → auto set actual_close_date + include reason
      if (form.stage === 'lost') {
        payload.actual_close_date = new Date().toISOString().split('T')[0];
      }
      // Clear lost_reason if not lost
      if (form.stage !== 'lost') {
        payload.lost_reason = '';
      }

      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const inputCls = 'px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full';
  const labelCls = 'text-neutral-500 text-[10px] font-black uppercase tracking-wider';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="rounded-2xl border border-white/10 p-6 w-full max-w-lg animate-scaleIn max-h-[90vh] overflow-y-auto"
        style={{ background: '#161616' }}
      >
        <h3 className="text-base font-black uppercase tracking-wider text-white mb-6">
          {editDeal ? 'Chỉnh sửa Deal' : 'Tạo Deal mới'}
        </h3>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Client */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Khách hàng *</label>
            <select value={form.client_id} onChange={e => set('client_id', e.target.value)}
              className={inputCls} style={{ background: '#1a1a1a' }}>
              <option value="">Chọn khách hàng</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Tên deal *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="VD: Character Art Package Q3"
              className={inputCls} style={{ background: '#1a1a1a' }} />
          </div>

          {/* Value + Currency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 flex flex-col gap-1">
              <label className={labelCls}>Giá trị</label>
              <input type="number" value={form.value} onChange={e => set('value', e.target.value)}
                placeholder="10000" className={inputCls} style={{ background: '#1a1a1a' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Tiền tệ</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className={inputCls} style={{ background: '#1a1a1a' }}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Stage + Probability */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Giai đoạn</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}
                className={inputCls} style={{ background: '#1a1a1a' }}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Xác suất (%)</label>
              <input type="number" min={0} max={100} value={form.probability}
                onChange={e => set('probability', e.target.value)}
                className={inputCls} style={{ background: '#1a1a1a' }} />
            </div>
          </div>

          {/* Expected close date + Follow-up */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Dự kiến chốt</label>
              <input type="date" value={form.expected_close_date}
                onChange={e => set('expected_close_date', e.target.value)}
                className={inputCls} style={{ background: '#1a1a1a' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>📌 Follow-up tiếp</label>
              <input type="date" value={form.next_follow_up}
                onChange={e => set('next_follow_up', e.target.value)}
                className={inputCls} style={{ background: '#1a1a1a' }} />
            </div>
          </div>

          {/* Lost reason — only show when stage = lost */}
          {form.stage === 'lost' && (
            <div className="flex flex-col gap-1">
              <label className={`${labelCls} text-red-500/70`}>Lý do mất deal *</label>
              <textarea value={form.lost_reason} onChange={e => set('lost_reason', e.target.value)}
                rows={3} placeholder="VD: Ngân sách không đủ, chọn vendor khác..."
                className="w-full px-3 py-2 rounded-xl text-sm text-white border border-red-500/30 outline-none focus:border-red-500/50 transition-colors resize-none"
                style={{ background: '#1a1a1a' }} />
            </div>
          )}

          {/* Won info badge */}
          {form.stage === 'won' && (
            <div className="p-3 rounded-xl text-xs text-green-400 border border-green-500/20 bg-green-500/5 flex items-center gap-2">
              <span>🎉</span>
              <span>Ngày chốt thực tế sẽ tự động được ghi là hôm nay</span>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Ghi chú</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={3} placeholder="Thông tin thêm..."
              className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
              style={{ background: '#1a1a1a' }} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
            Huỷ
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.client_id || !form.title}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}>
            {saving ? 'Đang lưu...' : editDeal ? 'Cập nhật' : 'Tạo deal'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DealFormModal;
