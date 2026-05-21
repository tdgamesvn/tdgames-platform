import type { HelpContent } from '@/components/HelpPanel';

export const HR_HELP: HelpContent[] = [
  {
    tabId: 'history',
    tabLabel: 'Nhân sự',
    icon: '👥',
    summary:
      'Danh sách toàn bộ nhân viên trong công ty. Lọc theo phòng ban, loại hợp đồng và trạng thái. Xem hồ sơ chi tiết hoặc chỉnh sửa thông tin trực tiếp từ đây.',
    sections: [
      {
        title: 'Tìm kiếm & lọc',
        type: 'info',
        items: [
          'Gõ tên hoặc mã nhân viên vào ô tìm kiếm để lọc nhanh.',
          '<strong>Loại hợp đồng</strong>: Full-time, Part-time, Freelancer, Thực tập sinh.',
          '<strong>Trạng thái</strong>: Đang làm, Đã nghỉ — mặc định chỉ hiển thị nhân viên đang làm.',
          '<strong>Phòng ban</strong>: Lọc theo từng phòng ban hoặc xem toàn bộ.',
        ],
      },
      {
        title: 'Các thao tác nhanh',
        type: 'steps',
        items: [
          'Nhấn <strong>Xem</strong> (👁) để mở hồ sơ chi tiết nhân viên.',
          'Nhấn <strong>Sửa</strong> (✏️) để chỉnh sửa thông tin.',
          'Nhấn <strong>+ Thêm nhân viên</strong> để mở form đầy đủ.',
          'Nhấn <strong>+ Nhanh</strong> để thêm nhân viên với thông tin tối thiểu.',
          'Nhấn <strong>Sync Workforce</strong> để đồng bộ danh sách lên Workforce app.',
        ],
      },
      {
        title: 'Nhắc việc sắp hết hạn',
        type: 'warning',
        items: [
          'Badge đỏ trên nút <strong>Nhắc việc</strong> cho biết số lượng nhắc việc đang chờ xử lý.',
          'Bao gồm: hợp đồng sắp hết hạn, thử việc sắp kết thúc, sinh nhật trong tháng.',
          'Vào tab <strong>Nhắc việc</strong> để xem chi tiết và dismiss từng mục.',
        ],
      },
    ],
  },
  {
    tabId: 'edit',
    tabLabel: 'Thêm/Sửa',
    icon: '✏️',
    summary:
      'Form nhập thông tin nhân viên đầy đủ — thông tin cá nhân, hợp đồng, lương, thiết bị bàn giao và tài liệu nội bộ. Dùng khi cần nhập chi tiết ngay từ đầu.',
    sections: [
      {
        title: 'Các nhóm thông tin',
        type: 'info',
        items: [
          '<strong>Thông tin cơ bản</strong>: họ tên, ngày sinh, CCCD, địa chỉ, email, điện thoại.',
          '<strong>Công việc</strong>: phòng ban, chức danh, ngày vào làm, loại hợp đồng.',
          '<strong>Lương & ngân hàng</strong>: mức lương, tài khoản nhận lương.',
          '<strong>Hợp đồng</strong>: tải lên/quản lý các phiên bản hợp đồng đã ký.',
          '<strong>Thiết bị bàn giao</strong>: máy tính, màn hình, phụ kiện được cấp.',
          '<strong>Tài liệu</strong>: CCCD, bằng cấp, giấy tờ khác.',
        ],
      },
      {
        title: 'Lưu ý khi nhập',
        type: 'tips',
        items: [
          'Chọn đúng <strong>Loại hợp đồng</strong> vì ảnh hưởng đến tính lương và TNCN trong Payroll.',
          'Điền <strong>MST cá nhân</strong> để hệ thống tự điền khi xuất báo cáo TNCN.',
          'Sau khi lưu, nhân viên xuất hiện ngay trong danh sách và có thể thêm vào Workforce.',
        ],
      },
    ],
  },
  {
    tabId: 'activity',
    tabLabel: 'Phòng ban',
    icon: '🏢',
    summary:
      'Quản lý cơ cấu phòng ban của công ty. Thêm, sửa, xoá phòng ban và xem số lượng nhân viên trong từng phòng ban.',
    sections: [
      {
        title: 'Quản lý phòng ban',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Thêm phòng ban</strong>, điền tên và mô tả.',
          'Nhấn ✏️ để sửa tên/mô tả phòng ban đã có.',
          'Nhấn 🗑️ để xoá — chỉ xoá được phòng ban <strong>không có nhân viên</strong>.',
        ],
      },
      {
        title: 'Thông tin hiển thị',
        type: 'info',
        items: [
          'Mỗi thẻ phòng ban hiển thị <strong>số nhân viên đang làm việc</strong> trong phòng ban đó.',
          'Phòng ban được dùng để lọc danh sách nhân viên và phân loại trong báo cáo lương.',
          'Thay đổi phòng ban của nhân viên bằng cách vào form <strong>Sửa</strong> nhân viên đó.',
        ],
      },
    ],
  },
  {
    tabId: 'dashboard',
    tabLabel: 'Nhắc việc',
    icon: '🔔',
    summary:
      'Trung tâm nhắc việc HR — tự động phát hiện hợp đồng sắp hết hạn, thử việc sắp kết thúc và sinh nhật sắp tới để không bỏ sót việc quan trọng.',
    sections: [
      {
        title: 'Các loại nhắc việc',
        type: 'info',
        items: [
          '<strong>Hợp đồng hết hạn</strong> — Thông báo trước 30 ngày khi hợp đồng lao động sắp hết.',
          '<strong>Kết thúc thử việc</strong> — Nhắc khi nhân viên thử việc gần đến ngày kết thúc.',
          '<strong>Sinh nhật</strong> — Liệt kê sinh nhật nhân viên trong tháng hiện tại.',
        ],
      },
      {
        title: 'Cách xử lý',
        type: 'steps',
        items: [
          'Nhấn <strong>Tạo nhắc việc</strong> để hệ thống quét và tạo danh sách mới nhất.',
          'Nhấn <strong>Đã xử lý</strong> trên từng mục để dismiss sau khi đã giải quyết.',
          'Với hợp đồng hết hạn: vào form sửa nhân viên → tab Hợp đồng → cập nhật hợp đồng mới.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Badge số đỏ trên tab <strong>Nhắc việc</strong> trong Navbar cho biết còn bao nhiêu việc chưa xử lý.',
          'Nhắc việc không tự xoá — cần dismiss thủ công sau khi đã xử lý xong.',
          'Nhấn lại <strong>Tạo nhắc việc</strong> định kỳ (đầu tuần/đầu tháng) để cập nhật.',
        ],
      },
    ],
  },
];
