import React from 'react';
import { PayPayrollSheet, PayPayrollRecord, PayrollFormulaConfig } from '@/types';
import { exportPaySlipToExcel } from '../services/payrollExportService';

interface Props {
  sheet: PayPayrollSheet;
  record: PayPayrollRecord;
  formula: PayrollFormulaConfig;
  onClose: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const PaySlip: React.FC<Props> = ({ sheet, record: rec, formula, onClose }) => {
  const std = formula.standardWorkDays;
  const ratio = rec.work_days / std;
  const empName = rec.employee?.full_name || 'N/A';
  const empCode = rec.employee?.employee_code || '';
  const dept = rec.employee?.department?.name || '—';
  const position = rec.employee?.position || '—';

  const handlePrint = () => {
    const styleId = '__payslip_print_style__';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @media print {
        html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
        body * { visibility: hidden !important; }
        #payslip-printable, #payslip-printable * { visibility: visible !important; }
        #payslip-printable {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 14px 24px !important;
          background: white !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          z-index: 99999 !important;
        }
        #payslip-printable * {
          color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
      @page { size: A4 portrait; margin: 10mm; }
    `;
    setTimeout(() => {
      window.print();
      if (styleEl) styleEl.textContent = '';
    }, 200);
  };

  const handleExportExcel = () => {
    exportPaySlipToExcel(sheet, rec, formula);
  };

  return (
    <div id="payslip-overlay" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      {/* Action bar */}
      <div className="fixed top-0 left-0 right-0 z-60 flex items-center justify-between px-6 py-3 no-print"
        style={{ background: 'rgba(15,15,15,0.95)', borderBottom: '1px solid rgba(255,149,0,0.15)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-neutral-medium hover:text-white hover:bg-white/10 transition-all text-sm font-bold">
            ← Quay lại
          </button>
          <span className="text-white/40 text-xs">|</span>
          <span className="text-white font-bold text-sm">Phiếu lương — {empName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80"
            style={{ background: 'linear-gradient(135deg, #059669, #34D399)' }}>
            📥 Excel
          </button>
          <button onClick={handlePrint}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80"
            style={{ background: 'linear-gradient(135deg, #5E5CE6, #0A84FF)' }}>
            🖨️ In / PDF
          </button>
        </div>
      </div>

      {/* Printable pay slip */}
      <div id="payslip-printable" className="mt-16 mb-8 mx-4 w-full max-w-[660px]"
        style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          fontFamily: '"Montserrat", "Segoe UI", sans-serif',
          color: '#1a1a1a',
        }}>

        <div style={{ padding: '28px 36px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '4px' }}>
              <img src="https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/logo_td.png"
                alt="TD Games" style={{ width: '30px', height: '30px' }} />
              <span style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '0.08em', color: '#e67e00' }}>
                TD GAMES COMPANY LIMITED
              </span>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.1em', color: '#1a1a1a', margin: '8px 0 2px' }}>
              PHIẾU LƯƠNG
            </h1>
            <p style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>Tháng {sheet.month}/{sheet.year}</p>
          </div>

          {/* Employee info */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 20px',
            padding: '12px 16px', borderRadius: '8px', background: '#f8f8f8', marginBottom: '14px',
          }}>
            <InfoRow label="Mã nhân viên" value={empCode} />
            <InfoRow label="Phòng ban" value={dept} />
            <InfoRow label="Họ và tên" value={empName} />
            <InfoRow label="Chức vụ" value={position} />
            {rec.is_probation && (
              <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                <span style={{ background: '#FFF3E0', color: '#E65100', padding: '2px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.08em' }}>
                  ⭐ THỬ VIỆC – Không đóng BH, Thuế {(formula.probationPitRate * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {!rec.is_probation && rec.probation_ratio > 0 && rec.probation_ratio < 1 && (
              <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                <span style={{ background: '#FFEFD5', color: '#C2410C', padding: '2px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.08em' }}>
                  🔄 THÁNG CHUYỂN GIAO – {Math.round(rec.probation_ratio * 100)}% thử việc (10% thuế phẳng) + {Math.round((1 - rec.probation_ratio) * 100)}% chính thức (BHXH + thuế lũy tiến)
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, #FF9500, #FF6B00)', margin: '12px 0' }} />

          {/* Gross calculation */}
          <SectionTitle title="LƯƠNG THỰC TẾ" />
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
                <Th align="left">Khoản mục</Th>
                <Th align="right">Tham chiếu</Th>
                <Th align="right">Thực tế</Th>
              </tr>
            </thead>
            <tbody>
              <Tr label={`Ngày công (tỷ lệ: ${(ratio * 100).toFixed(2)}%)`} ref_val={`${std}`} actual={`${rec.work_days}`} />
              <Tr label="Lương cơ bản" ref_val={fmt(rec.base_salary)} actual={fmt(Math.round(rec.base_salary * ratio))} />
              <Tr label="Phụ cấp ăn trưa" ref_val={fmt(rec.lunch_allowance)} actual={fmt(Math.round(rec.lunch_allowance * ratio))} />
              <Tr label="PC xăng xe" ref_val={fmt(rec.transport_allowance)} actual={fmt(Math.round(rec.transport_allowance * ratio))} />
              <Tr label="PC điện thoại" ref_val={fmt(rec.phone_allowance)} actual={fmt(Math.round(rec.phone_allowance * ratio))} />
              <Tr label="PC trang phục" ref_val={fmt(rec.clothing_allowance)} actual={fmt(Math.round(rec.clothing_allowance * ratio))} />
              <Tr label="Phụ cấp KPI" ref_val={fmt(rec.kpi_allowance)} actual={fmt(Math.round(rec.kpi_allowance * ratio))} />
              <Tr label="Tăng ca mặc định" ref_val={fmt(rec.default_ot)} actual={fmt(Math.round(rec.default_ot * ratio))} />
              <Tr label={`Tăng ca phát sinh (${rec.extra_ot_hours}h)`} ref_val="—" actual={rec.extra_ot > 0 ? fmt(rec.extra_ot) : '0'} highlight />
              <TrBold label="GROSS THAM CHIẾU" value={fmt(rec.gross_ref)} />
              <TrBold label="GROSS THỰC TẾ" value={fmt(rec.gross_actual)} highlight />
            </tbody>
          </table>

          {/* Tax calculation */}
          <SectionTitle title={rec.is_probation ? 'THUẾ TNCN (THỬ VIỆC)' : 'BẢO HIỂM & THUẾ'} />
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
                <Th align="left">Khoản mục</Th>
                <Th align="right">Số tiền</Th>
              </tr>
            </thead>
            <tbody>
              {rec.is_probation ? (
                <>
                  <Tr2 label="BH nhân viên" value="0 (không đóng – thử việc)" color="#999" />
                  <Tr2 label="Thu nhập chịu thuế" value={fmt(rec.taxable_income)} />
                  <Tr2 label={`Thuế TNCN (${(formula.probationPitRate * 100).toFixed(0)}% cố định)`} value={rec.pit > 0 ? `-${fmt(rec.pit)}` : '0'} color="#d32f2f" />
                </>
              ) : (
                <>
                  <Tr2 label={`BH nhân viên (${(formula.bhEmployeeRate * 100).toFixed(2)}%)`} value={`-${fmt(rec.employee_bhxh)}`} color="#e65100" />
                  <Tr2 label="Thu nhập chịu thuế (CB + ĐT + KPI)" value={fmt(rec.taxable_income)} />
                  <Tr2 label="Giảm trừ bản thân" value={`-${fmt(formula.personalDeduction)}`} color="#888" />
                  <Tr2 label={`Giảm trừ NPT (${rec.dependents_count} người)`} value={`-${fmt(rec.dependents_count * formula.dependentDeduction)}`} color="#888" />
                  <Tr2 label="Thu nhập tính thuế" value={rec.assessable_income > 0 ? fmt(rec.assessable_income) : '0'} />
                  <Tr2 label="Thuế TNCN (lũy tiến)" value={rec.pit > 0 ? `-${fmt(rec.pit)}` : '0'} color={rec.pit > 0 ? '#d32f2f' : '#2e7d32'} />
                </>
              )}
            </tbody>
          </table>

          {/* Net */}
          <div style={{
            padding: '12px 18px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #059669, #34D399)',
            margin: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 900, color: 'white', letterSpacing: '0.06em' }}>NET THỰC LĨNH</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: 'white' }}>{fmt(rec.net_salary)} đ</span>
          </div>

          {/* Company cost */}
          <SectionTitle title="CHI PHÍ CÔNG TY" />
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <tbody>
              {rec.is_probation ? (
                <>
                  <Tr2 label="BH công ty" value="0 (không đóng – thử việc)" color="#999" />
                  <TrBold2 label="TỔNG CHI PHÍ CÔNG TY" value={fmt(rec.total_company_cost)} color="#1565c0" />
                </>
              ) : (
                <>
                  <Tr2 label={`BH công ty (${(formula.bhCompanyRate * 100).toFixed(2)}%)`} value={fmt(rec.company_bhxh)} color="#1565c0" />
                  <TrBold2 label="TỔNG CHI PHÍ CÔNG TY" value={fmt(rec.total_company_cost)} color="#1565c0" />
                </>
              )}
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px',
            textAlign: 'center', marginTop: '28px',
          }}>
            <SigBlock label="NGƯỜI NHẬN" />
            <SigBlock label="KẾ TOÁN" />
            <SigBlock label="GIÁM ĐỐC" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ──

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: '9px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a' }}>{value}</span>
  </div>
);

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <p style={{ fontSize: '9px', fontWeight: 900, color: '#FF9500', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px', marginTop: '6px' }}>
    {title}
  </p>
);

const Th: React.FC<{ children: React.ReactNode; align: 'left' | 'right' }> = ({ children, align }) => (
  <th style={{ padding: '5px 10px', textAlign: align, fontSize: '9px', fontWeight: 800, color: '#999', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
    {children}
  </th>
);

const Tr: React.FC<{ label: string; ref_val: string; actual: string; highlight?: boolean }> = ({ label, ref_val, actual, highlight }) => (
  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
    <td style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 500, color: '#333' }}>{label}</td>
    <td style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 500, color: '#888', textAlign: 'right' }}>{ref_val}</td>
    <td style={{ padding: '5px 10px', fontSize: '11px', textAlign: 'right', fontWeight: highlight ? 700 : 500, color: highlight ? '#FF9500' : '#333' }}>{actual}</td>
  </tr>
);

const TrBold: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <tr style={{ borderTop: '2px solid #e5e5e5' }}>
    <td colSpan={2} style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 900, color: '#1a1a1a' }}>{label}</td>
    <td style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 900, textAlign: 'right', color: highlight ? '#059669' : '#1a1a1a' }}>{value}</td>
  </tr>
);

const Tr2: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
    <td style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 500, color: '#333' }}>{label}</td>
    <td style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: color || '#333', textAlign: 'right' }}>{value}</td>
  </tr>
);

const TrBold2: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <tr style={{ borderTop: '2px solid #e5e5e5' }}>
    <td style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 900, color: '#1a1a1a' }}>{label}</td>
    <td style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 900, color: color || '#1a1a1a', textAlign: 'right' }}>{value}</td>
  </tr>
);

const SigBlock: React.FC<{ label: string }> = ({ label }) => (
  <div>
    <p style={{ fontSize: '10px', fontWeight: 700, color: '#333', marginBottom: '48px' }}>{label}</p>
    <p style={{ fontSize: '9px', color: '#999' }}>(Ký, ghi rõ họ tên)</p>
  </div>
);

export default PaySlip;
