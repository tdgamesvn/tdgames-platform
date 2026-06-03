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
  onUpdateRecord: (id: string, field: string, value: number | string) => void;
  onSaveRecord: (rec: PayPayrollRecord) => void;
  onConfirm: () => void;
  onMarkPaid?: () => void;
  onRollback?: () => void;
  /** Kế toán đánh dấu đã giải quyết khiếu nại của nhân viên */
  onResolveDispute?: (recordId: string) => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const EMP_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: '⏳ Chờ XN', cls: 'bg-yellow-500/15 text-yellow-400' },
  confirmed: { label: '✅ Đã XN', cls: 'bg-emerald-500/15 text-emerald-400' },
  disputed:  { label: '❌ Khiếu nại', cls: 'bg-red-500/15 text-red-400' },
  resolved:  { label: '✓ Đã giải quyết', cls: 'bg-blue-500/15 text-blue-400' },
};

const PayrollSheet: React.FC<Props> = ({
  sheet, records, formula, loading, onBack, onUpdateRecord, onSaveRecord, onConfirm, onMarkPaid, onRollback, onResolveDispute,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [paySlipRecord, setPaySlipRecord] = useState<PayPayrollRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraft = sheet.status === 'draft';
  const isPaid = sheet.status === 'paid';

  // Chỉ cho phép "Đã trả lương" khi tất cả NV đã xác nhận hoặc đã giải quyết khiếu nại
  const canMarkPaid = records.length > 0 && records.every(r =>
    r.employee_status === 'confirmed' || r.employee_status === 'resolved',
  );
  const pendingCount = records.filter(r => !r.employee_status || r.employee_status === 'pending').length;
  const disputedCount = records.filter(r => r.employee_status === 'disputed').length;

  // Focus when editing
  useEffect(() => {
    if (editingCell && inputRef.current) inputRef.current.focus();
  }, [editingCell]);

  // Auto-save with debounce (numeric fields — triggers recalculate)
  const handleCellChange = (rec: PayPayrollRecord, field: string, value: number) => {
    onUpdateRecord(rec.id, field, value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const updated = records.find(r => r.id === rec.id);
      if (updated) {
        const recalced = { ...updated, [field]: value };
        onSaveRecord(recalced);
      }
    }, 800);
  };

  // Auto-save with debounce (string fields — no recalculate)
  const handleStringChange = (rec: PayPayrollRecord, field: string, value: string) => {
    onUpdateRecord(rec.id, field, value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const updated = records.find(r => r.id === rec.id);
      if (updated) onSaveRecord({ ...updated, [field]: value });
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
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={canMarkPaid ? onMarkPaid : undefined}
                  disabled={!canMarkPaid}
                  title={!canMarkPaid ? `Còn ${pendingCount} chờ XN, ${disputedCount} khiếu nại chưa giải quyết` : ''}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all ${canMarkPaid ? 'hover:opacity-80' : 'opacity-40 cursor-not-allowed'}`}
                  style={{ background: canMarkPaid ? 'linear-gradient(135deg, #0EA5E9, #2563EB)' : '#374151' }}>
                  💳 Đánh dấu đã trả lương
                </button>
                {!canMarkPaid && (
                  <span className="text-[10px] text-yellow-400/80">
                    {pendingCount > 0 && `${pendingCount} chờ xác nhận`}
                    {pendingCount > 0 && disputedCount > 0 && ' · '}
                    {disputedCount > 0 && `${disputedCount} khiếu nại`}
                  </span>
                )}
              </div>
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
              const std = sheet.standard_work_days ?? formula.standardWorkDays;
              const ratio = rec.work_days / std;

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
                      {sheet.status !== 'draft' && (() => {
                        const st = rec.employee_status ?? 'pending';
                        const badge = EMP_STATUS_BADGE[st] ?? EMP_STATUS_BADGE.pending;
                        return (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${badge.cls}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
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
                          {rec.work_days}/{std}
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

                    {/* Bonus + Lý do — editable */}
                    <div className="text-right" onClick={e => e.stopPropagation()}>
                      {isDraft && editingCell?.id === rec.id && editingCell?.field === 'bonus' ? (
                        <div className="flex flex-col gap-1 items-end">
                          <input ref={inputRef} type="number" step="1000" placeholder="Số tiền"
                            className="w-24 px-1 py-0.5 rounded bg-black/40 border border-yellow-500/40 text-white text-xs text-right outline-none"
                            value={rec.bonus ?? 0}
                            onChange={e => handleCellChange(rec, 'bonus', +e.target.value)}
                          />
                          <input type="text" placeholder="Lý do thưởng..."
                            className="w-32 px-1 py-0.5 rounded bg-black/40 border border-yellow-500/20 text-yellow-200/70 text-[10px] text-right outline-none"
                            value={rec.bonus_reason ?? ''}
                            onChange={e => handleStringChange(rec, 'bonus_reason', e.target.value)}
                            onBlur={() => setEditingCell(null)}
                          />
                        </div>
                      ) : (
                        <div
                          className={`flex flex-col items-end gap-0.5 ${isDraft ? 'cursor-text' : ''}`}
                          onClick={() => isDraft && setEditingCell({ id: rec.id, field: 'bonus' })}
                        >
                          <span className={`text-xs ${isDraft ? 'text-yellow-400' : 'text-white'}`}>
                            {(rec.bonus ?? 0) > 0 ? fmt(rec.bonus) : (isDraft ? '+ thêm' : '—')}
                          </span>
                          {rec.bonus_reason && (
                            <span className="text-[9px] text-yellow-200/50 italic truncate max-w-[7rem]" title={rec.bonus_reason}>
                              {rec.bonus_reason}
                            </span>
                          )}
                        </div>
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
                          <Row label="Ngày công" value={`${rec.work_days} / ${std}`} sub={`Tỷ lệ: ${(ratio).toFixed(6)}`} />
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
                                <Row label={rec.bonus_reason ? `Thưởng: ${rec.bonus_reason}` : 'Thưởng (nhập tay)'} value={`+${fmt(rec.bonus)}đ`} color="text-yellow-400" />
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
                                <Row label={rec.bonus_reason ? `Thưởng: ${rec.bonus_reason}` : 'Thưởng (nhập tay)'} value={`+${fmt(rec.bonus)}đ`} color="text-yellow-400" />
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

                      {/* Khối xác nhận nhân viên — chỉ hiện khi sheet đã confirmed/paid */}
                      {sheet.status !== 'draft' && (() => {
                        const st = rec.employee_status ?? 'pending';
                        const badge = EMP_STATUS_BADGE[st] ?? EMP_STATUS_BADGE.pending;
                        return (
                          <div className="mt-4 pt-4 border-t border-white/[0.06]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">
                              👤 Xác nhận từ nhân viên
                            </p>
                            <div className="flex items-start gap-3 flex-wrap">
                              <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${badge.cls}`}>
                                {badge.label}
                              </span>
                              {rec.employee_confirmed_at && (
                                <span className="text-[10px] text-neutral-medium">
                                  {new Date(rec.employee_confirmed_at).toLocaleString('vi-VN')}
                                </span>
                              )}
                              {st === 'disputed' && rec.employee_comment && (
                                <div className="w-full mt-1 p-2 bg-red-500/8 border border-red-500/20 rounded-lg">
                                  <p className="text-[10px] text-red-300/80 font-semibold mb-1">Nội dung khiếu nại:</p>
                                  <p className="text-[11px] text-red-200/70">{rec.employee_comment}</p>
                                  {onResolveDispute && (
                                    <button
                                      onClick={e => { e.stopPropagation(); onResolveDispute(rec.id); }}
                                      className="mt-2 px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-[10px] font-bold hover:bg-blue-500/30 transition-colors"
                                    >
                                      ✓ Đã giải quyết
                                    </button>
                                  )}
                                </div>
                              )}
                              {st === 'resolved' && rec.employee_comment && (
                                <div className="w-full mt-1 p-2 bg-blue-500/8 border border-blue-500/20 rounded-lg">
                                  <p className="text-[10px] text-blue-300/60 font-semibold mb-1">Khiếu nại đã giải quyết:</p>
                                  <p className="text-[11px] text-blue-200/50 line-through">{rec.employee_comment}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
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
