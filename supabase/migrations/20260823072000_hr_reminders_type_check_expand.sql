-- hr_reminders: CHECK constraint bị bỏ quên khi thêm loại nhắc việc mới.
--
-- `generateReminders()` (apps/hr/services/hrService.ts) sinh 5 loại mà CHECK cũ không
-- cho phép: performance_review + 4 loại bhxh_*. UI đã có nhãn/icon đủ 12 loại
-- (ReminderDashboard.TYPE_LABELS) nên UI+code là nguồn đúng, CHECK mới là chỗ lạc hậu.
--
-- Vì insert là MỘT batch (`.insert(newReminders)`), chỉ cần 1 bản ghi sai loại là cả lô
-- bị từ chối với 400 — kể cả nhắc sinh nhật / hết hạn hợp đồng hợp lệ. Hệ quả: tính năng
-- Nhắc việc gần như không tạo được gì (bảng chỉ có mỗi 'probation_end').
--
-- Mở rộng danh sách cho khớp code. Không đụng dữ liệu cũ.

alter table hr_reminders drop constraint if exists hr_reminders_type_check;

alter table hr_reminders add constraint hr_reminders_type_check
  check (type = any (array[
    'contract_expiry',
    'birthday',
    'evaluation',
    'work_permit',
    'freelancer_payment',
    'probation_end',
    'anniversary',
    'performance_review',
    'bhxh_payment_deadline',
    'bhxh_missing_insurance',
    'bhxh_new_employee',
    'bhxh_salary_change'
  ]));
