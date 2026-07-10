-- Upload bản scan biên bản nghiệm thu đã ký (khoán việc + dự án)
ALTER TABLE public.wf_project_acceptances ADD COLUMN IF NOT EXISTS signed_file_url text;
ALTER TABLE public.wf_settlements ADD COLUMN IF NOT EXISTS signed_file_url text;
