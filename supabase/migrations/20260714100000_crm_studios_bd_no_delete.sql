-- BD được thêm/sửa studio nhưng KHÔNG được xoá — chỉ admin/ke_toan mới xoá.
-- Tách policy FOR ALL cũ (crm_studios_staff) thành SELECT/INSERT/UPDATE (admin/ke_toan/bd)
-- + DELETE riêng (admin/ke_toan).
DROP POLICY IF EXISTS crm_studios_staff ON public.crm_studios;

CREATE POLICY crm_studios_select ON public.crm_studios
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

CREATE POLICY crm_studios_insert ON public.crm_studios
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

CREATE POLICY crm_studios_update ON public.crm_studios
  FOR UPDATE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

CREATE POLICY crm_studios_delete ON public.crm_studios
  FOR DELETE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
