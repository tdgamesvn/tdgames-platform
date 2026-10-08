import type { HelpContent } from '@/components/HelpPanel';

// Nội dung nút "?" trên Navbar app Dự án. tabId = id tab của Navbar (xem TAB_LABELS trong ProjectsApp).
export const PROJECTS_HELP: HelpContent[] = [
  {
    tabId: 'overview',
    tabLabel: 'Tổng quan',
    icon: '🏠',
    summary: 'Bức tranh hôm nay: bao nhiêu việc đang làm, đang chờ khách, việc nào trễ hoặc bị kẹt. Dữ liệu lấy từ ClickUp, tự cập nhật.',
    sections: [
      {
        title: 'Đọc 5 ô số liệu',
        type: 'info',
        items: [
          '<strong>Đang làm</strong>: task team đang thực hiện (gồm cả đang sửa FIX, đang chờ lead kiểm tra).',
          '<strong>Chờ khách</strong>: đã gửi khách duyệt hoặc tạm dừng — không tính vào thời gian làm của team.',
          '<strong>Chưa bắt đầu</strong>: task mới, chưa ai nhận làm.',
          '<strong>Trễ hạn</strong>: chưa xong mà đã qua hạn chót trên ClickUp.',
          'Bấm vào bất kỳ ô nào để xem danh sách task tương ứng.',
        ],
      },
      {
        title: 'Việc cần xử lý',
        type: 'steps',
        items: [
          '<strong>Team đang kẹt</strong>: task nằm ở trạng thái đang làm quá 2 ngày — hỏi người làm xem có vướng gì.',
          '<strong>Chờ khách lâu</strong>: gửi khách quá 5 ngày chưa phản hồi — nhắc khách.',
          'Bấm vào task để xem toàn bộ quá trình chuyển trạng thái.',
          'Task "chết" (đã bỏ trên ClickUp nhưng chưa đóng): rê chuột vào dòng → <strong>Bỏ qua</strong> để ẩn khỏi cảnh báo.',
        ],
      },
      {
        title: 'Thông báo tự động',
        type: 'tips',
        items: [
          '8:30 sáng mỗi ngày: nhắc task kẹt / chờ khách lâu / chưa có ước lượng giờ.',
          '8:30 sáng thứ Hai: tổng kết tuần trước.',
        ],
      },
    ],
  },
  {
    tabId: 'reports',
    tabLabel: 'Dự án',
    icon: '📁',
    summary: 'Mỗi thẻ là một dự án (folder trên ClickUp) với tiến độ % và các cảnh báo.',
    sections: [
      {
        title: 'Cách dùng',
        type: 'steps',
        items: [
          'Lọc <strong>Đang chạy / Hoàn thành / Tất cả</strong> hoặc gõ tên dự án, tên khách để tìm.',
          'Bấm vào thẻ để mở trang chi tiết: ai làm bao nhiêu, số task hoàn thành theo ngày/tuần/tháng/quý/năm.',
          '<strong>Hạn gần nhất</strong> màu đỏ = có task đã quá hạn mà chưa xong.',
        ],
      },
    ],
  },
  {
    tabId: 'history',
    tabLabel: 'Nhân sự',
    icon: '👥',
    summary: 'Hiệu suất từng người (cả nhân viên nội bộ lẫn freelancer). Chọn kỳ ở trên để so sánh cùng một khoảng thời gian.',
    sections: [
      {
        title: 'Các chỉ số nghĩa là gì',
        type: 'info',
        items: [
          '<strong>Đã xong</strong>: số task giao khách lần đầu (hoặc đóng) trong kỳ.',
          '<strong>Giờ làm</strong>: thời gian task ở trạng thái đang làm. Nhân viên nội bộ chỉ tính trong giờ chấm công; freelancer tính theo giờ đồng hồ nên chỉ mang tính tham khảo.',
          '<strong>Duyệt ngay</strong>: % task khách duyệt luôn, không phải sửa lần nào.',
          '<strong>Đúng hạn</strong>: % task giao khách trước hoặc đúng hạn chót.',
          '<strong>Lần sửa</strong>: số lần task bị chuyển sang FIX (khách/lead yêu cầu sửa).',
        ],
      },
      {
        title: 'Lưu ý khi so sánh',
        type: 'warning',
        items: [
          'Tỷ lệ % của người có ít hơn 3 task hiện chữ mờ và xếp sau — chưa đủ để đánh giá.',
          'Giờ làm chỉ có từ 17/09/2026 (ngày bắt đầu ghi lịch sử trạng thái).',
        ],
      },
    ],
  },
  {
    tabId: 'dashboard',
    tabLabel: 'Chỉ số',
    icon: '📈',
    summary: 'Xu hướng 8 tuần gần nhất của cả team: làm được bao nhiêu, nhanh hay chậm, chất lượng ra sao.',
    sections: [
      {
        title: 'Dành cho admin',
        type: 'tips',
        items: [
          '<strong>Phân nhóm trạng thái</strong>: chọn trạng thái ClickUp nào được tính giờ làm. Trạng thái mới trên ClickUp sẽ hiện "Chưa phân nhóm".',
          '<strong>PM phụ trách dự án</strong>: gán dự án cho từng PM. PM chưa được gán xem tất cả. PM cần đăng nhập lại để thấy thay đổi.',
        ],
      },
    ],
  },
  {
    tabId: 'recurring',
    tabLabel: 'Task phụ',
    icon: '📝',
    summary: 'Việc nhỏ tạo ngay trong app (ngoài ClickUp) — ví dụ việc nội bộ, việc chuẩn bị cho một task ClickUp.',
    sections: [
      {
        title: 'Cách dùng',
        type: 'steps',
        items: [
          'Bấm <strong>+ Thêm task</strong>, đặt tên, chọn dự án, người làm, hạn chót.',
          'Có thể gắn vào một task ClickUp để biết việc phụ này phục vụ việc chính nào.',
          'Bấm <strong>Bắt đầu</strong> → <strong>Xong</strong> để cập nhật tiến độ.',
        ],
      },
    ],
  },
];
