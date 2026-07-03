import React from 'react';
import { PayPayrollRecord, PayPayrollSheet } from '@/types';

type PayslipWithSheet = PayPayrollRecord & { sheet?: PayPayrollSheet };

interface Props {
  ps: PayslipWithSheet;
  /** Ngày công tiêu chuẩn — ưu tiên sheet.standard_work_days, fallback 22 */
  standardDays?: number;
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString('vi-VN');

const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' } as const;
const lblStyle = { fontSize: '12px', color: '#aaa' } as const;
const valStyle = { fontSize: '12px', fontWeight: 600, color: '#F5F5F5', textAlign: 'right' as const } as const;

/**
 * Bảng chi tiết đầy đủ 1 phiếu lương — từng khoản mục (tham chiếu vs thực tế),
 * BH & thuế từng dòng, thưởng, NET, ghi chú bảo mật.
 * Dùng chung cho tab "Bảng lương của tôi" và modal xác nhận bắt buộc —
 * nhân viên PHẢI thấy đủ chi tiết để đối chiếu đúng/sai trước khi xác nhận.
 */
const PayslipDetailSection: React.FC<Props> = ({ ps, standardDays }) => {
  const STANDARD_DAYS = standardDays ?? ps.sheet?.standard_work_days ?? 22;
  const ratio = (ps.work_days || 0) / STANDARD_DAYS;

  // Thử việc / tháng chuyển giao
  const isTransition = !ps.is_probation && (ps.probation_ratio || 0) > 0 && (ps.probation_ratio || 0) < 1;
  const hasPreSalary = isTransition && ps.pre_official_base_salary != null;
  const effectiveBase = hasPreSalary
    ? Math.round((ps.pre_official_base_salary || 0) * (ps.probation_ratio || 0) + (ps.base_salary || 0) * (1 - (ps.probation_ratio || 0)))
    : (ps.base_salary || 0);

  return (
    <>
      {/* Section: Lương thực tế */}
      <p style={{ fontSize: '10px', fontWeight: 900, color: '#06B6D4', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
        💰 Lương thực tế
      </p>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '2px solid rgba(255,255,255,0.08)', marginBottom: '2px' }}>
        <span style={{ fontSize: '9px', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Khoản mục</span>
        <div style={{ display: 'flex', gap: '32px' }}>
          <span style={{ fontSize: '9px', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', width: '90px', textAlign: 'right' }}>Tham chiếu</span>
          <span style={{ fontSize: '9px', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', width: '90px', textAlign: 'right' }}>Thực tế</span>
        </div>
      </div>

      {hasPreSalary ? (
        <>
          <div style={rowStyle}>
            <span style={lblStyle}>{`Lương CB cũ (TV ${Math.round((ps.probation_ratio || 0) * 100)}%)`}</span>
            <div style={{ display: 'flex', gap: '32px' }}>
              <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(ps.pre_official_base_salary || 0)}</span>
              <span style={{ ...valStyle, width: '90px' }}>{fmt(Math.round((ps.pre_official_base_salary || 0) * (ps.probation_ratio || 0) * ratio))}</span>
            </div>
          </div>
          <div style={rowStyle}>
            <span style={lblStyle}>{`Lương CB mới (CThức ${Math.round((1 - (ps.probation_ratio || 0)) * 100)}%)`}</span>
            <div style={{ display: 'flex', gap: '32px' }}>
              <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(ps.base_salary || 0)}</span>
              <span style={{ ...valStyle, width: '90px' }}>{fmt(Math.round((ps.base_salary || 0) * (1 - (ps.probation_ratio || 0)) * ratio))}</span>
            </div>
          </div>
          <div style={rowStyle}>
            <span style={{ ...lblStyle, color: '#FF9500' }}>Lương CB thực tế (prorate)</span>
            <div style={{ display: 'flex', gap: '32px' }}>
              <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(effectiveBase)}</span>
              <span style={{ ...valStyle, color: '#FF9500', width: '90px' }}>{fmt(Math.round(effectiveBase * ratio))}</span>
            </div>
          </div>
        </>
      ) : (
        <div style={rowStyle}>
          <span style={lblStyle}>Lương cơ bản</span>
          <div style={{ display: 'flex', gap: '32px' }}>
            <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(ps.base_salary || 0)}</span>
            <span style={{ ...valStyle, width: '90px' }}>{fmt(Math.round((ps.base_salary || 0) * ratio))}</span>
          </div>
        </div>
      )}

      {[
        { label: 'PC ăn trưa', ref: ps.lunch_allowance, actual: Math.round((ps.lunch_allowance || 0) * ratio) },
        { label: 'PC xăng xe', ref: ps.transport_allowance, actual: Math.round((ps.transport_allowance || 0) * ratio) },
        { label: 'PC điện thoại', ref: ps.phone_allowance, actual: Math.round((ps.phone_allowance || 0) * ratio) },
        { label: 'PC trang phục', ref: ps.clothing_allowance, actual: Math.round((ps.clothing_allowance || 0) * ratio) },
        { label: 'Phụ cấp KPI', ref: ps.kpi_allowance, actual: Math.round((ps.kpi_allowance || 0) * ratio) },
        { label: 'Tăng ca mặc định', ref: ps.default_ot, actual: Math.round((ps.default_ot || 0) * ratio) },
      ].map((item, i) => (
        <div key={i} style={rowStyle}>
          <span style={lblStyle}>{item.label}</span>
          <div style={{ display: 'flex', gap: '32px' }}>
            <span style={{ ...valStyle, color: '#888', width: '90px' }}>{fmt(item.ref || 0)}</span>
            <span style={{ ...valStyle, width: '90px' }}>{fmt(item.actual)}</span>
          </div>
        </div>
      ))}

      {/* Extra OT row */}
      {(ps.extra_ot_hours || 0) > 0 && (
        <div style={rowStyle}>
          <span style={{ ...lblStyle, color: '#FF9500' }}>Tăng ca phát sinh ({ps.extra_ot_hours}h)</span>
          <div style={{ display: 'flex', gap: '32px' }}>
            <span style={{ ...valStyle, color: '#888', width: '90px' }}>—</span>
            <span style={{ ...valStyle, color: '#FF9500', width: '90px' }}>{fmt(ps.extra_ot || 0)}</span>
          </div>
        </div>
      )}

      {/* Gross rows */}
      <div style={{ borderTop: '2px solid rgba(255,255,255,0.08)', marginTop: '4px', paddingTop: '6px' }}>
        <div style={rowStyle}>
          <span style={{ ...lblStyle, fontWeight: 800, color: '#ccc' }}>GROSS THAM CHIẾU</span>
          <span style={{ ...valStyle, fontWeight: 800 }}>{fmt(ps.gross_ref || 0)} ₫</span>
        </div>
        <div style={rowStyle}>
          <span style={{ ...lblStyle, fontWeight: 800, color: '#06B6D4' }}>GROSS THỰC TẾ</span>
          <span style={{ fontSize: '14px', fontWeight: 900, color: '#06B6D4' }}>{fmt(ps.gross_actual || 0)} ₫</span>
        </div>
      </div>

      {/* Section: BH & Thuế */}
      <p style={{ fontSize: '10px', fontWeight: 900, color: '#FF9500', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '16px 0 8px' }}>
        🛡️ Bảo hiểm & Thuế
      </p>

      {ps.is_probation ? (
        <>
          <div style={rowStyle}>
            <span style={lblStyle}>BH nhân viên</span>
            <span style={{ ...valStyle, color: '#888' }}>0 (không đóng — thử việc)</span>
          </div>
          <div style={rowStyle}>
            <span style={lblStyle}>Thu nhập chịu thuế</span>
            <span style={valStyle}>{fmt(ps.taxable_income || 0)} ₫</span>
          </div>
          <div style={rowStyle}>
            <span style={lblStyle}>Thuế TNCN (cố định, thử việc)</span>
            <span style={{ ...valStyle, color: (ps.pit || 0) > 0 ? '#FF3B30' : '#34C759' }}>
              {(ps.pit || 0) > 0 ? `-${fmt(ps.pit)}` : '0'} ₫
            </span>
          </div>
        </>
      ) : (
        <>
          <div style={rowStyle}>
            <span style={lblStyle}>BH nhân viên (10.5%)</span>
            <span style={{ ...valStyle, color: '#FF9500' }}>-{fmt(ps.employee_bhxh || 0)} ₫</span>
          </div>
          <div style={rowStyle}>
            <span style={lblStyle}>Thu nhập chịu thuế (CB + KPI)</span>
            <span style={valStyle}>{fmt(ps.taxable_income || 0)} ₫</span>
          </div>
          <div style={rowStyle}>
            <span style={lblStyle}>Giảm trừ bản thân</span>
            <span style={{ ...valStyle, color: '#888' }}>-15.500.000 ₫</span>
          </div>
          <div style={rowStyle}>
            <span style={lblStyle}>Giảm trừ NPT ({ps.dependents_count || 0} người)</span>
            <span style={{ ...valStyle, color: '#888' }}>-{fmt((ps.dependents_count || 0) * 6_200_000)} ₫</span>
          </div>
          <div style={rowStyle}>
            <span style={lblStyle}>Thu nhập tính thuế</span>
            <span style={valStyle}>{(ps.assessable_income || 0) > 0 ? fmt(ps.assessable_income) : '0'} ₫</span>
          </div>
          <div style={rowStyle}>
            <span style={lblStyle}>Thuế TNCN (lũy tiến)</span>
            <span style={{ ...valStyle, color: (ps.pit || 0) > 0 ? '#FF3B30' : '#34C759' }}>
              {(ps.pit || 0) > 0 ? `-${fmt(ps.pit)}` : '0'} ₫
            </span>
          </div>
        </>
      )}

      {/* Thưởng (nếu có) — cộng thẳng vào net, không tính thuế/BH */}
      {(ps.bonus || 0) > 0 && (
        <div style={rowStyle}>
          <span style={{ ...lblStyle, color: '#EAB308' }}>🎁 {ps.bonus_reason || 'Thưởng'}</span>
          <span style={{ ...valStyle, color: '#EAB308' }}>+{fmt(ps.bonus)} ₫</span>
        </div>
      )}

      {/* NET */}
      <div style={{
        padding: '14px 20px', borderRadius: '12px', margin: '14px 0',
        background: 'linear-gradient(135deg, rgba(52,199,89,0.15), rgba(5,150,105,0.15))',
        border: '1px solid rgba(52,199,89,0.2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 900, color: '#34C759', letterSpacing: '0.06em' }}>💵 NET THỰC LĨNH</span>
        <span style={{ fontSize: '22px', fontWeight: 900, color: '#34C759' }}>{fmt(ps.net_salary || 0)} ₫</span>
      </div>

      {/* Confidentiality notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px',
        padding: '10px 14px', marginTop: '6px',
        background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.12)',
        borderRadius: '10px',
      }}>
        <span style={{ fontSize: '13px', flexShrink: 0 }}>🔒</span>
        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
          Thông tin lương là <span style={{ color: 'rgba(255,149,0,0.7)', fontWeight: 700 }}>bảo mật cá nhân</span>. Vui lòng không chia sẻ, tiết lộ hoặc cho bất kỳ ai khác biết nội dung phiếu lương này.
        </p>
      </div>
    </>
  );
};

export default PayslipDetailSection;
