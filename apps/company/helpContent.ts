import type { HelpContent } from '@/components/HelpPanel';

export const COMPANY_HELP: HelpContent[] = [
  {
    tabId: 'history',
    tabLabel: 'Thông tin',
    icon: '🏢',
    summary:
      'Thông tin pháp lý của công ty — MST, địa chỉ đăng ký, người đại diện pháp luật và các thông tin đăng ký kinh doanh.',
    sections: [
      {
        title: 'Xem thông tin',
        type: 'info',
        items: [
          'Hiển thị toàn bộ thông tin đăng ký doanh nghiệp theo Cổng ĐKDN quốc gia.',
          'Nếu có nhiều pháp nhân (TD GAMES / TD CONSULTING), chọn pháp nhân ở thanh trên.',
          'TD GAMES ★ là pháp nhân chính — mặc định hiển thị khi vào app.',
        ],
      },
      {
        title: 'Chỉnh sửa',
        type: 'steps',
        items: [
          'Nhấn <strong>✏️ Chỉnh sửa</strong> để mở form sửa thông tin.',
          'Cập nhật các trường cần thiết (địa chỉ, email, ghi chú...).',
          'Nhấn <strong>💾 Lưu</strong> để ghi vào cơ sở dữ liệu.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'warning',
        items: [
          'Chỉ Admin và Kế toán mới có quyền chỉnh sửa thông tin công ty.',
          'MST là trường duy nhất không thể thay đổi — liên hệ admin nếu cần.',
        ],
      },
    ],
  },
  {
    tabId: 'activity',
    tabLabel: 'Giấy tờ',
    icon: '📁',
    summary:
      'Kho lưu trữ giấy tờ pháp lý — Giấy phép kinh doanh, Đăng ký thuế, CCCD người đại diện, Con dấu và các tài liệu quan trọng khác.',
    sections: [
      {
        title: 'Upload tài liệu',
        type: 'steps',
        items: [
          'Nhấn <strong>⬆ Upload</strong>, chọn loại tài liệu và file từ máy tính.',
          'Hỗ trợ: PDF, ảnh JPG/PNG, Word, Excel. Giới hạn kích thước 50MB.',
          'Điền tên tài liệu và ghi chú (ngày cấp, bản số mấy...) nếu cần.',
          'Nhấn <strong>⬆ Lưu</strong> để upload lên Supabase Storage.',
        ],
      },
      {
        title: 'Xem & tải về',
        type: 'info',
        items: [
          'Nhấn <strong>👁 Xem</strong> để mở tài liệu trong tab mới (link có hiệu lực 1 giờ).',
          'Tài liệu được lưu trữ bảo mật trên Supabase Storage — chỉ người đăng nhập mới xem được.',
        ],
      },
      {
        title: 'Loại tài liệu thường dùng',
        type: 'tips',
        items: [
          '<strong>GPKD</strong> — Giấy phép kinh doanh (bản scan màu)',
          '<strong>Đăng ký thuế</strong> — Giấy chứng nhận MST',
          '<strong>CCCD đại diện</strong> — CCCD/CMND người đại diện pháp luật (2 mặt)',
          '<strong>Con dấu</strong> — Ảnh/file vector mẫu dấu công ty',
          '<strong>Chữ ký</strong> — File chữ ký số của người đại diện',
        ],
      },
    ],
  },
  {
    tabId: 'settings',
    tabLabel: 'Ngân hàng',
    icon: '🏦',
    summary:
      'Danh sách tài khoản ngân hàng đăng ký dưới tên pháp nhân — dùng để điền vào hoá đơn và hợp đồng.',
    sections: [
      {
        title: 'Thông tin hiển thị',
        type: 'info',
        items: [
          'Hiển thị các tài khoản thuộc pháp nhân đang chọn (TD GAMES hoặc TD CONSULTING).',
          'Tài khoản <strong>Chính</strong> được dùng mặc định khi tạo hoá đơn trong Invoice app.',
          'Tỷ giá VND/USD được lấy theo VCB bình quân hiển thị trên Navbar.',
        ],
      },
      {
        title: 'Thêm / sửa tài khoản',
        type: 'tips',
        items: [
          'Quản lý tài khoản ngân hàng trong <strong>Expense → 💱 Tỷ giá</strong>.',
          'Sau khi thêm, quay lại đây để kiểm tra hiển thị đúng pháp nhân chưa.',
        ],
      },
    ],
  },
];
