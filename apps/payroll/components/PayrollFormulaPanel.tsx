import React, { useCallback, useEffect, useState } from 'react';
import { AccountUser, PayPayrollFormulaSettings, PayrollTaxBracketRow } from '@/types';
import { hasAnyRole } from '@/utils/roleUtils';
import {
  FALLBACK_PAYROLL_FORMULA,
  fetchAllPayrollFormulas,
  insertPayrollFormula,
  updatePayrollFormula,
  deletePayrollFormula,
  settingsRowToConfig,
} from '../services/payrollFormulaService';

const canEditFormula = (u: AccountUser) => hasAnyRole(u, ['admin', 'ke_toan']);

const defaultBrackets = (): PayrollTaxBracketRow[] => [
  { limit: 10_000_000, rate: 0.05, deduction: 0 },
  { limit: 30_000_000, rate: 0.10, deduction: 500_000 },
  { limit: 60_000_000, rate: 0.20, deduction: 3_500_000 },
  { limit: 100_000_000, rate: 0.30, deduction: 9_500_000 },
  { limit: null, rate: 0.35, deduction: 14_500_000 },
];

function emptyForm(): {
  name: string;
  effective_from: string;
  standard_work_days: number;
  hours_per_day: number;
  bh_employee_rate: number;
  bh_company_rate: number;
  personal_deduction: number;
  dependent_deduction: number;
  ot_rate_weekday: number;
  probation_pit_rate: number;
  tax_brackets: PayrollTaxBracketRow[];
  notes: string;
} {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return {
    name: `Bộ thông số từ ${m}/${y}`,
    effective_from: `${y}-${m}-01`,
    standard_work_days: FALLBACK_PAYROLL_FORMULA.standardWorkDays,
    hours_per_day: FALLBACK_PAYROLL_FORMULA.hoursPerDay,
    bh_employee_rate: FALLBACK_PAYROLL_FORMULA.bhEmployeeRate,
    bh_company_rate: FALLBACK_PAYROLL_FORMULA.bhCompanyRate,
    personal_deduction: FALLBACK_PAYROLL_FORMULA.personalDeduction,
    dependent_deduction: FALLBACK_PAYROLL_FORMULA.dependentDeduction,
    ot_rate_weekday: FALLBACK_PAYROLL_FORMULA.otRateWeekday,
    probation_pit_rate: FALLBACK_PAYROLL_FORMULA.probationPitRate,
    tax_brackets: defaultBrackets(),
    notes: '',
  };
}

interface Props {
  currentUser: AccountUser;
  onNotify: (message: string, type: 'success' | 'error') => void;
}

