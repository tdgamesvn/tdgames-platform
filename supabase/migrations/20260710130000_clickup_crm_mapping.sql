-- Đồng bộ Client/Project: CRM là source of truth, ClickUp map qua bảng mapping
-- Space → crm_clients, Folder → crm_projects

CREATE TABLE IF NOT EXISTS public.wf_clickup_crm_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clickup_type text NOT NULL CHECK (clickup_type IN ('space', 'folder')),
  clickup_name text NOT NULL,
  client_id uuid REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.crm_projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clickup_type, clickup_name)
);

ALTER TABLE public.wf_clickup_crm_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY wf_clickup_crm_map_authenticated_all ON public.wf_clickup_crm_map
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wf_clickup_crm_map_client ON public.wf_clickup_crm_map(client_id);
CREATE INDEX IF NOT EXISTS idx_wf_clickup_crm_map_project ON public.wf_clickup_crm_map(project_id);

-- FK trên nghiệm thu dự án (giữ client_name/project_name text để hiển thị + fallback)
ALTER TABLE public.wf_project_acceptances
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.crm_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.crm_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wf_pa_client ON public.wf_project_acceptances(client_id);
CREATE INDEX IF NOT EXISTS idx_wf_pa_project ON public.wf_project_acceptances(project_id);

-- Backfill 1 lần: match tên không phân biệt hoa thường; không match → để null
UPDATE public.wf_project_acceptances a
SET client_id = c.id
FROM public.crm_clients c
WHERE a.client_id IS NULL
  AND lower(trim(a.client_name)) = lower(trim(c.name));

UPDATE public.wf_project_acceptances a
SET project_id = p.id
FROM public.crm_projects p
WHERE a.project_id IS NULL
  AND lower(trim(a.project_name)) = lower(trim(p.name));

-- Seed mapping từ dữ liệu task đã sync + tên trùng CRM (đỡ phải map tay cái hiển nhiên)
INSERT INTO public.wf_clickup_crm_map (clickup_type, clickup_name, client_id)
SELECT DISTINCT 'space', t.clickup_space_name, c.id
FROM public.wf_tasks t
JOIN public.crm_clients c ON lower(trim(c.name)) = lower(trim(t.clickup_space_name))
WHERE t.clickup_space_name IS NOT NULL
ON CONFLICT (clickup_type, clickup_name) DO NOTHING;

INSERT INTO public.wf_clickup_crm_map (clickup_type, clickup_name, project_id)
SELECT DISTINCT 'folder', t.clickup_folder_name, p.id
FROM public.wf_tasks t
JOIN public.crm_projects p ON lower(trim(p.name)) = lower(trim(t.clickup_folder_name))
WHERE t.clickup_folder_name IS NOT NULL
ON CONFLICT (clickup_type, clickup_name) DO NOTHING;
