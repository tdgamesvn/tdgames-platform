import type { HelpContent } from '@/components/HelpPanel';

export const ATTENDANCE_HELP: HelpContent[] = [
  {
    tabId: 'dashboard',
    tabLabel: 'Dashboard',
    icon: '📊',
    summary:
      'Tổng quan chấm công tháng hiện tại — số ngày làm việc, đi muộn, vắng mặt và tình trạng nghỉ phép của toàn bộ nhân viên.',
    sections: [
      {
        title: 'Các chỉ số chính',
        type: 'info',
        items: [
          '<strong>Tổng ngày công</strong> — Số ngày làm việc thực tế trong tháng.',
          '<strong>Đi muộn / Về sớm</strong> — Số lượt vi phạm giờ giấc trong kỳ.',
          '<strong>Vắng mặt</strong> — Ngày không có dữ liệu chấm công và chưa có phép.',
          '<strong>Nghỉ phép</strong> — Tổng ngày nghỉ phép đã được duyệt trong tháng.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Dashboard tổng hợp theo tháng hiện tại — chuyển sang tab <strong>Bảng công</strong> để xem từng ngày.',
          'Dữ liệu chấm công lấy từ máy chấm công hoặc nhập thủ công trong tab Bảng công.',
        ],
      },
    ],
  },
  {
    tabId: 'history',
    tabLabel: 'Bảng công',
    icon: '📅',
    summary:
      'Bảng chấm công chi tiết từng ngày — xem giờ vào/ra, tính số giờ làm việc, ghi nhận đi muộn và tổng hợp theo nhân viên.',
    sections: [
      {
        title: 'Xem và nhập bảng công',
        type: 'steps',
        items: [
          'Chọn <strong>Tháng / Năm</strong> cần xem ở bộ lọc phía trên.',
          'Chọn nhân viên từ danh sách để xem bảng công cá nhân.',
          'Nhấn vào ô ngày bất kỳ để nhập hoặc sửa giờ vào/ra thủ công.',
          'Hệ thống tự tính <strong>số giờ làm</strong> và đánh dấu đi muộn/về sớm theo ca.',
        ],
      },
      {
        title: 'Các loại ngày',
        type: 'info',
        items: [
          '<strong>Làm việc</strong> — Có chấm công vào/ra đầy đủ.',
          '<strong>Đi muộn / Về sớm</strong> — Vào sau hoặc ra trước giờ ca quy định.',
          '<strong>Nghỉ phép</strong> — Đã được duyệt phép, không tính vắng mặt.',
          '<strong>Vắng</strong> — Không có chấm công, không có phép được duyệt.',
          '<strong>Ngày lễ / Cuối tuần</strong> — Theo lịch nghỉ lễ quốc gia.',
        ],
      },
    ],
  },
  {
    tabId: 'activity',
    tabLabel: 'Ca làm việc',
    icon: '🕐',
    summary:
      'Quản lý các ca làm việc — định nghĩa giờ bắt đầu, kết thúc và thời gian linh hoạt để hệ thống tính chấm công chính xác.',
    sections: [
      {
        title: 'Tạo ca làm việc',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Thêm ca</strong>, điền tên ca và giờ bắt đầu/kết thúc.',
          'Đặt <strong>Biên độ linh hoạt</strong> (phút) — vào trễ trong biên độ này không bị đánh dấu muộn.',
          'Chọn các <strong>ngày trong tuần</strong> áp dụng ca này.',
          'Gán ca cho nhân viên trong hồ sơ nhân sự (tab HR).',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Mỗi nhân viên chỉ thuộc một ca tại một thời điểm.',
          'Thay đổi ca sẽ áp dụng từ ngày được chỉ định, không ảnh hưởng bảng công đã chốt.',
          'Ca <strong>Linh hoạt</strong> không tính đi muộn — phù hợp cho vị trí remote/quản lý.',
        ],
      },
    ],
  },
  {
    tabId: 'recurring',
    tabLabel: 'Báo cáo',
    icon: '📈',
    summary:
      'Báo cáo chấm công tổng hợp — tỷ lệ đi làm, vắng mặt và đi muộn theo từng nhân viên và phòng ban. Xuất CSV để nộp hoặc làm căn cứ tính lương.',
    sections: [
      {
        title: 'Loại báo cáo',
        type: 'info',
        items: [
          '<strong>Theo nhân viên</strong> — Tổng ngày công, ngày vắng, ngày muộn trong kỳ.',
          '<strong>Theo phòng ban</strong> — So sánh tỷ lệ chuyên cần giữa các phòng.',
          '<strong>Chi tiết ngày</strong> — Danh sách từng lượt chấm công kèm giờ vào/ra.',
        ],
      },
      {
        title: 'Xuất báo cáo',
        type: 'steps',
        items: [
          'Chọn khoảng thời gian và phòng ban cần báo cáo.',
          'Nhấn <strong>⬇ Xuất CSV</strong> để tải file về.',
          'File CSV dùng làm căn cứ tính lương trong Payroll hoặc lưu trữ theo tháng.',
        ],
      },
    ],
  },
  {
    tabId: 'tasks',
    tabLabel: 'Nghỉ phép',
    icon: '🌴',
    summary:
      'Quản lý đơn nghỉ phép — nhân viên gửi đơn, quản lý duyệt/từ chối. Hệ thống tự cập nhật số ngày phép còn lại và bảng công.',
    sections: [
      {
        title: 'Gửi đơn nghỉ phép',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Tạo đơn nghỉ</strong>, chọn loại phép và khoảng ngày.',
          'Điền lý do và nhấn <strong>Gửi đơn</strong> — đơn chuyển sang trạng thái <em>Chờ duyệt</em>.',
          'Sau khi admin duyệt, ngày nghỉ tự động ghi vào bảng công.',
        ],
      },
      {
        title: 'Duyệt đơn (Admin)',
        type: 'info',
        items: [
          'Admin thấy toàn bộ đơn nghỉ của tất cả nhân viên.',
          'Nhấn <strong>Duyệt</strong> để chấp thuận hoặc <strong>Từ chối</strong> kèm lý do.',
          'Đơn đã duyệt không thể thu hồi — nhân viên cần tạo đơn mới nếu thay đổi.',
        ],
      },
      {
        title: 'Loại phép',
        type: 'tips',
        items: [
          '<strong>Phép năm</strong> — 1 ngày/tháng chính thức, cộng dồn, hết năm không dùng hết bị reset.',
          '<strong>Nghỉ không lương</strong> — Không trừ phép năm nhưng trừ lương ngày tương ứng.',
          '<strong>🎂 Nghỉ sinh nhật</strong> — Chính thức đủ 6 tháng, 1 ngày/năm, có lương.',
          '<strong>🏠 Làm remote</strong> — 1 ngày/tuần, chỉ áp dụng sau khi chính thức.',
          '<strong>🎊 Hiếu hỉ</strong> — Chính thức đủ 1 năm, tối đa 3 ngày/lần, theo Điều 115 BLLĐ, không trừ phép năm.',
        ],
      },
    ],
  },
];
