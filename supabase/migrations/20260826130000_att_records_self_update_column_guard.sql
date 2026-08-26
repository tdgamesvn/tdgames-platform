-- Khoá cột nhạy cảm khi nhân viên tự sửa bản ghi chấm công + gộp guard thành 1 hàm dùng chung.
--
-- Cùng lỗ hổng vừa vá ở hr_employees: policy `att_records_member_update_checkout` tên là
-- "checkout" nhưng chỉ kiểm tra ĐƯỢC ĐỘNG VÀO HÀNG NÀO. Nhân viên gọi thẳng PostgREST bằng
-- token của mình sửa được cả `check_in` (xoá dấu đi muộn), `late_minutes`, `early_minutes`,
-- `overtime_minutes` (tự cộng giờ tăng ca), `status`, `approved_by`, `date`.
--
-- Luồng hợp lệ của member trên bảng này chỉ có đúng một thứ: ghi `check_out`
-- (attendanceService.ts:112 và :545). Sửa giờ vào/ra, OT, trạng thái đều là việc của HR và
-- đi qua policy `att_records_staff` (is_staff()).
--
-- Tiện thể bỏ hàm riêng của hr_employees, thay bằng một hàm chung nhận whitelist qua TG_ARGV
-- — hai bảng cùng một logic, không việc gì nhân bản thành hai.
CREATE OR REPLACE FUNCTION public.guard_self_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Edge Function (service_role) và pg_cron (postgres) đi cửa sau, không bị chặn.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN RETURN NEW; END IF;
  IF is_staff() THEN RETURN NEW; END IF;

  -- ponytail: ép cột ngoài whitelist về giá trị cũ thay vì RAISE. Client đã lọc sẵn nên
  -- request hợp lệ không bao giờ chạm nhánh này; ném lỗi chỉ tổ làm hỏng form khi sau này
  -- có ai gửi dư một cột. Muốn bắt kẻ dò API thì đổi thành RAISE và soi log.
  RETURN jsonb_populate_record(NEW, COALESCE((
    SELECT jsonb_object_agg(k, v)
    FROM jsonb_each(to_jsonb(OLD)) AS t(k, v)
    WHERE NOT (k = ANY(TG_ARGV[0]::text[]))
  ), '{}'::jsonb));
END;
$$;

-- hr_employees — whitelist = EMPLOYEE_EDITABLE_FIELDS (apps/portal/services/portalService.ts)
-- + onboarding_completed_at (handbook tự bấm) + updated_at.
-- ⚠ Thêm cột mới vào form Portal thì phải thêm vào CẢ HAI chỗ.
DROP TRIGGER IF EXISTS hr_employees_guard_self_update ON public.hr_employees;
CREATE TRIGGER hr_employees_guard_self_update
  BEFORE UPDATE ON public.hr_employees
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_update_columns(
    '{full_name,email,phone,date_of_birth,gender,nationality,address,temp_address,id_number,id_issue_date,id_issue_place,avatar_url,id_card_front_url,id_card_back_url,tax_code,insurance_number,bank_name,bank_account,bank_branch,vehicle_type,license_plate,vehicle_brand,vehicle_color,onboarding_completed_at,updated_at}'
  );

DROP FUNCTION IF EXISTS public.hr_employees_guard_self_update();

-- att_records — member chỉ được bấm giờ về.
-- ponytail: vẫn cho đặt check_out thành giờ bất kỳ, không ép phải là "bây giờ". Client bấm
-- lại nhiều lần là chuyện hợp lệ (attendanceService.ts:108 update đè), mà chốt theo now()
-- thì lệch đồng hồ máy khách là hỏng chấm công thật. Cột tính tiền (overtime_minutes) đã khoá.
DROP TRIGGER IF EXISTS att_records_guard_self_update ON public.att_records;
CREATE TRIGGER att_records_guard_self_update
  BEFORE UPDATE ON public.att_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_update_columns('{check_out}');
