-- Việc 8 — SECURITY DEFINER RPC mở cho anon/authenticated.
--
-- Postgres mặc định GRANT EXECUTE ... TO PUBLIC cho mọi function mới. Cộng
-- SECURITY DEFINER (chạy quyền owner `postgres`, bỏ qua RLS) = ai cầm anon key
-- (lấy từ JS bundle, không cần đăng nhập) gọi được qua PostgREST `/rest/v1/rpc/...`.
--
-- Migration 20260509140002 đã revoke PUBLIC — nhưng bằng DANH SÁCH GÕ TAY.
-- 4 function tạo sau nó (20260513, 20260707, 20260803) không có trong danh sách
-- nên lọt lưới. Đó mới là gốc: danh sách tay không tự bao được function tương lai.
--
-- Chứng minh trước khi vá: `set local role anon` → `select find_auth_user_by_email(...)`
-- chạy lọt, không lỗi quyền.

-- ── GỐC: function tạo mới từ nay mặc định KHÔNG có PUBLIC EXECUTE ───────────
-- Quên grant ⇒ app lỗi "permission denied" ngay (hỏng to, thấy liền),
-- thay vì im lặng mở cho cả internet như 4 ca dưới.
alter default privileges in schema public revoke execute on functions from public;

-- ── NGỌN 1: không có caller nào từ client ⇒ cắt sạch anon + authenticated ───
-- Edge function dùng service_role (không bị ảnh hưởng), pg_cron chạy quyền postgres,
-- trigger nội bộ là SECURITY DEFINER owner postgres nên vẫn gọi được.

-- Trả nguyên 1 dòng auth.users (id, email, raw_user_meta_data chứa role/employee_id,
-- banned_until). anon dò được email ⇒ moi toàn bộ danh sách nhân viên.
-- Caller: manage-employee-auth + create-employee-auth, cả hai dùng supabaseAdmin.
revoke execute on function public.find_auth_user_by_email(text) from public, anon, authenticated;

-- Ghi đè accrued_days phép năm của TOÀN BỘ nhân viên fulltime. Caller: pg_cron.
revoke execute on function public.refresh_leave_balances(integer) from public, anon, authenticated;

-- Bơm hàng loạt notification cho nhân viên. Caller: pg_cron.
revoke execute on function public.send_eval_deadline_reminders() from public, anon, authenticated;

-- Caller: trigger trg_payroll_records_touch_expense (nội bộ).
revoke execute on function public.refresh_payroll_expense_for_sheet(uuid) from public, anon, authenticated;

-- So khớp mật khẩu invoice_accounts, không rate-limit ⇒ anon brute-force thoải mái.
-- ponytail: không có caller nào trong repo (chỉ còn trong migration cũ). Revoke chứ chưa
-- drop — drop hẳn khi xác nhận invoice_accounts là bảng chết.
revoke execute on function public.invoice_verify_login(text, text) from public, anon, authenticated;

-- ── NGỌN 2: có caller thật từ UI ⇒ cắt anon + chèn guard role vào thân hàm ──
-- Supabase chỉ có 3 role DB (anon/authenticated/service_role) nên không phân biệt
-- admin vs member bằng GRANT được — phải chặn trong thân hàm.

revoke execute on function public.sync_invoice_revenue() from public, anon;

create or replace function public.sync_invoice_revenue()
returns json language plpgsql security definer set search_path = public as $$
DECLARE
  v_inserted integer := 0;
  v_updated  integer := 0;
  v_inv      record;
  v_amount   numeric;
  v_date     date;
  v_cat_id   uuid := '868dbd1b-3187-43b5-a9dd-496191ac268a';
