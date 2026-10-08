-- Nhóm trạng thái "paused" (Tạm dừng) cho pending — sếp 08/10: pending có 2 kiểu
-- (1) khách báo dừng, (2) người làm bị điều sang task ưu tiên hơn ⇒ pending để KHÔNG cộng giờ.
-- Cả 2 đều không phải giờ làm; kiểu (2) là nội bộ nên không được tính "chờ khách".
-- paused: không tính giờ làm, không tính giờ chờ khách, không vào cảnh báo "Chờ khách lâu".
ALTER TABLE public.wf_status_categories DROP CONSTRAINT wf_status_categories_category_check;
ALTER TABLE public.wf_status_categories ADD CONSTRAINT wf_status_categories_category_check
  CHECK (category IN ('active','waiting_client','paused','not_started','done'));
UPDATE public.wf_status_categories SET category = 'paused', label = 'Tạm dừng', updated_at = now() WHERE status = 'pending';
