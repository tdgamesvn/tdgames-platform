-- Bug: bất kỳ ai có role 'bd' (kể cả member/freelancer kiêm bd) đều có thể
-- gán studio cho BẤT KỲ ai qua dropdown "BD phụ trách", kể cả đổi chủ studio
-- đã có người take care. RLS crm_studios_update chỉ check role update được
-- bảng, không phân biệt được "đổi owner_id" khỏi các field khác.
-- Fix: trigger chặn ở tầng DB (không phụ thuộc UI) —
--   - admin/ke_toan: đổi owner_id/owner_name tự do.
--   - bd thường (không phải admin/ke_toan): chỉ được "nhận" studio đang
--     owner_id IS NULL, và chỉ được gán cho chính mình (không gán hộ người khác).
CREATE OR REPLACE FUNCTION public.guard_crm_studio_owner_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id THEN
    RETURN NEW; -- owner không đổi, không cần check gì thêm
  END IF;

  IF public.jwt_has_any_role(ARRAY['admin', 'ke_toan']) THEN
    RETURN NEW;
  END IF;

  IF OLD.owner_id IS NULL AND NEW.owner_id = auth.uid() THEN
    RETURN NEW; -- tự nhận studio chưa có ai take care
  END IF;

  RAISE EXCEPTION 'Chỉ Admin mới được đổi BD phụ trách. Bạn chỉ có thể tự nhận studio chưa có người phụ trách.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS crm_studios_owner_change_guard ON public.crm_studios;
CREATE TRIGGER crm_studios_owner_change_guard
  BEFORE UPDATE ON public.crm_studios
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_crm_studio_owner_change();
