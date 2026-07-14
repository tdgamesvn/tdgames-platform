-- Bước 2/3 cụm fix "luồng CRM chưa match nhau": Deal chuyển sang Won không tự
-- tạo gì ở tab Dự án — BD phải nhớ tự tay qua tạo project, dễ quên.
-- Đặt logic ở tầng DB (trigger) thay vì app code vì có 3 đường ghi stage='won'
-- khác nhau (kéo thả kanban, dropdown detail panel, form sửa deal) — trigger
-- bắt được cả 3 mà không cần sửa từng nơi gọi.
ALTER TABLE public.crm_projects ADD COLUMN deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL;
CREATE INDEX crm_projects_deal_id_idx ON public.crm_projects (deal_id);

CREATE OR REPLACE FUNCTION public.auto_create_project_on_deal_won()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage = 'won' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'won') THEN
    -- Idempotent: đã có project cho deal này rồi thì thôi (tránh tạo trùng khi
    -- sửa deal đã Won nhiều lần — form luôn gửi lại stage hiện tại mỗi lần lưu).
    IF NOT EXISTS (SELECT 1 FROM public.crm_projects WHERE deal_id = NEW.id) THEN
      INSERT INTO public.crm_projects (client_id, deal_id, name, description, status, budget, currency)
      VALUES (
        NEW.client_id, NEW.id, NEW.title,
        'Tự động tạo khi deal "' || NEW.title || '" chuyển sang Won.',
        'active', NEW.value, NEW.currency
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_deals_auto_project_on_won ON public.crm_deals;
CREATE TRIGGER crm_deals_auto_project_on_won
  AFTER INSERT OR UPDATE ON public.crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_project_on_deal_won();
