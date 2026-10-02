import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AppBackground from '@/components/AppBackground';
import { PayPayrollSheet, PayPayrollRecord, PayrollFormulaConfig } from '@/types';
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
  /** Áp lại công thức hiện hành cho cả bảng (khi hệ số/công thức đổi sau lúc tạo bảng). */
  onRecalcAll?: () => void;
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
  confirmed: { label: '✅ Đã XN', cls: 'bg-green-500/15 text-green-400' },
  disputed:  { label: '❌ Khiếu nại', cls: 'bg-red-500/15 text-red-400' },
  resolved:  { label: '✓ Đã giải quyết', cls: 'bg-blue-500/15 text-blue-400' },
};

const PayrollSheet: React.FC<Props> = ({
  sheet, records, formula, loading, onBack, onUpdateRecord, onSaveRecord, onUpdateStandardWorkDays, onRecalcAll, onConfirm, onMarkPaid, onRollback, onResolveDispute, onRefresh,
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

  // Xác nhận bảng lương = khoá số liệu + phiếu lương hiện cho toàn bộ NV trên Portal
  // (portalService lọc sheet `confirmed|paid`) ⇒ bắt bấm 2 lần, không cho ấn nhầm 1 phát.
  const [confirmModal, setConfirmModal] = useState(false);

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
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-primary/10" style={{ background: 'rgba(15,15,15,0.9)' }}>
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} aria-label="Quay lại danh sách" className="w-9 h-9 rounded-xl border border-white/10 text-neutral-medium hover:text-white hover:border-white/20 transition-all">←</button>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>{sheet.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                  sheet.status === 'draft' ? 'bg-orange-500/20 text-orange-400' :
                  sheet.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
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
                  <span className="text-blue-400 text-[10px] font-semibold">
                    Đã trả: {new Date(sheet.paid_at).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 1 nút duy nhất theo trạng thái: nháp → "Tính lại" (kéo chấm công + áp công thức,
                tự ghi DB nên đã là số mới nhất); đã chốt → "Làm mới" (xem NV xác nhận/khiếu nại). */}
            {!isDraft && onRefresh && (
              <button onClick={onRefresh} disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 hover:text-white transition-all disabled:opacity-50"
                title="Làm mới trạng thái xác nhận">
                Làm mới
              </button>
            )}
            {isDraft && onRecalcAll && (
              <button
                onClick={() => {
                  if (confirm(
                    `Đồng bộ chấm công + tính lại lương của ${records.length} người?\n\n`
                    + `• Ngày công và giờ OT sẽ lấy lại từ BẢNG CHẤM CÔNG ĐÃ CHỐT của tháng này.\n`
                    + `• Ai đang được sửa tay ngày công/OT trên bảng lương sẽ bị GHI ĐÈ.\n`
                    + `• Công thức/hệ số hiện hành cũng được áp lại. Số tiền có thể thay đổi.`,
                  )) onRecalcAll();
                }}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 hover:text-white transition-all disabled:opacity-50"
                title="Kéo lại ngày công/OT từ chấm công đã chốt + áp lại công thức (không đổi công chuẩn)">
                Tính lại
              </button>
            )}
            {isDraft && (
              <button onClick={() => setConfirmModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all hover:opacity-90"
                style={{ background: '#FF9500' }}>
                Xác nhận bảng lương
              </button>
            )}
            {sheet.status === 'confirmed' && onMarkPaid && (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={canMarkPaid ? onMarkPaid : undefined}
                  disabled={!canMarkPaid}
                  title={!canMarkPaid ? `Còn ${pendingCount} chờ XN, ${disputedCount} khiếu nại chưa giải quyết` : ''}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all ${canMarkPaid ? 'hover:opacity-90' : 'opacity-40 cursor-not-allowed'}`}
                  style={{ background: canMarkPaid ? '#FF9500' : '#404040' }}>
                  Đánh dấu đã trả lương
                </button>
                {!canMarkPaid && (
                  <span className="text-[10px] text-orange-400/80">
                    {pendingCount > 0 && `${pendingCount} chờ xác nhận`}
                    {pendingCount > 0 && disputedCount > 0 && ' · '}
                    {disputedCount > 0 && `${disputedCount} khiếu nại`}
                  </span>
                )}
              </div>
            )}
            {sheet.status === 'confirmed' && onRollback && (
              <button onClick={onRollback}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 hover:text-white transition-all">
                Huỷ xác nhận
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-6 md:px-12 py-6 animate-fadeInUp">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Tổng Gross thực tế', value: totalGrossActual, color: 'text-white' },
            { label: 'Tổng BH nhân viên', value: totalBhNv, color: 'text-orange-400' },
            { label: 'Tổng thuế TNCN', value: totalPit, color: 'text-red-400' },
            { label: 'Tổng thưởng KPI', value: totalBonus, color: 'text-primary' },
            { label: 'Tổng Net thực lĩnh', value: totalNet, color: 'text-green-400' },
            { label: 'Tổng chi phí công ty', value: totalCompanyCost, color: 'text-blue-400' },
          ].map(card => (
            <div key={card.label} className="rounded-[20px] border border-primary/10 p-4 space-y-1 bg-surface">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{card.label}</p>
              <p className={`text-xl font-black tabular-nums ${card.color}`}>{fmt(card.value)}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
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
                            className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 text-[9px] font-bold uppercase tracking-wider hover:bg-orange-500/25 transition-all"
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
                          className="w-16 px-1 py-0.5 rounded bg-black/40 border border-green-500/40 text-white text-xs text-right outline-none"
                          value={rec.work_days}
                          onChange={e => handleCellChange(rec, 'work_days', +e.target.value)}
                          onBlur={() => setEditingCell(null)}
                        />
                      ) : (
                        <span className={`text-xs ${isDraft ? 'text-green-400 cursor-text' : 'text-white'}`}
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

                    <span className="text-right text-sm text-green-400 font-black">{fmt(rec.net_salary)}</span>
                  </div>

                  {/* Expanded: 8-step detail */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-black/20 border-b border-white/[0.04]">
                      {(() => {
                        const fullMonth = Math.abs(ratio - 1) < 1e-9;
                        const isSplit = !rec.is_probation && rec.probation_ratio > 0 && rec.probation_ratio < 1;
                        const otH = totalOtHours(rec);
                        const bonus = rec.bonus ?? 0;
                        const colSpan = fullMonth ? 2 : 3;
                        const prorate = (field: 'pre_official_base_salary' | 'pre_official_kpi_allowance' | 'pre_official_default_ot', label: string, current: number) =>
                          isSplit && (
                            <tr>
                              <td colSpan={colSpan} className="pb-2">
                                <ProrateEditor
                                  label={label}
                                  oldValue={rec[field]}
                                  current={current}
                                  probationRatio={rec.probation_ratio}
                                  editable={isDraft}
                                  onChange={v => handleCellChange(rec, field, v)}
                                />
                              </td>
                            </tr>
                          );
                        const income = (label: string, base: number, opts: { exempt?: boolean } = {}) => (
                          <tr className="border-b border-white/5">
                            <td className="py-2 text-neutral-400">
                              {label}
                              {opts.exempt && <span className="ml-2 text-[9px] font-black uppercase text-neutral-600">miễn thuế</span>}
                            </td>
                            {!fullMonth && <td className="py-2 text-right text-neutral-500 tabular-nums">{fmt(base)}</td>}
                            <td className="py-2 text-right text-white font-semibold tabular-nums">{fmt(Math.round(base * ratio))}</td>
                          </tr>
                        );
                        return (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                                Chi tiết tính lương — <span className="text-white">{empName}</span>
                              </p>
                              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                                Ngày công <span className="text-white">{rec.work_days} / {std}</span>
                                {!fullMonth && <> · tỷ lệ <span className="text-white">{(ratio * 100).toFixed(1)}%</span></>}
                                {rec.is_probation && <span className="ml-2 px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400">Thử việc</span>}
                              </p>
                            </div>

                            {/* Dòng tiền: Gross − BH − Thuế = Net */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                              <FlowCard label="Gross thực tế" value={rec.gross_actual} />
                              <FlowCard
                                sign="−"
                                label={rec.is_probation ? 'BH nhân viên' : `BH nhân viên ${(formula.bhEmployeeRate * 100).toFixed(1)}%`}
                                value={rec.employee_bhxh}
                                note={rec.is_probation ? 'Thử việc không đóng' : undefined}
                              />
                              <FlowCard
                                sign="−"
                                label={rec.is_probation ? `Thuế TNCN ${(formula.probationPitRate * 100).toFixed(0)}%` : 'Thuế TNCN'}
                                value={rec.pit}
                                note={rec.is_probation ? 'Cố định' : 'Lũy tiến'}
                              />
                              <FlowCard sign="=" label="Net thực lĩnh" value={rec.net_salary} primary />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr] gap-3">
                              {/* Thu nhập */}
                              <div className="rounded-[20px] border border-primary/10 bg-surface p-5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-2">Thu nhập</p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-neutral-600">
                                      <th className="py-2 text-left font-black">Khoản</th>
                                      {!fullMonth && <th className="py-2 text-right font-black">Mức HĐ</th>}
                                      <th className="py-2 text-right font-black">{fullMonth ? 'Số tiền' : 'Thực nhận'}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {income('Lương cơ bản', rec.base_salary)}
                                    {prorate('pre_official_base_salary', 'Lương CB cũ (thử việc)', rec.base_salary)}
                                    {income('PC ăn trưa', rec.lunch_allowance, { exempt: true })}
                                    {income('PC xăng xe', rec.transport_allowance)}
                                    {income('PC điện thoại', rec.phone_allowance)}
                                    {income('PC trang phục', rec.clothing_allowance, { exempt: true })}
                                    {income('KPI', rec.kpi_allowance)}
                                    {prorate('pre_official_kpi_allowance', 'KPI cũ (thử việc)', rec.kpi_allowance)}
                                    {income('Tăng ca mặc định', rec.default_ot, { exempt: true })}
                                    {prorate('pre_official_default_ot', 'Tăng ca cũ (thử việc)', rec.default_ot)}
                                    {otH > 0 && (
                                      <tr className="border-b border-white/5">
                                        <td className="py-2 text-neutral-400">
                                          Tăng ca phát sinh <span className="text-neutral-600">({otH}h)</span>
                                          <span className="ml-2 text-[9px] font-black uppercase text-neutral-600">miễn thuế</span>
                                          <p className="text-[10px] text-neutral-600">{otBreakdown(rec)}</p>
                                        </td>
                                        {!fullMonth && <td />}
                                        <td className="py-2 text-right text-white font-semibold tabular-nums">{fmt(rec.extra_ot)}</td>
                                      </tr>
                                    )}
                                    {bonus > 0 && (
                                      <tr className="border-b border-white/5">
                                        <td className="py-2 text-neutral-400">
                                          Thưởng
                                          {rec.bonus_reason && <p className="text-[10px] text-neutral-600">{rec.bonus_reason}</p>}
                                        </td>
                                        {!fullMonth && <td />}
                                        <td className="py-2 text-right text-primary font-semibold tabular-nums">+{fmt(bonus)}</td>
                                      </tr>
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr>
                                      <td className="pt-3 text-neutral-600">Gross tham chiếu (đủ công, chưa thưởng/OT)</td>
                                      {!fullMonth && <td />}
                                      <td className="pt-3 text-right text-neutral-500 tabular-nums">{fmt(rec.gross_ref)}</td>
                                    </tr>
                                    <tr>
                                      <td className="pt-1 font-black text-white">Gross thực tế</td>
                                      {!fullMonth && <td />}
                                      <td className="pt-1 text-right font-black text-white tabular-nums">{fmt(rec.gross_actual)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>

                              {/* Thuế TNCN */}
                              <div className="rounded-[20px] border border-primary/10 bg-surface p-5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-2">
                                  Thuế TNCN {rec.is_probation ? `· ${(formula.probationPitRate * 100).toFixed(0)}% cố định` : '· lũy tiến'}
                                </p>
                                <Line label="Thu nhập chịu thuế" sub="CB + xăng + ĐT + KPI + thưởng" value={fmt(rec.taxable_income)} />
                                {rec.is_probation ? (
                                  <Line label="Thuế suất" value={`${(formula.probationPitRate * 100).toFixed(0)}%`} muted />
                                ) : (
                                  <>
                                    <Line label="BH nhân viên" value={`−${fmt(rec.employee_bhxh)}`} muted />
                                    <Line label="Giảm trừ bản thân" value={`−${fmt(formula.personalDeduction)}`} muted />
                                    <Line label={`Giảm trừ NPT (${rec.dependents_count})`} value={`−${fmt(rec.dependents_count * formula.dependentDeduction)}`} muted />
                                    <Line label="Thu nhập tính thuế" value={rec.assessable_income > 0 ? fmt(rec.assessable_income) : '0'} sub={rec.assessable_income > 0 ? undefined : 'Âm → tính 0'} />
                                  </>
                                )}
                                <Line label="Thuế phải nộp" value={fmt(rec.pit)} total />
                              </div>

                              {/* Chi phí công ty */}
                              <div className="rounded-[20px] border border-primary/10 bg-surface p-5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-2">Công ty chi</p>
                                <Line label="Gross thực tế" value={fmt(rec.gross_actual)} />
                                <Line
                                  label={rec.is_probation ? 'BH công ty' : `BH công ty ${(formula.bhCompanyRate * 100).toFixed(1)}%`}
                                  value={rec.is_probation ? '0' : `+${fmt(rec.company_bhxh)}`}
                                  sub={rec.is_probation ? 'Thử việc không đóng' : undefined}
                                  muted
                                />
                                <Line label="Tổng chi phí" value={fmt(rec.total_company_cost)} total />
                              </div>
                            </div>
                          </>
                        );
                      })()}

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
              <span className="text-right text-green-400 font-black text-sm">{fmt(totalNet)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Xác nhận bảng lương — bước 2, tránh ấn nhầm nút ở header */}
      {confirmModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-[20px] border border-primary/10 bg-surface p-6 animate-scaleIn">
            <h3 className="text-white font-black text-base uppercase tracking-tight">Xác nhận bảng lương?</h3>
            <p className="text-neutral-medium text-xs mt-1 leading-relaxed">
              Sau khi xác nhận, <b className="text-yellow-400">phiếu lương sẽ hiện cho toàn bộ nhân viên</b> trên
              Portal để họ xác nhận/khiếu nại. Muốn sửa lại phải bấm “Huỷ xác nhận”.
            </p>

            <div className="mt-4 rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-600 font-black uppercase tracking-wider text-[10px]">Bảng</span>
                <b className="text-white">{sheet.title}</b>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-600 font-black uppercase tracking-wider text-[10px]">Số người</span>
                <b className="text-white tabular-nums">{records.length}</b>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-600 font-black uppercase tracking-wider text-[10px]">Tổng net</span>
                <b className="text-green-400 tabular-nums">{fmt(totalNet)}</b>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-white/10 text-neutral-medium hover:text-white text-xs font-black uppercase transition-all"
              >
                Huỷ
              </button>
              <button
                onClick={() => { setConfirmModal(false); onConfirm?.(); }}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-primary text-black text-xs font-black uppercase disabled:opacity-30 transition-all"
              >
                Xác nhận & gửi phiếu lương
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

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

/** Ô trong dải dòng tiền Gross − BH − Thuế = Net. */
const FlowCard: React.FC<{ label: string; value: number; sign?: string; note?: string; primary?: boolean }> =
  ({ label, value, sign, note, primary }) => (
    <div
      className={`rounded-[20px] border p-4 ${primary ? '' : 'border-primary/10 bg-surface'}`}
      style={primary ? { background: 'rgba(255,149,0,0.08)', borderColor: 'rgba(255,149,0,0.35)' } : undefined}
    >
      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        {sign && <span className="mr-1 text-neutral-500">{sign}</span>}{label}
      </p>
      <p className={`text-2xl font-black tabular-nums ${primary ? 'text-primary' : 'text-white'}`}>{fmt(value)}</p>
      {note && <p className="text-[10px] text-neutral-600">{note}</p>}
    </div>
  );

/** Dòng label — số trong thẻ Thuế / Công ty chi. `total` = dòng kết quả có gạch trên. */
const Line: React.FC<{ label: string; value: string; sub?: string; muted?: boolean; total?: boolean }> =
  ({ label, value, sub, muted, total }) => (
    <div className={`flex items-start justify-between gap-3 text-xs ${total ? 'mt-2 pt-3 border-t border-white/10' : 'py-1.5'}`}>
      <div>
        <span className={total ? 'font-black text-white' : 'text-neutral-400'}>{label}</span>
        {sub && <p className="text-[10px] text-neutral-600">{sub}</p>}
      </div>
      <span className={`tabular-nums whitespace-nowrap ${total ? 'font-black text-white text-sm' : muted ? 'text-neutral-500' : 'text-white font-semibold'}`}>
        {value}
      </span>
    </div>
  );

/** Tháng lên chính thức giữa chừng: nhập mức cũ (thử việc) + hiện công thức prorate. */
const ProrateEditor: React.FC<{
  label: string; oldValue: number | null | undefined; current: number;
  probationRatio: number; editable: boolean; onChange: (v: number) => void;
}> = ({ label, oldValue, current, probationRatio, editable, onChange }) => {
  if (!editable && oldValue == null) return null;
  const pTv = Math.round(probationRatio * 100);
  return (
    <div className="ml-3 pl-3 border-l-2 border-primary/30 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
      <span className="font-semibold text-primary/80">{label}</span>
      {editable ? (
        <input
          type="number" step="100000"
          className="w-28 px-2 py-0.5 rounded bg-[#1a1a1a] border border-white/10 text-white text-[11px] text-right outline-none focus:border-primary/50"
          value={oldValue ?? ''}
          placeholder="Nhập mức cũ..."
          onChange={e => onChange(+e.target.value || 0)}
        />
      ) : (
        <span className="text-white">{fmt(oldValue!)}</span>
      )}
      {oldValue != null && (
        <span className="text-neutral-600">
          {fmt(oldValue)} × {pTv}% + {fmt(current)} × {100 - pTv}%
        </span>
      )}
    </div>
  );
};

export default PayrollSheet;
