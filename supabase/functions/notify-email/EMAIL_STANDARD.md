# TD Games Platform — Email Standard

_v1.0 — Cập nhật: 2026-06-10_

> **AI INSTRUCTION:** Đọc file này TRƯỚC khi thêm bất kỳ luồng gửi email mới nào.
> Mọi email phải tuân theo chuẩn này. Không tự đặt ra format mới.

---

## Kiến trúc tổng quan

```
DB Trigger (INSERT on notifications)
    └─▶ trigger_notify_email() [pg_net]
            └─▶ notify-email (Edge Function, Supabase)
                    └─▶ Resend API → User inbox
```

---

## Cấu trúc email (template anatomy)

```
┌──────────────────────────────────────────────────────┐
│  [Preheader ẩn — 90 ký tự đầu của body]              │  ← Gmail preview text
├──────────────────────────────────────────────────────┤
│  ████ (4px orange accent bar)                        │  ← #FF9500
├──────────────────────────────────────────────────────┤
│  TD Games  Platform                  [Category badge]│  ← Header row
├──────────────────────────────────────────────────────┤
│                                                      │
│  Tiêu đề email (h1, 21px bold)                       │  ← record.title
│                                                      │
│  Nội dung chi tiết (p, 15px, #555)                   │  ← record.body
│                                                      │
│  [Xem chi tiết →] (CTA button)                       │  ← record.link
│                                                      │
├──────────────────────────────────────────────────────┤
│  Footer: disclaimer + company address + MST          │  ← CAN-SPAM
└──────────────────────────────────────────────────────┘
```

---

## Quy tắc bắt buộc

### Subject line
- ✅ Format: `[TD Games] Nội dung mô tả rõ ràng`
- ✅ Tiếng Việt có dấu
- ❌ Không dùng emoji trong subject (trigger spam filter)
- ❌ Không dùng ALL CAPS
- ❌ Không dùng dấu chấm than nhiều (`!!!`)
- ❌ Không dùng các từ spam: "miễn phí", "khẩn cấp", "click ngay"

### HTML
- Doctype: `XHTML 1.0 Transitional` (chuẩn email client)
- Layout: 100% table-based, không dùng div/flex/grid
- Width: max-width 600px
- Styles: inline only — không dùng `<style>` block (bị strip bởi email clients)
- Font: `Helvetica, Arial, sans-serif` (web-safe, không load external)
- Background: sáng (`#f2f2f4` ngoài, `#ffffff` card)
- ❌ Không dùng dark background (`#0F0F0F`, `#1A1A1A`, v.v.)

### CTA Button
- Luôn dùng `<table>` wrap button, không phải `display:block` trên `<a>`
- Màu: `#FF9500` background, `#000000` text
- Padding: `12px 32px`
- Border-radius: `6px`

### Preheader
- Dùng 90 ký tự đầu của `body`, hoặc `title` nếu không có body
- Pad bằng `&nbsp;&zwnj;` để ngăn Gmail hiện content thừa

### Headers (Resend API)
Luôn thêm 3 headers này trong mọi email:
```json
{
  "List-Unsubscribe": "<mailto:noreply@tdgamestudio.com?subject=unsubscribe>",
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  "X-Mailer": "TD Games Platform v1"
}
```
> `List-Unsubscribe` + `List-Unsubscribe-Post` là **bắt buộc** theo Google/Yahoo 2024 Bulk Sender Policy.

### Plain-text fallback
- Luôn include field `text` trong Resend payload
- Nội dung: thuần text, không HTML, có đầy đủ thông tin như HTML version
- Kết thúc bằng địa chỉ công ty (CAN-SPAM compliance)

---

## Cách thêm luồng email mới

### Bước 1 — Thêm DB trigger

```sql
-- Trong migration SQL
CREATE OR REPLACE FUNCTION notify_ten_chuc_nang()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE _uid uuid;
BEGIN
  -- Lấy auth_user_id của người nhận
  SELECT auth_user_id INTO _uid FROM hr_employees WHERE id = NEW.employee_id LIMIT 1;
  IF _uid IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  VALUES (
    _uid,
    'ten_loai_notification',               -- type key (snake_case)
    'Tiêu đề hiển thị trong app và email', -- title
    'Mô tả chi tiết...',                   -- body (tối đa 2 câu)
    '#portal/tab-hoac-route'               -- deep-link vào app
  );
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_ten_chuc_nang
  AFTER INSERT ON ten_bang
  FOR EACH ROW EXECUTE FUNCTION notify_ten_chuc_nang();
```

> **Deep-link format:**
> - Portal employee: `#portal/eval-{cycle_id}`
> - Portal leave: `#portal` (tab recurring)
> - HR app: `#hr/evaluation`

### Bước 2 — Đăng ký TYPE_META trong `index.ts`

```typescript
// Trong TYPE_META object:
ten_loai_notification: {
  subject:  '[TD Games] Mô tả ngắn gọn cho email subject',
  category: 'Tên nhóm',  // hiện trong badge góc phải header
},
```

**Danh sách category hiện có:**
| category | Dùng cho |
|----------|----------|
| `Nghỉ phép` | leave_* |
| `Bảng lương` | payslip_* |
| `Chi phí` | expense_* |
| `Hóa đơn` | invoice_* |
| `Đánh giá` | eval_* |
| `Thông báo` | broadcast, misc |

### Bước 3 — Deploy edge function

```bash
# Dùng Supabase MCP tool:
mcp__supabase__deploy_edge_function(
  name: "notify-email",
  verify_jwt: false,
  files: [{ name: "index.ts", content: <nội dung file> }]
)
```

---

## Anti-spam checklist (kiểm tra trước khi deploy)

| # | Kiểm tra | Status |
|---|----------|--------|
| 1 | Subject không có emoji | ✅ |
| 2 | Subject có `[TD Games]` prefix | ✅ |
| 3 | HTML background sáng (không dark) | ✅ |
| 4 | Có plain-text `text` field | ✅ |
| 5 | `reply_to` được set | ✅ |
| 6 | `List-Unsubscribe` header có | ✅ |
| 7 | `List-Unsubscribe-Post` header có | ✅ |
| 8 | Footer có địa chỉ công ty | ✅ |
| 9 | CTA button dùng table-wrap | ✅ |
| 10 | Resend domain `tdgamestudio.com` verified | ✅ (confirmed) |
| 11 | SPF/DKIM/DMARC DNS records tồn tại trên Cloudflare | ✅ (confirmed) |

---

## Environment variables (Supabase Edge Function Secrets)

| Key | Mô tả |
|-----|-------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Sender address (default: `noreply@tdgamestudio.com`) |
| `APP_URL` | Base URL (default: `https://app.tdgamestudio.com`) |
| `SUPABASE_URL` | Auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase |

---

## Lịch sử version

| Version | Ngày | Thay đổi |
|---------|------|----------|
| v7 | 2026-06-10 | Per-type category badge, orange accent bar, XHTML doctype, preheader, List-Unsubscribe, CAN-SPAM footer, EMAIL_STANDARD.md |
| v6 | 2026-06-10 | Light theme (dark → light), `text` field, `reply_to` |
| v5 | 2026-06-09 | Deep-link `#portal/eval-{id}`, `text` field, `reply_to` |
| v4 | 2026-06-08 | `eval_assigned`, `eval_deadline_reminder` types |
| v3 | 2026-06-08 | `eval_self_submitted`, `eval_leader_submitted`, `eval_1on1_required`, `eval_completed` |
