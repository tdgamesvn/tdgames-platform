import React, { useState, useEffect, useMemo } from 'react';
import {
  HrEmployee, HrDepartment, HrChangeRequestType, HrChangeRequest,
  HrSalaryComponent, HrEmployeeSalary,
} from '@/types';
import * as hrSvc from '../services/hrService';
import { createChangeRequest } from '../services/changeRequestService';

// ══════════════════════════════════════════════════════════
// ── Props ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

interface Props {
  employees: HrEmployee[];
  departments: HrDepartment[];
  initialEmployeeId?: string | null;
  initialType?: HrChangeRequestType | null;
  onSubmit: (req: HrChangeRequest) => void;
  onClose: () => void;
}

// ══════════════════════════════════════════════════════════
// ── Helpers ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

const TYPE_OPTIONS: Array<{ key: HrChangeRequestType; icon: string; title: string; desc: string; color: string }> = [
  { key: 'probation_end',       icon: '🎓', title: 'Lên chính thức',    desc: 'Kết thúc thử việc, cập nhật ngày chính thức + lương', color: '#FF9500' },
  { key: 'salary_change',       icon: '💰', title: 'Điều chỉnh lương',  desc: 'Tăng / giảm các khoản lương',                        color: '#10b981' },
  { key: 'promotion',           icon: '🔺', title: 'Thăng chức',        desc: 'Thay đổi chức vụ / level, kèm lương nếu có',         color: '#3b82f6' },
  { key: 'department_transfer', icon: '🔄', title: 'Chuyển phòng ban',  desc: 'Chuyển nhân viên sang phòng ban khác',                color: '#a855f7' },
  { key: 'termination',         icon: '❌', title: 'Nghỉ việc',         desc: 'Đề xuất nghỉ việc / buộc thôi việc',                  color: '#ef4444' },
];

const fmt = (n: number) => n.toLocaleString('vi-VN');

const inputCls = 'w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors';
const inputStyle = { background: '#1a1a1a' };
const labelCls = 'text-neutral-500 text-[10px] font-black uppercase tracking-wider';

// ══════════════════════════════════════════════════════════
// ── SalaryEditor (sub-component) ─────────────────────────
// ══════════════════════════════════════════════════════════

interface SalaryRow {
  component_id: string;
  name: string;
  old_amount: number;
  new_amount: number;
}

