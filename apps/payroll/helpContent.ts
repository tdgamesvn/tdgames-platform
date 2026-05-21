import type { HelpContent } from '@/components/HelpPanel';

export const PAYROLL_HELP: HelpContent[] = [
  {
    tabId: 'history',
    tabLabel: 'Bảng lương',
    icon: '💰',
    summary:
      'Danh sách tất cả bảng lương theo tháng. Tạo bảng lương mới, mở để nhập chi tiết lương từng nhân viên, xác nhận và đánh dấu đã trả.',
    sections: [
      {
        title: 'Quy trình bảng lương',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Tạo bảng lương</strong>, chọn tháng và năm rồi nhấn <strong>Tạo & tính lương</strong>.',
          'Hệ thống tự tính lương cơ bản từ dữ liệu nhân sự. Nhấn vào bảng để mở chi tiết.',
          'Kiểm tra và điều chỉnh từng dòng: phụ cấp, khấu trừ, thưởng, ngày công thực tế.',
          'Nhấn <strong>Xác nhận</strong> để chuyển bảng lương sang trạng thái <em>Đã xác nhận</em>.',
          'Sau khi chi trả, nhấn <strong>Đã trả</strong> để hoàn tất. Dữ liệu đưa vào báo cáo TNCN.',
        ],
      },
      {
        title: 'Trạng thái bảng lương',
        type: 'info',
        items: [
          '<strong>Nháp</strong> (Draft) — Đang soạn thảo, chưa xác nhận. Có thể sửa tự do.',
          '<strong>Đã xác nhận</strong> — Đã khoá số liệu. Cần Rollback nếu muốn sửa lại.',
          '<strong>Đã trả</strong> — Lương đã được chi trả. Dùng để tính TNCN quyết toán.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Chỉ bảng lương <em>Đã xác nhận</em> hoặc <em>Đã trả</em> mới xuất hiện trong báo cáo TNCN (app Kế toán).',
          'Nhấn <strong>Rollback</strong> để đưa bảng lương từ Đã xác nhận về Nháp nếu cần sửa.',
          'Xoá bảng lương chỉ khả dụng khi còn ở trạng thái <em>Nháp</em>.',
        ],
      },
    ],
  },
  {
    tabId: 'formula',
    tabLabel: 'Công thức',
    icon: '🧮',
    summary:
      'Cấu hình công thức tính lương — định nghĩa các thành phần lương, phụ cấp, khấu trừ và thuế TNCN áp dụng cho toàn bộ nhân viên.',
    sections: [
      {
        title: 'Các thành phần công thức',
        type: 'info',
        items: [
          '<strong>Lương cơ bản</strong> — Mức lương tháng ghi trong hợp đồng.',
          '<strong>Phụ cấp</strong> — Phụ cấp ăn trưa, xăng xe, điện thoại, nhà ở... (có thể chịu thuế hoặc không).',
          '<strong>Khấu trừ</strong> — BHXH, BHYT, BHTN (phần nhân viên đóng).',
          '<strong>Thuế TNCN</strong> — Tính theo biểu luỹ tiến 7 bậc của Việt Nam.',
          '<strong>Thực nhận</strong> = Lương cơ bản + Phụ cấp − Khấu trừ − TNCN.',
        ],
      },
      {
        title: 'Lưu ý khi chỉnh công thức',
        type: 'warning',
        items: [
          'Thay đổi công thức sẽ ảnh hưởng đến <strong>bảng lương tạo mới</strong> — không ảnh hưởng bảng đã xác nhận.',
          'Kiểm tra kỹ tỷ lệ BHXH/BHYT/BHTN trước khi lưu vì ảnh hưởng đến nhiều nhân viên.',
          'Nên tạo bảng lương thử nghiệm tháng mới sau khi thay đổi công thức để kiểm tra kết quả.',
        ],
      },
    ],
  },
];
