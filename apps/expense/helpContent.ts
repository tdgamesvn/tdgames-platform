import type { HelpContent } from '@/components/HelpPanel';

export const EXPENSE_HELP: HelpContent[] = [
  {
    tabId: 'overview',
    tabLabel: 'Dashboard',
    icon: '📊',
    summary:
      'Tổng quan chi phí theo tháng — biểu đồ phân tích theo danh mục, trạng thái và loại giao dịch. Nắm nhanh tình hình thu chi trước khi vào danh sách chi tiết.',
    sections: [
      {
        title: 'Các chỉ số chính',
        type: 'info',
        items: [
          '<strong>Tổng chi phí</strong> — Tổng giá trị tất cả giao dịch trong kỳ (đã trả + chưa trả).',
          '<strong>Đã thanh toán</strong> — Chi phí có trạng thái <em>Đã trả</em>.',
          '<strong>Chờ duyệt</strong> — Chi phí đang ở trạng thái <em>Chờ duyệt</em> cần xử lý.',
          'Chi phí USD và VND hiển thị riêng — không cộng lẫn để tránh sai tỷ giá.',
        ],
      },
      {
        title: 'Biểu đồ',
        type: 'tips',
        items: [
          'Biểu đồ tròn phân bổ chi phí theo <strong>Danh mục</strong> (lương, vận hành, marketing...).',
          'Biểu đồ cột so sánh chi phí theo <strong>Tháng</strong> để thấy xu hướng.',
          'Nhấn vào một danh mục trong biểu đồ để lọc thẳng sang tab <strong>Danh sách</strong>.',
        ],
      },
    ],
  },
  {
    tabId: 'history',
    tabLabel: 'Danh sách',
    icon: '📋',
    summary:
      'Toàn bộ giao dịch chi phí và thu nhập. Thêm mới, chỉnh sửa, duyệt/từ chối và thay đổi trạng thái thanh toán. Hỗ trợ lọc đa chiều theo nhiều tiêu chí.',
    sections: [
      {
        title: 'Thêm chi phí mới',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Thêm</strong> để mở form nhập chi phí.',
          'Điền: danh mục, mô tả, số tiền, đơn vị tiền tệ (VND/USD), ngày chi.',
          'Chọn <strong>Loại</strong>: Chi phí hoặc Thu nhập (revenue).',
          'Chọn <strong>Nguồn</strong>: Công ty, Cá nhân hoặc Tạm ứng.',
          'Chọn trạng thái ban đầu: <em>Chờ duyệt</em> hoặc <em>Đã trả</em>.',
          'Nhấn <strong>Lưu</strong> — chi phí xuất hiện ngay trong danh sách.',
        ],
      },
      {
        title: 'Bộ lọc',
        type: 'info',
        items: [
          '<strong>Danh mục</strong>: lọc theo nhóm chi phí.',
          '<strong>Từ ngày / Đến ngày</strong>: khoảng thời gian bất kỳ.',
          '<strong>Trạng thái</strong>: Chờ duyệt / Đã duyệt / Đã trả / Từ chối.',
          '<strong>Loại</strong>: Chi phí (expense) hoặc Thu nhập (revenue).',
          '<strong>Nguồn</strong>: Công ty / Cá nhân / Tạm ứng.',
        ],
      },
      {
        title: 'Duyệt & trạng thái',
        type: 'tips',
        items: [
          'Admin có thể nhấn <strong>Duyệt</strong> hoặc <strong>Từ chối</strong> chi phí đang chờ.',
          'Nhấn nút trạng thái để chuyển <em>Đã duyệt → Đã trả</em> hoặc ngược lại.',
          'Chi phí <strong>Đã trả</strong> mới được tính vào P&L và đối chiếu ngân hàng.',
        ],
      },
    ],
  },
  {
    tabId: 'recurring',
    tabLabel: 'Định kỳ',
    icon: '🔄',
    summary:
      'Quản lý chi phí định kỳ — tự động tạo giao dịch theo lịch hàng tháng, hàng quý hoặc hàng năm cho các khoản chi cố định như thuê văn phòng, phần mềm SaaS.',
    sections: [
      {
        title: 'Tạo chi phí định kỳ',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Tạo mới</strong>, chọn danh mục và điền mô tả.',
          'Nhập số tiền, đơn vị tiền tệ và loại chi phí.',
          'Chọn <strong>Tần suất</strong>: hàng tháng, hàng quý, hàng năm.',
          'Chọn <strong>Ngày bắt đầu</strong> và tuỳ chọn ngày kết thúc.',
          'Lưu — hệ thống tự tạo giao dịch theo lịch vào đầu mỗi kỳ.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Giao dịch định kỳ được tạo ở trạng thái <em>Chờ duyệt</em>, cần duyệt và đánh dấu đã trả thủ công.',
          'Có thể <strong>Tạm dừng</strong> một khoản định kỳ mà không cần xoá.',
          'Sửa thông tin chỉ ảnh hưởng <strong>các kỳ tiếp theo</strong>, không thay đổi giao dịch đã tạo.',
        ],
      },
    ],
  },
  {
    tabId: 'activity',
    tabLabel: 'Danh mục',
    icon: '🏷️',
    summary:
      'Quản lý danh mục chi phí — nhóm các khoản chi theo chủ đề (lương, vận hành, marketing...) để phân tích và báo cáo chính xác hơn.',
    sections: [
      {
        title: 'Quản lý danh mục',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Thêm danh mục</strong>, điền tên và chọn icon/màu.',
          'Nhấn ✏️ để sửa tên hoặc màu danh mục đã có.',
          'Nhấn 🗑️ để xoá — chỉ xoá được danh mục <strong>chưa có giao dịch</strong>.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Danh mục được dùng để phân tích trong Dashboard, Reports và P&L của Kế toán.',
          'Nên tạo danh mục theo chuẩn kế toán nội bộ để báo cáo nhất quán.',
          'Không thể xoá danh mục đang có chi phí — hãy chuyển chi phí sang danh mục khác trước.',
        ],
      },
    ],
  },
  {
    tabId: 'reports',
    tabLabel: 'Báo cáo',
    icon: '📈',
    summary:
      'Báo cáo chi phí tổng hợp theo kỳ — so sánh tháng này vs tháng trước, phân tích theo danh mục và xuất CSV để lưu trữ hoặc nộp kế toán.',
    sections: [
      {
        title: 'Các loại báo cáo',
        type: 'info',
        items: [
          '<strong>Theo tháng</strong> — Tổng chi phí từng tháng trong năm, so sánh xu hướng.',
          '<strong>Theo danh mục</strong> — Breakdown chi tiết từng nhóm chi phí trong kỳ.',
          '<strong>Trạng thái</strong> — Phân tích tỷ lệ Đã trả / Chờ duyệt / Từ chối.',
        ],
      },
      {
        title: 'Xuất báo cáo',
        type: 'steps',
        items: [
          'Chọn khoảng thời gian cần báo cáo ở bộ lọc phía trên.',
          'Nhấn <strong>⬇ Xuất CSV</strong> để tải file về.',
          'File CSV gồm: Ngày, Danh mục, Mô tả, Số tiền, Tiền tệ, Trạng thái, Nguồn.',
        ],
      },
    ],
  },
  {
    tabId: 'fxrates',
    tabLabel: 'Tỷ giá',
    icon: '💱',
    summary:
      'Quản lý lịch sử tỷ giá USD/VND theo ngày. Tỷ giá bình quân được dùng để quy đổi chi phí USD trong P&L, Dashboard và Báo cáo kế toán.',
    sections: [
      {
        title: 'Cập nhật tỷ giá',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Thêm tỷ giá</strong>, chọn ngày và nhập tỷ giá mua/bán.',
          'Hệ thống tự tính <strong>Tỷ giá bình quân</strong> = (Mua + Bán) ÷ 2.',
          'Tỷ giá gần nhất có trong database sẽ được dùng cho ngày chưa có dữ liệu.',
        ],
      },
      {
        title: 'Nguồn tỷ giá',
        type: 'info',
        items: [
          'Tỷ giá VCB mua/bán cập nhật tự động hàng ngày ở thanh Navbar.',
          'Tỷ giá bình quân trong Expense được dùng cho quy đổi P&L và Bank Reconciliation.',
          'Nếu thiếu tỷ giá một ngày, các module sẽ dùng tỷ giá gần nhất có sẵn trong database.',
        ],
      },
    ],
  },
  {
    tabId: 'cashflow',
    tabLabel: 'Dòng tiền',
    icon: '💵',
    summary:
      'Báo cáo dòng tiền (Cash Flow) — tổng hợp tiền vào từ hoá đơn thu tiền và tiền ra từ chi phí đã thanh toán. Xem theo tháng để quản lý thanh khoản.',
    sections: [
      {
        title: 'Cách đọc Cash Flow',
        type: 'info',
        items: [
          '<strong>Tiền vào (Inflow)</strong> — Tổng hoá đơn đã thu tiền (Paid) trong kỳ.',
          '<strong>Tiền ra (Outflow)</strong> — Tổng chi phí đã thanh toán (Đã trả) trong kỳ.',
          '<strong>Dòng tiền ròng</strong> = Tiền vào − Tiền ra. Số âm = thâm hụt tháng đó.',
          '<strong>Số dư tích luỹ</strong> — Cộng dồn từ đầu kỳ, cho thấy thanh khoản hiện tại.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Chỉ tính giao dịch <strong>thực thu / thực chi</strong> — không tính hoá đơn pending hoặc chi phí chờ duyệt.',
          'Chi phí USD được quy đổi VND theo tỷ giá bình quân VCB hiện tại.',
          'Dùng Cash Flow để dự đoán nhu cầu vốn ngắn hạn, không thay thế cho P&L.',
        ],
      },
    ],
  },
];
