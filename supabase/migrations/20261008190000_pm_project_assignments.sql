-- Phân quyền PM theo dự án. Admin gán dự án cho PM; PM CHƯA được gán dự án nào ⇒ xem tất cả
-- (giữ hành vi cũ, không ai mất quyền đột ngột); đã gán ⇒ chỉ thấy dự án được gán. Chặn ở DB
-- (view pm_tasks), không chỉ ẩn UI. Tên dự án = projectOf() trong projectService.ts:
-- folder ClickUp → project → list → '(Không rõ)' (chuỗi rỗng coi như không có).
CREATE TABLE IF NOT EXISTS public.pm_project_assignments (
  project    text NOT NULL,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project, user_id)
);
ALTER TABLE public.pm_project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_project_assignments_admin ON public.pm_project_assignments FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin'])) WITH CHECK (public.jwt_has_any_role(ARRAY['admin']));
CREATE POLICY pm_project_assignments_self_read ON public.pm_project_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.pm_can_see_project(p text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.jwt_has_any_role(ARRAY['admin'])
      OR NOT EXISTS (SELECT 1 FROM public.pm_project_assignments a WHERE a.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.pm_project_assignments a WHERE a.user_id = auth.uid() AND a.project = p);
$$;

CREATE OR REPLACE VIEW public.pm_tasks AS
  SELECT t.id, t.worker_id, t.project, t.client_name, t.title,
         t.clickup_task_id, t.clickup_list_id, t.clickup_status, t.status,
         t.start_date, t.due_date, t.completed_at, t.approved_at, t.closed_date,
         t.clickup_space_name, t.clickup_folder_name, t.clickup_list_name,
         t.clickup_updated_at, t.crm_project_id, t.created_at, t.updated_at,
         t.time_estimate_hours
  FROM public.wf_tasks t
  WHERE public.jwt_has_any_role(ARRAY['admin','pm'])
    AND public.pm_can_see_project(COALESCE(NULLIF(t.clickup_folder_name, ''), NULLIF(t.project, ''), NULLIF(t.clickup_list_name, ''), '(Không rõ)'));

-- Danh sách tài khoản PM cho admin gán dự án (auth.users không đọc được từ client).
CREATE OR REPLACE FUNCTION public.pm_list_pm_users()
RETURNS TABLE (user_id uuid, email text, full_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.jwt_has_any_role(ARRAY['admin']) THEN RAISE EXCEPTION 'Chỉ admin'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, COALESCE(e.full_name, u.raw_user_meta_data->>'username', u.email::text)
  FROM auth.users u LEFT JOIN public.hr_employees e ON e.auth_user_id = u.id
  WHERE (u.banned_until IS NULL OR u.banned_until < now())
    AND (u.raw_app_meta_data->>'role' = 'pm' OR COALESCE(u.raw_app_meta_data->'secondary_roles', '[]'::jsonb) ? 'pm')
  ORDER BY 3;
END $$;
REVOKE ALL ON FUNCTION public.pm_list_pm_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pm_list_pm_users() TO authenticated;
