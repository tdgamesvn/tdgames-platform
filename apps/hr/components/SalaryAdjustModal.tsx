import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HrEmployee, HrSalaryComponent, HrEmployeeSalary } from '@/types';
import * as hrSvc from '../services/hrService';
import { directSalaryAdjust } from '../services/changeRequestService';
import SalaryEditor from './SalaryEditor';
import type { SalaryRow } from './SalaryEditor';

// ══════════════════════════════════════════════════════════
// ── Props ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

interface Props {
  employee: HrEmployee;
  onSuccess: () => void;
  onClose: () => void;
}

// ══════════════════════════════════════════════════════════
// ── Helpers ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

const inputCls = 'w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors';
const inputStyle = { background: '#1a1a1a' };
const labelCls = 'text-neutral-500 text-[10px] font-black uppercase tracking-wider';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ══════════════════════════════════════════════════════════
// ── SalaryAdjustModal ────────────────────────────────────
// ══════════════════════════════════════════════════════════

const SalaryAdjustModal: React.FC<Props> = ({ employee, onSuccess, onClose }) => {
  // ── State ──
  const [effectiveDate, setEffectiveDate] = useState(todayStr());
  const [reason, setReason] = useState('');
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Data loading
  const [components, setComponents] = useState<HrSalaryComponent[]>([]);
  const [empSalary, setEmpSalary] = useState<HrEmployeeSalary[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load salary components + employee salary ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      hrSvc.fetchSalaryComponents(),
      hrSvc.fetchEmployeeSalary(employee.id),
    ])
      .then(([comps, salary]) => {
        if (cancelled) return;
        setComponents(comps);
        setEmpSalary(salary);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [employee.id]);

  // ── Build salary rows ──
  useEffect(() => {
    if (!components.length) return;
    const rows: SalaryRow[] = components
      .filter(c => c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => {
        const es = empSalary.find(s => s.component_id === c.id && !s.effective_to);
        return {
          component_id: c.id,
          name: c.name,
          old_amount: es?.amount || 0,
          new_amount: es?.amount || 0,
        };
      });
    setSalaryRows(rows);
  }, [components, empSalary]);

  // ── Has changes? ──
  const changedRows = salaryRows.filter(r => r.new_amount !== r.old_amount);
  const hasChanges = changedRows.length > 0;

  // ── Submit ──
  const handleSubmit = async () => {
    setError('');

    if (!effectiveDate) {
      setError('Vui lòng chọn ngày hiệu lực');
      return;
    }
    if (!hasChanges) {
      setError('Chưa có thay đổi lương nào');
      return;
    }

    setSaving(true);
    try {
      await directSalaryAdjust(
        employee.id,
        changedRows.map(r => ({
          component_id: r.component_id,
          name: r.name,
          old_amount: r.old_amount,
          new_amount: r.new_amount,
        })),
        effectiveDate,
        reason || undefined,
      );
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Không thể cập nhật lương');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──
  const backdropMouseDownRef = useRef(false);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onMouseDown={e => { backdropMouseDownRef.current = e.target === e.currentTarget; }}
      onClick={e => { if (e.target === e.currentTarget && backdropMouseDownRef.current) onClose(); }}
    >
      <div
        className="bg-surface rounded-[20px] border border-primary/10 w-full max-w-2xl max-h-[90vh] flex flex-col animate-scaleIn overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-lg font-black text-white">Điều chỉnh lương</h2>
            <p className="text-xs text-neutral-medium mt-0.5">
              {employee.full_name} {employee.employee_code ? `(${employee.employee_code})` : ''} — {employee.position || 'N/A'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-medium hover:text-white hover:bg-white/5 transition-all"
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-neutral-medium text-sm animate-td-pulse">
              Đang tải bảng lương...
            </div>
          ) : (
            <>
              {/* Salary editor */}
              <SalaryEditor rows={salaryRows} onChange={setSalaryRows} />

              {/* Effective date */}
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Ngày hiệu lực *</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              {/* Reason (optional) */}
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Lý do</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Nhập lý do (không bắt buộc)..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
                  style={inputStyle}
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !hasChanges || !effectiveDate}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}
          >
            {saving ? 'Đang lưu...' : 'Áp dụng ngay'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SalaryAdjustModal;
