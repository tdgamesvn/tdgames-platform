import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  /** Sửa công chuẩn của bảng + tính lại toàn bộ record. Chỉ dùng khi bảng còn nháp. */
  onUpdateStandardWorkDays?: (std: number, note: string) => void;
  onConfirm: () => void;
  onMarkPaid?: () => void;
  onRollback?: () => void;
  /** Kế toán đánh dấu đã giải quyết khiếu nại của nhân viên */
  onResolveDispute?: (recordId: string) => void;
  /** Làm mới dữ liệu từ DB */
  onRefresh?: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

// OT tách theo loại ngày (BLLĐ 2019 Đ.98) + ca đêm (NĐ 145/2020 Đ.57).
// Hệ số lấy từ bộ công thức đang áp dụng.
const OT_FIELDS = [
  { key: 'extra_ot_hours', label: 'Ngày thường', rate: 'otRateWeekday' },
  { key: 'extra_ot_hours_weekend', label: 'T7 / CN', rate: 'otRateWeekend' },
  { key: 'extra_ot_hours_holiday', label: 'Lễ / Tết', rate: 'otRateHoliday' },
  { key: 'extra_ot_hours_night', label: 'Đêm — ngày thường', rate: 'otRateNightWeekday' },
  { key: 'extra_ot_hours_night_weekend', label: 'Đêm — T7 / CN', rate: 'otRateNightWeekend' },
  { key: 'extra_ot_hours_night_holiday', label: 'Đêm — Lễ / Tết', rate: 'otRateNightHoliday' },
] as const;

const otRate = (formula: PayrollFormulaConfig, key: string) =>
  formula[(OT_FIELDS.find(f => f.key === key)!.rate)] ?? 0;

export const totalOtHours = (rec: PayPayrollRecord) =>
  OT_FIELDS.reduce((s, f) => s + ((rec as any)[f.key] || 0), 0);

const otBreakdown = (rec: PayPayrollRecord) => OT_FIELDS
  .filter(f => ((rec as any)[f.key] || 0) > 0)
  .map(f => `${f.label}: ${(rec as any)[f.key]}h`)
  .join(' · ');

const EMP_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: '⏳ Chờ XN', cls: 'bg-yellow-500/15 text-yellow-400' },
  confirmed: { label: '✅ Đã XN', cls: 'bg-emerald-500/15 text-emerald-400' },
  disputed:  { label: '❌ Khiếu nại', cls: 'bg-red-500/15 text-red-400' },
  resolved:  { label: '✓ Đã giải quyết', cls: 'bg-blue-500/15 text-blue-400' },
};

