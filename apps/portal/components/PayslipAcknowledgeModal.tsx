import React, { useState } from 'react';
import { PayPayrollRecord, PayPayrollSheet } from '@/types';
import { submitPayslipAcknowledgement } from '../services/portalService';

type PayslipWithSheet = PayPayrollRecord & { sheet?: PayPayrollSheet };

interface Props {
  payslip: PayslipWithSheet;
  onDone: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

/**
 * Màn hình blocking bắt buộc — nhân viên phải xác nhận hoặc khiếu nại
 * trước khi tiếp tục dùng app. Không có nút đóng (X).
 */
const PayslipAcknowledgeModal: React.FC<Props> = ({ payslip, onDone }) => {
  const [mode, setMode] = useState<'view' | 'dispute'>('view');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheet = payslip.sheet;
  const monthLabel = sheet ? `Tháng ${sheet.month}/${sheet.year}` : 'Bảng lương';

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await submitPayslipAcknowledgement(payslip.id, 'confirmed');
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!comment.trim()) {
      setError('Vui lòng nhập nội dung sai sót trước khi gửi.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await submitPayslipAcknowledgement(payslip.id, 'disputed', comment.trim());
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Full-screen overlay — không thể đóng */
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        background: '#111', border: '1px solid #2a2a2a', borderRadius: '20px',
        width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 0 60px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid #1e1e1e',
          background: 'linear-gradient(135deg, rgba(234,179,8,0.08), rgba(234,179,8,0.02))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '22px' }}>📋</span>
            <span style={{
              fontSize: '11px', fontWeight: 900, textTransform: 'uppercase',
              letterSpacing: '0.12em', color: '#EAB308',
            }}>
              Xác nhận phiếu lương bắt buộc
            </span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: 0 }}>
            {monthLabel}
          </h2>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '6px', lineHeight: 1.5 }}>
            Vui lòng kiểm tra thông tin bên dưới và xác nhận. Bạn cần hoàn thành bước này trước khi tiếp tục sử dụng app.
          </p>
        </div>

        {/* Payslip summary */}
        <div style={{ padding: '20px 24px' }}>
          {/* NET highlight */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: '12px', padding: '16px', marginBottom: '16px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '11px', color: '#6EE7B7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Lương thực lĩnh
            </p>
            <p style={{ fontSize: '28px', fontWeight: 900, color: '#10B981', margin: 0 }}>
              {fmt(payslip.net_salary)} <span style={{ fontSize: '14px' }}>đ</span>
            </p>
          </div>

          {/* Key figures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {[
              { label: 'Gross thực tế', value: fmt(payslip.gross_actual), color: '#fff' },
              { label: 'BH nhân viên', value: fmt(payslip.employee_bhxh), color: '#FB923C' },
              { label: 'Thuế TNCN', value: fmt(payslip.pit), color: '#F87171' },
              { label: 'Ngày công', value: `${payslip.work_days}/${sheet?.standard_work_days ?? 22}`, color: '#A78BFA' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: '#161616', borderRadius: '10px', padding: '10px 12px',
                border: '1px solid #1e1e1e',
              }}>
                <p style={{ fontSize: '10px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                <p style={{ fontSize: '14px', fontWeight: 700, color, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Bonus if any */}
          {(payslip.bonus ?? 0) > 0 && (
            <div style={{
              background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)',
              borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '12px', color: '#CA8A04' }}>
                🎁 {payslip.bonus_reason || 'Thưởng'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#EAB308' }}>
                +{fmt(payslip.bonus)} đ
              </span>
            </div>
          )}

          {/* Company note if any */}
          {payslip.note && (
            <div style={{
              background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.2)',
              borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
            }}>
              <p style={{ fontSize: '10px', color: '#FF9500', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                💌 Lời nhắn từ công ty
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {payslip.note}
              </p>
            </div>
          )}

          {/* Dispute textarea */}
          {mode === 'dispute' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                Mô tả sai sót <span style={{ color: '#F87171' }}>*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                placeholder="Ví dụ: Ngày công tính thiếu 1 ngày, phụ cấp xăng xe không đúng..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                style={{
                  width: '100%', background: '#0a0a0a', border: '1px solid #333',
                  borderRadius: '10px', color: '#fff', fontSize: '13px',
                  padding: '10px 12px', resize: 'vertical', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p style={{ fontSize: '12px', color: '#F87171', marginBottom: '12px', padding: '8px 12px', background: 'rgba(248,113,113,0.08)', borderRadius: '8px' }}>
              ⚠️ {error}
            </p>
          )}

          {/* Confidentiality notice */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            padding: '10px 14px', marginBottom: '14px',
            background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.15)',
            borderRadius: '10px',
          }}>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>🔒</span>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,149,0,0.8)', lineHeight: 1.6 }}>
              Thông tin lương là <strong>bảo mật cá nhân</strong>. Vui lòng không chia sẻ, tiết lộ hoặc cho bất kỳ ai khác biết nội dung phiếu lương này.
            </p>
          </div>

          {/* Action buttons */}
          {mode === 'view' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={() => setMode('dispute')}
                disabled={loading}
                style={{
                  padding: '12px', borderRadius: '12px', fontWeight: 800,
                  fontSize: '13px', border: '1px solid rgba(248,113,113,0.3)',
                  background: 'rgba(248,113,113,0.08)', color: '#F87171',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                ❌ Báo sai sót
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  padding: '12px', borderRadius: '12px', fontWeight: 800,
                  fontSize: '13px', border: 'none',
                  background: loading ? '#333' : 'linear-gradient(135deg, #059669, #10B981)',
                  color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {loading ? 'Đang xử lý...' : '✅ Xác nhận đúng'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={() => { setMode('view'); setComment(''); setError(null); }}
                disabled={loading}
                style={{
                  padding: '12px', borderRadius: '12px', fontWeight: 700,
                  fontSize: '13px', border: '1px solid #333',
                  background: 'transparent', color: '#888',
                  cursor: 'pointer',
                }}
              >
                ← Quay lại
              </button>
              <button
                onClick={handleDispute}
                disabled={loading || !comment.trim()}
                style={{
                  padding: '12px', borderRadius: '12px', fontWeight: 800,
                  fontSize: '13px', border: 'none',
                  background: loading || !comment.trim() ? '#333' : 'linear-gradient(135deg, #DC2626, #F87171)',
                  color: '#fff', cursor: loading || !comment.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {loading ? 'Đang gửi...' : '📤 Gửi khiếu nại'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayslipAcknowledgeModal;
