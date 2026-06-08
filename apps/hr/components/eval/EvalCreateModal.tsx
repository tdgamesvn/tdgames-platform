import React, { useState, useMemo } from 'react';
import { HrEmployee, EvalPeriodType, AccountUser } from '@/types';
import { createCycle, autoLabel } from '../../services/evaluationService';

interface EvalCreateModalProps {
  employees:   HrEmployee[];
  currentUser: AccountUser;
  onCreated:   () => void;
  onClose:     () => void;
}

// ── Helpers ──────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function nextSemiAnnualDate(officialDate: string): string {
  const base = new Date(officialDate);
  const now  = new Date();
  let next = new Date(base);
  while (next <= now) {
    next = new Date(next);
    next.setMonth(next.getMonth() + 6);
  }
  return next.toISOString().split('T')[0];
}

function urgencyColor(days: number | null): string {
  if (days === null) return 'text-neutral-medium';
  if (days < 0)   return 'text-red-400';
  if (days <= 7)  return 'text-red-400';
  if (days <= 14) return 'text-orange-400';
  if (days <= 30) return 'text-yellow-400';
  return 'text-status-success';
}

function urgencyLabel(days: number | null, type: EvalPeriodType): string {
  if (days === null) return '';
  if (days < 0)   return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return 'Hôm nay!';
  if (type === 'probation') return `Còn ${days} ngày`;
  return `Còn ${days} ngày`;
}

// ─────────────────────────────────────────────────────────

