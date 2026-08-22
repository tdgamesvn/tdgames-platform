import React, { useState, useEffect, useRef } from 'react';
import { AccountUser, HrChangeRequest, HrChangeRequestType, HrChangeRequestStatus } from '@/types';
import { fetchMyChangeRequests } from '../services/portalService';

// ── Helpers ───────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('vi-VN');

const TYPE_META: Record<HrChangeRequestType, { icon: string; label: string; color: string; bg: string }> = {
  probation_end:       { icon: '🎓', label: 'Lên chính thức',    color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  salary_change:       { icon: '💰', label: 'Điều chỉnh lương',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  promotion:           { icon: '🔺', label: 'Thăng chức',        color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  department_transfer: { icon: '🔄', label: 'Chuyển phòng ban',  color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  termination:         { icon: '❌', label: 'Nghỉ việc',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const STATUS_META: Record<HrChangeRequestStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ duyệt', color: '#FF9500', bg: 'rgba(255,149,0,0.12)' },
  approved: { label: 'Đã duyệt',  color: '#34C759', bg: 'rgba(52,199,89,0.12)' },
  rejected: { label: 'Từ chối',   color: '#FF3B30', bg: 'rgba(255,59,48,0.12)' },
};

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN');
}

function fmtDateTime(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Salary Table ───────────────────────────────────────────
function SalaryTable({ components }: { components: Array<{ name: string; old_amount: number; new_amount: number }> }) {
  return (
    <div className="overflow-x-auto">
      <table style={{ width: '100%', fontSize: '12px', marginTop: '8px', borderCollapse: 'collapse', minWidth: 480 }}>
        <thead>
          <tr style={{ color: '#888' }}>
            <th style={{ textAlign: 'left', padding: '6px 0', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Khoản mục</th>
            <th style={{ textAlign: 'right', padding: '6px 0', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hiện tại</th>
            <th style={{ textAlign: 'right', padding: '6px 0', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mới</th>
            <th style={{ textAlign: 'right', padding: '6px 0', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Chênh lệch</th>
          </tr>
        </thead>
        <tbody>
          {components.map((c, i) => {
            const diff = c.new_amount - c.old_amount;
            return (
              <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '8px 0', color: '#ccc' }}>{c.name}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: '#888' }}>{fmt(c.old_amount)}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#06B6D4' }}>{fmt(c.new_amount)}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: diff > 0 ? '#34C759' : diff < 0 ? '#FF3B30' : '#888' }}>
                  {diff > 0 ? '+' : ''}{fmt(diff)}
                </td>
              </tr>
            );
          })}
          {components.length > 1 && (() => {
            const oldTotal = components.reduce((s, c) => s + c.old_amount, 0);
            const newTotal = components.reduce((s, c) => s + c.new_amount, 0);
            const diffTotal = newTotal - oldTotal;
            return (
              <tr style={{ borderTop: '2px solid rgba(255,255,255,0.08)', fontWeight: 800 }}>
                <td style={{ padding: '8px 0', color: '#ccc', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tổng</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: '#888' }}>{fmt(oldTotal)}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: '#06B6D4' }}>{fmt(newTotal)}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: diffTotal > 0 ? '#34C759' : diffTotal < 0 ? '#FF3B30' : '#888' }}>
                  {diffTotal > 0 ? '+' : ''}{fmt(diffTotal)}
                </td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

// ── Request Card ───────────────────────────────────────────
const RequestCard: React.FC<{ req: HrChangeRequest; isHighlighted?: boolean }> = ({ req, isHighlighted }) => {
  const [expanded, setExpanded] = useState(!!isHighlighted);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [isHighlighted]);

  const meta = TYPE_META[req.request_type];
  const statusMeta = STATUS_META[req.status];
  const c = req.changes || {};
  const snap = req.current_snapshot || {};

  return (
    <div
      ref={cardRef}
      style={{
        background: '#161616',
        border: `1px solid ${isHighlighted ? 'rgba(6,182,212,0.5)' : expanded ? 'rgba(6,182,212,0.25)' : '#222'}`,
        borderRadius: '16px',
        boxShadow: isHighlighted ? '0 0 20px rgba(6,182,212,0.15)' : 'none',
        transition: 'all 0.2s',
      }}
    >
      {/* Header — click to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '16px',
          padding: '18px 20px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        {/* Type badge */}
        <span style={{
          flexShrink: 0, padding: '4px 12px', borderRadius: '10px',
          fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
          background: meta.bg, color: meta.color,
        }}>
          {meta.icon} {meta.label}
        </span>

        {/* Date info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', color: '#ccc', margin: 0 }}>
            Hiệu lực: <strong style={{ color: '#F5F5F5' }}>{fmtDate(req.effective_date)}</strong>
            <span style={{ color: '#666', marginLeft: '12px', fontSize: '11px' }}>
              Tạo: {fmtDateTime(req.created_at)}
            </span>
          </p>
        </div>

        {/* Status badge */}
        <span style={{
          flexShrink: 0, padding: '4px 12px', borderRadius: '10px',
          fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
          background: statusMeta.bg, color: statusMeta.color,
        }}>
          {statusMeta.label}
        </span>

        {/* Chevron */}
        <span style={{
          flexShrink: 0, color: '#666', fontSize: '12px',
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Salary table */}
            {(req.request_type === 'probation_end' || req.request_type === 'salary_change') && c.salary_components?.length > 0 && (
              <div style={{ background: '#0F0F0F', border: '1px solid #222', borderRadius: '12px', padding: '14px' }}>
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Điều chỉnh lương</p>
                <SalaryTable components={c.salary_components} />
              </div>
            )}

            {req.request_type === 'probation_end' && c.official_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                <span style={{ color: '#888', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ngày chính thức:</span>
                <span style={{ fontWeight: 800, color: '#34C759' }}>{fmtDate(c.official_date)}</span>
              </div>
            )}

            {/* Promotion */}
            {req.request_type === 'promotion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Thay đổi chức vụ</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: '#0F0F0F', border: '1px solid #222', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: '#666', marginBottom: '4px' }}>Chức vụ hiện tại</p>
                    <p style={{ fontSize: '13px', color: '#ccc' }}>{snap.position || '—'} {snap.level ? `/ ${snap.level}` : ''}</p>
                  </div>
                  <div style={{ background: '#0F0F0F', border: '1px solid #222', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: '#666', marginBottom: '4px' }}>Chức vụ mới</p>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: '#3b82f6' }}>
                      {c.new_position || snap.position || '—'} {c.new_level ? `/ ${c.new_level}` : ''}
                    </p>
                  </div>
                </div>
                {c.salary_components?.length > 0 && (
                  <div style={{ background: '#0F0F0F', border: '1px solid #222', borderRadius: '12px', padding: '14px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Điều chỉnh lương kèm theo</p>
                    <SalaryTable components={c.salary_components} />
                  </div>
                )}
              </div>
            )}

            {/* Department transfer */}
            {req.request_type === 'department_transfer' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#0F0F0F', border: '1px solid #222', borderRadius: '12px', padding: '12px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: '#666', marginBottom: '4px' }}>Phòng ban hiện tại</p>
                  <p style={{ fontSize: '13px', color: '#ccc' }}>{snap.department_name || '—'}</p>
                </div>
                <div style={{ background: '#0F0F0F', border: '1px solid #222', borderRadius: '12px', padding: '12px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: '#666', marginBottom: '4px' }}>Phòng ban mới</p>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#a855f7' }}>{c.new_department_name || '—'}</p>
                </div>
              </div>
            )}

            {/* Termination */}
            {req.request_type === 'termination' && (
              <div style={{ background: '#0F0F0F', border: '1px solid #222', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                  <span style={{ color: '#888', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px', flexShrink: 0 }}>Ngày nghỉ:</span>
                  <span style={{ fontWeight: 800, color: '#FF3B30' }}>{fmtDate(c.termination_date || req.effective_date)}</span>
                </div>
                {c.termination_reason && (
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px', marginTop: '8px' }}>
                    <span style={{ color: '#888', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px', flexShrink: 0 }}>Lý do:</span>
                    <span style={{ color: '#ccc' }}>{c.termination_reason}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reason / approval note */}
            {req.reason && (
              <div style={{ background: '#0F0F0F', border: '1px solid #222', borderRadius: '12px', padding: '14px' }}>
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ghi chú đề xuất</p>
                <p style={{ fontSize: '13px', color: '#ccc', margin: 0 }}>{req.reason}</p>
              </div>
            )}

            {req.approval_note && (
              <div style={{ background: '#0F0F0F', border: '1px solid #222', borderRadius: '12px', padding: '14px' }}>
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {req.status === 'approved' ? 'Ghi chú duyệt' : 'Lý do từ chối'}
                </p>
                <p style={{ fontSize: '13px', color: '#ccc', margin: 0, fontStyle: 'italic' }}>"{req.approval_note}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Tab Component ────────────────────────────────────
interface Props {
  currentUser: AccountUser;
  onToast: (msg: string, type: 'success' | 'error') => void;
  highlightId?: string | null;
}

const ChangeRequestsTab: React.FC<Props> = ({ currentUser, onToast, highlightId }) => {
  const [requests, setRequests] = useState<HrChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser.employee_id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchMyChangeRequests(currentUser.employee_id)
      .then(data => setRequests(data))
      .catch(err => onToast(err.message || 'Lỗi tải đề xuất', 'error'))
      .finally(() => setIsLoading(false));
  }, [currentUser.employee_id]);

  return (
    <div className="animate-fadeInUp">
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
          📋 Đề xuất nhân sự
        </h2>
        <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
          Các đề xuất thay đổi liên quan đến bạn
        </p>
      </div>

      {!currentUser.employee_id ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔗</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Tài khoản chưa liên kết nhân viên</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Liên hệ HR để liên kết tài khoản với hồ sơ nhân viên</p>
        </div>
      ) : isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p className="animate-pulse" style={{ color: '#888', fontSize: '13px' }}>Đang tải...</p>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Chưa có đề xuất nào</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Khi HR tạo đề xuất liên quan đến bạn, nó sẽ hiển thị ở đây</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              isHighlighted={req.id === highlightId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ChangeRequestsTab;
