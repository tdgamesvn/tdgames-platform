import React, { useState } from 'react';
import { ExpenseRecord, ExpenseCategory, AccountUser } from '@/types';
import { hasAnyRole } from '@/utils/roleUtils';
import { Button } from '@/components/Button';

interface Props {
  expenses: ExpenseRecord[];
  categories: ExpenseCategory[];
  isLoading: boolean;
  currentUser: AccountUser;
  filterCategory: string; setFilterCategory: (v: string) => void;
  filterDateFrom: string; setFilterDateFrom: (v: string) => void;
  filterDateTo: string; setFilterDateTo: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  filterType: 'all' | 'expense' | 'revenue'; setFilterType: (v: 'all' | 'expense' | 'revenue') => void;
  filterSource: string; setFilterSource: (v: string) => void;
  totalVND: number; totalUSD: number;
  revenueVND: number; revenueUSD: number;
  expenseVND: number; expenseUSD: number;
  onEdit: (exp: ExpenseRecord) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (exp: ExpenseRecord) => void;
  onApprove: (id: string, note?: string) => void;
  onReject: (id: string, note: string) => void;
  onRefresh: () => void;
  onAdd: () => void;
  vcbAvgRate: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-blue-500/15 text-blue-400',
  paid: 'bg-emerald-500/15 text-emerald-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  paid: 'Đã trả',
};

const SOURCE_BADGES: Record<string, { label: string; color: string; icon: string }> = {
  payroll: { label: 'Payroll', color: '#3B82F6', icon: '💼' },
  settlement: { label: 'Freelancer', color: '#8B5CF6', icon: '🎨' },
  invoice: { label: 'Invoice', color: '#10B981', icon: '💰' },
};

const TYPE_TABS = [
  { key: 'all' as const, label: 'Tất cả', icon: '📊' },
  { key: 'expense' as const, label: 'Chi phí', icon: '📤' },
  { key: 'revenue' as const, label: 'Doanh thu', icon: '💰' },
];

const SOURCE_OPTIONS = [
  { key: '', label: 'Tất cả nguồn' },
  { key: 'payroll', label: '💼 Payroll' },
  { key: 'settlement', label: '🎨 Freelancer' },
  { key: 'invoice', label: '💰 Invoice' },
  { key: 'manual', label: '📝 Thủ công' },
];

