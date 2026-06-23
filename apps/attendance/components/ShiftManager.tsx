import React, { useState } from 'react';
import { AttShift, HrEmployee, AttEmployeeShift } from '@/types';

interface Props {
  shifts: AttShift[];
  employees: HrEmployee[];
  employeeShifts: AttEmployeeShift[];
  onSave: (shift: Omit<AttShift, 'id' | 'created_at'>) => void;
  onUpdate: (id: string, updates: Partial<AttShift>) => void;
  onDelete: (id: string) => void;
  onAssign: (es: Omit<AttEmployeeShift, 'id' | 'created_at' | 'shift' | 'employee'>) => void;
  onDeleteAssignment: (id: string) => void;
}

const DAYS = [
  { key: 'mon', label: 'T2' }, { key: 'tue', label: 'T3' }, { key: 'wed', label: 'T4' },
  { key: 'thu', label: 'T5' }, { key: 'fri', label: 'T6' }, { key: 'sat', label: 'T7' }, { key: 'sun', label: 'CN' },
];

const emptyShift = {
  name: '', shift_type: 'fixed' as const, start_time: '08:00', end_time: '17:00',
  break_minutes: 60, late_threshold_minutes: 15, early_threshold_minutes: 15,
  overtime_after_minutes: 0, applicable_days: ['mon', 'tue', 'wed', 'thu', 'fri'], is_active: true,
};

