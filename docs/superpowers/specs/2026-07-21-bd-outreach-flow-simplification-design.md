# BD Outreach Flow Simplification — Design

_Ngày: 2026-07-21_

## Bối cảnh

Nhân viên role `bd` dùng module CRM → Email Outreach để tự tìm lead, verify email, gửi cold email và follow-up. Sếp phản ánh luồng này "hơi rắc rối". Sau khi rà code (`apps/crm/components/EmailOutreach.tsx`) và trao đổi, xác nhận 3 điểm gây khó chịu:

- **A. Quá nhiều bước/nút cho 1 lead** — Thêm Studio (tab Studios) → Thêm Lead (tab Leads) → Verify → Gửi, tách rời nhiều tab/nút.
- **B. Phải tự nhớ bấm follow-up** — không có nhắc/tự động gửi FU1/FU2, BD phải tự rà bảng Leads.
- **C. Dễ bấm nhầm / khó nhìn** — cột Actions dồn tới 2-4 nút (chọn template, Gửi, Thủ công, Xoá) chung 1 hàng ngang hẹp; dropdown trạng thái 8 lựa chọn tự do dễ chỉnh sai.

**Phát hiện quan trọng:** Điểm B đã có sẵn code xử lý (`cron_followup.py` trên VPS `/opt/td-mailer-api`) — tự gửi FU1 sau 3 ngày, FU2 sau 7 ngày, có quota-guard, dry-run, báo Discord — nhưng **chưa từng được lên lịch chạy** (không có trong crontab/systemd timer). Script có 2 lỗ hổng cần vá trước khi bật an toàn:
1. Không check cờ `sending_paused` (bounce-rate guard, xem session 2026-07-21 cùng ngày) — bật nguyên xi có thể gửi nhầm cả lúc đang pause an toàn.
2. Luôn gửi bằng sender mặc định công ty, không theo `from_email` của BD phụ trách lead (`assigned_bd_id`) — phá tính năng "BD data isolation" đã làm 2026-07-13 (mỗi BD gửi bằng mail công việc thật của mình).

## Mục tiêu

Giảm rắc rối cho BD ở 2 hướng độc lập, làm song song:
1. Dọn UI cột Actions (điểm C, hỗ trợ nhận biết điểm B qua cảnh báo trực quan).
2. Bật lại auto follow-up có sẵn, đã vá lỗ hổng (giải quyết dứt điểm điểm B).

**Không làm trong scope này:** điểm A (gộp luồng Studio→Lead→Verify→Gửi thành 1 luồng liền mạch) — effort cao hơn hẳn, để đánh giá riêng sau khi 2 việc trên xong nếu sếp vẫn thấy rối.

## Thiết kế

### A. Dọn cột Actions (frontend)

File: `apps/crm/components/EmailOutreach.tsx`, trong `LeadsTab` (khu vực render Actions cell, dòng ~885-943).

- **Gộp nút:** Nút chính "📧 Gửi {label}" (label lấy từ `getNextTemplate()` — Initial/FU1/FU2, không đổi logic) giữ nguyên hành vi 1-click gửi ngay. Nút "✍️ Thủ công" (đánh dấu đã gửi thủ công, gọi `svc.logManualSend`) và nút "✕ Xoá" (gọi `handleDelete`) — cả hai ít dùng hơn — chuyển vào 1 menu nhỏ mở bằng nút kebab "⋮" cạnh nút Gửi. Dropdown chọn template override (chỉ hiện nếu BD có template riêng) giữ nguyên vị trí, không đổi.
- **Cảnh báo quá hạn follow-up:** Thêm hàm helper tính "quá hạn" thuần client-side, không đổi schema:
  ```ts
  function isOverdue(lead: CrmOutreachLead): number | null {
    const now = Date.now();
    if (lead.outreach_status === 'initial_sent' && lead.initial_sent_at) {
      const days = Math.floor((now - new Date(lead.initial_sent_at).getTime()) / 86400000);
      return days >= 3 ? days : null;
    }
    if (lead.outreach_status === 'followup1_sent' && lead.followup1_sent_at) {
      const days = Math.floor((now - new Date(lead.followup1_sent_at).getTime()) / 86400000);
      return days >= 7 ? days : null;
    }
    return null; // pending, followup2_sent, replied, bounced, invalid_email, unsubscribed -> never overdue
  }
  ```
  Ngưỡng 3/7 ngày **khớp với `RULES` trong `cron_followup.py`** — nếu sau này đổi ngưỡng ở 1 nơi, phải đổi cả 2 (ghi chú `// keep in sync with cron_followup.py RULES` ở cả 2 nơi).
  Hiển thị: tag nhỏ màu cam/đỏ "⏰ Quá hạn {days}d" cạnh dropdown trạng thái, chỉ khi `isOverdue(lead) !== null`.

### B. Bật auto follow-up (`cron_followup.py`, VPS `/opt/td-mailer-api`)

- **Vá guard `sending_paused`:** đầu `main()`, sau khi setup logger, thêm:
  ```python
  from services.settings import get_setting
  if get_setting('sending_paused', True):
      logger.warning("Sending paused (bounce-rate guard). Exit."); return
  ```
- **Vá per-BD sender:** `do_send(lead, rule, dry_run)` hiện gọi `send_email(lead['email'], subj, html)` — cần lấy email của `lead['assigned_bd_id']` (nếu có) làm `from_email`/`reply_to`, giống cách `routes/email.py::send()` đang override cho gửi tay. Nếu `assigned_bd_id` là null (lead cũ/admin-owned), giữ hành vi cũ (sender mặc định công ty từ ENV).
  - Cần tra email của user từ `assigned_bd_id` (uuid) — dùng Supabase admin API `auth.admin.get_user_by_id` hoặc query `account_users_view` nếu đã có (kiểm tra lúc code, migration `account_users_view` được nhắc tới trong LOG session Studios).
- **Lên lịch:** thêm vào crontab VPS: `0 3 * * * cd /opt/td-mailer-api && /usr/bin/python3 cron_followup.py >> logs/followup_cron.log 2>&1` (3:00 UTC = 10:00 ICT, đúng docstring có sẵn trong file).
- **Rollout an toàn:** backup file trước khi sửa (`cron_followup.py.bak-20260721`), chạy `python3 cron_followup.py --dry-run` xem output đúng leads mong đợi trước, rồi mới thêm crontab thật.

## Test plan

- **Frontend:** `npm run build` pass; verify UI thật trên localhost — 1 lead giả `initial_sent_at` = 4 ngày trước → thấy tag "Quá hạn 4d"; menu ⋮ mở đúng 2 action, không vỡ layout ở màn hình hẹp.
- **Backend:** `cron_followup.py --dry-run` với ít nhất 1 lead có `assigned_bd_id` khớp ngày đến hạn → log show đúng `from_email` dự kiến là email của BD đó (không phải mặc định công ty); test riêng case `sending_paused=true` → script thoát sớm, không gửi gì.
- Sau khi bật crontab thật: theo dõi `logs/followup.log` + Discord notify 1-2 ngày đầu trước khi coi là ổn định.

## Rủi ro

- Sửa `cron_followup.py` trên VPS — cần backup + test dry-run kỹ vì đây là script tự động, lỗi sẽ gửi nhầm/gửi sai người mà không ai review trước (khác gửi tay có confirm popup).
- Nếu tra email theo `assigned_bd_id` thất bại (user bị xoá, hoặc field null) — phải fallback êm về sender mặc định, không được để cron crash giữa batch (đã có try/except quanh từng lead trong vòng lặp gốc, giữ nguyên pattern này).
