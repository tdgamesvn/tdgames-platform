import React, { useEffect } from 'react';
import { HrEmployee, HrDepartment, HrEquipmentHandover } from '@/types';

interface Props {
  employee: HrEmployee;
  department: HrDepartment | undefined;
  handover: HrEquipmentHandover;
  companyName?: string;
  onClose: () => void;
}

/** Mẫu biên bản tham khảo thông lệ: Công ty — Bên giao / Bên nhận — danh mục — cam kết — chữ ký. */
const EquipmentHandoverPrint: React.FC<Props> = ({
  employee,
  department,
  handover,
  companyName = 'CÔNG TY TNHH TƯ VẤN TD (TD CONSULTING COMPANY LIMITED)',
  onClose,
}) => {
  const items = handover.items || [];
  const fmtDate = (d: string) => {
    try {
      const [y, m, day] = d.slice(0, 10).split('-');
      return `${day}/${m}/${y}`;
    } catch {
      return d;
    }
  };

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
          padding: 12mm 16mm !important; background: white !important;
          font-family: 'Times New Roman', Times, serif !important;
          color: #000 !important;
        }
      }
      @page { size: A4 portrait; margin: 12mm; }
    `;
    return () => {
      if (el) el.textContent = '';
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

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
        <div className="flex justify-end gap-2 p-3 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
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
          Sau khi ký xong, quay lại tab <strong className="text-neutral-300">Thiết bị</strong> của nhân viên này và{' '}
          <strong className="text-neutral-300">upload PDF đã ký</strong> vào đúng biên bản để lưu hồ sơ.
        </p>
        <div className="overflow-auto p-4 bg-neutral-200">
          <div
            id="hr-handover-print-root"
            style={{
              background: 'white',
              color: '#111',
              padding: '28px 32px',
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{companyName}</p>
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, margin: '12px 0 8px', textTransform: 'uppercase' }}>
              Biên bản bàn giao tài sản, công cụ, dụng cụ làm việc
            </p>
            <p style={{ textAlign: 'center', fontSize: 13, marginBottom: 20 }}>
              Số: <strong>{handover.handover_number || '…'}</strong> &nbsp;|&nbsp; Ngày lập:{' '}
              <strong>{fmtDate(handover.handover_date)}</strong>
            </p>

            <p style={{ marginBottom: 10 }}>
              Căn cứ nhu cầu làm việc tại đơn vị, hôm nay <strong>{fmtDate(handover.handover_date)}</strong>, tại{' '}
              <strong>{handover.location || '…'}</strong>, chúng tôi gồm:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 8px', border: '1px solid #333', width: '22%' }}><strong>Bên giao</strong></td>
                  <td style={{ padding: '6px 8px', border: '1px solid #333' }}>{handover.giver_name || '…………………………'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 8px', border: '1px solid #333' }}><strong>Bên nhận</strong></td>
                  <td style={{ padding: '6px 8px', border: '1px solid #333' }}>
                    Ông/Bà: <strong>{employee.full_name}</strong>
                    {employee.employee_code ? ` — Mã NV: ${employee.employee_code}` : ''}
                    {department?.name ? ` — Phòng: ${department.name}` : ''}
                    {employee.position ? ` — Chức danh: ${employee.position}` : ''}
                  </td>
                </tr>
              </tbody>
            </table>

            <p style={{ marginBottom: 8, fontWeight: 700 }}>Đã bàn giao các tài sản / công cụ / dụng cụ sau:</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #333', padding: 6, width: 36 }}>STT</th>
                  <th style={{ border: '1px solid #333', padding: 6 }}>Tên tài sản / dụng cụ</th>
                  <th style={{ border: '1px solid #333', padding: 6, width: 52 }}>SL</th>
                  <th style={{ border: '1px solid #333', padding: 6, width: 44 }}>ĐVT</th>
                  <th style={{ border: '1px solid #333', padding: 6 }}>Số seri / Mã</th>
                  <th style={{ border: '1px solid #333', padding: 6 }}>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ border: '1px solid #333', padding: 8, textAlign: 'center' }}>
                      (Chưa có danh mục)
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td style={{ border: '1px solid #333', padding: 6, textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #333', padding: 6 }}>
                        <strong>{it.name}</strong>
                        {it.description ? <span><br /><span style={{ fontSize: 11 }}>{it.description}</span></span> : null}
                      </td>
                      <td style={{ border: '1px solid #333', padding: 6, textAlign: 'right' }}>{it.quantity}</td>
                      <td style={{ border: '1px solid #333', padding: 6 }}>{it.unit}</td>
                      <td style={{ border: '1px solid #333', padding: 6 }}>{it.serial_number || '—'}</td>
                      <td style={{ border: '1px solid #333', padding: 6 }}>{it.condition_notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <p style={{ marginBottom: 10, fontSize: 13 }}>
              Bên nhận cam kết sử dụng đúng mục đích, bảo quản và chịu trách nhiệm về tài sản đã nhận; hoàn trả hoặc bồi
              thường theo quy định của Công ty khi thất thoát, hư hỏng do lỗi chủ quan.
            </p>
            {handover.notes ? (
              <p style={{ marginBottom: 10, fontSize: 12, fontStyle: 'italic' }}>Ghi chú: {handover.notes}</p>
            ) : null}
            {handover.receiver_ack ? (
              <p style={{ marginBottom: 14, fontSize: 12 }}>Xác nhận bên nhận: {handover.receiver_ack}</p>
            ) : null}

            <p style={{ marginBottom: 28, fontSize: 12 }}>
              Biên bản được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: 16 }}>
                    <p style={{ fontWeight: 700, marginBottom: 56 }}>Đại diện bên giao</p>
                    <p style={{ fontStyle: 'italic', fontSize: 11 }}>(Ký và ghi rõ họ tên)</p>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: 16 }}>
                    <p style={{ fontWeight: 700, marginBottom: 56 }}>Bên nhận</p>
                    <p style={{ fontStyle: 'italic', fontSize: 11 }}>(Ký và ghi rõ họ tên)</p>
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
