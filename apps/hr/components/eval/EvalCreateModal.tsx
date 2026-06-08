import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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

/** Next 6-month anniversary from official_date relative to today */
function nextSemiAnnualDate(officialDate: string): string {
  const base = new Date(officialDate);
  const now  = new Date();
  // Find the next 6-month mark
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
  if (days < 0)   return `Đã quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return 'Hôm nay!';
  if (type === 'probation') return `Còn ${days} ngày hết thử việc`;
  return `Còn ${days} ngày đến kỳ review`;
}

// ─────────────────────────────────────────────────────────

const EvalCreateModal: React.FC<EvalCreateModalProps> = ({ employees, currentUser, onCreated, onClose }) => {
  // Track where mousedown started — only close backdrop if drag originated ON the backdrop,
  // not when user drags from inside the modal (e.g. selecting text in an input)
  const backdropMouseDownRef = useRef(false);

  const [step, setStep]             = useState<1 | 2>(1);
  const [periodType, setPeriodType] = useState<EvalPeriodType>('probation');
  const [periodLabel, setPeriodLabel] = useState(autoLabel('probation'));
  const [employeeId, setEmployeeId] = useState('');
  const [leaderUserId, setLeaderUserId] = useState(currentUser.id);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [deadline, setDeadline] = useState('');

  // ── Smart filter + annotate ──────────────────────────────

  const candidateEmployees = useMemo(() => {
    const base = employees.filter(e => e.status === 'active' && (e.type === 'fulltime' || e.type === 'parttime'));

    if (periodType === 'probation') {
      // Only employees still in probation (probation_end is in the future, or up to 14 days past)
      return base
        .filter(e => e.probation_end && daysUntil(e.probation_end) !== null && daysUntil(e.probation_end)! > -14)
        .map(e => ({ emp: e, days: daysUntil(e.probation_end), dateLabel: e.probation_end! }))
        .sort((a, b) => (a.days ?? 999) - (b.days ?? 999)); // sắp xếp gần nhất lên trên
    } else {
      // Only officially hired (official_date set), not in probation
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
    setEmployeeId(''); // reset khi đổi loại
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId)          { setError('Vui lòng chọn nhân viên'); return; }
    if (!periodLabel.trim())  { setError('Vui lòng nhập tên kỳ'); return; }
    if (!deadline)            { setError('Vui lòng chọn hạn nộp tự đánh giá'); return; }
    if (!leaderUserId.trim()) { setError('Vui lòng nhập User ID của leader'); return; }

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

  const inputCls = "w-full bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all";
  const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium";

  const selectedCandidate = candidateEmployees.find(c => c.emp.id === employeeId);

  // createPortal renders straight to document.body — bypasses any ancestor
  // with transform/filter/will-change that would break position:fixed
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && backdropMouseDownRef.current) onClose(); }}
    >
      <div
        className="bg-surface rounded-[20px] border border-primary/10 w-full max-w-lg animate-scaleIn overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-white/5">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-neutral-light">📋 Tạo kỳ đánh giá</h3>
            <p className="text-xs text-neutral-medium mt-0.5">Bước {step}/2 — {step === 1 ? 'Chọn loại kỳ' : 'Chọn nhân viên & xác nhận'}</p>
          </div>
          <button onClick={onClose} className="text-neutral-medium hover:text-neutral-light transition-all text-lg leading-none">✕</button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/5">
          <div className="h-full bg-primary transition-all" style={{ width: step === 1 ? '50%' : '100%' }} />
        </div>

        <div className="p-6">
          {/* ── STEP 1: Chọn loại kỳ ── */}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-neutral-medium">Chọn loại đánh giá bạn muốn tạo:</p>

              <div className="grid grid-cols-1 gap-3">
                {([
                  {
                    type: 'probation' as EvalPeriodType,
                    icon: '🧪',
                    title: 'Đánh giá hết thử việc',
                    desc: 'Dành cho nhân viên đang trong giai đoạn thử việc',
                    count: employees.filter(e => e.status === 'active' && (e.type === 'fulltime' || e.type === 'parttime') && e.probation_end && daysUntil(e.probation_end)! > -14).length,
                    countLabel: 'NV đang thử việc',
                  },
                  {
                    type: 'semi_annual' as EvalPeriodType,
                    icon: '📅',
                    title: 'Review định kỳ 6 tháng',
                    desc: 'Dành cho nhân viên đã chính thức (sau thử việc)',
                    count: employees.filter(e => e.status === 'active' && (e.type === 'fulltime' || e.type === 'parttime') && e.official_date).length,
                    countLabel: 'NV đã chính thức',
                  },
                ]).map(opt => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => { handlePeriodTypeChange(opt.type); setStep(2); }}
                    className={`flex items-start gap-4 p-4 rounded-[20px] border text-left transition-all hover:border-primary/40 hover:bg-primary/5 ${
                      periodType === opt.type ? 'border-primary/40 bg-primary/5' : 'border-white/8'
                    }`}
                    style={{ background: periodType === opt.type ? 'rgba(255,149,0,0.05)' : 'rgba(255,255,255,0.02)' }}
                  >
                    <span className="text-2xl mt-0.5">{opt.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-black text-neutral-light">{opt.title}</p>
                      <p className="text-xs text-neutral-medium mt-0.5">{opt.desc}</p>
                    </div>
                    <span className="text-xs font-black text-primary shrink-0">
                      {opt.count} {opt.countLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Chọn nhân viên + xác nhận ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Back to step 1 */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-neutral-medium hover:text-primary transition-all"
              >
                ← Đổi loại kỳ
              </button>

              {/* Loại đã chọn (readonly) */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                <span>{periodType === 'probation' ? '🧪' : '📅'}</span>
                <span className="text-xs font-black text-primary uppercase tracking-wider">
                  {periodType === 'probation' ? 'Đánh giá hết thử việc' : 'Review định kỳ 6 tháng'}
                </span>
              </div>

              {/* Employee list — thẻ chọn, không phải dropdown */}
              <div className="flex flex-col gap-1">
                <label className={labelCls}>
                  Nhân viên * &nbsp;
                  <span className="text-neutral-medium normal-case font-normal">
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
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {candidateEmployees.map(({ emp, days }) => {
                      const isSelected = employeeId === emp.id;
                      const dc = urgencyColor(days);
                      const dl = urgencyLabel(days, periodType);
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => setEmployeeId(emp.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-primary/50 bg-primary/10'
                              : 'border-white/8 hover:border-white/15'
                          }`}
                          style={{ background: isSelected ? 'rgba(255,149,0,0.08)' : 'rgba(255,255,255,0.02)' }}
                        >
                          {/* Check */}
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-primary bg-primary' : 'border-white/20'}`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-neutral-light truncate">{emp.full_name}</p>
                            <p className="text-xs text-neutral-medium">{emp.employee_code} — {emp.position || 'N/A'}</p>
                          </div>

                          {/* Days badge */}
                          {dl && (
                            <span className={`text-[10px] font-black shrink-0 ${dc}`}>{dl}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Period label */}
              <div className="flex flex-col gap-1">
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
              <div className="flex flex-col gap-1">
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

              {/* Leader user ID */}
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Leader User ID *</label>
                <input
                  type="text"
                  value={leaderUserId}
                  onChange={e => setLeaderUserId(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-neutral-medium">Mặc định: tài khoản của bạn. Thay UUID nếu người đánh giá khác.</p>
              </div>

              {error && (
                <p className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">{error}</p>
              )}

              {/* Selected summary */}
              {selectedCandidate && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-white/8 bg-white/2">
                  <span className="text-status-success text-sm">✓</span>
                  <p className="text-xs text-neutral-medium">
                    <span className="font-black text-neutral-light">{selectedCandidate.emp.full_name}</span>
                    {' — '}{periodLabel}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={saving || !employeeId}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-black hover:opacity-90 transition-all disabled:opacity-50"
                  style={{ background: '#FF9500' }}
                >
                  {saving ? 'Đang tạo...' : 'Tạo kỳ'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EvalCreateModal;
