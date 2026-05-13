import React, { useEffect } from 'react';
import { HrEmployee, HrDepartment, HrEquipmentHandover } from '@/types';

interface Props {
  employee: HrEmployee;
  department: HrDepartment | undefined;
  handover: HrEquipmentHandover;
  companyName?: string;
  companyAddress?: string;
  onClose: () => void;
}

const EquipmentHandoverPrint: React.FC<Props> = ({
  employee,
  department,
  handover,
  companyName = 'TD GAMES STUDIO',
  companyAddress = '',
  onClose,
}) => {
  const items = handover.items || [];

  const fmtDate = (d: string) => {
    try {
      const [y, m, day] = d.slice(0, 10).split('-');
      return { day, m, y };
    } catch {
      return { day: '...', m: '...', y: '......' };
    }
  };

  const { day, m, y } = fmtDate(handover.handover_date);

  useEffect(() => {
    const id = '__hr_handover_print__';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `
      @media print {
        html, body { background: white !important; margin: 0 !important; }
        body * { visibility: hidden !important; }
        #hr-handover-print-root, #hr-handover-print-root * { visibility: visible !important; }
        #hr-handover-print-root {
          position: fixed !important; left: 0; top: 0; width: 100%;
          padding: 15mm 20mm !important; background: white !important;
          font-family: 'Times New Roman', Times, serif !important;
          font-size: 13pt !important;
          color: #000 !important;
        }
      }
      @page { size: A4 portrait; margin: 15mm 20mm; }
    `;
    return () => { if (el) el.textContent = ''; };
  }, []);

  const cell: React.CSSProperties = { border: '1px solid #000', padding: '6px 8px', verticalAlign: 'top' };
  const cellC: React.CSSProperties = { ...cell, textAlign: 'center' };
  const th: React.CSSProperties = { ...cellC, fontWeight: 700 };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full max-h-[90vh] overflow-auto rounded-2xl shadow-2xl flex flex-col"
        style={{ background: '#1a1a1a' }}
        onClick={e => e.stopPropagation()}
      >
        {/* toolbar */}
        <div className="flex justify-end gap-2 p-3 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-white"
            style={{ background: 'linear-gradient(135deg, #34C759, #30D158)' }}
          >
            🖨️ In / PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase border border-white/20 text-neutral-300"
          >
            Đóng
          </button>
        </div>
        <p className="text-[11px] text-neutral-400 px-4 py-2 border-b border-white/10 shrink-0 leading-relaxed">
          Sau khi ký xong, quay lại tab <strong className="text-neutral-300">Bàn giao dụng cụ</strong> và{' '}
          <strong className="text-neutral-300">upload PDF đã ký</strong> vào đúng biên bản để lưu hồ sơ.
        </p>

        {/* preview */}
        <div className="overflow-auto p-4 bg-neutral-200">
          <div
            id="hr-handover-print-root"
            style={{
              background: 'white',
              color: '#000',
              padding: '28px 36px',
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: 13,
              lineHeight: 1.6,
              minWidth: 640,
            }}
          >
            {/* ── State header ── */}
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <p style={{ fontWeight: 700, fontSize: 13 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p style={{ fontWeight: 700, fontSize: 13 }}>Độc lập - Tự do - Hạnh phúc</p>
              <p style={{ margin: '2px auto 0', width: 220, borderBottom: '1px solid #000' }} />
            </div>

            {/* ── Title ── */}
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, margin: '16px 0 4px', textTransform: 'uppercase' }}>
              Biên bản bàn giao máy móc, thiết bị
            </p>
            {handover.handover_number && (
              <p style={{ textAlign: 'center', fontSize: 12, marginBottom: 4 }}>
                Số: {handover.handover_number}
              </p>
            )}

            {/* ── Opening paragraph ── */}
            <p style={{ marginTop: 14, marginBottom: 6, textAlign: 'justify' }}>
              Hôm nay, ngày{' '}
              <span style={{ fontWeight: 700 }}>{day}</span> tháng{' '}
              <span style={{ fontWeight: 700 }}>{m}</span> năm{' '}
              <span style={{ fontWeight: 700 }}>{y}</span>, tại{' '}
              <span style={{ fontWeight: 700 }}>{handover.location || '………………………………………………'}</span>, chúng tôi gồm:
            </p>

            {/* ── Bên A (Bên giao) ── */}
            <p style={{ fontWeight: 700, marginBottom: 2 }}>BÊN GIAO (Bên A): {companyName}</p>
            <p style={{ marginBottom: 2 }}>
              Địa chỉ: {companyAddress || '…………………………………………………………………………………………………'}
            </p>
            <p style={{ marginBottom: 12 }}>
              Đại diện: {handover.giver_name || '…………………………………………………………………………………………'}
            </p>

            {/* ── Bên B (Bên nhận) ── */}
            <p style={{ fontWeight: 700, marginBottom: 2 }}>BÊN NHẬN (Bên B):</p>
            <p style={{ marginBottom: 2 }}>
              Địa chỉ:{' '}
              {department?.name
                ? `Phòng / Ban: ${department.name}`
                : '…………………………………………………………………………………………………'}
            </p>
            <p style={{ marginBottom: 14 }}>
              Đại diện: Ông/Bà{' '}
              <strong>{employee.full_name}</strong>
              {employee.employee_code ? ` — Mã NV: ${employee.employee_code}` : ''}
              {employee.position ? ` — Chức danh: ${employee.position}` : ''}
            </p>

            {/* ── Equipment table ── */}
            <p style={{ marginBottom: 6 }}>
              Hai bên tiến hành bàn giao các máy móc, thiết bị sau:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36 }}>STT</th>
                  <th style={{ ...th }}>Tên thiết bị</th>
                  <th style={{ ...th }}>Thông số kỹ thuật,<br />Mã thiết bị</th>
                  <th style={{ ...th, width: 72 }}>Số lượng</th>
                  <th style={{ ...th }}>Hiện trạng</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <>
                    {[1, 2, 3].map(n => (
                      <tr key={n}>
                        <td style={cellC}>{n}.</td>
                        <td style={cell}>&nbsp;</td>
                        <td style={cell}>&nbsp;</td>
                        <td style={cellC}>&nbsp;</td>
                        <td style={cell}>&nbsp;</td>
                      </tr>
                    ))}
                  </>
                ) : (
                  items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td style={cellC}>{idx + 1}.</td>
                      <td style={cell}>
                        <strong>{it.name}</strong>
                        {it.unit && it.unit !== 'cái' ? (
                          <span style={{ fontSize: 11, color: '#444' }}> ({it.unit})</span>
                        ) : null}
                      </td>
                      <td style={cell}>
                        {[it.description, it.serial_number].filter(Boolean).join(' / ') || ''}
                      </td>
                      <td style={cellC}>{it.quantity}</td>
                      <td style={cell}>{it.condition_notes || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* ── Closing ── */}
            <p style={{ textAlign: 'justify', marginBottom: 6 }}>
              Biên bản này làm thành cơ sở để hai bên thực hiện bàn giao tài sản, thiết bị.
              {handover.notes ? ` ${handover.notes}` : ''}
            </p>
            <p style={{ textAlign: 'justify', marginBottom: 24 }}>
              Hai bên thống nhất lập Biên bản bàn giao theo những nội dung như trên và Biên bản Bàn giao
              được lập thành 02 bản giống nhau, mỗi bên giữ một bản có giá trị tương đương nhau.
            </p>
            {handover.receiver_ack ? (
              <p style={{ fontStyle: 'italic', fontSize: 12, marginBottom: 16 }}>
                Xác nhận bên nhận: {handover.receiver_ack}
              </p>
            ) : null}

            {/* ── Signatures ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', paddingRight: 8 }}>
                    <p style={{ fontWeight: 700 }}>Đại diện bên giao</p>
                    <p style={{ fontStyle: 'italic', fontSize: 12, marginBottom: 64 }}>(Ký, ghi rõ họ và tên)</p>
                    <p>&nbsp;</p>
                  </td>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', paddingLeft: 8 }}>
                    <p style={{ fontWeight: 700 }}>Đại diện bên nhận</p>
                    <p style={{ fontStyle: 'italic', fontSize: 12, marginBottom: 64 }}>(Ký, ghi rõ họ và tên)</p>
                    <p>&nbsp;</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EquipmentHandoverPrint;
