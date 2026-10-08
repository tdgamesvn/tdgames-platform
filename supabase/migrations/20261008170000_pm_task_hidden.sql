-- PM "Bỏ qua" task chết/không còn theo dõi (vd task bị bỏ trên ClickUp mà chưa đóng) khỏi các
-- danh sách cảnh báo (trễ hạn, đứng lâu, chưa ước lượng). Dùng chung cho mọi PM; hiện lại được.
CREATE TABLE IF NOT EXISTS public.pm_task_hidden (
  task_id    uuid PRIMARY KEY REFERENCES public.wf_tasks(id) ON DELETE CASCADE,
  reason     text,
  hidden_by  uuid DEFAULT auth.uid(),
  hidden_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pm_task_hidden ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_task_hidden_manage ON public.pm_task_hidden FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','pm'])) WITH CHECK (public.jwt_has_any_role(ARRAY['admin','pm']));