const PayrollSheet: React.FC<Props> = ({
  sheet, records, formula, loading, onBack, onUpdateRecord, onSaveRecord, onUpdateStandardWorkDays, onConfirm, onMarkPaid, onRollback, onResolveDispute, onRefresh,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [paySlipRecord, setPaySlipRecord] = useState<PayPayrollRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraft = sheet.status === 'draft';
  const isPaid = sheet.status === 'paid';

  // Công chuẩn: số tự tính chỉ đếm T2–T6 ⇒ tháng có lễ (2/9) hoặc có buổi làm T7 phải sửa tay.
  const sheetStd = sheet.standard_work_days ?? formula.standardWorkDays;
  // Sửa qua modal, không sửa inline: đổi số này là tính lại tiền cả bảng nên phải cố ý + có lý do.
  const [stdModal, setStdModal] = useState(false);
  const [stdDraft, setStdDraft] = useState(String(sheetStd));
  const [stdNote, setStdNote] = useState('');
  const openStdModal = () => { setStdDraft(String(sheetStd)); setStdNote(''); setStdModal(true); };

  const stdNum = Number(stdDraft);
  const stdError =
    !Number.isFinite(stdNum) || stdNum <= 0 || stdNum > 31 ? 'Công chuẩn phải trong khoảng 1–31 ngày'
    : stdNum === sheetStd ? 'Số ngày không đổi'
    : !stdNote.trim() ? 'Phải nhập lý do'
    : '';

  const submitStd = () => {
    if (stdError) return;
    onUpdateStandardWorkDays?.(stdNum, stdNote);
    setStdModal(false);
  };

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
                {/* Chìm mặc định, sáng lên khi hover — số tiền cả bảng treo vào con số này. */}
                <span
                  className="group inline-flex items-center gap-1.5 rounded-md bg-white/[0.03] border border-white/8 px-2 py-0.5 hover:border-white/15 transition-all"
                  title={sheet.standard_work_days_note ? `Lý do: ${sheet.standard_work_days_note}` : undefined}
                >
                  <span className="text-[9px] font-black uppercase tracking-wider text-neutral-600">Công chuẩn</span>
                  <b className="text-white text-xs font-black tabular-nums">{sheetStd}</b>
                  <span className="text-[10px] text-neutral-600">ngày</span>
                  {isDraft && onUpdateStandardWorkDays && (
                    <button
                      onClick={openStdModal}
                      disabled={loading}
                      className="text-[10px] font-black uppercase text-neutral-600 group-hover:text-primary transition-colors disabled:opacity-40"
                    >
                      Sửa
                    </button>
                  )}
                </span>
                {isPaid && sheet.paid_at && (
                  <span className="text-cyan-400/90 text-[10px] font-semibold">
                    Đã trả: {new Date(sheet.paid_at).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onRefresh && (
              <button onClick={onRefresh} disabled={loading}
                className="px-3 py-2 rounded-xl text-xs font-bold text-neutral-medium hover:text-white border border-white/10 hover:border-white/20 transition-all"
                title="Làm mới trạng thái xác nhận">
                🔄
              </button>
            )}
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
            <div className="grid grid-cols-[3fr,0.8fr,1fr,0.8fr,1fr,0.8fr,0.8fr,0.8fr,1.2fr] gap-0 bg-black/30 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-neutral-medium border-b border-primary/10">
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
            {records.map((rec, recIdx) => {
              const isExpanded = expandedId === rec.id;
              const empName = rec.employee?.full_name || 'N/A';
              const std = sheet.standard_work_days ?? formula.standardWorkDays;
              const ratio = rec.work_days / std;
              /** Hàng gần cuối bảng → popover thưởng lật lên trên để không bị cắt khỏi viewport */
              const popoverUp = recIdx >= records.length - 2 && records.length > 2;

              return (
                <div key={rec.id}>
                  {/* Main row */}
                  <div
                    className="group/row grid grid-cols-[3fr,0.8fr,1fr,0.8fr,1fr,0.8fr,0.8fr,0.8fr,1.2fr] gap-0 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer items-center"
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm flex-shrink-0">{isExpanded ? '▼' : '▶'}</span>
                      <div className="flex flex-col gap-1 min-w-0">
                        {/* Dòng 1: Tên đầy đủ */}
                        <span className="text-white font-bold text-sm leading-tight" title={empName}>{empName}</span>
                        {/* Dòng 2: Badges nhỏ */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {rec.is_probation && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                              THỬ VIỆC
                            </span>
                          )}
                          {!rec.is_probation && rec.probation_ratio > 0 && rec.probation_ratio < 1 && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 text-[9px] font-bold uppercase tracking-wider"
                              title={`${Math.round(rec.probation_ratio * 100)}% thử việc + ${Math.round((1 - rec.probation_ratio) * 100)}% chính thức`}
                            >
                              CHUYỂN GIAO
                            </span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setPaySlipRecord(rec); }}
                            className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-500/25 transition-all"
                            title="Xem phiếu lương"
                          >
                            📄 Phiếu lương
                          </button>
                          {sheet.status !== 'draft' && (() => {
                            const st = rec.employee_status ?? 'pending';
                            const badge = EMP_STATUS_BADGE[st] ?? EMP_STATUS_BADGE.pending;
                            return (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badge.cls}`}>
                                {badge.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
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

                    {/* Extra OT hours - editable (3 loại ngày qua popover) */}
                    <div className="text-right relative" onClick={e => e.stopPropagation()}>
                      {isDraft && editingCell?.id === rec.id && editingCell?.field === 'extra_ot_hours' && (
                        <div
                          className={`absolute right-0 ${popoverUp ? 'bottom-full mb-1' : 'top-full mt-1'} z-30 w-60 bg-surface border border-blue-500/30 rounded-xl shadow-2xl shadow-black/70 p-3 text-left space-y-2.5`}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null); }}
                        >
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">💪 Tăng ca phát sinh (giờ)</p>
                          {OT_FIELDS.map((f, i) => (
                            <div key={f.key}>
                              <label className="block text-[9px] font-black text-neutral-600 uppercase tracking-wider mb-1">
                                {f.label} — {(otRate(formula, f.key) * 100).toFixed(0)}%
                              </label>
                              <input ref={i === 0 ? inputRef : undefined} type="number" step="0.5" min="0" placeholder="0"
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs text-right outline-none focus:border-blue-500/50"
                                value={(rec as any)[f.key] ?? 0}
                                onChange={e => handleCellChange(rec, f.key, +e.target.value)}
                              />
                            </div>
                          ))}
                          <div className="flex justify-between items-center pt-0.5">
                            <span className="text-[9px] text-neutral-medium">= {fmt(rec.extra_ot)}đ</span>
                            <button
                              onClick={() => setEditingCell(null)}
                              className="px-3 py-1 rounded-lg bg-primary text-black text-[10px] font-black uppercase hover:opacity-90 transition-opacity"
                            >Xong</button>
                          </div>
                        </div>
                      )}
                      <span className={`text-xs ${isDraft ? 'text-blue-400 cursor-pointer' : 'text-white'}`}
                        title={otBreakdown(rec)}
                        onClick={() => isDraft && setEditingCell({ id: rec.id, field: 'extra_ot_hours' })}>
                        {totalOtHours(rec) > 0 ? `${totalOtHours(rec)}h` : '—'}
                      </span>
                    </div>

                    <span className="text-right text-xs text-white font-bold">{fmt(rec.gross_actual)}</span>
                    <span className="text-right text-xs text-orange-400">{fmt(rec.employee_bhxh)}</span>
                    <span className="text-right text-xs text-red-400">{rec.pit > 0 ? fmt(rec.pit) : '0'}</span>

                    {/* Bonus + Lý do — editable qua popover */}
                    <div className="text-right relative" onClick={e => e.stopPropagation()}>
                      {isDraft && editingCell?.id === rec.id && editingCell?.field === 'bonus' && (
                        <div
                          className={`absolute right-0 ${popoverUp ? 'bottom-full mb-1' : 'top-full mt-1'} z-30 w-60 bg-surface border border-yellow-500/30 rounded-xl shadow-2xl shadow-black/70 p-3 text-left space-y-2.5`}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null); }}
                        >
                          <p className="text-[10px] font-black text-yellow-400 uppercase tracking-wider">🎁 Thưởng tháng này</p>
                          <div>
                            <label className="block text-[9px] font-black text-neutral-600 uppercase tracking-wider mb-1">Số tiền (VND)</label>
                            <input ref={inputRef} type="number" step="100000" min="0" placeholder="0"
                              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs text-right outline-none focus:border-yellow-500/50"
                              value={rec.bonus ?? 0}
                              onChange={e => handleCellChange(rec, 'bonus', +e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-neutral-600 uppercase tracking-wider mb-1">Lý do</label>
                            <input type="text" placeholder="VD: Vượt KPI, dự án ABC..."
                              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-yellow-500/50"
                              value={rec.bonus_reason ?? ''}
                              onChange={e => handleStringChange(rec, 'bonus_reason', e.target.value)}
                            />
                          </div>
                          <div className="flex justify-between items-center pt-0.5">
                            <span className="text-[9px] text-neutral-medium">Chịu thuế, không prorate</span>
                            <button
                              onClick={() => setEditingCell(null)}
                              className="px-3 py-1 rounded-lg bg-primary text-black text-[10px] font-black uppercase hover:opacity-90 transition-opacity"
                            >Xong</button>
                          </div>
                        </div>
                      )}
                      <div
                        className={`flex flex-col items-end gap-0.5 ${isDraft ? 'cursor-pointer' : ''}`}
                        onClick={() => isDraft && setEditingCell({ id: rec.id, field: 'bonus' })}
                      >
                        {(rec.bonus ?? 0) > 0 ? (
                          <>
                            <span className={`text-xs font-bold ${isDraft ? 'text-yellow-400' : 'text-white'}`}>{fmt(rec.bonus)}</span>
                            {rec.bonus_reason && (
                              <span className="text-[9px] text-yellow-200/50 italic truncate max-w-[7rem]" title={rec.bonus_reason}>
                                {rec.bonus_reason}
                              </span>
                            )}
                          </>
                        ) : isDraft ? (
                          <span className="px-2 py-0.5 rounded-md border border-dashed border-yellow-500/40 text-yellow-400/80 text-[10px] font-bold hover:bg-yellow-500/10 hover:text-yellow-300 transition-colors">
                            + Thưởng
                          </span>
                        ) : (
                          <span className="text-xs text-white">—</span>
                        )}
                      </div>
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
                          {!rec.is_probation && rec.probation_ratio > 0 && rec.probation_ratio < 1 && (
                            <div className="pl-3 border-l-2 border-orange-500/30 space-y-1">
                              {isDraft ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-orange-300/80 font-semibold whitespace-nowrap">Lương CB cũ (TV):</span>
                                  <input
                                    type="number" step="100000"
                                    className="w-28 px-1.5 py-0.5 rounded bg-black/40 border border-orange-500/30 text-orange-300 text-[11px] text-right outline-none focus:border-orange-500/60"
                                    value={rec.pre_official_base_salary ?? ''}
                                    placeholder="Nhập lương cũ..."
                                    onChange={e => handleCellChange(rec, 'pre_official_base_salary', +e.target.value || 0)}
                                  />
                                </div>
                              ) : rec.pre_official_base_salary != null ? (
                                <Row label="Lương CB cũ (thử việc)" value={fmt(rec.pre_official_base_salary)} color="text-orange-300/80" />
                              ) : null}
                              {rec.pre_official_base_salary != null && (
                                <Row
                                  label="Prorate"
                                  value={`${fmt(rec.pre_official_base_salary)} × ${Math.round(rec.probation_ratio * 100)}% + ${fmt(rec.base_salary)} × ${Math.round((1 - rec.probation_ratio) * 100)}%`}
                                  color="text-orange-200/60"
                                />
                              )}
                            </div>
                          )}
                          <Row label="PC ăn trưa" value={fmt(rec.lunch_allowance)} sub={`Thực: ${fmt(Math.round(rec.lunch_allowance * ratio))}`} />
                          <Row label="PC xăng xe" value={fmt(rec.transport_allowance)} sub={`Thực: ${fmt(Math.round(rec.transport_allowance * ratio))}`} />
                          <Row label="PC điện thoại" value={fmt(rec.phone_allowance)} sub={`Thực: ${fmt(Math.round(rec.phone_allowance * ratio))}`} />
                          <Row label="PC trang phục" value={fmt(rec.clothing_allowance)} sub={`Thực: ${fmt(Math.round(rec.clothing_allowance * ratio))}`} />
                          <Row label="KPI" value={fmt(rec.kpi_allowance)} sub={`Thực: ${fmt(Math.round(rec.kpi_allowance * ratio))}`} />
                          {!rec.is_probation && rec.probation_ratio > 0 && rec.probation_ratio < 1 && (
                            <div className="pl-3 border-l-2 border-orange-500/30 space-y-1">
                              {isDraft ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-orange-300/80 font-semibold whitespace-nowrap">KPI cũ (TV):</span>
                                  <input
                                    type="number" step="100000"
                                    className="w-28 px-1.5 py-0.5 rounded bg-black/40 border border-orange-500/30 text-orange-300 text-[11px] text-right outline-none focus:border-orange-500/60"
                                    value={rec.pre_official_kpi_allowance ?? ''}
                                    placeholder="Nhập KPI cũ..."
                                    onChange={e => handleCellChange(rec, 'pre_official_kpi_allowance', +e.target.value || 0)}
                                  />
                                </div>
                              ) : rec.pre_official_kpi_allowance != null ? (
                                <Row label="KPI cũ (thử việc)" value={fmt(rec.pre_official_kpi_allowance)} color="text-orange-300/80" />
                              ) : null}
                              {rec.pre_official_kpi_allowance != null && (
                                <Row
                                  label="Prorate"
                                  value={`${fmt(rec.pre_official_kpi_allowance)} × ${Math.round(rec.probation_ratio * 100)}% + ${fmt(rec.kpi_allowance)} × ${Math.round((1 - rec.probation_ratio) * 100)}%`}
                                  color="text-orange-200/60"
                                />
                              )}
                            </div>
                          )}
                          <Row label="Tăng ca MĐ" value={fmt(rec.default_ot)} sub={`Thực: ${fmt(Math.round(rec.default_ot * ratio))}`} />
                          {!rec.is_probation && rec.probation_ratio > 0 && rec.probation_ratio < 1 && (
                            <div className="pl-3 border-l-2 border-orange-500/30 space-y-1">
                              {isDraft ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-orange-300/80 font-semibold whitespace-nowrap">Tăng ca cũ (TV):</span>
                                  <input
                                    type="number" step="100000"
                                    className="w-28 px-1.5 py-0.5 rounded bg-black/40 border border-orange-500/30 text-orange-300 text-[11px] text-right outline-none focus:border-orange-500/60"
                                    value={rec.pre_official_default_ot ?? ''}
                                    placeholder="Nhập tăng ca cũ..."
                                    onChange={e => handleCellChange(rec, 'pre_official_default_ot', +e.target.value || 0)}
                                  />
                                </div>
                              ) : rec.pre_official_default_ot != null ? (
                                <Row label="Tăng ca cũ (thử việc)" value={fmt(rec.pre_official_default_ot)} color="text-orange-300/80" />
                              ) : null}
                              {rec.pre_official_default_ot != null && (
                                <Row
                                  label="Prorate"
                                  value={`${fmt(rec.pre_official_default_ot)} × ${Math.round(rec.probation_ratio * 100)}% + ${fmt(rec.default_ot)} × ${Math.round((1 - rec.probation_ratio) * 100)}%`}
                                  color="text-orange-200/60"
                                />
                              )}
                            </div>
                          )}
                          <Row
                            label="Tăng ca phát sinh"
                            value={totalOtHours(rec) > 0 ? `${totalOtHours(rec)}h → ${fmt(rec.extra_ot)}đ` : '—'}
                            sub={totalOtHours(rec) > 0 ? otBreakdown(rec) : undefined}
                            highlight
                          />
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
                              <Row label="TNCT (CB + Xăng + ĐT + KPI)" value={fmt(rec.taxable_income)} />
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

                      {/* Lời nhắn cho nhân viên — hiện trên phiếu lương của nhân viên */}
                      {(isDraft || rec.note) && (
                        <div className="mt-4 pt-4 border-t border-white/[0.06]">
                          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">
                            💌 Lời nhắn cho nhân viên
                          </p>
                          {isDraft ? (
                            <div onClick={e => e.stopPropagation()}>
                              <textarea
                                rows={2}
                                placeholder="VD: Chúc mừng bạn lên chính thức! Công ty sẽ bao trọn chi phí cho chuyến du lịch sắp tới. Cảm ơn bạn."
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-primary/50 resize-none placeholder:text-neutral-700"
                                value={rec.note ?? ''}
                                onChange={e => handleStringChange(rec, 'note', e.target.value)}
                              />
                              <p className="text-[9px] text-neutral-600 mt-1">Nhân viên sẽ thấy lời nhắn này khi mở phiếu lương trên Portal.</p>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-primary/[0.06] border border-primary/20 rounded-lg">
                              <p className="text-[11px] text-primary/90 whitespace-pre-wrap">{rec.note}</p>
                            </div>
                          )}
                        </div>
                      )}

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
            <div className="grid grid-cols-[3fr,0.8fr,1fr,0.8fr,1fr,0.8fr,0.8fr,0.8fr,1.2fr] gap-0 px-4 py-3 bg-black/40 text-xs font-bold">
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

      {/* Sửa công chuẩn — portal vì header cha có backdrop-blur/transform */}
      {stdModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setStdModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-[20px] border border-primary/10 bg-surface p-6 animate-scaleIn">
            <h3 className="text-white font-black text-base uppercase tracking-tight">Sửa công chuẩn</h3>
            <p className="text-neutral-medium text-xs mt-1 leading-relaxed">
              Số tự tính chỉ đếm T2–T6. Sửa khi tháng có lễ (2/9) hoặc có buổi làm T7.
              <b className="text-yellow-400"> Lưu xong sẽ tính lại lương cả {records.length} người.</b>
            </p>

            <label className="block mt-4 text-[10px] font-black text-neutral-600 uppercase tracking-wider">Số ngày công chuẩn</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number" step="0.5" min="1" max="31" autoFocus
                value={stdDraft}
                onChange={e => setStdDraft(e.target.value)}
                className="w-24 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white font-black text-lg text-right outline-none focus:border-primary/60"
              />
              <span className="text-neutral-medium text-xs">ngày · hiện tại <b className="text-white">{sheetStd}</b></span>
            </div>

            <label className="block mt-4 text-[10px] font-black text-neutral-600 uppercase tracking-wider">
              Lý do <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={stdNote}
              onChange={e => setStdNote(e.target.value)}
              placeholder="VD: Tháng 9 có lễ 2/9 + nửa ngày làm T7 05/09"
              className="w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary/60 resize-none"
            />

            <div className="flex items-center justify-between gap-3 mt-5">
              <span className="text-[11px] text-red-400 font-semibold">{stdError && stdNote ? stdError : ''}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setStdModal(false)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-neutral-medium hover:text-white text-xs font-black uppercase transition-all"
                >
                  Huỷ
                </button>
                <button
                  onClick={submitStd}
                  disabled={!!stdError || loading}
                  className="px-4 py-2 rounded-lg bg-primary text-black text-xs font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Xác nhận & tính lại
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

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
