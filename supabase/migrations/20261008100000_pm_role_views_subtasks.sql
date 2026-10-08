-- App "Dự án" cho role PM (secondary role 'pm') + admin.
-- Nguyên tắc: PM KHÔNG thấy tiền. wf_tasks chứa price/client_price/exchange_rate/bonus trong
-- cùng dòng — RLS không lọc được cột ⇒ PM KHÔNG có policy trên wf_*; chỉ đọc qua view pm_*
-- (security_invoker off: chạy quyền owner, tự lọc role trong WHERE) không chứa cột tiền.
-- Mẫu giống hr_employee_directory (20260807110000).

-- 1. Hạn chót task (ClickUp due_date) — sync điền dần, null = không đặt hạn.
ALTER TABLE public.wf_tasks ADD COLUMN IF NOT EXISTS due_date date;

-- 2. View không tiền
CREATE OR REPLACE VIEW public.pm_tasks AS
  SELECT t.id, t.worker_id, t.project, t.client_name, t.title,
         t.clickup_task_id, t.clickup_list_id, t.clickup_status, t.status,
         t.start_date, t.due_date, t.completed_at, t.approved_at, t.closed_date,
         t.clickup_space_name, t.clickup_folder_name, t.clickup_list_name,
         t.clickup_updated_at, t.crm_project_id, t.created_at, t.updated_at
  FROM public.wf_tasks t
  WHERE public.jwt_has_any_role(ARRAY['admin','pm']);

-- share_pct = tỷ lệ chia tiền ⇒ bỏ.
CREATE OR REPLACE VIEW public.pm_task_assignees AS
  SELECT a.task_id, a.worker_id
  FROM public.wf_task_assignees a
  WHERE public.jwt_has_any_role(ARRAY['admin','pm']);

-- Bỏ ngân hàng / MST / SĐT.
CREATE OR REPLACE VIEW public.pm_workers AS
  SELECT w.id, w.full_name, w.email, w.type, w.is_active, w.entity
  FROM public.wf_workers w
  WHERE public.jwt_has_any_role(ARRAY['admin','pm']);

CREATE OR REPLACE VIEW public.pm_task_status_log AS
  SELECT l.id, l.task_id, l.from_status, l.to_status, l.changed_at
  FROM public.wf_task_status_log l
  WHERE public.jwt_has_any_role(ARRAY['admin','pm']);

REVOKE ALL ON public.pm_tasks, public.pm_task_assignees, public.pm_workers, public.pm_task_status_log FROM PUBLIC, anon;
GRANT SELECT ON public.pm_tasks, public.pm_task_assignees, public.pm_workers, public.pm_task_status_log TO authenticated;

-- 3. Task phụ tạo trong app (ClickUp vẫn là nguồn chính)
CREATE TABLE IF NOT EXISTS public.pm_subtasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL CHECK (length(trim(title)) > 0),
  description         text,
  project             text,                                                   -- tên dự án / space
  parent_task_id      uuid REFERENCES public.wf_tasks(id) ON DELETE SET NULL, -- gắn task ClickUp (tuỳ chọn)
  assignee_worker_id  uuid REFERENCES public.wf_workers(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done','cancelled')),
  priority            text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  due_date            date,
  completed_at        timestamptz,
  entity              text DEFAULT 'TD GAMES',
  created_by          uuid DEFAULT auth.uid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pm_subtasks_parent_idx   ON public.pm_subtasks(parent_task_id);
CREATE INDEX IF NOT EXISTS pm_subtasks_assignee_idx ON public.pm_subtasks(assignee_worker_id);

ALTER TABLE public.pm_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_subtasks_manage ON public.pm_subtasks FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','pm']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','pm']));

CREATE OR REPLACE FUNCTION public.pm_subtasks_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pm_subtasks_touch ON public.pm_subtasks;
CREATE TRIGGER pm_subtasks_touch BEFORE INSERT OR UPDATE ON public.pm_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.pm_subtasks_touch();

-- 4. Vá kèm: 2 bảng đang cho MỌI user đăng nhập (kể cả freelancer) ghi.
--    Chỉ app Workforce (admin/ke_toan) dùng. wf_kpi_settings chứa mức phạt FIX (đụng tiền).
DROP POLICY IF EXISTS wf_clickup_crm_map_authenticated_all ON public.wf_clickup_crm_map;
CREATE POLICY wf_clickup_crm_map_staff_all ON public.wf_clickup_crm_map FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan'])) WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS wf_kpi_settings_authenticated_all ON public.wf_kpi_settings;
CREATE POLICY wf_kpi_settings_staff_all ON public.wf_kpi_settings FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan'])) WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
