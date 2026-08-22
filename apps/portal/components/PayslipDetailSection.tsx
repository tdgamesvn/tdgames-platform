import React from 'react';
import { PayPayrollRecord, PayPayrollSheet } from '@/types';

type PayslipWithSheet = PayPayrollRecord & { sheet?: PayPayrollSheet };

interface Props {
  ps: PayslipWithSheet;
  /** Ngày công tiêu chuẩn — ưu tiên sheet.standard_work_days, fallback 22 */
  standardDays?: number;
  /** Có truyền → hiện nút mở tab Chấm công đúng tháng của phiếu. Modal xác nhận không truyền. */
  onViewAttendance?: () => void;
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString('vi-VN');

/** Tổng giờ OT phát sinh — gộp cả 3 loại ngày (thường / T7-CN / lễ). */
const otTotalHours = (ps: PayPayrollRecord) =>
  (ps.extra_ot_hours || 0) + (ps.extra_ot_hours_weekend || 0) + (ps.extra_ot_hours_holiday || 0)
  + (ps.extra_ot_hours_night || 0) + (ps.extra_ot_hours_night_weekend || 0) + (ps.extra_ot_hours_night_holiday || 0);

// Row/label/value dùng className (Tailwind, arbitrary values) để scale theo breakpoint
// thay vì style cố định — to hơn & đọc được trên mọi kích thước màn hình.
const rowCls = 'flex justify-between items-center py-1.5 sm:py-2 border-b border-white/5';
const lblCls = 'text-[12px] sm:text-[14px] text-[#aaa] pr-2';
const valWrapCls = 'flex gap-2.5 sm:gap-6 shrink-0';
const refValCls = 'hidden sm:inline-block w-[64px] sm:w-[96px] text-right text-[12px] sm:text-[14px] font-semibold text-[#888]';
const actValCls = 'w-[64px] sm:w-[96px] text-right text-[12px] sm:text-[14px] font-semibold text-[#F5F5F5]';

/**
 * Bảng chi tiết đầy đủ 1 phiếu lương — layout 2 cột (Lương thực tế | BH & Thuế),
 * responsive theo breakpoint (to hơn trên desktop, gọn & dễ đọc trên mobile).
 * Dùng chung cho tab "Bảng lương của tôi" và modal xác nhận bắt buộc —
 * nhân viên PHẢI thấy đủ chi tiết để đối chiếu đúng/sai trước khi xác nhận.
 */
const PayslipDetailSection: React.FC<Props> = ({ ps, standardDays, onViewAttendance }) => {
  const STANDARD_DAYS = standardDays ?? ps.sheet?.standard_work_days ?? 22;
  const ratio = (ps.work_days || 0) / STANDARD_DAYS;

  // Thử việc / tháng chuyển giao
  const isTransition = !ps.is_probation && (ps.probation_ratio || 0) > 0 && (ps.probation_ratio || 0) < 1;
  const hasPreSalary = isTransition && ps.pre_official_base_salary != null;
  const effectiveBase = hasPreSalary
    ? Math.round((ps.pre_official_base_salary || 0) * (ps.probation_ratio || 0) + (ps.base_salary || 0) * (1 - (ps.probation_ratio || 0)))
    : (ps.base_salary || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-10 gap-y-5 md:gap-y-6">
      {/* ── Ngày công — nhân viên phải thấy CÁI NÀY TRƯỚC, vì mọi con số bên dưới
             đều là "khoản cố định × tỷ lệ này". Trước đây nó là dòng 11px màu #666
             nằm ngoài component => nhân viên không thấy, không tự đối chiếu được. ── */}
      <div className="md:col-span-2 rounded-xl px-4 py-3 sm:px-5 sm:py-4"
        style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.25)' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="m-0 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#06B6D4]">
              📅 Ngày công tháng này
            </p>
            <p className="m-0 mt-1 text-[18px] sm:text-[22px] font-black text-[#F5F5F5]">
              {ps.work_days || 0} <span className="text-[#666] font-bold">/ {STANDARD_DAYS} ngày chuẩn</span>
              <span className="ml-2 text-[#06B6D4]">= {(ratio * 100).toFixed(1)}%</span>
            </p>
          </div>
          {onViewAttendance && (
            <button onClick={onViewAttendance}
              className="text-[11px] sm:text-[12px] font-bold text-[#06B6D4] hover:text-white transition-colors rounded-lg px-3 py-2"
              style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)' }}>
              Xem chi tiết chấm công →
            </button>
          )}
        </div>
        <p className="m-0 mt-2 text-[11px] sm:text-[13px] leading-relaxed text-white/50">
          Lương cơ bản và các phụ cấp cố định đều được nhân với tỷ lệ này.
          Ví dụ: <span className="text-white/75 font-semibold">
            {fmt(effectiveBase)} × {ps.work_days || 0}/{STANDARD_DAYS} = {fmt(Math.round(effectiveBase * ratio))} ₫
          </span>
        </p>
      </div>

