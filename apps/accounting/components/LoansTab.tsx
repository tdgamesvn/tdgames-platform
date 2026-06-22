import React, { useState, useMemo } from 'react';
import { LoanRecord } from '@/types';
import {
  addLoan, recordLoanRepayment, markLoanPaidOff, deleteLoan,
  calcDueDate,
} from '../services/loansService';

interface Props {
  loans: LoanRecord[];
  currentUser: string;
  onReload: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const today = new Date().toISOString().slice(0, 10);

// ── Status Badge ─────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:   { label: 'Đang vay',   color: '#4CAF50' },
  overdue:  { label: 'Quá hạn',    color: '#F44336' },
  paid_off: { label: 'Đã tất toán', color: '#9D9C9D' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#9D9C9D' };
  return (
    <span
      className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg whitespace-nowrap"
      style={{ background: `${cfg.color}20`, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

// ── Add Form Modal ───────────────────────────────

interface AddFormProps {
  currentUser: string;
  onSave: () => void;
  onClose: () => void;
}

const BLANK = {
  lender_name: '', principal: '', currency: 'VND' as const,
  interest_rate: '', term_months: '12', start_date: today, notes: '',
};

function AddForm({ currentUser, onSave, onClose }: AddFormProps) {
  const [f, setF] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const dueDate = f.start_date && f.term_months ? calcDueDate(f.start_date, Number(f.term_months)) : '';

  const handleSubmit = async () => {
    if (!f.lender_name.trim()) { setErr('Nhập tên bên cho vay'); return; }
    if (!f.principal || Number(f.principal) <= 0) { setErr('Nhập số tiền vay'); return; }
    if (!f.interest_rate || Number(f.interest_rate) < 0) { setErr('Nhập lãi suất'); return; }
    if (!f.start_date) { setErr('Chọn ngày vay'); return; }
    setSaving(true); setErr('');
    try {
      await addLoan({
        lender_name: f.lender_name.trim(),
        principal: Number(f.principal),
        currency: f.currency,
        interest_rate: Number(f.interest_rate),
        term_months: Number(f.term_months),
        start_date: f.start_date,
        due_date: dueDate,
        outstanding: Number(f.principal),
        status: 'active',
        notes: f.notes.trim() || undefined,
        created_by: currentUser,
      });
      onSave();
    } catch (e: any) {
      setErr(e.message || 'Lỗi lưu dữ liệu');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, node: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">{label}</label>
      {node}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-2xl border border-white/10 p-6 w-full max-w-md space-y-4 animate-scaleIn"
        style={{ background: '#1A1A1A' }}>
        <h3 className="text-sm font-black uppercase tracking-wider text-white">+ Khoản vay mới</h3>

        <div className="grid grid-cols-2 gap-4">
          {field('Bên cho vay *',
            <input value={f.lender_name} onChange={e => setF(p => ({ ...p, lender_name: e.target.value }))}
              placeholder="VD: BIDV, Cá nhân..."
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }} />
          )}
          {field('Loại tiền',
            <select value={f.currency} onChange={e => setF(p => ({ ...p, currency: e.target.value as 'VND' | 'USD' }))}
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}>
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          )}
          {field('Số tiền vay *',
            <input type="number" value={f.principal} onChange={e => setF(p => ({ ...p, principal: e.target.value }))}
              placeholder="0" min={0}
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }} />
          )}
          {field('Lãi suất (%/năm) *',
            <input type="number" value={f.interest_rate} onChange={e => setF(p => ({ ...p, interest_rate: e.target.value }))}
              placeholder="VD: 8.5" step="0.1" min={0}
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }} />
          )}
          {field('Kỳ hạn (tháng)',
            <select value={f.term_months} onChange={e => setF(p => ({ ...p, term_months: e.target.value }))}
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}>
              {[1,2,3,6,9,12,18,24,36,60].map(m => <option key={m} value={m}>{m} tháng</option>)}
            </select>
          )}
          {field('Ngày vay *',
            <input type="date" value={f.start_date} onChange={e => setF(p => ({ ...p, start_date: e.target.value }))}
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }} />
          )}
          {field('Ngày đáo hạn (tự tính)',
            <div className="px-3 py-2 rounded-xl text-sm border border-white/5 text-neutral-400 font-mono" style={{ background: '#111' }}>
              {dueDate || '—'}
            </div>
          )}
        </div>

        {field('Ghi chú',
          <input value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))}
            placeholder="Tuỳ chọn..."
            className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
            style={{ background: '#1a1a1a' }} />
        )}

        {err && <p className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}>
            {saving ? 'Đang lưu...' : '✓ Lưu'}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
            Huỷ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Repayment Modal ──────────────────────────────