const ExpenseList: React.FC<Props> = ({
  expenses, categories, isLoading, currentUser,
  filterCategory, setFilterCategory,
  filterDateFrom, setFilterDateFrom,
  filterDateTo, setFilterDateTo,
  filterStatus, setFilterStatus,
  filterType, setFilterType,
  filterSource, setFilterSource,
  totalVND, totalUSD,
  revenueVND, revenueUSD, expenseVND, expenseUSD,
  onEdit, onDelete, onToggleStatus, onApprove, onReject, onRefresh, onAdd,
  vcbAvgRate,
}) => {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; note: string } | null>(null);
  const canApprove = hasAnyRole(currentUser, ['admin', 'ke_toan']);
  const toVND = (amount: number, currency: string) => currency === 'USD' ? amount * vcbAvgRate : amount;
  const fmtVND = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' ₫';

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'VND') return amount.toLocaleString('vi-VN') + ' ₫';
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  const profitVND = revenueVND - expenseVND;
  const profitUSD = revenueUSD - expenseUSD;
  const hasFilters = filterCategory || filterStatus || filterDateFrom || filterDateTo || filterType !== 'all' || filterSource;

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">Financial Ledger</h2>
          <p className="text-neutral-medium text-sm mt-2">Sổ cái tài chính • {expenses.length} giao dịch</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={onAdd} variant="primary" size="sm">
            ＋ Thêm chi phí
          </Button>
          <Button onClick={onRefresh} variant="ghost" size="sm" disabled={isLoading}>
            {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
          </Button>
        </div>
      </div>

      {/* ── P&L Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="p-5 rounded-[20px] border bg-surface border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer"
          onClick={() => setFilterType(filterType === 'revenue' ? 'all' : 'revenue')}>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mb-1">💰 Doanh thu</p>
          <p className="text-lg font-black text-emerald-400 tabular-nums">{fmtVND(revenueVND + revenueUSD * vcbAvgRate)}</p>
        </div>

        {/* Expense */}
        <div className="p-5 rounded-[20px] border bg-surface border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer"
          onClick={() => setFilterType(filterType === 'expense' ? 'all' : 'expense')}>
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400/80 mb-1">📤 Chi phí</p>
          <p className="text-lg font-black text-red-400 tabular-nums">{fmtVND(expenseVND + expenseUSD * vcbAvgRate)}</p>
        </div>

        {/* Profit */}
        <div className="p-5 rounded-[20px] border bg-surface border-primary/10 hover:border-primary/25 transition-all md:col-span-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">📊 Lợi nhuận</p>
          {(() => {
            const totalRev = revenueVND + revenueUSD * vcbAvgRate;
            const totalExp = expenseVND + expenseUSD * vcbAvgRate;
            const profit = totalRev - totalExp;
            return <p className={`text-lg font-black tabular-nums ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {profit >= 0 ? '+' : ''}{fmtVND(profit)}
            </p>;
          })()}
        </div>
      </div>

      {/* ── Type Tabs ── */}
      <div className="flex items-center gap-2">
        {TYPE_TABS.map(tab => (
          <button key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              filterType === tab.key
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-white/[0.03] text-white/50 border border-transparent hover:bg-white/[0.06] hover:text-white/70'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
        <div className="w-px h-6 bg-white/10 mx-1" />
        {/* Source filter */}
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="bg-surface border border-primary/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/30 transition-colors">
          {SOURCE_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* ── Filters Row ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="bg-surface border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/30 transition-colors">
          <option value="">Tất cả danh mục</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-surface border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/30 transition-colors">
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="paid">Đã trả</option>
        </select>
        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
          className="bg-surface border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/30 transition-colors" />
        <span className="text-neutral-medium text-sm">→</span>
        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
          className="bg-surface border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/30 transition-colors" />
        {hasFilters && (
          <button onClick={() => { setFilterCategory(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterType('all'); setFilterSource(''); }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-400/10 transition-colors">
            ✕ Reset
          </button>
        )}
      </div>

      {/* ── Card Grid ── */}
      {isLoading ? (
        <div className="py-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6 animate-pulse">
            <svg className="w-10 h-10 text-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="opacity-50 font-black uppercase tracking-widest text-xs">Loading expenses...</p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="col-span-full py-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="opacity-50 font-black uppercase tracking-widest text-xs">
            {filterType === 'revenue' ? 'Không có doanh thu' : filterType === 'expense' ? 'Không có chi phí' : 'No entries found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {expenses.map((exp) => {
            const isRevenue = exp.type === 'revenue';
            const isAutoSynced = exp.source_type && exp.source_type !== 'manual';
            return (
              <div key={exp.id} className={`rounded-[20px] border transition-all hover:scale-[1.01] bg-surface ${isRevenue ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-primary/10 hover:border-primary/25'} relative overflow-hidden group`}>
                {/* Status accent bar */}
                <div className={`h-1 w-full ${isRevenue ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : exp.status === 'paid' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : exp.status === 'approved' ? 'bg-gradient-to-r from-blue-500 to-blue-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`} />

                {/* Auto-synced indicator */}
                {isAutoSynced && (
                  <div className="absolute top-2.5 right-3">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.05]" title="Tự động đồng bộ">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[8px] font-bold text-white/40">AUTO</span>
                    </div>
                  </div>
                )}

                <div className="p-5">
                  {/* Row 1: Title + Date */}
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-black tracking-tight text-white truncate pr-3">{exp.title}</h3>
                    <span className="text-[10px] font-bold tabular-nums text-neutral-medium whitespace-nowrap">{exp.expense_date}</span>
                  </div>

                  {/* Row 2: Vendor + Project */}
                  <p className="text-sm font-semibold truncate text-white/70">{exp.vendor || 'Không có vendor'}</p>
                  {exp.project && <p className="text-[10px] truncate mt-0.5 text-neutral-medium/50">📁 {exp.project}</p>}
                  {exp.receipt_url && (
                    <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] mt-0.5 text-primary/60 hover:text-primary transition-colors">
                      📎 Xem hoá đơn
                    </a>
                  )}

                  {/* Row 3: Badges */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {isRevenue && (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400">💰 Doanh thu</span>
                    )}
                    <button onClick={() => onToggleStatus(exp)}
                      className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all hover:scale-105 ${STATUS_COLORS[exp.status]}`}>
                      {STATUS_LABELS[exp.status]}
                    </button>
                    {exp.source_type && SOURCE_BADGES[exp.source_type] && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black" style={{
                        backgroundColor: SOURCE_BADGES[exp.source_type].color + '15',
                        color: SOURCE_BADGES[exp.source_type].color
                      }}>
                        {SOURCE_BADGES[exp.source_type].icon} {SOURCE_BADGES[exp.source_type].label}
                      </span>
                    )}
                    {exp.category && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black" style={{ backgroundColor: exp.category.color + '15', color: exp.category.color }}>
                        {exp.category.icon} {exp.category.name}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                      exp.account_type === 'personal'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {exp.account_type === 'personal' ? '👤' : '🏢'}
                    </span>
                    {exp.entity === 'TD CONSULTING' && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/15 text-blue-400">TDC</span>
                    )}
                  </div>

                  {/* Row 4: Amount */}
                  <div className="mt-4 pt-3 border-t border-primary/5">
                    <p className={`text-xl font-black tabular-nums ${isRevenue ? 'text-emerald-400' : 'text-primary'}`}>
                      {isRevenue ? '+' : ''}{fmtVND(toVND(exp.amount, exp.currency))}
                    </p>
                  </div>

                  {/* Approval info */}
                  {exp.approved_at && (
                    <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider">
                        {exp.status === 'approved' ? '✅' : '❌'} {exp.approver_id} · {new Date(exp.approved_at).toLocaleDateString('vi-VN')}
                        {exp.approval_note ? ` — ${exp.approval_note}` : ''}
                      </p>
                    </div>
                  )}

                  {/* Approval buttons — chỉ hiện cho admin/ke_toan với expense pending */}
                  {canApprove && exp.status === 'pending' && !isRevenue && (
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => onApprove(exp.id!)}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/25 transition-colors">
                        ✅ Duyệt
                      </button>
                      <button
                        onClick={() => setRejectModal({ id: exp.id!, note: '' })}
                        className="flex-1 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-black uppercase tracking-wider hover:bg-red-500/25 transition-colors">
                        ❌ Từ chối
                      </button>
                    </div>
                  )}

                  {/* Action bar — visible on hover */}
                  <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-primary/5 opacity-40 group-hover:opacity-100 transition-opacity">
                    {!isAutoSynced && (
                      <>
                        <button onClick={() => onEdit(exp)} title="Sửa" className="p-2 rounded-lg transition-colors hover:bg-white/5 hover:text-primary">
                          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <div className="w-px h-5 mx-0.5 bg-white/10" />
                        {deleteConfirm === exp.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => { onDelete(exp.id!); setDeleteConfirm(null); }} className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider">Xoá</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 text-[10px] font-black uppercase tracking-wider">Huỷ</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(exp.id!)} title="Xoá" className="p-2 rounded-lg transition-colors text-red-500/50 hover:text-red-400 hover:bg-red-500/10">
                            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        )}
                      </>
                    )}
                    {isAutoSynced && (
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">🔒 Auto-synced</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal từ chối ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#161616] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-black text-white mb-1">❌ Từ chối chi phí</h3>
            <p className="text-[11px] text-white/50 mb-4">Vui lòng nhập lý do từ chối để thông báo cho người tạo.</p>
            <textarea
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-white/25 resize-none"
              rows={3}
              placeholder="Lý do từ chối..."
              value={rejectModal.note}
              onChange={e => setRejectModal({ ...rejectModal, note: e.target.value })}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { onReject(rejectModal.id, rejectModal.note); setRejectModal(null); }}
                disabled={!rejectModal.note.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-xs font-black uppercase tracking-wider hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Xác nhận từ chối
              </button>
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors">
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseList;
