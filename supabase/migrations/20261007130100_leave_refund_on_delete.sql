-- Xoá đơn phép năm đã duyệt → DB tự hoàn phép đúng dòng (carry-over / phép năm).
-- Trước đây client (deleteLeaveRequest) tự hoàn và chỉ hoàn về quarter=0.
-- ⚠ Áp migration này CÙNG LÚC deploy frontend đã bỏ đoạn hoàn phép phía client,
--   nếu không sẽ hoàn 2 lần.
CREATE OR REPLACE FUNCTION public.handle_leave_request_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'approved' AND OLD.leave_type = 'annual' THEN
    PERFORM att_leave_refund(
      OLD.employee_id,
      EXTRACT(YEAR FROM OLD.date_from)::integer,
      COALESCE(OLD.leave_days, 1),
      OLD.leave_carry_used
    );
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_leave_request_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_leave_request_delete ON public.att_requests;
CREATE TRIGGER trg_leave_request_delete
  AFTER DELETE ON public.att_requests
  FOR EACH ROW WHEN (OLD.request_type = 'leave')
  EXECUTE FUNCTION public.handle_leave_request_delete();
