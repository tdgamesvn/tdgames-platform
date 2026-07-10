import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { BhxhEmployee, BhxhPayment } from '../services/accountingService';
import { fetchBhxhPayment, saveBhxhPayment, deleteBhxhPayment } from '../services/accountingService';
import {
  fetchPayrollFormulaForMonth,
  FALLBACK_PAYROLL_FORMULA,
} from '../../payroll/services/payrollFormulaService';
import type { PayrollFormulaConfig } from '@/types';

interface Props {
  employees: BhxhEmployee[];
  currentUser: string;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const now = new Date();

// ── Helpers ───────────────────────────────────────────────────

function isProbationaryInMonth(emp: BhxhEmployee, year: number, month: number): boolean {
  if (!emp.official_date) return true;
  const monthStart = new Date(year, month - 1, 1);
  return new Date(emp.official_date) > monthStart;
}

/** Số ngày còn đến ngày 25 của tháng/năm đang xem */
function daysUntilDeadline(month: number, year: number): number {
  const deadline = new Date(year, month - 1, 25);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
}

interface BhxhRow {
  stt: number;
  employee_code: string;
  full_name: string;
  department_name: string | null;
  insurance_number: string;
  bhxh_base: number;
  employee_contrib: number;
  company_contrib: number;
  total: number;
  note: string;
}

function computeRows(
  employees: BhxhEmployee[],
  formula: PayrollFormulaConfig,
  year: number,
  month: number,
): BhxhRow[] {
  const r = (v: number) => Math.round(v);
  let stt = 0;
  return employees
    .filter(emp => !isProbationaryInMonth(emp, year, month))
    .map(emp => {
      stt++;
      const base = emp.bhxh_base;
      const empContrib = r(base * formula.bhEmployeeRate);
      const compContrib = r(base * formula.bhCompanyRate);
      let note = '';
      if (emp.start_date) {
        const start = new Date(emp.start_date);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        if (start >= monthStart && start <= monthEnd) {
          note = `Mới vào ${start.getDate()}/${month}`;
        }
      }
      return {
        stt,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department_name: emp.department_name,
        insurance_number: emp.insurance_number,
        bhxh_base: base,
        employee_contrib: empContrib,
        company_contrib: compContrib,
        total: empContrib + compContrib,
        note,
      };
    });
}

function exportExcel(rows: BhxhRow[], formula: PayrollFormulaConfig, month: number, year: number) {
  const data: any[][] = [];
  data.push(['TD GAMES COMPANY LIMITED']);
  data.push([`BẢNG KÊ NỘP BẢO HIỂM XÃ HỘI THÁNG ${month}/${year}`]);
  data.push([`Hạn nộp: Trước ngày 25/${month}/${year}`]);
  data.push([]);
  data.push([
    'STT', 'Mã NV', 'Họ và tên', 'Phòng ban', 'Mã số BHXH',
    'Lương đóng BH',
    `NV đóng (${(formula.bhEmployeeRate * 100).toFixed(2)}%)`,
    `Công ty đóng (${(formula.bhCompanyRate * 100).toFixed(2)}%)`,
    'Tổng đóng', 'Ghi chú',
  ]);
  rows.forEach(r => {
    data.push([r.stt, r.employee_code, r.full_name, r.department_name || '',
      r.insurance_number, r.bhxh_base, r.employee_contrib, r.company_contrib, r.total, r.note]);
  });
  data.push([]);
  data.push(['', '', 'TỔNG CỘNG', '', '',
    rows.reduce((s, r) => s + r.bhxh_base, 0),
    rows.reduce((s, r) => s + r.employee_contrib, 0),
    rows.reduce((s, r) => s + r.company_contrib, 0),
    rows.reduce((s, r) => s + r.total, 0), '']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 20 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `BHXH_T${month}_${year}`);
  XLSX.writeFile(wb, `Bang_Ke_BHXH_T${month}_${year}.xlsx`);
}

// ── Mark Paid Modal ───────────────────────────────────────────

interface MarkPaidFormProps {
  month: number;
  year: number;
  suggestedAmount: number;
  currentUser: string;
  existing: BhxhPayment | null;
  onSave: (payment: BhxhPayment) => void;
  onDelete: () => void;
  onClose: () => void;
}

function MarkPaidForm({ month, year, suggestedAmount, currentUser, existing, onSave, onDelete, onClose }: MarkPaidFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState(existing ? String(existing.total_amount) : String(suggestedAmount));
  const [paidDate, setPaidDate] = useState(existing?.paid_date || today);
  const [notes, setNotes] = useState(existing?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const amt = Number(amount.replace(/[^\d]/g, ''));
    if (!amt || !paidDate) { setError('Vui lòng nhập đủ số tiền và ngày nộp'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await saveBhxhPayment(month, year, {
        total_amount: amt,
        paid_date: paidDate,
        paid_by: currentUser,
        notes,
      });
      onSave(result);
    } catch (e: any) {
      setError(e.message || 'Lỗi lưu dữ liệu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Xoá trạng thái đã nộp?')) return;
    setSaving(true);
    try {
      await deleteBhxhPayment(month, year);
      onDelete();
    } catch (e: any) {
      setError(e.message || 'Lỗi xoá dữ liệu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-[20px] border border-primary/10 p-6 w-full max-w-sm space-y-4"
        style={{ background: '#1A1A1A' }}>
        <h3 className="text-sm font-black uppercase tracking-wider text-white">
          {existing ? 'Cập nhật' : 'Đánh dấu đã nộp'} BHXH tháng {month}/{year}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Số tiền đã nộp (đ)</label>
            <input
              type="text"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-orange-500/50"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Ngày nộp</label>
            <input
              type="date"
              value={paidDate}
              onChange={e => setPaidDate(e.target.value)}
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Ghi chú</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
              placeholder="VD: Chuyển khoản VCB..."
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-primary text-black hover:opacity-90 transition-opacity disabled:opacity-40">
            {saving ? 'Đang lưu...' : '✓ Xác nhận'}
          </button>
          {existing && (
            <button onClick={handleDelete} disabled={saving}
              className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border border-red-500/30 text-red-400 hover:border-red-500/60 transition-colors">
              Xoá
            </button>
          )}
          <button onClick={onClose} disabled={saving}
            className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border border-white/10 text-neutral-400 hover:border-white/20 transition-colors">
            Huỷ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────

export default function BhxhTab({ employees, currentUser }: Props) {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [formula, setFormula] = useState<PayrollFormulaConfig>(FALLBACK_PAYROLL_FORMULA);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [payment, setPayment] = useState<BhxhPayment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);

  // Fetch formula khi thay đổi tháng/năm
  useEffect(() => {
    let cancelled = false;
    setFormulaLoading(true);
    fetchPayrollFormulaForMonth(month, year)
      .then(({ config }) => { if (!cancelled) setFormula(config); })
      .catch(() => { if (!cancelled) setFormula(FALLBACK_PAYROLL_FORMULA); })
      .finally(() => { if (!cancelled) setFormulaLoading(false); });
    return () => { cancelled = true; };
  }, [month, year]);

  // Fetch payment status khi thay đổi tháng/năm
  useEffect(() => {
    let cancelled = false;
    setPaymentLoading(true);
    setPayment(null);
    fetchBhxhPayment(month, year)
      .then(data => { if (!cancelled) setPayment(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPaymentLoading(false); });
    return () => { cancelled = true; };
  }, [month, year]);

  const rows = useMemo(
    () => computeRows(employees, formula, year, month),
    [employees, formula, year, month],
  );

  const totalEmp = rows.reduce((s, r) => s + r.employee_contrib, 0);
  const totalComp = rows.reduce((s, r) => s + r.company_contrib, 0);
  const totalAll = rows.reduce((s, r) => s + r.total, 0);
  const totalBase = rows.reduce((s, r) => s + r.bhxh_base, 0);
  const probationaryCount = employees.filter(emp => isProbationaryInMonth(emp, year, month)).length;

  // Countdown logic — chỉ hiện khi đang xem tháng hiện tại
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const daysLeft = isCurrentMonth ? daysUntilDeadline(month, year) : null;

  const deadlineBanner = (() => {
    if (!isCurrentMonth || payment) return null; // Đã nộp → không hiện
    if (daysLeft === null) return null;
    if (daysLeft < 0) return { bg: 'rgba(244,67,54,0.12)', border: '#F44336', color: '#F44336', text: `Đã quá hạn nộp BHXH tháng ${month}/${year} (${Math.abs(daysLeft)} ngày)!` };
    if (daysLeft === 0) return { bg: 'rgba(244,67,54,0.12)', border: '#F44336', color: '#F44336', text: `Hôm nay là hạn cuối nộp BHXH tháng ${month}/${year}!` };
    if (daysLeft <= 3) return { bg: 'rgba(244,67,54,0.10)', border: '#F44336', color: '#F44336', text: `⚠️ Còn ${daysLeft} ngày đến hạn nộp BHXH (ngày 25/${month})` };
    if (daysLeft <= 7) return { bg: 'rgba(255,149,0,0.10)', border: '#FF9500', color: '#FF9500', text: `⏰ Còn ${daysLeft} ngày đến hạn nộp BHXH (ngày 25/${month})` };
    return null;
  })();

  return (
    <div className="space-y-5">
      {/* Deadline banner */}
      {deadlineBanner && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border"
          style={{ background: deadlineBanner.bg, borderColor: deadlineBanner.border }}>
          <span className="text-sm font-black" style={{ color: deadlineBanner.color }}>
            {deadlineBanner.text}
          </span>
          <button onClick={() => setShowMarkPaid(true)}
            className="ml-auto px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border"
            style={{ borderColor: deadlineBanner.border, color: deadlineBanner.color }}>
            Đánh dấu đã nộp
          </button>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Bảng kê nộp BHXH</h2>
          <p className="text-neutral-medium text-sm mt-1">Hạn nộp: trước ngày 25 hàng tháng · Chỉ nhân viên chính thức</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Month/Year pickers */}
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="bg-surface border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-orange-500/50">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-surface border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-orange-500/50">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Payment status badge */}
          {paymentLoading ? (
            <span className="text-[10px] text-neutral-600 uppercase tracking-wider">Đang tải...</span>
          ) : payment ? (
            <button onClick={() => setShowMarkPaid(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-colors"
              style={{ background: 'rgba(76,175,80,0.10)', borderColor: '#4CAF50', color: '#4CAF50' }}>
              ✅ Đã nộp {payment.paid_date.slice(8, 10)}/{payment.paid_date.slice(5, 7)}
            </button>
          ) : (
            <button onClick={() => setShowMarkPaid(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:border-white/30 hover:text-white transition-colors">
              ⏳ Chưa nộp
            </button>
          )}

          {/* Export button */}
          <button onClick={() => exportExcel(rows, formula, month, year)} disabled={rows.length === 0}
            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-primary text-black hover:opacity-90 transition-opacity disabled:opacity-30">
            ↓ Xuất Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Nhân viên tham gia', value: rows.length.toString(), unit: 'người', color: 'text-white' },
          { label: `NV đóng (${(formula.bhEmployeeRate * 100).toFixed(2)}%)`, value: fmt(totalEmp), unit: 'đ', color: 'text-orange-400' },
          { label: `Công ty đóng (${(formula.bhCompanyRate * 100).toFixed(2)}%)`, value: fmt(totalComp), unit: 'đ', color: 'text-blue-400' },
          { label: 'Tổng nộp', value: fmt(totalAll), unit: 'đ', color: 'text-green-400' },
        ].map(card => (
          <div key={card.label} className="rounded-[20px] border border-primary/10 bg-surface p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-2">{card.label}</div>
            <div className={`text-xl font-black ${card.color}`}>{card.value}</div>
            <div className="text-[10px] text-neutral-600 mt-0.5">{card.unit}</div>
          </div>
        ))}
      </div>

      {/* Notices */}
      <div className="flex items-center gap-3 flex-wrap">
        {formulaLoading && <span className="text-[10px] text-neutral-600 uppercase tracking-wider">Đang tải công thức...</span>}
        {probationaryCount > 0 && (
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full"
            style={{ background: 'rgba(255,167,38,0.12)', color: '#FFA726' }}>
            ⚠ {probationaryCount} NV thử việc – không tính vào bảng kê
          </span>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-[20px] border border-primary/10 bg-surface py-20 text-center">
          <div className="text-3xl mb-3">🛡️</div>
          <div className="text-sm font-semibold text-neutral-400">Không có nhân viên chính thức trong tháng này</div>
          <div className="text-xs text-neutral-600 mt-1">Kiểm tra lại ngày chính thức trong HR</div>
        </div>
      ) : (
        <div className="rounded-[20px] border border-primary/10 bg-surface overflow-x-auto">
          <table className="text-xs w-full" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider w-10">STT</th>
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">Mã NV</th>
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Họ và tên</th>
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">Phòng ban</th>
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">Mã BHXH</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Lương đóng BH</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">NV đóng</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Công ty đóng</th>
                <th className="text-right px-4 py-3 text-neutral-400 uppercase tracking-wider font-black">Tổng đóng</th>
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.employee_code} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-3 py-2.5 text-neutral-600">{row.stt}</td>
                  <td className="px-3 py-2.5 text-neutral-400 font-mono">{row.employee_code}</td>
                  <td className="px-4 py-2.5 text-white font-semibold whitespace-nowrap">{row.full_name}</td>
                  <td className="px-3 py-2.5 text-neutral-400 whitespace-nowrap">{row.department_name || '—'}</td>
                  <td className="px-3 py-2.5 text-neutral-400 font-mono">
                    {row.insurance_number || <span className="text-red-400/70">Chưa có</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-white">{fmt(row.bhxh_base)}</td>
                  <td className="px-4 py-2.5 text-right text-orange-400">{fmt(row.employee_contrib)}</td>
                  <td className="px-4 py-2.5 text-right text-blue-400">{fmt(row.company_contrib)}</td>
                  <td className="px-4 py-2.5 text-right text-green-400 font-black">{fmt(row.total)}</td>
                  <td className="px-3 py-2.5 text-neutral-500 whitespace-nowrap">
                    {row.note ? <span style={{ color: '#FFA726' }}>{row.note}</span> : ''}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-white/10 bg-white/2">
                <td colSpan={5} className="px-4 py-3 text-neutral-400 font-black uppercase text-xs tracking-wider">
                  Tổng cộng ({rows.length} người)
                </td>
                <td className="px-4 py-3 text-right text-white font-black">{fmt(totalBase)}</td>
                <td className="px-4 py-3 text-right text-orange-400 font-black">{fmt(totalEmp)}</td>
                <td className="px-4 py-3 text-right text-blue-400 font-black">{fmt(totalComp)}</td>
                <td className="px-4 py-3 text-right text-green-400 font-black">{fmt(totalAll)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Mark Paid Modal */}
      {showMarkPaid && (
        <MarkPaidForm
          month={month}
          year={year}
          suggestedAmount={totalAll}
          currentUser={currentUser}
          existing={payment}
          onSave={p => { setPayment(p); setShowMarkPaid(false); }}
          onDelete={() => { setPayment(null); setShowMarkPaid(false); }}
          onClose={() => setShowMarkPaid(false)}
        />
      )}
    </div>
  );
}
