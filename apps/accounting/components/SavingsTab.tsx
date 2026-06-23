import React, { useState, useMemo } from 'react';
import { SavingsDeposit } from '@/types';
import {
  addSaving, settleSaving, renewSaving, deleteSaving,
  calcMaturityDate, daysUntilMaturity,
} from '../services/savingsService';

interface Props {
  savings: SavingsDeposit[];
  currentUser: string;
  onReload: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const today = new Date().toISOString().slice(0, 10);

// ── Status Badge ─────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: 'Đang gửi',   color: '#4CAF50' },
  matured:   { label: 'Đã đáo hạn', color: '#FFA726' },
  withdrawn: { label: 'Đã tất toán', color: '#9D9C9D' },
  renewed:   { label: 'Đã tái tục', color: '#2196F3' },
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

// ── Days Badge ───────────────────────────────────

function DaysBadge({ maturityDate }: { maturityDate: string }) {
  const days = daysUntilMaturity(maturityDate);
  if (days < 0)  return <span className="text-[10px] font-black text-red-400">Quá {Math.abs(days)} ngày</span>;
  if (days === 0) return <span className="text-[10px] font-black text-red-400">Hôm nay</span>;
  if (days <= 7)  return <span className="text-[10px] font-black text-orange-400">{days} ngày</span>;
  if (days <= 30) return <span className="text-[10px] font-black text-yellow-400">{days} ngày</span>;
  return <span className="text-[10px] text-neutral-500">{days} ngày</span>;
}

// ── Add Form Modal ───────────────────────────────

interface AddFormProps {
  currentUser: string;
  onSave: (s: SavingsDeposit) => void;
  onClose: () => void;
}

const BLANK_FORM = {
  bank_name: '', account_number: '', principal: '',
  currency: 'VND' as const, interest_rate: '', term_months: '3',
  start_date: today, notes: '',
};

function AddForm({ currentUser, onSave, onClose }: AddFormProps) {
  const [f, setF] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const maturityDate = f.start_date && f.term_months
    ? calcMaturityDate(f.start_date, Number(f.term_months))
    : '';

  const handleSubmit = async () => {
    if (!f.bank_name.trim()) { setErr('Nhập tên ngân hàng'); return; }
    if (!f.principal || Number(f.principal) <= 0) { setErr('Nhập số tiền gốc'); return; }
    if (!f.interest_rate || Number(f.interest_rate) <= 0) { setErr('Nhập lãi suất'); return; }
    if (!f.start_date) { setErr('Chọn ngày gửi'); return; }
    setSaving(true); setErr('');
    try {
      const result = await addSaving({
        bank_name: f.bank_name.trim(),
        account_number: f.account_number.trim() || undefined,
        principal: Number(f.principal),
        currency: f.currency,
        interest_rate: Number(f.interest_rate),
        term_months: Number(f.term_months),
        start_date: f.start_date,
        maturity_date: maturityDate,
        status: 'active',
        notes: f.notes.trim() || undefined,
        created_by: currentUser,
      });
      onSave(result);
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

  const input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
      style={{ background: '#1a1a1a' }}
    />
  );

  const select = (props: React.SelectHTMLAttributes<HTMLSelectElement>, children: React.ReactNode) => (
    <select
      {...props}
      className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
      style={{ background: '#1a1a1a' }}
    >
      {children}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-2xl border border-white/10 p-6 w-full max-w-md space-y-4 animate-scaleIn"
        style={{ background: '#1A1A1A' }}>
        <h3 className="text-sm font-black uppercase tracking-wider text-white">+ Gửi tiết kiệm mới</h3>

        <div className="grid grid-cols-2 gap-4">
          {field('Ngân hàng *',
            input({ value: f.bank_name, onChange: e => setF(p => ({ ...p, bank_name: e.target.value })), placeholder: 'VD: Vietcombank' })
          )}
          {field('Số tài khoản',
            input({ value: f.account_number, onChange: e => setF(p => ({ ...p, account_number: e.target.value })), placeholder: 'Tuỳ chọn' })
          )}
          {field('Số tiền gốc *',
            input({ type: 'number', value: f.principal, onChange: e => setF(p => ({ ...p, principal: e.target.value })), placeholder: '0', min: 0 })
          )}
          {field('Loại tiền',
            select({ value: f.currency, onChange: e => setF(p => ({ ...p, currency: e.target.value as 'VND' | 'USD' })) },
              <><option value="VND">VND</option><option value="USD">USD</option></>
            )
          )}
          {field('Lãi suất (%/năm) *',
            input({ type: 'number', value: f.interest_rate, onChange: e => setF(p => ({ ...p, interest_rate: e.target.value })), placeholder: 'VD: 5.5', step: '0.1' })
          )}
          {field('Kỳ hạn (tháng)',
            select({ value: f.term_months, onChange: e => setF(p => ({ ...p, term_months: e.target.value })) },
              [1,2,3,6,9,12,18,24,36].map(m => <option key={m} value={m}>{m} tháng</option>)
            )
          )}
          {field('Ngày gửi *',
            input({ type: 'date', value: f.start_date, onChange: e => setF(p => ({ ...p, start_date: e.target.value })) })
          )}
          {field('Ngày đáo hạn (tự tính)',
            <div className="px-3 py-2 rounded-xl text-sm border border-white/5 text-neutral-400 font-mono" style={{ background: '#111' }}>
              {maturityDate || '—'}
            </div>
          )}
        </div>

        {field('Ghi chú',
          <input
            value={f.notes}
            onChange={e => setF(p => ({ ...p, notes: e.target.value }))}
            placeholder="Tuỳ chọn..."
            className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
            style={{ background: '#1a1a1a' }}
          />
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

// ── Settle Modal ─────────────────────────────────

interface SettleModalProps {
  saving: SavingsDeposit;
  currentUser: string;
  onDone: () => void;
  onClose: () => void;
}

function SettleModal({ saving, currentUser, onDone, onClose }: SettleModalProps) {
  const estimatedInterest = saving.principal * (saving.interest_rate / 100) * (saving.term_months / 12);
  const [interest, setInterest] = useState(String(Math.round(estimatedInterest)));
  const [saving2, setSaving2] = useState(false);
  const [err, setErr] = useState('');

  const handleSettle = async () => {
    const interestVal = Number(interest.replace(/[^\d.]/g, ''));
    if (isNaN(interestVal) || interestVal < 0) { setErr('Nhập lãi thực nhận (có thể = 0)'); return; }
    setSaving2(true); setErr('');
    try {
      await settleSaving(saving.id!, interestVal, currentUser, saving);
      onDone();
    } catch (e: any) {
      setErr(e.message || 'Lỗi tất toán');
    } finally {
      setSaving2(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-2xl border border-white/10 p-6 w-full max-w-sm space-y-4 animate-scaleIn"
        style={{ background: '#1A1A1A' }}>
        <h3 className="text-sm font-black uppercase tracking-wider text-white">Tất toán tiết kiệm</h3>
        <div className="rounded-xl border border-white/5 p-3 space-y-1" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{saving.bank_name}</p>
          <p className="text-sm font-semibold text-white">{fmt(saving.principal)} {saving.currency}</p>
          <p className="text-xs text-neutral-400">{saving.term_months}T · {saving.interest_rate}%/năm</p>
          <p className="text-xs text-neutral-500">Lãi ước tính: {fmt(estimatedInterest)} {saving.currency}</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Lãi thực nhận ({saving.currency})</label>
          <input
            type="number" value={interest}
            onChange={e => setInterest(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
            style={{ background: '#1a1a1a' }}
            min={0}
          />
          <p className="text-[10px] text-neutral-600">
            Tổng thu về: {fmt(saving.principal + Number(interest || 0))} {saving.currency}
          </p>
        </div>

        {err && <p className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={handleSettle} disabled={saving2}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}>
            {saving2 ? 'Đang xử lý...' : '✓ Xác nhận tất toán'}
          </button>
          <button onClick={onClose} disabled={saving2}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
            Huỷ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Renew Modal ──────────────────────────────────

interface RenewModalProps {
  saving: SavingsDeposit;
  currentUser: string;
  onDone: () => void;
  onClose: () => void;
}

function RenewModal({ saving, currentUser, onDone, onClose }: RenewModalProps) {
  const [termMonths, setTermMonths] = useState(String(saving.term_months));
  const [interestRate, setInterestRate] = useState(String(saving.interest_rate));
  const [startDate, setStartDate] = useState(saving.maturity_date);
  const [saving2, setSaving2] = useState(false);
  const [err, setErr] = useState('');

  const newMaturity = startDate && termMonths ? calcMaturityDate(startDate, Number(termMonths)) : '';

  const handleRenew = async () => {
    if (!interestRate || Number(interestRate) <= 0) { setErr('Nhập lãi suất mới'); return; }
    setSaving2(true); setErr('');
    try {
      await renewSaving(
        saving.id!,
        {
          bank_name: saving.bank_name,
          account_number: saving.account_number,
          principal: saving.principal,
          currency: saving.currency,
          interest_rate: Number(interestRate),
          term_months: Number(termMonths),
          start_date: startDate,
          maturity_date: newMaturity,
          status: 'active',
          notes: saving.notes,
          parent_id: saving.id,
          created_by: currentUser,
        },
        currentUser,
        saving
      );
      onDone();
    } catch (e: any) {
      setErr(e.message || 'Lỗi tái tục');
    } finally {
      setSaving2(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-2xl border border-white/10 p-6 w-full max-w-sm space-y-4 animate-scaleIn"
        style={{ background: '#1A1A1A' }}>
        <h3 className="text-sm font-black uppercase tracking-wider text-white">Tái tục tiết kiệm</h3>
        <div className="rounded-xl border border-white/5 p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{saving.bank_name}</p>
          <p className="text-sm font-semibold text-white">{fmt(saving.principal)} {saving.currency}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Kỳ hạn mới</label>
            <select value={termMonths} onChange={e => setTermMonths(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}>
              {[1,2,3,6,9,12,18,24,36].map(m => <option key={m} value={m}>{m} tháng</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Lãi suất (%/năm)</label>
            <input type="number" value={interestRate}
              onChange={e => setInterestRate(e.target.value)}
              step="0.1" min={0}
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Ngày bắt đầu mới</label>
            <input type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Đáo hạn mới</label>
            <div className="px-3 py-2 rounded-xl text-sm border border-white/5 text-neutral-400 font-mono" style={{ background: '#111' }}>
              {newMaturity || '—'}
            </div>
          </div>
        </div>

        {err && <p className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={handleRenew} disabled={saving2}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}>
            {saving2 ? 'Đang xử lý...' : '↻ Tái tục'}
          </button>
          <button onClick={onClose} disabled={saving2}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
            Huỷ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────

export default function SavingsTab({ savings, currentUser, onReload, onToast }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [settling, setSettling] = useState<SavingsDeposit | null>(null);
  const [renewing, setRenewing] = useState<SavingsDeposit | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Tổng tiền đang gửi (active)
  const activeSavings = useMemo(() => savings.filter(s => s.status === 'active'), [savings]);
  const totalActive = activeSavings.reduce((s, r) => s + (r.currency === 'VND' ? r.principal : 0), 0);
  const totalActiveUsd = activeSavings.reduce((s, r) => s + (r.currency === 'USD' ? r.principal : 0), 0);
  const totalInterestEarned = savings
    .filter(s => s.status === 'withdrawn' && s.interest_earned)
    .reduce((s, r) => s + (r.interest_earned || 0), 0);

  // Warning: sắp đáo hạn trong 30 ngày
  const soonMaturing = activeSavings.filter(s => {
    const days = daysUntilMaturity(s.maturity_date);
    return days >= 0 && days <= 30;
  });
  const overdue = activeSavings.filter(s => daysUntilMaturity(s.maturity_date) < 0);

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá bản ghi gửi tiết kiệm này? Thao tác không thể hoàn tác.')) return;
    setDeleting(id);
    try {
      await deleteSaving(id);
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
      {/* Warning banners */}
      {overdue.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border"
          style={{ background: 'rgba(244,67,54,0.10)', borderColor: '#F44336' }}>
          <span className="text-sm font-black text-red-400">
            🚨 {overdue.length} khoản tiết kiệm đã quá đáo hạn — cần tất toán hoặc tái tục ngay!
          </span>
        </div>
      )}
      {soonMaturing.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border"
          style={{ background: 'rgba(255,149,0,0.08)', borderColor: 'rgba(255,149,0,0.4)' }}>
          <span className="text-sm font-black text-orange-400">
            ⏰ {soonMaturing.length} khoản sắp đáo hạn trong 30 ngày tới:&nbsp;
            {soonMaturing.map(s => `${s.bank_name} (${daysUntilMaturity(s.maturity_date)}N)`).join(' · ')}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Gửi tiết kiệm</h2>
          <p className="text-neutral-medium text-sm mt-1">Theo dõi các khoản tiền gửi có kỳ hạn</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all"
          style={{ background: '#FF9500' }}>
          + Thêm khoản gửi
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Đang gửi (VND)', value: fmt(totalActive), unit: 'đ', color: 'text-orange-400' },
          { label: 'Đang gửi (USD)', value: fmt(totalActiveUsd), unit: '$', color: 'text-blue-400' },
          { label: 'Số khoản active', value: String(activeSavings.length), unit: 'khoản', color: 'text-white' },
          { label: 'Lãi đã nhận (VND)', value: fmt(totalInterestEarned), unit: 'đ', color: 'text-green-400' },
        ].map(card => (
          <div key={card.label} className="rounded-[20px] border border-primary/10 bg-surface p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-2">{card.label}</div>
            <div className={`text-2xl font-black ${card.color}`}>{card.value}</div>
            <div className="text-[10px] text-neutral-600 mt-0.5">{card.unit}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {savings.length === 0 ? (
        <div className="text-center py-16 text-neutral-700 text-sm rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-3xl mb-3">💰</p>
          <p className="text-neutral-600 text-sm">Chưa có khoản gửi tiết kiệm nào</p>
          <p className="text-xs mt-1 text-neutral-700">Nhấn "+ Thêm khoản gửi" để bắt đầu theo dõi</p>
        </div>
      ) : (
        <div className="rounded-[20px] border border-primary/10 bg-surface overflow-x-auto">
          <table className="text-xs w-full" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="border-b border-white/5">
                {['Ngân hàng', 'Số tiền', 'Lãi suất', 'Kỳ hạn', 'Ngày gửi', 'Ngày đáo hạn', 'Còn lại', 'Trạng thái', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {savings.map(s => (
                <tr key={s.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{s.bank_name}</div>
                    {s.account_number && <div className="text-neutral-600 font-mono text-[10px] mt-0.5">{s.account_number}</div>}
                  </td>
                  <td className="px-4 py-3 text-white font-mono whitespace-nowrap">
                    {fmt(s.principal)} <span className="text-neutral-500">{s.currency}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-300 whitespace-nowrap">{s.interest_rate}%/năm</td>
                  <td className="px-4 py-3 text-neutral-300 whitespace-nowrap">{s.term_months}T</td>
                  <td className="px-4 py-3 text-neutral-400 font-mono whitespace-nowrap">{s.start_date}</td>
                  <td className="px-4 py-3 text-neutral-400 font-mono whitespace-nowrap">{s.maturity_date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s.status === 'active' ? <DaysBadge maturityDate={s.maturity_date} /> : <span className="text-neutral-600">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.status === 'active' && (
                        <>
                          <button onClick={() => setSettling(s)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all whitespace-nowrap">
                            Tất toán
                          </button>
                          <button onClick={() => setRenewing(s)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all whitespace-nowrap">
                            Tái tục
                          </button>
                        </>
                      )}
                      <button onClick={() => handleDelete(s.id!)} disabled={deleting === s.id}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400/60 border border-red-500/15 hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-30">
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddForm
          currentUser={currentUser}
          onSave={() => { setShowAdd(false); onToast('Đã thêm khoản gửi tiết kiệm'); onReload(); }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {settling && (
        <SettleModal
          saving={settling}
          currentUser={currentUser}
          onDone={() => { setSettling(null); onToast('Đã tất toán thành công'); onReload(); }}
          onClose={() => setSettling(null)}
        />
      )}
      {renewing && (
        <RenewModal
          saving={renewing}
          currentUser={currentUser}
          onDone={() => { setRenewing(null); onToast('Đã tái tục thành công'); onReload(); }}
          onClose={() => setRenewing(null)}
        />
      )}
    </div>
  );
}
