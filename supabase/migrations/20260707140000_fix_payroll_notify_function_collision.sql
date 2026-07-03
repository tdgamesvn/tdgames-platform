-- CRITICAL FIX — tên hàm bị đụng độ (function name collision)
--
-- Migration 20260707120000 dùng `CREATE OR REPLACE FUNCTION public.notify_payroll_confirmed()`
-- mà KHÔNG kiểm tra hàm này đã tồn tại từ trước (migration 20260603100000_payroll_employee_acknowledgement.sql,
-- gắn với trigger `trg_notify_payroll_confirmed` có sẵn từ session 2) — hàm gốc dùng để insert
-- vào bảng `notifications` cho từng nhân viên trong sheet (type 'payslip_pending_review'),
-- từ đó có trigger khác gọi edge function `notify-email` gửi email thật cho nhân viên.
--
-- Hậu quả: từ lúc apply 20260707120000, hàm gốc bị GHI ĐÈ bởi logic gửi Discord — nhân viên
-- sẽ KHÔNG còn nhận được notification trong app / email nhắc xác nhận phiếu lương khi kế toán
-- bấm "Xác nhận" nữa (dù Discord vẫn gửi được, nhưng in-app + email đã hỏng).
--
-- Fix:
-- 1. Khôi phục nguyên bản `notify_payroll_confirmed()` (in-app notification + email) từ
--    20260603100000, gắn lại đúng cho trigger `trg_notify_payroll_confirmed`.
-- 2. Đổi tên hàm gửi Discord thành `notify_payroll_confirmed_discord()` — tránh đụng tên vĩnh viễn.
-- 3. Trỏ lại trigger `trg_payroll_discord_confirmed` sang hàm mới.

-- ── 1. Khôi phục hàm gốc (in-app notification + email cho nhân viên) ─────────
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

-- ── 2. Đổi tên hàm Discord (tách khỏi tên hàm gốc) ────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_payroll_confirmed_discord()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _discord_url  text;
  _period       text;
  _desc         text;
BEGIN
  IF NEW.status <> 'confirmed' OR OLD.status IS NOT DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT value INTO _discord_url
  FROM   public.app_config
  WHERE  key = 'discord_payroll_webhook'
  LIMIT  1;

  IF _discord_url IS NULL OR _discord_url = '' THEN
    RETURN NEW;
  END IF;

  _period := 'tháng ' || NEW.month || '/' || NEW.year;

  _desc :=
       '### 💰 Bảng lương ' || _period || ' đã sẵn sàng' || chr(10)
    || 'Công ty đã gửi bảng lương ' || _period || ' trên TD Games Platforms.' || chr(10)
    || chr(10)
    || 'Các bạn vui lòng truy cập app để kiểm tra và xác nhận phiếu lương của mình.' || chr(10)
    || chr(10)
    || '📌 Cần làm:' || chr(10)
    || '• Đăng nhập vào Platforms' || chr(10)
    || '• Kiểm tra chi tiết phiếu lương' || chr(10)
    || '• Bấm Xác nhận nếu thông tin chính xác' || chr(10)
    || chr(10)
    || '⚠️ Nếu có bất kỳ thắc mắc hoặc sai sót nào, vui lòng phản hồi lại trên phiếu lương hoặc inbox trực tiếp cho bộ phận Nhân sự nhé.' || chr(10)
    || chr(10)
    || '🔗 Truy cập nhanh: app.tdgamestudio.com → Portal';

  PERFORM net.http_post(
    url     := _discord_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'content', '@everyone',
      'embeds', jsonb_build_array(
        jsonb_build_object(
          'description', _desc,
          'color',       16749824,
          'footer',      jsonb_build_object('text', 'TD Games • Phòng Hành chính - Nhân sự')
        )
      )
    )
  );

  RETURN NEW;
END;
$$;

-- ── 3. Trỏ lại trigger Discord sang hàm mới ──────────────────────────────────
DROP TRIGGER IF EXISTS trg_payroll_discord_confirmed ON pay_payroll_sheets;
CREATE TRIGGER trg_payroll_discord_confirmed
  AFTER UPDATE OF status ON pay_payroll_sheets
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed')
  EXECUTE FUNCTION public.notify_payroll_confirmed_discord();
