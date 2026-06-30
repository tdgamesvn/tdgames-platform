// apps/crm/components/PaymentScheduleSection.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { CrmPaymentSchedule, AccountUser } from '@/types';
import { hasAnyRole } from '@/utils/roleUtils';
import {
  fetchPaymentSchedulesByProject,
  createPaymentSchedule,
  updatePaymentSchedule,
  markPaymentScheduleInvoiced,
  markPaymentSchedulePaid,
  deletePaymentSchedule,
} from '../services/crmPaymentScheduleService';
import PaymentScheduleForm from './PaymentScheduleForm';

interface Props {
  projectId: string;
  projectCurrency: string;
  currentUser: AccountUser | null;
}

// Trả về style theo status + overdue
function getStatus(s: CrmPaymentSchedule) {
  if (s.status === 'paid')
    return { label: 'Đã thu tiền',     icon: '🟢', color: '#34C759', bg: 'rgba(52,199,89,0.12)' };
  if (s.status === 'invoiced')
    return { label: 'Đã xuất invoice', icon: '🔵', color: '#0A84FF', bg: 'rgba(10,132,255,0.12)' };
  const today = new Date().toISOString().slice(0, 10);
  if (s.due_date < today)
    return { label: 'Quá hạn',         icon: '🔴', color: '#FF453A', bg: 'rgba(255,69,58,0.12)' };
  return   { label: 'Chờ xuất',        icon: '🟡', color: '#FF9500', bg: 'rgba(255,149,0,0.12)' };
}