const ShiftManager: React.FC<Props> = ({ shifts, employees, employeeShifts, onSave, onUpdate, onDelete, onAssign, onDeleteAssignment }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyShift);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState({ employee_id: '', shift_id: '', effective_from: new Date().toISOString().split('T')[0], effective_to: null as string | null });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const cardCls = 'rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl';
  const inputCls = 'w-full px-4 py-3 rounded-xl bg-black/30 border border-primary/10 text-white text-sm focus:border-primary/40 outline-none transition-colors';
  const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1';

  const handleSubmit = () => {
    if (!form.name || !form.start_time || !form.end_time) return;
    if (editingId) {
      onUpdate(editingId, form);
      setEditingId(null);
    } else {
      onSave(form);
    }
    setForm(emptyShift);
    setShowForm(false);
  };

  const startEdit = (s: AttShift) => {
    setForm({ name: s.name, shift_type: s.shift_type, start_time: s.start_time, end_time: s.end_time, break_minutes: s.break_minutes, late_threshold_minutes: s.late_threshold_minutes, early_threshold_minutes: s.early_threshold_minutes, overtime_after_minutes: s.overtime_after_minutes, applicable_days: s.applicable_days, is_active: s.is_active });
    setEditingId(s.id);
    setShowForm(true);
  };

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      applicable_days: f.applicable_days.includes(day)
        ? f.applicable_days.filter(d => d !== day)
        : [...f.applicable_days, day],
    }));
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent uppercase tracking-tight">
            🔄 Ca làm việc
          </h1>
          <p className="text-neutral-medium text-sm mt-1">Quản lý ca & phân ca cho nhân viên</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setShowAssignForm(!showAssignForm); setShowForm(false); }}
            className="px-6 py-3 rounded-xl bg-blue-500/20 text-blue-400 font-black text-sm uppercase tracking-wide hover:bg-blue-500/30 transition-all">
            👥 Phân ca
          </button>
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyShift); setShowAssignForm(false); }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-black text-sm uppercase tracking-wide hover:scale-105 transition-all">
            + Thêm ca
          </button>
        </div>
      </div>

      {/* Shift Form */}
      {showForm && (
        <div className={cardCls}>
          <h3 className="text-lg font-black text-white uppercase mb-4">{editingId ? '✏️ Sửa ca' : '➕ Thêm ca mới'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelCls}>Tên ca *</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ca sáng" />
            </div>
            <div>
              <label className={labelCls}>Giờ bắt đầu *</label>
              <input type="time" className={inputCls} value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Giờ kết thúc *</label>
              <input type="time" className={inputCls} value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Loại ca</label>
              <select className={inputCls} value={form.shift_type} onChange={e => setForm(f => ({ ...f, shift_type: e.target.value as any }))}>
                <option value="fixed">Cố định</option>
                <option value="rotating">Xoay ca</option>
                <option value="project">Theo dự án</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nghỉ (phút)</label>
              <input type="number" className={inputCls} value={form.break_minutes} onChange={e => setForm(f => ({ ...f, break_minutes: +e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Muộn sau (phút)</label>
              <input type="number" className={inputCls} value={form.late_threshold_minutes} onChange={e => setForm(f => ({ ...f, late_threshold_minutes: +e.target.value }))} />
            </div>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Ngày áp dụng</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => (
                <button key={d.key} onClick={() => toggleDay(d.key)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${form.applicable_days.includes(d.key) ? 'bg-orange-500 text-white' : 'bg-white/[0.05] text-neutral-medium'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-black text-sm">
              {editingId ? '💾 Cập nhật' : '💾 Lưu'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-6 py-3 rounded-xl bg-white/[0.05] text-neutral-medium font-bold text-sm">
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Assign Form */}
      {showAssignForm && (
        <div className={cardCls}>
          <h3 className="text-lg font-black text-white uppercase mb-4">👥 Phân ca cho nhân viên</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className={labelCls}>Nhân viên *</label>
              <select className={inputCls} value={assignForm.employee_id} onChange={e => setAssignForm(f => ({ ...f, employee_id: e.target.value }))}>
                <option value="">-- Chọn --</option>
                {employees.filter(e => e.status === 'active').map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ca *</label>
              <select className={inputCls} value={assignForm.shift_id} onChange={e => setAssignForm(f => ({ ...f, shift_id: e.target.value }))}>
                <option value="">-- Chọn --</option>
                {shifts.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Từ ngày *</label>
              <input type="date" className={inputCls} value={assignForm.effective_from} onChange={e => setAssignForm(f => ({ ...f, effective_from: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Đến ngày</label>
              <input type="date" className={inputCls} value={assignForm.effective_to || ''} onChange={e => setAssignForm(f => ({ ...f, effective_to: e.target.value || null }))} />
            </div>
          </div>
          <button disabled={!assignForm.employee_id || !assignForm.shift_id}
            onClick={() => { onAssign(assignForm); setAssignForm({ employee_id: '', shift_id: '', effective_from: new Date().toISOString().split('T')[0], effective_to: null }); }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-black text-sm disabled:opacity-30 transition-all">
            💾 Phân ca
          </button>
        </div>
      )}

      {/* Shift list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shifts.map(s => {
          const assigned = employeeShifts.filter(es => es.shift_id === s.id);
          return (
            <div key={s.id} className={cardCls + ' relative group'}>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-black text-white">{s.name}</h4>
                  <div className="text-sm text-orange-400 font-bold mt-1">{s.start_time} — {s.end_time}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${s.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {s.is_active ? 'Hoạt động' : 'Tắt'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {DAYS.map(d => (
                  <span key={d.key} className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.applicable_days.includes(d.key) ? 'bg-orange-500/20 text-orange-400' : 'bg-white/[0.03] text-neutral-medium/30'}`}>
                    {d.label}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-center">
                <div className="text-[10px] text-neutral-medium"><span className="text-white font-bold block">{s.break_minutes}p</span>Nghỉ</div>
                <div className="text-[10px] text-neutral-medium"><span className="text-white font-bold block">{s.late_threshold_minutes}p</span>Muộn</div>
                <div className="text-[10px] text-neutral-medium"><span className="text-white font-bold block">{s.overtime_after_minutes}p</span>OT</div>
              </div>
              {assigned.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] font-bold text-neutral-medium uppercase">👥 {assigned.length} nhân viên</span>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => startEdit(s)} className="px-3 h-8 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center gap-1 hover:bg-blue-500/30">✏️ Sửa</button>
                {confirmDeleteId === s.id ? (
                  <>
                    <button onClick={() => { onDelete(s.id); setConfirmDeleteId(null); }} className="px-3 h-8 rounded-lg bg-red-500 text-white text-[10px] font-bold hover:bg-red-600">Xác nhận xóa</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="px-3 h-8 rounded-lg bg-white/10 text-neutral-medium text-[10px] font-bold hover:bg-white/20">Hủy</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDeleteId(s.id)} className="px-3 h-8 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold flex items-center gap-1 hover:bg-red-500/30">🗑️ Xóa</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {shifts.length === 0 && (
        <div className="text-center py-16 opacity-40">
          <div className="text-5xl mb-4">🔄</div>
          <div className="text-lg font-bold">Chưa có ca làm việc nào</div>
          <div className="text-sm">Nhấn "+ Thêm ca" để bắt đầu</div>
        </div>
      )}
    </div>
  );
};

export default ShiftManager;