const EvalCreateModal: React.FC<EvalCreateModalProps> = ({ employees, currentUser, onCreated, onClose }) => {
  const [step, setStep]               = useState<1 | 2>(1);
  const [periodType, setPeriodType]   = useState<EvalPeriodType>('probation');
  const [periodLabel, setPeriodLabel] = useState(autoLabel('probation'));
  const [employeeId, setEmployeeId]   = useState('');
  const [leaderUserId, setLeaderUserId] = useState(currentUser.id);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [deadline, setDeadline]       = useState('');

  const candidateEmployees = useMemo(() => {
    const base = employees.filter(e => e.status === 'active' && (e.type === 'fulltime' || e.type === 'parttime'));
    if (periodType === 'probation') {
      return base
        .filter(e => e.probation_end && daysUntil(e.probation_end) !== null && daysUntil(e.probation_end)! > -14)
        .map(e => ({ emp: e, days: daysUntil(e.probation_end), dateLabel: e.probation_end! }))
        .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
    } else {
      return base
        .filter(e => e.official_date)
        .map(e => {
          const nextDate = nextSemiAnnualDate(e.official_date!);
          return { emp: e, days: daysUntil(nextDate), dateLabel: nextDate };
        })
        .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
    }
  }, [employees, periodType]);

  const handlePeriodTypeChange = (t: EvalPeriodType) => {
    setPeriodType(t);
    setPeriodLabel(autoLabel(t));
    setEmployeeId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId)         { setError('Vui lòng chọn nhân viên'); return; }
    if (!periodLabel.trim()) { setError('Vui lòng nhập tên kỳ'); return; }
    if (!deadline)           { setError('Vui lòng chọn hạn nộp tự đánh giá'); return; }
    if (!leaderUserId.trim()){ setError('Vui lòng nhập User ID của leader'); return; }

    setSaving(true); setError('');
    try {
      await createCycle({
        employee_id:    employeeId,
        period_type:    periodType,
        period_label:   periodLabel.trim(),
        leader_user_id: leaderUserId.trim(),
        created_by:     currentUser.id,
        deadline,
      });
      onCreated(); onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi tạo kỳ đánh giá');
    } finally { setSaving(false); }
  };

  const inputCls = "w-full bg-[#111111] border border-white/8 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/50 transition-all";
  const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium";
  const selectedCandidate = candidateEmployees.find(c => c.emp.id === employeeId);

  const probationCount = employees.filter(
    e => e.status === 'active' && (e.type === 'fulltime' || e.type === 'parttime')
      && e.probation_end && daysUntil(e.probation_end)! > -14
  ).length;
  const officialCount = employees.filter(
    e => e.status === 'active' && (e.type === 'fulltime' || e.type === 'parttime') && e.official_date
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="bg-[#141414] rounded-2xl border border-white/8 w-full max-w-lg animate-scaleIn overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                step >= 1 ? 'bg-primary text-black' : 'bg-white/10 text-neutral-medium'
              }`}>1</div>
              <div className={`w-8 h-px transition-all ${step === 2 ? 'bg-primary' : 'bg-white/10'}`} />
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                step === 2 ? 'bg-primary text-black' : 'bg-white/10 text-neutral-medium'
              }`}>2</div>
            </div>
            <div>
              <p className="text-sm font-black text-neutral-light">Tạo kỳ đánh giá</p>
              <p className="text-[10px] text-neutral-medium mt-0.5 uppercase tracking-wider">
                {step === 1 ? 'Bước 1 — Chọn loại kỳ' : 'Bước 2 — Nhân viên & xác nhận'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-medium hover:text-neutral-light hover:bg-white/5 transition-all text-sm"
          >✕</button>
        </div>

        <div className="p-6">

          {/* ══ STEP 1: Chọn loại kỳ ══ */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-medium mb-4">Chọn loại đánh giá bạn muốn tạo:</p>

              {/* Card — Thử việc */}
              <button
                type="button"
                onClick={() => { handlePeriodTypeChange('probation'); setStep(2); }}
                className="w-full group relative flex items-center gap-5 p-5 rounded-2xl border border-white/8 hover:border-primary/40 text-left transition-all overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(255,149,0,0.04)' }} />

                {/* Icon */}
                <div className="relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.2)' }}>
                  <span className="text-xl">🧪</span>
                </div>

                {/* Text */}
                <div className="relative flex-1 min-w-0">
                  <p className="text-sm font-black text-neutral-light group-hover:text-white transition-colors">
                    Đánh giá hết thử việc
                  </p>
                  <p className="text-xs text-neutral-medium mt-1 leading-relaxed">
                    Dành cho nhân viên đang trong giai đoạn thử việc
                  </p>
                  {/* Count pill */}
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(255,149,0,0.10)' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-wide">
                      {probationCount} NV đang thử việc
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="relative w-4 h-4 text-neutral-medium group-hover:text-primary transition-all group-hover:translate-x-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Card — 6 tháng */}
              <button
                type="button"
                onClick={() => { handlePeriodTypeChange('semi_annual'); setStep(2); }}
                className="w-full group relative flex items-center gap-5 p-5 rounded-2xl border border-white/8 hover:border-primary/40 text-left transition-all overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(255,149,0,0.04)' }} />

                <div className="relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(33,150,243,0.12)', border: '1px solid rgba(33,150,243,0.2)' }}>
                  <span className="text-xl">📅</span>
                </div>

                <div className="relative flex-1 min-w-0">
                  <p className="text-sm font-black text-neutral-light group-hover:text-white transition-colors">
                    Review định kỳ 6 tháng
                  </p>
                  <p className="text-xs text-neutral-medium mt-1 leading-relaxed">
                    Dành cho nhân viên đã chính thức (sau thử việc)
                  </p>
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(33,150,243,0.10)' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-wide">
                      {officialCount} NV đã chính thức
                    </span>
                  </div>
                </div>

                <svg className="relative w-4 h-4 text-neutral-medium group-hover:text-primary transition-all group-hover:translate-x-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* ══ STEP 2: Chọn nhân viên + xác nhận ══ */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Back */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-neutral-medium hover:text-primary transition-all mb-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Đổi loại kỳ
              </button>

              {/* Loại đã chọn */}
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-primary/20"
                style={{ background: 'rgba(255,149,0,0.06)' }}>
                <span className="text-base">{periodType === 'probation' ? '🧪' : '📅'}</span>
                <span className="text-xs font-black text-primary uppercase tracking-wider">
                  {periodType === 'probation' ? 'Đánh giá hết thử việc' : 'Review định kỳ 6 tháng'}
                </span>
              </div>

              {/* Employee list */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>
                  Nhân viên *
                  <span className="text-neutral-medium normal-case font-normal ml-1">
                    ({candidateEmployees.length} {periodType === 'probation' ? 'đang thử việc' : 'đã chính thức'})
                  </span>
                </label>

                {candidateEmployees.length === 0 ? (
                  <div className="text-center py-8 rounded-xl border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-2xl mb-2">{periodType === 'probation' ? '🧪' : '📅'}</p>
                    <p className="text-xs text-neutral-medium">
                      {periodType === 'probation'
                        ? 'Không có nhân viên nào đang trong giai đoạn thử việc'
                        : 'Không có nhân viên chính thức nào'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {candidateEmployees.map(({ emp, days }) => {
                      const isSelected = employeeId === emp.id;
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => setEmployeeId(emp.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-primary/50'
                              : 'border-white/8 hover:border-white/15'
                          }`}
                          style={{ background: isSelected ? 'rgba(255,149,0,0.08)' : 'rgba(255,255,255,0.02)' }}
                        >
                          {/* Radio */}
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? 'border-primary bg-primary' : 'border-white/20'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-neutral-light truncate">{emp.full_name}</p>
                            <p className="text-xs text-neutral-medium">{emp.employee_code} — {emp.position || 'N/A'}</p>
                          </div>

                          {days !== null && (
                            <span className={`text-[10px] font-black shrink-0 ${urgencyColor(days)}`}>
                              {urgencyLabel(days, periodType)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tên kỳ */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Tên kỳ *</label>
                <input
                  type="text"
                  value={periodLabel}
                  onChange={e => setPeriodLabel(e.target.value)}
                  placeholder="VD: Thử việc T6/2026"
                  className={inputCls}
                />
              </div>

              {/* Deadline */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Hạn nộp tự đánh giá *</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={inputCls}
                  required
                />
              </div>

              {/* Leader */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Leader User ID *</label>
                <input
                  type="text"
                  value={leaderUserId}
                  onChange={e => setLeaderUserId(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-neutral-medium">Mặc định: tài khoản của bạn. Thay UUID nếu người đánh giá khác.</p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                  <span className="text-red-400 text-sm">⚠</span>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Summary */}
              {selectedCandidate && !error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/8"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-status-success text-sm">✓</span>
                  <p className="text-xs text-neutral-medium">
                    <span className="font-black text-neutral-light">{selectedCandidate.emp.full_name}</span>
                    {' — '}{periodLabel}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={saving || !employeeId}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-black hover:opacity-90 transition-all disabled:opacity-40"
                  style={{ background: '#FF9500' }}
                >
                  {saving ? 'Đang tạo...' : 'Tạo kỳ đánh giá'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvalCreateModal;
