import type { HelpContent } from '@/components/HelpPanel';

export const ACCOUNTING_HELP: HelpContent[] = [
  {
    tabId: 'assets',
    tabLabel: 'Tài sản',
    icon: '🏢',
    summary:
      'Quản lý tài sản cố định của công ty (máy móc, thiết bị, bất động sản...). Hệ thống tự động tính khấu hao theo đường thẳng mỗi tháng.',
    sections: [
      {
        title: 'Cách thêm tài sản',
        type: 'steps',
        items: [
          'Nhấn nút <strong>+ Thêm tài sản</strong> ở góc phải.',
          'Điền tên, ngày mua, nguyên giá, giá trị thanh lý và thời gian sử dụng (tháng).',
          'Chọn loại tài sản và đơn vị sở hữu, sau đó nhấn <strong>Lưu</strong>.',
          'Hệ thống sẽ tự tính khấu hao hàng tháng và cập nhật giá trị còn lại.',
        ],
      },
      {
        title: 'Công thức khấu hao',
        type: 'info',
        items: [
          '<strong>Khấu hao tháng</strong> = (Nguyên giá − Giá trị thanh lý) ÷ Số tháng sử dụng',
          '<strong>Giá trị còn lại</strong> = Nguyên giá − Tổng khấu hao đã tính',
          'Khi hết thời gian sử dụng, giá trị còn lại = Giá trị thanh lý (không khấu hao thêm).',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'tips',
        items: [
          'Tài sản <strong>Đã thanh lý</strong> vẫn lưu lịch sử nhưng không tính vào tổng khấu hao.',
          'Chỉ tài sản có trạng thái <strong>Đang sử dụng</strong> mới được tính khấu hao tháng này.',
          'Có thể sửa thông tin tài sản bất kỳ lúc nào bằng nút ✏️ trên mỗi dòng.',
        ],
      },
    ],
  },
  {
    tabId: 'advances',
    tabLabel: 'Tạm ứng',
    icon: '💳',
    summary:
      'Theo dõi các khoản tạm ứng cho nhân viên đi công tác hoặc mua hàng. Khi nhân viên quyết toán, nhập số tiền thực chi và số tiền hoàn lại.',
    sections: [
      {
        title: 'Tạo tạm ứng mới',
        type: 'steps',
        items: [
          'Nhấn <strong>+ Tạm ứng</strong>, điền tên người nhận, mục đích và số tiền.',
          'Chọn ngày tạm ứng, nhấn <strong>Lưu</strong>. Trạng thái sẽ là <em>Đang mở</em>.',
          'Khi nhân viên quyết toán: nhấn <strong>Quyết toán</strong>, nhập số đã chi và số hoàn lại.',
          'Nếu huỷ khoản tạm ứng (chưa chi): nhấn <strong>Huỷ</strong>.',
        ],
      },
      {
        title: 'Trạng thái tạm ứng',
        type: 'info',
        items: [
          '<strong>Đang mở</strong> — Đã tạm ứng, chưa quyết toán.',
          '<strong>Đã quyết toán</strong> — Đã chi xong, đã hoàn tiền thừa (nếu có).',
          '<strong>Đã huỷ</strong> — Khoản tạm ứng bị huỷ, không chi tiền.',
        ],
      },
      {
        title: 'Lưu ý quan trọng',
        type: 'warning',
        items: [
          'Chỉ xoá tạm ứng khi chắc chắn nhập sai. Dùng <strong>Huỷ</strong> thay vì Xoá nếu khoản tạm ứng không dùng đến.',
          'Tổng tạm ứng đang mở hiển thị ở thẻ tóm tắt phía trên — con số này cần được theo dõi chặt.',
        ],
      },
    ],
  },
  {
    tabId: 'payables',
    tabLabel: 'Công nợ',
    icon: '📋',
    summary:
      'Bảng kê công nợ phải trả (AP) tổng hợp từ các chi phí trong hệ thống Expense. Dữ liệu tự động đồng bộ — không cần nhập thêm.',
    sections: [
      {
        title: 'Cách đọc bảng',
        type: 'info',
        items: [
          '<strong>Tổng phải trả</strong> — Tổng giá trị tất cả chi phí trong kỳ (đã trả + chưa trả).',
          '<strong>Đã thanh toán</strong> — Tổng chi phí có trạng thái <em>Đã trả</em>.',
          '<strong>Còn tồn đọng</strong> — Các chi phí chưa hoặc chưa được duyệt thanh toán.',
          'Nhấn vào tên nhà cung cấp để xem từng phiếu chi cụ thể.',
        ],
      },
      {
        title: 'Lọc theo kỳ',
        type: 'tips',
        items: [
          'Chọn <strong>Tháng / Quý / Năm / Tất cả</strong> ở góc phải để lọc theo kỳ kế toán.',
          'Chi phí bằng USD hiển thị riêng ở cột cuối, không cộng vào tổng VND để tránh sai tỷ giá.',
          'Để thay đổi trạng thái chi phí, vào app <strong>Expense</strong> và cập nhật tại đó.',
        ],
      },
    ],
  },
  {
    tabId: 'pnl',
    tabLabel: 'Lãi / Lỗ',
    icon: '📈',
    summary:
      'Báo cáo P&L (Profit & Loss) tổng hợp doanh thu từ Hoá đơn đã thu tiền và chi phí đã thanh toán. Tự động quy đổi USD → VND theo tỷ giá VCB.',
    sections: [
      {
        title: 'Cách đọc P&L',
        type: 'info',
        items: [
          '<strong>Doanh thu</strong> — Tổng giá trị hoá đơn có trạng thái <em>Đã thu tiền</em> trong kỳ (theo ngày thu tiền).',
          '<strong>Chi phí</strong> — Tổng chi phí <em>Đã thanh toán</em> trong kỳ (theo ngày chi).',
          '<strong>Lợi nhuận</strong> = Doanh thu − Chi phí. Số âm hiển thị màu đỏ.',
          '<strong>Biên lợi nhuận</strong> = Lợi nhuận ÷ Doanh thu × 100%.',
        ],
      },
      {
        title: '3 góc nhìn phân tích',
        type: 'steps',
        items: [
          '<strong>Tổng quan</strong> — Biểu đồ thanh so sánh doanh thu, chi phí, lợi nhuận.',
          '<strong>Theo danh mục</strong> — Chi phí breakdown theo từng category (lương, vận hành, marketing...).',
          '<strong>Theo client</strong> — Doanh thu và lợi nhuận theo từng khách hàng.',
        ],
      },
      {
        title: 'Lưu ý về tỷ giá',
        type: 'tips',
        items: [
          'Tỷ giá USD/VND lấy từ VCB bình quân, cập nhật trong phần <strong>Expense → Tỷ giá</strong>.',
          'Nếu tỷ giá chưa cập nhật hôm nay, hệ thống dùng tỷ giá gần nhất có trong database.',
        ],
      },
    ],
  },
  {
    tabId: 'bank',
    tabLabel: 'Ngân hàng',
    icon: '🏦',
    summary:
      'Import sao kê ngân hàng CSV và đối chiếu từng giao dịch với hoá đơn, chi phí hoặc tạm ứng. Hỗ trợ Techcombank và BIDV.',
    sections: [
      {
        title: 'Import sao kê',
        type: 'steps',
        items: [
          'Xuất file CSV từ Internet Banking của Techcombank hoặc BIDV.',
          'Nhấn <strong>⬆ Import CSV</strong>, chọn file. Hệ thống tự nhận biết ngân hàng.',
          'Các giao dịch mới xuất hiện trong bảng. Giao dịch đã import trước đó không bị trùng.',
          'Kiểm tra cột <strong>Khớp với</strong> — giao dịch nào có gợi ý ~Auto thì xem xét xác nhận.',
        ],
      },
      {
        title: 'Khớp giao dịch',
        type: 'info',
        items: [
          '<strong>Auto ✓</strong> — Hệ thống tìm được hoá đơn/chi phí khớp ±1% số tiền và ±3 ngày. Nhấn để xác nhận.',
          '<strong>Khớp</strong> — Chọn thủ công từ danh sách hoá đơn, chi phí hoặc tạm ứng.',
          '<strong>Bỏ khớp</strong> — Huỷ liên kết nếu khớp nhầm.',
          'Giao dịch <strong>Phát sinh Có</strong> (tiền vào) → khớp với Hoá đơn đã thu.',
          'Giao dịch <strong>Phát sinh Nợ</strong> (tiền ra) → khớp với Chi phí hoặc Tạm ứng.',
        ],
      },
      {
        title: 'Định dạng CSV được hỗ trợ',
        type: 'tips',
        items: [
          '<strong>Techcombank:</strong> Date, Description, Debit, Credit, Balance',
          '<strong>BIDV:</strong> STT, Ngày GD, Số tham chiếu, Mô tả, Phát sinh Nợ, Phát sinh Có, Số dư',
          'Ngày chấp nhận dạng DD/MM/YYYY hoặc YYYY-MM-DD.',
        ],
      },
    ],
  },
  {
    tabId: 'vat',
    tabLabel: 'VAT',
    icon: '🧾',
    summary:
      'Bảng kê thuế GTGT theo quý từ tất cả hoá đơn đã xuất (trừ hoá đơn đã huỷ). Dùng để làm tờ khai thuế GTGT hàng quý.',
    sections: [
      {
        title: 'Cách sử dụng',
        type: 'steps',
        items: [
          'Chọn <strong>Năm</strong> và <strong>Quý</strong> cần kê khai ở góc phải.',
          'Kiểm tra tổng <strong>Doanh thu, Thuế GTGT, Tổng cộng</strong> ở 3 thẻ trên.',
          'Nhấn vào ô quý trong bảng tóm tắt để xem chi tiết từng hoá đơn.',
          'Nhấn <strong>⬇ Xuất CSV</strong> để tải file về nộp hoặc kiểm tra.',
        ],
      },
      {
        title: 'Cách tính VAT',
        type: 'info',
        items: [
          '<strong>Doanh thu</strong> = Subtotal sau discount (chưa VAT), đã quy về VND.',
          '<strong>Thuế GTGT</strong> = Doanh thu × Thuế suất (thường 8% hoặc 10%).',
          'Hoá đơn có thuế suất 0% vẫn xuất hiện trong bảng kê, VAT = 0.',
          'Hoá đơn <em>bị huỷ</em> không được tính.',
        ],
      },
      {
        title: 'Lưu ý',
        type: 'warning',
        items: [
          'VAT tính theo <strong>ngày xuất hoá đơn</strong>, không theo ngày thu tiền.',
          'Nếu thuế suất hoá đơn bị sai, cần vào app <strong>Invoice</strong> sửa lại trước khi kê khai.',
        ],
      },
    ],
  },
  {
    tabId: 'tncn',
    tabLabel: 'TNCN',
    icon: '💼',
    summary:
      'Tổng hợp thuế thu nhập cá nhân (TNCN) từ bảng lương đã xác nhận hoặc đã trả. Dùng để làm quyết toán thuế TNCN cuối năm.',
    sections: [
      {
        title: 'Cách đọc bảng TNCN',
        type: 'info',
        items: [
          'Mỗi hàng là 1 nhân viên, các cột là 12 tháng trong năm.',
          'Ô màu cam = có TNCN phát sinh tháng đó. Dấu · = không có bảng lương tháng đó.',
          '<strong>Tổng TNCN</strong> = tổng thuế đã khấu trừ cả năm của nhân viên.',
          '<strong>Chịu thuế</strong> = tổng thu nhập chịu thuế trước khi tính thuế.',
        ],
      },
      {
        title: 'Xuất báo cáo',
        type: 'steps',
        items: [
          'Chọn năm cần quyết toán ở góc phải.',
          'Nhấn <strong>⬇ Xuất CSV</strong> để tải file.',
          'File CSV gồm: Họ tên, MST cá nhân, TNCN từng tháng, Tổng thu nhập chịu thuế, Tổng TNCN.',
          'Dùng file này để điền vào mẫu quyết toán 02/QTT-TNCN hoặc nộp cho phần mềm HTKK.',
        ],
      },
      {
        title: 'Điều kiện hiển thị',
        type: 'tips',
        items: [
          'Chỉ tính từ bảng lương có trạng thái <strong>Đã xác nhận</strong> hoặc <strong>Đã trả</strong>.',
          'Bảng lương nháp (<em>Draft</em>) không được tính vào quyết toán.',
          'Nhân viên không có TNCN trong năm sẽ không xuất hiện trong bảng.',
          'Để bổ sung dữ liệu lương, vào app <strong>Payroll</strong> và xác nhận bảng lương tháng đó.',
        ],
      },
    ],
  },
];
