# Apollo Bulk Contact Enrichment — Design

_2026-07-08_

## Mục tiêu

Dùng tối đa credits Apollo (2500/tháng, reset hàng tháng — còn ~2459) để tìm nhiều contact nhất
cho các studio đã có trong `crm_discovered_studios`. **Không discover studio mới.**

Số liệu hiện tại (2026-07-08):
- `crm_discovered_studios`: 625 studios
- `crm_outreach_leads`: 569 leads
- Studios có <2 contact: 613

## Quyết định đã chốt

1. **Chạy 1 lần hết** (không chia ngày) — credits reset monthly, không dùng là mất.
   Bottleneck là gửi mail (30/ngày), không phải tìm contact.
2. **3 contact/studio** (625 × 3 ≈ 1875 credits), phần dư quét sâu thêm cho studio tier cao / có reply.
3. **Dry-run 20 studio đầu → sếp duyệt kết quả trong tab Outreach → full run.**
4. Tắt auto-discovery (studio mới), giữ nguyên toàn bộ luồng gửi mail.

## Kiến trúc

Không sửa frontend. Một script mới trên VPS + tắt 2 cron discovery.

### 1. Tắt discovery
- Supabase: `UPDATE crm_outreach_config SET value='false' WHERE key='auto_discovery'`
  (hoặc unschedule pg_cron `outreach-auto-discovery-daily`)
- VPS: comment dòng 08:00 `daily-discover` trong `/etc/cron.d/`

### 2. Script `bulk_enrich.py` (`/opt/td-mailer-api/`)
Chạy tay qua SSH. Flow:

1. Query studios cần enrich: mỗi studio trong `crm_discovered_studios`,
   đếm leads hiện có theo `LOWER(studio_name)` — cần thêm `(3 - count)` contact.
2. Với mỗi studio: gọi Apollo `POST /v1/mixed_people/api_search`
   (reuse `services/apollo.py`) với:
   - `q_organization_name` = studio_name
   - `person_titles`: CEO, Founder, Co-Founder, Business Development,
     Publishing Manager, Head of Publishing, COO
   - `per_page` = số contact còn thiếu
3. Insert vào `crm_outreach_leads`: status `pending`, `source='apollo_bulk_enrich'`,
   dedupe theo email (skip nếu email đã tồn tại — bảng nào cũng vậy).
   Skip contact không có email verified.
4. **Credit guard:** đếm email reveal đã dùng, dừng cứng ở 2300 (chừa ~160 dự phòng).
5. **Rate limit:** sleep giữa các call theo limit Apollo (~50 req/phút plan trả phí);
   backoff khi 429.
6. **Resume:** ghi checkpoint (studio đã xử lý) vào file JSON local —
   đứt giữa chừng chạy lại là tiếp, không tốn credit trùng.
7. Log: số studio quét, contact tìm được, credits đã dùng → stdout + file log.

Flags: `--limit 20` (dry-run đợt đầu), `--max-credits 2300`, `--per-studio 3`.

### 3. Sau khi enrich
Leads mới ở `pending` tự chảy qua `daily-send` (30 mail/ngày) như cũ. Không đổi gì.

## Error handling
- Apollo 422 (endpoint deprecated lần 3): dừng, báo lỗi rõ — xem OUTREACH_PIPELINE.md.
- Studio không tìm thấy người: ghi nhận, không retry (checkpoint đánh dấu đã xử lý).
- Supabase insert lỗi: log + tiếp tục studio kế.

## Phase 2 (chưa làm)
- Cron monthly chạy lại script vài ngày trước reset để tiêu credit dư.
- Tăng `daily-send` limit nếu 2000 leads gửi 2 tháng là quá chậm.
- Ưu tiên tier khi quét sâu vòng 2.

## Verification
- Dry-run 20 studio: kiểm tra leads mới trong tab Outreach (đúng studio, đúng title, email hợp lệ).
- Sau full run: SQL đếm leads theo `source='apollo_bulk_enrich'`, đối chiếu credits đã trừ
  trên dashboard Apollo.
