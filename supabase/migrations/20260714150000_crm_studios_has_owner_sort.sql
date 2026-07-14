-- Sếp yêu cầu: studio đã có BD nhận phải tự nổi lên đầu danh sách (không cần filter thủ công).
-- Generated column để order-by được qua PostgREST (không order theo expression trực tiếp).
ALTER TABLE public.crm_studios ADD COLUMN has_owner boolean GENERATED ALWAYS AS (owner_id IS NOT NULL) STORED;
CREATE INDEX crm_studios_has_owner_idx ON public.crm_studios (has_owner, studio_name);
