import React, { useState } from 'react';
import { PayPayrollRecord, PayPayrollSheet } from '@/types';
import { submitPayslipAcknowledgement } from '../services/portalService';
import PayslipDetailSection from './PayslipDetailSection';

type PayslipWithSheet = PayPayrollRecord & { sheet?: PayPayrollSheet };

interface Props {
  payslip: PayslipWithSheet;
  onDone: () => void;
}

/**
 * Màn hình blocking bắt buộc — nhân viên phải xác nhận hoặc khiếu nại
 * trước khi tiếp tục dùng app. Không có nút đóng (X).
 * Kích thước responsive: to & rộng trên desktop, tự co gọn trên mobile
 * (dùng Tailwind breakpoints thay vì kích thước cố định).
 */
const PayslipAcknowledgeModal: React.FC<Props> = ({ payslip, onDone }) => {
  const [mode, setMode] = useState<'view' | 'dispute'>('view');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheet = payslip.sheet;
  const monthLabel = sheet ? `Tháng ${sheet.month}/${sheet.year}` : 'Bảng lương';
  const isTransition = !payslip.is_probation && (payslip.probation_ratio || 0) > 0 && (payslip.probation_ratio || 0) < 1;

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

  const badgeCls = 'text-[9px] sm:text-[10px] font-black tracking-wide px-2 py-1 sm:px-2.5 rounded';

  return (
    /* Full-screen overlay — không thể đóng */
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
      <div
        className="w-full max-w-[96vw] sm:max-w-[700px] md:max-w-[920px] lg:max-w-[1100px] max-h-[97vh] sm:max-h-[94vh] overflow-y-auto rounded-2xl sm:rounded-[24px] border border-[#2a2a2a] bg-[#111]"
        style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between flex-wrap gap-2 px-4 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-[#1e1e1e]"
          style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.08), rgba(234,179,8,0.02))' }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base sm:text-xl">📋</span>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#EAB308]">
                Xác nhận phiếu lương bắt buộc
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white m-0">
              {monthLabel}
            </h2>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            {payslip.is_probation && (
              <span className={badgeCls} style={{ background: 'rgba(255,149,0,0.12)', color: '#FF9500' }}>
                ⭐ THỬ VIỆC
              </span>
            )}
            {isTransition && (
              <span className={badgeCls} style={{ background: 'rgba(255,149,0,0.12)', color: '#FF9500' }}>
                🔄 CHUYỂN GIAO {Math.round((payslip.probation_ratio || 0) * 100)}%TV + {Math.round((1 - (payslip.probation_ratio || 0)) * 100)}%CT
              </span>
            )}
          </div>
        </div>

        {/* Payslip full detail — nhân viên PHẢI thấy đủ để đối chiếu đúng/sai */}
        <div className="px-4 sm:px-8 py-4 sm:py-6">
          <PayslipDetailSection ps={payslip} />

          {/* Company note if any */}
          {payslip.note && (
            <div className="rounded-xl px-3 py-2.5 sm:px-5 sm:py-4 mt-4 sm:mt-6"
              style={{ background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.2)' }}>
              <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-widest text-[#FF9500] mb-1.5">
                💌 Lời nhắn từ công ty
              </p>
              <p className="m-0 text-[12px] sm:text-[15px] leading-relaxed text-white/85 whitespace-pre-wrap">
                {payslip.note}
              </p>
            </div>
          )}

          {/* Dispute textarea */}
          {mode === 'dispute' && (
            <div className="mt-4 sm:mt-6">
              <label className="block mb-2 text-[12px] sm:text-sm font-semibold text-[#aaa]">
                Mô tả sai sót <span className="text-[#F87171]">*</span>
              </label>
              <textarea
                autoFocus
                rows={2}
                placeholder="Ví dụ: Ngày công tính thiếu 1 ngày, phụ cấp xăng xe không đúng..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-full rounded-xl border border-[#333] bg-[#0a0a0a] text-white text-[13px] sm:text-sm px-3 py-2.5 sm:px-4 sm:py-3 outline-none font-[inherit] box-border resize-y"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-3 sm:mt-4 rounded-lg px-3 py-2 text-[12px] sm:text-sm text-[#F87171]" style={{ background: 'rgba(248,113,113,0.08)' }}>
              ⚠️ {error}
            </p>
          )}

          {/* Action buttons */}
          {mode === 'view' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 mt-4 sm:mt-6">
              <button
                onClick={() => setMode('dispute')}
                disabled={loading}
                className="rounded-xl font-extrabold text-[13px] sm:text-base py-3 sm:py-4 cursor-pointer transition-all disabled:cursor-not-allowed"
                style={{ border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#F87171' }}
              >
                ❌ Báo sai sót
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-xl font-extrabold text-[13px] sm:text-base py-3 sm:py-4 text-white cursor-pointer transition-all disabled:cursor-not-allowed"
                style={{ border: 'none', background: loading ? '#333' : 'linear-gradient(135deg, #059669, #10B981)' }}
              >
                {loading ? 'Đang xử lý...' : '✅ Xác nhận đúng'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 mt-4 sm:mt-6">
              <button
                onClick={() => { setMode('view'); setComment(''); setError(null); }}
                disabled={loading}
                className="rounded-xl font-bold text-[13px] sm:text-base py-3 sm:py-4 bg-transparent text-[#888] cursor-pointer"
                style={{ border: '1px solid #333' }}
              >
                ← Quay lại
              </button>
              <button
                onClick={handleDispute}
                disabled={loading || !comment.trim()}
                className="rounded-xl font-extrabold text-[13px] sm:text-base py-3 sm:py-4 text-white cursor-pointer transition-all disabled:cursor-not-allowed"
                style={{ border: 'none', background: loading || !comment.trim() ? '#333' : 'linear-gradient(135deg, #DC2626, #F87171)' }}
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
