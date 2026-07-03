-- ============================================================================
-- Payroll employee acknowledgement flow
--
-- BACKFILL: đã apply trực tiếp trên remote ngày 2026-06-03 (session 2) qua
-- Supabase MCP, chưa từng có file migration trong repo. File này dump lại
-- từ DB live ngày 2026-07-03 để repo giữ đủ source (idempotent, chạy lại
-- trên DB hiện tại không đổi gì).
--
-- Nội dung:
-- 1. Cột acknowledgement trên pay_payroll_records
--    (employee_status: pending/confirmed/disputed/resolved)
-- 2. Function + trigger notify_payroll_confirmed:
--    khi sheet chuyển status -> 'confirmed', insert 1 notification loại
--    'payslip_pending_review' cho từng nhân viên có trong bảng lương
--    -> bảng notifications có sẵn trigger pg_net gọi edge function
--       notify-email (xem 20260520035414_create_notify_email_webhook_trigger.sql)
--    -> nhân viên nhận email "Phiếu lương của bạn cần xác nhận"
-- ============================================================================

-- 1. Acknowledgement columns ---------------------------------------------------
ALTER TABLE public.pay_payroll_records
  ADD COLUMN IF NOT EXISTS employee_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS employee_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS employee_comment text;

-- 2. Notify function -----------------------------------------------------------
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
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
    VALUES (
      _rec.auth_user_id,
      'payslip_pending_review',
      'Phiếu lương cần xác nhận',
      'Phiếu lương tháng ' || NEW.month || '/' || NEW.year || ' đã sẵn sàng. Vui lòng kiểm tra và xác nhận.',
      '#payroll'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. Trigger --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_payroll_confirmed ON public.pay_payroll_sheets;
CREATE TRIGGER trg_notify_payroll_confirmed
  AFTER UPDATE OF status ON public.pay_payroll_sheets
  FOR EACH ROW EXECUTE FUNCTION public.notify_payroll_confirmed();
