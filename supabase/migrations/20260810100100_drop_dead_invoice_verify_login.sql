-- Nợ từ việc 8: hàm SECURITY DEFINER kiểm mật khẩu cho bảng `invoice_accounts`.
-- Bảng đã không còn tồn tại (login cũ thay bằng Supabase Auth) => hàm chỉ còn là mặt tấn công
-- chết (password oracle nếu bảng bị tạo lại). 0 caller trong repo. Không mất dữ liệu.
drop function if exists public.invoice_verify_login(text, text);