      {/* ── Cột trái: Lương thực tế ── */}
      <div>
        <p className="text-[11px] sm:text-[13px] font-black text-[#06B6D4] tracking-widest uppercase mb-2">
          💰 Lương thực tế
        </p>
        {/* Header row */}
        <div className="flex justify-between py-1 border-b-2 border-white/10 mb-0.5">
          <span className="text-[9px] sm:text-[10px] font-extrabold text-[#666] uppercase tracking-wider">Khoản mục</span>
          <div className={valWrapCls}>
            <span className={`hidden sm:inline-block w-[64px] sm:w-[96px] text-right text-[9px] sm:text-[10px] font-extrabold text-[#666] uppercase tracking-wider`}>Tham chiếu</span>
            <span className="w-[64px] sm:w-[96px] text-right text-[9px] sm:text-[10px] font-extrabold text-[#06B6D4] uppercase tracking-wider">
              Thực tế<br /><span className="text-[8px] sm:text-[9px] text-[#666] normal-case">×{ps.work_days || 0}/{STANDARD_DAYS}</span>
            </span>
          </div>
        </div>

        {hasPreSalary ? (
          <>
            <div className={rowCls}>
              <span className={lblCls}>{`Lương CB cũ (TV ${Math.round((ps.probation_ratio || 0) * 100)}%)`}</span>
              <div className={valWrapCls}>
                <span className={refValCls}>{fmt(ps.pre_official_base_salary || 0)}</span>
                <span className={actValCls}>{fmt(Math.round((ps.pre_official_base_salary || 0) * (ps.probation_ratio || 0) * ratio))}</span>
              </div>
            </div>
            <div className={rowCls}>
              <span className={lblCls}>{`Lương CB mới (CThức ${Math.round((1 - (ps.probation_ratio || 0)) * 100)}%)`}</span>
              <div className={valWrapCls}>
                <span className={refValCls}>{fmt(ps.base_salary || 0)}</span>
                <span className={actValCls}>{fmt(Math.round((ps.base_salary || 0) * (1 - (ps.probation_ratio || 0)) * ratio))}</span>
              </div>
            </div>
            <div className={rowCls}>
              <span className={`${lblCls} text-[#FF9500]`}>Lương CB thực tế (prorate)</span>
              <div className={valWrapCls}>
                <span className={refValCls}>{fmt(effectiveBase)}</span>
                <span className={`${actValCls} text-[#FF9500]`}>{fmt(Math.round(effectiveBase * ratio))}</span>
              </div>
            </div>
          </>
        ) : (
          <div className={rowCls}>
            <span className={lblCls}>Lương cơ bản</span>
            <div className={valWrapCls}>
              <span className={refValCls}>{fmt(ps.base_salary || 0)}</span>
              <span className={actValCls}>{fmt(Math.round((ps.base_salary || 0) * ratio))}</span>
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
          <div key={i} className={rowCls}>
            <span className={lblCls}>{item.label}</span>
            <div className={valWrapCls}>
              <span className={refValCls}>{fmt(item.ref || 0)}</span>
              <span className={actValCls}>{fmt(item.actual)}</span>
            </div>
          </div>
        ))}

        {/* Extra OT row */}
        {otTotalHours(ps) > 0 && (
          <div className={rowCls}>
            <span className={`${lblCls} text-[#FF9500]`}>Tăng ca phát sinh ({otTotalHours(ps)}h)</span>
            <div className={valWrapCls}>
              <span className={refValCls}>—</span>
              <span className={`${actValCls} text-[#FF9500]`}>{fmt(ps.extra_ot || 0)}</span>
            </div>
          </div>
        )}

        {/* Gross rows */}
        <div className="border-t-2 border-white/10 mt-1.5 pt-1.5">
          <div className={rowCls}>
            <span className="text-[12px] sm:text-[14px] font-extrabold text-[#ccc]">GROSS THAM CHIẾU</span>
            <span className="text-[12px] sm:text-[14px] font-extrabold text-[#F5F5F5]">{fmt(ps.gross_ref || 0)} ₫</span>
          </div>
          <div className={rowCls}>
            <span className="text-[12px] sm:text-[14px] font-extrabold text-[#06B6D4]">GROSS THỰC TẾ</span>
            <span className="text-[15px] sm:text-[18px] font-black text-[#06B6D4]">{fmt(ps.gross_actual || 0)} ₫</span>
          </div>
        </div>
      </div>

      {/* ── Cột phải: BH & Thuế + NET ── */}
      <div className="flex flex-col">
        <p className="text-[11px] sm:text-[13px] font-black text-[#FF9500] tracking-widest uppercase mb-2">
          🛡️ Bảo hiểm & Thuế
        </p>

        {ps.is_probation ? (
          <>
            <div className={rowCls}>
              <span className={lblCls}>BH nhân viên</span>
              <span className="text-[12px] sm:text-[14px] font-semibold text-[#888]">0 (thử việc)</span>
            </div>
            <div className={rowCls}>
              <span className={lblCls}>Thu nhập chịu thuế</span>
              <span className="text-[12px] sm:text-[14px] font-semibold text-[#F5F5F5]">{fmt(ps.taxable_income || 0)} ₫</span>
            </div>
            <div className={rowCls}>
              <span className={lblCls}>Thuế TNCN (cố định, TV)</span>
              <span className={`text-[12px] sm:text-[14px] font-semibold ${(ps.pit || 0) > 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}`}>
                {(ps.pit || 0) > 0 ? `-${fmt(ps.pit)}` : '0'} ₫
              </span>
            </div>
          </>
        ) : (
          <>
            <div className={rowCls}>
              <span className={lblCls}>BH nhân viên (10.5%)</span>
              <span className="text-[12px] sm:text-[14px] font-semibold text-[#FF9500]">-{fmt(ps.employee_bhxh || 0)} ₫</span>
            </div>
            <div className={rowCls}>
              <span className={lblCls}>Thu nhập chịu thuế</span>
              <span className="text-[12px] sm:text-[14px] font-semibold text-[#F5F5F5]">{fmt(ps.taxable_income || 0)} ₫</span>
            </div>
            <div className={rowCls}>
              <span className={lblCls}>Giảm trừ bản thân</span>
              <span className="text-[12px] sm:text-[14px] font-semibold text-[#888]">-15.500.000 ₫</span>
            </div>
            <div className={rowCls}>
              <span className={lblCls}>Giảm trừ NPT ({ps.dependents_count || 0} người)</span>
              <span className="text-[12px] sm:text-[14px] font-semibold text-[#888]">-{fmt((ps.dependents_count || 0) * 6_200_000)} ₫</span>
            </div>
            <div className={rowCls}>
              <span className={lblCls}>Thu nhập tính thuế</span>
              <span className="text-[12px] sm:text-[14px] font-semibold text-[#F5F5F5]">{(ps.assessable_income || 0) > 0 ? fmt(ps.assessable_income) : '0'} ₫</span>
            </div>
            <div className={rowCls}>
              <span className={lblCls}>Thuế TNCN (lũy tiến)</span>
              <span className={`text-[12px] sm:text-[14px] font-semibold ${(ps.pit || 0) > 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}`}>
                {(ps.pit || 0) > 0 ? `-${fmt(ps.pit)}` : '0'} ₫
              </span>
            </div>
          </>
        )}

        {/* Thưởng (nếu có) — cộng thẳng vào net, không tính thuế/BH */}
        {(ps.bonus || 0) > 0 && (
          <div className={rowCls}>
            <span className="text-[12px] sm:text-[14px] text-[#EAB308]">🎁 {ps.bonus_reason || 'Thưởng'}</span>
            <span className="text-[12px] sm:text-[14px] font-semibold text-[#EAB308]">+{fmt(ps.bonus)} ₫</span>
          </div>
        )}

        {/* NET */}
        <div className="flex justify-between items-center rounded-xl px-4 py-3 sm:px-6 sm:py-4 mt-3 sm:mt-4"
          style={{
            background: 'linear-gradient(135deg, rgba(52,199,89,0.15), rgba(5,150,105,0.15))',
            border: '1px solid rgba(52,199,89,0.2)',
            marginTop: 'auto',
          }}>
          <span className="text-[12px] sm:text-[14px] font-black text-[#34C759] tracking-wider">💵 NET THỰC LĨNH</span>
          <span className="text-[22px] sm:text-[30px] font-black text-[#34C759]">{fmt(ps.net_salary || 0)} ₫</span>
        </div>
      </div>

      {/* Lời nhắn từ công ty (nếu có) — full width */}
      {ps.note && (
        <div className="md:col-span-2 rounded-xl px-3 py-2.5 sm:px-5 sm:py-4"
          style={{ background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.2)' }}>
          <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-widest text-[#FF9500] mb-1.5">
            💌 Lời nhắn từ công ty
          </p>
          <p className="m-0 text-[12px] sm:text-[15px] leading-relaxed text-white/85 whitespace-pre-wrap">
            {ps.note}
          </p>
        </div>
      )}

      {/* Confidentiality notice — full width */}
      <div className="md:col-span-2 flex items-start gap-2 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3"
        style={{ background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.12)' }}>
        <span className="text-[13px] sm:text-[15px] shrink-0">🔒</span>
        <p className="m-0 text-[11px] sm:text-[13px] leading-relaxed text-white/35">
          Thông tin lương là <span className="text-[#FF9500]/70 font-bold">bảo mật cá nhân</span>. Vui lòng không chia sẻ, tiết lộ hoặc cho bất kỳ ai khác biết nội dung phiếu lương này.
        </p>
      </div>
    </div>
  );
};

export default PayslipDetailSection;