const PayrollFormulaPanel: React.FC<Props> = ({ currentUser, onNotify }) => {
  const editable = canEditFormula(currentUser);
  const [list, setList] = useState<PayPayrollFormulaSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllPayrollFormulas();
      setList(data);
    } catch (e: any) {
      onNotify(e.message || 'Không tải được cấu hình', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    reload();
  }, [reload]);

  const startNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setMode('edit');
  };

  const startEdit = (row: PayPayrollFormulaSettings) => {
    setEditId(row.id);
    const tb = Array.isArray(row.tax_brackets) ? (row.tax_brackets as PayrollTaxBracketRow[]) : defaultBrackets();
    setForm({
      name: row.name,
      effective_from: row.effective_from.slice(0, 10),
      standard_work_days: Number(row.standard_work_days),
      hours_per_day: Number(row.hours_per_day),
      bh_employee_rate: Number(row.bh_employee_rate),
      bh_company_rate: Number(row.bh_company_rate),
      personal_deduction: Number(row.personal_deduction),
      dependent_deduction: Number(row.dependent_deduction),
      ot_rate_weekday: Number(row.ot_rate_weekday),
      probation_pit_rate: Number(row.probation_pit_rate),
      tax_brackets: tb.length ? tb : defaultBrackets(),
      notes: row.notes || '',
    });
    setMode('edit');
  };

  const save = async () => {
    if (!editable) return;
    const brackets = [...form.tax_brackets];
    const last = brackets[brackets.length - 1];
    if (last) last.limit = null;
    try {
      if (editId) {
        await updatePayrollFormula(editId, { ...form, tax_brackets: brackets });
        onNotify('Đã cập nhật bộ thông số', 'success');
      } else {
        await insertPayrollFormula({ ...form, tax_brackets: brackets });
        onNotify('Đã thêm bộ thông số mới', 'success');
      }
      setMode('list');
      await reload();
    } catch (e: any) {
      const msg = String(e.message || '');
      if (e.code === '23505' || msg.includes('pay_payroll_formula_effective_from')) {
        onNotify('Đã có bộ thông số với cùng ngày hiệu lực. Chọn ngày khác hoặc sửa bản hiện có.', 'error');
      } else {
        onNotify(msg || 'Lưu thất bại', 'error');
      }
    }
  };

  const removeRow = async (id: string) => {
    if (!editable) return;
    try {
      await deletePayrollFormula(id);
      onNotify('Đã xoá', 'success');
      setConfirmDeleteId(null);
      await reload();
    } catch (e: any) {
      if (String(e.message).includes('foreign key') || e.code === '23503') {
        onNotify('Không xoá được: đang có bảng lương dùng công thức này.', 'error');
      } else {
        onNotify(e.message || 'Xoá thất bại', 'error');
      }
    }
  };

  const updateBracket = (i: number, patch: Partial<PayrollTaxBracketRow>) => {
    setForm(f => ({
      ...f,
      tax_brackets: f.tax_brackets.map((b, j) => (j === i ? { ...b, ...patch } : b)),
    }));
  };

  const addBracket = () => {
    setForm(f => ({
      ...f,
      tax_brackets: [...f.tax_brackets, { limit: 50_000_000, rate: 0.2, deduction: 0 }],
    }));
  };

  const removeBracket = (i: number) => {
    setForm(f => ({
      ...f,
      tax_brackets: f.tax_brackets.filter((_, j) => j !== i),
    }));
  };

  if (mode === 'edit' && editable) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">⚙️ {editId ? 'Sửa' : 'Thêm'} bộ thông số</h2>
          <button type="button" onClick={() => setMode('list')}
            className="text-sm text-neutral-medium hover:text-white">← Danh sách</button>
        </div>
        <div className="space-y-4 p-5 rounded-2xl bg-card-dark border border-primary/10">
          <Field label="Tên hiển thị" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Field label="Hiệu lực từ (ngày đầu tháng áp dụng)" type="date" value={form.effective_from} onChange={v => setForm(f => ({ ...f, effective_from: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Num label="Ngày công chuẩn / tháng" value={form.standard_work_days} onChange={v => setForm(f => ({ ...f, standard_work_days: v }))} step="0.1" />
            <Num label="Giờ làm / ngày" value={form.hours_per_day} onChange={v => setForm(f => ({ ...f, hours_per_day: v }))} step="0.1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Num label="BH nhân viên (tỷ lệ, VD 0.105)" value={form.bh_employee_rate} onChange={v => setForm(f => ({ ...f, bh_employee_rate: v }))} step="0.001" />
            <Num label="BH công ty (tỷ lệ)" value={form.bh_company_rate} onChange={v => setForm(f => ({ ...f, bh_company_rate: v }))} step="0.001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Giảm trừ bản thân (đ)" value={form.personal_deduction} onChange={v => setForm(f => ({ ...f, personal_deduction: v }))} step="1000" />
            <Num label="Giảm trừ / 1 NPT (đ)" value={form.dependent_deduction} onChange={v => setForm(f => ({ ...f, dependent_deduction: v }))} step="1000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Hệ số tăng ca ngày thường (VD 1.5)" value={form.ot_rate_weekday} onChange={v => setForm(f => ({ ...f, ot_rate_weekday: v }))} step="0.1" />
            <Num label="Thuế TNCN thử việc (tỷ lệ)" value={form.probation_pit_rate} onChange={v => setForm(f => ({ ...f, probation_pit_rate: v }))} step="0.01" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Biểu thuế lũy tiến (bậc cuối để trống mức = vô hạn)</span>
              <button type="button" onClick={addBracket} className="text-xs text-emerald-400 font-bold">+ Bậc</button>
            </div>
            <div className="space-y-2">
              {form.tax_brackets.map((b, i) => (
                <div key={i} className="flex flex-wrap gap-2 items-center p-2 rounded-lg bg-black/20">
                  <span className="text-[10px] text-neutral-medium w-16">Bậc {i + 1}</span>
                  <input placeholder="Mức tối đa TNTT" disabled={i === form.tax_brackets.length - 1}
                    className="flex-1 min-w-[100px] px-2 py-1 rounded bg-black/30 border border-white/10 text-white text-xs"
                    type="number" value={i === form.tax_brackets.length - 1 ? '' : (b.limit ?? '')}
                    onChange={e => updateBracket(i, { limit: e.target.value === '' ? null : +e.target.value })} />
                  <input className="w-20 px-2 py-1 rounded bg-black/30 border border-white/10 text-white text-xs" type="number" step="0.01"
                    value={b.rate} onChange={e => updateBracket(i, { rate: +e.target.value })} title="Thuế suất" />
                  <input className="w-28 px-2 py-1 rounded bg-black/30 border border-white/10 text-white text-xs" type="number" step="1000"
                    value={b.deduction} onChange={e => updateBracket(i, { deduction: +e.target.value })} title="Khấu trừ nhanh" />
                  {form.tax_brackets.length > 1 && (
                    <button type="button" onClick={() => removeBracket(i)} className="text-red-400 text-xs px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Field label="Ghi chú" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} multiline />
          <button type="button" onClick={save}
            className="w-full py-3 rounded-xl bg-emerald-500 text-white font-black uppercase text-sm tracking-widest hover:bg-emerald-600">
            Lưu
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">📐 Công thức & thông số</h2>
          <p className="text-neutral-medium text-sm mt-1">
            Hệ thống chọn bản <strong className="text-white">mới nhất</strong> có <code className="text-emerald-400">Hiệu lực từ</code> ≤ tháng lương (giống cách đặt kỳ áp dụng trên AMIS).
          </p>
        </div>
        {editable && (
          <button type="button" onClick={startNew}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white"
            style={{ background: 'linear-gradient(135deg, #5E5CE6, #0A84FF)' }}>
            + Thêm bộ mới
          </button>
        )}
      </div>

      {!editable && (
        <p className="text-amber-400/90 text-sm mb-4">Bạn chỉ xem được thông số. Chỉ <strong>Admin</strong> và <strong>Kế toán</strong> được chỉnh sửa.</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(row => {
            const cfg = settingsRowToConfig(row);
            return (
              <div key={row.id} className="p-4 rounded-2xl bg-card-dark border border-primary/10">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-white font-bold">{row.name}</p>
                    <p className="text-neutral-medium text-xs mt-1">
                      Hiệu lực từ: {row.effective_from.slice(0, 10)} · Chuẩn {cfg.standardWorkDays} ngày · BH NV {(cfg.bhEmployeeRate * 100).toFixed(2)}%
                    </p>
                    <p className="text-neutral-medium text-[10px] mt-1">{row.notes}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {editable && (
                      <>
                        <button type="button" onClick={() => startEdit(row)} className="px-3 py-1 rounded-lg bg-white/10 text-white text-xs font-bold">Sửa</button>
                        {confirmDeleteId === row.id ? (
                          <>
                            <button type="button" onClick={() => removeRow(row.id)} className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-bold">Xác nhận xoá</button>
                            <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-3 py-1 rounded-lg bg-white/10 text-xs text-neutral-medium">Huỷ</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setConfirmDeleteId(row.id)} className="px-3 py-1 rounded-lg text-red-400 text-xs font-bold">Xoá</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
}> = ({ label, value, onChange, type = 'text', multiline }) => (
  <label className="block">
    <span className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">{label}</span>
    {multiline ? (
      <textarea className="w-full px-3 py-2 rounded-lg bg-black/30 border border-primary/10 text-white text-sm outline-none min-h-[72px]"
        value={value} onChange={e => onChange(e.target.value)} />
    ) : (
      <input type={type} className="w-full px-3 py-2 rounded-lg bg-black/30 border border-primary/10 text-white text-sm outline-none"
        value={value} onChange={e => onChange(e.target.value)} />
    )}
  </label>
);

const Num: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}> = ({ label, value, onChange, step }) => (
  <label className="block">
    <span className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">{label}</span>
    <input type="number" step={step} className="w-full px-3 py-2 rounded-lg bg-black/30 border border-primary/10 text-white text-sm outline-none"
      value={Number.isFinite(value) ? value : 0} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
  </label>
);

export default PayrollFormulaPanel;
