import React, { useState, useEffect } from 'react';
import { AccountUser, AttRequest } from '@/types';
import {
  fetchAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  deleteLeaveRequest,
  submitLeaveRequest,
} from '@/apps/portal/services/leaveService';

interface LeaveApprovalProps {
  currentUser: AccountUser;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const LEAVE_TYPES: Record<string, string> = {
  annual:   'Phép năm',
  unpaid:   'Không lương',
  sick:     'Nghỉ ốm',
  birthday: '🎂 Nghỉ sinh nhật',
  remote:   '🏠 Làm remote',
};

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ duyệt',  color: '#FF9500', bg: 'rgba(255,149,0,0.12)' },
  approved: { label: 'Đã duyệt',   color: '#34C759', bg: 'rgba(52,199,89,0.12)' },
  rejected: { label: 'Từ chối',     color: '#FF3B30', bg: 'rgba(255,59,48,0.12)' },
};

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

const LeaveApproval: React.FC<LeaveApprovalProps> = ({ currentUser, onToast }) => {
  const [requests, setRequests] = useState<AttRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    dateFrom: '',
    dateTo: '',
    leaveType: 'annual' as 'annual' | 'unpaid' | 'sick',
    leaveDays: 1,
    reason: '',
  });

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllLeaveRequests(filter === 'all' ? undefined : filter);
      setRequests(data);
    } catch (err: any) {
      onToast(err.message || 'Lỗi khi tải dữ liệu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      await approveLeaveRequest(id, currentUser.username, reviewNotes[id] || '');
      onToast('✅ Đã duyệt đơn nghỉ phép', 'success');
      setReviewNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      await loadRequests();
    } catch (err: any) {
      onToast(err.message || 'Lỗi khi duyệt', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!reviewNotes[id]?.trim()) {
      onToast('Vui lòng nhập lý do từ chối', 'error');
      return;
    }
    setProcessing(id);
    try {
      await rejectLeaveRequest(id, currentUser.username, reviewNotes[id] || '');
      onToast('❌ Đã từ chối đơn nghỉ phép', 'success');
      setReviewNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      await loadRequests();
    } catch (err: any) {
      onToast(err.message || 'Lỗi khi từ chối', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmingDelete !== id) {
      setConfirmingDelete(id);
      return;
    }
    setProcessing(id);
    setConfirmingDelete(null);
    try {
      await deleteLeaveRequest(id);
      onToast('🗑️ Đã xoá đơn nghỉ phép', 'success');
      await loadRequests();
    } catch (err: any) {
      onToast(err.message || 'Lỗi khi xoá', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleSubmitLeave = async () => {
    if (!currentUser.employee_id) {
      onToast('Tài khoản này chưa liên kết hồ sơ nhân viên', 'error');
      return;
    }
    if (!form.dateFrom || !form.dateTo) {
      onToast('Vui lòng chọn ngày bắt đầu và kết thúc', 'error');
      return;
    }
    if (form.dateTo < form.dateFrom) {
      onToast('Ngày kết thúc không được nhỏ hơn ngày bắt đầu', 'error');
      return;
    }
    if (!form.reason.trim()) {
      onToast('Vui lòng nhập lý do nghỉ phép', 'error');
      return;
    }

    setProcessing('create');
    try {
      await submitLeaveRequest(
        currentUser.employee_id,
        form.dateFrom,
        form.dateTo,
        Number(form.leaveDays) || 1,
        form.leaveType,
        form.reason.trim(),
      );
      onToast('✅ Đã gửi đơn nghỉ phép', 'success');
      setForm({
        dateFrom: '',
        dateTo: '',
        leaveType: 'annual',
        leaveDays: 1,
        reason: '',
      });
      setFilter('pending');
      await loadRequests();
    } catch (err: any) {
      onToast(err.message || 'Lỗi khi gửi đơn nghỉ phép', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'pending', label: 'Chờ duyệt' },
    { key: 'approved', label: 'Đã duyệt' },
    { key: 'rejected', label: 'Từ chối' },
    { key: 'all', label: 'Tất cả' },
  ];

  return (
    <div className="animate-fadeInUp">
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF6B35', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
          🏖️ Quản lý Nghỉ phép
        </h2>
        <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
          Duyệt đơn xin nghỉ phép của nhân viên
        </p>
      </div>

      {/* Create leave request */}
      <div style={{
        marginBottom: '20px', background: '#161616', border: '1px solid #222',
        borderRadius: '16px', padding: '20px'
      }}>
        <div style={{ marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#F5F5F5' }}>📝 Tạo đơn nghỉ phép</h3>
          <p style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
            Gửi đơn trực tiếp từ Platforms
          </p>
        </div>

        {!currentUser.employee_id ? (
          <div style={{
            padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,59,48,0.08)',
            border: '1px solid rgba(255,59,48,0.18)', color: '#FF8A80', fontSize: '12px', fontWeight: 700,
          }}>
            Tài khoản hiện tại chưa liên kết employee_id nên chưa thể gửi đơn nghỉ phép.
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px', marginBottom: '12px'
            }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Từ ngày</p>
                <input
                  type="date"
                  value={form.dateFrom}
                  onChange={e => setForm(prev => ({ ...prev, dateFrom: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5', fontSize: '13px' }}
                />
              </div>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Đến ngày</p>
                <input
                  type="date"
                  value={form.dateTo}
                  onChange={e => setForm(prev => ({ ...prev, dateTo: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5', fontSize: '13px' }}
                />
              </div>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Loại nghỉ</p>
                <select
                  value={form.leaveType}
                  onChange={e => setForm(prev => ({ ...prev, leaveType: e.target.value as 'annual' | 'unpaid' | 'sick' }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5', fontSize: '13px' }}
                >
                  <option value="annual">Phép năm</option>
                  <option value="unpaid">Không lương</option>
                  <option value="sick">Nghỉ ốm</option>
                </select>
              </div>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Số ngày</p>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={form.leaveDays}
                  onChange={e => setForm(prev => ({ ...prev, leaveDays: Number(e.target.value) || 0 }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Lý do</p>
              <textarea
                value={form.reason}
                onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
                rows={3}
                placeholder="Nhập lý do nghỉ phép..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5', fontSize: '13px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSubmitLeave}
                disabled={processing === 'create'}
                style={{
                  padding: '10px 18px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #FF6B35 0%, #F7C948 100%)',
                  color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                  opacity: processing === 'create' ? 0.5 : 1,
                }}
              >
                {processing === 'create' ? 'Đang gửi...' : '📨 Gửi đơn nghỉ phép'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '8px 18px', borderRadius: '10px', border: '1px solid',
              borderColor: filter === f.key ? '#FF6B35' : '#333',
              background: filter === f.key ? 'rgba(255,107,53,0.12)' : 'transparent',
              color: filter === f.key ? '#FF6B35' : '#888',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {f.label}
            {f.key === 'pending' && pendingCount > 0 && filter !== 'pending' && (
              <span style={{
                marginLeft: '6px', padding: '1px 6px', borderRadius: '6px',
                background: '#FF3B30', color: '#fff', fontSize: '10px', fontWeight: 800,
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p className="animate-pulse" style={{ color: '#888', fontSize: '13px' }}>Đang tải...</p>
        </div>
      ) : requests.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px', background: '#161616',
          borderRadius: '16px', border: '1px solid #222',
        }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
            Không có đơn nào {filter !== 'all' ? `(${FILTERS.find(f => f.key === filter)?.label})` : ''}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map(req => {
            const st = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
            const isPending = req.status === 'pending';
            const isProcessing = processing === req.id;

            return (
              <div key={req.id} style={{
                background: '#161616', border: `1px solid ${isPending ? '#333' : '#222'}`,
                borderRadius: '14px', padding: '22px', transition: 'all 0.2s',
                borderLeftWidth: '4px', borderLeftColor: st.color,
              }}>
                {/* Top row: employee + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Avatar */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                      background: req.employee?.avatar_url
                        ? `url(${req.employee.avatar_url}) center/cover`
                        : 'linear-gradient(135deg, #FF6B35 0%, #F7C948 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: req.employee?.avatar_url ? '0' : '18px', fontWeight: 900, color: '#fff',
                    }}>
                      {!req.employee?.avatar_url && (req.employee?.full_name?.[0] || '?')}
                    </div>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 800, color: '#F5F5F5' }}>
                        {req.employee?.full_name || 'N/A'}
                      </p>
                      <p style={{ fontSize: '11px', color: '#888' }}>
                        {req.employee?.position || ''} {req.employee?.department_id ? '' : ''}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 800, padding: '4px 12px', borderRadius: '8px',
                    background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {st.label}
                  </span>
                </div>

                {/* Details */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px', marginBottom: '12px',
                  padding: '14px', background: '#0F0F0F', borderRadius: '10px',
                }}>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Thời gian</p>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#F5F5F5' }}>
                      {new Date(req.date_from).toLocaleDateString('vi-VN')}
                      {req.leave_hours
                        ? <span style={{ color: '#aaa', fontWeight: 400 }}> · {req.time_from?.slice(0,5)}–{req.time_to?.slice(0,5)}</span>
                        : req.date_to !== req.date_from ? <span> → {new Date(req.date_to).toLocaleDateString('vi-VN')}</span> : null
                      }
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Số ngày</p>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: '#06B6D4' }}>
                      {req.leave_hours ? `${req.leave_hours}h = ` : ''}{req.leave_days} ngày
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Loại</p>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#8B5CF6' }}>
                      {LEAVE_TYPES[req.leave_type] || req.leave_type}
                    </p>
                  </div>
                </div>

                {/* Reason */}
                <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 700, color: '#888' }}>Lý do:</span> {req.reason}
                </p>

                {/* Reviewer note (if already reviewed) */}
                {req.reviewer_note && !isPending && (
                  <p style={{
                    fontSize: '12px', color: req.status === 'rejected' ? '#FF3B30' : '#34C759',
                    marginBottom: '12px', fontStyle: 'italic', padding: '8px 12px',
                    background: req.status === 'rejected' ? 'rgba(255,59,48,0.05)' : 'rgba(52,199,89,0.05)',
                    borderRadius: '8px',
                  }}>
                    💬 {req.reviewer_note}
                  </p>
                )}

                {/* Action buttons for pending */}
                {isPending && (
                  <div style={{ borderTop: '1px solid #222', paddingTop: '14px' }}>
                    <input
                      type="text"
                      placeholder="Ghi chú (bắt buộc khi từ chối)..."
                      value={reviewNotes[req.id] || ''}
                      onChange={e => setReviewNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                        border: '1px solid #333', background: '#0F0F0F', color: '#F5F5F5',
                        fontSize: '13px', outline: 'none', marginBottom: '12px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={isProcessing}
                        style={{
                          flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                          background: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
                          color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                          opacity: isProcessing ? 0.5 : 1,
                        }}
                      >
                        ✅ Duyệt
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={isProcessing}
                        style={{
                          flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                          background: 'linear-gradient(135deg, #FF3B30 0%, #FF453A 100%)',
                          color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                          opacity: isProcessing ? 0.5 : 1,
                        }}
                      >
                        ❌ Từ chối
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete button — always visible for admin */}
                <div style={{ borderTop: isPending ? 'none' : '1px solid #222', paddingTop: isPending ? '0' : '12px', marginTop: isPending ? '0' : '4px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {confirmingDelete === req.id && (
                    <button
                      onClick={() => setConfirmingDelete(null)}
                      style={{
                        padding: '6px 14px', borderRadius: '8px', border: '1px solid #333',
                        background: 'transparent', color: '#888', fontSize: '11px',
                        fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Huỷ
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(req.id)}
                    disabled={isProcessing}
                    style={{
                      padding: '6px 14px', borderRadius: '8px',
                      border: confirmingDelete === req.id ? 'none' : '1px solid rgba(255,59,48,0.2)',
                      background: confirmingDelete === req.id ? 'linear-gradient(135deg, #FF3B30 0%, #FF453A 100%)' : 'transparent',
                      color: confirmingDelete === req.id ? '#fff' : '#FF3B30',
                      fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      opacity: isProcessing ? 0.5 : 1,
                    }}
                  >
                    {confirmingDelete === req.id ? '❗ Xác nhận xoá' : '🗑️ Xoá đơn'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeaveApproval;
