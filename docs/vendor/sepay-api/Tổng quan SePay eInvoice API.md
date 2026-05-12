# Tổng quan SePay eInvoice API

## Giới thiệu, luồng xử lý và các endpoint chính của eInvoice API.

---

**API Overview:**

API tạo và quản lý hóa đơn điện tử theo quy định của Tổng cục Thuế Việt Nam.

**Base URLs:**
- Production: `https://einvoice-api.sepay.vn`
- Sandbox: `https://einvoice-api-sandbox.sepay.vn`


---

### Giới thiệu

* eInvoice API giúp doanh nghiệp tạo, phát hành và tra cứu hóa đơn điện tử qua HTTP.
* Hỗ trợ hai môi trường: Sandbox cho thử nghiệm và Production cho vận hành.

<ButtonLink href="/vi/einvoice-demo" variant="link">Xem hóa đơn demo</ButtonLink>

***

### Môi trường & Base URL

<TextBlock title="Environment">
```text
Production: https://einvoice-api.sepay.vn
Sandbox: https://einvoice-api-sandbox.sepay.vn
```
</TextBlock>

***

### Xác thực

<TextBlock title="Authorization">
```text
Header: Authorization: Bearer <ACCESS_TOKEN>
```
</TextBlock>

***

### Luồng tổng quát

<Mermaid title="eInvoice Processing Flow">
sequenceDiagram
  participant App as Merchant App
  participant API as SePay eInvoice API

  App->>API: POST v1/token
  API-->>App: access_token

  App->>API: GET v1/provider-accounts
  API-->>App: provider account list

  App->>API: GET v1/provider-accounts/{id}
  API-->>App: provider account detail

  App->>API: POST v1/invoices/create
  API-->>App: tracking_code (create)

  App->>API: GET v1/invoices/create/check/{tracking_code}
  API-->>App: status, message (create)

  App->>API: POST v1/invoices/issue
  API-->>App: tracking_code (issue)

  App->>API: GET v1/invoices/issue/check/{tracking_code}
  API-->>App: status, message (issue)

  App->>API: GET v1/invoices/{reference_code}
  API-->>App: invoice detail + file URLs

  App->>API: GET v1/usage
  API-->>App: quota_remaining

  App->>API: GET v1/invoices?page=1&per_page=10
  API-->>App: invoice list + paging
</Mermaid>

* **Mô tả luồng xử lý eInvoice:**

* Luồng xử lý eInvoice bao gồm các bước chính từ xác thực, kiểm tra tài khoản/ hạn ngạch đến tạo, phát hành và tra cứu hóa đơn:

1. **Lấy access token**
   Ứng dụng của merchant gọi API để lấy `access_token`. Token này được sử dụng cho tất cả các API eInvoice tiếp theo.

2. **Danh sách tài khoản**
   Merchant truy vấn danh sách tài khoản nhà cung cấp (`GET v1/provider-accounts`) để biết các tài khoản eInvoice khả dụng cùng trạng thái của từng tài khoản.

3. **Chi tiết tài khoản**
   Khi đã chọn được tài khoản, merchant gọi `GET v1/provider-accounts/{id}` để lấy cấu hình chi tiết (mẫu/ký hiệu hóa đơn, trạng thái hoạt động).

4. **Tạo hóa đơn (Create)**
   Merchant gửi dữ liệu hóa đơn lên hệ thống (`POST v1/invoices/create`). API trả về `tracking_code` để theo dõi trạng thái xử lý xuất hóa đơn.

5. **Kiểm tra trạng thái tạo hóa đơn**
   Merchant sử dụng `tracking_code` gọi `/create/check` để kiểm tra trạng thái xuất hóa đơn (thành công hoặc thất bại).

6. **Phát hành hóa đơn (Issue)**
   Sau khi hóa đơn được tạo thành công, merchant gửi yêu cầu phát hành (`POST v1/invoices/issue`). API trả về `tracking_code` cho bước phát hành.

7. **Kiểm tra trạng thái phát hành**
   Merchant gọi `/issue/check` với `tracking_code` để xác nhận kết quả phát hành hóa đơn.

8. **Lấy chi tiết hóa đơn**
   Khi hóa đơn đã phát hành thành công, merchant có thể truy vấn `GET v1/invoices/{reference_code}` để nhận thông tin và file hóa đơn (PDF, XML,…).

9. **Kiểm tra hạn ngạch**
   Merchant có thể gọi `GET v1/usage` để theo dõi số lượt phát hành/xuất hóa đơn còn lại nhằm tối ưu kế hoạch sử dụng dịch vụ.

10. **Danh sách hóa đơn**
    Merchant có thể gọi `GET v1/invoices` để lấy danh sách các hóa đơn đã tạo/phát hành kèm phân trang phục vụ quản lý và đối soát.

<Callout type="info" title="Lưu ý">
Các bước 
Create
 và 
Issue
 được xử lý bất đồng bộ. Merchant cần gọi API 
`/check`
 tương ứng để xác nhận trạng thái trước khi thực hiện bước tiếp theo.
</Callout>

***

### Endpoint chính

<Endpoint method="POST" path="v1/token">
  * Lấy access token.
</Endpoint>

<Endpoint method="GET" path="v1/provider-accounts">
  * Danh sách tài khoản
</Endpoint>

<Endpoint method="GET" path="v1/provider-accounts/{id}">
  * Chi tiết tài khoản
</Endpoint>

<Endpoint method="POST" path="v1/invoices/create">
  * Tạo hóa đơn (nháp/phát hành tùy `is_draft`).
</Endpoint>

<Endpoint method="GET" path="v1/invoices/create/check/{tracking_code}">
  * Kiểm tra trạng thái tạo hóa đơn.
</Endpoint>

<Endpoint method="POST" path="v1/invoices/issue">
  * Gửi yêu cầu phát hành từ hóa đơn nháp đã tạo.
</Endpoint>

<Endpoint method="GET" path="v1/invoices/issue/check/{tracking_code}">
  * Theo dõi trạng thái phát hành.
</Endpoint>

<Endpoint method="GET" path="v1/invoices/{reference_code}">
  * Chi tiết hóa đơn.
</Endpoint>

<Endpoint method="GET" path="v1/usage">
  * Kiểm tra hạn ngạch
</Endpoint>

<Endpoint method="GET" path="v1/invoices">
  * Danh sách hóa đơn (phân trang).
</Endpoint>

***

### Cấu trúc phản hồi chung

<Response title="Success">
```json
{
  "success": true,
  "data": "object"
}
```
</Response>

<Response title="Error">
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Thông điệp lỗi"
  }
}
```
</Response>

***

### Bước tiếp theo

Để bắt đầu sử dụng eInvoice API, bạn cần thực hiện theo thứ tự sau:

1. **[Tạo Access Token](/vi/einvoice-api/tao-token)** - Lấy Bearer token để xác thực các API tiếp theo
2. **[Danh sách tài khoản](/vi/einvoice-api/danh-sach-tai-khoan)** - Xem các tài khoản nhà cung cấp hóa đơn điện tử khả dụng
3. **[Xuất hóa đơn điện tử](/vi/einvoice-api/xuat-hoa-don-dien-tu)** - Bắt đầu tạo hóa đơn đầu tiên

<Callout type="info" title="Gợi ý">
Nếu bạn mới bắt đầu, hãy sử dụng môi trường 
Sandbox
 để thử nghiệm trước khi chuyển sang Production.
</Callout>