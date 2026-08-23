import React, { useState } from 'react';
import { Worker } from '@/types';

interface WorkerListProps {
  workers: Worker[];
  isLoading: boolean;
  filterType: string;
  setFilterType: (v: string) => void;
  onEdit: (w: Worker) => void;
  onDelete: (id: string) => void;
  onToggleActive: (w: Worker) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onSyncFromHR?: () => Promise<void>;
}

const WorkerList: React.FC<WorkerListProps> = ({
  workers, isLoading, filterType, setFilterType,
  onEdit, onDelete, onToggleActive, onRefresh, onAdd, onSyncFromHR
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const freelancerCount = workers.filter(w => w.type === 'freelancer').length;
  const inhouseCount = workers.filter(w => w.type === 'inhouse').length;

  const handleDelete = (id: string) => {
    onDelete(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">Nhân Sự</h2>
          <p className="text-neutral-medium text-sm mt-1">Quản lý freelancer & inhouse</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onAdd} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-black font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all hover:scale-105">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Thêm nhân sự
          </button>
          {onSyncFromHR && (
            <button
              onClick={async () => { setSyncing(true); try { await onSyncFromHR(); } finally { setSyncing(false); } }}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-cyan-500/20 text-cyan-400 font-black text-xs uppercase tracking-widest hover:bg-cyan-500/10 transition-all hover:scale-105 disabled:opacity-50"
              title="Đồng bộ dữ liệu từ HR (phone, bank, ...)"
            >
              {syncing ? (
                <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
              Sync HR
            </button>
          )}
          <button onClick={onRefresh} className="p-3 rounded-2xl border border-primary/10 text-neutral-medium hover:text-primary hover:border-primary/30 transition-all hover:scale-105">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Tổng nhân sự', value: workers.length },
          { label: 'Freelancer', value: freelancerCount },
          { label: 'Inhouse', value: inhouseCount },
        ].map(c => (
          <div key={c.label} className="p-5 rounded-[20px] border border-primary/10 bg-surface">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">{c.label}</p>
            <p className="text-3xl font-black text-white">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-center">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all"
        >
          <option value="">Tất cả loại</option>
          <option value="freelancer">Freelancer</option>
          <option value="inhouse">Inhouse</option>
        </select>
        <span className="text-neutral-medium text-xs ml-auto">{workers.length} kết quả</span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && workers.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-neutral-medium text-sm">Chưa có nhân sự nào</p>
        </div>
      )}

      {/* Worker Cards */}
      {!isLoading && workers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workers.map(w => (
            <div
              key={w.id}
              className="group relative rounded-[20px] border border-primary/10 bg-surface overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-card-glow"
            >
              {/* Accent bar */}
              <div className={`h-1 w-full ${w.is_active ? (w.type === 'freelancer' ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600') : 'bg-neutral-dark'}`} />

              <div className="p-5">
                {/* Name + Type badge */}
                <div className="mb-3 pr-24">
                  <h3 className="text-white font-bold text-base">{w.full_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                      w.type === 'freelancer' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {w.type}
                    </span>
                    <div className={`w-2.5 h-2.5 rounded-full ${w.is_active ? 'bg-emerald-400' : 'bg-neutral-dark'}`} />
                    <span className={`text-[9px] ${w.is_active ? 'text-emerald-400' : 'text-neutral-medium/40'}`}>{w.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-1 text-xs text-neutral-medium">
                  {w.email && <p>📧 {w.email}</p>}
                  {w.phone && <p>📱 {w.phone}</p>}
                  {w.bank_name && <p>🏦 {w.bank_name} — {w.bank_account}</p>}
                </div>

                {/* Notes */}
                {w.notes && <p className="text-[11px] text-neutral-medium/60 mt-3 line-clamp-2">{w.notes}</p>}
              </div>

              {/* Inline Delete Confirmation */}
              {confirmDeleteId === w.id && (
                <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-[20px]">
                  <p className="text-white font-bold text-sm">Xóa nhân sự này?</p>
                  <p className="text-neutral-medium text-xs">{w.full_name}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDelete(w.id!)}
                      className="px-5 py-2 rounded-xl bg-red-500 text-white font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all"
                    >
                      Xóa
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-5 py-2 rounded-xl border border-primary/20 text-neutral-medium font-black text-xs uppercase tracking-widest hover:text-white hover:border-primary/40 transition-all"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Hover Actions */}
              <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onToggleActive(w)} className="p-2 rounded-lg hover:bg-white/10 transition-all text-neutral-medium hover:text-yellow-400" title={w.is_active ? 'Deactivate' : 'Activate'}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={w.is_active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} /></svg>
                </button>
                <button onClick={() => onEdit(w)} className="p-2 rounded-lg hover:bg-white/10 transition-all text-neutral-medium hover:text-primary" title="Sửa">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => setConfirmDeleteId(w.id!)} className="p-2 rounded-lg hover:bg-white/10 transition-all text-neutral-medium hover:text-red-400" title="Xóa">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerList;