const fmt = (n: number, cur: string) =>
  cur === 'VND'
    ? n.toLocaleString('vi-VN') + ' ₫'
    : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const PaymentScheduleSection: React.FC<Props> = ({ projectId, projectCurrency, currentUser }) => {
  const [schedules, setSchedules]         = useState<CrmPaymentSchedule[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [editingSchedule, setEditing]     = useState<CrmPaymentSchedule | null>(null);
  const [actionOpenId, setActionOpenId]   = useState<string | null>(null);
  const [deleteConfirmId, setDeleteId]    = useState<string | null>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const canManage    = hasAnyRole(currentUser, ['admin']);
  const canMarkStatus = hasAnyRole(currentUser, ['admin', 'ke_toan']);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    if (!actionOpenId) return;
    const handleClick = (e: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) {
        setActionOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [actionOpenId]);

  const load = async () => {
    setLoading(true);
    try {
      setSchedules(await fetchPaymentSchedulesByProject(projectId));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const currency   = schedules[0]?.currency || projectCurrency || 'VND';
  const totalAmt   = schedules.reduce((s, r) => s + r.amount, 0);
  const totalPaid  = schedules.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const totalLeft  = totalAmt - totalPaid;

  const handleSave = async (data: Omit<CrmPaymentSchedule, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingSchedule) {
      await updatePaymentSchedule(editingSchedule.id, {
        name: data.name, amount: data.amount,
        currency: data.currency, due_date: data.due_date, notes: data.notes,
      });
    } else {
      await createPaymentSchedule({ ...data, project_id: projectId });
    }
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deletePaymentSchedule(id);
    setDeleteId(null);
    await load();
  };

  return (
    <div style={{
      marginBottom: '20px', background: '#0F0F0F',
      border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{
          fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: '#888', margin: 0,
        }}>
          💳 Lịch thanh toán
          {schedules.length > 0 && (
            <span style={{ color: '#555', marginLeft: '6px' }}>· {schedules.length} đợt</span>
          )}
        </h4>
        {canManage && (
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
          >
            + Thêm đợt
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <p style={{ color: '#555', fontSize: '12px' }}>Đang tải...</p>
      ) : schedules.length === 0 ? (
        <p style={{ color: '#555', fontSize: '12px', fontStyle: 'italic' }}>
          Chưa có đợt thanh toán nào.
        </p>
      ) : (
        <>
          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {schedules.map(s => {
              const st = getStatus(s);
              const isOverdue = s.status === 'pending' && s.due_date < new Date().toISOString().slice(0, 10);
              const isActionOpen = actionOpenId === s.id;

              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', borderRadius: '8px',
                    background: isOverdue ? 'rgba(255,69,58,0.06)' : '#161616',
                    border: `1px solid ${isOverdue ? 'rgba(255,69,58,0.2)' : '#222'}`,
                  }}
                >
                  {/* Name */}
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: '#E5E5E5', minWidth: 0 }}>
                    {s.name}
                  </span>

                  {/* Amount */}
                  <span style={{ fontSize: '13px', fontWeight: 900, color: '#F5F5F5', whiteSpace: 'nowrap' }}>
                    {fmt(s.amount, s.currency)}
                  </span>

                  {/* Due date */}
                  <span style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>
                    {s.due_date}
                  </span>

                  {/* Status badge */}
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                    color: st.color, background: st.bg, whiteSpace: 'nowrap',
                  }}>
                    {st.icon} {st.label}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} ref={isActionOpen ? actionRef : undefined}>
                    {/* Edit — chỉ BD + admin, chỉ khi pending */}
                    {canManage && s.status === 'pending' && deleteConfirmId !== s.id && (
                      <button
                        type="button"
                        title="Sửa"
                        onClick={() => { setEditing(s); setShowForm(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '12px', color: '#555' }}
                      >✏️</button>
                    )}

                    {/* Mark status — admin + ke_toan, chỉ khi chưa paid */}
                    {canMarkStatus && s.status !== 'paid' && deleteConfirmId !== s.id && (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setActionOpenId(isActionOpen ? null : s.id)}
                          className="px-2 py-1 rounded text-[10px] font-black text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 transition-all"
                        >
                          ▾
                        </button>
                        {isActionOpen && (
                          <div style={{
                            position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                            background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                            zIndex: 50, minWidth: '200px', overflow: 'hidden',
                          }}>
                            {s.status === 'pending' && (
                              <button
                                type="button"
                                onClick={async () => { await markPaymentScheduleInvoiced(s.id); setActionOpenId(null); await load(); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#0A84FF', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                🔵 Đánh dấu đã xuất invoice
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => { await markPaymentSchedulePaid(s.id); setActionOpenId(null); await load(); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#34C759', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              🟢 Đánh dấu đã thu tiền
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delete — chỉ BD + admin */}
                    {canManage && (
                      deleteConfirmId === s.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#FF453A', fontWeight: 700 }}>Xoá?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            style={{ fontSize: '10px', padding: '2px 8px', background: '#FF453A', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                          >✓</button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(null)}
                            style={{ fontSize: '10px', padding: '2px 8px', background: '#333', border: 'none', borderRadius: '4px', color: '#ccc', cursor: 'pointer', fontWeight: 700 }}
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          title="Xoá"
                          onClick={() => setDeleteId(s.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '12px', color: '#555' }}
                        >🗑️</button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer summary */}
          <div style={{
            borderTop: '1px solid #222', paddingTop: '10px',
            display: 'flex', gap: '20px', fontSize: '12px', flexWrap: 'wrap',
          }}>
            <span style={{ color: '#888' }}>
              Tổng: <strong style={{ color: '#F5F5F5' }}>{fmt(totalAmt, currency)}</strong>
            </span>
            <span style={{ color: '#888' }}>
              Thu: <strong style={{ color: '#34C759' }}>{fmt(totalPaid, currency)}</strong>
            </span>
            <span style={{ color: '#888' }}>
              Còn: <strong style={{ color: totalLeft > 0 ? '#FF9500' : '#555' }}>{fmt(totalLeft, currency)}</strong>
            </span>
          </div>
        </>
      )}

      {/* Inline form */}
      {showForm && (
        <PaymentScheduleForm
          projectId={projectId}
          projectCurrency={projectCurrency}
          schedule={editingSchedule}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
};

export default PaymentScheduleSection;
