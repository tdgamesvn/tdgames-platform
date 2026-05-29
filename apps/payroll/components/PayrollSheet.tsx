import React, { useState, useRef, useEffect } from 'react';
import AppBackground from '@/components/AppBackground';
import { PayPayrollSheet, PayPayrollRecord, PayrollFormulaConfig } from '@/types';
import { exportPayrollToExcel } from '../services/payrollExportService';
import PaySlip from './PaySlip';

interface Props {
  sheet: PayPayrollSheet;
  records: PayPayrollRecord[];
  /** Thông số công thức đang áp dụng cho bảng này (theo DB / kỳ). */
  formula: PayrollFormulaConfig;
  loading: boolean;
  onBack: () => void;
  onUpdateRecord: (id: string, field: string, value: number) => void;
  onSaveRecord: (rec: PayPayrollRecord) => void;
  onConfirm: () => void;
  onMarkPaid?: () => void;
  onRollback?: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const PayrollSheet: React.FC<Props> = ({
  sheet, records, formula, loading, onBack, onUpdateRecord, onSaveRecord, onConfirm, onMarkPaid, onRollback,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [paySlipRecord, setPaySlipRecord] = useState<PayPayrollRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraft = sheet.status === 'draft';
  const isPaid = sheet.status === 'paid';

  // Focus when editing
  useEffect(() => {
    if (editingCell && inputRef.current) inputRef.current.focus();
  }, [editingCell]);

  // Auto-save with debounce
  const handleCellChange = (rec: PayPayrollRecord, field: string, value: number) => {
    onUpdateRecord(rec.id, field, value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // Find updated record from records
      const updated = records.find(r => r.id === rec.id);
      if (updated) {
        const recalced = { ...updated, [field]: value };
        onSaveRecord(recalced);
      }
    }, 800);
  };

  // Summaries
  const totalGrossActual = records.reduce((s, r) => s + r.gross_actual, 0);
  const totalNet = records.reduce((s, r) => s + r.net_salary, 0);
  const totalBhNv = records.reduce((s, r) => s + r.employee_bhxh, 0);
  const totalPit = records.reduce((s, r) => s + r.pit, 0);
  const totalCompanyCost = records.reduce((s, r) => s + r.total_company_cost, 0);
  const totalBonus = records.reduce((s, r) => s + (r.bonus ?? 0), 0);

  return (
    <div className="min-h-screen bg-bg-dark relative overflow-hidden">
      <AppBackground />
      {/* Header */}
      <div className="sticky top-0 z-30 bg-bg-dark/90 backdrop-blur-xl border-b border-primary/10">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-neutral-medium hover:text-white transition-colors text-lg">←</button>
            <div>
              <h1 className="text-white font-black text-lg uppercase tracking-tight">{sheet.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                  sheet.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                  sheet.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {sheet.status === 'draft' ? 'Nháp' : sheet.status === 'confirmed' ? 'Đã xác nhận' : 'Đã trả'}
                </span>
                <span className="text-neutral-medium text-xs">{records.length} nhân viên</span>
                {isPaid && sheet.paid_at && (
                  <span className="text-cyan-400/90 text-[10px] font-semibold">
                    Đã trả: {new Date(sheet.paid_at).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => exportPayrollToExcel(sheet, records, formula)}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80"
              style={{ background: 'linear-gradient(135deg, #059669, #34D399)' }}>
              📥 Export Excel
            </button>
            {isDraft && (
              <button onClick={onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80"
                style={{ background: 'linear-gradient(135deg, #34D399, #059669)' }}>
                ✅ Xác nhận bảng lương
              </button>
            )}
            {sheet.status === 'confirmed' && onMarkPaid && (
              <button onClick={onMarkPaid}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #2563EB)' }}>
                💳 Đánh dấu đã trả lương
              </button>
            )}
            {sheet.status === 'confirmed' && onRollback && (
              <button onClick={onRollback}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                ↩️ Huỷ xác nhận
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Tổng Gross thực tế', value: totalGrossActual, color: 'text-white' },
            { label: 'Tổng BH nhân viên', value: totalBhNv, color: 'text-orange-400' },
            { label: 'Tổng thuế TNCN', value: totalPit, color: 'text-red-400' },
            { label: 'Tổng thưởng KPI', value: totalBonus, color: 'text-yellow-400' },
            { label: 'Tổng Net thực lĩnh', value: totalNet, color: 'text-emerald-400' },
            { label: 'Tổng chi phí công ty', value: totalCompanyCost, color: 'text-blue-400' },
          ].map(card => (
            <div key={card.label} className="p-3 rounded-2xl bg-card-dark border border-primary/10">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium">{card.label}</p>
              <p className={`text-lg font-black mt-1 ${card.color}`}>{fmt(card.value)}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="rounded-2xl border border-primary/10 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr,0.8fr,1fr,0.8fr,1fr,0.8fr,0.8fr,0.8fr,1.2fr] gap-0 bg-black/30 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-neutral-medium border-b border-primary/10">
              <span>Nhân viên</span>
              <span className="text-right">Ngày công</span>
              <span className="text-right">Gross TK</span>
              <span className="text-right">TC phát sinh</span>
              <span className="text-right">Gross thực</span>
              <span className="text-right">BH NV</span>
              <span className="text-right">Thuế</span>
              <span className="text-right">Thưởng</span>
              <span className="text-right">Net thực lĩnh</span>
            </div>

            {/* Table rows */}
            {records.map(rec => {
              const isExpanded = expandedId === rec.id;
              const empName = rec.employee?.full_name || 'N/A';
              const ratio = rec.work_days / formula.standardWorkDays;

              return (
                <div key={rec.id}>
                  {/* Main row */}
                  <div
                    className="group/row grid grid-cols-[2fr,0.8fr,1fr,0.8fr,1fr,0.8fr,0.8fr,0.8fr,1.2fr] gap-0 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer items-center"
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
                      <span className="text-white font-bold text-sm truncate">{empName}</span>
                      {rec.is_probation && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                          THỬ VIỆC
                        </span>
                      )}
                      {!rec.is_probation && rec.probation_ratio > 0 && rec.probation_ratio < 1 && (
                        <span
                          className="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-400 text-[9px] font-bold uppercase tracking-wider"
                          title={`${Math.round(rec.probation_ratio * 100)}% thử việc + ${Math.round((1 - rec.probation_ratio) * 100)}% chính thức`}
                        >
                          CHUYỂN GIAO
                        </span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setPaySlipRecord(rec); }}
                        className="ml-1 px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-500/25 transition-all"
                        title="Xem phiếu lương"
                      >
                        📄 Phiếu lương
                      </button>
                    </div>

                    {/* Work days - editable */}
                    <div className="text-right" onClick={e => e.stopPropagation()}>
                      {isDraft && editingCell?.id === rec.id && editingCell?.field === 'work_days' ? (
                        <input ref={inputRef} type="number" step="0.5"
                          className="w-16 px-1 py-0.5 rounded bg-black/40 border border-emerald-500/40 text-white text-xs text-right outline-none"
                          value={rec.work_days}
                          onChange={e => handleCellChange(rec, 'work_days', +e.target.value)}
                          onBlur={() => setEditingCell(null)}
                        />
                      ) : (
                        <span className={`text-xs ${isDraft ? 'text-emerald-400 cursor-text' : 'text-white'}`}
                          onClick={() => isDraft && setEditingCell({ id: rec.id, field: 'work_days' })}>
                          {rec.work_days}/{formula.standardWorkDays}
                        </span>
                      )}
                    </div>

                    <span className="text-right text-xs text-neutral-medium">{fmt(rec.gross_ref)}</span>

                    {/* Extra OT hours - editable */}
                    <div className="text-right" onClick={e => e.stopPropagation()}>
                      {isDraft && editingCell?.id === rec.id && editingCell?.field === 'extra_ot_hours' ? (
                        <input ref={inputRef} type="number" step="0.5"
                          className="w-16 px-1 py-0.5 rounded bg-black/40 border border-blue-500/40 text-white text-xs text-right outline-none"
                          value={rec.extra_ot_hours}
                          onChange={e => handleCellChange(rec, 'extra_ot_hours', +e.target.value)}
                          onBlur={() => setEditingCell(null)}
                        />
                      ) : (
                        <span className={`text-xs ${isDraft ? 'text-blue-400 cursor-text' : 'text-white'}`}
                          onClick={() => isDraft && setEditingCell({ id: rec.id, field: 'extra_ot_hours' })}>
                          {rec.extra_ot_hours > 0 ? `${rec.extra_ot_hours}h` : '—'}
                        </span>
                      )}
                    </div>

                    <span className="text-right text-xs text-white font-bold">{fmt(rec.gross_actual)}</span>
                    <span className="text-right text-xs text-orange-400">{fmt(rec.employee_bhxh)}</span>
                    <span className="text-right text-xs text-red-400">{rec.pit > 0 ? fmt(rec.pit) : '0'}</span>

                    {/* Bonus - editable */}
                    <div className="text-right" onClick={e => e.stopPropagation()}>
                      {isDraft && editingCell?.id === rec.id && editingCell?.field === 'bonus' ? (
                        <input ref={inputRef} type="number" step="1000"
                          className="w-20 px-1 py-0.5 rounded bg-black/40 border border-yellow-500/40 text-white text-xs text-right outline-none"
                          value={rec.bonus ?? 0}
                          onChange={e => handleCellChange(rec, 'bonus', +e.target.value)}
                          onBlur={() => setEditingCell(null)}
                        />
                      ) : (
                        <span
                          className={`text-xs ${isDraft ? 'text-yellow-400 cursor-text' : 'text-white'}`}
                          onClick={() => isDraft && setEditingCell({ id: rec.id, field: 'bonus' })}
                        >
                          {(rec.bonus ?? 0) > 0 ? fmt(rec.bonus) : (isDraft ? '+ thêm' : '—')}
                        </span>
                      )}
                    </div>

                    <span className="text-right text-sm text-emerald-400 font-black">{fmt(rec.net_salary)}</span>
                  </div>

                  {/* Expanded: 8-step detail */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-black/20 border-b border-white/[0.04]">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-3">
                        📊 Chi tiết tính lương — {empName}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left: Input + Steps 1-2 */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Input & Bước 1-2</div>
                          <Row label="Ngày công" value={`${rec.work_days} / ${formula.standardWorkDays}`} sub={`Tỷ lệ: ${(ratio).toFixed(6)}`} />
                          <Row label="Lương CB" value={fmt(rec.base_salary)} sub={`Thực: ${fmt(Math.round(rec.base_salary * ratio))}`} />
                          <Row label="PC ăn trưa" value={fmt(rec.lunch_allowance)} sub={`Thực: ${fmt(Math.round(rec.lunch_allowance * ratio))}`} />
                          <Row label="PC xăng xe" value={fmt(rec.transport_allowance)} sub={`Thực: ${fmt(Math.round(rec.transport_allowance * ratio))}`} />
                          <Row label="PC điện thoại" value={fmt(rec.phone_allowance)} sub={`Thực: ${fmt(Math.round(rec.phone_allowance * ratio))}`} />
                          <Row label="PC trang phục" value={fmt(rec.clothing_allowance)} sub={`Thực: ${fmt(Math.round(rec.clothing_allowance * ratio))}`} />
                          <Row label="KPI" value={fmt(rec.kpi_allowance)} sub={`Thực: ${fmt(Math.round(rec.kpi_allowance * ratio))}`} />
                          <Row label="Tăng ca MĐ" value={fmt(rec.default_ot)} sub={`Thực: ${fmt(Math.round(rec.default_ot * ratio))}`} />
                          <Row label="Tăng ca phát sinh" value={rec.extra_ot_hours > 0 ? `${rec.extra_ot_hours}h → ${fmt(rec.extra_ot)}đ` : '—'} highlight />
                          <div className="border-t border-white/[0.06] pt-2 mt-2">
                            <Row label="Gross tham chiếu" value={fmt(rec.gross_ref)} bold />
                            <Row label="Gross thực tế" value={fmt(rec.gross_actual)} bold highlight />
                          </div>
                        </div>

                        {/* Right: Steps 3-8 */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-emerald-400 uppercase mb-1">
                            {rec.is_probation ? 'THỬ VIỆC: Thuế 10% – Không BH' : 'Bước 3-8: BH → Thuế → Net'}
                          </div>
                          {rec.is_probation ? (
                            <>
                              <Row label="BH nhân viên" value="0 (không đóng)" color="text-neutral-medium/50" />
                              <Row label="Thu nhập chịu thuế" value={fmt(rec.taxable_income)} />
                              <Row label={`Thuế TNCN (${(formula.probationPitRate * 100).toFixed(0)}% cố định)`} value={fmt(rec.pit)} color="text-red-400" />
                              {(rec.bonus ?? 0) > 0 && (
                                <Row label="Thưởng KPI (nhập tay)" value={`+${fmt(rec.bonus)}đ`} color="text-yellow-400" />
                              )}
                              <div className="border-t border-white/[0.06] pt-2 mt-2">
                                <Row label="NET THỰC LĨNH" value={`${fmt(rec.net_salary)}đ`} bold highlight />
                              </div>
                              <div className="border-t border-white/[0.06] pt-2 mt-2">
                                <Row label="BH công ty" value="0 (không đóng)" color="text-neutral-medium/50" />
                                <Row label="Chi phí công ty" value={fmt(rec.total_company_cost)} bold color="text-blue-400" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Row label={`BH nhân viên (${(formula.bhEmployeeRate * 100).toFixed(2)}%)`} value={fmt(rec.employee_bhxh)} color="text-orange-400" />
                              <Row label="TNCT (CB + ĐT + KPI)" value={fmt(rec.taxable_income)} />
                              <Row label="Giảm trừ bản thân" value={`-${fmt(formula.personalDeduction)}`} color="text-neutral-medium" />
                              <Row label={`Giảm trừ NPT (${rec.dependents_count})`} value={`-${fmt(rec.dependents_count * formula.dependentDeduction)}`} color="text-neutral-medium" />
                              <Row label="TNTT" value={rec.assessable_income > 0 ? fmt(rec.assessable_income) : '0 (âm → 0)'} />
                              <Row label="Thuế TNCN (lũy tiến)" value={rec.pit > 0 ? fmt(rec.pit) : '0'} color={rec.pit > 0 ? 'text-red-400' : 'text-emerald-400'} />
                              {(rec.bonus ?? 0) > 0 && (
                                <Row label="Thưởng KPI (nhập tay)" value={`+${fmt(rec.bonus)}đ`} color="text-yellow-400" />
                              )}
                              <div className="border-t border-white/[0.06] pt-2 mt-2">
                                <Row label="NET THỰC LĨNH" value={`${fmt(rec.net_salary)}đ`} bold highlight />
                              </div>
                              <div className="border-t border-white/[0.06] pt-2 mt-2">
                                <Row label={`BH công ty (${(formula.bhCompanyRate * 100).toFixed(2)}%)`} value={fmt(rec.company_bhxh)} color="text-blue-400" />
                                <Row label="Chi phí công ty" value={fmt(rec.total_company_cost)} bold color="text-blue-400" />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Summary row */}
            <div className="grid grid-cols-[2fr,0.8fr,1fr,0.8fr,1fr,0.8fr,0.8fr,0.8fr,1.2fr] gap-0 px-4 py-3 bg-black/40 text-xs font-bold">
              <span className="text-neutral-medium uppercase text-[10px] tracking-widest">Tổng cộng</span>
              <span></span>
              <span></span>
              <span></span>
              <span className="text-right text-white">{fmt(totalGrossActual)}</span>
              <span className="text-right text-orange-400">{fmt(totalBhNv)}</span>
              <span className="text-right text-red-400">{fmt(totalPit)}</span>
              <span className="text-right text-yellow-400">{totalBonus > 0 ? fmt(totalBonus) : '—'}</span>
              <span className="text-right text-emerald-400 font-black text-sm">{fmt(totalNet)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Pay Slip Overlay */}
      {paySlipRecord && (
        <PaySlip
          sheet={sheet}
          record={paySlipRecord}
          formula={formula}
          onClose={() => setPaySlipRecord(null)}
        />
      )}
    </div>
  );
};

// Helper component for detail rows
const Row: React.FC<{
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  highlight?: boolean;
  color?: string;
}> = ({ label, value, sub, bold, highlight, color }) => (
  <div className="flex items-center justify-between">
    <span className={`text-xs ${bold ? 'font-bold text-white' : 'text-neutral-medium'}`}>{label}</span>
    <div className="text-right">
      <span className={`text-xs ${
        highlight ? 'text-emerald-400 font-black' :
        bold ? 'text-white font-bold' :
        color || 'text-white'
      }`}>{value}</span>
      {sub && <p className="text-[9px] text-neutral-medium/60">{sub}</p>}
    </div>
  </div>
);

export default PayrollSheet;
