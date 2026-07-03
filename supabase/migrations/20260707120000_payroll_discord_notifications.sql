-- Payroll Discord Notifications
--
-- Khi bảng lương (pay_payroll_sheets) chuyển status draft/paid → 'confirmed'
-- (tức sếp/kế toán bấm nút "Xác nhận" trên PayrollSheet.tsx), tự động gửi
-- 1 tin tóm tắt lên Discord qua webhook (đọc từ app_config, không hardcode URL).
--
-- Nội dung: tổng số nhân viên, tổng lương Net, tổng chi phí công ty, người
-- xác nhận, kỳ lương — KHÔNG liệt kê breakdown lương từng nhân viên (tránh
-- lộ thông tin lương cá nhân lên kênh chung). Không mention @everyone.
--
-- Sau khi deploy migration này, set webhook URL trong Supabase SQL Editor:
--   INSERT INTO public.app_config (key, value)
--   VALUES ('discord_payroll_webhook', 'YOUR_WEBHOOK_URL')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.notify_payroll_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _discord_url  text;
  _emp_count    int;
  _total_net    numeric;
  _total_cost   numeric;
  _confirmer    text;
  _fmt_net      text;
  _fmt_cost     text;
BEGIN
  -- Chỉ fire khi status THỰC SỰ chuyển sang 'confirmed' (không fire khi update field khác,
  -- không fire khi confirmed → confirmed do save record lặt vặt)
  IF NEW.status <> 'confirmed' OR OLD.status IS NOT DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Đọc webhook URL từ app_config (SECURITY DEFINER bypasses RLS) — không gửi nếu chưa cấu hình
  SELECT value INTO _discord_url
  FROM   public.app_config
  WHERE  key = 'discord_payroll_webhook'
  LIMIT  1;

  IF _discord_url IS NULL OR _discord_url = '' THEN
    RETURN NEW;
  END IF;

  -- Tổng hợp số liệu toàn bộ record trong sheet
  SELECT COUNT(*), COALESCE(SUM(net_salary), 0), COALESCE(SUM(total_company_cost), 0)
  INTO   _emp_count, _total_net, _total_cost
  FROM   pay_payroll_records
  WHERE  sheet_id = NEW.id;

  -- Resolve tên người xác nhận
  SELECT COALESCE(e.full_name, u.email, '—')
  INTO   _confirmer
  FROM   auth.users u
  LEFT JOIN hr_employees e ON e.auth_user_id = u.id
  WHERE  u.id = NEW.confirmed_by
  LIMIT  1;

  _fmt_net  := replace(to_char(_total_net,  'FM999,999,999,999'), ',', '.') || ' đ';
  _fmt_cost := replace(to_char(_total_cost, 'FM999,999,999,999'), ',', '.') || ' đ';

  PERFORM net.http_post(
    url     := _discord_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'embeds', jsonb_build_array(
        jsonb_build_object(
          'title',  '💰 Bảng lương đã xác nhận — ' || COALESCE(NEW.title, ('Tháng ' || NEW.month || '/' || NEW.year)),
          'color',  16749824, -- #FF9500 brand
          'fields', jsonb_build_array(
            jsonb_build_object('name', '👥 Số nhân viên',        'value', _emp_count::text, 'inline', true),
            jsonb_build_object('name', '👤 Người xác nhận',      'value', COALESCE(_confirmer, '—'), 'inline', true),
            jsonb_build_object('name', '💵 Tổng lương Net',      'value', _fmt_net,  'inline', false),
            jsonb_build_object('name', '🏢 Tổng chi phí công ty', 'value', _fmt_cost, 'inline', false)
          ),
          'footer', jsonb_build_object(
            'text', 'TD Games Payroll • ' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
          )
        )
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_discord_confirmed ON pay_payroll_sheets;
CREATE TRIGGER trg_payroll_discord_confirmed
  AFTER UPDATE OF status ON pay_payroll_sheets
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed')
  EXECUTE FUNCTION public.notify_payroll_confirmed();
