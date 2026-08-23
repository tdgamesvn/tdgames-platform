import React, { useState } from 'react';
import { HrEmployee, HrDepartment, AccountUser } from '@/types';
import { hasRole } from '@/utils/roleUtils';
import { toPublicUrl, resendInvite, resetEmployeePassword } from '../services/hrService';

interface Props {
  currentUser: AccountUser;
  employees: HrEmployee[];
  departments: HrDepartment[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterDepartment: string;
  setFilterDepartment: (v: string) => void;
  totalCount: number;
  onView: (e: HrEmployee) => void;
  onEdit: (e: HrEmployee) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onQuickAdd: () => void;
  onSyncWorkforce: () => void;
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
  pendingReminders: number;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  fulltime: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  freelancer: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  parttime: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  inactive: { bg: 'bg-neutral-500/20', text: 'text-neutral-400' },
  offboarded: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  blacklist: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

const EmployeeList: React.FC<Props> = ({
  currentUser, employees, departments, isLoading, searchQuery, setSearchQuery,
  filterType, setFilterType, filterStatus, setFilterStatus,
  filterDepartment, setFilterDepartment, totalCount,
  onView, onEdit, onDelete, onAdd, onQuickAdd, onSyncWorkforce, onRefresh, onToast, pendingReminders,
}) => {
  const isHrOnly = hasRole(currentUser, 'hr') && !hasRole(currentUser, 'admin') && !hasRole(currentUser, 'ke_toan');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // 'invite_ID' or 'reset_ID'

  const ftCount = employees.filter(e => e.type === 'fulltime').length;
  const flCount = employees.filter(e => e.type === 'freelancer').length;
  const activeCount = employees.filter(e => e.status === 'active').length;

  const selectCls = "bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all";

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF375F' }}>
            Nhân sự
          </h2>
          <p className="text-neutral-medium text-sm mt-1">Quản lý hồ sơ nhân sự toàn diện</p>
        </div>
        {/* ponytail: wrap để 4 nút không tràn mép trên điện thoại; md+ vẫn 1 hàng như cũ */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {pendingReminders > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold animate-pulse">
              🔔 {pendingReminders} nhắc việc
            </span>
          )}
          <button onClick={onSyncWorkforce} className="flex items-center gap-2 px-4 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #5E5CE6 0%, #0A84FF 100%)' }} title="Đồng bộ tất cả nhân sự sang Workforce">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Sync WF
          </button>
          <button onClick={onQuickAdd} className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #34C759 0%, #059669 100%)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Thêm nhanh
          </button>
          <button onClick={onAdd} className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Thêm nhân sự
          </button>
          <button onClick={onRefresh} className="p-3 rounded-2xl border border-primary/10 text-neutral-medium hover:text-primary hover:border-primary/30 transition-all hover:scale-105">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng NV', value: totalCount, color: '#FF375F' },
          { label: 'Fulltime', value: ftCount, color: '#34C759' },
          { label: 'Freelancer', value: flCount, color: '#0A84FF' },
          { label: 'Đang làm việc', value: activeCount, color: '#FF9500' },
        ].map(c => (
          <div key={c.label} className="p-5 rounded-[20px] border border-primary/10 bg-surface">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">{c.label}</p>
            <p className="text-3xl font-black" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, email, mã NV..."
            className="w-full bg-surface border border-primary/10 text-neutral-light rounded-xl pl-10 pr-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all"
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectCls}>
          <option value="">Tất cả loại</option>
          <option value="fulltime">Fulltime</option>
          <option value="freelancer">Freelancer</option>
          <option value="parttime">Part-time</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang làm việc</option>
          <option value="inactive">Nghỉ việc</option>
          <option value="offboarded">Offboarded</option>
          <option value="blacklist">Blacklist</option>
        </select>
        <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} className={selectCls}>
          <option value="">Tất cả phòng ban</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="text-neutral-medium text-xs ml-auto">{employees.length} kết quả</span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && employees.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,55,95,0.1)' }}>
            <svg className="w-10 h-10" style={{ color: 'rgba(255,55,95,0.4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-neutral-medium text-sm">Chưa có nhân sự nào. Nhấn "Thêm nhân sự" để bắt đầu.</p>
        </div>
      )}

