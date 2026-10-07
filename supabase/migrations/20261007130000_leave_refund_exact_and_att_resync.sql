-- ══════════════════════════════════════════════════════════════════
-- 1. Hoàn phép đúng dòng đã trừ
--   Cũ: duyệt trừ carry-over (quarter=1) trước rồi mới tới quarter=0,
--       nhưng huỷ duyệt / xoá đơn lại hoàn TOÀN BỘ về quarter=0
--       ⇒ carry-over mất, phép năm nay dư. Xoá đơn còn hoàn ở client.
--   Mới: lưu phần trừ vào carry-over trên chính đơn (leave_carry_used),
--        hoàn lại đúng tỉ lệ đó. Xoá đơn đã duyệt → trigger DB tự hoàn.
--   Đơn duyệt trước migration có leave_carry_used = NULL ⇒ coi như 0
--   (đã kiểm tra: chưa dòng quarter=1 nào có used_days > 0).
--
-- 2. att_resync_for_dates: tính lại bảng công các tháng bị ảnh hưởng
--   ngay khi duyệt đơn (thay vì chờ cron đêm attendance-sync-nightly).
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.att_requests
  ADD COLUMN IF NOT EXISTS leave_carry_used numeric;

COMMENT ON COLUMN public.att_requests.leave_carry_used IS
  'Số ngày phép đã trừ vào carry-over (leave_balances quarter=1) khi duyệt — dùng để hoàn đúng dòng.';

-- Hoàn phép: carry-over phần đã trừ vào carry, còn lại về quarter=0.
CREATE OR REPLACE FUNCTION public.att_leave_refund(_emp uuid, _year integer, _days numeric, _carry numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_carry numeric := LEAST(GREATEST(COALESCE(_carry, 0), 0), _days);
BEGIN
  IF v_carry > 0 THEN
    UPDATE leave_balances
       SET used_days = GREATEST(0, used_days - v_carry)
     WHERE employee_id = _emp AND year = _year AND quarter = 1;
  END IF;

  IF _days - v_carry > 0 THEN
    UPDATE leave_balances
       SET used_days = GREATEST(0, used_days - (_days - v_carry))
     WHERE employee_id = _emp AND year = _year AND quarter = 0;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.att_leave_refund(uuid, integer, numeric, numeric) FROM PUBLIC, anon, authenticated;

-- BEFORE (thay vì AFTER) để ghi được NEW.leave_carry_used mà không phải UPDATE lại
-- att_requests (UPDATE lại sẽ kích hoạt trg_notify_leave_status lần 2).
CREATE OR REPLACE FUNCTION public.handle_leave_request_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year      integer;
  v_days      numeric;
  v_avail     numeric;
  v_co_avail  numeric;
  v_co_use    numeric := 0;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF NEW.leave_type = 'annual' THEN
      v_year := EXTRACT(YEAR FROM NEW.date_from)::integer;
      v_days := COALESCE(NEW.leave_days, 1);

      SELECT COALESCE(SUM(GREATEST(0, accrued_days - used_days - COALESCE(expired_days, 0))), 0)
        INTO v_avail
        FROM leave_balances
       WHERE employee_id = NEW.employee_id AND year = v_year AND quarter IN (0, 1);

      IF v_avail < v_days THEN
        RAISE EXCEPTION 'Không đủ ngày phép. Còn lại: % ngày, yêu cầu: % ngày', v_avail, v_days;
      END IF;

      SELECT GREATEST(0, accrued_days - used_days - COALESCE(expired_days, 0))
        INTO v_co_avail
        FROM leave_balances
       WHERE employee_id = NEW.employee_id AND year = v_year AND quarter = 1;

      IF COALESCE(v_co_avail, 0) > 0 THEN
        v_co_use := LEAST(v_days, v_co_avail);
        UPDATE leave_balances
           SET used_days = used_days + v_co_use
         WHERE employee_id = NEW.employee_id AND year = v_year AND quarter = 1;
      END IF;

      IF v_days - v_co_use > 0 THEN
        UPDATE leave_balances
           SET used_days = used_days + (v_days - v_co_use)
         WHERE employee_id = NEW.employee_id AND year = v_year AND quarter = 0;
      END IF;

      NEW.leave_carry_used := v_co_use;
    END IF;

  ELSIF OLD.status = 'approved' AND NEW.status IN ('rejected', 'cancelled', 'pending') THEN
    IF OLD.leave_type = 'annual' THEN
      PERFORM att_leave_refund(
        OLD.employee_id,
        EXTRACT(YEAR FROM OLD.date_from)::integer,
        COALESCE(OLD.leave_days, 1),
        OLD.leave_carry_used
      );
      NEW.leave_carry_used := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_request_status ON public.att_requests;
CREATE TRIGGER trg_leave_request_status
  BEFORE UPDATE OF status ON public.att_requests
  FOR EACH ROW WHEN (NEW.request_type = 'leave')
  EXECUTE FUNCTION public.handle_leave_request_status_change();

-- (Trigger hoàn phép khi XOÁ đơn nằm ở migration 20261007130100 — áp cùng lúc deploy
--  frontend bỏ đoạn hoàn phép phía client, tránh hoàn 2 lần.)

-- ── 2. Tính lại bảng công ngay cho các tháng [_from, _to] ──
-- Tháng hiện tại: att_sync_current_month (tự tạo bảng/dòng nếu chưa có).
-- Tháng khác: chỉ bảng đã tồn tại, chưa chốt, từ att_sync_from_month trở đi.
-- Không phải HR/admin → bỏ qua lặng lẽ (nhân viên tự xoá đơn ở Portal vẫn chạy được).
CREATE OR REPLACE FUNCTION public.att_resync_for_dates(_from date, _to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _today   date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _cur     date := date_trunc('month', _today)::date;
  _sync_fr text;
  _m       date;
  _sid     uuid;
  _n       integer := 0;
  _did_cur boolean := false;
BEGIN
  IF NOT is_staff() THEN RETURN 0; END IF;
  IF _from IS NULL THEN RETURN 0; END IF;
  _to := COALESCE(_to, _from);

  SELECT value INTO _sync_fr FROM app_config WHERE key = 'att_sync_from_month';
  _sync_fr := COALESCE(NULLIF(_sync_fr, ''), '2026-09');

  FOR _m IN
    SELECT generate_series(date_trunc('month', LEAST(_from, _to)),
                           date_trunc('month', GREATEST(_from, _to)),
                           interval '1 month')::date
  LOOP
    CONTINUE WHEN to_char(_m, 'YYYY-MM') < _sync_fr;

    -- att_sync_current_month đã lo cả tháng hiện tại lẫn tháng trước.
    IF _m >= (_cur - interval '1 month')::date AND _m <= _cur THEN
      IF NOT _did_cur THEN
        PERFORM att_sync_current_month();
        _did_cur := true;
        _n := _n + 1;
      END IF;
      CONTINUE;
    END IF;

    FOR _sid IN
      SELECT id FROM att_monthly_sheets
       WHERE year = extract(year FROM _m) AND month = extract(month FROM _m)
         AND status <> 'finalized'
    LOOP
      PERFORM att_sync_month_workdays(_sid);
      _n := _n + 1;
    END LOOP;
  END LOOP;

  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.att_resync_for_dates(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.att_resync_for_dates(date, date) TO authenticated;
