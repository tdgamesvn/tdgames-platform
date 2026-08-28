-- Huỷ xác nhận bảng lương (confirmed → draft) để lại rác:
--   1. Noti "Phiếu lương cần xác nhận" vẫn nằm trong chuông, bấm vào không thấy phiếu
--      (fetchMyPayslips chỉ lấy sheet confirmed/paid) → nhân viên tưởng lỗi app.
--   2. Link cũ là '#payroll' — app đó member không có quyền, guard router đá về HomeScreen.
--      Nghĩa là noti phiếu lương xưa nay bấm vào KHÔNG BAO GIỜ tới đúng chỗ.
--   3. Confirm lại → Discord @everyone bắn lần nữa cho cả công ty.
--
-- Fix:
--   • Noti mang metadata {sheet_id} để về sau còn truy ngược được, link → '#portal'.
--   • Rollback: viết lại noti cũ thành "đã thu hồi" (đánh dấu đã đọc, bỏ link) thay vì xoá —
--     nhân viên đã nhận email rồi, xoá trắng thì họ không hiểu chuyện gì xảy ra.
--     UPDATE không kích hoạt on_notification_email / on_notification_push (đều AFTER INSERT).
--   • Confirm lại VẪN gửi noti + email cá nhân (bảng lương có thể đã sửa số, không được im lặng),
--     nhưng Discord @everyone chỉ bắn đúng 1 lần/sheet — mốc là confirmed_by, set lần confirm
--     đầu và không bao giờ bị xoá.

-- ── 1. Noti xác nhận: thêm metadata.sheet_id + link đúng app ─────────────────
CREATE OR REPLACE FUNCTION public.notify_payroll_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rec RECORD;
BEGIN
  IF NEW.status <> 'confirmed' OR OLD.status = 'confirmed' THEN RETURN NEW; END IF;

  FOR _rec IN
    SELECT e.auth_user_id, e.full_name, pr.net_salary
    FROM pay_payroll_records pr
    JOIN hr_employees e ON e.id = pr.employee_id
    WHERE pr.sheet_id = NEW.id AND e.auth_user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link, metadata)
    VALUES (
      _rec.auth_user_id,
      'payslip_pending_review',
      'Phiếu lương cần xác nhận',
      'Phiếu lương tháng ' || NEW.month || '/' || NEW.year || ' đã sẵn sàng. Vui lòng kiểm tra và xác nhận.',
      '#portal',
      jsonb_build_object('sheet_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ── 2. Rollback về Nháp → noti cũ thành "đã thu hồi" ─────────────────────────
CREATE OR REPLACE FUNCTION public.notify_payroll_withdrawn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.notifications
  SET type    = 'payslip_withdrawn',
      title   = 'Bảng lương đã thu hồi',
      body    = 'Bảng lương tháng ' || NEW.month || '/' || NEW.year ||
                ' đang được chỉnh sửa lại. Bạn sẽ nhận thông báo mới khi phiếu lương sẵn sàng.',
      link    = NULL,
      is_read = true
  WHERE type = 'payslip_pending_review'
    AND metadata->>'sheet_id' = NEW.id::text;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_payroll_withdrawn ON pay_payroll_sheets;
CREATE TRIGGER trg_notify_payroll_withdrawn
  AFTER UPDATE OF status ON pay_payroll_sheets
  FOR EACH ROW
  WHEN (NEW.status = 'draft' AND OLD.status IS DISTINCT FROM 'draft')
  EXECUTE FUNCTION public.notify_payroll_withdrawn();

-- ── 3. Discord @everyone: chỉ 1 lần/sheet ────────────────────────────────────
-- ponytail: mốc "đã công bố" mượn confirmed_by có sẵn, không thêm cột. Muốn bắn lại
-- Discord thủ công thì UPDATE pay_payroll_sheets SET confirmed_by = NULL rồi confirm lại.
DROP TRIGGER IF EXISTS trg_payroll_discord_confirmed ON pay_payroll_sheets;
CREATE TRIGGER trg_payroll_discord_confirmed
  AFTER UPDATE OF status ON pay_payroll_sheets
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed'
        AND OLD.confirmed_by IS NULL)
  EXECUTE FUNCTION public.notify_payroll_confirmed_discord();

-- ── 4. Backfill metadata cho noti cũ (chưa có sheet_id) ──────────────────────
-- Ghép qua người nhận: noti thuộc sheet nào mà chính họ có record trong đó.
UPDATE public.notifications n
SET metadata = jsonb_build_object('sheet_id', s.id)
FROM pay_payroll_sheets s
JOIN pay_payroll_records pr ON pr.sheet_id = s.id
JOIN hr_employees e         ON e.id = pr.employee_id
WHERE n.type = 'payslip_pending_review'
  AND n.metadata IS NULL
  AND e.auth_user_id = n.recipient_user_id
  AND n.body LIKE 'Phiếu lương tháng ' || s.month || '/' || s.year || '%';

-- ── 5. Dọn ngay các noti đang trỏ vào sheet đã quay về Nháp ──────────────────
UPDATE public.notifications n
SET type    = 'payslip_withdrawn',
    title   = 'Bảng lương đã thu hồi',
    body    = 'Bảng lương tháng ' || s.month || '/' || s.year ||
              ' đang được chỉnh sửa lại. Bạn sẽ nhận thông báo mới khi phiếu lương sẵn sàng.',
    link    = NULL,
    is_read = true
FROM pay_payroll_sheets s
WHERE n.type = 'payslip_pending_review'
  AND n.metadata->>'sheet_id' = s.id::text
  AND s.status = 'draft';
