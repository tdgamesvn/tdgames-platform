-- Danh bạ nội bộ: chặn freelancer đọc.
--
-- View cũ chỉ lọc AI ĐƯỢC HIỆN (active + fulltime/parttime + không ẩn) mà quên lọc
-- AI ĐƯỢC XEM. Cộng thêm `security_invoker=off` (view bỏ qua RLS của hr_employees) nên
-- BẤT KỲ tài khoản đăng nhập nào cũng đọc trọn danh bạ — gồm `date_of_birth` và `address`
-- (địa chỉ nhà) của toàn bộ nhân viên chính thức.
--
-- Đo trước khi vá: vai `freelancer` đọc được 10/10 dòng. Có 4 tài khoản freelancer thật.
-- Freelancer là người ngoài công ty, chỉ được xem nghiệm thu task của họ và hồ sơ của
-- chính họ — không có việc gì với địa chỉ nhà của nhân viên.
--
-- Giữ nguyên 12 cột: `date_of_birth` + `address` là TÍNH NĂNG (HandbookApp hiện 🎂 và 📍),
-- sếp đã chốt giữ. Xem .agent/meta/DECISIONS.md 2026-08-26. Chỉ siết NGƯỜI XEM.
--
-- ponytail: điều kiện dựa trên `type` của chính người gọi trong hr_employees, không dựa
-- trên role JWT. Lý do: role trong `app_metadata` có cả giá trị lạ ngoài dự tính
-- (`ke_toan_thue`), whitelist role sẽ âm thầm khoá nhầm người mỗi lần ai đó thêm role mới.
-- Nhánh is_staff() để admin/hr/ke_toan không có hồ sơ nhân viên vẫn xem được.
CREATE OR REPLACE VIEW public.hr_employee_directory AS
SELECT id, full_name, email, work_email, phone, "position", avatar_url, status, type,
       department_id, date_of_birth, address
FROM public.hr_employees
WHERE status = 'active'
  AND type = ANY (ARRAY['fulltime'::text, 'parttime'::text])
  AND is_hidden IS NOT TRUE
  AND (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.hr_employees me
      WHERE me.auth_user_id = (SELECT auth.uid())
        AND me.status = 'active'
        AND me.type = ANY (ARRAY['fulltime'::text, 'parttime'::text])
    )
  );
