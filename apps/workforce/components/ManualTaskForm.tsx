import React, { useState } from 'react';
import { Worker } from '@/types';
import * as wfSvc from '../services/workforceService';

/**
 * Thêm việc NGOÀI ClickUp (freelancer không có trên ClickUp, việc phát sinh…).
 * Task lưu với clickup_task_id = null ⇒ sync ClickUp không đụng tới (sync chỉ khớp theo mã ClickUp).
 * Tạo sẵn ở trạng thái "Hoàn thành" + closed_date = ngày hoàn thành ⇒ vào thẳng được phiếu nghiệm thu.
 * Không tính vào nghiệm thu với khách (exclude_from_acceptance) — đây là chi phí nội bộ.
 */
interface Props {
  workers: Worker[];
  projects: string[];
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const inputCls = 'w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/50';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1';

const lastDayOfPrevMonth = () => {
  const d = new Date(); d.setDate(0);
  return d.toISOString().slice(0, 10);
};

const ManualTaskForm: React.FC<Props> = ({ workers, projects, onClose, onSaved, onToast }) => {
  const [workerId, setWorkerId] = useState('');
  const [project, setProject] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [closedDate, setClosedDate] = useState(lastDayOfPrevMonth());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const sortedWorkers = [...workers].sort((a, b) =>
    Number(b.is_active) - Number(a.is_active) || a.full_name.localeCompare(b.full_name, 'vi'));
  const valid = workerId && project.trim() && title.trim() && Number(price) > 0 && closedDate;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await wfSvc.saveTask({
        project: project.trim(),
        client_name: '',
        title: title.trim(),
        clickup_task_id: null,
        clickup_list_id: null,
        clickup_status: null,
        clickup_space_name: null,
        clickup_folder_name: null,
        clickup_list_name: null,
        status: 'completed',
        price: Number(price),
        currency,
        exchange_rate: 0,
        bonus: 0,
        bonus_note: '',
        start_date: closedDate,
        closed_date: closedDate,
        completed_at: closedDate,
        approved_at: null,
        payment_status: 'unpaid',
        notes: notes.trim() ? `[Ngoài ClickUp] ${notes.trim()}` : '[Ngoài ClickUp]',
        synced_at: null,
        client_price: 0,
        client_currency: 'USD',
        exclude_from_acceptance: true,
      } as any, [{ worker_id: workerId, share_pct: 100 }]);
      onToast('Đã thêm việc ngoài ClickUp', 'success');
      onSaved();
      // Giữ người + dự án + ngày để nhập liên tiếp nhiều việc cho cùng 1 người
      setTitle(''); setPrice(''); setNotes('');
    } catch (e: any) {
      onToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[20px] border p-5 space-y-4"
      style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-black uppercase tracking-wider text-white">Thêm việc ngoài ClickUp</p>
          <p className="text-xs text-neutral-medium mt-1">
            Việc của freelancer không có trên ClickUp. Tạo xong ở trạng thái Hoàn thành, chọn được ngay khi tạo phiếu nghiệm thu.
          </p>
        </div>
        <button onClick={onClose}
          className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
          Đóng
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Người làm *</label>
          <select className={inputCls} value={workerId} onChange={e => setWorkerId(e.target.value)}>
            <option value="">— Chọn —</option>
            {sortedWorkers.map(w => (
              <option key={w.id} value={w.id}>{w.full_name}{w.is_active ? '' : ' (ngừng hoạt động)'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Dự án *</label>
          <input className={inputCls} list="manual-task-projects" value={project}
            onChange={e => setProject(e.target.value)} placeholder="VD: Marketing TD Games" />
          <datalist id="manual-task-projects">
            {projects.map(p => <option key={p} value={p} />)}
          </datalist>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Tên việc *</label>
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)}
            placeholder="VD: Lên kế hoạch và triển khai nội dung marketing tháng 09/2026" />
        </div>
        <div>
          <label className={labelCls}>Đơn giá (trước thuế) *</label>
          <div className="flex gap-2">
            <input type="number" min="0" className={inputCls} value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
            <select className={`${inputCls} w-24`} value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Ngày hoàn thành *</label>
          <input type="date" className={inputCls} value={closedDate} onChange={e => setClosedDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Ghi chú</label>
          <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="VD: 9,6 công tháng 9 quy đổi theo lương" />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={!valid || saving}
          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-primary hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? 'Đang lưu...' : '+ Thêm việc'}
        </button>
      </div>
    </div>
  );
};

export default ManualTaskForm;
