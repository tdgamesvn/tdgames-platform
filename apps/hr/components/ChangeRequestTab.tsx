import React, { useState, useEffect, useRef } from 'react';
import { HrChangeRequest, HrEmployee, HrDepartment, AccountUser, HrChangeRequestType } from '@/types';
import { approveChangeRequest, rejectChangeRequest, deleteChangeRequest } from '../services/changeRequestService';
import ChangeRequestForm from './ChangeRequestForm';

interface Props {
  requests: HrChangeRequest[];
  employees: HrEmployee[];
  departments: HrDepartment[];
  currentUser: AccountUser;
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
  highlightId?: string | null;
}

// ── Helpers ───────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('vi-VN');

const TYPE_META: Record<HrChangeRequestType, { icon: string; label: string; color: string; bg: string }> = {
  probation_end:       { icon: '🎓', label: 'Lên chính thức',    color: '#FF9500', bg: 'rgba(255,149,0,0.12)' },
  salary_change:       { icon: '💰', label: 'Điều chỉnh lương',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  promotion:           { icon: '🔺', label: 'Thăng chức',        color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  department_transfer: { icon: '🔄', label: 'Chuyển phòng ban',  color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  termination:         { icon: '❌', label: 'Nghỉ việc',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const STATUS_META = {
  pending:  { label: 'Chờ duyệt', cls: 'bg-orange-500/20 text-orange-400' },
  approved: { label: 'Đã duyệt',  cls: 'bg-emerald-500/20 text-emerald-400' },
  rejected: { label: 'Từ chối',   cls: 'bg-red-500/20 text-red-400' },
};

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN');
}

function fmtDateTime(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

// ── SalaryTable ───────────────────────────────────────────

function SalaryTable({ components }: { components: Array<{ name: string; old_amount: number; new_amount: number }> }) {
  return (
    <table className="w-full text-xs mt-2">
      <thead>
        <tr className="text-neutral-medium">
          <th className="text-left py-1.5 font-black uppercase tracking-wider">Khoản mục</th>
          <th className="text-right py-1.5 font-black uppercase tracking-wider">Hiện tại</th>
          <th className="text-right py-1.5 font-black uppercase tracking-wider">Đề xuất</th>
          <th className="text-right py-1.5 font-black uppercase tracking-wider">Chênh lệch</th>
        </tr>
      </thead>
      <tbody>
        {components.map((c, i) => {
          const diff = c.new_amount - c.old_amount;
          return (
            <tr key={i} className="border-t border-white/5">
              <td className="py-2 text-neutral-light">{c.name}</td>
              <td className="py-2 text-right text-neutral-medium">{fmt(c.old_amount)}</td>
              <td className="py-2 text-right font-black" style={{ color: '#FF9500' }}>{fmt(c.new_amount)}</td>
              <td className={`py-2 text-right font-black ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-neutral-medium'}`}>
                {diff > 0 ? '+' : ''}{fmt(diff)}
              </td>
            </tr>
          );
        })}
        {/* Total row */}
        {components.length > 1 && (() => {
          const oldTotal = components.reduce((s, c) => s + c.old_amount, 0);
          const newTotal = components.reduce((s, c) => s + c.new_amount, 0);
          const diffTotal = newTotal - oldTotal;
          return (
            <tr className="border-t-2 border-white/10 font-black">
              <td className="py-2 text-neutral-light uppercase tracking-wider text-[10px]">Tổng</td>
              <td className="py-2 text-right text-neutral-medium">{fmt(oldTotal)}</td>
              <td className="py-2 text-right" style={{ color: '#FF9500' }}>{fmt(newTotal)}</td>
              <td className={`py-2 text-right ${diffTotal > 0 ? 'text-emerald-400' : diffTotal < 0 ? 'text-red-400' : 'text-neutral-medium'}`}>
                {diffTotal > 0 ? '+' : ''}{fmt(diffTotal)}
              </td>
            </tr>
          );
        })()}
      </tbody>
    </table>
  );
}

// ── RequestCard ───────────────────────────────────────────

interface CardProps {
  req: HrChangeRequest;
  currentUser: AccountUser;
  departments: HrDepartment[];
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
  isHighlighted?: boolean;
  onAdjustSalary?: (employeeId: string) => void;
}

const RequestCard: React.FC<CardProps> = ({ req, currentUser, departments, onRefresh, onToast, isHighlighted, onAdjustSalary }) => {
  const [expanded, setExpanded] = useState(!!isHighlighted);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to highlighted card on mount
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [isHighlighted]);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const meta = TYPE_META[req.request_type];
  const statusMeta = STATUS_META[req.status];
  const emp = req.employee;
  const c = req.changes || {};
  const snap = req.current_snapshot || {};

  const handleApprove = async () => {
    setSaving(true);
    try {
      await approveChangeRequest(req.id, currentUser.id, noteText || undefined);
      onToast('Đã duyệt đề xuất', 'success');
      onRefresh();
    } catch (e: any) {
      onToast(e.message || 'Lỗi duyệt đề xuất', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!noteText.trim()) {
      onToast('Vui lòng nhập lý do từ chối', 'error');
      return;
    }
    setSaving(true);
    try {
      await rejectChangeRequest(req.id, currentUser.id, noteText);
      onToast('Đã từ chối đề xuất', 'success');
      onRefresh();
    } catch (e: any) {
      onToast(e.message || 'Lỗi từ chối', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Xoá đề xuất này? Hành động không thể hoàn tác.')) return;
    setSaving(true);
    try {
      await deleteChangeRequest(req.id);
      onToast('Đã xoá đề xuất', 'success');
      onRefresh();
    } catch (e: any) {
      onToast(e.message || 'Lỗi xoá đề xuất', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'hr';

  return (
    <div
      ref={cardRef}
      className="rounded-[20px] border transition-all duration-200"
      style={{
        background: '#1A1A1A',
        borderColor: isHighlighted ? 'rgba(255,149,0,0.5)' : expanded ? 'rgba(255,149,0,0.25)' : 'rgba(255,255,255,0.08)',
        boxShadow: isHighlighted ? '0 0 20px rgba(255,149,0,0.15)' : 'none',
      }}
    >
      {/* Card header — always visible, click to expand */}
      <button
        className="w-full flex items-center gap-4 p-5 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Type badge */}
        <span
          className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider"
          style={{ background: meta.bg, color: meta.color }}
        >
          {meta.icon} {meta.label}
        </span>

        {/* Employee info */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-neutral-light text-sm truncate">
            {emp?.full_name || '—'}
            {emp?.employee_code && (
              <span className="ml-2 text-[10px] font-black text-neutral-medium uppercase tracking-wider">
                {emp.employee_code}
              </span>
            )}
          </p>
          <p className="text-[11px] text-neutral-medium mt-0.5">
            Hiệu lực: {fmtDate(req.effective_date)} · Tạo: {fmtDateTime(req.created_at)}
          </p>
        </div>

        {/* Status badge */}
        <span className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider ${statusMeta.cls}`}>
          {statusMeta.label}
        </span>

        {/* Chevron */}
        <span className="shrink-0 text-neutral-medium text-xs transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5 space-y-5 pt-5">

          {/* ── Salary table (probation_end, salary_change, promotion with salary) ── */}
          {(req.request_type === 'probation_end' || req.request_type === 'salary_change') && c.salary_components?.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Điều chỉnh lương</p>
              <div className="rounded-xl border border-white/5 p-3" style={{ background: '#0F0F0F' }}>
                <SalaryTable components={c.salary_components} />
              </div>
            </div>
          )}

          {req.request_type === 'probation_end' && c.official_date && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-neutral-medium text-[10px] font-black uppercase tracking-wider">Ngày chính thức:</span>
              <span className="font-black text-emerald-400">{fmtDate(c.official_date)}</span>
            </div>
          )}

          {/* ── Promotion ── */}
          {req.request_type === 'promotion' && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Thay đổi chức vụ</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/5 p-3" style={{ background: '#0F0F0F' }}>
                  <p className="text-[10px] font-black text-neutral-medium mb-1">Chức vụ hiện tại</p>
                  <p className="text-sm text-neutral-light">{snap.position || '—'} {snap.level ? `/ ${snap.level}` : ''}</p>
                </div>
                <div className="rounded-xl border border-white/5 p-3" style={{ background: '#0F0F0F' }}>
                  <p className="text-[10px] font-black text-neutral-medium mb-1">Chức vụ mới</p>
                  <p className="text-sm font-black" style={{ color: '#3b82f6' }}>
                    {c.new_position || snap.position || '—'} {c.new_level ? `/ ${c.new_level}` : ''}
                  </p>
                </div>
              </div>
              {c.salary_components?.length > 0 && (
                <div className="rounded-xl border border-white/5 p-3" style={{ background: '#0F0F0F' }}>
                  <p className="text-[10px] font-black text-neutral-medium mb-2">Điều chỉnh lương kèm theo</p>
                  <SalaryTable components={c.salary_components} />
                </div>
              )}
            </div>
          )}

          {/* ── Department transfer ── */}
          {req.request_type === 'department_transfer' && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Chuyển phòng ban</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/5 p-3" style={{ background: '#0F0F0F' }}>
                  <p className="text-[10px] font-black text-neutral-medium mb-1">Phòng ban hiện tại</p>
                  <p className="text-sm text-neutral-light">
                    {snap.department_name || departments.find(d => d.id === snap.department_id)?.name || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 p-3" style={{ background: '#0F0F0F' }}>
                  <p className="text-[10px] font-black text-neutral-medium mb-1">Phòng ban mới</p>
                  <p className="text-sm font-black" style={{ color: '#a855f7' }}>
                    {c.new_department_name || departments.find(d => d.id === c.new_department_id)?.name || '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Termination ── */}
          {req.request_type === 'termination' && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Thông tin nghỉ việc</p>
              <div className="rounded-xl border border-white/5 p-3 space-y-2" style={{ background: '#0F0F0F' }}>
                <div className="flex gap-3 text-sm">
                  <span className="text-neutral-medium text-[10px] font-black uppercase tracking-wider w-28 shrink-0">Ngày nghỉ:</span>
                  <span className="font-black text-red-400">{fmtDate(c.termination_date || req.effective_date)}</span>
                </div>
                {c.termination_reason && (
                  <div className="flex gap-3 text-sm">
                    <span className="text-neutral-medium text-[10px] font-black uppercase tracking-wider w-28 shrink-0">Lý do:</span>
                    <span className="text-neutral-light">{c.termination_reason}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Meta info ── */}
          <div className="grid grid-cols-2 gap-3">
            {req.reason && (
              <div className="rounded-xl border border-white/5 p-3 col-span-2" style={{ background: '#0F0F0F' }}>
                <p className="text-[10px] font-black text-neutral-medium mb-1 uppercase tracking-wider">Ghi chú đề xuất</p>
                <p className="text-sm text-neutral-light">{req.reason}</p>
              </div>
            )}
            {/* Người tạo / Người duyệt — chỉ hiện cho admin & hr */}
            {isAdmin && (
              <>
                <div className="rounded-xl border border-white/5 p-3" style={{ background: '#0F0F0F' }}>
                  <p className="text-[10px] font-black text-neutral-medium mb-1 uppercase tracking-wider">Người tạo</p>
                  <p className="text-sm text-neutral-light">{req.requested_by || '—'}</p>
                  <p className="text-[10px] text-neutral-medium mt-0.5">{fmtDateTime(req.created_at)}</p>
                </div>
                {(req.status === 'approved' || req.status === 'rejected') && (
                  <div className="rounded-xl border border-white/5 p-3" style={{ background: '#0F0F0F' }}>
                    <p className="text-[10px] font-black text-neutral-medium mb-1 uppercase tracking-wider">
                      {req.status === 'approved' ? 'Người duyệt' : 'Người từ chối'}
                    </p>
                    <p className="text-sm text-neutral-light">{req.approved_by || '—'}</p>
                    <p className="text-[10px] text-neutral-medium mt-0.5">{fmtDateTime(req.approved_at)}</p>
                    {req.approval_note && (
                      <p className="text-xs text-neutral-medium mt-1 italic">"{req.approval_note}"</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Adjust salary shortcut (approved salary_change or probation_end) ── */}
          {req.status === 'approved' && (req.request_type === 'salary_change' || req.request_type === 'probation_end') && isAdmin && onAdjustSalary && (
            <div className="pt-1 border-t border-white/5">
              <button
                onClick={() => onAdjustSalary(req.employee_id)}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all"
              >
                💰 Điều chỉnh lương
              </button>
            </div>
          )}

          {/* ── Action buttons for pending ── */}
          {req.status === 'pending' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium block mb-2">
                  Ghi chú duyệt / từ chối
                </label>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Nhập ghi chú (bắt buộc khi từ chối)..."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm text-neutral-light resize-none focus:outline-none transition-all"
                  style={{
                    background: '#0F0F0F',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(255,149,0,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                  {saving ? '...' : '✅ Duyệt'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
                >
                  {saving ? '...' : '❌ Từ chối'}
                </button>
                {isAdmin && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="py-3 px-5 rounded-xl font-black text-xs uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #78716c 0%, #57534e 100%)' }}
                    title="Xoá đề xuất (Admin)"
                  >
                    {saving ? '...' : '🗑️ Xoá'}
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────

const ChangeRequestTab: React.FC<Props> = ({
  requests,
  employees,
  departments,
  currentUser,
  onRefresh,
  onToast,
  highlightId,
}) => {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [formInit, setFormInit] = useState<{ employeeId: string | null; type: HrChangeRequestType | null } | null>(null);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const filtered = requests.filter(r => {
    if (filterTab === 'all') return true;
    return r.status === filterTab;
  });

  const FILTER_TABS: Array<{ key: FilterTab; label: string; count?: number }> = [
    { key: 'all',      label: 'Tất cả',    count: requests.length },
    { key: 'pending',  label: 'Chờ duyệt', count: pendingCount },
    { key: 'approved', label: 'Đã duyệt' },
    { key: 'rejected', label: 'Từ chối' },
  ];

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* ── Header ── */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            Đề xuất nhân sự
          </h2>
          <p className="text-neutral-medium text-sm mt-1">Quản lý & duyệt các đề xuất thay đổi</p>
        </div>
        <button
          onClick={() => setFormInit({ employeeId: null, type: null })}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)' }}
        >
          + Tạo đề xuất
        </button>
      </div>

      {/* ── Filter pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_TABS.map(tab => {
          const active = filterTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
              style={{
                background: active ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.04)',
                color: active ? '#FF9500' : '#888',
                border: `1px solid ${active ? 'rgba(255,149,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className="px-1.5 py-0.5 rounded-lg text-[10px] font-black"
                  style={{
                    background: active ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.08)',
                    color: active ? '#FF9500' : '#666',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,149,0,0.08)' }}>
            <span className="text-4xl">📋</span>
          </div>
          <p className="text-neutral-medium text-sm">
            {filterTab === 'all' ? 'Chưa có đề xuất nào. Nhấn "Tạo đề xuất" để bắt đầu.' : 'Không có đề xuất nào trong mục này.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              currentUser={currentUser}
              departments={departments}
              onRefresh={onRefresh}
              onToast={onToast}
              isHighlighted={req.id === highlightId}
              onAdjustSalary={(empId) => setFormInit({ employeeId: empId, type: 'salary_change' })}
            />
          ))}
        </div>
      )}

      {/* ── Create / Adjust form modal ── */}
      {formInit !== null && (
        <ChangeRequestForm
          employees={employees}
          departments={departments}
          initialEmployeeId={formInit.employeeId}
          initialType={formInit.type}
          onSubmit={() => {
            setFormInit(null);
            onRefresh();
            onToast('Đã tạo đề xuất thành công', 'success');
          }}
          onClose={() => setFormInit(null)}
        />
      )}
    </div>
  );
};

export default ChangeRequestTab;