function SalaryEditor({
  rows,
  onChange,
}: {
  rows: SalaryRow[];
  onChange: (rows: SalaryRow[]) => void;
}) {
  const setAmount = (idx: number, val: number) => {
    const next = [...rows];
    next[idx] = { ...next[idx], new_amount: val };
    onChange(next);
  };

  const oldTotal = rows.reduce((s, r) => s + r.old_amount, 0);
  const newTotal = rows.reduce((s, r) => s + r.new_amount, 0);
  const diff = newTotal - oldTotal;

  return (
    <div className="rounded-xl border border-white/5 p-4" style={{ background: '#0F0F0F' }}>
      <p className={labelCls + ' mb-3'}>Bảng lương</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-neutral-medium">
            <th className="text-left py-1.5 font-black uppercase tracking-wider">Khoản mục</th>
            <th className="text-right py-1.5 font-black uppercase tracking-wider">Hiện tại</th>
            <th className="text-right py-1.5 font-black uppercase tracking-wider w-36">Đề xuất</th>
            <th className="text-right py-1.5 font-black uppercase tracking-wider">Chênh lệch</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const d = r.new_amount - r.old_amount;
            return (
              <tr key={r.component_id} className="border-t border-white/5">
                <td className="py-2 text-neutral-light">{r.name}</td>
                <td className="py-2 text-right text-neutral-medium">{fmt(r.old_amount)}</td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    value={r.new_amount || ''}
                    onChange={e => setAmount(i, Number(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded-lg text-sm text-right text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                    style={{ background: '#1a1a1a' }}
                    min={0}
                  />
                </td>
                <td className={`py-2 text-right font-black ${d > 0 ? 'text-emerald-400' : d < 0 ? 'text-red-400' : 'text-neutral-medium'}`}>
                  {d > 0 ? '+' : ''}{fmt(d)}
                </td>
              </tr>
            );
          })}
          {rows.length > 1 && (
            <tr className="border-t-2 border-white/10 font-black">
              <td className="py-2 text-neutral-light uppercase tracking-wider text-[10px]">Tổng</td>
              <td className="py-2 text-right text-neutral-medium">{fmt(oldTotal)}</td>
              <td className="py-2 text-right" style={{ color: '#FF9500' }}>{fmt(newTotal)}</td>
              <td className={`py-2 text-right ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-neutral-medium'}`}>
                {diff > 0 ? '+' : ''}{fmt(diff)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── Main form ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

const ChangeRequestForm: React.FC<Props> = ({
  employees,
  departments,
  initialEmployeeId,
  initialType,
  onSubmit,
  onClose,
}) => {
  // ── State ──
  const [employeeId, setEmployeeId] = useState(initialEmployeeId || '');
  const [requestType, setRequestType] = useState<HrChangeRequestType | ''>(initialType || '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Type-specific state
  const [officialDate, setOfficialDate] = useState('');
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);
  const [newPosition, setNewPosition] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [terminationDate, setTerminationDate] = useState('');
  const [terminationReason, setTerminationReason] = useState('');

  // Data loading
  const [components, setComponents] = useState<HrSalaryComponent[]>([]);
  const [empSalary, setEmpSalary] = useState<HrEmployeeSalary[]>([]);
  const [loadingSalary, setLoadingSalary] = useState(false);

  const activeEmployees = useMemo(
    () => employees.filter(e => e.status === 'active'),
    [employees],
  );
  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === employeeId),
    [employees, employeeId],
  );

  // ── Load salary components once ──
  useEffect(() => {
    hrSvc.fetchSalaryComponents().then(setComponents).catch(() => {});
  }, []);

  // ── Load employee salary when employee selected ──
  useEffect(() => {
    if (!employeeId) { setEmpSalary([]); return; }
    setLoadingSalary(true);
    hrSvc.fetchEmployeeSalary(employeeId)
      .then(setEmpSalary)
      .catch(() => {})
      .finally(() => setLoadingSalary(false));
  }, [employeeId]);

  // ── Build salary rows when components + empSalary ready ──
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

  // ── Pre-fill from selected employee ──
  useEffect(() => {
    if (selectedEmployee) {
      setNewPosition(selectedEmployee.position || '');
      setNewLevel(selectedEmployee.level || '');
      setNewDepartmentId(selectedEmployee.department_id || '');
    }
  }, [selectedEmployee]);

  // ── Needs salary editor? ──
  const needsSalary = requestType === 'probation_end' || requestType === 'salary_change' || requestType === 'promotion';

  // ── Build payload ──
  const buildPayload = () => {
    if (!employeeId || !requestType || !effectiveDate) {
      return null;
    }
    const emp = selectedEmployee;
    if (!emp) return null;

    const currentSnapshot: Record<string, any> = {
      position: emp.position,
      level: emp.level,
      department_id: emp.department_id,
      department_name: emp.department?.name || departments.find(d => d.id === emp.department_id)?.name || '',
      salary: emp.salary,
      official_date: emp.official_date,
      status: emp.status,
    };

    let changes: Record<string, any> = {};

    switch (requestType) {
      case 'probation_end':
        if (!officialDate) { setError('Vui lòng chọn ngày chính thức'); return null; }
        changes = {
          official_date: officialDate,
          salary_components: salaryRows
            .filter(r => r.new_amount > 0 || r.old_amount > 0)
            .map(r => ({ component_id: r.component_id, name: r.name, old_amount: r.old_amount, new_amount: r.new_amount })),
        };
        break;
      case 'salary_change':
        changes = {
          salary_components: salaryRows
            .filter(r => r.new_amount !== r.old_amount)
            .map(r => ({ component_id: r.component_id, name: r.name, old_amount: r.old_amount, new_amount: r.new_amount })),
        };
        if (!changes.salary_components.length) { setError('Chưa có thay đổi lương nào'); return null; }
        break;
      case 'promotion':
        if (!newPosition && !newLevel) { setError('Vui lòng nhập chức vụ hoặc level mới'); return null; }
        changes = {
          new_position: newPosition,
          new_level: newLevel,
          salary_components: salaryRows
            .filter(r => r.new_amount !== r.old_amount)
            .map(r => ({ component_id: r.component_id, name: r.name, old_amount: r.old_amount, new_amount: r.new_amount })),
        };
        break;
      case 'department_transfer':
        if (!newDepartmentId || newDepartmentId === emp.department_id) {
          setError('Vui lòng chọn phòng ban mới (khác phòng ban hiện tại)');
          return null;
        }
        changes = {
          new_department_id: newDepartmentId,
          new_department_name: departments.find(d => d.id === newDepartmentId)?.name || '',
        };
        break;
      case 'termination':
        if (!terminationDate) { setError('Vui lòng chọn ngày nghỉ việc'); return null; }
        changes = {
          termination_date: terminationDate,
          termination_reason: terminationReason,
        };
        break;
    }

    return {
      employee_id: employeeId,
      request_type: requestType,
      status: 'pending' as const,
      changes,
      current_snapshot: currentSnapshot,
      effective_date: effectiveDate,
      reason: reason || null,
      requested_by: null, // will be set by context if needed
    };
  };

  // ── Submit ──
  const handleSubmit = async () => {
    setError('');
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    try {
      const result = await createChangeRequest(payload);
      onSubmit(result);
    } catch (e: any) {
      setError(e.message || 'Không thể tạo đề xuất');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8"
      style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/[0.08] animate-scaleIn"
        style={{ background: '#1A1A1A' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-lg font-black text-white">Tạo đề xuất nhân sự</h2>
            <p className="text-xs text-neutral-medium mt-0.5">Chọn nhân viên, loại đề xuất và điền thông tin</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-medium hover:text-white hover:bg-white/5 transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* ── 1. Employee select ── */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Nhân viên *</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className={inputCls}
              style={inputStyle}
              disabled={!!initialEmployeeId}
            >
              <option value="">— Chọn nhân viên —</option>
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} {emp.employee_code ? `(${emp.employee_code})` : ''} — {emp.position || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          {/* ── 2. Request type radio cards ── */}
          {employeeId && (
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Loại đề xuất *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                {TYPE_OPTIONS.map(opt => {
                  const active = requestType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setRequestType(opt.key); setError(''); }}
                      className="flex items-start gap-3 p-4 rounded-xl border text-left transition-all"
                      style={{
                        background: active ? `${opt.color}10` : 'rgba(255,255,255,0.02)',
                        borderColor: active ? `${opt.color}40` : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-black" style={{ color: active ? opt.color : '#F2F2F2' }}>
                          {opt.title}
                        </p>
                        <p className="text-[11px] text-neutral-medium mt-0.5 leading-relaxed">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 3. Effective date (all types) ── */}
          {requestType && (
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
          )}

          {/* ── 4. Type-specific fields ── */}

          {/* Probation end: official_date */}
          {requestType === 'probation_end' && (
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Ngày chính thức *</label>
              <input
                type="date"
                value={officialDate}
                onChange={e => setOfficialDate(e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          )}

          {/* Promotion: position + level */}
          {requestType === 'promotion' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Chức vụ mới</label>
                <input
                  type="text"
                  value={newPosition}
                  onChange={e => setNewPosition(e.target.value)}
                  placeholder={selectedEmployee?.position || ''}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Level mới</label>
                <input
                  type="text"
                  value={newLevel}
                  onChange={e => setNewLevel(e.target.value)}
                  placeholder={selectedEmployee?.level || ''}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Department transfer */}
          {requestType === 'department_transfer' && (
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Phòng ban mới *</label>
              <select
                value={newDepartmentId}
                onChange={e => setNewDepartmentId(e.target.value)}
                className={inputCls}
                style={inputStyle}
              >
                <option value="">— Chọn phòng ban —</option>
                {departments.filter(d => d.is_active).map(d => (
                  <option key={d.id} value={d.id} disabled={d.id === selectedEmployee?.department_id}>
                    {d.name} {d.id === selectedEmployee?.department_id ? '(hiện tại)' : ''}
                  </option>
                ))}
              </select>
              {selectedEmployee?.department && (
                <p className="text-[11px] text-neutral-medium mt-1">
                  Phòng ban hiện tại: <span className="text-neutral-light font-black">{selectedEmployee.department.name}</span>
                </p>
              )}
            </div>
          )}

          {/* Termination */}
          {requestType === 'termination' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Ngày nghỉ việc *</label>
                <input
                  type="date"
                  value={terminationDate}
                  onChange={e => setTerminationDate(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Lý do nghỉ việc</label>
                <textarea
                  value={terminationReason}
                  onChange={e => setTerminationReason(e.target.value)}
                  placeholder="Nhập lý do..."
                  rows={3}
                  className={'w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none'}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Salary editor (probation_end, salary_change, promotion) */}
          {needsSalary && employeeId && (
            loadingSalary ? (
              <div className="text-center py-6 text-neutral-medium text-sm animate-td-pulse">
                Đang tải bảng lương...
              </div>
            ) : (
              <SalaryEditor rows={salaryRows} onChange={setSalaryRows} />
            )
          )}

          {/* ── 5. Reason (all types) ── */}
          {requestType && (
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Ghi chú / Lý do đề xuất</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Nhập ghi chú (không bắt buộc)..."
                rows={3}
                className={'w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none'}
                style={inputStyle}
              />
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !employeeId || !requestType || !effectiveDate}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}
          >
            {saving ? 'Đang tạo...' : 'Tạo đề xuất'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeRequestForm;
