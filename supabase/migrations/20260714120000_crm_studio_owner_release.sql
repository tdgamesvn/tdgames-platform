-- Cho phép BD tự "bỏ nhận" (nhả) studio đang do chính mình phụ trách, để BD
-- khác nhận lại. Trigger guard_crm_studio_owner_change trước đó chỉ cho BD
-- thường tự NHẬN studio trống (OLD NULL -> NEW = self), chưa cho tự NHẢ
-- (OLD = self -> NEW NULL) nên bị RAISE EXCEPTION oan.
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

  IF OLD.owner_id = auth.uid() AND NEW.owner_id IS NULL THEN
    RETURN NEW; -- tự bỏ nhận studio đang phụ trách
  END IF;

  RAISE EXCEPTION 'Chỉ Admin mới được đổi BD phụ trách. Bạn chỉ có thể tự nhận/bỏ nhận studio của mình.'
    USING ERRCODE = '42501';
END;
$$;
