import React, { useEffect } from 'react';
import { HrEmployee, HrParkingRegistration } from '@/types';

interface Props {
  employee: HrEmployee;
  registration: HrParkingRegistration;
  onClose: () => void;
}

const VEHICLE_LABELS: Record<string, string> = {
  motorcycle: 'Xe máy',
  car: 'Ô tô',
  bicycle: 'Xe đạp',
  electric_bike: 'Xe máy điện',
  other: 'Khác',
};

const ParkingFormPrint: React.FC<Props> = ({ employee, registration, onClose }) => {
  const fmtDate = (d: string | null) => {
    if (!d) return '....... / ....... / .........';
    const [y, m, day] = d.slice(0, 10).split('-');
    return `${day} / ${m} / ${y}`;
  };

  useEffect(() => {
    const id = '__hr_parking_print__';
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
        #hr-parking-print-root, #hr-parking-print-root * { visibility: visible !important; }
        #hr-parking-print-root {
          position: fixed !important; left: 0; top: 0; width: 100%;
          padding: 12mm 16mm !important; background: white !important;
          font-family: 'Times New Roman', Times, serif !important;
          font-size: 12pt !important; color: #000 !important;
        }
      }
      @page { size: A4 portrait; margin: 12mm 16mm; }
    `;
    return () => { if (el) el.textContent = ''; };
  }, []);

  const cell: React.CSSProperties = { border: '1px solid #000', padding: '6px 8px', verticalAlign: 'top' };
  const cellC: React.CSSProperties = { ...cell, textAlign: 'center' };
  const th: React.CSSProperties = { ...cellC, fontWeight: 700 };

  const TERMS = [
    'Địa điểm trông giữ xe máy tại tầng 2 nhà xe sát dành cho nhân viên, khách hàng TTTM V+ (phía sau toà nhà). Chỗ để xe chỉ sử dụng cho nhân viên của Công ty thuê văn phòng tại Trung tâm thương mại V+ và ký vào bản đăng ký này, nhận thẻ gửi xe tại văn phòng Ban quản lý (tầng 2).',
    'Phí gửi xe phải được thanh toán đúng hạn theo quy định khi BQL gửi thông báo/hóa đơn.',
    'Thẻ gửi xe không được phép chuyển nhượng. Mỗi thẻ gửi xe sẽ được đăng ký riêng trên hệ thống quản lý đỗ xe của tòa nhà và chỉ được sử dụng hợp lệ ra/vào cho đúng xe đã đăng ký.',
    'Chủ xe tự chịu trách nhiệm về tài sản trong xe.',
    'Tất cả các xe đều phải đỗ trong phạm vi ranh giới của khu vực quy định. Không đỗ xe trước sảnh ảnh hưởng lối đi.',
    'Ban quản lý không chịu trách nhiệm cho bất kỳ tổn thất nào nếu xảy ra mất xe, thiệt hại, mất mát đồ trong xe khi chủ xe đỗ không đúng quy định.',
    'Nghiêm cấm mang các chất gây nghiện, chất gây cháy nổ vào tòa nhà. Không hút thuốc và sử dụng chất cấm tại khu vực đỗ xe của tòa nhà.',
    'Tốc độ giới hạn lái xe trong tầng hầm không vượt quá 5km/h.',
    'Thời gian đỗ trong giờ làm việc là từ 7h00 - 21h30 đối với xe máy.',
  ];

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

        {/* preview */}
        <div className="overflow-auto p-4 bg-neutral-200">
          <div
            id="hr-parking-print-root"
            style={{
              background: 'white',
              color: '#000',
              padding: '24px 32px',
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: 12,
              lineHeight: 1.55,
              minWidth: 640,
            }}
          >
            {/* ── Header ── */}
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
              TRUNG TÂM THƯƠNG MẠI V+<br />
              505 MINH KHAI, VĨNH TUY, HÀ NỘI
            </p>
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, margin: '10px 0 4px', textTransform: 'uppercase' }}>
              Đăng ký sử dụng dịch vụ gửi xe máy TTTM V+
            </p>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ display: 'inline-block', width: 260, borderBottom: '1px solid #000' }} />
            </div>

            {/* ── Thông tin chủ phương tiện ── */}
            <p style={{ fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Thông tin chủ phương tiện</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 12 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 0', width: '38%' }}>
                    Họ và tên:<span style={{ marginLeft: 8, borderBottom: '1px dotted #000', display: 'inline-block', width: 180 }}>
                      {'  '}Nguyễn Thị Thùy Dung
                    </span>
                  </td>
                  <td style={{ padding: '4px 0' }}>
                    Tên Công ty:<span style={{ marginLeft: 8, borderBottom: '1px dotted #000', display: 'inline-block', width: 180 }}>
                      {'  '}TD CONSULTING
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0' }}>
                    Tên chủ phương tiện:
                    <span style={{ marginLeft: 8, borderBottom: '1px dotted #000', display: 'inline-block', width: 140 }}>
                      {'  '}{employee.full_name}
                    </span>
                  </td>
                  <td style={{ padding: '4px 0' }}>
                    Số điện thoại:
                    <span style={{ marginLeft: 8, borderBottom: '1px dotted #000', display: 'inline-block', width: 180 }}>
                      {'  '}{employee.phone || ''}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── Bảng xe ── */}
            <p style={{ fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Thông tin dịch vụ đăng ký</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36 }}>STT</th>
                  <th style={th}>Họ và tên</th>
                  <th style={th}>Nhãn hiệu xe</th>
                  <th style={th}>Biển kiểm soát</th>
                  <th style={th}>Loại phương tiện</th>
                  <th style={{ ...th, width: 64 }}>Số thẻ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={cellC}>1</td>
                  <td style={cell}>{employee.full_name}</td>
                  <td style={cell}>{registration.vehicle_brand || ''}</td>
                  <td style={{ ...cellC, fontWeight: 700 }}>{registration.license_plate}</td>
                  <td style={cellC}>{VEHICLE_LABELS[registration.vehicle_type] || registration.vehicle_type}</td>
                  <td style={cell}>{registration.card_number || ''}</td>
                </tr>
                <tr>
                  <td style={cellC}>&nbsp;</td>
                  <td style={cell}>&nbsp;</td>
                  <td style={cell}>&nbsp;</td>
                  <td style={cell}>&nbsp;</td>
                  <td style={cell}>&nbsp;</td>
                  <td style={cell}>&nbsp;</td>
                </tr>
              </tbody>
            </table>

            <p style={{ marginBottom: 14 }}>
              Sử dụng dịch vụ gửi xe từ ngày{' '}
              <strong>{fmtDate(registration.registered_at)}</strong>
            </p>

            {/* ── Điều khoản ── */}
            <p style={{ fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Điều khoản dịch vụ</p>
            <ol style={{ paddingLeft: 20, marginBottom: 16, fontSize: 11 }}>
              {TERMS.map((t, i) => (
                <li key={i} style={{ marginBottom: 3 }}>{t}</li>
              ))}
            </ol>

            {/* ── Hủy thẻ xe ── */}
            <p style={{ fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Đăng ký hủy thẻ xe</p>
            <p style={{ fontSize: 11, marginBottom: 20 }}>
              Quý khách hàng huỷ vé xe theo mẫu của Ban quản lý Trung tâm thương mại V+ đồng thời gửi lại
              thẻ xe cho Ban quản lý. Lưu ý: Trong trường hợp thẻ cong, hỏng, bong tróc, mờ chữ Ban quản
              lý Trung tâm thương mại V+ sẽ không nhận lại thẻ.
            </p>

            {/* ── Signatures ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                <tr>
                  <td style={{ width: '33%', textAlign: 'center', verticalAlign: 'top' }}>
                    <p style={{ fontWeight: 700 }}>Người đăng ký</p>
                    <p style={{ fontStyle: 'italic', fontSize: 10 }}>(Ký, ghi rõ họ tên và đóng dấu công ty)</p>
                    <p style={{ marginTop: 60 }}>&nbsp;</p>
                  </td>
                  <td style={{ width: '33%', textAlign: 'center', verticalAlign: 'top' }}>
                    <p style={{ fontWeight: 700 }}>Người nhận đăng ký</p>
                    <p style={{ fontStyle: 'italic', fontSize: 10 }}>(Ký và ghi rõ họ tên)</p>
                    <p style={{ marginTop: 60 }}>&nbsp;</p>
                  </td>
                  <td style={{ width: '33%', textAlign: 'center', verticalAlign: 'top' }}>
                    <p style={{ fontWeight: 700 }}>Đại diện BQL phê duyệt</p>
                    <p style={{ fontStyle: 'italic', fontSize: 10 }}>(Ký và ghi rõ họ tên)</p>
                    <p style={{ marginTop: 60 }}>&nbsp;</p>
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

export default ParkingFormPrint;