interface RepayModalProps {
  loan: LoanRecord;
  currentUser: string;
  onDone: () => void;
  onClose: () => void;
}

function RepayModal({ loan, currentUser, onDone, onClose }: RepayModalProps) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const remaining = loan.outstanding - Number(amount || 0);

  const handleRepay = async () => {
    const amt = Number(amount.replace(/[^\d.]/g, ''));
    if (!amt || amt <= 0) { setErr('Nhập số tiền trả'); return; }
    if (amt > loan.outstanding) { setErr(`Số tiền không được vượt dư nợ (${fmt(loan.outstanding)})`); return; }
    setSaving(true); setErr('');
    try {
      await recordLoanRepayment(loan.id!, amt, loan, currentUser);
      onDone();
    } catch (e: any) {
      setErr(e.message || 'Lỗi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-2xl border border-white/10 p-6 w-full max-w-sm space-y-4 animate-scaleIn"
        style={{ background: '#1A1A1A' }}>
        <h3 className="text-sm font-black uppercase tracking-wider text-white">Cập nhật trả nợ</h3>
        <div className="rounded-xl border border-white/5 p-3 space-y-1" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{loan.lender_name}</p>
          <p className="text-sm font-semibold text-white">Dư nợ hiện tại: {fmt(loan.outstanding)} {loan.currency}</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Số tiền trả ({loan.currency})</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0" min={0} max={loan.outstanding}
            className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
            style={{ background: '#1a1a1a' }} />
          {amount && Number(amount) > 0 && (
            <p className="text-[10px] text-neutral-500">
              Dư nợ còn lại: <span className={remaining <= 0 ? 'text-green-400 font-black' : 'text-white'}>{fmt(Math.max(0, remaining))} {loan.currency}</span>
              {remaining <= 0 && ' — Tất toán hoàn toàn!'}
            </p>
          )}
        </div>

        {err && <p className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={handleRepay} disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}>
            {saving ? 'Đang xử lý...' : '✓ Xác nhận trả'}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
            Huỷ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────

export default function LoansTab({ loans, currentUser, onReload, onToast }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [repaying, setRepaying] = useState<LoanRecord | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const activeLoans = useMemo(() => loans.filter(l => l.status === 'active' || l.status === 'overdue'), [loans]);
  const totalOutstanding = activeLoans.reduce((s, l) => s + (l.currency === 'VND' ? l.outstanding : 0), 0);
  const totalOutstandingUsd = activeLoans.reduce((s, l) => s + (l.currency === 'USD' ? l.outstanding : 0), 0);
  const totalPrincipal = activeLoans.reduce((s, l) => s + (l.currency === 'VND' ? l.principal : 0), 0);

  const overdueLoans = activeLoans.filter(l => l.due_date < today);

  const handleMarkPaidOff = async (loan: LoanRecord) => {
    if (!confirm(`Đánh dấu khoản vay "${loan.lender_name}" đã tất toán?`)) return;
    try {
      await markLoanPaidOff(loan.id!);
      onToast('Đã tất toán khoản vay');
      onReload();
    } catch (e: any) {
      onToast(e.message || 'Lỗi', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá bản ghi khoản vay này?')) return;
    setDeleting(id);
    try {
      await deleteLoan(id);
      onToast('Đã xoá bản ghi');
      onReload();
    } catch (e: any) {
      onToast(e.message || 'Lỗi xoá', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Warning banner — quá hạn */}
      {overdueLoans.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border"
          style={{ background: 'rgba(244,67,54,0.10)', borderColor: '#F44336' }}>
          <span className="text-sm font-black text-red-400">
            🚨 {overdueLoans.length} khoản vay đã quá hạn:&nbsp;
            {overdueLoans.map(l => l.lender_name).join(', ')}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Vay nợ</h2>
          <p className="text-neutral-medium text-sm mt-1">Theo dõi dư nợ và lịch trả nợ</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all"
          style={{ background: '#FF9500' }}>
          + Thêm khoản vay
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Dư nợ hiện tại (VND)', value: fmt(totalOutstanding), unit: 'đ', color: 'text-red-400' },
          { label: 'Dư nợ hiện tại (USD)', value: fmt(totalOutstandingUsd), unit: '$', color: 'text-red-400' },
          { label: 'Gốc vay (VND)', value: fmt(totalPrincipal), unit: 'đ', color: 'text-orange-400' },
          { label: 'Số khoản active', value: String(activeLoans.length), unit: 'khoản', color: 'text-white' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-2">{card.label}</div>
            <div className={`text-2xl font-black ${card.color}`}>{card.value}</div>
            <div className="text-[10px] text-neutral-600 mt-0.5">{card.unit}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loans.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-white/8"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-3xl mb-3">🏧</p>
          <p className="text-neutral-600 text-sm">Chưa có khoản vay nào</p>
          <p className="text-xs mt-1 text-neutral-700">Nhấn "+ Thêm khoản vay" để theo dõi</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <table className="text-xs w-full" style={{ minWidth: '960px' }}>
            <thead>
              <tr className="border-b border-white/5">
                {['Bên cho vay', 'Gốc vay', 'Dư nợ', 'Lãi suất', 'Kỳ hạn', 'Ngày vay', 'Đáo hạn', 'Trạng thái', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loans.map(l => {
                const isOverdue = (l.status === 'active') && l.due_date < today;
                return (
                  <tr key={l.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{l.lender_name}</div>
                      {l.notes && <div className="text-neutral-600 text-[10px] mt-0.5 truncate max-w-[140px]">{l.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-neutral-300 font-mono whitespace-nowrap">{fmt(l.principal)} <span className="text-neutral-500">{l.currency}</span></td>
                    <td className="px-4 py-3 font-mono font-black whitespace-nowrap">
                      <span className={l.status === 'paid_off' ? 'text-neutral-600' : l.outstanding > 0 ? 'text-red-400' : 'text-green-400'}>
                        {fmt(l.outstanding)} <span className="text-neutral-500 font-normal">{l.currency}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-300 whitespace-nowrap">{l.interest_rate}%/năm</td>
                    <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">{l.term_months}T</td>
                    <td className="px-4 py-3 text-neutral-400 font-mono whitespace-nowrap">{l.start_date}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      <span className={isOverdue ? 'text-red-400 font-black' : 'text-neutral-400'}>{l.due_date}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={isOverdue ? 'overdue' : l.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(l.status === 'active' || l.status === 'overdue' || isOverdue) && l.outstanding > 0 && (
                          <>
                            <button onClick={() => setRepaying(l)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all whitespace-nowrap">
                              Cập nhật dư nợ
                            </button>
                            <button onClick={() => handleMarkPaidOff(l)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all whitespace-nowrap">
                              Tất toán
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDelete(l.id!)} disabled={deleting === l.id}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400/60 border border-red-500/15 hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-30">
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddForm
          currentUser={currentUser}
          onSave={() => { setShowAdd(false); onToast('Đã thêm khoản vay mới'); onReload(); }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {repaying && (
        <RepayModal
          loan={repaying}
          currentUser={currentUser}
          onDone={() => { setRepaying(null); onToast('Đã cập nhật dư nợ'); onReload(); }}
          onClose={() => setRepaying(null)}
        />
      )}
    </div>
  );
}
