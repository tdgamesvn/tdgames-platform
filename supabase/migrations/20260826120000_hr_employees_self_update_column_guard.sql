-- Khoá cột nhạy cảm khi nhân viên tự sửa hồ sơ.
--
-- Policy hr_employee_self_update chỉ kiểm tra ĐƯỢC ĐỘNG VÀO HÀNG NÀO, không kiểm tra
-- ĐƯỢC SỬA CỘT NÀO. Whitelist duy nhất trước giờ nằm ở client
-- (EMPLOYEE_EDITABLE_FIELDS trong apps/portal/services/portalService.ts) nên bất kỳ ai
-- cầm access token của chính mình gọi thẳng PostgREST đều ghi được status, type,
-- position, department_id, official_date, exclude_from_payroll... tức tự sửa dữ liệu
-- gốc của bảng lương và BHXH.
--
-- Danh sách dưới đây = EMPLOYEE_EDITABLE_FIELDS + onboarding_completed_at (handbook tự
-- bấm) + updated_at. Giữ đúng bằng client nên không luồng nào đổi hành vi.
-- ⚠ Thêm cột mới vào form Portal thì phải thêm vào CẢ HAI chỗ.
CREATE OR REPLACE FUNCTION public.hr_employees_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _allowed text[] := ARRAY[
    'full_name', 'email', 'phone', 'date_of_birth', 'gender', 'nationality',
    'address', 'temp_address', 'id_number', 'id_issue_date', 'id_issue_place',
    'avatar_url', 'id_card_front_url', 'id_card_back_url',
    'tax_code', 'insurance_number',
    'bank_name', 'bank_account', 'bank_branch',
    'vehicle_type', 'license_plate', 'vehicle_brand', 'vehicle_color',
    'onboarding_completed_at', 'updated_at'
  ];
BEGIN
  -- Edge Function (service_role) và pg_cron (postgres) đi cửa sau, không bị chặn.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN RETURN NEW; END IF;
  IF jwt_has_any_role(ARRAY['admin', 'hr', 'ke_toan']) THEN RETURN NEW; END IF;

  -- ponytail: ép cột ngoài whitelist về giá trị cũ thay vì RAISE. Client đã lọc sẵn nên
  -- request hợp lệ không bao giờ chạm nhánh này; ném lỗi chỉ tổ làm hỏng form khi sau này
  -- có ai gửi dư một cột. Muốn bắt kẻ dò API thì đổi thành RAISE và soi log.
  RETURN jsonb_populate_record(NEW, COALESCE((
    SELECT jsonb_object_agg(k, v)
    FROM jsonb_each(to_jsonb(OLD)) AS t(k, v)
    WHERE NOT (k = ANY(_allowed))
  ), '{}'::jsonb));
END;
$$;

DROP TRIGGER IF EXISTS hr_employees_guard_self_update ON public.hr_employees;
CREATE TRIGGER hr_employees_guard_self_update
  BEFORE UPDATE ON public.hr_employees
  FOR EACH ROW EXECUTE FUNCTION public.hr_employees_guard_self_update();