      {/* Employee Cards */}
      {!isLoading && employees.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {employees.map(emp => {
            const tc = TYPE_COLORS[emp.type] || TYPE_COLORS.fulltime;
            const sc = STATUS_COLORS[emp.status] || STATUS_COLORS.active;
            const dept = departments.find(d => d.id === emp.department_id);

            return (
              <div
                key={emp.id}
                className="group relative rounded-[20px] border border-primary/10 bg-surface overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-card-glow cursor-pointer"
                onClick={() => onView(emp)}
              >
                {/* Accent bar */}
                <div className="h-1 w-full" style={{
                  background: emp.type === 'fulltime' ? 'linear-gradient(90deg, #34C759, #30D158)' :
                    emp.type === 'freelancer' ? 'linear-gradient(90deg, #0A84FF, #5E5CE6)' :
                    'linear-gradient(90deg, #FF9500, #FF6B00)',
                }} />

                <div className="p-5">
                  {/* Name + badges */}
                  <div className="mb-3 flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
                      {emp.avatar_url ? (
                        <img src={toPublicUrl(emp.avatar_url)} alt={emp.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-base font-black text-white" style={{ background: 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>
                          {emp.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className="text-white font-bold text-base truncate">{emp.full_name}</h3>
                      <p className="text-neutral-medium/60 text-[11px] font-mono">{emp.employee_code}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${tc.bg} ${tc.text}`}>
                          {emp.type}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${sc.bg} ${sc.text}`}>
                          {emp.status}
                        </span>
                        {emp.worker_id && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400" title="Đã đồng bộ Workforce">
                            WF ✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1 text-xs text-neutral-medium">
                    {emp.position && <p>💼 {emp.position}{emp.level ? ` • ${emp.level}` : ''}</p>}
                    {dept && <p>🏢 {dept.name}</p>}
                    {emp.work_email && <p>💼 {emp.work_email}</p>}
                    {emp.email && <p>📧 {emp.email}</p>}
                    {emp.phone && <p>📱 {emp.phone}</p>}
                    {emp.type === 'freelancer' && emp.specializations && emp.specializations.length > 0 && (
                      <p>🎨 {emp.specializations.join(', ')}</p>
                    )}
                    {!isHrOnly && emp.type === 'freelancer' && emp.rate_amount && emp.rate_amount > 0 && (
                      <p>💵 {emp.rate_amount.toLocaleString()} {emp.rate_currency}/{emp.rate_type}</p>
                    )}
                  </div>

                  {emp.tags && emp.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {emp.tags.slice(0, 3).map(t => (
                        <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-medium">{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete confirmation */}
                {confirmDeleteId === emp.id && (
                  <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-[20px]" onClick={e => e.stopPropagation()}>
                    <p className="text-white font-bold text-sm">Xóa nhân sự này?</p>
                    <p className="text-neutral-medium text-xs">{emp.full_name}</p>
                    <div className="flex gap-3">
                      <button onClick={() => { onDelete(emp.id); setConfirmDeleteId(null); }} className="px-5 py-2 rounded-xl bg-red-500 text-white font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all">Xóa</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-5 py-2 rounded-xl border border-primary/20 text-neutral-medium font-black text-xs uppercase tracking-widest hover:text-white hover:border-primary/40 transition-all">Hủy</button>
                    </div>
                  </div>
                )}

                {/* Hover actions */}
                <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  {/* Re-send Invite */}
                  {emp.work_email && (emp.type === 'fulltime' || emp.type === 'parttime') && (
                    <button
                      onClick={async () => {
                        setActionLoading(`invite_${emp.id}`);
                        try {
                          const msg = await resendInvite({ work_email: emp.work_email!, full_name: emp.full_name, id: emp.id });
                          onToast(msg, 'success');
                        } catch (err: any) {
                          onToast(err.message || 'Lỗi gửi invite', 'error');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === `invite_${emp.id}`}
                      className="p-2 rounded-lg hover:bg-white/10 transition-all text-neutral-medium hover:text-emerald-400"
                      title="Gửi lại Invite"
                    >
                      {actionLoading === `invite_${emp.id}` ? (
                        <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      )}
                    </button>
                  )}
                  {/* Reset Password */}
                  {emp.work_email && (emp.type === 'fulltime' || emp.type === 'parttime') && (
                    <button
                      onClick={async () => {
                        setActionLoading(`reset_${emp.id}`);
                        try {
                          const msg = await resetEmployeePassword(emp.work_email!);
                          onToast(msg, 'success');
                        } catch (err: any) {
                          onToast(err.message || 'Lỗi reset password', 'error');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === `reset_${emp.id}`}
                      className="p-2 rounded-lg hover:bg-white/10 transition-all text-neutral-medium hover:text-amber-400"
                      title="Reset mật khẩu"
                    >
                      {actionLoading === `reset_${emp.id}` ? (
                        <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      )}
                    </button>
                  )}
                  {/* Edit */}
                  <button onClick={() => onEdit(emp)} className="p-2 rounded-lg hover:bg-white/10 transition-all text-neutral-medium hover:text-primary" title="Sửa">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  {/* Delete */}
                  <button onClick={() => setConfirmDeleteId(emp.id)} className="p-2 rounded-lg hover:bg-white/10 transition-all text-neutral-medium hover:text-red-400" title="Xóa">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
