-- PDF biên bản bàn giao đã ký (lưu trữ trên R2 / CDN)

ALTER TABLE public.hr_equipment_handovers
ADD COLUMN IF NOT EXISTS file_url text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.hr_equipment_handovers.file_url IS 'URL PDF biên bản đã ký để lưu trữ và tải về';
