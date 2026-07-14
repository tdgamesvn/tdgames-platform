-- Sếp phát hiện: thêm khách hàng thủ công (crm_clients) không link được với studio nào
-- trong crm_studios (1000+ prospect pool) — 2 bảng hoàn toàn tách rời, gõ lại info từ đầu.
-- Bước 1: cho phép link — studio_id nullable, chưa bắt buộc (client vẫn tạo tay bình thường
-- không qua studio được, vd đối tác giới thiệu trực tiếp không nằm trong pool prospect).
ALTER TABLE public.crm_clients ADD COLUMN studio_id bigint REFERENCES public.crm_studios(id) ON DELETE SET NULL;
CREATE INDEX crm_clients_studio_id_idx ON public.crm_clients (studio_id);
