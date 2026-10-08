-- Ước lượng thời gian ClickUp (time_estimate, ms) ⇒ giờ. So với giờ làm thật trong app Dự án.
ALTER TABLE public.wf_tasks ADD COLUMN IF NOT EXISTS time_estimate_hours numeric;
COMMENT ON COLUMN public.wf_tasks.time_estimate_hours IS 'ClickUp time_estimate (ms) quy ra giờ; null = không ước lượng. Sync bởi clickup-auto-sync.';
CREATE OR REPLACE VIEW public.pm_tasks AS
  SELECT t.id, t.worker_id, t.project, t.client_name, t.title,
         t.clickup_task_id, t.clickup_list_id, t.clickup_status, t.status,
         t.start_date, t.due_date, t.completed_at, t.approved_at, t.closed_date,
         t.clickup_space_name, t.clickup_folder_name, t.clickup_list_name,
         t.clickup_updated_at, t.crm_project_id, t.created_at, t.updated_at,
         t.time_estimate_hours
  FROM public.wf_tasks t WHERE public.jwt_has_any_role(ARRAY['admin','pm']);
