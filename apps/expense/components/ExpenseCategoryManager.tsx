import React, { useState } from 'react';
import { ExpenseCategory } from '@/types';
import { Button } from '@/components/Button';

interface Props {
  categories: ExpenseCategory[];
  onSave: (data: Omit<ExpenseCategory, 'id'>) => void;
  onUpdate: (id: string, data: Partial<ExpenseCategory>) => void;
  onDelete: (id: string) => void;
}

const PRESET_COLORS = ['#F97316', '#8B5CF6', '#06B6D4', '#EF4444', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E'];
const PRESET_ICONS = ['📦', '👨‍💻', '🔧', '🖥️', '📋', '💼', '🖨️', '🏢', '🎨', '📱', '🚗', '✈️', '🍔', '📚', '💡', '🔒'];

const ExpenseCategoryManager: React.FC<Props> = ({ categories, onSave, onUpdate, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const resetForm = () => { setName(''); setColor(PRESET_COLORS[0]); setIcon(PRESET_ICONS[0]); setEditingId(null); setShowForm(false); };

  const startEdit = (cat: ExpenseCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color);
    setIcon(cat.icon);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) {
      onUpdate(editingId, { name, color, icon });
    } else {
      onSave({ name, color, icon });
    }
    resetForm();
  };

  const inputClass = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all";
  const labelClass = "block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2";

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">Categories</h2>
          <p className="text-neutral-medium text-sm mt-2">Quản lý danh mục chi phí</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} variant="ghost" size="sm">
          {showForm ? '✕ Đóng' : '+ Thêm danh mục'}
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-[24px] border border-primary/10 p-8 bg-surface animate-fadeInUp">
          <div className="space-y-5">
            <div>
              <label className={labelClass}>Tên danh mục *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Tên danh mục..." required />
            </div>
            <div>
              <label className={labelClass}>Icon</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_ICONS.map(i => (
                  <button key={i} type="button" onClick={() => setIcon(i)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${icon === i ? 'bg-primary/20 ring-2 ring-primary scale-110' : 'bg-white/5 hover:bg-white/10'}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Màu sắc</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            {/* Preview */}
            <div>
              <label className={labelClass}>Xem trước</label>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold" style={{ backgroundColor: color + '20', color }}>
                {icon} {name || 'Danh mục'}
              </span>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={resetForm}
              className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all hover:scale-[1.01]">
              Huỷ
            </button>
            <button type="submit"
              className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-primary text-black transition-all hover:scale-[1.01] shadow-btn-glow">
              {editingId ? 'Cập nhật' : 'Lưu'}
            </button>
          </div>
        </form>
      )}

      {/* Category Grid — card style matching Invoice */}
      {categories.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          </div>
          <p className="opacity-50 font-black uppercase tracking-widest text-xs">No categories yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map(cat => (
            <div key={cat.id} className="rounded-[20px] border transition-all hover:scale-[1.01] bg-surface border-primary/10 hover:border-primary/25 relative overflow-hidden group">
              {/* Accent bar with category color */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${cat.color}, ${cat.color}80)` }} />

              <div className="p-5">
                {/* Icon + Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: cat.color + '15' }}>
                    {cat.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white">{cat.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: cat.color }} />
                      <span className="text-[10px] text-neutral-medium font-bold tabular-nums">{cat.color}</span>
                    </div>
                  </div>
                </div>

                {/* Actions — hover visible like Invoice */}
                <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-primary/5 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(cat)} title="Sửa" className="p-2 rounded-lg transition-colors hover:bg-white/5 hover:text-primary">
                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <div className="w-px h-5 mx-0.5 bg-white/10" />
                  {deleteConfirm === cat.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => { onDelete(cat.id); setDeleteConfirm(null); }} className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider">Xoá</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 text-[10px] font-black uppercase tracking-wider">Huỷ</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(cat.id)} title="Xoá" className="p-2 rounded-lg transition-colors text-red-500/50 hover:text-red-400 hover:bg-red-500/10">
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpenseCategoryManager;
