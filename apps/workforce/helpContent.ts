import type { HelpContent } from '@/components/HelpPanel';

export const WORKFORCE_HELP: HelpContent[] = [
  {
    tabId: 'history',
    tabLabel: 'Nhân sự',
    icon: '👷',
    summary:
      'Danh sách cộng tác viên (freelancer/part-time) đang làm việc trong các dự án. Quản lý thông tin, rate và trạng thái hoạt động.',
    sections: [
      {
        title: 'Quản lý CTV',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Thêm CTV</strong> để mở form đăng ký thông tin.',
          'Điền họ tên, email, số điện thoại, bank account và rate mặc định.',
          'Gán CTV vào dự án từ tab <strong>Task</strong> hoặc <strong>Nghiệm thu</strong>.',
          'Nhấn ✏️ để sửa thông tin hoặc cập nhật rate khi có thay đổi.',
        ],
      },
      {
        title: 'Đồng bộ từ HR',
        type: 'tips',
        items: [
          'Nhấn <strong>Sync từ HR</strong> để import nhân viên Part-time/Freelancer từ app HR.',
          'Dữ liệu đồng bộ một chiều: HR → Workforce. Sửa thông tin cơ bản ở HR.',
          'Rate và thông tin thanh toán quản lý riêng trong Workforce.',
        ],
      },
    ],
  },
  {
    tabId: 'recurring',
    tabLabel: 'Task',
    icon: '✅',
    summary:
      'Danh sách công việc từ ClickUp — theo dõi task được giao cho CTV, trạng thái hoàn thành và làm căn cứ nghiệm thu.',
    sections: [
      {
        title: 'Theo dõi task',
        type: 'info',
        items: [
          'Task được đồng bộ tự động từ <strong>ClickUp</strong> theo cấu hình trong tab Cấu hình.',
          'Mỗi task hiển thị: tên, người được giao, trạng thái, deadline và dự án.',
          'Task <strong>Done</strong> trong ClickUp là căn cứ để tạo nghiệm thu thanh toán.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Nhấn <strong>Sync ClickUp</strong> để tải task mới nhất — dữ liệu không tự cập nhật realtime.',
          'Chỉ task thuộc Space/Folder đã cấu hình mới xuất hiện trong danh sách.',
          'Trạng thái task chỉ đọc — sửa trực tiếp trong ClickUp.',
        ],
      },
    ],
  },
  {
    tabId: 'activity',
    tabLabel: 'Nghiệm thu',
    icon: '📝',
    summary:
      'Quản lý nghiệm thu từng đợt — ghi nhận số task hoàn thành, tính tiền thanh toán cho CTV và theo dõi trạng thái chi trả.',
    sections: [
      {
        title: 'Tạo nghiệm thu',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Tạo nghiệm thu</strong>, chọn CTV và kỳ nghiệm thu.',
          'Chọn các task đã hoàn thành muốn đưa vào đợt nghiệm thu này.',
          'Hệ thống tính tiền dựa trên số task × rate hoặc số giờ × rate.',
          'Nhấn <strong>Xác nhận</strong> để khoá nghiệm thu, sau đó <strong>Đã trả</strong> khi chi tiền xong.',
        ],
      },
      {
        title: 'Trạng thái nghiệm thu',
        type: 'info',
        items: [
          '<strong>Nháp</strong> — Đang tổng hợp, chưa khoá.',
          '<strong>Đã xác nhận</strong> — Đã tính xong, chờ chi trả.',
          '<strong>Đã trả</strong> — Đã chuyển khoản cho CTV.',
        ],
      },
    ],
  },
  {
    tabId: 'reports',
    tabLabel: 'NT Dự Án',
    icon: '🏗️',
    summary:
      'Nghiệm thu cấp dự án — ghi nhận milestone hoàn thành với khách hàng, làm căn cứ xuất hoá đơn và theo dõi tiến độ thanh toán.',
    sections: [
      {
        title: 'Tạo nghiệm thu dự án',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Tạo NT Dự Án</strong>, chọn dự án từ CRM.',
          'Điền tên milestone, giá trị nghiệm thu và ngày hoàn thành.',
          'Đính kèm biên bản nghiệm thu nếu cần.',
          'Sau khi xác nhận, dùng thông tin này để xuất hoá đơn trong Invoice app.',
        ],
      },
      {
        title: 'Liên kết với Invoice',
        type: 'tips',
        items: [
          'Nghiệm thu dự án là cơ sở để tạo hoá đơn — copy số tiền sang Invoice app.',
          'Theo dõi trạng thái thanh toán từ phía khách hàng tại tab <strong>Thanh toán</strong> trong CRM.',
        ],
      },
    ],
  },
  {
    tabId: 'overview',
    tabLabel: 'Tổng Quan',
    icon: '📊',
    summary:
      'Dashboard tài chính Workforce — tổng hợp chi phí CTV, doanh thu dự án và lợi nhuận theo kỳ.',
    sections: [
      {
        title: 'Các chỉ số',
        type: 'info',
        items: [
          '<strong>Chi phí CTV</strong> — Tổng nghiệm thu đã trả cho cộng tác viên trong kỳ.',
          '<strong>Doanh thu dự án</strong> — Tổng nghiệm thu dự án đã xác nhận với khách hàng.',
          '<strong>Margin</strong> = Doanh thu − Chi phí CTV. Cho thấy hiệu quả dự án.',
          'Chi phí USD được quy đổi theo tỷ giá VCB bình quân hiển thị trên Navbar.',
        ],
      },
    ],
  },
  {
    tabId: 'dashboard',
    tabLabel: 'Cấu hình',
    icon: '⚙️',
    summary:
      'Cấu hình kết nối ClickUp — nhập API token, chọn Space/Folder để đồng bộ task vào hệ thống.',
    sections: [
      {
        title: 'Kết nối ClickUp',
        type: 'steps',
        items: [
          'Vào ClickUp → Settings → Apps → API Token, copy token.',
          'Dán token vào ô <strong>ClickUp API Token</strong> và nhấn <strong>Lưu</strong>.',
          'Chọn <strong>Workspace → Space → Folder</strong> muốn đồng bộ task.',
          'Quay lại tab <strong>Task</strong> và nhấn <strong>Sync ClickUp</strong> để tải task lần đầu.',
        ],
      },
      {
        title: 'Lưu ý bảo mật',
        type: 'warning',
        items: [
          'API Token có quyền đọc toàn bộ workspace ClickUp — không chia sẻ với người khác.',
          'Nếu token bị lộ, tạo token mới trong ClickUp và cập nhật lại tại đây.',
        ],
      },
    ],
  },
];
