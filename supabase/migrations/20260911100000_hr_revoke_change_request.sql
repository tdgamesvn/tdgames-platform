-- Thu hồi đơn đề xuất ĐÃ DUYỆT: đảo ngược những gì applyChanges (client) đã ghi.
-- Làm trong 1 RPC SECURITY DEFINER vì role `hr` không có quyền trên hr_employee_salary
-- (migration 20260807100000) và cần atomic — hỏng nửa chừng là lương/lịch sử lệch nhau.
--
-- Phạm vi: probation_end / salary_change / promotion / department_transfer.
-- ponytail: termination KHÔNG hỗ trợ — duyệt xong đã khoá auth qua edge function,
-- SQL không mở lại được. Cần thì thêm enableEmployeeLogin ở client sau khi RPC xong.

CREATE OR REPLACE FUNCTION public.hr_revoke_change_request(
  p_id          uuid,
  p_revoked_by  text,
  p_note        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r     public.hr_change_requests%ROWTYPE;
  snap  jsonb;
  sc    jsonb;
  eff   date;
BEGIN
  IF NOT public.jwt_has_any_role(ARRAY['admin', 'hr']) THEN
    RAISE EXCEPTION 'forbidden: hr_revoke_change_request';
  END IF;

  SELECT * INTO r FROM public.hr_change_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'approved' THEN
    RAISE EXCEPTION 'Đơn không tồn tại hoặc chưa được duyệt';
  END IF;
  IF r.request_type = 'termination' THEN
    RAISE EXCEPTION 'Đơn nghỉ việc không thu hồi được (tài khoản đã bị khoá) — xử lý tay';
  END IF;

  snap := COALESCE(r.current_snapshot, '{}'::jsonb);
  eff  := r.effective_date;

  -- ── Lương: chỉ đảo được khi CHƯA có thay đổi nào sau đơn này ──
  IF jsonb_array_length(COALESCE(r.changes->'salary_components', '[]'::jsonb)) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.hr_employee_salary
       WHERE employee_id = r.employee_id AND effective_from > eff
    ) THEN
      RAISE EXCEPTION 'Đã có thay đổi lương sau ngày % — không thu hồi tự động được', eff;
    END IF;

    FOR sc IN SELECT * FROM jsonb_array_elements(r.changes->'salary_components') LOOP
      -- xoá dòng mở tại ngày hiệu lực (kể cả dòng 0-ngày do "sửa đề xuất đã duyệt")
      DELETE FROM public.hr_employee_salary
       WHERE employee_id = r.employee_id
         AND component_id = (sc->>'component_id')::uuid
         AND effective_from = eff;
      -- mở lại dòng bị đóng đúng ngày đó
      UPDATE public.hr_employee_salary
         SET effective_to = NULL
       WHERE employee_id = r.employee_id
         AND component_id = (sc->>'component_id')::uuid
         AND effective_to = eff;
    END LOOP;
  END IF;

  -- ── Thông tin nhân sự về snapshot lúc tạo đơn ──
  CASE r.request_type
    WHEN 'probation_end' THEN
      UPDATE public.hr_employees
         SET official_date = (snap->>'official_date')::date
       WHERE id = r.employee_id;
      -- trigger trg_auto_leave_balance bỏ qua khi không còn ngày gốc ⇒ tự zero phép năm
      UPDATE public.leave_balances lb
         SET accrued_days = 0
        FROM public.hr_employees e
       WHERE lb.employee_id = e.id AND e.id = r.employee_id
         AND lb.quarter = 0 AND lb.year = EXTRACT(YEAR FROM eff)::int
         AND COALESCE(e.official_date, e.probation_end + 1) IS NULL;
    WHEN 'promotion' THEN
      UPDATE public.hr_employees
         SET position = snap->>'position', level = snap->>'level'
       WHERE id = r.employee_id;
    WHEN 'department_transfer' THEN
      UPDATE public.hr_employees
         SET department_id = (snap->>'department_id')::uuid
       WHERE id = r.employee_id;
    ELSE NULL;
  END CASE;

  -- ── Lịch sử vị trí do lần duyệt ghi ra ──
  DELETE FROM public.hr_position_history
   WHERE employee_id = r.employee_id
     AND effective_date = eff
     AND created_at >= COALESCE(r.approved_at, r.created_at);

  UPDATE public.hr_change_requests
     SET status = 'rejected',
         approved_by = p_revoked_by,
         approved_at = now(),
         approval_note = '[Thu hồi] ' || p_note
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_revoke_change_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_revoke_change_request(uuid, text, text) TO authenticated;
