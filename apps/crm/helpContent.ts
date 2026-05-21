import type { HelpContent } from '@/components/HelpPanel';

export const CRM_HELP: HelpContent[] = [
  {
    tabId: 'history',
    tabLabel: 'Khách hàng',
    icon: '🤝',
    summary:
      'Danh sách tất cả khách hàng (client). Xem thông tin liên hệ, trạng thái hợp tác, dự án đang chạy và lịch sử giao dịch.',
    sections: [
      {
        title: 'Quản lý khách hàng',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Thêm khách hàng</strong> để tạo hồ sơ mới.',
          'Điền tên công ty, người liên hệ, email, số điện thoại và nguồn khách hàng.',
          'Chọn <strong>Trạng thái</strong>: Tiềm năng, Đang hợp tác, Đã kết thúc.',
          'Nhấn vào tên khách để xem chi tiết: dự án, hoạt động, lịch sử thanh toán.',
        ],
      },
      {
        title: 'Tìm kiếm & lọc',
        type: 'info',
        items: [
          'Gõ tên hoặc email vào ô tìm kiếm để lọc nhanh.',
          'Lọc theo <strong>Trạng thái</strong> để tập trung vào từng nhóm khách.',
          'Lọc theo <strong>Nguồn</strong>: Referral, Inbound, Outbound, Cold...',
        ],
      },
    ],
  },
  {
    tabId: 'tasks',
    tabLabel: 'Dự án',
    icon: '📁',
    summary:
      'Danh sách dự án gắn với từng khách hàng — theo dõi tiến độ, ngân sách và trạng thái dự án. Làm căn cứ cho nghiệm thu và hoá đơn.',
    sections: [
      {
        title: 'Quản lý dự án',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Tạo dự án</strong>, chọn khách hàng và điền thông tin.',
          'Điền tên dự án, mô tả, ngày bắt đầu, ngày kết thúc dự kiến và ngân sách.',
          'Chọn <strong>Trạng thái</strong>: Đề xuất, Đang chạy, Hoàn thành, Tạm dừng, Huỷ.',
          'Cập nhật tiến độ định kỳ để theo dõi sát hơn.',
        ],
      },
      {
        title: 'Liên kết với các module khác',
        type: 'tips',
        items: [
          'Dự án trong CRM được dùng để tạo <strong>Nghiệm thu Dự Án</strong> trong Workforce.',
          'Dự án là gợi ý khi tạo hoá đơn mới trong Invoice — giúp điền thông tin khách tự động.',
          'Tài liệu dự án (hợp đồng, spec) quản lý trong tab <strong>Tài liệu</strong>.',
        ],
      },
    ],
  },
  {
    tabId: 'settings',
    tabLabel: 'Tài liệu',
    icon: '📄',
    summary:
      'Kho tài liệu nội bộ liên quan đến khách hàng và dự án — hợp đồng, spec, biên bản nghiệm thu, NDA và các file quan trọng khác.',
    sections: [
      {
        title: 'Upload tài liệu',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Upload</strong>, chọn file từ máy tính.',
          'Gán tài liệu với <strong>Khách hàng</strong> và <strong>Dự án</strong> tương ứng.',
          'Chọn <strong>Loại tài liệu</strong>: Hợp đồng, NDA, Spec, Biên bản, Khác.',
          'Tài liệu được lưu trên Supabase Storage — có thể xem và tải lại bất kỳ lúc nào.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Hỗ trợ PDF, Word, Excel, ảnh. Giới hạn 50MB mỗi file.',
          'Tài liệu có phân quyền — chỉ admin và người được giao mới xem được.',
          'Không xoá hợp đồng đang còn hiệu lực — lưu trữ để audit sau này.',
        ],
      },
    ],
  },
  {
    tabId: 'activity',
    tabLabel: 'Thanh toán',
    icon: '💳',
    summary:
      'Theo dõi lịch sử thanh toán từ khách hàng — số tiền đã thu, còn nợ và ngày thanh toán dự kiến cho từng dự án.',
    sections: [
      {
        title: 'Cách đọc bảng thanh toán',
        type: 'info',
        items: [
          '<strong>Giá trị hợp đồng</strong> — Tổng giá trị dự án theo thoả thuận.',
          '<strong>Đã thu</strong> — Tổng số tiền khách đã thanh toán (linked với Invoice Paid).',
          '<strong>Còn lại</strong> — Số tiền chưa thu = Giá trị hợp đồng − Đã thu.',
          'Nhấn vào dòng để xem các hoá đơn liên quan trong Invoice app.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Dữ liệu đồng bộ tự động từ Invoice — cập nhật khi hoá đơn được đánh dấu <em>Paid</em>.',
          'Để ghi nhận thanh toán, cập nhật trạng thái trong tab <strong>Lịch sử</strong> của Invoice.',
        ],
      },
    ],
  },
  {
    tabId: 'board',
    tabLabel: 'Hoạt động',
    icon: '🗂️',
    summary:
      'Nhật ký hoạt động CRM — ghi lại tất cả tương tác với khách hàng: cuộc gọi, email, meeting, ghi chú và thay đổi trạng thái.',
    sections: [
      {
        title: 'Ghi hoạt động',
        type: 'steps',
        items: [
          'Vào hồ sơ khách hàng → tab <strong>Hoạt động</strong> → nhấn <strong>+ Ghi chú</strong>.',
          'Chọn loại: Gọi điện 📞, Email 📧, Meeting 🤝, Ghi chú 📝.',
          'Điền nội dung tóm tắt và nhấn <strong>Lưu</strong>.',
          'Hoạt động xuất hiện trong timeline toàn cục tại tab này.',
        ],
      },
      {
        title: 'Bộ lọc',
        type: 'info',
        items: [
          'Lọc theo <strong>Loại hoạt động</strong>: Gọi / Email / Meeting / Ghi chú.',
          'Lọc theo <strong>Khách hàng</strong> để xem toàn bộ lịch sử tương tác với một client.',
          'Lọc theo <strong>Người thực hiện</strong> để review hoạt động của từng thành viên.',
        ],
      },
    ],
  },
  {
    tabId: 'outreach',
    tabLabel: 'Outreach',
    icon: '📧',
    summary:
      'Gửi email hàng loạt đến danh sách khách hàng tiềm năng — soạn template, chọn đối tượng và theo dõi kết quả gửi.',
    sections: [
      {
        title: 'Tạo chiến dịch email',
        type: 'steps',
        items: [
          'Soạn <strong>Tiêu đề</strong> và <strong>Nội dung</strong> email (hỗ trợ biến {{name}}, {{company}}).',
          'Chọn <strong>Đối tượng</strong>: lọc theo trạng thái khách, nguồn hoặc chọn thủ công.',
          'Nhấn <strong>Gửi thử</strong> để kiểm tra email đến hộp thư của bạn trước.',
          'Nhấn <strong>Gửi chiến dịch</strong> để gửi hàng loạt qua Resend.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'warning',
        items: [
          'Email gửi qua <strong>Resend</strong> — cấu hình domain và from address trong phần cài đặt.',
          'Giới hạn gửi tuỳ theo plan Resend — kiểm tra quota trước khi gửi chiến dịch lớn.',
          'Luôn test trước khi gửi hàng loạt để tránh lỗi template hoặc nội dung sai.',
        ],
      },
    ],
  },
];
