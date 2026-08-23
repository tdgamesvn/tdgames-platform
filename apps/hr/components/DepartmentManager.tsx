import React, { useState } from 'react';
import { HrDepartment, HrEmployee } from '@/types';

interface Props {
  departments: HrDepartment[];
  employees: HrEmployee[];
  onSave: (dept: Omit<HrDepartment, 'id' | 'created_at'>) => void;
  onUpdate: (id: string, updates: Partial<HrDepartment>) => void;
  onDelete: (id: string) => void;
}

const inputCls = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-white placeholder-neutral-medium/40 focus:outline-none focus:border-primary/40 transition-all text-sm";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block";

const DepartmentManager: React.FC<Props> = ({ departments, employees, onSave, onUpdate, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', manager_id: null as string | null, is_active: true });

  const resetForm = () => {
    setForm({ name: '', code: '', description: '', manager_id: null, is_active: true });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (d: HrDepartment) => {
    setForm({ name: d.name, code: d.code, description: d.description, manager_id: d.manager_id, is_active: d.is_active });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      onUpdate(editingId, form);
    } else {
      onSave(form);
    }
    resetForm();
  };

  const getEmployeeCount = (deptId: string) => employees.filter(e => e.department_id === deptId).length;
  const getManager = (managerId: string | null) => managerId ? employees.find(e => e.id === managerId) : null;

  return (
    <div className="animate-fadeInUp space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:gap-0 md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF375F' }}>Phòng ban</h2>
          <p className="text-neutral-medium text-sm mt-1">Quản lý cơ cấu tổ chức</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all" style={{ background: 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          Thêm phòng ban
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-[20px] border border-primary/10 bg-surface p-8 space-y-6">
          <h3 className="text-lg font-black text-white uppercase">{editingId ? 'Sửa phòng ban' : 'Thêm phòng ban mới'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Tên phòng ban *</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Art Department" />
            </div>
            <div>
              <label className={labelCls}>Mã</label>
              <input className={inputCls} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="ART" />
            </div>
            <div>
              <label className={labelCls}>Quản lý</label>
              <select className={inputCls} value={form.manager_id || ''} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value || null }))}>
                <option value="">-- Chọn --</option>
                {employees.filter(e => e.status === 'active').map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Mô tả</label>
              <input className={inputCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả phòng ban..." />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={resetForm} className="px-6 py-3 rounded-xl border border-primary/10 text-neutral-medium font-black text-xs uppercase tracking-widest hover:text-white hover:border-primary/30 transition-all">Hủy</button>
            <button onClick={handleSubmit} className="px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all" style={{ background: 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>
              {editingId ? '💾 Cập nhật' : '✚ Thêm'}
            </button>
          </div>
        </div>
      )}

      {/* Department Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map(d => {
          const count = getEmployeeCount(d.id);
          const manager = getManager(d.manager_id);
          return (
            <div key={d.id} className="group relative rounded-[20px] border border-primary/10 bg-surface overflow-hidden hover:border-primary/30 transition-all">
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #FF375F, #FF6B81)' }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-bold text-base">{d.name}</h3>
                    <p className="text-neutral-medium/60 text-[11px] font-mono">{d.code}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${d.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {d.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {d.description && <p className="text-neutral-medium text-xs mb-3">{d.description}</p>}
                <div className="flex items-center justify-between text-xs text-neutral-medium">
                  <span>👥 {count} nhân sự</span>
                  {manager && <span>👤 {manager.full_name}</span>}
                </div>
              </div>
              {/* Hover actions */}
              <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(d)} className="p-2 rounded-lg hover:bg-white/10 text-neutral-medium hover:text-primary transition-all" title="Sửa">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                {count === 0 && (
                  <button onClick={() => { if (confirm(`Xóa phòng ban "${d.name}"?`)) onDelete(d.id); }} className="p-2 rounded-lg hover:bg-white/10 text-neutral-medium hover:text-red-400 transition-all" title="Xóa">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DepartmentManager;
