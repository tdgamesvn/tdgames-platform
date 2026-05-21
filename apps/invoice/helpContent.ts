import type { HelpContent } from '@/components/HelpPanel';

export const INVOICE_HELP: HelpContent[] = [
  {
    tabId: 'edit',
    tabLabel: 'Tạo HĐ',
    icon: '✏️',
    summary:
      'Soạn thảo hoá đơn mới hoặc chỉnh sửa hoá đơn đã lưu. Điền đầy đủ thông tin khách hàng, hạng mục dịch vụ, thuế và ngân hàng trước khi lưu.',
    sections: [
      {
        title: 'Các bước tạo hoá đơn',
        type: 'steps',
        items: [
          'Chọn <strong>Pháp nhân</strong> phát hành: TD Games, TD Consulting, hoặc Cá nhân.',
          'Điền thông tin khách hàng — gõ tên để gợi ý từ danh sách CRM, hoặc nhập mới.',
          'Thêm hạng mục dịch vụ: tên, số lượng, đơn giá, đơn vị tính.',
          'Chọn thuế suất (0%, 8%, 10%), loại giảm giá và ngân hàng nhận tiền.',
          'Nhấn <strong>Lưu lên Cloud</strong> để lưu. Nhấn <strong>Xuất PDF</strong> để tải file.',
        ],
      },
      {
        title: 'Loại tiền tệ & tỷ giá',
        type: 'info',
        items: [
          'Hoá đơn hỗ trợ <strong>USD</strong> và <strong>VND</strong>.',
          'Tỷ giá VCB (mua/bán) hiển thị ở thanh trên cùng, cập nhật tự động mỗi ngày.',
          'Khi tạo eInvoice cho HĐ USD, hệ thống yêu cầu nhập tỷ giá để convert sang VND (SePay chỉ hỗ trợ VND).',
        ],
      },
      {
        title: 'Quản lý ngân hàng & studio',
        type: 'tips',
        items: [
          'Nhấn <strong>Quản lý ngân hàng</strong> để thêm/sửa/xóa tài khoản nhận tiền.',
          'Nhấn <strong>Quản lý studio</strong> để cập nhật thông tin pháp nhân xuất hiện trên hoá đơn.',
          'Đặt <strong>Mặc định</strong> cho ngân hàng/studio hay dùng nhất để tự điền khi tạo HĐ mới.',
        ],
      },
    ],
  },
  {
    tabId: 'preview',
    tabLabel: 'Preview',
    icon: '👁️',
    summary:
      'Xem trước hoá đơn đúng như khi in ra hoặc gửi cho khách. Kiểm tra kỹ trước khi xuất PDF hoặc tạo eInvoice.',
    sections: [
      {
        title: 'Các thao tác trong Preview',
        type: 'info',
        items: [
          '<strong>Xuất PDF</strong> — Tải file PDF chất lượng cao để gửi email cho khách.',
          '<strong>Tạo eInvoice</strong> — Phát hành hoá đơn điện tử qua SePay (cần lưu cloud trước).',
          '<strong>Gửi Email</strong> — Gửi PDF trực tiếp cho khách qua email từ hệ thống.',
          'Chuyển <strong>Dark / Light theme</strong> — Thay đổi giao diện hoá đơn. Light phù hợp để in.',
        ],
      },
      {
        title: 'Lưu ý trước khi gửi khách',
        type: 'warning',
        items: [
          'Kiểm tra số hoá đơn, ngày, tên khách hàng và số tiền lần cuối.',
          'Đảm bảo đã chọn đúng ngân hàng nhận tiền trước khi gửi.',
          'Hoá đơn eInvoice sau khi phát hành <strong>không thể sửa</strong> — cần tạo HĐ điều chỉnh nếu sai.',
        ],
      },
    ],
  },
  {
    tabId: 'history',
    tabLabel: 'Lịch sử',
    icon: '📜',
    summary:
      'Danh sách tất cả hoá đơn đã tạo. Lọc theo pháp nhân, khách hàng hoặc khoảng thời gian. Quản lý trạng thái thanh toán và eInvoice.',
    sections: [
      {
        title: 'Trạng thái hoá đơn',
        type: 'info',
        items: [
          '<strong>Pending</strong> (vàng) — Đã xuất, chưa thu tiền.',
          '<strong>Paid</strong> (xanh lá) — Đã thu tiền. Hệ thống ghi nhận ngày thanh toán và phí chuyển khoản.',
          '<strong>Cancelled</strong> (đỏ) — Đã huỷ, không tính vào doanh thu.',
          'Nhấn nút trạng thái để chuyển <em>Pending → Paid</em> hoặc <em>Paid → Pending</em>.',
        ],
      },
      {
        title: 'Các thao tác nhanh',
        type: 'steps',
        items: [
          '<strong>Nhân bản</strong> — Tạo HĐ mới giống hệt HĐ đã chọn (chỉ thay số HĐ và ngày).',
          '<strong>Gửi Email</strong> — Gửi PDF hoá đơn trực tiếp cho khách.',
          '<strong>Tạo eInvoice</strong> — Phát hành hoá đơn điện tử lên SePay.',
          '<strong>Xoá</strong> — Chỉ xoá được HĐ chưa có eInvoice đã phát hành.',
        ],
      },
      {
        title: 'Đồng bộ eInvoice',
        type: 'tips',
        items: [
          'Nhấn <strong>Sync eInvoice</strong> để cập nhật trạng thái tất cả eInvoice từ SePay.',
          'Trạng thái eInvoice: <em>draft</em> (nháp), <em>signed</em> (đã ký), <em>cancelled</em> (đã huỷ).',
        ],
      },
    ],
  },
  {
    tabId: 'dashboard',
    tabLabel: 'Dashboard',
    icon: '📊',
    summary:
      'Tổng quan doanh thu theo tháng, quý và năm. Biểu đồ so sánh theo pháp nhân, khách hàng và trạng thái thanh toán.',
    sections: [
      {
        title: 'Các chỉ số chính',
        type: 'info',
        items: [
          '<strong>Doanh thu</strong> — Tổng giá trị HĐ đã Paid trong kỳ (đã trừ phí chuyển khoản).',
          '<strong>Pending</strong> — Tổng giá trị HĐ chưa thu tiền, cần theo dõi.',
          '<strong>Số HĐ</strong> — Đếm theo trạng thái: Paid / Pending / Cancelled.',
          'Doanh thu USD được quy đổi VND theo tỷ giá VCB trung bình hiện tại.',
        ],
      },
      {
        title: 'Bộ lọc',
        type: 'tips',
        items: [
          'Lọc theo <strong>Pháp nhân</strong> (TD Games, TD Consulting, Cá nhân) để xem riêng từng entity.',
          'Lọc theo <strong>Khách hàng</strong> để phân tích doanh thu theo từng client.',
          'Chọn <strong>Từ ngày / Đến ngày</strong> để xem bất kỳ khoảng thời gian nào.',
        ],
      },
    ],
  },
  {
    tabId: 'aging',
    tabLabel: 'AR Aging',
    icon: '⏳',
    summary:
      'Phân tích công nợ phải thu (Accounts Receivable) theo độ tuổi. Nhận biết ngay các hoá đơn quá hạn cần theo dõi và đôn đốc thu tiền.',
    sections: [
      {
        title: 'Cách đọc bảng Aging',
        type: 'info',
        items: [
          '<strong>Current</strong> — HĐ chưa đến hạn thanh toán.',
          '<strong>1–30 ngày</strong> — Quá hạn từ 1 đến 30 ngày.',
          '<strong>31–60 ngày</strong> — Quá hạn từ 31 đến 60 ngày. Cần liên hệ khách.',
          '<strong>61–90 ngày</strong> — Rủi ro cao. Cần xử lý ngay.',
          '<strong>>90 ngày</strong> — Nợ xấu. Cần escalate hoặc ghi nhận dự phòng.',
        ],
      },
      {
        title: 'Hành động khuyến nghị',
        type: 'warning',
        items: [
          'HĐ quá hạn >30 ngày nên gửi email nhắc nợ từ tab <strong>Lịch sử</strong>.',
          'Theo dõi cột <strong>Tổng pending</strong> theo từng khách hàng để ưu tiên thu.',
          'Sau khi thu được tiền, cập nhật trạng thái sang <strong>Paid</strong> trong tab Lịch sử.',
        ],
      },
    ],
  },
  {
    tabId: 'activity',
    tabLabel: 'Activity',
    icon: '🗂️',
    summary:
      'Nhật ký hoạt động — ghi lại mọi thay đổi trên hệ thống hoá đơn: tạo, sửa, xoá, đổi trạng thái, gửi email.',
    sections: [
      {
        title: 'Thông tin trong Activity Log',
        type: 'info',
        items: [
          'Mỗi dòng ghi: <strong>Thời gian</strong>, <strong>Người thực hiện</strong>, <strong>Hành động</strong> và <strong>Hoá đơn liên quan</strong>.',
          'Dùng để audit trail — truy vết ai đã thay đổi gì và lúc nào.',
          'Log không thể xoá hoặc chỉnh sửa, đảm bảo tính toàn vẹn dữ liệu.',
        ],
      },
    ],
  },
  {
    tabId: 'recurring',
    tabLabel: 'Định kỳ',
    icon: '🔄',
    summary:
      'Quản lý hoá đơn định kỳ — tự động tạo hoá đơn theo lịch hàng tháng, hàng quý hoặc hàng năm cho các hợp đồng dài hạn.',
    sections: [
      {
        title: 'Tạo hoá đơn định kỳ',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Tạo mới</strong>, chọn khách hàng và pháp nhân.',
          'Điền hạng mục dịch vụ và số tiền (giống tạo HĐ thường).',
          'Chọn <strong>Tần suất</strong>: hàng tháng, hàng quý, hoặc hàng năm.',
          'Chọn <strong>Ngày bắt đầu</strong> và <strong>Ngày kết thúc</strong> (hoặc để trống nếu không giới hạn).',
          'Lưu — hệ thống sẽ tự tạo HĐ theo lịch và thông báo khi đến kỳ.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'HĐ định kỳ được tạo tự động dưới dạng <em>Pending</em>, cần xác nhận thu tiền thủ công.',
          'Có thể tạm dừng (<strong>Pause</strong>) một HĐ định kỳ mà không cần xoá.',
          'Sửa thông tin HĐ định kỳ chỉ áp dụng cho <strong>các kỳ tiếp theo</strong>, không ảnh hưởng HĐ đã tạo.',
        ],
      },
    ],
  },
];