BEGIN
  IF NOT public.jwt_has_any_role(ARRAY['admin', 'ke_toan']) THEN
    RAISE EXCEPTION 'forbidden: sync_invoice_revenue';
  END IF;

  FOR v_inv IN
    SELECT * FROM invoice_invoices WHERE status = 'paid'
  LOOP
    v_amount := CASE
      WHEN v_inv.amount_received IS NOT NULL AND v_inv.amount_received > 0 THEN v_inv.amount_received
      ELSE COALESCE((
        SELECT SUM((item->>'quantity')::numeric * (item->>'unitPrice')::numeric)
        FROM jsonb_array_elements(v_inv.items) item
      ), 0)
    END;

    v_date := COALESCE(v_inv.paid_date, v_inv.issue_date, CURRENT_DATE);

    IF EXISTS (SELECT 1 FROM expense_expenses WHERE source_type = 'invoice' AND source_id = v_inv.id) THEN
      UPDATE expense_expenses
      SET amount       = v_amount,
          currency     = v_inv.currency,
          expense_date = v_date,
          client_name  = v_inv.client_name,
          title        = 'Doanh thu: ' || COALESCE(v_inv.client_name, 'Invoice #' || v_inv.invoice_number),
          updated_at   = now()
      WHERE source_type = 'invoice' AND source_id = v_inv.id;
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO expense_expenses (
        title, amount, currency, expense_date, category_id,
        client_name, vendor, status, type, source_type, source_id,
        created_by, notes
      ) VALUES (
        'Doanh thu: ' || COALESCE(v_inv.client_name, 'Invoice #' || v_inv.invoice_number),
        v_amount,
        v_inv.currency,
        v_date,
        v_cat_id,
        v_inv.client_name,
        '',
        'approved',
        'revenue',
        'invoice',
        v_inv.id,
        'system',
        'Sync từ Invoice #' || v_inv.invoice_number || COALESCE(' | ' || v_inv.client_name, '')
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('inserted', v_inserted, 'updated', v_updated);
END;
$$;

grant execute on function public.sync_invoice_revenue() to authenticated;

-- Xoá/tạo lại cron job ClickUp + ghi wf_clickup_config. Member gọi được = tắt được
-- auto-sync của cả công ty.
create or replace function public.update_clickup_sync_schedule(p_times text[], p_enabled boolean default true)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
DECLARE
  v_time text;
  v_hour int;
  v_minute int;
  v_utc_hour int;
  v_job_name text;
  v_count int := 0;
  v_fn_url text;
BEGIN
  IF NOT public.jwt_has_any_role(ARRAY['admin', 'ke_toan']) THEN
    RAISE EXCEPTION 'forbidden: update_clickup_sync_schedule';
  END IF;

  v_fn_url := 'https://fifuhkupaqcfjwyouwpa.supabase.co/functions/v1/clickup-auto-sync';

  DELETE FROM cron.job WHERE jobname LIKE 'clickup-auto-sync-%';

  IF NOT p_enabled THEN
    UPDATE wf_clickup_config SET auto_sync_times = p_times, auto_sync_enabled = false, updated_at = now();
    RETURN jsonb_build_object('ok', true, 'enabled', false, 'jobs_created', 0);
  END IF;

  FOREACH v_time IN ARRAY p_times
  LOOP
    v_hour := split_part(v_time, ':', 1)::int;
    v_minute := split_part(v_time, ':', 2)::int;
    v_utc_hour := (v_hour - 7 + 24) % 24;

    v_job_name := 'clickup-auto-sync-' || v_count;
    v_count := v_count + 1;

    PERFORM cron.schedule(
      v_job_name,
      v_minute || ' ' || v_utc_hour || ' * * *',
      format(
        'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json''), body := ''{}''::jsonb) AS request_id;',
        v_fn_url
      )
    );
  END LOOP;

  UPDATE wf_clickup_config SET auto_sync_times = p_times, auto_sync_enabled = p_enabled, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'enabled', true, 'jobs_created', v_count);
END;
$$;

revoke execute on function public.update_clickup_sync_schedule(text[], boolean) from public, anon;
grant execute on function public.update_clickup_sync_schedule(text[], boolean) to authenticated;
